import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import {
  concluirTarefa,
  criarNota,
  criarTarefa,
  getCurrentUserEmail,
  loadAtendimentoData,
  type AtendimentoData,
} from "@/lib/atendimento/fetch";
import {
  EMPTY_FILTERS,
  SEM_PERIODO,
  anoDoAluno,
  applyFilters,
  exportAlunosCSV,
  fmtDateBR,
  fmtDateTimeBR,
  sortAlunos,
  tarefasGlobaisPendentes,
  todayISO,
  type Aluno,
  type Filters,
  type SortKey,
} from "@/lib/atendimento/engine";

const ALUNO_COLS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: "nome", label: "Nome" },
  { key: "cpf", label: "CPF" },
  { key: "telefone", label: "Telefone" },
  { key: "instituicao", label: "Instituição" },
  { key: "curso", label: "Curso" },
  { key: "status", label: "Status" },
  { key: "agendado", label: "Agendado" },
  { key: "atendido", label: "Atendido" },
  { key: "tarefasPendentes", label: "Tarefas", num: true },
];

const RENDER_CAP = 500;

export default function Atendimento() {
  const [data, setData] = useState<AtendimentoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Carregando…");
  const [statusKind, setStatusKind] = useState<"ok" | "err" | null>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "nome", dir: "asc" });

  const [orfaosOpen, setOrfaosOpen] = useState(false);
  const [orfaosFilter, setOrfaosFilter] = useState("");

  const [drawerCodigo, setDrawerCodigo] = useState<number | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");

  const [novaTarefaMotivo, setNovaTarefaMotivo] = useState("");
  const [novaTarefaPrazo, setNovaTarefaPrazo] = useState("");
  const [novaNotaTexto, setNovaNotaTexto] = useState("");
  const [novaNotaTipo, setNovaNotaTipo] = useState("contato");

  async function refresh(manual = false) {
    if (manual) {
      setStatusKind(null);
      setStatusText("Atualizando…");
    }
    try {
      const d = await loadAtendimentoData();
      setData(d);
      setStatusKind("ok");
      setStatusText("Atualizado " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao carregar dados");
      setStatusKind("err");
      setStatusText("Falha ao carregar");
    }
  }

  useEffect(() => {
    refresh();
    getCurrentUserEmail().then(setCurrentUserEmail);
    const t = setInterval(() => {
      if (drawerCodigo === null) refresh();
    }, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerCodigo]);

  const alunosDoAno = useMemo(() => {
    if (!data) return [];
    if (!filters.ano) return data.alunos;
    if (filters.ano === SEM_PERIODO) return data.alunos.filter((a) => !anoDoAluno(a.ano_periodo));
    return data.alunos.filter((a) => anoDoAluno(a.ano_periodo) === filters.ano);
  }, [data, filters.ano]);

  const anos = useMemo(() => {
    if (!data) return { lista: [] as string[], temSemPeriodo: false };
    const set = new Set<string>();
    let temSemPeriodo = false;
    data.alunos.forEach((a) => {
      const ano = anoDoAluno(a.ano_periodo);
      if (ano) set.add(ano);
      else if (a.ano_periodo) temSemPeriodo = true;
    });
    return { lista: Array.from(set).sort((a, b) => b.localeCompare(a, "pt-BR", { numeric: true })), temSemPeriodo };
  }, [data]);

  const instituicoes = useMemo(() => {
    const counts: Record<string, number> = {};
    alunosDoAno.forEach((a) => {
      if (a.instituicao) counts[a.instituicao] = (counts[a.instituicao] || 0) + 1;
    });
    return Object.keys(counts)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((inst) => ({ inst, count: counts[inst] }));
  }, [alunosDoAno]);

  const filtrados = useMemo(() => (data ? applyFilters(data.alunos, filters) : []), [data, filters]);
  const ordenados = useMemo(() => sortAlunos(filtrados, sort.key, sort.dir), [filtrados, sort]);

  const kpis = useMemo(() => {
    const total = filtrados.length;
    const agendados = filtrados.filter((a) => a.agendado).length;
    const atendidos = filtrados.filter((a) => a.atendido).length;
    return { total, agendados, naoAgendados: total - agendados, atendidos };
  }, [filtrados]);

  const tarefasGlobais = useMemo(() => (data ? tarefasGlobaisPendentes(data.alunos) : []), [data]);

  const orfaosFiltrados = useMemo(() => {
    if (!data) return [];
    const term = orfaosFilter.trim().toLowerCase();
    if (!term) return data.agendamentosOrfaos;
    return data.agendamentosOrfaos.filter((a) =>
      `${a.nome_cliente || ""} ${a.nro_controle_cliente || ""}`.toLowerCase().includes(term)
    );
  }, [data, orfaosFilter]);

  const drawerAluno = useMemo(
    () => (data && drawerCodigo != null ? data.alunos.find((a) => a.codigo === drawerCodigo) || null : null),
    [data, drawerCodigo]
  );
  const drawerNotas = useMemo(() => {
    if (!data || drawerCodigo == null) return [];
    return data.notas
      .filter((n) => n.cliente_codigo === drawerCodigo)
      .sort((a, b) => (b.criado_em || "").localeCompare(a.criado_em || ""));
  }, [data, drawerCodigo]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  async function handleConcluirTarefa(id: number) {
    try {
      await concluirTarefa(id);
      setData((d) => {
        if (!d) return d;
        const tarefas = d.tarefas.map((t) => (t.id === id ? { ...t, status: "concluida" as const } : t));
        return { ...d, tarefas, alunos: recomputeAlunosTarefas(d.alunos, tarefas) };
      });
    } catch (e: unknown) {
      alert("Não foi possível concluir a tarefa: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleAddTarefa() {
    if (!drawerAluno) return;
    const motivo = novaTarefaMotivo.trim();
    if (!motivo) {
      alert("Descreva o que precisa ser feito.");
      return;
    }
    try {
      const nova = await criarTarefa(drawerAluno.codigo, motivo, novaTarefaPrazo || null);
      setData((d) => {
        if (!d) return d;
        const tarefas = [...d.tarefas, nova];
        return { ...d, tarefas, alunos: recomputeAlunosTarefas(d.alunos, tarefas) };
      });
      setNovaTarefaMotivo("");
      setNovaTarefaPrazo("");
    } catch (e: unknown) {
      alert("Não foi possível criar a tarefa: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleAddNota() {
    if (!drawerAluno) return;
    const texto = novaNotaTexto.trim();
    if (!texto) {
      alert("Escreva o que foi conversado.");
      return;
    }
    try {
      const nova = await criarNota(drawerAluno.codigo, novaNotaTipo, texto, currentUserEmail || null);
      setData((d) => (d ? { ...d, notas: [...d.notas, nova] } : d));
      setNovaNotaTexto("");
    } catch (e: unknown) {
      alert("Não foi possível salvar a anotação: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-900 text-ink-50">
        <p className="text-red-400">Não foi possível carregar os dados: {error}</p>
        <Link to="/" className="text-brand-400 hover:text-brand-300">← Voltar</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-ink-300">
        Carregando atendimento…
      </div>
    );
  }

  return (
    <Layout>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">CRM de Atendimento</h1>
          <p className="flex items-center gap-2 text-sm text-ink-400">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                statusKind === "ok" ? "bg-emerald-500" : statusKind === "err" ? "bg-red-500" : "bg-ink-500"
              }`}
            />
            {statusText}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refresh(true)} className="text-sm text-ink-300 hover:text-ink-50">
            ↻ Atualizar
          </button>
        </div>
      </header>

      {/* filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <FilterField label="Ano">
          <select
            value={filters.ano}
            onChange={(e) => setFilters((f) => ({ ...f, ano: e.target.value }))}
            className="rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
          >
            <option value="">Todos os anos</option>
            {anos.lista.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
            {anos.temSemPeriodo && <option value={SEM_PERIODO}>Sem período definido</option>}
          </select>
        </FilterField>
        <FilterField label="Instituição">
          <select
            value={filters.instituicao}
            onChange={(e) => setFilters((f) => ({ ...f, instituicao: e.target.value }))}
            className="rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
          >
            <option value="">Todas</option>
            {instituicoes.map(({ inst, count }) => (
              <option key={inst} value={inst}>
                {inst} ({count})
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Agendado">
          <select
            value={filters.agendado}
            onChange={(e) => setFilters((f) => ({ ...f, agendado: e.target.value as Filters["agendado"] }))}
            className="rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
          >
            <option value="">Todos</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </FilterField>
        <FilterField label="Atendido">
          <select
            value={filters.atendido}
            onChange={(e) => setFilters((f) => ({ ...f, atendido: e.target.value as Filters["atendido"] }))}
            className="rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
          >
            <option value="">Todos</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </FilterField>
        <input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Buscar nome, CPF, telefone…"
          className="rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
        />
        <button
          onClick={() => setFilters(EMPTY_FILTERS)}
          className="rounded-full border border-ink-600 px-2.5 py-1 text-xs text-ink-300 hover:text-ink-50"
        >
          Limpar filtros
        </button>
        <button
          onClick={() => exportAlunosCSV(filtrados)}
          className="ml-auto rounded-md border border-ink-600 px-2.5 py-1 text-sm text-ink-100 hover:border-brand-600 hover:text-brand-300"
        >
          ⭳ Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Alunos (filtro atual)" value={kpis.total} />
        <Kpi label="Agendados" value={kpis.agendados} />
        <Kpi label="Não agendados" value={kpis.naoAgendados} />
        <Kpi label="Atendidos" value={kpis.atendidos} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* tabela de alunos */}
        <div className="rounded-lg border border-ink-800 bg-ink-850 p-3 lg:col-span-2">
          <p className="mb-3 text-sm font-medium text-ink-100">
            {ordenados.length.toLocaleString("pt-BR")} aluno(s) encontrado(s)
            {ordenados.length > RENDER_CAP ? ` — mostrando ${RENDER_CAP}` : ""}
          </p>
          <div className="max-h-[36rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ink-850">
                <tr className="border-b border-ink-800 text-left text-xs uppercase text-ink-400">
                  {ALUNO_COLS.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => toggleSort(c.key)}
                      className={`cursor-pointer select-none py-2 ${c.num ? "text-right" : ""}`}
                    >
                      {c.label} {sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenados.slice(0, RENDER_CAP).map((a) => (
                  <tr
                    key={a.codigo}
                    onClick={() => setDrawerCodigo(a.codigo)}
                    className="cursor-pointer border-b border-ink-800/50 hover:bg-ink-800/50"
                  >
                    <td className="py-2">{a.nome}</td>
                    <td className="py-2">{a.cpf || "—"}</td>
                    <td className="py-2">{a.telefone || "—"}</td>
                    <td className="py-2">{a.instituicao || "—"}</td>
                    <td className="py-2">{a.curso || "—"}</td>
                    <td className="py-2">{a.status || "—"}</td>
                    <td className="py-2">
                      <Pill good={a.agendado}>
                        {a.agendado ? `Sim${a.ultimoAgendamento ? " · " + fmtDateBR(a.ultimoAgendamento.data) : ""}` : "Não"}
                      </Pill>
                    </td>
                    <td className="py-2">
                      <Pill good={a.atendido}>{a.atendido ? "Sim" : "Não"}</Pill>
                    </td>
                    <td className="py-2 text-right">
                      {a.tarefasPendentes ? (
                        <span className="rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-300">
                          {a.tarefasPendentes}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {!ordenados.length && (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-ink-400">
                      Nenhum aluno encontrado com esses filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* tarefas globais */}
        <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
          <p className="mb-3 text-sm font-medium text-ink-100">
            Tarefas pendentes ({tarefasGlobais.length})
          </p>
          <div className="max-h-[36rem] space-y-2 overflow-auto">
            {!tarefasGlobais.length && <p className="text-sm text-ink-400">Nenhuma tarefa pendente. 🎉</p>}
            {tarefasGlobais.map(({ tarefa, aluno }) => {
              const atrasada = !!(tarefa.prazo && tarefa.prazo < todayISO());
              return (
                <div
                  key={tarefa.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                    atrasada ? "border-red-900 bg-red-950/30" : "border-ink-800 bg-ink-900"
                  }`}
                >
                  <button onClick={() => setDrawerCodigo(aluno.codigo)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium">{tarefa.motivo}</p>
                    <p className="truncate text-xs text-ink-400">
                      {aluno.nome}
                      {aluno.instituicao ? ` · ${aluno.instituicao}` : ""}
                      {tarefa.prazo ? ` · prazo ${fmtDateBR(tarefa.prazo)}${atrasada ? " (atrasada)" : ""}` : ""}
                    </p>
                  </button>
                  <button
                    onClick={() => handleConcluirTarefa(tarefa.id)}
                    className="whitespace-nowrap rounded-md border border-ink-600 px-2 py-1 text-xs text-ink-100 hover:border-emerald-600 hover:text-emerald-300"
                  >
                    Concluir
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* agendamentos órfãos */}
      <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
        <button
          onClick={() => setOrfaosOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm font-medium text-ink-100">
            {orfaosOpen ? "▾" : "▸"} Agendamentos sem cliente correspondente ({data.agendamentosOrfaos.length})
          </span>
        </button>
        {orfaosOpen && (
          <div className="mt-3">
            <input
              value={orfaosFilter}
              onChange={(e) => setOrfaosFilter(e.target.value)}
              placeholder="Buscar nome, nº controle…"
              className="mb-3 w-full max-w-sm rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
            />
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-ink-850">
                  <tr className="border-b border-ink-800 text-left text-xs uppercase text-ink-400">
                    <th className="py-2">Data</th>
                    <th className="py-2">Horário</th>
                    <th className="py-2">Studio</th>
                    <th className="py-2">Nome na agenda</th>
                    <th className="py-2">Nº controle informado</th>
                    <th className="py-2">Status atendimento</th>
                  </tr>
                </thead>
                <tbody>
                  {orfaosFiltrados.slice(0, 300).map((a) => (
                    <tr key={a.codigo} className="border-b border-ink-800/50">
                      <td className="py-2">{fmtDateBR(a.data)}</td>
                      <td className="py-2">{a.horario || ""}</td>
                      <td className="py-2">{a.studio || ""}</td>
                      <td className="py-2">{a.nome_cliente || ""}</td>
                      <td className="py-2">{a.nro_controle_cliente || ""}</td>
                      <td className="py-2">{a.status_atend || ""}</td>
                    </tr>
                  ))}
                  {!orfaosFiltrados.length && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-ink-400">
                        {data.agendamentosOrfaos.length ? "Nenhum resultado para essa busca." : "Nenhum agendamento órfão encontrado. 🎉"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* drawer do aluno */}
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

            <div className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3 text-sm text-ink-100">
              <p>CPF: {drawerAluno.cpf || "—"}</p>
              <p>Telefone: {drawerAluno.telefone || "—"}</p>
              <p>
                Status: {drawerAluno.status || "—"}
                {drawerAluno.tipo ? ` · ${drawerAluno.tipo}` : ""}
              </p>
              <p>
                Contrato: {drawerAluno.nro_controle || "—"}
                {drawerAluno.ano_periodo ? ` · ${drawerAluno.ano_periodo}` : ""}
              </p>
            </div>

            <Section title="Agendamentos">
              {drawerAluno.agendamentos.length ? (
                drawerAluno.agendamentos.map((ag) => (
                  <div key={ag.codigo} className="border-b border-ink-800 py-1.5 text-sm">
                    {fmtDateBR(ag.data)}
                    {ag.horario ? ` · ${ag.horario}` : ""}
                    {ag.studio ? ` · ${ag.studio}` : ""} ·{" "}
                    <Pill good={ag.status_atend === "ATENDIDO"}>{ag.status_atend || "—"}</Pill>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-400">Nenhum agendamento encontrado.</p>
              )}
            </Section>

            <Section title="Tarefas">
              {drawerAluno.tarefas.length ? (
                <div className="space-y-2">
                  {drawerAluno.tarefas.map((t) => {
                    const atrasada = t.status !== "concluida" && !!(t.prazo && t.prazo < todayISO());
                    const concluida = t.status === "concluida";
                    return (
                      <div
                        key={t.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                          atrasada ? "border-red-900 bg-red-950/30" : "border-ink-800 bg-ink-850"
                        }`}
                      >
                        <div className={concluida ? "line-through opacity-60" : ""}>
                          <p className="text-sm font-medium">{t.motivo}</p>
                          <p className="text-xs text-ink-400">
                            {t.prazo ? `prazo ${fmtDateBR(t.prazo)}${atrasada ? " (atrasada)" : ""}` : "sem prazo"}
                          </p>
                        </div>
                        {concluida ? (
                          <Pill good>Concluída</Pill>
                        ) : (
                          <button
                            onClick={() => handleConcluirTarefa(t.id)}
                            className="whitespace-nowrap rounded-md border border-ink-600 px-2 py-1 text-xs text-ink-100 hover:border-emerald-600 hover:text-emerald-300"
                          >
                            Concluir
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-ink-400">Nenhuma tarefa ainda.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={novaTarefaMotivo}
                  onChange={(e) => setNovaTarefaMotivo(e.target.value)}
                  placeholder="O que precisa ser feito?"
                  className="min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
                />
                <input
                  type="date"
                  value={novaTarefaPrazo}
                  onChange={(e) => setNovaTarefaPrazo(e.target.value)}
                  className="rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
                />
                <button
                  onClick={handleAddTarefa}
                  className="rounded-md bg-brand-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-brand-500"
                >
                  Adicionar
                </button>
              </div>
            </Section>

            <Section title="Anotações">
              {drawerNotas.length ? (
                <div className="space-y-2">
                  {drawerNotas.map((n) => (
                    <div key={n.id} className="rounded-lg border border-ink-800 bg-ink-850 p-2 text-sm">
                      <p className="text-xs text-ink-400">
                        {n.tipo}
                        {n.autor ? ` · ${n.autor}` : ""} · {fmtDateTimeBR(n.criado_em)}
                      </p>
                      <p>{n.texto}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-400">Nenhuma anotação ainda.</p>
              )}
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <select
                    value={novaNotaTipo}
                    onChange={(e) => setNovaNotaTipo(e.target.value)}
                    className="rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
                  >
                    <option value="contato">Contato</option>
                    <option value="observacao">Observação</option>
                    <option value="ligacao">Ligação</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                <textarea
                  value={novaNotaTexto}
                  onChange={(e) => setNovaNotaTexto(e.target.value)}
                  placeholder="O que foi conversado?"
                  rows={3}
                  className="w-full rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
                />
                <button
                  onClick={handleAddNota}
                  className="rounded-md bg-brand-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-brand-500"
                >
                  Salvar anotação
                </button>
              </div>
            </Section>
          </div>
        </>
      )}
    </Layout>
  );
}

// recalcula tarefas/tarefasPendentes de cada aluno após criar/concluir uma tarefa,
// sem precisar refazer o join completo com contratos/agenda
function recomputeAlunosTarefas(alunos: Aluno[], tarefas: Aluno["tarefas"]): Aluno[] {
  const byCliente: Record<number, Aluno["tarefas"]> = {};
  tarefas.forEach((t) => {
    if (!byCliente[t.cliente_codigo]) byCliente[t.cliente_codigo] = [];
    byCliente[t.cliente_codigo].push(t);
  });
  return alunos.map((a) => {
    const doAluno = (byCliente[a.codigo] || [])
      .slice()
      .sort((x, y) => (x.prazo || "9999-99-99").localeCompare(y.prazo || "9999-99-99"));
    return { ...a, tarefas: doAluno, tarefasPendentes: doAluno.filter((t) => t.status !== "concluida").length };
  });
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
      <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-ink-400">{label}</span>
      {children}
    </label>
  );
}

function Pill({ good, children }: { good: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${
        good ? "border-emerald-800 bg-emerald-950 text-emerald-300" : "border-ink-600 bg-ink-850 text-ink-300"
      }`}
    >
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</p>
      {children}
    </div>
  );
}
