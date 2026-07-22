/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        navy: {
          50: "#eef1f8",
          100: "#d7ddef",
          200: "#aab6dc",
          300: "#7d90c9",
          400: "#4a5da3",
          500: "#1f2f7a",
          600: "#152363",
          700: "#0f1a4d",
          800: "#0a1238",
          900: "#001E62",
          950: "#040a24",
        },
        brand: {
          yellow: "#FFC900",
          "yellow-dark": "#E5B500",
        },
        priority: {
          kritik: "#E4002B",
          yuksek: "#FF6900",
          orta: "#F5A623",
          dusuk: "#5B7A6B",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#F7F8FB",
          muted: "#EEF0F5",
        },
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 26, 77, 0.04), 0 4px 16px rgba(15, 26, 77, 0.06)",
        elevated: "0 4px 12px rgba(15, 26, 77, 0.08), 0 12px 32px rgba(15, 26, 77, 0.1)",
        glow: "0 0 0 3px rgba(255, 201, 0, 0.35)",
      },
      keyframes: {
        "fade-in": { "0%": { opacity: 0, transform: "translateY(4px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        "scale-in": { "0%": { opacity: 0, transform: "scale(0.96)" }, "100%": { opacity: 1, transform: "scale(1)" } },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
