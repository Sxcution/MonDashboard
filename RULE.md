# MonDashboard Development Rules

## 1. Project Identity

MonDashboard is a private Flask + SQLite internal productivity/dashboard app. It is a black-gray premium command workspace, not a SaaS landing page, not ecommerce, and not neon cyberpunk.

Frontend source of truth is:

- `frontend/src/**/*.ts`
- `app/static/css/**/*.css`
- `app/templates/**/*.html`
- `app/**/*.py`

Do not edit `app/static/dist/*.bundle.js` directly when a TypeScript source exists. Preserve existing routes, IDs, JS hooks, Bootstrap 5 modals, context menus, API behavior, and backend logic unless the user explicitly asks for behavior changes.

## 2. Global Design System

Use these tokens as the source of truth:

```css
:root {
    --md-bg: #050608;
    --md-bg-soft: #090b0f;
    --md-header: #050608;
    --md-surface: #11141a;
    --md-surface-2: #18181b;
    --md-card: #141416;
    --md-panel: #141416;
    --md-border: rgba(255,255,255,.10);
    --md-border-strong: rgba(255,255,255,.18);
    --md-text: #f5f5f5;
    --md-text-soft: #d4d4d8;
    --md-muted: #9ca3af;
    --md-muted-2: #71717a;
    --md-success: #22c55e;
    --md-warning: #f59e0b;
    --md-danger: #ef4444;
    --md-info: #38bdf8;
    --md-wechat: #07c160;
    --md-blue: #1677ff;
    --md-radius-sm: 8px;
    --md-radius-md: 12px;
    --md-radius-lg: 16px;
    --md-shadow-soft: 0 12px 32px rgba(0,0,0,.28);
    --md-shadow-panel: 0 18px 48px rgba(0,0,0,.38);
}
```

## 3. Color Rules

- Header/navbar must be black.
- Page background must be black.
- Panel and card surfaces must use `#141416`.
- Borders must use `rgba(255,255,255,.10)` or `rgba(255,255,255,.18)`.
- Text must be white or soft gray.
- Muted text must be gray.
- Accent colors are allowed only for icons, status badges, action buttons, and WeChat account state borders.
- Do not recolor the whole app into blue/green/cyan.
- Do not make every component pure gray with no status colors.
- Do not remove colored WeChat account state borders.

## 4. Shared Components

Future UI work should reuse these structures instead of inventing new surfaces:

```css
.md-panel {
    background: var(--md-panel);
    border: 1px solid var(--md-border);
    border-radius: var(--md-radius-md);
    box-shadow: var(--md-shadow-panel);
    color: var(--md-text);
}

.md-card {
    background: var(--md-card);
    border: 1px solid var(--md-border);
    border-radius: var(--md-radius-sm);
    box-shadow: var(--md-shadow-soft);
    color: var(--md-text);
}

.md-btn {
    border: 1px solid var(--md-border);
    border-radius: var(--md-radius-sm);
    background: var(--md-surface-2);
    color: var(--md-text);
}

.md-btn-primary {
    border-color: rgba(56,189,248,.38);
    background: rgba(56,189,248,.16);
    color: #e0f2fe;
}

.md-btn-danger {
    border-color: rgba(239,68,68,.45);
    background: rgba(239,68,68,.16);
    color: #fecaca;
}

.md-input {
    border: 1px solid var(--md-border);
    border-radius: var(--md-radius-sm);
    background: var(--md-bg-soft);
    color: var(--md-text);
}

.md-section-title {
    color: var(--md-text);
    font-weight: 800;
}

.md-section-subtitle {
    color: var(--md-muted);
}

.md-modal .modal-content {
    background: var(--md-panel);
    border: 1px solid var(--md-border);
    border-radius: var(--md-radius-md);
    color: var(--md-text);
}
```

## 5. Modal Rules

- Never use `alert()`.
- Never use `confirm()`.
- Never use `prompt()`.
- All delete, reset, rename, input, edit, warning, and confirmation flows must use Bootstrap 5 modal.
- All modals must use the MonDashboard black-gray modal style.
- Danger color is only for destructive buttons or small warning icons.
- Do not use Bootstrap bright modal headers such as `bg-danger text-white`.
- Do not create random modal styles per feature.

## 6. Panel And Card Rules

- All new panels/cards must use `#141416`.
- Use soft borders.
- Use consistent radius.
- Use controlled accent icons.
- Do not use random bright panels.
- Do not use full neon gradients as the main theme.

## 7. MXH / WeChat Card Rules

- MXH account cards must use `#141416` background.
- Keep existing render logic and account rules.
- Preserve `borderClass` logic from `getAccountBorderClass()`.
- WeChat state borders must remain visible:
  - green for qualified HK/active state where existing logic says green
  - blue for Nearby People active
  - yellow for unverified
  - white for old non-HK when existing logic says white
  - red/orange if existing logic uses warning/dead/due states
- Do not flatten WeChat cards into all-gray cards.
- Colored borders/glow must be visible but not excessive.

## 8. Notes And Telegram Rules

- Notes and Telegram must follow the same black-gray plus controlled accent design system.
- Existing functionality must not be rewritten.
- Replace old Bootstrap bright defaults gradually with shared MonDashboard classes.
- Do not break existing modals, context menus, editor behavior, Telegram task flow, or session management.

## 9. Build And Test Rules

- For TypeScript changes, run `npm run check:ts` and `npm run build`.
- For Python changes, run `python -m compileall app`.
- Do not commit runtime/local data such as `data/`, `logs/`, databases, session files, `node_modules/`, or local model/tool binaries.
