"use strict";
// MXH modal form helpers. Classic global wrapper, no ES modules yet.
(function () {
    function bindAddAccountDefaults(doc) {
        const mxhAddAccountModal = doc.getElementById('mxh-addAccountModal');
        if (!mxhAddAccountModal || mxhAddAccountModal.dataset.mxhDefaultsBound)
            return;
        mxhAddAccountModal.dataset.mxhDefaultsBound = '1';
        mxhAddAccountModal.addEventListener('shown.bs.modal', function () {
            const today = new Date();
            const day = today.getDate();
            const month = today.getMonth() + 1;
            const year = today.getFullYear();
            const dayInput = doc.getElementById('mxh-day');
            const monthInput = doc.getElementById('mxh-month');
            const yearInput = doc.getElementById('mxh-year');
            const usernameInput = doc.getElementById('mxh-username');
            const platformInput = doc.getElementById('mxh-platform');
            const passwordInput = doc.getElementById('mxh-password');
            const phoneInput = doc.getElementById('mxh-phone');
            const urlInput = doc.getElementById('mxh-url');
            if (dayInput)
                dayInput.value = day;
            if (monthInput)
                monthInput.value = month;
            if (yearInput)
                yearInput.value = year;
            if (usernameInput)
                usernameInput.value = '';
            if (platformInput)
                platformInput.value = '';
            if (passwordInput)
                passwordInput.value = '';
            if (phoneInput)
                phoneInput.value = '';
            if (urlInput)
                urlInput.value = '';
        });
    }
    function bindWechatDateDefault(doc) {
        const wechatAccountModal = doc.getElementById('wechat-account-modal');
        if (!wechatAccountModal || wechatAccountModal.dataset.mxhDateDefaultBound)
            return;
        wechatAccountModal.dataset.mxhDateDefaultBound = '1';
        wechatAccountModal.addEventListener('shown.bs.modal', function () {
            const dateInput = doc.getElementById('wechat-date');
            if (!dateInput)
                return;
            const currentDate = dateInput.value;
            console.log('🔍 Modal opened, current date value:', currentDate);
            if (!currentDate || currentDate === '01/01/2024') {
                const today = new Date();
                const day = today.getDate();
                const month = today.getMonth() + 1;
                const year = today.getFullYear();
                const formattedDate = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
                console.log('🔍 Setting date to:', formattedDate);
                dateInput.value = formattedDate;
            }
        });
    }
    function bindWechatDateFormatter(doc) {
        const dateInput = doc.getElementById('wechat-date');
        if (!dateInput || dateInput.dataset.mxhDateFormatterBound)
            return;
        dateInput.dataset.mxhDateFormatterBound = '1';
        dateInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2);
            }
            if (value.length >= 5) {
                value = value.slice(0, 5) + '/' + value.slice(5, 9);
            }
            e.target.value = value;
        });
        dateInput.addEventListener('keydown', function (e) {
            if (e.key !== 'Backspace')
                return;
            const cursorPos = this.selectionStart;
            const value = this.value;
            if (cursorPos > 0 && value[cursorPos - 1] === '/') {
                e.preventDefault();
                this.setSelectionRange(cursorPos - 1, cursorPos - 1);
            }
        });
        dateInput.addEventListener('paste', function (e) {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
            if (pastedData.length >= 8) {
                const day = pastedData.slice(0, 2);
                const month = pastedData.slice(2, 4);
                const year = pastedData.slice(4, 8);
                this.value = day + '/' + month + '/' + year;
            }
            else if (pastedData.length >= 4) {
                const day = pastedData.slice(0, 2);
                const month = pastedData.slice(2, 4);
                this.value = day + '/' + month + '/';
            }
            else {
                this.value = pastedData;
            }
        });
    }
    function updatePlatformDropdown(doc) {
        const platformSelect = doc.getElementById('mxh-platform');
        if (!platformSelect)
            return;
        // Reset to default (wechat only)
        platformSelect.innerHTML = `
            <option value="">Chọn nền tảng...</option>
            <option value="wechat">WeChat</option>
        `;
        // Read custom platforms from localStorage
        let customPlatforms = [];
        try {
            customPlatforms = JSON.parse(localStorage.getItem('mxh_custom_platforms') || '[]');
        }
        catch (e) {
            console.error('Error loading custom platforms:', e);
        }
        // Add them to select list
        customPlatforms.forEach(p => {
            const val = String(p.value || p.name || '').toLowerCase().trim();
            const lbl = String(p.name || '').trim();
            if (val && val !== 'wechat') {
                const opt = doc.createElement('option');
                opt.value = val;
                opt.textContent = lbl;
                platformSelect.appendChild(opt);
            }
        });
    }
    function bindCustomPlatformHandler(doc) {
        const addBtn = doc.getElementById('mxh-btn-add-platform');
        const saveBtn = doc.getElementById('mxh-save-platform-btn');
        const inputField = doc.getElementById('mxh-new-platform-name');
        const addPlatformModalEl = doc.getElementById('mxh-addPlatformModal');
        if (!addBtn || !saveBtn || !inputField || !addPlatformModalEl)
            return;
        // Populate dropdown initially
        updatePlatformDropdown(doc);
        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            inputField.value = '';
            // Show the platform modal
            const modal = window.bootstrap.Modal.getOrCreateInstance(addPlatformModalEl);
            modal.show();
        });
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const platformName = inputField.value.trim();
            if (!platformName) {
                if (typeof window.showToast === 'function') {
                    window.showToast('Tên nền tảng không được để trống!', 'error');
                }
                else {
                    alert('Tên nền tảng không được để trống!');
                }
                return;
            }
            const platformValue = platformName.toLowerCase();
            // Load existing
            let customPlatforms = [];
            try {
                customPlatforms = JSON.parse(localStorage.getItem('mxh_custom_platforms') || '[]');
            }
            catch (err) {
                customPlatforms = [];
            }
            // Check duplicate
            const exists = platformValue === 'wechat' || customPlatforms.some(p => String(p.value || p.name || '').toLowerCase() === platformValue);
            if (exists) {
                if (typeof window.showToast === 'function') {
                    window.showToast('Nền tảng này đã tồn tại!', 'warning');
                }
                else {
                    alert('Nền tảng này đã tồn tại!');
                }
                return;
            }
            // Save new platform
            customPlatforms.push({
                name: platformName,
                value: platformValue
            });
            localStorage.setItem('mxh_custom_platforms', JSON.stringify(customPlatforms));
            // Update dropdown
            updatePlatformDropdown(doc);
            // Set value to the new platform in add account modal
            const platformSelect = doc.getElementById('mxh-platform');
            if (platformSelect) {
                platformSelect.value = platformValue;
            }
            // Close child modal
            const modal = window.bootstrap.Modal.getInstance(addPlatformModalEl);
            if (modal)
                modal.hide();
            if (typeof window.showToast === 'function') {
                window.showToast('Đã thêm nền tảng mới!', 'success');
            }
        });
    }
    function init(ctx) {
        const doc = ctx.document || document;
        bindAddAccountDefaults(doc);
        bindWechatDateDefault(doc);
        bindWechatDateFormatter(doc);
        bindCustomPlatformHandler(doc);
    }
    window.MXHModalForms = {
        init
    };
})();
