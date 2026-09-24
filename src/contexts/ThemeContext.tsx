import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light";
export type ThemePreference = ThemeMode | "auto";
export type Accent = "blue" | "violet" | "green" | "orange";
export type FontSize = "compact" | "normal" | "comfortable";
export type Density = "compact" | "comfortable";

interface ThemeState {
  /** tema efetivamente aplicado (resolve "auto" pro sistema operacional) */
  theme: ThemeMode;
  /** preferência escolhida pelo usuário — pode ser "auto" */
  themePreference: ThemePreference;
  accent: Accent;
  fontSize: FontSize;
  density: Density;
  defaultRoute: string;
  toggleTheme: () => void;
  setThemePreference: (t: ThemePreference) => void;
  setAccent: (a: Accent) => void;
  setFontSize: (f: FontSize) => void;
  setDensity: (d: Density) => void;
  setDefaultRoute: (r: string) => void;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

const THEME_KEY = "applause_theme"; // "dark" | "light" | "auto"
const ACCENT_KEY = "applause_accent";
const FONT_SIZE_KEY = "applause_font_size";
const DENSITY_KEY = "applause_density";
const DEFAULT_ROUTE_KEY = "applause_default_route";

const FONT_SIZE_PX: Record<FontSize, number> = { compact: 14, normal: 16, comfortable: 18 };

function readStored<T extends string>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return (v as T) || fallback;
  } catch {
    return fallback;
  }
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return true;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() =>
    readStored<ThemePreference>(THEME_KEY, "dark")
  );
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const [accent, setAccentState] = useState<Accent>(() => readStored<Accent>(ACCENT_KEY, "blue"));
  const [fontSize, setFontSizeState] = useState<FontSize>(() => readStored<FontSize>(FONT_SIZE_KEY, "normal"));
  const [density, setDensityState] = useState<Density>(() => readStored<Density>(DENSITY_KEY, "comfortable"));
  const [defaultRoute, setDefaultRouteState] = useState<string>(() => readStored(DEFAULT_ROUTE_KEY, "/"));

  const theme: ThemeMode = themePreference === "auto" ? (systemDark ? "dark" : "light") : themePreference;

  // acompanha a preferência do SO quando o usuário escolheu "automático"
  useEffect(() => {
    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => setSystemDark(mql!.matches);
      mql.addEventListener("change", onChange);
      return () => mql!.removeEventListener("change", onChange);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, themePreference);
    } catch {
      /* localStorage indisponível — segue só na sessão */
    }
  }, [themePreference]);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
    try {
      localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      /* idem */
    }
  }, [accent]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${FONT_SIZE_PX[fontSize]}px`;
    try {
      localStorage.setItem(FONT_SIZE_KEY, fontSize);
    } catch {
      /* idem */
    }
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
    try {
      localStorage.setItem(DENSITY_KEY, density);
    } catch {
      /* idem */
    }
  }, [density]);

  useEffect(() => {
    try {
      localStorage.setItem(DEFAULT_ROUTE_KEY, defaultRoute);
    } catch {
      /* idem */
    }
  }, [defaultRoute]);

  function toggleTheme() {
    setThemePreferenceState((t) => {
      const resolved = t === "auto" ? (systemPrefersDark() ? "dark" : "light") : t;
      return resolved === "dark" ? "light" : "dark";
    });
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themePreference,
        accent,
        fontSize,
        density,
        defaultRoute,
        toggleTheme,
        setThemePreference: setThemePreferenceState,
        setAccent: setAccentState,
        setFontSize: setFontSizeState,
        setDensity: setDensityState,
        setDefaultRoute: setDefaultRouteState,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme precisa estar dentro de <ThemeProvider>");
  return ctx;
}
