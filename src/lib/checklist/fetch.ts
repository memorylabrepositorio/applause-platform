import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/fetchAll";
import { cached, invalidateCache } from "@/lib/cache";
import type { ChecklistEvento, ContratoRow } from "./engine";

async function loadEventosUncached(): Promise<ChecklistEvento[]> {
  const { data, error } = await supabase
    .from("checklist_eventos")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data || []) as ChecklistEvento[];
}

export function loadEventos(): Promise<ChecklistEvento[]> {
  return cached("checklist-eventos", loadEventosUncached);
}

export function loadContratos(): Promise<ContratoRow[]> {
  return cached("checklist-contratos", () =>
    fetchAllRows<ContratoRow>("contratos", "nro_controle,instituicao,curso,ano_periodo,status,qtde_clientes")
  );
}

export async function createChecklistFromContrato(contrato: ContratoRow): Promise<ChecklistEvento> {
  const payload = {
    instituicao: contrato.instituicao,
    curso: contrato.curso,
    nro_controle: contrato.nro_controle,
    status: "em_andamento",
  };
  const { data, error } = await supabase.from("checklist_eventos").insert(payload).select();
  if (error || !data || !data.length) {
    throw error || new Error("Erro desconhecido ao criar checklist");
  }
  invalidateCache("checklist-eventos");
  return data[0] as ChecklistEvento;
}

export async function updateChecklist(id: number, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("checklist_eventos").update(payload).eq("id", id);
  if (error) throw error;
  invalidateCache("checklist-eventos");
}

export async function deleteChecklist(id: number): Promise<void> {
  const { error } = await supabase.from("checklist_eventos").delete().eq("id", id);
  if (error) throw error;
  invalidateCache("checklist-eventos");
}
