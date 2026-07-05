/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        ink: "#151a17",
        foam: "#f7f3e8",
        paper: "#fffdf7",
        malt: "#f3b33d",
        hop: "#2f6f4e",
        moss: "#dce8d7",
        copper: "#b75f33",
        night: "#111614",
        line: "#ddd4c4"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 18px 45px rgba(16, 22, 21, 0.12)"
      }
    }
  },
  plugins: []
};
