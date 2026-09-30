import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMeuPerfil } from "@/lib/freelancers/fetch";
import type { Freelancer } from "@/lib/freelancers/engine";

interface Ctx {
  perfil: Freelancer;
}

/**
 * Área do freelancer: exige sessão válida E um perfil em `freelancers` (ou
 * seja, conta que se cadastrou por /freelancer/cadastro — não uma conta da
 * equipe interna). Passa o perfil já carregado pro children via render prop.
 */
export function FreelancerProtectedRoute({ children }: { children: (ctx: Ctx) => ReactNode }) {
  const { session, loading: authLoading, signOut } = useAuth();
  const [perfil, setPerfil] = useState<Freelancer | null>(null);
  const [perfilLoading, setPerfilLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setPerfilLoading(false);
      return;
    }
    fetchMeuPerfil(session.user.id)
      .then(setPerfil)
      .finally(() => setPerfilLoading(false));
  }, [session]);

  if (authLoading || perfilLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-ink-300">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <span className="text-sm">Carregando…</span>
      </div>
    );
  }

  if (!session) return <Navigate to="/freelancer/login" replace />;
  // sessão sem perfil de freelancer (ex: conta da equipe): não redireciona pro
  // /freelancer/login — ele manda quem tem sessão de volta pra agenda (loop)
  if (!perfil) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-4 text-center text-ink-300">
        <p className="text-ink-100">Esta conta não tem perfil de freelancer.</p>
        <p className="text-sm">{session.user.email} não está cadastrada no portal do freelancer.</p>
        <div className="mt-2 flex gap-3 text-sm">
          <Link to="/" className="text-brand-400 hover:text-brand-300">
            Ir para o painel
          </Link>
          <button onClick={() => signOut()} className="text-brand-400 hover:text-brand-300">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return <>{children({ perfil })}</>;
}
