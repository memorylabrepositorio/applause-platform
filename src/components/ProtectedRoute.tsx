import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, org, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-ink-300">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <span className="text-sm">Carregando…</span>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // sessão válida mas sem organização (ex: conta de freelancer, que não tem
  // linha em core.memberships) não é conta da equipe — não entra no painel
  // interno, mesmo sabendo a URL. Não redireciona pra /login: o Login manda
  // quem tem sessão de volta pra "/", o que viraria um loop.
  if (!org) return <SemAcesso />;

  return <>{children}</>;
}

function SemAcesso() {
  const { session, signOut } = useAuth();
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 px-4 text-center text-ink-300">
      <p className="text-ink-100">Esta conta não tem acesso ao painel interno.</p>
      <p className="text-sm">
        {session?.user.email} não está vinculada a nenhuma organização. Se você é da equipe, peça para liberarem o
        acesso.
      </p>
      <div className="mt-2 flex gap-3 text-sm">
        <Link to="/freelancer/agenda" className="text-brand-400 hover:text-brand-300">
          Sou freelancer
        </Link>
        <button onClick={() => signOut()} className="text-brand-400 hover:text-brand-300">
          Sair
        </button>
      </div>
    </div>
  );
}
