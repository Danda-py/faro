import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Grafite caldo: niente blu, niente viola.
        ink: {
          950: "#0e0e0d",
          900: "#131312",
          850: "#181817",
          800: "#1d1c19",
          700: "#262521",
        },
        // Toni neutri caldi usati per testo, bordi e controlli secondari.
        signal: {
          50: "#f5f2ea",
          100: "#ece8de",
          200: "#ddd7c9",
          300: "#c3bcab",
          400: "#9a9486",
          500: "#6d685e",
          600: "#49453d",
        },
        paper: "#f1eee6",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Cascadia Code",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
