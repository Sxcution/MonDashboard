# Mon Dashboard

Mon Dashboard là dashboard nội bộ chạy bằng Flask + SQLite, giao diện Bootstrap dark theme, frontend đã được tách khỏi các template lớn sang TypeScript, CSS theo trang và Vite bundles.

## Trạng Thái Hiện Tại

- Backend: Flask app factory trong `app/__init__.py`, route theo từng module trong `app/*_routes.py`.
- Database: SQLite trong thư mục `data/`, được tạo/đảm bảo bởi `app/database.py`.
- Frontend source: TypeScript trong `frontend/src/`.
- CSS source: CSS theo trang trong `app/static/css/`.
- Bundle đang được template load: `app/static/dist/*.bundle.js`.
- Build phụ trợ từ TypeScript: `app/static/js/`.

Các trang chính hiện có:

- Home/chat dashboard
- MXH social account manager
- Notes editor
- Image editor/collage
- Settings
- Telegram sessions/tasks

## Cấu Trúc Chính

```text
app/
  __init__.py              Flask app factory, đăng ký blueprint
  database.py              SQLite schema/init helpers
  *_routes.py              Route/API theo từng mảng
  templates/               Jinja templates, càng mỏng càng tốt
  static/css/              CSS đã tách theo trang
  static/js/               JS emit từ TypeScript
  static/dist/             Vite bundles đang được template load

frontend/
  src/                     TypeScript source of truth
  src/mxh/                 MXH modules
  src/image-editor/        Image editor modules
  src/api/                 API facades/shared HTTP helpers
  vite/                    Entry points cho Vite bundles
  build-pages.mjs          Build tất cả page bundles

data/                      Local database, uploads, generated user data
scripts/                   Dev run scripts
tests/                     Browser smoke tests
```

## Source Of Truth

Khi sửa frontend, ưu tiên sửa ở:

```text
frontend/src/**/*.ts
app/static/css/**/*.css
app/templates/**/*.html
```

Không sửa trực tiếp `app/static/dist/*.bundle.js` nếu thay đổi có source TypeScript tương ứng. Sau khi sửa TypeScript, chạy build để sinh lại JS:

```powershell
npm run build
```

`tsconfig.json` emit classic JS vào `app/static/js/`, sau đó `frontend/build-pages.mjs` dùng Vite để tạo bundle trong `app/static/dist/`.

## MXH

MXH hiện là phần được refactor sâu nhất:

- Source chính: `frontend/src/mxh.ts` và `frontend/src/mxh/*.ts`
- Template: `app/templates/mxh.html`
- CSS: `app/static/css/mxh.css`, `app/static/css/mxh_new_features.css`
- Bundle đang load: `app/static/dist/mxh.bundle.js`

Các phần quan trọng:

- `account-rules.ts`: luật tuổi tài khoản, scan QR, Nearby People, thiếu info, border trạng thái
- `render.ts`: render card, stats panel, nhóm/platform nav
- `filters.ts`: quick filters, search, dim/filter card
- `inline-edit.ts`: sửa nhanh tại chỗ và đồng bộ UI không reload
- `account-actions.ts`: modal, CRUD, status, scan, reset, move account
- `context-menu.ts` và `context-actions.ts`: menu chuột phải

Luồng cập nhật nhanh không reload dựa trên `ctx.mxhAccounts` + các hàm:

- `updateStatsPanels()`
- `updateCardVisibility()`
- `scheduleRender()`
- `requestFullRebuild()` khi cần rebuild DOM card

## Notes

- Source chính: `frontend/src/notes.ts`, `frontend/src/notes/*`
- Template: `app/templates/notes.html`
- CSS: `app/static/css/notes.css`
- Bundle đang load: `app/static/dist/notes.bundle.js`

Notes đã được tách khỏi template lớn, nhưng vẫn giữ Jinja/Bootstrap và API Flask hiện tại.

## Image

- Source chính: `frontend/src/image.ts`, `frontend/src/image-editor/*`
- Template: `app/templates/image.html`
- CSS: `app/static/css/image.css`
- Bundle đang load: `app/static/dist/image.bundle.js`

Image gồm upload, single image viewer, heal/crop/text layer/collage/history.

## Settings Và Telegram

- Settings: `frontend/src/settings.ts`, `app/templates/settings.html`, `app/static/dist/settings.bundle.js`
- Telegram: `frontend/src/telegram.ts`, `app/templates/telegram.html`, `app/static/dist/telegram.bundle.js`

## Cài Đặt

Python:

```powershell
pip install -r requirements.txt
```

Node:

```powershell
npm install
```

## Chạy Dev

Windows:

```powershell
.\scripts\run_dev.ps1
```

Hoặc chạy app trực tiếp:

```powershell
python .\run.pyw
```

Linux/macOS:

```bash
bash scripts/run_dev.sh
```

## Build Và Kiểm Tra

```powershell
npm run check:ts
npm run build
```

Browser smoke test:

```powershell
npm run test:browser
```

Python compile check:

```powershell
python -m compileall app
```

## Quy Ước Dọn Repo

Không commit các file runtime/local:

- `data/`
- `logs/`
- `*.db`
- `__pycache__/`
- `node_modules/`

Các file build `app/static/dist/*.bundle.js` và JS emit trong `app/static/js/` hiện vẫn được giữ trong repo vì Flask template đang load trực tiếp từ static output.

## Ghi Chú Cho Lần Sửa Tiếp Theo

- Nếu UI không cập nhật sau khi sửa state, kiểm tra xem luồng đó đã gọi `updateStatsPanels`, `updateCardVisibility`, `scheduleRender`, hoặc `requestFullRebuild` chưa.
- Nếu thay đổi MXH TypeScript, luôn build lại trước khi test trên browser.
- Nếu sửa CSS/template, thường không cần build JS, chỉ refresh browser.
