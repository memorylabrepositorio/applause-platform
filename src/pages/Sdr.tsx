import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BackLink from "@/components/BackLink";
import { loadAtendimentoData } from "@/lib/atendimento/fetch";
import { fmtDateBR, type Aluno } from "@/lib/atendimento/engine";
import {
  deleteLembrete,
  enviarMensagemManual,
  loadConversas,
  loadLembretes,
  loadMensagens,
  loadSdrConfig,
  saveSdrConfig,
  setConversaModo,
  upsertLembrete,
} from "@/lib/sdr/fetch";
import {
  MODO_LABEL,
  conversaDoAluno,
  fmtDateTimeBR,
  previewTemplate,
  type SdrConfig,
  type SdrConversa,
  type SdrLembrete,
  type SdrMensagem,
  type SdrModo,
} from "@/lib/sdr/engine";

export default function Sdr() {
  const [alunos, setAlunos] = useState<Aluno[] | null>(null);
  const [config, setConfig] = useState<SdrConfig | null>(null);
  const [lembretes, setLembretes] = useState<SdrLembrete[]>([]);
  const [conversas, setConversas] = useState<SdrConversa[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState("");

  const [drawerCodigo, setDrawerCodigo] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<SdrMensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function refresh() {
    try {
      const [dataAtend, cfg, lemb, conv] = await Promise.all([
        loadAtendimentoData(),
        loadSdrConfig(),
        loadLembretes(),
        loadConversas(),
      ]);
      setAlunos(dataAtend.alunos);
      setConfig(cfg);
      setLembretes(lemb);
      setConversas(conv);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao carregar dados");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (drawerCodigo == null) return;
    loadMensagens(drawerCodigo).then(setMensagens).catch(() => setMensagens([]));
  }, [drawerCodigo]);

  const filaLembrete = useMemo(() => {
    if (!alunos) return [];
    return alunos
      .filter((a) => !a.agendado)
      .map((a) => ({ aluno: a, conversa: conversaDoAluno(conversas, a.codigo) }));
  }, [alunos, conversas]);

  const precisamAtencao = useMemo(
    () => filaLembrete.filter((r) => r.conversa.modo === "conversando" || r.conversa.modo === "escalado_humano"),
    [filaLembrete]
  );

  const drawerAluno = useMemo(
    () => (alunos && drawerCodigo != null ? alunos.find((a) => a.codigo === drawerCodigo) || null : null),
    [alunos, drawerCodigo]
  );
  const drawerConversa = drawerCodigo != null ? conversaDoAluno(conversas, drawerCodigo) : null;

  async function handleSaveConfig(patch: Partial<SdrConfig>) {
    if (!config) return;
    const merged = { ...config, ...patch };
    setConfig(merged);
    setSavingConfig(true);
    setConfigMsg("Salvando…");
    try {
      await saveSdrConfig(patch);
      setConfigMsg("Salvo às " + new Date().toLocaleTimeString("pt-BR"));
    } catch (e: unknown) {
      setConfigMsg("Erro ao salvar: " + (e instanceof Error ? e.message : "erro desconhecido"));
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleSaveLembrete(l: SdrLembrete) {
    try {
      const saved = await upsertLembrete(l);
      setLembretes((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
    } catch (e: unknown) {
      alert("Não foi possível salvar: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleAddLembrete() {
    const ordem = (lembretes[lembretes.length - 1]?.ordem || 0) + 1;
    try {
      const novo = await upsertLembrete({ ordem, dias_sem_agendar: 3, template: "", ativo: true });
      setLembretes((prev) => [...prev, novo]);
    } catch (e: unknown) {
      alert("Não foi possível criar: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleDeleteLembrete(id: number) {
    if (!confirm("Remover esse lembrete da cadência?")) return;
    try {
      await deleteLembrete(id);
      setLembretes((prev) => prev.filter((l) => l.id !== id));
    } catch (e: unknown) {
      alert("Não foi possível remover: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleSetModo(codigo: number, modo: SdrModo) {
    try {
      await setConversaModo(codigo, modo);
      setConversas((prev) => {
        const exists = prev.some((c) => c.cliente_codigo === codigo);
        if (exists) return prev.map((c) => (c.cliente_codigo === codigo ? { ...c, modo } : c));
        return [...prev, { ...conversaDoAluno(prev, codigo), cliente_codigo: codigo, modo }];
      });
    } catch (e: unknown) {
      alert("Não foi possível atualizar: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleEnviarMensagem() {
    if (!drawerAluno || !novaMensagem.trim()) return;
    setEnviando(true);
    try {
      await enviarMensagemManual(drawerAluno.codigo, novaMensagem.trim());
      setNovaMensagem("");
      const atualizadas = await loadMensagens(drawerAluno.codigo);
      setMensagens(atualizadas);
    } catch (e: unknown) {
      alert(
        "Não foi possível enviar: " +
          (e instanceof Error ? e.message : "erro desconhecido") +
          " (verifique se a Edge Function sdr-send já foi publicada)"
      );
    } finally {
      setEnviando(false);
    }
  }

  if (error && !alunos) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-900 text-ink-50">
        <p className="text-red-400">Não foi possível carregar os dados: {error}</p>
        <p className="max-w-md text-center text-sm text-ink-400">
          Se o erro mencionar as tabelas sdr_config/sdr_lembretes/sdr_conversas/sdr_mensagens, confirme se a
          migration 0003_sdr_schema.sql já foi rodada no SQL Editor do Supabase.
        </p>
        <Link to="/" className="text-brand-400 hover:text-brand-300">← Voltar</Link>
      </div>
    );
  }

  if (!alunos || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-ink-300">
        Carregando SDR…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-900 p-3 text-ink-50 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">SDR (Agente de IA)</h1>
          <p className="text-sm text-ink-400">
            Lembretes automáticos de agendamento por WhatsApp — {filaLembrete.length} aluno(s) na fila
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSaveConfig({ ativo: !config.ativo })}
            disabled={savingConfig}
            className={`rounded-md border px-2.5 py-1 text-sm font-medium ${
              config.ativo
                ? "border-emerald-700 bg-emerald-950 text-emerald-300"
                : "border-ink-600 bg-ink-850 text-ink-300"
            }`}
          >
            {config.ativo ? "● Agente ativo" : "○ Agente desligado"}
          </button>
          <Link to="/configuracoes" className="text-sm text-ink-300 hover:text-ink-50">
            ⚙ Configurações
          </Link>
        <BackLink />
        </div>
      </header>

      {!config.ativo && (
        <div className="mb-4 rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          O agente está desligado — nenhuma mensagem automática será enviada até você ativar aqui em cima.
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* configuração geral */}
        <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-ink-100">Configuração geral</p>
            <Link to="/configuracoes" className="text-xs text-brand-400 hover:text-brand-300">
              Canal, chaves de API e comportamento do agente →
            </Link>
          </div>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-ink-400">
              Canal ativo agora: <span className="text-ink-100">{config.canal === "meta" ? "API oficial da Meta" : "Evolution API"}</span>
            </p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-ink-400">Envia mensagens a partir de</label>
                <input
                  type="time"
                  value={config.janela_envio_inicio?.slice(0, 5) || "09:00"}
                  onChange={(e) => handleSaveConfig({ janela_envio_inicio: e.target.value })}
                  className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-ink-400">Até</label>
                <input
                  type="time"
                  value={config.janela_envio_fim?.slice(0, 5) || "19:00"}
                  onChange={(e) => handleSaveConfig({ janela_envio_fim: e.target.value })}
                  className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-400">
                Lembrete da sessão marcada — dias antes de enviar
              </label>
              <input
                type="number"
                min={0}
                value={config.lembrete_sessao_dias_antes}
                onChange={(e) => handleSaveConfig({ lembrete_sessao_dias_antes: Number(e.target.value) })}
                className="w-28 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-400">
                Mensagem do lembrete de sessão (use {"{{nome}}"}, {"{{data_sessao}}"}, {"{{horario}}"})
              </label>
              <textarea
                value={config.lembrete_sessao_template}
                onChange={(e) => setConfig((c) => (c ? { ...c, lembrete_sessao_template: e.target.value } : c))}
                onBlur={(e) => handleSaveConfig({ lembrete_sessao_template: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1"
              />
            </div>
            {configMsg && <p className="text-xs text-ink-400">{configMsg}</p>}
          </div>
        </div>

        {/* cadência de lembretes */}
        <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-ink-100">Cadência de lembretes (quem não agendou)</p>
            <button
              onClick={handleAddLembrete}
              className="rounded-md border border-ink-600 px-2 py-1 text-xs text-ink-100 hover:border-brand-600 hover:text-brand-300"
            >
              + Adicionar etapa
            </button>
          </div>
          <div className="max-h-[28rem] space-y-3 overflow-auto">
            {lembretes.map((l) => (
              <LembreteRow key={l.id} lembrete={l} onSave={handleSaveLembrete} onDelete={handleDeleteLembrete} />
            ))}
            {!lembretes.length && (
              <p className="text-sm text-ink-400">Nenhuma etapa configurada ainda.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* precisam de atenção */}
        <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
          <p className="mb-3 text-sm font-medium text-ink-100">
            Precisam de atenção ({precisamAtencao.length})
          </p>
          <div className="max-h-[28rem] space-y-2 overflow-auto">
            {!precisamAtencao.length && (
              <p className="text-sm text-ink-400">Ninguém respondeu ou foi escalado ainda.</p>
            )}
            {precisamAtencao.map(({ aluno, conversa }) => (
              <button
                key={aluno.codigo}
                onClick={() => setDrawerCodigo(aluno.codigo)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-amber-900 bg-amber-950/20 px-2.5 py-1.5 text-left hover:border-amber-700"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{aluno.nome}</p>
                  <p className="truncate text-xs text-ink-400">
                    {aluno.instituicao || "—"} · {MODO_LABEL[conversa.modo]}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs text-ink-400">
                  {fmtDateTimeBR(conversa.ultima_resposta_em)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* fila de lembrete */}
        <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
          <p className="mb-3 text-sm font-medium text-ink-100">
            Fila de lembrete automático ({filaLembrete.length})
          </p>
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ink-850">
                <tr className="border-b border-ink-800 text-left text-xs uppercase text-ink-400">
                  <th className="py-2">Aluno</th>
                  <th className="py-2">Instituição</th>
                  <th className="py-2">Etapa</th>
                  <th className="py-2">Modo</th>
                  <th className="py-2">Último contato</th>
                </tr>
              </thead>
              <tbody>
                {filaLembrete.slice(0, 300).map(({ aluno, conversa }) => (
                  <tr
                    key={aluno.codigo}
                    onClick={() => setDrawerCodigo(aluno.codigo)}
                    className="cursor-pointer border-b border-ink-800/50 hover:bg-ink-800/50"
                  >
                    <td className="py-2">{aluno.nome}</td>
                    <td className="py-2">{aluno.instituicao || "—"}</td>
                    <td className="py-2">{conversa.etapa_lembrete}</td>
                    <td className="py-2">{MODO_LABEL[conversa.modo]}</td>
                    <td className="py-2">{fmtDateTimeBR(conversa.ultimo_contato_em) || "—"}</td>
                  </tr>
                ))}
                {!filaLembrete.length && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-ink-400">
                      Nenhum aluno pendente de agendamento no momento. 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* drawer de conversa */}
      {drawerAluno && (
        <>
          <div onClick={() => setDrawerCodigo(null)} className="fixed inset-0 z-40 bg-black/60" />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-auto border-l border-ink-800 bg-ink-900 p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{drawerAluno.nome}</h2>
                <p className="text-sm text-ink-400">
                  {drawerAluno.instituicao || "—"}
                  {drawerAluno.curso ? ` · ${drawerAluno.curso}` : ""}
                </p>
              </div>
              <button onClick={() => setDrawerCodigo(null)} className="text-ink-400 hover:text-ink-50">
                ✕
              </button>
            </div>

            {drawerConversa && (
              <div className="mb-4 flex flex-wrap gap-2">
                {(["lembrete", "conversando", "escalado_humano", "pausado"] as SdrModo[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleSetModo(drawerAluno.codigo, m)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      drawerConversa.modo === m
                        ? "border-brand-600 bg-brand-950 text-brand-300"
                        : "border-ink-600 text-ink-300"
                    }`}
                  >
                    {MODO_LABEL[m]}
                  </button>
                ))}
              </div>
            )}

            <div className="mb-4 flex-1 space-y-2 overflow-auto rounded-lg border border-ink-800 bg-ink-850 p-3">
              {mensagens.length ? (
                mensagens.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm ${
                      m.direcao === "saida"
                        ? "ml-auto bg-brand-950 text-brand-100"
                        : "bg-ink-800 text-ink-50"
                    }`}
                  >
                    <p>{m.texto}</p>
                    <p className="mt-1 text-xs opacity-60">
                      {fmtDateTimeBR(m.criado_em)} · {m.tipo}
                      {m.status_envio ? ` · ${m.status_envio}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-400">Nenhuma mensagem trocada ainda.</p>
              )}
            </div>

            <div className="flex gap-2">
              <input
                value={novaMensagem}
                onChange={(e) => setNovaMensagem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEnviarMensagem()}
                placeholder="Responder pelo WhatsApp…"
                className="min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
              />
              <button
                onClick={handleEnviarMensagem}
                disabled={enviando || !novaMensagem.trim()}
                className="rounded-md bg-brand-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LembreteRow({
  lembrete,
  onSave,
  onDelete,
}: {
  lembrete: SdrLembrete;
  onSave: (l: SdrLembrete) => void;
  onDelete: (id: number) => void;
}) {
  const [local, setLocal] = useState(lembrete);
  const dirty = JSON.stringify(local) !== JSON.stringify(lembrete);

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs text-ink-400">Etapa {local.ordem}</span>
        <label className="ml-auto flex items-center gap-1 text-xs text-ink-300">
          <input
            type="checkbox"
            checked={local.ativo}
            onChange={(e) => setLocal((l) => ({ ...l, ativo: e.target.checked }))}
          />
          ativo
        </label>
        <button onClick={() => onDelete(lembrete.id)} className="text-ink-500 hover:text-red-400" title="Remover">
          ✕
        </button>
      </div>
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span className="text-ink-400">Enviar após</span>
        <input
          type="number"
          min={0}
          value={local.dias_sem_agendar}
          onChange={(e) => setLocal((l) => ({ ...l, dias_sem_agendar: Number(e.target.value) }))}
          className="w-16 rounded-md border border-ink-600 bg-ink-800 px-2 py-1"
        />
        <span className="text-ink-400">dias sem agendar</span>
      </div>
      <textarea
        value={local.template}
        onChange={(e) => setLocal((l) => ({ ...l, template: e.target.value }))}
        placeholder="Use {{nome}}, {{instituicao}}, {{curso}}…"
        rows={3}
        className="mb-2 w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
      />
      <p className="mb-2 text-xs italic text-ink-500">
        {previewTemplate(local.template, { nome: "Maria", instituicao: "Instituição X", curso: "Curso Y" }) ||
          "Pré-visualização aparece aqui…"}
      </p>
      {dirty && (
        <button
          onClick={() => onSave(local)}
          className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-500"
        >
          Salvar etapa
        </button>
      )}
    </div>
  );
}
