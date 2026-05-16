"use strict";
// MXH state helpers.
// Kept as a classic global wrapper for now so the large legacy script can be
// reduced gradually before moving to real ES modules / TypeScript.
(function () {
    const cardStates = new Map();
    const lockedStates = new Map();
    let forceFullRebuildOnce = false;
    function normalizeCardId(cardId) {
        return Number(cardId);
    }
    function getCardState(cardId) {
        const key = normalizeCardId(cardId);
        if (!cardStates.has(key)) {
            cardStates.set(key, { activeAccountId: null, isFlipped: false });
        }
        const raw = cardStates.get(key);
        if (lockedStates.has(key)) {
            return { ...raw, activeAccountId: lockedStates.get(key) };
        }
        return raw;
    }
    function setCardState(cardId, updates, lock = false) {
        const key = normalizeCardId(cardId);
        if (lockedStates.has(key))
            return;
        const state = getCardState(key);
        Object.assign(state, updates);
        cardStates.set(key, state);
        if (lock && updates.activeAccountId != null) {
            lockedStates.set(key, updates.activeAccountId);
            setTimeout(() => lockedStates.delete(key), 2000);
        }
    }
    function deleteCardState(cardId) {
        cardStates.delete(normalizeCardId(cardId));
    }
    function clearCardActiveAccounts() {
        cardStates.forEach(state => {
            state.activeAccountId = null;
        });
    }
    function requestFullRebuild() {
        forceFullRebuildOnce = true;
    }
    function consumeFullRebuild() {
        const shouldRebuild = forceFullRebuildOnce;
        forceFullRebuildOnce = false;
        return shouldRebuild;
    }
    window.MXHState = {
        getCardState,
        setCardState,
        deleteCardState,
        clearCardActiveAccounts,
        requestFullRebuild,
        consumeFullRebuild
    };
})();
