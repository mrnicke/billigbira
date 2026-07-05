import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://mrnicke.github.io",
  base: "/billigbira",
  integrations: [react()],
  output: "static",
});
