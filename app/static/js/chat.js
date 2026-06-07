"use strict";
(function () {
    let currentSessionId = null;
    let providerSettings = {}; // Store settings for all providers
    const MODEL_DISPLAY_NAMES = {
        'Hermes Agent': 'Hermes Agent',
        'gpt-4o': 'GPT-4o',
        'gpt-3.5-turbo': 'GPT-3.5',
        'gemini-2.5-flash': 'Gemini 2.5 Flash',
        'gemini-2.5-pro': 'Gemini 2.5 Pro'
    };
    function getSelectedModel() {
        try {
            return JSON.parse(localStorage.getItem('selectedModel') || '{}');
        }
        catch {
            return {};
        }
    }
    function setCurrentModelName(model) {
        const modelNameEl = document.getElementById('current-model-name');
        if (modelNameEl)
            modelNameEl.textContent = MODEL_DISPLAY_NAMES[model] || model;
    }
    function isHomeCommandCenter() {
        return Boolean(document.querySelector('.home-command-center'));
    }
    function showChatNotice(message, type = 'info') {
        const toast = window.showToast;
        if (typeof toast === 'function') {
            toast(message, type);
            return;
        }
        console[type === 'error' ? 'error' : 'log'](message);
    }
    async function confirmChatAction(message, title = 'Xác nhận') {
        const confirmModal = window.confirm;
        if (typeof confirmModal !== 'function')
            return false;
        const result = confirmModal(message, title);
        return typeof result?.then === 'function' ? Boolean(await result) : Boolean(result);
    }
    function openChatPanel() {
        const chatPanel = document.getElementById('hermes-chat-panel');
        if (chatPanel && !chatPanel.classList.contains('is-open')) {
            chatPanel.classList.add('is-open');
            document.querySelector('.home-hero-copy')?.classList.add('chat-open');
            setTimeout(() => {
                chatPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                const chatInput = document.getElementById('user-input');
                if (chatInput)
                    chatInput.focus();
            }, 100);
        }
    }
    document.addEventListener('DOMContentLoaded', function () {
        // Set default model if not already set
        if (!localStorage.getItem('selectedModel')) {
            localStorage.setItem('selectedModel', JSON.stringify({
                provider: 'hermes',
                model: 'Hermes Agent'
            }));
            setCurrentModelName('Hermes Agent');
        }
        else {
            // Restore selected model display
            const selected = getSelectedModel();
            setCurrentModelName(selected.model || 'Hermes Agent');
        }
        loadSessions();
        loadAISettings();
        // Check if we're returning to this tab or loading fresh
        // Check if we're returning to this tab or loading fresh
        // const savedSessionId = sessionStorage.getItem('currentSessionId'); // Use sessionStorage for tab-specific persistence
        // const wasOnHomePage = sessionStorage.getItem('wasOnHomePage');
        // FORCE NEW CHAT ON LOAD as requested
        // if (savedSessionId && wasOnHomePage === 'true') {
        //    // Returning from another tab - restore the session
        //    loadSession(savedSessionId);
        // } else {
        // Fresh load or first time - start new chat
        startNewChat();
        sessionStorage.removeItem('currentSessionId');
        // }
        // Mark that we're on the home page
        sessionStorage.setItem('wasOnHomePage', 'true');
        // Auto-resize textarea
        const textarea = document.getElementById('user-input');
        textarea.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            if (this.value === '')
                this.style.height = '24px'; // Reset to min height
        });
        // Handle Enter key to send
        textarea.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        // Handle Form Submit
        document.getElementById('chat-form').addEventListener('submit', function (e) {
            e.preventDefault();
            sendMessage();
        });
        // Search filter
        document.getElementById('chatSearch').addEventListener('input', function (e) {
            const term = (e.target?.value || '').toLowerCase();
            const items = document.querySelectorAll('.chat-history-item');
            items.forEach(item => {
                const text = (item.textContent || '').toLowerCase();
                item.style.display = text.includes(term) ? 'block' : 'none';
            });
        });
        // --- Default Focus Logic ---
        // 1. Activate Home Tab
        const homeTabLink = document.getElementById('home-tab-link');
        if (homeTabLink && !homeTabLink.classList.contains('active')) {
            homeTabLink.click();
        }
        // 2. Start New Chat & Focus Input
        // Wait a bit for tab animation
        setTimeout(() => {
            startNewChat();
            // Focus input is handled inside startNewChat, but let's ensure it
            const chatInput = document.getElementById('user-input');
            if (chatInput && !isHomeCommandCenter())
                chatInput.focus();
        }, 500);
        // Initialize Tooltips
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
        // --- Mini Chat Bubble Logic ---
        const miniChatBubble = document.getElementById('mini-chat-bubble');
        const miniChatWindow = document.getElementById('mini-chat-window');
        const chatTabLink = document.querySelector('button[data-bs-target="#v-pills-chat"]');
        // Show/Hide Bubble based on Active Tab
        if (chatTabLink) {
            chatTabLink.addEventListener('shown.bs.tab', function (e) {
                if (miniChatBubble)
                    miniChatBubble.style.display = 'none';
                if (miniChatWindow)
                    miniChatWindow.style.display = 'none'; // Close window if returning to main chat
            });
            // Listen for other tabs showing
            document.querySelectorAll('button[data-bs-toggle="pill"]').forEach(tab => {
                if (tab !== chatTabLink) {
                    tab.addEventListener('shown.bs.tab', function (e) {
                        if (miniChatBubble)
                            miniChatBubble.style.display = 'flex';
                    });
                }
            });
        }
        // Initial check
        const activeTab = document.querySelector('.nav-link.active');
        if (activeTab && activeTab.getAttribute('data-bs-target') !== '#v-pills-chat') {
            if (miniChatBubble)
                miniChatBubble.style.display = 'flex';
        }
        // Global Paste Event Listener
        document.addEventListener('paste', function (e) {
            // Only handle if we are on the chat page (user-input exists)
            const userInput = document.getElementById('user-input');
            if (!userInput)
                return;
            console.log('Global paste event detected');
            const clipboardData = e.clipboardData || e.originalEvent?.clipboardData;
            if (!clipboardData)
                return;
            const items = clipboardData.items;
            for (let index in items) {
                const item = items[index];
                if (item.kind === 'file' && item.type.includes('image/')) {
                    const blob = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = function (event) {
                        const base64 = event.target?.result;
                        if (typeof base64 === 'string')
                            showImagePreview(base64);
                    };
                    reader.readAsDataURL(blob);
                    e.preventDefault(); // Prevent default paste behavior for images
                    return; // Stop processing other items
                }
            }
        });
        // Provider Change Listener
        document.getElementById('ai-provider')?.addEventListener('change', function (e) {
            updateSettingsUI(e.target.value);
        });
        // Setup context menu for chat history
        setupChatHistoryContextMenu();
        // --- Home Hermes Chat Collapse/Expand Logic ---
        const chatPanel = document.getElementById('hermes-chat-panel');
        const searchForm = document.getElementById('homeCommandSearch');
        const collapseBtn = document.getElementById('btn-collapse-hermes');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (chatPanel) {
                    chatPanel.classList.remove('is-open');
                    document.querySelector('.home-hero-copy')?.classList.remove('chat-open');
                    if (searchForm) {
                        searchForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            });
        }
    });
    // Image Preview Functions
    let currentImageBase64 = null;
    function showImagePreview(base64) {
        currentImageBase64 = base64;
        const preview = document.getElementById('image-preview');
        if (preview)
            preview.src = base64;
        const container = document.getElementById('image-preview-container');
        if (!container)
            return;
        container.classList.remove('d-none');
        container.style.display = 'block'; // Force show (resetting inline style from clearImagePreview)
        // Focus back on input
        document.getElementById('user-input')?.focus();
    }
    function clearImagePreview() {
        currentImageBase64 = null;
        const preview = document.getElementById('image-preview');
        if (preview)
            preview.src = '';
        const container = document.getElementById('image-preview-container');
        if (!container)
            return;
        container.classList.add('d-none');
        container.style.display = 'none'; // Force hide
    }
    // Context Menu Functions
    function setupChatHistoryContextMenu() {
        document.addEventListener('contextmenu', function (e) {
            const historyItem = e.target?.closest('.chat-history-item');
            if (historyItem) {
                e.preventDefault();
                showContextMenu(e.clientX, e.clientY, historyItem.dataset.id);
            }
        });
        // Close context menu on click elsewhere
        document.addEventListener('click', hideContextMenu);
    }
    function showContextMenu(x, y, sessionId) {
        hideContextMenu(); // Remove existing menu if any
        const menu = document.createElement('div');
        menu.id = 'chat-context-menu';
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.innerHTML = `
        <div class="context-menu-item" data-chat-delete-session="${sessionId}">
            <i class="bi bi-trash me-2"></i>Xoá chat
        </div>
    `;
        menu.addEventListener('click', (event) => {
            const deleteItem = event.target?.closest('[data-chat-delete-session]');
            if (!deleteItem)
                return;
            deleteChat(deleteItem.dataset.chatDeleteSession);
        });
        document.body.appendChild(menu);
    }
    function hideContextMenu() {
        const menu = document.getElementById('chat-context-menu');
        if (menu)
            menu.remove();
    }
    async function deleteChat(sessionId) {
        if (!sessionId)
            return;
        if (!(await confirmChatAction('Are you sure you want to delete this chat?')))
            return;
        try {
            const response = await fetch(`/api/chat/delete_session/${sessionId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                // If deleted chat was current session, start new chat
                if (currentSessionId === sessionId) {
                    startNewChat();
                    sessionStorage.removeItem('currentSessionId');
                }
                loadSessions(); // Refresh history list
            }
        }
        catch (error) {
            console.error('Error deleting chat:', error);
        }
        hideContextMenu();
    }
    function toggleSidebar() {
        document.getElementById('chatSidebar').classList.toggle('show');
    }
    function selectModel(provider, model) {
        // Update display name
        const displayName = MODEL_DISPLAY_NAMES[model] || model;
        setCurrentModelName(model);
        // Update settings
        const providerInput = document.getElementById('ai-provider');
        const modelInput = document.getElementById('ai-model');
        if (providerInput)
            providerInput.value = provider;
        if (modelInput)
            modelInput.value = model;
        providerSettings.provider = provider;
        if (provider === 'hermes') {
            providerSettings.hermes_model = model || 'Hermes Agent';
        }
        else if (provider === 'gemini') {
            providerSettings.gemini_model = model;
        }
        else if (provider === 'openai') {
            providerSettings.openai_model = model;
        }
        updateSettingsUI(provider);
        // Save to localStorage
        const settings = {
            provider: provider,
            model: model
        };
        localStorage.setItem('selectedModel', JSON.stringify(settings));
        console.log(`Selected model: ${provider} - ${displayName}`);
    }
    async function loadSessions() {
        try {
            const response = await fetch('/api/chat/sessions');
            const data = await response.json();
            const list = document.getElementById('chatHistoryList');
            list.innerHTML = '';
            if (data.success && data.sessions.length > 0) {
                data.sessions.forEach((session) => {
                    const item = document.createElement('a');
                    item.href = '#';
                    item.className = 'chat-history-item';
                    item.textContent = session.title || 'Chat mới';
                    item.dataset.id = session.id;
                    item.onclick = (e) => {
                        e.preventDefault();
                        loadSession(session.id);
                    };
                    list.appendChild(item);
                });
            }
            else {
                list.innerHTML = '<div class="text-center text-muted small mt-3">Chưa có lịch sử</div>';
            }
        }
        catch (error) {
            console.error('Failed to load sessions:', error);
        }
    }
    function startNewChat() {
        currentSessionId = null;
        const messages = document.getElementById('chat-messages');
        messages.innerHTML = `
        <div class="h-100 d-flex flex-column justify-content-center align-items-center text-center p-4 empty-state">
            <div class="mb-4">
                <div class="logo-circle">
                    <i class="bi bi-robot fs-1"></i>
                </div>
            </div>
            <h3 class="mb-3 fw-bold">Hermes sẵn sàng</h3>
            <div class="d-flex flex-wrap justify-content-center gap-2">
                <button class="btn-suggestion" type="button" onclick="sendSuggestion('Tóm tắt dashboard hôm nay')">Tóm tắt dashboard</button>
                <button class="btn-suggestion" type="button" onclick="sendSuggestion('Kiểm tra các ghi chú mới nhất')">Ghi chú mới</button>
                <button class="btn-suggestion" type="button" onclick="sendSuggestion('Xem tình trạng Telegram')">Telegram</button>
            </div>
        </div>
    `;
        // Center input when empty
        const container = document.querySelector('.chat-input-container');
        if (container)
            container.classList.add('centered');
        document.querySelectorAll('.chat-history-item').forEach(el => el.classList.remove('active'));
        clearImagePreview();
    }
    async function loadSession(sessionId) {
        currentSessionId = sessionId;
        sessionStorage.setItem('currentSessionId', sessionId); // Persist session in current tab
        document.querySelectorAll('.chat-history-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === sessionId);
        });
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-light" role="status"></div></div>';
        try {
            const response = await fetch(`/api/chat/history/${sessionId}`);
            const data = await response.json();
            chatMessages.innerHTML = '';
            if (data.success) {
                data.history.forEach((msg) => appendMessage(msg.role, msg.content));
                chatMessages.scrollTop = chatMessages.scrollHeight;
                // Remove centered class when loading existing chat
                if (data.history && data.history.length > 0) {
                    const container = document.querySelector('.chat-input-container');
                    if (container)
                        container.classList.remove('centered');
                }
            }
        }
        catch (error) {
            chatMessages.innerHTML = `<div class="text-danger text-center mt-5">Error loading chat: ${error.message}</div>`;
        }
    }
    function appendMessage(role, content, modelName = null) {
        const chatMessages = document.getElementById('chat-messages');
        const emptyState = chatMessages.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
            // Move input to bottom when first message appears
            const container = document.querySelector('.chat-input-container');
            if (container)
                container.classList.remove('centered');
        }
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${role === 'user' ? 'user' : 'ai'}`; // Add specific class
        const avatarClass = role === 'user' ? 'user-avatar-img' : 'ai-avatar-img';
        // User requested to remove the user icon symbol but keep the colored circle
        const avatarIcon = role === 'user' ? '' : '<i class="bi bi-robot"></i>';
        // Determine Display Name - NO NAME for user messages
        let displayName = '';
        if (role === 'user') {
            displayName = ''; // No label for user
        }
        else {
            // Use passed model name, or current setting, or fallback
            if (modelName) {
                displayName = modelName;
            }
            else {
                // Try to get from settings if not passed (e.g. history load)
                const provider = providerSettings.provider || 'openai';
                if (provider === 'openai')
                    displayName = providerSettings.openai_model || 'GPT-3.5 Turbo';
                else if (provider === 'gemini')
                    displayName = providerSettings.gemini_model || 'Gemini Pro';
            }
        }
        // Handle Image Content (if content is JSON-like or contains image marker)
        // For now, assume content is text. If we support images in history, we need to parse.
        // Simple check for image tag in content (if we save it as HTML)
        let formattedContent = content
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        // Only show name if it exists (AI messages only)
        const nameHtml = displayName ? `<div class="fw-bold mb-1">${displayName}</div>` : '';
        messageRow.innerHTML = `
        <div class="message-container">
            <div class="message-avatar ${avatarClass}">${avatarIcon}</div>
            <div class="message-content">
                ${nameHtml}
                <div>${formattedContent}</div>
            </div>
        </div>
    `;
        chatMessages.appendChild(messageRow);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    function sendSuggestion(text) {
        document.getElementById('user-input').value = text;
        sendMessage();
    }
    async function sendMessage() {
        const input = document.getElementById('user-input');
        const message = input.value.trim();
        // Allow sending if there is an image, even if text is empty
        if (!message && !currentImageBase64)
            return;
        input.value = '';
        input.style.height = '24px';
        // Display User Message
        let displayContent = message;
        if (currentImageBase64) {
            displayContent = `<img src="${currentImageBase64}" class="chat-message-image" alt="Uploaded image">` + message;
        }
        appendMessage('user', displayContent);
        // Clear image immediately after adding to UI
        const imageToSend = currentImageBase64; // Store for payload
        clearImagePreview();
        const chatMessages = document.getElementById('chat-messages');
        const loadingId = 'loading-' + Date.now();
        const loadingRow = document.createElement('div');
        loadingRow.className = 'message-row ai'; // Add ai class
        loadingRow.id = loadingId;
        // Get current model name for loading state
        let currentModelName = 'Hermes Agent';
        const provider = getSelectedModel().provider || providerSettings.provider || 'hermes';
        if (provider === 'openai')
            currentModelName = providerSettings.openai_model || 'GPT-3.5 Turbo';
        else if (provider === 'gemini')
            currentModelName = providerSettings.gemini_model || 'Gemini Pro';
        loadingRow.innerHTML = `
        <div class="message-container">
            <div class="message-avatar ai-avatar-img"><i class="bi bi-robot"></i></div>
            <div class="message-content">
                <div class="fw-bold mb-1">${currentModelName}</div>
                <div class="typing-indicator"><span></span><span></span><span></span></div>
            </div>
        </div>
    `;
        chatMessages.appendChild(loadingRow);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        try {
            // Get selected model from localStorage
            const selectedModel = getSelectedModel();
            const payload = {
                message: message,
                session_id: currentSessionId,
                provider: selectedModel.provider || providerSettings.provider || 'hermes',
                model: selectedModel.model || 'Hermes Agent'
            };
            if (imageToSend) {
                payload.image = imageToSend;
            }
            const response = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            document.getElementById(loadingId)?.remove();
            if (data.success) {
                if (!currentSessionId || currentSessionId !== data.session_id) {
                    currentSessionId = data.session_id;
                    sessionStorage.setItem('currentSessionId', String(currentSessionId)); // Persist session in current tab
                    loadSessions();
                }
                // Pass the model name used (we assume it's the same as what we sent)
                appendMessage('assistant', data.response, currentModelName);
            }
            else {
                appendMessage('assistant', 'Error: ' + data.error, currentModelName);
            }
        }
        catch (error) {
            document.getElementById(loadingId)?.remove();
            appendMessage('assistant', 'Network Error: ' + error.message, currentModelName);
        }
        finally {
            // Image already cleared
        }
    }
    async function clearAllChats() {
        if (!(await confirmChatAction('Are you sure you want to delete all chat history?')))
            return;
        showChatNotice('Feature coming soon!', 'info');
    }
    // --- Smart Settings Logic ---
    async function loadAISettings() {
        try {
            const response = await fetch('/api/chat/settings');
            const data = await response.json();
            if (data.success) {
                providerSettings = data.settings; // Store all settings
                // Set current provider
                const currentProvider = getSelectedModel().provider || providerSettings.provider || 'hermes';
                const providerInput = document.getElementById('ai-provider');
                if (providerInput)
                    providerInput.value = currentProvider;
                // Load System Prompts
                const promptFields = {
                    'system-prompt-general': providerSettings.system_prompt_general,
                    'system-prompt-mxh': providerSettings.system_prompt_mxh,
                    'system-prompt-notes': providerSettings.system_prompt_notes,
                    'system-prompt-telegram': providerSettings.system_prompt_telegram,
                    'system-prompt-image': providerSettings.system_prompt_image
                };
                Object.entries(promptFields).forEach(([id, value]) => {
                    const field = document.getElementById(id);
                    if (field)
                        field.value = value || '';
                });
                updateSettingsUI(currentProvider);
                updateHeaderModelName(currentProvider);
            }
        }
        catch (error) {
            console.error(error);
        }
    }
    function updateSettingsUI(provider) {
        // Load Key/Model based on provider
        const apiKeyInput = document.getElementById('ai-api-key');
        const modelInput = document.getElementById('ai-model');
        const apiKeyRow = document.getElementById('ai-api-key-row');
        if (apiKeyRow)
            apiKeyRow.classList.toggle('d-none', provider === 'hermes');
        if (!apiKeyInput || !modelInput)
            return;
        if (provider === 'hermes') {
            apiKeyInput.value = '';
            modelInput.value = providerSettings.hermes_model || 'Hermes Agent';
            modelInput.placeholder = 'Hermes Agent';
        }
        else if (provider === 'openai') {
            apiKeyInput.value = providerSettings.openai_api_key || '';
            modelInput.value = providerSettings.openai_model || 'gpt-3.5-turbo';
            modelInput.placeholder = 'e.g. gpt-4o';
        }
        else if (provider === 'gemini') {
            apiKeyInput.value = providerSettings.gemini_api_key || '';
            modelInput.value = providerSettings.gemini_model || 'gemini-2.5-flash';
            modelInput.placeholder = 'e.g. gemini-2.5-flash';
        }
    }
    function updateHeaderModelName(provider) {
        let modelName = '';
        if (provider === 'hermes') {
            modelName = providerSettings.hermes_model || 'Hermes Agent';
        }
        else if (provider === 'openai') {
            modelName = providerSettings.openai_model || 'GPT-3.5 Turbo';
        }
        else if (provider === 'gemini') {
            modelName = providerSettings.gemini_model || 'Gemini 2.5 Flash';
        }
        if (!modelName)
            modelName = provider.charAt(0).toUpperCase() + provider.slice(1);
        setCurrentModelName(modelName);
    }
    async function saveAISettings() {
        const provider = document.getElementById('ai-provider').value;
        const apiKey = document.getElementById('ai-api-key').value;
        const model = document.getElementById('ai-model').value;
        // Get System Prompts
        const promptGeneral = document.getElementById('system-prompt-general').value;
        const promptMxh = document.getElementById('system-prompt-mxh').value;
        const promptNotes = document.getElementById('system-prompt-notes').value;
        const promptTelegram = document.getElementById('system-prompt-telegram').value;
        const promptImage = document.getElementById('system-prompt-image').value;
        // Update local state
        providerSettings.provider = provider;
        providerSettings.system_prompt_general = promptGeneral;
        providerSettings.system_prompt_mxh = promptMxh;
        providerSettings.system_prompt_notes = promptNotes;
        providerSettings.system_prompt_telegram = promptTelegram;
        providerSettings.system_prompt_image = promptImage;
        if (provider === 'openai') {
            providerSettings.openai_api_key = apiKey;
            providerSettings.openai_model = model;
        }
        else if (provider === 'gemini') {
            providerSettings.gemini_api_key = apiKey;
            providerSettings.gemini_model = model;
        }
        else if (provider === 'hermes') {
            providerSettings.hermes_model = model || 'Hermes Agent';
        }
        try {
            const response = await fetch('/api/chat/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(providerSettings) // Send all settings
            });
            const data = await response.json();
            if (data.success) {
                showChatNotice('Đã lưu cài đặt!', 'success');
                updateHeaderModelName(provider);
                localStorage.setItem('selectedModel', JSON.stringify({ provider, model: model || 'Hermes Agent' }));
                const modal = bootstrap.Modal.getInstance(document.getElementById('aiSettingsModal'));
                modal?.hide();
            }
            else {
                showChatNotice('Error: ' + data.error, 'error');
            }
        }
        catch (error) {
            showChatNotice('Error: ' + error.message, 'error');
        }
    }
    // Clear Dashboard Cache
    async function clearDashboardCache() {
        if (await confirmChatAction('Clear browser cache and reload? This will refresh all cached files.')) {
            // Clear localStorage (optional - keeps chat history in database)
            // localStorage.clear();
            // Force hard reload to clear cache
            window.location.reload();
            // Alternative: Use Cache API if available
            if ('caches' in window) {
                caches.keys().then(function (names) {
                    for (let name of names)
                        caches.delete(name);
                });
            }
        }
    }
    window.openChatPanel = openChatPanel;
    window.showImagePreview = showImagePreview;
    window.clearImagePreview = clearImagePreview;
    window.toggleSidebar = toggleSidebar;
    window.selectModel = selectModel;
    window.startNewChat = startNewChat;
    window.sendSuggestion = sendSuggestion;
    window.sendMessage = sendMessage;
    window.clearAllChats = clearAllChats;
    window.saveAISettings = saveAISettings;
    window.clearDashboardCache = clearDashboardCache;
})();
