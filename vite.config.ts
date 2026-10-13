import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { resolve } from "node:path";
import { electrobunViteAliases } from "./.hutch/devkit/api/config/electrobun-vite.ts";

export default defineConfig({
  plugins: [solid()],
  root: "src/desktop/view",
  base: "./",
  publicDir: resolve(import.meta.dirname, "assets"),
  resolve: { alias: electrobunViteAliases(resolve(import.meta.dirname, ".hutch/devkit")) },
  build: { outDir: "../../../web-dist", emptyOutDir: true, target: "es2022" },
  worker: { format: "es" },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
