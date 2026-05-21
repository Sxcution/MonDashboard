# Mon Dashboard

Mon Dashboard là dashboard nội bộ chạy bằng Flask + SQLite, giao diện Bootstrap dark theme, frontend được tách dần sang TypeScript và bundle bằng Vite. Ứng dụng hiện tập trung vào các khu chính: Home/AI chat, Notes, MXH, Image, Telegram và Settings.

## Trạng Thái Hiện Tại

- Backend: Flask app factory trong `app/__init__.py`, đăng ký blueprint theo từng mảng chức năng.
- Database: SQLite tại `data/Data.db`, khởi tạo và migrate tối thiểu bằng `app/database.py`.
- Runtime data: file cấu hình, session Telegram, ảnh Notes, ảnh collage/history và dữ liệu người dùng nằm trong `data/`.
- Frontend source of truth: TypeScript trong `frontend/src/`, CSS theo trang trong `app/static/css/`, template Jinja trong `app/templates/`.
- Build output: `app/static/js/` là JS emit từ TypeScript; `app/static/dist/*.bundle.js` là bundle Vite đang được template load.

## Cấu Trúc Chính

```text
app/
  __init__.py              Flask app factory, đăng ký blueprint
  database.py              SQLite schema/init/migration helpers
  routes.py                route trang Home, Notes, Telegram
  *_routes.py              route/API theo từng mảng chức năng
  templates/               Jinja templates
  static/css/              CSS theo trang
  static/js/               JS emit từ TypeScript
  static/dist/             Vite bundles template đang load

frontend/
  src/                     TypeScript source of truth
  src/api/                 HTTP/API facades
  src/mxh/                 Module MXH
  src/notes/               Helper media cho Notes
  src/image-editor/        Module Image editor
  vite/                    Entry points cho từng bundle
  build-pages.mjs          Build toàn bộ page bundles

data/                      SQLite DB, uploads, images, settings, generated data
scripts/                   Script chạy dev
tests/                     Playwright browser smoke tests
tools/                     Model/binary helper cho xử lý ảnh
```

## Các Trang Và Tính Năng

### Home / AI Chat

- Template: `app/templates/home.html`
- Source: `frontend/src/app.ts`, `frontend/src/dashboard.ts`, `frontend/src/chat.ts`, `frontend/src/console-mirror.ts`
- API: `app/chatbot_routes.py`, helper tool trong `app/chatbot_tools.py`
- Hỗ trợ chat session, lịch sử hội thoại, cài đặt AI, provider OpenAI/Gemini, gửi ảnh và lấy ngữ cảnh từ Notes, MXH, Telegram.

### Notes

- Template: `app/templates/notes.html`
- Source: `frontend/src/notes.ts`, `frontend/src/notes/media.ts`, `frontend/src/api/notesApi.ts`
- CSS: `app/static/css/notes.css`
- Bundle: `app/static/dist/notes.bundle.js`
- API: `app/notes_routes.py`
- Tính năng chính: danh sách/detail ghi chú, search, đánh dấu, context menu, rich editor, autosave, toast `Đã lưu ghi chú`, profile chip có ID/password/content/ảnh, popover preview, code block, split view, upload/serve ảnh Notes, reminder queue và sound notification.

### MXH

- Template: `app/templates/mxh.html`
- Source: `frontend/src/mxh.ts`, `frontend/src/mxh/*.ts`, `frontend/src/api/mxhApi.ts`
- CSS: `app/static/css/mxh.css`, `app/static/css/mxh_new_features.css`
- Bundle: `app/static/dist/mxh.bundle.js`
- API: `app/mxh_routes.py`, `app/mxh_api.py`
- Tính năng chính: quản lý group/platform/card/account, account chính/phụ, inline edit có toast đã lưu, quick filters/search/stats, context menu, notice đến hạn, scan history, phone history, Nearby People, rule/badge trạng thái, reset/rescue/move account.

### Image

- Template: `app/templates/image.html`
- Source: `frontend/src/image.ts`, `frontend/src/image-editor/*.ts`, `frontend/src/api/imageApi.ts`
- CSS: `app/static/css/image.css`
- Bundle: `app/static/dist/image.bundle.js`
- API: `app/image_routes.py`
- Tính năng chính: upload ảnh, single image viewer, crop, text layer, heal/object remove, collage bằng canvas, collage history, xóa/mở history, upscale ảnh bằng Upscayl nếu có, fallback OpenCV super-resolution hoặc PIL.

### Telegram

- Template: `app/templates/telegram.html`
- Source: `frontend/src/telegram.ts`
- CSS: `app/static/css/telegram.css`
- Bundle: `app/static/dist/telegram.bundle.js`
- API: `app/telegram_routes.py`, worker trong `app/telegram_workers.py`, auto seeding API trong `app/automatic_routes.py`
- Tính năng chính: quản lý nhóm session, upload admin/session `.session`, metadata session, proxy config, global task settings, task configs, chạy/dừng/poll task `check-live`, `joinGroup`, `seedingGroup`, và cài đặt auto seeding.

### Settings

- Template: `app/templates/settings.html`
- Source: `frontend/src/settings.ts`
- CSS: `app/static/css/settings.css`
- Bundle: `app/static/dist/settings.bundle.js`
- API: `app/settings_routes.py`
- Tính năng chính: auto-start Windows, auto-open dashboard, shutdown timer, notification timer, MXH refresh interval.

## Source Of Truth Khi Sửa Code

Ưu tiên sửa ở:

```text
frontend/src/**/*.ts
app/static/css/**/*.css
app/templates/**/*.html
app/**/*.py
```

Không sửa trực tiếp `app/static/dist/*.bundle.js` nếu thay đổi có source TypeScript tương ứng. Sau khi sửa TypeScript, chạy build để sinh lại cả `app/static/js/` và `app/static/dist/`:

```powershell
npm run build
```

`tsconfig.json` emit classic JS vào `app/static/js/`, sau đó `frontend/build-pages.mjs` dùng Vite để tạo bundle theo trang trong `app/static/dist/`.

## Cài Đặt

Python:

```powershell
pip install -r requirements.txt
```

Các tính năng AI/xử lý ảnh nâng cao có dependency riêng:

```powershell
pip install -r requirements-ai.txt
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

Hoặc chạy app có system tray:

```powershell
python .\run.pyw
```

Linux/macOS:

```bash
bash scripts/run_dev.sh
```

Mặc định app chạy tại:

```text
http://127.0.0.1:5000
```

## Build Và Kiểm Tra

```powershell
npm run check:ts
npm run build
python -m compileall app
```

Browser smoke test cần Flask server đang chạy:

```powershell
npm run test:browser
```

## Quy Ước Repo

Không commit dữ liệu runtime/local:

- `data/`
- `logs/`
- `*.db`
- `__pycache__/`
- `node_modules/`

Hiện repo vẫn giữ `app/static/js/` và `app/static/dist/*.bundle.js` vì template Flask đang load trực tiếp các output này.

## Ghi Chú Cho Lần Sửa Tiếp Theo

- Khi sửa TypeScript, chạy `npm run build` trước khi test browser.
- Khi sửa CSS/template, thường chỉ cần refresh browser, trừ khi có thay đổi TypeScript đi kèm.
- MXH cập nhật UI không reload dựa nhiều vào `ctx.mxhAccounts`, `updateStatsPanels()`, `updateCardVisibility()`, `scheduleRender()` và `requestFullRebuild()`.
- Notes có autosave theo hàng đợi trong `frontend/src/notes.ts`; nếu đổi luồng lưu, kiểm tra cả blur, input debounce, chuyển note, pagehide/beforeunload và lifecycle pause/resume.
- Image object remove/upscale phụ thuộc dependency hoặc binary/model có sẵn; route có fallback nhưng vẫn nên test với ảnh thật khi chỉnh phần này.
