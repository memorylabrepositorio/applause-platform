import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { CalendarDays, ListChecks, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Logo from "@/components/Logo";

const NAV = [
  { to: "/freelancer/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/freelancer/candidaturas", label: "Minhas candidaturas", icon: ListChecks },
];

export default function FreelancerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-900 text-ink-50">
      <header className="flex items-center justify-between border-b border-ink-800 bg-ink-850 px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo className="h-7" />
          <span className="text-sm text-ink-400">Portal do Freelancer</span>
        </div>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
                  isActive ? "bg-brand-600 text-white" : "text-ink-300 hover:bg-ink-800 hover:text-ink-50"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={() => supabase.auth.signOut()}
            className="ml-2 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-50"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
