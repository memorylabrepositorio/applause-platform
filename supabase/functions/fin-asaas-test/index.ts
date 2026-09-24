// Testa se a chave do Asaas configurada em Configurações > Cobranças está
// válida, chamando o endpoint mais barato da API (saldo da conta). Sempre
// responde 200 — o resultado (ok: true/false) é o que importa pra tela, não
// o status HTTP, pra não gerar um "erro" genérico quando na verdade é só uma
// chave errada.
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { asaasFetch, type AsaasAmbiente } from "../_shared/asaas.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ ok: false, error: "Unauthorized" }, 401);
  const admin = supabaseAdmin();
  const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userErr || !userData?.user) return json({ ok: false, error: "Unauthorized" }, 401);

  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) return json({ ok: false, error: "Chave ASAAS_API_KEY não configurada" });

  const { data: config } = await admin.from("financeiro_config").select("asaas_ambiente").eq("id", 1).single();
  const ambiente = (config?.asaas_ambiente as AsaasAmbiente) || "sandbox";

  try {
    const saldo = (await asaasFetch("/finance/getCurrentBalance", apiKey, ambiente)) as { balance: number };
    return json({ ok: true, ambiente, balance: saldo.balance });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "erro desconhecido" });
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
