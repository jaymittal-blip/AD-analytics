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
        "background":                "#131313",
        "surface":                   "#131313",
        "surface-dim":               "#131313",
        "surface-bright":            "#3a3939",
        "surface-container-lowest":  "#0e0e0e",
        "surface-container-low":     "#1c1b1b",
        "surface-container":         "#201f1f",
        "surface-container-high":    "#2a2a2a",
        "surface-container-highest": "#353534",
        "surface-variant":           "#353534",
        "on-surface":                "#e5e2e1",
        "on-surface-variant":        "#e4beba",
        "on-background":             "#e5e2e1",
        "primary":                   "#ffb3ad",
        "primary-container":         "#ff5451",
        "on-primary":                "#68000a",
        "on-primary-container":      "#5c0008",
        "secondary":                 "#4ae176",
        "secondary-container":       "#00b954",
        "on-secondary":              "#003915",
        "on-secondary-container":    "#004119",
        "tertiary":                  "#adc6ff",
        "tertiary-container":        "#4d8eff",
        "on-tertiary":               "#002e6a",
        "on-tertiary-container":     "#00285d",
        "error":                     "#ffb4ab",
        "error-container":           "#93000a",
        "on-error":                  "#690005",
        "on-error-container":        "#ffdad6",
        "outline":                   "#ab8986",
        "outline-variant":           "#5b403e",
        "inverse-surface":           "#e5e2e1",
        "inverse-on-surface":        "#313030",
        // Legacy dash-* aliases
        dash: {
          bg:     "#131313",
          surface:"#1A1A1A",
          raised: "#201f1f",
          border: "#262626",
          text:   "#e5e2e1",
          muted:  "#e4beba",
          kill:   "#ff5451",
          scale:  "#4ae176",
          watch:  "#adc6ff",
          test:   "#ffa502",
          ended:  "#57606f",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
