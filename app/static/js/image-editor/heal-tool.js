"use strict";
// Typed Image editor module: AI object removal brush.
// Uses a white mask + Simple LaMa backend instead of legacy OpenCV inpainting.
let blemishToolActive = false;
let blemishBrushSize = 15;
let blemishMaskOpacity = 0.3;
let isProcessingHeal = false;
let hasDrawnMask = false;
let isHealing = false;
let blemishMaskCanvas = null;
let blemishMaskCtx = null;
let originalImageForBlemish = null;
let blemishSettingsTimeout = null;
let objectRemoveBrushCursor = null;
function imageCanvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob)
                resolve(blob);
            else
                reject(new Error('Không xuất được ảnh từ canvas'));
        }, 'image/png');
    });
}
function getImageErrorMessage(error) {
    if (!(error instanceof Error))
        return String(error);
    try {
        const parsed = JSON.parse(error.message);
        return parsed.install_hint || parsed.error || parsed.details || error.message;
    }
    catch {
        return error.message;
    }
}
function showBlemishSettings() {
    if (blemishSettingsTimeout)
        clearTimeout(blemishSettingsTimeout);
    const menu = document.getElementById('blemishSettingsMenu');
    if (menu)
        menu.style.display = 'block';
}
function hideBlemishSettings() {
    blemishSettingsTimeout = window.setTimeout(() => {
        const menu = document.getElementById('blemishSettingsMenu');
        if (menu)
            menu.style.display = 'none';
    }, 300);
}
function updateBlemishBrushSize(value) {
    blemishBrushSize = parseInt(String(value), 10);
    const label = document.getElementById('blemishBrushValue');
    if (label)
        label.textContent = String(value);
    updateObjectRemoveCursorSize();
}
function updateBlemishRadius(_value) {
    // Kept for compatibility with older generated bundles/templates.
}
function updateBlemishOpacity(value) {
    blemishMaskOpacity = parseInt(String(value), 10) / 100;
    const label = document.getElementById('blemishOpacityValue');
    if (label)
        label.textContent = String(value);
}
function resetObjectRemoveMask() {
    if (!blemishMaskCanvas || !blemishMaskCtx)
        return;
    blemishMaskCtx.fillStyle = 'black';
    blemishMaskCtx.fillRect(0, 0, blemishMaskCanvas.width, blemishMaskCanvas.height);
    hasDrawnMask = false;
}
function resetObjectRemoveState() {
    originalImageForBlemish = null;
    isHealing = false;
    isProcessingHeal = false;
    hasDrawnMask = false;
    if (blemishMaskCanvas && blemishMaskCtx && singleImageCanvas) {
        blemishMaskCanvas.width = singleImageCanvas.width;
        blemishMaskCanvas.height = singleImageCanvas.height;
        resetObjectRemoveMask();
    }
}
function restoreObjectRemoveBaseImage() {
    if (!originalImageForBlemish || !singleImageCtx || !singleImageCanvas)
        return;
    if (originalImageForBlemish.width !== singleImageCanvas.width ||
        originalImageForBlemish.height !== singleImageCanvas.height) {
        resetObjectRemoveState();
        return;
    }
    singleImageCtx.putImageData(originalImageForBlemish, 0, 0);
}
function ensureObjectRemoveMask() {
    if (!singleImageCanvas)
        return;
    if (!blemishMaskCanvas) {
        blemishMaskCanvas = document.createElement('canvas');
        blemishMaskCtx = blemishMaskCanvas.getContext('2d');
    }
    if (!blemishMaskCtx)
        return;
    if (blemishMaskCanvas.width !== singleImageCanvas.width || blemishMaskCanvas.height !== singleImageCanvas.height) {
        blemishMaskCanvas.width = singleImageCanvas.width;
        blemishMaskCanvas.height = singleImageCanvas.height;
        resetObjectRemoveMask();
    }
}
function ensureObjectRemoveCursor() {
    if (!objectRemoveBrushCursor) {
        objectRemoveBrushCursor = document.createElement('div');
        objectRemoveBrushCursor.className = 'object-remove-brush-cursor';
        document.body.appendChild(objectRemoveBrushCursor);
    }
    updateObjectRemoveCursorSize();
    return objectRemoveBrushCursor;
}
function updateObjectRemoveCursorSize() {
    if (!objectRemoveBrushCursor || !singleImageCanvas)
        return;
    const rect = singleImageCanvas.getBoundingClientRect();
    const scale = rect.width > 0 && singleImageCanvas.width > 0 ? rect.width / singleImageCanvas.width : 1;
    const diameter = Math.max(4, blemishBrushSize * 2 * scale);
    objectRemoveBrushCursor.style.width = `${diameter}px`;
    objectRemoveBrushCursor.style.height = `${diameter}px`;
}
function moveObjectRemoveCursor(event) {
    if (!blemishToolActive)
        return;
    if (isProcessingHeal) {
        if (singleImageCanvas)
            singleImageCanvas.style.cursor = 'progress';
        hideObjectRemoveCursor();
        return;
    }
    const cursor = ensureObjectRemoveCursor();
    updateObjectRemoveCursorSize();
    if (singleImageCanvas)
        singleImageCanvas.style.cursor = 'none';
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.style.display = 'block';
}
function hideObjectRemoveCursor() {
    if (objectRemoveBrushCursor)
        objectRemoveBrushCursor.style.display = 'none';
}
function deactivateAllTools() {
    if (typeof hideUpscaleCompare === 'function') {
        hideUpscaleCompare();
    }
    if (typeof closeUpscaleModelDialog === 'function') {
        closeUpscaleModelDialog();
    }
    if (blemishToolActive) {
        blemishToolActive = false;
        const blemishBtn = document.getElementById('blemishToolBtn');
        if (blemishBtn) {
            blemishBtn.classList.remove('active');
            blemishBtn.style.backgroundColor = '';
            blemishBtn.style.color = '';
        }
        if (singleImageCanvas)
            singleImageCanvas.style.cursor = 'grab';
        hideObjectRemoveCursor();
        restoreObjectRemoveBaseImage();
        resetObjectRemoveMask();
        removeBlemishListeners();
        isProcessingHeal = false;
        isHealing = false;
    }
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
    if (!blemishToolActive) {
        deactivateAllTools();
    }
    if (collageImages.length === 0) {
        showToast('Chọn ảnh trước', 'warning');
        return;
    }
    if (collageImages.length > 1) {
        showToast('Xoá Vật Thể chỉ dùng cho 1 ảnh', 'info');
        return;
    }
    blemishToolActive = !blemishToolActive;
    const btn = document.getElementById('blemishToolBtn');
    if (blemishToolActive) {
        btn?.classList.add('active');
        if (btn) {
            btn.style.backgroundColor = '#198754';
            btn.style.color = 'white';
        }
        singleImageCanvas.style.cursor = 'none';
        ensureObjectRemoveCursor();
        ensureObjectRemoveMask();
        originalImageForBlemish = singleImageCtx.getImageData(0, 0, singleImageCanvas.width, singleImageCanvas.height);
        setupBlemishListeners();
        showToast('Tô vùng cần xoá rồi thả chuột', 'success');
    }
    else {
        btn?.classList.remove('active');
        if (btn) {
            btn.style.backgroundColor = '';
            btn.style.color = '';
        }
        singleImageCanvas.style.cursor = 'grab';
        hideObjectRemoveCursor();
        removeBlemishListeners();
        restoreObjectRemoveBaseImage();
        resetObjectRemoveMask();
        showToast('Đã tắt Xoá Vật Thể', 'info');
    }
}
function setupBlemishListeners() {
    singleImageCanvas.addEventListener('mouseenter', moveObjectRemoveCursor);
    singleImageCanvas.addEventListener('mousemove', moveObjectRemoveCursor);
    singleImageCanvas.addEventListener('mousedown', startDrawingMask);
    singleImageCanvas.addEventListener('mousemove', continueDrawingMask);
    singleImageCanvas.addEventListener('mouseup', endDrawingMask);
    singleImageCanvas.addEventListener('mouseleave', endDrawingMask);
    singleImageCanvas.addEventListener('mouseleave', hideObjectRemoveCursor);
    document.addEventListener('keydown', handleBlemishKeys);
}
function removeBlemishListeners() {
    if (!singleImageCanvas)
        return;
    singleImageCanvas.removeEventListener('mouseenter', moveObjectRemoveCursor);
    singleImageCanvas.removeEventListener('mousemove', moveObjectRemoveCursor);
    singleImageCanvas.removeEventListener('mousedown', startDrawingMask);
    singleImageCanvas.removeEventListener('mousemove', continueDrawingMask);
    singleImageCanvas.removeEventListener('mouseup', endDrawingMask);
    singleImageCanvas.removeEventListener('mouseleave', endDrawingMask);
    singleImageCanvas.removeEventListener('mouseleave', hideObjectRemoveCursor);
    document.removeEventListener('keydown', handleBlemishKeys);
    hideObjectRemoveCursor();
}
function startDrawingMask(event) {
    if (!blemishToolActive || isProcessingHeal)
        return;
    if (!originalImageForBlemish) {
        originalImageForBlemish = singleImageCtx.getImageData(0, 0, singleImageCanvas.width, singleImageCanvas.height);
    }
    isHealing = true;
    hasDrawnMask = true;
    drawMaskPoint(event);
}
function continueDrawingMask(event) {
    if (!isHealing || !blemishToolActive || isProcessingHeal)
        return;
    drawMaskPoint(event);
}
async function endDrawingMask() {
    if (!isHealing)
        return;
    isHealing = false;
    if (hasDrawnMask && !isProcessingHeal) {
        await processBlemishHealingAuto();
    }
}
function drawMaskPoint(event) {
    if (!blemishMaskCtx || !singleImageCanvas)
        return;
    const rect = singleImageCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (singleImageCanvas.width / rect.width);
    const y = (event.clientY - rect.top) * (singleImageCanvas.height / rect.height);
    blemishMaskCtx.fillStyle = 'white';
    blemishMaskCtx.beginPath();
    blemishMaskCtx.arc(x, y, blemishBrushSize, 0, Math.PI * 2);
    blemishMaskCtx.fill();
    singleImageCtx.save();
    singleImageCtx.globalAlpha = blemishMaskOpacity;
    singleImageCtx.fillStyle = '#19d27f';
    singleImageCtx.beginPath();
    singleImageCtx.arc(x, y, blemishBrushSize, 0, Math.PI * 2);
    singleImageCtx.fill();
    singleImageCtx.restore();
}
function handleBlemishKeys(event) {
    if (!blemishToolActive)
        return;
    if (event.key === '[') {
        const newSize = Math.max(1, blemishBrushSize - 1);
        updateBlemishBrushSize(newSize);
        const slider = document.getElementById('blemishBrushSlider');
        if (slider)
            slider.value = String(newSize);
    }
    if (event.key === ']') {
        const newSize = Math.min(80, blemishBrushSize + 1);
        updateBlemishBrushSize(newSize);
        const slider = document.getElementById('blemishBrushSlider');
        if (slider)
            slider.value = String(newSize);
    }
    if (event.key === 'Escape') {
        deactivateAllTools();
    }
}
async function processBlemishHealing(_event) {
    await processBlemishHealingAuto();
}
async function processBlemishHealingAuto() {
    if (!blemishToolActive || isProcessingHeal || !hasDrawnMask || !blemishMaskCanvas || !originalImageForBlemish)
        return;
    try {
        isProcessingHeal = true;
        if (singleImageCanvas)
            singleImageCanvas.style.cursor = 'progress';
        hideObjectRemoveCursor();
        saveCanvasState();
        restoreObjectRemoveBaseImage();
        showToast('Đang xoá vật thể...', 'info');
        const imageBlob = await imageCanvasToBlob(singleImageCanvas);
        const maskBlob = await imageCanvasToBlob(blemishMaskCanvas);
        const formData = new FormData();
        formData.append('image', imageBlob, 'image.png');
        formData.append('mask', maskBlob, 'mask.png');
        const resultBlob = window.ImageApi
            ? await window.ImageApi.objectRemove(formData)
            : await fetch('/image/api/object_remove', { method: 'POST', body: formData }).then((response) => {
                if (!response.ok)
                    throw new Error('Xoá Vật Thể lỗi');
                return response.blob();
            });
        const resultUrl = URL.createObjectURL(resultBlob);
        await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                singleImageCanvas.width = img.width;
                singleImageCanvas.height = img.height;
                singleImageCtx.drawImage(img, 0, 0);
                collageImages[0] = img;
                originalImageForBlemish = singleImageCtx.getImageData(0, 0, singleImageCanvas.width, singleImageCanvas.height);
                ensureObjectRemoveMask();
                resetObjectRemoveMask();
                saveImageToCache([singleImageCanvas.toDataURL('image/png')], 'collage');
                saveCanvasState();
                URL.revokeObjectURL(resultUrl);
                resolve();
            };
            img.onerror = reject;
            img.src = resultUrl;
        });
        showToast('Đã xoá vật thể', 'success');
    }
    catch (error) {
        restoreObjectRemoveBaseImage();
        resetObjectRemoveMask();
        console.error(error);
        showToast(getImageErrorMessage(error), 'danger');
    }
    finally {
        isProcessingHeal = false;
        if (blemishToolActive && singleImageCanvas)
            singleImageCanvas.style.cursor = 'none';
    }
}
