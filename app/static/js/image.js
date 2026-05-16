"use strict";
// @ts-nocheck
// ===== NAVBAR NAVIGATION HANDLER =====
function handleImageNavClick(event) {
    // If already on /image page, prevent reload
    if (window.location.pathname.startsWith('/image')) {
        event.preventDefault();
        console.log('Already on image page, prevented reload');
        return false;
    }
    return true; // Allow navigation if on different page
}
// ===== AUTO-SAVE & RESTORE SYSTEM =====
// Use localStorage instead of sessionStorage to persist across browser close
const STORAGE_KEY_EDIT_IMAGE = 'stool_edit_image_cache'; // Legacy, kept for compatibility
const STORAGE_KEY_COLLAGE_IMAGES = 'stool_collage_images_cache';
const STORAGE_KEY_COLLAGE_HISTORY = 'stool_collage_history';
// Save image to localStorage
function saveImageToCache(data, type = 'edit') {
    try {
        const key = type === 'edit' ? STORAGE_KEY_EDIT_IMAGE : STORAGE_KEY_COLLAGE_IMAGES;
        // If data is array (collage images), stringify it
        const valueToStore = Array.isArray(data) ? JSON.stringify(data) : data;
        localStorage.setItem(key, valueToStore);
        console.log(`✅ Image saved to cache (${type})`, Array.isArray(data) ? `${data.length} images` : '');
    }
    catch (e) {
        console.warn('⚠️ Failed to save image to cache:', e);
    }
}
// Load image from localStorage
function loadImageFromCache(type = 'edit') {
    try {
        const key = type === 'edit' ? STORAGE_KEY_EDIT_IMAGE : STORAGE_KEY_COLLAGE_IMAGES;
        const dataURL = localStorage.getItem(key);
        if (dataURL) {
            console.log(`✅ Image loaded from cache (${type})`);
            return dataURL;
        }
    }
    catch (e) {
        console.warn('⚠️ Failed to load image from cache:', e);
    }
    return null;
}
// Clear cache
function clearImageCache(type = 'edit') {
    const key = type === 'edit' ? STORAGE_KEY_EDIT_IMAGE : STORAGE_KEY_COLLAGE_IMAGES;
    localStorage.removeItem(key);
    console.log(`🗑️ Cache cleared (${type})`);
}
// ===== COLLAGE HISTORY MANAGEMENT =====
function saveToHistory(imageDataArray) {
    try {
        const history = JSON.parse(localStorage.getItem(STORAGE_KEY_COLLAGE_HISTORY) || '[]');
        const newEntry = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleString('vi-VN'),
            imageCount: imageDataArray.length,
            images: imageDataArray // Array of base64 dataURLs
        };
        // Add to beginning of history
        history.unshift(newEntry);
        // Keep only last 50 entries
        if (history.length > 50) {
            history.splice(50);
        }
        localStorage.setItem(STORAGE_KEY_COLLAGE_HISTORY, JSON.stringify(history));
        console.log(`✅ Saved to history: ${newEntry.imageCount} images`);
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
        const history = JSON.parse(localStorage.getItem(STORAGE_KEY_COLLAGE_HISTORY) || '[]');
        const container = document.getElementById('collageHistory');
        if (history.length === 0) {
            container.innerHTML = '<small class="text-muted text-center py-3">No saved collages</small>';
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
                     title="${item.date} - ${item.imageCount} photos">
                    <img src="${thumbnailSrc}" alt="Collage">
                    <div class="history-item-date">${item.imageCount} photos</div>
                </div>
            `;
        }).join('');
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
            showToast('History item not found', 'danger');
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
                        showToast(`Loaded 1 photo from history`, 'success');
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
                        showToast(`Loaded ${item.imageCount} photos from history`, 'success');
                    }
                }
            };
            img.src = dataURL;
        });
    }
    catch (e) {
        console.error('Failed to load history for edit:', e);
        showToast('Error loading history', 'danger');
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
            <i class="bi bi-trash"></i>Delete
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
        showToast('Deleted from history', 'info');
    }
    catch (e) {
        console.error('Failed to delete from history:', e);
        showToast('Error deleting from history', 'danger');
    }
}
// ===== PHOTO COLLAGE - MAIN INTERFACE =====
// Global flag to lock/unlock image dragging
let isImageDraggingLocked = false;
// Function to lock/unlock image dragging (used when editing text)
function lockImageDragging(lock) {
    isImageDraggingLocked = lock;
    const collageTiles = document.getElementById('collage-tiles');
    if (lock) {
        // Lock: disable pointer events on all images and show overlay
        collageTiles.style.pointerEvents = 'none';
        collageTiles.style.opacity = '0.6';
        collageTiles.style.filter = 'blur(1px)';
        console.log('🔒 Image dragging LOCKED (editing text)');
    }
    else {
        // Unlock: enable pointer events on all images
        collageTiles.style.pointerEvents = 'auto';
        collageTiles.style.opacity = '1';
        collageTiles.style.filter = 'none';
        console.log('🔓 Image dragging UNLOCKED');
    }
}
// ===== SINGLE IMAGE VIEWER MODE =====
let singleImageZoom = 1;
let singleImageCanvas = null;
let singleImageCtx = null;
let zoomListener = null; // Track the listener
// ===== UNDO FUNCTIONALITY =====
let canvasHistory = [];
let maxHistorySize = 20;
function saveCanvasState() {
    if (!singleImageCanvas || !singleImageCtx)
        return;
    // Save current canvas state as data URL
    const state = singleImageCanvas.toDataURL();
    canvasHistory.push(state);
    // Limit history size
    if (canvasHistory.length > maxHistorySize) {
        canvasHistory.shift();
    }
    console.log(`💾 Canvas state saved (${canvasHistory.length} in history)`);
}
function undoCanvas() {
    if (canvasHistory.length === 0) {
        showToast('No more undo history', 'info');
        return;
    }
    // Remove current state
    canvasHistory.pop();
    if (canvasHistory.length === 0) {
        showToast('Reached initial state', 'info');
        return;
    }
    // Restore previous state
    const previousState = canvasHistory[canvasHistory.length - 1];
    const img = new Image();
    img.onload = function () {
        singleImageCtx.clearRect(0, 0, singleImageCanvas.width, singleImageCanvas.height);
        singleImageCanvas.width = img.width;
        singleImageCanvas.height = img.height;
        singleImageCtx.drawImage(img, 0, 0);
        showToast('↩️ Undo successful', 'success');
    };
    img.src = previousState;
}
// Setup Ctrl+Z listener
document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (collageImages.length === 1) {
            undoCanvas();
        }
    }
});
function showSingleImageViewer(image) {
    // Hide collage elements
    document.getElementById('uploadedPhotosPreview').style.display = 'none';
    document.getElementById('collage-tiles').style.display = 'none';
    document.getElementById('collageCanvasContainer').style.display = 'none';
    document.getElementById('templatesPanel').style.display = 'none';
    // Show single viewer
    const viewer = document.getElementById('singleImageViewer');
    viewer.style.display = 'flex';
    viewer.style.alignItems = 'center';
    viewer.style.justifyContent = 'center';
    // Setup canvas
    singleImageCanvas = document.getElementById('singleImageCanvas');
    singleImageCtx = singleImageCanvas.getContext('2d');
    // RESET zoom and remove old listener
    singleImageZoom = 1;
    singleImageCanvas.style.transform = 'scale(1)';
    if (zoomListener) {
        singleImageCanvas.removeEventListener('wheel', zoomListener);
    }
    // Set canvas size to fit container
    const container = viewer.parentElement;
    const maxWidth = container.clientWidth - 40;
    const maxHeight = container.clientHeight - 40;
    let scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    singleImageCanvas.width = image.width * scale;
    singleImageCanvas.height = image.height * scale;
    // Draw image
    singleImageCtx.clearRect(0, 0, singleImageCanvas.width, singleImageCanvas.height);
    singleImageCtx.drawImage(image, 0, 0, singleImageCanvas.width, singleImageCanvas.height);
    // Save initial state for undo
    canvasHistory = []; // Clear history for new image
    saveCanvasState();
    // Add zoom functionality with new listener
    zoomListener = handleSingleImageZoom;
    singleImageCanvas.addEventListener('wheel', zoomListener, { passive: false });
}
function handleSingleImageZoom(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    singleImageZoom *= delta;
    singleImageZoom = Math.max(0.1, Math.min(5, singleImageZoom)); // Clamp 0.1x - 5x
    singleImageCanvas.style.transform = `scale(${singleImageZoom})`;
    singleImageCanvas.style.transition = 'transform 0.1s';
}
// ===== DRAG & DROP + PASTE IMAGES =====
function setupDragDropPaste() {
    const dropZone = document.body;
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    // Highlight drop zone
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.outline = '3px dashed #0dcaf0';
        });
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.outline = '';
        });
    });
    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop);
    // Handle paste
    document.addEventListener('paste', handlePaste);
}
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = Array.from(dt.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
        processUploadedFiles(files);
    }
}
function handlePaste(e) {
    const items = e.clipboardData.items;
    const imageFiles = [];
    for (let item of items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file)
                imageFiles.push(file);
        }
    }
    if (imageFiles.length > 0) {
        processUploadedFiles(imageFiles);
    }
}
function processUploadedFiles(files) {
    collageImages = [];
    imageOffsets = [];
    imagePositions = [];
    const previewContainer = document.getElementById('uploadedPhotosPreview');
    previewContainer.innerHTML = '';
    const imageDataURLs = [];
    let loadedCount = 0;
    files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                collageImages.push(img);
                imageDataURLs.push(event.target.result);
                loadedCount++;
                // Add thumbnail
                const col = document.createElement('div');
                col.className = 'col-auto';
                col.innerHTML = `
                    <div class="position-relative image-thumb-frame">
                        <img src="${event.target.result}"
                             class="img-thumbnail image-thumb-img">
                    </div>
                `;
                previewContainer.appendChild(col);
                if (loadedCount === files.length) {
                    document.getElementById('collagePrompt').style.display = 'none';
                    if (files.length === 1) {
                        showSingleImageViewer(collageImages[0]);
                        showToast('1 photo added - Single viewer mode', 'success');
                    }
                    else {
                        // Hide single image viewer when switching to collage
                        document.getElementById('singleImageViewer').style.display = 'none';
                        previewContainer.style.display = 'flex';
                        showToast(`${files.length} photos added`, 'success');
                        renderLayoutTemplates();
                        const matchingLayout = layoutTemplates.find(l => l.maxPhotos === files.length);
                        if (matchingLayout)
                            selectLayout(matchingLayout.id);
                    }
                    saveImageToCache(imageDataURLs, 'collage');
                    saveToHistory(imageDataURLs);
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}
// ===== CLEAR ALL HISTORY =====
function clearAllHistory() {
    localStorage.removeItem(STORAGE_KEY_COLLAGE_HISTORY);
    loadCollageHistoryFromStorage();
    showToast('All history cleared', 'info');
}
// ===== BLEMISH REMOVAL TOOL (HEALING BRUSH - Backend OpenCV Inpainting) =====
let blemishToolActive = false;
let blemishBrushSize = 15; // Optimal size for drawing mask
let blemishInpaintRadius = 5; // Inpainting radius (3-10)
let blemishMaskOpacity = 0.3; // Mask opacity (10-80%)
let isProcessingHeal = false; // Prevent double API calls  
let hasDrawnMask = false; // Track if user drew anything
let blemishMethod = 'ns'; // 'ns' or 'telea'
let isHealing = false;
let blemishMaskCanvas = null; // Separate canvas for drawing mask
let blemishMaskCtx = null;
let originalImageForBlemish = null; // Store original before healing
let blemishSettingsTimeout = null; // For hover delay
// Settings UI functions
function showBlemishSettings() {
    clearTimeout(blemishSettingsTimeout);
    document.getElementById('blemishSettingsMenu').style.display = 'block';
}
function hideBlemishSettings() {
    blemishSettingsTimeout = setTimeout(() => {
        document.getElementById('blemishSettingsMenu').style.display = 'none';
    }, 300); // 300ms delay before hiding
}
function updateBlemishBrushSize(value) {
    blemishBrushSize = parseInt(value);
    document.getElementById('blemishBrushValue').textContent = value;
}
function updateBlemishRadius(value) {
    blemishInpaintRadius = parseInt(value);
    document.getElementById('blemishRadiusValue').textContent = value;
}
function updateBlemishOpacity(value) {
    blemishMaskOpacity = parseInt(value) / 100;
    document.getElementById('blemishOpacityValue').textContent = value;
}
// Get selected method
function getBlemishMethod() {
    const nsRadio = document.getElementById('methodNS');
    const teleaRadio = document.getElementById('methodTelea');
    return nsRadio.checked ? 'ns' : 'telea';
}
// ===== DEACTIVATE ALL TOOLS (Helper function) =====
function deactivateAllTools() {
    // Deactivate Blemish Tool
    if (blemishToolActive) {
        blemishToolActive = false;
        const blemishBtn = document.getElementById('blemishToolBtn');
        if (blemishBtn) {
            blemishBtn.classList.remove('active');
            blemishBtn.style.backgroundColor = '';
            blemishBtn.style.color = '';
        }
        if (singleImageCanvas)
            singleImageCanvas.style.cursor = 'default';
        if (originalImageForBlemish && singleImageCtx) {
            singleImageCtx.putImageData(originalImageForBlemish, 0, 0);
        }
        if (blemishMaskCanvas && blemishMaskCtx) {
            blemishMaskCtx.fillStyle = 'black';
            blemishMaskCtx.fillRect(0, 0, blemishMaskCanvas.width, blemishMaskCanvas.height);
        }
        hasDrawnMask = false;
    }
    // Deactivate Crop Tool
    if (cropToolActive) {
        cropToolActive = false;
        const cropBtn = document.getElementById('cropToolBtn');
        if (cropBtn) {
            cropBtn.classList.remove('active');
            cropBtn.style.backgroundColor = '';
            cropBtn.style.color = '';
        }
        hideCropOverlay();
    }
}
function toggleBlemishTool() {
    // Deactivate other tools first
    if (!blemishToolActive) {
        deactivateAllTools();
    }
    if (collageImages.length === 0) {
        showToast('Upload a photo first!', 'warning');
        return;
    }
    // Only works in single image mode
    if (collageImages.length > 1) {
        showToast('Blemish tool only works with single images', 'info');
        return;
    }
    blemishToolActive = !blemishToolActive;
    const btn = document.getElementById('blemishToolBtn');
    if (blemishToolActive) {
        btn.classList.add('active');
        btn.style.backgroundColor = '#198754';
        btn.style.color = 'white';
        singleImageCanvas.style.cursor = 'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><circle cx="15" cy="15" r="12" fill="none" stroke="lime" stroke-width="2"/></svg>) 15 15, crosshair';
        // Create mask canvas
        if (!blemishMaskCanvas) {
            blemishMaskCanvas = document.createElement('canvas');
            blemishMaskCanvas.width = singleImageCanvas.width;
            blemishMaskCanvas.height = singleImageCanvas.height;
            blemishMaskCtx = blemishMaskCanvas.getContext('2d');
            blemishMaskCtx.fillStyle = 'black';
            blemishMaskCtx.fillRect(0, 0, blemishMaskCanvas.width, blemishMaskCanvas.height);
        }
        // Store original image
        originalImageForBlemish = singleImageCtx.getImageData(0, 0, singleImageCanvas.width, singleImageCanvas.height);
        setupBlemishListeners();
        showToast('🩹 Paint & release to heal (auto)', 'success');
    }
    else {
        btn.classList.remove('active');
        btn.style.backgroundColor = '';
        btn.style.color = '';
        singleImageCanvas.style.cursor = 'grab';
        removeBlemishListeners();
        showToast('Healing tool disabled', 'info');
    }
}
function setupBlemishListeners() {
    singleImageCanvas.addEventListener('mousedown', startDrawingMask);
    singleImageCanvas.addEventListener('mousemove', continueDrawingMask);
    singleImageCanvas.addEventListener('mouseup', endDrawingMask);
    singleImageCanvas.addEventListener('mouseleave', endDrawingMask);
    // Listen for Enter key to process healing
    document.addEventListener('keydown', processBlemishHealing);
}
function removeBlemishListeners() {
    singleImageCanvas.removeEventListener('mousedown', startDrawingMask);
    singleImageCanvas.removeEventListener('mousemove', continueDrawingMask);
    singleImageCanvas.removeEventListener('mouseup', endDrawingMask);
    singleImageCanvas.removeEventListener('mouseleave', endDrawingMask);
    document.removeEventListener('keydown', processBlemishHealing);
}
function startDrawingMask(e) {
    if (!blemishToolActive)
        return;
    isHealing = true;
    hasDrawnMask = true;
    drawMaskPoint(e);
}
function continueDrawingMask(e) {
    if (!isHealing || !blemishToolActive)
        return;
    drawMaskPoint(e);
}
async function endDrawingMask() {
    isHealing = false;
    if (hasDrawnMask && !isProcessingHeal) {
        await processBlemishHealingAuto();
    }
}
function drawMaskPoint(e) {
    const rect = singleImageCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (singleImageCanvas.width / rect.width);
    const y = (e.clientY - rect.top) * (singleImageCanvas.height / rect.height);
    // Draw on mask canvas (white = heal this area)
    blemishMaskCtx.fillStyle = 'white';
    blemishMaskCtx.beginPath();
    blemishMaskCtx.arc(x, y, blemishBrushSize, 0, Math.PI * 2);
    blemishMaskCtx.fill();
    // Show visual feedback on main canvas (semi-transparent red overlay)
    singleImageCtx.save();
    singleImageCtx.globalAlpha = 0.3;
    singleImageCtx.fillStyle = '#ff3b30';
    singleImageCtx.beginPath();
    singleImageCtx.arc(x, y, blemishBrushSize, 0, Math.PI * 2);
    singleImageCtx.fill();
    singleImageCtx.restore();
}
async function processBlemishHealing(e) {
    if (!blemishToolActive || e.key !== 'Enter')
        return;
    try {
        // Save state before processing (for Undo)
        saveCanvasState();
        // Get current settings
        const method = getBlemishMethod();
        const radius = blemishInpaintRadius;
        const methodName = method === 'ns' ? 'Navier-Stokes' : 'Telea';
        showToast(`⏳ Processing with ${methodName} (radius: ${radius})...`, 'info');
        // Convert canvases to blobs
        const imageBlob = await new Promise(resolve => singleImageCanvas.toBlob(resolve, 'image/png'));
        const maskBlob = await new Promise(resolve => blemishMaskCanvas.toBlob(resolve, 'image/png'));
        // Send to backend with parameters
        const formData = new FormData();
        formData.append('image', imageBlob, 'image.png');
        formData.append('mask', maskBlob, 'mask.png');
        formData.append('method', method);
        formData.append('radius', radius.toString());
        const response = await fetch('/image/api/remove_blemish', {
            method: 'POST',
            body: formData
        });
        if (!response.ok)
            throw new Error('Healing failed');
        const healedBlob = await response.blob();
        const healedUrl = URL.createObjectURL(healedBlob);
        // Load healed image back to canvas
        const healedImg = new Image();
        healedImg.onload = () => {
            singleImageCtx.drawImage(healedImg, 0, 0);
            URL.revokeObjectURL(healedUrl);
            // Reset mask
            blemishMaskCtx.fillStyle = 'black';
            blemishMaskCtx.fillRect(0, 0, blemishMaskCanvas.width, blemishMaskCanvas.height);
            showToast('✨ Blemish removed successfully!', 'success');
        };
        healedImg.src = healedUrl;
    }
    catch (error) {
        console.error('Healing error:', error);
        showToast('❌ Healing failed', 'danger');
    }
}
// Keyboard handler for blemish tool (adjust brush/radius with keyboard shortcuts)
function handleBlemishKeys(e) {
    if (!window.blemishToolActive)
        return;
    // [ and ] to change brush size
    if (e.key === '[') {
        const newSize = Math.max(1, (window.blemishBrushSize || 15) - 1);
        updateBlemishBrushSize(newSize);
        document.getElementById('blemishBrush').value = newSize;
    }
    if (e.key === ']') {
        const newSize = Math.min(50, (window.blemishBrushSize || 15) + 1);
        updateBlemishBrushSize(newSize);
        document.getElementById('blemishBrush').value = newSize;
    }
    // - and + to change heal radius
    if (e.key === '-') {
        const newRadius = Math.max(1, (window.blemishInpaintRadius || 5) - 1);
        updateBlemishRadius(newRadius);
        document.getElementById('blemishRadius').value = newRadius;
    }
    if (e.key === '=' || e.key === '+') {
        const newRadius = Math.min(15, (window.blemishInpaintRadius || 5) + 1);
        updateBlemishRadius(newRadius);
        document.getElementById('blemishRadius').value = newRadius;
    }
    // ESC to deactivate tool
    if (e.key === 'Escape') {
        deactivateAllTools();
    }
    // Enter to manually trigger healing if needed
    if (e.key === 'Enter') {
        if (typeof processBlemishHealing === 'function') {
            processBlemishHealing(e);
        }
    }
}
// Auto-healing function (triggered on mouse release)
async function processBlemishHealingAuto() {
    if (!window.blemishToolActive || window.isProcessingHeal || !window.hasDrawnMask)
        return;
    try {
        window.isProcessingHeal = true;
        saveCanvasState(); // Save for Undo
        const method = getBlemishMethod();
        const radius = window.blemishInpaintRadius;
        const methodName = method === 'ns' ? 'Navier-Stokes' : 'Telea';
        showToast(`⏳ Healing (${methodName}, r=${radius})...`, 'info');
        const imageBlob = await new Promise(r => singleImageCanvas.toBlob(r, 'image/png'));
        const maskBlob = await new Promise(r => blemishMaskCanvas.toBlob(r, 'image/png'));
        const formData = new FormData();
        formData.append('image', imageBlob, 'image.png');
        formData.append('mask', maskBlob, 'mask.png');
        formData.append('method', method);
        formData.append('radius', String(radius));
        const resp = await fetch('/image/api/remove_blemish', { method: 'POST', body: formData });
        if (!resp.ok)
            throw new Error('Healing failed');
        const healedBlob = await resp.blob();
        const healedUrl = URL.createObjectURL(healedBlob);
        await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                singleImageCtx.drawImage(img, 0, 0);
                URL.revokeObjectURL(healedUrl);
                resolve();
            };
            img.src = healedUrl;
        });
        // Reset mask
        blemishMaskCtx.fillStyle = 'black';
        blemishMaskCtx.fillRect(0, 0, blemishMaskCanvas.width, blemishMaskCanvas.height);
        window.hasDrawnMask = false;
        showToast('✨ Healed!', 'success');
    }
    catch (err) {
        console.error(err);
        showToast('❌ Healing failed', 'danger');
    }
    finally {
        window.isProcessingHeal = false;
    }
}
// ===== CROP TOOL =====
let cropToolActive = false;
let cropOverlay = null;
let cropRect = { x: 50, y: 50, width: 400, height: 400 }; // Default crop area
let isDraggingCrop = false;
let cropDragStartX = 0;
let cropDragStartY = 0;
let dragType = ''; // 'move', 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
function toggleCropTool() {
    // Deactivate other tools first
    if (!cropToolActive) {
        deactivateAllTools();
    }
    if (collageImages.length === 0) {
        showToast('Upload a photo first!', 'warning');
        return;
    }
    // Only works in single image mode
    if (collageImages.length > 1) {
        showToast('Crop tool only works with single images', 'info');
        return;
    }
    cropToolActive = !cropToolActive;
    const btn = document.getElementById('cropToolBtn');
    if (cropToolActive) {
        btn.classList.add('active');
        btn.style.backgroundColor = '#0dcaf0';
        btn.style.color = 'white';
        showCropOverlay();
        showToast('✂️ Adjust crop area and press Enter to apply, ESC to cancel', 'info');
    }
    else {
        btn.classList.remove('active');
        btn.style.backgroundColor = '';
        btn.style.color = '';
        hideCropOverlay();
    }
}
function showCropOverlay() {
    // Save state before crop
    saveCanvasState();
    // Create overlay container
    const viewer = document.getElementById('singleImageViewer');
    cropOverlay = document.createElement('div');
    cropOverlay.id = 'cropOverlay';
    // Get canvas position within viewer
    const viewerRect = viewer.getBoundingClientRect();
    const canvasRect = singleImageCanvas.getBoundingClientRect();
    // Calculate canvas position relative to viewer
    const canvasLeft = canvasRect.left - viewerRect.left;
    const canvasTop = canvasRect.top - viewerRect.top;
    const canvasWidth = canvasRect.width;
    const canvasHeight = canvasRect.height;
    cropOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 200;
        cursor: move;
        pointer-events: all;
    `;
    // Initialize crop rect based on actual canvas position and size
    const margin = Math.min(canvasWidth, canvasHeight) * 0.1; // 10% margin
    cropRect = {
        x: canvasLeft + margin,
        y: canvasTop + margin,
        width: canvasWidth - margin * 2,
        height: canvasHeight - margin * 2
    };
    cropOverlay.innerHTML = `
        <svg width="100%" height="100%" class="image-crop-svg">
            <!-- Dimmed area outside crop -->
            <defs>
                <mask id="cropMask">
                    <rect width="100%" height="100%" fill="white"/>
                    <rect id="cropHole" x="${cropRect.x}" y="${cropRect.y}" 
                          width="${cropRect.width}" height="${cropRect.height}" fill="black"/>
                </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#cropMask)"/>


            
            <!-- Crop frame -->
            <rect id="cropFrame" x="${cropRect.x}" y="${cropRect.y}" 
                  width="${cropRect.width}" height="${cropRect.height}" 
                  fill="none" stroke="#00ffff" stroke-width="2"/>
            
            <!-- Grid lines (rule of thirds) -->
            <line x1="${cropRect.x + cropRect.width / 3}" y1="${cropRect.y}" 
                  x2="${cropRect.x + cropRect.width / 3}" y2="${cropRect.y + cropRect.height}" 
                  stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
            <line x1="${cropRect.x + cropRect.width * 2 / 3}" y1="${cropRect.y}" 
                  x2="${cropRect.x + cropRect.width * 2 / 3}" y2="${cropRect.y + cropRect.height}" 
                  stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
            <line x1="${cropRect.x}" y1="${cropRect.y + cropRect.height / 3}" 
                  x2="${cropRect.x + cropRect.width}" y2="${cropRect.y + cropRect.height / 3}" 
                  stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
            <line x1="${cropRect.x}" y1="${cropRect.y + cropRect.height * 2 / 3}" 
                  x2="${cropRect.x + cropRect.width}" y2="${cropRect.y + cropRect.height * 2 / 3}" 
                  stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
            
            <!-- Corner handles (larger, easier to grab) -->
            <circle cx="${cropRect.x}" cy="${cropRect.y}" r="10" fill="#00ffff" stroke="white" stroke-width="2" class="crop-handle" data-handle="nw"/>
            <circle cx="${cropRect.x + cropRect.width}" cy="${cropRect.y}" r="10" fill="#00ffff" stroke="white" stroke-width="2" class="crop-handle" data-handle="ne"/>
            <circle cx="${cropRect.x}" cy="${cropRect.y + cropRect.height}" r="10" fill="#00ffff" stroke="white" stroke-width="2" class="crop-handle" data-handle="sw"/>
            <circle cx="${cropRect.x + cropRect.width}" cy="${cropRect.y + cropRect.height}" r="10" fill="#00ffff" stroke="white" stroke-width="2" class="crop-handle" data-handle="se"/>
            
            <!-- Edge handles -->
            <circle cx="${cropRect.x + cropRect.width / 2}" cy="${cropRect.y}" r="8" fill="#00ffff" stroke="white" stroke-width="2" class="crop-handle" data-handle="n"/>
            <circle cx="${cropRect.x + cropRect.width / 2}" cy="${cropRect.y + cropRect.height}" r="8" fill="#00ffff" stroke="white" stroke-width="2" class="crop-handle" data-handle="s"/>
            <circle cx="${cropRect.x}" cy="${cropRect.y + cropRect.height / 2}" r="8" fill="#00ffff" stroke="white" stroke-width="2" class="crop-handle" data-handle="w"/>
            <circle cx="${cropRect.x + cropRect.width}" cy="${cropRect.y + cropRect.height / 2}" r="8" fill="#00ffff" stroke="white" stroke-width="2" class="crop-handle" data-handle="e"/>
        </svg>
    `;
    viewer.appendChild(cropOverlay);
    // Add event listeners
    cropOverlay.addEventListener('mousedown', startCropDrag);
    document.addEventListener('mousemove', continueCropDrag);
    document.addEventListener('mouseup', endCropDrag);
    document.addEventListener('keydown', handleCropKeys);
    // Handle cursor changes
    cropOverlay.addEventListener('mousemove', updateCropCursor);
}
function hideCropOverlay() {
    if (cropOverlay) {
        cropOverlay.remove();
        cropOverlay = null;
    }
    document.removeEventListener('mousemove', continueCropDrag);
    document.removeEventListener('mouseup', endCropDrag);
    document.removeEventListener('keydown', handleCropKeys);
}
function updateCropCursor(e) {
    const handle = e.target.dataset.handle;
    if (handle) {
        const cursors = {
            'nw': 'nw-resize', 'ne': 'ne-resize', 'sw': 'sw-resize', 'se': 'se-resize',
            'n': 'n-resize', 's': 's-resize', 'e': 'e-resize', 'w': 'w-resize'
        };
        cropOverlay.style.cursor = cursors[handle] || 'move';
    }
    else {
        // Check if inside crop rect
        const rect = singleImageCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (x >= cropRect.x && x <= cropRect.x + cropRect.width &&
            y >= cropRect.y && y <= cropRect.y + cropRect.height) {
            cropOverlay.style.cursor = 'move';
        }
        else {
            cropOverlay.style.cursor = 'default';
        }
    }
}
function startCropDrag(e) {
    isDraggingCrop = true;
    const viewerRect = document.getElementById('singleImageViewer').getBoundingClientRect();
    cropDragStartX = e.clientX - viewerRect.left;
    cropDragStartY = e.clientY - viewerRect.top;
    const handle = e.target.dataset.handle;
    if (handle) {
        dragType = handle;
    }
    else {
        // Check if inside crop area
        if (cropDragStartX >= cropRect.x && cropDragStartX <= cropRect.x + cropRect.width &&
            cropDragStartY >= cropRect.y && cropDragStartY <= cropRect.y + cropRect.height) {
            dragType = 'move';
        }
    }
}
function continueCropDrag(e) {
    if (!isDraggingCrop)
        return;
    const viewerRect = document.getElementById('singleImageViewer').getBoundingClientRect();
    const canvasRect = singleImageCanvas.getBoundingClientRect();
    const canvasLeft = canvasRect.left - viewerRect.left;
    const canvasTop = canvasRect.top - viewerRect.top;
    const canvasWidth = canvasRect.width;
    const canvasHeight = canvasRect.height;
    const x = e.clientX - viewerRect.left;
    const y = e.clientY - viewerRect.top;
    const dx = x - cropDragStartX;
    const dy = y - cropDragStartY;
    if (dragType === 'move') {
        cropRect.x += dx;
        cropRect.y += dy;
        // Keep within canvas bounds
        cropRect.x = Math.max(canvasLeft, Math.min(canvasLeft + canvasWidth - cropRect.width, cropRect.x));
        cropRect.y = Math.max(canvasTop, Math.min(canvasTop + canvasHeight - cropRect.height, cropRect.y));
    }
    else if (dragType) {
        // Handle resize
        if (dragType.includes('n')) {
            const newY = cropRect.y + dy;
            const newHeight = cropRect.height - dy;
            if (newHeight > 50) {
                cropRect.y = Math.max(canvasTop, newY);
                cropRect.height = newHeight;
            }
        }
        if (dragType.includes('s')) {
            const maxHeight = canvasTop + canvasHeight - cropRect.y;
            cropRect.height = Math.max(50, Math.min(maxHeight, cropRect.height + dy));
        }
        if (dragType.includes('w')) {
            const newX = cropRect.x + dx;
            const newWidth = cropRect.width - dx;
            if (newWidth > 50) {
                cropRect.x = Math.max(canvasLeft, newX);
                cropRect.width = newWidth;
            }
        }
        if (dragType.includes('e')) {
            const maxWidth = canvasLeft + canvasWidth - cropRect.x;
            cropRect.width = Math.max(50, Math.min(maxWidth, cropRect.width + dx));
        }
        // Ensure crop stays within canvas bounds
        cropRect.x = Math.max(canvasLeft, cropRect.x);
        cropRect.y = Math.max(canvasTop, cropRect.y);
        cropRect.width = Math.min(canvasLeft + canvasWidth - cropRect.x, cropRect.width);
        cropRect.height = Math.min(canvasTop + canvasHeight - cropRect.y, cropRect.height);
    }
    cropDragStartX = x;
    cropDragStartY = y;
    updateCropOverlay();
}
function endCropDrag() {
    isDraggingCrop = false;
    dragType = '';
}
function updateCropOverlay() {
    if (!cropOverlay)
        return;
    const svg = cropOverlay.querySelector('svg');
    svg.querySelector('#cropHole').setAttribute('x', cropRect.x);
    svg.querySelector('#cropHole').setAttribute('y', cropRect.y);
    svg.querySelector('#cropHole').setAttribute('width', cropRect.width);
    svg.querySelector('#cropHole').setAttribute('height', cropRect.height);
    svg.querySelector('#cropFrame').setAttribute('x', cropRect.x);
    svg.querySelector('#cropFrame').setAttribute('y', cropRect.y);
    svg.querySelector('#cropFrame').setAttribute('width', cropRect.width);
    svg.querySelector('#cropFrame').setAttribute('height', cropRect.height);
    // Update grid lines
    const lines = svg.querySelectorAll('line');
    lines[0].setAttribute('x1', cropRect.x + cropRect.width / 3);
    lines[0].setAttribute('x2', cropRect.x + cropRect.width / 3);
    lines[0].setAttribute('y1', cropRect.y);
    lines[0].setAttribute('y2', cropRect.y + cropRect.height);
    lines[1].setAttribute('x1', cropRect.x + cropRect.width * 2 / 3);
    lines[1].setAttribute('x2', cropRect.x + cropRect.width * 2 / 3);
    lines[1].setAttribute('y1', cropRect.y);
    lines[1].setAttribute('y2', cropRect.y + cropRect.height);
    lines[2].setAttribute('x1', cropRect.x);
    lines[2].setAttribute('x2', cropRect.x + cropRect.width);
    lines[2].setAttribute('y1', cropRect.y + cropRect.height / 3);
    lines[2].setAttribute('y2', cropRect.y + cropRect.height / 3);
    lines[3].setAttribute('x1', cropRect.x);
    lines[3].setAttribute('x2', cropRect.x + cropRect.width);
    lines[3].setAttribute('y1', cropRect.y + cropRect.height * 2 / 3);
    lines[3].setAttribute('y2', cropRect.y + cropRect.height * 2 / 3);
    // Update handles
    const handles = svg.querySelectorAll('.crop-handle');
    handles[0].setAttribute('cx', cropRect.x);
    handles[0].setAttribute('cy', cropRect.y);
    handles[1].setAttribute('cx', cropRect.x + cropRect.width);
    handles[1].setAttribute('cy', cropRect.y);
    handles[2].setAttribute('cx', cropRect.x);
    handles[2].setAttribute('cy', cropRect.y + cropRect.height);
    handles[3].setAttribute('cx', cropRect.x + cropRect.width);
    handles[3].setAttribute('cy', cropRect.y + cropRect.height);
    handles[4].setAttribute('cx', cropRect.x + cropRect.width / 2);
    handles[4].setAttribute('cy', cropRect.y);
    handles[5].setAttribute('cx', cropRect.x + cropRect.width / 2);
    handles[5].setAttribute('cy', cropRect.y + cropRect.height);
    handles[6].setAttribute('cx', cropRect.x);
    handles[6].setAttribute('cy', cropRect.y + cropRect.height / 2);
    handles[7].setAttribute('cx', cropRect.x + cropRect.width);
    handles[7].setAttribute('cy', cropRect.y + cropRect.height / 2);
}
function handleCropKeys(e) {
    if (!cropToolActive)
        return;
    if (e.key === 'Enter') {
        applyCrop();
    }
    else if (e.key === 'Escape') {
        toggleCropTool();
    }
}
function applyCrop() {
    // Get canvas position relative to viewer
    const viewerRect = document.getElementById('singleImageViewer').getBoundingClientRect();
    const canvasRect = singleImageCanvas.getBoundingClientRect();
    const canvasLeft = canvasRect.left - viewerRect.left;
    const canvasTop = canvasRect.top - viewerRect.top;
    // Calculate crop coordinates relative to canvas
    const cropXRelative = cropRect.x - canvasLeft;
    const cropYRelative = cropRect.y - canvasTop;
    // Scale to actual canvas pixels
    const scaleX = singleImageCanvas.width / canvasRect.width;
    const scaleY = singleImageCanvas.height / canvasRect.height;
    const cropX = Math.max(0, Math.floor(cropXRelative * scaleX));
    const cropY = Math.max(0, Math.floor(cropYRelative * scaleY));
    const cropW = Math.min(singleImageCanvas.width - cropX, Math.floor(cropRect.width * scaleX));
    const cropH = Math.min(singleImageCanvas.height - cropY, Math.floor(cropRect.height * scaleY));
    if (cropW <= 0 || cropH <= 0) {
        showToast('Invalid crop area', 'error');
        return;
    }
    // Get the cropped image data
    const croppedData = singleImageCtx.getImageData(cropX, cropY, cropW, cropH);
    // Resize canvas to cropped size
    singleImageCanvas.width = cropW;
    singleImageCanvas.height = cropH;
    // Draw cropped image
    singleImageCtx.putImageData(croppedData, 0, 0);
    // Update the original image
    const croppedImage = new Image();
    croppedImage.onload = function () {
        collageImages[0] = croppedImage;
        // Save to cache only (not history - history is for uploaded images only)
        const imageDataURLs = [croppedImage.src];
        saveImageToCache(imageDataURLs, 'collage');
        // Clear history and save new state
        canvasHistory = [];
        saveCanvasState();
        showToast('✂️ Image cropped successfully!', 'success');
        toggleCropTool();
    };
    croppedImage.src = singleImageCanvas.toDataURL('image/png');
}
// ===== IMAGE ENHANCEMENT =====
async function enhanceImage() {
    if (collageImages.length === 0) {
        showToast('Upload a photo first!', 'warning');
        return;
    }
    // Only works in single image mode
    if (collageImages.length > 1) {
        showToast('Enhance tool only works with single images', 'info');
        return;
    }
    const btn = document.getElementById('enhanceBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Enhancing...';
    try {
        // Save state before enhancement
        saveCanvasState();
        // Convert canvas to blob
        const blob = await new Promise(resolve => {
            singleImageCanvas.toBlob(resolve, 'image/png');
        });
        // Create FormData
        const formData = new FormData();
        formData.append('image', blob, 'image.png');
        // Call enhancement API
        const response = await fetch('/image/api/enhance_web_image', {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            throw new Error('Enhancement failed');
        }
        // Get enhanced image
        const enhancedBlob = await response.blob();
        const enhancedURL = URL.createObjectURL(enhancedBlob);
        // Load and display enhanced image
        const enhancedImg = new Image();
        enhancedImg.onload = function () {
            // Update canvas
            singleImageCanvas.width = enhancedImg.width;
            singleImageCanvas.height = enhancedImg.height;
            singleImageCtx.clearRect(0, 0, singleImageCanvas.width, singleImageCanvas.height);
            singleImageCtx.drawImage(enhancedImg, 0, 0);
            // Update collage images array
            collageImages[0] = enhancedImg;
            // Save to cache
            const imageDataURLs = [singleImageCanvas.toDataURL('image/png')];
            saveImageToCache(imageDataURLs, 'collage');
            // Save new state for undo
            saveCanvasState();
            // Clean up
            URL.revokeObjectURL(enhancedURL);
            showToast('✨ Image enhanced successfully!', 'success');
        };
        enhancedImg.onerror = function () {
            throw new Error('Failed to load enhanced image');
        };
        enhancedImg.src = enhancedURL;
    }
    catch (error) {
        console.error('Enhancement error:', error);
        showToast('Enhancement failed: ' + error.message, 'danger');
    }
    finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-stars me-1"></i>Enhance';
    }
}
// ===== LOCKED DRAG WITH OBJECT-POSITION =====
function bindLockedDrag(img, imageIndex) {
    if (!img)
        return;
    img.setAttribute('draggable', 'false'); // chặn drag mặc định của trình duyệt
    img.style.cursor = 'grab';
    let dragging = false;
    let startX = 0, startY = 0;
    let startPosX = 50, startPosY = 50; // object-position ban đầu (%)
    img.addEventListener('pointerdown', (e) => {
        // Don't allow dragging if locked (editing text)
        if (isImageDraggingLocked) {
            console.log('⛔ Image drag blocked - text editing in progress');
            return;
        }
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        // Lấy object-position hiện tại
        const pos = img.style.objectPosition || '50% 50%';
        const [px, py] = pos.split(' ').map(s => parseFloat(s));
        startPosX = px;
        startPosY = py;
        if (img.setPointerCapture) {
            img.setPointerCapture(e.pointerId);
        }
        img.style.cursor = 'grabbing';
        e.preventDefault();
    }, { passive: false });
    img.addEventListener('pointermove', (e) => {
        if (!dragging)
            return;
        const rect = img.getBoundingClientRect();
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        // Chuyển delta pixel sang % dựa trên kích thước tile
        const deltaXPercent = (deltaX / rect.width) * 100;
        const deltaYPercent = (deltaY / rect.height) * 100;
        // Tính vị trí mới (kéo chuột phải = ảnh sang phải, kéo lên = ảnh lên)
        let newX = startPosX + deltaXPercent;
        let newY = startPosY + deltaYPercent;
        // Clamp 0–100% để không bao giờ hở nền
        newX = Math.max(0, Math.min(100, newX));
        newY = Math.max(0, Math.min(100, newY));
        img.style.objectPosition = `${newX}% ${newY}%`;
        // Save to imagePositions array for persistence
        if (imageIndex !== undefined) {
            imagePositions[imageIndex] = { x: newX, y: newY };
        }
        e.preventDefault();
    }, { passive: false });
    const end = () => {
        dragging = false;
        img.style.cursor = 'grab';
    };
    img.addEventListener('pointerup', end);
    img.addEventListener('pointercancel', end);
}
// ===== HELPER FUNCTIONS FOR CANVAS COLLAGE =====
// Preload ảnh: trả về HTMLImageElement đã sẵn sàng
async function loadImage(src) {
    return new Promise((res, rej) => {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = src;
    });
}
// Tính danh sách cell theo layout cho 3 ảnh
// Trả về mảng các rect: [{x,y,w,h}, ...] (tọa độ pixel trong canvas)
function getCellsForLayout(layoutKey, W, H, gutter) {
    const g = gutter;
    // Mặc định: 1 ảnh bên phải full height, 2 ảnh bên trái chia đôi
    // Đặt tên ví dụ: 'L2_R1' (2 trái 1 phải), 'R2_L1', 'T2_B1' (2 trên 1 dưới), ...
    switch (layoutKey) {
        case 'L2_R1':
        case 'layout-3-left': {
            const colW = Math.floor((W - g) / 2);
            const rightW = W - g - colW;
            const halfH = Math.floor((H - g) / 2);
            return [
                { x: 0, y: 0, w: colW, h: halfH }, // left-top
                { x: 0, y: halfH + g, w: colW, h: H - halfH - g }, // left-bottom
                { x: colW + g, y: 0, w: rightW, h: H } // right full
            ];
        }
        case 'R2_L1':
        case 'layout-3-right': {
            const colW = Math.floor((W - g) / 2);
            const leftW = W - g - colW;
            const halfH = Math.floor((H - g) / 2);
            return [
                { x: 0, y: 0, w: leftW, h: H }, // left full
                { x: leftW + g, y: 0, w: colW, h: halfH }, // right-top
                { x: leftW + g, y: halfH + g, w: colW, h: H - halfH - g } // right-bottom
            ];
        }
        case 'T2_B1':
        case 'layout-3-top': {
            const rowH = Math.floor((H - g) / 2);
            const topH = rowH, botH = H - g - rowH;
            const halfW = Math.floor((W - g) / 2);
            return [
                { x: 0, y: 0, w: halfW, h: topH }, // top-left
                { x: halfW + g, y: 0, w: W - halfW - g, h: topH }, // top-right
                { x: 0, y: topH + g, w: W, h: botH } // bottom full
            ];
        }
        case 'B2_T1':
        case 'layout-3-bottom': {
            const rowH = Math.floor((H - g) / 2);
            const topH = H - g - rowH, botH = rowH;
            const halfW = Math.floor((W - g) / 2);
            return [
                { x: 0, y: 0, w: W, h: topH }, // top full
                { x: 0, y: topH + g, w: halfW, h: botH }, // bottom-left
                { x: halfW + g, y: topH + g, w: W - halfW - g, h: botH } // bottom-right
            ];
        }
        case 'layout-3h':
        case 'layout-3-horizontal':
        default: { // 3 cột (fallback)
            const colW = Math.floor((W - 2 * g) / 3);
            return [
                { x: 0, y: 0, w: colW, h: H },
                { x: colW + g, y: 0, w: colW, h: H },
                { x: 2 * (colW + g), y: 0, w: W - 2 * (colW + g) - colW, h: H }
            ];
        }
    }
}
// Clamp offset để không bao giờ hở nền (cover logic)
function clampOffsetForCover(imgW, imgH, cellW, cellH, off) {
    const imgAspect = imgW / imgH;
    const cellAspect = cellW / cellH;
    // Kích thước vẽ theo cover
    let drawW, drawH;
    if (imgAspect > cellAspect) {
        drawH = cellH;
        drawW = Math.ceil(cellH * imgAspect);
    }
    else {
        drawW = cellW;
        drawH = Math.ceil(cellW / imgAspect);
    }
    // Phần "dư" để có thể pan mà vẫn cover
    const overflowX = Math.max(0, drawW - cellW);
    const overflowY = Math.max(0, drawH - cellH);
    return {
        x: Math.min(overflowX / 2, Math.max(-overflowX / 2, off.x || 0)),
        y: Math.min(overflowY / 2, Math.max(-overflowY / 2, off.y || 0)),
        drawW, drawH
    };
}
// ===== PHOTO COLLAGE TAB VARIABLES =====
let collageCanvas = document.getElementById('collageCanvas');
let collageCtx = collageCanvas.getContext('2d');
let collageImages = [];
let selectedLayout = null;
// Image position offsets for manual adjustment
let imageOffsets = []; // Array of {x: 0, y: 0} for each image
// Store object-position for each image (to persist across re-renders)
let imagePositions = []; // Array of {x: 50, y: 50} (percentage)
// Current images and layout for canvas redraw
let currentImages = [];
let currentLayoutKey = null;
// Drag state
let isDragging = false;
let dragImageIndex = -1;
let dragStartX = 0;
let dragStartY = 0;
let dragInitialOffsetX = 0;
let dragInitialOffsetY = 0;
// Layout templates definitions - [col, row, colSpan, rowSpan]
const layoutTemplates = [
    // === 1 PHOTO ===
    { id: 'layout-1', name: '1 photo', cols: 1, rows: 1, maxPhotos: 1, cells: [[0, 0, 1, 1]] },
    // === 2 PHOTOS ===
    { id: 'layout-2h', name: '2 horizontal', cols: 2, rows: 1, maxPhotos: 2, cells: [[0, 0, 1, 1], [1, 0, 1, 1]] },
    { id: 'layout-2v', name: '2 vertical', cols: 1, rows: 2, maxPhotos: 2, cells: [[0, 0, 1, 1], [0, 1, 1, 1]] },
    // === 3 PHOTOS ===
    { id: 'layout-3h', name: '3 horizontal', cols: 3, rows: 1, maxPhotos: 3, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1]] },
    { id: 'layout-3v', name: '3 vertical', cols: 1, rows: 3, maxPhotos: 3, cells: [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1]] },
    { id: 'layout-3-left', name: '3 left large', cols: 2, rows: 2, maxPhotos: 3, cells: [[0, 0, 1, 2], [1, 0, 1, 1], [1, 1, 1, 1]] },
    { id: 'layout-3-right', name: '3 right large', cols: 2, rows: 2, maxPhotos: 3, cells: [[0, 0, 1, 1], [0, 1, 1, 1], [1, 0, 1, 2]] },
    { id: 'layout-3-top', name: '3 top large', cols: 2, rows: 2, maxPhotos: 3, cells: [[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1]] },
    { id: 'layout-3-bottom', name: '3 bottom large', cols: 2, rows: 2, maxPhotos: 3, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 2, 1]] },
    // === 4 PHOTOS ===
    { id: 'layout-4-grid', name: '4 grid 2×2', cols: 2, rows: 2, maxPhotos: 4, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1]] },
    { id: 'layout-4h', name: '4 horizontal', cols: 4, rows: 1, maxPhotos: 4, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [3, 0, 1, 1]] },
    { id: 'layout-4v', name: '4 vertical', cols: 1, rows: 4, maxPhotos: 4, cells: [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1], [0, 3, 1, 1]] },
    { id: 'layout-4-left', name: '4 left large', cols: 2, rows: 3, maxPhotos: 4, cells: [[0, 0, 1, 3], [1, 0, 1, 1], [1, 1, 1, 1], [1, 2, 1, 1]] },
    { id: 'layout-4-right', name: '4 right large', cols: 2, rows: 3, maxPhotos: 4, cells: [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1], [1, 0, 1, 3]] },
    { id: 'layout-4-top', name: '4 top large', cols: 3, rows: 2, maxPhotos: 4, cells: [[0, 0, 3, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]] },
    { id: 'layout-4-bottom', name: '4 bottom large', cols: 3, rows: 2, maxPhotos: 4, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [0, 1, 3, 1]] },
    { id: 'layout-4-center', name: '4 center large', cols: 3, rows: 3, maxPhotos: 4, cells: [[0, 0, 1, 1], [2, 0, 1, 1], [1, 1, 1, 1], [0, 2, 1, 1]] },
    // === 5 PHOTOS ===
    { id: 'layout-5h', name: '5 horizontal', cols: 5, rows: 1, maxPhotos: 5, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [3, 0, 1, 1], [4, 0, 1, 1]] },
    { id: 'layout-5v', name: '5 vertical', cols: 1, rows: 5, maxPhotos: 5, cells: [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1], [0, 3, 1, 1], [0, 4, 1, 1]] },
    { id: 'layout-5-left', name: '5 left large', cols: 3, rows: 2, maxPhotos: 5, cells: [[0, 0, 1, 2], [1, 0, 1, 1], [2, 0, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]] },
    { id: 'layout-5-right', name: '5 right large', cols: 3, rows: 2, maxPhotos: 5, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 0, 1, 2]] },
    { id: 'layout-5-top2', name: '5 top 2', cols: 3, rows: 2, maxPhotos: 5, cells: [[0, 0, 2, 1], [2, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]] },
    { id: 'layout-5-top3', name: '5 top 3', cols: 3, rows: 2, maxPhotos: 5, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [0, 1, 2, 1], [2, 1, 1, 1]] },
    { id: 'layout-5-center', name: '5 center large', cols: 3, rows: 3, maxPhotos: 5, cells: [[0, 0, 1, 1], [2, 0, 1, 1], [1, 1, 1, 1], [0, 2, 1, 1], [2, 2, 1, 1]] },
    { id: 'layout-5-grid', name: '5 grid mixed', cols: 3, rows: 2, maxPhotos: 5, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [0, 1, 1, 1], [1, 1, 2, 1]] },
    // === 6 PHOTOS ===
    { id: 'layout-6-grid', name: '6 grid 2×3', cols: 3, rows: 2, maxPhotos: 6, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]] },
    { id: 'layout-6h', name: '6 horizontal', cols: 6, rows: 1, maxPhotos: 6, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [3, 0, 1, 1], [4, 0, 1, 1], [5, 0, 1, 1]] },
    { id: 'layout-6v', name: '6 vertical', cols: 1, rows: 6, maxPhotos: 6, cells: [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1], [0, 3, 1, 1], [0, 4, 1, 1], [0, 5, 1, 1]] },
    // === 9 PHOTOS ===
    { id: 'layout-9-grid', name: '9 grid 3×3', cols: 3, rows: 3, maxPhotos: 9, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1], [0, 2, 1, 1], [1, 2, 1, 1], [2, 2, 1, 1]] }
];
// Update slider values display and trigger collage update
document.getElementById('collageGutter').addEventListener('input', function (e) {
    document.getElementById('gutterValue2').textContent = e.target.value;
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});
document.getElementById('collageRadius').addEventListener('input', function (e) {
    document.getElementById('radiusValue2').textContent = e.target.value;
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});
document.getElementById('collageBorder').addEventListener('input', function (e) {
    document.getElementById('borderValue2').textContent = e.target.value;
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});
// Auto-update collage when settings change
document.getElementById('collageAspect').addEventListener('change', function () {
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});
document.getElementById('collageBorderColor').addEventListener('change', function () {
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});
document.getElementById('collageBackground').addEventListener('change', function () {
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});
// Render layout templates
function renderLayoutTemplates() {
    const container = document.getElementById('layoutTemplates');
    const panel = document.getElementById('templatesPanel');
    // Show/hide panel based on uploaded photos
    if (collageImages.length === 0) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';
    let html = '';
    // Filter templates: only show templates matching uploaded photo count
    const availableTemplates = layoutTemplates.filter(layout => layout.maxPhotos === collageImages.length);
    if (availableTemplates.length === 0) {
        html = `<div class="text-center text-muted p-2 w-100 image-layout-empty">
                    <i class="bi bi-info-circle"></i> No layouts for ${collageImages.length} photos
                </div>`;
        container.innerHTML = html;
        return;
    }
    availableTemplates.forEach(layout => {
        // Smaller size for sidebar
        const svgSize = 60;
        const maxDim = Math.max(layout.cols, layout.rows);
        const scale = svgSize / maxDim;
        const svgWidth = layout.cols * scale;
        const svgHeight = layout.rows * scale;
        html += `
            <div class="layout-template ${selectedLayout === layout.id ? 'selected' : ''}"
                 data-image-layout-id="${layout.id}"
                 title="${layout.name} (${layout.maxPhotos} photo${layout.maxPhotos > 1 ? 's' : ''})">
                <svg viewBox="0 0 ${layout.cols * 100} ${layout.rows * 100}" 
                     width="${svgWidth}" 
                     height="${svgHeight}"
                     class="image-layout-svg">
                    ${layout.cells.map(cell => {
            const [x, y, w, h] = cell;
            const cellX = x * 100;
            const cellY = y * 100;
            const cellW = w * 100;
            const cellH = h * 100;
            return `<rect x="${cellX + 3}" y="${cellY + 3}" width="${cellW - 6}" height="${cellH - 6}" 
                                     fill="#495057" 
                                     stroke="#6c757d" 
                                     stroke-width="3"
                                     rx="5" ry="5"/>`;
        }).join('')}
                </svg>
                <small class="d-block text-center mt-1 image-layout-label">${layout.name}</small>
            </div>
        `;
    });
    container.innerHTML = html;
}
function selectLayout(layoutId) {
    const layout = layoutTemplates.find(l => l.id === layoutId);
    if (!layout)
        return;
    selectedLayout = layoutId;
    renderLayoutTemplates();
    if (collageImages.length > 0) {
        createCollageWithLayout();
    }
}
document.getElementById('collageUpload').addEventListener('change', function (e) {
    const files = Array.from(e.target.files);
    if (files.length === 0)
        return;
    collageImages = [];
    imageOffsets = [];
    imagePositions = []; // Reset saved positions
    const previewContainer = document.getElementById('uploadedPhotosPreview');
    previewContainer.innerHTML = '';
    const imageDataURLs = []; // Store for caching
    let loadedCount = 0;
    files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                collageImages.push(img);
                imageDataURLs.push(event.target.result); // Save dataURL
                loadedCount++;
                // Add thumbnail to preview
                const col = document.createElement('div');
                col.className = 'col-auto';
                col.innerHTML = `
                    <div class="position-relative image-thumb-frame">
                        <img src="${event.target.result}"
                             class="img-thumbnail image-thumb-img">
                    </div>
                `;
                previewContainer.appendChild(col);
                if (loadedCount === files.length) {
                    document.getElementById('collagePrompt').style.display = 'none';
                    // Check if single image mode
                    if (files.length === 1) {
                        // Single image viewer mode
                        showSingleImageViewer(collageImages[0]);
                        showToast('1 photo uploaded - Single viewer mode', 'success');
                    }
                    else {
                        // Collage mode (2+ images)
                        // Hide single image viewer when switching to collage
                        document.getElementById('singleImageViewer').style.display = 'none';
                        previewContainer.style.display = 'flex';
                        showToast(`${files.length} photos uploaded`, 'success');
                        // Re-render templates to show only matching photo count
                        renderLayoutTemplates();
                        // Auto-select first matching layout
                        const matchingLayout = layoutTemplates.find(l => l.maxPhotos === files.length);
                        if (matchingLayout) {
                            selectLayout(matchingLayout.id);
                        }
                    }
                    // Save to cache
                    saveImageToCache(imageDataURLs, 'collage');
                    // Auto-save to history
                    saveToHistory(imageDataURLs);
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
});
// ==== CREATE HTML COLLAGE WITH CSS GRID (SUPPORTS ALL LAYOUTS) ====
function createHTMLCollage() {
    const gutter = parseInt(document.getElementById('collageGutter').value);
    const radius = parseInt(document.getElementById('collageRadius').value);
    const borderWidth = parseInt(document.getElementById('collageBorder').value);
    const borderColor = document.getElementById('collageBorderColor').value;
    const backgroundColor = document.getElementById('collageBackground').value;
    const collageTiles = document.getElementById('collage-tiles');
    // Get current layout
    const layout = layoutTemplates.find(l => l.id === selectedLayout);
    if (!layout)
        return;
    // --- Get aspect ratio from selector ---
    const aspect = document.getElementById('collageAspect').value;
    const [arW, arH] = aspect.split(':').map(Number);
    // --- Calculate height based on actual width of #collage-tiles ---
    const tiles = document.getElementById('collage-tiles');
    const maxW = tiles.parentElement.clientWidth;
    const innerW = Math.max(320, maxW - gutter * 2);
    const innerH = Math.round(innerW * arH / arW);
    // Set CSS variables for responsive styling
    tiles.style.setProperty('--canvas-h', `${innerH}px`);
    tiles.style.aspectRatio = `${arW} / ${arH}`;
    collageTiles.style.setProperty('--gutter', `${gutter}px`);
    collageTiles.style.setProperty('--radius', `${radius}px`);
    collageTiles.style.setProperty('--stroke', `${borderWidth}px`);
    collageTiles.style.setProperty('--stroke-color', borderColor);
    // Apply background
    collageTiles.style.backgroundColor = backgroundColor;
    collageTiles.style.padding = `${gutter}px`;
    // Clear existing tiles
    collageTiles.innerHTML = '';
    // Set up CSS Grid based on layout
    collageTiles.style.display = 'grid';
    collageTiles.style.gridTemplateColumns = `repeat(${layout.cols}, 1fr)`;
    collageTiles.style.gridTemplateRows = `repeat(${layout.rows}, 1fr)`;
    collageTiles.style.gap = `${gutter}px`;
    // Create tiles based on layout cells
    layout.cells.forEach((cell, index) => {
        if (index >= collageImages.length)
            return; // Don't create tile if no image
        const [col, row, colSpan, rowSpan] = cell;
        // Create tile container
        const tileDiv = document.createElement('div');
        tileDiv.className = 'tile';
        tileDiv.style.gridColumn = `${col + 1} / span ${colSpan}`;
        tileDiv.style.gridRow = `${row + 1} / span ${rowSpan}`;
        tileDiv.style.overflow = 'hidden';
        tileDiv.style.borderRadius = `${radius}px`;
        tileDiv.style.border = borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : 'none';
        tileDiv.style.position = 'relative';
        // Create image
        const img = document.createElement('img');
        img.src = collageImages[index].src;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        // Restore saved position or use default
        if (imagePositions[index]) {
            img.style.objectPosition = `${imagePositions[index].x}% ${imagePositions[index].y}%`;
        }
        else {
            img.style.objectPosition = '50% 50%';
            // Initialize position in array
            imagePositions[index] = { x: 50, y: 50 };
        }
        img.style.pointerEvents = 'auto';
        img.style.userSelect = 'none';
        img.style.display = 'block';
        tileDiv.appendChild(img);
        collageTiles.appendChild(tileDiv);
        // Bind drag functionality with index
        bindLockedDrag(img, index);
    });
    // Hide canvas, show tiles
    document.getElementById('collageCanvasContainer').style.display = 'none';
    document.getElementById('uploadedPhotosPreview').style.display = 'none';
    document.getElementById('collagePrompt').style.display = 'none';
    collageTiles.style.display = 'grid';
}
// Apply UI settings
function applyUI() {
    if (selectedLayout && collageImages.length > 0) {
        createHTMLCollage();
    }
}
function createCollageWithLayout() {
    if (collageImages.length === 0 || !selectedLayout) {
        showToast('Please upload photos and select a layout', 'warning');
        return;
    }
    const layout = layoutTemplates.find(l => l.id === selectedLayout);
    if (!layout)
        return;
    // ===== USE HTML/CSS GRID FOR ALL LAYOUTS =====
    // HTML tiles work perfectly for all layouts (2, 3, 4, 9 photos)
    createHTMLCollage();
}
// New async canvas collage function
async function createCanvasCollage(images, layoutKey) {
    // Save for drag redraw
    currentImages = images;
    currentLayoutKey = layoutKey;
    // 1) Kích thước canvas theo tỷ lệ chọn
    const aspect = document.getElementById('collageAspect').value; // '1:1','3:4','4:5','16:9'
    const [arW, arH] = aspect.split(':').map(Number);
    const base = 1080; // cạnh dài để xuất nét
    const CW = arW >= arH ? base : Math.round(base * (arW / arH));
    const CH = arH >= arW ? base : Math.round(base * (arH / arW));
    collageCanvas.width = CW;
    collageCanvas.height = CH;
    const gutter = parseInt(document.getElementById('collageGutter').value || 0, 10);
    const radius = parseInt(document.getElementById('collageRadius').value || 0, 10);
    const border = parseInt(document.getElementById('collageBorder').value || 0, 10);
    const borderColor = document.getElementById('collageBorderColor').value || '#ff3b30';
    const backgroundColor = document.getElementById('collageBackground').value || '#111111';
    // 2) Preload ảnh (fix lỗi "chỉ 1 ảnh")
    const imgs = await Promise.all(images.map(src => loadImage(src)));
    // 3) Tính cell theo layout
    const cells = getCellsForLayout(layoutKey, CW, CH, gutter);
    // nếu số cell ít hơn số ảnh, chỉ lấy ảnh đầu; nếu nhiều hơn thì lặp lại ảnh cuối
    const n = Math.min(cells.length, imgs.length);
    collageCtx.clearRect(0, 0, CW, CH);
    // Fill background
    collageCtx.fillStyle = backgroundColor;
    collageCtx.fillRect(0, 0, CW, CH);
    for (let i = 0; i < n; i++) {
        const { x, y, w, h } = cells[i];
        const im = imgs[i];
        // 3a) chuẩn bị cover + clamp offset
        const offRaw = imageOffsets[i] || { x: 0, y: 0 };
        const { x: offX, y: offY, drawW, drawH } = clampOffsetForCover(im.width, im.height, w, h, offRaw);
        // 3b) toạ độ vẽ sao cho ảnh vẫn cover cell
        const drawX = x + Math.round((w - drawW) / 2 + offX);
        const drawY = y + Math.round((h - drawH) / 2 + offY);
        // 3c) clip tròn góc + vẽ
        collageCtx.save();
        if (radius > 0) {
            const r = Math.min(radius, Math.min(w, h) / 2 - 1);
            const p = new Path2D();
            p.moveTo(x + r, y);
            p.arcTo(x + w, y, x + w, y + h, r);
            p.arcTo(x + w, y + h, x, y + h, r);
            p.arcTo(x, y + h, x, y, r);
            p.arcTo(x, y, x + w, y, r);
            p.closePath();
            collageCtx.clip(p);
        }
        else {
            collageCtx.beginPath();
            collageCtx.rect(x, y, w, h);
            collageCtx.clip();
        }
        collageCtx.drawImage(im, drawX, drawY, drawW, drawH);
        collageCtx.restore();
        // 3d) Border cell (vẽ đúng nét, không *2)
        if (border > 0) {
            collageCtx.save();
            collageCtx.lineWidth = border;
            collageCtx.strokeStyle = borderColor;
            const inset = border / 2;
            collageCtx.beginPath();
            if (radius > 0) {
                const r = Math.max(0, Math.min(radius - inset, Math.min(w, h) / 2 - inset));
                const p2 = new Path2D();
                p2.moveTo(x + inset + r, y + inset);
                p2.arcTo(x + w - inset, y + inset, x + w - inset, y + h - inset, r);
                p2.arcTo(x + w - inset, y + h - inset, x + inset, y + h - inset, r);
                p2.arcTo(x + inset, y + h - inset, x + inset, y + inset, r);
                p2.arcTo(x + inset, y + inset, x + w - inset, y + inset, r);
                p2.closePath();
                collageCtx.stroke(p2);
            }
            else {
                collageCtx.strokeRect(x + inset, y + inset, w - border, h - border);
            }
            collageCtx.restore();
        }
    }
    // 4) Gắn vùng drag cho từng cell (pan trong giới hạn)
    enableCanvasDrag(cells);
    // Show canvas container
    document.getElementById('uploadedPhotosPreview').style.display = 'none';
    document.getElementById('collageCanvasContainer').style.display = 'block';
    document.getElementById('collage-tiles').style.display = 'none';
}
// Kéo trong Canvas – không bao giờ lòi nền
function enableCanvasDrag(cells) {
    let active = -1;
    let start = { x: 0, y: 0 };
    collageCanvas.onpointerdown = (e) => {
        const rect = collageCanvas.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (collageCanvas.width / rect.width);
        const cy = (e.clientY - rect.top) * (collageCanvas.height / rect.height);
        // chọn cell đang click
        active = cells.findIndex(({ x, y, w, h }) => cx >= x && cx <= x + w && cy >= y && cy <= y + h);
        start = { x: cx, y: cy };
        if (collageCanvas.setPointerCapture) {
            collageCanvas.setPointerCapture(e.pointerId);
        }
    };
    collageCanvas.onpointermove = (e) => {
        if (active < 0)
            return;
        const rect = collageCanvas.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (collageCanvas.width / rect.width);
        const cy = (e.clientY - rect.top) * (collageCanvas.height / rect.height);
        const dx = cx - start.x, dy = cy - start.y;
        start = { x: cx, y: cy };
        imageOffsets[active] = imageOffsets[active] || { x: 0, y: 0 };
        imageOffsets[active].x += dx;
        imageOffsets[active].y += dy;
        // vẽ lại (clamp sẽ áp trong createCanvasCollage)
        if (currentImages && currentLayoutKey) {
            createCanvasCollage(currentImages, currentLayoutKey);
        }
    };
    const end = () => { active = -1; };
    collageCanvas.onpointerup = end;
    collageCanvas.onpointercancel = end;
}
// ========== TEXT LAYER FUNCTIONS ==========
let textLayers = [];
let currentEditingLayer = null;
let textLayerCounter = 0;
let selectedTextRange = null;
function toggleTextLayer() {
    // Deactivate other tools first
    deactivateAllTools();
    if (collageImages.length === 0) {
        showToast('Upload photos first!', 'warning');
        return;
    }
    createNewTextLayer();
}
function createNewTextLayer() {
    textLayerCounter++;
    const layerId = `textLayer_${textLayerCounter}`;
    const textLayer = {
        id: layerId,
        text: 'Double click to edit',
        color: '#ffffff',
        rainbow: false,
        fontFamily: 'Arial',
        x: 50, // percentage
        y: 50, // percentage
        fontSize: 32
    };
    textLayers.push(textLayer);
    renderTextLayer(textLayer, false); // false = don't auto edit, let user double-click
    // Show helpful hint on first text layer
    if (textLayers.length === 1) {
        showToast('💡 Double-click text to edit, Drag to move, Right-click for options', 'info');
    }
}
function renderTextLayer(layer, autoEdit = false) {
    const container = document.getElementById('textLayersContainer');
    // Remove old layer element if exists
    const oldElement = document.getElementById(layer.id);
    if (oldElement)
        oldElement.remove();
    const layerDiv = document.createElement('div');
    layerDiv.id = layer.id;
    layerDiv.className = 'text-layer-wrapper';
    layerDiv.style.cssText = `
        position: absolute;
        left: ${layer.x}%;
        top: ${layer.y}%;
        transform: translate(-50%, -50%);
        cursor: move;
        pointer-events: auto;
        z-index: 10;
        max-width: 80%;
        user-select: none;
    `;
    // Create text content
    const textContent = document.createElement('div');
    textContent.className = 'text-layer-content';
    textContent.style.cssText = `
        font-size: ${layer.fontSize}px;
        font-weight: bold;
        font-family: ${layer.fontFamily || 'Arial'}, sans-serif;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        padding: 8px 12px;
        border: 2px solid transparent;
        transition: border 0.2s;
        pointer-events: auto;
        cursor: move;
        border-radius: 4px;
    `;
    if (layer.rainbow) {
        const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
        let html = '';
        for (let i = 0; i < layer.text.length; i++) {
            const color = colors[i % colors.length];
            html += `<span data-image-rainbow-color="${color}">${layer.text[i] === '\n' ? '<br>' : layer.text[i]}</span>`;
        }
        textContent.innerHTML = html;
        textContent.querySelectorAll('[data-image-rainbow-color]').forEach(span => {
            span.style.color = span.dataset.imageRainbowColor;
        });
    }
    else {
        textContent.style.color = layer.color;
        textContent.innerHTML = layer.text.replace(/\n/g, '<br>');
    }
    layerDiv.appendChild(textContent);
    // Hover effect
    layerDiv.onmouseenter = () => {
        if (textContent.contentEditable !== 'true') { // Only if not editing
            textContent.style.borderColor = 'rgba(13, 202, 240, 0.5)';
            textContent.style.backgroundColor = 'rgba(13, 202, 240, 0.1)';
        }
    };
    layerDiv.onmouseleave = () => {
        if (textContent.contentEditable !== 'true') { // Only if not editing
            textContent.style.borderColor = 'transparent';
            textContent.style.backgroundColor = 'transparent';
        }
    };
    // Double-click on wrapper or content to edit inline
    const enableEdit = (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log('Double-click detected on text layer:', layer.id);
        editTextLayerInline(layer.id);
    };
    layerDiv.ondblclick = enableEdit;
    textContent.ondblclick = enableEdit;
    // Right-click context menu for options
    layerDiv.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showTextContextMenu(e, layer.id);
    };
    // Drag functionality - MUST be on the wrapper
    makeDraggableText(layerDiv, layer);
    container.appendChild(layerDiv);
    // Auto-edit removed - user must double-click to edit
}
function editTextLayerInline(layerId) {
    console.log('editTextLayerInline called for:', layerId);
    const layer = textLayers.find(l => l.id === layerId);
    if (!layer) {
        console.error('Layer not found:', layerId);
        return;
    }
    const layerElement = document.getElementById(layerId);
    if (!layerElement) {
        console.error('Layer element not found:', layerId);
        return;
    }
    const textContent = layerElement.querySelector('.text-layer-content');
    if (!textContent) {
        console.error('Text content not found for:', layerId);
        return;
    }
    // Check if already editing
    if (textContent.contentEditable === 'true') {
        console.log('Already editing');
        textContent.focus();
        return;
    }
    console.log('Enabling contentEditable for direct editing');
    // LOCK image dragging while editing text
    lockImageDragging(true);
    // Make text content editable directly
    textContent.contentEditable = 'true';
    textContent.style.outline = '3px solid #0dcaf0';
    textContent.style.outlineOffset = '2px';
    textContent.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    textContent.style.cursor = 'text';
    textContent.style.zIndex = '1000'; // Bring to front
    // Store original HTML
    const originalHTML = textContent.innerHTML;
    // Clear rainbow formatting for editing (use plain text)
    if (layer.rainbow) {
        textContent.textContent = layer.text;
        textContent.style.color = '#ffffff';
    }
    // Focus and select text
    textContent.focus();
    // Select all text
    setTimeout(() => {
        const range = document.createRange();
        range.selectNodeContents(textContent);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }, 10);
    // Function to save and exit edit mode
    const saveAndExit = () => {
        const newText = textContent.textContent.trim();
        layer.text = newText || 'Double click to edit';
        // Exit edit mode
        textContent.contentEditable = 'false';
        textContent.style.outline = 'none';
        textContent.style.backgroundColor = 'transparent';
        textContent.style.cursor = 'move';
        textContent.style.zIndex = '10'; // Reset z-index
        // UNLOCK image dragging
        lockImageDragging(false);
        // Re-render to apply rainbow if needed
        renderTextLayer(layer);
        showToast('Text updated ✓', 'success');
    };
    // Save on blur (click outside)
    textContent.onblur = saveAndExit;
    // Save on Escape key
    textContent.onkeydown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            textContent.blur();
        }
        e.stopPropagation();
    };
    // Prevent double-click while editing
    textContent.ondblclick = (e) => {
        e.stopPropagation();
    };
}
function showColorPicker(layerId) {
    const layer = textLayers.find(l => l.id === layerId);
    if (!layer)
        return;
    currentEditingLayer = layer;
    // Position toolbar near the text layer
    const layerElement = document.getElementById(layerId);
    const rect = layerElement.getBoundingClientRect();
    const toolbar = document.getElementById('textColorToolbar');
    toolbar.style.display = 'block';
    toolbar.style.left = Math.min(rect.left, window.innerWidth - 300) + 'px';
    toolbar.style.top = (rect.bottom + 10) + 'px';
    // Set current values
    document.getElementById('toolbarColorPicker').value = layer.color;
    document.getElementById('toolbarColorCode').value = layer.color;
    document.getElementById('toolbarRainbowMode').checked = layer.rainbow;
}
// OLD FUNCTIONS - KEPT FOR COMPATIBILITY (can be removed later)
function deleteTextLayer(layerId) {
    textLayers = textLayers.filter(l => l.id !== layerId);
    const element = document.getElementById(layerId);
    if (element)
        element.remove();
    showToast('Text layer deleted', 'success');
}
function showTextContextMenu(event, layerId) {
    event.preventDefault();
    event.stopPropagation();
    const layer = textLayers.find(l => l.id === layerId);
    if (!layer)
        return;
    currentEditingLayer = layer;
    // Close any open menus first
    closeAllMenus();
    // Show main context menu
    const contextMenu = document.getElementById('textContextMenu');
    contextMenu.style.display = 'block';
    contextMenu.style.left = event.clientX + 'px';
    contextMenu.style.top = event.clientY + 'px';
    // Setup submenu hover events
    setupSubmenuHovers(event.clientX, event.clientY);
    // Close menu on click outside
    setTimeout(() => {
        document.addEventListener('click', closeAllMenus);
    }, 100);
}
function setupSubmenuHovers(menuX, menuY) {
    const colorMenuItem = document.getElementById('colorMenuItem');
    const fontMenuItem = document.getElementById('fontMenuItem');
    const colorSubmenu = document.getElementById('colorSubmenu');
    const fontSubmenu = document.getElementById('fontSubmenu');
    const contextMenu = document.getElementById('textContextMenu');
    // Color submenu hover
    colorMenuItem.onmouseenter = () => {
        fontSubmenu.style.display = 'none';
        colorSubmenu.style.display = 'block';
        const rect = colorMenuItem.getBoundingClientRect();
        colorSubmenu.style.left = (rect.right + 5) + 'px';
        colorSubmenu.style.top = rect.top + 'px';
        // Populate preset colors
        populatePresetColors();
        // Set current values
        document.getElementById('colorCodeInput').value = currentEditingLayer.color;
        document.getElementById('rainbowCheckbox').checked = currentEditingLayer.rainbow;
    };
    // Font submenu hover
    fontMenuItem.onmouseenter = () => {
        colorSubmenu.style.display = 'none';
        fontSubmenu.style.display = 'block';
        const rect = fontMenuItem.getBoundingClientRect();
        fontSubmenu.style.left = (rect.right + 5) + 'px';
        fontSubmenu.style.top = rect.top + 'px';
        // Populate font list
        populateFontList();
    };
    // Keep submenus open when hovering over them
    colorSubmenu.onmouseenter = () => {
        colorSubmenu.style.display = 'block';
    };
    fontSubmenu.onmouseenter = () => {
        fontSubmenu.style.display = 'block';
    };
}
function populatePresetColors() {
    const presetColors = [
        '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
        '#FFA500', '#800080', '#FFC0CB', '#A52A2A', '#808080', '#00FF7F', '#4B0082', '#FFD700',
        '#FF69B4', '#32CD32', '#1E90FF', '#FF4500', '#8A2BE2', '#20B2AA', '#DC143C', '#7FFF00'
    ];
    const container = document.getElementById('presetColors');
    container.innerHTML = '';
    presetColors.forEach(color => {
        const div = document.createElement('div');
        div.className = 'color-preset';
        div.style.backgroundColor = color;
        div.title = color;
        div.onclick = () => applyColor(color);
        container.appendChild(div);
    });
}
function populateFontList() {
    const fonts = [
        'Arial',
        'Helvetica',
        'Impact',
        'Comic Sans MS',
        'Courier New',
        'Georgia',
        'Palatino',
        'Garamond',
        'Bookman',
        'Trebuchet MS',
        'Arial Black',
        'Verdana',
        'Times New Roman',
        'Brush Script MT',
        'Lucida Handwriting',
        'Copperplate',
        'Papyrus',
        'Lobster',
        'Pacifico',
        'Oswald',
        'Montserrat',
        'Playfair Display',
        'Bebas Neue',
        'Anton'
    ];
    const container = document.getElementById('fontList');
    container.innerHTML = '';
    fonts.forEach(font => {
        const div = document.createElement('div');
        div.className = 'font-item';
        div.textContent = font;
        div.style.fontFamily = font;
        div.onclick = () => applyFont(font);
        container.appendChild(div);
    });
}
function applyColor(color) {
    if (!currentEditingLayer)
        return;
    currentEditingLayer.color = color;
    currentEditingLayer.rainbow = false;
    renderTextLayer(currentEditingLayer);
    showToast('Color applied ✓', 'success');
    closeAllMenus();
}
function applyCustomColor() {
    const input = document.getElementById('colorCodeInput');
    let color = input.value.trim();
    // Add # if missing
    if (!color.startsWith('#')) {
        color = '#' + color;
    }
    // Validate hex color
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
        showToast('Invalid color code! Use format: #FFFFFF', 'warning');
        return;
    }
    applyColor(color);
}
function applyRainbowMode(enabled) {
    if (!currentEditingLayer)
        return;
    currentEditingLayer.rainbow = enabled;
    if (!enabled) {
        // Use current color when disabling rainbow
        currentEditingLayer.color = document.getElementById('colorCodeInput').value || '#FFFFFF';
    }
    renderTextLayer(currentEditingLayer);
    showToast(enabled ? 'Rainbow mode enabled 🌈' : 'Rainbow mode disabled', 'success');
}
function applyFont(font) {
    if (!currentEditingLayer)
        return;
    currentEditingLayer.fontFamily = font;
    renderTextLayer(currentEditingLayer);
    showToast(`Font changed to ${font} ✓`, 'success');
    closeAllMenus();
}
function deleteCurrentTextLayer() {
    if (!currentEditingLayer)
        return;
    textLayers = textLayers.filter(l => l.id !== currentEditingLayer.id);
    const element = document.getElementById(currentEditingLayer.id);
    if (element)
        element.remove();
    showToast('Text layer deleted', 'success');
    closeAllMenus();
    currentEditingLayer = null;
}
function closeAllMenus() {
    document.getElementById('textContextMenu').style.display = 'none';
    document.getElementById('colorSubmenu').style.display = 'none';
    document.getElementById('fontSubmenu').style.display = 'none';
    document.removeEventListener('click', closeAllMenus);
}
function makeDraggableText(element, layer) {
    let isDragging = false;
    let startX, startY;
    let dragStartTime = 0;
    element.onpointerdown = (e) => {
        // Check if text is being edited
        const textContent = element.querySelector('.text-layer-content');
        if (textContent && textContent.contentEditable === 'true') {
            return; // Don't drag while editing
        }
        // Don't start drag on double-click
        if (e.detail === 2) {
            return;
        }
        isDragging = true;
        dragStartTime = Date.now();
        startX = e.clientX;
        startY = e.clientY;
        element.style.cursor = 'grabbing';
        // Add visual feedback
        if (textContent) {
            textContent.style.borderColor = 'rgba(13, 202, 240, 0.8)';
            textContent.style.borderWidth = '3px';
        }
        e.preventDefault();
        e.stopPropagation();
    };
    document.onpointermove = (e) => {
        if (!isDragging)
            return;
        const container = document.getElementById('textLayersContainer');
        const rect = container.getBoundingClientRect();
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        layer.x += (deltaX / rect.width) * 100;
        layer.y += (deltaY / rect.height) * 100;
        // Clamp values
        layer.x = Math.max(5, Math.min(95, layer.x));
        layer.y = Math.max(5, Math.min(95, layer.y));
        element.style.left = layer.x + '%';
        element.style.top = layer.y + '%';
        startX = e.clientX;
        startY = e.clientY;
    };
    document.onpointerup = (e) => {
        if (isDragging) {
            element.style.cursor = 'move';
            isDragging = false;
            // Reset border after drag
            const textContent = element.querySelector('.text-layer-content');
            if (textContent) {
                textContent.style.borderWidth = '2px';
            }
        }
    };
}
// Collage Settings Dropdown Toggle
document.addEventListener('DOMContentLoaded', () => {
    // Setup keyboard shortcuts for blemish tool
    document.addEventListener('keydown', handleBlemishKeys);
    // Setup drag & drop and paste
    setupDragDropPaste();
    // Disable right-click context menu on photo display areas
    const photoAreas = [
        document.getElementById('singleImageViewer'),
        document.getElementById('collage-tiles'),
        document.getElementById('collageCanvasContainer'),
        document.getElementById('uploadedPhotosPreview')
    ];
    photoAreas.forEach(area => {
        if (area) {
            area.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            });
        }
    });
    const settingsBtn = document.getElementById('collageSettingsBtn');
    const settingsMenu = document.getElementById('collageSettingsMenu');
    if (settingsBtn && settingsMenu) {
        // Toggle on hover
        settingsBtn.addEventListener('mouseenter', () => {
            settingsMenu.style.display = 'block';
        });
        // Keep menu open when hovering over it
        settingsMenu.addEventListener('mouseenter', () => {
            settingsMenu.style.display = 'block';
        });
        // Close when mouse leaves both button and menu
        settingsBtn.addEventListener('mouseleave', (e) => {
            setTimeout(() => {
                if (!settingsMenu.matches(':hover') && !settingsBtn.matches(':hover')) {
                    settingsMenu.style.display = 'none';
                }
            }, 100);
        });
        settingsMenu.addEventListener('mouseleave', () => {
            setTimeout(() => {
                if (!settingsBtn.matches(':hover')) {
                    settingsMenu.style.display = 'none';
                }
            }, 100);
        });
    }
    const toolbarColorPicker = document.getElementById('toolbarColorPicker');
    const toolbarColorCode = document.getElementById('toolbarColorCode');
    if (toolbarColorPicker && toolbarColorCode) {
        toolbarColorPicker.addEventListener('input', (e) => {
            toolbarColorCode.value = e.target.value;
        });
        toolbarColorCode.addEventListener('input', (e) => {
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                toolbarColorPicker.value = e.target.value;
            }
        });
    }
    // Restore cached images from localStorage
    restoreCachedImages();
    // Load history from localStorage
    loadCollageHistoryFromStorage();
});
function restoreCachedImages() {
    // Restore Collage images only (Edit Image removed)
    const cachedCollageData = localStorage.getItem(STORAGE_KEY_COLLAGE_IMAGES);
    if (cachedCollageData) {
        try {
            const imageDataArray = JSON.parse(cachedCollageData);
            collageImages = [];
            let loadedCount = 0;
            imageDataArray.forEach((dataURL, index) => {
                const img = new Image();
                img.onload = function () {
                    collageImages[index] = img;
                    loadedCount++;
                    if (loadedCount === imageDataArray.length) {
                        // All images loaded, update UI
                        document.getElementById('collagePrompt').style.display = 'none';
                        // Check if single image - show single viewer
                        if (imageDataArray.length === 1) {
                            showSingleImageViewer(collageImages[0]);
                            console.log('Restored 1 image in single viewer mode');
                            return;
                        }
                        // Multiple images - show collage mode
                        // Hide single image viewer when in collage mode
                        document.getElementById('singleImageViewer').style.display = 'none';
                        document.getElementById('uploadedPhotosPreview').style.display = 'flex';
                        // Hide canvas/tiles if they were showing
                        document.getElementById('collageCanvasContainer').style.display = 'none';
                        const tiles = document.getElementById('collage-tiles');
                        if (tiles)
                            tiles.style.display = 'none';
                        // Recreate preview thumbnails with proper structure
                        const previewContainer = document.getElementById('uploadedPhotosPreview');
                        previewContainer.innerHTML = '';
                        collageImages.forEach((img, i) => {
                            const col = document.createElement('div');
                            col.className = 'col-auto';
                            col.innerHTML = `
                                <div class="position-relative image-thumb-frame">
                                    <img src="${img.src}"
                                         class="img-thumbnail image-thumb-img">
                                </div>
                            `;
                            previewContainer.appendChild(col);
                        });
                        // Re-render layout templates
                        renderLayoutTemplates();
                        // Auto-select matching layout
                        const matchingLayout = layoutTemplates.find(l => l.maxPhotos === collageImages.length);
                        if (matchingLayout) {
                            selectLayout(matchingLayout.id);
                        }
                        console.log(`Restored ${collageImages.length} collage images from cache`);
                    }
                };
                img.src = dataURL;
            });
        }
        catch (e) {
            console.error('Failed to restore collage images:', e);
        }
    }
}
function clearCollage() {
    collageImages = [];
    imageOffsets = [];
    imagePositions = []; // Reset saved positions
    selectedLayout = null;
    // Clear text layers
    textLayers = [];
    document.getElementById('textLayersContainer').innerHTML = '';
    // Hide single image viewer
    const singleViewer = document.getElementById('singleImageViewer');
    singleViewer.style.display = 'none';
    // Clear canvas if exists
    if (singleImageCanvas) {
        singleImageCtx.clearRect(0, 0, singleImageCanvas.width, singleImageCanvas.height);
        singleImageCanvas.style.transform = 'scale(1)';
        if (zoomListener) {
            singleImageCanvas.removeEventListener('wheel', zoomListener);
        }
    }
    document.getElementById('collageCanvasContainer').style.display = 'none';
    document.getElementById('collage-tiles').style.display = 'none';
    document.getElementById('collagePrompt').style.display = 'block';
    document.getElementById('uploadedPhotosPreview').style.display = 'none';
    document.getElementById('uploadedPhotosPreview').innerHTML = '';
    document.getElementById('collageUpload').value = '';
    // Clear cache
    clearImageCache('collage');
    renderLayoutTemplates();
    showToast('Collage cleared', 'info');
}
async function saveCollage() {
    const tilesContainer = document.getElementById('collage-tiles');
    if (tilesContainer.style.display === 'none' || collageImages.length === 0) {
        showToast('Please create a collage first', 'warning');
        return;
    }
    try {
        // Get settings
        const gutter = parseInt(document.getElementById('collageGutter').value);
        const radius = parseInt(document.getElementById('collageRadius').value);
        const borderWidth = parseInt(document.getElementById('collageBorder').value);
        const borderColor = document.getElementById('collageBorderColor').value;
        const backgroundColor = document.getElementById('collageBackground').value;
        const layout = layoutTemplates.find(l => l.id === selectedLayout);
        // Create high-res canvas (1080x1080)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1080;
        canvas.height = 1080;
        // Fill background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, 1080, 1080);
        // Set high quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        // Calculate grid
        const padding = gutter * 1.5; // Scale gutter for 1080
        const availableW = 1080 - padding * 2;
        const availableH = 1080 - padding * 2;
        const cellW = availableW / layout.cols;
        const cellH = availableH / layout.rows;
        const gap = gutter * 1.5;
        // Draw each image
        for (let i = 0; i < Math.min(collageImages.length, layout.cells.length); i++) {
            const [col, row, colSpan, rowSpan] = layout.cells[i];
            const img = collageImages[i];
            const pos = imagePositions[i] || { x: 50, y: 50 };
            // Calculate position and size
            const x = padding + col * cellW + (col > 0 ? gap * col : 0);
            const y = padding + row * cellH + (row > 0 ? gap * row : 0);
            const w = cellW * colSpan - (colSpan > 1 ? gap : 0);
            const h = cellH * rowSpan - (rowSpan > 1 ? gap : 0);
            // Save context
            ctx.save();
            // Clip with rounded corners
            if (radius > 0) {
                const r = radius * 1.5;
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.lineTo(x + w - r, y);
                ctx.arcTo(x + w, y, x + w, y + r, r);
                ctx.lineTo(x + w, y + h - r);
                ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
                ctx.lineTo(x + r, y + h);
                ctx.arcTo(x, y + h, x, y + h - r, r);
                ctx.lineTo(x, y + r);
                ctx.arcTo(x, y, x + r, y, r);
                ctx.closePath();
                ctx.clip();
            }
            // Draw image with object-fit: cover logic
            const imgAspect = img.width / img.height;
            const targetAspect = w / h;
            let drawW, drawH, drawX, drawY;
            if (imgAspect > targetAspect) {
                // Image wider than target
                drawH = h;
                drawW = img.width * (h / img.height);
                drawX = x - (drawW - w) * (pos.x / 100);
                drawY = y;
            }
            else {
                // Image taller than target
                drawW = w;
                drawH = img.height * (w / img.width);
                drawX = x;
                drawY = y - (drawH - h) * (pos.y / 100);
            }
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            ctx.restore();
            // Draw border
            if (borderWidth > 0) {
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = borderWidth * 1.5;
                if (radius > 0) {
                    const r = radius * 1.5;
                    ctx.beginPath();
                    ctx.moveTo(x + r, y);
                    ctx.lineTo(x + w - r, y);
                    ctx.arcTo(x + w, y, x + w, y + r, r);
                    ctx.lineTo(x + w, y + h - r);
                    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
                    ctx.lineTo(x + r, y + h);
                    ctx.arcTo(x, y + h, x, y + h - r, r);
                    ctx.lineTo(x, y + r);
                    ctx.arcTo(x, y, x + r, y, r);
                    ctx.closePath();
                    ctx.stroke();
                }
                else {
                    ctx.strokeRect(x, y, w, h);
                }
            }
        }
        // Draw text layers
        for (const layer of textLayers) {
            const x = (layer.x / 100) * 1080;
            const y = (layer.y / 100) * 1080;
            ctx.font = `bold ${layer.fontSize * 1.5}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Text shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
            if (layer.rainbow) {
                // Rainbow text
                const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
                let offsetX = -ctx.measureText(layer.text).width / 2;
                for (let i = 0; i < layer.text.length; i++) {
                    ctx.fillStyle = colors[i % colors.length];
                    ctx.fillText(layer.text[i], x + offsetX, y);
                    offsetX += ctx.measureText(layer.text[i]).width;
                }
            }
            else {
                ctx.fillStyle = layer.color;
                ctx.fillText(layer.text, x, y);
            }
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
        // Convert to blob
        canvas.toBlob(async (blob) => {
            // 1. Download to user's computer
            const link = document.createElement('a');
            link.download = `collage-${Date.now()}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
            // 2. Save thumbnail to server
            const formData = new FormData();
            formData.append('image', blob, 'collage.png');
            formData.append('imageCount', collageImages.length);
            formData.append('layout', selectedLayout);
            // Include thumbnails of original images
            for (let i = 0; i < collageImages.length; i++) {
                formData.append('thumbnails', collageImages[i].src);
            }
            const response = await fetch('/image/api/save-collage', {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                const data = await response.json();
                // History is now managed via localStorage, no need to reload
                showToast('Collage saved successfully!', 'success');
            }
            else {
                showToast('Collage downloaded, but failed to save to history', 'warning');
            }
        }, 'image/png', 1.0);
    }
    catch (error) {
        console.error('Save error:', error);
        showToast('Failed to save collage: ' + error.message, 'danger');
    }
}
// OLD SERVER-BASED HISTORY FUNCTIONS (DEPRECATED - Now using localStorage)
/*
// View history collage - Display in main preview
async function viewHistoryCollage(collageId) {
    try {
        const url = `/image/api/collage-thumbnail/${collageId}`;
        
        // Create temporary image element to load the collage
        const img = new Image();
        img.onload = function() {
            // Clear current collage
            collageImages = [];
            imageOffsets = [];
            imagePositions = [];
            textLayers = [];
            document.getElementById('textLayersContainer').innerHTML = '';
            selectedLayout = null;
            
            // Hide collage tiles, show canvas container instead
            document.getElementById('collage-tiles').style.display = 'none';
            document.getElementById('collagePrompt').style.display = 'none';
            
            // Display the saved collage image directly
            const canvasContainer = document.getElementById('collageCanvasContainer');
            canvasContainer.style.display = 'block';
            canvasContainer.innerHTML =
                '<div class="image-history-viewer">' +
                    '<img src="' + url + '" class="image-history-viewer-img" alt="Saved Collage">' +
                '</div>';
            
            showToast('History collage loaded (view only)', 'info');
        };
        
        img.onerror = function() {
            showToast('Failed to load collage from history', 'danger');
        };
        
        img.src = url;
        
    } catch (error) {
        console.error('Failed to view history:', error);
        showToast('Error loading collage', 'danger');
    }
}

// Load collage history from server
async function loadCollageHistory() {
    try {
        const response = await fetch('/image/api/collage-history');
        const data = await response.json();
        
        const container = document.getElementById('collageHistory');
        
        if (!data.history || data.history.length === 0) {
            container.innerHTML = '<small class="text-muted text-center py-3">No saved collages</small>';
            return;
        }
        
        container.innerHTML = data.history.map(item => `
            <div class="history-item"
                 data-id="${item.id}"
                 data-image-collage-view="${item.id}"
                 data-image-collage-menu="${item.id}"
                 title="${item.date} - ${item.imageCount} photos">
                <img src="/image/api/collage-thumbnail/${item.id}" alt="Collage">
                <div class="history-item-date">${item.imageCount} photos</div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Failed to load history:', error);
    }
}

// Show context menu
function showContextMenu(event, id) {
    event.preventDefault();
    
    // Remove existing context menu
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();
    
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.innerHTML = `
        <div class="context-menu-item" data-image-collage-delete="${id}">
            <i class="bi bi-trash"></i>Delete
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

// Delete collage from history
async function deleteCollageFromHistory(id) {
    try {
        const response = await fetch(`/image/api/collage-delete/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadCollageHistory(); // Reload history
            showToast('Collage deleted', 'info');
        } else {
            showToast('Failed to delete collage', 'danger');
        }
    } catch (error) {
        console.error('Failed to delete:', error);
        showToast('Failed to delete collage', 'danger');
    }
}
*/
function bindImageTemplateActions() {
    const clickActions = {
        toggleTextLayer,
        toggleBlemishTool,
        enhanceImage,
        saveCollage,
        clearCollage,
        clearAllHistory,
        deleteCurrentTextLayer
    };
    const inputActions = {
        updateBlemishBrushSize,
        updateBlemishRadius,
        updateBlemishOpacity
    };
    document.addEventListener('click', (event) => {
        const actionEl = event.target.closest('[data-image-action]');
        if (actionEl) {
            const action = actionEl.dataset.imageAction;
            if (action === 'click-target') {
                const targetId = actionEl.dataset.imageTarget;
                if (targetId)
                    document.getElementById(targetId)?.click();
                return;
            }
            if (clickActions[action]) {
                clickActions[action]();
                return;
            }
        }
        const historyEditEl = event.target.closest('[data-image-history-edit]');
        if (historyEditEl) {
            loadHistoryForEdit(historyEditEl.dataset.imageHistoryEdit);
            return;
        }
        const historyDeleteEl = event.target.closest('[data-image-history-delete]');
        if (historyDeleteEl) {
            event.stopPropagation();
            deleteFromHistory(historyDeleteEl.dataset.imageHistoryDelete);
            return;
        }
        const layoutEl = event.target.closest('[data-image-layout-id]');
        if (layoutEl) {
            selectLayout(layoutEl.dataset.imageLayoutId);
            return;
        }
        const collageViewEl = event.target.closest('[data-image-collage-view]');
        if (collageViewEl) {
            viewHistoryCollage(collageViewEl.dataset.imageCollageView);
            return;
        }
        const collageDeleteEl = event.target.closest('[data-image-collage-delete]');
        if (collageDeleteEl) {
            event.stopPropagation();
            deleteCollageFromHistory(collageDeleteEl.dataset.imageCollageDelete);
        }
    });
    document.addEventListener('contextmenu', (event) => {
        const historyMenuEl = event.target.closest('[data-image-history-menu]');
        if (historyMenuEl) {
            showHistoryContextMenu(event, historyMenuEl.dataset.imageHistoryMenu);
            return;
        }
        const collageMenuEl = event.target.closest('[data-image-collage-menu]');
        if (collageMenuEl) {
            showContextMenu(event, collageMenuEl.dataset.imageCollageMenu);
        }
    });
    document.addEventListener('input', (event) => {
        const inputEl = event.target.closest('[data-image-input-action]');
        if (!inputEl)
            return;
        const action = inputEl.dataset.imageInputAction;
        if (inputActions[action])
            inputActions[action](inputEl.value);
    });
    document.addEventListener('change', (event) => {
        const changeEl = event.target.closest('[data-image-change-action]');
        if (!changeEl)
            return;
        if (changeEl.dataset.imageChangeAction === 'applyRainbowMode') {
            applyRainbowMode(changeEl.checked);
        }
    });
    document.addEventListener('mouseover', (event) => {
        const hoverEl = event.target.closest('[data-image-hover-in]');
        if (!hoverEl || hoverEl.contains(event.relatedTarget))
            return;
        if (hoverEl.dataset.imageHoverIn === 'showBlemishSettings')
            showBlemishSettings();
    });
    document.addEventListener('mouseout', (event) => {
        const hoverEl = event.target.closest('[data-image-hover-out]');
        if (!hoverEl || hoverEl.contains(event.relatedTarget))
            return;
        if (hoverEl.dataset.imageHoverOut === 'hideBlemishSettings')
            hideBlemishSettings();
    });
}
// Initialize layout templates on page load
document.addEventListener('DOMContentLoaded', function () {
    bindImageTemplateActions();
    renderLayoutTemplates();
    // History is now loaded via loadCollageHistoryFromStorage() in earlier DOMContentLoaded handler
    // Apply UI if collage is already loaded
    if (typeof applyUI === 'function') {
        applyUI();
    }
    // Bind locked drag to all images in collage-tiles
    document.querySelectorAll('#collage-tiles .tile > img').forEach(bindLockedDrag);
    // Keyboard shortcuts for collage
    document.addEventListener('keydown', function (e) {
        // Only work in collage tab
        const collageTab = document.getElementById('collage-panel');
        if (!collageTab || !collageTab.classList.contains('active'))
            return;
        // [ key - decrease gutter
        if (e.key === '[') {
            const gutterSlider = document.getElementById('collageGutter');
            const currentValue = parseInt(gutterSlider.value);
            if (currentValue > parseInt(gutterSlider.min)) {
                gutterSlider.value = currentValue - 1;
                document.getElementById('gutterValue2').textContent = gutterSlider.value;
                if (selectedLayout && collageImages.length > 0) {
                    createCollageWithLayout();
                }
            }
            e.preventDefault();
        }
        // ] key - increase gutter
        if (e.key === ']') {
            const gutterSlider = document.getElementById('collageGutter');
            const currentValue = parseInt(gutterSlider.value);
            if (currentValue < parseInt(gutterSlider.max)) {
                gutterSlider.value = currentValue + 1;
                document.getElementById('gutterValue2').textContent = gutterSlider.value;
                if (selectedLayout && collageImages.length > 0) {
                    createCollageWithLayout();
                }
            }
            e.preventDefault();
        }
        // T key - add text layer
        if (e.key === 't' || e.key === 'T') {
            toggleTextLayer();
            e.preventDefault();
        }
    });
});
