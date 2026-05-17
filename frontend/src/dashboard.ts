// Dashboard-wide behavior extracted from base.html and partials/navbar.html.

function showAlert(message, title = 'Thong Bao') {
    const textEl = document.getElementById('globalAlertText');
    const titleEl = document.getElementById('globalAlertModalLabel');
    const modalEl = document.getElementById('globalAlertModal');
    if (!textEl || !titleEl || !modalEl) return;

    textEl.textContent = message;
    titleEl.innerHTML = `<i class="bi bi-info-circle me-2 text-info"></i>${title}`;
    new bootstrap.Modal(modalEl).show();
}

function showConfirm(message, title = 'Xac Nhan'): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const textEl = document.getElementById('globalDeleteConfirmText');
        const titleEl = document.getElementById('globalDeleteConfirmModalLabel');
        const modalEl = document.getElementById('globalDeleteConfirmModal');
        const confirmBtn = document.getElementById('globalDeleteConfirmBtn');
        const cancelBtn = document.querySelector('#globalDeleteConfirmModal .btn-secondary');
        if (!textEl || !titleEl || !modalEl || !confirmBtn || !cancelBtn) {
            resolve(false);
            return;
        }

        textEl.textContent = message;
        titleEl.innerHTML = `<i class="bi bi-exclamation-triangle me-2 text-warning"></i>${title}`;

        const modal = new bootstrap.Modal(modalEl);
        const newConfirmBtn = confirmBtn.cloneNode(true) as HTMLElement;
        const newCancelBtn = cancelBtn.cloneNode(true) as HTMLElement;
        confirmBtn.parentNode?.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode?.replaceChild(newCancelBtn, cancelBtn);

        newConfirmBtn.onclick = () => {
            modal.hide();
            resolve(true);
        };

        newCancelBtn.onclick = () => {
            modal.hide();
            resolve(false);
        };

        modal.show();
    });
}

function requestNotificationPermission() {
    if (!("Notification" in window)) {
        alert("Trinh duyet nay khong ho tro thong bao may tinh.");
        return;
    }

    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            showToast("Da cap quyen thong bao thanh cong!", "success");
            new Notification("STool Dashboard", {
                body: "Thong bao da duoc kich hoat!",
                icon: "/static/favicon.ico"
            });
        } else {
            showToast("Quyen thong bao bi tu choi.", "error");
        }
    });
}

function showPlatformNotification(title, body, icon = "/static/favicon.ico") {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
        new Notification(title, { body, icon });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(title, { body, icon });
            }
        });
    }
}

function openThemeColorPrompt() {
    const currentColor = localStorage.getItem('dashboardThemeColor') || '#1a1d21';
    const nextColor = prompt('Nhap ma mau theme dashboard, vi du #1a1d21', currentColor);
    if (nextColor === null) return;

    const normalized = nextColor.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
        showToast('Ma mau khong hop le. Hay nhap dang #1a1d21.', 'error');
        return;
    }

    localStorage.setItem('dashboardThemeColor', normalized);
    document.documentElement.style.setProperty('--dashboard-bg', normalized);
    showToast(`Da doi mau theme: ${normalized}`, 'success');
}

function handleDashboardImageNavClick(event: Event) {
    if (window.location.pathname.startsWith('/image')) {
        event.preventDefault();
        return false;
    }
    return true;
}

function hideAllContextMenus() {
    document.querySelectorAll<HTMLElement>('.custom-context-menu').forEach(menu => {
        menu.style.display = 'none';
    });
}

function showContextMenu(menu: HTMLElement, x: number, y: number) {
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';
}

function initDashboardContextMenu() {
    const dashboardMenu = document.getElementById('dashboard-context-menu');
    if (!dashboardMenu) return;

    dashboardMenu.addEventListener('click', (event) => {
        const action = (event.target as Element | null)?.closest<HTMLElement>('[data-dashboard-action]')?.dataset.dashboardAction;
        if (!action) return;
        event.preventDefault();
        if (action === 'reload') location.reload();
        if (action === 'settings') location.href = '/settings/';
        if (action === 'notifications') requestNotificationPermission();
        hideAllContextMenus();
    });

    document.addEventListener('contextmenu', (event) => {
        const target = event.target as Element | null;
        if (!target?.closest('.tab-pane') && !target?.closest('.custom-context-menu')) {
            event.preventDefault();
            hideAllContextMenus();
            showContextMenu(dashboardMenu, event.clientX, event.clientY);
        }
    });

    document.addEventListener('click', () => {
        hideAllContextMenus();
    });
}

function initDashboardNavbar() {
    const hamburgerMenu = document.getElementById('global-hamburger-menu');
    if (!hamburgerMenu) return;

    const navShell = hamburgerMenu.closest<HTMLElement>('[data-settings-url]');
    const settingsUrl = navShell?.dataset.settingsUrl || '/settings/';
    const menuLink = hamburgerMenu.querySelector<HTMLElement>('.nav-link');
    const dropdownMenu = hamburgerMenu.querySelector<HTMLElement>('.dropdown-menu');
    const dropdownContentUl = document.getElementById('hamburger-dropdown-content');
    if (!menuLink || !dropdownMenu || !dropdownContentUl) return;
    let bsDropdownInstance = null;
    let autoHideTimeout;
    let mouseLeaveTimeout;
    let isMouseOverMenu = false;
    let isMouseOverDropdown = false;

    const getMenuItemsForTab = (tabId) => {
        let items = `
            <li>
                <a class="dropdown-item" href="${settingsUrl}">
                    <i class="bi bi-gear-wide-connected me-2"></i>Cai dat chung
                </a>
            </li>
            <li>
                <button class="dropdown-item" type="button" data-dashboard-action="change-theme">
                    <i class="bi bi-palette me-2"></i>Doi mau theme
                </button>
            </li>
            <li><hr class="dropdown-divider"></li>
        `;

        switch (tabId) {
            case 'notes':
                items += `<li><a class="dropdown-item" href="#"><i class="bi bi-journal-gear me-2"></i>Cai dat Ghi chu</a></li>`;
                break;
            case 'mxh':
                items += `<li><a class="dropdown-item" href="#"><i class="bi bi-share-gear me-2"></i>Cai dat MXH</a></li>`;
                break;
            case 'image':
                items += `<li><a class="dropdown-item" href="#"><i class="bi bi-image-gear me-2"></i>Cai dat Image</a></li>`;
                break;
            case 'telegram':
                items += `<li><a class="dropdown-item" href="#"><i class="bi bi-telegram me-2"></i>Cai dat Telegram</a></li>`;
                break;
            default:
                break;
        }

        return items;
    };

    const updateDropdownContent = () => {
        const activeTabLink = document.querySelector<HTMLElement>('#main-tab .nav-link.active');
        const activeTabId = activeTabLink ? activeTabLink.dataset.tabId : 'home';
        dropdownContentUl.innerHTML = getMenuItemsForTab(activeTabId);
    };

    const ensureBsInstance = () => {
        if (!bsDropdownInstance) {
            bsDropdownInstance = new bootstrap.Dropdown(menuLink);
        }
        return bsDropdownInstance;
    };

    const showDropdown = () => {
        const instance = ensureBsInstance();
        updateDropdownContent();
        if (!dropdownMenu.classList.contains('show')) instance.show();
    };

    const hideDropdown = () => {
        const instance = ensureBsInstance();
        if (dropdownMenu.classList.contains('show')) instance.hide();
    };

    hamburgerMenu.addEventListener('mouseenter', () => {
        clearTimeout(autoHideTimeout);
        clearTimeout(mouseLeaveTimeout);
        isMouseOverMenu = true;
        showDropdown();
        autoHideTimeout = setTimeout(() => {
            if (!isMouseOverDropdown) hideDropdown();
        }, 2000);
    });

    hamburgerMenu.addEventListener('mouseleave', () => {
        isMouseOverMenu = false;
        mouseLeaveTimeout = setTimeout(() => {
            if (!isMouseOverDropdown) {
                clearTimeout(autoHideTimeout);
                hideDropdown();
            }
        }, 300);
    });

    dropdownMenu.addEventListener('mouseenter', () => {
        clearTimeout(autoHideTimeout);
        clearTimeout(mouseLeaveTimeout);
        isMouseOverDropdown = true;
        if (!dropdownMenu.classList.contains('show')) showDropdown();
    });

    dropdownMenu.addEventListener('mouseleave', () => {
        isMouseOverDropdown = false;
        setTimeout(() => {
            if (!isMouseOverMenu && !isMouseOverDropdown) hideDropdown();
        }, 100);
    });

    dropdownMenu.addEventListener('click', (event) => {
        const target = event.target as Element | null;
        const themeBtn = target?.closest('[data-dashboard-action="change-theme"]');
        if (themeBtn) {
            event.preventDefault();
            openThemeColorPrompt();
            hideDropdown();
            return;
        }
        if (target?.closest('.dropdown-item')) hideDropdown();
    });

    hamburgerMenu.addEventListener('hidden.bs.dropdown', () => {
        isMouseOverMenu = false;
        isMouseOverDropdown = false;
        clearTimeout(autoHideTimeout);
        clearTimeout(mouseLeaveTimeout);
    });

    updateDropdownContent();
}

function applySavedDashboardTheme() {
    const resetVersionKey = 'dashboardThemeResetVersion';
    const resetVersion = 'restore-pre-sample-original-20260516';
    if (localStorage.getItem(resetVersionKey) !== resetVersion) {
        localStorage.setItem('dashboardThemeColor', '#1a1d21');
        localStorage.setItem(resetVersionKey, resetVersion);
    }

    const savedColor = localStorage.getItem('dashboardThemeColor');
    if (savedColor && /^#[0-9a-fA-F]{6}$/.test(savedColor)) {
        document.documentElement.style.setProperty('--dashboard-bg', savedColor);
    }
}

window.alert = showAlert;
window.confirm = showConfirm as any;
window.showAlert = showAlert;
window.showConfirm = showConfirm;
window.requestNotificationPermission = requestNotificationPermission;
window.showPlatformNotification = showPlatformNotification;
window.openThemeColorPrompt = openThemeColorPrompt;
window.handleImageNavClick = handleDashboardImageNavClick;
window.hideAllContextMenus = hideAllContextMenus;

applySavedDashboardTheme();

document.addEventListener('DOMContentLoaded', () => {
    initDashboardContextMenu();
    initDashboardNavbar();
    document.querySelectorAll('[data-dashboard-nav="image"]').forEach(link => {
        link.addEventListener('click', handleDashboardImageNavClick);
    });
});
