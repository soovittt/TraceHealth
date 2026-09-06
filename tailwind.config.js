/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    fontSize: {
      "2xs": ["11px", { lineHeight: "14px", letterSpacing: "0.01em" }],
      xs: ["12px", { lineHeight: "16px" }],
      sm: ["13px", { lineHeight: "18px" }],
      base: ["14px", { lineHeight: "20px" }],
      md: ["15px", { lineHeight: "22px" }],
      lg: ["17px", { lineHeight: "24px", letterSpacing: "-0.01em" }],
      xl: ["20px", { lineHeight: "26px", letterSpacing: "-0.015em" }],
      "2xl": ["24px", { lineHeight: "30px", letterSpacing: "-0.02em" }],
      "3xl": ["30px", { lineHeight: "36px", letterSpacing: "-0.022em" }],
      "4xl": ["38px", { lineHeight: "42px", letterSpacing: "-0.025em" }],
      "5xl": ["50px", { lineHeight: "52px", letterSpacing: "-0.03em" }],
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: {
          DEFAULT: v("ink-900"),
          900: v("ink-900"),
          800: v("ink-800"),
          700: v("ink-700"),
          600: v("ink-600"),
          500: v("ink-500"),
          400: v("ink-400"),
          300: v("ink-300"),
        },
        line: { DEFAULT: v("line"), soft: v("line-soft"), strong: v("line-strong") },
        canvas: v("canvas"),
        surface: v("surface"),
        // Primary chrome (buttons, avatars) — dark-on-light in light, light-on-dark in dark.
        brand: { DEFAULT: v("brand"), fg: v("brand-fg") },
        accent: {
          DEFAULT: v("accent"),
          fg: v("accent"),
          soft: v("accent-soft"),
          line: v("accent-line"),
          hover: v("accent-hover"),
        },
        good: { DEFAULT: v("good"), soft: v("good-soft"), ink: v("good-ink") },
        warn: { DEFAULT: v("warn"), soft: v("warn-soft"), line: v("warn-line") },
        bad: { DEFAULT: v("bad"), soft: v("bad-soft"), ink: v("bad-ink") },
      },
      borderRadius: {
        DEFAULT: "6px",
        md: "7px",
        lg: "9px",
        xl: "11px",
        "2xl": "14px",
      },
      boxShadow: {
        xs: "0 1px 1px rgba(0,0,0,0.04)",
        card: "0 1px 2px rgba(0,0,0,0.04)",
        pop: "0 1px 3px rgba(0,0,0,0.10), 0 12px 32px rgba(0,0,0,0.16)",
      },
      keyframes: {
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        rise: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.18s ease-out both",
        rise: "rise 0.22s cubic-bezier(0.2,0.7,0.2,1) both",
      },
    },
  },
  plugins: [],
};
