// Recebe as notificações de status de pagamento do Asaas (configurado no
// painel do Asaas em Configurações > Integrações > Webhooks, apontando pra
// URL desta função). Não tem usuário logado — protegido por um token
// compartilhado (ASAAS_WEBHOOK_TOKEN) que o Asaas devolve em todo request,
// configurado nos dois lados.
//
// Idempotente: pode chegar o mesmo evento mais de uma vez (reenvio do Asaas
// em caso de timeout) — todo evento é gravado primeiro em
// financeiro_asaas_webhook_events (chave única por event_id), e só então
// processado; um reenvio esbarra na unique constraint e é ignorado sem
// reaplicar nada. Cobre pagamento confirmado, vencido e estornado — não só
// "pago/não pago".
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const EVENTOS_PAGO = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const EVENTOS_ESTORNO = new Set(["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_DELETED"]);
const EVENTOS_VENCIDO = new Set(["PAYMENT_OVERDUE"]);
const EVENTOS_ATUALIZADO = new Set(["PAYMENT_UPDATED"]);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const tokenEsperado = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const tokenRecebido = req.headers.get("asaas-access-token");
  if (!tokenEsperado || tokenRecebido !== tokenEsperado) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    id?: string;
    event?: string;
    payment?: { id?: string; status?: string; value?: number; dueDate?: string };
  };
  try {
    body = await req.json();
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  const evento = body.event;
  const payment = body.payment;
  if (!evento || !payment?.id) {
    // responde 200 mesmo assim — não é um erro que valha reenvio do Asaas
    return new Response("ok (evento ignorado — sem payment.id)", { status: 200 });
  }

  const admin = supabaseAdmin();

  // grava o evento bruto ANTES de processar — se já existir (event_id
  // repetido), foi reenvio do Asaas: registra a tentativa mas não reprocessa.
  const eventId = body.id || `${evento}:${payment.id}:${payment.status || ""}`;
  const { error: logError } = await admin
    .from("financeiro_asaas_webhook_events")
    .insert({ event_id: eventId, event_type: evento, payload: body });
  if (logError) {
    if (logError.code === "23505") {
      return new Response("ok (evento duplicado, ignorado)", { status: 200 });
    }
    // falha ao gravar o log não deve travar o processamento do pagamento
  }

  const { data: parcela } = await admin
    .from("financeiro_parcelas")
    .select("id,valor_parcela,vencimento,pago")
    .eq("asaas_charge_id", payment.id)
    .maybeSingle();

  if (!parcela) {
    // cobrança não corresponde a nenhuma parcela nossa — nada a fazer
    return new Response("ok (parcela não encontrada)", { status: 200 });
  }

  const patch: Record<string, unknown> = {
    asaas_status: payment.status || evento,
    atualizado_em: new Date().toISOString(),
  };

  if (EVENTOS_PAGO.has(evento) && !parcela.pago) {
    patch.pago = true;
    patch.pago_em = new Date().toISOString().slice(0, 10);
    patch.valor_pago = payment.value ?? parcela.valor_parcela;
  } else if (EVENTOS_ESTORNO.has(evento) && parcela.pago) {
    patch.pago = false;
    patch.pago_em = null;
    patch.valor_pago = null;
  } else if (EVENTOS_VENCIDO.has(evento)) {
    // só atualiza o status exibido — a parcela em si já fica "vencida"
    // automaticamente na tela pela data de vencimento (statusParcela)
  } else if (EVENTOS_ATUALIZADO.has(evento) && payment.dueDate) {
    // valor/vencimento alterado direto no Asaas — reflete de volta na parcela
    patch.vencimento = payment.dueDate;
    if (payment.value) patch.valor_parcela = payment.value;
  }

  await admin.from("financeiro_parcelas").update(patch).eq("id", parcela.id);

  return new Response("ok", { status: 200 });
});
