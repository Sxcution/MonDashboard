// Typed Image editor module: drag/drop/paste/upload.
// Keeps behavior compatible while the monolith is split into smaller files.

// ===== DRAG & DROP + PASTE IMAGES =====
function setupDragDropPaste() {
    const dropZone = document.body;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e: Event): void {
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

function handleDrop(e: DragEvent): void {
    const dt = e.dataTransfer;
    if (!dt) return;
    const files = Array.from(dt.files).filter(f => f.type.startsWith('image/'));
    
    if (files.length > 0) {
        processUploadedFiles(files);
    }
}

function handlePaste(e: ClipboardEvent): void {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    
    for (let item of items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) imageFiles.push(file);
        }
    }
    
    if (imageFiles.length > 0) {
        processUploadedFiles(imageFiles);
    }
}

function processUploadedFiles(files: File[]): void {
    deactivateAllTools();
    if (typeof resetObjectRemoveState === 'function') {
        resetObjectRemoveState();
    }
    textLayers = [];
    const textContainer = document.getElementById('textLayersContainer');
    if (textContainer) textContainer.innerHTML = '';
    collageImages = [];
    imageOffsets = [];
    imagePositions = [];
    const previewContainer = document.getElementById('uploadedPhotosPreview');
    previewContainer.innerHTML = '';
    
    const imageDataURLs: string[] = [];
    let loadedCount = 0;
    
    files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const dataUrl = String(event.target?.result || '');
            const img = new Image();
            img.onload = function() {
                collageImages.push(img);
                imageDataURLs.push(dataUrl);
                loadedCount++;
                
                // Add thumbnail
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
                    
                    if (files.length === 1) {
                        showSingleImageViewer(collageImages[0]);
                        showToast('Đã thêm 1 ảnh', 'success');
                    } else {
                        // Hide single image viewer when switching to collage
                        document.getElementById('singleImageViewer').style.display = 'none';
                        
                        previewContainer.style.display = 'flex';
                        showToast(`Đã thêm ${files.length} ảnh`, 'success');
                        renderLayoutTemplates();
                        const matchingLayout = layoutTemplates.find(l => l.maxPhotos === files.length);
                        if (matchingLayout) selectLayout(matchingLayout.id);
                    }
                    
                    saveImageToCache(imageDataURLs, 'collage');
                    saveToHistory(imageDataURLs);
                }
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    });
}

// ===== CLEAR ALL HISTORY =====
function clearAllHistory() {
    localStorage.removeItem(STORAGE_KEY_COLLAGE_HISTORY);
    loadCollageHistoryFromStorage();
    showToast('Đã xoá toàn bộ lịch sử', 'info');
}
