/** @type {import('tailwindcss').Config} */
function withOpacity(varName) {
  return `rgb(var(${varName}) / <alpha-value>)`;
}

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Tokens semânticos: os valores reais vivem em variáveis CSS
        // (src/index.css), que trocam com data-theme/data-accent — assim
        // toda classe bg-ink-900/text-brand-600 já responde ao tema sem
        // precisar duplicar nada aqui.
        ink: {
          950: withOpacity("--ink-950"),
          900: withOpacity("--ink-900"),
          850: withOpacity("--ink-850"),
          800: withOpacity("--ink-800"),
          700: withOpacity("--ink-700"),
          600: withOpacity("--ink-600"),
          500: withOpacity("--ink-500"),
          400: withOpacity("--ink-400"),
          300: withOpacity("--ink-300"),
          100: withOpacity("--ink-100"),
          50: withOpacity("--ink-50"),
        },
        brand: {
          950: withOpacity("--brand-950"),
          900: withOpacity("--brand-900"),
          800: withOpacity("--brand-800"),
          700: withOpacity("--brand-700"),
          600: withOpacity("--brand-600"),
          500: withOpacity("--brand-500"),
          400: withOpacity("--brand-400"),
          300: withOpacity("--brand-300"),
          200: withOpacity("--brand-200"),
          100: withOpacity("--brand-100"),
        },
      },
    },
  },
  plugins: [],
};
