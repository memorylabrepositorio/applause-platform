import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BackLink from "@/components/BackLink";
import { atualizarItem, criarItem, excluirItem, loadProducaoData } from "@/lib/producao/fetch";
import {
  EMPTY_FILTERS,
  STATUS_LABEL,
  STATUS_ORDER,
  applyFilters,
  atrasado,
  computeKpis,
  enriquecerItens,
  fmtDateBR,
  type ClienteRef,
  type ContratoRef,
  type ProducaoFilters,
  type ProducaoItem,
  type ProducaoItemEnriquecido,
  type StatusProducao,
} from "@/lib/producao/engine";

type StatusKind = "ok" | "err" | null;

const EMPTY_FORM = {
  cliente_codigo: "",
  contrato_nro_controle: "",
  produto: "",
  tipo_edicao: "",
  prazo_estudio: "",
  prazo_cliente: "",
  observacoes: "",
};

export default function Producao() {
  const [itens, setItens] = useState<ProducaoItem[] | null>(null);
  const [clientes, setClientes] = useState<ClienteRef[]>([]);
  const [contratos, setContratos] = useState<ContratoRef[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<StatusKind>(null);
  const [statusText, setStatusText] = useState("Carregando…");

  const [filters, setFilters] = useState<ProducaoFilters>(EMPTY_FILTERS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [drawerId, setDrawerId] = useState<number | null>(null);

  async function refresh(manual = false) {
    if (manual) {
      setStatusKind(null);
      setStatusText("Atualizando…");
    }
    try {
      const data = await loadProducaoData();
      setItens(data.itens);
      setClientes(data.clientes);
      setContratos(data.contratos);
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
  }, []);

  const enriquecidos = useMemo(
    () => (itens ? enriquecerItens(itens, clientes, contratos) : []),
    [itens, clientes, contratos]
  );

  const kpis = useMemo(() => computeKpis(enriquecidos), [enriquecidos]);

  const filtrados = useMemo(() => {
    const rows = applyFilters(enriquecidos, filters);
    return rows.sort((a, b) => (a.prazo_estudio || "9999").localeCompare(b.prazo_estudio || "9999"));
  }, [enriquecidos, filters]);

  const drawerItem = useMemo(
    () => (drawerId != null ? enriquecidos.find((p) => p.id === drawerId) || null : null),
    [enriquecidos, drawerId]
  );

  async function handleCriar() {
    setFormError("");
    const clienteCodigo = Number(form.cliente_codigo);
    if (!clienteCodigo) {
      setFormError("Informe o código do cliente.");
      return;
    }
    if (!form.produto.trim()) {
      setFormError("Informe o produto.");
      return;
    }
    setSaving(true);
    try {
      const novo = await criarItem({
        cliente_codigo: clienteCodigo,
        contrato_nro_controle: form.contrato_nro_controle || null,
        produto: form.produto.trim(),
        tipo_edicao: form.tipo_edicao || null,
        prazo_estudio: form.prazo_estudio || null,
        prazo_cliente: form.prazo_cliente || null,
        observacoes: form.observacoes || null,
        status: "nao_iniciado",
        origem: "manual",
      });
      setItens((prev) => (prev ? [novo, ...prev] : [novo]));
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erro desconhecido ao criar item");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(item: ProducaoItemEnriquecido, status: StatusProducao) {
    try {
      await atualizarItem(item.id, { status });
      setItens((prev) => (prev ? prev.map((it) => (it.id === item.id ? { ...it, status } : it)) : prev));
    } catch (e: unknown) {
      alert("Erro ao atualizar status: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleSalvarObs(texto: string) {
    if (!drawerItem) return;
    try {
      await atualizarItem(drawerItem.id, { observacoes: texto || null });
      setItens((prev) =>
        prev ? prev.map((it) => (it.id === drawerItem.id ? { ...it, observacoes: texto || null } : it)) : prev
      );
    } catch (e: unknown) {
      alert("Erro ao salvar observação: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleExcluir() {
    if (!drawerItem) return;
    if (!confirm(`Remover "${drawerItem.produto}" de ${drawerItem.clienteNome}? Essa ação não pode ser desfeita.`)) return;
    try {
      await excluirItem(drawerItem.id);
      setItens((prev) => (prev ? prev.filter((it) => it.id !== drawerItem.id) : prev));
      setDrawerId(null);
    } catch (e: unknown) {
      alert("Erro ao remover: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  if (loadError && !itens) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-900 text-ink-50">
        <p className="text-red-400">Não foi possível carregar os dados: {loadError}</p>
        <Link to="/" className="text-brand-400 hover:text-brand-300">← Voltar</Link>
      </div>
    );
  }

  if (!itens) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-ink-300">
        Carregando produção…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-900 p-3 text-ink-50 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Produção — Itens Vendidos</h1>
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
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-brand-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-brand-500"
          >
            + Novo item
          </button>
        <BackLink />
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Total" value={String(kpis.total)} />
        <Kpi label="Não iniciado" value={String(kpis.naoIniciado)} />
        <Kpi label="Em produção" value={String(kpis.emProducao)} tone="indigo" />
        <Kpi label="Concluído / Entregue" value={String(kpis.concluido + kpis.entregue)} tone="emerald" />
        <Kpi label="Atrasados" value={String(kpis.atrasados)} tone="red" />
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
          <p className="mb-3 text-sm font-medium text-ink-100">Novo item de produção</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Código do cliente">
              <input
                value={form.cliente_codigo}
                onChange={(e) => setForm((f) => ({ ...f, cliente_codigo: e.target.value }))}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <Field label="Nº controle do contrato">
              <input
                value={form.contrato_nro_controle}
                onChange={(e) => setForm((f) => ({ ...f, contrato_nro_controle: e.target.value }))}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <Field label="Produto">
              <input
                value={form.produto}
                onChange={(e) => setForm((f) => ({ ...f, produto: e.target.value }))}
                placeholder="ex.: 3030, foto avulsa…"
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <Field label="Tipo de edição">
              <input
                value={form.tipo_edicao}
                onChange={(e) => setForm((f) => ({ ...f, tipo_edicao: e.target.value }))}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <Field label="Prazo do estúdio">
              <input
                type="date"
                value={form.prazo_estudio}
                onChange={(e) => setForm((f) => ({ ...f, prazo_estudio: e.target.value }))}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <Field label="Prazo do cliente">
              <input
                type="date"
                value={form.prazo_cliente}
                onChange={(e) => setForm((f) => ({ ...f, prazo_cliente: e.target.value }))}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Observações">
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
                />
              </Field>
            </div>
          </div>
          {formError && <p className="mt-3 text-sm text-red-400">{formError}</p>}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleCriar}
              disabled={saving}
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              Salvar item
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
                setFormError("");
              }}
              className="text-sm text-ink-300 hover:text-ink-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as "" | StatusProducao }))}
          className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
        >
          <option value="">Todos os status</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-ink-300">
          <input
            type="checkbox"
            checked={filters.soAtrasados}
            onChange={(e) => setFilters((f) => ({ ...f, soAtrasados: e.target.checked }))}
          />
          Só atrasados
        </label>
        <input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Buscar cliente, produto, contrato, instituição…"
          className="min-w-[240px] flex-1 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
        />
        {(filters.status || filters.search || filters.soAtrasados) && (
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
              <th className="px-2.5 py-1.5">Cliente</th>
              <th className="px-2.5 py-1.5">Instituição</th>
              <th className="px-2.5 py-1.5">Produto</th>
              <th className="px-2.5 py-1.5">Edição</th>
              <th className="px-2.5 py-1.5">Prazo estúdio</th>
              <th className="px-2.5 py-1.5">Prazo cliente</th>
              <th className="px-2.5 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {!filtrados.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-ink-400">
                  Nenhum item encontrado.
                </td>
              </tr>
            )}
            {filtrados.map((it) => (
              <tr key={it.id} className="border-b border-ink-800/60 hover:bg-ink-800/40">
                <td className="cursor-pointer px-2.5 py-1.5" onClick={() => setDrawerId(it.id)}>{it.clienteNome}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{it.instituicao}</td>
                <td className="px-2.5 py-1.5">{it.produto}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{it.tipo_edicao || "—"}</td>
                <td className={`px-2.5 py-1.5 ${atrasado(it) ? "text-red-400" : "text-ink-300"}`}>
                  {fmtDateBR(it.prazo_estudio) || "—"}
                </td>
                <td className="px-2.5 py-1.5 text-ink-300">{fmtDateBR(it.prazo_cliente) || "—"}</td>
                <td className="px-2.5 py-1.5">
                  <select
                    value={it.status}
                    onChange={(e) => handleStatusChange(it, e.target.value as StatusProducao)}
                    onClick={(e) => e.stopPropagation()}
                    className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(it.status)}`}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawerItem && (
        <div className="fixed inset-0 z-20 flex justify-end bg-black/50" onClick={() => setDrawerId(null)}>
          <div
            className="h-full w-full max-w-md overflow-auto border-l border-ink-800 bg-ink-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-lg font-medium">{drawerItem.clienteNome}</p>
                <p className="text-sm text-ink-400">
                  {drawerItem.instituicao} {drawerItem.curso ? `· ${drawerItem.curso}` : ""}
                </p>
              </div>
              <button onClick={() => setDrawerId(null)} className="text-ink-400 hover:text-ink-50">✕</button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Produto" value={drawerItem.produto} />
              <InfoRow label="Tipo de edição" value={drawerItem.tipo_edicao || "—"} />
              <InfoRow label="Prazo estúdio" value={fmtDateBR(drawerItem.prazo_estudio) || "—"} />
              <InfoRow label="Prazo cliente" value={fmtDateBR(drawerItem.prazo_cliente) || "—"} />
              <InfoRow label="Contrato" value={drawerItem.contrato_nro_controle || "—"} />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs text-ink-400">Observações</label>
              <textarea
                defaultValue={drawerItem.observacoes || ""}
                onBlur={(e) => handleSalvarObs(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </div>

            <button
              onClick={handleExcluir}
              className="w-full rounded-md border border-red-900 bg-red-950/50 px-2.5 py-1 text-sm text-red-400 hover:bg-red-950"
            >
              Remover item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function statusClass(status: StatusProducao): string {
  switch (status) {
    case "nao_iniciado":
      return "border-ink-600 bg-ink-800 text-ink-100";
    case "em_producao":
      return "border-brand-800 bg-brand-950 text-brand-300";
    case "concluido":
      return "border-emerald-800 bg-emerald-950 text-emerald-300";
    case "entregue":
      return "border-emerald-700 bg-emerald-900 text-emerald-200";
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-ink-400">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-400">{label}</p>
      <p>{value}</p>
    </div>
  );
}
