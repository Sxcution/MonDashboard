// MXH notice badge preview helpers.
(function () {
    function init(ctx) {
        const doc = ctx.document;
        const win = ctx.window;

        if (doc.documentElement?.dataset.mxhNoticePreviewBound) return;
        if (doc.documentElement) doc.documentElement.dataset.mxhNoticePreviewBound = '1';

        let $preview = null;
        let $badge = null;
        let hoverEnterTimer = null;
        let hoverLeaveTimer = null;
        let actionDocClickBound = false;

        const ENTER_DELAY = 80;
        const LEAVE_DELAY = 160;

        const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

        function clearTimers() {
            if (hoverEnterTimer) { clearTimeout(hoverEnterTimer); hoverEnterTimer = null; }
            if (hoverLeaveTimer) { clearTimeout(hoverLeaveTimer); hoverLeaveTimer = null; }
        }

        function closePreview(force = false) {
            clearTimers();
            if (!$preview) return;
            $preview.classList.remove('show');
            const el = $preview;
            $preview = null;
            $badge = null;
            setTimeout(() => el.remove(), 120);
            if (actionDocClickBound) {
                doc.removeEventListener('click', onDocumentClick, true);
                actionDocClickBound = false;
            }
        }

        function onDocumentClick(event) {
            if (!$preview || !$badge) return;
            if (event.target.closest('.notice-preview') || event.target.closest('.notice-badge')) return;
            closePreview(true);
        }

        function placePreview(box, badge) {
            const rect = badge.getBoundingClientRect();
            const boxH = box.offsetHeight || 200;
            const boxW = box.offsetWidth || 200;

            const desiredLeft = Math.max(8, Math.min(rect.left - (boxW - rect.width) / 2, win.innerWidth - boxW - 8));

            let top = rect.bottom + 10;
            if (top + boxH > win.innerHeight - 8) {
                top = Math.max(8, rect.top - boxH - 12);
                box.style.setProperty('--arrow-top', (boxH - 6) + 'px');
            } else {
                box.style.setProperty('--arrow-top', '-8px');
            }

            const arrowLeft = Math.min(Math.max(rect.left + rect.width / 2 - desiredLeft - 6, 10), boxW - 22);
            box.style.setProperty('--arrow-left', arrowLeft + 'px');

            box.style.left = desiredLeft + 'px';
            box.style.top = top + 'px';
        }

        function buildPreviewDOM(data, badgeType, mode) {
            const box = doc.createElement('div');
            box.className = 'notice-preview' + (mode === 'action' ? ' action' : '');

            if (badgeType === 'anniversary') {
                const msg = data?.message || 'Tài khoản đã đủ tuổi 1 năm';
                box.innerHTML = `
                    <div class="content">${escapeHtml(msg)}</div>
                    <div class="actions">
                        <button type="button" class="btn btn-off">Tắt Thông Báo</button>
                        <button type="button" class="btn btn-ok">Ok</button>
                    </div>
                `;
            } else {
                const title = data?.title || 'Thông báo đến hạn';

                let meta = '';
                if (data?.start_human && data?.due_human) {
                    meta = `Từ: ${data.start_human} → Đến hạn: ${data.due_human}`;
                } else if (data?.due_human) {
                    meta = `Đến hạn: ${data.due_human}`;
                } else if (data?.due_at) {
                    const dueDate = new Date(data.due_at);
                    if (data?.start_at) {
                        const startDate = new Date(data.start_at);
                        meta = `Từ: ${startDate.toLocaleDateString('vi-VN')} → Đến hạn: ${dueDate.toLocaleDateString('vi-VN')}`;
                    } else {
                        meta = `Đến hạn: ${dueDate.toLocaleDateString('vi-VN')}`;
                    }
                }

                const msg = data?.message || '(Không có nội dung)';

                box.innerHTML = `
                    <div class="title">${escapeHtml(title)}</div>
                    <div class="meta">${escapeHtml(meta)}</div>
                    <div class="content">${escapeHtml(msg)}</div>
                    <div class="actions">
                        <button type="button" class="btn btn-off">Tắt Thông Báo</button>
                        <button type="button" class="btn btn-ok">Ok</button>
                    </div>
                `;
            }

            box.querySelector('.btn-ok').addEventListener('click', () => closePreview(true));
            box.querySelector('.btn-off').addEventListener('click', async () => {
                try {
                    const accId = $badge?.dataset.accountId;
                    const noticeId = $badge?.dataset.noticeId;
                    await ctx.MXHApi.disableNotice(accId, noticeId);
                    $badge.style.display = 'none';
                    closePreview(true);
                } catch (err) {
                    console.error(err);
                    ctx.showAlert('Tắt thông báo thất bại (kiểm tra route backend)');
                }
            });

            box.addEventListener('mouseover', () => { if (hoverLeaveTimer) { clearTimeout(hoverLeaveTimer); hoverLeaveTimer = null; } });
            box.addEventListener('mouseout', (event) => {
                if (!box.contains(event.relatedTarget) && (!$badge || !$badge.contains(event.relatedTarget))) {
                    scheduleClose();
                }
            });

            return box;
        }

        function scheduleOpen(badge, mode) {
            clearTimers();
            hoverEnterTimer = setTimeout(async () => {
                if ($preview && $badge && $badge !== badge) closePreview(true);

                $badge = badge;

                const badgeType = badge.dataset.badgeType || 'due';
                let data = null;

                if (badgeType === 'anniversary') {
                    try {
                        const raw = badge?.dataset?.anniversaryCache;
                        if (raw) {
                            data = JSON.parse(raw);
                        }
                    } catch (err) {
                        console.error('🔍 Error parsing anniversary cache:', err);
                    }
                } else {
                    try {
                        data = await ctx.MXHApi.getNoticeData(badge.dataset.accountId, badge);
                    } catch (err) {
                        console.error(err);
                        data = { title: 'Thông báo đến hạn', message: 'Không lấy được nội dung', due_human: '' };
                    }
                }

                if ($preview) {
                    $preview.classList.toggle('action', mode === 'action');
                } else {
                    $preview = buildPreviewDOM(data, badgeType, mode);
                    doc.body.appendChild($preview);
                }

                $preview.style.visibility = 'hidden';
                $preview.classList.add('show');
                placePreview($preview, badge);
                $preview.style.visibility = '';

                if (mode === 'action' && !actionDocClickBound) {
                    doc.addEventListener('click', onDocumentClick, true);
                    actionDocClickBound = true;
                }
            }, ENTER_DELAY);
        }

        function scheduleClose() {
            clearTimers();
            hoverLeaveTimer = setTimeout(() => {
                if ($preview && !$preview.classList.contains('action')) {
                    closePreview();
                }
            }, LEAVE_DELAY);
        }

        doc.addEventListener('mouseover', (event) => {
            const badge = event.target.closest('.notice-badge');
            if (!badge) return;
            if (badge.contains(event.relatedTarget)) return;
            scheduleOpen(badge, 'hover');
        }, true);

        doc.addEventListener('mouseout', (event) => {
            const badge = event.target.closest('.notice-badge');
            if (!badge) return;
            if (badge.contains(event.relatedTarget)) return;
            if (!$preview || ($preview && !$preview.contains(event.relatedTarget))) {
                scheduleClose();
            }
        }, true);

        doc.addEventListener('click', (event) => {
            const badge = event.target.closest('.notice-badge');
            if (!badge) return;

            event.preventDefault();
            event.stopPropagation();

            if ($preview && $badge === badge) {
                $preview.classList.add('action');
                if (!actionDocClickBound) {
                    doc.addEventListener('click', onDocumentClick, true);
                    actionDocClickBound = true;
                }
                return;
            }

            scheduleOpen(badge, 'action');
        }, true);

        win.addEventListener('scroll', () => { if ($preview && $badge) placePreview($preview, $badge); }, true);
        win.addEventListener('resize', () => { if ($preview && $badge) placePreview($preview, $badge); }, true);
    }

    window.MXHNoticePreview = {
        init
    };
})();
