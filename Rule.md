# MON DASHBOARD AGENT RULES

Updated: 2026-05-21

## 1. Session Startup

When the user says `Rule`, `/Rule`, or asks to read project rules:

1. Read `Rule.md`.
2. Read `project_structure.md`.
3. Read `naming_registry.json`.
4. Follow these rules for the rest of the session unless the user gives a newer direct instruction.

## 2. Required Project Documents

The following files are project control documents and must stay at the repository root:

- `Rule.md`: agent workflow, coding, verification, and documentation rules.
- `project_structure.md`: current architecture and file ownership map.
- `naming_registry.json`: UI IDs, route names, storage keys, commands, and important identifiers.

After any task that adds, removes, renames, or meaningfully changes a feature, file, route, UI ID, storage key, or generated bundle:

1. Update `project_structure.md` when the architecture or file map changes.
2. Update `naming_registry.json` when identifiers, IDs, routes, storage keys, or public functions change.
3. Update `README.md` only when user-facing setup, build, or feature documentation changes.

## 3. Current Architecture

Mon Dashboard is a Flask + SQLite dashboard with Bootstrap UI and TypeScript frontend source.

- Flask app factory: `app/__init__.py`.
- Root page routes: `app/routes.py`.
- Feature blueprints: `app/*_routes.py` and `app/mxh_api.py`.
- Database helper and migrations: `app/database.py`.
- Base template: `app/templates/layouts/base.html`.
- Shared navbar: `app/templates/partials/navbar.html`.
- Page templates: `app/templates/*.html`.
- CSS source: `app/static/css/*.css`.
- TypeScript source of truth: `frontend/src/**/*.ts`.
- Vite page entries: `frontend/vite/*-entry.ts`.
- Classic JS emit: `app/static/js/`.
- Vite bundles loaded by templates: `app/static/dist/*.bundle.js`.
- Runtime data and SQLite DB: `data/`.

The project does not currently use `app/routes/` folders or SQLAlchemy model classes in `app/models/`; do not invent those paths unless the user asks for a refactor.

## 4. Editing Rules

- Prefer editing source files over generated files.
- For TypeScript behavior, edit `frontend/src/**/*.ts`, then run `npm run build`.
- Do not manually edit `app/static/dist/*.bundle.js` when a TypeScript source exists.
- Do not manually edit `app/static/js/**/*.js` when it is emitted from TypeScript, except for confirming generated output after build.
- Keep CSS in `app/static/css/`; avoid new inline styles in templates.
- Use Bootstrap Modal for critical confirmations.
- Do not use native `alert()`, `confirm()`, or `prompt()`.
- Do not revert unrelated user changes in the worktree.

## 5. Naming Standards

- Python identifiers: `snake_case`.
- TypeScript/JavaScript identifiers: `camelCase`.
- CSS classes and HTML IDs: descriptive kebab-case unless the existing file already uses another convention.
- Code identifiers should be English.
- User-facing Vietnamese text should be clear and consistent with the existing UI.
- Register important IDs, route names, localStorage/sessionStorage keys, generated bundle names, and public global functions in `naming_registry.json`.

## 6. UI Standards

- Dashboard uses Bootstrap 5 dark theme.
- Critical actions use compact Bootstrap modals.
- Toasts use the global toast system unless a feature already has a local equivalent.
- No browser-native confirmation dialogs.
- Avoid adding new visual modes that leave dead code behind. If a feature is removed, remove its code path, CSS, registry entry, and docs.
- Before palette cleanup, use `color_inventory.md` as the current color audit baseline.

## 7. Verification

After code changes, verify with the smallest useful set:

```powershell
npm run check:ts
npm run build
python -m compileall app
```

When frontend behavior changes and the Flask server is running, also run:

```powershell
npm run test:browser
```

For JSON changes:

```powershell
python -m json.tool naming_registry.json
```

## 8. Data Safety

- Do not delete or modify user runtime data in `data/` unless explicitly requested.
- Do not commit or package `node_modules/`, `__pycache__/`, DB files, logs, or uploaded runtime data.
- When creating temporary test data through APIs, clean it up through the matching API when possible.

## 9. AI Review Packaging

If the user asks to package files for AI review:

- Output folder: `AI_Review/{FeatureName}_{YYYYMMDD}.zip`.
- Include relevant `.py`, `.html`, `.css`, `.js`, `.ts`, `.json`, and `.md` files.
- Exclude `node_modules`, `__pycache__`, DB files, virtualenvs, logs, and runtime user data.

## 10. Priority

If `.agent/rules/` exists, follow it as supporting engineering guidance. If it conflicts with this file or the user's current instruction, this `Rule.md` and the user's current instruction take priority.
