// ===== SETTINGS REAL-TIME SYSTEM =====
    const SETTINGS_CONFIG = {
        AUTO_REFRESH_INTERVAL: 3000,
        DEBOUNCE_DELAY: 500
    };

    // Global state
    let settingsData = null;
    let autoRefreshInterval = null;
    let isUpdating = false;

    // Timers
    let shutdownCountdownInterval = null;
    let notificationCountdownInterval = null;

    // ===== AUTO-REFRESH SYSTEM =====
    function startAutoRefresh() {
        if (autoRefreshInterval) return;
        autoRefreshInterval = setInterval(() => {
            if (!isUpdating) {
                loadSettings(false);
            }
        }, SETTINGS_CONFIG.AUTO_REFRESH_INTERVAL);
        console.log('✅ Settings auto-refresh started');
    }

    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
            console.log('⏸️ Settings auto-refresh stopped');
        }
    }

    // Pause auto-refresh when user is interacting
    function pauseAutoRefresh() {
        stopAutoRefresh();
        setTimeout(startAutoRefresh, 2000); // Resume after 2s
    }

    // ===== LOAD SETTINGS =====
    async function loadSettings(forceRender = false) {
        try {
            const response = await fetch('/settings/api/settings');
            const newData = await response.json();

            // Smart comparison - only render if data changed
            const dataChanged = JSON.stringify(settingsData) !== JSON.stringify(newData);

            if (dataChanged || forceRender) {
                settingsData = newData;
                renderSettings();
                console.log('🔄 Settings updated');
            }

            // Update last updated time
            document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString('vi-VN');
        } catch (error) {
            console.error('Error loading settings:', error);
            showToast('Lỗi khi tải cài đặt!', 'error');
        }
    }

    // ===== RENDER SETTINGS =====
    function renderSettings() {
        if (!settingsData) return;

        // System settings
        document.getElementById('autoStartSwitch').checked = settingsData.auto_start || false;
        document.getElementById('autoOpenDashboardSwitch').checked = settingsData.auto_open_dashboard || false;

        // Timer settings
        if (settingsData.shutdown_timer) {
            const st = settingsData.shutdown_timer;
            document.getElementById('shutdownToggle').checked = st.enabled || false;
            document.getElementById('shutdownHours').value = st.hours || 0;
            document.getElementById('shutdownMinutes').value = st.minutes || 0;
            toggleShutdownInputs(st.enabled);
        }

        if (settingsData.notification_timer) {
            const nt = settingsData.notification_timer;
            document.getElementById('notificationToggle').checked = nt.enabled || false;
            document.getElementById('notificationHours').value = nt.hours || 0;
            document.getElementById('notificationMinutes').value = nt.minutes || 0;
            document.getElementById('notificationMessage').value = nt.message || '';
            toggleNotificationInputs(nt.enabled);
        }

        // Start countdown timers if enabled
        checkTimers();
    }

    // ===== TOGGLE AUTO START =====
    async function toggleAutoStart() {
        const checkbox = document.getElementById('autoStartSwitch');
        const enabled = checkbox.checked;

        // Instant local update
        if (settingsData) {
            settingsData.auto_start = enabled;
        }

        pauseAutoRefresh();

        // Background API call
        try {
            await fetch('/settings/api/settings/auto-start', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            showToast(`Tự động khởi động: ${enabled ? 'BẬT' : 'TẮT'}`, 'success');
        } catch (error) {
            console.error('Error toggling auto-start:', error);
            checkbox.checked = !enabled;
            if (settingsData) settingsData.auto_start = !enabled;
            showToast('Lỗi khi cập nhật!', 'error');
        }
    }

    // ===== TOGGLE AUTO OPEN DASHBOARD =====
    async function toggleAutoOpenDashboard() {
        const checkbox = document.getElementById('autoOpenDashboardSwitch');
        const enabled = checkbox.checked;

        // Instant local update
        if (settingsData) {
            settingsData.auto_open_dashboard = enabled;
        }

        pauseAutoRefresh();

        // Background API call
        try {
            await fetch('/settings/api/settings/auto-open-dashboard', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            showToast(`Tự động mở dashboard: ${enabled ? 'BẬT' : 'TẮT'}`, 'success');
        } catch (error) {
            console.error('Error toggling auto-open:', error);
            checkbox.checked = !enabled;
            if (settingsData) settingsData.auto_open_dashboard = !enabled;
            showToast('Lỗi khi cập nhật!', 'error');
        }
    }

    // ===== SHUTDOWN TIMER =====
    function toggleShutdownTimer() {
        const enabled = document.getElementById('shutdownToggle').checked;
        toggleShutdownInputs(enabled);

        if (!enabled) {
            localStorage.removeItem('shutdownDeadline');
            clearInterval(shutdownCountdownInterval);
            document.getElementById('shutdownCountdown').textContent = '';
        }
    }

    function toggleShutdownInputs(enabled) {
        document.getElementById('shutdownHours').disabled = !enabled;
        document.getElementById('shutdownMinutes').disabled = !enabled;
        document.getElementById('applyShutdownBtn').disabled = !enabled;
        document.getElementById('shutdownInputs').style.opacity = enabled ? '1' : '0.5';
    }

    async function applyShutdownTimer() {
        const hours = parseInt(document.getElementById('shutdownHours').value) || 0;
        const minutes = parseInt(document.getElementById('shutdownMinutes').value) || 0;
        const totalMs = (hours * 60 + minutes) * 60 * 1000;

        if (totalMs === 0) {
            showToast('Vui lòng nhập thời gian!', 'error');
            return;
        }

        pauseAutoRefresh();

        try {
            await fetch('/settings/api/settings/shutdown-timer', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: true, hours, minutes })
            });

            localStorage.setItem('shutdownDeadline', String(Date.now() + totalMs));
            startShutdownCountdown();
            showToast(`Đã hẹn tắt máy sau ${hours}h ${minutes}p`, 'success');
        } catch (error) {
            console.error('Error setting shutdown timer:', error);
            showToast('Lỗi khi cài đặt!', 'error');
        }
    }

    function startShutdownCountdown() {
        clearInterval(shutdownCountdownInterval);

        shutdownCountdownInterval = setInterval(() => {
            const deadline = localStorage.getItem('shutdownDeadline');
            if (!deadline) {
                clearInterval(shutdownCountdownInterval);
                return;
            }

            const remaining = Number(deadline) - Date.now();
            if (remaining <= 0) {
                clearInterval(shutdownCountdownInterval);
                localStorage.removeItem('shutdownDeadline');
                document.getElementById('shutdownCountdown').textContent = 'Đang tắt máy...';
                showToast('Đang tắt máy...', 'info');
                fetch('/settings/api/system/shutdown', { method: 'POST' });
            } else {
                const hours = Math.floor(remaining / 3600000);
                const minutes = Math.floor((remaining % 3600000) / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                document.getElementById('shutdownCountdown').textContent =
                    `⏰ Còn lại: ${hours}h ${minutes}p ${seconds}s`;
            }
        }, 1000);
    }

    // ===== NOTIFICATION TIMER =====
    function toggleNotificationTimer() {
        const enabled = document.getElementById('notificationToggle').checked;
        toggleNotificationInputs(enabled);

        if (!enabled) {
            localStorage.removeItem('notificationDeadline');
            clearInterval(notificationCountdownInterval);
            document.getElementById('notificationCountdown').textContent = '';
        }
    }

    function toggleNotificationInputs(enabled) {
        document.getElementById('notificationHours').disabled = !enabled;
        document.getElementById('notificationMinutes').disabled = !enabled;
        document.getElementById('notificationMessage').disabled = !enabled;
        document.getElementById('applyNotificationBtn').disabled = !enabled;
        document.getElementById('notificationInputs').style.opacity = enabled ? '1' : '0.5';
    }

    async function applyNotificationTimer() {
        const hours = parseInt(document.getElementById('notificationHours').value) || 0;
        const minutes = parseFloat(document.getElementById('notificationMinutes').value) || 0;
        const message = document.getElementById('notificationMessage').value.trim();
        // Allow decimals for quick testing (e.g. 0.1 min = 6 seconds)
        const totalMs = (hours * 60 + minutes) * 60 * 1000;

        if (totalMs === 0) {
            showToast('Vui lòng nhập thời gian!', 'error');
            return;
        }

        if (!message) {
            showToast('Vui lòng nhập nội dung thông báo!', 'error');
            return;
        }

        pauseAutoRefresh();

        try {
            await fetch('/settings/api/settings/notification-timer', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: true, hours, minutes, message })
            });

            localStorage.setItem('notificationDeadline', String(Date.now() + totalMs));
            localStorage.setItem('notificationMessage', message);
            startNotificationCountdown();
            showToast(`Đã hẹn thông báo sau ${hours}h ${minutes}p`, 'success');
        } catch (error) {
            console.error('Error setting notification timer:', error);
            showToast('Lỗi khi cài đặt!', 'error');
        }
    }

    function startNotificationCountdown() {
        clearInterval(notificationCountdownInterval);

        notificationCountdownInterval = setInterval(() => {
            const deadline = localStorage.getItem('notificationDeadline');
            if (!deadline) {
                clearInterval(notificationCountdownInterval);
                return;
            }

            const remaining = Number(deadline) - Date.now();
            if (remaining <= 0) {
                clearInterval(notificationCountdownInterval);
                const message = localStorage.getItem('notificationMessage') || 'Hết giờ!';
                localStorage.removeItem('notificationDeadline');
                document.getElementById('notificationCountdown').textContent = 'Đã thông báo!';

                // Show browser notification
                if (Notification.permission === "granted") {
                    new Notification('⏰ Thông báo!', { body: message, requireInteraction: true });
                }
                showToast(message, 'info', 'Thông báo');
            } else {
                const hours = Math.floor(remaining / 3600000);
                const minutes = Math.floor((remaining % 3600000) / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                document.getElementById('notificationCountdown').textContent =
                    `⏰ Còn lại: ${hours}h ${minutes}p ${seconds}s`;
            }
        }, 1000);
    }

    // ===== CHECK TIMERS ON LOAD =====
    function checkTimers() {
        // Check shutdown timer
        const shutdownDeadline = localStorage.getItem('shutdownDeadline');
        if (shutdownDeadline && Date.now() < Number(shutdownDeadline)) {
            startShutdownCountdown();
        }

        // Check notification timer
        const notificationDeadline = localStorage.getItem('notificationDeadline');
        if (notificationDeadline && Date.now() < Number(notificationDeadline)) {
            startNotificationCountdown();
        }
    }

    // ===== MXH REAL-TIME SETTINGS LOGIC =====

    // Function to load the MXH refresh interval
    async function loadMxhRefreshInterval() {
        try {
            const response = await fetch('/settings/api/settings');
            if (response.ok) {
                const settings = await response.json();
                const interval = settings.mxh_refresh_interval || 15000;
                document.getElementById('mxh-refresh-interval-ms').value = interval;
            }
        } catch (error) {
            console.error('Error loading MXH settings:', error);
        }
    }

    // Function to apply the MXH refresh interval
    async function applyMxhRefreshInterval() {
        const intervalInput = document.getElementById('mxh-refresh-interval-ms');
        const interval = parseInt(intervalInput.value, 10);

        if (isNaN(interval) || interval < 3000) {
            showToast('Tần suất phải là số nguyên >= 3000ms!', 'error');
            intervalInput.focus();
            return;
        }

        try {
            const response = await fetch('/settings/api/settings/mxh-refresh-interval', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ interval_ms: interval })
            });

            if (response.ok) {
                localStorage.setItem('mxh_refresh_interval_ms', String(interval));
                window.dispatchEvent(new CustomEvent('mxh-refresh-interval-changed', {
                    detail: { interval }
                }));
                showToast(`✅ Đã lưu tần suất làm mới: ${interval / 1000} giây.`, 'success');
            } else {
                const error = await response.json();
                showToast(error.error || 'Lỗi khi lưu tần suất!', 'error');
            }
        } catch (error) {
            showToast('Lỗi kết nối API!', 'error');
        }
    }

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 Settings page loaded');

        // Request notification permission
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Load initial settings
        await loadSettings(true);

        // NEW: Load MXH refresh interval on DOM ready
        loadMxhRefreshInterval();

        // NEW: Event listener for apply button
        const applyMxhRefreshBtn = document.getElementById('apply-mxh-refresh-btn');
        if (applyMxhRefreshBtn) {
            applyMxhRefreshBtn.addEventListener('click', applyMxhRefreshInterval);
        }

        document.querySelectorAll('[data-settings-action]').forEach((element) => {
            element.addEventListener('click', (event) => {
                const action = (event.currentTarget as HTMLElement).dataset.settingsAction;
                if (action === 'reload') loadSettings(true);
                if (action === 'enable-notification') requestNotificationPermission();
                if (action === 'apply-shutdown') applyShutdownTimer();
                if (action === 'apply-notification') applyNotificationTimer();
            });
            element.addEventListener('change', (event) => {
                const action = (event.currentTarget as HTMLElement).dataset.settingsAction;
                if (action === 'toggle-auto-start') toggleAutoStart();
                if (action === 'toggle-auto-open-dashboard') toggleAutoOpenDashboard();
                if (action === 'toggle-shutdown') toggleShutdownTimer();
                if (action === 'toggle-notification') toggleNotificationTimer();
            });
        });

        // Start auto-refresh
        startAutoRefresh();

        // Tab visibility handling
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopAutoRefresh();
            } else {
                loadSettings(true);
                startAutoRefresh();
            }
        });

        // Check Notification Permission on Load
        if (Notification.permission === 'granted') {
            const btn = document.getElementById('btnEnableNotification');
            if (btn) {
                btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Đã Bật';
                btn.classList.remove('btn-outline-primary');
                btn.classList.add('btn-success');
                btn.disabled = true;
            }
        }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        stopAutoRefresh();
        clearInterval(shutdownCountdownInterval);
        clearInterval(notificationCountdownInterval);
    });
