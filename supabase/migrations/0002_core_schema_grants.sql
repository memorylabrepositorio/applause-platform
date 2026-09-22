-- ============================================================================
-- 0002_core_schema_grants.sql
-- ----------------------------------------------------------------------------
-- A migration 0001 criou o schema `core`, suas tabelas e as policies de RLS,
-- mas um schema novo (fora de `public`) não recebe privilégio automático
-- para as roles usadas pelo PostgREST (`anon`, `authenticated`). Sem isso a
-- API responde "permission denied for schema core" (42501) mesmo com o
-- schema já exposto em Project Settings > API > Exposed schemas e mesmo com
-- as RLS policies corretas — GRANT e RLS são camadas independentes.
--
-- Esta migration é ADITIVA: só concede privilégios, não altera dados nem
-- estrutura.
-- ============================================================================

grant usage on schema core to anon, authenticated;

grant select on all tables in schema core to anon, authenticated;

-- Garante que tabelas futuras do schema `core` também fiquem acessíveis
-- sem precisar de outra migration de grants.
alter default privileges in schema core
  grant select on tables to anon, authenticated;
