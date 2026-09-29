-- ============================================================================
-- 0009_freelancers_schema.sql
-- ----------------------------------------------------------------------------
-- Módulo de freelancers dentro do bloco Estúdio: fotógrafos freelancer se
-- cadastram com login próprio, veem a agenda de vagas abertas e se
-- candidatam; a gestão cria as vagas manualmente e aprova/recusa candidatos.
--
-- Freelancer é uma conta Supabase Auth como qualquer outra, mas SEM linha em
-- core.memberships — é isso que a diferencia de um usuário da equipe interna
-- (staff). core.is_staff() abaixo é o helper que todas as policies usam pra
-- decidir "essa conta é da equipe ou é um freelancer?".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: o usuário autenticado é da equipe interna (tem alguma membership)?
-- Mesma lógica que core.my_org_ids() já usa, só que como boolean — usado nas
-- policies deste módulo (e reaproveitável por módulos futuros que também
-- precisem separar "conta interna" de "conta externa").
-- ----------------------------------------------------------------------------
create or replace function core.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from core.memberships where user_id = auth.uid());
$$;

comment on function core.is_staff() is
  'true se o usuário autenticado pertence a alguma organização (core.memberships) — ou seja, é conta da equipe, não uma conta externa (ex: freelancer).';

-- ----------------------------------------------------------------------------
-- freelancers — perfil complementar de quem se cadastrou (id = auth.users.id)
-- ----------------------------------------------------------------------------
create table if not exists public.freelancers (
  id bigint generated always as identity,
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome_completo text not null,
  telefone text,
  email text,
  cidade text,
  portfolio_url text,
  equipamento text,
  observacoes text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists freelancers_status_idx on public.freelancers (status);

-- ----------------------------------------------------------------------------
-- vagas_freelancer — datas/eventos precisando de freelancer, cadastradas
-- manualmente pela gestão
-- ----------------------------------------------------------------------------
create table if not exists public.vagas_freelancer (
  id bigint generated always as identity primary key,
  data date not null,
  horario_inicio time,
  horario_fim time,
  instituicao text,
  tipo_evento text,
  qtd_necessaria int not null default 1 check (qtd_necessaria > 0),
  valor_diaria numeric(10, 2),
  observacoes text,
  status text not null default 'aberta' check (status in ('aberta', 'fechada', 'cancelada')),
  criado_por uuid references auth.users (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists vagas_freelancer_data_idx on public.vagas_freelancer (data);
create index if not exists vagas_freelancer_status_idx on public.vagas_freelancer (status);

-- ----------------------------------------------------------------------------
-- candidaturas_freelancer — freelancer se candidata a uma vaga; gestão
-- aprova/recusa manualmente
-- ----------------------------------------------------------------------------
create table if not exists public.candidaturas_freelancer (
  id bigint generated always as identity primary key,
  vaga_id bigint not null references public.vagas_freelancer (id) on delete cascade,
  freelancer_id uuid not null references public.freelancers (user_id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'cancelado')),
  mensagem text,
  decidido_em timestamptz,
  decidido_por uuid references auth.users (id),
  criado_em timestamptz not null default now(),
  unique (vaga_id, freelancer_id)
);

create index if not exists candidaturas_freelancer_vaga_idx on public.candidaturas_freelancer (vaga_id);
create index if not exists candidaturas_freelancer_freelancer_idx on public.candidaturas_freelancer (freelancer_id);
create index if not exists candidaturas_freelancer_status_idx on public.candidaturas_freelancer (status);

-- ----------------------------------------------------------------------------
-- RLS — freelancer só vê/mexe no que é dele; staff (core.is_staff()) vê e
-- gerencia tudo
-- ----------------------------------------------------------------------------
alter table public.freelancers enable row level security;
alter table public.vagas_freelancer enable row level security;
alter table public.candidaturas_freelancer enable row level security;

drop policy if exists freelancers_select on public.freelancers;
create policy freelancers_select on public.freelancers
  for select to authenticated
  using (user_id = auth.uid() or core.is_staff());

drop policy if exists freelancers_insert on public.freelancers;
create policy freelancers_insert on public.freelancers
  for insert to authenticated
  with check (user_id = auth.uid() or core.is_staff());

drop policy if exists freelancers_update on public.freelancers;
create policy freelancers_update on public.freelancers
  for update to authenticated
  using (user_id = auth.uid() or core.is_staff())
  with check (user_id = auth.uid() or core.is_staff());

drop policy if exists freelancers_delete on public.freelancers;
create policy freelancers_delete on public.freelancers
  for delete to authenticated
  using (core.is_staff());

drop policy if exists vagas_freelancer_select on public.vagas_freelancer;
create policy vagas_freelancer_select on public.vagas_freelancer
  for select to authenticated
  using (status = 'aberta' or core.is_staff());

drop policy if exists vagas_freelancer_insert on public.vagas_freelancer;
create policy vagas_freelancer_insert on public.vagas_freelancer
  for insert to authenticated
  with check (core.is_staff());

drop policy if exists vagas_freelancer_update on public.vagas_freelancer;
create policy vagas_freelancer_update on public.vagas_freelancer
  for update to authenticated
  using (core.is_staff())
  with check (core.is_staff());

drop policy if exists vagas_freelancer_delete on public.vagas_freelancer;
create policy vagas_freelancer_delete on public.vagas_freelancer
  for delete to authenticated
  using (core.is_staff());

drop policy if exists candidaturas_freelancer_select on public.candidaturas_freelancer;
create policy candidaturas_freelancer_select on public.candidaturas_freelancer
  for select to authenticated
  using (freelancer_id = auth.uid() or core.is_staff());

drop policy if exists candidaturas_freelancer_insert on public.candidaturas_freelancer;
create policy candidaturas_freelancer_insert on public.candidaturas_freelancer
  for insert to authenticated
  with check (freelancer_id = auth.uid());

drop policy if exists candidaturas_freelancer_update on public.candidaturas_freelancer;
create policy candidaturas_freelancer_update on public.candidaturas_freelancer
  for update to authenticated
  using (core.is_staff() or (freelancer_id = auth.uid() and status = 'pendente'))
  with check (core.is_staff() or (freelancer_id = auth.uid() and status = 'cancelado'));

drop policy if exists candidaturas_freelancer_delete on public.candidaturas_freelancer;
create policy candidaturas_freelancer_delete on public.candidaturas_freelancer
  for delete to authenticated
  using (core.is_staff() or (freelancer_id = auth.uid() and status = 'pendente'));

grant select, insert, update, delete on public.freelancers, public.vagas_freelancer, public.candidaturas_freelancer to authenticated;
grant usage, select on all sequences in schema public to authenticated;
