// ===== MXH REAL-TIME CONFIGURATION =====
(function () {
let isMXHDashboardTabInitialized = false;
const MXH_CONFIG = {
    AUTO_REFRESH_INTERVAL: 15000, // Changed from 3000 to 15000ms (15 seconds)
    DEBOUNCE_DELAY: 500, // Debounce for inline editing
    RENDER_BATCH_SIZE: 50, // Cards to render per batch (for smooth rendering)
    ENABLE_AUTO_REFRESH: true // Changed from false to true
};

const MXH_REFRESH_INTERVAL_KEY = 'mxh_refresh_interval_ms';
const MXH_MIN_REFRESH_INTERVAL = 3000;
const MXH_DEFAULT_REFRESH_INTERVAL = 15000;

const MXHState = window.MXHState;
const MXHApi = window.MXHApi;
const MXHUtils = window.MXHUtils;
const MXHAccountRules = window.MXHAccountRules;
const MXHBadges = window.MXHBadges;
const MXHFilters = window.MXHFilters;
const MXHRender = window.MXHRender;
const MXHFlipCard = window.MXHFlipCard;
const MXHContextMenu = window.MXHContextMenu;
const MXHInlineEdit = window.MXHInlineEdit;
const MXHPhoneHistory = window.MXHPhoneHistory;
const MXHScanHistory = window.MXHScanHistory;
const MXHAccountActions = window.MXHAccountActions;
const MXHInit = window.MXHInit;

// --- GLOBAL FLAGS ---
window.interactionPaused = false; // set true khi mở modal/context, false khi đóng
let _mxhGroupsTick = 0;
let refreshAbortController;
const mxhInlineEditRuntime = MXHInlineEdit.createRuntime({ document, window });
mxhInlineEditRuntime.bindGlobalEvents();

function applyMXHDynamicStyles(root = document) {
    root.querySelectorAll<HTMLElement>('[data-mxh-color]').forEach(el => {
        el.style.setProperty('--mxh-color', el.dataset.mxhColor || '#6c757d');
    });
    root.querySelectorAll<HTMLElement>('[data-mxh-bg]').forEach(el => {
        el.style.setProperty('--mxh-bg', el.dataset.mxhBg || '#6c757d');
        el.style.setProperty('--mxh-fg', el.dataset.mxhFg || '#fff');
        el.style.setProperty('--mxh-border', el.dataset.mxhBorder || '1px solid rgba(255,255,255,.25)');
    });
}

// MXH Global State
let mxhGroups = [];
let mxhAccounts = [];
let currentContextAccountId = null;
let currentContextCardId = null; // NEW: For card-based context menu
let autoRefreshTimer = null;
let isRendering = false;
let pendingUpdates = false;
let activeGroupId = null;
let activeFilter = 'default'; // THÊM DÒNG NÀY
let activeViewFilter = 'default'; // 🔍 Thêm biến này để lưu bộ lọc "Xem"
let lastUpdateTime = null; // NEW: Store the timestamp of the last successful data load // null = show all groups, otherwise show specific group only
let mxhSearchQuery = '';
// Default platform: ưu tiên WeChat (chỉ set 1 lần khi vừa load data)
let _mxhDefaultPlatformSet = false;

function normalizeRefreshInterval(value) {
    const interval = Number(value);
    if (!Number.isFinite(interval) || interval < MXH_MIN_REFRESH_INTERVAL) return null;
    return Math.round(interval);
}

function setMXHRefreshInterval(value) {
    const interval = normalizeRefreshInterval(value) || MXH_DEFAULT_REFRESH_INTERVAL;
    MXH_CONFIG.AUTO_REFRESH_INTERVAL = interval;
    try {
        localStorage.setItem(MXH_REFRESH_INTERVAL_KEY, String(interval));
    } catch (error) {
        console.warn('Unable to cache MXH refresh interval:', error);
    }
    return interval;
}

async function loadMXHRefreshIntervalSetting() {
    try {
        const cachedInterval = normalizeRefreshInterval(localStorage.getItem(MXH_REFRESH_INTERVAL_KEY));
        if (cachedInterval) setMXHRefreshInterval(cachedInterval);
    } catch (error) {
        console.warn('Unable to read cached MXH refresh interval:', error);
    }

    try {
        const response = await fetch('/settings/api/settings', { cache: 'no-store' });
        if (!response.ok) return MXH_CONFIG.AUTO_REFRESH_INTERVAL;

        const settings = await response.json();
        return setMXHRefreshInterval(settings.mxh_refresh_interval);
    } catch (error) {
        console.warn('Unable to load MXH refresh interval from settings:', error);
        return MXH_CONFIG.AUTO_REFRESH_INTERVAL;
    }
}

function bindMXHRefreshIntervalUpdates() {
    window.addEventListener('storage', (event) => {
        if (event.key !== MXH_REFRESH_INTERVAL_KEY || !event.newValue) return;
        setMXHRefreshInterval(event.newValue);
        if (autoRefreshTimer) startAutoRefresh();
    });

    window.addEventListener('mxh-refresh-interval-changed', (event) => {
        const interval = (event as CustomEvent).detail?.interval;
        setMXHRefreshInterval(interval);
        if (autoRefreshTimer) startAutoRefresh();
    });
}

const mxhAccountsContainer = document.getElementById('mxh-accounts-container');
if (mxhAccountsContainer) {
    mxhAccountsContainer.addEventListener('click', (event) => {
        if ((event.target as Element | null)?.closest('.mxh-card-number-edit')) {
            event.stopPropagation();
        }
    });
    mxhAccountsContainer.addEventListener('contextmenu', (event) => {
        const card = (event.target as Element | null)?.closest<HTMLElement>('.mxh-card[data-card-id]');
        if (!card || !mxhAccountsContainer.contains(card)) return;
        window.handleCardContextMenu(
            event,
            Number(card.dataset.cardId),
            Number(card.dataset.accountId),
            card.dataset.platform
        );
    });
    mxhAccountsContainer.addEventListener('keydown', (event) => {
        const field = (event.target as Element | null)?.closest<HTMLElement>('.editable-field[contenteditable="true"]');
        if (!field || !mxhAccountsContainer.contains(field)) return;
        if (event.key === 'Enter') {
            event.preventDefault();
            field.blur();
        }
    });
    mxhAccountsContainer.addEventListener('blur', (event) => {
        const field = (event.target as Element | null)?.closest<HTMLElement>('.editable-field[contenteditable="true"]');
        if (!field || !mxhAccountsContainer.contains(field)) return;
        window.saveInlineEdit(field, Number(field.dataset.accountId), field.dataset.field);
    }, true);
}

function trySetDefaultPlatform() {
    if (_mxhDefaultPlatformSet) return false;
    activeGroupId = null; // Mặc định hiển thị Lọc tất cả
    _mxhDefaultPlatformSet = true;
    return false;
}


// 🔍 THÊM DÒNG NÀY: Lưu từ khóa tìm kiếm

// ===== PERFORMANCE OPTIMIZATION UTILITIES =====
const getCardState = MXHState.getCardState;
const setCardState = MXHState.setCardState;
const requestFullRebuild = MXHState.requestFullRebuild;
const areGroupsEqual = MXHUtils.areGroupsEqual;
const debounce = MXHUtils.debounce;
const throttle = MXHUtils.throttle;
const escapeHtml = MXHUtils.escapeHtml;
const getPlatformColor = MXHUtils.getPlatformColor;
const getPlatformIconClass = MXHUtils.getPlatformIconClass;
const getContainerTypeIcon = MXHUtils.getContainerTypeIcon;
const getContainerTypeColorClass = MXHUtils.getContainerTypeColorClass;
const getContainerTypeTitle = MXHUtils.getContainerTypeTitle;
const normalizeISOForJS = MXHAccountRules.normalizeISOForJS;
const ensureNoticeParsed = MXHAccountRules.ensureNoticeParsed;
const calculateTimeDifferenceInHours = MXHAccountRules.calculateTimeDifferenceInHours;
const formatAccountAge = MXHAccountRules.formatAccountAge;
const calculateNearbyCountdown = MXHAccountRules.calculateNearbyCountdown;
const calculateScanCountdown = MXHAccountRules.calculateScanCountdown;
const canScanWeChat = MXHAccountRules.canScanWeChat;
const needsHongKongNumber = MXHAccountRules.needsHongKongNumber;
const canScanWeChatHK = MXHAccountRules.canScanWeChatHK;
const isEligibleNearbyPeople = MXHAccountRules.isEligibleNearbyPeople;
const isNearbyPeopleActive = MXHAccountRules.isNearbyPeopleActive;
const getAccountCreatedDateForStats = MXHAccountRules.getAccountCreatedDateForStats;
const isAccountDisabledForStats = MXHAccountRules.isAccountDisabledForStats;
const hasIncompleteProfileInfo = MXHAccountRules.hasIncompleteProfileInfo;
const getAccountBorderClass = MXHAccountRules.getAccountBorderClass;

// Gom render về idle để mượt
const scheduleRender = () => (window.requestIdleCallback
    ? requestIdleCallback(() => renderMXHAccounts(), { timeout: 200 })
    : setTimeout(() => renderMXHAccounts(), 50)
);

function getRenderContext() {
    return {
        document,
        window,
        navigator,
        bootstrap,
        MXHState,
        MXHApi,
        get mxhAccounts() { return mxhAccounts; },
        set mxhAccounts(value) { mxhAccounts = Array.isArray(value) ? value : []; },
        get mxhGroups() { return mxhGroups; },
        set mxhGroups(value) { mxhGroups = Array.isArray(value) ? value : []; },
        get activeGroupId() { return activeGroupId; },
        get activeFilter() { return activeFilter; },
        set activeFilter(value) { activeFilter = value; },
        get activeViewFilter() { return activeViewFilter; },
        set activeViewFilter(value) { activeViewFilter = value; },
        get mxhSearchQuery() { return mxhSearchQuery; },
        set mxhSearchQuery(value) { mxhSearchQuery = value; },
        get currentContextAccountId() { return currentContextAccountId; },
        set currentContextAccountId(value) { currentContextAccountId = value; },
        get currentContextCardId() { return currentContextCardId; },
        set currentContextCardId(value) { currentContextCardId = value; },
        setCurrentContext(cardId, accountId) {
            currentContextCardId = cardId;
            currentContextAccountId = accountId;
        },
        setMXHInlineEditActive: mxhInlineEditRuntime.setActive,
        clearMXHInlineEditSelection: mxhInlineEditRuntime.clearSelection,
        setMXHCommitInlineEditOnBlur: mxhInlineEditRuntime.setCommitOnBlur,
        get isRendering() { return isRendering; },
        set isRendering(value) { isRendering = value; },
        get isInitialRenderComplete() { return isInitialRenderComplete; },
        set isInitialRenderComplete(value) { isInitialRenderComplete = value; },
        get lastRenderedGroupId() { return lastRenderedGroupId; },
        set lastRenderedGroupId(value) { lastRenderedGroupId = value; },
        getCardState,
        setCardState,
        getCardBadge,
        getGroupBadgeMarkup,
        renderGroupsNav,
        selectGroup,
        calculateGroupBadge,
        updateMainNavBadge,
        applyMXHDynamicStyles,
        escapeHtml,
        getPlatformIconClass,
        getPlatformColor,
        getContainerTypeIcon,
        getContainerTypeColorClass,
        getContainerTypeTitle,
        formatAccountAge,
        calculateScanCountdown,
        calculateNearbyCountdown,
        getAccountBorderClass,
        isEligibleNearbyPeople,
        isNearbyPeopleActive,
        getAccountCreatedDateForStats,
        calculateTimeDifferenceInHours,
        isAccountDisabledForStats,
        hasIncompleteProfileInfo,
        canScanWeChat,
        canScanWeChatHK,
        ensureNoticeParsed,
        needsHongKongNumber,
        renderCardFace,
        flipCardToAccount,
        updateStatsPanels,
        handleNearbyAction,
        openScanHistoryModal,
        applyQuickFilter,
        isMXHInlineEditing: mxhInlineEditRuntime.isEditing,
        shouldHoldMXHInlineEditOnBlur: mxhInlineEditRuntime.shouldHoldOnBlur,
        captureMXHInlineEditSelection: mxhInlineEditRuntime.captureSelection,
        restoreMXHInlineEditSelection: mxhInlineEditRuntime.restoreSelection,
        initializeTooltips,
        updateCardVisibility,
        loadMXHData,
        scheduleRender,
        requestFullRebuild,
        startAutoRefresh,
        stopAutoRefresh,
        debounce,
        showToast: (...args) => {
            if (typeof showToast === 'function') (showToast as any)(...args);
        },
        showAlert: (...args) => {
            if (typeof showAlert === 'function') {
                (showAlert as any)(...args);
            } else {
                window.alert(args[0]);
            }
        },
        confirm: (...args) => (confirm as any)(...args),
        pauseAutoRefresh,
        resumeAutoRefresh
    };
}


// ===== REAL-TIME DATA LOADING WITH SMART UPDATES =====
// Load MXH data from API with optimized rendering
async function loadMXHData(forceRender = false) {
    if (mxhInlineEditRuntime.isEditing()) return; // Keep caret/selection stable while editing inline fields.
    if (window.interactionPaused || document.hidden) return; // (1) chặn khi đang tương tác/ẩn tab

    // (3) chống race-condition
    refreshAbortController?.abort();
    refreshAbortController = new AbortController();
    const { signal } = refreshAbortController;

    try {
        // (2) giảm tần suất fetch groups
        const fetchGroupsNow = ((++_mxhGroupsTick % 4) === 1) || forceRender;
        const groupsReq = fetchGroupsNow ? MXHApi.getGroups(signal) : Promise.resolve({ ok: false });
        const accountsReq = MXHApi.getAccounts(lastUpdateTime, signal);

        const [groupsResponse, accountsResponse] = await Promise.all([groupsReq, accountsReq]);

        // (4) chỉ render groups nếu thay đổi
        if (groupsResponse && groupsResponse.ok) {
            const newGroups = await groupsResponse.json();
            if (!areGroupsEqual(mxhGroups, newGroups)) {
                mxhGroups = newGroups;
                renderGroupsNav();
                updateMainNavBadge();
            }
        }

        let dataChanged = false;

        if (accountsResponse.ok) {
            const delta = await accountsResponse.json();                 // [{...updated accounts...}]
            const accountMap = new Map(mxhAccounts.map(a => [a.id, a])); // quick index
            let touchedAny = false;

            delta.forEach(acc => {
                const exist = accountMap.get(acc.id);
                if (!exist || JSON.stringify(exist) !== JSON.stringify(acc)) {
                    accountMap.set(acc.id, acc);
                    touchedAny = true;
                }
            });

            if (touchedAny) {
                mxhAccounts = Array.from(accountMap.values());
                dataChanged = true;

                // Cập nhật lastUpdateTime sau khi merge delta thành công
                lastUpdateTime = Math.max(
                    lastUpdateTime || 0,
                    ...(delta.map(acc => new Date(acc.updated_at || acc.updatedAt || Date.now()).getTime()))
                ) || Date.now();
            }
        }


        // Default tab: ưu tiên WeChat
        const _defaultChanged = trySetDefaultPlatform();
        if (_defaultChanged) dataChanged = true;

        // (5) render mượt
        if (forceRender || dataChanged) {
            if (dataChanged) requestFullRebuild();
            scheduleRender();
            updateMainNavBadge();
        }

    } catch (err) {
        if (err.name !== 'AbortError') console.error('loadMXHData error:', err);
    }
}

// ===== AUTO-REFRESH SYSTEM =====
function startAutoRefresh() {
    if (!MXH_CONFIG.ENABLE_AUTO_REFRESH) return;

    stopAutoRefresh(); // Clear any existing timer
    const interval = normalizeRefreshInterval(MXH_CONFIG.AUTO_REFRESH_INTERVAL) || MXH_DEFAULT_REFRESH_INTERVAL;
    MXH_CONFIG.AUTO_REFRESH_INTERVAL = interval;

    autoRefreshTimer = setInterval(async () => {
        await loadMXHData(false); // Don't force render, only if data changed
    }, interval);

    // console.log('✅ MXH Auto-refresh enabled (every', MXH_CONFIG.AUTO_REFRESH_INTERVAL / 1000, 'seconds)');
}

function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
}

function pauseAutoRefresh() {
    window.interactionPaused = true;
}

function resumeAutoRefresh() {
    window.interactionPaused = false;
}

function pauseMXHDashboardTab() {
    window.interactionPaused = true;
    mxhInlineEditRuntime.captureSelection();
    stopAutoRefresh();
    refreshAbortController?.abort();
    hideCardContextMenu();
}

function resumeMXHDashboardTab() {
    window.interactionPaused = false;
    startAutoRefresh();
    if (mxhInlineEditRuntime.isEditing()) {
        setTimeout(() => mxhInlineEditRuntime.restoreSelection(), 50);
    } else {
        loadMXHData(false);
    }
}

async function ensurePlatformGroup(platform) {
    return await MXHAccountActions.ensurePlatformGroup(platform);
}


// Get card badge for individual cards (positioned like group badge)
// 🔍 Updated to accept allAccounts to check all accounts in the card
function getCardBadge(account, allAccounts = []) {
    return MXHBadges.getCardBadge(getRenderContext(), account, allAccounts);
}

function getGroupBadgeMarkup(badgeInfo, fallbackColor) {
    return MXHRender.getGroupBadgeMarkup(getRenderContext(), badgeInfo, fallbackColor);
}

async function getNextCardNumber(groupId) {
    return await MXHAccountActions.getNextCardNumber(groupId);
}


// Toggle group visibility
// ===== RENDER GROUP NAVIGATION WITH BADGES =====
function renderGroupsNav() {
    return MXHRender.renderGroupsNav(getRenderContext());
}

// Calculate smart badge count for a specific group with detailed breakdown
function calculateGroupBadge(groupId) {
    return MXHBadges.calculateGroupBadge(getRenderContext(), groupId);
}

// Update badge dots on main MXH nav tab
function updateMainNavBadge() {
    return MXHBadges.updateMainNavBadge(getRenderContext());
}

// Select a specific group (or null for all)
function selectGroup(groupId) {
    activeGroupId = groupId === 'null' ? null : groupId;
    renderGroupsNav();
    scheduleRender();
}

// ===== DATETIME NORMALIZATION HELPERS =====
// Cắt microseconds về 3 chữ số và thêm 'Z' nếu thiếu timezone
// ===== CARD FACE RENDERING =====
// Render individual card face with all account details
function renderCardFace(account, allAccounts, side) {
    return MXHRender.renderCardFace(getRenderContext(), account, allAccounts, side);
}


// ===== STATISTICS PANEL =====
function updateStatsPanels(tabAccounts) {
    return MXHRender.updateStatsPanels(getRenderContext(), tabAccounts);
}

// ===== OPTIMIZED RENDERING WITH SCROLL PRESERVATION =====
// Render MXH Accounts with performance optimizations and scroll position preservation
// ===== OPTIMIZED RENDERING WITH SCROLL PRESERVATION (UPDATED WITH FILTERS) =====
// ===== OPTIMIZED RENDER LOGIC (UPDATE IN-PLACE) =====

// Flag to check if initial render is done
let isInitialRenderComplete = false;
let lastRenderedGroupId = null;

function renderMXHAccounts(forceRender = false) {
    return MXHRender.renderMXHAccounts(getRenderContext(), forceRender);
}

// New Smart Filter Function
function applyQuickFilter(filterKey) {
    return MXHFilters.applyQuickFilter(getRenderContext(), filterKey);
}

function updateCardVisibility(searchQuery) {
    return MXHFilters.updateCardVisibility(getRenderContext(), searchQuery);
}

// === NEW: Flip Card Function (Single Flip Animation) ===
function flipCardToAccount(cardId, accountId) {
    return MXHFlipCard.flipCardToAccount(getRenderContext(), cardId, accountId);
}

// Helper function for notice configuration
function configureNoticeToggleFor(menuId, account) {
    const el = document.querySelector<HTMLElement>(`#${menuId} [id$="-notice-toggle"]`);
    if (!el) return;
    const noticeObj = ensureNoticeParsed(account.notice);
    const hasNotice = !!(noticeObj && noticeObj.enabled);
    // set action + icon + text
    el.dataset.action = hasNotice ? 'clear-notice' : 'set-notice';
    el.innerHTML = hasNotice
        ? '<i class="bi bi-bell-slash-fill me-2"></i> Hủy thông báo'
        : '<i class="bi bi-bell-fill me-2"></i> Thông báo';
}

// Handle Card Context Menu - Use Unified Menu
// === NEW: Card-based Context Menu với Submenu ===
window.handleCardContextMenu = function (event, cardId, accountId, platform) {
    return MXHContextMenu.showCardContextMenu(getRenderContext(), event, cardId, accountId, platform);
}

// Smart anchor: flip trái/phải + trên/dưới theo mép màn hình, kèm offset 8px
function positionContextMenuSmart(menu, x, y) {
    return MXHContextMenu.positionContextMenuSmart(menu, x, y);
}

MXHContextMenu.bindSubmenuPositioning(document);

async function handleNearbyAction(accountId, actionType) {
    try {
        const res = await MXHApi.nearbyPeople({ account_id: accountId, action: actionType });
        const data = await res.json();
        if (data.success) {
            if (typeof showToast === 'function') showToast('Cập nhật Nearby People thành công', 'success');
            loadMXHData(true);
        } else {
            if (typeof showToast === 'function') showToast('Lỗi: ' + (data.error || 'Server error'), 'error');
        }
    } catch (e) {
        console.error('Lỗi khi gọi API:', e);
        if (typeof showToast === 'function') showToast('Lỗi kết nối', 'error');
    }
}

function hideCardContextMenu() {
    return MXHContextMenu.hideCardContextMenu(getRenderContext());
}

function openMoveAccountModal(accountId) {
    return MXHAccountActions.openMoveAccountModal(accountId);
}


async function createSubAccount(cardId, containerType) {
    return await MXHAccountActions.createSubAccount(cardId, containerType);
}


async function deleteCard(cardId) {
    return await MXHAccountActions.deleteCard(cardId);
}


async function deleteSubAccount(accountId) {
    return await MXHAccountActions.deleteSubAccount(accountId);
}


async function rescueAccountAction(accountId, result) {
    return await MXHAccountActions.rescueAccountAction(accountId, result);
}


async function scanWeChatAccount(accountId) {
    return await MXHAccountActions.scanWeChatAccount(accountId);
}



async function updateAccountStatusNew(accountId, status) {
    return await MXHAccountActions.updateAccountStatusNew(accountId, status);
}


async function updateWechatVerifyStatus(accountId, wechatStatus) {
    return await MXHAccountActions.updateWechatVerifyStatus(accountId, wechatStatus);
}


function openNoticeModal(event) {
    return MXHAccountActions.openNoticeModal(event);
}
async function cancelNotice(accountId) {
    return await MXHAccountActions.cancelNotice(accountId);
}


async function resetScanCountNew(accountId) {
    return await MXHAccountActions.resetScanCountNew(accountId);
}


function openAccountModalForEdit(accountId) {
    return MXHAccountActions.openAccountModalForEdit(accountId);
}


async function deleteAccount(accountId) {
    return await MXHAccountActions.deleteAccount(accountId);
}


async function resetAccount(accountId) {
    return await MXHAccountActions.resetAccount(accountId);
}









// Initialize - Load data and start auto-refresh
async function initMXHDashboardTab() {
    if (isMXHDashboardTabInitialized) return;
    if (!document.getElementById('mxh-tool-pane')) return;
    isMXHDashboardTabInitialized = true;

    window.registerDashboardTabLifecycle?.('mxh', {
        pause: pauseMXHDashboardTab,
        resume: resumeMXHDashboardTab
    });

    bindMXHRefreshIntervalUpdates();
    await loadMXHRefreshIntervalSetting();
    await MXHInit.init(getRenderContext());

    const mxhPaneShell = document.getElementById('mxh-tool-pane')?.closest<HTMLElement>('[data-dashboard-tab-pane]');
    if (mxhPaneShell?.hidden) pauseMXHDashboardTab();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMXHDashboardTab, { once: true });
} else {
    initMXHDashboardTab();
}

// Initialize tooltips function
function initializeTooltips() {
    // Initialize Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Open WeChat Modal Function
window.openWeChatModal = function (accountId) {
    return MXHAccountActions.openWeChatModal(accountId);
};


// --- Hàm quản lý Lịch sử SĐT ---
async function loadPhoneHistory(accountId) {
    return MXHPhoneHistory.loadPhoneHistory(getRenderContext(), accountId);
}

window.loadPhoneHistory = loadPhoneHistory;

window.copyPhoneHistory = function (phone) {
    return MXHPhoneHistory.copyPhoneHistory(getRenderContext(), phone);
};

// ===== INLINE EDITING FUNCTIONS WITH INSTANT UPDATES =====

// --- Inline edit: update DOM locally, không render lại cả trang ---
function _mxhNormalizeValue(v) {
    return MXHInlineEdit.normalizeValue(v);
}

function _mxhFormatDisplay(field, value) {
    return MXHInlineEdit.formatDisplay(field, value);
}

function _mxhSyncEditableDom(accountId, field, value) {
    return MXHInlineEdit.syncEditableDom(getRenderContext(), accountId, field, value);
}

// Save inline edit when user clicks away or presses Enter
window.saveInlineEdit = async function (element, accountId, field) {
    return MXHInlineEdit.saveInlineEdit(getRenderContext(), element, accountId, field);
};

// Quick update field (instant local update, debounced API call)
async function quickUpdateField(accountId, field, value) {
    return MXHInlineEdit.quickUpdateField(getRenderContext(), accountId, field, value);
}

// Setup contenteditable fields
function setupEditableFields() {
    return MXHInlineEdit.setupEditableFields(getRenderContext());
}

window.toggleAccountStatus = async function (accountId) {
    return await MXHAccountActions.toggleAccountStatus(accountId);
};

// === Scan history helpers ===
// === NEW: Show Scan History ===
// Helper to load data without opening modal (for Refresh/Reset)
async function fetchScanHistoryData(accountId) {
    return MXHScanHistory.fetchScanHistoryData(getRenderContext(), accountId);
}

// Main function to open modal
async function openScanHistoryModal(accountId) {
    return MXHScanHistory.openScanHistoryModal(getRenderContext(), accountId);
}

// === NEW: Reset Scan History ===
async function resetScanHistory(btn) {
    return MXHScanHistory.resetScanHistory(getRenderContext(), btn);
}
})();
