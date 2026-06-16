"use strict";
// Typed Image editor module: text layers.
// Keeps behavior compatible while the monolith is split into smaller files.
// ========== TEXT LAYER FUNCTIONS ==========
let textLayers = [];
let currentEditingLayer = null;
let textLayerCounter = 0;
let selectedTextRange = null;
const imageTextFonts = ['Georgia', 'Neorah', 'JuneVille', 'Grovana'];
function readEditableText(element) {
    return (element.innerText || element.textContent || '')
        .replace(/\r\n/g, '\n')
        .replace(/\u00a0/g, ' ')
        .trim();
}
function appendPlainTextWithBreaks(target, text) {
    const lines = text.split(/\r?\n/);
    lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) {
            target.appendChild(document.createElement('br'));
        }
        target.appendChild(document.createTextNode(line));
    });
}
function appendRainbowTextWithBreaks(target, text) {
    const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
    let colorIndex = 0;
    text.split(/\r?\n/).forEach((line, lineIndex) => {
        if (lineIndex > 0) {
            target.appendChild(document.createElement('br'));
        }
        for (const char of line) {
            const span = document.createElement('span');
            span.style.color = colors[colorIndex % colors.length];
            span.textContent = char;
            target.appendChild(span);
            colorIndex++;
        }
    });
}
function textLayerIsGradientFill(fill) {
    return /^linear-gradient\(/i.test((fill || '').trim());
}
function getTextLayerFill(layer) {
    return String(layer.fill || layer.color || '#ffffff');
}
function textLayerFirstColor(fill, fallback = '#ffffff') {
    return (fill || '').match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/)?.[0] || fill || fallback;
}
function applyTextLayerFillStyle(target, layer) {
    const fill = getTextLayerFill(layer);
    target.style.backgroundImage = '';
    target.style.backgroundClip = '';
    target.style.webkitBackgroundClip = '';
    target.style.webkitTextFillColor = '';
    if (textLayerIsGradientFill(fill)) {
        target.style.color = 'transparent';
        target.style.backgroundImage = fill;
        target.style.backgroundClip = 'text';
        target.style.webkitBackgroundClip = 'text';
        target.style.webkitTextFillColor = 'transparent';
    }
    else {
        target.style.color = fill;
    }
}
function toggleTextLayer() {
    // Deactivate other tools first
    deactivateAllTools();
    if (collageImages.length === 0) {
        showToast('Chọn ảnh trước', 'warning');
        return;
    }
    createNewTextLayer();
}
function createNewTextLayer() {
    textLayerCounter++;
    const layerId = `textLayer_${textLayerCounter}`;
    const textLayer = {
        id: layerId,
        text: 'Nhập Text',
        color: '#ffffff',
        fill: '#ffffff',
        rainbow: false,
        fontFamily: 'Georgia',
        x: 50, // percentage
        y: 50, // percentage
        fontSize: 32
    };
    textLayers.push(textLayer);
    renderTextLayer(textLayer, false); // false = don't auto edit, let user double-click
    // Show helpful hint on first text layer
    if (textLayers.length === 1) {
        showToast('Bấm đúp để sửa chữ, kéo để di chuyển, chuột phải để đổi tuỳ chọn', 'info');
    }
}
function renderTextLayer(layer, autoEdit = false) {
    const container = document.getElementById('textLayersContainer');
    // Remove old layer element if exists
    const oldElement = document.getElementById(layer.id);
    if (oldElement)
        oldElement.remove();
    const layerDiv = document.createElement('div');
    layerDiv.id = layer.id;
    layerDiv.className = 'text-layer-wrapper';
    layerDiv.style.cssText = `
        position: absolute;
        left: ${layer.x}%;
        top: ${layer.y}%;
        transform: translate(-50%, -50%);
        cursor: move;
        pointer-events: auto;
        z-index: 10;
        max-width: 80%;
        user-select: none;
    `;
    // Create text content
    const textContent = document.createElement('div');
    textContent.className = 'text-layer-content';
    textContent.style.cssText = `
        font-size: ${layer.fontSize}px;
        font-weight: bold;
        font-family: "${String(layer.fontFamily || 'Georgia').replace(/"/g, '')}", Georgia, serif;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        padding: 8px 12px;
        border: 2px solid transparent;
        transition: border 0.2s;
        pointer-events: auto;
        cursor: move;
        border-radius: 4px;
        white-space: pre-line;
    `;
    if (layer.rainbow) {
        appendRainbowTextWithBreaks(textContent, layer.text);
    }
    else {
        applyTextLayerFillStyle(textContent, layer);
        appendPlainTextWithBreaks(textContent, layer.text);
    }
    layerDiv.appendChild(textContent);
    // Hover effect
    layerDiv.onmouseenter = () => {
        if (textContent.contentEditable !== 'true') { // Only if not editing
            textContent.style.borderColor = 'rgba(13, 202, 240, 0.5)';
            textContent.style.backgroundColor = 'rgba(13, 202, 240, 0.1)';
        }
    };
    layerDiv.onmouseleave = () => {
        if (textContent.contentEditable !== 'true') { // Only if not editing
            textContent.style.borderColor = 'transparent';
            textContent.style.backgroundColor = 'transparent';
        }
    };
    // Double-click on wrapper or content to edit inline
    const enableEdit = (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log('Double-click detected on text layer:', layer.id);
        editTextLayerInline(layer.id);
    };
    layerDiv.ondblclick = enableEdit;
    textContent.ondblclick = enableEdit;
    // Right-click context menu for options
    layerDiv.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showTextContextMenu(e, layer.id);
    };
    // Drag functionality - MUST be on the wrapper
    makeDraggableText(layerDiv, layer);
    container.appendChild(layerDiv);
    // Auto-edit removed - user must double-click to edit
}
function editTextLayerInline(layerId) {
    console.log('editTextLayerInline called for:', layerId);
    const layer = textLayers.find(l => l.id === layerId);
    if (!layer) {
        console.error('Layer not found:', layerId);
        return;
    }
    const layerElement = document.getElementById(layerId);
    if (!layerElement) {
        console.error('Layer element not found:', layerId);
        return;
    }
    const textContent = layerElement.querySelector('.text-layer-content');
    if (!textContent) {
        console.error('Text content not found for:', layerId);
        return;
    }
    // Check if already editing
    if (textContent.contentEditable === 'true') {
        console.log('Already editing');
        textContent.focus();
        return;
    }
    console.log('Enabling contentEditable for direct editing');
    // LOCK image dragging while editing text
    lockImageDragging(true);
    // Make text content editable directly
    textContent.contentEditable = 'true';
    textContent.style.outline = '3px solid #0dcaf0';
    textContent.style.outlineOffset = '2px';
    textContent.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    textContent.style.cursor = 'text';
    textContent.style.zIndex = '1000'; // Bring to front
    // Store original HTML
    const originalHTML = textContent.innerHTML;
    // Clear rainbow formatting for editing (use plain text)
    if (layer.rainbow) {
        textContent.textContent = layer.text;
        textContent.style.color = '#ffffff';
    }
    textContent.style.backgroundImage = '';
    textContent.style.backgroundClip = '';
    textContent.style.webkitBackgroundClip = '';
    textContent.style.webkitTextFillColor = '';
    // Focus and select text
    textContent.focus();
    // Select all text
    setTimeout(() => {
        const range = document.createRange();
        range.selectNodeContents(textContent);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }, 10);
    // Function to save and exit edit mode
    const saveAndExit = () => {
        const newText = readEditableText(textContent);
        layer.text = newText || 'Bấm đúp để sửa';
        // Exit edit mode
        textContent.contentEditable = 'false';
        textContent.style.outline = 'none';
        textContent.style.backgroundColor = 'transparent';
        textContent.style.cursor = 'move';
        textContent.style.zIndex = '10'; // Reset z-index
        // UNLOCK image dragging
        lockImageDragging(false);
        // Re-render to apply rainbow if needed
        renderTextLayer(layer);
        showToast('Đã cập nhật chữ', 'success');
    };
    // Save on blur (click outside)
    textContent.onblur = saveAndExit;
    // Save on Escape key
    textContent.onkeydown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            textContent.blur();
        }
        e.stopPropagation();
    };
    // Prevent double-click while editing
    textContent.ondblclick = (e) => {
        e.stopPropagation();
    };
}
function showColorPicker(layerId) {
    const layer = textLayers.find(l => l.id === layerId);
    if (!layer)
        return;
    currentEditingLayer = layer;
    // Position toolbar near the text layer
    const layerElement = document.getElementById(layerId);
    const rect = layerElement.getBoundingClientRect();
    const toolbar = document.getElementById('textColorToolbar');
    toolbar.style.display = 'block';
    toolbar.style.left = Math.min(rect.left, window.innerWidth - 300) + 'px';
    toolbar.style.top = (rect.bottom + 10) + 'px';
    // Set current values
    document.getElementById('toolbarColorPicker').value = layer.color;
    document.getElementById('toolbarColorCode').value = layer.color;
    document.getElementById('toolbarRainbowMode').checked = layer.rainbow;
}
// OLD FUNCTIONS - KEPT FOR COMPATIBILITY (can be removed later)
function deleteTextLayer(layerId) {
    textLayers = textLayers.filter(l => l.id !== layerId);
    const element = document.getElementById(layerId);
    if (element)
        element.remove();
    showToast('Đã xoá chữ', 'success');
}
function showTextContextMenu(event, layerId) {
    event.preventDefault();
    event.stopPropagation();
    const layer = textLayers.find(l => l.id === layerId);
    if (!layer)
        return;
    currentEditingLayer = layer;
    // Close any open menus first
    closeAllMenus();
    // Show main context menu
    const contextMenu = document.getElementById('textContextMenu');
    contextMenu.style.display = 'block';
    contextMenu.style.left = event.clientX + 'px';
    contextMenu.style.top = event.clientY + 'px';
    // Setup submenu hover events
    setupSubmenuHovers(event.clientX, event.clientY);
    // Close menu on click outside
    setTimeout(() => {
        document.addEventListener('click', closeAllMenus);
    }, 100);
}
function setupSubmenuHovers(menuX, menuY) {
    const colorMenuItem = document.getElementById('colorMenuItem');
    const fontMenuItem = document.getElementById('fontMenuItem');
    const colorSubmenu = document.getElementById('colorSubmenu');
    const fontSubmenu = document.getElementById('fontSubmenu');
    const contextMenu = document.getElementById('textContextMenu');
    // Color submenu hover
    colorMenuItem.onmouseenter = () => {
        fontSubmenu.style.display = 'none';
        colorSubmenu.style.display = 'block';
        const rect = colorMenuItem.getBoundingClientRect();
        colorSubmenu.style.left = (rect.right + 5) + 'px';
        colorSubmenu.style.top = rect.top + 'px';
        // Populate preset colors
        populatePresetColors();
        // Set current values
        const colorInput = document.getElementById('colorCodeInput');
        const rainbowInput = document.getElementById('rainbowCheckbox');
        if (colorInput)
            colorInput.value = currentEditingLayer.color;
        if (rainbowInput)
            rainbowInput.checked = Boolean(currentEditingLayer.rainbow);
    };
    // Font submenu hover
    fontMenuItem.onmouseenter = () => {
        colorSubmenu.style.display = 'none';
        fontSubmenu.style.display = 'block';
        const rect = fontMenuItem.getBoundingClientRect();
        fontSubmenu.style.left = (rect.right + 5) + 'px';
        fontSubmenu.style.top = rect.top + 'px';
        // Populate font list
        populateFontList();
    };
    // Keep submenus open when hovering over them
    colorSubmenu.onmouseenter = () => {
        colorSubmenu.style.display = 'block';
    };
    fontSubmenu.onmouseenter = () => {
        fontSubmenu.style.display = 'block';
    };
}
function populatePresetColors() {
    const quickColors = [
        '#ffffff', '#111111', '#ff3b30', '#ff9500', '#ffcc00',
        '#34c759', '#00c7be', '#007aff', '#5856d6', '#af52de'
    ];
    const gradients = [
        'linear-gradient(90deg, #ff3b30, #ff9500, #ffcc00, #34c759, #00c7be, #007aff, #af52de)',
        'linear-gradient(135deg, #ffffff, #868e96, #111111)',
        'linear-gradient(135deg, #00f5a0, #00d9f5, #665dff)',
        'linear-gradient(135deg, #ff0844, #ffb199)',
        'linear-gradient(135deg, #f9d423, #ff4e50)',
        'linear-gradient(135deg, #4facfe, #00f2fe)',
        'linear-gradient(135deg, #43e97b, #38f9d7)',
        'linear-gradient(135deg, #fa709a, #fee140)',
        'linear-gradient(135deg, #30cfd0, #330867)',
        'linear-gradient(135deg, #667eea, #764ba2)'
    ];
    const container = document.getElementById('presetColors');
    container.innerHTML = `
        <div class="collage-color-section-title">Màu nhanh</div>
        <div class="collage-color-grid" data-text-color-grid></div>
        <div class="collage-color-section-title">Gradient</div>
        <div class="image-gradient-editor" data-gradient-editor="text">
            <div class="image-gradient-preview" id="textGradientPreview"></div>
            <div class="image-gradient-checkpoints">
                <input type="color" value="#1700d8" data-text-gradient-stop title="Điểm màu 1">
                <input type="color" value="#e7a62b" data-text-gradient-stop title="Điểm màu 2">
                <input type="color" value="#1600d8" data-text-gradient-stop title="Điểm màu 3">
            </div>
            <div class="image-color-action-row">
                <button type="button" class="image-modern-color-apply" data-text-gradient-apply>Áp dụng Gradient</button>
            </div>
        </div>
        <div class="collage-gradient-grid" data-text-gradient-grid></div>
    `;
    const colorGrid = container.querySelector('[data-text-color-grid]');
    const gradientGrid = container.querySelector('[data-text-gradient-grid]');
    quickColors.forEach(color => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'collage-fill-swatch color-preset';
        button.style.background = color;
        button.title = color;
        button.onclick = () => applyColor(color);
        colorGrid.appendChild(button);
    });
    gradients.forEach(gradient => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'collage-gradient-swatch color-preset';
        button.style.background = gradient;
        button.title = 'Gradient';
        button.onclick = () => applyColor(gradient);
        gradientGrid.appendChild(button);
    });
    const updatePreview = () => {
        const handles = Array.from(container.querySelectorAll('.gradient-checkpoint-handle'));
        if (handles.length === 0) {
            const stops = Array.from(container.querySelectorAll('[data-text-gradient-stop]')).map(input => input.value);
            const gradient = `linear-gradient(90deg, ${stops.join(', ')})`;
            const preview = document.getElementById('textGradientPreview');
            if (preview)
                preview.style.background = gradient;
            return gradient;
        }
        const stops = handles.map(handle => {
            const input = handle.querySelector('input');
            const percent = parseFloat(handle.style.left) || 0;
            return {
                color: input?.value || '#ffffff',
                percent: percent
            };
        });
        stops.sort((a, b) => a.percent - b.percent);
        const gradient = `linear-gradient(90deg, ${stops.map(s => `${s.color} ${Math.round(s.percent)}%`).join(', ')})`;
        const preview = document.getElementById('textGradientPreview');
        if (preview)
            preview.style.background = gradient;
        return gradient;
    };
    container.querySelectorAll('[data-text-gradient-stop]').forEach(input => {
        input.addEventListener('input', updatePreview);
    });
    const textGradientEditor = container.querySelector('[data-gradient-editor="text"]');
    if (textGradientEditor && window.initializeGradientEditor) {
        window.initializeGradientEditor(textGradientEditor, updatePreview);
    }
    const gradientButton = container.querySelector('[data-text-gradient-apply]');
    gradientButton?.addEventListener('click', () => applyColor(updatePreview()));
    const customRow = document.querySelector('#colorSubmenu .image-inline-47');
    if (customRow && !customRow.querySelector('[data-text-custom-fill]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'image-modern-color-apply';
        button.dataset.textCustomFill = 'true';
        button.textContent = 'Áp dụng mã';
        button.addEventListener('click', applyCustomColor);
        customRow.appendChild(button);
    }
    updatePreview();
}
function populateFontList() {
    const container = document.getElementById('fontList');
    container.innerHTML = '';
    imageTextFonts.forEach(font => {
        const div = document.createElement('div');
        div.className = 'font-item';
        div.textContent = font;
        div.style.fontFamily = `"${font}", Georgia, serif`;
        div.onclick = () => applyFont(font);
        container.appendChild(div);
    });
}
function applyColor(color) {
    if (!currentEditingLayer)
        return;
    currentEditingLayer.fill = color;
    currentEditingLayer.color = textLayerIsGradientFill(color) ? textLayerFirstColor(color) : color;
    currentEditingLayer.rainbow = false;
    renderTextLayer(currentEditingLayer);
    showToast('Đã đổi màu', 'success');
    closeAllMenus();
}
function applyTextFillFromCollagePanel(fill) {
    const targetLayer = currentEditingLayer || textLayers[textLayers.length - 1];
    if (!targetLayer)
        return false;
    currentEditingLayer = targetLayer;
    targetLayer.fill = fill;
    targetLayer.color = textLayerIsGradientFill(fill) ? textLayerFirstColor(fill) : fill;
    targetLayer.rainbow = false;
    renderTextLayer(targetLayer);
    return true;
}
function applyCustomColor() {
    const input = document.getElementById('colorCodeInput');
    let color = input.value.trim();
    // Add # if missing
    if (!color.startsWith('#')) {
        color = '#' + color;
    }
    // Validate hex color
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
        showToast('Mã màu không hợp lệ. Dùng dạng #FFFFFF', 'warning');
        return;
    }
    applyColor(color);
}
function applyRainbowMode(enabled) {
    if (!currentEditingLayer)
        return;
    currentEditingLayer.rainbow = enabled;
    if (!enabled) {
        // Use current color when disabling rainbow
        currentEditingLayer.color = document.getElementById('colorCodeInput').value || '#FFFFFF';
        currentEditingLayer.fill = currentEditingLayer.color;
    }
    renderTextLayer(currentEditingLayer);
    showToast(enabled ? 'Đã bật màu cầu vồng' : 'Đã tắt màu cầu vồng', 'success');
}
function applyFont(font) {
    if (!currentEditingLayer)
        return;
    currentEditingLayer.fontFamily = font;
    renderTextLayer(currentEditingLayer);
    showToast(`Đã đổi font sang ${font}`, 'success');
    closeAllMenus();
}
function deleteCurrentTextLayer() {
    if (!currentEditingLayer)
        return;
    textLayers = textLayers.filter(l => l.id !== currentEditingLayer.id);
    const element = document.getElementById(currentEditingLayer.id);
    if (element)
        element.remove();
    showToast('Đã xoá chữ', 'success');
    closeAllMenus();
    currentEditingLayer = null;
}
function closeAllMenus() {
    ['textContextMenu', 'colorSubmenu', 'fontSubmenu'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.querySelectorAll('input, textarea').forEach(input => input.blur());
            el.style.display = 'none';
        }
    });
    document.removeEventListener('click', closeAllMenus);
}
function makeDraggableText(element, layer) {
    let isDragging = false;
    let startX, startY;
    let dragStartTime = 0;
    element.onpointerdown = (e) => {
        // Check if text is being edited
        const textContent = element.querySelector('.text-layer-content');
        if (textContent && textContent.contentEditable === 'true') {
            return; // Don't drag while editing
        }
        // Don't start drag on double-click
        if (e.detail === 2) {
            return;
        }
        isDragging = true;
        dragStartTime = Date.now();
        startX = e.clientX;
        startY = e.clientY;
        element.style.cursor = 'grabbing';
        // Add visual feedback
        if (textContent) {
            textContent.style.borderColor = 'rgba(13, 202, 240, 0.8)';
            textContent.style.borderWidth = '3px';
        }
        e.preventDefault();
        e.stopPropagation();
    };
    document.onpointermove = (e) => {
        if (!isDragging)
            return;
        const container = document.getElementById('textLayersContainer');
        const rect = container.getBoundingClientRect();
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        layer.x += (deltaX / rect.width) * 100;
        layer.y += (deltaY / rect.height) * 100;
        // Clamp values
        layer.x = Math.max(5, Math.min(95, layer.x));
        layer.y = Math.max(5, Math.min(95, layer.y));
        element.style.left = layer.x + '%';
        element.style.top = layer.y + '%';
        startX = e.clientX;
        startY = e.clientY;
    };
    document.onpointerup = (e) => {
        if (isDragging) {
            element.style.cursor = 'move';
            isDragging = false;
            // Reset border after drag
            const textContent = element.querySelector('.text-layer-content');
            if (textContent) {
                textContent.style.borderWidth = '2px';
            }
        }
    };
}
