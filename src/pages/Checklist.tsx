import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadContratos, loadEventos, createChecklistFromContrato, updateChecklist, deleteChecklist } from "@/lib/checklist/fetch";
import {
  ALL_FIELD_KEYS,
  SECTIONS,
  SEM_PERIODO,
  anoDoContrato,
  checklistDoContrato,
  fmtDateBR,
  progressOf,
  type ChecklistEvento,
  type ContratoRow,
} from "@/lib/checklist/engine";

type StatusKind = "ok" | "err" | null;

export default function Checklist() {
  const [eventos, setEventos] = useState<ChecklistEvento[] | null>(null);
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<StatusKind>(null);
  const [statusText, setStatusText] = useState("Carregando…");

  const [searchTerm, setSearchTerm] = useState("");
  const [instituicaoTerm, setInstituicaoTerm] = useState("");
  const [instituicaoSelecionada, setInstituicaoSelecionada] = useState<string | null>(null);
  const [anoSelecionado, setAnoSelecionado] = useState("");

  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh(manual = false) {
    if (manual) {
      setStatusKind(null);
      setStatusText("Atualizando…");
    }
    try {
      const [ev, ct] = await Promise.all([loadEventos(), loadContratos()]);
      setEventos(ev);
      setContratos(ct);
      setStatusKind("ok");
      setStatusText("Atualizado " + new Date().toLocaleTimeString("pt-BR"));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao carregar dados";
      setLoadError(msg);
      setStatusKind("err");
      setStatusText("Falha ao carregar");
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      if (currentId === null) refresh();
    }, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const currentEvento = useMemo(
    () => (eventos && currentId != null ? eventos.find((e) => e.id === currentId) || null : null),
    [eventos, currentId]
  );

  function openEvento(id: number) {
    const evento = eventos?.find((e) => e.id === id);
    if (!evento) return;
    const values: Record<string, string> = {};
    ALL_FIELD_KEYS.forEach((k) => {
      values[k] = evento[k] != null ? String(evento[k]) : "";
    });
    setFormValues(values);
    setCurrentId(id);
    setSaveStatus("");
  }

  function closeForm() {
    setCurrentId(null);
    setFormValues({});
  }

  async function handleSave() {
    if (!currentEvento) return;
    const filled = ALL_FIELD_KEYS.every((k) => formValues[k] && formValues[k].trim());
    const status = filled ? "completo" : "em_andamento";
    const payload: Record<string, unknown> = {};
    ALL_FIELD_KEYS.forEach((k) => {
      payload[k] = formValues[k] || null;
    });
    payload.status = status;

    setSaving(true);
    setSaveStatus("Salvando…");
    try {
      await updateChecklist(currentEvento.id, payload);
      setEventos((prev) =>
        prev ? prev.map((e) => (e.id === currentEvento.id ? ({ ...e, ...payload } as ChecklistEvento) : e)) : prev
      );
      setSaveStatus("Salvo às " + new Date().toLocaleTimeString("pt-BR"));
    } catch (e: unknown) {
      setSaveStatus("Erro ao salvar: " + (e instanceof Error ? e.message : "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemover(id: number) {
    const evento = eventos?.find((e) => e.id === id);
    if (!evento) return;
    const label = evento.instituicao + (evento.turma ? " — " + evento.turma : "") + (evento.curso ? ` (${evento.curso})` : "");
    if (!confirm(`Remover o checklist de "${label}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteChecklist(id);
      setEventos((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
      if (currentId === id) closeForm();
    } catch (e: unknown) {
      alert("Não foi possível remover: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleAbrirOuCriar(contrato: ContratoRow) {
    const existente = eventos ? checklistDoContrato(eventos, contrato.nro_controle) : undefined;
    if (existente) {
      openEvento(existente.id);
      return;
    }
    try {
      const novo = await createChecklistFromContrato(contrato);
      setEventos((prev) => (prev ? [novo, ...prev] : [novo]));
      openEvento(novo.id);
    } catch (e: unknown) {
      alert("Não foi possível criar o checklist: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  // ---------- listas derivadas ----------

  const eventosFiltrados = useMemo(() => {
    if (!eventos) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return eventos;
    return eventos.filter((e) =>
      [e.instituicao, e.turma, e.curso].some((v) => v && String(v).toLowerCase().includes(term))
    );
  }, [eventos, searchTerm]);

  const contratosDoAno = useMemo(() => {
    if (!anoSelecionado) return contratos;
    if (anoSelecionado === SEM_PERIODO) return contratos.filter((c) => !anoDoContrato(c.ano_periodo));
    return contratos.filter((c) => anoDoContrato(c.ano_periodo) === anoSelecionado);
  }, [contratos, anoSelecionado]);

  const anos = useMemo(() => {
    const set = new Set<string>();
    let temSemPeriodo = false;
    contratos.forEach((c) => {
      const ano = anoDoContrato(c.ano_periodo);
      if (ano) set.add(ano);
      else if (c.ano_periodo) temSemPeriodo = true;
    });
    const lista = Array.from(set).sort((a, b) => b.localeCompare(a, "pt-BR", { numeric: true }));
    return { lista, temSemPeriodo };
  }, [contratos]);

  const instituicoes = useMemo(() => {
    const term = instituicaoTerm.trim().toLowerCase();
    const counts: Record<string, number> = {};
    contratosDoAno.forEach((c) => {
      const inst = (c.instituicao || "").trim();
      if (!inst) return;
      counts[inst] = (counts[inst] || 0) + 1;
    });
    const lista = Object.keys(counts)
      .filter((inst) => !term || inst.toLowerCase().includes(term))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { lista, counts };
  }, [contratosDoAno, instituicaoTerm]);

  const contratosDaInstituicao = useMemo(() => {
    if (!instituicaoSelecionada) return [];
    return contratosDoAno
      .filter((c) => (c.instituicao || "").trim() === instituicaoSelecionada)
      .sort((a, b) => (b.ano_periodo || "").localeCompare(a.ano_periodo || ""));
  }, [contratosDoAno, instituicaoSelecionada]);

  if (loadError && !eventos) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-slate-100">
        <p className="text-red-400">Não foi possível carregar os dados: {loadError}</p>
        <Link to="/" className="text-indigo-400 hover:text-indigo-300">← Voltar</Link>
      </div>
    );
  }

  if (!eventos) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Carregando checklists…
      </div>
    );
  }

  // ---------- view: formulário ----------
  if (currentEvento) {
    const pct = progressOf({ ...currentEvento, ...formValues } as ChecklistEvento);
    const completo = pct === 100;
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <button onClick={closeForm} className="mb-2 text-sm text-slate-400 hover:text-slate-200">
              ← Voltar para a lista
            </button>
            <h1 className="text-xl font-semibold">
              {currentEvento.instituicao}
              {currentEvento.turma ? ` — ${currentEvento.turma}` : ""}
            </h1>
            <p className="text-sm text-slate-500">
              {currentEvento.curso || "sem curso definido"}
              {currentEvento.data_evento ? ` · ${fmtDateBR(currentEvento.data_evento)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge completo={completo} pct={pct} />
            <button
              onClick={() => handleRemover(currentEvento.id)}
              className="rounded-md border border-red-900 bg-red-950/50 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950"
            >
              Remover
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </header>

        {saveStatus && <p className="mb-4 text-sm text-slate-400">{saveStatus}</p>}

        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.title} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-300">{section.title}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.fields.map((f) => {
                  const val = formValues[f.key] || "";
                  const filled = val.trim().length > 0;
                  const wrapClass = f.long ? "sm:col-span-2 lg:col-span-3" : "";
                  return (
                    <div key={f.key} className={wrapClass}>
                      <label className="mb-1 block text-xs text-slate-500">{f.label}</label>
                      {f.long ? (
                        <textarea
                          value={val}
                          onChange={(e) => setFormValues((v) => ({ ...v, [f.key]: e.target.value }))}
                          rows={3}
                          className={`w-full rounded-md border px-3 py-1.5 text-sm ${
                            filled ? "border-indigo-800 bg-slate-800" : "border-slate-700 bg-slate-900"
                          }`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => setFormValues((v) => ({ ...v, [f.key]: e.target.value }))}
                          className={`w-full rounded-md border px-3 py-1.5 text-sm ${
                            filled ? "border-indigo-800 bg-slate-800" : "border-slate-700 bg-slate-900"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------- view: lista ----------
  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Checklist de Solenidade</h1>
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                statusKind === "ok" ? "bg-emerald-500" : statusKind === "err" ? "bg-red-500" : "bg-slate-600"
              }`}
            />
            {statusText}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refresh(true)} className="text-sm text-slate-400 hover:text-slate-200">
            ↻ Atualizar
          </button>
          <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Painel principal
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* novo checklist a partir de contrato */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="mb-3 text-sm font-medium text-slate-300">Novo checklist a partir de contrato</p>
          <div className="mb-3 flex flex-wrap gap-2">
            <select
              value={anoSelecionado}
              onChange={(e) => setAnoSelecionado(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm"
            >
              <option value="">Todos os anos</option>
              {anos.lista.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
              {anos.temSemPeriodo && <option value={SEM_PERIODO}>Sem período definido</option>}
            </select>
            <button
              onClick={() => {
                setAnoSelecionado("");
                setInstituicaoTerm("");
                setInstituicaoSelecionada(null);
              }}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
            >
              Limpar filtros
            </button>
          </div>
          <input
            value={instituicaoTerm}
            onChange={(e) => setInstituicaoTerm(e.target.value)}
            placeholder="Buscar instituição…"
            className="mb-2 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm"
          />
          <select
            value={instituicaoSelecionada || ""}
            onChange={(e) => setInstituicaoSelecionada(e.target.value || null)}
            className="mb-3 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm"
          >
            <option value="">Selecione a instituição…</option>
            {instituicoes.lista.map((inst) => (
              <option key={inst} value={inst}>
                {inst} ({instituicoes.counts[inst]} contrato(s))
              </option>
            ))}
          </select>

          {instituicaoSelecionada && (
            <div className="max-h-80 space-y-2 overflow-auto">
              {!contratosDaInstituicao.length && (
                <p className="text-sm text-slate-500">Nenhum contrato encontrado pra essa instituição.</p>
              )}
              {contratosDaInstituicao.map((c) => {
                const existente = checklistDoContrato(eventos, c.nro_controle);
                return (
                  <button
                    key={c.nro_controle}
                    onClick={() => handleAbrirOuCriar(c)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-left hover:border-slate-700"
                  >
                    <div>
                      <p className="text-sm">{c.curso || "(sem curso)"}</p>
                      <p className="text-xs text-slate-500">
                        {c.ano_periodo || ""} · Nº controle {c.nro_controle}
                        {c.qtde_clientes ? ` · ${c.qtde_clientes} alunos` : ""}
                      </p>
                    </div>
                    {existente ? (
                      <StatusBadge completo={existente.status === "completo"} pct={progressOf(existente)} compact />
                    ) : (
                      <span className="whitespace-nowrap rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
                        Começar checklist
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* lista de checklists existentes */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-300">
              Checklists ({eventosFiltrados.length})
            </p>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar instituição, turma, curso…"
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="max-h-[32rem] space-y-2 overflow-auto">
            {!eventosFiltrados.length && <p className="text-sm text-slate-500">Nenhum evento encontrado.</p>}
            {eventosFiltrados.map((e) => {
              const pct = progressOf(e);
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                >
                  <button onClick={() => openEvento(e.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm">
                      {e.instituicao}
                      {e.turma ? ` — ${e.turma}` : ""}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {e.curso || ""}
                      {e.data_evento ? ` · ${fmtDateBR(e.data_evento)}` : ""}
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="hidden h-1.5 w-20 rounded-full bg-slate-800 sm:block">
                      <div className="h-1.5 rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs text-slate-500">{pct}%</span>
                    <StatusBadge completo={e.status === "completo"} pct={pct} compact />
                    <button
                      onClick={() => handleRemover(e.id)}
                      title="Remover checklist"
                      aria-label="Remover checklist"
                      className="text-slate-600 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ completo, pct, compact }: { completo: boolean; pct: number; compact?: boolean }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${
        completo ? "border-emerald-800 bg-emerald-950 text-emerald-300" : "border-amber-800 bg-amber-950 text-amber-300"
      }`}
    >
      {completo ? "Completo" : "Em andamento"}
      {!compact ? ` · ${pct}%` : ""}
    </span>
  );
}
