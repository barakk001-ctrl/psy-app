import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm cream / clinic palette
        cream: {
          50: "#FDFBF7",
          100: "#FAF7F1",
          200: "#F2EDE2",
          300: "#E8E2D5",
          400: "#D4CCB9",
        },
        ink: {
          DEFAULT: "#1A1714",
          soft: "#3A332C",
          muted: "#6B5F52",
          subtle: "#74685A",
        },
        sage: {
          50: "#F1F4ED",
          100: "#DCE3D2",
          300: "#A8B79C",
          500: "#5C7559",
          600: "#4A6048",
          700: "#3A4B39",
        },
        // Soft gold accent (auth brand panel divider)
        gold: {
          200: "#EFE2C4",
          300: "#E3CFA3",
          400: "#D4B97F",
        },
        terracotta: {
          500: "#B5654A",
          600: "#9A553D",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Auth pages on a laptop: sizes that follow the viewport height, so the
      // page fits one screen (the variables are set in globals.css, .auth-shell;
      // the fallbacks are the sizes used everywhere else). Use with lg: only.
      spacing: {
        "auth-pad": "var(--auth-pad, 2rem)",
        "auth-xl": "var(--auth-xl, 2rem)",
        "auth-lg": "var(--auth-lg, 1.5rem)",
        "auth-md": "var(--auth-md, 1rem)",
        "auth-sm": "var(--auth-sm, 0.5rem)",
        "auth-logo": "var(--auth-logo, 2.75rem)",
      },
      borderRadius: {
        DEFAULT: "0.625rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(26, 23, 20, 0.03), 0 4px 16px rgba(26, 23, 20, 0.05)",
        lift: "0 2px 6px rgba(26, 23, 20, 0.05), 0 12px 32px rgba(26, 23, 20, 0.08)",
        glow: "0 2px 8px rgba(92, 117, 89, 0.25), 0 6px 20px rgba(92, 117, 89, 0.2)",
        bar: "0 -1px 2px rgba(26, 23, 20, 0.03), 0 8px 32px rgba(26, 23, 20, 0.12)",
      },
    },
  },
  plugins: [
    // A laptop-width window that is short (auth pages only, see globals.css)
    plugin(({ addVariant }) => {
      addVariant("short", "@media (min-width: 1024px) and (max-height: 839px)");
    }),
  ],
} satisfies Config;
