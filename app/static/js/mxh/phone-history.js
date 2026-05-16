"use strict";
// MXH phone history modal helpers.
(function () {
    async function loadPhoneHistory(ctx, accountId) {
        const listContainer = ctx.document.getElementById('phone-history-list');
        listContainer.innerHTML = '<div class="text-muted mxh-phone-history-status"><i class="bi bi-hourglass me-1"></i>Đang tải...</div>';
        if (!listContainer.dataset.mxhCopyBound) {
            listContainer.addEventListener('click', (event) => {
                const button = event.target.closest('[data-copy-phone]');
                if (!button || !listContainer.contains(button))
                    return;
                copyPhoneHistory(ctx, button.dataset.copyPhone);
            });
            listContainer.dataset.mxhCopyBound = '1';
        }
        try {
            const response = await ctx.MXHApi.getPhoneHistory(accountId);
            const history = await response.json();
            if (history && history.length > 0) {
                listContainer.innerHTML = history.map(item => {
                    let changedAt = '';
                    if (item.changed_at) {
                        const date = new Date(item.changed_at);
                        changedAt = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                    }
                    return `
                        <div class="d-flex align-items-center justify-content-between border-bottom border-secondary mb-1 pb-1 mxh-phone-history-row">
                            <div>
                                <span class="font-monospace text-warning fw-bold">${item.phone}</span>
                                <small class="text-muted ms-2 mxh-phone-history-date">${changedAt}</small>
                            </div>
                            <button type="button" class="btn btn-sm btn-link text-info p-0 d-flex align-items-center justify-content-center mxh-action-icon mxh-phone-history-copy" data-copy-phone="${ctx.escapeHtml(item.phone)}" title="Copy SĐT này">
                                <i class="bi bi-copy"></i>
                            </button>
                        </div>
                    `;
                }).join('');
            }
            else {
                listContainer.innerHTML = '<div class="text-muted mxh-phone-history-status">Không có lịch sử thay đổi SĐT</div>';
            }
        }
        catch (error) {
            console.error('Failed to load phone history', error);
            listContainer.innerHTML = '<div class="text-danger mxh-phone-history-status">Lỗi tải dữ liệu</div>';
        }
    }
    function copyPhoneHistory(ctx, phone) {
        ctx.navigator.clipboard.writeText(phone);
        ctx.showToast(`Đã copy: ${phone}`, 'success');
    }
    function bindControls(ctx) {
        const addButton = ctx.document.getElementById('btn-add-phone-history');
        if (addButton && !addButton.dataset.mxhPhoneHistoryBound) {
            addButton.addEventListener('click', () => {
                const addRow = ctx.document.getElementById('phone-history-add-row');
                if (addRow.classList.contains('d-none')) {
                    addRow.classList.remove('d-none');
                    ctx.document.getElementById('input-new-phone-history').focus();
                }
                else {
                    addRow.classList.add('d-none');
                }
            });
            addButton.dataset.mxhPhoneHistoryBound = '1';
        }
        const cancelButton = ctx.document.getElementById('btn-cancel-add-phone-history');
        if (cancelButton && !cancelButton.dataset.mxhPhoneHistoryBound) {
            cancelButton.addEventListener('click', () => {
                ctx.document.getElementById('phone-history-add-row').classList.add('d-none');
                ctx.document.getElementById('input-new-phone-history').value = '';
            });
            cancelButton.dataset.mxhPhoneHistoryBound = '1';
        }
        const confirmButton = ctx.document.getElementById('btn-confirm-add-phone-history');
        if (confirmButton && !confirmButton.dataset.mxhPhoneHistoryBound) {
            confirmButton.addEventListener('click', async () => {
                if (!ctx.currentContextAccountId)
                    return;
                const inputEl = ctx.document.getElementById('input-new-phone-history');
                const phoneStr = inputEl.value.trim();
                if (!phoneStr)
                    return;
                try {
                    const response = await ctx.MXHApi.addPhoneHistory(ctx.currentContextAccountId, { phone: phoneStr });
                    if (response.ok) {
                        ctx.showToast('Đã thêm vào lịch sử SĐT', 'success');
                        inputEl.value = '';
                        ctx.document.getElementById('phone-history-add-row').classList.add('d-none');
                        loadPhoneHistory(ctx, ctx.currentContextAccountId);
                    }
                    else {
                        throw new Error('Server error');
                    }
                }
                catch (error) {
                    ctx.showToast('Lỗi khi thêm SĐT', 'error');
                }
            });
            confirmButton.dataset.mxhPhoneHistoryBound = '1';
        }
        const clearButton = ctx.document.getElementById('btn-clear-phone-history');
        if (clearButton && !clearButton.dataset.mxhPhoneHistoryBound) {
            clearButton.addEventListener('click', async () => {
                if (!ctx.currentContextAccountId)
                    return;
                if (!ctx.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử SĐT của tài khoản này?'))
                    return;
                try {
                    const response = await ctx.MXHApi.deletePhoneHistory(ctx.currentContextAccountId);
                    if (response.ok) {
                        ctx.showToast('Đã xóa lịch sử', 'success');
                        loadPhoneHistory(ctx, ctx.currentContextAccountId);
                    }
                    else {
                        throw new Error('Server error');
                    }
                }
                catch (error) {
                    ctx.showToast('Lỗi khi xóa lịch sử', 'error');
                }
            });
            clearButton.dataset.mxhPhoneHistoryBound = '1';
        }
    }
    window.MXHPhoneHistory = {
        loadPhoneHistory,
        copyPhoneHistory,
        bindControls
    };
})();
