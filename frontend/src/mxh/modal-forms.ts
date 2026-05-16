// MXH modal form helpers. Classic global wrapper, no ES modules yet.
(function () {
    function bindAddAccountDefaults(doc) {
        const mxhAddAccountModal = doc.getElementById('mxh-addAccountModal');
        if (!mxhAddAccountModal || mxhAddAccountModal.dataset.mxhDefaultsBound) return;
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

            if (dayInput) dayInput.value = day;
            if (monthInput) monthInput.value = month;
            if (yearInput) yearInput.value = year;
            if (usernameInput) usernameInput.value = '';
            if (platformInput) platformInput.value = '';
            if (passwordInput) passwordInput.value = '';
            if (phoneInput) phoneInput.value = '';
            if (urlInput) urlInput.value = '';
        });
    }

    function bindWechatDateDefault(doc) {
        const wechatAccountModal = doc.getElementById('wechat-account-modal');
        if (!wechatAccountModal || wechatAccountModal.dataset.mxhDateDefaultBound) return;
        wechatAccountModal.dataset.mxhDateDefaultBound = '1';

        wechatAccountModal.addEventListener('shown.bs.modal', function () {
            const dateInput = doc.getElementById('wechat-date');
            if (!dateInput) return;

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
        if (!dateInput || dateInput.dataset.mxhDateFormatterBound) return;
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
            if (e.key !== 'Backspace') return;

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
            } else if (pastedData.length >= 4) {
                const day = pastedData.slice(0, 2);
                const month = pastedData.slice(2, 4);
                this.value = day + '/' + month + '/';
            } else {
                this.value = pastedData;
            }
        });
    }

    function init(ctx) {
        const doc = ctx.document || document;
        bindAddAccountDefaults(doc);
        bindWechatDateDefault(doc);
        bindWechatDateFormatter(doc);
    }

    window.MXHModalForms = {
        init
    };
})();
