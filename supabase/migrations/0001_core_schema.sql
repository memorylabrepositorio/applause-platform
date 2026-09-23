-- ============================================================================
-- 0001_core_schema.sql
-- ----------------------------------------------------------------------------
-- Fundação multi-tenant do sistema Applause. Cria o schema `core`, que passa
-- a ser a única fonte de verdade sobre "quem é quem": organizações, membros
-- e papéis. Cada módulo futuro (vendas, checklist, atendimento, SDR, álbuns,
-- etc.) referencia `core.organizations` por `org_id`, em vez de reinventar
-- login/permissão, com um schema central (`core`) compartilhado por todos os
-- módulos.
--
-- Esta migration é ADITIVA: não altera nem apaga nada das tabelas existentes
-- (vendas, contratos, clientes, agenda, checklist_eventos, atendimento_*).
-- Ela só cria a fundação por baixo. Backfill e RLS das tabelas antigas ficam
-- para uma migration separada (0002), depois de validar o app novo.
-- ============================================================================

create schema if not exists core;

-- ----------------------------------------------------------------------------
-- Organizações. Hoje só existe a Applause, mas o modelo já nasce multi-tenant
-- (o mesmo código pode servir outra organização amanhã).
-- ----------------------------------------------------------------------------
create table if not exists core.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  created_at   timestamptz not null default now()
);

comment on table core.organizations is 'Tenants do sistema. Applause é a primeira linha.';

-- ----------------------------------------------------------------------------
-- Membros de uma organização (quem pode logar e enxergar os dados dela).
-- ----------------------------------------------------------------------------
create table if not exists core.memberships (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references core.organizations(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists memberships_user_id_idx on core.memberships(user_id);
create index if not exists memberships_org_id_idx on core.memberships(org_id);

-- ----------------------------------------------------------------------------
-- Papéis por (usuário, org, app). `app` identifica o módulo: 'vendas',
-- 'checklist', 'atendimento', 'sdr', etc. Um usuário pode ser admin de um
-- módulo e apenas membro de outro.
-- ----------------------------------------------------------------------------
create table if not exists core.roles (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references core.organizations(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  app          text not null,
  role         text not null check (role in ('admin', 'member')),
  created_at   timestamptz not null default now(),
  unique (org_id, user_id, app)
);

create index if not exists roles_user_id_idx on core.roles(user_id);

-- ----------------------------------------------------------------------------
-- Helper: org(s) do usuário autenticado. Toda policy de módulo usa esta
-- function em vez de repetir o join memberships -> auth.uid() em cada tabela.
-- ----------------------------------------------------------------------------
create or replace function core.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from core.memberships where user_id = auth.uid();
$$;

comment on function core.my_org_ids() is
  'Organizações às quais o usuário autenticado pertence. Use em policies: org_id in (select core.my_org_ids())';

-- ----------------------------------------------------------------------------
-- Helper: o usuário autenticado é admin de um app numa org?
-- ----------------------------------------------------------------------------
create or replace function core.is_admin(_org_id uuid, _app text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from core.roles
    where org_id = _org_id and user_id = auth.uid() and app = _app and role = 'admin'
  );
$$;

alter table core.organizations enable row level security;
alter table core.memberships   enable row level security;
alter table core.roles         enable row level security;

-- Um usuário só vê a própria organização e os próprios vínculos.
create policy "org members can read their org"
  on core.organizations for select
  using (id in (select core.my_org_ids()));

create policy "users can read their own memberships"
  on core.memberships for select
  using (user_id = auth.uid());

create policy "users can read their own roles"
  on core.roles for select
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Seed: organização Applause + qualquer usuário já existente em auth.users
-- vira membro dela automaticamente (ajuste depois: isso é só pra não travar
-- o primeiro login enquanto não há convite/onboarding).
-- ----------------------------------------------------------------------------
insert into core.organizations (name, slug)
values ('Applause Formaturas', 'applause')
on conflict (slug) do nothing;

insert into core.memberships (org_id, user_id)
select (select id from core.organizations where slug = 'applause'), u.id
from auth.users u
on conflict (org_id, user_id) do nothing;
