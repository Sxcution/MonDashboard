// MXH card flip animation helpers. Classic global wrapper, no ES modules yet.
(function () {
    function flipCardToAccount(ctx, cardId, accountId) {
        const doc = ctx.document || document;
        const state = ctx.getCardState(cardId);
        const wrapper = doc.getElementById(`card-wrapper-${cardId}`);
        const cardInner = wrapper?.querySelector('.mxh-card-inner');
        if (!wrapper || !cardInner) return;

        if (state.activeAccountId === accountId) {
            return;
        }

        const accounts = ctx.mxhAccounts.filter(acc => Number(acc.card_id) === Number(cardId));
        const newActiveAccount = accounts.find(acc => acc.id === accountId);
        if (!newActiveAccount) return;

        ctx.setCardState(cardId, { activeAccountId: accountId });
        cardInner.style.transform = 'rotateY(90deg)';

        setTimeout(() => {
            cardInner.innerHTML = ctx.renderCardFace(newActiveAccount, accounts, 'front');
            ctx.applyMXHDynamicStyles(cardInner);

            cardInner.style.transform = 'rotateY(-90deg)';
            void cardInner.offsetWidth;

            cardInner.style.transition = 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
            cardInner.style.transform = 'rotateY(0deg)';
        }, 300);
    }

    window.MXHFlipCard = {
        flipCardToAccount
    };
})();
