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
        // Little Joys warm organic palette
        "background":                "#F0EDE4",
        "surface":                   "#FAFAF7",
        "surface-dim":               "#EDE9DF",
        "surface-bright":            "#FFFFFF",
        "surface-container-lowest":  "#FFFFFF",
        "surface-container-low":     "#F7F4EE",
        "surface-container":         "#EDE9DF",
        "surface-container-high":    "#E4DFCF",
        "surface-container-highest": "#D8D3C5",
        "surface-variant":           "#E0DBD0",
        "on-surface":                "#1A2E20",  // dark forest-green text
        "on-surface-variant":        "#5A6E5C",  // muted forest green
        "on-background":             "#1A2E20",

        "primary":                   "#2D4032",  // dark forest green (icon color)
        "primary-container":         "#4A6B50",  // medium green
        "on-primary":                "#FFFFFF",
        "on-primary-container":      "#FFFFFF",

        "secondary":                 "#3D7A52",  // scale / success green
        "secondary-container":       "#C8E6D4",
        "on-secondary":              "#FFFFFF",
        "on-secondary-container":    "#1C3D2A",

        "tertiary":                  "#B87830",  // amber / monitor
        "tertiary-container":        "#F5E0B8",
        "on-tertiary":               "#FFFFFF",
        "on-tertiary-container":     "#4A2E00",

        "error":                     "#C0503A",  // terracotta / kill
        "error-container":           "#F5CFC7",
        "on-error":                  "#FFFFFF",
        "on-error-container":        "#3D0A00",

        "outline":                   "#A09888",
        "outline-variant":           "#D4CEC0",
        "inverse-surface":           "#2D2820",
        "inverse-on-surface":        "#F0EDE4",
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        card:  "0 1px 3px rgba(45,64,50,0.06), 0 4px 12px rgba(45,64,50,0.06)",
        float: "0 4px 20px rgba(45,64,50,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
