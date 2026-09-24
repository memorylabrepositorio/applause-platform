import { supabase } from "@/lib/supabase";

export type SecretName = "EVOLUTION_API_KEY" | "META_ACCESS_TOKEN" | "ASAAS_API_KEY" | "ASAAS_WEBHOOK_TOKEN";

export interface SecretsStatus {
  EVOLUTION_API_KEY: boolean;
  META_ACCESS_TOKEN: boolean;
  ASAAS_API_KEY: boolean;
  ASAAS_WEBHOOK_TOKEN: boolean;
}

export async function getSecretsStatus(): Promise<{ status?: SecretsStatus; error?: string }> {
  const { data, error } = await supabase.functions.invoke("settings-secrets", { method: "GET" });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error as string };
  return { status: data?.status as SecretsStatus };
}

export async function saveSecret(name: SecretName, value: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("settings-secrets", {
    method: "POST",
    body: { name, value },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error as string);
}
