---
description: Automatically audit and update project documentation (naming_registry.json & project_structure.md) based on changes in the last 24 hours.
---
// turbo-all

# Documentation Auto-Update Workflow

1. **Identify Modified Files**:
   - Run a command to list files modified in the last **24 hours** (covering long sessions).
   - Filter for relevant extensions: `.py`, `.js`, `.html`, `.css`, `.json`, `.md` (exclude logs/tmp).
   - Example Command: `Get-ChildItem -Recurse -File | Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-24) -and $_.FullName -notmatch '\\.git|__pycache__|env|venv|node_modules' } | Select-Object -ExpandProperty FullName`

2. **Analyze Changes**:
   - Read the content of the identified modified files.
   - Scan for:
     - **New UI elements**: `id="..."` in HTML files.
     - **New Constants/Variables**: Key identifiers in Python/JS.
     - **New Files**: Files present in the list but missing from `project_structure.md`.
     - **Feature Changes**: Significant code additions (e.g., new routes, new API endpoints).

3. **Update `naming_registry.json`**:
   - **Protocol**: Single Source of Truth for IDs/Names.
   - **Action**: Add any missing IDs found in step 2.
   - **Format**: `snake_case_key`: `kebab-case-value` (or matching project convention).
   - **Constraint**: Do not remove existing keys unless sure they are deleted.

4. **Update `project_structure.md`**:
   - **Action**: Add new files to the list.
   - **Action**: Update descriptions for modified files (e.g., "Added WeChat nickname support").

5. **Generate Report**:
   - Output a summary of the update actions:
     - 📂 Files changed (count).
     - 📝 Registry updates (new keys added).
     - 🗺️ Structure updates (files added/descriptions changed).
