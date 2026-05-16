# Frontend TypeScript Source

This folder is the source of truth for the refactored MXH frontend.

Build commands:

```bash
npm run build
npm run build:mxh
npm run check:mxh
npm run vite:build
```

`npm run build:mxh` emits browser-ready classic scripts into:

```text
app/static/js/
```

`npm run vite:build` emits the bundled script used by `app/templates/mxh.html`:

```text
app/static/dist/mxh.bundle.js
```

Flask still serves normal static files. No backend route changes are required.
