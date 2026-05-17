"use strict";
// 🔍 DEBUG: Telegram script loading
console.log('🔍 Loading Telegram script...');
(async () => {
    const telegramPane = document.getElementById('telegram-tool-pane');
    if (!telegramPane) {
        console.log('🔍 Telegram pane not found!');
        return;
    }
    console.log('🔍 Telegram pane found, initializing...');
    // --- START: REFACTORED SCRIPT BLOCK FOR AUTO-SAVING UI STATE ---
    const adminSwitch = document.getElementById('tg-admin-reply-switch');
    const adminDelayInput = document.getElementById('tg-admin-delay-input');
    const globalSettingInputs = [
        document.getElementById('tg-core-input'),
        document.getElementById('tg-delay-session-input'),
        document.getElementById('tg-delay-batch-input'),
        adminSwitch,
        adminDelayInput
    ];
    let autoSaveTimer = null;
    // Function to load and populate the main control bar settings from the database.
    async function loadTelegramGlobalSettings() {
        console.log('🔍 Loading Telegram global settings...');
        try {
            const response = await fetch('/automatic/api/seeding/settings');
            if (!response.ok)
                return;
            const settings = await response.json();
            if (Object.keys(settings).length > 0) {
                document.getElementById('tg-core-input').value = settings.core || 5;
                document.getElementById('tg-delay-session-input').value = settings.delay_per_session || 10;
                document.getElementById('tg-delay-batch-input').value = settings.delay_between_batches || 600;
                adminSwitch.checked = settings.admin_enabled || false;
                adminDelayInput.value = settings.admin_delay || 10;
                adminDelayInput.disabled = !adminSwitch.checked;
            }
            console.log('🔍 Telegram settings loaded:', settings);
        }
        catch (error) {
            console.error("🔍 Could not load global Telegram settings:", error);
        }
    }
    // The auto-save function with debouncing.
    function triggerAutoSave() {
        clearTimeout(autoSaveTimer); // Reset the timer on every change
        autoSaveTimer = setTimeout(async () => {
            const payload = {
                core: parseInt(document.getElementById('tg-core-input').value, 10),
                delay_per_session: parseInt(document.getElementById('tg-delay-session-input').value, 10),
                delay_between_batches: parseInt(document.getElementById('tg-delay-batch-input').value, 10),
                admin_enabled: document.getElementById('tg-admin-reply-switch').checked,
                admin_delay: parseInt(document.getElementById('tg-admin-delay-input').value, 10)
            };
            try {
                console.log('🔍 Auto-saving Telegram settings:', payload);
                const response = await fetch('/telegram/api/global-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (!response.ok)
                    throw new Error(result.error || 'Lỗi server');
                showToast('Cài đặt chung đã được tự động lưu.', 'success');
            }
            catch (error) {
                showToast(`Lỗi tự động lưu: ${error.message}`, 'error');
            }
        }, 1500); // Wait 1.5 seconds after the last change before saving
    }
    // Attach event listeners for auto-saving
    globalSettingInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', triggerAutoSave); // For text/number inputs
            input.addEventListener('change', triggerAutoSave); // For checkboxes/switches
        }
    });
    // Event listener to show/hide the admin delay input when the toggle is clicked.
    if (adminSwitch) {
        adminSwitch.addEventListener('change', () => {
            adminDelayInput.disabled = !adminSwitch.checked;
        });
    }
    // Load settings on page load
    loadTelegramGlobalSettings();
    // --- END: REFACTORED SCRIPT BLOCK FOR AUTO-SAVING UI STATE ---
    let tg_pollingInterval = null;
    let tg_currentTaskId = null;
    let tg_lastCheckedCheckbox = null;
    let tg_currentTaskConfig = {};
    let tg_completedInTask = new Set();
    let tg_allGroups = [];
    async function tg_handleRunStopClick(event) {
        const button = event.currentTarget;
        if (button.dataset.taskRunning === 'true') {
            if (!tg_currentTaskId)
                return;
            try {
                console.log('🔍 Stopping task:', tg_currentTaskId);
                await fetch(`/telegram/api/stop-task/${tg_currentTaskId}`, { method: 'POST' });
            }
            catch (error) {
                showToast(`Lỗi khi dừng: ${error.message}`, 'error');
            }
        }
        else {
            const isGroupTaskSelected = tg_currentTaskConfig && tg_currentTaskConfig.task && ['seedingGroup', 'joinGroup'].includes(tg_currentTaskConfig.task);
            if (isGroupTaskSelected) {
                await tg_handleRunGroupTask();
            }
            else {
                await tg_handleCheckLive();
            }
        }
    }
    async function tg_handleRunGroupTask() {
        console.log('🔍 Running group task...');
        const selectedFilenames = Array.from(telegramPane.querySelectorAll('.tg-session-checkbox:checked:not(#tg-selectAllCheckbox)')).map(cb => cb.closest('tr').dataset.filename);
        let sessionsForTask = selectedFilenames;
        if (sessionsForTask.length === 0 && tg_currentTaskConfig.task === 'seedingGroup' && tg_currentTaskConfig.session_filenames?.length > 0) {
            sessionsForTask = tg_currentTaskConfig.session_filenames;
            showToast('Không có session nào được chọn. Sử dụng danh sách đã lưu trong cấu hình.', 'info');
        }
        if (sessionsForTask.length === 0)
            return showToast('Vui lòng chọn hoặc lưu session trong cấu hình.', 'error');
        const payload = {
            groupId: document.getElementById('tg-group-session-select').value,
            task: tg_currentTaskConfig.task,
            config: tg_currentTaskConfig,
            filenames: sessionsForTask,
            core: parseInt(document.getElementById('tg-core-input').value, 10),
            delay_per_session: parseInt(document.getElementById('tg-delay-session-input').value, 10),
            delay_between_batches: parseInt(document.getElementById('tg-delay-batch-input').value, 10),
            admin_enabled: document.getElementById('tg-admin-reply-switch').checked,
            admin_delay: parseInt(document.getElementById('tg-admin-delay-input').value, 10)
        };
        if (!payload.groupId)
            return showToast('Vui lòng chọn nhóm session.', 'error');
        const taskDesc = telegramPane.querySelector('#tg-group-task-cards .card.card-selected .card-title')?.textContent.trim() || "tác vụ";
        tg_startTaskUI(sessionsForTask.length, `Bắt đầu "${taskDesc}"...`);
        try {
            console.log('🔍 Running task payload:', payload);
            const response = await fetch('/telegram/api/run-task', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok)
                throw new Error((await response.json()).error || 'Lỗi server.');
            const { task_id } = await response.json();
            tg_currentTaskId = task_id;
            console.log('🔍 Task started with ID:', task_id);
            tg_setRunStopButtonState('running');
            tg_pollTaskStatus(tg_currentTaskId);
        }
        catch (error) {
            showToast(`Lỗi: ${error.message}`, 'error');
            tg_setRunStopButtonState('idle');
        }
    }
    // START: Replacement for tg_handleCheckLive
    async function tg_handleCheckLive() {
        console.log('🔍 Check Live initiated...');
        if (tg_pollingInterval)
            return showToast('Tác vụ khác đang chạy.', 'error');
        const groupId = document.getElementById('tg-group-session-select').value;
        if (!groupId)
            return showToast('Vui lòng chọn nhóm.', 'error');
        const selectedFilenames = Array.from(telegramPane.querySelectorAll('.tg-session-checkbox:checked:not(#tg-selectAllCheckbox)')).map(cb => cb.closest('tr').dataset.filename);
        if (selectedFilenames.length === 0)
            return showToast('Vui lòng chọn ít nhất một session.', 'error');
        // Deselect any group task cards to avoid confusion
        telegramPane.querySelectorAll('#tg-group-task-cards .card').forEach(d => d.classList.remove('card-selected'));
        tg_currentTaskConfig = {};
        const payload = {
            groupId: groupId,
            task: "check-live", // Set the correct task name
            filenames: selectedFilenames,
            core: parseInt(document.getElementById('tg-core-input').value, 10),
            delay_per_session: parseInt(document.getElementById('tg-delay-session-input').value, 10),
            delay_between_batches: parseInt(document.getElementById('tg-delay-batch-input').value, 10),
            admin_enabled: false, // Not applicable for check-live
            admin_delay: 0 // Not applicable for check-live
        };
        tg_startTaskUI(selectedFilenames.length, `Bắt đầu Check Live...`);
        try {
            console.log('🔍 Check Live payload:', payload);
            // Call the correct, generic run-task endpoint
            const response = await fetch('/telegram/api/run-task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok)
                throw new Error((await response.json()).error || 'Lỗi server.');
            const { task_id } = await response.json();
            tg_currentTaskId = task_id;
            console.log('🔍 Check Live started with ID:', task_id);
            tg_setRunStopButtonState('running');
            tg_pollTaskStatus(tg_currentTaskId);
        }
        catch (error) {
            showToast(`Lỗi: ${error.message}`, 'error');
            tg_setRunStopButtonState('idle');
        }
    }
    // END: Replacement for tg_handleCheckLive
    function tg_startTaskUI(total, msg) {
        tg_completedInTask.clear();
        showToast(msg, 'info');
        document.getElementById('tg-status-success-count').textContent = '0';
        document.getElementById('tg-status-failed-count').textContent = '0';
        document.getElementById('tg-status-progress-text').textContent = `0/${total}`;
        // 🔍 FIX: Không thay đổi Status cell nữa, chỉ hiển thị progress ở header
    }
    function tg_setRunStopButtonState(state) {
        const button = document.getElementById('tg-runStopBtn');
        const statusText = document.getElementById('tg-status-progress-text');
        if (state === 'running') {
            button.dataset.taskRunning = 'true';
            statusText.dataset.taskRunning = 'true';
            button.innerHTML = `<i class="bi bi-stop-fill"></i> Stop`;
            button.classList.replace('btn-primary', 'btn-danger');
        }
        else {
            button.dataset.taskRunning = 'false';
            statusText.dataset.taskRunning = 'false';
            button.innerHTML = `<i class="bi bi-play-fill"></i> Run`;
            button.classList.replace('btn-danger', 'btn-primary');
        }
    }
    function tg_pollTaskStatus(taskId) {
        if (tg_pollingInterval)
            clearInterval(tg_pollingInterval);
        tg_pollingInterval = setInterval(async () => {
            if (!tg_currentTaskId) {
                clearInterval(tg_pollingInterval);
                return;
            }
            try {
                const response = await fetch(`/telegram/api/task-status/${taskId}`);
                if (!response.ok) {
                    clearInterval(tg_pollingInterval);
                    tg_setRunStopButtonState('idle');
                    return;
                }
                const task = await response.json();
                tg_updateUiWithTaskProgress(task);
                if (task.status === 'completed' || task.status === 'stopped') {
                    clearInterval(tg_pollingInterval);
                    tg_pollingInterval = null;
                    tg_currentTaskId = null;
                    // Show Completion Modal
                    document.getElementById('tg-completed-total').textContent = task.total;
                    document.getElementById('tg-completed-success').textContent = task.success;
                    document.getElementById('tg-completed-failed').textContent = task.failed;
                    new bootstrap.Modal(document.getElementById('tg-taskCompletedModal')).show();
                    // showToast(task.status === 'completed' ? 'Hoàn tất tác vụ!' : 'Tác vụ đã dừng.', 'success'); // replaced by modal
                    document.getElementById('tg-status-progress-text').textContent = "Idle";
                    tg_setRunStopButtonState('idle');
                    tg_updateSessionCountDisplay();
                }
            }
            catch (error) {
                clearInterval(tg_pollingInterval);
                console.error('Lỗi khi polling:', error);
                tg_setRunStopButtonState('idle');
            }
        }, 1500);
    }
    function tg_updateUiWithTaskProgress(task) {
        document.getElementById('tg-status-progress-text').textContent = `${task.processed}/${task.total}`;
        document.getElementById('tg-status-success-count').textContent = String(task.success);
        document.getElementById('tg-status-failed-count').textContent = String(task.failed);
        // Update status for completed sessions in this poll
        task.results.forEach(result => {
            const row = telegramPane.querySelector(`tr[data-filename="${result.filename}"]`);
            if (!row)
                return;
            tg_completedInTask.add(result.filename); // Mark this session as processed
            if (result.full_name)
                row.cells[3].textContent = result.full_name;
            if (result.username)
                row.cells[4].textContent = result.username;
            // 🔍 FIX: Hiển thị Live/Die icon với badge
            row.cells[5].innerHTML = result.is_live
                ? `<span class="badge bg-success"><i class="bi bi-check-circle-fill"></i> Live</span>`
                : `<span class="badge bg-danger"><i class="bi bi-x-circle-fill"></i> Die</span>`;
            // 🔍 FIX: Status cell giữ nguyên không đổi, chỉ hiển thị status_text
            row.cells[6].innerHTML = `<span class="text-info">${result.status_text}</span>`;
        });
        // 🔍 FIX: Handle global task messages (hiển thị ở header, không cập nhật Status cell)
        if (task.messages && task.messages.length > 0) {
            const latestMessage = task.messages[task.messages.length - 1];
            document.getElementById('tg-status-progress-text').textContent = latestMessage;
        }
    }
    async function tg_loadGroups() {
        console.log('🔍 Loading Telegram groups...');
        try {
            const r = await fetch('/telegram/api/groups');
            tg_allGroups = await r.json();
            const s = document.getElementById('tg-group-session-select');
            s.innerHTML = '<option selected disabled>-- Chọn nhóm --</option>';
            tg_allGroups.forEach(g => {
                if (g.name !== 'Adminsession')
                    s.add(new Option(g.name, g.id));
            });
            const storedId = localStorage.getItem('tg_selectedGroupId');
            // Check if the stored ID exists and corresponds to a valid, non-admin group in the list
            if (storedId && tg_allGroups.some(g => g.id == storedId && g.name !== 'Adminsession')) {
                s.value = storedId;
                // CRITICAL FIX: Programmatically trigger the 'change' event to force session loading.
                // The 'await' is important as the event handler is async.
                await s.dispatchEvent(new Event('change'));
            }
            console.log('🔍 Groups loaded:', tg_allGroups);
        }
        catch (e) {
            showToast('Không thể tải nhóm Telegram.', 'error');
        }
    }
    async function tg_handleGroupSelect(e) {
        tg_lastCheckedCheckbox = null;
        const groupId = e.target.value;
        console.log('🔍 Group selected:', groupId);
        localStorage.setItem('tg_selectedGroupId', groupId);
        const tableBody = document.getElementById('tg-sessions-table-body');
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center"><div class="spinner-border spinner-border-sm"></div></td></tr>`;
        try {
            const res = await fetch(`/telegram/api/groups/${groupId}/sessions`);
            tg_renderSessions(await res.json());
        }
        catch (e) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Lỗi tải session</td></tr>`;
        }
    }
    function tg_renderSessions(sessions) {
        const tableBody = document.getElementById('tg-sessions-table-body');
        tableBody.innerHTML = ''; // Clear the single body
        document.getElementById('tg-total-sessions-count').textContent = String(sessions.length);
        const rowHtml = (s, i) => {
            // Live/Die icons
            const liveIcon = s.is_live === null
                ? '<i class="bi bi-question-circle-fill text-secondary"></i>'
                : (s.is_live
                    ? '<span class="badge bg-success"><i class="bi bi-check-circle-fill"></i> Live</span>'
                    : '<span class="badge bg-danger"><i class="bi bi-x-circle-fill"></i> Die</span>');
            return `<tr data-filename="${s.filename}">
                        <td><input class="form-check-input tg-session-checkbox" type="checkbox"></td>
                        <td>${i + 1}</td>
                        <td>${s.phone}</td>
                        <td class="d-none d-md-table-cell dashboard-cell-editable">${s.full_name || 'N/A'}</td>
                        <td class="d-none d-md-table-cell dashboard-cell-editable">${s.username || ''}</td>
                        <td class="text-center">${liveIcon}</td>
                        <td><span class="text-info">${s.status_text || 'Sẵn sàng'}</span></td>
                  </tr>`;
        };
        // Render all sessions into the single table body. No more splitting.
        tableBody.innerHTML = sessions.map((s, i) => rowHtml(s, i)).join('');
        tg_updateSessionCountDisplay();
        console.log('🔍 Sessions rendered:', sessions.length);
    }
    function tg_updateSessionCountDisplay() {
        const statusEl = document.getElementById('tg-status-progress-text');
        if (statusEl && statusEl.dataset.taskRunning !== 'true') {
            const selected = telegramPane.querySelectorAll('.tg-session-checkbox:checked').length;
            const total = telegramPane.querySelectorAll('.tg-session-checkbox').length;
            statusEl.textContent = selected > 0 ? `${selected}/${total} Selected` : 'Idle';
        }
    }
    window.tg_openConfigModal = async (taskId, event) => {
        if (event)
            event.stopPropagation();
        await tg_selectCardAndLoadConfig(taskId);
        const modalId = `tg-${taskId}Modal`;
        const configModal = document.getElementById(modalId);
        if (configModal) {
            if (taskId === 'joinGroup')
                tg_populateJoinGroupModal();
            if (taskId === 'seedingGroup')
                await tg_populateSeedingGroupModal();
            new bootstrap.Modal(configModal).show();
        }
    };
    async function tg_selectCardAndLoadConfig(taskId) {
        telegramPane.querySelectorAll('#tg-group-task-cards .card').forEach(d => d.classList.remove('card-selected'));
        const card = telegramPane.querySelector(`#tg-group-task-cards .card[data-task-id="${taskId}"]`);
        if (card)
            card.classList.add('card-selected');
        localStorage.setItem('tg_lastSelectedTask', taskId);
        try {
            const response = await fetch(`/telegram/api/config/${taskId}`);
            tg_currentTaskConfig = response.ok ? await response.json() : {};
            tg_currentTaskConfig.task = taskId;
        }
        catch (error) {
            tg_currentTaskConfig = { task: taskId };
        }
    }
    function tg_populateJoinGroupModal() { document.getElementById('tg-joinGroupLinks').value = (tg_currentTaskConfig?.links || []).join('\n'); }
    async function tg_populateSeedingGroupModal() {
        const { group_links, messages, admin_messages, admin_session_file } = tg_currentTaskConfig;
        document.getElementById('tg-seedingGroupLinks').value = (group_links || []).join('\n');
        document.getElementById('tg-seedingGroupMessages').value = (messages || []).join('\n');
        document.getElementById('tg-seedingAdminMessages').value = (admin_messages || []).join('\n');
        document.getElementById('tg-seedingSilentSwitch').checked = tg_currentTaskConfig?.send_silent || false;
        const adminSelect = document.getElementById('tg-seedingAdminSessionSelect');
        adminSelect.innerHTML = '<option value="">-- Đang tải... --</option>';
        const adminGroup = tg_allGroups.find(g => g.name === 'Adminsession');
        if (!adminGroup) {
            adminSelect.innerHTML = '<option value="">-- Không có nhóm Adminsession --</option>';
            return;
        }
        try {
            const res = await fetch(`/telegram/api/groups/${adminGroup.id}/sessions`);
            const adminSessions = await res.json();
            adminSelect.innerHTML = '<option value="">-- Không sử dụng Admin --</option>';
            adminSessions.forEach(s => adminSelect.add(new Option(s.phone || s.filename, s.filename)));
            if (admin_session_file)
                adminSelect.value = admin_session_file;
        }
        catch (error) {
            adminSelect.innerHTML = '<option value="">-- Lỗi tải session --</option>';
        }
    }
    async function tg_saveJoinGroupConfig() {
        const links = document.getElementById('tg-joinGroupLinks').value.trim().split(/\r?\n/).filter(Boolean);
        const configToSave = { links };
        try {
            await fetch('/telegram/api/config/joinGroup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(configToSave) });
            tg_currentTaskConfig = { ...tg_currentTaskConfig, ...configToSave };
            bootstrap.Modal.getInstance(document.getElementById('tg-joinGroupModal')).hide();
            showToast('Đã lưu cấu hình Join Group!', 'success');
        }
        catch (error) {
            showToast(`Lỗi: ${error.message}`, 'error');
        }
    }
    async function tg_saveSeedingGroupConfig() {
        const configToSave = {
            group_links: document.getElementById('tg-seedingGroupLinks').value.trim().split(/\r?\n/).filter(Boolean),
            messages: document.getElementById('tg-seedingGroupMessages').value.trim().split(/\r?\n/).filter(Boolean),
            admin_messages: document.getElementById('tg-seedingAdminMessages').value.trim().split(/\r?\n/).filter(Boolean),
            admin_session_file: document.getElementById('tg-seedingAdminSessionSelect').value,
            session_filenames: Array.from(telegramPane.querySelectorAll('.tg-session-checkbox:checked:not(#tg-selectAllCheckbox)')).map(cb => cb.closest('tr').dataset.filename),
            send_silent: document.getElementById('tg-seedingSilentSwitch').checked
        };
        try {
            await fetch('/telegram/api/config/seedingGroup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(configToSave) });
            tg_currentTaskConfig = { ...tg_currentTaskConfig, ...configToSave };
            bootstrap.Modal.getInstance(document.getElementById('tg-seedingGroupModal')).hide();
            showToast('Đã lưu cấu hình Seeding Group!', 'success');
        }
        catch (error) {
            showToast(`Lỗi: ${error.message}`, 'error');
        }
    }
    async function tg_handleSaveGroup(event) {
        event.preventDefault();
        const form = document.getElementById('tg-addSessionForm');
        const nameInput = document.getElementById('tg-groupName');
        const filesInput = document.getElementById('tg-sessionFiles');
        if (!nameInput.value.trim() || !filesInput.files.length)
            return showToast('Vui lòng nhập tên nhóm và chọn file.', 'error');
        const formData = new FormData(form);
        try {
            const r = await fetch('/telegram/api/groups', { method: 'POST', body: formData });
            const j = await r.json();
            if (!r.ok)
                throw new Error(j.error || 'Lỗi server.');
            showToast(j.message || 'Thành công!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('tg-addSessionModal')).hide();
            form.reset();
            await tg_loadGroups();
        }
        catch (e) {
            showToast(`Lỗi: ${e.message}`, 'error');
        }
    }
    async function tg_handleUploadAdminSession() {
        const files = this.files;
        if (!files?.length)
            return;
        const formData = new FormData();
        for (const file of files)
            formData.append('admin_session_files', file);
        try {
            const response = await fetch('/telegram/api/upload-admin-sessions', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error);
            showToast(result.message, 'success');
            await tg_loadGroups();
            await tg_populateSeedingGroupModal();
        }
        catch (error) {
            showToast(`Lỗi: ${error.message}`, 'error');
        }
    }
    async function tg_resumeActiveTasks() {
        try {
            const response = await fetch('/telegram/api/active-tasks');
            if (!response.ok)
                return;
            const activeTasks = await response.json();
            const taskIds = Object.keys(activeTasks);
            if (taskIds.length > 0) {
                const taskIdToResume = taskIds[0];
                const taskData = activeTasks[taskIdToResume];
                showToast(`Khôi phục trạng thái tác vụ: ${taskData.task_name}`, 'info');
                tg_currentTaskId = taskIdToResume;
                document.getElementById('tg-status-success-count').textContent = taskData.success;
                document.getElementById('tg-status-failed-count').textContent = taskData.failed;
                document.getElementById('tg-status-progress-text').textContent = `${taskData.processed}/${taskData.total}`;
                const groupSelect = document.getElementById('tg-group-session-select');
                // Set the group select dropdown to the group associated with the resumed task
                groupSelect.value = taskData.group_id;
                // CRITICAL FIX: Trigger the change event to load and display the sessions for that group.
                await groupSelect.dispatchEvent(new Event('change'));
                tg_setRunStopButtonState('running');
                tg_pollTaskStatus(taskIdToResume);
            }
        }
        catch (error) {
            console.error("Lỗi khi khôi phục tác vụ:", error);
        }
    }
    document.getElementById('tg-runStopBtn').addEventListener('click', tg_handleRunStopClick);
    document.getElementById('tg-checkLiveBtn').addEventListener('click', tg_handleCheckLive);
    document.getElementById('tg-check-live-btn-header').addEventListener('click', tg_handleCheckLive); // Header button
    document.getElementById('tg-group-session-select').addEventListener('change', tg_handleGroupSelect);
    document.getElementById('tg-saveGroupBtn').addEventListener('click', tg_handleSaveGroup);
    document.getElementById('tg-saveJoinGroupConfigBtn').addEventListener('click', tg_saveJoinGroupConfig);
    document.getElementById('tg-saveSeedingGroupConfigBtn').addEventListener('click', tg_saveSeedingGroupConfig);
    document.getElementById('tg-uploadAdminSession').addEventListener('change', tg_handleUploadAdminSession);
    // Delete Dead Sessions Function
    window.tg_deleteDeadSessions = async () => {
        // Determine current groupId
        const groupSelect = document.getElementById('tg-group-session-select');
        const groupId = groupSelect?.value || '';
        if (!groupId) {
            alert('Vui lòng chọn nhóm.');
            return;
        }
        // Collect all "dead" sessions from the table
        const rows = [
            ...document.querySelectorAll('#tg-sessions-table-body tr[data-live="false"]')
        ];
        const filenames = rows.map(r => r.dataset.filename).filter(Boolean);
        if (filenames.length === 0) {
            alert('Không có session die để xóa.');
            return;
        }
        // Guard when a task is running
        const runBtn = document.getElementById('tg-runStopBtn');
        if (runBtn && runBtn.dataset.taskRunning === 'true') {
            alert('Đang chạy tác vụ, vui lòng dừng trước khi xóa.');
            return;
        }
        // Confirm
        if (!confirm(`Xóa ${filenames.length} session die khỏi nhóm và khỏi đĩa?`)) {
            return;
        }
        try {
            // Call backend
            const res = await fetch('/telegram/api/sessions/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group_id: groupId, filenames })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `HTTP ${res.status}`);
            }
            const { deleted = [], missing = [], failed = [] } = await res.json();
            // Update UI by reloading sessions
            const tableBody = document.getElementById('tg-sessions-table-body');
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading...</td></tr>';
            const sessionsRes = await fetch(`/telegram/api/groups/${groupId}/sessions`);
            tg_renderSessions(await sessionsRes.json());
            // Notify result
            if (failed.length > 0) {
                alert(`Không thể xóa ${failed.length} session.`);
            }
            else {
                console.log('Deleted sessions:', deleted);
            }
        }
        catch (error) {
            alert(`Lỗi xóa session: ${error.message}`);
        }
    };
    // Attach event handler for delete sessions context menu
    document.getElementById('tg-context-delete-session')?.addEventListener('click', async () => {
        if (typeof hideAllContextMenus === 'function')
            hideAllContextMenus();
        try {
            await window.tg_deleteDeadSessions?.();
        }
        catch (e) {
            alert(`Lỗi xóa session: ${e.message}`);
        }
    });
    // Immediately load groups and check for active tasks on page load.
    (async () => {
        await tg_loadGroups();
        await tg_resumeActiveTasks();
    })();
    document.getElementById('tg-shuffleMessagesBtn').addEventListener('click', () => {
        const memberTextarea = document.getElementById('tg-seedingGroupMessages');
        const adminTextarea = document.getElementById('tg-seedingAdminMessages');
        const shuffleTextarea = (textarea) => {
            let lines = textarea.value.split('\n').filter(line => line.trim() !== '');
            for (let i = lines.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [lines[i], lines[j]] = [lines[j], lines[i]];
            }
            textarea.value = lines.join('\n');
        };
        shuffleTextarea(memberTextarea);
        shuffleTextarea(adminTextarea);
        showToast('Đã xáo trộn tin nhắn!', 'success');
    });
    document.getElementById('tg-group-task-cards').addEventListener('click', e => {
        const target = e.target;
        const card = target.closest('.card[data-task-id]');
        if (card && !target.closest('button')) {
            tg_selectCardAndLoadConfig(card.dataset.taskId);
        }
    });
    document.getElementById('tg-session-tables-container').addEventListener('click', e => {
        const checkbox = e.target;
        // First, handle the specific "Select All" case
        if (checkbox.id === 'tg-selectAllCheckbox') {
            const allSessionCheckboxes = telegramPane.querySelectorAll('.tg-session-checkbox:not(#tg-selectAllCheckbox)');
            allSessionCheckboxes.forEach(cb => {
                if (!cb.disabled) {
                    cb.checked = checkbox.checked;
                }
            });
            tg_updateSessionCountDisplay();
            // THEN, handle clicks on individual session checkboxes
        }
        else if (checkbox.classList.contains('tg-session-checkbox')) {
            if (e.shiftKey && tg_lastCheckedCheckbox) {
                const allCheckboxes = Array.from(telegramPane.querySelectorAll('.tg-session-checkbox:not(#tg-selectAllCheckbox)'));
                const start = allCheckboxes.indexOf(tg_lastCheckedCheckbox);
                const end = allCheckboxes.indexOf(checkbox);
                if (start !== -1 && end !== -1) {
                    const lower = Math.min(start, end);
                    const upper = Math.max(start, end);
                    for (let i = lower; i <= upper; i++) {
                        allCheckboxes[i].checked = checkbox.checked;
                    }
                }
            }
            tg_lastCheckedCheckbox = checkbox;
            tg_updateSessionCountDisplay();
        }
    });
    document.getElementById('tg-addSessionModal').addEventListener('show.bs.modal', async () => {
        const listEl = document.getElementById('tg-existing-groups-list');
        listEl.innerHTML = `<div class="text-center"><div class="spinner-border spinner-border-sm"></div></div>`;
        try {
            const r = await fetch('/telegram/api/groups');
            const groups = await r.json();
            listEl.innerHTML = groups.map(g => `<div class="d-flex justify-content-between align-items-center p-2 border-bottom"><span>${g.name}</span><button class="btn btn-sm btn-outline-danger tg-delete-group-btn" data-group-id="${g.id}"><i class="bi bi-trash-fill"></i></button></div>`).join('') || '<p class="text-muted text-center">Chưa có nhóm nào.</p>';
        }
        catch (e) {
            listEl.innerHTML = `<div class="text-danger text-center">Lỗi tải nhóm.</div>`;
        }
    });
    document.getElementById('tg-existing-groups-list').addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.tg-delete-group-btn');
        if (deleteBtn) {
            const groupId = deleteBtn.dataset.groupId;
            if (await window.confirm('Bạn có chắc muốn xóa nhóm này?', 'Xác nhận xóa nhóm')) {
                try {
                    const res = await fetch(`/telegram/api/groups/${groupId}`, { method: 'DELETE' });
                    if (!res.ok)
                        throw new Error("Lỗi server");
                    deleteBtn.closest('.d-flex').remove();
                    await tg_loadGroups();
                }
                catch (err) {
                    showToast('Lỗi xóa nhóm', 'error');
                }
            }
            return;
        }
    });
    const proxyModalEl = document.getElementById('tg-proxyModal');
    const proxyTextarea = document.getElementById('tg-proxy-list');
    const saveProxyBtn = document.getElementById('tg-save-proxy-btn');
    const proxyEnableCheckbox = document.getElementById('tg-proxy-enabled');
    if (proxyModalEl) {
        proxyModalEl.addEventListener('show.bs.modal', async () => {
            try {
                const response = await fetch('/telegram/api/proxies');
                const config = await response.json();
                proxyTextarea.value = (config.proxies || []).join('\n');
                proxyEnableCheckbox.checked = config.enabled || false;
            }
            catch (error) {
                showToast('Lỗi tải cấu hình proxy.', 'error');
            }
        });
        saveProxyBtn.addEventListener('click', async () => {
            try {
                const payload = {
                    enabled: proxyEnableCheckbox.checked,
                    proxies: proxyTextarea.value
                };
                const response = await fetch('/telegram/api/proxies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (!response.ok)
                    throw new Error(result.error || 'Lỗi server');
                showToast(result.message, 'success');
                bootstrap.Modal.getInstance(proxyModalEl).hide();
            }
            catch (error) {
                showToast(`Lỗi lưu proxy: ${error.message}`, 'error');
            }
        });
    }
    // --- START: NEW FUNCTION TO ADD ---
    function tg_makeCellEditable(cell, field, filename) {
        const originalText = cell.textContent.trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control form-control-sm';
        input.value = originalText;
        input.spellcheck = false;
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        input.select();
        const saveChanges = async () => {
            const newValue = input.value.trim();
            if (newValue === originalText) {
                cell.textContent = originalText;
                return;
            }
            const statusCell = cell.closest('tr').cells[6];
            const oldStatusHTML = statusCell.innerHTML;
            statusCell.innerHTML = `<span class="text-info">Updating...</span>`;
            showToast(`Updating ${field}...`, 'info');
            try {
                const groupId = document.getElementById('tg-group-session-select').value;
                const response = await fetch(`/telegram/api/update-session-info`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        group_id: groupId,
                        filename: filename,
                        field: field,
                        value: newValue
                    })
                });
                const result = await response.json();
                if (!response.ok)
                    throw new Error(result.error || 'Unknown error');
                cell.textContent = result.updated_value;
                if (field === 'username' && result.updated_full_name) {
                    cell.closest('tr').cells[3].textContent = result.updated_full_name;
                }
                statusCell.innerHTML = `<span class="text-success">Success!</span>`;
                showToast(result.message, 'success');
            }
            catch (error) {
                cell.textContent = originalText;
                statusCell.innerHTML = oldStatusHTML;
                showToast(`Error: ${error.message}`, 'error');
            }
        };
        input.addEventListener('blur', saveChanges);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
            else if (e.key === 'Escape') {
                cell.textContent = originalText;
                input.removeEventListener('blur', saveChanges);
                input.blur();
            }
        });
    }
    // --- END: NEW FUNCTION TO ADD ---
    // --- START: NEW EVENT LISTENER TO ADD ---
    document.getElementById('tg-session-tables-container').addEventListener('dblclick', (e) => {
        const cell = e.target.closest('td');
        if (!cell)
            return;
        const tr = cell.closest('tr');
        const filename = tr.dataset.filename;
        if (!filename)
            return;
        const cellIndex = cell.cellIndex;
        let field = null;
        if (cellIndex === 3) { // Full Name column
            field = 'full_name';
        }
        else if (cellIndex === 4) { // Username column
            field = 'username';
        }
        if (field) {
            tg_makeCellEditable(cell, field, filename);
        }
    });
    // --- END: NEW EVENT LISTENER TO ADD ---
    // Context menu functionality
    const telegramMenu = document.getElementById('telegram-context-menu');
    if (telegramMenu && telegramPane) {
        telegramPane.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof hideAllContextMenus === 'function')
                hideAllContextMenus();
            telegramMenu.style.display = 'block';
            telegramMenu.style.left = e.clientX + 'px';
            telegramMenu.style.top = e.clientY + 'px';
        });
        document.addEventListener('click', () => {
            if (telegramMenu)
                telegramMenu.style.display = 'none';
        });
        telegramMenu.addEventListener('contextmenu', e => e.preventDefault());
        telegramMenu.addEventListener('click', (e) => {
            const actionItem = e.target.closest('[data-tg-context-action]');
            if (!actionItem)
                return;
            e.preventDefault();
            console.log(actionItem.dataset.tgContextAction || 'telegram-context-action');
            telegramMenu.style.display = 'none';
        });
    }
    telegramPane.querySelectorAll('[data-tg-config-task]').forEach((button) => {
        button.addEventListener('click', (event) => {
            const taskId = event.currentTarget.dataset.tgConfigTask;
            if (!taskId || typeof window.tg_openConfigModal !== 'function')
                return;
            window.tg_openConfigModal(taskId, event);
        });
    });
    console.log('🔍 Telegram script fully initialized!');
})();
