/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,ts,tsx}"],
  theme: {
    extend: {
      animation: {
        "spin-slow": "spin 6s linear infinite",
        "pulse-glow": "pulse-glow 1.8s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: 1, boxShadow: "0 0 0 0 rgba(239,68,68,0.6)" },
          "50%": { opacity: 0.85, boxShadow: "0 0 0 8px rgba(239,68,68,0)" },
        },
      },
    },
  },
  plugins: [],
};
