// Typed localStorage helpers for the legacy image editor.
(function () {
    const STORAGE_KEY_EDIT_IMAGE = "stool_edit_image_cache";
    const STORAGE_KEY_COLLAGE_IMAGES = "stool_collage_images_cache";
    const STORAGE_KEY_COLLAGE_HISTORY = "stool_collage_history";

    function keyForType(type: ImageCacheType = "edit"): string {
        return type === "edit" ? STORAGE_KEY_EDIT_IMAGE : STORAGE_KEY_COLLAGE_IMAGES;
    }

    function saveImageToCache(data: string | string[], type: ImageCacheType = "edit"): void {
        const value = Array.isArray(data) ? JSON.stringify(data) : data;
        localStorage.setItem(keyForType(type), value);
    }

    function loadImageFromCache(type: ImageCacheType = "edit"): string | null {
        return localStorage.getItem(keyForType(type));
    }

    function clearImageCache(type: ImageCacheType = "edit"): void {
        localStorage.removeItem(keyForType(type));
    }

    function readCollageHistory(): ImageCollageHistoryItem[] {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY_COLLAGE_HISTORY) || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function writeCollageHistory(history: ImageCollageHistoryItem[]): void {
        localStorage.setItem(STORAGE_KEY_COLLAGE_HISTORY, JSON.stringify(history));
    }

    function addCollageHistory(images: string[], layoutId: string | null = null): ImageCollageHistoryItem {
        const history = readCollageHistory();
        const entry: ImageCollageHistoryItem = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleString("vi-VN"),
            imageCount: images.length,
            images,
            layoutId
        };

        history.unshift(entry);
        if (history.length > 50) history.splice(50);
        writeCollageHistory(history);
        return entry;
    }

    window.ImageEditorStorage = {
        saveImageToCache,
        loadImageFromCache,
        clearImageCache,
        readCollageHistory,
        writeCollageHistory,
        addCollageHistory
    };
})();
