import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
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

const COLLAPSE_KEY = "applause_sidebar_collapsed";

export default function Sidebar() {
  const { org, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [collapsed]);

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-2">
      {MODULES.map((m) => (
        <NavLink
          key={m.to}
          to={m.to}
          title={collapsed ? m.label : undefined}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
              collapsed ? "lg:justify-center lg:px-0" : ""
            } ${
              isActive
                ? "bg-brand-950/80 text-brand-300 shadow-inner shadow-black/30"
                : "text-ink-300 hover:translate-x-0.5 hover:bg-ink-800/70 hover:text-ink-50"
            }`
          }
        >
          <span className="text-base leading-none drop-shadow-sm">{m.icon}</span>
          <span
            className={`truncate transition-all duration-150 ${
              collapsed ? "lg:w-0 lg:opacity-0" : "lg:w-auto lg:opacity-100"
            }`}
          >
            {m.label}
          </span>
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
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`z-50 flex shrink-0 flex-col border-r border-ink-800/60 bg-ink-850/75 shadow-[8px_0_30px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "fixed inset-y-0 left-0 w-64 translate-x-0" : "fixed inset-y-0 left-0 w-64 -translate-x-full lg:relative"
        } ${collapsed ? "lg:w-[4.5rem]" : "lg:w-64"}`}
      >
        <div className="flex items-center gap-3 border-b border-ink-800/60 px-4 py-5">
          <NavLink to="/" className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            {collapsed ? (
              <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-lg shadow-brand-950/50 lg:flex">
                M
              </span>
            ) : null}
            <Logo className={`h-11 shrink-0 ${collapsed ? "lg:hidden" : ""}`} />
          </NavLink>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md border border-ink-700 text-xs text-ink-300 transition hover:border-brand-600 hover:text-brand-300 lg:flex"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>
        {!collapsed && (
          <div className="px-4 pb-1 pt-3">
            <p className="truncate text-sm font-medium text-ink-100">{org?.name ?? "Organização"}</p>
            <p className="text-xs text-ink-500">Painel Applause</p>
          </div>
        )}
        {nav}
        <div
          className={`flex items-center gap-2 border-t border-ink-800/60 px-3 py-3 ${
            collapsed ? "lg:flex-col" : "justify-between"
          }`}
        >
          <AppearanceMenu />
          <button
            onClick={signOut}
            title="Sair"
            aria-label="Sair"
            className="rounded-md px-2 py-1.5 text-sm text-ink-300 transition hover:text-ink-50"
          >
            <span className={collapsed ? "lg:hidden" : ""}>Sair</span>
            <span className={`hidden ${collapsed ? "lg:inline" : ""}`}>⏻</span>
          </button>
        </div>
      </aside>
    </>
  );
}
