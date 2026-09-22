import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-8"
      >
        <h1 className="text-xl font-semibold text-slate-100">Applause</h1>
        <div className="space-y-1">
          <label className="text-sm text-slate-400">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-400">Senha</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
