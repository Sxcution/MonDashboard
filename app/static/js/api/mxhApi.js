"use strict";
// Typed MXH API facade. Existing MXHApi stays in place for compatibility.
(function () {
    const http = window.MonHttp;
    window.MXHTypedApi = {
        getGroups(signal) {
            return http.request("/mxh/api/groups", { signal });
        },
        getAccounts(lastUpdateTime, signal) {
            const url = lastUpdateTime
                ? `/mxh/api/accounts?last_updated_at=${encodeURIComponent(lastUpdateTime)}`
                : "/mxh/api/accounts";
            return http.request(url, { signal });
        },
        createAccount(payload) {
            return http.postJson("/mxh/api/accounts", payload);
        },
        updateAccount(accountId, payload) {
            return http.putJson(`/mxh/api/accounts/${accountId}`, payload);
        },
        deleteAccount(accountId) {
            return http.request(`/mxh/api/accounts/${accountId}`, { method: "DELETE" });
        },
        setNotice(accountId, payload) {
            return http.putJson(`/mxh/api/accounts/${accountId}/notice`, payload);
        },
        deleteNotice(accountId) {
            return http.request(`/mxh/api/accounts/${accountId}/notice`, { method: "DELETE" });
        }
    };
})();
