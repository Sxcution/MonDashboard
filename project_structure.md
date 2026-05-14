# Project Structure: MonDashboard

## Root Directory (`Dashboard/`)
- `.agent/`: ECC performance system (Rules, Workflows, Skills).
- `run.pyw`: Main entry point. Starts Flask server in a daemon thread and system tray icon.
- `dashboard.db`: SQLite database file.
- `requirements.txt`: Python dependencies.

## App Core (`app/`)
- `__init__.py`: Flask app factory (`create_app`).
- `database.py`: Database connection and initialization logic.
- `chatbot_tools.py`: Definitions of tools available to the AI (Notes, MXH, Telegram).

## Routes (`app/`)
- `routes.py`: Main/Index routes.
- `chatbot_routes.py`: API endpoints for Chatbot (`/api/chat`), history, and settings.
- `mxh_routes.py`: Routes for Social Media management (Facebook, TikTok, WeChat). Includes account CRUD, reset, status toggling, and stats calculation logic.
- `notes_routes.py`: Routes for Notes management.
- `telegram_routes.py`: Routes for Telegram session management.
- `image_routes.py`: Routes for image processing/OCR.
- `settings_routes.py`: Routes for loading/saving dashboard settings.
- `automatic_routes.py`: Routes for automation tasks.

## Workers (`app/`)
- `telegram_workers.py`: Background workers for Telegram automation.
- `mxh_api.py`: API wrapper for MXH interactions. Provides quick update endpoints for inline editing (username, phone, nickname) and Nearby People management.

## Templates (`app/templates/`)
- `home.html`: Main Dashboard UI (Chat interface).
- `mxh.html`: Social Media management interface. Features: Dropdown Tabs, **Optimized Stats Panels (Smart Filters)**, **Update In-Place Filtering (High Performance)**, Inline Editing (username, phone, email), 3D Flip Cards, **Global View Mode (Card 2/3)**, **Smart Scan Countdown**, **Scan History Logger**, **UnVerify/Verify Success Status**, **Container Type Sub-Accounts (Shelter/Security Folder/Multi User/Clone App)**, **Nearby People Badge & Filter**, **Modern Theme-Consistent Search Bar (Integrated Style)**, **Standardized Action Buttons (.btn-mxh-action)**.
- `notes.html`: Notes management interface.
- `telegram.html`: Telegram management interface.
- `settings.html`: Settings interface.
- `image.html`: Image processing interface.
- `layouts/base.html`: Base HTML template.
- `partials/`: Reusable HTML partials.

## Static Assets (`app/static/`)
- `js/chat.js`: Frontend logic for Chatbot.
- `css/`: Stylesheets.

## Scripts (`scripts/`)
- `run_dev.ps1`: PowerShell script for development run.
- `run_dev.sh`: Shell script for development run.
