import { supabase } from "@/lib/supabase";
import type { SdrConfig, SdrConversa, SdrLembrete, SdrMensagem, SdrModo } from "./engine";

export async function loadSdrConfig(): Promise<SdrConfig> {
  const { data, error } = await supabase.from("sdr_config").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as SdrConfig;
}

export async function saveSdrConfig(patch: Partial<SdrConfig>): Promise<void> {
  const { error } = await supabase.from("sdr_config").update(patch).eq("id", 1);
  if (error) throw error;
}

export async function loadLembretes(): Promise<SdrLembrete[]> {
  const { data, error } = await supabase.from("sdr_lembretes").select("*").order("ordem", { ascending: true });
  if (error) throw error;
  return (data || []) as SdrLembrete[];
}

export async function upsertLembrete(l: Partial<SdrLembrete>): Promise<SdrLembrete> {
  const { data, error } = await supabase.from("sdr_lembretes").upsert(l).select();
  if (error || !data || !data.length) throw error || new Error("Erro ao salvar lembrete");
  return data[0] as SdrLembrete;
}

export async function deleteLembrete(id: number): Promise<void> {
  const { error } = await supabase.from("sdr_lembretes").delete().eq("id", id);
  if (error) throw error;
}

export async function loadConversas(): Promise<SdrConversa[]> {
  const { data, error } = await supabase.from("sdr_conversas").select("*");
  if (error) throw error;
  return (data || []) as SdrConversa[];
}

export async function setConversaModo(clienteCodigo: number, modo: SdrModo): Promise<void> {
  const { error } = await supabase
    .from("sdr_conversas")
    .upsert({ cliente_codigo: clienteCodigo, modo }, { onConflict: "cliente_codigo" });
  if (error) throw error;
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
