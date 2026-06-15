// MXH account date/status rules. Classic global wrapper, no ES modules yet.
(function () {
    function normalizeISOForJS(iso) {
        if (!iso) return null;
        let s = String(iso).trim();
        s = s.replace(' ', 'T');
        if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s += 'Z';
        s = s.replace(/(\.\d{3})\d+/, '$1');
        return s;
    }

    function ensureNoticeParsed(notice) {
        const n = (typeof notice === 'string') ? (() => { try { return JSON.parse(notice); } catch { return {}; } })() : (notice || {});
        if (n && n.start_at) n.start_at = normalizeISOForJS(n.start_at);
        return n;
    }

    function calculateTimeDifferenceInHours(startDate, endDate) {
        const diffMilliseconds = endDate.getTime() - startDate.getTime();
        return diffMilliseconds / (1000 * 60 * 60);
    }

    function formatAccountAge(createdDate, now) {
        const totalHours = calculateTimeDifferenceInHours(createdDate, now);
        const totalDays = Math.floor(totalHours / 24);

        if (totalDays >= 365) {
            const years = Math.floor(totalDays / 365);
            const months = Math.floor((totalDays % 365) / 30);
            return {
                display: `${years}N ${months}th`,
                color: '#07c160'
            };
        }

        if (totalDays >= 30) {
            const months = Math.floor(totalDays / 30);
            const days = totalDays % 30;
            return {
                display: `${months}th ${days}d`,
                color: '#fff'
            };
        }

        return {
            display: `${totalDays}d`,
            color: '#fff'
        };
    }

    function calculateNearbyCountdown(account, now) {
        if (!isEligibleNearbyPeople(account)) return '';
        const createdDate = new Date(account.wechat_created_year, (account.wechat_created_month || 1) - 1, account.wechat_created_day || 1);
        const totalHours = calculateTimeDifferenceInHours(createdDate, now);
        const totalDays = Math.floor(totalHours / 24);
        const isOldAccount = totalDays >= 365;
        const activeClass = isOldAccount ? 'mxh-color-success' : 'mxh-color-white';

        if (!account.nearby_people_until) {
            return `<i class="bi bi-geo-alt me-1 mxh-countdown-icon ${activeClass}"></i><span class="${activeClass}">Active</span>`;
        }

        const until = new Date(account.nearby_people_until);
        const hoursUntil = calculateTimeDifferenceInHours(now, until);
        if (hoursUntil <= 0) {
            return `<i class="bi bi-geo-alt me-1 mxh-countdown-icon ${activeClass}"></i><span class="${activeClass}">Active</span>`;
        }

        const remainingDays = Math.floor(hoursUntil / 24);
        const remainingHours = Math.floor(hoursUntil % 24);
        const countdownClass = hoursUntil < 72 ? 'mxh-color-warning' : 'mxh-color-white';
        if (remainingDays > 0) {
            return `<i class="bi bi-geo-alt me-1 mxh-countdown-icon ${countdownClass}"></i><span class="${countdownClass}">${remainingDays} ngày</span>`;
        }
        return `<i class="bi bi-geo-alt me-1 mxh-countdown-icon ${countdownClass}"></i><span class="${countdownClass}">${remainingHours} giờ</span>`;
    }

    function calculateScanCountdown(account, now) {
        const currentScanCount = account.wechat_scan_count || 0;
        const maxScans = 3;

        if (currentScanCount >= maxScans) {
            return `<i class="bi bi-qr-code me-1 mxh-color-danger"></i>${maxScans}/${maxScans}`;
        }

        if (account.wechat_last_scan_date) {
            const lastScanDate = new Date(account.wechat_last_scan_date);
            const nextScanDate = new Date(lastScanDate.getTime() + 30 * 24 * 60 * 60 * 1000);
            const hoursUntilNextScan = calculateTimeDifferenceInHours(now, nextScanDate);

            if (hoursUntilNextScan > 0) {
                const remainingDays = Math.floor(hoursUntilNextScan / 24);
                const remainingHours = Math.floor(hoursUntilNextScan % 24);
                if (remainingDays > 0) {
                    return `<i class="bi bi-qr-code me-1 mxh-countdown-icon mxh-color-white"></i>${currentScanCount} <small class="text-warning">(${remainingDays}d)</small>`;
                } else if (remainingHours > 0) {
                    return `<i class="bi bi-qr-code me-1 mxh-color-white"></i>${currentScanCount} <small class="text-warning">(${remainingHours}h)</small>`;
                }
                return `<i class="bi bi-qr-code me-1 mxh-countdown-icon mxh-color-success"></i>${currentScanCount}`;
            }
            return `<i class="bi bi-qr-code me-1 mxh-countdown-icon mxh-color-success"></i>${currentScanCount}`;
        }

        const createdDate = new Date(account.wechat_created_year, (account.wechat_created_month || 1) - 1, account.wechat_created_day || 1);
        const totalHours = calculateTimeDifferenceInHours(createdDate, now);
        const totalDays = Math.floor(totalHours / 24);

        if (totalDays < 180) {
            return '';
        }
        return `<i class="bi bi-qr-code me-1 mxh-countdown-icon mxh-color-success"></i>${currentScanCount}/${maxScans}`;
    }

    function canScanWeChat(account) {
        if (!account || account.platform !== 'wechat') return false;
        if ((account.status || '').toLowerCase() === 'disabled') return false;

        const phone = (account.phone || '').replace(/[\s+]/g, '');
        if (phone.startsWith('852')) return false;

        const now = new Date();
        const currentScanCount = account.wechat_scan_count || 0;
        const maxScans = 3;
        if (currentScanCount >= maxScans) return false;

        if (account.wechat_last_scan_date) {
            const lastScanDate = new Date(account.wechat_last_scan_date);
            const nextScanDate = new Date(lastScanDate.getTime() + 30 * 24 * 60 * 60 * 1000);
            const hoursUntilNextScan = calculateTimeDifferenceInHours(now, nextScanDate);
            return hoursUntilNextScan <= 0;
        }

        if (!account.wechat_created_year) return false;
        const createdDate = new Date(account.wechat_created_year, (account.wechat_created_month || 1) - 1, account.wechat_created_day || 1);
        const totalHours = calculateTimeDifferenceInHours(createdDate, now);
        return totalHours >= 180 * 24;
    }

    function needsHongKongNumber(account) {
        if (!account || account.platform !== 'wechat') return false;
        if (!account.wechat_created_year) return false;

        const now = new Date();
        const createdDate = new Date(
            account.wechat_created_year,
            (account.wechat_created_month || 1) - 1,
            account.wechat_created_day || 1
        );
        const totalHours = calculateTimeDifferenceInHours(createdDate, now);
        const totalDays = Math.floor(totalHours / 24);
        if (totalDays < 365) return false;

        const primaryPhone = (account.phone || '').replace(/[\s+]/g, '');
        const isHongKongNumber = primaryPhone.startsWith('852');
        return !isHongKongNumber;
    }

    function canScanWeChatHK(account) {
        if (!account || account.platform !== 'wechat') return false;
        if ((account.status || '').toLowerCase() === 'disabled') return false;
        if (!account.wechat_created_year) return false;

        const now = new Date();
        const createdDate = new Date(
            account.wechat_created_year,
            (account.wechat_created_month || 1) - 1,
            account.wechat_created_day || 1
        );
        const totalDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        if (totalDays < 365) return false;

        const phone = (account.phone || '').replace(/[\s+]/g, '');
        return phone.startsWith('852');
    }

    function isEligibleNearbyPeople(account) {
        if (!account || account.platform !== 'wechat') return false;
        if (!account.wechat_created_year) return false;
        const now = new Date();
        const createdDate = new Date(
            account.wechat_created_year,
            (account.wechat_created_month || 1) - 1,
            account.wechat_created_day || 1
        );
        const totalDays = Math.floor(calculateTimeDifferenceInHours(createdDate, now) / 24);
        return totalDays >= 365;
    }

    function isNearbyPeopleActive(account) {
        if (!account || account.platform !== 'wechat') return false;
        if ((account.status || '').toLowerCase() === 'disabled') return false;
        if (!isEligibleNearbyPeople(account)) return false;
        if (account.nearby_people_until) {
            const until = new Date(account.nearby_people_until);
            const now = new Date();
            const hoursLeft = calculateTimeDifferenceInHours(now, until);
            if (hoursLeft > 12) return false;
        }
        return true;
    }

    function getAccountCreatedDateForStats(acc) {
        const y = acc.wechat_created_year || acc.created_year;
        const m = acc.wechat_created_month || acc.created_month;
        const d = acc.wechat_created_day || acc.created_day;

        if (y) {
            return new Date(Number(y), (Number(m || 1) - 1), Number(d || 1));
        }

        if (acc.created_at) {
            const dt = new Date(normalizeISOForJS(acc.created_at));
            if (!isNaN(dt.getTime())) return dt;
        }

        return null;
    }

    function isAccountDisabledForStats(acc) {
        const st = String(acc.status || '').toLowerCase();
        return (st === 'disabled' || st === 'die' || st === 'inactive') || !!acc.die_date;
    }

    function hasIncompleteProfileInfo(account) {
        if (!account || account.platform !== 'wechat') return false;

        const hasValue = (value) => {
            const normalized = String(value || '').trim();
            return normalized !== '' && normalized !== '.';
        };

        const verification = String(account.wechat_status || '').trim().toLowerCase();
        const isUnverified = verification === 'unverified';

        return !hasValue(account.username) ||
            !hasValue(account.phone) ||
            !hasValue(account.email) ||
            !hasValue(account.wechat_nickname) ||
            isUnverified;
    }

    function getAccountBorderClass(account) {
        const status = String(account.status || '').toLowerCase();
        if (status === 'disabled') return '';

        if (account.wechat_status === 'unverified') {
            return 'mxh-border-yellow';
        }

        if (account.platform === 'wechat') {
            if (isNearbyPeopleActive(account)) {
                return 'mxh-border-blue';
            }

            if (account.wechat_created_year) {
                const now = new Date();
                const createdDate = new Date(
                    account.wechat_created_year,
                    (account.wechat_created_month || 1) - 1,
                    account.wechat_created_day || 1
                );
                const totalHours = calculateTimeDifferenceInHours(createdDate, now);
                const totalDays = Math.floor(totalHours / 24);
                if (totalDays >= 365) {
                    // Bỏ viền neon trắng (VN) và xanh lá cây (HK) đối với các tài khoản trên 1 năm tuổi
                    return '';
                }
            }
        }

        return '';
    }

    window.MXHAccountRules = {
        normalizeISOForJS,
        ensureNoticeParsed,
        calculateTimeDifferenceInHours,
        formatAccountAge,
        calculateNearbyCountdown,
        calculateScanCountdown,
        canScanWeChat,
        needsHongKongNumber,
        canScanWeChatHK,
        isEligibleNearbyPeople,
        isNearbyPeopleActive,
        getAccountCreatedDateForStats,
        isAccountDisabledForStats,
        hasIncompleteProfileInfo,
        getAccountBorderClass
    };
})();

