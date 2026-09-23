import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/fetchAll";
import type { ContaPagar } from "./engine";

export async function loadContasPagar(): Promise<ContaPagar[]> {
  return fetchAllRows<ContaPagar>("contas_pagar");
}

export async function criarConta(payload: Partial<ContaPagar>): Promise<ContaPagar> {
  const { data, error } = await supabase.from("contas_pagar").insert(payload).select();
  if (error || !data || !data.length) throw error || new Error("Erro desconhecido ao criar conta");
  return data[0] as ContaPagar;
}

export async function atualizarConta(id: number, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from("contas_pagar")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function excluirConta(id: number): Promise<void> {
  const { error } = await supabase.from("contas_pagar").delete().eq("id", id);
  if (error) throw error;
}
