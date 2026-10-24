import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === "true" ? "/DJMesrc/" : "/",
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 4173, strictPort: true },
  preview: { port: 4174, strictPort: true },
});
