# MON DASHBOARD - FRONTEND REFACTOR SNAPSHOT

Cập nhật: 2026-05-16

## Phạm vi đã làm

- Không rewrite Flask backend.
- Không đổi API hiện có.
- Không đổi SQLite schema.
- Không đụng dữ liệu trong `data/`.
- Giữ Bootstrap và layout/behavior hiện tại.

## Trạng thái hiện tại

- MXH đã tách khỏi template lớn:
  - `app/templates/mxh.html`
  - `app/static/css/mxh.css`
  - `frontend/src/mxh.ts`
  - `frontend/src/mxh/*.ts`
  - `app/static/dist/mxh.bundle.js`
- Notes đã tách template lớn:
  - `app/templates/notes.html`
  - `app/static/css/notes.css`
  - `frontend/src/notes.ts`
  - `app/static/dist/notes.bundle.js`
- Image, Settings, Telegram, Notes Preview đã tách inline `<style>` và `<script>`:
  - `app/static/css/image.css`
  - `app/static/css/settings.css`
  - `app/static/css/telegram.css`
  - `app/static/css/notespreview.css`
  - `frontend/src/image.ts`
  - `frontend/src/settings.ts`
  - `frontend/src/telegram.ts`
  - `frontend/src/notespreview.ts`
- `base.html` và `partials/navbar.html` đã tách JS dùng chung:
  - `frontend/src/dashboard.ts`
  - `frontend/src/script.ts`
  - `app/static/js/dashboard.js`
  - `app/static/js/script.js`
- Các JS legacy khác đã đưa vào TypeScript source:
  - `frontend/src/app.ts`
  - `frontend/src/chat.ts`
  - `frontend/src/console-mirror.ts`

## TypeScript / Build

- Đã thêm pipeline:
  - `package.json`
  - `package-lock.json`
  - `tsconfig.json`
  - `frontend/build-pages.mjs`
  - `frontend/vite/*-entry.ts`
- Script chính:
  - `npm run build`
  - `npm run build:ts`
  - `npm run check:ts`
  - `npm run test:browser`
- MXH dùng Vite bundle:
  - `app/static/dist/mxh.bundle.js`
- Notes dùng Vite bundle:
  - `app/static/dist/notes.bundle.js`
- Các page legacy-compatible còn lại dùng JS sinh từ TypeScript trong `app/static/js/*.js`.

## MXH sau refactor

- Đã tách module: state, api, rules, badges, filters, render, flip-card, context-menu, inline-edit, histories, modal-forms, context-actions, init.
- Đã tách thêm Notice/scan reset khỏi `account-actions.ts`:
  - `frontend/src/mxh/account-notices.ts`
- `account-actions.ts` đã giảm kích thước và đã bỏ `@ts-nocheck`.
- Một số module MXH nhỏ cũng đã bỏ `@ts-nocheck` và qua `tsc`.

## Inline còn lại

- Template chính không còn `<style>`, `<script>` inline lớn, `onclick`, `onchange`, `oninput`, hoặc `style`.
- Vẫn còn một ít HTML string động trong JS legacy có `onclick`/`style` nội bộ, chủ yếu ở Image/app/chat cũ.
- Các file TS lớn như `image.ts`, `notes.ts`, `app.ts`, `chat.ts` vẫn đang ở dạng legacy-compatible, chưa type hóa sâu 100%.

## Kiểm tra đã chạy

- `npm run build`: OK.
- `npm run check:ts`: OK.
- `node --check app/static/js/*.js`: OK.
- `node --check app/static/js/mxh/*.js`: OK.
- `node --check app/static/dist/*.js`: OK.
- `python -m compileall app`: OK.
- Flask `test_client` render smoke các page chính: OK.
- Browser smoke bằng Playwright/Chrome:
  - `/`
  - `/mxh`
  - `/notes`
  - `/image/`
  - `/settings/`
  - `/telegram`
  - Kết quả: 6 passed.

## Việc còn lại nếu muốn siết thật sâu

- Type hóa sâu các file legacy lớn:
  - `frontend/src/notes.ts`
  - `frontend/src/image.ts`
  - `frontend/src/app.ts`
  - `frontend/src/chat.ts`
- Gỡ nốt HTML string động có inline handler/style trong JS cũ.
- Có thể tách sâu tiếp `image.ts` và `notes.ts` theo module nhỏ giống MXH.
