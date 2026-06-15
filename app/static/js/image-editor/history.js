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
function escapeHistoryHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function getHistoryPreviewMarkup(item) {
    const images = Array.isArray(item.images) ? item.images : [];
    const count = images.length || item.imageCount || 0;
    const firstImage = escapeHistoryHtml(images[0] || '');
    if (count < 2) {
        return `<img class="history-preview-img" src="${firstImage}" alt="Ảnh đã lưu">`;
    }
    const layoutId = typeof item.layoutId === 'string' ? item.layoutId : '';
    const layout = layoutTemplates.find(candidate => candidate.id === layoutId && candidate.maxPhotos === count)
        || layoutTemplates.find(candidate => candidate.maxPhotos === count);
    if (!layout) {
        const fallbackImages = images.slice(0, Math.min(count, 4)).map(src => `
            <img src="${escapeHistoryHtml(src)}" alt="Ảnh trong lịch sử">
        `).join('');
        return `<div class="history-collage-preview history-collage-preview-fallback">${fallbackImages}</div>`;
    }
    const tiles = layout.cells.slice(0, Math.min(images.length, layout.cells.length)).map((cell, index) => {
        const [col, row, colSpan, rowSpan] = cell;
        return `
            <img src="${escapeHistoryHtml(images[index] || '')}"
                 alt="Ảnh trong lịch sử"
                 style="grid-column:${col + 1} / span ${colSpan}; grid-row:${row + 1} / span ${rowSpan};">
        `;
    }).join('');
    return `
        <div class="history-collage-preview"
             style="grid-template-columns:repeat(${layout.cols}, 1fr); grid-template-rows:repeat(${layout.rows}, 1fr);">
            ${tiles}
        </div>
    `;
}
function saveToHistory(imageDataArray) {
    try {
        const newEntry = window.ImageEditorStorage.addCollageHistory(imageDataArray, imageDataArray.length > 1 ? selectedLayout : null);
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
        if (!container)
            return;
        if (history.length === 0) {
            container.innerHTML = '<small class="text-muted text-center py-3">Chưa có ảnh đã lưu</small>';
            return;
        }
        container.innerHTML = history.map(item => `
            <div class="history-item"
                 data-id="${escapeHistoryHtml(item.id)}"
                 data-image-history-edit="${escapeHistoryHtml(item.id)}"
                 data-image-history-menu="${escapeHistoryHtml(item.id)}"
                 title="${escapeHistoryHtml(item.date)} - ${item.imageCount} ảnh">
                ${getHistoryPreviewMarkup(item)}
                <div class="history-item-date">${item.imageCount} ảnh</div>
            </div>
        `).join('');
        console.log(`✅ Loaded ${history.length} history items`);
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
    if (typeof window.hideAllContextMenus === 'function') {
        window.hideAllContextMenus();
    }
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
// ===== THƯ MỤC ẢNH (PC IMAGE FOLDER NAVIGATION) =====
const STORAGE_KEY_IMAGE_FOLDER_PATH = 'stool_image_folder_path';
function initImageFolderPanel() {
    const btnOpenFolderModal = document.getElementById('btnOpenFolderModal');
    const btnConfirmFolderPath = document.getElementById('btnConfirmFolderPath');
    const imageFolderPathInput = document.getElementById('imageFolderPathInput');
    if (btnOpenFolderModal) {
        btnOpenFolderModal.addEventListener('click', () => {
            const modalEl = document.getElementById('imageFolderInputModal');
            if (modalEl && typeof bootstrap !== 'undefined') {
                const savedPath = localStorage.getItem(STORAGE_KEY_IMAGE_FOLDER_PATH) || '';
                if (imageFolderPathInput)
                    imageFolderPathInput.value = savedPath;
                new bootstrap.Modal(modalEl).show();
            }
        });
    }
    if (btnConfirmFolderPath && imageFolderPathInput) {
        btnConfirmFolderPath.addEventListener('click', async () => {
            const pathValue = imageFolderPathInput.value.trim();
            if (!pathValue) {
                showToast('Đường dẫn không được để trống', 'warning');
                return;
            }
            try {
                // Focus out input to prevent browser caret rendering bugs
                imageFolderPathInput.blur();
                const modalEl = document.getElementById('imageFolderInputModal');
                if (modalEl && typeof bootstrap !== 'undefined') {
                    const modalInstance = bootstrap.Modal.getInstance(modalEl);
                    if (modalInstance) {
                        modalInstance.hide();
                    }
                    else {
                        new bootstrap.Modal(modalEl).hide();
                    }
                }
                await fetchAndRenderSubfolders(pathValue);
                localStorage.setItem(STORAGE_KEY_IMAGE_FOLDER_PATH, pathValue);
                showToast('Đã mở thư mục ảnh', 'success');
            }
            catch (err) {
                // Keep error log silently or remove
            }
        });
    }
    // Modal hide listener to double-check input blur and fix sticky caret bug
    const modalEl = document.getElementById('imageFolderInputModal');
    if (modalEl && imageFolderPathInput) {
        modalEl.addEventListener('hidden.bs.modal', () => {
            imageFolderPathInput.blur();
        });
    }
    // Global listener to blur active input/textarea when any modal closes (to fix caret leak bug)
    document.addEventListener('hidden.bs.modal', () => {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            document.activeElement.blur();
        }
    });
    // Single click for selection or immediate back navigation
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (!target)
            return;
        const folderItem = target.closest('.image-folder-item');
        if (folderItem) {
            const itemType = folderItem.dataset.itemType;
            const container = document.getElementById('imageFolderHistory');
            if (e.ctrlKey && (itemType === 'image' || itemType === 'video')) {
                // If Ctrl is held and it is a file, toggle selection
                folderItem.classList.toggle('selected-item');
                // Deselect any folder items (we only want files selected)
                if (container) {
                    container.querySelectorAll('.image-folder-item[data-item-type="folder"]').forEach(item => {
                        item.classList.remove('selected-item');
                    });
                }
            }
            else {
                // Otherwise, normal behavior: deselect all and select this one
                if (container) {
                    container.querySelectorAll('.image-folder-item').forEach(item => {
                        item.classList.remove('selected-item');
                    });
                }
                folderItem.classList.add('selected-item');
            }
            // If this is the "<- Quay lại" button, navigate back immediately on single click
            if (itemType === 'folder' && folderItem.title === 'Quay lại thư mục cha') {
                const folderPath = folderItem.dataset.folderPath;
                if (folderPath) {
                    fetchAndRenderSubfolders(folderPath);
                }
            }
        }
    });
    // Double click to open folder or load file to canvas
    document.addEventListener('dblclick', (e) => {
        const target = e.target;
        if (!target)
            return;
        const folderItem = target.closest('.image-folder-item');
        if (folderItem) {
            const itemType = folderItem.dataset.itemType;
            if (itemType === 'folder') {
                const folderPath = folderItem.dataset.folderPath;
                if (folderPath) {
                    fetchAndRenderSubfolders(folderPath);
                }
            }
            else if (itemType === 'image' || itemType === 'video') {
                const filePath = folderItem.dataset.filePath;
                if (filePath) {
                    loadFileToCanvas(filePath, itemType);
                }
            }
        }
    });
    // Context menu listener for subdirectory folders and image/video files
    document.addEventListener('contextmenu', (e) => {
        const target = e.target;
        if (!target)
            return;
        const folderItem = target.closest('.image-folder-item');
        if (folderItem) {
            const itemType = folderItem.dataset.itemType;
            if (itemType === 'folder') {
                const folderPath = folderItem.dataset.folderPath;
                const folderName = folderItem.title;
                // Don't show explorer context menu for the back button ".. (Quay lại)"
                if (folderPath && folderName !== 'Quay lại thư mục cha') {
                    e.preventDefault();
                    e.stopPropagation();
                    // Select the folder first
                    const container = document.getElementById('imageFolderHistory');
                    if (container) {
                        container.querySelectorAll('.image-folder-item').forEach(item => {
                            item.classList.remove('selected-item');
                        });
                    }
                    folderItem.classList.add('selected-item');
                    // Hide other context menus
                    if (typeof window.hideAllContextMenus === 'function') {
                        window.hideAllContextMenus();
                    }
                    showFolderContextMenu(e, folderPath);
                }
            }
            else if (itemType === 'image' || itemType === 'video') {
                const filePath = folderItem.dataset.filePath;
                if (filePath) {
                    e.preventDefault();
                    e.stopPropagation();
                    // If the right-clicked item is not already selected, clear other selections and select it
                    if (!folderItem.classList.contains('selected-item')) {
                        const container = document.getElementById('imageFolderHistory');
                        if (container) {
                            container.querySelectorAll('.image-folder-item').forEach(item => {
                                item.classList.remove('selected-item');
                            });
                        }
                        folderItem.classList.add('selected-item');
                    }
                    // Hide other context menus
                    if (typeof window.hideAllContextMenus === 'function') {
                        window.hideAllContextMenus();
                    }
                    showFileContextMenu(e, filePath, itemType);
                }
            }
        }
    });
    const savedPath = localStorage.getItem(STORAGE_KEY_IMAGE_FOLDER_PATH);
    if (savedPath) {
        fetchAndRenderSubfolders(savedPath);
    }
}
function showFolderContextMenu(event, folderPath) {
    const existing = document.querySelector('.context-menu');
    if (existing)
        existing.remove();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.innerHTML = `
        <div class="context-menu-item" id="btnOpenFolderInExplorer">
            <span class="d-flex align-items-center gap-2">
                <i class="bi bi-folder-symlink"></i>
                <span>Mở thư mục</span>
            </span>
        </div>
    `;
    document.body.appendChild(menu);
    const btnOpen = menu.querySelector('#btnOpenFolderInExplorer');
    if (btnOpen) {
        btnOpen.addEventListener('click', async () => {
            menu.remove();
            try {
                const response = await fetch('/image/api/open-folder-explorer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ path: folderPath })
                });
                const resData = await response.json();
                if (!resData.success) {
                    showToast(resData.error || 'Không thể mở thư mục', 'danger');
                }
            }
            catch (err) {
                showToast('Lỗi kết nối máy chủ', 'danger');
            }
        });
    }
    const closeMenu = (clickEvent) => {
        if (!menu.contains(clickEvent.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
}
function getDisplayName(name, type) {
    if (type === 'image') {
        const lastDot = name.lastIndexOf('.');
        if (lastDot > 0) {
            return name.substring(0, lastDot);
        }
    }
    return name;
}
async function loadFileToCanvas(filePath, type) {
    try {
        const serveUrl = `/image/api/serve-file?path=${encodeURIComponent(filePath)}`;
        // Deactivate active tools & clean state
        deactivateAllTools();
        if (typeof window.resetObjectRemoveState === 'function') {
            window.resetObjectRemoveState();
        }
        textLayers = [];
        const textContainer = document.getElementById('textLayersContainer');
        if (textContainer)
            textContainer.innerHTML = '';
        if (type === 'image') {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                // Set global variables for image editor
                collageImages = [img];
                imageOffsets = [];
                imagePositions = [];
                // Hide collage layout details, show single view
                const previewContainer = document.getElementById('uploadedPhotosPreview');
                if (previewContainer)
                    previewContainer.style.display = 'none';
                const tiles = document.getElementById('collage-tiles');
                if (tiles)
                    tiles.style.display = 'none';
                const collageCanvasContainer = document.getElementById('collageCanvasContainer');
                if (collageCanvasContainer)
                    collageCanvasContainer.style.display = 'none';
                const templatesPanel = document.getElementById('templatesPanel');
                if (templatesPanel)
                    templatesPanel.style.display = 'none';
                const collagePrompt = document.getElementById('collagePrompt');
                if (collagePrompt)
                    collagePrompt.style.display = 'none';
                window.currentOpenedFilePath = filePath;
                saveImageToCache([serveUrl], 'collage');
                showSingleImageViewer(img);
            };
            img.onerror = () => {
                window.currentOpenedFilePath = null;
                showToast('Không thể tải file ảnh', 'danger');
            };
            img.src = serveUrl;
        }
        else if (type === 'video') {
            const video = document.createElement('video');
            video.crossOrigin = "anonymous";
            video.muted = true;
            video.playsInline = true;
            video.onloadeddata = () => {
                // Set video size explicitly to be used in showSingleImageViewer
                video.width = video.videoWidth;
                video.height = video.videoHeight;
                // Set global variables for image editor
                collageImages = [video];
                imageOffsets = [];
                imagePositions = [];
                // Hide collage layout details, show single view
                const previewContainer = document.getElementById('uploadedPhotosPreview');
                if (previewContainer)
                    previewContainer.style.display = 'none';
                const tiles = document.getElementById('collage-tiles');
                if (tiles)
                    tiles.style.display = 'none';
                const collageCanvasContainer = document.getElementById('collageCanvasContainer');
                if (collageCanvasContainer)
                    collageCanvasContainer.style.display = 'none';
                const templatesPanel = document.getElementById('templatesPanel');
                if (templatesPanel)
                    templatesPanel.style.display = 'none';
                const collagePrompt = document.getElementById('collagePrompt');
                if (collagePrompt)
                    collagePrompt.style.display = 'none';
                window.currentOpenedFilePath = filePath;
                saveImageToCache([serveUrl], 'collage');
                showSingleImageViewer(video);
            };
            video.onerror = () => {
                window.currentOpenedFilePath = null;
                showToast('Không thể tải file video', 'danger');
            };
            video.src = serveUrl;
            video.load();
        }
    }
    catch (err) {
        showToast('Lỗi khi tải file', 'danger');
    }
}
async function fetchAndRenderSubfolders(path) {
    try {
        localStorage.setItem('current_image_folder_opened', path);
        const url = `/image/api/list-subfolders?path=${encodeURIComponent(path)}`;
        const response = await fetch(url);
        const data = await response.json();
        const container = document.getElementById('imageFolderHistory');
        if (!container)
            return;
        // Save current selections before rendering
        const previouslySelectedPaths = new Set();
        container.querySelectorAll('.selected-item').forEach(item => {
            const path = item.dataset.filePath || item.dataset.folderPath;
            if (path) {
                previouslySelectedPaths.add(path);
            }
        });
        if (!data.success) {
            showToast(data.error || 'Lỗi khi đọc danh sách thư mục', 'danger');
            container.innerHTML = `<small class="text-danger text-center py-3 d-block">${escapeHistoryHtml(data.error)}</small>`;
            return;
        }
        const subfolders = data.subfolders || [];
        const files = data.files || [];
        const rootPath = localStorage.getItem(STORAGE_KEY_IMAGE_FOLDER_PATH) || '';
        const cleanPath = path.replace(/[\\/]+$/, '').toLowerCase();
        const cleanRoot = rootPath.replace(/[\\/]+$/, '').toLowerCase();
        const isRoot = (cleanPath === cleanRoot);
        let html = '';
        if (!isRoot) {
            const lastSlash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
            let parentPath = '';
            if (lastSlash > 0) {
                parentPath = path.substring(0, lastSlash);
                if (parentPath.endsWith(':')) {
                    parentPath += '\\';
                }
            }
            if (parentPath) {
                html += `
                    <div class="image-folder-row image-folder-item" data-item-type="folder" data-folder-path="${escapeHistoryHtml(parentPath)}" title="Quay lại thư mục cha">
                        <i class="bi bi-arrow-left text-muted"></i>
                        <span class="folder-name text-muted">.. (Quay lại)</span>
                    </div>
                `;
            }
        }
        // Render subfolders
        subfolders.forEach((sub) => {
            html += `
                <div class="image-folder-row image-folder-item" data-item-type="folder" data-folder-path="${escapeHistoryHtml(sub.path)}" title="${escapeHistoryHtml(sub.name)}">
                    <i class="bi bi-folder-fill text-info"></i>
                    <span class="folder-name">${escapeHistoryHtml(sub.name)}</span>
                </div>
            `;
        });
        // Render image and video files
        files.forEach((file) => {
            const displayName = getDisplayName(file.name, file.type);
            const iconClass = file.type === 'image' ? 'bi-image text-warning' : 'bi-play-btn-fill text-danger';
            html += `
                <div class="image-folder-row image-folder-item" data-item-type="${file.type}" data-file-path="${escapeHistoryHtml(file.path)}" title="${escapeHistoryHtml(file.name)}">
                    <i class="bi ${iconClass}"></i>
                    <span class="folder-name">${escapeHistoryHtml(displayName)}</span>
                </div>
            `;
        });
        if (subfolders.length === 0 && files.length === 0) {
            html += '<small class="text-muted text-center py-3 d-block">Thư mục trống</small>';
        }
        container.innerHTML = html;
        // Restore selections
        if (previouslySelectedPaths.size > 0) {
            container.querySelectorAll('.image-folder-item').forEach(item => {
                const path = item.dataset.filePath || item.dataset.folderPath;
                if (path && previouslySelectedPaths.has(path)) {
                    item.classList.add('selected-item');
                }
            });
        }
        window.fetchAndRenderSubfolders = fetchAndRenderSubfolders;
    }
    catch (e) {
        showToast('Lỗi kết nối máy chủ', 'danger');
    }
}
function showFileContextMenu(event, filePath, itemType) {
    const existing = document.querySelector('.context-menu');
    if (existing)
        existing.remove();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    const deleteLabel = itemType === 'image' ? 'Xoá Ảnh' : 'Xoá Video';
    menu.innerHTML = `
        <div class="context-menu-item text-danger" id="btnDeleteFile">
            <span class="d-flex align-items-center gap-2">
                <i class="bi bi-trash"></i>
                <span>${deleteLabel}</span>
            </span>
        </div>
    `;
    document.body.appendChild(menu);
    // Stop propagation of click events inside context menu to prevent outside clicks closing it immediately
    menu.addEventListener('mousedown', (e) => e.stopPropagation());
    menu.addEventListener('click', (e) => e.stopPropagation());
    const btnDelete = menu.querySelector('#btnDeleteFile');
    if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
            menu.remove();
            // Get all selected files
            const selectedElements = document.querySelectorAll('#imageFolderHistory .selected-item');
            const selectedPaths = [];
            selectedElements.forEach(item => {
                const path = item.dataset.filePath;
                const type = item.dataset.itemType;
                if (path && (type === 'image' || type === 'video')) {
                    selectedPaths.push(path);
                }
            });
            if (selectedPaths.length === 0) {
                selectedPaths.push(filePath);
            }
            const confirmMsg = selectedPaths.length > 1
                ? `Bạn có chắc muốn xoá ${selectedPaths.length} file đã chọn khỏi đĩa không?`
                : `Bạn có chắc muốn xoá file này khỏi đĩa không?`;
            const isConfirmed = await window.showConfirm(confirmMsg, 'Xác nhận xoá file');
            if (!isConfirmed)
                return;
            let successCount = 0;
            let failCount = 0;
            let lastErrorMsg = '';
            for (const path of selectedPaths) {
                try {
                    const response = await fetch('/image/api/delete-file', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ path })
                    });
                    const resData = await response.json();
                    if (resData.success) {
                        successCount++;
                    }
                    else {
                        failCount++;
                        lastErrorMsg = resData.error || 'Lỗi không xác định';
                    }
                }
                catch (e) {
                    failCount++;
                    lastErrorMsg = e instanceof Error ? e.message : String(e);
                }
            }
            if (failCount > 0) {
                showToast(`Đã xoá ${successCount} file. Thất bại ${failCount} file: ${lastErrorMsg}`, 'warning');
            }
            else {
                showToast(`Đã xoá thành công ${successCount} file`, 'success');
            }
            const currentPath = localStorage.getItem('current_image_folder_opened');
            if (currentPath && typeof window.fetchAndRenderSubfolders === 'function') {
                window.fetchAndRenderSubfolders(currentPath);
            }
        });
    }
    const closeMenu = (clickEvent) => {
        if (!menu.contains(clickEvent.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
}
