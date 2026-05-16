// MXH scan history modal helpers.
(function () {
    async function fetchScanHistoryData(ctx, accountId) {
        const listEl = ctx.document.getElementById('scan-history-list');
        listEl.innerHTML = '<div class="text-center text-muted small py-3">Đang tải...</div>';

        try {
            const response = await ctx.MXHApi.getScanHistory(accountId);
            if (response.ok) {
                const history = await response.json();
                if (history.length === 0) {
                    listEl.innerHTML = '<div class="text-center text-muted small py-3">Chưa có lịch sử quét</div>';
                } else {
                    listEl.innerHTML = history.map(item => {
                        const date = new Date(item.scan_date);
                        const day = String(date.getDate()).padStart(2, '0');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const year = date.getFullYear();
                        return `
                            <div class="text-center p-1 rounded mb-1 mxh-scan-history-item">
                                <span class="mxh-scan-history-date">${day}/${month}/${year}</span>
                            </div>
                        `;
                    }).join('');
                }
            } else {
                listEl.innerHTML = '<div class="text-center text-danger small py-3">Lỗi tải lịch sử</div>';
            }
        } catch (error) {
            console.error('Error fetching history:', error);
            listEl.innerHTML = '<div class="text-center text-danger small py-3">Lỗi kết nối</div>';
        }
    }

    async function openScanHistoryModal(ctx, accountId) {
        const el = ctx.document.getElementById('scan-history-modal');
        const modal = ctx.bootstrap.Modal.getOrCreateInstance(el);

        const resetBtn = ctx.document.getElementById('btn-reset-scan-history');
        if (resetBtn) resetBtn.dataset.accountId = accountId;

        await fetchScanHistoryData(ctx, accountId);

        modal.show();
    }

    async function resetScanHistory(ctx, btn) {
        const accountId = btn.dataset.accountId;
        if (!accountId) return;

        try {
            const response = await ctx.MXHApi.deleteScanHistory(accountId);

            if (response.ok) {
                await fetchScanHistoryData(ctx, accountId);
                ctx.showToast('Đã xóa lịch sử quét', 'success');
            } else {
                ctx.showToast('Lỗi xóa lịch sử', 'error');
            }
        } catch (error) {
            console.error('Error resetting history:', error);
            ctx.showToast('Lỗi kết nối', 'error');
        }
    }

    function bindControls(ctx) {
        const resetScanHistoryBtn = ctx.document.getElementById('btn-reset-scan-history');
        if (resetScanHistoryBtn && !resetScanHistoryBtn.dataset.mxhScanHistoryBound) {
            resetScanHistoryBtn.addEventListener('click', function () {
                resetScanHistory(ctx, this);
            });
            resetScanHistoryBtn.dataset.mxhScanHistoryBound = '1';
        }
    }

    window.MXHScanHistory = {
        fetchScanHistoryData,
        openScanHistoryModal,
        resetScanHistory,
        bindControls
    };
})();
