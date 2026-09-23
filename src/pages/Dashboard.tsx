import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";
import AppearanceMenu from "@/components/AppearanceMenu";

const MODULES = [
  { to: "/vendas", label: "Painel de Vendas", ready: true },
  { to: "/checklist", label: "Checklist de Solenidade", ready: true },
  { to: "/atendimento", label: "CRM de Atendimento", ready: true },
  { to: "/sdr", label: "SDR (Agente de IA)", ready: true },
  { to: "/financeiro", label: "Financeiro (Contas a Receber)", ready: true },
  { to: "/producao", label: "Produção (Itens Vendidos)", ready: true },
  { to: "/p4f", label: "P4F / Sessão Estúdio", ready: true },
  { to: "/contas-pagar", label: "Contas a Pagar", ready: true },
  { to: "/lucro", label: "Lucro por Contrato", ready: true },
];

export default function Dashboard() {
  const { org, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-ink-900 p-6 text-ink-50">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="h-9" />
          <div className="h-8 w-px bg-ink-700" />
          <div>
            <h1 className="text-lg font-semibold text-ink-50">Applause</h1>
            <p className="text-sm text-ink-300">{org?.name ?? "Organização"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AppearanceMenu />
          <button onClick={signOut} className="text-sm text-ink-300 hover:text-ink-50">
            Sair
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="rounded-lg border border-ink-700 bg-ink-850 p-4 shadow-sm transition hover:border-brand-600 hover:shadow-brand-900/20"
          >
            <p className="font-medium text-ink-50">{m.label}</p>
            <p className="mt-1 text-xs text-ink-400">
              {m.ready ? "Disponível" : "Em construção"}
            </p>
          </Link>
        ))}
      </div>

      <footer className="mt-12 flex items-center justify-center gap-2 text-xs text-ink-500">
        <Logo className="h-4 opacity-60" />
      </footer>
    </div>
  );
}
