import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { falarSaudacao, lerApelido, periodoAtual, primeiroNome } from "@/lib/greeting";
import Logo from "@/components/Logo";
import AppearanceMenu from "@/components/AppearanceMenu";

export default function Login() {
  const { session } = useAuth();
  const { saudacaoAudio, saudacaoTextos, saudacaoVozId } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // saudação falada — dispara aqui, dentro do gesto de clique do usuário
    // (login), que é o que a maioria dos navegadores exige pra liberar áudio.
    // o apelido é lido pelo ID desta conta que acabou de logar — nunca do
    // apelido de quem usou o computador antes (ver lerApelido em lib/greeting)
    if (saudacaoAudio) {
      const apelido = lerApelido(data.session);
      falarSaudacao(primeiroNome(data.session, apelido), saudacaoTextos[periodoAtual()], saudacaoVozId);
    }
  }

  return (
    <div className="relative flex h-screen items-center justify-center bg-ink-900">
      <div className="absolute right-4 top-4">
        <AppearanceMenu />
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-3 rounded-lg border border-ink-800 bg-ink-850 p-6 shadow-xl shadow-black/30"
      >
        <div className="mb-2 flex flex-col items-center gap-3 text-center">
          <Logo className="h-10" />
          <p className="text-sm text-ink-300">Painel Applause</p>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-ink-300">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-ink-50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-ink-300">Senha</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-ink-50"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-brand-600 py-2 font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
