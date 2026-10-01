import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Layout from "@/components/Layout";
import UltimaAtualizacao from "@/components/UltimaAtualizacao";
import { loadEdicaoData } from "@/lib/edicao/fetch";
import {
  EMPTY_FILTERS,
  FUNIL_STATUS_LABEL,
  FUNIL_STATUS_ORDER,
  STATUS_EDICAO_LABEL,
  STATUS_EDICAO_ORDER,
  applyFilters,
  computeKpis,
  fmtDateBR,
  funilCounts,
  statusEdicao,
  volumePorEditor,
  type EdicaoFilters,
  type FunilAlbunsItem,
  type ProducaoEdicaoItem,
  type StatusEdicao,
} from "@/lib/edicao/engine";

type StatusKind = "ok" | "err" | null;

export default function Edicao() {
  const [producao, setProducao] = useState<ProducaoEdicaoItem[] | null>(null);
  const [funil, setFunil] = useState<FunilAlbunsItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<StatusKind>(null);
  const [statusText, setStatusText] = useState("Carregando…");
  const [filters, setFilters] = useState<EdicaoFilters>(EMPTY_FILTERS);

  async function refresh(manual = false) {
    if (manual) {
      setStatusKind(null);
      setStatusText("Atualizando…");
    }
    try {
      const data = await loadEdicaoData();
      setProducao(data.producao);
      setFunil(data.funil);
      setStatusKind("ok");
      setStatusText(`${data.producao.length} produções · ${data.funil.length} álbuns no funil`);
      setLoadError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erro desconhecido";
      setStatusKind("err");
      setStatusText("Falha ao carregar");
      setLoadError(msg);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const kpis = useMemo(() => (producao ? computeKpis(producao) : null), [producao]);
  const funilBySt = useMemo(() => (funil ? funilCounts(funil) : null), [funil]);
  const editores = useMemo(() => (producao ? volumePorEditor(producao) : []), [producao]);
  const filtrados = useMemo(() => (producao ? applyFilters(producao, filters) : []), [producao, filters]);
  const editorOptions = useMemo(() => {
    if (!producao) return [];
    const set = new Set<string>();
    producao.forEach((it) => it.editor && set.add(it.editor));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [producao]);

  if (loadError && !producao) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-900 text-ink-50">
        <p className="text-red-400">Não foi possível carregar os dados: {loadError}</p>
        <Link to="/" className="text-brand-400 hover:text-brand-300">← Voltar</Link>
      </div>
    );
  }

  if (!producao || !funil || !kpis || !funilBySt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-ink-300">
        Carregando edição…
      </div>
    );
  }

  return (
    <Layout>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Edição — Convites, Vídeos e Álbuns</h1>
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
          <UltimaAtualizacao tabelas={["producao_edicao", "funil_albuns"]} />
          <button onClick={() => refresh(true)} className="text-sm text-ink-300 hover:text-ink-50">
            ↻ Atualizar
          </button>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Total" value={String(kpis.total)} />
        <Kpi label="Aguardando entrada" value={String(kpis.aguardando)} />
        <Kpi label="Em edição" value={String(kpis.emEdicao)} tone="indigo" />
        <Kpi label="Atrasados" value={String(kpis.atrasados)} tone="red" />
        <Kpi label="Concluídos no mês" value={String(kpis.concluidosNoMes)} tone="emerald" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-ink-800 bg-ink-850 p-3 lg:col-span-2">
          <p className="mb-2 text-sm font-medium text-ink-100">Funil de álbuns</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FUNIL_STATUS_ORDER.map((s) => (
              <div key={s} className="rounded-md border border-ink-800 bg-ink-900 p-2.5 text-center">
                <p className="text-lg font-semibold text-ink-50">{funilBySt[s]}</p>
                <p className="text-xs text-ink-400">{FUNIL_STATUS_LABEL[s]}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
          <p className="mb-2 text-sm font-medium text-ink-100">Volume por editor</p>
          {editores.length ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={editores} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--ink-800))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "rgb(var(--ink-400))" }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="editor"
                  width={70}
                  tick={{ fontSize: 11, fill: "rgb(var(--ink-300))" }}
                />
                <Tooltip
                  contentStyle={{ background: "rgb(var(--ink-850))", border: "1px solid rgb(var(--ink-700))", fontSize: 12 }}
                  labelStyle={{ color: "rgb(var(--ink-100))" }}
                />
                <Bar dataKey="total" fill="rgb(var(--brand-500))" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-ink-400">Sem editores atribuídos ainda.</p>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as "" | StatusEdicao }))}
          className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
        >
          <option value="">Todos os status</option>
          {STATUS_EDICAO_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_EDICAO_LABEL[s]}</option>
          ))}
        </select>
        <select
          value={filters.editor}
          onChange={(e) => setFilters((f) => ({ ...f, editor: e.target.value }))}
          className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
        >
          <option value="">Todos os editores</option>
          {editorOptions.map((ed) => (
            <option key={ed} value={ed}>{ed}</option>
          ))}
        </select>
        <input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Buscar aluno, instituição, editor, vendedor…"
          className="min-w-[240px] flex-1 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
        />
        {(filters.status || filters.editor || filters.search) && (
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="rounded-md border border-ink-600 px-2.5 py-1 text-sm text-ink-300 hover:text-ink-50"
          >
            Limpar filtros
          </button>
        )}
        <span className="text-xs text-ink-400">{filtrados.length} item(ns)</span>
      </div>

      <div className="overflow-auto rounded-lg border border-ink-800 bg-ink-850">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-800 text-xs text-ink-400">
            <tr>
              <th className="px-2.5 py-1.5">Aluno</th>
              <th className="px-2.5 py-1.5">Instituição</th>
              <th className="px-2.5 py-1.5">Editor</th>
              <th className="px-2.5 py-1.5">Produto</th>
              <th className="px-2.5 py-1.5">Data limite</th>
              <th className="px-2.5 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {!filtrados.length && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-ink-400">
                  Nenhum item encontrado.
                </td>
              </tr>
            )}
            {filtrados.slice(0, 300).map((it) => {
              const st = statusEdicao(it);
              return (
                <tr key={it.id} className="border-b border-ink-800/60 hover:bg-ink-800/40">
                  <td className="px-2.5 py-1.5">{it.aluno}</td>
                  <td className="px-2.5 py-1.5 text-ink-300">{it.instituicao || "—"}</td>
                  <td className="px-2.5 py-1.5 text-ink-300">{it.editor || "—"}</td>
                  <td className="px-2.5 py-1.5 text-ink-300">{it.produto || "—"}</td>
                  <td className={`px-2.5 py-1.5 ${st === "atrasado" ? "text-red-400" : "text-ink-300"}`}>
                    {fmtDateBR(it.data_limite) || "—"}
                  </td>
                  <td className="px-2.5 py-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(st)}`}>
                      {STATUS_EDICAO_LABEL[st]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtrados.length > 300 && (
          <p className="border-t border-ink-800 px-3 py-2 text-center text-xs text-ink-400">
            Mostrando os primeiros 300 de {filtrados.length} — use os filtros pra restringir.
          </p>
        )}
      </div>
    </Layout>
  );
}

function statusClass(status: StatusEdicao): string {
  switch (status) {
    case "aguardando":
      return "border-ink-600 bg-ink-800 text-ink-100";
    case "em_edicao":
      return "border-brand-800 bg-brand-950 text-brand-300";
    case "atrasado":
      return "border-red-800 bg-red-950 text-red-300";
    case "concluido":
      return "border-emerald-800 bg-emerald-950 text-emerald-300";
  }
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "red" | "indigo" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-400" : tone === "red" ? "text-red-400" : tone === "indigo" ? "text-brand-400" : "text-ink-50";
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-850 p-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
