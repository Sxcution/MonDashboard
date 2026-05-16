// MXH API helpers.
// Classic script wrapper keeps the current non-module frontend stable while
// moving endpoint knowledge out of mxh.js one piece at a time.
(function () {
    const jsonHeaders = { 'Content-Type': 'application/json' };
    const acceptJsonHeaders = { 'Accept': 'application/json' };

    const noticeEndpoints = {
        getNotice: [
            '/mxh/api/notice',
            '/mxh/notice',
            '/api/mxh/notice'
        ],
        disableNotice: [
            '/mxh/api/notice/disable',
            '/mxh/notice/disable',
            '/api/mxh/notice/disable'
        ]
    };

    let cachedNoticeGetURL = null;
    let cachedNoticeDisableURL = null;

    function jsonInit(method, body) {
        return {
            method,
            headers: jsonHeaders,
            body: JSON.stringify(body)
        };
    }

    async function tryFetch(urls, init) {
        let lastErr;
        for (const url of urls) {
            try {
                const res = await fetch(url, init);
                if (res.ok) return { res, url };
                lastErr = new Error(`HTTP ${res.status} @ ${url}`);
                if (res.status === 404) continue;
                throw lastErr;
            } catch (err) {
                lastErr = err;
            }
        }
        throw lastErr || new Error('No endpoint matched');
    }

    window.MXHApi = {
        getGroups(signal) {
            return fetch('/mxh/api/groups', { signal });
        },

        createGroup(payload) {
            return fetch('/mxh/api/groups', jsonInit('POST', payload));
        },

        getAccounts(lastUpdateTime, signal) {
            const url = lastUpdateTime
                ? `/mxh/api/accounts?last_updated_at=${lastUpdateTime}`
                : '/mxh/api/accounts';
            return fetch(url, { signal });
        },

        createAccount(payload) {
            return fetch('/mxh/api/accounts', jsonInit('POST', payload));
        },

        updateAccount(accountId, payload) {
            return fetch(`/mxh/api/accounts/${accountId}`, jsonInit('PUT', payload));
        },

        deleteAccount(accountId) {
            return fetch(`/mxh/api/accounts/${accountId}`, { method: 'DELETE' });
        },

        resetAccount(accountId) {
            return fetch(`/mxh/api/accounts/${accountId}/reset`, { method: 'POST' });
        },

        moveAccount(accountId, payload) {
            return fetch(`/mxh/api/accounts/${accountId}/move`, jsonInit('POST', payload));
        },

        toggleStatus(accountId) {
            return fetch(`/mxh/api/accounts/${accountId}/toggle-status`, { method: 'POST' });
        },

        scanAccount(accountId) {
            return fetch(`/mxh/api/accounts/${accountId}/scan`, { method: 'POST' });
        },

        resetScan(accountId) {
            return fetch(`/mxh/api/accounts/${accountId}/scan`, jsonInit('POST', { reset: true }));
        },

        rescueAccount(accountId, payload) {
            return fetch(`/mxh/api/accounts/${accountId}/rescue`, jsonInit('POST', payload));
        },

        createSubAccount(cardId, payload) {
            return fetch(`/mxh/api/cards/${cardId}/accounts`, jsonInit('POST', payload));
        },

        updateCard(cardId, payload) {
            return fetch(`/mxh/api/cards/${cardId}`, jsonInit('PUT', payload));
        },

        deleteCard(cardId) {
            return fetch(`/mxh/api/cards/${cardId}`, { method: 'DELETE' });
        },

        deleteSubAccount(accountId) {
            return fetch(`/mxh/api/sub_accounts/${accountId}`, { method: 'DELETE' });
        },

        setNotice(accountId, payload) {
            return fetch(`/mxh/api/accounts/${accountId}/notice`, jsonInit('PUT', payload));
        },

        deleteNotice(accountId) {
            return fetch(`/mxh/api/accounts/${accountId}/notice`, { method: 'DELETE' });
        },

        getPhoneHistory(accountId) {
            return fetch(`/mxh/api/accounts/${accountId}/phone-history`);
        },

        addPhoneHistory(accountId, payload) {
            return fetch(`/mxh/api/accounts/${accountId}/phone-history/add`, jsonInit('POST', payload));
        },

        deletePhoneHistory(accountId) {
            return fetch(`/mxh/api/accounts/${accountId}/phone-history`, { method: 'DELETE' });
        },

        nearbyPeople(payload) {
            return fetch('/mxh/api/nearby_people', jsonInit('POST', payload));
        },

        async getNoticeData(accountId, badge) {
            const raw = badge?.dataset?.noticeCache;
            if (raw) {
                try {
                    return JSON.parse(raw);
                } catch { }
            }

            const q = `?account_id=${encodeURIComponent(accountId)}`;
            const urls = cachedNoticeGetURL
                ? [cachedNoticeGetURL + q]
                : noticeEndpoints.getNotice.map(url => url + q);
            const { res, url } = await tryFetch(urls, { headers: acceptJsonHeaders });
            cachedNoticeGetURL = url.replace(q, '');
            return res.json();
        },

        async disableNotice(accountId, noticeId) {
            const body = noticeId ? { notice_id: noticeId } : { account_id: accountId };
            const urls = cachedNoticeDisableURL
                ? [cachedNoticeDisableURL]
                : noticeEndpoints.disableNotice;
            const { res, url } = await tryFetch(urls, jsonInit('POST', body));
            cachedNoticeDisableURL = url;
            if (!res.ok) throw new Error('Disable notice failed: ' + res.status);
            return res.json().catch(() => ({}));
        },

        getScanHistory(accountId) {
            return fetch(`/mxh/api/accounts/${accountId}/scan-history`);
        },

        deleteScanHistory(accountId) {
            return fetch(`/mxh/api/accounts/${accountId}/scan-history`, { method: 'DELETE' });
        }
    };
})();
