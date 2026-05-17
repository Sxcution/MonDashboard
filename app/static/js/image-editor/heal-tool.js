"use strict";
// Typed Image editor module: blemish/heal tool.
// Keeps behavior compatible while the monolith is split into smaller files.
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
let originalImageForBlemishDirty = false;
let blemishSettingsTimeout = null; // For hover delay
function imageCanvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob)
                resolve(blob);
            else
                reject(new Error('Canvas export failed'));
        }, 'image/png');
    });
}
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
        if (originalImageForBlemish && !originalImageForBlemishDirty && singleImageCtx) {
            singleImageCtx.putImageData(originalImageForBlemish, 0, 0);
        }
        if (blemishMaskCanvas && blemishMaskCtx) {
            blemishMaskCtx.fillStyle = 'black';
            blemishMaskCtx.fillRect(0, 0, blemishMaskCanvas.width, blemishMaskCanvas.height);
        }
        hasDrawnMask = false;
        isProcessingHeal = false;
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
        originalImageForBlemishDirty = false;
        setupBlemishListeners();
        showToast('ðŸ©¹ Paint & release to heal (auto)', 'success');
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
    singleImageCtx.globalAlpha = blemishMaskOpacity;
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
        showToast(`â³ Processing with ${methodName} (radius: ${radius})...`, 'info');
        // Convert canvases to blobs
        const imageBlob = await imageCanvasToBlob(singleImageCanvas);
        const maskBlob = await imageCanvasToBlob(blemishMaskCanvas);
        // Send to backend with parameters
        const formData = new FormData();
        formData.append('image', imageBlob, 'image.png');
        formData.append('mask', maskBlob, 'mask.png');
        formData.append('method', method);
        formData.append('radius', radius.toString());
        const healedBlob = window.ImageApi
            ? await window.ImageApi.removeBlemish(formData)
            : await fetch('/image/api/remove_blemish', { method: 'POST', body: formData })
                .then(response => {
                if (!response.ok)
                    throw new Error('Healing failed');
                return response.blob();
            });
        const healedUrl = URL.createObjectURL(healedBlob);
        // Load healed image back to canvas
        const healedImg = new Image();
        healedImg.onload = () => {
            singleImageCtx.drawImage(healedImg, 0, 0);
            URL.revokeObjectURL(healedUrl);
            // Reset mask
            blemishMaskCtx.fillStyle = 'black';
            blemishMaskCtx.fillRect(0, 0, blemishMaskCanvas.width, blemishMaskCanvas.height);
            hasDrawnMask = false;
            originalImageForBlemishDirty = true;
            showToast('âœ¨ Blemish removed successfully!', 'success');
        };
        healedImg.src = healedUrl;
    }
    catch (error) {
        console.error('Healing error:', error);
        showToast('âŒ Healing failed', 'danger');
    }
}
// Keyboard handler for blemish tool (adjust brush/radius with keyboard shortcuts)
function handleBlemishKeys(e) {
    if (!blemishToolActive)
        return;
    // [ and ] to change brush size
    if (e.key === '[') {
        const newSize = Math.max(1, blemishBrushSize - 1);
        updateBlemishBrushSize(newSize);
        document.getElementById('blemishBrushSlider').value = String(newSize);
    }
    if (e.key === ']') {
        const newSize = Math.min(50, blemishBrushSize + 1);
        updateBlemishBrushSize(newSize);
        document.getElementById('blemishBrushSlider').value = String(newSize);
    }
    // - and + to change heal radius
    if (e.key === '-') {
        const newRadius = Math.max(1, blemishInpaintRadius - 1);
        updateBlemishRadius(newRadius);
        document.getElementById('blemishRadiusSlider').value = String(newRadius);
    }
    if (e.key === '=' || e.key === '+') {
        const newRadius = Math.min(15, blemishInpaintRadius + 1);
        updateBlemishRadius(newRadius);
        document.getElementById('blemishRadiusSlider').value = String(newRadius);
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
    if (!blemishToolActive || isProcessingHeal || !hasDrawnMask)
        return;
    try {
        isProcessingHeal = true;
        saveCanvasState(); // Save for Undo
        const method = getBlemishMethod();
        const radius = blemishInpaintRadius;
        const methodName = method === 'ns' ? 'Navier-Stokes' : 'Telea';
        showToast(`â³ Healing (${methodName}, r=${radius})...`, 'info');
        const imageBlob = await imageCanvasToBlob(singleImageCanvas);
        const maskBlob = await imageCanvasToBlob(blemishMaskCanvas);
        const formData = new FormData();
        formData.append('image', imageBlob, 'image.png');
        formData.append('mask', maskBlob, 'mask.png');
        formData.append('method', method);
        formData.append('radius', String(radius));
        const healedBlob = window.ImageApi
            ? await window.ImageApi.removeBlemish(formData)
            : await fetch('/image/api/remove_blemish', { method: 'POST', body: formData })
                .then(response => {
                if (!response.ok)
                    throw new Error('Healing failed');
                return response.blob();
            });
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
        hasDrawnMask = false;
        originalImageForBlemishDirty = true;
        showToast('âœ¨ Healed!', 'success');
    }
    catch (err) {
        console.error(err);
        showToast('âŒ Healing failed', 'danger');
    }
    finally {
        isProcessingHeal = false;
    }
}
