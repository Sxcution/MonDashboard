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

        // Ensure platform group exists
        async function ensurePlatformGroup(platform) {
            const existingGroup = mxhGroups.find(g => g.name.toLowerCase() === platform.toLowerCase());
            if (existingGroup) {
                return existingGroup.id;
            }

            try {
                const response = await MXHApi.createGroup({
                    name: platform.charAt(0).toUpperCase() + platform.slice(1),
                    color: getPlatformColor(platform)
                });

                if (response.ok) {
                    const newGroup = await response.json();
                    mxhGroups.push(newGroup);
                    return newGroup.id;
                } else {
                    throw new Error('Failed to create group');
                }
            } catch (error) {
                console.error('Error creating platform group:', error);
                throw error;
            }
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

        // Get next card number (per platform/group)
        async function getNextCardNumber(groupId) {
            // Get all accounts in the same group
            const groupAccounts = mxhAccounts.filter(acc => acc.group_id === groupId);
            const numbers = groupAccounts.map(acc => parseInt(acc.card_name)).filter(n => !isNaN(n));

            if (numbers.length === 0) return 1;

            // Find first available number starting from 1
            for (let i = 1; i <= numbers.length + 1; i++) {
                if (!numbers.includes(i)) {
                    return i;
                }
            }
            return Math.max(...numbers) + 1;
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

        // === Di Chuyển Tài Khoản sang Card khác ===
        function openMoveAccountModal(accountId) {
            const account = mxhAccounts.find(acc => acc.id === accountId);
            if (!account) return;

            document.getElementById('move-account-name').value = account.username || 'Không tên';
            document.getElementById('move-account-current-card').value = `Card ${account.card_name || '?'}`;
            document.getElementById('move-account-target-card').value = '';
            document.getElementById('move-account-error').style.display = 'none';
            document.getElementById('move-account-error').textContent = '';

            // Store account id for confirm handler
            document.getElementById('move-account-modal').dataset.accountId = accountId;

            const modal = new bootstrap.Modal(document.getElementById('move-account-modal'));
            modal.show();
        }

        document.getElementById('move-account-confirm-btn').addEventListener('click', async () => {
            const modalEl = document.getElementById('move-account-modal');
            const accountId = parseInt(modalEl.dataset.accountId);
            const targetCardName = document.getElementById('move-account-target-card').value.trim();
            const errorEl = document.getElementById('move-account-error');

            if (!targetCardName) {
                errorEl.textContent = 'Vui lòng nhập số card đích!';
                errorEl.style.display = 'block';
                return;
            }

            const account = mxhAccounts.find(acc => acc.id === accountId);
            if (!account) {
                errorEl.textContent = 'Không tìm thấy tài khoản!';
                errorEl.style.display = 'block';
                return;
            }

            // Prevent moving primary account
            if (account.is_primary) {
                errorEl.textContent = 'Không thể di chuyển tài khoản chính!';
                errorEl.style.display = 'block';
                return;
            }

            // Check same card
            if (account.card_name === targetCardName) {
                errorEl.textContent = 'Tài khoản đã thuộc card này!';
                errorEl.style.display = 'block';
                return;
            }

            // Find target card from mxhAccounts (find any account with matching card_name in same group)
            const targetAccount = mxhAccounts.find(acc =>
                acc.card_name === targetCardName && acc.group_id === account.group_id
            );

            if (!targetAccount) {
                errorEl.textContent = `Không tìm thấy Card ${targetCardName} trong cùng nhóm!`;
                errorEl.style.display = 'block';
                return;
            }

            const targetCardId = targetAccount.card_id;

            try {
                const response = await MXHApi.moveAccount(accountId, { target_card_id: targetCardId });

                if (response.ok) {
                    const result = await response.json();

                    // Update local data
                    const accountIndex = mxhAccounts.findIndex(acc => acc.id === accountId);
                    if (accountIndex !== -1) {
                        mxhAccounts[accountIndex].card_id = targetCardId;
                        mxhAccounts[accountIndex].card_name = targetCardName;
                    }

                    // Close modal and re-render
                    bootstrap.Modal.getInstance(modalEl).hide();
                    requestFullRebuild();
                    scheduleRender();
                    showToast(`✅ Đã chuyển tài khoản sang Card ${targetCardName}!`, 'success');
                } else {
                    const err = await response.json();
                    errorEl.textContent = err.error || 'Lỗi không xác định!';
                    errorEl.style.display = 'block';
                }
            } catch (error) {
                errorEl.textContent = 'Lỗi kết nối: ' + error.message;
                errorEl.style.display = 'block';
            }
        });

        // === NEW: Create Sub-Account ===
        async function createSubAccount(cardId, containerType) {
            try {
                // 🔍 Get current date for new sub-account
                const today = new Date();
                const currentDay = today.getDate();
                const currentMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
                const currentYear = today.getFullYear();

                console.log('🔍 Creating sub-account with date:', { day: currentDay, month: currentMonth, year: currentYear, containerType });

                const payload = {
                    wechat_created_day: currentDay,
                    wechat_created_month: currentMonth,
                    wechat_created_year: currentYear
                };
                if (containerType) {
                    payload.container_type = containerType;
                }

                const response = await MXHApi.createSubAccount(cardId, payload);

                if (response.ok) {
                    const newAccount = await response.json();
                    console.log('🔍 New account created:', newAccount);
                    console.log('🔍 New account full data:', JSON.stringify(newAccount, null, 2));

                    // 🔍 Merge dữ liệu mới vào mxhAccounts ngay lập tức để badge có thể tính toán
                    const existingIndex = mxhAccounts.findIndex(a => a.id === newAccount.id);
                    if (existingIndex >= 0) {
                        mxhAccounts[existingIndex] = newAccount;
                    } else {
                        mxhAccounts.push(newAccount);
                    }

                    // 🔍 Reload all data to ensure consistency and get full card info
                    await loadMXHData(true);

                    console.log('🔍 Data reloaded, mxhAccounts count:', mxhAccounts.length);

                    // 🔍 Gọi render lại ngay để badge được cập nhật
                    scheduleRender();

                    // Wait a bit more for render to complete, then flip to new account
                    setTimeout(() => {
                        console.log('🔍 Attempting to flip to account:', newAccount.id);
                        const accountExists = mxhAccounts.find(a => a.id === newAccount.id);
                        console.log('🔍 Account exists in mxhAccounts:', !!accountExists);
                        if (accountExists) {
                            console.log('🔍 Account data:', accountExists);
                        }
                        flipCardToAccount(cardId, newAccount.id);
                    }, 300);

                    if (typeof showToast === 'function') {
                        showToast('Đã tạo tài khoản phụ!', 'success');
                    }
                } else {
                    throw new Error('Failed to create sub-account');
                }
            } catch (error) {
                console.error('🔍 Error creating sub-account:', error);
                if (typeof showToast === 'function') {
                    showToast('Lỗi tạo tài khoản phụ!', 'error');
                }
            }
        }

        // === NEW: Delete Card (và tất cả accounts) ===
        async function deleteCard(cardId) {
            if (!(await showConfirm('Xóa card này và tất cả tài khoản trên card?'))) return;

            try {
                const response = await MXHApi.deleteCard(cardId);

                if (response.ok) {
                    // Remove from local state
                    mxhAccounts = mxhAccounts.filter(acc => acc.card_id !== cardId);
                    MXHState.deleteCardState(cardId);
                    scheduleRender();
                    if (typeof showToast === 'function') {
                        showToast('Đã xóa card!', 'success');
                    }
                } else {
                    throw new Error('Failed to delete card');
                }
            } catch (error) {
                console.error('Error deleting card:', error);
                if (typeof showToast === 'function') {
                    showToast('Lỗi xóa card!', 'error');
                }
            }
        }

        // === NEW: Delete Sub-Account ===
        async function deleteSubAccount(accountId) {
            if (!(await showConfirm('Xóa tài khoản phụ này?'))) return;

            try {
                const response = await MXHApi.deleteSubAccount(accountId);

                if (response.ok) {
                    // Remove from local state
                    // 🔍 Before removing, find the cardId to restore view
                    const subAcc = mxhAccounts.find(acc => acc.id === accountId);
                    const cardId = subAcc ? subAcc.card_id : null;

                    mxhAccounts = mxhAccounts.filter(acc => acc.id !== accountId);

                    // 🔍 Restore view to primary account if cardId exists
                    // 🔍 Restore view to primary account if cardId exists
                    if (cardId) {
                        const cardAccounts = mxhAccounts.filter(acc => Number(acc.card_id) === Number(cardId));
                        const primaryAcc = cardAccounts.find(acc => acc.is_primary) || cardAccounts[0];
                        if (primaryAcc) {
                            setCardState(Number(cardId), { activeAccountId: primaryAcc.id });
                            console.log(`🔍 Restored view to primary/first account ${primaryAcc.id} for card ${cardId}`);
                        }
                    }

                    requestFullRebuild();
                    scheduleRender();
                    if (typeof showToast === 'function') {
                        showToast('Đã xóa tài khoản phụ!', 'success');
                    }
                } else {
                    throw new Error('Failed to delete sub-account');
                }
            } catch (error) {
                console.error('Error deleting sub-account:', error);
                if (typeof showToast === 'function') {
                    showToast('Lỗi xóa tài khoản phụ!', 'error');
                }
            }
        }

        // === NEW: Rescue Account Action ===
        async function rescueAccountAction(accountId, result) {
            try {
                const response = await MXHApi.rescueAccount(accountId, { result });

                if (response.ok) {
                    // Update local state
                    const accountIndex = mxhAccounts.findIndex(acc => acc.id === accountId);
                    if (accountIndex !== -1) {
                        if (result === 'success') {
                            mxhAccounts[accountIndex].status = 'active';
                            mxhAccounts[accountIndex].die_date = null;
                            mxhAccounts[accountIndex].disabled_date = null;
                            mxhAccounts[accountIndex].rescue_success_count = (mxhAccounts[accountIndex].rescue_success_count || 0) + 1;
                        } else {
                            mxhAccounts[accountIndex].rescue_count = (mxhAccounts[accountIndex].rescue_count || 0) + 1;
                        }
                    }

                    scheduleRender();
                    const message = result === 'success' ? '✅ Cứu thành công!' : '📝 Đã ghi nhận cứu thất bại!';
                    if (typeof showToast === 'function') {
                        showToast(message, 'success');
                    }
                } else {
                    throw new Error('Failed to rescue account');
                }
            } catch (error) {
                console.error('Error rescuing account:', error);
                if (typeof showToast === 'function') {
                    showToast('Lỗi khi cứu tài khoản!', 'error');
                }
            }
        }

        // === NEW: Scan WeChat Account ===
        async function scanWeChatAccount(accountId) {
            // Instant local update
            const accountIndex = mxhAccounts.findIndex(acc => acc.id === accountId);
            if (accountIndex !== -1) {
                mxhAccounts[accountIndex].wechat_scan_count = (mxhAccounts[accountIndex].wechat_scan_count || 0) + 1;
                mxhAccounts[accountIndex].wechat_last_scan_date = new Date().toISOString();

                // Force full rebuild to ensure UI updates (e.g. scan count color)
                requestFullRebuild();
                scheduleRender();
            }

            try {
                const response = await MXHApi.scanAccount(accountId);

                if (response.ok) {
                    // Merge server response if available
                    const responseData = await response.json();
                    if (responseData && responseData.id) {
                        const idx = mxhAccounts.findIndex(acc => acc.id === accountId);
                        if (idx !== -1) {
                            mxhAccounts[idx] = responseData;

                            // Force full rebuild again to sync with server data
                            requestFullRebuild();
                            scheduleRender();
                        }
                    }

                    if (typeof showToast === 'function') {
                        showToast('✅ Đã ghi nhận quét WeChat!', 'success');
                    }
                } else {
                    throw new Error('Failed to record scan');
                }
            } catch (error) {
                console.error('Error scanning WeChat:', error);
                if (typeof showToast === 'function') {
                    showToast('Lỗi khi quét WeChat!', 'error');
                }
            }
        }


        // === NEW: Update Account Status (Disabled = Die UI) ===
        async function updateAccountStatusNew(accountId, status) {
            try {
                const payload = { status };

                // 🔍 Disabled (Die UI) ghi nhận ngày disabled, clear die_date cũ
                if (status === 'disabled') {
                    payload.disabled_date = new Date().toISOString().split('T')[0];
                    payload.die_date = null;
                } else {
                    // Active: clear cả die_date/disabled_date
                    payload.die_date = null;
                    payload.disabled_date = null;
                }

                const response = await MXHApi.updateAccount(accountId, payload);

                if (response.ok) {
                    const updatedAccount = await response.json();

                    // Update local state
                    const index = mxhAccounts.findIndex(acc => acc.id === accountId);
                    if (index !== -1) {
                        mxhAccounts[index] = updatedAccount;
                    }

                    // Force full rebuild to ensure UI updates (e.g. gray out card)
                    requestFullRebuild();
                    scheduleRender();
                    if (typeof showToast === 'function') {
                        showToast(`Đã cập nhật trạng thái: ${status}`, 'success');
                    }
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to update status');
                }
            } catch (error) {
                console.error('Error updating status:', error);
                if (typeof showToast === 'function') {
                    showToast(`Lỗi cập nhật trạng thái: ${error.message}`, 'error');
                }
            }
        }

        // === Update wechat_status (UnVerify / Verify Success) ===
        async function updateWechatVerifyStatus(accountId, wechatStatus) {
            try {
                const payload = { wechat_status: wechatStatus || 'available' };

                const response = await MXHApi.updateAccount(accountId, payload);

                if (response.ok) {
                    const updatedAccount = await response.json();

                    const index = mxhAccounts.findIndex(acc => acc.id === accountId);
                    if (index !== -1) {
                        mxhAccounts[index] = updatedAccount;
                    }

                    requestFullRebuild();
                    scheduleRender();
                    if (typeof showToast === 'function') {
                        const label = wechatStatus === 'unverified' ? 'UnVerify' : 'Verify Success';
                        showToast(`✅ Đã cập nhật: ${label}`, 'success');
                    }
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to update wechat_status');
                }
            } catch (error) {
                console.error('Error updating wechat verify status:', error);
                if (typeof showToast === 'function') {
                    showToast(`Lỗi cập nhật: ${error.message}`, 'error');
                }
            }
        }

        // Notice modal functions
        let noticeTargetId = null;
        function openNoticeModal(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!currentContextAccountId) return;

            noticeTargetId = currentContextAccountId;
            document.getElementById('noticeTitle').value = 'Dưỡng';
            document.getElementById('noticeDays').value = 30;
            document.getElementById('noticeNote').value = '';

            const modal = new bootstrap.Modal(document.getElementById('noticeModal'));
            modal.show();
        }

        async function submitNotice() {
            const title = document.getElementById('noticeTitle').value.trim();
            const days = parseInt(document.getElementById('noticeDays').value, 10) || 0;
            const note = document.getElementById('noticeNote').value.trim();

            if (!noticeTargetId || !title || days <= 0) {
                showToast('Vui lòng điền đầy đủ thông tin!', 'error');
                return;
            }

            try {
                // Pause auto-refresh to prevent race condition
                stopAutoRefresh();

                const response = await MXHApi.setNotice(noticeTargetId, { title, days, note });

                if (response.ok) {
                    showToast('✅ Đã đặt thông báo!', 'success');

                    // Update local data immediately to trigger render
                    const account = mxhAccounts.find(a => a.id === noticeTargetId);
                    if (account) {
                        const startDate = new Date();
                        const dueDate = new Date(startDate);
                        dueDate.setDate(dueDate.getDate() + days);

                        account.notice = {
                            enabled: true,
                            title: title,
                            days: days,
                            note: note,
                            start_at: startDate.toISOString(),
                            due_date: dueDate.toISOString()
                        };

                        // Force full rebuild to ensure UI updates
                        requestFullRebuild();
                    }

                    const modal = bootstrap.Modal.getInstance(document.getElementById('noticeModal'));
                    modal.hide();

                    // Force re-render with updated data
                    scheduleRender();

                    // Resume auto-refresh after render
                    setTimeout(() => startAutoRefresh(), 100);
                } else {
                    showToast('Lỗi khi đặt thông báo!', 'error');
                    startAutoRefresh(); // Resume even on error
                }
            } catch (error) {
                showToast('Lỗi kết nối!', 'error');
                startAutoRefresh(); // Resume even on error
            }
            noticeTargetId = null;
        }

        const submitNoticeBtn = document.getElementById('mxh-submit-notice-btn');
        if (submitNoticeBtn) {
            submitNoticeBtn.addEventListener('click', submitNotice);
        }

        async function clearNotice(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!currentContextAccountId) return;

            try {
                // Pause auto-refresh to prevent race condition
                stopAutoRefresh();

                const response = await MXHApi.deleteNotice(currentContextAccountId);

                if (response.ok) {
                    showToast('✅ Đã tắt thông báo!', 'success');

                    // Update local data immediately to trigger render
                    const account = mxhAccounts.find(a => a.id === currentContextAccountId);
                    if (account) {
                        account.notice = null; // Set to null instead of empty object

                        // Force full rebuild to ensure UI updates
                        requestFullRebuild();
                    }

                    // Force re-render with updated data
                    scheduleRender();

                    // Resume auto-refresh after render
                    setTimeout(() => startAutoRefresh(), 100);
                } else {
                    showToast('Lỗi khi xóa thông báo!', 'error');
                    startAutoRefresh(); // Resume even on error
                }
            } catch (error) {
                showToast('Lỗi kết nối!', 'error');
                startAutoRefresh(); // Resume even on error
            }
        }

        // Alias for cancel notice from context menu
        async function cancelNotice(accountId) {
            currentContextAccountId = accountId;
            await clearNotice(null);
        }

        // NEW: Reset scan count for new context menu
        async function resetScanCountNew(accountId) {
            if (!accountId) return;

            // Instant local update
            const accountIndex = mxhAccounts.findIndex(acc => acc.id === accountId);
            if (accountIndex !== -1) {
                mxhAccounts[accountIndex].wechat_scan_count = 0;
                mxhAccounts[accountIndex].wechat_last_scan_date = null;

                // Force full rebuild to ensure UI updates (e.g. scan count color)
                requestFullRebuild();
                scheduleRender();
            }

            try {
                const response = await MXHApi.resetScan(accountId);

                if (response.ok) {
                    // Merge server response if available
                    const responseData = await response.json();
                    if (responseData && responseData.id) {
                        const idx = mxhAccounts.findIndex(acc => acc.id === accountId);
                        if (idx !== -1) {
                            mxhAccounts[idx] = responseData;
                            // Force full rebuild again to sync with server data
                            requestFullRebuild();
                            scheduleRender();
                        }
                    }
                    showToast('✅ Đã reset lượt quét!', 'success');
                } else {
                    showToast('Lỗi!', 'error');
                    await loadMXHData(false);
                }
            } catch (error) {
                showToast('Lỗi kết nối!', 'error');
                await loadMXHData(false);
            }
        }

        // Open modal for editing account (WeChat or Generic)
        function openAccountModalForEdit(accountId) {
            currentContextAccountId = accountId;
            const account = mxhAccounts.find(acc => acc.id === accountId);

            if (!account) return;

            // Nếu là WeChat → mở WeChat modal, không thì mở generic modal
            if (account.platform === 'wechat') {
                openWeChatModal(accountId);
            } else {
                // Open generic modal for other platforms
                document.getElementById('generic-username').value = account.login_username || '';
                document.getElementById('generic-password').value = account.login_password || '';
                document.getElementById('generic-display-name').value = account.username || '';
                document.getElementById('generic-phone').value = account.phone || '';
                document.getElementById('generic-url').value = account.url || '';
                document.getElementById('generic-notes').value = account.notes || '';

                const modal = new bootstrap.Modal(document.getElementById('generic-account-modal'));
                modal.show();
            }
        }

        async function deleteAccount(accountId) {
            // Instant local update - remove from array
            const accountIndex = mxhAccounts.findIndex(acc => acc.id === accountId);
            if (accountIndex !== -1) {
                mxhAccounts.splice(accountIndex, 1);
            }
            scheduleRender();

            try {
                const response = await MXHApi.deleteAccount(accountId);

                if (response.ok) {
                    showToast('✅ Đã xóa card!', 'success');

                } else {
                    showToast('Lỗi!', 'error');
                    await loadMXHData(false);
                }
            } catch (error) {
                showToast('Lỗi kết nối!', 'error');
                await loadMXHData(false);
            }
        }

        async function resetAccount(accountId) {
            // Find the account and its card_id
            const accountIndex = mxhAccounts.findIndex(acc => acc.id === accountId);
            if (accountIndex === -1) {
                console.error(`Account ${accountId} not found for reset`);
                return;
            }

            const cardId = mxhAccounts[accountIndex].card_id;

            // Instant local update - reset all data
            const account = mxhAccounts[accountIndex];
            mxhAccounts[accountIndex] = {
                ...account, // Keep all existing fields
                id: account.id,
                card_id: account.card_id,
                platform: account.platform,
                group_id: account.group_id,
                card_name: account.card_name,
                is_primary: account.is_primary,
                // Reset these fields
                username: '.',
                phone: '.',
                wechat_nickname: '.',
                status: 'active',
                wechat_scan_count: 0,
                wechat_last_scan_date: null,
                die_date: null,
                disabled_date: null,
                rescue_count: 0,
                rescue_success_count: 0,
                notice: null,
                muted_until: null
            };

            // *** CRITICAL: Ensure activeAccountId is set BEFORE rendering ***
            // Force full rebuild to ensure UI updates
            requestFullRebuild();

            scheduleRender();

            try {
                const response = await MXHApi.resetAccount(accountId);

                if (response.ok) {
                    const updatedAccount = await response.json();
                    // Merge server response back into local data
                    const idx = mxhAccounts.findIndex(acc => acc.id === accountId);
                    if (idx !== -1) {
                        mxhAccounts[idx] = updatedAccount;
                        // Force full rebuild again to sync with server data
                        requestFullRebuild();
                        console.log(`✅ Reset account ${accountId}, keeping it as active for card ${cardId}`);
                        scheduleRender(); // Re-render with server data
                    }
                    showToast('✅ Đã reset card!', 'success');
                } else {
                    showToast('Lỗi!', 'error');
                    await loadMXHData(false);
                }
            } catch (error) {
                console.error('Error resetting account:', error);
                showToast('Lỗi kết nối!', 'error');
                await loadMXHData(false);
            }
        }

        // Modal Button Handlers with instant updates
        document.getElementById('mxh-save-account-btn').addEventListener('click', async () => {
            const platform = document.getElementById('mxh-platform').value;
            const username = (document.getElementById('mxh-username').value || '.').trim() || '.';
            const password = (document.getElementById('mxh-password')?.value || '.').trim() || '.';
            const phone = (document.getElementById('mxh-phone').value || '.').trim() || '.';
            const url = (document.getElementById('mxh-url').value || '.').trim() || '.';
            const day = parseInt(document.getElementById('mxh-day').value, 10);
            const month = parseInt(document.getElementById('mxh-month').value, 10);
            const year = parseInt(document.getElementById('mxh-year').value, 10);

            // Chỉ bắt buộc: NỀN TẢNG + NGÀY/THÁNG/NĂM (đã auto-fill)
            if (!platform || !day || !month || !year) {
                showToast('Chọn Nền tảng và Ngày tạo!', 'error');
                return;
            }

            try {
                const groupId = await ensurePlatformGroup(platform);
                const autoCardNumber = (await getNextCardNumber(groupId)).toString();

                const res = await MXHApi.createAccount({
                    card_name: autoCardNumber,
                    group_id: groupId,
                    platform,
                    username,             // nếu trống đã là "."
                    phone,
                    url,
                    login_username: ".",  // lưu cặp thông tin đăng nhập để hiện sau này
                    login_password: password,
                    wechat_created_day: day,
                    wechat_created_month: month,
                    wechat_created_year: year
                });

                if (res.ok) {
                    showToast('✅ Đã tạo card!', 'success');
                    bootstrap.Modal.getInstance(document.getElementById('mxh-addAccountModal')).hide();
                    await loadMXHData(false);
                } else {
                    const err = await res.json();
                    showToast(err.error || 'Lỗi khi tạo tài khoản!', 'error');
                }
            } catch {
                showToast('Lỗi kết nối!', 'error');
            }
        });

        document.getElementById('wechat-apply-btn').addEventListener('click', async () => {
            if (!currentContextAccountId) return;

            const selectedStatus = document.getElementById('wechat-status').value;

            // Get date value from single input and parse it
            const dateValue = document.getElementById('wechat-date').value;
            const dateParts = dateValue.split('/');
            const day = parseInt(dateParts[0]) || 1;
            const month = parseInt(dateParts[1]) || 1;
            const year = parseInt(dateParts[2]) || 2024;

            const data = {
                card_name: document.getElementById('wechat-card-name').value,
                username: document.getElementById('wechat-username').value,
                phone: document.getElementById('wechat-phone').value,
                wechat_nickname: document.getElementById('wechat-nickname').value,
                email: document.getElementById('wechat-email').value,
                notes: document.getElementById('wechat-notes').value,
                wechat_created_day: day,
                wechat_created_month: month,
                wechat_created_year: year,
                status: selectedStatus,  // Status chỉ còn 'active' hoặc 'disabled'
                wechat_status: selectedStatus
            };

            console.log('🔍 WeChat Apply - Data to save:', data);

            // Find account and preserve card_id
            const accountIndex = mxhAccounts.findIndex(acc => acc.id === currentContextAccountId);
            if (accountIndex === -1) {
                showToast('Lỗi: Không tìm thấy account!', 'error');
                return;
            }

            const cardId = Number(mxhAccounts[accountIndex].card_id);

            // Update local data immediately - preserve ALL existing properties
            Object.assign(mxhAccounts[accountIndex], data);

            // *** CRITICAL: Ensure activeAccountId is set BEFORE rendering ***
            setCardState(cardId, { activeAccountId: currentContextAccountId });
            console.log(`🔧 WeChat Apply: Updated account ${currentContextAccountId}, set as active for card ${cardId}`);
            console.log(`   Account exists in mxhAccounts:`, !!mxhAccounts.find(a => a.id === currentContextAccountId));
            console.log(`   Card accounts:`, mxhAccounts.filter(a => a.card_id === cardId).map(a => ({ id: a.id, is_primary: a.is_primary })));

            // Hide modal and re-render (preserves active account)
            bootstrap.Modal.getInstance(document.getElementById('wechat-account-modal')).hide();
            scheduleRender();

            try {
                console.log('🔍 Sending PUT request to:', `/mxh/api/accounts/${currentContextAccountId}`);
                const response = await MXHApi.updateAccount(currentContextAccountId, data);

                console.log('🔍 Response status:', response.status);

                if (response.ok) {
                    const updatedAccount = await response.json();
                    console.log('🔍 Updated account from server:', updatedAccount);
                    console.log('🔍 Email from server:', updatedAccount.email);
                    console.log('🔍 Full JSON:', JSON.stringify(updatedAccount, null, 2));
                    // Merge the server response back into local data
                    const idx = mxhAccounts.findIndex(acc => acc.id === currentContextAccountId);
                    if (idx !== -1) {
                        mxhAccounts[idx] = updatedAccount;
                        // *** CRITICAL: Keep the account active after server update ***
                        setCardState(cardId, { activeAccountId: currentContextAccountId });
                        console.log(`✅ Updated WeChat account ${currentContextAccountId}, keeping it as active for card ${cardId}`);
                        scheduleRender(); // Re-render with server data
                    }
                    showToast('✅ Đã cập nhật!', 'success');
                } else {
                    const errorText = await response.text();
                    console.error('🔍 Error response:', errorText);
                    try {
                        const error = JSON.parse(errorText);
                        showToast(error.error || 'Lỗi!', 'error');
                    } catch {
                        showToast('Lỗi: ' + errorText, 'error');
                    }
                    await loadMXHData(false);
                }
            } catch (error) {
                console.error('🔍 Fetch error:', error);
                showToast('Lỗi kết nối: ' + error.message, 'error');
                await loadMXHData(false);
            }
        });

        document.getElementById('generic-account-edit-form').addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission (browser refresh)
            if (!currentContextAccountId) return;

            const data = {
                login_username: document.getElementById('generic-username').value,
                login_password: document.getElementById('generic-password').value,
                username: document.getElementById('generic-display-name').value,
                phone: document.getElementById('generic-phone').value,
                url: document.getElementById('generic-url').value,
                notes: document.getElementById('generic-notes').value
            };

            // Find account and preserve card_id
            const accountIndex = mxhAccounts.findIndex(acc => acc.id === currentContextAccountId);
            if (accountIndex === -1) {
                showToast('Lỗi: Không tìm thấy account!', 'error');
                return;
            }

            const cardId = Number(mxhAccounts[accountIndex].card_id);

            // Instant local update
            Object.keys(data).forEach(key => {
                if (data[key] !== undefined && data[key] !== null) {
                    mxhAccounts[accountIndex][key] = data[key];
                }
            });

            // *** CRITICAL: Ensure activeAccountId is set BEFORE rendering ***
            setCardState(cardId, { activeAccountId: currentContextAccountId });
            console.log(`🔧 Generic Apply: Updated account ${currentContextAccountId}, set as active for card ${cardId}`);
            console.log(`   Account exists in mxhAccounts:`, !!mxhAccounts.find(a => a.id === currentContextAccountId));
            console.log(`   Card accounts:`, mxhAccounts.filter(a => a.card_id === cardId).map(a => ({ id: a.id, is_primary: a.is_primary })));

            bootstrap.Modal.getInstance(document.getElementById('generic-account-modal')).hide();
            scheduleRender();

            try {
                const response = await MXHApi.updateAccount(currentContextAccountId, data);

                if (response.ok) {
                    const updatedAccount = await response.json();
                    // Merge the server response back into local data
                    const idx = mxhAccounts.findIndex(acc => acc.id === currentContextAccountId);
                    if (idx !== -1) {
                        mxhAccounts[idx] = updatedAccount;
                        // *** CRITICAL: Keep the account active after server update ***
                        setCardState(cardId, { activeAccountId: currentContextAccountId });
                        console.log(`✅ Updated generic account ${currentContextAccountId}, keeping it as active for card ${cardId}`);
                        scheduleRender(); // Re-render with server data
                    }
                    showToast('✅ Đã cập nhật!', 'success');
                } else {
                    showToast('Lỗi!', 'error');
                    await loadMXHData(false);
                }
            } catch (error) {
                showToast('Lỗi kết nối!', 'error');
                await loadMXHData(false);
            }
        });

        document.getElementById('apply-card-number-btn').addEventListener('click', async () => {
            if (!currentContextAccountId) return;

            const newNumber = document.getElementById('new-card-number').value;
            if (!newNumber) return;

            // Instant local update
            const accountIndex = mxhAccounts.findIndex(acc => acc.id === currentContextAccountId);
            if (accountIndex !== -1) {
                mxhAccounts[accountIndex].card_name = newNumber;
            }

            bootstrap.Modal.getInstance(document.getElementById('change-card-number-modal')).hide();
            scheduleRender();

            try {
                const response = await MXHApi.updateAccount(currentContextAccountId, { card_name: newNumber });

                if (response.ok) {
                    const updatedAccount = await response.json();
                    // Update all accounts with the same card_id to have the new card_name
                    const cardId = updatedAccount.card_id;
                    mxhAccounts.forEach((acc, idx) => {
                        if (acc.card_id === cardId) {
                            mxhAccounts[idx].card_name = newNumber;
                        }
                    });
                    scheduleRender();
                    showToast('✅ Đã đổi số hiệu!', 'success');
                } else {
                    showToast('Lỗi!', 'error');
                    await loadMXHData(false);
                }
            } catch (error) {
                showToast('Lỗi kết nối!', 'error');
                await loadMXHData(false);
            }
        });

        document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
            if (!currentContextAccountId) return;
            await deleteAccount(currentContextAccountId);
            bootstrap.Modal.getInstance(document.getElementById('delete-card-modal')).hide();
        });

        // Reset button handlers
        document.getElementById('wechat-reset-btn').addEventListener('click', () => {
            if (!currentContextAccountId) return;
            const modal = new bootstrap.Modal(document.getElementById('reset-card-modal'));
            modal.show();
        });

        document.getElementById('generic-reset-btn').addEventListener('click', () => {
            if (!currentContextAccountId) return;
            const modal = new bootstrap.Modal(document.getElementById('reset-card-modal'));
            modal.show();
        });

        document.getElementById('confirm-reset-btn').addEventListener('click', async () => {
            if (!currentContextAccountId) return;
            await resetAccount(currentContextAccountId);

            // Safely hide modals - check if instance exists first
            const resetModal = bootstrap.Modal.getInstance(document.getElementById('reset-card-modal'));
            if (resetModal) resetModal.hide();

            const wechatModal = bootstrap.Modal.getInstance(document.getElementById('wechat-account-modal'));
            if (wechatModal) wechatModal.hide();

            const genericModal = bootstrap.Modal.getInstance(document.getElementById('generic-account-modal'));
            if (genericModal) genericModal.hide();
        });

        document.getElementById('mxh-apply-view-mode-btn').addEventListener('click', () => {
            const cardsPerRow = document.getElementById('mxh-cards-per-row').value;
            localStorage.setItem('mxh_cards_per_row', cardsPerRow);

            const style = document.getElementById('mxh-dynamic-style') || document.createElement('style');
            style.id = 'mxh-dynamic-style';
            style.innerHTML = `
        #mxh-accounts-container .row > .col {
            flex: 0 0 calc(100% / ${cardsPerRow});
            max-width: calc(100% / ${cardsPerRow});
        }
    `;
            if (!document.getElementById('mxh-dynamic-style')) {
                document.head.appendChild(style);
            }

            showToast(`Đã áp dụng ${cardsPerRow} cards/hàng!`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('mxh-view-mode-modal')).hide();
        });

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

            // Initial load
            await loadMXHData(true);

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
        let _openWeChatModalLock = false;
        window.openWeChatModal = function (accountId) {
            if (_openWeChatModalLock) return;
            _openWeChatModalLock = true;

            const account = mxhAccounts.find(acc => acc.id === accountId);
            if (!account) {
                console.error('🔍 Account not found:', accountId);
                _openWeChatModalLock = false;
                return;
            }

            console.log('🔍 Opening WeChat modal for account:', account);
            console.log('🔍 Date info:', {
                day: account.wechat_created_day,
                month: account.wechat_created_month,
                year: account.wechat_created_year
            });

            currentContextAccountId = accountId;

            const modalTitle = document.querySelector('#wechat-account-modal .modal-title');
            modalTitle.innerHTML = '<i class="bi bi-wechat me-2"></i>Thông Tin Tài Khoản';

            document.getElementById('wechat-card-name').value = account.card_name || '';
            document.getElementById('wechat-username').value = account.username || '';
            document.getElementById('wechat-phone').value = account.phone || '';
            document.getElementById('wechat-nickname').value = (account.wechat_nickname && account.wechat_nickname !== '.') ? account.wechat_nickname : '';
            document.getElementById('wechat-email').value = account.email || '';

            // 🔍 Format date for display - use current date if not set
            let day = account.wechat_created_day;
            let month = account.wechat_created_month;
            let year = account.wechat_created_year;

            // If date is not set, use current date
            if (!day || !month || !year) {
                const today = new Date();
                day = day || today.getDate();
                month = month || (today.getMonth() + 1);
                year = year || today.getFullYear();
                console.log('🔍 Date not set, using current date:', { day, month, year });
            }

            document.getElementById('wechat-date').value = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;

            const primaryStatus = account.status || 'active';
            document.getElementById('wechat-status').value = primaryStatus;

            // Load Ghi chú
            document.getElementById('wechat-notes').value = account.notes || '';

            // Load Lịch sử SĐT
            loadPhoneHistory(accountId);

            const modal = new bootstrap.Modal(document.getElementById('wechat-account-modal'));
            modal.show();

            setTimeout(() => { _openWeChatModalLock = false; }, 300);
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

        // Toggle account status (click on status to change) - INSTANT UPDATE NO RELOAD
        window.toggleAccountStatus = async function (event, accountId) {
            event.stopPropagation();
            event.preventDefault();

            // Find the account and update locally FIRST (instant UI update)
            const accountIndex = mxhAccounts.findIndex(acc => acc.id === accountId);
            if (accountIndex === -1) return;

            const currentStatus = mxhAccounts[accountIndex].status;

            // Toggle status locally
            const newStatus = currentStatus === 'disabled' ? 'active' : 'disabled';
            mxhAccounts[accountIndex].status = newStatus;

            // 🔍 Update disabled_date when toggling disabled status
            if (newStatus === 'disabled') {
                mxhAccounts[accountIndex].disabled_date = new Date().toISOString();
                mxhAccounts[accountIndex].die_date = null;
            } else {
                mxhAccounts[accountIndex].disabled_date = null;
                mxhAccounts[accountIndex].die_date = null;
            }

            // Re-render immediately (no API call wait)
            scheduleRender();

            // Then update backend in background
            try {
                const response = await MXHApi.toggleStatus(accountId);

                if (response.ok) {
                    showToast('✅ Đã thay đổi trạng thái!', 'success');
                } else {
                    // Revert on error
                    const error = await response.json();
                    showToast(error.error || 'Lỗi khi thay đổi trạng thái!', 'error');
                    await loadMXHData(false); // Reload to get correct data
                }
            } catch (error) {
                showToast('Lỗi kết nối!', 'error');
                await loadMXHData(false); // Reload to get correct data
            }
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
