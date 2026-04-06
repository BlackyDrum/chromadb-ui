import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Default to root for local/Docker builds and let GitHub Pages override the base.
const base = process.env.APP_BASE_PATH ?? "/";

// https://vite.dev/config/
export default defineConfig({
  base: base.endsWith("/") ? base : `${base}/`,
  plugins: [vue()],
});
