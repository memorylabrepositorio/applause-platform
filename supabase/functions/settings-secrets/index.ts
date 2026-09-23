// Tela de Configurações > Integrações fala com esta função pra checar quais
// chaves já estão configuradas (GET, só nomes — nunca valores) e pra salvar
// uma chave nova (POST) — que vira um secret real do projeto via Management
// API do Supabase, nunca uma linha de tabela.
//
// Bootstrap necessário (uma vez só, via CLI):
//   supabase secrets set SUPABASE_MANAGEMENT_TOKEN=<personal access token>
//   supabase secrets set SUPABASE_PROJECT_REF=<ref do projeto>
// O token é criado em supabase.com/dashboard/account/tokens e o ref
// aparece na URL do projeto (Project Settings > General).
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const SECRETS_GERENCIADOS = ["EVOLUTION_API_KEY", "META_ACCESS_TOKEN"];

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !data?.user) return null;
  return data.user;
}

function managementConfig() {
  const token = Deno.env.get("SUPABASE_MANAGEMENT_TOKEN");
  const ref = Deno.env.get("SUPABASE_PROJECT_REF");
  if (!token || !ref) {
    throw new Error(
      "Bootstrap pendente: configure os secrets SUPABASE_MANAGEMENT_TOKEN e SUPABASE_PROJECT_REF via supabase CLI"
    );
  }
  return { token, ref };
}

Deno.serve(async (req: Request) => {
  const user = await requireUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (req.method === "GET") {
    try {
      const { token, ref } = managementConfig();
      const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Management API respondeu ${res.status}`);
      const secrets = (await res.json()) as { name: string }[];
      const nomes = new Set(secrets.map((s) => s.name));
      const status = Object.fromEntries(SECRETS_GERENCIADOS.map((n) => [n, nomes.has(n)]));
      return json({ status });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "erro desconhecido" }, 500);
    }
  }

  if (req.method === "POST") {
    let body: { name?: string; value?: string };
    try {
      body = await req.json();
    } catch {
      return new Response("JSON inválido", { status: 400 });
    }
    if (!body.name || !SECRETS_GERENCIADOS.includes(body.name) || !body.value) {
      return json({ error: "name precisa ser um dos secrets suportados, e value não pode ser vazio" }, 400);
    }
    try {
      const { token, ref } = managementConfig();
      const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ name: body.name, value: body.value }]),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Management API respondeu ${res.status}: ${t}`);
      }
      return json({ ok: true });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "erro desconhecido" }, 500);
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
