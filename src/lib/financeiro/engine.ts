// Módulo Financeiro — contas a receber (parcelas).

export type FormaPagamento = "pix" | "boleto" | "cartao" | "dinheiro" | "outro";
export type OrigemLancamento = "manual" | "pronet";
export type StatusParcela = "pago" | "vencido" | "em_dia";
export type AsaasBillingType = "PIX" | "BOLETO";

export interface Parcela {
  id: number;
  cliente_codigo: number;
  contrato_nro_controle: string | null;
  forma_pagamento: FormaPagamento;
  numero_parcela: number;
  total_parcelas: number;
  valor_parcela: number;
  vencimento: string; // ISO date
  pago: boolean;
  pago_em: string | null;
  valor_pago: number | null;
  telefone_cobranca: string | null;
  observacoes: string | null;
  origem: OrigemLancamento;
  criado_em?: string;
  // cobrança automática via Asaas (boleto/PIX) — null enquanto não gerada
  asaas_charge_id?: string | null;
  asaas_payment_url?: string | null;
  asaas_billing_type?: AsaasBillingType | null;
  asaas_status?: string | null;
}

// status que o Asaas devolve — mapeados pra um rótulo em pt-BR
export const ASAAS_STATUS_LABEL: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  RECEIVED: "Recebido",
  CONFIRMED: "Confirmado",
  OVERDUE: "Vencido no Asaas",
  REFUNDED: "Estornado",
  RECEIVED_IN_CASH: "Recebido em dinheiro",
  REFUND_REQUESTED: "Estorno solicitado",
  CHARGEBACK_REQUESTED: "Chargeback solicitado",
  DELETED: "Cancelado",
};

export interface ClienteRef {
  codigo: number;
  nome_cliente: string;
  telefone: string | null;
  nro_controle: string | null;
}

export interface ContratoRef {
  nro_controle: string;
  instituicao: string;
  curso: string;
}

export interface ParcelaEnriquecida extends Parcela {
  clienteNome: string;
  instituicao: string;
  curso: string;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function statusParcela(p: Parcela): StatusParcela {
  if (p.pago) return "pago";
  if (p.vencimento < todayISO()) return "vencido";
  return "em_dia";
}

export function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtDateBR(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function enriquecerParcelas(
  parcelas: Parcela[],
  clientes: ClienteRef[],
  contratos: ContratoRef[]
): ParcelaEnriquecida[] {
  const clientesByCodigo = new Map(clientes.map((c) => [c.codigo, c]));
  const contratosByNro = new Map(contratos.map((c) => [c.nro_controle, c]));
  return parcelas.map((p) => {
    const cliente = clientesByCodigo.get(p.cliente_codigo);
    const contrato = p.contrato_nro_controle ? contratosByNro.get(p.contrato_nro_controle) : undefined;
    return {
      ...p,
      clienteNome: cliente?.nome_cliente || `Cliente #${p.cliente_codigo}`,
      instituicao: contrato?.instituicao || "",
      curso: contrato?.curso || "",
    };
  });
}

export interface FinanceiroFilters {
  status: "" | StatusParcela;
  search: string;
}

export const EMPTY_FILTERS: FinanceiroFilters = { status: "", search: "" };

export function applyFilters(rows: ParcelaEnriquecida[], f: FinanceiroFilters): ParcelaEnriquecida[] {
  const term = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status && statusParcela(r) !== f.status) return false;
    if (term) {
      const alvo = `${r.clienteNome} ${r.contrato_nro_controle || ""} ${r.telefone_cobranca || ""} ${r.instituicao}`.toLowerCase();
      if (!alvo.includes(term)) return false;
    }
    return true;
  });
}

export interface FinanceiroKpis {
  totalContratado: number;
  totalRecebido: number;
  totalEmAberto: number;
  totalVencido: number;
}

export function computeKpis(rows: ParcelaEnriquecida[]): FinanceiroKpis {
  let totalContratado = 0;
  let totalRecebido = 0;
  let totalEmAberto = 0;
  let totalVencido = 0;
  rows.forEach((r) => {
    totalContratado += r.valor_parcela;
    const status = statusParcela(r);
    if (status === "pago") totalRecebido += r.valor_pago ?? r.valor_parcela;
    else if (status === "vencido") totalVencido += r.valor_parcela;
    else totalEmAberto += r.valor_parcela;
  });
  return { totalContratado, totalRecebido, totalEmAberto, totalVencido };
}
