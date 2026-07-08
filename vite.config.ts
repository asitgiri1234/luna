import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              // Modules required at runtime, not bundled: better-sqlite3 is
              // native; pdfjs-dist / mammoth are heavy document parsers that
              // ship their own workers/assets and resolve cleanly from
              // node_modules in the main process.
              external: ["better-sqlite3", /^pdfjs-dist(\/|$)/, "mammoth", /^tesseract\.js(\/|$)/],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, "electron/preload.ts"),
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  // Relative base so the packaged app can load assets from the local filesystem.
  base: "./",
});
