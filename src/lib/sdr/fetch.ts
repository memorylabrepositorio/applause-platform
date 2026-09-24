import { supabase } from "@/lib/supabase";
import { cached, invalidateCache } from "@/lib/cache";
import type { SdrConfig, SdrConversa, SdrLembrete, SdrMensagem, SdrModo } from "./engine";

async function loadSdrConfigUncached(): Promise<SdrConfig> {
  const { data, error } = await supabase.from("sdr_config").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as SdrConfig;
}

export function loadSdrConfig(): Promise<SdrConfig> {
  return cached("sdr-config", loadSdrConfigUncached);
}

export async function saveSdrConfig(patch: Partial<SdrConfig>): Promise<void> {
  const { error } = await supabase.from("sdr_config").update(patch).eq("id", 1);
  if (error) throw error;
  invalidateCache("sdr-config");
}

async function loadLembretesUncached(): Promise<SdrLembrete[]> {
  const { data, error } = await supabase.from("sdr_lembretes").select("*").order("ordem", { ascending: true });
  if (error) throw error;
  return (data || []) as SdrLembrete[];
}

export function loadLembretes(): Promise<SdrLembrete[]> {
  return cached("sdr-lembretes", loadLembretesUncached);
}

export async function upsertLembrete(l: Partial<SdrLembrete>): Promise<SdrLembrete> {
  const { data, error } = await supabase.from("sdr_lembretes").upsert(l).select();
  if (error || !data || !data.length) throw error || new Error("Erro ao salvar lembrete");
  invalidateCache("sdr-lembretes");
  return data[0] as SdrLembrete;
}

export async function deleteLembrete(id: number): Promise<void> {
  const { error } = await supabase.from("sdr_lembretes").delete().eq("id", id);
  if (error) throw error;
  invalidateCache("sdr-lembretes");
}

async function loadConversasUncached(): Promise<SdrConversa[]> {
  const { data, error } = await supabase.from("sdr_conversas").select("*");
  if (error) throw error;
  return (data || []) as SdrConversa[];
}

export function loadConversas(): Promise<SdrConversa[]> {
  return cached("sdr-conversas", loadConversasUncached, 30 * 1000); // conversas mudam rápido — TTL curto
}

export async function setConversaModo(clienteCodigo: number, modo: SdrModo): Promise<void> {
  const { error } = await supabase
    .from("sdr_conversas")
    .upsert({ cliente_codigo: clienteCodigo, modo }, { onConflict: "cliente_codigo" });
  if (error) throw error;
  invalidateCache("sdr-conversas");
}

export async function loadMensagens(clienteCodigo: number): Promise<SdrMensagem[]> {
  const { data, error } = await supabase
    .from("sdr_mensagens")
    .select("*")
    .eq("cliente_codigo", clienteCodigo)
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data || []) as SdrMensagem[];
}

// Envio manual (um humano respondendo pelo painel) passa pela Edge Function
// "sdr-send" — ela é quem guarda as chaves da Evolution/Meta API e quem
// efetivamente manda a mensagem. O navegador nunca vê essas chaves.
export async function enviarMensagemManual(clienteCodigo: number, texto: string): Promise<void> {
  const { error } = await supabase.functions.invoke("sdr-send", {
    body: { cliente_codigo: clienteCodigo, texto, tipo: "nota_humana" },
  });
  if (error) throw error;
}
