// Typed MXH API facade. Existing MXHApi stays in place for compatibility.
(function () {
    const http = window.MonHttp;

    window.MXHTypedApi = {
        getGroups(signal?: AbortSignal) {
            return http.request<MXHGroup[]>("/mxh/api/groups", { signal });
        },
        getAccounts(lastUpdateTime?: string | null, signal?: AbortSignal) {
            const url = lastUpdateTime
                ? `/mxh/api/accounts?last_updated_at=${encodeURIComponent(lastUpdateTime)}`
                : "/mxh/api/accounts";
            return http.request<MXHAccount[]>(url, { signal });
        },
        createAccount(payload: Partial<MXHAccount>) {
            return http.postJson<MXHAccount>("/mxh/api/accounts", payload);
        },
        updateAccount(accountId: MXHId, payload: Partial<MXHAccount>) {
            return http.putJson<MXHAccount>(`/mxh/api/accounts/${accountId}`, payload);
        },
        deleteAccount(accountId: MXHId) {
            return http.request(`/mxh/api/accounts/${accountId}`, { method: "DELETE" });
        },
        setNotice(accountId: MXHId, payload: MXHNotice) {
            return http.putJson(`/mxh/api/accounts/${accountId}/notice`, payload);
        },
        deleteNotice(accountId: MXHId) {
            return http.request(`/mxh/api/accounts/${accountId}/notice`, { method: "DELETE" });
        }
    };
})();
