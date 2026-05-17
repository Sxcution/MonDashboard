// Image editor API facade. Keeps the existing Flask endpoints unchanged.
(function () {
    const http = window.MonHttp;

    window.ImageApi = {
        removeBlemish(formData: FormData) {
            return http.blob("/image/api/remove_blemish", {
                method: "POST",
                body: formData
            });
        },
        enhanceWebImage(formData: FormData) {
            return http.blob("/image/api/enhance_web_image", {
                method: "POST",
                body: formData
            });
        },
        saveCollage(formData: FormData) {
            return http.request("/image/api/save-collage", {
                method: "POST",
                body: formData
            });
        },
        collageHistory() {
            return http.request<{ history: ImageCollageHistoryItem[] }>("/image/api/collage-history");
        },
        deleteCollage(id: string) {
            return http.request(`/image/api/collage-delete/${id}`, { method: "DELETE" });
        }
    };
})();
