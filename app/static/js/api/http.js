"use strict";
// Shared fetch helpers for classic-script and Vite bundled pages.
(function () {
    function buildJsonInit(options = {}) {
        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };
        const { body, ...requestOptions } = options;
        const init = {
            ...requestOptions,
            method: options.method || "GET",
            headers
        };
        if (Object.prototype.hasOwnProperty.call(options, "body")) {
            init.body = JSON.stringify(body);
        }
        return init;
    }
    async function parseResponse(response) {
        const contentType = response.headers.get("content-type") || "";
        const hasJson = contentType.includes("application/json");
        const data = hasJson ? await response.json().catch(() => null) : await response.text();
        if (!response.ok) {
            const payload = (data && typeof data === "object") ? data : {};
            const message = payload.error || payload.message || payload.detail || `HTTP ${response.status}`;
            throw new Error(message);
        }
        return data;
    }
    async function request(url, init = {}) {
        const response = await fetch(url, init);
        return parseResponse(response);
    }
    async function blob(url, init = {}) {
        const response = await fetch(url, init);
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(text || `HTTP ${response.status}`);
        }
        return response.blob();
    }
    function raw(url, options = {}) {
        return fetch(url, buildJsonInit(options));
    }
    function json(url, options = {}) {
        return request(url, buildJsonInit(options));
    }
    window.MonHttp = {
        request,
        blob,
        json,
        raw,
        postJson(url, body, init = {}) {
            return json(url, { ...init, method: "POST", body });
        },
        putJson(url, body, init = {}) {
            return json(url, { ...init, method: "PUT", body });
        },
        deleteJson(url, init = {}) {
            return json(url, { ...init, method: "DELETE" });
        }
    };
})();
