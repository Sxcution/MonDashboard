# MXH Dashboard Rendering Issue Report

## Problem Description
The user is experiencing persistent issues where UI updates for the **MXH (Social Media) Dashboard** do not reflect immediately on the frontend after an action is performed. A page reload is consistently required to see changes.

Specifically:
1.  **Notice Updates:** Setting or Clearing a "Notice" (Thông báo) for a card works on the backend, but the card's UI (badge/text) does not update to show/hide the notice until the page is reloaded.
2.  **Status Updates:** Changing an account's status (e.g., to "Die" or "Active") via the UI does not immediately reflect the visual change (e.g., status icon, dimming) until a reload.
3.  **Cancel Notice Notification:** Canceling a notice was triggering a Windows system notification, which has been removed, but the UI update issue persists.

## Current Attempts
- Attempted to use `setCardState(cardId, { activeAccountId: ... })` to force a re-render of the specific card after `submitNotice` and `clearNotice`.
- Attempted to call `scheduleRender()` immediately after state updates.
- Verified that `showPlatformNotification` was removed from the cancel logic to stop unwanted alerts.

## Included Files
The attached `MXH_Fix_20260103.zip` contains the following codebase files for review:

1.  **`app/templates/mxh.html`**: The main frontend template containing the `renderMXHAccounts`, `renderCardFace`, `submitNotice`, `clearNotice`, and `setCardState` logic.
2.  **`app/mxh_routes.py`**: The Flask backend routes handling account updates (`PUT /mxh/api/accounts/...`) and notice operations.
3.  **`app/mxh_api.py`**: Helper API functions.
4.  **`naming_registry.json`**: Centralized UI ID registry.
5.  **`project_structure.md`**: Project file structure overview.

## Request for ChatGPT/Reviewer
Please analyze the `mxh.html` rendering logic (specifically `renderMXHAccounts` and the update functions) to identify why the local DOM is not updating effectively without a reload.
- Check if `mxhAccounts` array is correctly mutated locally before `scheduleRender()` is called.
- Check if `setCardState` is correctly triggering the re-render of the specific card face.
- Provide a solution to ensure **instant UI updates** for Notice and Status changes without requiring a page refresh.
