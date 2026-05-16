import { build } from "vite";

const pages = [
  { name: "mxh", entry: "frontend/vite/mxh-entry.ts", global: "MXHBundle" },
  { name: "notes", entry: "frontend/vite/notes-entry.ts", global: "NotesBundle" },
  { name: "settings", entry: "frontend/vite/settings-entry.ts", global: "SettingsBundle" },
  { name: "telegram", entry: "frontend/vite/telegram-entry.ts", global: "TelegramBundle" },
  { name: "image", entry: "frontend/vite/image-entry.ts", global: "ImageBundle" }
];

for (const page of pages) {
  await build({
    root: "frontend",
    publicDir: false,
    build: {
      outDir: "../app/static/dist",
      emptyOutDir: false,
      manifest: page.name === "mxh",
      rollupOptions: {
        input: page.entry,
        output: {
          format: "iife",
          name: page.global,
          entryFileNames: `${page.name}.bundle.js`,
          chunkFileNames: "[name].js",
          assetFileNames: "[name][extname]"
        }
      }
    }
  });
}
