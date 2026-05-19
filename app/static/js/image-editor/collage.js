"use strict";
// Typed Image editor module: collage layout/rendering.
// Keeps behavior compatible while the monolith is split into smaller files.
// ===== LOCKED DRAG WITH OBJECT-POSITION =====
function bindLockedDrag(img, imageIndex) {
    if (!img)
        return;
    const dragSurface = (img.parentElement || img);
    img.setAttribute('draggable', 'false'); // cháº·n drag máº·c Ä‘á»‹nh cá»§a trÃ¬nh duyá»‡t
    img.style.cursor = 'grab';
    img.style.userSelect = 'none';
    img.style.touchAction = 'none';
    img.style.setProperty('-webkit-user-drag', 'none');
    dragSurface.style.cursor = 'grab';
    dragSurface.style.touchAction = 'none';
    let panDragging = false;
    let swapDragging = false;
    let swapMoved = false;
    let startX = 0, startY = 0;
    let startPosX = 50, startPosY = 50; // object-position ban Ä‘áº§u (%)
    dragSurface.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.button !== 2)
            return;
        // Don't allow dragging if locked (editing text)
        if (isImageDraggingLocked) {
            console.log('â›” Image drag blocked - text editing in progress');
            return;
        }
        panDragging = e.button === 2;
        swapDragging = e.button === 0;
        swapMoved = false;
        dragSurface.classList.toggle('is-swap-dragging', swapDragging);
        startX = e.clientX;
        startY = e.clientY;
        // Láº¥y object-position hiá»‡n táº¡i
        const pos = img.style.objectPosition || window.getComputedStyle(img).objectPosition || '50% 50%';
        const [px, py] = pos.split(' ').map(s => parseFloat(s));
        startPosX = Number.isFinite(px) ? px : 50;
        startPosY = Number.isFinite(py) ? py : 50;
        if (dragSurface.setPointerCapture) {
            dragSurface.setPointerCapture(e.pointerId);
        }
        img.style.cursor = 'grabbing';
        dragSurface.style.cursor = 'grabbing';
        e.preventDefault();
        e.stopPropagation();
    }, { passive: false });
    dragSurface.addEventListener('pointermove', (e) => {
        if (!panDragging && !swapDragging)
            return;
        const rect = dragSurface.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0)
            return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        if (swapDragging) {
            swapMoved = swapMoved || Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6;
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        // Chuyá»ƒn delta pixel sang % dá»±a trÃªn kÃ­ch thÆ°á»›c tile
        const deltaXPercent = (deltaX / rect.width) * 100;
        const deltaYPercent = (deltaY / rect.height) * 100;
        // TÃ­nh vá»‹ trÃ­ má»›i (kÃ©o chuá»™t pháº£i = áº£nh sang pháº£i, kÃ©o lÃªn = áº£nh lÃªn)
        let newX = startPosX - deltaXPercent;
        let newY = startPosY - deltaYPercent;
        // Clamp 0â€“100% Ä‘á»ƒ khÃ´ng bao giá» há»Ÿ ná»n
        newX = Math.max(0, Math.min(100, newX));
        newY = Math.max(0, Math.min(100, newY));
        img.style.objectPosition = `${newX}% ${newY}%`;
        // Save to imagePositions array for persistence
        if (imageIndex !== undefined) {
            imagePositions[imageIndex] = { x: newX, y: newY };
        }
        e.preventDefault();
        e.stopPropagation();
    }, { passive: false });
    const end = (e) => {
        const shouldSwap = Boolean(e && e.type === 'pointerup' && swapDragging && swapMoved);
        const fromIndex = imageIndex ?? -1;
        let toIndex = -1;
        if (shouldSwap && e) {
            const dropTarget = document
                .elementFromPoint(e.clientX, e.clientY)
                ?.closest('.tile[data-collage-tile-index]');
            toIndex = parseInt(dropTarget?.dataset.collageTileIndex || '-1', 10);
        }
        panDragging = false;
        swapDragging = false;
        swapMoved = false;
        dragSurface.classList.remove('is-swap-dragging');
        img.style.cursor = 'grab';
        dragSurface.style.cursor = 'grab';
        if (e && dragSurface.releasePointerCapture && dragSurface.hasPointerCapture(e.pointerId)) {
            dragSurface.releasePointerCapture(e.pointerId);
        }
        if (shouldSwap && fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
            swapCollageImageOrder(fromIndex, toIndex);
        }
    };
    dragSurface.addEventListener('pointerup', end);
    dragSurface.addEventListener('pointercancel', end);
    dragSurface.addEventListener('lostpointercapture', () => end());
    dragSurface.addEventListener('contextmenu', (e) => e.preventDefault());
}
// ===== HELPER FUNCTIONS FOR CANVAS COLLAGE =====
// Preload áº£nh: tráº£ vá» HTMLImageElement Ä‘Ã£ sáºµn sÃ ng
async function loadImage(src) {
    return new Promise((res, rej) => {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = src;
    });
}
// TÃ­nh danh sÃ¡ch cell theo layout cho 3 áº£nh
// Tráº£ vá» máº£ng cÃ¡c rect: [{x,y,w,h}, ...] (tá»a Ä‘á»™ pixel trong canvas)
function swapCollageImageOrder(fromIndex, toIndex) {
    if (fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= collageImages.length ||
        toIndex >= collageImages.length ||
        fromIndex === toIndex) {
        return;
    }
    [collageImages[fromIndex], collageImages[toIndex]] = [collageImages[toIndex], collageImages[fromIndex]];
    [imagePositions[fromIndex], imagePositions[toIndex]] = [
        imagePositions[toIndex] || { x: 50, y: 50 },
        imagePositions[fromIndex] || { x: 50, y: 50 }
    ];
    [imageOffsets[fromIndex], imageOffsets[toIndex]] = [
        imageOffsets[toIndex] || { x: 0, y: 0 },
        imageOffsets[fromIndex] || { x: 0, y: 0 }
    ];
    saveImageToCache(collageImages.map(img => img.src), 'collage');
    createHTMLCollage();
    showToast('Đã đổi vị trí ảnh', 'success');
}
function getCellsForLayout(layoutKey, W, H, gutter) {
    const g = gutter;
    // Máº·c Ä‘á»‹nh: 1 áº£nh bÃªn pháº£i full height, 2 áº£nh bÃªn trÃ¡i chia Ä‘Ã´i
    // Äáº·t tÃªn vÃ­ dá»¥: 'L2_R1' (2 trÃ¡i 1 pháº£i), 'R2_L1', 'T2_B1' (2 trÃªn 1 dÆ°á»›i), ...
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
        default: { // 3 cá»™t (fallback)
            const colW = Math.floor((W - 2 * g) / 3);
            return [
                { x: 0, y: 0, w: colW, h: H },
                { x: colW + g, y: 0, w: colW, h: H },
                { x: 2 * (colW + g), y: 0, w: W - 2 * (colW + g) - colW, h: H }
            ];
        }
    }
}
// Clamp offset Ä‘á»ƒ khÃ´ng bao giá» há»Ÿ ná»n (cover logic)
function clampOffsetForCover(imgW, imgH, cellW, cellH, off) {
    const imgAspect = imgW / imgH;
    const cellAspect = cellW / cellH;
    // KÃ­ch thÆ°á»›c váº½ theo cover
    let drawW, drawH;
    if (imgAspect > cellAspect) {
        drawH = cellH;
        drawW = Math.ceil(cellH * imgAspect);
    }
    else {
        drawW = cellW;
        drawH = Math.ceil(cellW / imgAspect);
    }
    // Pháº§n "dÆ°" Ä‘á»ƒ cÃ³ thá»ƒ pan mÃ  váº«n cover
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
let collageColorTarget = 'background';
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
    { id: 'layout-1', name: '1 ảnh', cols: 1, rows: 1, maxPhotos: 1, cells: [[0, 0, 1, 1]] },
    // === 2 PHOTOS ===
    { id: 'layout-2h', name: '2 ảnh ngang', cols: 2, rows: 1, maxPhotos: 2, cells: [[0, 0, 1, 1], [1, 0, 1, 1]] },
    { id: 'layout-2v', name: '2 ảnh dọc', cols: 1, rows: 2, maxPhotos: 2, cells: [[0, 0, 1, 1], [0, 1, 1, 1]] },
    // === 3 PHOTOS ===
    { id: 'layout-3h', name: '3 ảnh ngang', cols: 3, rows: 1, maxPhotos: 3, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1]] },
    { id: 'layout-3v', name: '3 ảnh dọc', cols: 1, rows: 3, maxPhotos: 3, cells: [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1]] },
    { id: 'layout-3-left', name: '3 ảnh trái lớn', cols: 2, rows: 2, maxPhotos: 3, cells: [[0, 0, 1, 2], [1, 0, 1, 1], [1, 1, 1, 1]] },
    { id: 'layout-3-right', name: '3 ảnh phải lớn', cols: 2, rows: 2, maxPhotos: 3, cells: [[0, 0, 1, 1], [0, 1, 1, 1], [1, 0, 1, 2]] },
    { id: 'layout-3-top', name: '3 ảnh trên lớn', cols: 2, rows: 2, maxPhotos: 3, cells: [[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1]] },
    { id: 'layout-3-bottom', name: '3 ảnh dưới lớn', cols: 2, rows: 2, maxPhotos: 3, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 2, 1]] },
    // === 4 PHOTOS ===
    { id: 'layout-4-grid', name: '4 ảnh lưới 2x2', cols: 2, rows: 2, maxPhotos: 4, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1]] },
    { id: 'layout-4h', name: '4 ảnh ngang', cols: 4, rows: 1, maxPhotos: 4, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [3, 0, 1, 1]] },
    { id: 'layout-4v', name: '4 ảnh dọc', cols: 1, rows: 4, maxPhotos: 4, cells: [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1], [0, 3, 1, 1]] },
    { id: 'layout-4-left', name: '4 ảnh trái lớn', cols: 2, rows: 3, maxPhotos: 4, cells: [[0, 0, 1, 3], [1, 0, 1, 1], [1, 1, 1, 1], [1, 2, 1, 1]] },
    { id: 'layout-4-right', name: '4 ảnh phải lớn', cols: 2, rows: 3, maxPhotos: 4, cells: [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1], [1, 0, 1, 3]] },
    { id: 'layout-4-top', name: '4 ảnh trên lớn', cols: 3, rows: 2, maxPhotos: 4, cells: [[0, 0, 3, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]] },
    { id: 'layout-4-bottom', name: '4 ảnh dưới lớn', cols: 3, rows: 2, maxPhotos: 4, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [0, 1, 3, 1]] },
    { id: 'layout-4-center', name: '4 ảnh giữa lớn', cols: 3, rows: 3, maxPhotos: 4, cells: [[0, 0, 1, 1], [2, 0, 1, 1], [1, 1, 1, 1], [0, 2, 1, 1]] },
    // === 5 PHOTOS ===
    { id: 'layout-5h', name: '5 ảnh ngang', cols: 5, rows: 1, maxPhotos: 5, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [3, 0, 1, 1], [4, 0, 1, 1]] },
    { id: 'layout-5v', name: '5 ảnh dọc', cols: 1, rows: 5, maxPhotos: 5, cells: [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1], [0, 3, 1, 1], [0, 4, 1, 1]] },
    { id: 'layout-5-left', name: '5 ảnh trái lớn', cols: 3, rows: 2, maxPhotos: 5, cells: [[0, 0, 1, 2], [1, 0, 1, 1], [2, 0, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]] },
    { id: 'layout-5-right', name: '5 ảnh phải lớn', cols: 3, rows: 2, maxPhotos: 5, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 0, 1, 2]] },
    { id: 'layout-5-top2', name: '5 ảnh trên 2 ô', cols: 3, rows: 2, maxPhotos: 5, cells: [[0, 0, 2, 1], [2, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]] },
    { id: 'layout-5-top3', name: '5 ảnh trên 3 ô', cols: 3, rows: 2, maxPhotos: 5, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [0, 1, 2, 1], [2, 1, 1, 1]] },
    { id: 'layout-5-center', name: '5 ảnh giữa lớn', cols: 3, rows: 3, maxPhotos: 5, cells: [[0, 0, 1, 1], [2, 0, 1, 1], [1, 1, 1, 1], [0, 2, 1, 1], [2, 2, 1, 1]] },
    { id: 'layout-5-grid', name: '5 ảnh lưới mix', cols: 3, rows: 2, maxPhotos: 5, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [0, 1, 1, 1], [1, 1, 2, 1]] },
    // === 6 PHOTOS ===
    { id: 'layout-6-grid', name: '6 ảnh lưới 2x3', cols: 3, rows: 2, maxPhotos: 6, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]] },
    { id: 'layout-6h', name: '6 ảnh ngang', cols: 6, rows: 1, maxPhotos: 6, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [3, 0, 1, 1], [4, 0, 1, 1], [5, 0, 1, 1]] },
    { id: 'layout-6v', name: '6 ảnh dọc', cols: 1, rows: 6, maxPhotos: 6, cells: [[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1], [0, 3, 1, 1], [0, 4, 1, 1], [0, 5, 1, 1]] },
    // === 9 PHOTOS ===
    { id: 'layout-9-grid', name: '9 ảnh lưới 3x3', cols: 3, rows: 3, maxPhotos: 9, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1], [0, 2, 1, 1], [1, 2, 1, 1], [2, 2, 1, 1]] }
];
function collageInput(id) {
    return document.getElementById(id);
}
function collageIsGradientFill(fill) {
    return /^linear-gradient\(/i.test((fill || '').trim());
}
function collageExtractFillColors(fill) {
    return (fill || '').match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g) || [];
}
function collageCreateCanvasFill(ctx, fill, x, y, w, h) {
    const value = (fill || '').trim();
    if (!collageIsGradientFill(value))
        return value || '#111111';
    const colors = collageExtractFillColors(value);
    if (colors.length < 2)
        return colors[0] || '#111111';
    const angleMatch = value.match(/linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg/i);
    const angle = angleMatch ? parseFloat(angleMatch[1]) : 90;
    const radians = ((angle - 90) * Math.PI) / 180;
    const half = Math.sqrt(w * w + h * h) / 2;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const dx = Math.cos(radians) * half;
    const dy = Math.sin(radians) * half;
    const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    colors.forEach((color, index) => {
        gradient.addColorStop(index / (colors.length - 1), color);
    });
    return gradient;
}
function collageGetFill(target) {
    const fillInput = collageInput(target === 'background' ? 'collageBackgroundFill' : 'collageBorderFill');
    const colorInput = collageInput(target === 'background' ? 'collageBackground' : 'collageBorderColor');
    return fillInput?.value || colorInput?.value || (target === 'background' ? '#111111' : '#ff3b30');
}
function collageSetFill(target, fill) {
    const fillInput = collageInput(target === 'background' ? 'collageBackgroundFill' : 'collageBorderFill');
    const colorInput = collageInput(target === 'background' ? 'collageBackground' : 'collageBorderColor');
    if (fillInput)
        fillInput.value = fill;
    if (colorInput && !collageIsGradientFill(fill))
        colorInput.value = fill;
    updateCollageQuickPanelValues();
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
}
function collageNormalizeHexColor(value) {
    let color = (value || '').trim();
    if (!color)
        return null;
    if (!color.startsWith('#'))
        color = `#${color}`;
    if (/^#[0-9a-fA-F]{3}$/.test(color)) {
        color = `#${color.slice(1).split('').map(char => char + char).join('')}`;
    }
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : null;
}
function collageApplyPanelFill(fill) {
    if (collageColorTarget === 'text') {
        if (typeof applyTextFillFromCollagePanel === 'function' && applyTextFillFromCollagePanel(fill)) {
            showToast('Đã đổi màu chữ', 'success');
        }
        else {
            showToast('Chọn hoặc thêm chữ trước khi đổi màu', 'warning');
        }
        return;
    }
    if (collageColorTarget === 'border' && parseInt(collageInput('collageBorder')?.value || '0', 10) === 0) {
        collageSetInputValue('collageBorder', '6');
    }
    collageSetFill(collageColorTarget, fill);
}
function collageBuildCheckpointGradient() {
    const stops = Array.from(document.querySelectorAll('[data-collage-gradient-stop]'))
        .map(input => input.value || '#ffffff');
    return `linear-gradient(90deg, ${stops.join(', ')})`;
}
function collageUpdateGradientPreview() {
    const gradient = collageBuildCheckpointGradient();
    const preview = document.getElementById('collageGradientPreview');
    if (preview)
        preview.style.background = gradient;
    return gradient;
}
function collageSyncGradientStops(fill) {
    const colors = collageExtractFillColors(fill).filter(color => color.startsWith('#'));
    if (colors.length < 2)
        return;
    const chosen = colors.length >= 3
        ? [colors[0], colors[Math.floor(colors.length / 2)], colors[colors.length - 1]]
        : [colors[0], colors[1], colors[1]];
    document.querySelectorAll('[data-collage-gradient-stop]').forEach((input, index) => {
        input.value = chosen[index] || chosen[chosen.length - 1];
    });
    collageUpdateGradientPreview();
}
function collageSetInputValue(id, value, eventType = 'input') {
    const input = collageInput(id);
    if (!input)
        return;
    input.value = value;
    input.dispatchEvent(new Event(eventType, { bubbles: true }));
}
function setCollageQuickPanelVisible(visible) {
    const panel = document.getElementById('collageQuickPanel');
    if (panel)
        panel.style.display = visible ? 'block' : 'none';
    if (!visible)
        closeCollagePopovers();
}
function closeCollagePopovers() {
    document.querySelectorAll('.collage-popover.is-open').forEach(menu => menu.classList.remove('is-open'));
    document.querySelectorAll('.collage-quick-item.is-open').forEach(button => button.classList.remove('is-open'));
}
function updateCollageQuickPanelValues() {
    const aspect = collageInput('collageAspect')?.value || '1:1';
    const gutter = collageInput('collageGutter')?.value || '0';
    const radius = collageInput('collageRadius')?.value || '0';
    const border = collageInput('collageBorder')?.value || '0';
    const currentFill = collageColorTarget === 'border' ? collageGetFill('border') : collageGetFill('background');
    const aspectValue = document.getElementById('collageAspectQuickValue');
    if (aspectValue)
        aspectValue.textContent = aspect;
    const spaceValue = document.getElementById('collageSpaceQuickValue');
    if (spaceValue)
        spaceValue.textContent = gutter;
    const swatch = document.getElementById('collageColorQuickSwatch');
    if (swatch)
        swatch.style.background = currentFill;
    const cornerIcon = document.getElementById('collageCornerQuickIcon');
    if (cornerIcon)
        cornerIcon.style.setProperty('--corner-preview-radius', `${Math.min(parseInt(radius, 10) || 0, 18)}px`);
    const spaceMirror = collageInput('collageSpaceMirror');
    const borderMirror = collageInput('collageBorderMirror');
    const cornerMirror = collageInput('collageCornerMirror');
    if (spaceMirror)
        spaceMirror.value = gutter;
    if (borderMirror)
        borderMirror.value = border;
    if (cornerMirror)
        cornerMirror.value = radius;
    const spaceMirrorValue = document.getElementById('collageSpaceMirrorValue');
    const borderMirrorValue = document.getElementById('collageBorderMirrorValue');
    const cornerMirrorValue = document.getElementById('collageCornerMirrorValue');
    if (spaceMirrorValue)
        spaceMirrorValue.textContent = gutter;
    if (borderMirrorValue)
        borderMirrorValue.textContent = border;
    if (cornerMirrorValue)
        cornerMirrorValue.textContent = radius;
    document.querySelectorAll('[data-collage-aspect-option]').forEach(button => {
        button.classList.toggle('is-active', button.dataset.collageAspectOption === aspect);
    });
    document.querySelectorAll('[data-collage-space-option]').forEach(button => {
        button.classList.toggle('is-active', button.dataset.collageSpaceOption === gutter);
    });
    document.querySelectorAll('[data-collage-corner-option]').forEach(button => {
        button.classList.toggle('is-active', button.dataset.collageCornerOption === radius);
    });
    document.querySelectorAll('[data-collage-color-target]').forEach(button => {
        button.classList.toggle('is-active', button.dataset.collageColorTarget === collageColorTarget);
    });
}
function bindCollageQuickControls() {
    document.querySelectorAll('[data-collage-popover]').forEach(button => {
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const targetId = button.dataset.collagePopover || '';
            const menu = document.getElementById(targetId);
            const shouldOpen = !menu?.classList.contains('is-open');
            closeCollagePopovers();
            if (shouldOpen && menu) {
                button.classList.add('is-open');
                menu.classList.add('is-open');
            }
        });
    });
    document.querySelectorAll('.collage-popover').forEach(menu => {
        menu.addEventListener('click', event => event.stopPropagation());
    });
    document.querySelectorAll('[data-collage-aspect-option]').forEach(button => {
        button.addEventListener('click', () => {
            const value = button.dataset.collageAspectOption;
            if (!value)
                return;
            collageSetInputValue('collageAspect', value, 'change');
            closeCollagePopovers();
        });
    });
    document.querySelectorAll('[data-collage-space-option]').forEach(button => {
        button.addEventListener('click', () => {
            const value = button.dataset.collageSpaceOption;
            if (!value)
                return;
            collageSetInputValue('collageGutter', value);
        });
    });
    document.querySelectorAll('[data-collage-corner-option]').forEach(button => {
        button.addEventListener('click', () => {
            const value = button.dataset.collageCornerOption;
            if (!value)
                return;
            collageSetInputValue('collageRadius', value);
        });
    });
    document.querySelectorAll('[data-collage-color-target]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.collageColorTarget;
            if (target === 'background' || target === 'border' || target === 'text') {
                collageColorTarget = target;
                updateCollageQuickPanelValues();
            }
        });
    });
    document.querySelectorAll('[data-collage-fill]').forEach(button => {
        button.addEventListener('click', () => {
            const fill = button.dataset.collageFill || '#ffffff';
            if (collageIsGradientFill(fill))
                collageSyncGradientStops(fill);
            collageApplyPanelFill(fill);
        });
    });
    document.querySelectorAll('[data-collage-gradient-stop]').forEach(input => {
        input.addEventListener('input', collageUpdateGradientPreview);
    });
    document.querySelector('[data-collage-gradient-apply]')?.addEventListener('click', () => {
        collageApplyPanelFill(collageUpdateGradientPreview());
    });
    const collageColorCodeInput = document.getElementById('collageColorCodeInput');
    const applyCollageCustomColor = () => {
        const color = collageNormalizeHexColor(collageColorCodeInput?.value || '');
        if (!color) {
            showToast('Mã màu không hợp lệ. Dùng dạng #FFFFFF', 'warning');
            return;
        }
        if (collageColorCodeInput)
            collageColorCodeInput.value = color;
        collageApplyPanelFill(color);
    };
    document.querySelector('[data-collage-custom-fill]')?.addEventListener('click', applyCollageCustomColor);
    collageColorCodeInput?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            applyCollageCustomColor();
        }
    });
    const spaceMirror = collageInput('collageSpaceMirror');
    const borderMirror = collageInput('collageBorderMirror');
    const cornerMirror = collageInput('collageCornerMirror');
    spaceMirror?.addEventListener('input', () => collageSetInputValue('collageGutter', spaceMirror.value));
    borderMirror?.addEventListener('input', () => collageSetInputValue('collageBorder', borderMirror.value));
    cornerMirror?.addEventListener('input', () => collageSetInputValue('collageRadius', cornerMirror.value));
    document.addEventListener('click', closeCollagePopovers);
    collageUpdateGradientPreview();
    updateCollageQuickPanelValues();
}
bindCollageQuickControls();
// Update slider values display and trigger collage update
document.getElementById('collageGutter').addEventListener('input', function (e) {
    document.getElementById('gutterValue2').textContent = e.target.value;
    updateCollageQuickPanelValues();
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});
document.getElementById('collageRadius').addEventListener('input', function (e) {
    document.getElementById('radiusValue2').textContent = e.target.value;
    updateCollageQuickPanelValues();
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});
document.getElementById('collageBorder').addEventListener('input', function (e) {
    document.getElementById('borderValue2').textContent = e.target.value;
    updateCollageQuickPanelValues();
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});
// Auto-update collage when settings change
document.getElementById('collageAspect').addEventListener('change', function () {
    updateCollageQuickPanelValues();
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});
document.getElementById('collageBorderColor').addEventListener('change', function () {
    collageSetFill('border', this.value);
});
document.getElementById('collageBackground').addEventListener('change', function () {
    collageSetFill('background', this.value);
});
// Render layout templates
function renderLayoutTemplates() {
    const container = document.getElementById('layoutTemplates');
    const panel = document.getElementById('templatesPanel');
    // Show collage controls only when there is a real collage, not a single image.
    if (collageImages.length < 2) {
        panel.style.display = 'none';
        if (container)
            container.innerHTML = '';
        setCollageQuickPanelVisible(false);
        return;
    }
    panel.style.display = 'block';
    setCollageQuickPanelVisible(true);
    updateCollageQuickPanelValues();
    let html = '';
    // Filter templates: only show templates matching uploaded photo count
    const availableTemplates = layoutTemplates.filter(layout => layout.maxPhotos === collageImages.length);
    if (availableTemplates.length === 0) {
        html = `<div class="text-center text-muted p-2 w-100 image-layout-empty">
                    <i class="bi bi-info-circle"></i> Chưa có bố cục cho ${collageImages.length} ảnh
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
                 title="${layout.name} (${layout.maxPhotos} ảnh)">
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
    if (collageImages.length < 2) {
        selectedLayout = null;
        setCollageQuickPanelVisible(false);
        return;
    }
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
    const files = Array.from(e.target.files || []);
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
            const dataUrl = String(event.target?.result || '');
            const img = new Image();
            img.onload = function () {
                collageImages.push(img);
                imageDataURLs.push(dataUrl); // Save dataURL
                loadedCount++;
                // Add thumbnail to preview
                const col = document.createElement('div');
                col.className = 'col-auto';
                col.innerHTML = `
                    <div class="position-relative image-thumb-frame">
                        <img src="${dataUrl}"
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
                        showToast('Đã thêm 1 ảnh', 'success');
                    }
                    else {
                        // Collage mode (2+ images)
                        // Hide single image viewer when switching to collage
                        document.getElementById('singleImageViewer').style.display = 'none';
                        previewContainer.style.display = 'flex';
                        showToast(`Đã thêm ${files.length} ảnh`, 'success');
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
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    });
});
// ==== CREATE HTML COLLAGE WITH CSS GRID (SUPPORTS ALL LAYOUTS) ====
function createHTMLCollage() {
    const gutter = parseInt(document.getElementById('collageGutter').value);
    const radius = parseInt(document.getElementById('collageRadius').value);
    const borderWidth = parseInt(document.getElementById('collageBorder').value);
    const borderColor = collageGetFill('border');
    const backgroundColor = collageGetFill('background');
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
    collageTiles.style.setProperty('--stroke-color', collageIsGradientFill(borderColor) ? '#ffffff' : borderColor);
    // Apply background
    collageTiles.style.background = backgroundColor;
    collageTiles.style.padding = `${gutter}px`;
    // Clear existing tiles
    collageTiles.innerHTML = '';
    // Set up CSS Grid based on layout
    collageTiles.style.display = 'grid';
    collageTiles.style.pointerEvents = 'auto';
    collageTiles.style.opacity = '1';
    collageTiles.style.filter = 'none';
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
        tileDiv.dataset.collageTileIndex = String(index);
        tileDiv.style.gridColumn = `${col + 1} / span ${colSpan}`;
        tileDiv.style.gridRow = `${row + 1} / span ${rowSpan}`;
        tileDiv.style.overflow = 'hidden';
        tileDiv.style.borderRadius = `${radius}px`;
        tileDiv.style.boxSizing = 'border-box';
        if (borderWidth > 0 && collageIsGradientFill(borderColor)) {
            tileDiv.style.border = `${borderWidth}px solid transparent`;
            tileDiv.style.background = borderColor;
        }
        else {
            tileDiv.style.border = borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : 'none';
            tileDiv.style.background = 'transparent';
        }
        tileDiv.style.position = 'relative';
        tileDiv.style.userSelect = 'none';
        tileDiv.style.touchAction = 'none';
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
        img.style.borderRadius = `${Math.max(radius - borderWidth, 0)}px`;
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
        showToast('Chọn ảnh và bố cục trước', 'warning');
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
    // 1) KÃ­ch thÆ°á»›c canvas theo tá»· lá»‡ chá»n
    const aspect = document.getElementById('collageAspect').value; // '1:1','3:4','4:5','16:9'
    const [arW, arH] = aspect.split(':').map(Number);
    const base = 1080; // cáº¡nh dÃ i Ä‘á»ƒ xuáº¥t nÃ©t
    const CW = arW >= arH ? base : Math.round(base * (arW / arH));
    const CH = arH >= arW ? base : Math.round(base * (arH / arW));
    collageCanvas.width = CW;
    collageCanvas.height = CH;
    const gutter = parseInt(document.getElementById('collageGutter').value || '0', 10);
    const radius = parseInt(document.getElementById('collageRadius').value || '0', 10);
    const border = parseInt(document.getElementById('collageBorder').value || '0', 10);
    const borderColor = collageGetFill('border') || '#ff3b30';
    const backgroundColor = collageGetFill('background') || '#111111';
    // 2) Preload áº£nh (fix lá»—i "chá»‰ 1 áº£nh")
    const imgs = await Promise.all(images.map(src => loadImage(src)));
    // 3) TÃ­nh cell theo layout
    const cells = getCellsForLayout(layoutKey, CW, CH, gutter);
    // náº¿u sá»‘ cell Ã­t hÆ¡n sá»‘ áº£nh, chá»‰ láº¥y áº£nh Ä‘áº§u; náº¿u nhiá»u hÆ¡n thÃ¬ láº·p láº¡i áº£nh cuá»‘i
    const n = Math.min(cells.length, imgs.length);
    collageCtx.clearRect(0, 0, CW, CH);
    // Fill background
    collageCtx.fillStyle = collageCreateCanvasFill(collageCtx, backgroundColor, 0, 0, CW, CH);
    collageCtx.fillRect(0, 0, CW, CH);
    for (let i = 0; i < n; i++) {
        const { x, y, w, h } = cells[i];
        const im = imgs[i];
        // 3a) chuáº©n bá»‹ cover + clamp offset
        const offRaw = imageOffsets[i] || { x: 0, y: 0 };
        const { x: offX, y: offY, drawW, drawH } = clampOffsetForCover(im.width, im.height, w, h, offRaw);
        // 3b) toáº¡ Ä‘á»™ váº½ sao cho áº£nh váº«n cover cell
        const drawX = x + Math.round((w - drawW) / 2 + offX);
        const drawY = y + Math.round((h - drawH) / 2 + offY);
        // 3c) clip trÃ²n gÃ³c + váº½
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
        // 3d) Border cell (váº½ Ä‘Ãºng nÃ©t, khÃ´ng *2)
        if (border > 0) {
            collageCtx.save();
            collageCtx.lineWidth = border;
            collageCtx.strokeStyle = collageCreateCanvasFill(collageCtx, borderColor, x, y, w, h);
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
    // 4) Gáº¯n vÃ¹ng drag cho tá»«ng cell (pan trong giá»›i háº¡n)
    enableCanvasDrag(cells);
    // Show canvas container
    document.getElementById('uploadedPhotosPreview').style.display = 'none';
    document.getElementById('collageCanvasContainer').style.display = 'block';
    document.getElementById('collage-tiles').style.display = 'none';
}
// KÃ©o trong Canvas â€“ khÃ´ng bao giá» lÃ²i ná»n
function enableCanvasDrag(cells) {
    let active = -1;
    let start = { x: 0, y: 0 };
    collageCanvas.onpointerdown = (e) => {
        const rect = collageCanvas.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (collageCanvas.width / rect.width);
        const cy = (e.clientY - rect.top) * (collageCanvas.height / rect.height);
        // chá»n cell Ä‘ang click
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
        imageOffsets[active].x -= dx;
        imageOffsets[active].y -= dy;
        // váº½ láº¡i (clamp sáº½ Ã¡p trong createCanvasCollage)
        if (currentImages && currentLayoutKey) {
            createCanvasCollage(currentImages, currentLayoutKey);
        }
    };
    const end = () => { active = -1; };
    collageCanvas.onpointerup = end;
    collageCanvas.onpointercancel = end;
}
