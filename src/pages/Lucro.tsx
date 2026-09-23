import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BackLink from "@/components/BackLink";
import { loadLucroPorContrato } from "@/lib/lucro/fetch";
import { EMPTY_FILTERS, applyFilters, fmtBRL, type LucroFilters, type LucroPorContrato } from "@/lib/lucro/engine";

type SortKey = "lucro" | "receitaFormatura" | "receitaPDV" | "despesas";

export default function Lucro() {
  const [rows, setRows] = useState<LucroPorContrato[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LucroFilters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("lucro");

  useEffect(() => {
    loadLucroPorContrato()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Falha ao carregar dados"));
  }, []);

  const filtradas = useMemo(() => {
    const base = applyFilters(rows || [], filters);
    return [...base].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [rows, filters, sortKey]);

  const totais = useMemo(() => {
    const base = rows || [];
    return base.reduce(
      (acc, r) => ({
        receitaFormatura: acc.receitaFormatura + r.receitaFormatura,
        receitaPDV: acc.receitaPDV + r.receitaPDV,
        despesas: acc.despesas + r.despesas,
        lucro: acc.lucro + r.lucro,
      }),
      { receitaFormatura: 0, receitaPDV: 0, despesas: 0, lucro: 0 }
    );
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
        Carregando lucro por contrato…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-900 p-3 text-ink-50 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Lucro por Contrato</h1>
          <p className="text-sm text-ink-400">Contrato de formatura + PDV − contas a pagar</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/contas-pagar" className="text-sm text-ink-300 hover:text-ink-50">
            ← Contas a pagar
          </Link>
        <BackLink />
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Receita formatura" value={fmtBRL(totais.receitaFormatura)} />
        <Kpi label="Receita PDV" value={fmtBRL(totais.receitaPDV)} />
        <Kpi label="Despesas" value={fmtBRL(totais.despesas)} tone="red" />
        <Kpi label="Lucro total" value={fmtBRL(totais.lucro)} tone="emerald" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
        >
          <option value="lucro">Ordenar por lucro</option>
          <option value="receitaFormatura">Ordenar por receita formatura</option>
          <option value="receitaPDV">Ordenar por receita PDV</option>
          <option value="despesas">Ordenar por despesas</option>
        </select>
        <input
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          placeholder="Buscar instituição, curso, contrato…"
          className="min-w-[240px] flex-1 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
        />
        <span className="text-xs text-ink-400">{filtradas.length} contrato(s)</span>
      </div>

      <div className="overflow-auto rounded-lg border border-ink-800 bg-ink-850">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-800 text-xs text-ink-400">
            <tr>
              <th className="px-2.5 py-1.5">Instituição</th>
              <th className="px-2.5 py-1.5">Curso</th>
              <th className="px-2.5 py-1.5">Nº controle</th>
              <th className="px-2.5 py-1.5">Receita formatura</th>
              <th className="px-2.5 py-1.5">Receita PDV</th>
              <th className="px-2.5 py-1.5">Despesas</th>
              <th className="px-2.5 py-1.5">Lucro</th>
            </tr>
          </thead>
          <tbody>
            {!filtradas.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-ink-400">
                  Nenhum contrato com dados de receita ou despesa ainda.
                </td>
              </tr>
            )}
            {filtradas.map((r) => (
              <tr key={r.nroControle} className="border-b border-ink-800/60 hover:bg-ink-800/40">
                <td className="px-2.5 py-1.5">{r.instituicao || "—"}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{r.curso || "—"}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{r.nroControle}</td>
                <td className="px-2.5 py-1.5">{fmtBRL(r.receitaFormatura)}</td>
                <td className="px-2.5 py-1.5">{fmtBRL(r.receitaPDV)}</td>
                <td className="px-2.5 py-1.5 text-red-400">{fmtBRL(r.despesas)}</td>
                <td className={`px-2.5 py-1.5 font-medium ${r.lucro >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {fmtBRL(r.lucro)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "red" }) {
  const toneClass = tone === "emerald" ? "text-emerald-400" : tone === "red" ? "text-red-400" : "text-ink-50";
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
