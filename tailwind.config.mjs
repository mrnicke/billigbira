/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211b",
        foam: "#f8f4e8",
        malt: "#f2b84b",
        hop: "#276749",
        copper: "#b45f32",
        night: "#101615"
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
