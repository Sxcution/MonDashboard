"use strict";
// Typed Image editor module: crop and enhance tools.
// Keeps behavior compatible while the monolith is split into smaller files.
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
        showToast('Chọn ảnh trước', 'warning');
        return;
    }
    // Only works in single image mode
    if (collageImages.length > 1) {
        showToast('Cắt ảnh chỉ dùng cho 1 ảnh', 'info');
        return;
    }
    cropToolActive = !cropToolActive;
    const btn = document.getElementById('cropToolBtn');
    if (cropToolActive) {
        btn.classList.add('active');
        btn.style.backgroundColor = '#0dcaf0';
        btn.style.color = 'white';
        showCropOverlay();
        showToast('Chỉnh vùng cắt rồi nhấn Enter để áp dụng, ESC để huỷ', 'info');
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
        showToast('Vùng cắt không hợp lệ', 'error');
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
        showToast('Đã cắt ảnh', 'success');
        toggleCropTool();
    };
    croppedImage.src = singleImageCanvas.toDataURL('image/png');
}
const UPSCALE_MODELS = [
    {
        id: 'upscayl-standard-4x',
        name: 'Upscayl Standard',
        description: 'Phù hợp với hầu hết các hình ảnh.'
    },
    {
        id: 'upscayl-lite-4x',
        name: 'Upscayl Lite',
        description: 'Phù hợp với hầu hết ảnh, xử lý nhanh hơn với hao hụt chất lượng tối thiểu.'
    },
    {
        id: 'high-fidelity-4x',
        name: 'High Fidelity',
        description: 'Dành cho mọi loại ảnh, tập trung chi tiết thực tế và bề mặt mượt.'
    },
    {
        id: 'remacri-4x',
        name: 'Remacri (Không thương mại)',
        description: 'Dành cho ảnh tự nhiên, tăng thêm độ sắc nét và chi tiết.'
    },
    {
        id: 'ultramix-balanced-4x',
        name: 'Ultramix (Không thương mại)',
        description: 'Dành cho ảnh tự nhiên với cân bằng giữa độ sắc nét và chi tiết.'
    },
    {
        id: 'ultrasharp-4x',
        name: 'Ultrasharp (Không thương mại)',
        description: 'Dành cho ảnh tự nhiên tập trung vào độ sắc nét.'
    },
    {
        id: 'digital-art-4x',
        name: 'Nghệ thuật Kỹ thuật số',
        description: 'Dành cho digital art và minh hoạ, không ưu tiên ảnh người thật.'
    }
];
let upscaleCompareOverlay = null;
let upscaleCompareResizeHandler = null;
function getUpscaleModel(modelId) {
    return UPSCALE_MODELS.find(model => model.id === modelId) || UPSCALE_MODELS[0];
}
function syncUpscaleModelSelection(modelId) {
    const model = getUpscaleModel(modelId);
    const input = document.getElementById('upscaleModel');
    const name = document.getElementById('upscaleSelectedModelName');
    const desc = document.getElementById('upscaleSelectedModelDesc');
    if (input)
        input.value = model.id;
    if (name)
        name.textContent = model.name;
    if (desc)
        desc.textContent = model.description;
    document.querySelectorAll('[data-upscale-model]').forEach(card => {
        card.classList.toggle('is-selected', card.dataset.upscaleModel === model.id);
    });
}
function openUpscaleModelDialog() {
    syncUpscaleModelSelection(document.getElementById('upscaleModel')?.value);
    document.getElementById('upscaleModelDialog')?.classList.add('show');
}
function closeUpscaleModelDialog() {
    document.getElementById('upscaleModelDialog')?.classList.remove('show');
}
function selectUpscaleModel(modelId) {
    syncUpscaleModelSelection(modelId);
    closeUpscaleModelDialog();
}
function setUpscaleComparePosition(value) {
    const overlay = upscaleCompareOverlay;
    if (!overlay)
        return;
    const numeric = typeof value === 'number' ? value : Number(value);
    const percent = Math.max(0, Math.min(100, Number.isFinite(numeric) ? numeric : 50));
    const after = overlay.querySelector('.upscale-compare-after');
    const divider = overlay.querySelector('.upscale-compare-divider');
    const handle = overlay.querySelector('.upscale-compare-handle');
    if (after)
        after.style.clipPath = `inset(0 0 0 ${percent}%)`;
    if (divider)
        divider.style.left = `${percent}%`;
    if (handle)
        handle.style.left = `${percent}%`;
}
function positionUpscaleCompareOverlay() {
    if (!upscaleCompareOverlay || !singleImageCanvas)
        return;
    const viewer = document.getElementById('singleImageViewer');
    if (!viewer)
        return;
    const viewerRect = viewer.getBoundingClientRect();
    const canvasRect = singleImageCanvas.getBoundingClientRect();
    upscaleCompareOverlay.style.left = `${canvasRect.left - viewerRect.left}px`;
    upscaleCompareOverlay.style.top = `${canvasRect.top - viewerRect.top}px`;
    upscaleCompareOverlay.style.width = `${canvasRect.width}px`;
    upscaleCompareOverlay.style.height = `${canvasRect.height}px`;
}
function hideUpscaleCompare() {
    if (upscaleCompareOverlay) {
        upscaleCompareOverlay.remove();
        upscaleCompareOverlay = null;
    }
    if (upscaleCompareResizeHandler) {
        window.removeEventListener('resize', upscaleCompareResizeHandler);
        upscaleCompareResizeHandler = null;
    }
}
function showUpscaleCompare(beforeDataUrl, afterDataUrl) {
    const viewer = document.getElementById('singleImageViewer');
    if (!viewer || !singleImageCanvas)
        return;
    hideUpscaleCompare();
    const overlay = document.createElement('div');
    overlay.id = 'upscaleCompareOverlay';
    overlay.className = 'upscale-compare-overlay';
    overlay.innerHTML = `
        <img src="${beforeDataUrl}" alt="Ảnh gốc">
        <div class="upscale-compare-after">
            <img src="${afterDataUrl}" alt="Ảnh đã làm nét">
        </div>
        <div class="upscale-compare-divider"></div>
        <div class="upscale-compare-handle"><i class="bi bi-caret-left-fill"></i><i class="bi bi-caret-right-fill"></i></div>
        <span class="upscale-compare-label before">Trước</span>
        <span class="upscale-compare-label after">Sau</span>
        <button type="button" class="upscale-compare-close" data-image-action="hideUpscaleCompare" title="Tắt so sánh">
            <i class="bi bi-x-lg"></i>
        </button>
        <input type="range" class="upscale-compare-range" min="0" max="100" value="50" aria-label="So sánh ảnh trước và sau">
    `;
    viewer.appendChild(overlay);
    upscaleCompareOverlay = overlay;
    const slider = overlay.querySelector('.upscale-compare-range');
    slider?.addEventListener('input', () => setUpscaleComparePosition(slider.value));
    upscaleCompareResizeHandler = () => positionUpscaleCompareOverlay();
    window.addEventListener('resize', upscaleCompareResizeHandler);
    requestAnimationFrame(() => {
        positionUpscaleCompareOverlay();
        setUpscaleComparePosition(50);
    });
}
function toggleUpscaleMenu() {
    if (collageImages.length === 0) {
        showToast('Chọn ảnh trước', 'warning');
        return;
    }
    if (collageImages.length > 1) {
        showToast('Làm Nét chỉ dùng cho 1 ảnh', 'info');
        return;
    }
    deactivateAllTools();
    document.getElementById('upscaleMenu')?.classList.toggle('show');
}
function cancelUpscaleMenu() {
    document.getElementById('upscaleMenu')?.classList.remove('show');
}
async function applyUpscale() {
    if (collageImages.length === 0) {
        showToast('Chọn ảnh trước', 'warning');
        return;
    }
    // Only works in single image mode
    if (collageImages.length > 1) {
        showToast('Làm Nét chỉ dùng cho 1 ảnh', 'info');
        return;
    }
    deactivateAllTools();
    cancelUpscaleMenu();
    const btn = document.getElementById('enhanceBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang xử lý...';
    try {
        // Save state before upscaling
        saveCanvasState();
        const originalDataUrl = singleImageCanvas.toDataURL('image/png');
        // Convert canvas to blob
        const blob = await imageCanvasToBlob(singleImageCanvas);
        // Create FormData
        const formData = new FormData();
        formData.append('image', blob, 'image.png');
        formData.append('scale', document.getElementById('upscaleScale')?.value || '2');
        formData.append('model', document.getElementById('upscaleModel')?.value || 'upscayl-standard-4x');
        formData.append('compression', '0');
        // Call Upscayl-backed API
        const enhancedBlob = window.ImageApi
            ? await window.ImageApi.upscaleImage(formData)
            : await fetch('/image/api/upscale_image', { method: 'POST', body: formData })
                .then(response => {
                if (!response.ok)
                    throw new Error('Làm Nét lỗi');
                return response.blob();
            });
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
            if (typeof resetObjectRemoveState === 'function') {
                resetObjectRemoveState();
            }
            // Save to cache
            const imageDataURLs = [singleImageCanvas.toDataURL('image/png')];
            saveImageToCache(imageDataURLs, 'collage');
            // Save new state for undo
            saveCanvasState();
            showUpscaleCompare(originalDataUrl, imageDataURLs[0]);
            // Clean up
            URL.revokeObjectURL(enhancedURL);
            showToast('Đã làm nét ảnh', 'success');
        };
        enhancedImg.onerror = function () {
            throw new Error('Không mở được ảnh đã xử lý');
        };
        enhancedImg.src = enhancedURL;
    }
    catch (error) {
        console.error('Upscale error:', error);
        showToast('Làm Nét lỗi: ' + (error instanceof Error ? error.message : String(error)), 'danger');
    }
    finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-stars me-1"></i>Làm Nét';
    }
}
