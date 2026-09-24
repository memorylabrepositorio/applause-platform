import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { SAUDACAO_PADRAO, lerApelido, salvarApelido, type Periodo } from "@/lib/greeting";
import { loadUserPreferences, saveUserPreferences } from "@/lib/preferences/fetch";
import { useAuth } from "@/contexts/AuthContext";

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
  /** saudação falada ("Bom dia, {nome}") ao logar — ligado por padrão */
  saudacaoAudio: boolean;
  /** como a pessoa quer ser chamada na saudação — vazio = usa nome/e-mail cadastrado */
  apelido: string;
  /** texto da saudação por período do dia — usa {nome} como placeholder */
  saudacaoTextos: Record<Periodo, string>;
  /** id (nome|idioma) da voz escolhida — vazio = escolhe automaticamente uma voz em pt-BR */
  saudacaoVozId: string;
  /** true enquanto ainda não sabemos se há preferências salvas na conta */
  carregandoPreferencias: boolean;
  toggleTheme: () => void;
  setThemePreference: (t: ThemePreference) => void;
  setAccent: (a: Accent) => void;
  setFontSize: (f: FontSize) => void;
  setDensity: (d: Density) => void;
  setDefaultRoute: (r: string) => void;
  setSaudacaoAudio: (v: boolean) => void;
  setApelido: (v: string) => void;
  setSaudacaoTexto: (periodo: Periodo, texto: string) => void;
  setSaudacaoVozId: (id: string) => void;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

// Chaves de localStorage: continuam existindo como CACHE local (pintura
// instantânea antes da conta carregar, e o que vale enquanto ninguém está
// logado — ex. tema na tela de login). A partir do momento em que a pessoa
// loga, a fonte de verdade passa a ser `core.user_preferences` no banco —
// segue a CONTA, não o navegador/computador (ver lib/preferences/fetch.ts).
const THEME_KEY = "applause_theme"; // "dark" | "light" | "auto"
const ACCENT_KEY = "applause_accent";
const FONT_SIZE_KEY = "applause_font_size";
const DENSITY_KEY = "applause_density";
const DEFAULT_ROUTE_KEY = "applause_default_route";
const SAUDACAO_AUDIO_KEY = "applause_saudacao_audio";
const SAUDACAO_TEXTO_KEY_PREFIX = "applause_saudacao_texto_"; // + manha|tarde|noite
const SAUDACAO_VOZ_KEY = "applause_saudacao_voz";

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
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;

  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() =>
    readStored<ThemePreference>(THEME_KEY, "dark")
  );
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const [accent, setAccentState] = useState<Accent>(() => readStored<Accent>(ACCENT_KEY, "blue"));
  const [fontSize, setFontSizeState] = useState<FontSize>(() => readStored<FontSize>(FONT_SIZE_KEY, "normal"));
  const [density, setDensityState] = useState<Density>(() => readStored<Density>(DENSITY_KEY, "comfortable"));
  const [defaultRoute, setDefaultRouteState] = useState<string>(() => readStored(DEFAULT_ROUTE_KEY, "/"));
  const [saudacaoAudio, setSaudacaoAudioState] = useState<boolean>(
    () => readStored(SAUDACAO_AUDIO_KEY, "1") === "1"
  );
  const [apelido, setApelidoState] = useState<string>("");
  const [saudacaoTextos, setSaudacaoTextosState] = useState<Record<Periodo, string>>(() => ({
    manha: readStored(SAUDACAO_TEXTO_KEY_PREFIX + "manha", SAUDACAO_PADRAO.manha),
    tarde: readStored(SAUDACAO_TEXTO_KEY_PREFIX + "tarde", SAUDACAO_PADRAO.tarde),
    noite: readStored(SAUDACAO_TEXTO_KEY_PREFIX + "noite", SAUDACAO_PADRAO.noite),
  }));
  const [saudacaoVozId, setSaudacaoVozIdState] = useState<string>(() => readStored(SAUDACAO_VOZ_KEY, ""));
  const [carregandoPreferencias, setCarregandoPreferencias] = useState(false);

  const theme: ThemeMode = themePreference === "auto" ? (systemDark ? "dark" : "light") : themePreference;

  // enquanto está carregando o que veio do banco (ou aplicando o que
  // acabou de vir de lá), não queremos que os efeitos de "salvar" abaixo
  // disparem um save imediato de volta — só depois que é uma mudança real
  // feita pela pessoa
  const suprimirSaveRef = useRef(false);
  const uidCarregadoRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    document.documentElement.setAttribute("data-accent", accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${FONT_SIZE_PX[fontSize]}px`;
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  // apelido é lido/gravado por conta (uid) desde o início — nunca mistura
  // entre pessoas que usam o mesmo computador (ver lib/greeting.ts)
  useEffect(() => {
    setApelidoState(lerApelido(session));
  }, [uid]);

  // ----------------------------------------------------------------------
  // Carrega as preferências salvas na conta assim que sabemos quem é a
  // pessoa logada. Até lá (e para quem não está logado, ex. tela de login),
  // vale o cache local acima — dá uma pintura instantânea sem esperar a
  // rede, e é o único lugar que existe pra alguém deslogado.
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!uid || uidCarregadoRef.current === uid) return;
    uidCarregadoRef.current = uid;
    setCarregandoPreferencias(true);
    loadUserPreferences()
      .then((prefs) => {
        if (!prefs) return;
        suprimirSaveRef.current = true;
        if (prefs.theme) setThemePreferenceState(prefs.theme);
        if (prefs.accent) setAccentState(prefs.accent);
        if (prefs.fontSize) setFontSizeState(prefs.fontSize);
        if (prefs.density) setDensityState(prefs.density);
        if (prefs.defaultRoute) setDefaultRouteState(prefs.defaultRoute);
        if (typeof prefs.saudacaoAudio === "boolean") setSaudacaoAudioState(prefs.saudacaoAudio);
        if (typeof prefs.apelido === "string" && prefs.apelido) {
          setApelidoState(prefs.apelido);
          salvarApelido(session, prefs.apelido); // mantém o cache local em dia também
        }
        if (prefs.saudacaoTextos) {
          setSaudacaoTextosState((atual) => ({ ...atual, ...prefs.saudacaoTextos }));
        }
        if (typeof prefs.saudacaoVozId === "string") setSaudacaoVozIdState(prefs.saudacaoVozId);
        // solta a supressão só depois que os set-states acima já rodaram e
        // os efeitos de "salvar" já viram os valores novos (senão reagimos
        // a um estado ainda desatualizado e a supressão não pega tudo)
        setTimeout(() => {
          suprimirSaveRef.current = false;
        }, 0);
      })
      .finally(() => setCarregandoPreferencias(false));
  }, [uid]);

  // ----------------------------------------------------------------------
  // Sempre que algo muda, grava no cache local na hora (pintura instantânea
  // / funciona sem conta) e agenda uma gravação no banco com debounce
  // (evita bater no banco a cada tecla digitada num campo de texto).
  // ----------------------------------------------------------------------
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, themePreference);
      localStorage.setItem(ACCENT_KEY, accent);
      localStorage.setItem(FONT_SIZE_KEY, fontSize);
      localStorage.setItem(DENSITY_KEY, density);
      localStorage.setItem(DEFAULT_ROUTE_KEY, defaultRoute);
      localStorage.setItem(SAUDACAO_AUDIO_KEY, saudacaoAudio ? "1" : "0");
      localStorage.setItem(SAUDACAO_VOZ_KEY, saudacaoVozId);
      (Object.keys(saudacaoTextos) as Periodo[]).forEach((p) => {
        localStorage.setItem(SAUDACAO_TEXTO_KEY_PREFIX + p, saudacaoTextos[p]);
      });
    } catch {
      /* localStorage indisponível — segue só na sessão */
    }

    if (!uid || suprimirSaveRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveUserPreferences({
        theme: themePreference,
        accent,
        fontSize,
        density,
        defaultRoute,
        saudacaoAudio,
        apelido,
        saudacaoTextos,
        saudacaoVozId,
      });
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, themePreference, accent, fontSize, density, defaultRoute, saudacaoAudio, apelido, saudacaoTextos, saudacaoVozId]);

  function setSaudacaoTexto(periodo: Periodo, texto: string) {
    setSaudacaoTextosState((atual) => ({ ...atual, [periodo]: texto }));
  }

  function setApelido(valor: string) {
    setApelidoState(valor);
    salvarApelido(session, valor); // cache local instantâneo — o save no banco vem pelo efeito de debounce acima
  }

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
        saudacaoAudio,
        apelido,
        saudacaoTextos,
        saudacaoVozId,
        carregandoPreferencias,
        toggleTheme,
        setThemePreference: setThemePreferenceState,
        setAccent: setAccentState,
        setFontSize: setFontSizeState,
        setDensity: setDensityState,
        setDefaultRoute: setDefaultRouteState,
        setSaudacaoAudio: setSaudacaoAudioState,
        setApelido,
        setSaudacaoTexto,
        setSaudacaoVozId: setSaudacaoVozIdState,
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
