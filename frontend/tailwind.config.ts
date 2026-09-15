import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#10243A", 2: "#1B3A58", 3: "#274B6E" },
        river: { DEFAULT: "#1D6FA5", light: "#3B8ECB", soft: "#D9EAF6" },
        wash: "#EAF2F8", canvas: "#F4F7FA",
        slate: { DEFAULT: "#4A5B6B", light: "#7A8A99" },
        ok: "#0F8B6E", warn: "#C77A14", bad: "#B3261E", line: "#DCE5EE",
      },
      fontFamily: { sans: ["'Manrope Variable'", "system-ui", "sans-serif"] },
      boxShadow: { card: "0 1px 2px rgba(16,36,58,.06), 0 0 0 1px rgba(16,36,58,.05)" },
    },
  },
  plugins: [],
};
export default config;
