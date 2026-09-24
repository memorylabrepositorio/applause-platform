import { supabase } from "@/lib/supabase";
import type { Periodo } from "@/lib/greeting";

/**
 * Preferências pessoais do usuário logado — tema, cor de destaque, apelido
 * da saudação, voz escolhida etc. Guardadas em `core.user_preferences`
 * (um JSONB por usuário), então seguem a CONTA, não o navegador/computador:
 * a mesma pessoa vê tudo igual em qualquer máquina, e contas diferentes no
 * mesmo computador nunca se misturam.
 */
export interface UserPreferences {
  theme?: "dark" | "light" | "auto";
  accent?: "blue" | "violet" | "green" | "orange";
  fontSize?: "compact" | "normal" | "comfortable";
  density?: "compact" | "comfortable";
  defaultRoute?: string;
  saudacaoAudio?: boolean;
  apelido?: string;
  saudacaoTextos?: Partial<Record<Periodo, string>>;
  saudacaoVozId?: string;
}

/** Devolve as preferências salvas no banco pro usuário logado, ou null se
 *  não há sessão / a leitura falhou (offline, RLS, etc.) — quem chama deve
 *  seguir com o que já tem em cache local nesse caso, nunca travar a UI. */
export async function loadUserPreferences(): Promise<UserPreferences | null> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .schema("core")
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[preferences] falha ao carregar", error);
    return null;
  }
  return (data?.preferences as UserPreferences | undefined) ?? {};
}

/** Salva (upsert) as preferências do usuário logado. Silencioso em falha —
 *  preferência é "best effort", nunca deve travar o app. */
export async function saveUserPreferences(prefs: UserPreferences): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return;

  const { error } = await supabase
    .schema("core")
    .from("user_preferences")
    .upsert({ user_id: uid, preferences: prefs, atualizado_em: new Date().toISOString() });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[preferences] falha ao salvar", error);
  }
}
