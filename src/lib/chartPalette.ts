// Paleta categórica pra gráficos — mesma ordem/tons do painel antigo
// (MemoryLab), com o slot 1 trocado pro azul de marca da Applause.
// Validada (ΔE CVD e contraste) com o script da skill de dataviz antes
// de entrar aqui; a ORDEM importa pra segurança de daltonismo — nunca
// reordenar ou pular slots.
export const CATEGORICAL_DARK = [
  "#0464b0", // 1 azul (marca)
  "#d95926", // 2 laranja
  "#199e70", // 3 verde-água
  "#c98500", // 4 amarelo
  "#d55181", // 5 magenta
  "#008300", // 6 verde
  "#9085e9", // 7 violeta
  "#e66767", // 8 vermelho
];

export const CATEGORICAL_LIGHT = [
  "#0464b0",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];

export function categoricalPalette(theme: "dark" | "light"): string[] {
  return theme === "light" ? CATEGORICAL_LIGHT : CATEGORICAL_DARK;
}

// tons neutros pra grid/eixo/tooltip dos gráficos — espelham as variáveis
// --ink-* de src/index.css (Recharts não lê CSS custom properties, então
// precisam existir também como hex aqui)
export const CHART_NEUTRALS = {
  dark: { grid: "#232326", axis: "#8a8a94", tooltipBg: "#111113", tooltipText: "#e8e8ec" },
  light: { grid: "#dcdce3", axis: "#6b6b77", tooltipBg: "#ffffff", tooltipText: "#1c1c21" },
};
