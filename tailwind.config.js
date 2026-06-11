/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          500: "#1e40af",
          600: "#1e3a8a",
          700: "#172554",
          800: "#0f172a",
          900: "#0a0f1a",
        },
        surface: {
          0: "#ffffff",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
        status: {
          delivered: "#16a34a",
          sending: "#2563eb",
          queued: "#9333ea",
          failed: "#dc2626",
          received: "#0891b2",
        },
      },
    },
  },
  plugins: [],
};
