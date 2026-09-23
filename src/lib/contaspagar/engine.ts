// Módulo Contas a Pagar — orçamento por contrato/instituição (ex.: orçamento
// do Pedro para formaturas): quanto está previsto pagar, quanto já foi pago,
// e quanto ainda falta, mês a mês.

export type StatusConta = "pendente" | "pago" | "atrasado";
export type OrigemLancamento = "manual" | "pronet";

export interface ContaPagar {
  id: number;
  contrato_nro_controle: string | null;
  instituicao: string | null;
  descricao: string;
  valor_previsto: number;
  valor_pago: number;
  mes_referencia: string | null; // ISO date (dia 1 do mês)
  status: StatusConta;
  origem: OrigemLancamento;
  criado_em?: string;
}

export const STATUS_LABEL: Record<StatusConta, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
};

export function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtMesBR(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${MESES[Number(m[2]) - 1]}/${m[1]}`;
}

export function saldoRestante(c: ContaPagar): number {
  return Math.max(0, c.valor_previsto - c.valor_pago);
}

export interface ContasPagarFilters {
  status: "" | StatusConta;
  search: string;
}

export const EMPTY_FILTERS: ContasPagarFilters = { status: "", search: "" };

export function applyFilters(rows: ContaPagar[], f: ContasPagarFilters): ContaPagar[] {
  const term = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status && r.status !== f.status) return false;
    if (term) {
      const alvo = `${r.descricao} ${r.instituicao || ""} ${r.contrato_nro_controle || ""}`.toLowerCase();
      if (!alvo.includes(term)) return false;
    }
    return true;
  });
}

export interface ContasPagarKpis {
  totalPrevisto: number;
  totalPago: number;
  totalRestante: number;
}

export function computeKpis(rows: ContaPagar[]): ContasPagarKpis {
  let totalPrevisto = 0;
  let totalPago = 0;
  rows.forEach((r) => {
    totalPrevisto += r.valor_previsto;
    totalPago += r.valor_pago;
  });
  return { totalPrevisto, totalPago, totalRestante: Math.max(0, totalPrevisto - totalPago) };
}
