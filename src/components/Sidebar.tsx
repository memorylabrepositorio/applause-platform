import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pin,
  PinOff,
  Power,
  Menu,
  Settings,
  Orbit,
  LayoutGrid,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import Logo from "@/components/Logo";
import AppearanceMenu from "@/components/AppearanceMenu";
import { useAuth } from "@/contexts/AuthContext";
import { DEPARTAMENTOS } from "@/lib/mapa/data";
import marca from "@/assets/marca-branca.png";

interface ItemNav {
  to: string;
  label: string;
}

interface GrupoNav {
  id: string;
  nome: string;
  icon: LucideIcon;
  cor: string;
  to?: string;
  itens: ItemNav[];
}

// itens de topo, fora dos setores
const TOPO: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/mapa", label: "Mapa", icon: Orbit },
  { to: "/modulos", label: "Visão geral", icon: LayoutGrid },
];

// a sidebar é agrupada por setor a partir dos MESMOS dados do Mapa — os dois
// ficam sempre em sincronia (ícone, cor e rotas). Setores sem nenhuma rota de
// verdade (ainda em desenvolvimento) não aparecem aqui — mesmo critério do
// Mapa, que também esconde as funções "dev" da vista principal.
const GRUPOS: GrupoNav[] = DEPARTAMENTOS.map((d) => {
  const vistos = new Set<string>(d.to ? [d.to] : []);
  const itens: ItemNav[] = [];
  d.ramos.flat().forEach((f) => {
    if (!f.to || vistos.has(f.to)) return;
    vistos.add(f.to);
    itens.push({ to: f.to, label: f.nome });
  });
  return { id: d.id, nome: d.nome, icon: d.icon, cor: d.cor, to: d.to, itens };
}).filter((g) => g.to || g.itens.length > 0);

const RODAPE: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

const PIN_KEY = "applause_sidebar_pinned";

export default function Sidebar() {
  const { org, signOut } = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  // "pinned" = o usuário travou a sidebar aberta manualmente.
  // sem pin, ela recolhe sozinha e só expande com o mouse em cima (hover) —
  // reage ao uso, não exige clique.
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem(PIN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [hovering, setHovering] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // setor com o "dropdown" de ferramentas aberto (só um por vez)
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);
  const grupoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(PIN_KEY, pinned ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [pinned]);

  // fecha o menu mobile e desfaz o "peek" ao trocar de painel
  useEffect(() => {
    setMobileOpen(false);
    setHovering(false);
    setGrupoAberto(null);
  }, [pathname]);

  const expanded = pinned || hovering;

  // sem a sidebar expandida não tem onde o dropdown descer — fecha junto
  useEffect(() => {
    if (!expanded) setGrupoAberto(null);
  }, [expanded]);

  function onEnter() {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    if (!pinned) setHovering(true);
  }
  function onLeave() {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setHovering(false), 150);
  }

  function abrirGrupo(id: string) {
    if (grupoTimer.current) clearTimeout(grupoTimer.current);
    setGrupoAberto(id);
  }
  function fecharGrupo() {
    if (grupoTimer.current) clearTimeout(grupoTimer.current);
    grupoTimer.current = setTimeout(() => setGrupoAberto(null), 150);
  }

  function itemClasses(isActive: boolean) {
    return `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 ${
      isActive
        ? "bg-gradient-to-r from-brand-600/25 to-brand-600/5 text-brand-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        : "text-ink-300 hover:bg-ink-50/[0.06] hover:text-ink-50"
    }`;
  }

  function ItemLink({ to, label, Icon }: { to: string; label: string; Icon: LucideIcon }) {
    return (
      <NavLink
        to={to}
        title={!expanded ? label : undefined}
        onClick={() => setMobileOpen(false)}
        className={({ isActive }) => itemClasses(isActive)}
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand-500 shadow-[0_0_8px] shadow-brand-500/70" />
            )}
            <Icon
              size={18}
              strokeWidth={1.75}
              className={`shrink-0 transition-transform duration-150 ${isActive ? "text-brand-400" : "text-ink-400 group-hover:text-ink-100"} group-hover:scale-110`}
            />
            <span className={`truncate transition-all duration-150 ${expanded ? "opacity-100" : "lg:w-0 lg:opacity-0"}`}>
              {label}
            </span>
          </>
        )}
      </NavLink>
    );
  }

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2.5 py-2">
      {TOPO.map((m) => (
        <ItemLink key={m.to} to={m.to} label={m.label} Icon={m.icon} />
      ))}

      <div className="my-2 border-t border-white/[0.06]" />

      {GRUPOS.map((g) => {
        const Icon = g.icon;
        const temSub = g.itens.length > 0;
        const aberto = expanded && grupoAberto === g.id;
        const ativoNoGrupo = pathname === g.to || g.itens.some((it) => pathname === it.to);

        if (!temSub) {
          // setor sem sub-rotas próprias — link simples, igual ao topo
          return <ItemLink key={g.id} to={g.to!} label={g.nome} Icon={Icon} />;
        }

        return (
          <div key={g.id} onMouseEnter={() => expanded && abrirGrupo(g.id)} onMouseLeave={fecharGrupo}>
            {g.to ? (
              <NavLink
                to={g.to}
                title={!expanded ? g.nome : undefined}
                className={({ isActive }) => itemClasses(isActive || ativoNoGrupo)}
              >
                {({ isActive }) => (
                  <>
                    {(isActive || ativoNoGrupo) && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand-500 shadow-[0_0_8px] shadow-brand-500/70" />
                    )}
                    <Icon
                      size={18}
                      strokeWidth={1.75}
                      className={`shrink-0 transition-transform duration-150 ${
                        isActive || ativoNoGrupo ? "" : "text-ink-400 group-hover:text-ink-100"
                      } group-hover:scale-110`}
                      style={isActive || ativoNoGrupo ? { color: g.cor } : undefined}
                    />
                    <span className={`flex-1 truncate transition-all duration-150 ${expanded ? "opacity-100" : "lg:w-0 lg:opacity-0"}`}>
                      {g.nome}
                    </span>
                    {expanded && (
                      <ChevronDown
                        size={14}
                        className={`shrink-0 text-ink-500 transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ) : (
              <button
                type="button"
                onClick={() => setGrupoAberto((a) => (a === g.id ? null : g.id))}
                title={!expanded ? g.nome : undefined}
                className={itemClasses(ativoNoGrupo) + " w-full"}
              >
                <Icon size={18} strokeWidth={1.75} className="shrink-0 text-ink-400 group-hover:text-ink-100 group-hover:scale-110" />
                <span className={`flex-1 truncate text-left transition-all duration-150 ${expanded ? "opacity-100" : "lg:w-0 lg:opacity-0"}`}>
                  {g.nome}
                </span>
                {expanded && (
                  <ChevronDown size={14} className={`shrink-0 text-ink-500 transition-transform duration-200 ${aberto ? "rotate-180" : ""}`} />
                )}
              </button>
            )}

            <AnimatePresence initial={false}>
              {aberto && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="ml-[22px] flex flex-col gap-0.5 border-l border-white/[0.08] py-1 pl-4">
                    {g.itens.map((it) => (
                      <NavLink
                        key={it.to}
                        to={it.to}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `truncate rounded-lg px-2.5 py-1.5 text-[13px] transition-colors duration-150 ${
                            isActive ? "text-brand-300" : "text-ink-400 hover:text-ink-50"
                          }`
                        }
                      >
                        {it.label}
                      </NavLink>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      <div className="my-2 border-t border-white/[0.06]" />

      {RODAPE.map((m) => (
        <ItemLink key={m.to} to={m.to} label={m.label} Icon={m.icon} />
      ))}
    </nav>
  );

  return (
    <>
      {/* mobile top bar */}
      <div className="flex items-center justify-between border-b border-ink-800/60 bg-ink-900 p-3 lg:hidden">
        <NavLink to="/" className="flex items-center gap-2">
          <Logo className="h-7" />
        </NavLink>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md border border-ink-700 p-1.5 text-ink-200"
          aria-label="Abrir menu"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <motion.aside
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        animate={{ width: expanded ? 264 : 76 }}
        transition={{ duration: 0.22, ease: "easeInOut" }}
        style={{ width: expanded ? 264 : 76 }}
        className={`sidebar-glass z-50 flex shrink-0 flex-col overflow-hidden border-r border-white/[0.06] shadow-[8px_0_40px_-12px_rgba(0,0,0,0.7)] lg:sticky lg:top-0 lg:h-screen ${
          mobileOpen
            ? "fixed inset-y-0 left-0 !w-64 translate-x-0"
            : "fixed inset-y-0 left-0 !w-64 -translate-x-full lg:relative lg:!w-auto lg:translate-x-0"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-3.5 py-5">
          <NavLink to="/" className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-1.5 shadow-lg shadow-brand-950/60">
              <img src={marca} alt="MemoryLab" className="h-full w-full object-contain" />
            </span>
            <AnimatePresence>
              {expanded && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                  className="min-w-0"
                >
                  <Logo className="h-8" />
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
          <button
            onClick={() => setPinned((v) => !v)}
            className={`hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-400 transition hover:bg-white/[0.08] hover:text-brand-300 lg:flex ${
              expanded ? "" : "lg:hidden"
            }`}
            title={pinned ? "Desafixar (recolher ao tirar o mouse)" : "Fixar aberta"}
            aria-label={pinned ? "Desafixar menu" : "Fixar menu"}
          >
            {pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
        </div>

        {expanded && (
          <div className="px-3.5 pb-1 pt-3">
            <p className="truncate text-sm font-medium text-ink-100">{org?.name ?? "Organização"}</p>
            <p className="text-xs text-ink-500">Painel Applause</p>
          </div>
        )}

        {nav}

        <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-3">
          <AppearanceMenu />
          <button
            onClick={signOut}
            title="Sair"
            aria-label="Sair"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-300 transition hover:text-ink-50"
          >
            <Power size={15} strokeWidth={1.75} />
            {expanded && <span>Sair</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
