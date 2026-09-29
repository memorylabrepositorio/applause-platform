import { cached } from "@/lib/cache";
import { fetchAllRows } from "@/lib/fetchAll";
import { buildRowsFromSupabase, type VendaRow } from "./engine";

async function loadVendasDataUncached(): Promise<VendaRow[]> {
  const [vendas, contratos, clientes, agenda] = await Promise.all([
    fetchAllRows<any>("vendas"),
    fetchAllRows<any>("contratos"),
    fetchAllRows<any>("clientes"),
    fetchAllRows<any>("agenda"),
  ]);
  return buildRowsFromSupabase(vendas, contratos, clientes, agenda);
}

// cacheado — essa é a consulta mais pesada do painel (4 tabelas inteiras),
// então guardar o resultado por alguns minutos é o que faz trocar de painel
// e voltar pra Vendas (ou entrar em Lucro por contrato, que reusa esses
// dados) não recarregar tudo de novo toda vez
export function loadVendasData(): Promise<VendaRow[]> {
  return cached("vendas", loadVendasDataUncached);
}
