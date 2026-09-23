// Lucro por contrato — cruza contrato de formatura (financeiro_parcelas) +
// PDV (vendas) + despesas (contas_pagar) pra saber quanto cada contrato
// rendeu de lucro no total.

export interface ContratoRef {
  nro_controle: string;
  instituicao: string;
  curso: string;
}

export interface LucroPorContrato {
  nroControle: string;
  instituicao: string;
  curso: string;
  receitaFormatura: number; // soma das parcelas financeiro_parcelas
  receitaPDV: number; // soma das vendas avulsas (produtos, sessões extras)
  despesas: number; // soma valor_pago em contas_pagar
  lucro: number;
}

export function computeLucroPorContrato(
  contratos: ContratoRef[],
  parcelasPorContrato: Map<string, number>,
  pdvPorContrato: Map<string, number>,
  despesasPorContrato: Map<string, number>
): LucroPorContrato[] {
  const nros = new Set<string>([
    ...contratos.map((c) => c.nro_controle),
    ...parcelasPorContrato.keys(),
    ...pdvPorContrato.keys(),
    ...despesasPorContrato.keys(),
  ]);
  const contratoByNro = new Map(contratos.map((c) => [c.nro_controle, c]));

  const rows: LucroPorContrato[] = [];
  nros.forEach((nro) => {
    if (!nro) return;
    const contrato = contratoByNro.get(nro);
    const receitaFormatura = parcelasPorContrato.get(nro) || 0;
    const receitaPDV = pdvPorContrato.get(nro) || 0;
    const despesas = despesasPorContrato.get(nro) || 0;
    if (!receitaFormatura && !receitaPDV && !despesas) return;
    rows.push({
      nroControle: nro,
      instituicao: contrato?.instituicao || "",
      curso: contrato?.curso || "",
      receitaFormatura,
      receitaPDV,
      despesas,
      lucro: receitaFormatura + receitaPDV - despesas,
    });
  });
  return rows;
}

export function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export interface LucroFilters {
  search: string;
}

export const EMPTY_FILTERS: LucroFilters = { search: "" };

export function applyFilters(rows: LucroPorContrato[], f: LucroFilters): LucroPorContrato[] {
  const term = f.search.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((r) =>
    `${r.instituicao} ${r.curso} ${r.nroControle}`.toLowerCase().includes(term)
  );
}
