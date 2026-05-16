"use strict";
// MXH account notice and scan-reset actions.
(function () {
    let ctx = null;
    function init(context) {
        ctx = context;
        const submitNoticeBtn = document.getElementById('mxh-submit-notice-btn');
        if (submitNoticeBtn && !submitNoticeBtn.dataset.mxhNoticeBound) {
            submitNoticeBtn.dataset.mxhNoticeBound = '1';
            submitNoticeBtn.addEventListener('click', submitNotice);
        }
    }
    let noticeTargetId = null;
    function openNoticeModal(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!ctx.currentContextAccountId)
            return;
        noticeTargetId = ctx.currentContextAccountId;
        document.getElementById('noticeTitle').value = 'Dưỡng';
        document.getElementById('noticeDays').value = '30';
        document.getElementById('noticeNote').value = '';
        const modal = new bootstrap.Modal(document.getElementById('noticeModal'));
        modal.show();
    }
    async function submitNotice() {
        const title = document.getElementById('noticeTitle').value.trim();
        const days = parseInt(document.getElementById('noticeDays').value, 10) || 0;
        const note = document.getElementById('noticeNote').value.trim();
        if (!noticeTargetId || !title || days <= 0) {
            ctx.showToast('Vui lòng điền đầy đủ thông tin!', 'error');
            return;
        }
        try {
            // Pause auto-refresh to prevent race condition
            ctx.pauseAutoRefresh();
            const response = await ctx.MXHApi.setNotice(noticeTargetId, { title, days, note });
            if (response.ok) {
                ctx.showToast('✅ Đã đặt thông báo!', 'success');
                // Update local data immediately to trigger render
                const account = ctx.mxhAccounts.find(a => a.id === noticeTargetId);
                if (account) {
                    const startDate = new Date();
                    const dueDate = new Date(startDate);
                    dueDate.setDate(dueDate.getDate() + days);
                    account.notice = {
                        enabled: true,
                        title: title,
                        days: days,
                        note: note,
                        start_at: startDate.toISOString(),
                        due_date: dueDate.toISOString()
                    };
                    // Force full rebuild to ensure UI updates
                    ctx.requestFullRebuild();
                }
                const modal = bootstrap.Modal.getInstance(document.getElementById('noticeModal'));
                modal.hide();
                // Force re-render with updated data
                ctx.scheduleRender();
                // Resume auto-refresh after render
                setTimeout(() => ctx.resumeAutoRefresh(), 100);
            }
            else {
                ctx.showToast('Lỗi khi đặt thông báo!', 'error');
                ctx.resumeAutoRefresh(); // Resume even on error
            }
        }
        catch (error) {
            ctx.showToast('Lỗi kết nối!', 'error');
            ctx.resumeAutoRefresh(); // Resume even on error
        }
        noticeTargetId = null;
    }
    async function clearNotice(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!ctx.currentContextAccountId)
            return;
        try {
            // Pause auto-refresh to prevent race condition
            ctx.pauseAutoRefresh();
            const response = await ctx.MXHApi.deleteNotice(ctx.currentContextAccountId);
            if (response.ok) {
                ctx.showToast('✅ Đã tắt thông báo!', 'success');
                // Update local data immediately to trigger render
                const account = ctx.mxhAccounts.find(a => a.id === ctx.currentContextAccountId);
                if (account) {
                    account.notice = null; // Set to null instead of empty object
                    // Force full rebuild to ensure UI updates
                    ctx.requestFullRebuild();
                }
                // Force re-render with updated data
                ctx.scheduleRender();
                // Resume auto-refresh after render
                setTimeout(() => ctx.resumeAutoRefresh(), 100);
            }
            else {
                ctx.showToast('Lỗi khi xóa thông báo!', 'error');
                ctx.resumeAutoRefresh(); // Resume even on error
            }
        }
        catch (error) {
            ctx.showToast('Lỗi kết nối!', 'error');
            ctx.resumeAutoRefresh(); // Resume even on error
        }
    }
    // Alias for cancel notice from context menu
    async function cancelNotice(accountId) {
        ctx.currentContextAccountId = accountId;
        await clearNotice(null);
    }
    // NEW: Reset scan count for new context menu
    async function resetScanCountNew(accountId) {
        if (!accountId)
            return;
        // Instant local update
        const accountIndex = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
        if (accountIndex !== -1) {
            ctx.mxhAccounts[accountIndex].wechat_scan_count = 0;
            ctx.mxhAccounts[accountIndex].wechat_last_scan_date = null;
            // Force full rebuild to ensure UI updates (e.g. scan count color)
            ctx.requestFullRebuild();
            ctx.scheduleRender();
        }
        try {
            const response = await ctx.MXHApi.resetScan(accountId);
            if (response.ok) {
                // Merge server response if available
                const responseData = await response.json();
                if (responseData && responseData.id) {
                    const idx = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
                    if (idx !== -1) {
                        ctx.mxhAccounts[idx] = responseData;
                        // Force full rebuild again to sync with server data
                        ctx.requestFullRebuild();
                        ctx.scheduleRender();
                    }
                }
                ctx.showToast('✅ Đã reset lượt quét!', 'success');
            }
            else {
                ctx.showToast('Lỗi!', 'error');
                await ctx.loadMXHData(false);
            }
        }
        catch (error) {
            ctx.showToast('Lỗi kết nối!', 'error');
            await ctx.loadMXHData(false);
        }
    }
    window.MXHAccountNotices = {
        init,
        openNoticeModal,
        submitNotice,
        clearNotice,
        cancelNotice,
        resetScanCountNew
    };
})();
