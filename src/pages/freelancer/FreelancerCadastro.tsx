import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cadastrarFreelancer } from "@/lib/freelancers/actions";
import Logo from "@/components/Logo";

export default function FreelancerCadastro() {
  const { session, loading } = useAuth();
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [equipamento, setEquipamento] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/freelancer/agenda" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await cadastrarFreelancer(email, senha, { nomeCompleto, telefone, cidade, portfolioUrl, equipamento });
      setOk(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setBusy(false);
    }
  }

  if (ok) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-900 px-4">
        <div className="w-full max-w-sm space-y-3 rounded-lg border border-ink-800 bg-ink-850 p-6 text-center">
          <Logo className="mx-auto h-10" />
          <p className="text-ink-50">Cadastro enviado!</p>
          <p className="text-sm text-ink-400">
            Se sua conta pedir confirmação de e-mail, verifique sua caixa de entrada antes do primeiro login.
          </p>
          <Link to="/freelancer/login" className="inline-block text-sm text-brand-400 hover:text-brand-300">
            Ir para o login →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-3 rounded-lg border border-ink-800 bg-ink-850 p-6 shadow-xl shadow-black/30"
      >
        <div className="mb-2 flex flex-col items-center gap-3 text-center">
          <Logo className="h-10" />
          <p className="text-sm text-ink-300">Cadastro de fotógrafo freelancer</p>
        </div>

        <Campo label="Nome completo" value={nomeCompleto} onChange={setNomeCompleto} required />
        <Campo label="E-mail" type="email" value={email} onChange={setEmail} required />
        <Campo label="Senha" type="password" value={senha} onChange={setSenha} required minLength={6} />
        <Campo label="Telefone / WhatsApp" value={telefone} onChange={setTelefone} required />
        <Campo label="Cidade" value={cidade} onChange={setCidade} required />
        <Campo label="Portfólio (link, opcional)" value={portfolioUrl} onChange={setPortfolioUrl} />
        <Campo label="Equipamento (opcional)" value={equipamento} onChange={setEquipamento} />

        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-brand-600 py-2 font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {busy ? "Enviando…" : "Cadastrar"}
        </button>
        <p className="text-center text-sm text-ink-400">
          Já tem conta?{" "}
          <Link to="/freelancer/login" className="text-brand-400 hover:text-brand-300">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
  required,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-ink-300">{label}</label>
      <input
        type={type}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-ink-50"
      />
    </div>
  );
}
