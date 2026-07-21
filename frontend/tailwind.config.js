/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        border: "var(--border)",
        text: "var(--text)",
        "text-2": "var(--text-2)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        "accent-soft": "var(--accent-soft)",
        good: "var(--good)",
        "good-soft": "var(--good-soft)",
        warn: "var(--warn)",
        "warn-soft": "var(--warn-soft)",
        critical: "var(--critical)",
        "critical-soft": "var(--critical-soft)",
        blue: "var(--blue)",
        "blue-soft": "var(--blue-soft)",
        "code-bg": "var(--code-bg)",
      },
      borderRadius: {
        stitch: "12px",
      },
      boxShadow: {
        stitch: "var(--shadow)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Roboto",
          "sans-serif",
        ],
        mono: ["SF Mono", "ui-monospace", "Consolas", "Menlo", "monospace"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        pulseDot: {
          "0%, 100%": { boxShadow: "0 0 0 0 color-mix(in srgb, var(--critical) 45%, transparent)" },
          "50%": { boxShadow: "0 0 0 5px transparent" },
        },
        "bar-grow": {
          from: { transform: "scaleY(0)" },
          to: { transform: "scaleY(1)" },
        },
        "draw-spark": {
          from: { strokeDashoffset: "120" },
          to: { strokeDashoffset: "0" },
        },
        spin: { to: { transform: "rotate(360deg)" } },
        float: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(24px, -32px) scale(1.06)" },
        },
        "float-alt": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-28px, 26px) scale(1.08)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out",
        "slide-up": "slide-up 0.35s ease-out",
        "slide-in-left": "slide-in-left 0.4s ease-out",
        "pulse-dot": "pulseDot 1.8s infinite",
        "bar-grow": "bar-grow 0.65s ease-out forwards",
        "draw-spark": "draw-spark 1.1s ease-out forwards",
        spin: "spin 0.8s linear infinite",
        "float-slow": "float 14s ease-in-out infinite",
        "float-slower": "float-alt 19s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
