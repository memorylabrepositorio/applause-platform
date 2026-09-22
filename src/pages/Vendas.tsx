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
  applyFilters,
  computeVendedorStats,
  estudioBreakdown,
  monthlySeries,
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

export default function Vendas() {
  const [rows, setRows] = useState<VendaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ year: String(new Date().getFullYear()) });

  useEffect(() => {
    loadVendasData()
      .then(setRows)
      .catch((e) => setError(e.message || "Falha ao carregar dados"));
  }, []);

  const filtered = useMemo(() => (rows ? applyFilters(rows, filters) : []), [rows, filters]);

  const kpis = useMemo(() => {
    const totalRevenue = filtered.reduce((s, r) => s + r.total, 0);
    const itemCount = filtered.length;
    const ticketMedio = itemCount ? totalRevenue / itemCount : 0;
    const cpfSet = new Set(filtered.map((r) => (r.cpf ? `cpf:${r.cpf}` : `nome:${r.cliente.toUpperCase()}`)));
    const matched = filtered.filter((r) => r.status !== "NAO ENCONTRADO").length;
    const convRate = itemCount ? (matched / itemCount) * 100 : 0;
    return { totalRevenue, itemCount, ticketMedio, clientCount: cpfSet.size, convRate };
  }, [filtered]);

  const monthly = useMemo(() => monthlySeries(filtered, filters.year), [filtered, filters.year]);
  const vendedores = useMemo(
    () => computeVendedorStats(filtered).sort((a, b) => b.revenue - a.revenue),
    [filtered]
  );
  const estudios = useMemo(() => estudioBreakdown(filtered).slice(0, 8), [filtered]);

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
            {fmtInt(filtered.length)} de {fmtInt(rows.length)} vendas
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="mb-3 text-sm font-medium text-slate-300">Faturamento por estúdio</p>
          <div className="space-y-2">
            {estudios.map((e) => {
              const max = estudios[0]?.value || 1;
              return (
                <button
                  key={e.label}
                  onClick={() => setFilters((f) => ({ ...f, estudio: e.label.toUpperCase() }))}
                  className="block w-full text-left"
                >
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>{e.label}</span>
                    <span>{fmtBRL(e.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-indigo-600"
                      style={{ width: `${(e.value / max) * 100}%` }}
                    />
                  </div>
                </button>
              );
            })}
            {!estudios.length && <p className="text-sm text-slate-500">Sem dados no período.</p>}
          </div>
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
