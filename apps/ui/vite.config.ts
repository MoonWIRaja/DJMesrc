import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import process from "node:process";
import { fileURLToPath } from "node:url";
const host = process.env.TAURI_DEV_HOST;
const srcDir = fileURLToPath(new URL("./src", import.meta.url));
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": srcDir } },
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: host || "127.0.0.1", hmr: host ? { protocol: "ws", host, port: 1421 } : undefined },
  build: { outDir: "../../dist", emptyOutDir: true },
});
