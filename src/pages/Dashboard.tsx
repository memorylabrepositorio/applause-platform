import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const MODULES = [
  { to: "/vendas", label: "Painel de Vendas", ready: false },
  { to: "/checklist", label: "Checklist de Solenidade", ready: false },
  { to: "/atendimento", label: "CRM de Atendimento", ready: false },
  { to: "/sdr", label: "SDR (Agente de IA)", ready: false },
];

export default function Dashboard() {
  const { org, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Applause</h1>
          <p className="text-sm text-slate-400">{org?.name ?? "Organização"}</p>
        </div>
        <button onClick={signOut} className="text-sm text-slate-400 hover:text-slate-200">
          Sair
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-indigo-600"
          >
            <p className="font-medium">{m.label}</p>
            <p className="mt-1 text-xs text-slate-500">
              {m.ready ? "Disponível" : "Em construção"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
