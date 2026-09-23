// Envio de WhatsApp — abstrai o canal (Evolution API hoje, API oficial da
// Meta como opção futura).
//
// URL/instância/phone-number-id são configuração NÃO sensível — vêm do
// banco (sdr_config), passadas por quem chama. As CHAVES de fato (API key,
// access token) nunca passam pelo banco nem pelo navegador: vivem só como
// secrets desta função (supabase secrets set / painel de Configurações).

export type Canal = "evolution" | "meta";

export interface EnviarResultado {
  ok: boolean;
  erro?: string;
}

export interface CanalConfig {
  evolutionBaseUrl?: string | null;
  evolutionInstance?: string | null;
  metaPhoneNumberId?: string | null;
}

export async function enviarWhatsapp(
  telefone: string | null,
  texto: string,
  canal: Canal,
  cfg: CanalConfig
): Promise<EnviarResultado> {
  if (!telefone) return { ok: false, erro: "Aluno sem telefone cadastrado" };
  try {
    if (canal === "meta") {
      await enviarViaMeta(telefone, texto, cfg.metaPhoneNumberId || null);
    } else {
      await enviarViaEvolution(telefone, texto, cfg.evolutionBaseUrl || null, cfg.evolutionInstance || null);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "erro desconhecido ao enviar" };
  }
}

async function enviarViaEvolution(
  telefone: string,
  texto: string,
  baseUrl: string | null,
  instance: string | null
): Promise<void> {
  const apiKey = Deno.env.get("EVOLUTION_API_KEY");
  if (!baseUrl || !instance) {
    throw new Error("Evolution API incompleta — configure a URL e a instância na tela de Configurações");
  }
  if (!apiKey) {
    throw new Error("Chave da Evolution API não configurada — configure em Configurações > Integrações");
  }
  const numero = telefone.replace(/\D/g, "");
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: numero, text: texto }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Evolution API respondeu ${res.status}: ${body}`);
  }
}

async function enviarViaMeta(telefone: string, texto: string, phoneNumberId: string | null): Promise<void> {
  const token = Deno.env.get("META_ACCESS_TOKEN");
  if (!phoneNumberId) {
    throw new Error("Meta: Phone Number ID não configurado — configure em Configurações > Integrações");
  }
  if (!token) {
    throw new Error("Meta: access token não configurado — configure em Configurações > Integrações");
  }
  const numero = telefone.replace(/\D/g, "");
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: numero,
      type: "text",
      text: { body: texto },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Meta API respondeu ${res.status}: ${body}`);
  }
}

export function preencherTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
