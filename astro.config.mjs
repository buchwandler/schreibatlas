import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://schreibatlas.de",
  base: process.env.SITE_BASE_PATH ?? "",
});
