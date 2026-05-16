// MXH page startup and UI binding. Classic global wrapper, no ES modules yet.
(function () {
    function initializeCardsPerRow(ctx) {
        const doc = ctx.document;
        const savedCardsPerRow = ctx.window.localStorage.getItem('mxh_cards_per_row') || 12;
        const cardsPerRowInput = doc.getElementById('mxh-cards-per-row');
        if (cardsPerRowInput) {
            cardsPerRowInput.value = savedCardsPerRow;
        }

        const existing = doc.getElementById('mxh-dynamic-style');
        const style = existing || doc.createElement('style');
        style.id = 'mxh-dynamic-style';
        style.innerHTML = `
            #mxh-accounts-container .row > .col {
                flex: 0 0 calc(100% / ${savedCardsPerRow});
                max-width: calc(100% / ${savedCardsPerRow});
            }
        `;
        if (!existing) doc.head.appendChild(style);
    }

    function checkNoticeExpirations(ctx) {
        if (typeof ctx.window.showPlatformNotification !== 'function') return;

        const notifiedKey = 'mxh_notified_notices_session';
        let notifiedSet;
        try {
            notifiedSet = new Set(JSON.parse(ctx.window.sessionStorage.getItem(notifiedKey) || '[]'));
        } catch (e) {
            notifiedSet = new Set();
        }

        const now = new Date();
        ctx.mxhAccounts.forEach(acc => {
            if (!acc.notice) return;
            const notice = ctx.ensureNoticeParsed(acc.notice);
            if (!notice || !notice.enabled) return;

            const start = notice.start_at ? new Date(notice.start_at) : null;
            const days = Number(notice.days) || 0;
            if (!start || days <= 0) return;

            const due = new Date(start.getTime() + days * 86400000);
            if (now < due) return;

            const key = `${acc.id}_${notice.title}_${due.getTime()}`;
            if (notifiedSet.has(key)) return;

            const accName = acc.username || acc.wechat_nickname || `Card ${acc.card_name}`;
            ctx.window.showPlatformNotification('⚠️ Thông báo ĐẾN HẠN', `${accName} - ${notice.title}: ${notice.note || ''}`);
            notifiedSet.add(key);
        });

        ctx.window.sessionStorage.setItem(notifiedKey, JSON.stringify([...notifiedSet]));
    }

    function bindModalLifecycle(ctx) {
        ctx.document.querySelectorAll('.modal').forEach(modal => {
            if (modal.dataset.mxhLifecycleBound) return;
            modal.dataset.mxhLifecycleBound = '1';
            modal.addEventListener('show.bs.modal', () => {
                ctx.window.interactionPaused = true;
                ctx.pauseAutoRefresh();
            });
            modal.addEventListener('hide.bs.modal', () => {
                ctx.window.interactionPaused = false;
                ctx.resumeAutoRefresh();
            });
        });
    }

    function bindVisibility(ctx) {
        const doc = ctx.document;
        if (doc.documentElement?.dataset.mxhVisibilityBound) return;
        if (doc.documentElement) doc.documentElement.dataset.mxhVisibilityBound = '1';

        doc.addEventListener('visibilitychange', () => {
            if (doc.hidden) {
                ctx.captureMXHInlineEditSelection();
                ctx.stopAutoRefresh();
            } else {
                ctx.startAutoRefresh();
                if (ctx.isMXHInlineEditing()) {
                    setTimeout(ctx.restoreMXHInlineEditSelection, 50);
                } else {
                    ctx.loadMXHData(false);
                }
            }
        });
    }

    function bindFilterDropdown(ctx) {
        const filterMenu = ctx.document.querySelector('.dropdown-menu[aria-labelledby="mxh-filter-btn"]');
        if (!filterMenu || filterMenu.dataset.mxhFilterBound) return;
        filterMenu.dataset.mxhFilterBound = '1';

        filterMenu.addEventListener('click', (event) => {
            event.preventDefault();
            const targetItem = event.target.closest('.dropdown-item');
            if (!targetItem) return;

            const filterType = targetItem.dataset.filter;
            if (!filterType) return;

            ctx.activeFilter = filterType;
            const filterButton = ctx.document.getElementById('mxh-filter-btn');

            filterMenu.querySelectorAll('.dropdown-item').forEach(item => {
                item.classList.toggle('active', item === targetItem);
            });

            if (filterButton) {
                if (filterType === 'default') {
                    filterButton.innerHTML = '<i class="bi bi-funnel me-1"></i> Lọc';
                    filterButton.classList.remove('btn-primary');
                    filterButton.classList.add('btn-outline-secondary');
                } else {
                    filterButton.innerHTML = `<i class="bi bi-funnel-fill me-1"></i> ${targetItem.textContent.trim()}`;
                    filterButton.classList.add('btn-primary');
                    filterButton.classList.remove('btn-outline-secondary');
                }
            }

            ctx.scheduleRender();
        });
    }

    function bindSearch(ctx) {
        const searchInput = ctx.document.getElementById('mxh-search-input');
        const clearButton = ctx.document.getElementById('mxh-search-clear');
        const searchGroup = ctx.document.getElementById('mxh-search-group');
        if (!searchInput || !clearButton || !searchGroup || searchGroup.dataset.mxhSearchBound) return;
        searchGroup.dataset.mxhSearchBound = '1';

        const handleSearch = (event) => {
            const query = event.target.value;
            ctx.mxhSearchQuery = query;
            clearButton.style.display = query ? 'block' : 'none';
            ctx.scheduleRender();
        };

        searchInput.addEventListener('input', ctx.debounce(handleSearch, 250));

        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            ctx.mxhSearchQuery = '';
            clearButton.style.display = 'none';
            searchInput.focus();
            ctx.scheduleRender();
        });
    }

    async function init(ctx) {
        initializeCardsPerRow(ctx);
        window.MXHAccountActions.init(ctx);
        window.MXHPhoneHistory.bindControls(ctx);
        window.MXHModalForms.init(ctx);
        window.MXHNoticePreview.init(ctx);
        window.MXHScanHistory.bindControls(ctx);

        ctx.renderGroupsNav();
        ctx.updateMainNavBadge();

        setTimeout(() => {
            ctx.renderGroupsNav();
            ctx.updateMainNavBadge();
            checkNoticeExpirations(ctx);
        }, 100);

        bindModalLifecycle(ctx);
        bindVisibility(ctx);
        bindFilterDropdown(ctx);
        bindSearch(ctx);
        window.MXHContextMenu.bindBackgroundContextMenu(ctx);
        window.MXHContextActions.bind(ctx);

        await ctx.loadMXHData(true);
        ctx.startAutoRefresh();
    }

    window.MXHInit = {
        init,
        initializeCardsPerRow,
        checkNoticeExpirations
    };
})();
