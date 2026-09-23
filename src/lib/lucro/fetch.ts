import { fetchAllRows } from "@/lib/fetchAll";
import { loadVendasData } from "@/lib/vendas/fetch";
import { computeLucroPorContrato, type ContratoRef, type LucroPorContrato } from "./engine";

interface ParcelaRow {
  contrato_nro_controle: string | null;
  valor_parcela: number;
}

interface ContaPagarRow {
  contrato_nro_controle: string | null;
  valor_pago: number;
}

export async function loadLucroPorContrato(): Promise<LucroPorContrato[]> {
  const [contratos, parcelas, contasPagar, vendas] = await Promise.all([
    fetchAllRows<ContratoRef>("contratos", "nro_controle,instituicao,curso"),
    fetchAllRows<ParcelaRow>("financeiro_parcelas", "contrato_nro_controle,valor_parcela"),
    fetchAllRows<ContaPagarRow>("contas_pagar", "contrato_nro_controle,valor_pago"),
    loadVendasData(),
  ]);

  const parcelasPorContrato = new Map<string, number>();
  parcelas.forEach((p) => {
    if (!p.contrato_nro_controle) return;
    parcelasPorContrato.set(
      p.contrato_nro_controle,
      (parcelasPorContrato.get(p.contrato_nro_controle) || 0) + (p.valor_parcela || 0)
    );
  });

  const despesasPorContrato = new Map<string, number>();
  contasPagar.forEach((c) => {
    if (!c.contrato_nro_controle) return;
    despesasPorContrato.set(
      c.contrato_nro_controle,
      (despesasPorContrato.get(c.contrato_nro_controle) || 0) + (c.valor_pago || 0)
    );
  });

  // PDV: vendas avulsas por contrato — exclui a linha sintética "NAO COMPROU"
  const pdvPorContrato = new Map<string, number>();
  vendas
    .filter((v) => v.descricao !== "NAO COMPROU")
    .forEach((v) => {
      if (!v.nroControle) return;
      pdvPorContrato.set(v.nroControle, (pdvPorContrato.get(v.nroControle) || 0) + v.total);
    });

  return computeLucroPorContrato(contratos, parcelasPorContrato, pdvPorContrato, despesasPorContrato);
}
