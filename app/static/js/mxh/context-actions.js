"use strict";
// MXH context menu action dispatcher. Classic global wrapper, no ES modules yet.
(function () {
    function hideCardMenu(ctx) {
        window.MXHContextMenu.hideCardContextMenu(ctx);
    }
    async function handleContextAction(ctx, event) {
        const menuItem = event.target.closest('.mxh-menu-item[data-action]');
        if (!menuItem)
            return;
        if (menuItem.closest('#mxh-background-context-menu'))
            return;
        event.preventDefault();
        event.stopPropagation();
        const action = menuItem.getAttribute('data-action');
        const accountId = ctx.currentContextAccountId;
        const cardId = ctx.currentContextCardId;
        if (action === 'switch-account') {
            const targetAccountId = parseInt(menuItem.getAttribute('data-account-id'), 10);
            if (cardId && targetAccountId) {
                ctx.flipCardToAccount(cardId, targetAccountId);
                hideCardMenu(ctx);
            }
        }
        else if (action === 'add-sub-shelter') {
            if (cardId) {
                await window.MXHAccountActions.createSubAccount(cardId, 'shelter');
                hideCardMenu(ctx);
            }
        }
        else if (action === 'add-sub-security-folder') {
            if (cardId) {
                await window.MXHAccountActions.createSubAccount(cardId, 'security_folder');
                hideCardMenu(ctx);
            }
        }
        else if (action === 'add-sub-multi-user') {
            if (cardId) {
                await window.MXHAccountActions.createSubAccount(cardId, 'multi_user');
                hideCardMenu(ctx);
            }
        }
        else if (action === 'add-sub-clone-app') {
            if (cardId) {
                await window.MXHAccountActions.createSubAccount(cardId, 'clone_app');
                hideCardMenu(ctx);
            }
        }
        else if (action === 'status-active') {
            if (accountId) {
                await window.MXHAccountActions.updateAccountStatusNew(accountId, 'active');
                hideCardMenu(ctx);
            }
        }
        else if (action === 'status-disabled') {
            if (accountId) {
                await window.MXHAccountActions.updateAccountStatusNew(accountId, 'disabled');
                hideCardMenu(ctx);
            }
        }
        else if (action === 'status-unverify') {
            if (accountId) {
                await window.MXHAccountActions.updateWechatVerifyStatus(accountId, 'unverified');
                hideCardMenu(ctx);
            }
        }
        else if (action === 'status-verify-success') {
            if (accountId) {
                await window.MXHAccountActions.updateWechatVerifyStatus(accountId, null);
                hideCardMenu(ctx);
            }
        }
        else if (action === 'rescue-success' || action === 'rescue-failed') {
            if (accountId) {
                const result = action === 'rescue-success' ? 'success' : 'failed';
                await window.MXHAccountActions.rescueAccountAction(accountId, result);
                hideCardMenu(ctx);
            }
        }
        else if (action === 'scan-wechat') {
            if (accountId) {
                await window.MXHAccountActions.scanWeChatAccount(accountId);
                hideCardMenu(ctx);
            }
        }
        else if (action === 'reset-scan') {
            if (accountId) {
                await window.MXHAccountActions.resetScanCountNew(accountId);
                hideCardMenu(ctx);
            }
        }
        else if (action === 'scan-history') {
            if (accountId) {
                ctx.openScanHistoryModal(accountId);
                hideCardMenu(ctx);
            }
        }
        else if (action === 'delete') {
            const account = ctx.mxhAccounts.find(acc => acc.id === accountId);
            if (account && account.is_primary) {
                if (cardId) {
                    await window.MXHAccountActions.deleteCard(cardId);
                    hideCardMenu(ctx);
                }
            }
            else if (accountId) {
                await window.MXHAccountActions.deleteSubAccount(accountId);
                hideCardMenu(ctx);
            }
        }
        else if (action === 'edit') {
            if (accountId) {
                window.MXHAccountActions.openAccountModalForEdit(accountId);
                hideCardMenu(ctx);
            }
        }
        else if (action === 'copy-phone') {
            const account = ctx.mxhAccounts.find(acc => acc.id === accountId);
            if (account && account.phone) {
                ctx.navigator.clipboard.writeText(account.phone);
                ctx.showToast(`Đã copy: ${account.phone}`, 'success');
            }
            hideCardMenu(ctx);
        }
        else if (action === 'nearby-active') {
            if (accountId) {
                await ctx.handleNearbyAction(accountId, 'active');
            }
            hideCardMenu(ctx);
        }
        else if (action === 'toggle-notice') {
            if (accountId) {
                window.MXHAccountActions.openNoticeModal(null);
                hideCardMenu(ctx);
            }
        }
        else if (action === 'cancel-notice') {
            if (accountId) {
                await window.MXHAccountActions.cancelNotice(accountId);
                hideCardMenu(ctx);
            }
        }
        else if (action === 'move-account') {
            if (accountId) {
                window.MXHAccountActions.openMoveAccountModal(accountId);
                hideCardMenu(ctx);
            }
        }
    }
    function bind(ctx) {
        const doc = ctx.document || document;
        if (doc.documentElement?.dataset.mxhContextActionsBound)
            return;
        if (doc.documentElement)
            doc.documentElement.dataset.mxhContextActionsBound = '1';
        doc.addEventListener('click', (event) => handleContextAction(ctx, event));
    }
    window.MXHContextActions = {
        bind,
        handleContextAction
    };
})();
