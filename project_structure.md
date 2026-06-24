# Mon Dashboard Project Structure

Updated: 2026-06-17 (Implemented client-side Mesh Warp / Liquify Push Tool in Image tab, made collage control buttons/panel layout more compact, implemented slideable teardrop gradient stops, and fixed border gradient intersections to be seamless across cells)

## Overview

Mon Dashboard is a local Flask + SQLite dashboard with Bootstrap dark UI and TypeScript frontend modules bundled by Vite.

The current main areas are:

- Home / AI chat shell
- Notes
- MXH
- Image editor
- Telegram
- Settings

## Root Files

| Path | Purpose |
| --- | --- |
| `README.md` | User-facing setup, feature, build, and test overview. |
| `Rule.md` | Agent rules and project workflow contract. |
| `project_structure.md` | Current architecture and file ownership map. |
| `naming_registry.json` | Registry of important UI IDs, routes, storage keys, commands, and generated artifacts. |
| `color_inventory.md` | Current custom color audit for palette cleanup. |
| `AI.md` | Frontend refactor status notes. |
| `run.pyw` | Windows tray/runtime launcher. |
| `requirements.txt` | Core Python dependencies. |
| `requirements-ai.txt` | Optional AI/image-processing dependencies. |
| `package.json` | Node build/test scripts and frontend dev dependencies. |
| `tsconfig.json` | TypeScript compiler config. |
| `vite.config.ts` | Legacy single-entry Vite config; multi-page build uses `frontend/build-pages.mjs`. |

## Backend

| Path | Purpose |
| --- | --- |
| `app/__init__.py` | Flask app factory, app config, DB initialization, blueprint registration. |
| `app/routes.py` | Root page routes for `/`, `/notes`, and `/telegram`. |
| `app/database.py` | SQLite connection, schema initialization, and migration helpers. |
| `app/chatbot_routes.py` | AI chat API under `/api/chat`. |
| `app/chatbot_tools.py` | AI context/tool helpers. |
| `app/notes_routes.py` | Notes API under `/notes/api/*`, sounds, and uploaded note images. |
| `app/mxh_routes.py` | MXH page and main MXH API routes under `/mxh`. |
| `app/mxh_api.py` | Additional MXH API routes under `/mxh/api`. |
| `app/image_routes.py` | Image page, image API routes under `/image`, and Gemini Watermark Remover integration. |
| `app/telegram_routes.py` | Telegram API routes under `/telegram/api`. |
| `app/telegram_workers.py` | Telegram task worker helpers. |
| `app/automatic_routes.py` | Automatic seeding API under `/automatic/api`. |
| `app/settings_routes.py` | Settings page and settings/system API under `/settings`. |

## Templates

| Path | Purpose |
| --- | --- |
| `app/templates/layouts/base.html` | Shared HTML shell, Bootstrap/CDN assets, global toast, global confirm/alert modals. |
| `app/templates/partials/navbar.html` | Dashboard tab navbar and hamburger menu. |
| `app/templates/home.html` | Home/search shell. |
| `app/templates/notes.html` | Notes UI, context menus, modals, and Notes bundle include. |
| `app/templates/mxh.html` | MXH management UI, modals, and MXH bundle include. |
| `app/templates/image.html` | Image editor/collage UI, controls, color/font menus, and Image bundle include. |
| `app/templates/telegram.html` | Telegram task/session UI and Telegram bundle include. |
| `app/templates/settings.html` | Settings UI and Settings bundle include. |
| `app/templates/notespreview.html` | Notes preview test page. |

## Static CSS

| Path | Purpose |
| --- | --- |
| `app/static/css/style.css` | Global base styles and shared UI helpers. |
| `app/static/css/chat.css` | Home/chat related styles. |
| `app/static/css/dashboard.css` | Dashboard shell, navbar, tab cache, global menus. |
| `app/static/css/notes.css` | Notes list/detail/editor/profile/image/context-menu styles. |
| `app/static/css/mxh.css` | MXH page styles. |
| `app/static/css/mxh_new_features.css` | Additional MXH feature styles. |
| `app/static/css/image.css` | Image editor/collage/upscale styles. |
| `app/static/css/telegram.css` | Telegram page styles. |
| `app/static/css/settings.css` | Settings page styles. |
| `app/static/css/home.css` | Home page styles. |
| `app/static/css/notespreview.css` | Notes preview styles. |

## Frontend Source Of Truth

| Path | Purpose |
| --- | --- |
| `frontend/src/app.ts` | Compatibility marker for older app entry behavior. |
| `frontend/src/chat.ts` | Chat UI and AI settings behavior. |
| `frontend/src/dashboard.ts` | Dashboard tab cache, nav, global menus, theme color, global modals. |
| `frontend/src/script.ts` | Shared browser helpers and global toast behavior. |
| `frontend/src/notes.ts` | Notes UI, autosave, context menus, profile chips, split view, delete modal. |
| `frontend/src/notes/media.ts` | Notes image compression and thumbnail helpers. |
| `frontend/src/mxh.ts` | MXH bootstrap/coordination. |
| `frontend/src/mxh/*.ts` | MXH modules: API, state, render, filters, context actions, account actions, badges, rules, notices, scan/phone history. |
| `frontend/src/image.ts` | Image editor bootstrap. |
| `frontend/src/image-editor/*.ts` | Image upload, canvas, collage, crop, heal, history, text layers, storage, navigation, warp tool. |
| `frontend/src/telegram.ts` | Telegram page behavior and task polling. |
| `frontend/src/settings.ts` | Settings page behavior. |
| `frontend/src/api/*.ts` | Shared and feature API facades. |
| `frontend/src/types/*.d.ts` | Shared global type declarations. |
| `frontend/vite/*-entry.ts` | Vite entry points for page bundles. |
| `frontend/build-pages.mjs` | Builds all page bundles into `app/static/dist`. |

## Generated Static Output

| Path | Purpose |
| --- | --- |
| `app/static/js/` | JavaScript emitted by `tsc` from `frontend/src`. Do not hand-edit when a TypeScript source exists. |
| `app/static/dist/*.bundle.js` | Vite IIFE bundles loaded by Flask templates. Generated by `npm run build`. |
| `app/static/dist/.vite/manifest.json` | Vite manifest output. |

## Runtime Data

| Path | Purpose |
| --- | --- |
| `data/Data.db` | SQLite database. Runtime data, not source. |
| `data/uploaded_sessions/` | Telegram uploaded sessions. Runtime data. |
| `data/notes_images/` | Uploaded Notes images. Runtime data. |
| `data/collage_history/` and related image data | Image editor generated/runtime data. |
| `tools/upscayl/` | Local Upscayl application payload. Ignored; do not upload to GitHub. |
| `tools/realesrgan-ncnn-vulkan/` | Local RealESRGAN binary/models. Ignored; do not upload to GitHub. |
| `tools/opencv-superres/` | Local OpenCV super-resolution models. Ignored; do not upload to GitHub. |

Do not modify or delete `data/` unless the user explicitly asks.
Do not commit local tool binaries/models; keep them installed locally and ignored by Git.

## Deplao Desktop App

The `Deplao-App-main/Deplao-App-main` directory contains the source code for the standalone Electron desktop multi-account browser app:

| Path | Purpose |
| --- | --- |
| `Deplao-App-main/Deplao-App-main/main.js` | Electron main process, handles session creation, window boundaries, IPC communication, and profile configurations. |
| `Deplao-App-main/Deplao-App-main/renderer.js` | Electron renderer process, controls user interaction, accounts sidebar, and profile modal setup. |
| `Deplao-App-main/Deplao-App-main/preload.js` | Electron preload script, exposes secure APIs to the context. |
| `Deplao-App-main/Deplao-App-main/index.html` | HTML layout for the desktop app sidebar, toolbar, and profile modals. |
| `Deplao-App-main/Deplao-App-main/package.json` | Project scripts (`npm start`, `npm run build`) and dependencies. |

## Tests And Verification

| Command | Purpose |
| --- | --- |
| `npm run check:ts` | TypeScript type check without emit. |
| `npm run build` | TypeScript emit plus Vite bundles. |
| `python -m compileall app` | Python syntax check. |
| `npm run test:browser` | Playwright smoke test for `/`, `/mxh`, `/notes`, `/image/`, `/settings/`, `/telegram`. Requires Flask server. |

## Important Notes

- The app currently uses flat route modules in `app/`, not `app/routes/`.
- The app currently uses raw SQLite helpers in `app/database.py`, not SQLAlchemy model files.
- Source edits should normally happen in `frontend/src`, `app/static/css`, `app/templates`, and `app/*.py`.
- Build output in `app/static/js` and `app/static/dist` should be regenerated, not manually maintained.
