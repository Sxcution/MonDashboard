# MonDashboard - Tien Do Refactor Frontend

Cap nhat: 2026-05-18

## Nguyen Tac

- Khong rewrite Flask backend.
- Khong doi API hien co: `/notes/api/*`, `/mxh/api/*`, `/image/api/*`.
- Khong doi SQLite schema, khong dung thu muc `data/`.
- Khong dung React; giu Bootstrap, Flask/Jinja routing va UI/UX hien tai.

## Da Hoan Thanh

- MXH da tach template lon, co Vite bundle va nhieu module TS rieng.
- Notes da tach template lon, co `notes.css`, `notes.bundle.js`, API facade va media helper typed.
- Image da tach template lon, co `image.css`, API facade, storage helper va cac module Image rieng.
- Settings, Telegram, Notes Preview da tach inline style/script co ban.
- Home/dashboard da tach CSS/JS page-specific co ban.
- Da co shared API/types trong `frontend/src/api/` va `frontend/src/types/`.
- Khong con file TypeScript nao trong `frontend/src` dung `@ts-nocheck`.

## TypeScript

- `frontend/src/notes.ts` da go `@ts-nocheck` va pass `npm run check:ts`.
- `frontend/src/app.ts` da rut ve compatibility marker vi `app.js` khong con duoc template/Python nao load.
- Cac module Image trong `frontend/src/image-editor/` da go `@ts-nocheck`.
- `frontend/src/types/notes.d.ts` da bo sung type cho Notes global state/actions.

## CSS

- `app/static/css/style.css` da giam tu khoang 31KB xuong khoang 7.5KB.
- Da tach them:
  - `app/static/css/chat.css`
  - `app/static/css/dashboard.css`
- Base load CSS theo thu tu cascade: `style.css` -> `chat.css` -> `dashboard.css` -> page CSS.
- Da sua mot cum CSS chat bi long sai cu phap sau khi tach file.

## Kiem Tra Gan Nhat

- `npm run build`: OK.
- `npm run check:ts`: OK.
- `node --check app/static/js/*.js` va `app/static/dist/*.js`: OK.
- `python -m compileall app`: OK.
- `git diff --check`: OK, chi con warning CRLF cua Windows.
- `npm run test:browser`: OK, 6 page smoke passed (`/`, `/mxh`, `/notes`, `/image/`, `/settings/`, `/telegram`).

## Trang Thai

- Frontend refactor + TypeScript cleanup theo roadmap hien tai da hoan thanh.
- Khong doi backend/API/schema/data.
- Can test tay sau cung cac luong nang: MXH actions, Notes rich editor/profile/image/code preview, Image heal/crop/collage/text layer, Telegram task.
