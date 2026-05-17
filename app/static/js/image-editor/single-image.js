"use strict";
// Typed Image editor module: single image viewer and undo.
// Keeps behavior compatible while the monolith is split into smaller files.
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
        console.log('ðŸ”’ Image dragging LOCKED (editing text)');
    }
    else {
        // Unlock: enable pointer events on all images
        collageTiles.style.pointerEvents = 'auto';
        collageTiles.style.opacity = '1';
        collageTiles.style.filter = 'none';
        console.log('ðŸ”“ Image dragging UNLOCKED');
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
    console.log(`ðŸ’¾ Canvas state saved (${canvasHistory.length} in history)`);
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
        showToast('â†©ï¸ Undo successful', 'success');
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
