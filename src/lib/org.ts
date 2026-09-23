import { supabase } from "./supabase";

/**
 * Resolução de organização (tenant) do usuário logado.
 *
 * Padrão simplificado de resolução de tenant: aqui tudo vive num único
 * projeto Supabase (não é "1 deploy = 1 org"), então a
 * resolução é direta — lê `core.memberships` e pega a primeira org do
 * usuário. Quando o sistema precisar de troca de organização (um usuário em
 * mais de uma), isso vira um seletor em vez de "a primeira que achar".
 */

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

let _orgCache: Organization | null = null;
let _orgPromise: Promise<Organization | null> | null = null;

export function invalidateOrgCache() {
  _orgCache = null;
  _orgPromise = null;
}

async function resolveOrg(): Promise<Organization | null> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .schema("core")
    .from("memberships")
    .select("org_id, organizations:org_id (id, name, slug)")
    .eq("user_id", uid)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[org] falha ao resolver organização", error);
    return null;
  }
  if (!data?.organizations) return null;

  // O join do PostgREST devolve array ou objeto dependendo da versão do client;
  // normaliza os dois casos.
  const org = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  return (org as Organization) ?? null;
}

export async function getCurrentOrg(): Promise<Organization | null> {
  if (_orgCache) return _orgCache;
  if (_orgPromise) return _orgPromise;
  _orgPromise = resolveOrg()
    .then((org) => {
      _orgCache = org;
      return org;
    })
    .catch((e) => {
      _orgPromise = null;
      throw e;
    });
  return _orgPromise;
}

export async function requireOrg(): Promise<Organization> {
  const org = await getCurrentOrg();
  if (!org) {
    throw new Error(
      "Usuário sem organização vinculada. Verifique core.memberships para este usuário."
    );
  }
  return org;
}

supabase.auth.onAuthStateChange(() => {
  invalidateOrgCache();
});
