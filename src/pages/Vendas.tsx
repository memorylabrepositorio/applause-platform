import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BackLink from "@/components/BackLink";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { CHART_NEUTRALS } from "@/lib/chartPalette";
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
  const { theme } = useTheme();
  const neutros = CHART_NEUTRALS[theme];
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-900 text-ink-50">
        <p className="text-red-400">Não foi possível carregar os dados: {error}</p>
        <Link to="/" className="text-brand-400 hover:text-brand-300">← Voltar</Link>
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-ink-300">
        Carregando vendas…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-900 p-3 text-ink-50 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Painel de Vendas</h1>
          <p className="text-sm text-ink-400">
            {fmtInt(salesOnly.length)} de {fmtInt(rows.filter((r) => r.descricao !== "NAO COMPROU").length)} vendas
          </p>
        </div>
        <BackLink />
      </header>

      {/* filtros */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={filters.year || ""}
          onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value || undefined }))}
          className="rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1 text-sm"
        >
          <option value="">Todos os anos</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {filters.vendedor && (
          <button
            onClick={() => setFilters((f) => ({ ...f, vendedor: undefined }))}
            className="rounded-md border border-brand-700 bg-brand-950 px-2.5 py-1 text-sm text-brand-300"
          >
            Vendedor: {filters.vendedor} ✕
          </button>
        )}
        {filters.estudio && (
          <button
            onClick={() => setFilters((f) => ({ ...f, estudio: undefined }))}
            className="rounded-md border border-brand-700 bg-brand-950 px-2.5 py-1 text-sm text-brand-300"
          >
            Estúdio: {filters.estudio} ✕
          </button>
        )}
        {filters.month && (
          <button
            onClick={() => setFilters((f) => ({ ...f, month: undefined }))}
            className="rounded-md border border-brand-700 bg-brand-950 px-2.5 py-1 text-sm text-brand-300"
          >
            Mês: {monthly.find((m) => m.key.endsWith(`-${filters.month}`))?.label || filters.month} ✕
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Faturamento total" value={fmtBRL(kpis.totalRevenue)} />
        <Kpi label="Itens vendidos" value={fmtInt(kpis.itemCount)} />
        <Kpi label="Ticket médio" value={fmtBRL(kpis.ticketMedio)} />
        <Kpi label="Clientes únicos" value={fmtInt(kpis.clientCount)} />
        <Kpi label="Cruzamento c/ agenda" value={fmtPct(kpis.convRate)} />
      </div>

      {/* faturamento mensal */}
      <div className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-ink-100">Faturamento por mês</p>
          <p className="text-xs text-ink-400">Clique numa barra pra filtrar o mês</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthly}>
            <defs>
              <linearGradient id="vendasMesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0464b0" stopOpacity={1} />
                <stop offset="100%" stopColor="#0464b0" stopOpacity={0.45} />
              </linearGradient>
              <linearGradient id="vendasMesGradientDim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0464b0" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#0464b0" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={neutros.grid} />
            <XAxis dataKey="label" stroke={neutros.axis} fontSize={12} />
            <YAxis stroke={neutros.axis} fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip
              cursor={{ fill: neutros.grid, opacity: 0.4 }}
              formatter={(v: number) => fmtBRL(v)}
              contentStyle={{
                background: neutros.tooltipBg,
                border: `1px solid ${neutros.grid}`,
                borderRadius: 8,
                color: neutros.tooltipText,
              }}
            />
            <Bar
              dataKey="revenue"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
              onClick={(d: { key: string }) => {
                const month = d.key.split("-")[1];
                setFilters((f) => ({ ...f, month: f.month === month ? undefined : month }));
              }}
            >
              {monthly.map((m) => {
                const mk = m.key.split("-")[1];
                const dimmed = filters.month && filters.month !== mk;
                return (
                  <Cell key={m.key} fill={dimmed ? "url(#vendasMesGradientDim)" : "url(#vendasMesGradient)"} />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ranking vendedores */}
        <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
          <p className="mb-3 text-sm font-medium text-ink-100">Vendas por vendedor</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left text-xs uppercase text-ink-400">
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
                  className="cursor-pointer border-b border-ink-800/50 hover:bg-ink-800/50"
                >
                  <td className="py-2">{v.label}</td>
                  <td className="py-2 text-right">{fmtBRL(v.revenue)}</td>
                  <td className="py-2 text-right">{fmtInt(v.items)}</td>
                  <td className="py-2 text-right">{fmtPct(v.conv)}</td>
                </tr>
              ))}
              {!vendedores.length && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-ink-400">
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

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarListCard title="Faturamento por instituição" items={instituicoes} />
        <BarListCard title="Faturamento por produto" items={produtos} />
      </div>

      {/* alunos: comprou/não comprou, agendado/não agendado */}
      <div className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink-100">
            Alunos ({fmtInt(alunos.length)} de {fmtInt(filtered.length)})
          </p>
          <input
            value={alunosFilter}
            onChange={(e) => setAlunosFilter(e.target.value)}
            placeholder="Buscar aluno, vendedor, instituição…"
            className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
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
            <thead className="sticky top-0 bg-ink-850">
              <tr className="border-b border-ink-800 text-left text-xs uppercase text-ink-400">
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
                  <tr key={i} className="border-b border-ink-800/50">
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
                  <td colSpan={7} className="py-4 text-center text-ink-400">Nenhum resultado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* vendas sem sessão na agenda */}
      <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink-100">
            Vendas sem sessão na agenda ({fmtInt(unmatched.length)})
          </p>
          <input
            value={unmatchedFilter}
            onChange={(e) => setUnmatchedFilter(e.target.value)}
            placeholder="Buscar cliente, vendedor, CPF…"
            className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
          />
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-850">
              <tr className="border-b border-ink-800 text-left text-xs uppercase text-ink-400">
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
                <tr key={i} className="border-b border-ink-800/50">
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
                  <td colSpan={6} className="py-4 text-center text-ink-400">Nenhum resultado.</td>
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
    <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
      <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
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
    <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
      <p className="mb-3 text-sm font-medium text-ink-100">{title}</p>
      <div className="space-y-2">
        {items.map((e) => {
          const Comp = onClick ? "button" : "div";
          return (
            <Comp
              key={e.label}
              onClick={onClick ? () => onClick(e.label) : undefined}
              className="block w-full text-left"
            >
              <div className="mb-1 flex justify-between text-xs text-ink-300">
                <span>{e.label}</span>
                <span>{fmtBRL(e.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-ink-800">
                <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(e.value / max) * 100}%` }} />
              </div>
            </Comp>
          );
        })}
        {!items.length && <p className="text-sm text-ink-400">Sem dados no período.</p>}
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
        active ? "border-brand-600 bg-brand-950 text-brand-300" : "border-ink-600 text-ink-300"
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
