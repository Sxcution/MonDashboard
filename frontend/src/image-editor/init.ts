// Typed Image editor module: initialization and delegated actions.
// Keeps behavior compatible while the monolith is split into smaller files.

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
    
    const toolbarColorPicker = document.getElementById('toolbarColorPicker') as HTMLInputElement | null;
    const toolbarColorCode = document.getElementById('toolbarColorCode') as HTMLInputElement | null;
    
    if (toolbarColorPicker && toolbarColorCode) {
        toolbarColorPicker.addEventListener('input', (e) => {
            toolbarColorCode.value = (e.target as HTMLInputElement).value;
        });
        
        toolbarColorCode.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                toolbarColorPicker.value = value;
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
                img.onload = function() {
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
                        if (tiles) tiles.style.display = 'none';
                        
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
        } catch (e) {
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

function getCanvasFontFamily(fontFamily?: string): string {
    const fallback = (fontFamily || 'Georgia').replace(/"/g, '');
    return `"${fallback}", Georgia, serif`;
}

function drawCanvasTextLayer(ctx: CanvasRenderingContext2D, layer: ImageTextLayer, canvasSize: number): void {
    const x = (layer.x / 100) * canvasSize;
    const y = (layer.y / 100) * canvasSize;
    const fontSize = layer.fontSize * (canvasSize / 720);
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
    } else {
        ctx.fillStyle = layer.color;
        lines.forEach((line, lineIndex) => {
            ctx.fillText(line, x, startY + lineIndex * lineHeight);
        });
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
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
            } else {
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
                } else {
                    ctx.strokeRect(x, y, w, h);
                }
            }
        }
        
        // Draw text layers
        for (const layer of textLayers) {
            drawCanvasTextLayer(ctx, layer, 1080);
        }
        
        const blob = await imageCanvasToBlob(canvas);

        // 1. Download to user's computer
        const link = document.createElement('a');
        link.download = `collage-${Date.now()}.png`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        
        // 2. Save thumbnail to server
        const formData = new FormData();
        formData.append('image', blob, 'collage.png');
        formData.append('imageCount', String(collageImages.length));
        formData.append('layout', selectedLayout || '');
        
        // Include thumbnails of original images
        for (let i = 0; i < collageImages.length; i++) {
            formData.append('thumbnails', collageImages[i].src);
        }
        
        if (window.ImageApi) {
            await window.ImageApi.saveCollage(formData);
            // History is now managed via localStorage, no need to reload
            showToast('Collage saved successfully!', 'success');
            return;
        }

        const response = await fetch('/image/api/save-collage', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            await response.json();
            // History is now managed via localStorage, no need to reload
            showToast('Collage saved successfully!', 'success');
        } else {
            showToast('Collage downloaded, but failed to save to history', 'warning');
        }
        
    } catch (error) {
        console.error('Save error:', error);
        showToast('Failed to save collage: ' + (error instanceof Error ? error.message : String(error)), 'danger');
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
async function viewHistoryCollage(collageId?: string): Promise<void> {
    if (!collageId) return;
    try {
        const url = `/image/api/collage-thumbnail/${collageId}`;
        const img = new Image();
        img.onload = function() {
            collageImages = [];
            imageOffsets = [];
            imagePositions = [];
            textLayers = [];
            const textLayersContainer = document.getElementById('textLayersContainer');
            if (textLayersContainer) textLayersContainer.innerHTML = '';
            selectedLayout = null;

            const collageTiles = document.getElementById('collage-tiles');
            if (collageTiles) collageTiles.style.display = 'none';
            const collagePrompt = document.getElementById('collagePrompt');
            if (collagePrompt) collagePrompt.style.display = 'none';

            const canvasContainer = document.getElementById('collageCanvasContainer');
            if (canvasContainer) {
                canvasContainer.style.display = 'block';
                canvasContainer.innerHTML =
                    '<div class="image-history-viewer">' +
                        '<img src="' + url + '" class="image-history-viewer-img" alt="Saved Collage">' +
                    '</div>';
            }

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

async function loadCollageHistory(): Promise<void> {
    try {
        const response = window.ImageApi
            ? await window.ImageApi.collageHistory()
            : await fetch('/image/api/collage-history').then((res) => res.json());

        const container = document.getElementById('collageHistory');
        if (!container) return;

        if (!response.history || response.history.length === 0) {
            container.innerHTML = '<small class="text-muted text-center py-3">No saved collages</small>';
            return;
        }

        container.innerHTML = response.history.map((item: ImageCollageHistoryItem) => `
            <div class="history-item"
                 data-id="${item.id}"
                 data-image-collage-view="${item.id}"
                 data-image-collage-menu="${item.id}"
                 title="${item.date || ''} - ${item.imageCount} photos">
                <img src="/image/api/collage-thumbnail/${item.id}" alt="Collage">
                <div class="history-item-date">${item.imageCount} photos</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load history:', error);
    }
}

function showCollageContextMenu(event: MouseEvent, id?: string): void {
    if (!id) return;
    event.preventDefault();

    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();

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

    const closeMenu = (clickEvent: MouseEvent) => {
        if (!menu.contains(clickEvent.target as Node)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
}

async function deleteCollageFromHistory(id?: string): Promise<void> {
    if (!id) return;
    try {
        let responseOk = false;
        if (window.ImageApi) {
            await window.ImageApi.deleteCollage(id);
            responseOk = true;
        } else {
            const response = await fetch(`/image/api/collage-delete/${id}`, {
                method: 'DELETE'
            });
            responseOk = response.ok;
        }

        if (responseOk) {
            loadCollageHistory();
            showToast('Collage deleted', 'info');
        } else {
            showToast('Failed to delete collage', 'danger');
        }
    } catch (error) {
        console.error('Failed to delete:', error);
        showToast('Failed to delete collage', 'danger');
    }
}

function getEventElement(event: Event): Element | null {
    return event.target instanceof Element ? event.target : null;
}

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
        const target = getEventElement(event);
        if (!target) return;

        const actionEl = target.closest<HTMLElement>('[data-image-action]');
        if (actionEl) {
            const action = actionEl.dataset.imageAction;
            if (action === 'click-target') {
                const targetId = actionEl.dataset.imageTarget;
                if (targetId) document.getElementById(targetId)?.click();
                return;
            }
            if (clickActions[action]) {
                clickActions[action]();
                return;
            }
        }

        const historyEditEl = target.closest<HTMLElement>('[data-image-history-edit]');
        if (historyEditEl) {
            loadHistoryForEdit(historyEditEl.dataset.imageHistoryEdit);
            return;
        }

        const historyDeleteEl = target.closest<HTMLElement>('[data-image-history-delete]');
        if (historyDeleteEl) {
            event.stopPropagation();
            deleteFromHistory(historyDeleteEl.dataset.imageHistoryDelete);
            return;
        }

        const layoutEl = target.closest<HTMLElement>('[data-image-layout-id]');
        if (layoutEl) {
            selectLayout(layoutEl.dataset.imageLayoutId);
            return;
        }

        const collageViewEl = target.closest<HTMLElement>('[data-image-collage-view]');
        if (collageViewEl) {
            viewHistoryCollage(collageViewEl.dataset.imageCollageView);
            return;
        }

        const collageDeleteEl = target.closest<HTMLElement>('[data-image-collage-delete]');
        if (collageDeleteEl) {
            event.stopPropagation();
            deleteCollageFromHistory(collageDeleteEl.dataset.imageCollageDelete);
        }
    });

    document.addEventListener('contextmenu', (event) => {
        const target = getEventElement(event);
        if (!target) return;

        const historyMenuEl = target.closest<HTMLElement>('[data-image-history-menu]');
        if (historyMenuEl) {
            showHistoryContextMenu(event, historyMenuEl.dataset.imageHistoryMenu);
            return;
        }

        const collageMenuEl = target.closest<HTMLElement>('[data-image-collage-menu]');
        if (collageMenuEl) {
            showCollageContextMenu(event, collageMenuEl.dataset.imageCollageMenu);
        }
    });

    document.addEventListener('input', (event) => {
        const target = getEventElement(event);
        if (!target) return;
        const inputEl = target.closest<HTMLInputElement>('[data-image-input-action]');
        if (!inputEl) return;
        const action = inputEl.dataset.imageInputAction;
        if (inputActions[action]) inputActions[action](inputEl.value);
    });

    document.addEventListener('change', (event) => {
        const target = getEventElement(event);
        if (!target) return;
        const changeEl = target.closest<HTMLInputElement>('[data-image-change-action]');
        if (!changeEl) return;
        if (changeEl.dataset.imageChangeAction === 'applyRainbowMode') {
            applyRainbowMode(changeEl.checked);
        }
    });

    document.addEventListener('mouseover', (event) => {
        const target = getEventElement(event);
        if (!target) return;
        const hoverEl = target.closest<HTMLElement>('[data-image-hover-in]');
        if (!hoverEl || hoverEl.contains(event.relatedTarget as Node | null)) return;
        if (hoverEl.dataset.imageHoverIn === 'showBlemishSettings') showBlemishSettings();
    });

    document.addEventListener('mouseout', (event) => {
        const target = getEventElement(event);
        if (!target) return;
        const hoverEl = target.closest<HTMLElement>('[data-image-hover-out]');
        if (!hoverEl || hoverEl.contains(event.relatedTarget as Node | null)) return;
        if (hoverEl.dataset.imageHoverOut === 'hideBlemishSettings') hideBlemishSettings();
    });
}

// Initialize layout templates on page load
document.addEventListener('DOMContentLoaded', function() {
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
    document.addEventListener('keydown', function(e) {
        // Only work in collage tab
        const collageTab = document.getElementById('collage-panel');
        if (!collageTab || !collageTab.classList.contains('active')) return;
        
        // [ key - decrease gutter
        if (e.key === '[') {
            const gutterSlider = document.getElementById('collageGutter') as HTMLInputElement | null;
            if (!gutterSlider) return;
            const currentValue = parseInt(gutterSlider.value || '0');
            if (currentValue > parseInt(gutterSlider.min)) {
                gutterSlider.value = String(currentValue - 1);
                const gutterValue = document.getElementById('gutterValue2');
                if (gutterValue) gutterValue.textContent = gutterSlider.value;
                if (selectedLayout && collageImages.length > 0) {
                    createCollageWithLayout();
                }
            }
            e.preventDefault();
        }
        
        // ] key - increase gutter
        if (e.key === ']') {
            const gutterSlider = document.getElementById('collageGutter') as HTMLInputElement | null;
            if (!gutterSlider) return;
            const currentValue = parseInt(gutterSlider.value || '0');
            if (currentValue < parseInt(gutterSlider.max)) {
                gutterSlider.value = String(currentValue + 1);
                const gutterValue = document.getElementById('gutterValue2');
                if (gutterValue) gutterValue.textContent = gutterSlider.value;
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
