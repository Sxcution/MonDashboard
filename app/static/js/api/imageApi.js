"use strict";
// Image editor API facade. Keeps the existing Flask endpoints unchanged.
(function () {
    const http = window.MonHttp;
    window.ImageApi = {
        removeBlemish(formData) {
            return http.blob("/image/api/remove_blemish", {
                method: "POST",
                body: formData
            });
        },
        enhanceWebImage(formData) {
            return http.blob("/image/api/enhance_web_image", {
                method: "POST",
                body: formData
            });
        },
        saveCollage(formData) {
            return http.request("/image/api/save-collage", {
                method: "POST",
                body: formData
            });
        },
        collageHistory() {
            return http.request("/image/api/collage-history");
        },
        deleteCollage(id) {
            return http.request(`/image/api/collage-delete/${id}`, { method: "DELETE" });
        }
    };
})();
