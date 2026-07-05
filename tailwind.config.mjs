/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        ink: "#121614",
        foam: "#f7f0df",
        paper: "#fffaf0",
        malt: "#f2b84b",
        hop: "#49a078",
        moss: "#dcead8",
        copper: "#cc6f3d",
        night: "#0d1110",
        line: "#2a302d",
        glass: "rgba(247, 240, 223, 0.1)",
        lager: "#ffe1a1"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 18px 45px rgba(4, 7, 6, 0.26)",
        app: "0 24px 70px rgba(4, 7, 6, 0.42)"
      }
    }
  },
  plugins: []
};
