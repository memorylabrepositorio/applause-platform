import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import {
  atualizarParcela,
  criarParcela,
  desmarcarPaga,
  excluirParcela,
  loadFinanceiroData,
  marcarComoPaga,
} from "@/lib/financeiro/fetch";
import {
  EMPTY_FILTERS,
  applyFilters,
  computeKpis,
  enriquecerParcelas,
  fmtBRL,
  fmtDateBR,
  statusParcela,
  todayISO,
  type ClienteRef,
  type ContratoRef,
  type FinanceiroFilters,
  type FormaPagamento,
  type Parcela,
  type ParcelaEnriquecida,
  type StatusParcela,
} from "@/lib/financeiro/engine";

type StatusKind = "ok" | "err" | null;

const FORMAS: FormaPagamento[] = ["pix", "boleto", "cartao", "dinheiro", "outro"];
const FORMA_LABEL: Record<FormaPagamento, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

const EMPTY_FORM = {
  cliente_codigo: "",
  contrato_nro_controle: "",
  forma_pagamento: "boleto" as FormaPagamento,
  numero_parcela: "1",
  total_parcelas: "1",
  valor_parcela: "",
  vencimento: todayISO(),
  telefone_cobranca: "",
  observacoes: "",
};

export default function Financeiro() {
  const [parcelas, setParcelas] = useState<Parcela[] | null>(null);
  const [clientes, setClientes] = useState<ClienteRef[]>([]);
  const [contratos, setContratos] = useState<ContratoRef[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<StatusKind>(null);
  const [statusText, setStatusText] = useState("Carregando…");

  const [filters, setFilters] = useState<FinanceiroFilters>(EMPTY_FILTERS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [pagoValor, setPagoValor] = useState("");
  const [pagoData, setPagoData] = useState(todayISO());

  async function refresh(manual = false) {
    if (manual) {
      setStatusKind(null);
      setStatusText("Atualizando…");
    }
    try {
      const data = await loadFinanceiroData();
      setParcelas(data.parcelas);
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

  const enriquecidas = useMemo(
    () => (parcelas ? enriquecerParcelas(parcelas, clientes, contratos) : []),
    [parcelas, clientes, contratos]
  );

  const kpis = useMemo(() => computeKpis(enriquecidas), [enriquecidas]);

  const filtradas = useMemo(() => {
    const rows = applyFilters(enriquecidas, filters);
    return rows.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [enriquecidas, filters]);

  const drawerParcela = useMemo(
    () => (drawerId != null ? enriquecidas.find((p) => p.id === drawerId) || null : null),
    [enriquecidas, drawerId]
  );

  function openDrawer(p: ParcelaEnriquecida) {
    setDrawerId(p.id);
    setPagoValor(String(p.valor_pago ?? p.valor_parcela));
    setPagoData(p.pago_em || todayISO());
  }

  async function handleCriar() {
    setFormError("");
    const clienteCodigo = Number(form.cliente_codigo);
    const valor = Number(form.valor_parcela.replace(",", "."));
    if (!clienteCodigo) {
      setFormError("Informe o código do cliente.");
      return;
    }
    if (!valor || valor <= 0) {
      setFormError("Informe um valor de parcela válido.");
      return;
    }
    if (!form.vencimento) {
      setFormError("Informe o vencimento.");
      return;
    }
    setSaving(true);
    try {
      const nova = await criarParcela({
        cliente_codigo: clienteCodigo,
        contrato_nro_controle: form.contrato_nro_controle || null,
        forma_pagamento: form.forma_pagamento,
        numero_parcela: Number(form.numero_parcela) || 1,
        total_parcelas: Number(form.total_parcelas) || 1,
        valor_parcela: valor,
        vencimento: form.vencimento,
        telefone_cobranca: form.telefone_cobranca || null,
        observacoes: form.observacoes || null,
        pago: false,
        origem: "manual",
      });
      setParcelas((prev) => (prev ? [nova, ...prev] : [nova]));
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erro desconhecido ao criar parcela");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarcarPaga() {
    if (!drawerParcela) return;
    const valor = Number(pagoValor.replace(",", "."));
    try {
      await marcarComoPaga(drawerParcela.id, valor || drawerParcela.valor_parcela, pagoData);
      setParcelas((prev) =>
        prev
          ? prev.map((p) =>
              p.id === drawerParcela.id ? { ...p, pago: true, valor_pago: valor, pago_em: pagoData } : p
            )
          : prev
      );
    } catch (e: unknown) {
      alert("Erro ao marcar como paga: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleDesmarcar() {
    if (!drawerParcela) return;
    try {
      await desmarcarPaga(drawerParcela.id);
      setParcelas((prev) =>
        prev
          ? prev.map((p) => (p.id === drawerParcela.id ? { ...p, pago: false, valor_pago: null, pago_em: null } : p))
          : prev
      );
    } catch (e: unknown) {
      alert("Erro ao desmarcar: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleExcluir() {
    if (!drawerParcela) return;
    if (!confirm(`Remover a parcela de ${drawerParcela.clienteNome}? Essa ação não pode ser desfeita.`)) return;
    try {
      await excluirParcela(drawerParcela.id);
      setParcelas((prev) => (prev ? prev.filter((p) => p.id !== drawerParcela.id) : prev));
      setDrawerId(null);
    } catch (e: unknown) {
      alert("Erro ao remover: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  async function handleSalvarObs(texto: string) {
    if (!drawerParcela) return;
    try {
      await atualizarParcela(drawerParcela.id, { observacoes: texto || null });
      setParcelas((prev) =>
        prev ? prev.map((p) => (p.id === drawerParcela.id ? { ...p, observacoes: texto || null } : p)) : prev
      );
    } catch (e: unknown) {
      alert("Erro ao salvar observação: " + (e instanceof Error ? e.message : "erro desconhecido"));
    }
  }

  if (loadError && !parcelas) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-900 text-ink-50">
        <p className="text-red-400">Não foi possível carregar os dados: {loadError}</p>
        <Link to="/" className="text-brand-400 hover:text-brand-300">← Voltar</Link>
      </div>
    );
  }

  if (!parcelas) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-ink-300">
        Carregando financeiro…
      </div>
    );
  }

  return (
    <Layout>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Financeiro — Contas a Receber</h1>
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
            + Nova parcela
          </button>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total contratado" value={fmtBRL(kpis.totalContratado)} />
        <Kpi label="Recebido" value={fmtBRL(kpis.totalRecebido)} tone="emerald" />
        <Kpi label="Em aberto (em dia)" value={fmtBRL(kpis.totalEmAberto)} tone="slate" />
        <Kpi label="Vencido" value={fmtBRL(kpis.totalVencido)} tone="red" />
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
          <p className="mb-3 text-sm font-medium text-ink-100">Nova parcela</p>
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
            <Field label="Forma de pagamento">
              <select
                value={form.forma_pagamento}
                onChange={(e) => setForm((f) => ({ ...f, forma_pagamento: e.target.value as FormaPagamento }))}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              >
                {FORMAS.map((f) => (
                  <option key={f} value={f}>{FORMA_LABEL[f]}</option>
                ))}
              </select>
            </Field>
            <Field label="Vencimento">
              <input
                type="date"
                value={form.vencimento}
                onChange={(e) => setForm((f) => ({ ...f, vencimento: e.target.value }))}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <Field label="Valor da parcela (R$)">
              <input
                value={form.valor_parcela}
                onChange={(e) => setForm((f) => ({ ...f, valor_parcela: e.target.value }))}
                placeholder="0,00"
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <Field label="Parcela nº">
              <input
                value={form.numero_parcela}
                onChange={(e) => setForm((f) => ({ ...f, numero_parcela: e.target.value }))}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <Field label="Total de parcelas">
              <input
                value={form.total_parcelas}
                onChange={(e) => setForm((f) => ({ ...f, total_parcelas: e.target.value }))}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </Field>
            <Field label="Telefone de cobrança">
              <input
                value={form.telefone_cobranca}
                onChange={(e) => setForm((f) => ({ ...f, telefone_cobranca: e.target.value }))}
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
              Salvar parcela
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
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as "" | StatusParcela }))}
          className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="em_dia">Em dia</option>
          <option value="vencido">Vencido</option>
          <option value="pago">Pago</option>
        </select>
        <input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Buscar cliente, contrato, telefone, instituição…"
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
        <span className="text-xs text-ink-400">{filtradas.length} parcela(s)</span>
      </div>

      <div className="overflow-auto rounded-lg border border-ink-800 bg-ink-850">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-800 text-xs text-ink-400">
            <tr>
              <th className="px-2.5 py-1.5">Cliente</th>
              <th className="px-2.5 py-1.5">Instituição</th>
              <th className="px-2.5 py-1.5">Parcela</th>
              <th className="px-2.5 py-1.5">Forma</th>
              <th className="px-2.5 py-1.5">Vencimento</th>
              <th className="px-2.5 py-1.5">Valor</th>
              <th className="px-2.5 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {!filtradas.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-ink-400">
                  Nenhuma parcela encontrada.
                </td>
              </tr>
            )}
            {filtradas.map((p) => (
              <tr
                key={p.id}
                onClick={() => openDrawer(p)}
                className="cursor-pointer border-b border-ink-800/60 hover:bg-ink-800/40"
              >
                <td className="px-2.5 py-1.5">{p.clienteNome}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{p.instituicao}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{p.numero_parcela}/{p.total_parcelas}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{FORMA_LABEL[p.forma_pagamento]}</td>
                <td className="px-2.5 py-1.5 text-ink-300">{fmtDateBR(p.vencimento)}</td>
                <td className="px-2.5 py-1.5">{fmtBRL(p.valor_parcela)}</td>
                <td className="px-2.5 py-1.5">
                  <StatusBadge status={statusParcela(p)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawerParcela && (
        <div className="fixed inset-0 z-20 flex justify-end bg-black/50" onClick={() => setDrawerId(null)}>
          <div
            className="h-full w-full max-w-md overflow-auto border-l border-ink-800 bg-ink-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-lg font-medium">{drawerParcela.clienteNome}</p>
                <p className="text-sm text-ink-400">
                  {drawerParcela.instituicao} {drawerParcela.curso ? `· ${drawerParcela.curso}` : ""}
                </p>
              </div>
              <button onClick={() => setDrawerId(null)} className="text-ink-400 hover:text-ink-50">✕</button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Parcela" value={`${drawerParcela.numero_parcela}/${drawerParcela.total_parcelas}`} />
              <InfoRow label="Forma" value={FORMA_LABEL[drawerParcela.forma_pagamento]} />
              <InfoRow label="Vencimento" value={fmtDateBR(drawerParcela.vencimento)} />
              <InfoRow label="Valor" value={fmtBRL(drawerParcela.valor_parcela)} />
              <InfoRow label="Contrato" value={drawerParcela.contrato_nro_controle || "—"} />
              <InfoRow label="Telefone" value={drawerParcela.telefone_cobranca || "—"} />
            </div>

            <div className="mb-4">
              <StatusBadge status={statusParcela(drawerParcela)} />
            </div>

            {!drawerParcela.pago ? (
              <div className="mb-4 rounded-lg border border-ink-800 bg-ink-850 p-3">
                <p className="mb-2 text-xs text-ink-400">Marcar como paga</p>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <input
                    value={pagoValor}
                    onChange={(e) => setPagoValor(e.target.value)}
                    placeholder="Valor pago"
                    className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
                  />
                  <input
                    type="date"
                    value={pagoData}
                    onChange={(e) => setPagoData(e.target.value)}
                    className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-sm"
                  />
                </div>
                <button
                  onClick={handleMarcarPaga}
                  className="w-full rounded-md bg-emerald-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Confirmar pagamento
                </button>
              </div>
            ) : (
              <div className="mb-4 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3">
                <p className="text-sm text-emerald-300">
                  Pago em {fmtDateBR(drawerParcela.pago_em)} · {fmtBRL(drawerParcela.valor_pago || 0)}
                </p>
                <button onClick={handleDesmarcar} className="mt-2 text-xs text-ink-300 hover:text-ink-50">
                  Desmarcar pagamento
                </button>
              </div>
            )}

            <div className="mb-4">
              <label className="mb-1 block text-xs text-ink-400">Observações</label>
              <textarea
                defaultValue={drawerParcela.observacoes || ""}
                onBlur={(e) => handleSalvarObs(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-sm"
              />
            </div>

            <button
              onClick={handleExcluir}
              className="w-full rounded-md border border-red-900 bg-red-950/50 px-2.5 py-1 text-sm text-red-400 hover:bg-red-950"
            >
              Remover parcela
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "red" | "slate" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-400" : tone === "red" ? "text-red-400" : "text-ink-50";
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

function StatusBadge({ status }: { status: StatusParcela }) {
  const map: Record<StatusParcela, string> = {
    pago: "border-emerald-800 bg-emerald-950 text-emerald-300",
    vencido: "border-red-800 bg-red-950 text-red-300",
    em_dia: "border-amber-800 bg-amber-950 text-amber-300",
  };
  const label: Record<StatusParcela, string> = {
    pago: "Pago",
    vencido: "Vencido",
    em_dia: "Em dia",
  };
  return (
    <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${map[status]}`}>
      {label[status]}
    </span>
  );
}
