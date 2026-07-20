import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    imageService: "compile",
  }),
  session: {
    driver: {
      entrypoint: new URL("./src/lib/astro/disabled-session-driver.ts", import.meta.url),
    },
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
