// Typed Image editor module: Mesh Warp / Liquify Push Tool.
// Implements local push-warp distortion using Gaussian falloff and Bilinear Interpolation Sampling.


// Warp Tool State Variables
let warpToolActive = false;
let isWarpDragging = false;
let warpBrushSize = 100;
let warpStrength = 0.25;
let warpGridSize = 16;
let warpSettingsTimeout: number | null = null;
let warpBaseImageData: ImageData | null = null;
let warpCurrentImageData: ImageData | null = null;
let warpPreviewCanvas: HTMLCanvasElement | null = null;
let warpPreviewCtx: CanvasRenderingContext2D | null = null;
let warpCursor: HTMLDivElement | null = null;
let warpLastPoint: { x: number; y: number } | null = null;
let warpDirty = false;
let warpHistory: ImageData[] = [];

// Intercept global deactivateAllTools to include warp tool deactivation
(function() {
    const originalDeactivateAllTools = (window as any).deactivateAllTools || (globalThis as any).deactivateAllTools;
    const newDeactivateAllTools = function() {
        if (typeof originalDeactivateAllTools === 'function') {
            originalDeactivateAllTools();
        }
        if (warpToolActive) {
            // Revert state silently without showing Toast if another tool is explicitly activated
            removeWarpListeners();
            hideWarpCursor();
            
            const btn = document.getElementById('warpToolBtn');
            if (btn) {
                btn.classList.remove('active');
                btn.style.backgroundColor = '';
                btn.style.color = '';
            }
            
            if (warpDirty && warpBaseImageData && singleImageCtx) {
                singleImageCtx.putImageData(warpBaseImageData, 0, 0);
            }
            
            warpToolActive = false;
            warpDirty = false;
            warpHistory = [];
            warpBaseImageData = null;
            warpCurrentImageData = null;
            hideWarpSettings();
        }
    };
    (window as any).deactivateAllTools = newDeactivateAllTools;
    (globalThis as any).deactivateAllTools = newDeactivateAllTools;
})();

// Settings Menu Visibility Toggle
function showWarpSettings(): void {
    if (warpSettingsTimeout) {
        clearTimeout(warpSettingsTimeout);
        warpSettingsTimeout = null;
    }
    const menu = document.getElementById('warpSettingsMenu');
    if (menu) {
        menu.style.display = 'block';
    }
}

function hideWarpSettings(): void {
    warpSettingsTimeout = window.setTimeout(() => {
        const menu = document.getElementById('warpSettingsMenu');
        if (menu) {
            menu.style.display = 'none';
        }
    }, 300);
}

// Slider update functions
function updateWarpBrushSize(value: string | number): void {
    warpBrushSize = parseInt(String(value), 10);
    const label = document.getElementById('warpBrushValue');
    if (label) label.textContent = String(warpBrushSize);
    updateWarpCursor();
}

function updateWarpStrength(value: string | number): void {
    const val = parseInt(String(value), 10);
    warpStrength = val / 100;
    const label = document.getElementById('warpStrengthValue');
    if (label) label.textContent = String(val);
}

// Grid size slider updates
function updateWarpGridSize(value: string | number): void {
    warpGridSize = parseInt(String(value), 10);
    const label = document.getElementById('warpGridValue');
    if (label) label.textContent = String(warpGridSize);
}

// Tool Activate / Deactivate Toggle
function toggleWarpTool(): void {
    if (collageImages.length === 0) {
        showToast("Chọn ảnh trước", "warning");
        return;
    }
    if (collageImages.length > 1) {
        showToast("Liquify chỉ dùng cho 1 ảnh", "info");
        return;
    }

    if (!warpToolActive) {
        // Deactivate all other tools first
        if (typeof deactivateAllTools === 'function') {
            deactivateAllTools();
        }

        warpToolActive = true;
        const btn = document.getElementById('warpToolBtn');
        if (btn) {
            btn.classList.add('active');
            btn.style.backgroundColor = '#0dcaf0';
            btn.style.color = 'white';
        }

        if (singleImageCanvas && singleImageCtx) {
            if (singleImageCanvas.width > 3000 || singleImageCanvas.height > 3000) {
                showToast("Ảnh lớn, xử lý có thể chậm", "warning");
            }

            warpBaseImageData = singleImageCtx.getImageData(0, 0, singleImageCanvas.width, singleImageCanvas.height);
            warpCurrentImageData = new ImageData(
                new Uint8ClampedArray(warpBaseImageData.data),
                warpBaseImageData.width,
                warpBaseImageData.height
            );

            warpHistory = [
                new ImageData(
                    new Uint8ClampedArray(warpBaseImageData.data),
                    warpBaseImageData.width,
                    warpBaseImageData.height
                )
            ];
        }

        warpDirty = false;
        setupWarpListeners();
        showWarpSettings();
        showToast("Kéo nhẹ trên ảnh để Liquify", "success");
    } else {
        cancelWarpTool();
    }
}

// Apply current warp changes
function applyWarpTool(): void {
    if (!warpToolActive) return;
    if (!warpDirty) {
        showToast("Chưa có thay đổi", "info");
        return;
    }

    if (typeof saveCanvasState === 'function') {
        saveCanvasState();
    }

    commitWarpPreviewToCanvas();

    warpDirty = false;
    showToast("Đã áp dụng Liquify", "success");

    if (singleImageCanvas && singleImageCtx) {
        warpBaseImageData = singleImageCtx.getImageData(0, 0, singleImageCanvas.width, singleImageCanvas.height);
        warpCurrentImageData = new ImageData(
            new Uint8ClampedArray(warpBaseImageData.data),
            warpBaseImageData.width,
            warpBaseImageData.height
        );
        warpHistory = [
            new ImageData(
                new Uint8ClampedArray(warpBaseImageData.data),
                warpBaseImageData.width,
                warpBaseImageData.height
            )
        ];
    }
}

// Cancel warp changes and exit tool
function cancelWarpTool(): void {
    if (!warpToolActive) return;

    removeWarpListeners();
    hideWarpCursor();

    const btn = document.getElementById('warpToolBtn');
    if (btn) {
        btn.classList.remove('active');
        btn.style.backgroundColor = '';
        btn.style.color = '';
    }

    if (warpDirty && warpBaseImageData && singleImageCtx) {
        singleImageCtx.putImageData(warpBaseImageData, 0, 0);
    }

    warpToolActive = false;
    warpDirty = false;
    warpHistory = [];
    warpBaseImageData = null;
    warpCurrentImageData = null;

    hideWarpSettings();
    showToast("Đã tắt Liquify", "info");
}

// Revert preview to state when tool was opened
function resetWarpPreview(): void {
    if (!warpToolActive || !warpBaseImageData || !singleImageCtx) return;

    singleImageCtx.putImageData(warpBaseImageData, 0, 0);
    warpCurrentImageData = new ImageData(
        new Uint8ClampedArray(warpBaseImageData.data),
        warpBaseImageData.width,
        warpBaseImageData.height
    );
    warpHistory = [
        new ImageData(
            new Uint8ClampedArray(warpBaseImageData.data),
            warpBaseImageData.width,
            warpBaseImageData.height
        )
    ];
    warpDirty = false;
    showToast("Đã reset preview", "info");
}

// Event Listeners Setup
function setupWarpListeners(): void {
    if (!singleImageCanvas) return;

    singleImageCanvas.addEventListener('mousedown', startWarpDrag);
    window.addEventListener('mousemove', continueWarpDrag);
    window.addEventListener('mouseup', endWarpDrag);
    singleImageCanvas.addEventListener('mousemove', moveWarpCursor);
    singleImageCanvas.addEventListener('mouseleave', hideWarpCursor);

    // Support touch devices
    singleImageCanvas.addEventListener('touchstart', startWarpDrag, { passive: false });
    window.addEventListener('touchmove', continueWarpDrag, { passive: false });
    window.addEventListener('touchend', endWarpDrag, { passive: false });
}

function removeWarpListeners(): void {
    if (!singleImageCanvas) return;

    singleImageCanvas.removeEventListener('mousedown', startWarpDrag);
    window.removeEventListener('mousemove', continueWarpDrag);
    window.removeEventListener('mouseup', endWarpDrag);
    singleImageCanvas.removeEventListener('mousemove', moveWarpCursor);
    singleImageCanvas.removeEventListener('mouseleave', hideWarpCursor);

    singleImageCanvas.removeEventListener('touchstart', startWarpDrag);
    window.removeEventListener('touchmove', continueWarpDrag);
    window.removeEventListener('touchend', endWarpDrag);
}

// Drag & Drop event handling
function startWarpDrag(event: MouseEvent | TouchEvent): void {
    if (!warpToolActive) return;
    if (event.cancelable) event.preventDefault();

    isWarpDragging = true;
    const pt = getCanvasPoint(event);
    if (!pt) return;
    warpLastPoint = pt;

    if (!warpCurrentImageData && singleImageCtx && singleImageCanvas) {
        warpBaseImageData = singleImageCtx.getImageData(0, 0, singleImageCanvas.width, singleImageCanvas.height);
        warpCurrentImageData = new ImageData(
            new Uint8ClampedArray(warpBaseImageData.data),
            warpBaseImageData.width,
            warpBaseImageData.height
        );
    }
}

function continueWarpDrag(event: MouseEvent | TouchEvent): void {
    if (!warpToolActive || !isWarpDragging || !warpLastPoint) return;
    if (event.cancelable) event.preventDefault();

    const currentPoint = getCanvasPoint(event);
    if (!currentPoint) return;

    const dx = currentPoint.x - warpLastPoint.x;
    const dy = currentPoint.y - warpLastPoint.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.5) return;

    applyMeshWarpStroke(warpLastPoint, currentPoint);
    warpLastPoint = currentPoint;
    warpDirty = true;

    moveWarpCursor(event);
}

function endWarpDrag(): void {
    if (!isWarpDragging) return;
    isWarpDragging = false;
    warpLastPoint = null;

    if (warpCurrentImageData) {
        warpHistory.push(
            new ImageData(
                new Uint8ClampedArray(warpCurrentImageData.data),
                warpCurrentImageData.width,
                warpCurrentImageData.height
            )
        );
        if (warpHistory.length > 20) {
            warpHistory.shift();
        }
    }
}

// Coordinate conversions
function getCanvasPoint(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
    if (!singleImageCanvas) return null;
    const rect = singleImageCanvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;
    if (window.TouchEvent && event instanceof TouchEvent) {
        if (event.touches.length === 0) {
            const touch = event.changedTouches[0] || event.targetTouches[0];
            if (!touch) return null;
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        }
    } else {
        clientX = (event as MouseEvent).clientX;
        clientY = (event as MouseEvent).clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * singleImageCanvas.width;
    const y = ((clientY - rect.top) / rect.height) * singleImageCanvas.height;

    return { x, y };
}

// Cursor display updates
function ensureWarpCursor(): HTMLDivElement {
    if (!warpCursor) {
        warpCursor = document.createElement('div');
        warpCursor.className = 'warp-brush-cursor';
        document.body.appendChild(warpCursor);
    }
    updateWarpCursor();
    return warpCursor;
}

function updateWarpCursor(): void {
    if (!warpCursor || !singleImageCanvas) return;
    const rect = singleImageCanvas.getBoundingClientRect();
    const scale = rect.width > 0 && singleImageCanvas.width > 0 ? rect.width / singleImageCanvas.width : 1;
    const diameter = Math.max(4, warpBrushSize * 2 * scale);
    warpCursor.style.width = `${diameter}px`;
    warpCursor.style.height = `${diameter}px`;
}

function moveWarpCursor(event: MouseEvent | TouchEvent): void {
    if (!warpToolActive) return;
    const cursor = ensureWarpCursor();
    updateWarpCursor();

    let clientX = 0;
    let clientY = 0;
    if (window.TouchEvent && event instanceof TouchEvent) {
        if (event.touches.length === 0) return;
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        clientX = (event as MouseEvent).clientX;
        clientY = (event as MouseEvent).clientY;
    }

    cursor.style.left = `${clientX}px`;
    cursor.style.top = `${clientY}px`;
    cursor.style.display = 'block';

    if (singleImageCanvas) {
        singleImageCanvas.style.cursor = 'none';
    }
}

function hideWarpCursor(): void {
    if (warpCursor) {
        warpCursor.style.display = 'none';
    }
    if (singleImageCanvas) {
        singleImageCanvas.style.cursor = 'grab';
    }
}

// Local Mesh Warp Stroke Algorithm (Gaussian Falloff + Bilinear Interpolation)
function applyMeshWarpStroke(from: { x: number; y: number }, to: { x: number; y: number }): void {
    if (!warpCurrentImageData || !singleImageCanvas || !singleImageCtx) return;

    const width = warpCurrentImageData.width;
    const height = warpCurrentImageData.height;

    const dragX = to.x - from.x;
    const dragY = to.y - from.y;
    const dragLen = Math.hypot(dragX, dragY);
    if (dragLen < 0.5) return;

    const radius = warpBrushSize;
    const sigma = radius * 0.45;
    const strength = Math.min(0.60, warpStrength);

    const src = new ImageData(
        new Uint8ClampedArray(warpCurrentImageData.data),
        width,
        height
    );
    const out = new ImageData(
        new Uint8ClampedArray(warpCurrentImageData.data),
        width,
        height
    );

    const minX = Math.max(0, Math.floor(from.x - radius - Math.abs(dragX)));
    const maxX = Math.min(width - 1, Math.ceil(from.x + radius + Math.abs(dragX)));
    const minY = Math.max(0, Math.floor(from.y - radius - Math.abs(dragY)));
    const maxY = Math.min(height - 1, Math.ceil(from.y + radius + Math.abs(dragY)));

    renderWarpedPatch(src, out, from, dragX, dragY, radius, sigma, strength, minX, maxX, minY, maxY);

    warpCurrentImageData = out;
    singleImageCtx.putImageData(out, 0, 0);
}

// Helper to warp bounding box pixels
function renderWarpedPatch(
    src: ImageData,
    out: ImageData,
    from: { x: number; y: number },
    dragX: number,
    dragY: number,
    radius: number,
    sigma: number,
    strength: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
): void {
    const width = src.width;
    const height = src.height;

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const dx = x - from.x;
            const dy = y - from.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 > radius * radius) continue;

            const falloff = Math.exp(-dist2 / (2 * sigma * sigma));
            const moveX = dragX * falloff * strength;
            const moveY = dragY * falloff * strength;

            const srcX = x - moveX;
            const srcY = y - moveY;

            const rgba = bilinearSample(src.data, width, height, srcX, srcY);
            const idx = (y * width + x) * 4;
            out.data[idx] = rgba[0];
            out.data[idx + 1] = rgba[1];
            out.data[idx + 2] = rgba[2];
            out.data[idx + 3] = rgba[3];
        }
    }
}

// Bilinear Interpolation Sampling
function bilinearSample(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    y: number
): [number, number, number, number] {
    x = Math.max(0, Math.min(width - 1, x));
    y = Math.max(0, Math.min(height - 1, y));

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);

    const tx = x - x0;
    const ty = y - y0;

    const idx00 = (y0 * width + x0) * 4;
    const idx10 = (y0 * width + x1) * 4;
    const idx01 = (y1 * width + x0) * 4;
    const idx11 = (y1 * width + x1) * 4;

    const r = (1 - tx) * (1 - ty) * data[idx00] +
              tx * (1 - ty) * data[idx10] +
              (1 - tx) * ty * data[idx01] +
              tx * ty * data[idx11];

    const g = (1 - tx) * (1 - ty) * data[idx00 + 1] +
              tx * (1 - ty) * data[idx10 + 1] +
              (1 - tx) * ty * data[idx01 + 1] +
              tx * ty * data[idx11 + 1];

    const b = (1 - tx) * (1 - ty) * data[idx00 + 2] +
              tx * (1 - ty) * data[idx10 + 2] +
              (1 - tx) * ty * data[idx01 + 2] +
              tx * ty * data[idx11 + 2];

    const a = (1 - tx) * (1 - ty) * data[idx00 + 3] +
              tx * (1 - ty) * data[idx10 + 3] +
              (1 - tx) * ty * data[idx01 + 3] +
              tx * ty * data[idx11 + 3];

    return [r, g, b, a];
}

// Save warp state back to collageImages[0] and storage cache
function commitWarpPreviewToCanvas(): void {
    if (!singleImageCanvas) return;
    const dataUrl = singleImageCanvas.toDataURL("image/png");
    const img = new Image();
    img.onload = () => {
        collageImages[0] = img;
        if (window.ImageEditorStorage && window.ImageEditorStorage.saveImageToCache) {
            window.ImageEditorStorage.saveImageToCache([dataUrl], "collage");
        }
    };
    img.src = dataUrl;
}

// Local Ctrl+Z key listener for drawing strokes
document.addEventListener('keydown', function(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        if (warpToolActive) {
            event.preventDefault();
            event.stopPropagation();

            if (warpHistory.length > 1) {
                warpHistory.pop(); // Remove current state
                const prevState = warpHistory[warpHistory.length - 1];
                warpCurrentImageData = new ImageData(
                    new Uint8ClampedArray(prevState.data),
                    prevState.width,
                    prevState.height
                );
                if (singleImageCtx) {
                    singleImageCtx.putImageData(warpCurrentImageData, 0, 0);
                }
                warpDirty = true;
                showToast("Đã hoàn tác thao tác vẽ", "success");
            } else if (warpHistory.length === 1) {
                resetWarpPreview();
            } else {
                showToast("Không còn thao tác để hoàn tác", "info");
            }
        }
    }
});
