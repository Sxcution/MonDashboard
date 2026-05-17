// Typed Image editor module: collage layout/rendering.
// Keeps behavior compatible while the monolith is split into smaller files.

// ===== LOCKED DRAG WITH OBJECT-POSITION =====
function bindLockedDrag(img: HTMLImageElement, imageIndex?: number): void {
    if (!img) return;
    img.setAttribute('draggable', 'false');  // cháº·n drag máº·c Ä‘á»‹nh cá»§a trÃ¬nh duyá»‡t
    img.style.cursor = 'grab';

    let dragging = false;
    let startX = 0, startY = 0;
    let startPosX = 50, startPosY = 50; // object-position ban Ä‘áº§u (%)

    img.addEventListener('pointerdown', (e) => {
        // Don't allow dragging if locked (editing text)
        if (isImageDraggingLocked) {
            console.log('â›” Image drag blocked - text editing in progress');
            return;
        }
        
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        // Láº¥y object-position hiá»‡n táº¡i
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
        if (!dragging) return;
        
        const rect = img.getBoundingClientRect();
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        // Chuyá»ƒn delta pixel sang % dá»±a trÃªn kÃ­ch thÆ°á»›c tile
        const deltaXPercent = (deltaX / rect.width) * 100;
        const deltaYPercent = (deltaY / rect.height) * 100;
        
        // TÃ­nh vá»‹ trÃ­ má»›i (kÃ©o chuá»™t pháº£i = áº£nh sang pháº£i, kÃ©o lÃªn = áº£nh lÃªn)
        let newX = startPosX + deltaXPercent;
        let newY = startPosY + deltaYPercent;
        
        // Clamp 0â€“100% Ä‘á»ƒ khÃ´ng bao giá» há»Ÿ ná»n
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
// Preload áº£nh: tráº£ vá» HTMLImageElement Ä‘Ã£ sáºµn sÃ ng
async function loadImage(src: string): Promise<HTMLImageElement> {
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
function getCellsForLayout(layoutKey: string, W: number, H: number, gutter: number): ImageCanvasCell[] {
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
                { x: 0,        y: 0,      w: colW, h: halfH },        // left-top
                { x: 0,        y: halfH+g,w: colW, h: H - halfH - g },// left-bottom
                { x: colW+g,   y: 0,      w: rightW, h: H }           // right full
            ];
        }
        case 'R2_L1':
        case 'layout-3-right': {
            const colW = Math.floor((W - g) / 2);
            const leftW = W - g - colW;
            const halfH = Math.floor((H - g) / 2);
            return [
                { x: 0,        y: 0,      w: leftW, h: H },           // left full
                { x: leftW+g,  y: 0,      w: colW, h: halfH },        // right-top
                { x: leftW+g,  y: halfH+g,w: colW, h: H - halfH - g } // right-bottom
            ];
        }
        case 'T2_B1':
        case 'layout-3-top': {
            const rowH = Math.floor((H - g) / 2);
            const topH = rowH, botH = H - g - rowH;
            const halfW = Math.floor((W - g) / 2);
            return [
                { x: 0,      y: 0,     w: halfW,   h: topH },         // top-left
                { x: halfW+g,y: 0,     w: W - halfW - g, h: topH },   // top-right
                { x: 0,      y: topH+g,w: W,       h: botH }          // bottom full
            ];
        }
        case 'B2_T1':
        case 'layout-3-bottom': {
            const rowH = Math.floor((H - g) / 2);
            const topH = H - g - rowH, botH = rowH;
            const halfW = Math.floor((W - g) / 2);
            return [
                { x: 0,      y: 0,     w: W,       h: topH },         // top full
                { x: 0,      y: topH+g,w: halfW,   h: botH },         // bottom-left
                { x: halfW+g,y: topH+g,w: W - halfW - g, h: botH }    // bottom-right
            ];
        }
        case 'layout-3h':
        case 'layout-3-horizontal':
        default: { // 3 cá»™t (fallback)
            const colW = Math.floor((W - 2*g)/3);
            return [
                { x: 0,         y: 0, w: colW,     h: H },
                { x: colW+g,    y: 0, w: colW,     h: H },
                { x: 2*(colW+g),y: 0, w: W - 2*(colW+g) - colW, h: H }
            ];
        }
    }
}

// Clamp offset Ä‘á»ƒ khÃ´ng bao giá» há»Ÿ ná»n (cover logic)
function clampOffsetForCover(imgW: number, imgH: number, cellW: number, cellH: number, off: ImagePoint) {
    const imgAspect = imgW / imgH;
    const cellAspect = cellW / cellH;

    // KÃ­ch thÆ°á»›c váº½ theo cover
    let drawW, drawH;
    if (imgAspect > cellAspect) {
        drawH = cellH;
        drawW = Math.ceil(cellH * imgAspect);
    } else {
        drawW = cellW;
        drawH = Math.ceil(cellW / imgAspect);
    }
    // Pháº§n "dÆ°" Ä‘á»ƒ cÃ³ thá»ƒ pan mÃ  váº«n cover
    const overflowX = Math.max(0, drawW - cellW);
    const overflowY = Math.max(0, drawH - cellH);

    return {
        x: Math.min( overflowX/2, Math.max(-overflowX/2, off.x || 0) ),
        y: Math.min( overflowY/2, Math.max(-overflowY/2, off.y || 0) ),
        drawW, drawH
    };
}

// ===== PHOTO COLLAGE TAB VARIABLES =====
let collageCanvas = document.getElementById('collageCanvas') as HTMLCanvasElement;
let collageCtx = collageCanvas.getContext('2d') as CanvasRenderingContext2D;
let collageImages: HTMLImageElement[] = [];
let selectedLayout: string | null = null;

// Image position offsets for manual adjustment
let imageOffsets: ImagePoint[] = []; // Array of {x: 0, y: 0} for each image

// Store object-position for each image (to persist across re-renders)
let imagePositions: ImagePoint[] = []; // Array of {x: 50, y: 50} (percentage)

// Current images and layout for canvas redraw
let currentImages: string[] = [];
let currentLayoutKey: string | null = null;

// Drag state
let isDragging = false;
let dragImageIndex = -1;
let dragStartX = 0;
let dragStartY = 0;
let dragInitialOffsetX = 0;
let dragInitialOffsetY = 0;

// Layout templates definitions - [col, row, colSpan, rowSpan]
const layoutTemplates: ImageLayoutTemplate[] = [
    // === 1 PHOTO ===
    { id: 'layout-1', name: '1 ảnh', cols: 1, rows: 1, maxPhotos: 1, cells: [[0,0,1,1]] },
    
    // === 2 PHOTOS ===
    { id: 'layout-2h', name: '2 ảnh ngang', cols: 2, rows: 1, maxPhotos: 2, cells: [[0,0,1,1], [1,0,1,1]] },
    { id: 'layout-2v', name: '2 ảnh dọc', cols: 1, rows: 2, maxPhotos: 2, cells: [[0,0,1,1], [0,1,1,1]] },
    
    // === 3 PHOTOS ===
    { id: 'layout-3h', name: '3 ảnh ngang', cols: 3, rows: 1, maxPhotos: 3, cells: [[0,0,1,1], [1,0,1,1], [2,0,1,1]] },
    { id: 'layout-3v', name: '3 ảnh dọc', cols: 1, rows: 3, maxPhotos: 3, cells: [[0,0,1,1], [0,1,1,1], [0,2,1,1]] },
    { id: 'layout-3-left', name: '3 ảnh trái lớn', cols: 2, rows: 2, maxPhotos: 3, cells: [[0,0,1,2], [1,0,1,1], [1,1,1,1]] },
    { id: 'layout-3-right', name: '3 ảnh phải lớn', cols: 2, rows: 2, maxPhotos: 3, cells: [[0,0,1,1], [0,1,1,1], [1,0,1,2]] },
    { id: 'layout-3-top', name: '3 ảnh trên lớn', cols: 2, rows: 2, maxPhotos: 3, cells: [[0,0,2,1], [0,1,1,1], [1,1,1,1]] },
    { id: 'layout-3-bottom', name: '3 ảnh dưới lớn', cols: 2, rows: 2, maxPhotos: 3, cells: [[0,0,1,1], [1,0,1,1], [0,1,2,1]] },
    
    // === 4 PHOTOS ===
    { id: 'layout-4-grid', name: '4 ảnh lưới 2x2', cols: 2, rows: 2, maxPhotos: 4, cells: [[0,0,1,1], [1,0,1,1], [0,1,1,1], [1,1,1,1]] },
    { id: 'layout-4h', name: '4 ảnh ngang', cols: 4, rows: 1, maxPhotos: 4, cells: [[0,0,1,1], [1,0,1,1], [2,0,1,1], [3,0,1,1]] },
    { id: 'layout-4v', name: '4 ảnh dọc', cols: 1, rows: 4, maxPhotos: 4, cells: [[0,0,1,1], [0,1,1,1], [0,2,1,1], [0,3,1,1]] },
    { id: 'layout-4-left', name: '4 ảnh trái lớn', cols: 2, rows: 3, maxPhotos: 4, cells: [[0,0,1,3], [1,0,1,1], [1,1,1,1], [1,2,1,1]] },
    { id: 'layout-4-right', name: '4 ảnh phải lớn', cols: 2, rows: 3, maxPhotos: 4, cells: [[0,0,1,1], [0,1,1,1], [0,2,1,1], [1,0,1,3]] },
    { id: 'layout-4-top', name: '4 ảnh trên lớn', cols: 3, rows: 2, maxPhotos: 4, cells: [[0,0,3,1], [0,1,1,1], [1,1,1,1], [2,1,1,1]] },
    { id: 'layout-4-bottom', name: '4 ảnh dưới lớn', cols: 3, rows: 2, maxPhotos: 4, cells: [[0,0,1,1], [1,0,1,1], [2,0,1,1], [0,1,3,1]] },
    { id: 'layout-4-center', name: '4 ảnh giữa lớn', cols: 3, rows: 3, maxPhotos: 4, cells: [[0,0,1,1], [2,0,1,1], [1,1,1,1], [0,2,1,1]] },
    
    // === 5 PHOTOS ===
    { id: 'layout-5h', name: '5 ảnh ngang', cols: 5, rows: 1, maxPhotos: 5, cells: [[0,0,1,1], [1,0,1,1], [2,0,1,1], [3,0,1,1], [4,0,1,1]] },
    { id: 'layout-5v', name: '5 ảnh dọc', cols: 1, rows: 5, maxPhotos: 5, cells: [[0,0,1,1], [0,1,1,1], [0,2,1,1], [0,3,1,1], [0,4,1,1]] },
    { id: 'layout-5-left', name: '5 ảnh trái lớn', cols: 3, rows: 2, maxPhotos: 5, cells: [[0,0,1,2], [1,0,1,1], [2,0,1,1], [1,1,1,1], [2,1,1,1]] },
    { id: 'layout-5-right', name: '5 ảnh phải lớn', cols: 3, rows: 2, maxPhotos: 5, cells: [[0,0,1,1], [1,0,1,1], [0,1,1,1], [1,1,1,1], [2,0,1,2]] },
    { id: 'layout-5-top2', name: '5 ảnh trên 2 ô', cols: 3, rows: 2, maxPhotos: 5, cells: [[0,0,2,1], [2,0,1,1], [0,1,1,1], [1,1,1,1], [2,1,1,1]] },
    { id: 'layout-5-top3', name: '5 ảnh trên 3 ô', cols: 3, rows: 2, maxPhotos: 5, cells: [[0,0,1,1], [1,0,1,1], [2,0,1,1], [0,1,2,1], [2,1,1,1]] },
    { id: 'layout-5-center', name: '5 ảnh giữa lớn', cols: 3, rows: 3, maxPhotos: 5, cells: [[0,0,1,1], [2,0,1,1], [1,1,1,1], [0,2,1,1], [2,2,1,1]] },
    { id: 'layout-5-grid', name: '5 ảnh lưới mix', cols: 3, rows: 2, maxPhotos: 5, cells: [[0,0,1,1], [1,0,1,1], [2,0,1,1], [0,1,1,1], [1,1,2,1]] },
    
    // === 6 PHOTOS ===
    { id: 'layout-6-grid', name: '6 ảnh lưới 2x3', cols: 3, rows: 2, maxPhotos: 6, cells: [[0,0,1,1], [1,0,1,1], [2,0,1,1], [0,1,1,1], [1,1,1,1], [2,1,1,1]] },
    { id: 'layout-6h', name: '6 ảnh ngang', cols: 6, rows: 1, maxPhotos: 6, cells: [[0,0,1,1], [1,0,1,1], [2,0,1,1], [3,0,1,1], [4,0,1,1], [5,0,1,1]] },
    { id: 'layout-6v', name: '6 ảnh dọc', cols: 1, rows: 6, maxPhotos: 6, cells: [[0,0,1,1], [0,1,1,1], [0,2,1,1], [0,3,1,1], [0,4,1,1], [0,5,1,1]] },
    
    // === 9 PHOTOS ===
    { id: 'layout-9-grid', name: '9 ảnh lưới 3x3', cols: 3, rows: 3, maxPhotos: 9, cells: [[0,0,1,1], [1,0,1,1], [2,0,1,1], [0,1,1,1], [1,1,1,1], [2,1,1,1], [0,2,1,1], [1,2,1,1], [2,2,1,1]] }
];

// Update slider values display and trigger collage update
document.getElementById('collageGutter').addEventListener('input', function(e) {
    document.getElementById('gutterValue2').textContent = (e.target as HTMLInputElement).value;
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});

document.getElementById('collageRadius').addEventListener('input', function(e) {
    document.getElementById('radiusValue2').textContent = (e.target as HTMLInputElement).value;
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});

document.getElementById('collageBorder').addEventListener('input', function(e) {
    document.getElementById('borderValue2').textContent = (e.target as HTMLInputElement).value;
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});

// Auto-update collage when settings change
document.getElementById('collageAspect').addEventListener('change', function() {
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});

document.getElementById('collageBorderColor').addEventListener('change', function() {
    if (selectedLayout && collageImages.length > 0) {
        createCollageWithLayout();
    }
});

document.getElementById('collageBackground').addEventListener('change', function() {
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
    const layout = layoutTemplates.find(l => l.id === layoutId);
    if (!layout) return;
    
    selectedLayout = layoutId;
    renderLayoutTemplates();
    
    if (collageImages.length > 0) {
        createCollageWithLayout();
    }
}

document.getElementById('collageUpload').addEventListener('change', function(e) {
    const files = Array.from((e.target as HTMLInputElement).files || []);
    if (files.length === 0) return;
    
    collageImages = [];
    imageOffsets = [];
    imagePositions = []; // Reset saved positions
    const previewContainer = document.getElementById('uploadedPhotosPreview');
    previewContainer.innerHTML = '';
    
    const imageDataURLs: string[] = []; // Store for caching
    let loadedCount = 0;
    
    files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const dataUrl = String(event.target?.result || '');
            const img = new Image();
            img.onload = function() {
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
                    } else {
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
    const borderColor = document.getElementById('collageBorderColor').value;
    const backgroundColor = document.getElementById('collageBackground').value;
    
    const collageTiles = document.getElementById('collage-tiles');
    
    // Get current layout
    const layout = layoutTemplates.find(l => l.id === selectedLayout);
    if (!layout) return;
    
    // --- Get aspect ratio from selector ---
    const aspect = document.getElementById('collageAspect').value;
    const [arW, arH] = aspect.split(':').map(Number);

    // --- Calculate height based on actual width of #collage-tiles ---
    const tiles = document.getElementById('collage-tiles');
    const maxW = tiles.parentElement.clientWidth;
    const innerW = Math.max(320, maxW - gutter*2);
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
        if (index >= collageImages.length) return; // Don't create tile if no image
        
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
        } else {
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
        showToast('Chọn ảnh và bố cục trước', 'warning');
        return;
    }
    
    const layout = layoutTemplates.find(l => l.id === selectedLayout);
    if (!layout) return;
    
    // ===== USE HTML/CSS GRID FOR ALL LAYOUTS =====
    // HTML tiles work perfectly for all layouts (2, 3, 4, 9 photos)
    createHTMLCollage();
}

// New async canvas collage function
async function createCanvasCollage(images: string[], layoutKey: string): Promise<void> {
    // Save for drag redraw
    currentImages = images;
    currentLayoutKey = layoutKey;
    
    // 1) KÃ­ch thÆ°á»›c canvas theo tá»· lá»‡ chá»n
    const aspect = document.getElementById('collageAspect').value; // '1:1','3:4','4:5','16:9'
    const [arW, arH] = aspect.split(':').map(Number);
    const base = 1080; // cáº¡nh dÃ i Ä‘á»ƒ xuáº¥t nÃ©t
    const CW = arW >= arH ? base : Math.round(base * (arW/arH));
    const CH = arH >= arW ? base : Math.round(base * (arH/arW));

    collageCanvas.width  = CW;
    collageCanvas.height = CH;

    const gutter = parseInt(document.getElementById('collageGutter').value || '0', 10);
    const radius = parseInt(document.getElementById('collageRadius').value || '0', 10);
    const border = parseInt(document.getElementById('collageBorder').value || '0', 10);
    const borderColor = document.getElementById('collageBorderColor').value || '#ff3b30';
    const backgroundColor = document.getElementById('collageBackground').value || '#111111';

    // 2) Preload áº£nh (fix lá»—i "chá»‰ 1 áº£nh")
    const imgs = await Promise.all(images.map(src => loadImage(src)));

    // 3) TÃ­nh cell theo layout
    const cells = getCellsForLayout(layoutKey, CW, CH, gutter);
    // náº¿u sá»‘ cell Ã­t hÆ¡n sá»‘ áº£nh, chá»‰ láº¥y áº£nh Ä‘áº§u; náº¿u nhiá»u hÆ¡n thÃ¬ láº·p láº¡i áº£nh cuá»‘i
    const n = Math.min(cells.length, imgs.length);

    collageCtx.clearRect(0,0,CW,CH);
    
    // Fill background
    collageCtx.fillStyle = backgroundColor;
    collageCtx.fillRect(0, 0, CW, CH);

    for (let i = 0; i < n; i++) {
        const {x,y,w,h} = cells[i];
        const im = imgs[i];

        // 3a) chuáº©n bá»‹ cover + clamp offset
        const offRaw = imageOffsets[i] || {x:0,y:0};
        const {x:offX, y:offY, drawW, drawH} = clampOffsetForCover(im.width, im.height, w, h, offRaw);

        // 3b) toáº¡ Ä‘á»™ váº½ sao cho áº£nh váº«n cover cell
        const drawX = x + Math.round((w - drawW)/2 + offX);
        const drawY = y + Math.round((h - drawH)/2 + offY);

        // 3c) clip trÃ²n gÃ³c + váº½
        collageCtx.save();
        if (radius > 0) {
            const r = Math.min(radius, Math.min(w,h)/2 - 1);
            const p = new Path2D();
            p.moveTo(x+r,y);
            p.arcTo(x+w,y,x+w,y+h,r);
            p.arcTo(x+w,y+h,x,y+h,r);
            p.arcTo(x,y+h,x,y,r);
            p.arcTo(x,y,x+w,y,r);
            p.closePath();
            collageCtx.clip(p);
        } else {
            collageCtx.beginPath();
            collageCtx.rect(x,y,w,h);
            collageCtx.clip();
        }

        collageCtx.drawImage(im, drawX, drawY, drawW, drawH);
        collageCtx.restore();

        // 3d) Border cell (váº½ Ä‘Ãºng nÃ©t, khÃ´ng *2)
        if (border > 0) {
            collageCtx.save();
            collageCtx.lineWidth = border;
            collageCtx.strokeStyle = borderColor;
            const inset = border/2;
            collageCtx.beginPath();
            if (radius > 0) {
                const r = Math.max(0, Math.min(radius - inset, Math.min(w,h)/2 - inset));
                const p2 = new Path2D();
                p2.moveTo(x+inset+r, y+inset);
                p2.arcTo(x+w-inset, y+inset,   x+w-inset, y+h-inset, r);
                p2.arcTo(x+w-inset, y+h-inset, x+inset,   y+h-inset, r);
                p2.arcTo(x+inset,   y+h-inset, x+inset,   y+inset,   r);
                p2.arcTo(x+inset,   y+inset,   x+w-inset, y+inset,   r);
                p2.closePath();
                collageCtx.stroke(p2);
            } else {
                collageCtx.strokeRect(x+inset, y+inset, w-border, h-border);
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
function enableCanvasDrag(cells: ImageCanvasCell[]): void {
    let active = -1;
    let start = {x:0, y:0};
    
    collageCanvas.onpointerdown = (e) => {
        const rect = collageCanvas.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (collageCanvas.width / rect.width);
        const cy = (e.clientY - rect.top)  * (collageCanvas.height / rect.height);
        // chá»n cell Ä‘ang click
        active = cells.findIndex(({x,y,w,h}) => cx>=x && cx<=x+w && cy>=y && cy<=y+h);
        start = {x:cx, y:cy};
        if (collageCanvas.setPointerCapture) {
            collageCanvas.setPointerCapture(e.pointerId);
        }
    };
    
    collageCanvas.onpointermove = (e) => {
        if (active < 0) return;
        const rect = collageCanvas.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (collageCanvas.width / rect.width);
        const cy = (e.clientY - rect.top)  * (collageCanvas.height / rect.height);
        const dx = cx - start.x, dy = cy - start.y;
        start = {x:cx, y:cy};
        imageOffsets[active] = imageOffsets[active] || {x:0, y:0};
        imageOffsets[active].x += dx;
        imageOffsets[active].y += dy;

        // váº½ láº¡i (clamp sáº½ Ã¡p trong createCanvasCollage)
        if (currentImages && currentLayoutKey) {
            createCanvasCollage(currentImages, currentLayoutKey);
        }
    };
    
    const end = () => { active = -1; };
    collageCanvas.onpointerup = end;
    collageCanvas.onpointercancel = end;
}
