import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getCurrentOrg, type Organization } from "@/lib/org";

interface AuthState {
  session: Session | null;
  org: Organization | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [orgLoading, setOrgLoading] = useState(false);
  const orgUid = useRef<string | null>(null);

  useEffect(() => {
    // só (re)busca a org quando muda o usuário — o refresh de token dispara
    // onAuthStateChange a cada hora e não pode "piscar" o painel inteiro
    function syncOrg(s: Session | null) {
      const uid = s?.user.id ?? null;
      if (uid === orgUid.current) return;
      orgUid.current = uid;
      setOrg(null);
      if (!uid) {
        setOrgLoading(false);
        return;
      }
      setOrgLoading(true);
      getCurrentOrg()
        .then((o) => {
          if (orgUid.current === uid) setOrg(o);
        })
        .catch(() => {
          if (orgUid.current === uid) setOrg(null);
        })
        .finally(() => {
          if (orgUid.current === uid) setOrgLoading(false);
        });
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      syncOrg(data.session);
      setSessionLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if ((newSession?.user.id ?? null) !== orgUid.current) setOrgLoading(true);
      // adiado: chamar o supabase de dentro deste callback pode travar no
      // lock interno do supabase-js (recomendação da própria documentação)
      setTimeout(() => syncOrg(newSession), 0);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // "loading" cobre sessão E organização: quem decide acesso (ProtectedRoute)
  // não pode ver "sessão sem org" só porque a org ainda está chegando
  const loading = sessionLoading || orgLoading;

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, org, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
