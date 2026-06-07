// Dashboard-wide behavior extracted from base.html and partials/navbar.html.

type DashboardTabLifecycle = {
    pause?: () => void | Promise<void>;
    resume?: () => void | Promise<void>;
};

type DashboardTabEntry = {
    id: string;
    url: string;
    pane: HTMLElement;
};

const DASHBOARD_CACHEABLE_TABS = new Set(['home', 'notes', 'mxh', 'image', 'telegram']);
const dashboardTabCache = new Map<string, DashboardTabEntry>();
const dashboardLoadedScriptUrls = new Set<string>();
const dashboardLoadedStyleUrls = new Set<string>();
const dashboardTabLifecycles: Record<string, DashboardTabLifecycle> = {};
let dashboardTabShellBound = false;
let activeDashboardTabId: string | null = null;
let dashboardSwitchToken = 0;
const DASHBOARD_GRAPHITE_BG = '#020203';

function normalizeAssetUrl(url: string, base = window.location.href) {
    try {
        return new URL(url, base).href;
    } catch {
        return url;
    }
}

function registerDashboardTabLifecycle(tabId: string, lifecycle: DashboardTabLifecycle) {
    if (!tabId) return;
    dashboardTabLifecycles[tabId] = lifecycle;
}

function getDashboardLifecycle(tabId: string | null) {
    if (!tabId) return null;
    return dashboardTabLifecycles[tabId] || null;
}

function getDashboardMain() {
    return document.getElementById('main-tab-content') as HTMLElement | null;
}

function getDashboardTabFromPath(pathname = window.location.pathname) {
    if (pathname === '/' || pathname === '') return 'home';
    if (pathname === '/notes' || pathname.startsWith('/notes/')) return 'notes';
    if (pathname === '/mxh' || pathname.startsWith('/mxh/')) return 'mxh';
    if (pathname === '/image' || pathname.startsWith('/image/')) return 'image';
    if (pathname === '/telegram' || pathname.startsWith('/telegram/')) return 'telegram';
    return null;
}

function getDashboardTabLink(tabId: string) {
    return document.querySelector<HTMLAnchorElement>(`#main-tab .nav-link[data-tab-id="${tabId}"]`);
}

function updateDashboardActiveNav(tabId: string) {
    document.querySelectorAll<HTMLElement>('#main-tab .nav-link[data-tab-id]').forEach(link => {
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
    document.querySelectorAll<HTMLScriptElement>('script[src]').forEach(script => {
        dashboardLoadedScriptUrls.add(normalizeAssetUrl(script.src));
    });
    document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]').forEach(link => {
        dashboardLoadedStyleUrls.add(normalizeAssetUrl(link.href));
    });
}

function createDashboardPane(tabId: string, url: string) {
    const pane = document.createElement('section');
    pane.className = 'dashboard-tab-cache-pane';
    pane.dataset.dashboardTabPane = tabId;
    pane.dataset.dashboardTabUrl = url;
    pane.hidden = true;
    pane.setAttribute('aria-hidden', 'true');
    return pane;
}

function adoptInitialDashboardPane(main: HTMLElement, tabId: string, url: string) {
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

function injectDashboardStyles(sourceDoc: Document, baseUrl: string) {
    sourceDoc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]').forEach(link => {
        const href = normalizeAssetUrl(link.getAttribute('href') || link.href, baseUrl);
        if (!href || dashboardLoadedStyleUrls.has(href)) return;

        const next = document.createElement('link');
        next.rel = 'stylesheet';
        next.href = href;
        if (link.media) next.media = link.media;
        if (link.crossOrigin) next.crossOrigin = link.crossOrigin;
        document.head.appendChild(next);
        dashboardLoadedStyleUrls.add(href);
    });
}

function shouldSkipDashboardScript(src: string) {
    if (!src) return true;
    if (dashboardLoadedScriptUrls.has(src)) return true;
    return false;
}

function loadDashboardScript(src: string, templateScript: HTMLScriptElement) {
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        if (templateScript.type) script.type = templateScript.type;
        if (templateScript.crossOrigin) script.crossOrigin = templateScript.crossOrigin;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Unable to load script: ${src}`));
        document.body.appendChild(script);
    });
}

async function injectDashboardScripts(sourceDoc: Document, baseUrl: string) {
    const scripts = Array.from(sourceDoc.querySelectorAll<HTMLScriptElement>('script[src]'));
    for (const script of scripts) {
        const src = normalizeAssetUrl(script.getAttribute('src') || script.src, baseUrl);
        if (shouldSkipDashboardScript(src)) continue;
        dashboardLoadedScriptUrls.add(src);
        await loadDashboardScript(src, script);
    }
}

async function fetchDashboardTab(tabId: string, url: string, main: HTMLElement) {
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

function setDashboardPaneVisibility(entry: DashboardTabEntry, active: boolean) {
    entry.pane.hidden = !active;
    entry.pane.classList.toggle('is-active', active);
    entry.pane.setAttribute('aria-hidden', active ? 'false' : 'true');
}

function pushDashboardHistory(tabId: string, url: string, pushHistory: boolean) {
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

async function switchDashboardTab(tabId: string, url: string, pushHistory = true) {
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

        if (switchToken !== dashboardSwitchToken) return;

        dashboardTabCache.forEach(cacheEntry => setDashboardPaneVisibility(cacheEntry, cacheEntry.id === tabId));
        activeDashboardTabId = tabId;
        updateDashboardActiveNav(tabId);
        pushDashboardHistory(tabId, url, pushHistory);

        await getDashboardLifecycle(tabId)?.resume?.();
        window.dispatchEvent(new CustomEvent('dashboard-tab-activated', {
            detail: { tabId, previousTabId }
        }));
    } catch (error) {
        console.error('Dashboard tab switch failed:', error);
        window.location.href = url;
    }
}

function initDashboardTabShell() {
    if (dashboardTabShellBound) return;

    const main = getDashboardMain();
    const initialTabId = getDashboardTabFromPath();
    if (!main || !initialTabId || !DASHBOARD_CACHEABLE_TABS.has(initialTabId)) return;

    dashboardTabShellBound = true;
    seedLoadedDashboardAssets();
    adoptInitialDashboardPane(main, initialTabId, window.location.href);
    pushDashboardHistory(initialTabId, window.location.href, false);

    document.querySelectorAll<HTMLAnchorElement>('#main-tab .nav-link[data-tab-id]').forEach(link => {
        const tabId = link.dataset.tabId || '';
        if (!DASHBOARD_CACHEABLE_TABS.has(tabId)) return;

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
    localStorage.setItem('dashboardThemeColor', DASHBOARD_GRAPHITE_BG);
    document.documentElement.style.setProperty('--dashboard-bg', DASHBOARD_GRAPHITE_BG);
    showToast('Da ap dung giao dien graphite.', 'success');
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
    const resetVersion = 'graphite-theme-20260608';
    if (localStorage.getItem(resetVersionKey) !== resetVersion || localStorage.getItem('dashboardThemeColor') !== DASHBOARD_GRAPHITE_BG) {
        localStorage.setItem('dashboardThemeColor', DASHBOARD_GRAPHITE_BG);
        localStorage.setItem(resetVersionKey, resetVersion);
    }
    document.documentElement.style.setProperty('--dashboard-bg', DASHBOARD_GRAPHITE_BG);
}

// === Global Background Starfield & Particles Effect ===
function initGlobalParticles() {
    const canvas = document.getElementById('dashboard-particles-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationId: number | null = null;
    let isActive = true;

    // Configuration
    const maxParticles = 65;
    const connectionDist = 110;
    const colors = [
        'rgba(255, 255, 255, ',   // White
        'rgba(56, 189, 248, '     // Cyan
    ];

    function resizeCanvas() {
        canvas!.width = window.innerWidth;
        canvas!.height = window.innerHeight;
    }

    class Particle {
        x!: number;
        y!: number;
        radius!: number;
        vx!: number;
        vy!: number;
        colorBase!: string;
        opacity!: number;
        fadeSpeed!: number;
        fadeDirection!: number;

        constructor() {
            this.reset(true);
        }

        reset(init = false) {
            this.x = Math.random() * canvas!.width;
            this.y = init ? Math.random() * canvas!.height : (Math.random() > 0.5 ? 0 : canvas!.height);
            this.radius = 0.5 + Math.random() * 1.5;
            this.vx = -0.12 + Math.random() * 0.24;
            this.vy = -0.12 + Math.random() * 0.24;
            this.colorBase = colors[Math.floor(Math.random() * colors.length)];
            this.opacity = 0.15 + Math.random() * 0.5;
            this.fadeSpeed = 0.003 + Math.random() * 0.007;
            this.fadeDirection = Math.random() > 0.5 ? 1 : -1;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Shimmering stars opacity oscillation
            this.opacity += this.fadeSpeed * this.fadeDirection;
            if (this.opacity > 0.70) {
                this.opacity = 0.70;
                this.fadeDirection = -1;
            } else if (this.opacity < 0.15) {
                this.opacity = 0.15;
                this.fadeDirection = 1;
            }

            // Wrap around edges
            if (this.x < 0 || this.x > canvas!.width || this.y < 0 || this.y > canvas!.height) {
                this.reset(false);
            }
        }

        draw() {
            ctx!.beginPath();
            ctx!.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx!.fillStyle = this.colorBase + this.opacity + ')';
            
            // Add subtle glow to larger particles
            if (this.radius > 1.2) {
                ctx!.shadowColor = this.colorBase.includes('56') ? '#38bdf8' : '#ffffff';
                ctx!.shadowBlur = this.radius * 3.5;
            }
            
            ctx!.fill();
            ctx!.shadowBlur = 0; // reset shadow blur
        }
    }

    function initParticles() {
        particles = [];
        for (let i = 0; i < maxParticles; i++) {
            particles.push(new Particle());
        }
    }

    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const p1 = particles[i];
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < connectionDist) {
                    const alpha = (1 - dist / connectionDist) * 0.05;
                    ctx!.beginPath();
                    ctx!.moveTo(p1.x, p1.y);
                    ctx!.lineTo(p2.x, p2.y);
                    ctx!.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
                    ctx!.lineWidth = 0.5;
                    ctx!.stroke();
                }
            }
        }
    }

    function animate() {
        if (!isActive) return;

        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

        for (const p of particles) {
            p.update();
            p.draw();
        }

        drawConnections();

        animationId = requestAnimationFrame(animate);
    }

    // Initial load
    resizeCanvas();
    initParticles();
    animate();

    // Window resize handler
    let resizeTimeout: any;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            resizeCanvas();
            initParticles();
        }, 150);
    });

    // Toggle animation activity based on page visibility
    document.addEventListener('visibilitychange', () => {
        isActive = document.visibilityState === 'visible';
        if (isActive && !animationId) {
            animate();
        } else if (!isActive && animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    });
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
window.registerDashboardTabLifecycle = registerDashboardTabLifecycle;

applySavedDashboardTheme();

document.addEventListener('DOMContentLoaded', () => {
    initDashboardContextMenu();
    initDashboardNavbar();
    initDashboardTabShell();
    initGlobalParticles();
    document.querySelectorAll('[data-dashboard-nav="image"]').forEach(link => {
        link.addEventListener('click', handleDashboardImageNavClick);
    });
});
