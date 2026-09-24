import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/fetchAll";
import { cached, invalidateCache } from "@/lib/cache";
import type { AsaasBillingType, ClienteRef, ContratoRef, Parcela } from "./engine";

export interface FinanceiroData {
  parcelas: Parcela[];
  clientes: ClienteRef[];
  contratos: ContratoRef[];
}

async function loadFinanceiroDataUncached(): Promise<FinanceiroData> {
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

export function loadFinanceiroData(): Promise<FinanceiroData> {
  return cached("financeiro", loadFinanceiroDataUncached);
}

export async function criarParcela(payload: Partial<Parcela>): Promise<Parcela> {
  const { data, error } = await supabase.from("financeiro_parcelas").insert(payload).select();
  if (error || !data || !data.length) throw error || new Error("Erro desconhecido ao criar parcela");
  invalidateCache(["financeiro", "lucro"]);
  return data[0] as Parcela;
}

export async function atualizarParcela(id: number, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from("financeiro_parcelas")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  invalidateCache(["financeiro", "lucro"]);
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
  invalidateCache(["financeiro", "lucro"]);
}

export async function desmarcarPaga(id: number): Promise<void> {
  const { error } = await supabase
    .from("financeiro_parcelas")
    .update({ pago: false, valor_pago: null, pago_em: null, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  invalidateCache(["financeiro", "lucro"]);
}

export async function excluirParcela(id: number): Promise<void> {
  const { error } = await supabase.from("financeiro_parcelas").delete().eq("id", id);
  if (error) throw error;
  invalidateCache(["financeiro", "lucro"]);
}

// ---------------------------------------------------------------------
// Cobrança automática via Asaas (boleto/PIX)
// ---------------------------------------------------------------------

export interface FinanceiroConfig {
  asaas_ambiente: "sandbox" | "producao";
}

async function loadFinanceiroConfigUncached(): Promise<FinanceiroConfig> {
  const { data, error } = await supabase.from("financeiro_config").select("asaas_ambiente").eq("id", 1).single();
  if (error) throw error;
  return data as FinanceiroConfig;
}

export function loadFinanceiroConfig(): Promise<FinanceiroConfig> {
  return cached("financeiro-config", loadFinanceiroConfigUncached);
}

export async function saveFinanceiroConfig(patch: Partial<FinanceiroConfig>): Promise<void> {
  const { error } = await supabase
    .from("financeiro_config")
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
  invalidateCache("financeiro-config");
}

export async function gerarCobrancaAsaas(
  parcelaId: number,
  billingType: AsaasBillingType
): Promise<{ payment_url: string; status: string }> {
  const { data, error } = await supabase.functions.invoke("fin-asaas-charge", {
    body: { parcela_id: parcelaId, billing_type: billingType },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error as string);
  invalidateCache(["financeiro", "lucro"]);
  return { payment_url: data.payment_url as string, status: data.status as string };
}

export async function testarConexaoAsaas(): Promise<{ ok: boolean; error?: string; balance?: number }> {
  const { data, error } = await supabase.functions.invoke("fin-asaas-test", { method: "POST" });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; error?: string; balance?: number };
}
