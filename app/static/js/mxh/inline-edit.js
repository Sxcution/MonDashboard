"use strict";
// MXH inline edit helpers. Classic global wrapper before TypeScript modules.
(function () {
    function createRuntime(ctx) {
        const doc = ctx.document || document;
        const win = ctx.window || window;
        const perf = win.performance || performance;
        let active = false;
        let releaseTimer = null;
        let selectionState = null;
        let lastDocumentPointerDownAt = 0;
        let commitOnBlur = false;
        let bound = false;
        function isEditableElement(el) {
            return !!(el && el.closest && el.closest('.editable-field[contenteditable="true"]'));
        }
        function isEditing() {
            return active || isEditableElement(doc.activeElement);
        }
        function setActive(value) {
            if (releaseTimer) {
                clearTimeout(releaseTimer);
                releaseTimer = null;
            }
            active = value;
        }
        function isLeavingBrowserWindow() {
            return doc.hidden || !doc.hasFocus();
        }
        function shouldHoldOnBlur() {
            if (isLeavingBrowserWindow())
                return true;
            if (commitOnBlur)
                return false;
            return (perf.now() - lastDocumentPointerDownAt) > 1200;
        }
        function captureSelection(targetEl = doc.activeElement) {
            const el = isEditableElement(targetEl) ? targetEl.closest('.editable-field[contenteditable="true"]') : null;
            if (!el)
                return;
            const selection = win.getSelection();
            if (!selection || selection.rangeCount === 0)
                return;
            const range = selection.getRangeAt(0);
            if (!el.contains(range.startContainer) || !el.contains(range.endContainer))
                return;
            const before = range.cloneRange();
            before.selectNodeContents(el);
            before.setEnd(range.startContainer, range.startOffset);
            selectionState = {
                accountId: el.dataset.accountId,
                field: el.dataset.field,
                start: before.toString().length,
                end: before.toString().length + range.toString().length
            };
        }
        function setContentEditableRange(el, start, end) {
            const range = doc.createRange();
            const selection = win.getSelection();
            let current = 0;
            let startSet = false;
            let endSet = false;
            const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
                const node = walker.currentNode;
                const next = current + node.nodeValue.length;
                if (!startSet && start <= next) {
                    range.setStart(node, Math.max(0, start - current));
                    startSet = true;
                }
                if (!endSet && end <= next) {
                    range.setEnd(node, Math.max(0, end - current));
                    endSet = true;
                    break;
                }
                current = next;
            }
            if (!startSet)
                range.setStart(el, el.childNodes.length);
            if (!endSet)
                range.setEnd(el, el.childNodes.length);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        function restoreSelection() {
            if (!selectionState)
                return;
            const el = Array.from(doc.querySelectorAll('.editable-field[contenteditable="true"]')).find(item => item.dataset.accountId === selectionState.accountId &&
                item.dataset.field === selectionState.field);
            if (!el)
                return;
            el.focus({ preventScroll: true });
            setContentEditableRange(el, selectionState.start, selectionState.end);
        }
        function clearSelection() {
            selectionState = null;
        }
        function setCommitOnBlur(value) {
            commitOnBlur = value;
        }
        function bindGlobalEvents() {
            if (bound)
                return;
            bound = true;
            doc.addEventListener('focusin', (event) => {
                if (isEditableElement(event.target))
                    setActive(true);
            });
            doc.addEventListener('pointerdown', () => {
                lastDocumentPointerDownAt = perf.now();
            }, true);
            doc.addEventListener('keydown', (event) => {
                if (isEditableElement(event.target) && event.key === 'Enter') {
                    commitOnBlur = true;
                    setTimeout(() => { commitOnBlur = false; }, 1000);
                }
            }, true);
            doc.addEventListener('selectionchange', () => {
                if (isEditableElement(doc.activeElement))
                    captureSelection();
            });
            doc.addEventListener('input', (event) => {
                if (isEditableElement(event.target))
                    captureSelection();
            });
            doc.addEventListener('focusout', (event) => {
                if (!isEditableElement(event.target))
                    return;
                captureSelection(event.target);
                releaseTimer = setTimeout(() => {
                    if (isLeavingBrowserWindow()) {
                        active = true;
                        return;
                    }
                    if (!doc.hidden && !isEditableElement(doc.activeElement)) {
                        active = false;
                    }
                }, 250);
            });
            win.addEventListener('blur', () => {
                if (isEditableElement(doc.activeElement)) {
                    captureSelection();
                    setActive(true);
                }
            });
            win.addEventListener('focus', () => {
                setTimeout(() => {
                    if (!doc.hidden && active)
                        restoreSelection();
                    if (!doc.hidden && !isEditableElement(doc.activeElement)) {
                        active = false;
                    }
                }, 250);
            });
        }
        return {
            bindGlobalEvents,
            isEditableElement,
            isEditing,
            setActive,
            shouldHoldOnBlur,
            captureSelection,
            restoreSelection,
            clearSelection,
            setCommitOnBlur
        };
    }
    function normalizeValue(value) {
        if (value == null)
            return '.';
        const normalized = String(value).trim();
        return (!normalized || normalized === '...') ? '.' : normalized;
    }
    function formatDisplay(field, value) {
        const normalized = normalizeValue(value);
        const hasValue = normalized !== '.';
        if (field === 'phone')
            return hasValue ? `📞 ${normalized}` : '📞 ...';
        if (field === 'email')
            return hasValue ? `✉ ${normalized}` : '✉ ...';
        if (field === 'wechat_nickname')
            return hasValue ? `@ ${normalized}` : '@ ...';
        return hasValue ? normalized : '...';
    }
    function syncEditableDom(ctx, accountId, field, value) {
        const display = formatDisplay(field, value);
        ctx.document.querySelectorAll(`.editable-field[data-account-id="${accountId}"][data-field="${field}"]`)
            .forEach(el => {
            if (ctx.document.activeElement === el)
                return;
            el.textContent = display;
            el.dataset.originalValue = normalizeValue(value);
        });
    }
    async function saveInlineEdit(ctx, element, accountId, field) {
        if (ctx.shouldHoldMXHInlineEditOnBlur()) {
            ctx.captureMXHInlineEditSelection(element);
            ctx.setMXHInlineEditActive(true);
            element.style.borderBottom = '1px dashed #007bff';
            return;
        }
        ctx.setMXHInlineEditActive(false);
        ctx.clearMXHInlineEditSelection();
        const newValue = element.textContent.trim();
        let cleanValue = newValue;
        if (field === 'phone') {
            cleanValue = newValue.replace(/^📞\s*/, '').replace(/\s/g, '');
        }
        else if (field === 'email') {
            cleanValue = newValue.replace(/^✉\s*/, '').trim();
        }
        else if (field === 'wechat_nickname') {
            cleanValue = newValue.replace(/^(@|🪐|📛)\s*/, '').trim();
        }
        const account = ctx.mxhAccounts.find(acc => acc.id === accountId);
        if (!account)
            return;
        const originalValue = account[field] || '.';
        if (!cleanValue || cleanValue === '...') {
            cleanValue = '.';
        }
        if (cleanValue === originalValue) {
            element.style.borderBottom = '1px dashed transparent';
            ctx.setMXHInlineEditActive(false);
            ctx.clearMXHInlineEditSelection();
            return;
        }
        const success = await quickUpdateField(ctx, accountId, field, cleanValue);
        if (success) {
            element.textContent = formatDisplay(field, cleanValue);
            syncEditableDom(ctx, accountId, field, cleanValue);
        }
        else {
            element.textContent = formatDisplay(field, originalValue);
            syncEditableDom(ctx, accountId, field, originalValue);
        }
        element.style.borderBottom = '1px dashed transparent';
        ctx.setMXHInlineEditActive(false);
        ctx.clearMXHInlineEditSelection();
        ctx.setMXHCommitInlineEditOnBlur(false);
    }
    async function quickUpdateField(ctx, accountId, field, value) {
        try {
            const accountIndex = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
            if (accountIndex === -1) {
                console.error(`Account ${accountId} not found`);
                return false;
            }
            const oldValue = ctx.mxhAccounts[accountIndex][field];
            const cardId = Number(ctx.mxhAccounts[accountIndex].card_id);
            ctx.mxhAccounts[accountIndex][field] = value;
            ctx.setCardState(cardId, { activeAccountId: accountId }, true);
            console.log(`🔧 Inline Edit (before API): Set card ${cardId} to show account ${accountId}`);
            const response = await ctx.MXHApi.updateAccount(accountId, { [field]: value });
            if (response.ok) {
                const idx = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
                if (idx !== -1) {
                    const normalizedCardId = Number(ctx.mxhAccounts[idx].card_id);
                    const updatedAccount = await response.json();
                    updatedAccount.card_id = normalizedCardId;
                    ctx.mxhAccounts[idx] = updatedAccount;
                    syncEditableDom(ctx, accountId, field, updatedAccount[field]);
                    const heavyFields = new Set(['status', 'muted_until', 'wechat_status', 'die_date', 'disabled_date', 'card_name']);
                    if (heavyFields.has(field)) {
                        ctx.setCardState(normalizedCardId, { activeAccountId: accountId }, true);
                        if (field === 'card_name') {
                            await ctx.loadMXHData(true);
                            setTimeout(() => {
                                const targetCardCol = ctx.document.getElementById(`col-card-${normalizedCardId}`);
                                if (targetCardCol) {
                                    targetCardCol.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    const cardInner = targetCardCol.querySelector('.mxh-card');
                                    if (cardInner) {
                                        const originalShadow = cardInner.style.boxShadow;
                                        cardInner.style.boxShadow = '0 0 15px 5px rgba(22, 119, 255, 0.6)';
                                        setTimeout(() => { cardInner.style.boxShadow = originalShadow; }, 2000);
                                    }
                                }
                            }, 500);
                        }
                        else {
                            ctx.scheduleRender();
                        }
                    }
                }
                const label = (field === 'username') ? 'tên' : (field === 'phone') ? 'SĐT' : (field === 'email') ? 'email' : (field === 'wechat_nickname') ? 'nickname' : (field === 'card_name') ? 'vị trí card' : field;
                ctx.showToast(`✅ Đã lưu ${label}!`, 'success');
                return true;
            }
            ctx.mxhAccounts[accountIndex][field] = oldValue;
            const error = await response.json();
            ctx.showToast(error.error || 'Lỗi khi cập nhật!', 'error');
            ctx.scheduleRender();
            return false;
        }
        catch (error) {
            console.error('Error in quickUpdateField:', error);
            ctx.showToast('Lỗi kết nối!', 'error');
            await ctx.loadMXHData(false);
            return false;
        }
    }
    function setupEditableFields(ctx) {
        const editableFields = ctx.document.querySelectorAll('.editable-field');
        editableFields.forEach(field => {
            field.dataset.originalValue = field.textContent.trim();
            field.addEventListener('keydown', async (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    field.blur();
                }
            });
            field.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    field.textContent = field.dataset.originalValue;
                    field.blur();
                }
            });
            field.addEventListener('blur', async (event) => {
                if (ctx.shouldHoldMXHInlineEditOnBlur()) {
                    ctx.captureMXHInlineEditSelection(event.target);
                    ctx.setMXHInlineEditActive(true);
                    event.target.style.borderBottom = '1px dashed #007bff';
                    return;
                }
                ctx.setMXHInlineEditActive(false);
                ctx.clearMXHInlineEditSelection();
                let newValue = event.target.textContent.trim();
                const accountId = parseInt(event.target.dataset.accountId);
                const fieldName = event.target.dataset.field;
                if (fieldName === 'phone') {
                    newValue = newValue.replace(/^📞\s*/, '').trim();
                }
                const isNoChange = newValue === field.dataset.originalValue ||
                    (newValue === '' && field.dataset.originalValue === '.') ||
                    (newValue === 'Click để nhập' && field.dataset.originalValue === '');
                if (isNoChange) {
                    if (fieldName === 'phone') {
                        event.target.textContent = field.dataset.originalValue ? `📞 ${field.dataset.originalValue}` : '📞 Click để nhập';
                    }
                    else {
                        event.target.textContent = field.dataset.originalValue || 'Click để nhập';
                    }
                    return;
                }
                if (newValue === 'Click để nhập') {
                    newValue = '.';
                }
                const success = await quickUpdateField(ctx, accountId, fieldName, newValue);
                if (success) {
                    field.dataset.originalValue = newValue;
                    if (fieldName === 'phone') {
                        event.target.textContent = `📞 ${newValue}`;
                    }
                }
                else if (fieldName === 'phone') {
                    event.target.textContent = field.dataset.originalValue ? `📞 ${field.dataset.originalValue}` : '📞 Click để nhập';
                }
                else {
                    event.target.textContent = field.dataset.originalValue || 'Click để nhập';
                }
            });
            field.addEventListener('focus', (event) => {
                if (event.target.dataset.field === 'phone') {
                    const phone = event.target.textContent.replace(/^📞\s*/, '').replace('Click để nhập', '').trim();
                    event.target.textContent = phone;
                }
                else if (event.target.textContent.trim() === 'Click để nhập') {
                    event.target.textContent = '';
                }
                setTimeout(() => {
                    const range = ctx.document.createRange();
                    range.selectNodeContents(event.target);
                    const selection = ctx.window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                }, 0);
            });
        });
    }
    window.MXHInlineEdit = {
        createRuntime,
        normalizeValue,
        formatDisplay,
        syncEditableDom,
        saveInlineEdit,
        quickUpdateField,
        setupEditableFields
    };
})();
