// Helper compartilhado pra falar com a API do Asaas (boleto/PIX/cartão).
// Baseado no padrão adotado no projeto de cobrança "arkom" — mas simplificado
// pra uso de uma única empresa (sem multi-tenant/vault por organização,
// a chave já vem de um secret único do projeto via settings-secrets).

export type AsaasAmbiente = "sandbox" | "producao";

export function asaasBaseUrl(ambiente: AsaasAmbiente): string {
  return ambiente === "producao" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
}

export class AsaasError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message);
  }
}

export async function asaasFetch(
  path: string,
  apiKey: string,
  ambiente: AsaasAmbiente,
  init: RequestInit = {}
): Promise<unknown> {
  const res = await fetch(`${asaasBaseUrl(ambiente)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const desc =
      body && typeof body === "object" && "errors" in (body as Record<string, unknown>)
        ? JSON.stringify((body as Record<string, unknown>).errors)
        : res.statusText;
    throw new AsaasError(`Asaas respondeu ${res.status}: ${desc}`, res.status, body);
  }
  return body;
}

// CPF/CNPJ só com dígitos — o Asaas rejeita se vier com pontuação em excesso
// de espaço, mas aceita com ou sem máscara; normalizamos pra evitar surpresa.
export function onlyDigits(v: string | null | undefined): string {
  return (v || "").replace(/\D/g, "");
}
