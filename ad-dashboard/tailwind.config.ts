import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dash: {
          bg:     "#0d0d14",
          surface:"#16161f",
          raised: "#1d1d2b",
          border: "#252535",
          text:   "#dde1f0",
          muted:  "#6b6f85",
          kill:   "#ff4757",
          scale:  "#2ed573",
          watch:  "#1e90ff",
          test:   "#ffa502",
          ended:  "#57606f",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
