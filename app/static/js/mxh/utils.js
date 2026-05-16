"use strict";
// MXH pure utility helpers.
(function () {
    function areGroupsEqual(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }
    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    function throttle(func, interval) {
        let lastCall = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastCall >= interval) {
                lastCall = now;
                func.apply(this, args);
            }
        };
    }
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return String(text).replace(/[&<>"']/g, char => map[char]);
    }
    function getPlatformColor(platform) {
        const colors = {
            facebook: '#1877f2',
            instagram: '#e4405f',
            twitter: '#1da1f2',
            zalo: '#0068ff',
            wechat: '#07c160',
            telegram: '#0088cc',
            whatsapp: '#25d366'
        };
        return colors[platform] || '#6c757d';
    }
    function getPlatformIconClass(platform) {
        const p = String(platform || '').toLowerCase();
        return ({
            wechat: 'bi-wechat',
            telegram: 'bi-telegram',
            facebook: 'bi-facebook',
            instagram: 'bi-instagram',
            zalo: 'bi-chat-dots-fill',
            twitter: 'bi-twitter',
            whatsapp: 'bi-whatsapp'
        }[p]) || 'bi-person-badge';
    }
    function getContainerTypeIcon(containerType) {
        return ({
            shelter: 'bi-shield-shaded',
            security_folder: 'bi-file-earmark-lock',
            clone_app: 'bi-copy',
            multi_user: 'bi-people'
        }[containerType]) || 'bi-people';
    }
    function getContainerTypeColorClass(containerType) {
        return ({
            shelter: 'mxh-menu-icon-shelter',
            security_folder: 'mxh-menu-icon-security-folder',
            clone_app: 'mxh-menu-icon-clone-app',
            multi_user: 'mxh-menu-icon-multi-user'
        }[containerType]) || 'mxh-menu-icon-multi-user';
    }
    function getContainerTypeTitle(containerType) {
        return ({
            shelter: 'Shelter',
            security_folder: 'Security Folder',
            clone_app: 'Clone App',
            multi_user: 'Multi User'
        }[containerType]) || 'Multi User';
    }
    window.MXHUtils = {
        areGroupsEqual,
        debounce,
        throttle,
        escapeHtml,
        getPlatformColor,
        getPlatformIconClass,
        getContainerTypeIcon,
        getContainerTypeColorClass,
        getContainerTypeTitle
    };
})();
