import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

type Grupo = "sessao_estudio" | "novo_hamburgo";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function P4F() {
  const [rows, setRows] = useState<VendaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadVendasData()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Falha ao carregar dados"));
  }, []);

  const salesOnly = useMemo(() => (rows || []).filter((r) => r.descricao !== "NAO COMPROU"), [rows]);

  const sessaoEstudioCaxiasPoa = useMemo(
    () =>
      salesOnly.filter(
        (r) => isSessaoEstudio(r) && (studioMatches(r.estudio, "CAXIAS") || studioMatches(r.estudio, "PORTO ALEGRE"))
      ),
    [salesOnly]
  );

  const novoHamburgo = useMemo(
    () => salesOnly.filter((r) => studioMatches(r.estudio, "NOVO HAMBURGO")),
    [salesOnly]
  );

  const term = norm(search);
  const filtrar = (base: VendaRow[]) =>
    !term ? base : base.filter((r) => norm(r.cliente).includes(term) || norm(r.cpf).includes(term));

  const listaSessaoEstudio = useMemo(() => filtrar(sessaoEstudioCaxiasPoa), [sessaoEstudioCaxiasPoa, term]);
  const listaNovoHamburgo = useMemo(() => filtrar(novoHamburgo), [novoHamburgo, term]);

  const [grupo, setGrupo] = useState<Grupo>("sessao_estudio");
  const lista = grupo === "sessao_estudio" ? listaSessaoEstudio : listaNovoHamburgo;
  const total = lista.reduce((s, r) => s + r.total, 0);

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
        Carregando P4F / Sessão Estúdio…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">P4F / Sessão Estúdio</h1>
          <p className="text-sm text-slate-500">
            Clientes Sessão Estúdio em Caxias/Porto Alegre e atendidos em Novo Hamburgo
          </p>
        </div>
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Painel principal
        </Link>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Sessão Estúdio (Caxias + POA)" value={String(sessaoEstudioCaxiasPoa.length)} />
        <Kpi label="Atendidos em Novo Hamburgo" value={String(novoHamburgo.length)} />
        <Kpi label={`Faturamento do grupo selecionado`} value={fmtBRL(total)} tone="emerald" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setGrupo("sessao_estudio")}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            grupo === "sessao_estudio"
              ? "border-indigo-600 bg-indigo-950 text-indigo-300"
              : "border-slate-700 text-slate-400 hover:text-slate-200"
          }`}
        >
          Sessão Estúdio (Caxias + Porto Alegre)
        </button>
        <button
          onClick={() => setGrupo("novo_hamburgo")}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            grupo === "novo_hamburgo"
              ? "border-indigo-600 bg-indigo-950 text-indigo-300"
              : "border-slate-700 text-slate-400 hover:text-slate-200"
          }`}
        >
          Atendidos em Novo Hamburgo
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente ou CPF…"
          className="ml-auto min-w-[220px] rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm"
        />
        <span className="text-xs text-slate-500">{lista.length} registro(s)</span>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Estúdio</th>
              <th className="px-3 py-2">Data da sessão</th>
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2">Vendedor</th>
              <th className="px-3 py-2">Nº controle</th>
              <th className="px-3 py-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            {!lista.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {lista.map((r, i) => (
              <tr key={`${r.nroControle}-${r.cliente}-${i}`} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                <td className="px-3 py-2">{r.cliente}</td>
                <td className="px-3 py-2 text-slate-400">{titleCase(estudioKey(r))}</td>
                <td className="px-3 py-2 text-slate-400">{r.dataSessao || "—"}</td>
                <td className="px-3 py-2 text-slate-400">{r.descricao}</td>
                <td className="px-3 py-2 text-slate-400">{vendedorLabel(r) || "—"}</td>
                <td className="px-3 py-2 text-slate-400">{r.nroControle}</td>
                <td className="px-3 py-2">{fmtBRL(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "emerald" }) {
  const toneClass = tone === "emerald" ? "text-emerald-400" : "text-slate-100";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
