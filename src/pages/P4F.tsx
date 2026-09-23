import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import BackLink from "@/components/BackLink";
import { useTheme } from "@/contexts/ThemeContext";
import { categoricalPalette, CHART_NEUTRALS } from "@/lib/chartPalette";
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
  const { theme } = useTheme();
  const cores = categoricalPalette(theme);
  const neutros = CHART_NEUTRALS[theme];

  const [rows, setRows] = useState<VendaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [detalheGrupo, setDetalheGrupo] = useState<Grupo | null>(null);

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

  const detalhe = useMemo(() => {
    if (!detalheGrupo) return null;
    const rowsDoGrupo = base.filter((r) => r.grupo === detalheGrupo);
    const faturamento = rowsDoGrupo.reduce((s, r) => s + r.total, 0);
    const ticketMedio = rowsDoGrupo.length ? faturamento / rowsDoGrupo.length : 0;
    const topClientes = [...rowsDoGrupo].sort((a, b) => b.total - a.total).slice(0, 5);
    const porVendedor = new Map<string, number>();
    rowsDoGrupo.forEach((r) => {
      const v = vendedorLabel(r) || "Sem vendedor";
      porVendedor.set(v, (porVendedor.get(v) || 0) + r.total);
    });
    const topVendedores = [...porVendedor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { grupo: detalheGrupo, registros: rowsDoGrupo.length, faturamento, ticketMedio, topClientes, topVendedores };
  }, [detalheGrupo, base]);

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
        {GRUPOS.map((g, i) => (
          <button key={g} onClick={() => setDetalheGrupo(g)} className="text-left">
            <Kpi label={g} value={String(chartData[i].registros)} accentColor={cores[i]} />
          </button>
        ))}
      </div>

      <div className="mb-3 rounded-lg border border-ink-800 bg-ink-850 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Registros por estúdio</p>
          <p className="text-xs text-ink-500">clique numa barra pra ver detalhes</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              {chartData.map((d, i) => (
                <linearGradient key={d.grupo} id={`p4f-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cores[i]} stopOpacity={1} />
                  <stop offset="100%" stopColor={cores[i]} stopOpacity={0.55} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={neutros.grid} vertical={false} />
            <XAxis dataKey="grupo" tick={{ fill: neutros.axis, fontSize: 11 }} axisLine={{ stroke: neutros.grid }} tickLine={false} />
            <YAxis tick={{ fill: neutros.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              cursor={{ fill: "rgba(4,100,176,0.08)" }}
              contentStyle={{ background: neutros.tooltipBg, border: `1px solid ${neutros.grid}`, borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: neutros.tooltipText, fontWeight: 600 }}
              formatter={(value: number, name: string) =>
                name === "faturamento" ? [fmtBRL(value), "Faturamento"] : [value, "Registros"]
              }
            />
            <Bar
              dataKey="registros"
              radius={[6, 6, 0, 0]}
              maxBarSize={72}
              cursor="pointer"
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
              onClick={(d) => setDetalheGrupo(d.grupo as Grupo)}
            >
              {chartData.map((d, i) => (
                <Cell key={d.grupo} fill={`url(#p4f-grad-${i})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {GRUPOS.map((g, i) => (
            <span key={g} className="flex items-center gap-1.5 text-xs text-ink-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: cores[i] }} />
              {g}
            </span>
          ))}
        </div>
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

      {detalhe && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDetalheGrupo(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-ink-700 bg-ink-850 p-4 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-400">Detalhe do grupo</p>
                <p className="text-lg font-semibold">{detalhe.grupo}</p>
              </div>
              <button onClick={() => setDetalheGrupo(null)} className="text-ink-500 hover:text-ink-50">✕</button>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-ink-700 p-2 text-center">
                <p className="text-xs text-ink-400">Registros</p>
                <p className="text-base font-semibold">{detalhe.registros}</p>
              </div>
              <div className="rounded-md border border-ink-700 p-2 text-center">
                <p className="text-xs text-ink-400">Faturamento</p>
                <p className="text-base font-semibold">{fmtBRL(detalhe.faturamento)}</p>
              </div>
              <div className="rounded-md border border-ink-700 p-2 text-center">
                <p className="text-xs text-ink-400">Ticket médio</p>
                <p className="text-base font-semibold">{fmtBRL(detalhe.ticketMedio)}</p>
              </div>
            </div>

            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">Top clientes</p>
            <div className="mb-4 space-y-1">
              {detalhe.topClientes.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">{c.cliente}</span>
                  <span className="text-ink-300">{fmtBRL(c.total)}</span>
                </div>
              ))}
              {!detalhe.topClientes.length && <p className="text-sm text-ink-500">Sem registros.</p>}
            </div>

            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">Vendedores</p>
            <div className="space-y-1">
              {detalhe.topVendedores.map(([v, valor]) => (
                <div key={v} className="flex items-center justify-between text-sm">
                  <span>{v}</span>
                  <span className="text-ink-300">{fmtBRL(valor)}</span>
                </div>
              ))}
              {!detalhe.topVendedores.length && <p className="text-sm text-ink-500">Sem registros.</p>}
            </div>

            <button
              onClick={() => {
                setFiltro(detalhe.grupo);
                setDetalheGrupo(null);
              }}
              className="mt-4 w-full rounded-md bg-brand-600 py-1.5 text-sm font-medium text-white hover:bg-brand-500"
            >
              Ver todos na tabela
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accentColor }: { label: string; value: string; accentColor: string }) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-850 p-3 transition hover:border-ink-600">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: accentColor }} />
        <p className="text-xs text-ink-400">{label}</p>
      </div>
      <p className="mt-1 text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}
