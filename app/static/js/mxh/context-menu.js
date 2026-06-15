"use strict";
// MXH card context menu helpers. Classic global wrapper, no ES modules yet.
(function () {
    function showCardContextMenu(ctx, event, cardId, accountId, platform) {
        event.preventDefault();
        event.stopPropagation();
        const doc = ctx.document || document;
        ctx.setCurrentContext(cardId, accountId);
        ctx.pauseAutoRefresh();
        const account = ctx.mxhAccounts.find(acc => acc.id === accountId);
        if (!account)
            return;
        const cardAccounts = ctx.mxhAccounts.filter(acc => Number(acc.card_id) === Number(cardId));
        const state = ctx.getCardState(cardId);
        const isPrimary = account.is_primary;
        const currentStatus = (account.status || 'active').toLowerCase();
        let noticeObj = null;
        try {
            noticeObj = typeof account.notice === 'string' ? JSON.parse(account.notice || '{}') : (account.notice || {});
        }
        catch (e) {
            noticeObj = {};
        }
        const hasNotice = noticeObj && (noticeObj.enabled === true || noticeObj.enabled === 1 || Number(noticeObj.days) > 0);
        const menuHtml = `
            <div class="mxh-context-menu" id="card-context-menu">
                <!-- 1. Tài Khoản -->
                <div class="mxh-menu-item has-submenu">
                    <span>Tài Khoản (${cardAccounts.length})</span>
                    <div class="mxh-submenu">
                        ${cardAccounts.map((acc, idx) => {
            const isActive = acc.id === state.activeAccountId;
            const isPrimary = acc.is_primary;
            const canScan = platform === 'wechat' && ctx.canScanWeChat(acc);
            const qrIcon = canScan ? '<i class="bi bi-qr-code mxh-color-success mxh-menu-indicator"></i>' : '';
            const needsHK = platform === 'wechat' && ctx.needsHongKongNumber(acc);
            const hkDot = needsHK ? '<span class="mxh-menu-hk-dot"></span>' : '';
            const nearbyActive = ctx.isNearbyPeopleActive(acc);
            const nearbyIcon = nearbyActive ? '<i class="bi bi-geo-alt-fill mxh-color-nearby mxh-menu-indicator" title="Nearby People Active"></i>' : '';
            const unverifyIcon = (acc.wechat_status === 'unverified') ? '<i class="bi bi-shield-exclamation mxh-color-warning mxh-menu-indicator" title="UnVerification"></i>' : '';
            const isDisabledAcc = (acc.status || '').toLowerCase() === 'disabled' || !!acc.die_date;
            const dieIcon = isDisabledAcc ? '<i class="bi bi-x-circle-fill mxh-menu-danger mxh-menu-indicator" title="Die"></i>' : '';
            const isNearbyActiveMenu = ctx.isNearbyPeopleActive(acc);
            const nearbyMenuClass = isNearbyActiveMenu ? ' nearby-glow-menu' : '';
            let bellIcon = '';
            if (acc.notice) {
                try {
                    const accNoticeObj = ctx.ensureNoticeParsed(acc.notice);
                    if (accNoticeObj && accNoticeObj.enabled && accNoticeObj.start_at && accNoticeObj.days) {
                        const now = new Date();
                        const startDate = new Date(accNoticeObj.start_at);
                        const endDate = new Date(startDate.getTime() + accNoticeObj.days * 24 * 60 * 60 * 1000);
                        if (now >= endDate) {
                            bellIcon = '<i class="bi bi-bell-fill mxh-color-danger mxh-menu-indicator"></i>';
                        }
                        else {
                            bellIcon = '<i class="bi bi-bell-fill text-warning mxh-menu-indicator"></i>';
                        }
                    }
                }
                catch (e) {
                    console.error('🔍 Error checking notice for account submenu:', e);
                }
            }
            return `
                            <div class="mxh-menu-item${nearbyMenuClass}" data-action="switch-account" data-account-id="${acc.id}">
                                ${isActive ? '✓ ' : ''}${idx + 1}. ${acc.username || '...'} ${isPrimary ? '👑' : ''}${dieIcon}${unverifyIcon}${qrIcon}${hkDot}${nearbyIcon}${bellIcon}
                            </div>
                        `;
        }).join('')}
                        <div class="mxh-menu-item has-submenu mxh-menu-separator-top">
                            <span><i class="bi bi-plus-circle me-2"></i>Thêm Tài Khoản</span>
                            <div class="mxh-submenu">
                                <div class="mxh-menu-item" data-action="add-sub-shelter">
                                    <i class="bi bi-shield-shaded me-2 mxh-menu-icon-shelter"></i>Shelter
                                </div>
                                <div class="mxh-menu-item" data-action="add-sub-security-folder">
                                    <i class="bi bi-file-earmark-lock me-2 mxh-menu-icon-security-folder"></i>Security Folder
                                </div>
                                <div class="mxh-menu-item" data-action="add-sub-multi-user">
                                    <i class="bi bi-people me-2 mxh-menu-icon-multi-user"></i>Multi User
                                </div>
                                <div class="mxh-menu-item" data-action="add-sub-clone-app">
                                    <i class="bi bi-copy me-2 mxh-menu-icon-clone-app"></i>Clone App
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. Thông tin -->
                <div class="mxh-menu-item" data-action="edit">
                    <i class="bi bi-pencil me-2"></i>Thông Tin
                </div>

                <!-- 3. Trạng Thái (WeChat only) -->
                ${platform === 'wechat' ? `
                <div class="mxh-menu-item has-submenu wechat-only">
                    <span>Trạng Thái${account.wechat_status === 'unverified' ? ' <i class="bi bi-shield-exclamation mxh-color-warning mxh-account-index-badge"></i>' : ''}</span>
                    <div class="mxh-submenu">
                        ${account.wechat_status === 'unverified' ? `
                            <div class="mxh-menu-item mxh-menu-success" data-action="status-verify-success">
                                <i class="bi bi-shield-check me-2"></i>Verify Success
                            </div>
                        ` : `
                            <div class="mxh-menu-item mxh-menu-warning" data-action="status-unverify">
                                <i class="bi bi-shield-exclamation me-2"></i>UnVerify
                            </div>
                        `}

                        ${currentStatus !== 'disabled' ? `
                            <div class="mxh-menu-item mxh-menu-danger mxh-menu-separator-top" data-action="status-disabled">
                                <i class="bi bi-x-circle me-2"></i>Die
                            </div>
                        ` : `
                            <div class="mxh-menu-item mxh-menu-active mxh-menu-separator-top" data-action="status-active">
                                <i class="bi bi-check-circle me-2"></i>Active
                            </div>
                        `}
                    </div>
                </div>
                ` : ''}

                <!-- 5. Copy SĐT / Nearby People (WeChat >= 1 năm tuổi) -->
                ${platform === 'wechat' && ctx.isEligibleNearbyPeople(account) ? `
                <div class="mxh-menu-item" data-action="nearby-active">
                    <i class="bi bi-geo-alt me-2"></i>Nearby People
                </div>
                ` : (account.phone ? `
                <div class="mxh-menu-item" data-action="copy-phone">
                    <i class="bi bi-phone me-2"></i>Copy SĐT
                </div>
                ` : '')}

                <!-- 6. Quét WeChat (WeChat only) -->
                ${platform === 'wechat' ? `
                <div class="mxh-menu-item has-submenu wechat-only">
                    <span><i class="bi bi-qr-code me-2"></i>Quét WeChat</span>
                    <div class="mxh-submenu">
                        <div class="mxh-menu-item mxh-menu-success" data-action="scan-wechat">
                            <i class="bi bi-check-circle me-2"></i>Đã Quét
                        </div>
                        <div class="mxh-menu-item" data-action="scan-history">
                            <i class="bi bi-clock-history me-2"></i>Lịch Sử Quét
                        </div>
                        <div class="mxh-menu-item mxh-menu-warning" data-action="reset-scan">
                            <i class="bi bi-arrow-counterclockwise me-2"></i>Reset Lượt Quét
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- 6. Thông báo -->
                <div class="mxh-menu-item ${hasNotice ? 'mxh-menu-danger' : 'mxh-menu-warning'}" data-action="${hasNotice ? 'cancel-notice' : 'toggle-notice'}">
                    ${hasNotice
            ? '<i class="bi bi-bell-slash-fill me-2"></i>Hủy Thông Báo'
            : '<i class="bi bi-bell me-2"></i>Thông Báo'}
                </div>

                <!-- Di chuyển TK : Chỉ hiện cho tài khoản phụ (non-primary) -->
                ${!isPrimary ? `
                <div class="mxh-menu-item mxh-menu-move mxh-menu-separator-top" data-action="move-account">
                    <i class="bi bi-arrow-left-right me-2"></i>Di Chuyển TK
                </div>
                ` : ''}

                <!-- Xóa -->
                <div class="mxh-menu-item mxh-menu-danger ${isPrimary ? 'mxh-menu-separator-top' : ''}" data-action="delete">
                    <i class="bi bi-trash me-2"></i>${isPrimary ? 'Xóa Card' : 'Xóa Acc'}
                </div>
            </div>
        `;
        const existingMenu = doc.getElementById('card-context-menu');
        if (existingMenu)
            existingMenu.remove();
        doc.body.insertAdjacentHTML('beforeend', menuHtml);
        const menu = doc.getElementById('card-context-menu');
        positionContextMenuSmart(menu, event.clientX, event.clientY);
        setTimeout(() => {
            doc.addEventListener('click', () => hideCardContextMenu(ctx), { once: true });
        }, 100);
    }
    function positionContextMenuSmart(menu, x, y) {
        if (!menu)
            return;
        const prevVis = menu.style.visibility;
        const prevDisp = menu.style.display;
        menu.style.visibility = 'hidden';
        menu.style.display = 'block';
        const rect = menu.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const m = 8;
        const placeRight = (x + rect.width + m <= vw);
        const placeDown = (y + rect.height + m <= vh);
        let left = placeRight ? (x + m) : (x - rect.width - m);
        let top = placeDown ? (y + m) : (y - rect.height - m);
        left = Math.min(Math.max(left, m), vw - rect.width - m);
        top = Math.min(Math.max(top, m), vh - rect.height - m);
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
        menu.style.visibility = prevVis || '';
        menu.style.display = prevDisp || '';
    }
    function bindSubmenuPositioning(doc = document) {
        if (doc.documentElement?.dataset.mxhContextSubmenuBound)
            return;
        if (doc.documentElement)
            doc.documentElement.dataset.mxhContextSubmenuBound = '1';
        doc.addEventListener('mouseover', function (e) {
            const target = e.target;
            const item = target?.closest('.mxh-menu-item.has-submenu');
            if (!item)
                return;
            if (!item.closest('.mxh-context-menu'))
                return;
            const submenu = item.querySelector(':scope > .mxh-submenu');
            if (!submenu)
                return;
            submenu.style.visibility = 'hidden';
            submenu.style.display = 'block';
            submenu.style.left = 'calc(100% - 2px)';
            submenu.style.right = 'auto';
            submenu.style.top = '-4px';
            submenu.style.bottom = 'auto';
            const itemRect = item.getBoundingClientRect();
            const submenuW = submenu.offsetWidth || 200;
            const submenuH = submenu.offsetHeight || 120;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const margin = 8;
            if (itemRect.right + submenuW + margin > vw) {
                submenu.style.left = 'auto';
                submenu.style.right = 'calc(100% - 2px)';
            }
            if (itemRect.top + submenuH + margin > vh) {
                submenu.style.top = 'auto';
                submenu.style.bottom = '-4px';
            }
            submenu.style.visibility = '';
            submenu.style.display = '';
        });
    }
    function updateBackgroundViewChecks(ctx) {
        const doc = ctx.document || document;
        const viewChecks = {
            default: doc.getElementById('view-default-check'),
            card2: doc.getElementById('view-card2-check'),
            card3: doc.getElementById('view-card3-check')
        };
        if (viewChecks.default)
            viewChecks.default.textContent = ctx.activeViewFilter === 'default' ? '✓ ' : '';
        if (viewChecks.card2)
            viewChecks.card2.textContent = ctx.activeViewFilter === 'card2' ? '✓ ' : '';
        if (viewChecks.card3)
            viewChecks.card3.textContent = ctx.activeViewFilter === 'card3' ? '✓ ' : '';
    }
    function hideBackgroundContextMenu(ctx) {
        const doc = ctx.document || document;
        const menu = doc.getElementById('mxh-background-context-menu');
        if (!menu)
            return;
        menu.style.display = 'none';
        menu.style.visibility = '';
    }
    function showBackgroundContextMenu(ctx, event) {
        const doc = ctx.document || document;
        const clickedCard = event.target.closest('.mxh-card');
        if (clickedCard)
            return;
        event.preventDefault();
        event.stopPropagation();
        const existingMenu = doc.getElementById('card-context-menu');
        if (existingMenu)
            hideCardContextMenu(ctx);
        const menu = doc.getElementById('mxh-background-context-menu');
        if (!menu)
            return;
        updateBackgroundViewChecks(ctx);
        menu.classList.remove('mxh-hidden-initial');
        menu.style.display = 'block';
        menu.style.visibility = '';
        positionContextMenuSmart(menu, event.clientX, event.clientY);
        menu.style.display = 'block';
        menu.style.visibility = '';
        setTimeout(() => {
            doc.addEventListener('click', () => hideBackgroundContextMenu(ctx), { once: true });
        }, 100);
    }
    function handleBackgroundContextMenuClick(ctx, event) {
        const doc = ctx.document || document;
        const action = event.target.closest('.mxh-menu-item')?.dataset.action;
        if (!action)
            return;
        if (action === 'view-default' || action === 'view-card2' || action === 'view-card3') {
            ctx.activeViewFilter = action.replace('view-', '');
            ctx.MXHState.clearCardActiveAccounts();
            updateBackgroundViewChecks(ctx);
            ctx.requestFullRebuild();
            ctx.scheduleRender();
        }
        else if (action === 'view-mode') {
            const modalEl = doc.getElementById('mxh-view-mode-modal');
            if (modalEl) {
                const modal = new ctx.bootstrap.Modal(modalEl);
                modal.show();
            }
        }
        else if (action === 'add-account') {
            const modalEl = doc.getElementById('mxh-addAccountModal');
            if (modalEl) {
                const modal = new ctx.bootstrap.Modal(modalEl);
                modal.show();
            }
        }
        hideBackgroundContextMenu(ctx);
    }
    function bindBackgroundContextMenu(ctx) {
        const doc = ctx.document || document;
        const pane = doc.getElementById('mxh-tool-pane');
        const menu = doc.getElementById('mxh-background-context-menu');
        if (pane && !pane.dataset.mxhBackgroundContextBound) {
            pane.dataset.mxhBackgroundContextBound = '1';
            pane.addEventListener('contextmenu', (event) => showBackgroundContextMenu(ctx, event));
        }
        if (menu && !menu.dataset.mxhBackgroundContextBound) {
            menu.dataset.mxhBackgroundContextBound = '1';
            menu.addEventListener('click', (event) => handleBackgroundContextMenuClick(ctx, event));
        }
    }
    function hideCardContextMenu(ctx) {
        const doc = ctx.document || document;
        const menu = doc.getElementById('card-context-menu');
        if (menu)
            menu.remove();
        ctx.resumeAutoRefresh();
    }
    window.MXHContextMenu = {
        showCardContextMenu,
        positionContextMenuSmart,
        bindSubmenuPositioning,
        bindBackgroundContextMenu,
        showBackgroundContextMenu,
        hideBackgroundContextMenu,
        hideCardContextMenu
    };
})();
