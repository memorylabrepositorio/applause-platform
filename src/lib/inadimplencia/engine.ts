export interface InadimplenciaResumo {
  id: number;
  contrato_nro_controle: string;
  cliente_nome: string;
  item_seq: number;
  valor_contratado: number;
  valor_faturado: number;
  valor_pendente: number;
  valor_quitado: number;
  valor_a_vencer: number;
  valor_inadimplente: number;
  percentual_inadimplente: number;
  referencia_em: string;
  origem: string;
}

export interface InadimplenciaKpis {
  totalInadimplente: number;
  /** % ponderado pelo valor contratado de todo o relatório (não a média simples das linhas) */
  percentualMedio: number;
  contratosAfetados: number;
  registrosInadimplentes: number;
  referenciaEm: string | null;
}

export function computeInadimplenciaKpis(rows: InadimplenciaResumo[]): InadimplenciaKpis {
  const inadimplentes = rows.filter((r) => r.valor_inadimplente > 0);
  const totalInadimplente = inadimplentes.reduce((s, r) => s + r.valor_inadimplente, 0);
  const totalContratado = rows.reduce((s, r) => s + r.valor_contratado, 0);
  const percentualMedio = totalContratado > 0 ? (totalInadimplente / totalContratado) * 100 : 0;
  const contratosAfetados = new Set(inadimplentes.map((r) => r.contrato_nro_controle)).size;
  const referenciaEm = rows.length
    ? rows.reduce((max, r) => (r.referencia_em > max ? r.referencia_em : max), rows[0].referencia_em)
    : null;
  return {
    totalInadimplente,
    percentualMedio,
    contratosAfetados,
    registrosInadimplentes: inadimplentes.length,
    referenciaEm,
  };
}

export interface InadimplenciaFilters {
  search: string;
  apenasInadimplentes: boolean;
  /** "" = todos os contratos */
  contrato: string;
}

export const EMPTY_INAD_FILTERS: InadimplenciaFilters = { search: "", apenasInadimplentes: true, contrato: "" };

export function applyInadimplenciaFilters(
  rows: InadimplenciaResumo[],
  filters: InadimplenciaFilters
): InadimplenciaResumo[] {
  let out = rows;
  if (filters.apenasInadimplentes) out = out.filter((r) => r.valor_inadimplente > 0);
  if (filters.contrato) out = out.filter((r) => r.contrato_nro_controle === filters.contrato);
  const q = filters.search.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (r) => r.cliente_nome.toLowerCase().includes(q) || r.contrato_nro_controle.toLowerCase().includes(q)
    );
  }
  return out;
}

/** lista de contratos distintos presentes nos dados, ordenada alfabeticamente — pro seletor de contrato */
export function listarContratos(rows: InadimplenciaResumo[]): string[] {
  return Array.from(new Set(rows.map((r) => r.contrato_nro_controle))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

export function fmtPct(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}
