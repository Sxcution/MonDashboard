"use strict";
// Typed Notes rich-editor island. Kept as one closure for behavior compatibility.
function initNotesDashboardTab() {
    if (window.__notesDashboardTabInitialized)
        return;
    const notesPane = document.getElementById('notes-tool-pane');
    if (!notesPane)
        return;
    window.__notesDashboardTabInitialized = true;
    const asElement = (target) => target instanceof Element ? target : null;
    const notesConfigEl = document.getElementById('notes-config');
    const notesApi = {
        getNotesUrl: notesConfigEl?.dataset.getNotesUrl || '/notes/api/get',
        addNoteUrl: notesConfigEl?.dataset.addNoteUrl || '/notes/api/add',
        updateNoteBase: notesConfigEl?.dataset.updateNoteBase || '/notes/api/update/',
        deleteNoteBase: notesConfigEl?.dataset.deleteNoteBase || '/notes/api/delete/',
        toggleMarkBase: notesConfigEl?.dataset.toggleMarkBase || '/notes/api/mark/'
    };
    const notesClient = window.NotesApiFactory?.fromConfig(notesApi);
    async function loadNotesFromApi() {
        if (notesClient)
            return notesClient.getNotes();
        const response = await fetch(notesApi.getNotesUrl);
        if (!response.ok)
            throw new Error(`Server error: ${response.status}`);
        return response.json();
    }
    async function updateNoteOnServer(noteId, payload) {
        if (notesClient)
            return notesClient.updateNote(noteId, payload);
        const response = await fetch(`${notesApi.updateNoteBase}${noteId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok)
            throw new Error('Save failed');
        return response.json();
    }
    async function saveModalNote(id, payload) {
        if (notesClient) {
            return id ? notesClient.updateNote(id, payload) : notesClient.addNote(payload);
        }
        const url = id ? `${notesApi.updateNoteBase}${id}` : notesApi.addNoteUrl;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok)
            throw new Error('Save failed');
        return response.json();
    }
    async function deleteNoteOnServer(noteId, method = 'POST') {
        if (notesClient)
            return notesClient.deleteNote(noteId, method);
        const response = await fetch(`${notesApi.deleteNoteBase}${noteId}`, { method });
        if (!response.ok)
            throw new Error('Delete failed');
        return response.json().catch(() => ({}));
    }
    async function toggleNoteMarkOnServer(noteId) {
        if (notesClient)
            return notesClient.toggleMark(noteId);
        const response = await fetch(`${notesApi.toggleMarkBase}${noteId}`, { method: 'POST' });
        if (!response.ok)
            throw new Error('Server error');
        return response.json().catch(() => ({}));
    }
    document.querySelectorAll('[data-color]').forEach((el) => {
        const color = el.dataset?.color;
        if (color)
            el.style.setProperty('--notes-swatch-color', color);
    });
    // --- DOM Elements ---
    const container = document.getElementById('notes-container');
    const searchInput = document.getElementById('notes-search-input');
    const listWrapper = document.getElementById('notes-list-wrapper');
    const detailWrapper = document.getElementById('notes-detail-wrapper');
    // Modal Elements
    const modalEl = document.getElementById('notes-addEditModal');
    const notesModal = new bootstrap.Modal(modalEl);
    const form = document.getElementById('notes-addEditForm');
    const modalTitle = document.getElementById('notes-modalTitle');
    const editIdInput = document.getElementById('notes-editId');
    const titleInput = document.getElementById('notes-title-input');
    const contentEditor = document.getElementById('notes-content-editor');
    // Context Menu Elements
    const noteCardMenu = document.getElementById('note-card-context-menu');
    const editorContextMenu = document.getElementById('notes-context-menu');
    const notesTabMenu = document.getElementById('notes-tab-context-menu');
    // === SMART CONTEXT MENU (port từ MXH sang Notes) ===
    // Note: positionContextMenuSmart & positionAllSubmenusForMenu đã được di chuyển sang script.js (global)
    // Hiển thị menu theo vị trí chuột, dùng smart flip.
    // Tự xử lý menu kiểu .custom-context-menu
    function showSmartMenu(menu, x, y) {
        if (!menu)
            return;
        // 1) Đảm bảo menu nằm trực tiếp trong <body> để né overflow/transform stacking
        if (menu.parentNode !== document.body) {
            document.body.appendChild(menu);
        }
        // 2) Gỡ mọi cờ ẩn có thể gây "mù" menu
        menu.removeAttribute('hidden');
        menu.classList.remove('hidden', 'd-none', 'is-hidden', 'invisible');
        // 3) TẠM bật để đo kích thước: dùng !important để thắng mọi CSS cứng đầu
        menu.style.setProperty('position', 'fixed', 'important');
        menu.style.setProperty('z-index', '2147483647', 'important');
        menu.style.setProperty('display', 'block', 'important');
        menu.style.setProperty('visibility', 'hidden', 'important');
        menu.style.removeProperty('left');
        menu.style.removeProperty('top');
        // 4) Đo và tính toạ độ thông minh
        const M = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = menu.getBoundingClientRect();
        let left = x + M;
        let top = y + M;
        if (left + rect.width > vw - M)
            left = x - rect.width - M;
        if (left < M)
            left = M;
        if (top + rect.height > vh - M)
            top = y - rect.height - M;
        if (top < M)
            top = M;
        // 5) Áp toạ độ
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
        // 6) Mở menu: vừa dùng class .show, vừa ép inline !important cho chắc
        menu.classList.add('show');
        menu.style.setProperty('visibility', 'visible', 'important');
        menu.style.setProperty('display', 'block', 'important');
        // 7) Căn submenu con (flip trái/phải & trên/dưới)
        positionAllSubmenusForMenu(menu);
    }
    // Ẩn tất cả context menu (tab/card/editor/profile-span + menu thumbnail ảnh)
    // Gọi mỗi lần click ra ngoài, scroll, resize.
    function hideAllContextMenus(preserveSelection = false) {
        document.querySelectorAll('.custom-context-menu').forEach(menu => {
            menu.classList.remove('show');
            // xoá mọi inline có thể giữ trạng thái "ẩn" sau lần trước
            menu.style.removeProperty('display');
            menu.style.removeProperty('visibility');
            menu.style.removeProperty('left');
            menu.style.removeProperty('top');
        });
        // Chỉ xóa savedSelection nếu KHÔNG preserve
        if (!preserveSelection) {
            savedSelection = null;
        }
    }
    // Đảm bảo toàn bộ menu tự ẩn khi click ngoài, scroll, resize
    document.addEventListener('click', () => hideAllContextMenus());
    window.addEventListener('scroll', () => hideAllContextMenus(), { passive: true });
    window.addEventListener('resize', () => hideAllContextMenus());
    // ===== SMART CONTEXT MENU POSITIONING =====
    const addLinkModal = new bootstrap.Modal(document.getElementById('notes-addLinkModal'));
    const linkUrlInput = document.getElementById('notes-link-url');
    const saveLinkBtn = document.getElementById('notes-save-link-btn');
    // --- State Variables ---
    let activeNoteId = null;
    let autoSaveTimer = null;
    let savedSelection = null;
    const NOTES_AUTOSAVE_DELAY_MS = 700;
    const NOTES_SAVED_TOAST_COOLDOWN_MS = 1200;
    let lastNotesSavedToastAt = 0;
    window.notesData = [];
    window.filteredNotes = [];
    // --- Core Functions ---
    function formatTimeAgo(isoString) {
        if (!isoString)
            return '';
        const seconds = Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
        if (seconds < 60)
            return "vài giây trước";
        const intervals = { 'năm': 31536000, 'tháng': 2592000, 'ngày': 86400, 'giờ': 3600, 'phút': 60 };
        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const value = Math.floor(seconds / secondsInUnit);
            if (value >= 1)
                return `${value} ${unit} trước`;
        }
        return "vài giây trước";
    }
    function getActiveEditorElement() {
        return document.getElementById('detail-editable-full');
    }
    function getNoteKey(noteId) {
        return String(noteId);
    }
    function unwrapNode(node) {
        const parent = node.parentNode;
        if (!parent)
            return;
        while (node.firstChild) {
            parent.insertBefore(node.firstChild, node);
        }
        parent.removeChild(node);
    }
    function stripTransientEditorMarkup(html) {
        const scratch = document.createElement('div');
        scratch.innerHTML = html;
        scratch.querySelectorAll('.notes-search-highlight').forEach(unwrapNode);
        return scratch.innerHTML;
    }
    function getPersistableEditorHtml(editorEl) {
        return stripTransientEditorMarkup(editorEl.innerHTML);
    }
    function buildNotePayloadFromHtml(html) {
        const parts = html.split('<br>');
        return {
            title_html: parts.shift() || '',
            content_html: parts.join('<br>')
        };
    }
    const noteSaveStateById = new Map();
    function getNoteSaveState(noteId) {
        const key = getNoteKey(noteId);
        let state = noteSaveStateById.get(key);
        if (!state) {
            state = {
                lastSavedHtml: null,
                queuedHtml: null,
                queuedSilent: true,
                saving: false,
                promise: null
            };
            noteSaveStateById.set(key, state);
        }
        return state;
    }
    function rememberEditorSnapshot(noteId, editorEl) {
        const html = getPersistableEditorHtml(editorEl);
        editorEl.dataset.noteEditorId = getNoteKey(noteId);
        editorEl.setAttribute('data-initial-content', html);
        getNoteSaveState(noteId).lastSavedHtml = html;
        return html;
    }
    function findLatestNote(noteId) {
        return window.notesData.find(n => String(n.id) === String(noteId)) || null;
    }
    function sortNotesDataByModifiedAt() {
        window.notesData.sort((a, b) => new Date(b.modified_at || 0).getTime() - new Date(a.modified_at || 0).getTime());
    }
    function getCurrentSearchTerm() {
        return (searchInput?.value || '').toLowerCase().trim();
    }
    function noteMatchesSearch(note, searchTerm) {
        if (!searchTerm)
            return true;
        const titleLower = (note.title_html || '').toLowerCase();
        const contentLower = (note.content_html || '').toLowerCase();
        if (titleLower.includes(searchTerm) || contentLower.includes(searchTerm))
            return true;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.content_html || '';
        if ((tempDiv.textContent || '').toLowerCase().includes(searchTerm))
            return true;
        return contentLower.includes(`data-profile-id="${searchTerm}"`);
    }
    function refreshFilteredNotesFromState(searchTerm = getCurrentSearchTerm()) {
        window.filteredNotes = searchTerm
            ? window.notesData.filter(note => noteMatchesSearch(note, searchTerm))
            : [...window.notesData];
        return window.filteredNotes;
    }
    function applySavedNoteToUi(noteId, updatedNote) {
        const index = window.notesData.findIndex(n => String(n.id) === String(noteId));
        if (index !== -1) {
            window.notesData[index] = updatedNote;
        }
        else {
            window.notesData.unshift(updatedNote);
        }
        sortNotesDataByModifiedAt();
        const searchTerm = getCurrentSearchTerm();
        renderNotes(refreshFilteredNotesFromState(searchTerm), searchTerm);
        container.scrollTop = 0;
    }
    function showNotesSavedToast() {
        const now = performance.now();
        if (now - lastNotesSavedToastAt < NOTES_SAVED_TOAST_COOLDOWN_MS)
            return;
        lastNotesSavedToastAt = now;
        showToast('✅ Đã lưu ghi chú!', 'success');
    }
    function queuePersistNoteHtml(noteId, html, options = {}) {
        const forceSave = Boolean(options.forceSave);
        const silentSave = Boolean(options.silentSave);
        const state = getNoteSaveState(noteId);
        if (!forceSave && html === state.lastSavedHtml) {
            return Promise.resolve(null);
        }
        const alreadyQueued = state.queuedHtml !== null;
        state.queuedHtml = html;
        state.queuedSilent = alreadyQueued ? (state.queuedSilent && silentSave) : silentSave;
        if (state.saving && state.promise) {
            return state.promise;
        }
        state.saving = true;
        state.promise = (async () => {
            try {
                while (state.queuedHtml !== null) {
                    const htmlToSave = state.queuedHtml;
                    const isSilent = state.queuedSilent;
                    state.queuedHtml = null;
                    state.queuedSilent = true;
                    if (htmlToSave === state.lastSavedHtml)
                        continue;
                    try {
                        if (!isSilent) {
                            showToast('Đang lưu...', 'info');
                        }
                        const updatedNote = await updateNoteOnServer(noteId, buildNotePayloadFromHtml(htmlToSave));
                        state.lastSavedHtml = htmlToSave;
                        applySavedNoteToUi(noteId, updatedNote);
                        showNotesSavedToast();
                    }
                    catch (error) {
                        if (state.queuedHtml === null) {
                            state.queuedHtml = htmlToSave;
                            state.queuedSilent = isSilent;
                        }
                        throw error;
                    }
                }
                return null;
            }
            finally {
                state.saving = false;
                state.promise = null;
            }
        })();
        return state.promise;
    }
    function scheduleNoteAutoSave(noteId, editorEl) {
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
        }
        autoSaveTimer = setTimeout(() => {
            autoSaveTimer = null;
            saveNoteChanges(noteId, false, true, editorEl);
        }, NOTES_AUTOSAVE_DELAY_MS);
    }
    function attachMainEditorAutoSave(editorEl, noteId, resetSavedSnapshot = false) {
        editorEl.spellcheck = false;
        if (resetSavedSnapshot) {
            rememberEditorSnapshot(noteId, editorEl);
        }
        else {
            const html = getPersistableEditorHtml(editorEl);
            const state = getNoteSaveState(noteId);
            editorEl.dataset.noteEditorId = getNoteKey(noteId);
            if (state.lastSavedHtml === null) {
                state.lastSavedHtml = html;
            }
            editorEl.setAttribute('data-initial-content', state.lastSavedHtml);
        }
        editorEl.addEventListener('blur', () => {
            saveNoteChanges(noteId, false, true, editorEl);
        });
        editorEl.addEventListener('input', () => {
            scheduleNoteAutoSave(noteId, editorEl);
        });
        editorEl.addEventListener('contextmenu', handleEditorContextMenu);
    }
    function attachRightSplitEditorAutoSave(editorEl, noteId) {
        editorEl.addEventListener('blur', () => {
            saveSplitState(noteId, 2, editorEl.innerHTML);
        });
        editorEl.addEventListener('input', () => {
            if (autoSaveTimer) {
                clearTimeout(autoSaveTimer);
            }
            autoSaveTimer = setTimeout(() => {
                autoSaveTimer = null;
                saveSplitState(noteId, 2, editorEl.innerHTML);
            }, NOTES_AUTOSAVE_DELAY_MS);
        });
        editorEl.addEventListener('contextmenu', handleEditorContextMenu);
    }
    function flushPendingNoteSave(useKeepalive = false) {
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = null;
        }
        const noteId = activeNoteId;
        if (!noteId)
            return;
        const editorEl = getActiveEditorElement();
        if (!editorEl)
            return;
        const currentContent = getPersistableEditorHtml(editorEl);
        const state = getNoteSaveState(noteId);
        const initialContent = editorEl.getAttribute('data-initial-content');
        if (currentContent === initialContent && currentContent === state.lastSavedHtml)
            return;
        if (!useKeepalive) {
            saveNoteChanges(noteId, true, true, editorEl);
            return;
        }
        const payload = buildNotePayloadFromHtml(currentContent);
        const body = JSON.stringify(payload);
        const url = `${notesApi.updateNoteBase}${noteId}`;
        try {
            if (navigator.sendBeacon) {
                const blob = new Blob([body], { type: 'application/json' });
                if (navigator.sendBeacon(url, blob)) {
                    state.lastSavedHtml = currentContent;
                    editorEl.setAttribute('data-initial-content', currentContent);
                    return;
                }
            }
        }
        catch (error) {
            console.warn('Notes beacon save failed:', error);
        }
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true
        })
            .then(() => {
            state.lastSavedHtml = currentContent;
            editorEl.setAttribute('data-initial-content', currentContent);
        })
            .catch(error => console.warn('Notes keepalive save failed:', error));
    }
    let dashboardSavedSelection = null;
    function captureDashboardSelection() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0)
            return;
        const range = selection.getRangeAt(0);
        const anchorNode = range.commonAncestorContainer;
        const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode.parentElement;
        if (!anchorElement || !notesPane.contains(anchorElement))
            return;
        dashboardSavedSelection = range.cloneRange();
    }
    function restoreDashboardSelection() {
        if (!dashboardSavedSelection)
            return;
        const selection = window.getSelection();
        if (!selection)
            return;
        const anchorNode = dashboardSavedSelection.commonAncestorContainer;
        const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode.parentElement;
        if (!anchorElement || !notesPane.contains(anchorElement)) {
            dashboardSavedSelection = null;
            return;
        }
        selection.removeAllRanges();
        selection.addRange(dashboardSavedSelection);
    }
    async function fetchAndRenderNotes(searchTerm = '') {
        try {
            const notes = await loadNotesFromApi();
            window.notesData = notes;
            sortNotesDataByModifiedAt();
            refreshFilteredNotesFromState(searchTerm);
            renderNotes(window.filteredNotes, searchTerm);
        }
        catch (error) {
            showToast(`Tải ghi chú thất bại: ${error.message}`, 'error');
        }
    }
    function renderNotes(notesToRender, searchTerm = '') {
        container.innerHTML = '';
        let displayList = [...notesToRender];
        if (activeNoteId) {
            const activeNoteIndex = displayList.findIndex(n => n.id === activeNoteId);
            if (activeNoteIndex > -1) {
                const [activeNote] = displayList.splice(activeNoteIndex, 1);
                displayList.unshift(activeNote);
            }
        }
        if (displayList.length === 0) {
            const emptyMessage = searchTerm
                ? `<div class="col-12 text-center text-muted p-5"><h6>Không tìm thấy ghi chú nào.</h6></div>`
                : `<div class="col-12 text-center text-muted p-5"><h6>Không có ghi chú nào.</h6><button class="btn btn-primary mt-3" data-notes-action="add-note"><i class="bi bi-plus-lg"></i> Tạo ghi chú đầu tiên</button></div>`;
            container.innerHTML = emptyMessage;
            return;
        }
        displayList.forEach(note => container.appendChild(createNoteCard(note, searchTerm)));
        // Re-apply active class after rendering
        if (activeNoteId) {
            const activeCard = document.querySelector(`.card[data-note-id="${activeNoteId}"]`);
            if (activeCard)
                activeCard.classList.add('note-card-active');
        }
    }
    function createNoteCard(note, searchTerm = '') {
        const col = document.createElement('div');
        col.className = 'note-card-wrapper';
        const markedIconHTML = note.is_marked ? `<i class="bi bi-star-fill text-warning me-2" title="Đã đánh dấu"></i>` : '';
        let title = note.title_html || 'Ghi chú không tiêu đề';
        let content = note.content_html || '...';
        // Apply profile highlight for search
        if (searchTerm) {
            const regex = new RegExp(`(<span class="has-profile"[^>]*data-profile-id="${searchTerm}"[^>]*?)>`, 'i');
            title = title.replace(regex, `$1 class="has-profile profile-highlight">`);
            content = content.replace(regex, `$1 class="has-profile profile-highlight">`);
        }
        // Create card structure first
        const card = document.createElement('div');
        card.className = 'card h-100';
        card.setAttribute('data-note-id', note.id);
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body d-flex flex-column';
        const headerDiv = document.createElement('div');
        headerDiv.className = 'd-flex justify-content-between align-items-center mb-2';
        headerDiv.innerHTML = `
                <h5 class="card-title mb-0 text-truncate">${title}</h5>
                <div class="d-flex align-items-center flex-shrink-0 ms-2">
                    ${markedIconHTML}
                    <small class="text-muted" title="${new Date(note.modified_at).toLocaleString('vi-VN')}">${formatTimeAgo(note.modified_at)}</small>
                </div>
            `;
        const contentDiv = document.createElement('div');
        contentDiv.className = 'card-text card-note-body flex-grow-1';
        contentDiv.innerHTML = content;
        cardBody.appendChild(headerDiv);
        cardBody.appendChild(contentDiv);
        card.appendChild(cardBody);
        col.appendChild(card);
        const cardElement = col.querySelector('.card');
        cardElement.addEventListener('click', (e) => {
            if (asElement(e.target)?.closest('button'))
                return;
            showNoteDetail(findLatestNote(note.id) || note);
        });
        return col;
    }
    function openDetailPanel() {
        listWrapper.classList.add('shrunk');
        detailWrapper.classList.add('visible');
    }
    window.closeDetailPanel = () => {
        flushPendingNoteSave(false);
        listWrapper.classList.remove('shrunk');
        detailWrapper.classList.remove('visible');
        document.querySelector('.note-card-active')?.classList.remove('note-card-active');
        activeNoteId = null;
        // Reset detail panel
        const detailHeader = detailWrapper.querySelector('.card-header');
        const detailContent = detailWrapper.querySelector('#notes-detail-content');
        const detailPlaceholder = detailWrapper.querySelector('#notes-detail-placeholder');
        if (detailHeader)
            detailHeader.innerHTML = '';
        if (detailContent)
            detailContent.classList.add('d-none');
        if (detailPlaceholder)
            detailPlaceholder.classList.remove('d-none');
        // Reset split view state when closing
        currentSplitMode = 1;
    };
    // === SPLIT VIEW LOGIC ===
    let currentSplitMode = 1; // 1 = single, 2 = split
    // Persist split state per note in localStorage
    function getSplitState(noteId) {
        try {
            const states = JSON.parse(localStorage.getItem('noteSplitStates') || '{}');
            return states[noteId] || { mode: 1, rightContent: '' };
        }
        catch {
            return { mode: 1, rightContent: '' };
        }
    }
    function saveSplitState(noteId, mode, rightContent = '') {
        try {
            const states = JSON.parse(localStorage.getItem('noteSplitStates') || '{}');
            if (mode === 1) {
                delete states[noteId]; // Remove when back to single
            }
            else {
                states[noteId] = { mode, rightContent };
            }
            localStorage.setItem('noteSplitStates', JSON.stringify(states));
        }
        catch (e) {
            console.error('Failed to save split state', e);
        }
    }
    window.toggleSplitMode = (mode) => {
        const detailContent = document.getElementById('notes-detail-content');
        const editorEl = document.getElementById('detail-editable-full');
        const splitBtn = document.getElementById('splitViewDropdown');
        if (!detailContent || !editorEl)
            return;
        flushPendingNoteSave(false);
        currentSplitMode = mode;
        if (mode === 2) {
            // === ENABLE SPLIT VIEW ===
            console.log('[Split View] Enabling split mode...');
            // Check if already in split mode
            if (detailContent.querySelector('.split-view-container')) {
                console.log('[Split View] Already in split mode, skipping');
                return;
            }
            // Get current content
            const currentHtml = editorEl.innerHTML;
            console.log('[Split View] Current content length:', currentHtml.length);
            // Create split container - simple layout, no fancy backgrounds
            const splitContainer = document.createElement('div');
            splitContainer.className = 'split-view-container';
            splitContainer.style.cssText = 'display: grid !important; grid-template-columns: 1fr 1px 1fr !important; gap: 0 !important; height: 100% !important; min-height: 500px !important;';
            // Pane 1: Original editable with ALL content
            const pane1 = document.createElement('div');
            pane1.className = 'split-pane';
            pane1.id = 'split-pane-left';
            pane1.style.cssText = 'overflow-y: auto !important; height: 100% !important; padding: 10px !important;';
            pane1.innerHTML = `<div id="detail-editable-full" contenteditable="true" spellcheck="false" data-placeholder="Dòng đầu là tiêu đề...">${currentHtml}</div>`;
            // Divider - simple white line
            const divider = document.createElement('div');
            divider.className = 'split-divider';
            divider.style.cssText = 'width: 1px !important; background: #fff !important; flex-shrink: 0 !important;';
            // Pane 2: EMPTY editable pane (not cloned)
            // Check localStorage for saved right content
            const savedState = getSplitState(activeNoteId);
            const rightContent = savedState.rightContent || '';
            const pane2 = document.createElement('div');
            pane2.className = 'split-pane';
            pane2.id = 'split-pane-right';
            pane2.style.cssText = 'overflow-y: auto !important; height: 100% !important; padding: 10px !important;';
            pane2.innerHTML = `<div id="detail-editable-right" class="notes-split-editable" contenteditable="true" spellcheck="false" data-placeholder="Nhập nội dung bên phải...">${rightContent}</div>`;
            splitContainer.appendChild(pane1);
            splitContainer.appendChild(divider);
            splitContainer.appendChild(pane2);
            // Replace content - CLEAR and append
            detailContent.innerHTML = '';
            detailContent.style.cssText = 'height: 100% !important; display: block !important;';
            detailContent.appendChild(splitContainer);
            console.log('[Split View] Split container added:', splitContainer);
            console.log('[Split View] detailContent children:', detailContent.children.length);
            // Re-attach event listeners to new editable
            const newEditor = document.getElementById('detail-editable-full');
            if (newEditor) {
                attachMainEditorAutoSave(newEditor, activeNoteId);
                // Re-initialize profile interactions
                initializeProfileInteractions();
                applySavedColors();
            }
            // Attach event listeners to RIGHT pane editor too
            const rightEditor = document.getElementById('detail-editable-right');
            if (rightEditor) {
                attachRightSplitEditorAutoSave(rightEditor, activeNoteId);
            }
            // Only save initial empty state if this is a NEW split (not restoring from localStorage)
            // savedState.rightContent is already loaded above, so don't overwrite it
            if (!savedState.rightContent) {
                saveSplitState(activeNoteId, 2, '');
            }
            // Update button style
            if (splitBtn)
                splitBtn.classList.add('active');
            // showToast('Đã bật chế độ chia đôi màn hình', 'info');
        }
        else {
            // === DISABLE SPLIT VIEW (Mode 1) ===
            const splitContainer = detailContent.querySelector('.split-view-container');
            if (!splitContainer)
                return;
            // Get content from LEFT pane only (right pane stays in localStorage)
            const leftEditor = document.getElementById('detail-editable-full');
            const leftHtml = leftEditor ? leftEditor.innerHTML : '';
            // Restore single view with LEFT pane content only (no merge)
            detailContent.innerHTML = `<div id="detail-editable-full" contenteditable="true" spellcheck="false" data-placeholder="Dòng đầu là tiêu đề...">${leftHtml}</div>`;
            // Re-attach event listeners
            const newEditor = document.getElementById('detail-editable-full');
            if (newEditor) {
                attachMainEditorAutoSave(newEditor, activeNoteId);
                // Re-initialize profile interactions
                initializeProfileInteractions();
                applySavedColors();
            }
            // Update button style
            if (splitBtn)
                splitBtn.classList.remove('active');
            // Clear split state from localStorage
            saveSplitState(activeNoteId, 1);
            // showToast('Đã tắt chế độ chia đôi', 'info');
        }
    };
    function showNoteDetail(note) {
        note = findLatestNote(note.id) || note;
        if (activeNoteId && String(activeNoteId) !== String(note.id)) {
            flushPendingNoteSave(false);
        }
        activeNoteId = note.id;
        document.querySelectorAll('#notes-container .card').forEach(card => card.classList.remove('note-card-active'));
        const clickedCard = document.querySelector(`.card[data-note-id="${note.id}"]`);
        if (clickedCard)
            clickedCard.classList.add('note-card-active');
        // Check if this note was previously in split mode
        const savedSplitState = getSplitState(note.id);
        openDetailPanel();
        const detailHeader = detailWrapper.querySelector('.card-header');
        const detailContent = detailWrapper.querySelector('#notes-detail-content');
        const detailPlaceholder = detailWrapper.querySelector('#notes-detail-placeholder');
        detailHeader.innerHTML = `
            <div class="d-flex justify-content-between align-items-center w-100">
                <small class="text-muted" title="${new Date(note.modified_at).toLocaleString('vi-VN')}">
                    <i class="bi bi-clock-history"></i> ${formatTimeAgo(note.modified_at)}
                </small>
                <div class="d-flex align-items-center gap-1">
                    <div class="dropdown">
                        <button class="btn btn-sm btn-split-view dropdown-toggle" type="button" id="splitViewDropdown" data-bs-toggle="dropdown" aria-expanded="false" title="Chia màn hình">
                            <i class="bi bi-layout-split"></i> Split
                        </button>
                        <ul class="dropdown-menu dropdown-menu-dark dropdown-menu-end" aria-labelledby="splitViewDropdown">
                            <li><a class="dropdown-item" href="#" data-notes-split-mode="1"><i class="bi bi-square me-2"></i>1 (Mặc định)</a></li>
                            <li><a class="dropdown-item" href="#" data-notes-split-mode="2"><i class="bi bi-layout-split me-2"></i>2 (Chia đôi)</a></li>
                        </ul>
                    </div>
                    <button class="btn btn-sm btn-primary" data-notes-action="add-note" title="Thêm ghi chú mới"><i class="bi bi-plus-lg"></i></button>
                    <button class="btn btn-sm btn-outline-danger" data-notes-action="delete-note" data-note-id="${note.id}" title="Xóa ghi chú"><i class="bi bi-trash-fill"></i></button>
                    <button class="btn-close btn-close-white notes-close-detail-btn" data-notes-action="close-detail" title="Đóng chi tiết"></button>
                </div>
            </div>`;
        // --- ⭐ BẮT ĐẦU THÊM CODE MỚI TỪ ĐÂY ---
        let titleHtml = note.title_html || '';
        let contentHtml = note.content_html || '';
        const searchInput = document.getElementById('notes-search-input');
        const searchTerm = searchInput ? searchInput.value.trim() : ''; // Lấy giá trị từ ô tìm kiếm
        if (searchTerm) {
            // Tạo regex để tìm kiếm (không phân biệt hoa thường, toàn cục)
            // Escape các ký tự đặc biệt trong search term để tránh lỗi regex
            const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
            // Highlight text như Telegram (background màu xanh đậm)
            // Sử dụng replace với $1 để giữ nguyên cách viết hoa/thường của từ gốc
            titleHtml = titleHtml.replace(regex, '<span class="notes-search-highlight">$1</span>');
            contentHtml = contentHtml.replace(regex, '<span class="notes-search-highlight">$1</span>');
        }
        // --- ⭐ KẾT THÚC CODE MỚI ---
        // Sử dụng titleHtml và contentHtml đã được xử lý
        detailContent.innerHTML = `<div id="detail-editable-full" contenteditable="true" spellcheck="false" data-placeholder="Dòng đầu là tiêu đề...">${titleHtml}<br>${contentHtml}</div>`;
        const editorEl = document.getElementById('detail-editable-full');
        attachMainEditorAutoSave(editorEl, note.id, true);
        // Click handler for links - open in new tab
        editorEl.addEventListener('click', (e) => {
            const link = asElement(e.target)?.closest('a');
            if (link && link.href) {
                e.preventDefault();
                e.stopPropagation();
                window.open(link.href, '_blank', 'noopener,noreferrer');
            }
        });
        // Paste handler - auto-save after paste and auto-convert URLs to links
        editorEl.addEventListener('paste', (e) => {
            e.preventDefault();
            // 🔍 Debug: Bắt đầu xử lý paste
            console.log('🔍 Paste event triggered');
            // Get the pasted content as plain text from the clipboard
            let plainText = e.clipboardData?.getData('text') || '';
            if (!plainText) {
                console.log('🔍 No text data in clipboard');
                return;
            }
            console.log('🔍 Plain text from clipboard:', plainText);
            console.log('🔍 Number of newlines:', (plainText.match(/\n/g) || []).length);
            // Process URLs (no longer auto-detect /commands)
            let processedHtml = plainText;
            // URL regex pattern - handles http, https, ftp, and file protocols
            const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
            if (urlRegex.test(processedHtml)) {
                // If URLs are found, replace them with HTML anchor tags
                processedHtml = processedHtml.replace(urlRegex, (url) => {
                    // Create a styled and secure link
                    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="notes-rendered-link">${url}</a>`;
                });
            }
            // 🔍 Convert newlines to <br> tags để giữ nguyên xuống dòng
            processedHtml = processedHtml.replace(/\n/g, '<br>');
            console.log('🔍 Processed HTML after newline conversion:', processedHtml);
            // Insert the processed HTML into the editor
            document.execCommand('insertHTML', false, processedHtml);
            // Auto-save after paste
            setTimeout(() => {
                if (note.id) {
                    console.log('🔍 Auto-saving note after paste:', note.id);
                    saveNoteChanges(note.id, true, false, editorEl);
                }
            }, 100);
        });
        // Initialize profile interactions and apply saved colors
        initializeProfileInteractions();
        applySavedColors();
        // Profile highlight logic for search
        const currentSearchTerm = searchInput.value.trim().toLowerCase();
        if (currentSearchTerm) {
            const matchingSpans = editorEl.querySelectorAll(`.has-profile[data-profile-id="${currentSearchTerm}" i]`);
            matchingSpans.forEach(span => {
                span.classList.add('profile-highlight');
                setTimeout(() => {
                    span.classList.remove('profile-highlight');
                }, 600);
            });
            if (matchingSpans.length > 0) {
                matchingSpans[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        detailPlaceholder.classList.add('d-none');
        detailContent.classList.remove('d-none');
        // Auto-restore split mode if this note was previously in split mode
        if (savedSplitState.mode === 2) {
            setTimeout(() => {
                window.toggleSplitMode(2);
            }, 100);
        }
    }
    // Save function for split view - saves LEFT pane to DB, RIGHT pane to localStorage ONLY
    async function saveSplitNoteChanges(silentSave = false, noteId = activeNoteId, leftEditorOverride = null, rightEditorOverride = null) {
        if (!noteId)
            return;
        const leftEditor = leftEditorOverride || document.getElementById('detail-editable-full');
        const rightEditor = rightEditorOverride || document.getElementById('detail-editable-right');
        if (rightEditor) {
            saveSplitState(noteId, 2, rightEditor.innerHTML);
        }
        if (leftEditor) {
            await saveNoteChanges(noteId, false, silentSave, leftEditor);
        }
    }
    async function saveNoteChanges(noteId, forceSave = false, silentSave = false, editorOverride = null) {
        if (!noteId)
            return;
        const editorEl = editorOverride || document.getElementById('detail-editable-full');
        if (!editorEl)
            return;
        const initialContent = editorEl.getAttribute('data-initial-content');
        const currentContent = getPersistableEditorHtml(editorEl);
        const saveState = getNoteSaveState(noteId);
        // Skip save if content unchanged and not forced
        if (!forceSave && (currentContent === initialContent || currentContent === saveState.lastSavedHtml)) {
            return;
        }
        try {
            await queuePersistNoteHtml(noteId, currentContent, { forceSave, silentSave });
            if (getPersistableEditorHtml(editorEl) === currentContent) {
                editorEl.setAttribute('data-initial-content', currentContent);
            }
        }
        catch (error) {
            showToast('Lỗi khi tự động lưu!', 'error');
        }
    }
    window.prepareAddNoteModal = () => {
        form.reset();
        modalTitle.textContent = 'Thêm Ghi Chú Mới';
        editIdInput.value = '';
        titleInput.innerHTML = '';
        contentEditor.innerHTML = '';
        // Force disable spellcheck
        titleInput.spellcheck = false;
        contentEditor.spellcheck = false;
        notesModal.show();
    };
    window.addNewNoteFromContextMenu = () => {
        hideAllContextMenus();
        window.prepareAddNoteModal();
    };
    // Confirm Delete Modal
    const confirmDeleteModalEl = document.getElementById('notes-confirmDeleteModal');
    const confirmDeleteModal = new bootstrap.Modal(confirmDeleteModalEl);
    const confirmDeleteBtn = document.getElementById('notes-confirm-delete-btn');
    let pendingDeleteNoteId = null;
    let isDeletingNote = false;
    function requestDeleteNote(id, event = null) {
        event?.preventDefault?.();
        event?.stopPropagation();
        if (!id)
            return;
        pendingDeleteNoteId = id;
        confirmDeleteModal.show();
    }
    window.deleteNoteWrapper = async (id, event) => {
        requestDeleteNote(id, event);
    };
    confirmDeleteModalEl.addEventListener('hidden.bs.modal', () => {
        if (!isDeletingNote) {
            pendingDeleteNoteId = null;
        }
    });
    document.addEventListener('click', (event) => {
        const target = asElement(event.target)?.closest('[data-notes-action], [data-notes-split-mode]');
        if (!target)
            return;
        const splitMode = target.dataset.notesSplitMode;
        if (splitMode) {
            event.preventDefault();
            window.toggleSplitMode(Number(splitMode));
            return;
        }
        const action = target.dataset.notesAction;
        if (action === 'add-note') {
            event.preventDefault();
            window.prepareAddNoteModal();
        }
        else if (action === 'delete-note') {
            event.preventDefault();
            window.deleteNoteWrapper(target.dataset.noteId, event);
        }
        else if (action === 'close-detail') {
            event.preventDefault();
            window.closeDetailPanel();
        }
    });
    confirmDeleteBtn.addEventListener('click', async () => {
        if (!pendingDeleteNoteId)
            return;
        const noteId = pendingDeleteNoteId;
        isDeletingNote = true;
        confirmDeleteBtn.setAttribute('disabled', 'true');
        try {
            await deleteNoteOnServer(noteId, 'POST');
            if (String(noteId) === String(activeNoteId)) {
                activeNoteId = null;
                window.closeDetailPanel();
            }
            pendingDeleteNoteId = null;
            confirmDeleteModal.hide();
            await fetchAndRenderNotes(searchInput.value.toLowerCase().trim());
            showToast('Đã xóa ghi chú.', 'info');
        }
        catch (error) {
            console.error('Error deleting note:', error);
            showToast('Không thể xóa ghi chú này, vui lòng thử lại.', 'error');
            confirmDeleteModal.hide();
        }
        finally {
            isDeletingNote = false;
            confirmDeleteBtn.removeAttribute('disabled');
        }
    });
    // --- Context Menu Logic ---
    function restoreSelection() {
        if (savedSelection) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(savedSelection);
        }
    }
    function createCodeBlockFromSelection() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0)
            return;
        const range = selection.getRangeAt(0);
        const anchorNode = range.commonAncestorContainer.nodeType === 1
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement;
        const editableRoot = anchorNode instanceof Element ? anchorNode.closest('[contenteditable="true"]') : null;
        if (!editableRoot)
            return;
        const selectedText = selection.toString();
        if (!selectedText || selectedText.trim().length === 0)
            return;
        // Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        wrapper.setAttribute('contenteditable', 'false');
        // Header (giống kiểu Gemini: trái là nhãn, phải là Copy)
        const header = document.createElement('div');
        header.className = 'code-block-header';
        const title = document.createElement('span');
        title.className = 'code-block-title';
        title.textContent = 'Code';
        title.setAttribute('contenteditable', 'true');
        title.setAttribute('spellcheck', 'false');
        title.setAttribute('data-placeholder', 'Type…');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'copy-btn';
        btn.textContent = 'Copy';
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = '<i class="bi bi-x-circle"></i>';
        delBtn.setAttribute('aria-label', 'Delete code block');
        const actions = document.createElement('div');
        actions.className = 'code-block-actions';
        actions.appendChild(delBtn); // 🗑 trước
        actions.appendChild(btn); // Copy sau
        header.appendChild(title);
        header.appendChild(actions);
        // Body
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = selectedText;
        code.setAttribute('contenteditable', 'true');
        pre.appendChild(code);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
        // Replace selection
        range.deleteContents();
        range.insertNode(wrapper);
        // Caret after block
        selection.removeAllRanges();
        const after = document.createRange();
        after.setStartAfter(wrapper);
        after.collapse(true);
        selection.addRange(after);
    }
    function handleEditorContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();
        hideAllContextMenus();
        const selection = window.getSelection();
        if (selection.toString().length > 0) {
            savedSelection = selection.getRangeAt(0).cloneRange();
            showSmartMenu(editorContextMenu, e.clientX, e.clientY);
        }
    }
    function handleTabContextMenu(e) {
        const noteCard = asElement(e.target)?.closest('.card[data-note-id]');
        if (!noteCard) {
            e.preventDefault();
            e.stopPropagation();
            hideAllContextMenus();
            showSmartMenu(notesTabMenu, e.clientX, e.clientY);
        }
    }
    // --- Event Listeners ---
    // Prevent default behavior on mousedown for context menu items to avoid losing selection
    editorContextMenu.addEventListener('mousedown', (e) => {
        if (asElement(e.target)?.closest('.menu-item')) {
            e.preventDefault();
        }
    });
    document.addEventListener('pointerdown', (event) => {
        const editorEl = getActiveEditorElement();
        if (!activeNoteId || !editorEl)
            return;
        const target = asElement(event.target);
        if (target && editorEl.contains(target))
            return;
        saveNoteChanges(activeNoteId, false, true, editorEl);
    }, true);
    // Main form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = editIdInput.value;
        const payload = {
            title_html: titleInput.innerHTML,
            content_html: contentEditor.innerHTML,
        };
        if (!payload.title_html && !payload.content_html) {
            showAlert('Ghi chú không được để trống.');
            return;
        }
        try {
            const savedNote = await saveModalNote(id, payload);
            notesModal.hide();
            await fetchAndRenderNotes(searchInput.value.toLowerCase().trim());
            showToast(id ? 'Đã cập nhật ghi chú!' : 'Đã tạo ghi chú mới!', 'success');
            showNoteDetail(savedNote); // Show the newly created/updated note
        }
        catch (error) {
            showToast('Lỗi: Không thể lưu ghi chú.', 'error');
        }
    });
    // Search input - Enhanced search like original version
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        renderNotes(refreshFilteredNotesFromState(searchTerm), searchTerm);
    });
    // Context menu actions for note card
    noteCardMenu.addEventListener('click', async (e) => {
        const target = asElement(e.target);
        const markItem = target?.closest('#context-mark-note');
        const deleteItem = target?.closest('#context-delete-note');
        e.stopPropagation();
        const noteId = noteCardMenu.dataset.noteId;
        if (!noteId)
            return;
        if (markItem) {
            // Handle mark/unmark
            try {
                await toggleNoteMarkOnServer(noteId);
                await fetchAndRenderNotes(searchInput.value.toLowerCase().trim());
                showToast('Đã cập nhật đánh dấu!', 'success');
            }
            catch (error) {
                showToast('Lỗi khi đánh dấu.', 'error');
            }
            finally {
                hideAllContextMenus();
            }
        }
        else if (deleteItem) {
            // Handle delete
            hideAllContextMenus();
            pendingDeleteNoteId = noteId;
            confirmDeleteModal.show();
        }
    });
    document.querySelector('#context-bold').addEventListener('click', () => {
        restoreSelection();
        document.execCommand('bold');
        hideAllContextMenus();
        setTimeout(() => saveNoteChanges(activeNoteId), 100);
    });
    document.querySelector('#context-code-block').addEventListener('click', () => {
        restoreSelection();
        createCodeBlockFromSelection();
        hideAllContextMenus();
        setTimeout(() => saveNoteChanges(activeNoteId), 100);
    });
    document.querySelector('#context-color .color-palette').addEventListener('click', (e) => {
        const colorTarget = asElement(e.target);
        if (colorTarget?.matches('span[data-color]')) {
            restoreSelection();
            const color = colorTarget.dataset.color;
            // Get current selection before execCommand
            const selection = window.getSelection();
            if (selection.rangeCount === 0)
                return;
            // Apply color formatting using execCommand
            // This creates <font color="..."> or <span style="color: ...">
            // DO NOT set contenteditable=false - it breaks Backspace behavior
            document.execCommand('foreColor', false, color);
            // Simply move cursor to end of selection, no special handling needed
            // The browser will handle Backspace normally on the colored text
            hideAllContextMenus();
            setTimeout(() => saveNoteChanges(activeNoteId), 100);
        }
    });
    document.querySelector('#context-link').addEventListener('click', () => {
        // The selection is already saved, just show the modal
        linkUrlInput.value = 'https://';
        addLinkModal.show();
    });
    saveLinkBtn.addEventListener('click', () => {
        const url = linkUrlInput.value.trim();
        if (url) {
            restoreSelection(); // Restore selection before creating link
            document.execCommand('createLink', false, url);
            addLinkModal.hide();
            savedSelection = null; // Clear saved selection
            setTimeout(() => saveNoteChanges(activeNoteId), 100);
        }
    });
    // Profile Modal Elements
    const profileModal = new bootstrap.Modal(document.getElementById('notes-addProfileModal'));
    const profileIdInput = document.getElementById('notes-profile-id');
    const profilePasswordInput = document.getElementById('notes-profile-password');
    const profileContentInput = document.getElementById('notes-profile-content-editor');
    const saveProfileBtn = document.getElementById('notes-save-profile-btn');
    const deleteProfileBtn = document.getElementById('notes-delete-profile-btn');
    const copyProfileIdBtn = document.getElementById('notes-copy-profile-id-btn');
    const copyProfilePasswordBtn = document.getElementById('notes-copy-profile-password-btn');
    const profileSpanMenu = document.getElementById('profile-span-context-menu');
    let currentProfileSpan = null;
    // Image Modal Context Menu
    const imageModal = document.getElementById('np-imagePreviewModal');
    const imagePreview = document.getElementById('np-imagePreview');
    const imageModalContextMenu = document.getElementById('image-modal-context-menu');
    let currentImageData = null;
    // Function để copy ảnh
    async function copyImageToClipboard() {
        if (!currentImageData) {
            showToast('Không có ảnh để copy', 'error');
            return;
        }
        try {
            // Convert data URL to blob
            const response = await fetch(currentImageData);
            const blob = await response.blob();
            // Copy to clipboard
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            showToast('Đã copy ảnh vào clipboard', 'success');
            hideAllContextMenus();
        }
        catch (error) {
            console.error('Error copying image:', error);
            showToast('Lỗi khi copy ảnh', 'error');
        }
    }
    // Event listener cho modal ảnh
    if (imagePreview) {
        imagePreview.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            hideAllContextMenus();
            // Lưu data của ảnh hiện tại
            currentImageData = imagePreview.src;
            showSmartMenu(imageModalContextMenu, e.clientX, e.clientY);
        });
    }
    // Event listener cho context menu copy
    document.getElementById('context-copy-image')?.addEventListener('click', copyImageToClipboard);
    // Code block copy button handler (event delegation)
    document.addEventListener('click', async (e) => {
        const btn = asElement(e.target)?.closest('.copy-btn');
        if (!btn)
            return;
        e.preventDefault();
        e.stopPropagation();
        const wrapper = btn.closest('.code-block-wrapper');
        const codeEl = wrapper ? wrapper.querySelector('pre code') : null;
        const textToCopy = codeEl ? codeEl.innerText : '';
        try {
            await navigator.clipboard.writeText(textToCopy);
            if (typeof showToast === 'function')
                showToast('Đã copy code vào clipboard.', 'success');
        }
        catch (err) {
            console.error('Clipboard copy failed:', err);
            if (typeof showToast === 'function')
                showToast('Copy thất bại (bị chặn clipboard).', 'error');
        }
    });
    // Prevent title click from affecting editor parent
    document.addEventListener('mousedown', (e) => {
        if (asElement(e.target)?.closest('.code-block-title')) {
            e.stopPropagation();
        }
    });
    // ===== Code Block Delete Modal =====
    const codeBlockDeleteModal = new bootstrap.Modal(document.getElementById('codeblock-confirmDeleteModal'));
    const codeBlockConfirmDeleteBtn = document.getElementById('codeblock-confirm-delete-btn');
    let pendingDeleteCodeBlockEl = null;
    let pendingDeleteEditorEl = null;
    document.addEventListener('click', (e) => {
        const delBtn = asElement(e.target)?.closest('.delete-btn');
        if (!delBtn)
            return;
        e.preventDefault();
        e.stopPropagation();
        pendingDeleteCodeBlockEl = delBtn.closest('.code-block-wrapper');
        pendingDeleteEditorEl = pendingDeleteCodeBlockEl
            ? pendingDeleteCodeBlockEl.closest('[contenteditable="true"]')
            : null;
        if (pendingDeleteCodeBlockEl)
            codeBlockDeleteModal.show();
    });
    codeBlockConfirmDeleteBtn.addEventListener('click', () => {
        if (!pendingDeleteCodeBlockEl)
            return;
        // Lưu điểm đặt caret trước khi xoá
        const parent = pendingDeleteCodeBlockEl.parentNode;
        const next = pendingDeleteCodeBlockEl.nextSibling;
        pendingDeleteCodeBlockEl.remove();
        codeBlockDeleteModal.hide();
        // Đặt caret lại cho editor
        if (pendingDeleteEditorEl) {
            pendingDeleteEditorEl.focus();
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                const r = document.createRange();
                if (next && parent.contains(next))
                    r.setStartBefore(next);
                else
                    r.setStart(parent, parent.childNodes.length);
                r.collapse(true);
                sel.addRange(r);
            }
            // Trigger autosave (editor đang có input listener debounce)
            pendingDeleteEditorEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        pendingDeleteCodeBlockEl = null;
        pendingDeleteEditorEl = null;
        if (typeof showToast === 'function')
            showToast('Đã xóa code block.', 'success');
    });
    // Image compression and paste functionality
    async function compressImageFile(file, { maxW = 900, maxH = 900, quality = 0.76 } = {}) {
        return window.NotesMedia.compressImageFile(file, { maxW, maxH, quality });
    }
    async function makeThumb(dataURL, maxSide = 200, quality = 0.82) {
        return window.NotesMedia.makeThumb(dataURL, maxSide, quality);
    }
    function enablePasteImagesInto(el) {
        if (!el)
            return;
        // Remove existing paste listeners to prevent duplicates
        el.removeEventListener('paste', handlePasteImages);
        el.addEventListener('paste', handlePasteImages);
    }
    function handlePasteImages(e) {
        const items = e.clipboardData?.items;
        if (!items)
            return;
        // Kiểm tra xem có ảnh trong clipboard không
        let hasImage = false;
        for (const it of items) {
            if (it.kind === 'file' && it.type.startsWith('image/')) {
                hasImage = true;
                break;
            }
        }
        if (hasImage) {
            e.preventDefault(); // Ngăn chặn hoàn toàn paste mặc định
            e.stopPropagation(); // Ngăn chặn event bubbling
            for (const it of items) {
                if (it.kind === 'file' && it.type.startsWith('image/')) {
                    const file = it.getAsFile();
                    // Ảnh gốc 100% không nén (để xem full size)
                    const reader = new FileReader();
                    reader.onload = () => {
                        const originalData = reader.result;
                        // thumbnail hiển thị trong khu vực riêng (nén nhẹ)
                        makeThumb(originalData, 150, 0.9).then(thumbData => {
                            addImageToThumbnailArea(originalData, thumbData);
                        });
                    };
                    reader.readAsDataURL(file);
                    break; // Chỉ xử lý ảnh đầu tiên
                }
            }
        }
    }
    function addImageToThumbnailArea(fullData, thumbData) {
        const container = document.getElementById('profile-images-container');
        const thumbnailsArea = document.getElementById('profile-images-thumbnails');
        if (!container || !thumbnailsArea)
            return;
        // Tạo thumbnail element
        const thumbElement = document.createElement('div');
        thumbElement.className = 'position-relative';
        thumbElement.style.cssText = 'width: 80px; height: 80px; cursor: pointer;';
        thumbElement.innerHTML = `
                <img src="${thumbData}" alt="thumbnail"
                     class="notes-profile-thumb-img">
                <button class="btn btn-sm btn-danger position-absolute"
                        class="notes-profile-thumb-delete"
                        type="button">
                    ×
                </button>
            `;
        // Thêm event listener cho button delete
        const deleteBtn = thumbElement.querySelector('button');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                removeImageFromThumbnailArea(deleteBtn);
            });
        }
        // Lưu data gốc vào attribute
        thumbElement.setAttribute('data-full', fullData);
        // Thêm vào khu vực thumbnails
        thumbnailsArea.appendChild(thumbElement);
        // Hiện container nếu đang ẩn
        if (container.style.display === 'none') {
            container.style.display = 'block';
        }
        // Thêm event click để xem ảnh full
        thumbElement.addEventListener('click', (e) => {
            if (asElement(e.target)?.tagName !== 'BUTTON') {
                const img = document.getElementById('np-imagePreview');
                if (img) {
                    img.src = fullData;
                    new bootstrap.Modal(document.getElementById('np-imagePreviewModal')).show();
                }
            }
        });
    }
    function removeImageFromThumbnailArea(button) {
        const thumbElement = button.closest('.position-relative');
        if (thumbElement) {
            thumbElement.remove();
            // Ẩn container nếu không còn ảnh nào
            const thumbnailsArea = document.getElementById('profile-images-thumbnails');
            if (thumbnailsArea && thumbnailsArea.children.length === 0) {
                document.getElementById('profile-images-container').style.display = 'none';
            }
        }
    }
    // Gắn handler khi mở modal Gán Profile
    document.getElementById('notes-addProfileModal')
        ?.addEventListener('shown.bs.modal', () => {
        const ed = document.getElementById('notes-profile-content-editor');
        enablePasteImagesInto(ed);
        ed?.focus();
        // Clear thumbnail area if creating new profile
        if (!currentProfileSpan) {
            clearThumbnailArea();
        }
    });
    // CRITICAL FIX: Reposition cursor AFTER modal is fully hidden
    document.getElementById('notes-addProfileModal')
        ?.addEventListener('hidden.bs.modal', () => {
        if (window._lastProfileSpan) {
            const span = window._lastProfileSpan;
            // Focus the content editor
            contentEditor.focus();
            // Move cursor outside the span
            const newRange = document.createRange();
            newRange.setStartAfter(span);
            newRange.setEndAfter(span);
            newRange.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(newRange);
            // Clear the reference
            window._lastProfileSpan = null;
        }
    });
    function clearThumbnailArea() {
        const container = document.getElementById('profile-images-container');
        const thumbnailsArea = document.getElementById('profile-images-thumbnails');
        if (thumbnailsArea) {
            thumbnailsArea.innerHTML = '';
        }
        if (container) {
            container.style.display = 'none';
        }
    }
    // click thumb để xem full
    document.getElementById('notes-addProfileModal')
        ?.addEventListener('click', (e) => {
        const thumb = asElement(e.target)?.closest('.tg-thumb');
        if (!thumb)
            return;
        const full = thumb.getAttribute('data-full') || thumb.querySelector('img')?.src;
        const img = document.getElementById('np-imagePreview');
        if (full && img) {
            img.src = full;
            new bootstrap.Modal('#np-imagePreviewModal').show();
        }
    });
    // Profile: Click "Gán Profile" in context menu
    document.querySelector('#context-profile').addEventListener('click', () => {
        const selection = window.getSelection();
        if (selection.toString().length === 0) {
            showAlert('Vui lòng bôi đen đoạn chữ cần gán Profile.');
            return;
        }
        savedSelection = selection.getRangeAt(0).cloneRange();
        profileIdInput.value = '';
        profilePasswordInput.value = '';
        profileContentInput.innerHTML = '';
        deleteProfileBtn.style.display = 'none';
        currentProfileSpan = null;
        hideAllContextMenus(true); // Preserve savedSelection!
        profileModal.show();
    });
    // Profile: Save button
    saveProfileBtn.addEventListener('click', () => {
        const profileId = profileIdInput.value.trim();
        const profilePassword = profilePasswordInput.value.trim();
        const profileContent = document.getElementById('notes-profile-content-editor')?.innerHTML.trim() || '';
        // Thu thập ảnh từ thumbnail area
        const thumbnailImages = [];
        const thumbnailElements = document.querySelectorAll('#profile-images-thumbnails .position-relative[data-full]');
        thumbnailElements.forEach(el => {
            const fullData = el.getAttribute('data-full');
            if (fullData) {
                thumbnailImages.push(fullData);
            }
        });
        // 1) Giữ content là text thuần
        const finalContent = profileContent;
        // 2) Lưu ảnh thành JSON string
        const imagesJson = JSON.stringify(thumbnailImages);
        // 3) Dọn dữ liệu cũ tự động nếu phát hiện profileSpan.dataset.profileContent còn chứa .tg-thumb
        if (currentProfileSpan && currentProfileSpan.dataset.profileContent) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = currentProfileSpan.dataset.profileContent;
            const hasLegacyImages = tempDiv.querySelectorAll('.tg-thumb').length > 0;
            if (hasLegacyImages) {
                // Gỡ ảnh cũ khỏi content và lưu lại
                const cleanContent = tempDiv.cloneNode(true);
                cleanContent.querySelectorAll('.tg-thumb, img').forEach(n => n.remove());
                currentProfileSpan.dataset.profileContent = cleanContent.innerHTML;
            }
        }
        if (!profileId && !finalContent && thumbnailImages.length === 0) {
            showAlert('Nhập ít nhất 1 trường: Nội dung hoặc ID hoặc ảnh.');
            return;
        }
        if (currentProfileSpan) {
            // Editing existing profile
            currentProfileSpan.dataset.profileId = profileId;
            currentProfileSpan.dataset.profilePassword = profilePassword;
            currentProfileSpan.dataset.profileContent = finalContent; // text only
            currentProfileSpan.dataset.profileImages = imagesJson; // ảnh
            if (profileId)
                currentProfileSpan.textContent = profileId;
            // ✅ Enable instant preview after edit
            requestAnimationFrame(() => initSingleProfilePopover(currentProfileSpan));
        }
        else if (savedSelection) {
            // Creating new profile
            const span = document.createElement('span');
            span.className = 'has-profile';
            span.dataset.profileId = profileId;
            span.dataset.profilePassword = profilePassword;
            span.dataset.profileContent = finalContent; // text only
            span.dataset.profileImages = imagesJson; // ảnh
            span.style.color = '#00e0ff';
            // ✅ CRITICAL FIX: Prevent browser from expanding span when typing
            span.setAttribute('contenteditable', 'false');
            span.appendChild(savedSelection.extractContents());
            savedSelection.insertNode(span);
            // ✅ Insert spacer to place cursor outside span
            const spacer = document.createTextNode('\u200B'); // Zero-width space
            span.parentNode.insertBefore(spacer, span.nextSibling);
            // ✅ CRITICAL FIX: Store the CORRECT editor (detail-editable-full, not notes-content-editor)
            const editor = span.closest('[contenteditable="true"]');
            window._lastProfileSpan = span;
            window._lastProfileSpacer = spacer;
            window._lastProfileEditor = editor;
            // ✅ Enable instant preview after creation
            requestAnimationFrame(() => initSingleProfilePopover(span));
        }
        else {
            // Không có selection và không đang edit -> lỗi logic
            showAlert('Lỗi: Không tìm thấy selection hoặc profile đang chỉnh sửa.');
            return;
        }
        profileModal.hide();
        savedSelection = null;
        currentProfileSpan = null;
        saveNoteChanges(activeNoteId, true);
    });
    // Profile: Delete button
    deleteProfileBtn.addEventListener('click', async () => {
        if (currentProfileSpan && await showConfirm('Xóa profile này?')) {
            // Unwrap the span, replacing it with its own text content
            const parent = currentProfileSpan.parentNode;
            while (currentProfileSpan.firstChild) {
                parent.insertBefore(currentProfileSpan.firstChild, currentProfileSpan);
            }
            parent.removeChild(currentProfileSpan);
            profileModal.hide();
            currentProfileSpan = null;
            saveNoteChanges(activeNoteId, true);
        }
    });
    // Helper function for copy-to-clipboard feedback
    const copyFeedback = (button) => {
        const originalIcon = button.innerHTML;
        button.innerHTML = '<i class="bi bi-check-lg text-success"></i>';
        setTimeout(() => {
            button.innerHTML = originalIcon;
        }, 1500);
    };
    // Profile: Copy buttons
    copyProfileIdBtn.addEventListener('click', function () {
        const idToCopy = profileIdInput.value;
        if (idToCopy) {
            navigator.clipboard.writeText(idToCopy).then(() => {
                copyFeedback(this);
            }).catch(err => {
                console.error('Failed to copy ID: ', err);
                showAlert('Lỗi khi sao chép ID.');
            });
        }
    });
    copyProfilePasswordBtn.addEventListener('click', function () {
        const passwordToCopy = profilePasswordInput.value;
        if (passwordToCopy) {
            navigator.clipboard.writeText(passwordToCopy).then(() => {
                copyFeedback(this);
            }).catch(err => {
                console.error('Failed to copy password: ', err);
                showAlert('Lỗi khi sao chép mật khẩu.');
            });
        }
    });
    // Profile Span Context Menu
    document.addEventListener('contextmenu', (e) => {
        const profileSpan = asElement(e.target)?.closest('.has-profile');
        if (profileSpan) {
            e.preventDefault();
            e.stopPropagation();
            hideAllContextMenus();
            currentProfileSpan = profileSpan;
            showSmartMenu(profileSpanMenu, e.clientX, e.clientY);
        }
    });
    // Profile Span: Click to edit
    document.addEventListener('click', (e) => {
        const target = asElement(e.target);
        const profileSpan = target?.closest('.has-profile');
        if (profileSpan && target?.classList.contains('has-profile')) {
            e.preventDefault();
            e.stopPropagation();
            currentProfileSpan = profileSpan;
            profileIdInput.value = profileSpan.dataset.profileId || '';
            profilePasswordInput.value = profileSpan.dataset.profilePassword || '';
            const fullContent = profileSpan.dataset.profileContent || '';
            const imagesJson = profileSpan.dataset.profileImages;
            let imageArray = [];
            if (imagesJson) {
                try {
                    imageArray = JSON.parse(imagesJson) || [];
                }
                catch { }
            }
            if (imageArray.length > 0) {
                // a) text: đảm bảo không có ảnh lẫn trong content
                const tmp = document.createElement('div');
                tmp.innerHTML = fullContent;
                // phòng legacy: nếu ai đó còn .tg-thumb trong content => gỡ ra
                tmp.querySelectorAll('.tg-thumb, img').forEach(n => n.remove());
                profileContentInput.innerHTML = tmp.innerHTML;
                // b) thumbnails từ mảng ảnh
                const container = document.getElementById('profile-images-container');
                const thumbs = document.getElementById('profile-images-thumbnails');
                thumbs.innerHTML = '';
                container.style.display = 'block';
                imageArray.forEach(full => {
                    makeThumb(full, 150, 0.9).then(thumb => addImageToThumbnailArea(full, thumb));
                });
            }
            else {
                // LEGACY fallback: tách ảnh .tg-thumb đang cũ trong content (đã có sẵn logic)
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = fullContent;
                const images = tempDiv.querySelectorAll('.tg-thumb');
                images.forEach(n => n.remove());
                profileContentInput.innerHTML = tempDiv.innerHTML; // text only
                loadImagesIntoThumbnailArea(images); // đổ thumb
            }
            deleteProfileBtn.style.display = 'block';
            profileModal.show();
        }
    });
    function loadImagesIntoThumbnailArea(imageElements) {
        const container = document.getElementById('profile-images-container');
        const thumbnailsArea = document.getElementById('profile-images-thumbnails');
        if (!container || !thumbnailsArea)
            return;
        // Clear existing thumbnails
        thumbnailsArea.innerHTML = '';
        if (imageElements.length === 0) {
            container.style.display = 'none';
            return;
        }
        // Load each image
        imageElements.forEach(imgEl => {
            const fullData = imgEl.getAttribute('data-full') || imgEl.querySelector('img')?.src;
            if (fullData) {
                makeThumb(fullData, 150, 0.9).then(thumbData => {
                    addImageToThumbnailArea(fullData, thumbData);
                });
            }
        });
    }
    // Profile Span: Change color
    profileSpanMenu.addEventListener('click', (e) => {
        const colorOption = asElement(e.target)?.closest('.color-option');
        if (colorOption && currentProfileSpan) {
            const newColor = colorOption.dataset.color || '';
            const profileId = currentProfileSpan.dataset.profileId || '';
            // Update the span color
            currentProfileSpan.style.color = newColor;
            // Save color to localStorage
            if (window.profileColors) {
                window.profileColors[profileId] = newColor;
                localStorage.setItem('profileColors', JSON.stringify(window.profileColors));
            }
            hideAllContextMenus();
            saveNoteChanges(activeNoteId, true);
        }
    });
    // Profile Span: Delete
    document.querySelector('#context-delete-profile').addEventListener('click', async () => {
        if (currentProfileSpan && await showConfirm('Xóa profile này?')) {
            // Unwrap the span, replacing it with its own text content
            const parent = currentProfileSpan.parentNode;
            while (currentProfileSpan.firstChild) {
                parent.insertBefore(currentProfileSpan.firstChild, currentProfileSpan);
            }
            parent.removeChild(currentProfileSpan);
            hideAllContextMenus();
            currentProfileSpan = null;
            saveNoteChanges(activeNoteId, true);
        }
    });
    // Title input context menu (như phiên bản cũ)
    titleInput.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        const selection = window.getSelection();
        // Chỉ hiển thị menu nếu có đoạn text được bôi đen
        if (selection.toString().length > 0) {
            // Đây là logic đúng, giống hệt với của ô Nội dung
            editorContextMenu.style.top = `${e.clientY}px`;
            editorContextMenu.style.left = `${e.clientX}px`;
            editorContextMenu.style.display = 'block';
        }
    });
    // --- Card Height Modifier ---
    function applySavedCardSize() {
        const savedModifier = localStorage.getItem('notesCardSizeModifier') || 'default';
        container.classList.remove('h-minus-2', 'h-minus-4');
        if (savedModifier !== 'default') {
            container.classList.add(savedModifier);
        }
        // Update checkmarks in menu
        const tabMenu = document.getElementById('notes-tab-context-menu');
        if (tabMenu) {
            const allChecks = tabMenu.querySelectorAll('.submenu .bi-check-circle-fill');
            allChecks.forEach(check => check.classList.add('d-none'));
            const activeCheck = tabMenu.querySelector(`.submenu [data-size-modifier="${savedModifier}"] i`);
            if (activeCheck) {
                activeCheck.classList.remove('d-none');
            }
        }
    }
    // Event listener for size modifier menu
    const sizeModifierMenu = document.getElementById('notes-tab-context-menu');
    if (sizeModifierMenu) {
        sizeModifierMenu.addEventListener('click', (e) => {
            const target = asElement(e.target);
            const addItem = target?.closest('.menu-item[data-action="add-note"]');
            if (addItem) {
                e.preventDefault();
                window.addNewNoteFromContextMenu();
                return;
            }
            const sizeItem = target?.closest('.submenu .menu-item[data-size-modifier]');
            if (sizeItem) {
                const modifier = sizeItem.dataset.sizeModifier || 'default';
                localStorage.setItem('notesCardSizeModifier', modifier);
                applySavedCardSize();
                hideAllContextMenus();
            }
        });
    }
    // Global clicks
    notesPane.addEventListener('contextmenu', handleTabContextMenu);
    // --- Profile Functions ---
    // Initialize profile colors storage
    if (typeof (Storage) !== "undefined") {
        const savedColors = localStorage.getItem('profileColors');
        if (savedColors) {
            window.profileColors = JSON.parse(savedColors);
        }
        else {
            window.profileColors = {};
        }
    }
    // Apply saved colors on load
    function applySavedColors() {
        if (window.profileColors) {
            Object.keys(window.profileColors).forEach(profileId => {
                const color = window.profileColors[profileId];
                const spans = document.querySelectorAll(`.has-profile[data-profile-id="${profileId}"]`);
                spans.forEach(span => {
                    span.style.color = color;
                });
            });
        }
    }
    // Helper: Initialize popover for a single profile span (for instant preview after creation)
    function initSingleProfilePopover(span) {
        const profileId = span.dataset.profileId || '';
        const profilePassword = span.dataset.profilePassword || '';
        const profileContent = span.dataset.profileContent || '';
        // 1) Lấy ảnh ưu tiên từ dataset.profileImages
        let src = null;
        const imagesJson = span.dataset.profileImages;
        if (imagesJson) {
            try {
                const arr = JSON.parse(imagesJson);
                if (Array.isArray(arr) && arr.length)
                    src = arr[0];
            }
            catch { }
        }
        // 2) Fallback legacy: moi ảnh từ HTML content (tg-thumb / img)
        if (!src && profileContent) {
            const tmp = document.createElement('div');
            tmp.innerHTML = profileContent;
            const firstThumb = tmp.querySelector('.tg-thumb');
            const firstImg = firstThumb ? null : tmp.querySelector('img');
            src = firstThumb
                ? (firstThumb.getAttribute('data-full') || firstThumb.querySelector('img')?.src)
                : (firstImg ? firstImg.getAttribute('src') : null);
        }
        let mediaHTML = '';
        if (src) {
            mediaHTML = `
                <div class="preview-container notes-copy-preview-container">
                    <img src="${src}" alt="preview" width="400" height="400" class="notes-copy-preview-img"/>
                </div>`;
        }
        const popoverContent = `
                <div class="profile-popover-content">
                    ${profileId ? `<div><strong>ID:</strong> ${profileId}</div>` : ''}
                    ${profilePassword ? `<div><strong>Password:</strong> ${profilePassword}</div>` : ''}
                    ${profileContent ? `<div class="notes-copy-profile-content">${profileContent}</div>` : ''}
                    ${mediaHTML}
                </div>
            `;
        // Dispose instance cũ nếu có
        const old = bootstrap.Popover.getInstance(span);
        if (old)
            old.dispose();
        // Tạo instance mới
        new bootstrap.Popover(span, {
            content: popoverContent,
            html: true,
            trigger: 'hover',
            placement: 'bottom',
            container: 'body',
            customClass: 'profile-popover-500',
            template: '<div class="popover profile-popover-500" role="tooltip"><div class="popover-arrow"></div><div class="popover-body p-2"></div></div>',
            boundary: 'viewport',
            fallbackPlacements: ['bottom', 'top', 'left', 'right'],
            offset: [0, 8],
            delay: { show: 60, hide: 120 }
        });
        // Bind update popper đúng cách, CHỈ bind 1 lần/span
        if (!span.dataset.profilePopoverBound) {
            span.dataset.profilePopoverBound = '1';
            span.addEventListener('shown.bs.popover', () => {
                const popId = span.getAttribute('aria-describedby');
                const root = popId ? document.getElementById(popId) : null;
                const img = root?.querySelector('.preview-container > img');
                if (root) {
                    root.style.width = '448px';
                    root.style.maxWidth = '448px';
                }
                const inst = bootstrap.Popover.getInstance(span);
                const upd = () => { inst?._popper?.update?.(); };
                if (img) {
                    img.complete ? upd() : img.addEventListener('load', upd, { once: true });
                }
            });
        }
    }
    // Initialize profile interactions (popovers, click handlers)
    function initializeProfileInteractions() {
        const editor = document.getElementById('detail-editable-full');
        if (!editor)
            return;
        // First, destroy any existing popovers to prevent duplicates
        editor.querySelectorAll('.has-profile').forEach(span => {
            const popoverInstance = bootstrap.Popover.getInstance(span);
            if (popoverInstance) {
                popoverInstance.dispose();
            }
        });
        // Add popovers to all profile spans
        editor.querySelectorAll('.has-profile').forEach(span => {
            const profileId = span.dataset.profileId || '';
            const profilePassword = span.dataset.profilePassword || '';
            const profileContent = span.dataset.profileContent || '';
            // Lấy ảnh đầu tiên trong content (nếu có) để preview 400x400
            let mediaHTML = '';
            const imagesJson = span.dataset.profileImages;
            let src = null;
            if (imagesJson) {
                try {
                    const arr = JSON.parse(imagesJson);
                    if (Array.isArray(arr) && arr.length)
                        src = arr[0]; // ảnh đầu tiên
                }
                catch { }
            }
            if (!src && profileContent) {
                const tmp = document.createElement('div');
                tmp.innerHTML = profileContent;
                const firstThumb = tmp.querySelector('.tg-thumb');
                const firstImg = firstThumb ? null : tmp.querySelector('img');
                src = firstThumb
                    ? (firstThumb.getAttribute('data-full') || firstThumb.querySelector('img')?.src)
                    : (firstImg ? firstImg.getAttribute('src') : null);
            }
            if (src) {
                mediaHTML = `
                    <div class="preview-container notes-copy-preview-container">
                        <img
                            src="${src}"
                            alt="preview"
                            width="400" height="400"
                            class="notes-copy-preview-img"
                        />
                    </div>`;
            }
            const popoverContent = `
                <div class="profile-popover-content">
                    ${profileId ? `<div><strong>ID:</strong> ${profileId}</div>` : ''}
                    ${profilePassword ? `<div><strong>Password:</strong> ${profilePassword}</div>` : ''}
                    ${profileContent ? `<div class="notes-copy-profile-content">${profileContent}</div>` : ''}
                    ${mediaHTML}
                </div>
            `;
            // Gỡ popover cũ
            const old = bootstrap.Popover.getInstance(span);
            if (old)
                old.dispose();
            const pop = new bootstrap.Popover(span, {
                content: popoverContent,
                html: true,
                trigger: 'hover',
                placement: 'bottom',
                container: 'body',
                customClass: 'profile-popover-500',
                template: '<div class="popover profile-popover-500" role="tooltip"><div class="popover-arrow"></div><div class="popover-body p-2"></div></div>',
                boundary: 'viewport',
                fallbackPlacements: ['bottom', 'top', 'left', 'right'],
                offset: [0, 8],
                delay: { show: 60, hide: 120 }
            });
            span.addEventListener('shown.bs.popover', () => {
                const root = document.querySelector('.popover.profile-popover-500:last-of-type');
                const img = root?.querySelector('.preview-container > img');
                if (!root)
                    return;
                // Siết lại lần nữa để thắng mọi CSS lạ
                root.style.width = '448px';
                root.style.maxWidth = '448px';
                if (img) {
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    // BẮT BUỘC cập nhật popper khi ảnh đã load xong
                    const upd = () => { pop._popper && pop._popper.update && pop._popper.update(); };
                    img.complete ? upd() : img.addEventListener('load', upd, { once: true });
                }
            });
        });
    }
    // ===== CONTEXT MENU CHUỘT PHẢI TRÊN CARD GHI CHÚ =====
    (function setupNoteCardContextMenu() {
        const notesRoot = document.querySelector("#notes-container"); // nơi chứa danh sách card
        const cardMenuEl = document.getElementById("note-card-context-menu");
        if (!notesRoot || !cardMenuEl) {
            console.warn("Context menu Ghi Chú: thiếu phần tử cần thiết (notesRoot/cardMenuEl)");
            return;
        }
        // Chuột phải vào card
        notesRoot.addEventListener("contextmenu", function (ev) {
            const mouseEvent = ev;
            // tìm card gần nhất
            const noteCardEl = asElement(ev.target)?.closest(".card[data-note-id]");
            if (!noteCardEl) {
                // click phải vùng trống -> ẩn menu
                hideAllContextMenus();
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            hideAllContextMenus();
            // Lấy ID ghi chú
            const noteId = noteCardEl.getAttribute("data-note-id") || noteCardEl.id || "";
            cardMenuEl.dataset.noteId = noteId;
            // Cập nhật text "Đánh dấu / Bỏ đánh dấu" dựa trên trạng thái hiện tại
            const noteObj = window.notesData.find(n => String(n.id) === String(noteId));
            const markBtn = cardMenuEl.querySelector('[data-action="mark"]');
            if (noteObj && markBtn) {
                markBtn.innerHTML = noteObj.is_marked
                    ? '<i class="bi bi-star-fill me-2"></i> Bỏ Đánh Dấu'
                    : '<i class="bi bi-star-fill me-2"></i> Đánh Dấu';
            }
            // Hiển thị menu với định vị thông minh kiểu MXH
            showSmartMenu(cardMenuEl, mouseEvent.clientX, mouseEvent.clientY);
        });
        // Ngăn chuột phải vào chính menu gây menu hệ thống
        cardMenuEl.addEventListener("contextmenu", function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        });
        // Click vào item trong menu card
        cardMenuEl.addEventListener("click", async function (ev) {
            const item = asElement(ev.target)?.closest(".menu-item[data-action]");
            if (!item)
                return;
            const action = item.getAttribute("data-action"); // open / mark / duplicate / copy-id / delete
            const noteId = cardMenuEl.dataset.noteId;
            hideAllContextMenus();
            // Xử lý action trực tiếp thay vì dùng hàm handleNoteMenuAction
            switch (action) {
                case 'mark':
                    // Đánh dấu/bỏ đánh dấu
                    if (noteId) {
                        try {
                            const data = await toggleNoteMarkOnServer(noteId);
                            if (data.success) {
                                await fetchAndRenderNotes(searchInput.value.toLowerCase().trim());
                                showToast('Đã cập nhật đánh dấu!', 'success');
                            }
                        }
                        catch (error) {
                            console.error('Error toggling mark:', error);
                            showToast('Lỗi khi cập nhật đánh dấu. Vui lòng thử lại.', 'error');
                        }
                    }
                    break;
                case 'copy-id':
                    // Copy ID ghi chú
                    if (noteId) {
                        navigator.clipboard.writeText(noteId).then(() => {
                            showToast('Đã copy ID ghi chú!', 'success');
                        }).catch(err => {
                            console.error('Failed to copy ID:', err);
                            showToast('Lỗi khi copy ID.', 'error');
                        });
                    }
                    break;
                case 'delete':
                    requestDeleteNote(noteId, ev);
                    break;
            }
        });
    })();
    // --- Initial Setup ---
    async function initializeNotesView() {
        // Close detail panel if it's open, ensuring a clean list state.
        if (detailWrapper.classList.contains('visible')) {
            window.closeDetailPanel();
        }
        // Await fetching and rendering to ensure data and elements are ready
        await fetchAndRenderNotes();
        // Apply card size settings
        applySavedCardSize();
        // NEW LOGIC: Automatically select and show the first note (như phiên bản cũ)
        if (window.filteredNotes && window.filteredNotes.length > 0) {
            const firstNote = window.filteredNotes[0];
            // Open the detail panel layout
            openDetailPanel();
            // Populate the panel with the first note's details
            showNoteDetail(firstNote);
        }
    }
    window.addEventListener('pagehide', () => flushPendingNoteSave(true));
    window.addEventListener('beforeunload', () => flushPendingNoteSave(true));
    document.addEventListener('visibilitychange', () => {
        if (document.hidden)
            flushPendingNoteSave(true);
    });
    window.registerDashboardTabLifecycle?.('notes', {
        pause() {
            captureDashboardSelection();
            flushPendingNoteSave();
        },
        resume() {
            requestAnimationFrame(restoreDashboardSelection);
        }
    });
    initializeNotesView();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotesDashboardTab, { once: true });
}
else {
    initNotesDashboardTab();
}
