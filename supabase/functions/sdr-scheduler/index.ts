// Disparo automático — pensada pra rodar em cron (Supabase Scheduled
// Function, ex: a cada 30-60 min). Faz duas coisas:
//   1. Lembrete de agendamento: alunos com contrato mas sem sessão marcada
//      na agenda, seguindo a cadência configurável em sdr_lembretes.
//   2. Lembrete de sessão: alunos que já agendaram e a sessão está
//      chegando (evita falta), configurado em sdr_config.
//
// Não manda nada se o agente estiver desligado (sdr_config.ativo = false)
// ou fora da janela de horário configurada.
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { enviarWhatsapp, preencherTemplate, type Canal } from "../_shared/send.ts";

const TIMEZONE = "America/Sao_Paulo";

interface Contrato {
  nro_controle: string;
  instituicao: string;
  curso: string;
}
interface Cliente {
  codigo: number;
  nome_cliente: string;
  telefone: string | null;
  nro_controle: string | null;
}
interface AgendaRow {
  data: string | null;
  horario: string | null;
  nome_cliente: string | null;
  nro_controle_cliente: string | null;
}
interface SdrConversaRow {
  cliente_codigo: number;
  modo: string;
  etapa_lembrete: number;
  lembrete_sessao_enviado: boolean;
  criado_em: string;
}
interface SdrLembreteRow {
  ordem: number;
  dias_sem_agendar: number;
  template: string;
  ativo: boolean;
}

function chave(nroControle: string | null, nome: string | null): string {
  return `${(nroControle || "").trim()}|${(nome || "").trim().toLowerCase()}`;
}

function horaAgora(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function dentroDaJanela(inicio: string, fim: string): boolean {
  const agora = horaAgora();
  return agora >= inicio.slice(0, 5) && agora <= fim.slice(0, 5);
}

function diasEntre(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / 86400000);
}

Deno.serve(async () => {
  const admin = supabaseAdmin();
  const log: string[] = [];

  const { data: config } = await admin.from("sdr_config").select("*").eq("id", 1).single();
  if (!config || !config.ativo) {
    return json({ skipped: "agente desligado" });
  }
  if (!dentroDaJanela(config.janela_envio_inicio, config.janela_envio_fim)) {
    return json({ skipped: "fora da janela de envio" });
  }
  const canal = (config.canal as Canal) || "evolution";
  const canalConfig = {
    evolutionBaseUrl: config.evolution_base_url,
    evolutionInstance: config.evolution_instance,
    metaPhoneNumberId: config.meta_phone_number_id,
  };

  const [{ data: contratos }, { data: clientes }, { data: agenda }, { data: conversas }, { data: lembretes }] =
    await Promise.all([
      admin.from("contratos").select("nro_controle,instituicao,curso"),
      admin.from("clientes").select("codigo,nome_cliente,telefone,nro_controle"),
      admin.from("agenda").select("data,horario,nome_cliente,nro_controle_cliente"),
      admin.from("sdr_conversas").select("*"),
      admin.from("sdr_lembretes").select("*").eq("ativo", true).order("ordem", { ascending: true }),
    ]);

  const contratosByNro = new Map<string, Contrato>();
  (contratos as Contrato[] | null)?.forEach((c) => contratosByNro.set(c.nro_controle, c));

  const agendaByChave = new Map<string, AgendaRow[]>();
  (agenda as AgendaRow[] | null)?.forEach((a) => {
    const k = chave(a.nro_controle_cliente, a.nome_cliente);
    if (!agendaByChave.has(k)) agendaByChave.set(k, []);
    agendaByChave.get(k)!.push(a);
  });

  const conversaByCodigo = new Map<number, SdrConversaRow>();
  (conversas as SdrConversaRow[] | null)?.forEach((c) => conversaByCodigo.set(c.cliente_codigo, c));

  const etapas = (lembretes as SdrLembreteRow[] | null) || [];

  let enviados = 0;
  let sessaoEnviados = 0;
  let erros = 0;

  for (const c of (clientes as Cliente[] | null) || []) {
    const contrato = c.nro_controle ? contratosByNro.get(c.nro_controle) : undefined;
    const ags = agendaByChave.get(chave(c.nro_controle, c.nome_cliente)) || [];
    const agendado = ags.length > 0;

    let conversa = conversaByCodigo.get(c.codigo);
    if (!conversa) {
      const { data: nova } = await admin
        .from("sdr_conversas")
        .insert({ cliente_codigo: c.codigo, telefone: c.telefone })
        .select()
        .single();
      conversa = nova as SdrConversaRow;
      conversaByCodigo.set(c.codigo, conversa);
    }

    // --- lembrete de agendamento (quem ainda não marcou sessão) ---
    if (!agendado && conversa.modo === "lembrete") {
      const dias = diasEntre(conversa.criado_em);
      const proximaEtapa = etapas.find((e) => e.ordem === conversa.etapa_lembrete + 1);
      if (proximaEtapa && dias >= proximaEtapa.dias_sem_agendar) {
        const texto = preencherTemplate(proximaEtapa.template, {
          nome: c.nome_cliente,
          instituicao: contrato?.instituicao || "",
          curso: contrato?.curso || "",
        });
        const resultado = await enviarWhatsapp(c.telefone, texto, canal, canalConfig);
        await admin.from("sdr_mensagens").insert({
          cliente_codigo: c.codigo,
          direcao: "saida",
          tipo: "lembrete_agendamento",
          canal,
          texto,
          status_envio: resultado.ok ? "enviado" : "falhou",
          erro: resultado.erro || null,
        });
        if (resultado.ok) {
          await admin
            .from("sdr_conversas")
            .update({ etapa_lembrete: proximaEtapa.ordem, ultimo_contato_em: new Date().toISOString() })
            .eq("cliente_codigo", c.codigo);
          enviados++;
        } else {
          erros++;
          log.push(`falha lembrete_agendamento aluno ${c.codigo}: ${resultado.erro}`);
        }
      }
    }

    // --- lembrete de sessão (quem já agendou, sessão chegando) ---
    if (agendado && !conversa.lembrete_sessao_enviado) {
      const proxima = ags
        .filter((a) => a.data)
        .sort((a, b) => (a.data || "").localeCompare(b.data || ""))[0];
      if (proxima?.data) {
        const diasParaSessao = Math.ceil((new Date(proxima.data).getTime() - Date.now()) / 86400000);
        if (diasParaSessao >= 0 && diasParaSessao <= config.lembrete_sessao_dias_antes) {
          const texto = preencherTemplate(config.lembrete_sessao_template, {
            nome: c.nome_cliente,
            data_sessao: new Date(proxima.data).toLocaleDateString("pt-BR"),
            horario: proxima.horario || "",
          });
          const resultado = await enviarWhatsapp(c.telefone, texto, canal, canalConfig);
          await admin.from("sdr_mensagens").insert({
            cliente_codigo: c.codigo,
            direcao: "saida",
            tipo: "lembrete_sessao",
            canal,
            texto,
            status_envio: resultado.ok ? "enviado" : "falhou",
            erro: resultado.erro || null,
          });
          if (resultado.ok) {
            await admin
              .from("sdr_conversas")
              .update({ lembrete_sessao_enviado: true, ultimo_contato_em: new Date().toISOString() })
              .eq("cliente_codigo", c.codigo);
            sessaoEnviados++;
          } else {
            erros++;
            log.push(`falha lembrete_sessao aluno ${c.codigo}: ${resultado.erro}`);
          }
        }
      }
    }
  }

  return json({ enviados, sessaoEnviados, erros, log });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}
