import type { Config } from "tailwindcss";

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
          subtle: "#9A8E80",
        },
        sage: {
          50: "#F1F4ED",
          100: "#DCE3D2",
          300: "#A8B79C",
          500: "#5C7559",
          600: "#4A6048",
          700: "#3A4B39",
        },
        terracotta: {
          500: "#B5654A",
          600: "#9A553D",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.375rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(26, 23, 20, 0.04), 0 2px 8px rgba(26, 23, 20, 0.04)",
        lift: "0 2px 4px rgba(26, 23, 20, 0.06), 0 8px 24px rgba(26, 23, 20, 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
