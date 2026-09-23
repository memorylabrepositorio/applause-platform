import { useEffect, useRef, useState } from "react";
import { useTheme, type Accent } from "@/contexts/ThemeContext";

const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  { id: "blue", label: "Azul", swatch: "#0464b0" },
  { id: "violet", label: "Violeta", swatch: "#4a3aa7" },
  { id: "green", label: "Verde", swatch: "#1baf7a" },
  { id: "orange", label: "Laranja", swatch: "#eb6834" },
];

export default function AppearanceMenu() {
  const { theme, accent, toggleTheme, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Aparência"
        aria-label="Aparência"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-700 text-ink-300 transition hover:border-brand-600 hover:text-ink-50"
      >
        {theme === "dark" ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 w-56 rounded-lg border border-ink-700 bg-ink-850 p-3 shadow-xl shadow-black/30">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">Tema</p>
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => theme !== "dark" && toggleTheme()}
              className={`flex-1 rounded-md border px-2 py-1.5 text-sm transition ${
                theme === "dark" ? "border-brand-600 bg-brand-950 text-brand-300" : "border-ink-600 text-ink-300 hover:text-ink-50"
              }`}
            >
              Escuro
            </button>
            <button
              onClick={() => theme !== "light" && toggleTheme()}
              className={`flex-1 rounded-md border px-2 py-1.5 text-sm transition ${
                theme === "light" ? "border-brand-600 bg-brand-950 text-brand-300" : "border-ink-600 text-ink-300 hover:text-ink-50"
              }`}
            >
              Claro
            </button>
          </div>

          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">Cor de destaque</p>
          <div className="flex gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccent(a.id)}
                title={a.label}
                aria-label={a.label}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  accent === a.id ? "border-ink-50 scale-110" : "border-transparent hover:scale-105"
                }`}
                style={{ background: a.swatch }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
