// Recebe o webhook da Evolution API quando um aluno responde no WhatsApp.
// Configure a URL desta função como webhook da instância (evento
// "messages.upsert" / mensagens recebidas).
//
// Comportamento (conforme decidido): assim que o aluno responde qualquer
// coisa, a conversa sai do modo "lembrete" e vai para "conversando" — a
// etapa de IA respondendo de fato (Parte B) ainda não está implementada
// aqui, então por enquanto isso só sinaliza no painel que alguém precisa
// olhar/responder manualmente pela ficha do aluno.
//
// Atenção: o formato exato do payload varia por versão da Evolution API.
// Se o parsing abaixo não achar o texto/telefone, a função ainda loga o
// payload cru em sdr_mensagens (tipo mensagem_aluno, texto pode vir vazio)
// pra facilitar o ajuste — veja o campo "erro" nesse caso.
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

function extrairTelefoneETexto(payload: any): { telefone: string | null; texto: string | null } {
  // formatos comuns da Evolution API (baileys por baixo):
  // payload.data.key.remoteJid = "5511999999999@s.whatsapp.net"
  // payload.data.message.conversation = "texto"
  // payload.data.message.extendedTextMessage.text = "texto"
  const data = payload?.data ?? payload;
  const remoteJid: string | undefined = data?.key?.remoteJid;
  const telefone = remoteJid ? remoteJid.split("@")[0] : null;

  const texto: string | null =
    data?.message?.conversation ||
    data?.message?.extendedTextMessage?.text ||
    data?.message?.buttonsResponseMessage?.selectedButtonId ||
    null;

  return { telefone, texto };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  const admin = supabaseAdmin();
  const { telefone, texto } = extrairTelefoneETexto(payload);

  if (!telefone) {
    // não conseguimos identificar quem mandou — só loga pra investigar depois
    console.error("sdr-webhook: não achou telefone no payload", JSON.stringify(payload));
    return new Response(JSON.stringify({ ok: false, erro: "telefone não encontrado no payload" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const numeroLimpo = telefone.replace(/\D/g, "");
  // tenta achar o cliente por telefone (compara só os dígitos)
  const { data: clientes } = await admin.from("clientes").select("codigo,telefone");
  const cliente = (clientes || []).find(
    (c: { codigo: number; telefone: string | null }) =>
      c.telefone && c.telefone.replace(/\D/g, "").slice(-8) === numeroLimpo.slice(-8)
  );

  if (!cliente) {
    console.error(`sdr-webhook: nenhum cliente com telefone terminando em ${numeroLimpo.slice(-8)}`);
    return new Response(JSON.stringify({ ok: false, erro: "cliente não encontrado pelo telefone" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  await admin.from("sdr_mensagens").insert({
    cliente_codigo: cliente.codigo,
    direcao: "entrada",
    tipo: "mensagem_aluno",
    canal: "evolution",
    texto: texto || "(mensagem sem texto — anexo/áudio/figurinha)",
  });

  const { data: conversaAtual } = await admin
    .from("sdr_conversas")
    .select("modo")
    .eq("cliente_codigo", cliente.codigo)
    .single();

  const novoModo = !conversaAtual || conversaAtual.modo === "lembrete" ? "conversando" : conversaAtual.modo;

  await admin.from("sdr_conversas").upsert(
    {
      cliente_codigo: cliente.codigo,
      telefone,
      modo: novoModo,
      ultima_resposta_em: new Date().toISOString(),
    },
    { onConflict: "cliente_codigo" }
  );

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
