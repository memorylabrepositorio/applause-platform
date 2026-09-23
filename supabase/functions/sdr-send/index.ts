// Envio manual — chamada pelo painel quando um humano responde um aluno
// pela ficha de conversa do módulo SDR. Requer usuário autenticado.
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { enviarWhatsapp, type Canal } from "../_shared/send.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const admin = supabaseAdmin();
  const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });

  let body: { cliente_codigo?: number; texto?: string; tipo?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  const { cliente_codigo, texto, tipo } = body;
  if (!cliente_codigo || !texto) {
    return new Response("cliente_codigo e texto são obrigatórios", { status: 400 });
  }

  const [{ data: cliente }, { data: config }] = await Promise.all([
    admin.from("clientes").select("telefone").eq("codigo", cliente_codigo).single(),
    admin
      .from("sdr_config")
      .select("canal,evolution_base_url,evolution_instance,meta_phone_number_id")
      .eq("id", 1)
      .single(),
  ]);

  const canal = (config?.canal as Canal) || "evolution";
  const resultado = await enviarWhatsapp(cliente?.telefone || null, texto, canal, {
    evolutionBaseUrl: config?.evolution_base_url,
    evolutionInstance: config?.evolution_instance,
    metaPhoneNumberId: config?.meta_phone_number_id,
  });

  await admin.from("sdr_mensagens").insert({
    cliente_codigo,
    direcao: "saida",
    tipo: tipo || "nota_humana",
    canal,
    texto,
    status_envio: resultado.ok ? "enviado" : "falhou",
    erro: resultado.erro || null,
  });

  await admin
    .from("sdr_conversas")
    .upsert(
      { cliente_codigo, ultimo_contato_em: new Date().toISOString() },
      { onConflict: "cliente_codigo", ignoreDuplicates: false }
    );

  if (!resultado.ok) {
    return new Response(JSON.stringify({ error: resultado.erro }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
