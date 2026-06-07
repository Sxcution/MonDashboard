// MXH search/filter helpers.
(function () {
    function getNearbyPeopleHoursUntilActive(ctx, account, now) {
        if (!account || account.platform !== 'wechat') return Number.POSITIVE_INFINITY;
        if ((account.status || '').toLowerCase() === 'disabled') return Number.POSITIVE_INFINITY;
        if (!ctx.isEligibleNearbyPeople(account)) return Number.POSITIVE_INFINITY;
        if (!account.nearby_people_until) return 0;

        const until = new Date(account.nearby_people_until);
        if (isNaN(until.getTime())) return Number.POSITIVE_INFINITY;

        return Math.max(0, ctx.calculateTimeDifferenceInHours(now, until));
    }

    function getNearestNearbyPeopleHours(ctx, accounts, now) {
        let nearestHours = Number.POSITIVE_INFINITY;
        accounts.forEach(account => {
            const hoursUntilActive = getNearbyPeopleHoursUntilActive(ctx, account, now);
            if (hoursUntilActive < nearestHours) nearestHours = hoursUntilActive;
        });
        return nearestHours;
    }

    function applyQuickFilter(ctx, filterKey) {
        if (ctx.isRendering) return;

        if (ctx.activeFilter === filterKey) {
            ctx.activeFilter = 'default';
        } else {
            ctx.activeFilter = filterKey;
        }

        const dropdownItems = ctx.document.querySelectorAll('.dropdown-item') as NodeListOf<HTMLElement>;
        dropdownItems.forEach(item => {
            if (item.dataset.filter === ctx.activeFilter) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        const visibleAccounts = ctx.activeGroupId
            ? ctx.mxhAccounts.filter(acc => String(acc.group_id) === String(ctx.activeGroupId))
            : ctx.mxhAccounts;
        ctx.updateStatsPanels(visibleAccounts);

        const searchQuery = ctx.document.getElementById('mxh-search-input').value.trim().toLowerCase();
        updateCardVisibility(ctx, searchQuery);
    }

    function updateCardVisibility(ctx, searchQuery) {
        const cols = ctx.document.querySelectorAll('.mxh-card-col');
        const filterDims = (
            ctx.activeFilter === 'wechat_scan' ||
            ctx.activeFilter === 'wechat_scan_vn' ||
            ctx.activeFilter === 'wechat_scan_hk' ||
            ctx.activeFilter === 'has_notice' ||
            ctx.activeFilter === 'creation_date' ||
            ctx.activeFilter === 'creation_date_newest' ||
            ctx.activeFilter === 'one_year' ||
            ctx.activeFilter === 'new_month' ||
            ctx.activeFilter === 'disabled' ||
            ctx.activeFilter === 'unverified' ||
            ctx.activeFilter === 'incomplete_info' ||
            ctx.activeFilter === 'need_hk' ||
            ctx.activeFilter === 'nearby_people'
        );
        const viewDims = (ctx.activeViewFilter === 'card2' || ctx.activeViewFilter === 'card3');
        const shouldDim = filterDims || viewDims || searchQuery.length > 0;

        let colsArray = Array.from(cols) as any[];
        const shouldSortByCreationDate = (ctx.activeFilter === 'creation_date' || ctx.activeFilter === 'creation_date_newest');
        const shouldSortByNearbyPeople = ctx.activeFilter === 'nearby_people';
        const shouldSort = shouldSortByCreationDate || shouldSortByNearbyPeople;
        const now = new Date();

        colsArray.forEach(col => {
            const cardId = col.dataset.cardId;
            const accounts = ctx.mxhAccounts.filter(acc => String(acc.card_id) === String(cardId));
            const nearestNearbyHours = shouldSortByNearbyPeople
                ? getNearestNearbyPeopleHours(ctx, accounts, now)
                : Number.POSITIVE_INFINITY;

            let isSearchMatch = true;
            if (searchQuery) {
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

            let isFilterMatch = true;
            if (filterDims) {
                if (ctx.activeFilter === 'wechat_scan' || ctx.activeFilter === 'wechat_scan_vn') {
                    isFilterMatch = accounts.some(account => ctx.canScanWeChat(account));
                } else if (ctx.activeFilter === 'wechat_scan_hk') {
                    isFilterMatch = accounts.some(account => ctx.canScanWeChatHK(account));
                } else if (ctx.activeFilter === 'has_notice') {
                    isFilterMatch = accounts.some(account => {
                        const noticeObj = ctx.ensureNoticeParsed(account.notice);
                        return (noticeObj && (noticeObj.enabled === true || noticeObj.enabled === 1 || Number(noticeObj.days) > 0));
                    });
                } else if (ctx.activeFilter === 'one_year') {
                    const now = new Date();
                    isFilterMatch = accounts.some(account => {
                        const created = ctx.getAccountCreatedDateForStats(account);
                        if (!created || isNaN(created.getTime())) return false;
                        const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
                        return days >= 365;
                    });
                } else if (ctx.activeFilter === 'new_month') {
                    const now = new Date();
                    isFilterMatch = accounts.some(account => {
                        const created = ctx.getAccountCreatedDateForStats(account);
                        if (!created || isNaN(created.getTime())) return false;
                        const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
                        return days >= 0 && days < 30;
                    });
                } else if (ctx.activeFilter === 'disabled') {
                    isFilterMatch = accounts.some(account => ctx.isAccountDisabledForStats(account));
                } else if (ctx.activeFilter === 'unverified') {
                    isFilterMatch = accounts.some(account => account.wechat_status === 'unverified');
                } else if (ctx.activeFilter === 'incomplete_info') {
                    isFilterMatch = accounts.some(account => ctx.hasIncompleteProfileInfo(account));
                } else if (ctx.activeFilter === 'need_hk') {
                    isFilterMatch = accounts.some(account => ctx.needsHongKongNumber(account));
                } else if (ctx.activeFilter === 'nearby_people') {
                    isFilterMatch = Number.isFinite(nearestNearbyHours);
                }
            }

            const isViewMatch = true;
            const isMatch = isSearchMatch && isFilterMatch && isViewMatch;

            col._isMatch = isMatch;

            if (shouldSortByCreationDate) {
                let dateVal = 0;
                if (ctx.activeFilter === 'creation_date') {
                    let minTs = Infinity;
                    accounts.forEach(account => {
                        const date = ctx.getAccountCreatedDateForStats(account);
                        if (date && !isNaN(date.getTime()) && date.getTime() < minTs) minTs = date.getTime();
                    });
                    dateVal = (minTs === Infinity) ? Number.MAX_SAFE_INTEGER : minTs;
                } else {
                    let maxTs = -1;
                    accounts.forEach(account => {
                        const date = ctx.getAccountCreatedDateForStats(account);
                        if (date && !isNaN(date.getTime()) && date.getTime() > maxTs) maxTs = date.getTime();
                    });
                    dateVal = (maxTs === -1) ? 0 : maxTs;
                }
                col._dateVal = dateVal;
            } else if (shouldSortByNearbyPeople) {
                col._nearbyPeopleVal = Number.isFinite(nearestNearbyHours)
                    ? nearestNearbyHours
                    : Number.MAX_SAFE_INTEGER;
            }

            const wrapper = col.querySelector('.mxh-card-wrapper');
            const overlay = wrapper.querySelector('.mxh-filter-overlay');

            if (isMatch) {
                wrapper.classList.remove('mxh-filtered-out');
                if (overlay) overlay.style.display = 'none';
            } else {
                wrapper.classList.add('mxh-filtered-out');
                if (overlay) overlay.style.display = 'flex';
            }

            col.style.order = '';
        });

        if (shouldSort) {
            colsArray.sort((a, b) => {
                if (shouldSortByNearbyPeople) {
                    return (a._nearbyPeopleVal - b._nearbyPeopleVal);
                }
                if (ctx.activeFilter === 'creation_date') {
                    return (a._dateVal - b._dateVal);
                }
                return (b._dateVal - a._dateVal);
            });

            colsArray.forEach((col, index) => {
                col.style.order = index;
            });
        }
    }

    window.MXHFilters = {
        applyQuickFilter,
        updateCardVisibility
    };
})();
