const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('messengerApp', {
  onNotificationClick: () => ipcRenderer.send('notification-click'),
  toggleDarkMode: () => ipcRenderer.send('toggle-dark-mode'),
  toggleAlwaysOnTop: () => ipcRenderer.send('toggle-always-on-top'),
  reloadPage: () => ipcRenderer.send('reload-page'),
  zoomIn: () => ipcRenderer.send('zoom-in'),
  zoomOut: () => ipcRenderer.send('zoom-out'),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
});

// ============================================================
// 1. Chặn Zalo / WhatsApp phát hiện tab đang bị ẩn
//    → Giữ cho MutationObserver + WebSocket luôn hoạt động
// ============================================================
Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);

// ============================================================
// 2. MutationObserver — Lắng nghe badge thay đổi realtime
//    Gửi IPC 'update-red-dot' về main process khi count thay đổi
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  let lastCount = -1;

  const sendCount = (count) => {
    if (count !== lastCount) {
      lastCount = count;
      ipcRenderer.send('update-red-dot', count);
    }
  };

  const getBadgeCount = () => {
    let count = 0;

    if (window.location.hostname.includes('zalo.me')) {
      // --- Zalo: quét class có chứa "unread" / "badge" / "count" ---
      const badges = document.querySelectorAll('[class*="unread"], [class*="badge"], [class*="count"]');
      for (const badge of badges) {
        if (badge.children.length > 0) continue;
        const text = badge.textContent.trim();
        if (/^\d+\+?$/.test(text)) {
          const num = parseInt(text, 10);
          if (num > 0 && num < 1000) count += num;
        }
      }

      // --- Zalo: auto-click nút "Kích hoạt" nếu bị ngắt session ---
      const btns = document.querySelectorAll('button, div, span, a');
      for (const btn of btns) {
        if (btn.textContent && btn.textContent.trim() === 'Kích hoạt' && btn.offsetParent !== null) {
          btn.click();
          break;
        }
      }
    } else {
      // --- WhatsApp / other: đọc từ document.title "(N) WhatsApp" ---
      const match = (document.title || '').match(/\((\d+)\)/);
      if (match) count = parseInt(match[1], 10);
    }

    return count;
  };

  // Quan sát toàn bộ DOM để bắt mọi thay đổi (badge, title, class)
  const observer = new MutationObserver(() => {
    sendCount(getBadgeCount());
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'data-count', 'aria-label'],
  });

  // Kiểm tra ngay khi trang load xong (phòng trường hợp DOMContentLoaded fire trễ)
  sendCount(getBadgeCount());

  // Fallback: kiểm tra mỗi 5 giây phòng observer bị miss
  setInterval(() => sendCount(getBadgeCount()), 5000);
});
