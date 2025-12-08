# GEMINI AGENT RULES - MON DASHBOARD

## I. DEBUGGING PROTOCOL
1. **Interactive/Hardware Debug:**
   - **Action:** Inject print logs into Flask routes or JavaScript console.log.
   - **Execution:** Instruct user to run the app in their current IDE Terminal.
   - **Constraint:** Do NOT ask user to open external cmd.exe unless unavoidable.

2. **Logic/Automated Debug:**
   - **Action:** Create self-contained test scripts (e.g., `test_api.py`).
   - **Execution:** Auto-run these scripts and analyze output yourself.

## II. WORKFLOW & VERIFICATION
3. **Post-Implementation Verification:**
   - **Action:** After ANY code modification, verify syntax and basic functionality.
   - **Constraint:** NEVER ask user to run if you haven't verified it first.

## III. CODING STANDARDS
4. **Naming & Commenting Standards:**
   - **Code Identifiers:** MUST use English, descriptive names (e.g., `btn_save_settings`).
   - **Comments:** MUST be bilingual or Vietnamese for UI elements.
   - **Consistency:** Use snake_case for Python, camelCase for JS.

5. **Naming Registry Protocol:**
   - **Mandatory File:** `naming_registry.json` at project root.
   - **Workflow:** READ first, UPDATE when adding new features.

## IV. ARCHITECTURE & FILE MANAGEMENT
6. **Project Structure Protocol:**
   - **Mandatory File:** `project_structure.md` at project root.
   - **Workflow:** Update when creating/deleting files.

## V. SESSION STARTUP PROTOCOL
7. **Context Loading:**
   - At session start, READ `project_structure.md` and `naming_registry.json`.

## VI. UI & STYLING PROTOCOL (WEB)
8. **Centralized Styling:**
   - ALL CSS must reside in `static/css/` folder.
   - Use Bootstrap 5 as primary framework.
   - Avoid inline styles in HTML/Jinja templates.

9. **Input Field Standards:**
   - **No Spinners:** Hide via CSS: `input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }`

10. **Notification & Dialog Standards:**
    - **Custom Modals Only:** Use Bootstrap Modal for critical actions.
    - **No Native Alerts:** NEVER use `alert()`, `confirm()`, `prompt()`.

## VII. FLASK-SPECIFIC PROTOCOL
11. **Route Organization:**
    - Group routes by feature in blueprints under `app/routes/`.
    - API routes MUST return JSON with consistent format: `{"success": bool, "data": {...}}`.

12. **Template Standards:**
    - Base template: `app/templates/base.html`
    - Use Jinja2 macros for reusable components.

13. **Database:**
    - Use SQLite with SQLAlchemy ORM.
    - Models in `app/models/`.

## VIII. AI REVIEW PACKAGING
14. **Automatic Packaging:**
    - **Trigger:** "đóng gói file .zip"
    - **Output:** `AI_Review/{FeatureName}_{YYYYMMDD}.zip`
    - **Include:** .py, .html, .css, .js, .json, .md files
    - **Exclude:** node_modules, __pycache__, .db files, venv

## IX. RULE COMMAND PROTOCOL
15. **Rule Trigger Command:**
    - **Trigger:** When user says "Rule", "/Rule", or "đọc Rule"
    - **Immediate Action:** 
      1. READ and ACKNOWLEDGE this `Rule.md` file
      2. READ `project_structure.md` to understand current architecture
      3. READ `naming_registry.json` to load existing variable names
    - **Compliance:** STRICTLY follow all rules for the entire session

16. **Post-Coding Documentation Update:**
    - **Trigger:** After completing ANY coding task that adds new features/elements
    - **Mandatory Updates:**
      1. `project_structure.md`: Add new files, update descriptions
      2. `naming_registry.json`: Add new IDs, button names, variables
    - **Goal:** Keep documentation in sync with codebase
