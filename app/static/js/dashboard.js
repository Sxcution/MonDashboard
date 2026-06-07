"use strict";
// Dashboard-wide behavior extracted from base.html and partials/navbar.html.
const DASHBOARD_CACHEABLE_TABS = new Set(['home', 'notes', 'mxh', 'image', 'telegram']);
const dashboardTabCache = new Map();
const dashboardLoadedScriptUrls = new Set();
const dashboardLoadedStyleUrls = new Set();
const dashboardTabLifecycles = {};
let dashboardTabShellBound = false;
let activeDashboardTabId = null;
let dashboardSwitchToken = 0;
const DASHBOARD_GRAPHITE_BG = '#020203';
function normalizeAssetUrl(url, base = window.location.href) {
    try {
        return new URL(url, base).href;
    }
    catch {
        return url;
    }
}
function registerDashboardTabLifecycle(tabId, lifecycle) {
    if (!tabId)
        return;
    dashboardTabLifecycles[tabId] = lifecycle;
}
function getDashboardLifecycle(tabId) {
    if (!tabId)
        return null;
    return dashboardTabLifecycles[tabId] || null;
}
function getDashboardMain() {
    return document.getElementById('main-tab-content');
}
function getDashboardTabFromPath(pathname = window.location.pathname) {
    if (pathname === '/' || pathname === '')
        return 'home';
    if (pathname === '/notes' || pathname.startsWith('/notes/'))
        return 'notes';
    if (pathname === '/mxh' || pathname.startsWith('/mxh/'))
        return 'mxh';
    if (pathname === '/image' || pathname.startsWith('/image/'))
        return 'image';
    if (pathname === '/telegram' || pathname.startsWith('/telegram/'))
        return 'telegram';
    return null;
}
function getDashboardTabLink(tabId) {
    return document.querySelector(`#main-tab .nav-link[data-tab-id="${tabId}"]`);
}
function updateDashboardActiveNav(tabId) {
    document.querySelectorAll('#main-tab .nav-link[data-tab-id]').forEach(link => {
        const isActive = link.dataset.tabId === tabId;
        link.classList.toggle('active', isActive);
        link.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    const dropdown = document.getElementById('hamburger-dropdown-content');
    if (dropdown) {
        const event = new CustomEvent('dashboard-active-tab-changed', { detail: { tabId } });
        window.dispatchEvent(event);
    }
}
function seedLoadedDashboardAssets() {
    document.querySelectorAll('script[src]').forEach(script => {
        dashboardLoadedScriptUrls.add(normalizeAssetUrl(script.src));
    });
    document.querySelectorAll('link[rel~="stylesheet"][href]').forEach(link => {
        dashboardLoadedStyleUrls.add(normalizeAssetUrl(link.href));
    });
}
function createDashboardPane(tabId, url) {
    const pane = document.createElement('section');
    pane.className = 'dashboard-tab-cache-pane';
    pane.dataset.dashboardTabPane = tabId;
    pane.dataset.dashboardTabUrl = url;
    pane.hidden = true;
    pane.setAttribute('aria-hidden', 'true');
    return pane;
}
function adoptInitialDashboardPane(main, tabId, url) {
    const pane = createDashboardPane(tabId, url);
    pane.hidden = false;
    pane.classList.add('is-active');
    pane.setAttribute('aria-hidden', 'false');
    while (main.firstChild) {
        pane.appendChild(main.firstChild);
    }
    main.appendChild(pane);
    dashboardTabCache.set(tabId, { id: tabId, url, pane });
    activeDashboardTabId = tabId;
    updateDashboardActiveNav(tabId);
}
function injectDashboardStyles(sourceDoc, baseUrl) {
    sourceDoc.querySelectorAll('link[rel~="stylesheet"][href]').forEach(link => {
        const href = normalizeAssetUrl(link.getAttribute('href') || link.href, baseUrl);
        if (!href || dashboardLoadedStyleUrls.has(href))
            return;
        const next = document.createElement('link');
        next.rel = 'stylesheet';
        next.href = href;
        if (link.media)
            next.media = link.media;
        if (link.crossOrigin)
            next.crossOrigin = link.crossOrigin;
        document.head.appendChild(next);
        dashboardLoadedStyleUrls.add(href);
    });
}
function shouldSkipDashboardScript(src) {
    if (!src)
        return true;
    if (dashboardLoadedScriptUrls.has(src))
        return true;
    return false;
}
function loadDashboardScript(src, templateScript) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        if (templateScript.type)
            script.type = templateScript.type;
        if (templateScript.crossOrigin)
            script.crossOrigin = templateScript.crossOrigin;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Unable to load script: ${src}`));
        document.body.appendChild(script);
    });
}
async function injectDashboardScripts(sourceDoc, baseUrl) {
    const scripts = Array.from(sourceDoc.querySelectorAll('script[src]'));
    for (const script of scripts) {
        const src = normalizeAssetUrl(script.getAttribute('src') || script.src, baseUrl);
        if (shouldSkipDashboardScript(src))
            continue;
        dashboardLoadedScriptUrls.add(src);
        await loadDashboardScript(src, script);
    }
}
async function fetchDashboardTab(tabId, url, main) {
    const response = await fetch(url, {
        headers: {
            'Accept': 'text/html',
            'X-Requested-With': 'DashboardTabShell'
        },
        credentials: 'same-origin'
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    const sourceDoc = new DOMParser().parseFromString(html, 'text/html');
    const sourceMain = sourceDoc.getElementById('main-tab-content');
    if (!sourceMain) {
        throw new Error('Khong tim thay noi dung tab.');
    }
    injectDashboardStyles(sourceDoc, url);
    const pane = createDashboardPane(tabId, url);
    pane.innerHTML = sourceMain.innerHTML;
    main.appendChild(pane);
    const entry = { id: tabId, url, pane };
    dashboardTabCache.set(tabId, entry);
    await injectDashboardScripts(sourceDoc, url);
    return entry;
}
function setDashboardPaneVisibility(entry, active) {
    entry.pane.hidden = !active;
    entry.pane.classList.toggle('is-active', active);
    entry.pane.setAttribute('aria-hidden', active ? 'false' : 'true');
}
function pushDashboardHistory(tabId, url, pushHistory) {
    const normalizedUrl = new URL(url, window.location.origin);
    const nextPath = `${normalizedUrl.pathname}${normalizedUrl.search}${normalizedUrl.hash}`;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const state = { dashboardTabId: tabId };
    if (pushHistory && nextPath !== currentPath) {
        window.history.pushState(state, '', nextPath);
        return;
    }
    window.history.replaceState(state, '', currentPath);
}
async function switchDashboardTab(tabId, url, pushHistory = true) {
    if (!DASHBOARD_CACHEABLE_TABS.has(tabId)) {
        window.location.href = url;
        return;
    }
    const main = getDashboardMain();
    if (!main) {
        window.location.href = url;
        return;
    }
    const switchToken = ++dashboardSwitchToken;
    const previousTabId = activeDashboardTabId;
    if (previousTabId === tabId && dashboardTabCache.has(tabId)) {
        pushDashboardHistory(tabId, url, pushHistory);
        updateDashboardActiveNav(tabId);
        return;
    }
    try {
        hideAllContextMenus();
        await getDashboardLifecycle(previousTabId)?.pause?.();
        let entry = dashboardTabCache.get(tabId);
        if (!entry) {
            entry = await fetchDashboardTab(tabId, url, main);
        }
        if (switchToken !== dashboardSwitchToken)
            return;
        dashboardTabCache.forEach(cacheEntry => setDashboardPaneVisibility(cacheEntry, cacheEntry.id === tabId));
        activeDashboardTabId = tabId;
        updateDashboardActiveNav(tabId);
        pushDashboardHistory(tabId, url, pushHistory);
        await getDashboardLifecycle(tabId)?.resume?.();
        window.dispatchEvent(new CustomEvent('dashboard-tab-activated', {
            detail: { tabId, previousTabId }
        }));
    }
    catch (error) {
        console.error('Dashboard tab switch failed:', error);
        window.location.href = url;
    }
}
function initDashboardTabShell() {
    if (dashboardTabShellBound)
        return;
    const main = getDashboardMain();
    const initialTabId = getDashboardTabFromPath();
    if (!main || !initialTabId || !DASHBOARD_CACHEABLE_TABS.has(initialTabId))
        return;
    dashboardTabShellBound = true;
    seedLoadedDashboardAssets();
    adoptInitialDashboardPane(main, initialTabId, window.location.href);
    pushDashboardHistory(initialTabId, window.location.href, false);
    document.querySelectorAll('#main-tab .nav-link[data-tab-id]').forEach(link => {
        const tabId = link.dataset.tabId || '';
        if (!DASHBOARD_CACHEABLE_TABS.has(tabId))
            return;
        link.addEventListener('click', (event) => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                return;
            }
            event.preventDefault();
            switchDashboardTab(tabId, link.href, true);
        }, true);
    });
    window.addEventListener('popstate', () => {
        const tabId = getDashboardTabFromPath();
        if (!tabId || !DASHBOARD_CACHEABLE_TABS.has(tabId)) {
            window.location.reload();
            return;
        }
        const link = getDashboardTabLink(tabId);
        switchDashboardTab(tabId, link?.href || window.location.href, false);
    });
}
function showAlert(message, title = 'Thong Bao') {
    const textEl = document.getElementById('globalAlertText');
    const titleEl = document.getElementById('globalAlertModalLabel');
    const modalEl = document.getElementById('globalAlertModal');
    if (!textEl || !titleEl || !modalEl)
        return;
    textEl.textContent = message;
    titleEl.innerHTML = `<i class="bi bi-info-circle me-2 text-info"></i>${title}`;
    new bootstrap.Modal(modalEl).show();
}
function showConfirm(message, title = 'Xac Nhan') {
    return new Promise((resolve) => {
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
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
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
        }
        else {
            showToast("Quyen thong bao bi tu choi.", "error");
        }
    });
}
function showPlatformNotification(title, body, icon = "/static/favicon.ico") {
    if (!("Notification" in window))
        return;
    if (Notification.permission === "granted") {
        new Notification(title, { body, icon });
    }
    else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(title, { body, icon });
            }
        });
    }
}
function openThemeColorPrompt() {
    localStorage.setItem('dashboardThemeColor', DASHBOARD_GRAPHITE_BG);
    document.documentElement.style.setProperty('--dashboard-bg', DASHBOARD_GRAPHITE_BG);
    showToast('Da ap dung giao dien graphite.', 'success');
}
function handleDashboardImageNavClick(event) {
    if (window.location.pathname.startsWith('/image')) {
        event.preventDefault();
        return false;
    }
    return true;
}
function hideAllContextMenus() {
    document.querySelectorAll('.custom-context-menu').forEach(menu => {
        menu.style.display = 'none';
    });
}
function showContextMenu(menu, x, y) {
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';
}
function initDashboardContextMenu() {
    const dashboardMenu = document.getElementById('dashboard-context-menu');
    if (!dashboardMenu)
        return;
    dashboardMenu.addEventListener('click', (event) => {
        const action = event.target?.closest('[data-dashboard-action]')?.dataset.dashboardAction;
        if (!action)
            return;
        event.preventDefault();
        if (action === 'reload')
            location.reload();
        if (action === 'settings')
            location.href = '/settings/';
        if (action === 'notifications')
            requestNotificationPermission();
        hideAllContextMenus();
    });
    document.addEventListener('contextmenu', (event) => {
        const target = event.target;
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
    if (!hamburgerMenu)
        return;
    const navShell = hamburgerMenu.closest('[data-settings-url]');
    const settingsUrl = navShell?.dataset.settingsUrl || '/settings/';
    const menuLink = hamburgerMenu.querySelector('.nav-link');
    const dropdownMenu = hamburgerMenu.querySelector('.dropdown-menu');
    const dropdownContentUl = document.getElementById('hamburger-dropdown-content');
    if (!menuLink || !dropdownMenu || !dropdownContentUl)
        return;
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
        const activeTabLink = document.querySelector('#main-tab .nav-link.active');
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
        if (!dropdownMenu.classList.contains('show'))
            instance.show();
    };
    const hideDropdown = () => {
        const instance = ensureBsInstance();
        if (dropdownMenu.classList.contains('show'))
            instance.hide();
    };
    hamburgerMenu.addEventListener('mouseenter', () => {
        clearTimeout(autoHideTimeout);
        clearTimeout(mouseLeaveTimeout);
        isMouseOverMenu = true;
        showDropdown();
        autoHideTimeout = setTimeout(() => {
            if (!isMouseOverDropdown)
                hideDropdown();
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
        if (!dropdownMenu.classList.contains('show'))
            showDropdown();
    });
    dropdownMenu.addEventListener('mouseleave', () => {
        isMouseOverDropdown = false;
        setTimeout(() => {
            if (!isMouseOverMenu && !isMouseOverDropdown)
                hideDropdown();
        }, 100);
    });
    dropdownMenu.addEventListener('click', (event) => {
        const target = event.target;
        const themeBtn = target?.closest('[data-dashboard-action="change-theme"]');
        if (themeBtn) {
            event.preventDefault();
            openThemeColorPrompt();
            hideDropdown();
            return;
        }
        if (target?.closest('.dropdown-item'))
            hideDropdown();
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
    const resetVersion = 'graphite-theme-20260608';
    if (localStorage.getItem(resetVersionKey) !== resetVersion || localStorage.getItem('dashboardThemeColor') !== DASHBOARD_GRAPHITE_BG) {
        localStorage.setItem('dashboardThemeColor', DASHBOARD_GRAPHITE_BG);
        localStorage.setItem(resetVersionKey, resetVersion);
    }
    document.documentElement.style.setProperty('--dashboard-bg', DASHBOARD_GRAPHITE_BG);
}
window.alert = showAlert;
window.confirm = showConfirm;
window.showAlert = showAlert;
window.showConfirm = showConfirm;
window.requestNotificationPermission = requestNotificationPermission;
window.showPlatformNotification = showPlatformNotification;
window.openThemeColorPrompt = openThemeColorPrompt;
window.handleImageNavClick = handleDashboardImageNavClick;
window.hideAllContextMenus = hideAllContextMenus;
window.registerDashboardTabLifecycle = registerDashboardTabLifecycle;
applySavedDashboardTheme();
document.addEventListener('DOMContentLoaded', () => {
    initDashboardContextMenu();
    initDashboardNavbar();
    initDashboardTabShell();
    document.querySelectorAll('[data-dashboard-nav="image"]').forEach(link => {
        link.addEventListener('click', handleDashboardImageNavClick);
    });
});
