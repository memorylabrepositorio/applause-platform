-- Integração com o Asaas (gateway de boleto/PIX/cartão) pro módulo
-- Financeiro — geração automática de cobrança por parcela e atualização de
-- status via webhook, sem precisar marcar "pago" na mão.

-- ---------------------------------------------------------------------------
-- financeiro_parcelas — rastreio da cobrança gerada no Asaas
-- ---------------------------------------------------------------------------
alter table public.financeiro_parcelas
  add column if not exists asaas_charge_id text,
  add column if not exists asaas_payment_url text,
  add column if not exists asaas_billing_type text
    check (asaas_billing_type is null or asaas_billing_type in ('PIX', 'BOLETO')),
  add column if not exists asaas_status text;

create unique index if not exists financeiro_parcelas_asaas_charge_idx
  on public.financeiro_parcelas (asaas_charge_id)
  where asaas_charge_id is not null;

-- ---------------------------------------------------------------------------
-- clientes — id do cliente já criado no Asaas, pra não recriar a cada cobrança
-- (a tabela clientes já existe de antes desta plataforma; só adiciona a coluna)
-- ---------------------------------------------------------------------------
alter table public.clientes
  add column if not exists asaas_customer_id text;

-- ---------------------------------------------------------------------------
-- financeiro_config — configuração singleton (ambiente sandbox/produção)
-- mesma ideia do sdr_config: uma linha só, id fixo = 1
-- ---------------------------------------------------------------------------
create table if not exists public.financeiro_config (
  id smallint primary key default 1 check (id = 1),
  asaas_ambiente text not null default 'sandbox' check (asaas_ambiente in ('sandbox', 'producao')),
  atualizado_em timestamptz not null default now()
);

insert into public.financeiro_config (id) values (1)
  on conflict (id) do nothing;

alter table public.financeiro_config enable row level security;

drop policy if exists financeiro_config_all on public.financeiro_config;
create policy financeiro_config_all on public.financeiro_config for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- financeiro_asaas_webhook_events — log bruto de cada evento recebido do
-- Asaas, gravado ANTES de processar. Dá auditoria ("o que chegou e quando")
-- e trava duplicidade por event_id (o Asaas reenvia em caso de timeout) —
-- padrão visto no sistema de cobrança que inspirou esta integração.
-- ---------------------------------------------------------------------------
create table if not exists public.financeiro_asaas_webhook_events (
  id bigint generated always as identity primary key,
  event_id text unique,
  event_type text not null,
  payload jsonb not null,
  criado_em timestamptz not null default now()
);

alter table public.financeiro_asaas_webhook_events enable row level security;

drop policy if exists financeiro_asaas_webhook_events_all on public.financeiro_asaas_webhook_events;
create policy financeiro_asaas_webhook_events_all on public.financeiro_asaas_webhook_events
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.financeiro_config, public.financeiro_asaas_webhook_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;
