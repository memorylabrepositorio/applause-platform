import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import BackLink from "@/components/BackLink";
import { loadVendasData } from "@/lib/vendas/fetch";
import {
  estudioKey,
  isSessaoEstudio,
  titleCase,
  vendedorLabel,
  type VendaRow,
} from "@/lib/vendas/engine";

// P4F / Sessão Estúdio — view filtrada sobre vendas+agenda, sem tabela nova:
// clientes "Sessão Estúdio" atendidos nos estúdios de Caxias e Porto Alegre,
// e todos os atendidos no estúdio de Novo Hamburgo.

function norm(s: string): string {
  return s.trim().toUpperCase();
}

function studioMatches(estudio: string, alvo: string): boolean {
  return norm(estudio).includes(alvo);
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Grupo = "Porto Alegre" | "Caxias" | "Novo Hamburgo";
type Filtro = "Todos" | Grupo;

const GRUPOS: Grupo[] = ["Porto Alegre", "Caxias", "Novo Hamburgo"];
const FILTROS: Filtro[] = ["Todos", ...GRUPOS];

interface RowComGrupo extends VendaRow {
  grupo: Grupo;
}

export default function P4F() {
  const [rows, setRows] = useState<VendaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("Todos");

  useEffect(() => {
    loadVendasData()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Falha ao carregar dados"));
  }, []);

  const salesOnly = useMemo(() => (rows || []).filter((r) => r.descricao !== "NAO COMPROU"), [rows]);

  // combina os dois critérios num único conjunto rotulado por grupo, pra dar
  // pra filtrar com um único conjunto de pills (Todos / POA / Caxias / NH)
  const base = useMemo<RowComGrupo[]>(() => {
    const out: RowComGrupo[] = [];
    salesOnly.forEach((r) => {
      if (isSessaoEstudio(r) && studioMatches(r.estudio, "PORTO ALEGRE")) {
        out.push({ ...r, grupo: "Porto Alegre" });
      } else if (isSessaoEstudio(r) && studioMatches(r.estudio, "CAXIAS")) {
        out.push({ ...r, grupo: "Caxias" });
      } else if (studioMatches(r.estudio, "NOVO HAMBURGO")) {
        out.push({ ...r, grupo: "Novo Hamburgo" });
      }
    });
    return out;
  }, [salesOnly]);

  const chartData = useMemo(
    () =>
      GRUPOS.map((g) => {
        const rows = base.filter((r) => r.grupo === g);
        return { grupo: g, registros: rows.length, faturamento: rows.reduce((s, r) => s + r.total, 0) };
      }),
    [base]
  );

  const term = norm(search);
  const lista = useMemo(() => {
    let rowsFiltradas = filtro === "Todos" ? base : base.filter((r) => r.grupo === filtro);
    if (term) {
      rowsFiltradas = rowsFiltradas.filter((r) => norm(r.cliente).includes(term) || norm(r.cpf).includes(term));
    }
    return rowsFiltradas;
  }, [base, filtro, term]);

  const total = lista.reduce((s, r) => s + r.total, 0);

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
        Carregando P4F / Sessão Estúdio…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-900 p-3 text-ink-50 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">P4F / Sessão Estúdio</h1>
          <p className="text-xs text-ink-400">
            Sessão Estúdio em Porto Alegre/Caxias e atendidos em Novo Hamburgo
          </p>
        </div>
        <BackLink />
      </header>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Porto Alegre" value={String(chartData[0].registros)} />
        <Kpi label="Caxias" value={String(chartData[1].registros)} />
        <Kpi label="Novo Hamburgo" value={String(chartData[2].registros)} />
      </div>

      <div className="mb-3 rounded-lg border border-ink-800 bg-ink-850 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
          Registros por estúdio
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#16214a" vertical={false} />
            <XAxis dataKey="grupo" tick={{ fill: "#7783a8", fontSize: 11 }} axisLine={{ stroke: "#16214a" }} tickLine={false} />
            <YAxis tick={{ fill: "#7783a8", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              cursor={{ fill: "rgba(4,100,176,0.1)" }}
              contentStyle={{ background: "#0a1636", border: "1px solid #16214a", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#e8ecf7" }}
              formatter={(value: number, name: string) =>
                name === "faturamento" ? [fmtBRL(value), "Faturamento"] : [value, "Registros"]
              }
            />
            <Bar dataKey="registros" fill="#0464b0" radius={[4, 4, 0, 0]} maxBarSize={64} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-md border px-2.5 py-1 text-sm transition ${
              filtro === f
                ? "border-brand-600 bg-brand-950 text-brand-300"
                : "border-ink-600 text-ink-300 hover:text-ink-50"
            }`}
          >
            {f}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente ou CPF…"
          className="ml-auto min-w-[200px] rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
        />
        <span className="text-xs text-ink-400">
          {lista.length} registro(s) · {fmtBRL(total)}
        </span>
      </div>

      <div className="overflow-auto rounded-lg border border-ink-800 bg-ink-850">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-800 text-xs text-ink-400">
            <tr>
              <th className="px-2.5 py-1.5">Cliente</th>
              <th className="px-2.5 py-1.5">Grupo</th>
              <th className="px-2.5 py-1.5">Estúdio</th>
              <th className="px-2.5 py-1.5">Data da sessão</th>
              <th className="px-2.5 py-1.5">Produto</th>
              <th className="px-2.5 py-1.5">Vendedor</th>
              <th className="px-2.5 py-1.5">Nº controle</th>
              <th className="px-2.5 py-1.5">Valor</th>
            </tr>
          </thead>
          <tbody>
            {!lista.length && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-ink-400">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {lista.map((r, i) => (
              <tr key={`${r.nroControle}-${r.cliente}-${i}`} className="border-b border-ink-800/60 hover:bg-ink-800/40">
                <td className="px-2.5 py-1.5">{r.cliente}</td>
                <td className="px-2.5 py-1.5">
                  <span className="rounded-full border border-ink-600 px-2 py-0.5 text-xs text-ink-300">{r.grupo}</span>
                </td>
                <td className="px-2.5 py-1.5 text-ink-300">{titleCase(estudioKey(r))}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{r.dataSessao || "—"}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{r.descricao}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{vendedorLabel(r) || "—"}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{r.nroControle}</td>
                <td className="px-2.5 py-1.5">{fmtBRL(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}
