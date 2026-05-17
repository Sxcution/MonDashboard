// Shared fetch helpers for classic-script and Vite bundled pages.
(function () {
    function buildJsonInit(options: JsonRequestOptions = {}): RequestInit {
        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };

        const { body, ...requestOptions } = options;
        const init: RequestInit = {
            ...requestOptions,
            method: options.method || "GET",
            headers
        };

        if (Object.prototype.hasOwnProperty.call(options, "body")) {
            init.body = JSON.stringify(body);
        }

        return init;
    }

    async function parseResponse<T>(response: Response): Promise<T> {
        const contentType = response.headers.get("content-type") || "";
        const hasJson = contentType.includes("application/json");
        const data = hasJson ? await response.json().catch(() => null) : await response.text();

        if (!response.ok) {
            const payload = (data && typeof data === "object") ? data as ApiErrorPayload : {};
            const message = payload.error || payload.message || payload.detail || `HTTP ${response.status}`;
            throw new Error(message);
        }

        return data as T;
    }

    async function request<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
        const response = await fetch(url, init);
        return parseResponse<T>(response);
    }

    async function blob(url: string, init: RequestInit = {}): Promise<Blob> {
        const response = await fetch(url, init);
        if (!response.ok) {
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                const payload = await response.json().catch(() => null) as ApiErrorPayload | null;
                throw new Error(payload?.install_hint || payload?.error || payload?.details || `HTTP ${response.status}`);
            }
            const text = await response.text().catch(() => "");
            throw new Error(text || `HTTP ${response.status}`);
        }
        return response.blob();
    }

    function raw(url: string, options: JsonRequestOptions = {}): Promise<Response> {
        return fetch(url, buildJsonInit(options));
    }

    function json<T = unknown>(url: string, options: JsonRequestOptions = {}): Promise<T> {
        return request<T>(url, buildJsonInit(options));
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
