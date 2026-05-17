// Image editor API facade. Keeps the existing Flask endpoints unchanged.
(function () {
    const http = window.MonHttp;

    window.ImageApi = {
        objectRemove(formData: FormData) {
            return http.blob("/image/api/object_remove", {
                method: "POST",
                body: formData
            });
        },
        upscaleImage(formData: FormData) {
            return http.blob("/image/api/upscale_image", {
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
