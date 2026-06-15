// MXH badge calculations and nav badge rendering.
(function () {
    function getCardBadge(ctx, account, allAccounts = []) {
        const now = new Date();
        const badgeInfo = {
            total: 0,
            noticeExpired: 0,
            noticeExpiredAccounts: [],
            needHongKong: 0,
            needHongKongAccounts: []
        };

        const cardAccounts = allAccounts.length > 0 ? allAccounts : [account];

        cardAccounts.forEach((acc, idx) => {
            if (acc.notice) {
                const noticeObj = ctx.ensureNoticeParsed(acc.notice);
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

            if (acc.platform === 'wechat' && acc.wechat_created_year) {
                const createdDate = new Date(
                    acc.wechat_created_year,
                    (acc.wechat_created_month || 1) - 1,
                    acc.wechat_created_day || 1
                );
                const totalHours = ctx.calculateTimeDifferenceInHours(createdDate, now);
                const totalDays = Math.floor(totalHours / 24);

                if (totalDays >= 365) {
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

        let badges = '';

        if (badgeInfo.noticeExpired > 0) {
            const accountsList = badgeInfo.noticeExpiredAccounts.map(a =>
                `Tài khoản thứ ${a.index}`
            ).join(', ');

            let noticeCache = '';
            if (account.notice) {
                try {
                    const noticeObj = ctx.ensureNoticeParsed(account.notice);
                    if (noticeObj && noticeObj.enabled) {
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

        if (badgeInfo.needHongKong > 0 && badgeInfo.noticeExpired === 0) {
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

        const nearbyActiveAccounts = cardAccounts.filter(acc => ctx.isNearbyPeopleActive(acc));
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

    function calculateGroupBadge(ctx, groupId) {
        const now = new Date();
        const badgeInfo = {
            total: 0,
            noticeExpired: 0,
            needHongKong: 0
        };

        ctx.mxhAccounts.forEach(account => {
            if (account.group_id != groupId) return;

            if (account.notice) {
                const noticeObj = ctx.ensureNoticeParsed(account.notice);
                if (noticeObj && noticeObj.enabled && noticeObj.start_at && noticeObj.days) {
                    const startDate = new Date(noticeObj.start_at);
                    const endDate = new Date(startDate.getTime() + noticeObj.days * 24 * 60 * 60 * 1000);
                    if (now >= endDate) {
                        badgeInfo.noticeExpired++;
                        badgeInfo.total++;
                    }
                }
            }

            if (account.platform === 'wechat' && account.wechat_created_year) {
                const createdDate = new Date(account.wechat_created_year, account.wechat_created_month - 1, account.wechat_created_day);
                const totalHours = ctx.calculateTimeDifferenceInHours(createdDate, now);
                const totalDays = Math.floor(totalHours / 24);

                if (totalDays >= 365) {
                    const primaryPhone = (account.phone || '').replace(/[\s+]/g, '');
                    const isHongKongNumber = primaryPhone.startsWith('852');
                    if (!isHongKongNumber) {
                        badgeInfo.needHongKong++;
                        badgeInfo.total++;
                    }
                }
            }

            if (account.platform === 'wechat' && account.secondary_wechat_created_year) {
                const secCreatedDate = new Date(
                    account.secondary_wechat_created_year,
                    (account.secondary_wechat_created_month || 1) - 1,
                    account.secondary_wechat_created_day || 1
                );
                const secTotalHours = ctx.calculateTimeDifferenceInHours(secCreatedDate, now);
                const secTotalDays = Math.floor(secTotalHours / 24);

                if (secTotalDays >= 365) {
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

    function updateMainNavBadge(ctx) {
        const mxhNavLink = ctx.document.querySelector('a[href*="mxh"]');
        if (!mxhNavLink) return;

        const existingBadge = mxhNavLink.querySelector('.nav-badge-container');
        if (existingBadge) existingBadge.remove();

        const uniqueGroupIds = [...new Set(ctx.mxhAccounts.map(acc => acc.group_id).filter(id => id))];
        let totalBadgeCount = 0;
        let hasNoticeExpired = false;

        uniqueGroupIds.forEach(groupId => {
            const badgeInfo = calculateGroupBadge(ctx, groupId);
            if (badgeInfo.total > 0) {
                totalBadgeCount += badgeInfo.total;
                if (badgeInfo.noticeExpired > 0) hasNoticeExpired = true;
            }
        });

        if (totalBadgeCount <= 0) return;

        const badgeContainer = ctx.document.createElement('div');
        badgeContainer.className = 'nav-badge-container';

        const badge = ctx.document.createElement('span');
        badge.className = 'group-badge nav-badge';
        badge.style.cssText = `
                position: absolute;
                top: 2px;
                right: -8px;
                background-color: #07c160;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                font-size: 0.7rem;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 8px #07c16040;
                animation: pulse 2s infinite;
                z-index: 10;
            `;

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

    window.MXHBadges = {
        getCardBadge,
        calculateGroupBadge,
        updateMainNavBadge
    };
})();
