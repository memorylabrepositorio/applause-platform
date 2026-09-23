/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta portada do painel antigo (MemoryLab): navy profundo + azul de marca,
        // no lugar do slate/indigo genérico usado no rascunho inicial dos módulos.
        ink: {
          950: "#01071f", // fundo mais profundo (ex.: overlays, cards internos)
          900: "#071129", // fundo padrão das páginas
          850: "#0a1636", // cards, painéis
          800: "#0f1c40", // bordas/hover de card
          700: "#16214a", // bordas (var(--grid) do painel antigo)
          600: "#253568", // bordas mais claras / baseline
          500: "#4b5670",
          400: "#7783a8", // texto secundário-mudo
          300: "#b7c0dd", // texto secundário
          100: "#e8ecf7",
          50: "#ffffff",
        },
        brand: {
          950: "#02172c",
          900: "#04274d",
          800: "#053a70",
          700: "#064a8c",
          600: "#0464b0", // azul de marca (var(--series-1) do painel antigo)
          500: "#1f7ecb",
          400: "#4a9ade",
          300: "#7fb8e8",
          200: "#b7d7f2",
          100: "#e0eefa",
        },
      },
    },
  },
  plugins: [],
};
