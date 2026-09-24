// Gera uma cobrança (PIX ou Boleto) no Asaas pra uma parcela do Financeiro.
// Chamada pelo painel quando o financeiro clica "Gerar cobrança" numa parcela
// em aberto. Cria o cliente no Asaas na primeira vez (e reaproveita depois,
// guardando o id em clientes.asaas_customer_id) e devolve o link de pagamento.
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { asaasFetch, onlyDigits, AsaasError, type AsaasAmbiente } from "../_shared/asaas.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const admin = supabaseAdmin();
  const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  let body: { parcela_id?: number; billing_type?: "PIX" | "BOLETO" };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const parcelaId = body.parcela_id;
  const billingType = body.billing_type === "PIX" ? "PIX" : "BOLETO";
  if (!parcelaId) return json({ error: "parcela_id é obrigatório" }, 400);

  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) {
    return json({ error: "Chave do Asaas não configurada (Configurações > Cobranças)" }, 500);
  }

  const [{ data: config }, { data: parcela }] = await Promise.all([
    admin.from("financeiro_config").select("asaas_ambiente").eq("id", 1).single(),
    admin.from("financeiro_parcelas").select("*").eq("id", parcelaId).single(),
  ]);
  if (!parcela) return json({ error: "Parcela não encontrada" }, 404);
  if (parcela.pago) return json({ error: "Essa parcela já está paga" }, 400);

  const ambiente = (config?.asaas_ambiente as AsaasAmbiente) || "sandbox";

  const { data: cliente } = await admin
    .from("clientes")
    .select("codigo,nome_cliente,cpf,telefone,asaas_customer_id")
    .eq("codigo", parcela.cliente_codigo)
    .single();
  if (!cliente) return json({ error: "Cliente da parcela não encontrado" }, 404);

  try {
    let asaasCustomerId = cliente.asaas_customer_id as string | null;

    if (!asaasCustomerId) {
      const cpf = onlyDigits(cliente.cpf);
      if (!cpf) {
        return json(
          { error: "Cliente sem CPF cadastrado — o Asaas exige CPF/CNPJ pra criar a cobrança" },
          400
        );
      }
      const criado = (await asaasFetch("/customers", apiKey, ambiente, {
        method: "POST",
        body: JSON.stringify({
          name: cliente.nome_cliente,
          cpfCnpj: cpf,
          mobilePhone: onlyDigits(cliente.telefone) || undefined,
          externalReference: String(cliente.codigo),
        }),
      })) as { id: string };
      asaasCustomerId = criado.id;
      await admin.from("clientes").update({ asaas_customer_id: asaasCustomerId }).eq("codigo", cliente.codigo);
    }

    const cobranca = (await asaasFetch("/payments", apiKey, ambiente, {
      method: "POST",
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType,
        value: parcela.valor_parcela,
        dueDate: parcela.vencimento,
        description: `Parcela ${parcela.numero_parcela}/${parcela.total_parcelas} — Applause Formaturas`,
        externalReference: String(parcela.id),
      }),
    })) as { id: string; invoiceUrl: string; status: string };

    await admin
      .from("financeiro_parcelas")
      .update({
        asaas_charge_id: cobranca.id,
        asaas_payment_url: cobranca.invoiceUrl,
        asaas_billing_type: billingType,
        asaas_status: cobranca.status,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", parcelaId);

    return json({ ok: true, payment_url: cobranca.invoiceUrl, status: cobranca.status });
  } catch (e) {
    const msg = e instanceof AsaasError ? e.message : e instanceof Error ? e.message : "erro desconhecido";
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
