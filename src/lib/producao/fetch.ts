import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/fetchAll";
import type { ClienteRef, ContratoRef, ProducaoItem } from "./engine";

export interface ProducaoData {
  itens: ProducaoItem[];
  clientes: ClienteRef[];
  contratos: ContratoRef[];
}

export async function loadProducaoData(): Promise<ProducaoData> {
  const [itens, clientesRaw, contratosRaw] = await Promise.all([
    fetchAllRows<ProducaoItem>("producao_itens"),
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
  return { itens, clientes, contratos };
}

export async function criarItem(payload: Partial<ProducaoItem>): Promise<ProducaoItem> {
  const { data, error } = await supabase.from("producao_itens").insert(payload).select();
  if (error || !data || !data.length) throw error || new Error("Erro desconhecido ao criar item de produção");
  return data[0] as ProducaoItem;
}

export async function atualizarItem(id: number, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from("producao_itens")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function excluirItem(id: number): Promise<void> {
  const { error } = await supabase.from("producao_itens").delete().eq("id", id);
  if (error) throw error;
}
