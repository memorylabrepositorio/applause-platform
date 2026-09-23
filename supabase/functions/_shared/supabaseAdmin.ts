import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cliente com service_role — só roda dentro das Edge Functions (servidor),
// nunca é exposto ao navegador. Usado pra ler/escrever ignorando RLS.
export function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados nos secrets da função");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
