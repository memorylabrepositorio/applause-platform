-- Base de dados do bloco Financeiro/Produção — pensada para, com o tempo,
-- SUBSTITUIR o Pronet e o SGE (não só espelhar). Por isso cada tabela tem uma
-- coluna `origem`: hoje tudo entra como 'manual' (lançado pelo time direto no
-- painel); quando a importação automática do Pronet existir, os lançamentos
-- dele entram como 'pronet' sem confundir com o que já foi digitado à mão.
--
-- Ainda NÃO existe import de planilha nem sincronização com Pronet — isso é
-- o próximo passo, depois que as telas de cadastro estiverem prontas.

-- ---------------------------------------------------------------------------
-- financeiro_parcelas — contas a receber (PIX, boleto, cartão)
-- ---------------------------------------------------------------------------
create table if not exists public.financeiro_parcelas (
  id bigint generated always as identity primary key,
  cliente_codigo bigint not null,
  contrato_nro_controle text,
  forma_pagamento text not null default 'boleto'
    check (forma_pagamento in ('pix', 'boleto', 'cartao', 'dinheiro', 'outro')),
  numero_parcela int not null default 1,
  total_parcelas int not null default 1,
  valor_parcela numeric(12,2) not null,
  vencimento date not null,
  pago boolean not null default false,
  pago_em date,
  valor_pago numeric(12,2),
  telefone_cobranca text,
  observacoes text,
  origem text not null default 'manual' check (origem in ('manual', 'pronet')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists financeiro_parcelas_cliente_idx on public.financeiro_parcelas (cliente_codigo);
create index if not exists financeiro_parcelas_vencimento_idx on public.financeiro_parcelas (vencimento) where not pago;

-- ---------------------------------------------------------------------------
-- producao_itens — status de produção/edição de cada item vendido
-- ---------------------------------------------------------------------------
create table if not exists public.producao_itens (
  id bigint generated always as identity primary key,
  cliente_codigo bigint not null,
  contrato_nro_controle text,
  produto text not null,
  tipo_edicao text,
  prazo_estudio date,
  prazo_cliente date,
  status text not null default 'nao_iniciado'
    check (status in ('nao_iniciado', 'em_producao', 'concluido', 'entregue')),
  observacoes text,
  origem text not null default 'manual' check (origem in ('manual', 'pronet')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists producao_itens_cliente_idx on public.producao_itens (cliente_codigo);
create index if not exists producao_itens_status_idx on public.producao_itens (status);

-- ---------------------------------------------------------------------------
-- contas_pagar — orçamento por contrato/instituição (ex: orçamento do Pedro)
-- ---------------------------------------------------------------------------
create table if not exists public.contas_pagar (
  id bigint generated always as identity primary key,
  contrato_nro_controle text,
  instituicao text,
  descricao text not null,
  valor_previsto numeric(12,2) not null,
  valor_pago numeric(12,2) not null default 0,
  mes_referencia date,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'atrasado')),
  origem text not null default 'manual' check (origem in ('manual', 'pronet')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists contas_pagar_contrato_idx on public.contas_pagar (contrato_nro_controle);

-- ---------------------------------------------------------------------------
-- RLS — mesmo padrão das demais tabelas do app (authenticated tem acesso
-- completo; refinamento por papel/organização fica pra depois, se precisar).
-- ---------------------------------------------------------------------------
alter table public.financeiro_parcelas enable row level security;
alter table public.producao_itens enable row level security;
alter table public.contas_pagar enable row level security;

drop policy if exists financeiro_parcelas_all on public.financeiro_parcelas;
create policy financeiro_parcelas_all on public.financeiro_parcelas for all to authenticated using (true) with check (true);

drop policy if exists producao_itens_all on public.producao_itens;
create policy producao_itens_all on public.producao_itens for all to authenticated using (true) with check (true);

drop policy if exists contas_pagar_all on public.contas_pagar;
create policy contas_pagar_all on public.contas_pagar for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.financeiro_parcelas, public.producao_itens, public.contas_pagar to authenticated;
grant usage, select on all sequences in schema public to authenticated;
