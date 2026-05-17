"use strict";
// Typed Image editor module: local history and cache wrappers.
// Keeps behavior compatible while the monolith is split into smaller files.
// ===== AUTO-SAVE & RESTORE SYSTEM =====
// Use localStorage instead of sessionStorage to persist across browser close
const STORAGE_KEY_EDIT_IMAGE = 'stool_edit_image_cache'; // Legacy, kept for compatibility
const STORAGE_KEY_COLLAGE_IMAGES = 'stool_collage_images_cache';
const STORAGE_KEY_COLLAGE_HISTORY = 'stool_collage_history';
// Save image to localStorage
function saveImageToCache(data, type = 'edit') {
    try {
        window.ImageEditorStorage.saveImageToCache(data, type);
        console.log(`âœ… Image saved to cache (${type})`, Array.isArray(data) ? `${data.length} images` : '');
    }
    catch (e) {
        console.warn('âš ï¸ Failed to save image to cache:', e);
    }
}
// Load image from localStorage
function loadImageFromCache(type = 'edit') {
    try {
        const dataURL = window.ImageEditorStorage.loadImageFromCache(type);
        if (dataURL) {
            console.log(`âœ… Image loaded from cache (${type})`);
            return dataURL;
        }
    }
    catch (e) {
        console.warn('âš ï¸ Failed to load image from cache:', e);
    }
    return null;
}
// Clear cache
function clearImageCache(type = 'edit') {
    window.ImageEditorStorage.clearImageCache(type);
    console.log(`ðŸ—‘ï¸ Cache cleared (${type})`);
}
// ===== COLLAGE HISTORY MANAGEMENT =====
function saveToHistory(imageDataArray) {
    try {
        const newEntry = window.ImageEditorStorage.addCollageHistory(imageDataArray);
        console.log(`âœ… Saved to history: ${newEntry.imageCount} images`);
        // Reload history display
        loadCollageHistoryFromStorage();
        return newEntry.id;
    }
    catch (e) {
        console.error('Failed to save to history:', e);
        return null;
    }
}
function loadCollageHistoryFromStorage() {
    try {
        const history = window.ImageEditorStorage.readCollageHistory();
        const container = document.getElementById('collageHistory');
        if (history.length === 0) {
            container.innerHTML = '<small class="text-muted text-center py-3">Chưa có ảnh đã lưu</small>';
            return;
        }
        container.innerHTML = history.map(item => {
            // Create thumbnail from first image
            const thumbnailSrc = item.images[0] || '';
            return `
                <div class="history-item"
                     data-id="${item.id}"
                     data-image-history-edit="${item.id}"
                     data-image-history-menu="${item.id}"
                    title="${item.date} - ${item.imageCount} ảnh">
                    <img src="${thumbnailSrc}" alt="Ảnh đã lưu">
                    <div class="history-item-date">${item.imageCount} ảnh</div>
                </div>
            `;
        }).join('');
        console.log(`âœ… Loaded ${history.length} history items`);
    }
    catch (e) {
        console.error('Failed to load history:', e);
    }
}
function loadHistoryForEdit(historyId) {
    try {
        const history = JSON.parse(localStorage.getItem(STORAGE_KEY_COLLAGE_HISTORY) || '[]');
        const item = history.find(h => h.id === historyId);
        if (!item) {
            showToast('Không tìm thấy ảnh trong lịch sử', 'danger');
            return;
        }
        // Clear current state
        collageImages = [];
        imageOffsets = [];
        imagePositions = [];
        textLayers = [];
        document.getElementById('textLayersContainer').innerHTML = '';
        selectedLayout = null;
        const previewContainer = document.getElementById('uploadedPhotosPreview');
        previewContainer.innerHTML = '';
        let loadedCount = 0;
        // Load all images from history
        item.images.forEach((dataURL, index) => {
            const img = new Image();
            img.onload = function () {
                collageImages.push(img);
                loadedCount++;
                // Add thumbnail to preview
                const col = document.createElement('div');
                col.className = 'col-auto';
                col.innerHTML = `
                    <div class="position-relative image-thumb-frame">
                        <img src="${dataURL}"
                             class="img-thumbnail image-thumb-img">
                    </div>
                `;
                previewContainer.appendChild(col);
                if (loadedCount === item.images.length) {
                    document.getElementById('collagePrompt').style.display = 'none';
                    // Check if single image
                    if (item.images.length === 1) {
                        showSingleImageViewer(collageImages[0]);
                        showToast('Đã tải 1 ảnh từ lịch sử', 'success');
                    }
                    else {
                        // Hide single image viewer
                        document.getElementById('singleImageViewer').style.display = 'none';
                        previewContainer.style.display = 'flex';
                        // Hide canvas/tiles
                        document.getElementById('collageCanvasContainer').style.display = 'none';
                        const tiles = document.getElementById('collage-tiles');
                        if (tiles)
                            tiles.style.display = 'none';
                        // Save to current cache
                        saveImageToCache(item.images, 'collage');
                        // Re-render templates
                        renderLayoutTemplates();
                        // Auto-select matching layout
                        const matchingLayout = layoutTemplates.find(l => l.maxPhotos === item.images.length);
                        if (matchingLayout) {
                            selectLayout(matchingLayout.id);
                        }
                        showToast(`Đã tải ${item.imageCount} ảnh từ lịch sử`, 'success');
                    }
                }
            };
            img.src = dataURL;
        });
    }
    catch (e) {
        console.error('Failed to load history for edit:', e);
        showToast('Lỗi khi tải lịch sử', 'danger');
    }
}
function showHistoryContextMenu(event, historyId) {
    event.preventDefault();
    event.stopPropagation();
    // Remove existing context menu
    const existing = document.querySelector('.context-menu');
    if (existing)
        existing.remove();
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.innerHTML = `
        <div class="context-menu-item" data-image-history-delete="${historyId}">
            <i class="bi bi-trash"></i>Xoá
        </div>
    `;
    document.body.appendChild(menu);
    // Close on click outside
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
}
function deleteFromHistory(historyId) {
    try {
        // Remove context menu first
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu)
            existingMenu.remove();
        let history = JSON.parse(localStorage.getItem(STORAGE_KEY_COLLAGE_HISTORY) || '[]');
        history = history.filter(h => h.id !== historyId);
        localStorage.setItem(STORAGE_KEY_COLLAGE_HISTORY, JSON.stringify(history));
        loadCollageHistoryFromStorage();
        showToast('Đã xoá khỏi lịch sử', 'info');
    }
    catch (e) {
        console.error('Failed to delete from history:', e);
        showToast('Lỗi khi xoá lịch sử', 'danger');
    }
}
