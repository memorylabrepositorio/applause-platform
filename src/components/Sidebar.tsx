import { NavLink } from "react-router-dom";
import { useState } from "react";
import Logo from "@/components/Logo";
import AppearanceMenu from "@/components/AppearanceMenu";
import { useAuth } from "@/contexts/AuthContext";

const MODULES = [
  { to: "/vendas", label: "Vendas", icon: "💰" },
  { to: "/checklist", label: "Checklist", icon: "📋" },
  { to: "/atendimento", label: "Atendimento", icon: "🤝" },
  { to: "/sdr", label: "SDR (IA)", icon: "🤖" },
  { to: "/financeiro", label: "Financeiro", icon: "💵" },
  { to: "/producao", label: "Produção", icon: "🖼️" },
  { to: "/p4f", label: "P4F / Estúdio", icon: "📸" },
  { to: "/contas-pagar", label: "Contas a pagar", icon: "🧾" },
  { to: "/lucro", label: "Lucro por contrato", icon: "📈" },
];

export default function Sidebar() {
  const { org, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
      {MODULES.map((m) => (
        <NavLink
          key={m.to}
          to={m.to}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
              isActive
                ? "bg-brand-950 text-brand-300"
                : "text-ink-300 hover:bg-ink-800 hover:text-ink-50"
            }`
          }
        >
          <span className="text-base leading-none">{m.icon}</span>
          <span className="truncate">{m.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <>
      {/* mobile top bar */}
      <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900 p-3 lg:hidden">
        <NavLink to="/" className="flex items-center gap-2">
          <Logo className="h-7" />
        </NavLink>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-200"
          aria-label="Abrir menu"
        >
          ☰
        </button>
      </div>

      {/* overlay for mobile */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`z-50 flex w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-850 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "fixed inset-y-0 left-0 translate-x-0" : "fixed inset-y-0 left-0 -translate-x-full lg:relative"
        }`}
      >
        <NavLink to="/" className="flex items-center gap-3 border-b border-ink-800 px-4 py-5">
          <Logo className="h-11" />
        </NavLink>
        <div className="px-4 pb-1 pt-3">
          <p className="truncate text-sm font-medium text-ink-100">{org?.name ?? "Organização"}</p>
          <p className="text-xs text-ink-500">Painel Applause</p>
        </div>
        {nav}
        <div className="flex items-center justify-between gap-2 border-t border-ink-800 px-3 py-3">
          <AppearanceMenu />
          <button
            onClick={signOut}
            className="rounded-md px-2 py-1.5 text-sm text-ink-300 hover:text-ink-50"
          >
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
