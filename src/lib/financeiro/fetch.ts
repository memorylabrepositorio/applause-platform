import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/fetchAll";
import type { ClienteRef, ContratoRef, Parcela } from "./engine";

export interface FinanceiroData {
  parcelas: Parcela[];
  clientes: ClienteRef[];
  contratos: ContratoRef[];
}

export async function loadFinanceiroData(): Promise<FinanceiroData> {
  const [parcelas, clientesRaw, contratosRaw] = await Promise.all([
    fetchAllRows<Parcela>("financeiro_parcelas"),
    fetchAllRows<{ codigo: number; nome_cliente: string; telefone: string | null; nro_controle: string | null }>(
      "clientes",
      "codigo,nome_cliente,telefone,nro_controle"
    ),
    fetchAllRows<{ nro_controle: string; instituicao: string; curso: string }>(
      "contratos",
      "nro_controle,instituicao,curso"
    ),
  ]);
  const clientes: ClienteRef[] = clientesRaw;
  const contratos: ContratoRef[] = contratosRaw;
  return { parcelas, clientes, contratos };
}

export async function criarParcela(payload: Partial<Parcela>): Promise<Parcela> {
  const { data, error } = await supabase.from("financeiro_parcelas").insert(payload).select();
  if (error || !data || !data.length) throw error || new Error("Erro desconhecido ao criar parcela");
  return data[0] as Parcela;
}

export async function atualizarParcela(id: number, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from("financeiro_parcelas")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function marcarComoPaga(id: number, valorPago: number, pagoEm: string): Promise<void> {
  const { error } = await supabase
    .from("financeiro_parcelas")
    .update({
      pago: true,
      valor_pago: valorPago,
      pago_em: pagoEm,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function desmarcarPaga(id: number): Promise<void> {
  const { error } = await supabase
    .from("financeiro_parcelas")
    .update({ pago: false, valor_pago: null, pago_em: null, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function excluirParcela(id: number): Promise<void> {
  const { error } = await supabase.from("financeiro_parcelas").delete().eq("id", id);
  if (error) throw error;
}
