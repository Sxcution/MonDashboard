"use strict";
// MXH render helpers. Kept as a classic global wrapper before moving to modules/TypeScript.
(function () {
    function getGroupBadgeMarkup(ctx, badgeInfo, fallbackColor) {
        const escapeHtml = ctx.escapeHtml;
        if (!badgeInfo || badgeInfo.total <= 0)
            return '';
        if (badgeInfo.noticeExpired > 0) {
            return `<span class="badge ms-2 mxh-dynamic-badge" data-mxh-bg="#fd7e14" data-mxh-fg="#fff" data-mxh-border="1px solid rgba(255,255,255,.25)">${badgeInfo.total}</span>`;
        }
        if (badgeInfo.needHongKong > 0) {
            return `<span class="badge ms-2 mxh-dynamic-badge" data-mxh-bg="#07c160" data-mxh-fg="#fff" data-mxh-border="1px solid rgba(255,255,255,.2)">${badgeInfo.total}</span>`;
        }
        return `<span class="badge ms-2 mxh-dynamic-badge" data-mxh-bg="${escapeHtml(fallbackColor || '#6c757d')}" data-mxh-fg="#fff" data-mxh-border="1px solid rgba(255,255,255,.25)">${badgeInfo.total}</span>`;
    }
    function renderGroupsNav(ctx) {
        const doc = ctx.document || document;
        const groupsNavContainer = doc.getElementById('mxh-groups-nav');
        if (!groupsNavContainer)
            return;
        const { mxhAccounts, mxhGroups, activeGroupId, calculateGroupBadge, getPlatformIconClass, escapeHtml, selectGroup, applyMXHDynamicStyles, updateMainNavBadge } = ctx;
        const uniqueGroupIds = [...new Set(mxhAccounts.map(acc => acc.group_id).filter(id => id))];
        let groups = uniqueGroupIds
            .map(groupId => mxhGroups.find(g => String(g.id) === String(groupId)))
            .filter(Boolean);
        groups.sort((a, b) => {
            const an = String(a.name || '').toLowerCase();
            const bn = String(b.name || '').toLowerCase();
            const aIsWeChat = an === 'wechat' || an.includes('wechat');
            const bIsWeChat = bn === 'wechat' || bn.includes('wechat');
            if (aIsWeChat !== bIsWeChat)
                return aIsWeChat ? -1 : 1;
            return an.localeCompare(bn);
        });
        const activeGroup = activeGroupId
            ? groups.find(g => String(g.id) === String(activeGroupId)) || mxhGroups.find(g => String(g.id) === String(activeGroupId))
            : null;
        const currentName = activeGroup ? activeGroup.name : 'Tất Cả';
        const currentIconClass = activeGroup
            ? (activeGroup.icon || getPlatformIconClass(activeGroup.name))
            : 'bi-grid-3x3-gap';
        let currentBadgeHtml = '';
        if (activeGroup) {
            const badgeInfo = calculateGroupBadge(activeGroup.id);
            currentBadgeHtml = getGroupBadgeMarkup(ctx, badgeInfo, activeGroup.color);
        }
        const groupItemsHtml = groups.map(group => {
            const isActive = activeGroupId && String(activeGroupId) === String(group.id);
            const badgeInfo = calculateGroupBadge(group.id);
            const badgeHtml = getGroupBadgeMarkup(ctx, badgeInfo, group.color);
            return `
                <li>
                    <a class="dropdown-item d-flex align-items-center justify-content-between ${isActive ? 'active' : ''}" href="#"
                       data-mxh-select-group="${escapeHtml(group.id)}">
                        <span class="d-flex align-items-center gap-2">
                            <i class="bi ${group.icon || getPlatformIconClass(group.name) || 'bi-people-fill'} mxh-dynamic-color" data-mxh-color="${escapeHtml(group.color || '#6c757d')}"></i>
                            <span>${group.name}</span>
                        </span>
                        ${badgeHtml}
                    </a>
                </li>
            `;
        }).join('');
        const isAllActive = activeGroupId === null;
        groupsNavContainer.innerHTML = `
            <div class="dropdown">
                <button class="btn btn-sm ${activeGroup ? 'btn-primary' : 'btn-outline-secondary'} dropdown-toggle"
                        type="button" id="mxh-platform-dropdown" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="bi ${currentIconClass} me-1"></i>${currentName}${currentBadgeHtml}
                </button>
                <ul class="dropdown-menu mxh-platform-menu" aria-labelledby="mxh-platform-dropdown">
                    <li>
                        <a class="dropdown-item ${isAllActive ? 'active' : ''}" href="#"
                           data-mxh-select-group="">
                            <i class="bi bi-grid-3x3-gap me-2"></i>Tất cả
                        </a>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    ${groupItemsHtml || '<li><span class="dropdown-item-text text-muted">Chưa có nhóm</span></li>'}
                </ul>
            </div>
        `;
        groupsNavContainer.querySelectorAll('[data-mxh-select-group]').forEach(item => {
            item.addEventListener('click', (event) => {
                event.preventDefault();
                const groupId = item.dataset.mxhSelectGroup;
                selectGroup(groupId ? groupId : null);
            });
        });
        applyMXHDynamicStyles(groupsNavContainer);
        updateMainNavBadge();
    }
    function renderCardFace(ctx, account, allAccounts, side) {
        const { getPlatformIconClass, getAccountBorderClass, formatAccountAge, calculateScanCountdown, calculateNearbyCountdown, escapeHtml, getContainerTypeIcon, getContainerTypeColorClass, getContainerTypeTitle, getPlatformColor, isNearbyPeopleActive } = ctx;
        const cardId = account.card_id;
        const accountIndex = account._realIndex || (allAccounts.findIndex(acc => acc.id === account.id) + 1);
        const totalAccounts = account._realTotal || allAccounts.length;
        const platform = account.platform || 'unknown';
        const iconClass = getPlatformIconClass(platform);
        const borderClass = getAccountBorderClass(account);
        const now = new Date();
        let accountAgeDisplay = '';
        let ageColor = '#fff';
        let scanCountdown = '';
        let nearbyCountdown = '';
        if (platform === 'wechat' && account.wechat_created_year) {
            const createdDate = new Date(account.wechat_created_year, (account.wechat_created_month || 1) - 1, account.wechat_created_day || 1);
            const ageInfo = formatAccountAge(createdDate, now);
            accountAgeDisplay = ageInfo.display;
            ageColor = ageInfo.color;
            scanCountdown = calculateScanCountdown(account, now);
            nearbyCountdown = calculateNearbyCountdown(account, now);
        }
        let statusIcon = '';
        if (account.status === 'disabled') {
            statusIcon = '<i class="bi bi-x-circle-fill status-icon mxh-color-danger"></i>';
        }
        else if (account.wechat_status === 'unverified') {
            statusIcon = '<i class="bi bi-shield-exclamation status-icon mxh-color-warning" title="Chưa xác minh"></i>';
        }
        let noticeHtml = '';
        let extraClass = '';
        let tipHtml = '';
        try {
            const noticeObj = typeof account.notice === 'string' ? JSON.parse(account.notice || '{}') : (account.notice || {});
            const hasNotice = noticeObj && (noticeObj.enabled === true || noticeObj.enabled === 1 || Number(noticeObj.days) > 0);
            if (hasNotice) {
                const dueDate = new Date(noticeObj.due_date || noticeObj.dueDate);
                if (dueDate instanceof Date && !isNaN(dueDate.getTime())) {
                    const today = new Date();
                    const remainTime = dueDate.getTime() - today.getTime();
                    const remainHours = Math.floor(remainTime / (1000 * 60 * 60));
                    const remainDays = Math.floor(remainHours / 24);
                    if (remainTime > 0) {
                        let timeDisplay = '';
                        if (remainDays >= 30) {
                            const remainMonths = Math.floor(remainDays / 30);
                            timeDisplay = `${remainMonths}m`;
                        }
                        else if (remainDays >= 1) {
                            timeDisplay = `${remainDays}d`;
                        }
                        else if (remainHours >= 1) {
                            timeDisplay = `${remainHours} giờ`;
                        }
                        else {
                            const remainMinutes = Math.floor(remainTime / (1000 * 60));
                            timeDisplay = `${remainMinutes}p`;
                        }
                        noticeHtml = `<div class="notice-line mxh-notice-line">${escapeHtml(noticeObj.title || 'Thông báo')}: ${timeDisplay}</div>`;
                    }
                    else {
                        noticeHtml = `<div class="notice-line mxh-notice-line expired">${escapeHtml(noticeObj.title || 'Thông báo')}: đã đến hạn</div>`;
                        extraClass = 'notice-expired-blink';
                    }
                    let tooltipTime;
                    if (remainDays >= 30) {
                        const months = Math.floor(remainDays / 30);
                        tooltipTime = `${months}m`;
                    }
                    else if (remainDays >= 1) {
                        tooltipTime = `${remainDays}d`;
                    }
                    else if (remainHours >= 1) {
                        tooltipTime = `${remainHours} giờ`;
                    }
                    else {
                        const remainMinutes = Math.floor(remainTime / (1000 * 60));
                        tooltipTime = `${remainMinutes}p`;
                    }
                    tipHtml = `<div class="notice-tooltip"><div class="notice-tooltip-title">${escapeHtml(noticeObj.title || 'Thông báo')} – ${tooltipTime}</div><div class="notice-tooltip-note">${escapeHtml(noticeObj.note || '')}</div></div>`;
                }
            }
        }
        catch (e) {
            console.error('Error parsing notice:', e);
        }
        let disabledInfo = '';
        const isDisabled = account.status === 'disabled';
        if (isDisabled && platform === 'wechat') {
            let disableDays = 0;
            if (account.disabled_date) {
                const disabledDate = new Date(account.disabled_date + 'T00:00:00');
                const disableHours = Math.floor((now.getTime() - disabledDate.getTime()) / (1000 * 60 * 60));
                disableDays = Math.floor(disableHours / 24);
            }
            disabledInfo = `
                <div class="mxh-disabled-info">
                    <div class="d-flex align-items-center justify-content-between">
                        <small class="text-danger">Die: ${disableDays} ngày</small>
                        <small>Cứu: <span class="text-danger">${account.rescue_count || 0}</span>-<span class="text-success">${account.rescue_success_count || 0}</span></small>
                    </div>
                </div>
            `;
        }
        const ageClass = ageColor === '#07c160' ? 'mxh-color-success' : 'mxh-color-white';
        const containerType = account.container_type;
        const containerIconHtml = String(account.is_primary) !== '1' && containerType
            ? `<i class="bi ${getContainerTypeIcon(containerType)} mxh-container-icon ${getContainerTypeColorClass(containerType)}" title="${getContainerTypeTitle(containerType)}"></i>`
            : '';
        return `
            <div class="mxh-card-face ${side}">
                <div class="card tool-card mxh-card mxh-card-fill ${borderClass} ${extraClass}"
                     data-card-id="${cardId}"
                     data-account-id="${account.id}"
                     data-platform="${platform}">
                    <div class="card-body mxh-card-body-flex">
                        <div>
                            <div class="d-flex align-items-center justify-content-between mb-1">
                                <div class="d-flex align-items-center gap-1">
                                    <h6 class="card-title mb-0 card-number editable-field mxh-card-number-edit"
                                        contenteditable="true"
                                        data-field="card_name"
                                        data-account-id="${account.id}"
                                        title="Click để sửa số/vị trí card, nhấp chuột ra ngoài để đổi card">
                                        ${account.card_name}
                                    </h6>
                                    <i class="bi ${iconClass} mxh-platform-icon mxh-dynamic-color" title="${platform}" data-mxh-color="${getPlatformColor(platform)}"></i>
                                    ${totalAccounts > 1 ? `<span class="badge bg-primary mxh-account-index-badge">${accountIndex}/${totalAccounts}</span>${containerIconHtml}` : ''}
                                </div>
                                <div class="d-flex align-items-center gap-1">
                                    ${accountAgeDisplay ? `<small class="${ageClass} mxh-account-age">${accountAgeDisplay}</small>` : ''}
                                </div>
                            </div>

                            <div class="text-center">
                                <div>
                                    <small
                                        contenteditable="true"
                                        data-field="username"
                                        data-account-id="${account.id}"
                                        class="editable-field mxh-editable-username${isNearbyPeopleActive(account) ? ' nearby-glow-name' : ''}"
                                        title="Click để chỉnh sửa">${account.username || '...'}</small>${statusIcon}
                                </div>
                                ${platform === 'wechat' ? `
                                <small
                                    contenteditable="true"
                                    class="editable-field text-muted mxh-editable-line mxh-editable-nickname"
                                    data-field="wechat_nickname"
                                    data-account-id="${account.id}"
                                    title="Click để chỉnh sửa">@ ${(account.wechat_nickname && account.wechat_nickname !== '.') ? account.wechat_nickname : '...'}</small>
                                ` : `
                                <small
                                    contenteditable="true"
                                    class="editable-field text-muted mxh-editable-line"
                                    data-field="login_username"
                                    data-account-id="${account.id}"
                                    title="Click để chỉnh sửa">👤 ${(account.login_username && account.login_username !== '.') ? account.login_username : '...'}</small>
                                <small
                                    contenteditable="true"
                                    class="editable-field text-muted mxh-editable-line"
                                    data-field="login_password"
                                    data-account-id="${account.id}"
                                    title="Click để chỉnh sửa">🔑 ${(account.login_password && account.login_password !== '.') ? account.login_password : '...'}</small>
                                `}
                                <small
                                    contenteditable="true"
                                    class="editable-field text-muted mxh-editable-line"
                                    data-field="phone"
                                    data-account-id="${account.id}"
                                    title="Click để chỉnh sửa">📞 ${account.phone || '...'}</small>
                                ${platform === 'wechat' ? `
                                <small
                                    contenteditable="true"
                                    class="editable-field text-muted mxh-editable-line mxh-editable-email"
                                    data-field="email"
                                    data-account-id="${account.id}"
                                    title="Click để chỉnh sửa">✉ ${(account.email && account.email !== '.') ? account.email : '...'}</small>
                                ` : ''}
                            </div>
                        </div>

                        <div>
                            ${platform === 'wechat' ? `
                                <div class="text-center mt-1">
                                    ${isDisabled ? disabledInfo : `<div class="d-flex justify-content-center align-items-center gap-3"><small class="mxh-card-metric">${scanCountdown}</small> <small class="mxh-card-metric">${nearbyCountdown}</small></div>`}
                                </div>
                            ` : ''}
                            ${noticeHtml}
                            ${tipHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    function updateStatsPanels(ctx, tabAccounts) {
        const doc = ctx.document || document;
        const elAcc = doc.getElementById('mxh-stats-accounts');
        const elCards = doc.getElementById('mxh-stats-cards');
        if (!elAcc || !elCards)
            return;
        const { activeFilter, getAccountCreatedDateForStats, calculateTimeDifferenceInHours, isAccountDisabledForStats, canScanWeChat, canScanWeChatHK, ensureNoticeParsed, needsHongKongNumber, hasIncompleteProfileInfo, isNearbyPeopleActive, applyQuickFilter } = ctx;
        const now = new Date();
        const total = tabAccounts.length;
        let oneYear = 0;
        let newMonth = 0;
        let disabled = 0;
        tabAccounts.forEach(acc => {
            const created = getAccountCreatedDateForStats(acc);
            if (created && !isNaN(created.getTime())) {
                const days = Math.floor(calculateTimeDifferenceInHours(created, now) / 24);
                if (days >= 365)
                    oneYear++;
                if (days >= 0 && days < 30)
                    newMonth++;
            }
            if (isAccountDisabledForStats(acc))
                disabled++;
        });
        elAcc.innerHTML = `
            <span class="text-nowrap ms-1 fw-bold">${total}</span>
            <span class="text-muted mx-1">|</span>
            <span class="stats-clickable d-inline-flex align-items-center ${activeFilter === 'one_year' ? 'active-stat-filter' : ''}" data-quick-filter="one_year">
                <span class="fw-semibold text-nowrap">TK 1 năm:</span> <span class="ms-1 fw-bold">${oneYear}</span>
            </span>
            <span class="text-muted mx-1">|</span>
            <span class="stats-clickable d-inline-flex align-items-center ${activeFilter === 'new_month' ? 'active-stat-filter' : ''}" data-quick-filter="new_month">
                <span class="fw-semibold text-nowrap">TK mới:</span> <span class="ms-1 fw-bold">${newMonth}</span>
            </span>
            <span class="text-muted mx-1">|</span>
            <span class="stats-clickable d-inline-flex align-items-center ${activeFilter === 'disabled' ? 'active-stat-filter' : ''}" data-quick-filter="disabled">
                <span class="fw-semibold text-nowrap">TK hạn chế:</span> <span class="ms-1 fw-bold text-danger">${disabled}</span>
            </span>
            <span class="text-muted mx-1">|</span>
            <span class="stats-clickable d-inline-flex align-items-center ${activeFilter === 'unverified' ? 'active-stat-filter' : ''}" data-quick-filter="unverified">
                <span class="fw-semibold text-nowrap">UnVerify:</span> <span class="ms-1 fw-bold text-warning">${tabAccounts.filter(a => a.wechat_status === 'unverified').length}</span>
            </span>
            <span class="text-muted mx-1">|</span>
            <span class="stats-clickable d-inline-flex align-items-center ${activeFilter === 'incomplete_info' ? 'active-stat-filter' : ''}" data-quick-filter="incomplete_info">
                <span class="fw-semibold text-nowrap">Thiếu Info:</span> <span class="ms-1 fw-bold text-info">${tabAccounts.filter(a => hasIncompleteProfileInfo(a)).length}</span>
            </span>
        `;
        const cardMap = {};
        tabAccounts.forEach(acc => {
            const cid = acc.card_id;
            if (!cardMap[cid])
                cardMap[cid] = [];
            cardMap[cid].push(acc);
        });
        const cardIds = Object.keys(cardMap);
        const totalCards = cardIds.length;
        let noticeExpiredCards = 0;
        let needHKCards = 0;
        let scanVNCards = 0;
        let scanHKCards = 0;
        cardIds.forEach(cid => {
            const accounts = cardMap[cid] || [];
            if (accounts.some(a => canScanWeChat(a)))
                scanVNCards++;
            if (accounts.some(a => canScanWeChatHK(a)))
                scanHKCards++;
            const hasExpired = accounts.some(a => {
                if (!a.notice)
                    return false;
                const n = ensureNoticeParsed(a.notice);
                if (!n || !n.enabled || !n.start_at || !n.days)
                    return false;
                const start = new Date(n.start_at);
                const end = new Date(start.getTime() + Number(n.days) * 24 * 60 * 60 * 1000);
                return now >= end;
            });
            if (hasExpired)
                noticeExpiredCards++;
            if (accounts.some(a => needsHongKongNumber(a)))
                needHKCards++;
        });
        let nearbyPeopleCards = 0;
        cardIds.forEach(cid => {
            const accounts = cardMap[cid] || [];
            if (accounts.some(a => isNearbyPeopleActive(a)))
                nearbyPeopleCards++;
        });
        elCards.innerHTML = `
            <span class="text-nowrap ms-1 fw-bold">${totalCards}</span>
            <span class="text-muted mx-1">|</span>
            <span class="stats-clickable d-inline-flex align-items-center ${activeFilter === 'wechat_scan_vn' ? 'active-stat-filter' : ''}" data-quick-filter="wechat_scan_vn">
                <span class="fw-semibold text-nowrap">Scan VN:</span> <span class="ms-1 fw-bold text-success">${scanVNCards}</span>
            </span>
            <span class="text-muted mx-1">|</span>
            <span class="stats-clickable d-inline-flex align-items-center ${activeFilter === 'wechat_scan_hk' ? 'active-stat-filter' : ''}" data-quick-filter="wechat_scan_hk">
                <span class="fw-semibold text-nowrap">Scan HK:</span> <span class="ms-1 fw-bold mxh-color-hk">${scanHKCards}</span>
            </span>
            <span class="text-muted mx-1">|</span>
            <span class="stats-clickable d-inline-flex align-items-center ${activeFilter === 'has_notice' ? 'active-stat-filter' : ''}" data-quick-filter="has_notice">
                <span class="fw-semibold text-nowrap">Thông Báo:</span> <span class="ms-1 fw-bold text-warning">${noticeExpiredCards}</span>
            </span>
            <span class="text-muted mx-1">|</span>
            <span class="stats-clickable d-inline-flex align-items-center ${activeFilter === 'need_hk' ? 'active-stat-filter' : ''}" data-quick-filter="need_hk">
                <span class="fw-semibold text-nowrap">Cần HK:</span> <span class="ms-1 fw-bold">${needHKCards}</span>
            </span>
            <span class="text-muted mx-1">|</span>
            <span class="stats-clickable d-inline-flex align-items-center ${activeFilter === 'nearby_people' ? 'active-stat-filter' : ''}" data-quick-filter="nearby_people">
                <i class="bi bi-geo-alt-fill me-1 mxh-color-nearby"></i><span class="fw-semibold text-nowrap">Nearby People:</span> <span class="ms-1 fw-bold mxh-color-nearby">${nearbyPeopleCards}</span>
            </span>
        `;
        [elAcc, elCards].forEach(panel => {
            if (panel.dataset.mxhQuickFilterBound)
                return;
            panel.addEventListener('click', (event) => {
                const target = event.target.closest('[data-quick-filter]');
                if (!target || !panel.contains(target))
                    return;
                applyQuickFilter(target.dataset.quickFilter);
            });
            panel.dataset.mxhQuickFilterBound = '1';
        });
    }
    function renderMXHAccounts(ctx, forceRender = false) {
        if (ctx.isMXHInlineEditing())
            return;
        if (ctx.isRendering)
            return;
        ctx.isRendering = true;
        const doc = ctx.document || document;
        const container = doc.getElementById('mxh-accounts-container');
        const searchQuery = ctx.mxhSearchQuery.toLowerCase().trim();
        const tabAccounts = ctx.activeGroupId
            ? ctx.mxhAccounts.filter(acc => String(acc.group_id) === String(ctx.activeGroupId))
            : ctx.mxhAccounts;
        updateStatsPanels(ctx, tabAccounts);
        const consumeFullRebuild = ctx.MXHState.consumeFullRebuild();
        const needsFullRebuild = !ctx.isInitialRenderComplete ||
            (ctx.activeGroupId !== ctx.lastRenderedGroupId) ||
            consumeFullRebuild ||
            forceRender;
        if (needsFullRebuild) {
            if (tabAccounts.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted mxh-empty-render-state">
                        <i class="bi bi-share-fill mxh-empty-state-icon"></i>
                        <h5 class="mt-3">Chưa có tài khoản MXH nào</h5>
                        <p>Nhấn "Thêm Tài Khoản MXH" để bắt đầu.</p>
                    </div>
                `;
                ctx.isRendering = false;
                ctx.isInitialRenderComplete = true;
                ctx.lastRenderedGroupId = ctx.activeGroupId;
                return;
            }
            // Group cards by platform
            const platformCards = {};
            tabAccounts.forEach(acc => {
                const platform = String(acc.platform || 'unknown').toLowerCase();
                const cardId = acc.card_id;
                if (!platformCards[platform])
                    platformCards[platform] = {};
                if (!platformCards[platform][cardId])
                    platformCards[platform][cardId] = [];
                platformCards[platform][cardId].push(acc);
            });
            // Sort platforms: WeChat first, then others alphabetically
            const sortedPlatforms = Object.keys(platformCards).sort((a, b) => {
                if (a === 'wechat')
                    return -1;
                if (b === 'wechat')
                    return 1;
                return a.localeCompare(b);
            });
            let html = '<div class="mxh-platforms-wrapper">';
            sortedPlatforms.forEach((platform, index) => {
                const cardGroups = platformCards[platform];
                const cardIds = Object.keys(cardGroups).sort((a, b) => {
                    const nameA = parseInt(cardGroups[a][0].card_name, 10) || Infinity;
                    const nameB = parseInt(cardGroups[b][0].card_name, 10) || Infinity;
                    return nameA - nameB;
                });
                const platformDisplayName = platform.charAt(0).toUpperCase() + platform.slice(1);
                html += `
                    <div class="mxh-platform-section mb-4" data-platform="${platform}">
                        <h6 class="mxh-platform-section-title d-flex align-items-center gap-2 mb-3 px-1">
                            <i class="bi ${ctx.getPlatformIconClass(platform)} mxh-dynamic-color" data-mxh-color="${ctx.getPlatformColor(platform)}"></i>
                            <span class="fw-bold text-uppercase tracking-wider" style="font-size: 0.85rem; color: var(--md-text-soft);">${platformDisplayName}</span>
                            <span class="badge bg-secondary-subtle text-muted rounded-pill px-2" style="font-size: 0.7rem;">${cardIds.length}</span>
                        </h6>
                        <div class="row g-2">
                `;
                cardIds.forEach(cardId => {
                    const accounts = cardGroups[cardId];
                    const state = ctx.getCardState(Number(cardId));
                    let activeAccount = null;
                    if (state.activeAccountId !== null) {
                        activeAccount = accounts.find(acc => acc.id === state.activeAccountId);
                    }
                    if (!activeAccount) {
                        if (ctx.activeViewFilter === 'card2' && accounts.length >= 2) {
                            activeAccount = accounts[1];
                        }
                        else if (ctx.activeViewFilter === 'card3' && accounts.length >= 3) {
                            activeAccount = accounts[2];
                        }
                    }
                    if (!activeAccount) {
                        activeAccount = accounts.find(a => a.is_primary) || accounts[0];
                    }
                    const isWeChat = activeAccount.platform === 'wechat';
                    html += `
                        <div class="col mxh-card-col" data-card-id="${cardId}" id="col-card-${cardId}">
                            <div class="mxh-card-wrapper mxh-card-wrapper-position ${state.isFlipped ? 'flipped' : ''} ${isWeChat ? 'wechat-tall' : ''}"
                                 id="card-wrapper-${cardId}">
                                ${ctx.getCardBadge(activeAccount, accounts)}
                                <div class="mxh-filter-overlay mxh-filter-overlay-hidden">
                                    <div class="mxh-filter-x">×</div>
                                    <div class="mxh-filter-none">None</div>
                                </div>
                                <div class="mxh-card-inner">
                                    ${renderCardFace(ctx, activeAccount, accounts, 'front')}
                                </div>
                            </div>
                        </div>
                    `;
                });
                html += `
                        </div>
                    </div>
                `;
                if (index < sortedPlatforms.length - 1) {
                    html += `<hr class="mxh-platform-divider my-4">`;
                }
            });
            html += '</div>';
            container.innerHTML = html;
            ctx.applyMXHDynamicStyles(container);
            ctx.lastRenderedGroupId = ctx.activeGroupId;
            ctx.isInitialRenderComplete = true;
            ctx.initializeTooltips();
        }
        ctx.updateCardVisibility(searchQuery);
        ctx.isRendering = false;
    }
    window.MXHRender = {
        getGroupBadgeMarkup,
        renderGroupsNav,
        renderCardFace,
        updateStatsPanels,
        renderMXHAccounts
    };
})();
