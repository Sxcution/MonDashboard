import { defineConfig } from "vite";

export default defineConfig({
  root: "frontend",
  publicDir: false,
  build: {
    outDir: "../app/static/dist",
    emptyOutDir: false,
    manifest: true,
    rollupOptions: {
      input: {
        mxh: "frontend/vite/mxh-entry.ts"
      },
      output: {
        format: "iife",
        name: "MXHBundle",
        entryFileNames: "mxh.bundle.js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]"
      }
    }
  }
});
