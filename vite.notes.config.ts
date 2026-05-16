import { defineConfig } from "vite";

export default defineConfig({
  root: "frontend",
  publicDir: false,
  build: {
    outDir: "../app/static/dist",
    emptyOutDir: false,
    manifest: false,
    rollupOptions: {
      input: {
        notes: "frontend/vite/notes-entry.ts"
      },
      output: {
        format: "iife",
        name: "NotesBundle",
        entryFileNames: "notes.bundle.js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]"
      }
    }
  }
});
