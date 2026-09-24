-- ============================================================================
-- 0007_user_preferences.sql
-- ----------------------------------------------------------------------------
-- Preferências pessoais por USUÁRIO (não por navegador/computador). Até aqui,
-- tema, cor de destaque, apelido da saudação, voz escolhida etc. viviam só no
-- localStorage do navegador — então trocavam de conta no mesmo computador
-- "herdavam" a config de quem usou antes, e a mesma pessoa via tudo do zero
-- num computador novo.
--
-- Um único JSONB (em vez de uma coluna por preferência) porque essa lista só
-- tende a crescer (novos toggles em Configurações) e não tem valor em
-- normalizar campo por campo — quem lê/escreve é sempre o próprio dono.
-- ============================================================================

create table if not exists core.user_preferences (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  preferences   jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

comment on table core.user_preferences is
  'Preferências pessoais por usuário (tema, acento, saudação por voz, apelido, etc.) — chave é o próprio auth.uid().';

alter table core.user_preferences enable row level security;

-- cada pessoa só enxerga e mexe na própria linha — diferente das tabelas
-- single-tenant do resto do sistema (using(true)), aqui é dado de indivíduo
drop policy if exists user_preferences_own_row on core.user_preferences;
create policy user_preferences_own_row on core.user_preferences
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on core.user_preferences to authenticated;
