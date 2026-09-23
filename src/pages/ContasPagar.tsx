import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { atualizarConta, criarConta, excluirConta, loadContasPagar } from "@/lib/contaspagar/fetch";
import {
  EMPTY_FILTERS,
  STATUS_LABEL,
  applyFilters,
  computeKpis,
  fmtBRL,
  fmtMesBR,
  saldoRestante,
  type ContaPagar,
  type ContasPagarFilters,
  type StatusConta,
} from "@/lib/contaspagar/engine";

type StatusKind = "ok" | "err" | null;

const EMPTY_FORM = {
  contrato_nro_controle: "",
  instituicao: "",
  descricao: "",
  valor_previsto: "",
  valor_pago: "0",
  mes_referencia: "",
};

export default function ContasPagar() {
  const [contas, setContas] = useState<ContaPagar[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<StatusKind>(null);
  const [statusText, setStatusText] = useState("Carregando…");

  const [filters, setFilters] = useState<ContasPagarFilters>(EMPTY_FILTERS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [pagoValor, setPagoValor] = useState("");

  async function refresh(manual = false) {
    if (manual) {
      setStatusKind(null);
      setStatusText("Atualizando…");
    }
    try {
      const data = await loadContasPagar();
      setContas(data);
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

  const kpis = useMemo(() => computeKpis(contas || []), [contas]);

  const filtradas = useMemo(() => {
    const rows = applyFilters(contas || [], filters);
    return rows.sort((a, b) => (a.mes_referencia || "9999").localeCompare(b.mes_referencia || "9999"));
  }, [contas, filters]);

  const drawerConta = useMemo(
    () => (drawerId != null ? (contas || []).find((c) => c.id === drawerId) || null : null),
    [contas, drawerId]
  );

  function openDrawer(c: ContaPagar) {
    setDrawerId(c.id);
    setPagoValor(String(c.valor_pago));
  }

  async function handleCriar() {
    setFormError("");
    const valorPrevisto = Number(form.valor_previsto.replace(",", "."));
    if (!form.descricao.trim()) {
      setFormError("Informe a descrição.");
      return;
    }
    if (!valorPrevisto || valorPrevisto <= 0) {
      setFormError("Informe um valor previsto válido.");
      return;
    }
    setSaving(true);
    try {
      const nova = await criarConta({
        contrato_nro_controle: form.contrato_nro_controle || null,
        instituicao: form.instituicao || null,
        descricao: form.descricao.trim(),
        valor_previsto: valorPrevisto,
        valor_pago: Number(form.valor_pago.replace(",", ".")) || 0,
        mes_referencia: form.mes_referencia || null,
        status: "pendente",
        origem: "manual",
      });
      setContas((prev) => (prev ? [nova, ...prev] : [nova]));
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erro desconhecido ao criar conta");
    } finally {
      setSaving(false);
    }
  }

  async function handleAtualizarPago() {
    if (!drawerConta) return;
    const valor = Number(pagoValor.replace(",", "."));
    const status: StatusConta = valor >= drawerConta.valor_previsto ? "pago" : "pendente";
    try {
      await atualizarConta(drawerConta.id, { valor_pago: valor, status });
      setContas((prev) =>
        prev ? prev.map((c) => (c.id === drawerConta.id ? { ...c, valor_pago: valor, status } : c)) : prev
      );
    } catch (e: unknown) {
      alert("Erro ao atualizar pagamento: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleMarcarAtrasado() {
    if (!drawerConta) return;
    try {
      await atualizarConta(drawerConta.id, { status: "atrasado" });
      setContas((prev) =>
        prev ? prev.map((c) => (c.id === drawerConta.id ? { ...c, status: "atrasado" } : c)) : prev
      );
    } catch (e: unknown) {
      alert("Erro ao atualizar status: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleExcluir() {
    if (!drawerConta) return;
    if (!confirm(`Remover "${drawerConta.descricao}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await excluirConta(drawerConta.id);
      setContas((prev) => (prev ? prev.filter((c) => c.id !== drawerConta.id) : prev));
      setDrawerId(null);
    } catch (e: unknown) {
      alert("Erro ao remover: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  if (loadError && !contas) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-900 text-ink-50">
        <p className="text-red-400">Não foi possível carregar os dados: {loadError}</p>
        <Link to="/" className="text-brand-400 hover:text-brand-300">← Voltar</Link>
      </div>
    );
  }

  if (!contas) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-ink-300">
        Carregando contas a pagar…
      </div>
    );
  }

  return (
    <Layout>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Contas a Pagar — Orçamento</h1>
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
            + Nova conta
          </button>
          <Link to="/lucro" className="text-sm text-ink-300 hover:text-ink-50">
            Lucro por contrato →
          </Link>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Previsto" value={fmtBRL(kpis.totalPrevisto)} />
        <Kpi label="Pago" value={fmtBRL(kpis.totalPago)} tone="emerald" />
        <Kpi label="Falta pagar" value={fmtBRL(kpis.totalRestante)} tone="red" />
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
          <p className="mb-3 text-sm font-medium text-ink-100">Nova conta a pagar</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nº controle do contrato">
              <input
                value={form.contrato_nro_controle}
                onChange={(e) => setForm((f) => ({ ...f, contrato_nro_controle: e.target.value }))}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <Field label="Instituição">
              <input
                value={form.instituicao}
                onChange={(e) => setForm((f) => ({ ...f, instituicao: e.target.value }))}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <Field label="Mês de referência">
              <input
                type="date"
                value={form.mes_referencia}
                onChange={(e) => setForm((f) => ({ ...f, mes_referencia: e.target.value }))}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Descrição">
                <input
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="ex.: Pagamento formatura São José — parcela 1"
                  className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
                />
              </Field>
            </div>
            <Field label="Valor previsto (R$)">
              <input
                value={form.valor_previsto}
                onChange={(e) => setForm((f) => ({ ...f, valor_previsto: e.target.value }))}
                placeholder="0,00"
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <Field label="Valor já pago (R$)">
              <input
                value={form.valor_pago}
                onChange={(e) => setForm((f) => ({ ...f, valor_pago: e.target.value }))}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
          </div>
          {formError && <p className="mt-3 text-sm text-red-400">{formError}</p>}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleCriar}
              disabled={saving}
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              Salvar conta
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
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as "" | StatusConta }))}
          className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="atrasado">Atrasado</option>
        </select>
        <input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Buscar descrição, instituição, contrato…"
          className="min-w-[240px] flex-1 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
        />
        {(filters.status || filters.search) && (
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="rounded-md border border-ink-600 px-2.5 py-1 text-sm text-ink-300 hover:text-ink-50"
          >
            Limpar filtros
          </button>
        )}
        <span className="text-xs text-ink-400">{filtradas.length} conta(s)</span>
      </div>

      <div className="overflow-auto rounded-lg border border-ink-800 bg-ink-850">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-800 text-xs text-ink-400">
            <tr>
              <th className="px-2.5 py-1.5">Descrição</th>
              <th className="px-2.5 py-1.5">Instituição</th>
              <th className="px-2.5 py-1.5">Mês</th>
              <th className="px-2.5 py-1.5">Previsto</th>
              <th className="px-2.5 py-1.5">Pago</th>
              <th className="px-2.5 py-1.5">Falta</th>
              <th className="px-2.5 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {!filtradas.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-ink-400">
                  Nenhuma conta encontrada.
                </td>
              </tr>
            )}
            {filtradas.map((c) => (
              <tr
                key={c.id}
                onClick={() => openDrawer(c)}
                className="cursor-pointer border-b border-ink-800/60 hover:bg-ink-800/40"
              >
                <td className="px-2.5 py-1.5">{c.descricao}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{c.instituicao || "—"}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{fmtMesBR(c.mes_referencia) || "—"}</td>
                <td className="px-2.5 py-1.5">{fmtBRL(c.valor_previsto)}</td>
                <td className="px-2.5 py-1.5 text-emerald-400">{fmtBRL(c.valor_pago)}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{fmtBRL(saldoRestante(c))}</td>
                <td className="px-2.5 py-1.5">
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawerConta && (
        <div className="fixed inset-0 z-20 flex justify-end bg-black/50" onClick={() => setDrawerId(null)}>
          <div
            className="h-full w-full max-w-md overflow-auto border-l border-ink-800 bg-ink-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-lg font-medium">{drawerConta.descricao}</p>
                <p className="text-sm text-ink-400">{drawerConta.instituicao || "—"}</p>
              </div>
              <button onClick={() => setDrawerId(null)} className="text-ink-400 hover:text-ink-50">✕</button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Contrato" value={drawerConta.contrato_nro_controle || "—"} />
              <InfoRow label="Mês" value={fmtMesBR(drawerConta.mes_referencia) || "—"} />
              <InfoRow label="Previsto" value={fmtBRL(drawerConta.valor_previsto)} />
              <InfoRow label="Falta" value={fmtBRL(saldoRestante(drawerConta))} />
            </div>

            <div className="mb-4">
              <StatusBadge status={drawerConta.status} />
            </div>

            <div className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
              <p className="mb-2 text-xs text-ink-400">Atualizar valor pago</p>
              <div className="mb-2 flex gap-2">
                <input
                  value={pagoValor}
                  onChange={(e) => setPagoValor(e.target.value)}
                  className="flex-1 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
                />
                <button
                  onClick={handleAtualizarPago}
                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Salvar
                </button>
              </div>
              {drawerConta.status !== "atrasado" && drawerConta.status !== "pago" && (
                <button onClick={handleMarcarAtrasado} className="text-xs text-amber-400 hover:text-amber-300">
                  Marcar como atrasado
                </button>
              )}
            </div>

            <button
              onClick={handleExcluir}
              className="w-full rounded-md border border-red-900 bg-red-950/50 px-2.5 py-1 text-sm text-red-400 hover:bg-red-950"
            >
              Remover conta
            </button>
          </div>
        </div>
      )}
    </Layout>
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

function StatusBadge({ status }: { status: StatusConta }) {
  const map: Record<StatusConta, string> = {
    pendente: "border-amber-800 bg-amber-950 text-amber-300",
    pago: "border-emerald-800 bg-emerald-950 text-emerald-300",
    atrasado: "border-red-800 bg-red-950 text-red-300",
  };
  return (
    <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${map[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
