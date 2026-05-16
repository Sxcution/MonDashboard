// ===== MXH REAL-TIME CONFIGURATION =====
const MXH_CONFIG = {
    AUTO_REFRESH_INTERVAL: 15000, // Changed from 3000 to 15000ms (15 seconds)
    DEBOUNCE_DELAY: 500, // Debounce for inline editing
    RENDER_BATCH_SIZE: 50, // Cards to render per batch (for smooth rendering)
    ENABLE_AUTO_REFRESH: true // Changed from false to true
};

// --- GLOBAL FLAGS ---
window.interactionPaused = false; // set true khi mở modal/context, false khi đóng
let _mxhGroupsTick = 0;
let refreshAbortController;
let mxhInlineEditActive = false;
let mxhInlineEditReleaseTimer = null;
let mxhInlineEditSelection = null;
let mxhLastDocumentPointerDownAt = 0;
let mxhCommitInlineEditOnBlur = false;

function isMXHEditableElement(el) {
    return !!(el && el.closest && el.closest('.editable-field[contenteditable="true"]'));
}

function isMXHInlineEditing() {
    return mxhInlineEditActive || isMXHEditableElement(document.activeElement);
}

function setMXHInlineEditActive(active) {
    if (mxhInlineEditReleaseTimer) {
        clearTimeout(mxhInlineEditReleaseTimer);
        mxhInlineEditReleaseTimer = null;
    }
    mxhInlineEditActive = active;
}

function isLeavingBrowserWindow() {
    return document.hidden || !document.hasFocus();
}

function shouldHoldMXHInlineEditOnBlur() {
    if (isLeavingBrowserWindow()) return true;
    if (mxhCommitInlineEditOnBlur) return false;
    return (performance.now() - mxhLastDocumentPointerDownAt) > 1200;
}

function captureMXHInlineEditSelection(targetEl = document.activeElement) {
    const el = isMXHEditableElement(targetEl) ? targetEl.closest('.editable-field[contenteditable="true"]') : null;
    if (!el) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return;

    const before = range.cloneRange();
    before.selectNodeContents(el);
    before.setEnd(range.startContainer, range.startOffset);

    mxhInlineEditSelection = {
        accountId: el.dataset.accountId,
        field: el.dataset.field,
        start: before.toString().length,
        end: before.toString().length + range.toString().length
    };
}

function setContentEditableRange(el, start, end) {
    const range = document.createRange();
    const selection = window.getSelection();
    let current = 0;
    let startSet = false;
    let endSet = false;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const next = current + node.nodeValue.length;

        if (!startSet && start <= next) {
            range.setStart(node, Math.max(0, start - current));
            startSet = true;
        }
        if (!endSet && end <= next) {
            range.setEnd(node, Math.max(0, end - current));
            endSet = true;
            break;
        }
        current = next;
    }

    if (!startSet) range.setStart(el, el.childNodes.length);
    if (!endSet) range.setEnd(el, el.childNodes.length);
    selection.removeAllRanges();
    selection.addRange(range);
}

function restoreMXHInlineEditSelection() {
    if (!mxhInlineEditSelection) return;

    const el = Array.from(document.querySelectorAll('.editable-field[contenteditable="true"]')).find(item =>
        item.dataset.accountId === mxhInlineEditSelection.accountId &&
        item.dataset.field === mxhInlineEditSelection.field
    );
    if (!el) return;

    el.focus({ preventScroll: true });
    setContentEditableRange(el, mxhInlineEditSelection.start, mxhInlineEditSelection.end);
}

function applyMXHDynamicStyles(root = document) {
    root.querySelectorAll('[data-mxh-color]').forEach(el => {
        el.style.setProperty('--mxh-color', el.dataset.mxhColor || '#6c757d');
    });
    root.querySelectorAll('[data-mxh-bg]').forEach(el => {
        el.style.setProperty('--mxh-bg', el.dataset.mxhBg || '#6c757d');
        el.style.setProperty('--mxh-fg', el.dataset.mxhFg || '#fff');
        el.style.setProperty('--mxh-border', el.dataset.mxhBorder || '1px solid rgba(255,255,255,.25)');
    });
}

document.addEventListener('focusin', (event) => {
    if (isMXHEditableElement(event.target)) setMXHInlineEditActive(true);
});

document.addEventListener('pointerdown', () => {
    mxhLastDocumentPointerDownAt = performance.now();
}, true);

document.addEventListener('keydown', (event) => {
    if (isMXHEditableElement(event.target) && event.key === 'Enter') {
        mxhCommitInlineEditOnBlur = true;
        setTimeout(() => { mxhCommitInlineEditOnBlur = false; }, 1000);
    }
}, true);

document.addEventListener('selectionchange', () => {
    if (isMXHEditableElement(document.activeElement)) captureMXHInlineEditSelection();
});

document.addEventListener('input', (event) => {
    if (isMXHEditableElement(event.target)) captureMXHInlineEditSelection();
});

document.addEventListener('focusout', (event) => {
    if (!isMXHEditableElement(event.target)) return;
    captureMXHInlineEditSelection(event.target);
    mxhInlineEditReleaseTimer = setTimeout(() => {
        if (isLeavingBrowserWindow()) {
            mxhInlineEditActive = true;
            return;
        }
        if (!document.hidden && !isMXHEditableElement(document.activeElement)) {
            mxhInlineEditActive = false;
        }
    }, 250);
});

window.addEventListener('blur', () => {
    if (isMXHEditableElement(document.activeElement)) {
        captureMXHInlineEditSelection();
        setMXHInlineEditActive(true);
    }
});

window.addEventListener('focus', () => {
    setTimeout(() => {
        if (!document.hidden && mxhInlineEditActive) {
            restoreMXHInlineEditSelection();
        }
        if (!document.hidden && !isMXHEditableElement(document.activeElement)) {
            mxhInlineEditActive = false;
        }
    }, 250);
});

// Tự dừng/bật auto-refresh theo trạng thái tab
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        captureMXHInlineEditSelection();
        stopAutoRefresh();
    } else {
        startAutoRefresh();
        if (mxhInlineEditActive) setTimeout(restoreMXHInlineEditSelection, 50);
    }
});

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

const mxhAccountsContainer = document.getElementById('mxh-accounts-container');
if (mxhAccountsContainer) {
    mxhAccountsContainer.addEventListener('click', (event) => {
        if (event.target.closest('.mxh-card-number-edit')) {
            event.stopPropagation();
        }
    });
    mxhAccountsContainer.addEventListener('contextmenu', (event) => {
        const card = event.target.closest('.mxh-card[data-card-id]');
        if (!card || !mxhAccountsContainer.contains(card)) return;
        window.handleCardContextMenu(
            event,
            Number(card.dataset.cardId),
            Number(card.dataset.accountId),
            card.dataset.platform
        );
    });
    mxhAccountsContainer.addEventListener('keydown', (event) => {
        const field = event.target.closest('.editable-field[contenteditable="true"]');
        if (!field || !mxhAccountsContainer.contains(field)) return;
        if (event.key === 'Enter') {
            event.preventDefault();
            field.blur();
        }
    });
    mxhAccountsContainer.addEventListener('blur', (event) => {
        const field = event.target.closest('.editable-field[contenteditable="true"]');
        if (!field || !mxhAccountsContainer.contains(field)) return;
        window.saveInlineEdit(field, Number(field.dataset.accountId), field.dataset.field);
    }, true);
}

function trySetDefaultPlatform() {
    if (_mxhDefaultPlatformSet) return false;

    // Nếu user đã chọn trước đó thì không auto override
    if (activeGroupId !== null) {
        _mxhDefaultPlatformSet = true;
        return false;
    }

    const wechatGroup = mxhGroups.find(g => String(g.name || '').toLowerCase() === 'wechat')
        || mxhGroups.find(g => String(g.name || '').toLowerCase().includes('wechat'));

    if (wechatGroup) {
        activeGroupId = wechatGroup.id;
        _mxhDefaultPlatformSet = true;
        renderGroupsNav();
        return true;
    }

    // Không có WeChat group => thôi, giữ "Tất cả" (set 1 lần để tránh giật)
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
        get mxhGroups() { return mxhGroups; },
        get activeGroupId() { return activeGroupId; },
        get activeFilter() { return activeFilter; },
        set activeFilter(value) { activeFilter = value; },
        get activeViewFilter() { return activeViewFilter; },
        set activeViewFilter(value) { activeViewFilter = value; },
        get mxhSearchQuery() { return mxhSearchQuery; },
        set mxhSearchQuery(value) { mxhSearchQuery = value; },
        get currentContextAccountId() { return currentContextAccountId; },
        setCurrentContext(cardId, accountId) {
            currentContextCardId = cardId;
            currentContextAccountId = accountId;
        },
        setMXHInlineEditActive,
        clearMXHInlineEditSelection() { mxhInlineEditSelection = null; },
        setMXHCommitInlineEditOnBlur(value) { mxhCommitInlineEditOnBlur = value; },
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
        canScanWeChat,
        canScanWeChatHK,
        ensureNoticeParsed,
        needsHongKongNumber,
        renderCardFace,
        applyQuickFilter,
        isMXHInlineEditing,
        shouldHoldMXHInlineEditOnBlur,
        captureMXHInlineEditSelection,
        initializeTooltips,
        updateCardVisibility,
        loadMXHData,
        scheduleRender,
        requestFullRebuild,
        showToast: (...args) => {
            if (typeof showToast === 'function') showToast(...args);
        },
        showAlert: (...args) => {
            if (typeof showAlert === 'function') {
                showAlert(...args);
            } else {
                window.alert(args[0]);
            }
        },
        confirm: (...args) => confirm(...args),
        pauseAutoRefresh,
        resumeAutoRefresh
    };
}


// ===== REAL-TIME DATA LOADING WITH SMART UPDATES =====
// Load MXH data from API with optimized rendering
async function loadMXHData(forceRender = false) {
    if (isMXHInlineEditing()) return; // Keep caret/selection stable while editing inline fields.
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

    autoRefreshTimer = setInterval(async () => {
        await loadMXHData(false); // Don't force render, only if data changed
    }, MXH_CONFIG.AUTO_REFRESH_INTERVAL);

    // console.log('✅ MXH Auto-refresh enabled (every', MXH_CONFIG.AUTO_REFRESH_INTERVAL / 1000, 'seconds)');
}

function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
}

// Pause auto-refresh when user is interacting (context menu open, modal open, etc.)
let interactionPaused = false;
function pauseAutoRefresh() {
    interactionPaused = true;
}

function resumeAutoRefresh() {
    interactionPaused = false;
}

async function ensurePlatformGroup(platform) {
    return await MXHAccountActions.ensurePlatformGroup(platform);
}


// Get card badge for individual cards (positioned like group badge)
// 🔍 Updated to accept allAccounts to check all accounts in the card
function getCardBadge(account, allAccounts = []) {
    const now = new Date();
    let badgeInfo = {
        total: 0,
        noticeExpired: 0,
        noticeExpiredAccounts: [], // 🔍 Track which accounts have expired notices
        needHongKong: 0,
        needHongKongAccounts: [] // 🔍 Track which accounts need HK number
    };

    // Get all accounts of this card
    const cardAccounts = allAccounts.length > 0 ? allAccounts : [account];

    // Check all accounts in the card
    cardAccounts.forEach((acc, idx) => {
        // 🟠 Cam: Check if notice countdown finished (causes blink)
        if (acc.notice) {
            const noticeObj = ensureNoticeParsed(acc.notice);
            if (noticeObj && noticeObj.enabled && noticeObj.start_at && noticeObj.days) {
                const startDate = new Date(noticeObj.start_at);
                const endDate = new Date(startDate.getTime() + noticeObj.days * 24 * 60 * 60 * 1000);
                if (now >= endDate) {
                    badgeInfo.noticeExpired++;
                    badgeInfo.total++;
                    badgeInfo.noticeExpiredAccounts.push({
                        index: idx + 1,
                        username: acc.username || 'Không tên',
                        isPrimary: acc.is_primary
                    });
                }
            }
        }

        // ⚪ Trắng: Check if account is 1 year old but still NOT Hong Kong number (IMPROVED with precise time calculation)
        if (acc.platform === 'wechat' && acc.wechat_created_year) {
            const createdDate = new Date(
                acc.wechat_created_year,
                (acc.wechat_created_month || 1) - 1,
                acc.wechat_created_day || 1
            );
            const totalHours = calculateTimeDifferenceInHours(createdDate, now);
            const totalDays = Math.floor(totalHours / 24);

            if (totalDays >= 365) {
                // Check if Hong Kong number
                const phone = (acc.phone || '').replace(/[\s+]/g, '');
                const isHongKongNumber = phone.startsWith('852');
                if (!isHongKongNumber) {
                    badgeInfo.needHongKong++;
                    badgeInfo.total++;
                    badgeInfo.needHongKongAccounts.push({
                        index: idx + 1,
                        username: acc.username || 'Không tên',
                        isPrimary: acc.is_primary
                    });
                }
            }
        }
    });

    // Return badge HTML if there are issues
    let badges = '';

    // Badge ĐẾN HẠN (đỏ) - ưu tiên cao nhất
    if (badgeInfo.noticeExpired > 0) {
        // 🔍 Build detailed message for notice
        const accountsList = badgeInfo.noticeExpiredAccounts.map(a =>
            `Tài khoản thứ ${a.index}`
        ).join(', ');

        let noticeCache = '';
        if (account.notice) {
            try {
                const noticeObj = ensureNoticeParsed(account.notice);
                if (noticeObj && noticeObj.enabled) {
                    // 🔍 Calculate start date and due date
                    const startDate = noticeObj.start_at ? new Date(noticeObj.start_at) : null;
                    const dueDate = noticeObj.due_date ? new Date(noticeObj.due_date) : null;

                    noticeCache = JSON.stringify({
                        title: noticeObj.title || 'Thông báo đến hạn',
                        message: accountsList + ' đã đến hạn',
                        due_human: dueDate ? dueDate.toLocaleDateString('vi-VN') : '',
                        start_human: startDate ? startDate.toLocaleDateString('vi-VN') : '',
                        due_at: noticeObj.due_date,
                        start_at: noticeObj.start_at,
                        notice_id: account.id,
                        accounts: badgeInfo.noticeExpiredAccounts
                    });
                }
            } catch (e) {
                console.error('🔍 Error parsing notice cache:', e);
            }
        }

        badges += `<span class="group-badge card-top-badge notice-badge mxh-badge-due" 
                            data-badge-type="due"
                            data-account-id="${account.id}"
                            data-notice-id="${account.id}"
                            ${noticeCache ? `data-notice-cache='${noticeCache}'` : ''}
                            title="Thông báo đến hạn">
                    </span>`;
    }

    // Badge ĐỦ 1 NĂM (trắng) - chỉ hiển thị nếu không có badge đỏ
    if (badgeInfo.needHongKong > 0 && badgeInfo.noticeExpired === 0) {
        // 🔍 Build detailed message for 1-year anniversary
        const accountsList = badgeInfo.needHongKongAccounts.map(a =>
            `Tài khoản thứ ${a.index}`
        ).join(', ');

        const anniversaryCache = JSON.stringify({
            title: 'Đủ tuổi 1 năm',
            message: accountsList + ' đã đủ 1 năm tuổi',
            accounts: badgeInfo.needHongKongAccounts
        });

        badges += `<span class="group-badge card-top-badge notice-badge mxh-badge-anniversary" 
                            data-badge-type="anniversary"
                            data-account-id="${account.id}"
                            data-anniversary-cache='${anniversaryCache}'
                            title="Tài khoản đủ tuổi 1 năm">
                        1Y
                    </span>`;
    }

    // Badge NEARBY PEOPLE (xanh dương) - CHỈ hiển thị khi:
    // - Tài khoản KHÔNG bị Die
    // - Tài khoản >= 1 năm tuổi
    // - Nearby People đang ở trạng thái Active (không đếm ngược)
    const nearbyActiveAccounts = cardAccounts.filter(acc => isNearbyPeopleActive(acc));
    if (nearbyActiveAccounts.length > 0 && badgeInfo.noticeExpired === 0) {
        badges += `<span class="group-badge card-top-badge nearby-eligible-badge mxh-badge-nearby"
                            data-badge-type="nearby-eligible"
                            data-account-id="${account.id}"
                            title="Đủ điều kiện Nearby People (>= 1 năm tuổi - Active)">
                        <i class="bi bi-geo-alt-fill"></i>
                    </span>`;
    }

    return badges;
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
    const now = new Date();
    let badgeInfo = {
        total: 0,
        noticeExpired: 0,
        needHongKong: 0
    };

    mxhAccounts.forEach(account => {
        if (account.group_id != groupId) return;

        // 🟠 Cam: Check if notice countdown finished (causes blink)
        if (account.notice) {
            const noticeObj = ensureNoticeParsed(account.notice);
            if (noticeObj && noticeObj.enabled && noticeObj.start_at && noticeObj.days) {
                const startDate = new Date(noticeObj.start_at);
                const endDate = new Date(startDate.getTime() + noticeObj.days * 24 * 60 * 60 * 1000);
                if (now >= endDate) {
                    badgeInfo.noticeExpired++;
                    badgeInfo.total++;
                }
            }
        }

        // ⚪ Trắng: Check if account is 1 year old but still NOT Hong Kong number (IMPROVED with precise time calculation)
        if (account.platform === 'wechat' && account.wechat_created_year) {
            const createdDate = new Date(account.wechat_created_year, account.wechat_created_month - 1, account.wechat_created_day);
            const totalHours = calculateTimeDifferenceInHours(createdDate, now);
            const totalDays = Math.floor(totalHours / 24);

            if (totalDays >= 365) {
                // Check if Hong Kong number
                const primaryPhone = (account.phone || '').replace(/[\s+]/g, '');
                const isHongKongNumber = primaryPhone.startsWith('852');
                if (!isHongKongNumber) {
                    badgeInfo.needHongKong++;
                    badgeInfo.total++;
                }
            }
        }

        // Check secondary account for WeChat (only if blinks) (IMPROVED with precise time calculation)
        if (account.platform === 'wechat' && account.secondary_wechat_created_year) {
            const secCreatedDate = new Date(
                account.secondary_wechat_created_year,
                (account.secondary_wechat_created_month || 1) - 1,
                account.secondary_wechat_created_day || 1
            );
            const secTotalHours = calculateTimeDifferenceInHours(secCreatedDate, now);
            const secTotalDays = Math.floor(secTotalHours / 24);

            if (secTotalDays >= 365) {
                // Check if Hong Kong number
                const secondaryPhone = (account.secondary_phone || '').replace(/[\s+]/g, '');
                const isHongKongNumber = secondaryPhone.startsWith('852');
                if (!isHongKongNumber) {
                    badgeInfo.needHongKong++;
                    badgeInfo.total++;
                }
            }
        }
    });

    return badgeInfo;
}

// Update badge dots on main MXH nav tab
function updateMainNavBadge() {
    const mxhNavLink = document.querySelector('a[href*="mxh"]');
    if (!mxhNavLink) return;

    // Remove existing badge
    const existingBadge = mxhNavLink.querySelector('.nav-badge-container');
    if (existingBadge) existingBadge.remove();

    // Calculate total badge count across all groups
    const uniqueGroupIds = [...new Set(mxhAccounts.map(acc => acc.group_id).filter(id => id))];
    let totalBadgeCount = 0;
    let hasNoticeExpired = false;
    let hasNeedHongKong = false;

    uniqueGroupIds.forEach(groupId => {
        const badgeInfo = calculateGroupBadge(groupId);
        if (badgeInfo.total > 0) {
            totalBadgeCount += badgeInfo.total;
            if (badgeInfo.noticeExpired > 0) hasNoticeExpired = true;
            if (badgeInfo.needHongKong > 0) hasNeedHongKong = true;
        }
    });

    if (totalBadgeCount > 0) {
        const badgeContainer = document.createElement('div');
        badgeContainer.className = 'nav-badge-container';

        // Create red badge similar to group badge
        const badge = document.createElement('span');
        badge.className = 'group-badge nav-badge';
        badge.style.cssText = `
                position: absolute;
                top: 2px;
                right: -8px;
                background-color: #dc3545;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                font-size: 0.7rem;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 8px #dc354540;
                animation: pulse 2s infinite;
                z-index: 10;
            `;

        // Show count or priority indicator
        if (hasNoticeExpired) {
            badge.textContent = '!';
            badge.title = `${totalBadgeCount} thông báo cần chú ý`;
        } else {
            badge.textContent = totalBadgeCount > 99 ? '99+' : totalBadgeCount;
            badge.title = `${totalBadgeCount} tài khoản cần chú ý`;
        }

        badgeContainer.appendChild(badge);
        mxhNavLink.appendChild(badgeContainer);
    }
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

function updateCardVisibility_OLD(searchQuery) {
    const cols = document.querySelectorAll('.mxh-card-col');
    const filterDims = (activeFilter === 'wechat_scan' || activeFilter === 'wechat_scan_vn' || activeFilter === 'wechat_scan_hk' || activeFilter === 'has_notice' || activeFilter === 'wechat_created_day'); // Added basic check logic
    const viewDims = (activeViewFilter === 'card2' || activeViewFilter === 'card3');
    const shouldDim = filterDims || viewDims || searchQuery.length > 0;

    cols.forEach(col => {
        const cardId = col.dataset.cardId;
        // Get all accounts for this card from global data
        // Optimization: We could cache this mapping, but find is fast enough for <1000 items
        const accounts = mxhAccounts.filter(acc => String(acc.card_id) === String(cardId));

        // 1. Check Search Match
        let isSearchMatch = true;
        if (searchQuery) {
            // Check if ANY account in this card matches search
            isSearchMatch = accounts.some(acc => {
                const cardName = (acc.card_name || '').toLowerCase();
                const username = (acc.username || '').toLowerCase();
                const phone = (acc.phone || '').toLowerCase();
                const email = (acc.email || '').toLowerCase();
                const loginUser = (acc.login_username || '').toLowerCase();
                const nickname = (acc.wechat_nickname || '').toLowerCase();
                return cardName.includes(searchQuery) ||
                    username.includes(searchQuery) ||
                    phone.includes(searchQuery) ||
                    email.includes(searchQuery) ||
                    loginUser.includes(searchQuery) ||
                    nickname.includes(searchQuery);
            });
        }

        // 2. Check Filter Match
        let isFilterMatch = true;
        if (filterDims) {
            if (activeFilter === 'wechat_scan' || activeFilter === 'wechat_scan_vn') {
                isFilterMatch = accounts.some(a => canScanWeChat(a));
            } else if (activeFilter === 'wechat_scan_hk') {
                isFilterMatch = accounts.some(a => canScanWeChatHK(a));
            } else if (activeFilter === 'has_notice') {
                isFilterMatch = accounts.some(a => {
                    const noticeObj = ensureNoticeParsed(a.notice);
                    return (noticeObj && (noticeObj.enabled === true || noticeObj.enabled === 1 || Number(noticeObj.days) > 0));
                });
            }
        }

        // 3. Check View Filter
        let isViewMatch = true;
        // if (viewDims) ... (Logic view filter 2/3 cards - tạm thời coi như match hết cho đơn giản visual filter)

        // Final Match State
        const isMatch = isSearchMatch && isFilterMatch && isViewMatch;

        const wrapper = col.querySelector('.mxh-card-wrapper');
        const overlay = wrapper.querySelector('.mxh-filter-overlay');

        if (isMatch) {
            // Show
            wrapper.classList.remove('mxh-filtered-out');
            if (overlay) overlay.style.display = 'none';
            col.style.order = "-1"; // Bring to top
        } else {
            // Dim

            col.style.order = "0"; // Valid matches go first
        }
    });
}

// === NEW: Flip Card Function (Single Flip Animation) ===
function flipCardToAccount(cardId, accountId) {
    return MXHFlipCard.flipCardToAccount(getRenderContext(), cardId, accountId);
}

// Helper function for notice configuration
function configureNoticeToggleFor(menuId, account) {
    const el = document.querySelector(`#${menuId} [id$="-notice-toggle"]`);
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

// Context menu click handler
document.addEventListener('click', async function (e) {
    const menuItem = e.target.closest('.mxh-menu-item[data-action]');
    if (!menuItem) return;

    e.preventDefault();
    e.stopPropagation();

    const action = menuItem.getAttribute('data-action');

    if (action === 'switch-account') {
        const accountId = parseInt(menuItem.getAttribute('data-account-id'));
        if (currentContextCardId && accountId) {
            flipCardToAccount(currentContextCardId, accountId);
            hideCardContextMenu();
        }
    } else if (action === 'add-sub-shelter') {
        if (currentContextCardId) {
            await createSubAccount(currentContextCardId, 'shelter');
            hideCardContextMenu();
        }
    } else if (action === 'add-sub-security-folder') {
        if (currentContextCardId) {
            await createSubAccount(currentContextCardId, 'security_folder');
            hideCardContextMenu();
        }
    } else if (action === 'add-sub-multi-user') {
        if (currentContextCardId) {
            await createSubAccount(currentContextCardId, 'multi_user');
            hideCardContextMenu();
        }
    } else if (action === 'add-sub-clone-app') {
        if (currentContextCardId) {
            await createSubAccount(currentContextCardId, 'clone_app');
            hideCardContextMenu();
        }
    } else if (action === 'status-active') {
        if (currentContextAccountId) {
            await updateAccountStatusNew(currentContextAccountId, 'active');
            hideCardContextMenu();
        }
    } else if (action === 'status-disabled') {
        if (currentContextAccountId) {
            await updateAccountStatusNew(currentContextAccountId, 'disabled');
            hideCardContextMenu();
        }
    } else if (action === 'status-unverify') {
        if (currentContextAccountId) {
            await updateWechatVerifyStatus(currentContextAccountId, 'unverified');
            hideCardContextMenu();
        }
    } else if (action === 'status-verify-success') {
        if (currentContextAccountId) {
            await updateWechatVerifyStatus(currentContextAccountId, null);
            hideCardContextMenu();
        }
    } else if (action === 'rescue-success' || action === 'rescue-failed') {
        const result = action === 'rescue-success' ? 'success' : 'failed';
        if (currentContextAccountId) {
            await rescueAccountAction(currentContextAccountId, result);
            hideCardContextMenu();
        }
    } else if (action === 'scan-wechat') {
        if (currentContextAccountId) {
            await scanWeChatAccount(currentContextAccountId);
            hideCardContextMenu();
        }
    } else if (action === 'reset-scan') {
        if (currentContextAccountId) {
            await resetScanCountNew(currentContextAccountId);
            hideCardContextMenu();
        }
    } else if (action === 'scan-history') {
        if (currentContextAccountId) {
            openScanHistoryModal(currentContextAccountId);
            hideCardContextMenu();
        }
    } else if (action === 'delete') {
        // Check if it's primary account
        const account = mxhAccounts.find(acc => acc.id === currentContextAccountId);
        if (account && account.is_primary) {
            // Delete entire card
            if (currentContextCardId) {
                await deleteCard(currentContextCardId);
                hideCardContextMenu();
            }
        } else {
            // Delete only this account
            if (currentContextAccountId) {
                await deleteSubAccount(currentContextAccountId);
                hideCardContextMenu();
            }
        }
    } else if (action === 'edit') {
        if (currentContextAccountId) {
            openAccountModalForEdit(currentContextAccountId);
            hideCardContextMenu();
        }
        // copy-nickname removed
    } else if (action === 'copy-phone') {
        const account = mxhAccounts.find(acc => acc.id === currentContextAccountId);
        if (account && account.phone) {
            navigator.clipboard.writeText(account.phone);
            if (typeof showToast === 'function') {
                showToast(`Đã copy: ${account.phone}`, 'success');
            }
        }
        hideCardContextMenu();
    } else if (action === 'nearby-active') {
        if (currentContextAccountId) {
            handleNearbyAction(currentContextAccountId, 'active');
        }
        hideCardContextMenu();
    } else if (action === 'toggle-notice') {
        if (currentContextAccountId) {
            openNoticeModal(null); // Sử dụng function có sẵn
            hideCardContextMenu();
        }
    } else if (action === 'cancel-notice') {
        if (currentContextAccountId) {
            await cancelNotice(currentContextAccountId);
            hideCardContextMenu();
        }
    } else if (action === 'move-account') {
        if (currentContextAccountId) {
            openMoveAccountModal(currentContextAccountId);
            hideCardContextMenu();
        }
    }
});

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









// Initialize cards per row setting
(function initializeCardsPerRow() {
    const savedCardsPerRow = localStorage.getItem('mxh_cards_per_row') || 12;
    const cardsPerRowInput = document.getElementById('mxh-cards-per-row');
    if (cardsPerRowInput) {
        cardsPerRowInput.value = savedCardsPerRow;
    }
    const style = document.createElement('style');
    style.id = 'mxh-dynamic-style';
    style.innerHTML = `
        #mxh-accounts-container .row > .col {
            flex: 0 0 calc(100% / ${savedCardsPerRow});
            max-width: calc(100% / ${savedCardsPerRow});
        }
    `;
    document.head.appendChild(style);
})();


// Initialize - Load data and start auto-refresh
document.addEventListener('DOMContentLoaded', async () => {
    // console.log('🚀 MXH Tab Initializing...');

    // Initialize Account Actions
    MXHAccountActions.init(getRenderContext());



    // Ensure groups are rendered after initial load
    renderGroupsNav();

    // Update main nav badge immediately
    updateMainNavBadge();

    // Backup: Force render groups after a short delay to ensure DOM is ready
    setTimeout(() => {
        renderGroupsNav();
        updateMainNavBadge();
        checkNoticeExpirations(); // Check for expired notices on load
    }, 100);
    document.addEventListener('DOMContentLoaded', async () => {
        MXHAccountActions.init(getRenderContext());

        await loadMXHData(true);

        startAutoRefresh();

        MXHContextMenu.bindBackgroundContextMenu(getRenderContext());
    });
    // Start auto-refresh
    startAutoRefresh();

    // Function to check and notify expired notices
    function checkNoticeExpirations() {
        if (typeof showPlatformNotification !== 'function') return;

        const notifiedKey = 'mxh_notified_notices_session';
        let notifiedSet;
        try {
            notifiedSet = new Set(JSON.parse(sessionStorage.getItem(notifiedKey) || '[]'));
        } catch (e) {
            notifiedSet = new Set();
        }

        const now = new Date();

        mxhAccounts.forEach(acc => {
            if (!acc.notice) return;
            const n = ensureNoticeParsed(acc.notice);
            if (!n || !n.enabled) return;

            const start = n.start_at ? new Date(n.start_at) : null;
            const days = Number(n.days) || 0;
            if (!start || days <= 0) return;

            const due = new Date(start.getTime() + days * 86400000);

            // If expired (or within last 24h to be safe/noisy?) -> Just expired check
            if (now >= due) {
                const key = `${acc.id}_${n.title}_${due.getTime()}`;
                if (!notifiedSet.has(key)) {
                    const accName = acc.username || acc.wechat_nickname || `Card ${acc.card_name}`;
                    showPlatformNotification('⚠️ Thông báo ĐẾN HẠN', `${accName} - ${n.title}: ${n.note || ''}`);
                    notifiedSet.add(key);
                }
            }
        });

        sessionStorage.setItem(notifiedKey, JSON.stringify([...notifiedSet]));
    }

    // Pause auto-refresh when modal is opened
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('show.bs.modal', () => {
            window.interactionPaused = true;
            pauseAutoRefresh();
        });
        modal.addEventListener('hide.bs.modal', () => {
            window.interactionPaused = false;
            resumeAutoRefresh();
        });
    });

    // Handle page visibility changes (pause when tab not visible)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoRefresh();
            // console.log('⏸️ MXH Auto-refresh paused (tab hidden)');
        } else {
            startAutoRefresh();
            if (!isMXHInlineEditing()) loadMXHData(false); // Resume quietly without rebuilding an active edit.
            // console.log('▶️ MXH Auto-refresh resumed (tab visible)');
        }
    });

    // ===== THÊM VÀO TỪ ĐÂY =====
    // Handle Filter Dropdown Clicks
    const filterMenu = document.querySelector('.dropdown-menu[aria-labelledby="mxh-filter-btn"]');
    if (filterMenu) {
        filterMenu.addEventListener('click', (e) => {
            e.preventDefault();
            const targetItem = e.target.closest('.dropdown-item');
            if (!targetItem) return;

            const filterType = targetItem.dataset.filter;
            if (!filterType) return;

            activeFilter = filterType;

            // Cập nhật giao diện nút
            const filterButton = document.getElementById('mxh-filter-btn');

            // Xóa 'active' khỏi tất cả item
            filterMenu.querySelectorAll('.dropdown-item').forEach(item => {
                item.classList.remove('active');
            });
            // Thêm 'active' cho item được chọn
            targetItem.classList.add('active');

            if (filterType === 'default') {
                // Reset về mặc định
                filterButton.innerHTML = `<i class="bi bi-funnel me-1"></i> Lọc`;
                filterButton.classList.remove('btn-primary');
                filterButton.classList.add('btn-outline-secondary');
            } else {
                // Hiển thị filter đang chọn
                filterButton.innerHTML = `<i class="bi bi-funnel-fill me-1"></i> ${targetItem.textContent.trim()}`;
                filterButton.classList.add('btn-primary');
                filterButton.classList.remove('btn-outline-secondary');
            }

            // Trigger re-render
            scheduleRender();
        });
    }

    // ===== 🔍 START: Xử lý sự kiện cho Thanh Tìm Kiếm =====
    const searchInput = document.getElementById('mxh-search-input');
    const clearButton = document.getElementById('mxh-search-clear');
    const searchGroup = document.getElementById('mxh-search-group');

    if (searchInput && clearButton && searchGroup) {
        // Hàm xử lý tìm kiếm
        const handleSearch = (event) => {
            const query = event.target.value;
            mxhSearchQuery = query; // Cập nhật biến global

            // Hiển thị/ẩn nút clear (X)
            if (query) {
                clearButton.style.display = 'block';
            } else {
                clearButton.style.display = 'none';
            }

            // Lên lịch render lại
            scheduleRender();
        };

        // Dùng debounce (đã có sẵn) để tránh lag
        searchInput.addEventListener('input', debounce(handleSearch, 250));

        // Xử lý nút Xóa
        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            mxhSearchQuery = '';
            clearButton.style.display = 'none';
            searchInput.focus();
            scheduleRender();
        });
    }
    // ===== 🔍 END: Xử lý sự kiện cho Thanh Tìm Kiếm =====

    MXHContextMenu.bindBackgroundContextMenu(getRenderContext());

    // console.log('✅ MXH Tab Ready - Real-time mode enabled!');
});

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

window.copyPhoneHistory = function (phone) {
    return MXHPhoneHistory.copyPhoneHistory(getRenderContext(), phone);
};

MXHPhoneHistory.bindControls(getRenderContext());

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


// Submenu state variables
let currentSubmenu = null;
let hideTimeout = null;

// Function to show submenu
function showSubmenu(menuItem) {
    // Hide previous submenu
    if (currentSubmenu && currentSubmenu !== menuItem) {
        const prevSubmenu = currentSubmenu.querySelector('.submenu');
        if (prevSubmenu) {
            prevSubmenu.classList.remove('show');
        }
    }

    // Show new submenu
    const submenuEl = menuItem.querySelector('.submenu');
    if (submenuEl) {
        positionSubmenu(menuItem);
        submenuEl.classList.add('show');
        currentSubmenu = menuItem;

        // Create bridge based on position
        const isLeft = submenuEl.classList.contains('submenu-left');
        createSubmenuBridge(submenuEl, isLeft);
    }

    // Clear any pending hide timeout
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }
}

// Function to hide submenu with delay
function hideSubmenu(delay = 100) {
    if (hideTimeout) {
        clearTimeout(hideTimeout);
    }
    hideTimeout = setTimeout(() => {
        if (currentSubmenu) {
            const submenuEl = currentSubmenu.querySelector('.submenu');
            if (submenuEl) {
                submenuEl.classList.remove('show');
            }
            currentSubmenu = null;
        }
    }, delay);
}

// Event listeners
document.addEventListener('mouseover', function (event) {
    const menuItem = event.target.closest('.menu-item.has-submenu');
    const submenu = event.target.closest('.submenu');
    const bridge = event.target.closest('.submenu-bridge');

    if (menuItem) {
        showSubmenu(menuItem);
    } else if (submenu || bridge) {
        // Keep submenu open when hovering over submenu or bridge
        if (currentSubmenu) {
            const submenuEl = currentSubmenu.querySelector('.submenu');
            if (submenuEl) {
                submenuEl.classList.add('show');
            }
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
        }
    }
});

document.addEventListener('mouseout', function (event) {
    const menuItem = event.target.closest('.menu-item.has-submenu');
    const submenu = event.target.closest('.submenu');
    const bridge = event.target.closest('.submenu-bridge');

    if (!menuItem && !submenu && !bridge) {
        // Hide submenu when leaving all related elements
        hideSubmenu();
    }
});

// Also position submenus when context menu is shown
function positionAllSubmenus(menuId) {
    setTimeout(() => {
        const menu = document.getElementById(menuId);
        if (menu) {
            const submenuItems = menu.querySelectorAll('.menu-item.has-submenu');
            submenuItems.forEach(positionSubmenu);
        }
    }, 10);
}

MXHModalForms.init(getRenderContext());

// ===== NOTICE PREVIEW SYSTEM =====
MXHNoticePreview.init(getRenderContext());


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

MXHScanHistory.bindControls(getRenderContext());
