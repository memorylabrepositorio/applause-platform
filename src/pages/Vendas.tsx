import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { loadVendasData } from "@/lib/vendas/fetch";
import {
  agendaStatus,
  applyFilters,
  comprouStatus,
  computeVendedorStats,
  estudioBreakdown,
  institutionBreakdown,
  institutionLabelOf,
  isUnmatchedRow,
  monthlySeries,
  productBreakdown,
  titleCase,
  vendedorLabel,
  type Filters,
  type VendaRow,
} from "@/lib/vendas/engine";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtInt(v: number): string {
  return v.toLocaleString("pt-BR");
}
function fmtPct(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}
function norm(s: string): string {
  return s.trim().toUpperCase();
}

type AlunosStatus = "" | "comprou" | "naocomprou" | "agendado" | "naoagendado";

export default function Vendas() {
  const [rows, setRows] = useState<VendaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ year: String(new Date().getFullYear()) });
  const [alunosStatus, setAlunosStatus] = useState<AlunosStatus>("");
  const [alunosFilter, setAlunosFilter] = useState("");
  const [unmatchedFilter, setUnmatchedFilter] = useState("");

  useEffect(() => {
    loadVendasData()
      .then(setRows)
      .catch((e) => setError(e.message || "Falha ao carregar dados"));
  }, []);

  const filtered = useMemo(() => (rows ? applyFilters(rows, filters) : []), [rows, filters]);
  // "não comprou" é uma linha sintética (aluno com contrato, sem venda) — não
  // entra em faturamento/ranking/gráfico, só no card de alunos
  const salesOnly = useMemo(() => filtered.filter((r) => r.descricao !== "NAO COMPROU"), [filtered]);

  const kpis = useMemo(() => {
    const totalRevenue = salesOnly.reduce((s, r) => s + r.total, 0);
    const itemCount = salesOnly.length;
    const ticketMedio = itemCount ? totalRevenue / itemCount : 0;
    const cpfSet = new Set(salesOnly.map((r) => (r.cpf ? `cpf:${r.cpf}` : `nome:${r.cliente.toUpperCase()}`)));
    const matched = salesOnly.filter((r) => r.status !== "NAO ENCONTRADO").length;
    const convRate = itemCount ? (matched / itemCount) * 100 : 0;
    return { totalRevenue, itemCount, ticketMedio, clientCount: cpfSet.size, convRate };
  }, [salesOnly]);

  const monthly = useMemo(() => monthlySeries(salesOnly, filters.year), [salesOnly, filters.year]);
  const vendedores = useMemo(
    () => computeVendedorStats(salesOnly).sort((a, b) => b.revenue - a.revenue),
    [salesOnly]
  );
  const estudios = useMemo(() => estudioBreakdown(salesOnly).slice(0, 8), [salesOnly]);
  const instituicoes = useMemo(() => institutionBreakdown(salesOnly), [salesOnly]);
  const produtos = useMemo(() => productBreakdown(salesOnly), [salesOnly]);

  const unmatched = useMemo(() => {
    const base = salesOnly.filter(isUnmatchedRow);
    const f = norm(unmatchedFilter);
    if (!f) return base;
    return base.filter(
      (r) => norm(r.cliente).includes(f) || vendedorLabel(r).toUpperCase().includes(f) || norm(r.cpf).includes(f)
    );
  }, [salesOnly, unmatchedFilter]);

  const alunosCounts = useMemo(() => {
    let comprou = 0,
      naoComprou = 0,
      agendado = 0,
      naoAgendado = 0;
    filtered.forEach((r) => {
      if (comprouStatus(r) === "sim") comprou++;
      else naoComprou++;
      if (agendaStatus(r) === "sim") agendado++;
      else naoAgendado++;
    });
    return { total: filtered.length, comprou, naoComprou, agendado, naoAgendado };
  }, [filtered]);

  const alunos = useMemo(() => {
    let base = filtered;
    if (alunosStatus === "comprou") base = base.filter((r) => comprouStatus(r) === "sim");
    else if (alunosStatus === "naocomprou") base = base.filter((r) => comprouStatus(r) === "nao");
    else if (alunosStatus === "agendado") base = base.filter((r) => agendaStatus(r) === "sim");
    else if (alunosStatus === "naoagendado") base = base.filter((r) => agendaStatus(r) === "nao");

    const f = norm(alunosFilter);
    if (!f) return base;
    return base.filter(
      (r) =>
        norm(r.cliente).includes(f) ||
        vendedorLabel(r).toUpperCase().includes(f) ||
        norm(institutionLabelOf(r) || "").includes(f)
    );
  }, [filtered, alunosStatus, alunosFilter]);

  const years = useMemo(() => {
    if (!rows) return [];
    const set = new Set<string>();
    rows.forEach((r) => {
      const y = r.dataVenda.split("/")[2];
      if (y) set.add(y);
    });
    return Array.from(set).sort().reverse();
  }, [rows]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-slate-100">
        <p className="text-red-400">Não foi possível carregar os dados: {error}</p>
        <Link to="/" className="text-indigo-400 hover:text-indigo-300">← Voltar</Link>
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Carregando vendas…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Painel de Vendas</h1>
          <p className="text-sm text-slate-500">
            {fmtInt(salesOnly.length)} de {fmtInt(rows.filter((r) => r.descricao !== "NAO COMPROU").length)} vendas
          </p>
        </div>
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Painel principal
        </Link>
      </header>

      {/* filtros */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={filters.year || ""}
          onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value || undefined }))}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm"
        >
          <option value="">Todos os anos</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {filters.vendedor && (
          <button
            onClick={() => setFilters((f) => ({ ...f, vendedor: undefined }))}
            className="rounded-md border border-indigo-700 bg-indigo-950 px-3 py-1.5 text-sm text-indigo-300"
          >
            Vendedor: {filters.vendedor} ✕
          </button>
        )}
        {filters.estudio && (
          <button
            onClick={() => setFilters((f) => ({ ...f, estudio: undefined }))}
            className="rounded-md border border-indigo-700 bg-indigo-950 px-3 py-1.5 text-sm text-indigo-300"
          >
            Estúdio: {filters.estudio} ✕
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Faturamento total" value={fmtBRL(kpis.totalRevenue)} />
        <Kpi label="Itens vendidos" value={fmtInt(kpis.itemCount)} />
        <Kpi label="Ticket médio" value={fmtBRL(kpis.ticketMedio)} />
        <Kpi label="Clientes únicos" value={fmtInt(kpis.clientCount)} />
        <Kpi label="Cruzamento c/ agenda" value={fmtPct(kpis.convRate)} />
      </div>

      {/* faturamento mensal */}
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <p className="mb-3 text-sm font-medium text-slate-300">Faturamento por mês</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip
              formatter={(v: number) => fmtBRL(v)}
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
            />
            <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ranking vendedores */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="mb-3 text-sm font-medium text-slate-300">Vendas por vendedor</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
                <th className="py-2">Vendedor</th>
                <th className="py-2 text-right">Faturamento</th>
                <th className="py-2 text-right">Itens</th>
                <th className="py-2 text-right">Conversão</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => (
                <tr
                  key={v.key}
                  onClick={() => setFilters((f) => ({ ...f, vendedor: v.key }))}
                  className="cursor-pointer border-b border-slate-800/50 hover:bg-slate-800/50"
                >
                  <td className="py-2">{v.label}</td>
                  <td className="py-2 text-right">{fmtBRL(v.revenue)}</td>
                  <td className="py-2 text-right">{fmtInt(v.items)}</td>
                  <td className="py-2 text-right">{fmtPct(v.conv)}</td>
                </tr>
              ))}
              {!vendedores.length && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500">
                    Sem vendas no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* estúdios */}
        <BarListCard
          title="Faturamento por estúdio"
          items={estudios}
          onClick={(label) => setFilters((f) => ({ ...f, estudio: label.toUpperCase() }))}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BarListCard title="Faturamento por instituição" items={instituicoes} />
        <BarListCard title="Faturamento por produto" items={produtos} />
      </div>

      {/* alunos: comprou/não comprou, agendado/não agendado */}
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-300">
            Alunos ({fmtInt(alunos.length)} de {fmtInt(filtered.length)})
          </p>
          <input
            value={alunosFilter}
            onChange={(e) => setAlunosFilter(e.target.value)}
            placeholder="Buscar aluno, vendedor, instituição…"
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Pill active={alunosStatus === ""} onClick={() => setAlunosStatus("")}>
            Todos ({fmtInt(alunosCounts.total)})
          </Pill>
          <Pill active={alunosStatus === "comprou"} onClick={() => setAlunosStatus("comprou")}>
            Comprou ({fmtInt(alunosCounts.comprou)})
          </Pill>
          <Pill active={alunosStatus === "naocomprou"} onClick={() => setAlunosStatus("naocomprou")}>
            Não comprou ({fmtInt(alunosCounts.naoComprou)})
          </Pill>
          <Pill active={alunosStatus === "agendado"} onClick={() => setAlunosStatus("agendado")}>
            Agendado ({fmtInt(alunosCounts.agendado)})
          </Pill>
          <Pill active={alunosStatus === "naoagendado"} onClick={() => setAlunosStatus("naoagendado")}>
            Falta agendar ({fmtInt(alunosCounts.naoAgendado)})
          </Pill>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900">
              <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
                <th className="py-2">Data</th>
                <th className="py-2">Aluno</th>
                <th className="py-2">Instituição/Turma</th>
                <th className="py-2">Produto</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2">Compra</th>
                <th className="py-2">Agenda</th>
              </tr>
            </thead>
            <tbody>
              {alunos.slice(0, 300).map((r, i) => {
                const comprou = comprouStatus(r) === "sim";
                const agendou = agendaStatus(r) === "sim";
                const inst = institutionLabelOf(r);
                return (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="py-2">{r.dataVenda || "—"}</td>
                    <td className="py-2">{titleCase(r.cliente)}</td>
                    <td className="py-2">{inst ? titleCase(inst) : "—"}</td>
                    <td className="py-2">{titleCase(r.descricao)}</td>
                    <td className="py-2 text-right">{fmtBRL(r.total)}</td>
                    <td className="py-2">
                      <Badge good={comprou}>{comprou ? "Comprou" : "Não comprou"}</Badge>
                    </td>
                    <td className="py-2">
                      <Badge good={agendou}>{agendou ? "Agendado" : "Falta agendar"}</Badge>
                    </td>
                  </tr>
                );
              })}
              {!alunos.length && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-500">Nenhum resultado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* vendas sem sessão na agenda */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-300">
            Vendas sem sessão na agenda ({fmtInt(unmatched.length)})
          </p>
          <input
            value={unmatchedFilter}
            onChange={(e) => setUnmatchedFilter(e.target.value)}
            placeholder="Buscar cliente, vendedor, CPF…"
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900">
              <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
                <th className="py-2">Data venda</th>
                <th className="py-2">Vendedor</th>
                <th className="py-2">Cliente</th>
                <th className="py-2">CPF/CNPJ</th>
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {unmatched.slice(0, 300).map((r, i) => (
                <tr key={i} className="border-b border-slate-800/50">
                  <td className="py-2">{r.dataVenda}</td>
                  <td className="py-2">{vendedorLabel(r)}</td>
                  <td className="py-2">{titleCase(r.cliente)}</td>
                  <td className="py-2">{r.cpf}</td>
                  <td className="py-2">{titleCase(r.descricao)}</td>
                  <td className="py-2 text-right">{fmtBRL(r.total)}</td>
                </tr>
              ))}
              {!unmatched.length && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-500">Nenhum resultado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function BarListCard({
  title,
  items,
  onClick,
}: {
  title: string;
  items: { label: string; value: number }[];
  onClick?: (label: string) => void;
}) {
  const max = items[0]?.value || 1;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="mb-3 text-sm font-medium text-slate-300">{title}</p>
      <div className="space-y-2">
        {items.map((e) => {
          const Comp = onClick ? "button" : "div";
          return (
            <Comp
              key={e.label}
              onClick={onClick ? () => onClick(e.label) : undefined}
              className="block w-full text-left"
            >
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>{e.label}</span>
                <span>{fmtBRL(e.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${(e.value / max) * 100}%` }} />
              </div>
            </Comp>
          );
        })}
        {!items.length && <p className="text-sm text-slate-500">Sem dados no período.</p>}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 ${
        active ? "border-indigo-600 bg-indigo-950 text-indigo-300" : "border-slate-700 text-slate-400"
      }`}
    >
      {children}
    </button>
  );
}

function Badge({ good, children }: { good: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        good ? "bg-emerald-950 text-emerald-400" : "bg-amber-950 text-amber-400"
      }`}
    >
      {children}
    </span>
  );
}
