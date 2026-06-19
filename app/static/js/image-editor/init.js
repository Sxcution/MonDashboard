"use strict";
// Typed Image editor module: initialization and delegated actions.
// Keeps behavior compatible while the monolith is split into smaller files.
let imageEditorCoreInitialized = false;
let imageEditorActionsInitialized = false;
let imageDashboardLifecycleRegistered = false;
function hasImageEditorDom() {
    return !!document.getElementById('collageCanvas') || !!document.getElementById('singleImageCanvas');
}
function closeImageFloatingUi() {
    document.querySelectorAll('.context-menu').forEach(menu => menu.remove());
    ['textContextMenu', 'colorSubmenu', 'fontSubmenu', 'upscaleMenu', 'upscaleModelDialog', 'blemishSettingsMenu', 'warpSettingsMenu'].forEach(id => {
        const el = document.getElementById(id);
        if (!el)
            return;
        if (id === 'upscaleModelDialog') {
            el.setAttribute('aria-hidden', 'true');
            el.classList.remove('is-open');
            return;
        }
        el.style.display = 'none';
    });
}
function registerImageDashboardLifecycle() {
    if (imageDashboardLifecycleRegistered)
        return;
    imageDashboardLifecycleRegistered = true;
    window.registerDashboardTabLifecycle?.('image', {
        pause() {
            closeImageFloatingUi();
        },
        resume() {
            requestAnimationFrame(() => {
                if (typeof applyUI === 'function')
                    applyUI();
                if (typeof renderLayoutTemplates === 'function')
                    renderLayoutTemplates();
            });
        }
    });
}
function initImageEditorCore() {
    if (imageEditorCoreInitialized || !hasImageEditorDom())
        return;
    imageEditorCoreInitialized = true;
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
            area.addEventListener('mousedown', () => {
                if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                    document.activeElement.blur();
                }
            });
        }
    });
    // Blur any active input immediately on mousedown in the capture phase (before stopPropagation/preventDefault)
    document.addEventListener('mousedown', (e) => {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            if (e.target !== document.activeElement) {
                document.activeElement.blur();
            }
        }
    }, { capture: true, passive: true });
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
            const value = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                toolbarColorPicker.value = value;
            }
        });
    }
    // Restore cached images from localStorage
    restoreCachedImages();
    // Load history from localStorage
    loadCollageHistoryFromStorage();
    // Initialize Thư Mục Ảnh panel
    if (typeof initImageFolderPanel === 'function') {
        initImageFolderPanel();
    }
    registerImageDashboardLifecycle();
}
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
    showToast('Đã xoá ảnh hiện tại', 'info');
}
function getCanvasFontFamily(fontFamily) {
    const fallback = (fontFamily || 'Georgia').replace(/"/g, '');
    return `"${fallback}", Georgia, serif`;
}
function drawTextLayerAt(ctx, layer, x, y, fontSize) {
    const lineHeight = fontSize * 1.25;
    const lines = layer.text.split(/\r?\n/);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    ctx.font = `bold ${fontSize}px ${getCanvasFontFamily(layer.fontFamily)}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    if (layer.rainbow) {
        const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
        let colorIndex = 0;
        lines.forEach((line, lineIndex) => {
            const lineY = startY + lineIndex * lineHeight;
            let offsetX = -ctx.measureText(line).width / 2;
            for (const char of line) {
                ctx.fillStyle = colors[colorIndex % colors.length];
                ctx.fillText(char, x + offsetX, lineY);
                offsetX += ctx.measureText(char).width;
                colorIndex++;
            }
        });
    }
    else {
        const fill = String(layer.fill || layer.color || '#ffffff');
        const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width), fontSize * 2);
        ctx.fillStyle = collageCreateCanvasFill(ctx, fill, x - textWidth / 2, startY - lineHeight / 2, textWidth, lineHeight * lines.length);
        lines.forEach((line, lineIndex) => {
            ctx.fillText(line, x, startY + lineIndex * lineHeight);
        });
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}
function drawCanvasTextLayer(ctx, layer, canvasWidth, canvasHeight = canvasWidth) {
    const x = (layer.x / 100) * canvasWidth;
    const y = (layer.y / 100) * canvasHeight;
    const fontSize = layer.fontSize * (Math.min(canvasWidth, canvasHeight) / 720);
    drawTextLayerAt(ctx, layer, x, y, fontSize);
}
function drawSingleImageTextLayer(ctx, layer) {
    if (!singleImageCanvas)
        return;
    const canvasRect = singleImageCanvas.getBoundingClientRect();
    const layerElement = document.getElementById(layer.id);
    const scaleX = singleImageCanvas.width / canvasRect.width;
    const scaleY = singleImageCanvas.height / canvasRect.height;
    let x = (layer.x / 100) * singleImageCanvas.width;
    let y = (layer.y / 100) * singleImageCanvas.height;
    if (layerElement && canvasRect.width > 0 && canvasRect.height > 0) {
        const layerRect = layerElement.getBoundingClientRect();
        x = (layerRect.left + layerRect.width / 2 - canvasRect.left) * scaleX;
        y = (layerRect.top + layerRect.height / 2 - canvasRect.top) * scaleY;
    }
    drawTextLayerAt(ctx, layer, x, y, layer.fontSize * Math.min(scaleX, scaleY));
}
async function generateActiveCanvas() {
    const tilesContainer = document.getElementById('collage-tiles');
    const singleViewer = document.getElementById('singleImageViewer');
    const isSingleImageMode = Boolean(singleViewer &&
        getComputedStyle(singleViewer).display !== 'none' &&
        singleImageCanvas &&
        singleImageCanvas.width > 0 &&
        singleImageCanvas.height > 0 &&
        collageImages.length === 1);
    const isCollageMode = Boolean(tilesContainer &&
        getComputedStyle(tilesContainer).display !== 'none' &&
        collageImages.length > 0);
    if (!isSingleImageMode && !isCollageMode) {
        return null;
    }
    if (isSingleImageMode) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = singleImageCanvas.width;
        canvas.height = singleImageCanvas.height;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(singleImageCanvas, 0, 0);
        for (const layer of textLayers) {
            drawSingleImageTextLayer(ctx, layer);
        }
        return canvas;
    }
    else {
        const gutterVal = document.getElementById('collageGutter');
        const radiusVal = document.getElementById('collageRadius');
        const borderVal = document.getElementById('collageBorder');
        const gutter = gutterVal ? parseInt(gutterVal.value) : 0;
        const radius = radiusVal ? parseInt(radiusVal.value) : 0;
        const borderWidth = borderVal ? parseInt(borderVal.value) : 0;
        const borderColor = collageGetFill('border');
        const backgroundColor = collageGetFill('background');
        const aspectVal = document.getElementById('collageAspect');
        const aspect = (aspectVal ? aspectVal.value : '1:1') || '1:1';
        const [arW, arH] = aspect.split(':').map(Number);
        const layout = layoutTemplates.find(l => l.id === selectedLayout);
        if (!layout)
            return null;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const longSide = 1080;
        canvas.width = arW >= arH ? longSide : Math.round(longSide * (arW / arH));
        canvas.height = arH >= arW ? longSide : Math.round(longSide * (arH / arW));
        ctx.fillStyle = collageCreateCanvasFill(ctx, backgroundColor, 0, 0, canvas.width, canvas.height);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const padding = gutter * 1.5;
        const availableW = canvas.width - padding * 2;
        const availableH = canvas.height - padding * 2;
        const cellW = availableW / layout.cols;
        const cellH = availableH / layout.rows;
        const gap = gutter * 1.5;
        for (let i = 0; i < Math.min(collageImages.length, layout.cells.length); i++) {
            const [col, row, colSpan, rowSpan] = layout.cells[i];
            const img = collageImages[i];
            const pos = imagePositions[i] || { x: 50, y: 50 };
            const x = padding + col * cellW + (col > 0 ? gap * col : 0);
            const y = padding + row * cellH + (row > 0 ? gap * row : 0);
            const w = cellW * colSpan - (colSpan > 1 ? gap : 0);
            const h = cellH * rowSpan - (rowSpan > 1 ? gap : 0);
            ctx.save();
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
            const imgAspect = img.width / img.height;
            const targetAspect = w / h;
            let drawW, drawH, drawX, drawY;
            if (imgAspect > targetAspect) {
                drawH = h;
                drawW = img.width * (h / img.height);
                drawX = x - (drawW - w) * (pos.x / 100);
                drawY = y;
            }
            else {
                drawW = w;
                drawH = img.height * (w / img.width);
                drawX = x;
                drawY = y - (drawH - h) * (pos.y / 100);
            }
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            ctx.restore();
            if (borderWidth > 0) {
                ctx.strokeStyle = collageCreateCanvasFill(ctx, borderColor, 0, 0, canvas.width, canvas.height);
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
        for (const layer of textLayers) {
            drawCanvasTextLayer(ctx, layer, canvas.width, canvas.height);
        }
        return canvas;
    }
}
async function saveCollage() {
    try {
        const canvas = await generateActiveCanvas();
        if (!canvas) {
            showToast('Tạo ảnh trước khi lưu', 'warning');
            return;
        }
        const tilesContainer = document.getElementById('collage-tiles');
        const singleViewer = document.getElementById('singleImageViewer');
        const isSingleImageMode = Boolean(singleViewer &&
            getComputedStyle(singleViewer).display !== 'none' &&
            singleImageCanvas &&
            singleImageCanvas.width > 0 &&
            singleImageCanvas.height > 0 &&
            collageImages.length === 1);
        // Determine target PC folder if any
        let targetFolder = null;
        let filename = null;
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${day}${month}${year}`;
        const currentOpenedFilePath = window.currentOpenedFilePath;
        if (currentOpenedFilePath) {
            // Get parent folder of current opened file
            const lastSlash = Math.max(currentOpenedFilePath.lastIndexOf('\\'), currentOpenedFilePath.lastIndexOf('/'));
            if (lastSlash > 0) {
                targetFolder = currentOpenedFilePath.substring(0, lastSlash);
                filename = `Image${dateStr}.png`;
            }
        }
        else {
            // Fallback to currently browsed folder in explorer panel
            const currentFolderOpened = localStorage.getItem('current_image_folder_opened');
            if (currentFolderOpened) {
                targetFolder = currentFolderOpened;
                filename = `Image${dateStr}.png`;
            }
        }
        const blob = await imageCanvasToBlob(canvas);
        const formData = new FormData();
        formData.append('image', blob, isSingleImageMode ? 'image.png' : 'collage.png');
        formData.append('imageCount', String(collageImages.length));
        formData.append('layout', isSingleImageMode ? 'single' : (selectedLayout || ''));
        if (targetFolder) {
            formData.append('targetFolder', targetFolder);
            formData.append('filename', filename || '');
        }
        // Include thumbnails
        if (isSingleImageMode) {
            formData.append('thumbnails', canvas.toDataURL('image/png'));
        }
        else {
            for (let i = 0; i < collageImages.length; i++) {
                formData.append('thumbnails', collageImages[i].src);
            }
        }
        let savedOnPc = false;
        let savedPath = '';
        if (window.ImageApi) {
            const res = await window.ImageApi.saveCollage(formData);
            savedOnPc = res.saved_on_pc;
            savedPath = res.saved_path;
        }
        else {
            const response = await fetch('/image/api/save-collage', {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                const data = await response.json();
                savedOnPc = data.saved_on_pc;
                savedPath = data.saved_path;
            }
        }
        if (savedOnPc) {
            // Show toast stating it was saved locally on PC, don't trigger download
            const lastSlash = Math.max(savedPath.lastIndexOf('\\'), savedPath.lastIndexOf('/'));
            const folderOnly = lastSlash > 0 ? savedPath.substring(0, lastSlash) : savedPath;
            showToast(`Đã lưu trực tiếp vào thư mục PC: ${folderOnly}`, 'success');
            // Reload the folder to show new file if current folder matches targetFolder
            const currentFolderOpened = localStorage.getItem('current_image_folder_opened');
            if (currentFolderOpened && targetFolder && currentFolderOpened.replace(/[\\/]+$/, '').toLowerCase() === targetFolder.replace(/[\\/]+$/, '').toLowerCase()) {
                if (typeof window.fetchAndRenderSubfolders === 'function') {
                    window.fetchAndRenderSubfolders(currentFolderOpened);
                }
                else if (typeof fetchAndRenderSubfolders === 'function') {
                    fetchAndRenderSubfolders(currentFolderOpened);
                }
            }
        }
        else {
            // Trigger browser download default
            const link = document.createElement('a');
            link.download = isSingleImageMode ? `image-${Date.now()}.png` : `collage-${Date.now()}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
            showToast('Đã tải ảnh về', 'success');
        }
    }
    catch (error) {
        console.error('Save error:', error);
        showToast('Lưu ảnh lỗi: ' + (error instanceof Error ? error.message : String(error)), 'danger');
    }
}
async function copyCanvasToClipboard() {
    try {
        const canvas = await generateActiveCanvas();
        if (!canvas) {
            showToast('Tạo ảnh trước khi copy', 'warning');
            return;
        }
        canvas.toBlob(async (blob) => {
            if (!blob) {
                showToast('Không thể tạo dữ liệu ảnh để copy', 'danger');
                return;
            }
            try {
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                showToast('Đã copy ảnh vào clipboard', 'success');
            }
            catch (err) {
                console.error('Clipboard write error:', err);
                showToast('Trình duyệt không hỗ trợ copy ảnh trực tiếp', 'warning');
            }
        }, 'image/png');
    }
    catch (e) {
        console.error('Copy error:', e);
        showToast('Lỗi khi copy ảnh: ' + e.message, 'danger');
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
// Legacy server-backed collage history compatibility. Current history is localStorage-based,
// but these handlers keep older DOM/history entries from becoming dead clicks.
async function viewHistoryCollage(collageId) {
    if (!collageId)
        return;
    try {
        const url = `/image/api/collage-thumbnail/${collageId}`;
        const img = new Image();
        img.onload = function () {
            collageImages = [];
            imageOffsets = [];
            imagePositions = [];
            textLayers = [];
            const textLayersContainer = document.getElementById('textLayersContainer');
            if (textLayersContainer)
                textLayersContainer.innerHTML = '';
            selectedLayout = null;
            const collageTiles = document.getElementById('collage-tiles');
            if (collageTiles)
                collageTiles.style.display = 'none';
            const collagePrompt = document.getElementById('collagePrompt');
            if (collagePrompt)
                collagePrompt.style.display = 'none';
            const canvasContainer = document.getElementById('collageCanvasContainer');
            if (canvasContainer) {
                canvasContainer.style.display = 'block';
                canvasContainer.innerHTML =
                    '<div class="image-history-viewer">' +
                        '<img src="' + url + '" class="image-history-viewer-img" alt="Ảnh đã lưu">' +
                        '</div>';
            }
            showToast('Đã mở ảnh trong lịch sử', 'info');
        };
        img.onerror = function () {
            showToast('Không tải được ảnh trong lịch sử', 'danger');
        };
        img.src = url;
    }
    catch (error) {
        console.error('Không mở được lịch sử:', error);
        showToast('Lỗi khi tải ảnh', 'danger');
    }
}
async function loadCollageHistory() {
    try {
        const response = window.ImageApi
            ? await window.ImageApi.collageHistory()
            : await fetch('/image/api/collage-history').then((res) => res.json());
        const container = document.getElementById('collageHistory');
        if (!container)
            return;
        if (!response.history || response.history.length === 0) {
            container.innerHTML = '<small class="text-muted text-center py-3">Chưa có ảnh đã lưu</small>';
            return;
        }
        container.innerHTML = response.history.map((item) => `
            <div class="history-item"
                 data-id="${item.id}"
                 data-image-collage-view="${item.id}"
                 data-image-collage-menu="${item.id}"
                 title="${item.date || ''} - ${item.imageCount} ảnh">
                <img src="/image/api/collage-thumbnail/${item.id}" alt="Ảnh đã lưu">
                <div class="history-item-date">${item.imageCount} ảnh</div>
            </div>
        `).join('');
    }
    catch (error) {
        console.error('Không tải được lịch sử:', error);
    }
}
function showCollageContextMenu(event, id) {
    if (!id)
        return;
    event.preventDefault();
    if (typeof window.hideAllContextMenus === 'function') {
        window.hideAllContextMenus();
    }
    const existing = document.querySelector('.context-menu');
    if (existing)
        existing.remove();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.innerHTML = `
        <div class="context-menu-item" data-image-collage-delete="${id}">
            <i class="bi bi-trash"></i>Xoá
        </div>
    `;
    document.body.appendChild(menu);
    const closeMenu = (clickEvent) => {
        if (!menu.contains(clickEvent.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
}
async function deleteCollageFromHistory(id) {
    if (!id)
        return;
    try {
        let responseOk = false;
        if (window.ImageApi) {
            await window.ImageApi.deleteCollage(id);
            responseOk = true;
        }
        else {
            const response = await fetch(`/image/api/collage-delete/${id}`, {
                method: 'DELETE'
            });
            responseOk = response.ok;
        }
        if (responseOk) {
            loadCollageHistory();
            showToast('Đã xoá ảnh', 'info');
        }
        else {
            showToast('Xoá ảnh lỗi', 'danger');
        }
    }
    catch (error) {
        console.error('Không xoá được lịch sử:', error);
        showToast('Xoá ảnh lỗi', 'danger');
    }
}
function getEventElement(event) {
    return event.target instanceof Element ? event.target : null;
}
function bindImageTemplateActions() {
    const clickActions = {
        toggleTextLayer,
        toggleBlemishTool,
        toggleUpscaleMenu,
        applyUpscale,
        cancelUpscaleMenu,
        openUpscaleModelDialog,
        closeUpscaleModelDialog,
        hideUpscaleCompare,
        saveCollage,
        clearCollage,
        clearAllHistory,
        deleteCurrentTextLayer,
        removeWatermark,
        copyCanvasToClipboard,
        toggleWarpTool,
        applyWarpTool,
        cancelWarpTool,
        resetWarpPreview
    };
    const inputActions = {
        updateBlemishBrushSize,
        updateBlemishRadius,
        updateBlemishOpacity,
        updateWarpBrushSize,
        updateWarpStrength,
        updateWarpGridSize
    };
    document.addEventListener('click', (event) => {
        const target = getEventElement(event);
        if (!target)
            return;
        const actionEl = target.closest('[data-image-action]');
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
        const upscaleModelEl = target.closest('[data-upscale-model]');
        if (upscaleModelEl) {
            selectUpscaleModel(upscaleModelEl.dataset.upscaleModel);
            return;
        }
        const historyEditEl = target.closest('[data-image-history-edit]');
        if (historyEditEl) {
            loadHistoryForEdit(historyEditEl.dataset.imageHistoryEdit);
            return;
        }
        const historyDeleteEl = target.closest('[data-image-history-delete]');
        if (historyDeleteEl) {
            event.stopPropagation();
            deleteFromHistory(historyDeleteEl.dataset.imageHistoryDelete);
            return;
        }
        const layoutEl = target.closest('[data-image-layout-id]');
        if (layoutEl) {
            selectLayout(layoutEl.dataset.imageLayoutId);
            return;
        }
        const collageViewEl = target.closest('[data-image-collage-view]');
        if (collageViewEl) {
            viewHistoryCollage(collageViewEl.dataset.imageCollageView);
            return;
        }
        const collageDeleteEl = target.closest('[data-image-collage-delete]');
        if (collageDeleteEl) {
            event.stopPropagation();
            deleteCollageFromHistory(collageDeleteEl.dataset.imageCollageDelete);
        }
    });
    document.addEventListener('contextmenu', (event) => {
        const target = getEventElement(event);
        if (!target)
            return;
        const historyMenuEl = target.closest('[data-image-history-menu]');
        if (historyMenuEl) {
            showHistoryContextMenu(event, historyMenuEl.dataset.imageHistoryMenu);
            return;
        }
        const collageMenuEl = target.closest('[data-image-collage-menu]');
        if (collageMenuEl) {
            showCollageContextMenu(event, collageMenuEl.dataset.imageCollageMenu);
        }
    });
    document.addEventListener('input', (event) => {
        const target = getEventElement(event);
        if (!target)
            return;
        const inputEl = target.closest('[data-image-input-action]');
        if (!inputEl)
            return;
        const action = inputEl.dataset.imageInputAction;
        if (inputActions[action])
            inputActions[action](inputEl.value);
    });
    document.addEventListener('change', (event) => {
        const target = getEventElement(event);
        if (!target)
            return;
        const changeEl = target.closest('[data-image-change-action]');
        if (!changeEl)
            return;
        if (changeEl.dataset.imageChangeAction === 'applyRainbowMode') {
            applyRainbowMode(changeEl.checked);
        }
    });
    document.addEventListener('mouseover', (event) => {
        const target = getEventElement(event);
        if (!target)
            return;
        const hoverEl = target.closest('[data-image-hover-in]');
        if (!hoverEl || hoverEl.contains(event.relatedTarget))
            return;
        if (hoverEl.dataset.imageHoverIn === 'showBlemishSettings')
            showBlemishSettings();
        if (hoverEl.dataset.imageHoverIn === 'showWarpSettings')
            showWarpSettings();
    });
    document.addEventListener('mouseout', (event) => {
        const target = getEventElement(event);
        if (!target)
            return;
        const hoverEl = target.closest('[data-image-hover-out]');
        if (!hoverEl || hoverEl.contains(event.relatedTarget))
            return;
        if (hoverEl.dataset.imageHoverOut === 'hideBlemishSettings')
            hideBlemishSettings();
        if (hoverEl.dataset.imageHoverOut === 'hideWarpSettings')
            hideWarpSettings();
    });
}
// Initialize layout templates on page load
function initImageEditorActions() {
    if (imageEditorActionsInitialized || !hasImageEditorDom())
        return;
    imageEditorActionsInitialized = true;
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
            if (!gutterSlider)
                return;
            const currentValue = parseInt(gutterSlider.value || '0');
            if (currentValue > parseInt(gutterSlider.min)) {
                gutterSlider.value = String(currentValue - 1);
                const gutterValue = document.getElementById('gutterValue2');
                if (gutterValue)
                    gutterValue.textContent = gutterSlider.value;
                if (selectedLayout && collageImages.length > 0) {
                    createCollageWithLayout();
                }
            }
            e.preventDefault();
        }
        // ] key - increase gutter
        if (e.key === ']') {
            const gutterSlider = document.getElementById('collageGutter');
            if (!gutterSlider)
                return;
            const currentValue = parseInt(gutterSlider.value || '0');
            if (currentValue < parseInt(gutterSlider.max)) {
                gutterSlider.value = String(currentValue + 1);
                const gutterValue = document.getElementById('gutterValue2');
                if (gutterValue)
                    gutterValue.textContent = gutterSlider.value;
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
    registerImageDashboardLifecycle();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initImageEditorCore, { once: true });
    document.addEventListener('DOMContentLoaded', initImageEditorActions, { once: true });
}
else {
    initImageEditorCore();
    initImageEditorActions();
}
