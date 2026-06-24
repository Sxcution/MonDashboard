const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('messengerApp', {
  onNotificationClick: () => ipcRenderer.send('notification-click'),
  toggleDarkMode: () => ipcRenderer.send('toggle-dark-mode'),
  toggleAlwaysOnTop: () => ipcRenderer.send('toggle-always-on-top'),
  reloadPage: () => ipcRenderer.send('reload-page'),
  zoomIn: () => ipcRenderer.send('zoom-in'),
  zoomOut: () => ipcRenderer.send('zoom-out'),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
});

function installWebNotificationClickBridge() {
  const script = `
    (() => {
      if (window.__zepLaoNotificationBridgeInstalled) return;
      window.__zepLaoNotificationBridgeInstalled = true;

      const OriginalNotification = window.Notification;
      if (typeof OriginalNotification !== 'function') return;

      function WrappedNotification(title, options) {
        const notification = new OriginalNotification(title, options);
        notification.addEventListener('click', () => {
          try {
            if (window.messengerApp && typeof window.messengerApp.onNotificationClick === 'function') {
              window.messengerApp.onNotificationClick();
            }
          } catch (_) { }
        });
        return notification;
      }

      WrappedNotification.prototype = OriginalNotification.prototype;
      Object.setPrototypeOf(WrappedNotification, OriginalNotification);
      Object.defineProperty(WrappedNotification, 'permission', {
        configurable: true,
        get: () => OriginalNotification.permission,
      });
      WrappedNotification.requestPermission = (...args) => OriginalNotification.requestPermission(...args);

      window.Notification = WrappedNotification;
    })();
  `;

  webFrame.executeJavaScript(script, false).catch(() => { });
}

installWebNotificationClickBridge();

try {
  Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
  Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
  document.addEventListener('visibilitychange', (event) => event.stopImmediatePropagation(), true);
} catch (_) { }

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function parseRgb(color) {
  const match = String(color || '').match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
  };
}

function isRedLike(color) {
  const rgb = parseRgb(color);
  if (!rgb) return false;
  return rgb.r >= 170 &&
    rgb.g <= 135 &&
    rgb.b <= 135 &&
    rgb.r > rgb.g * 1.35 &&
    rgb.r > rgb.b * 1.35;
}

function hasRedCssValue(value) {
  const matches = String(value || '').matchAll(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/ig);
  for (const match of matches) {
    if (isRedLike(`rgb(${match[1]}, ${match[2]}, ${match[3]})`)) return true;
  }
  return false;
}

function cleanText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').trim();
}

function getBadgeNumber(text) {
  const match = cleanText(text).match(/^(\d{1,3})\+?$/);
  if (!match) return 0;

  const number = parseInt(match[1], 10);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function px(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function maxBorderRadius(style) {
  return Math.max(
    px(style.borderTopLeftRadius),
    px(style.borderTopRightRadius),
    px(style.borderBottomRightRadius),
    px(style.borderBottomLeftRadius)
  );
}

function isVisibleElement(element, rect) {
  if (!element || !(element instanceof Element)) return false;

  const box = rect || element.getBoundingClientRect();
  if (!box || box.width <= 0 || box.height <= 0) return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  if (px(style.opacity) <= 0.05) return false;

  return true;
}

function hasRedBadgePaint(style, element) {
  if (isRedLike(style.backgroundColor) || isRedLike(style.borderColor)) return true;
  if (isRedLike(style.borderTopColor) || isRedLike(style.borderRightColor)) return true;
  if (isRedLike(style.borderBottomColor) || isRedLike(style.borderLeftColor)) return true;
  if (hasRedCssValue(style.backgroundImage) || hasRedCssValue(style.boxShadow)) return true;

  try {
    const before = window.getComputedStyle(element, '::before');
    const after = window.getComputedStyle(element, '::after');
    return isRedLike(before.backgroundColor) ||
      isRedLike(before.borderColor) ||
      hasRedCssValue(before.backgroundImage) ||
      hasRedCssValue(before.boxShadow) ||
      isRedLike(after.backgroundColor) ||
      isRedLike(after.borderColor) ||
      hasRedCssValue(after.backgroundImage) ||
      hasRedCssValue(after.boxShadow);
  } catch (_) {
    return false;
  }
}

function looksLikeBadgeBox(element, hasNumber) {
  const rect = element.getBoundingClientRect();
  if (!isVisibleElement(element, rect)) return false;

  const style = window.getComputedStyle(element);
  if (!hasRedBadgePaint(style, element)) return false;

  const ratio = rect.width / Math.max(rect.height, 1);
  const radius = maxBorderRadius(style);
  const isRounded = radius >= 4 || radius >= Math.min(rect.width, rect.height) * 0.3;

  if (hasNumber) {
    return rect.width >= 10 &&
      rect.width <= 48 &&
      rect.height >= 10 &&
      rect.height <= 32 &&
      ratio >= 0.65 &&
      ratio <= 3.8 &&
      isRounded;
  }

  return rect.width >= 4 &&
    rect.width <= 22 &&
    rect.height >= 4 &&
    rect.height <= 22 &&
    ratio >= 0.55 &&
    ratio <= 1.8 &&
    isRounded;
}

function closestBadgeBox(element, hasNumber) {
  let current = element;
  for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
    if (!(current instanceof Element)) break;

    if (hasNumber && !getBadgeNumber(current.textContent)) continue;
    if (!hasNumber && cleanText(current.textContent) !== '') continue;

    if (looksLikeBadgeBox(current, hasNumber)) {
      return current;
    }
  }

  return null;
}

function rectOverlapRatio(a, b) {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const overlap = width * height;
  if (overlap <= 0) return 0;

  const areaA = Math.max(a.width * a.height, 1);
  const areaB = Math.max(b.width * b.height, 1);
  return overlap / Math.min(areaA, areaB);
}

function addBadgeOnce(badges, element, value) {
  const rect = element.getBoundingClientRect();
  if (badges.some((badge) => badge.element === element || rectOverlapRatio(badge.rect, rect) > 0.65)) {
    return;
  }

  badges.push({ element, rect, value });
}

function scanZaloUnreadBadges() {
  const badges = [];
  const selector = 'div,span,b,strong,em,i,p,label';
  const elements = Array.from(document.querySelectorAll(selector));

  for (const element of elements) {
    const value = getBadgeNumber(element.textContent);
    if (!value) continue;

    const badgeBox = closestBadgeBox(element, true);
    if (badgeBox) {
      addBadgeOnce(badges, badgeBox, value);
    }
  }

  for (const element of elements) {
    if (cleanText(element.textContent) !== '') continue;

    const badgeBox = closestBadgeBox(element, false);
    if (badgeBox) {
      addBadgeOnce(badges, badgeBox, 1);
    }
  }

  return badges.reduce((total, badge) => total + badge.value, 0);
}

let lastBadgeCount = -1;
let lastBadgeScanAt = 0;
let pendingBadgeScanTimer = null;

const MIN_BADGE_SCAN_INTERVAL_MS = 3000;
const PERIODIC_BADGE_SCAN_INTERVAL_MS = 15000;

function sendZaloBadgeCount() {
  lastBadgeScanAt = Date.now();
  const currentCount = scanZaloUnreadBadges();
  if (currentCount === lastBadgeCount) return;

  lastBadgeCount = currentCount;
  ipcRenderer.send('update-red-dot', currentCount);
}

function startPopupSolver() {
  let retryCount = 0;
  const maxRetries = 12;
  const popupLabels = [
    'K\u00edch ho\u1ea1t',
    'Cho ph\u00e9p',
    'S\u1eed d\u1ee5ng Zalo PC',
    'T\u1ea3i ngay',
  ];

  const popupSolverInterval = setInterval(() => {
    retryCount += 1;
    const buttons = document.querySelectorAll('button, .btn, .z-button, .dialog-button, a');
    for (const btn of buttons) {
      const label = cleanText(btn.textContent);
      if (popupLabels.some((popupLabel) => label === popupLabel || label.includes(popupLabel))) {
        btn.click();
        clearInterval(popupSolverInterval);
        return;
      }
    }

    if (retryCount >= maxRetries) {
      clearInterval(popupSolverInterval);
    }
  }, 10000);
}

function startZaloUnreadObserver() {
  const isZalo = window.location.hostname.includes('zalo.me');
  if (!isZalo) return;

  const runScan = () => {
    pendingBadgeScanTimer = null;
    window.requestAnimationFrame(sendZaloBadgeCount);
  };

  const scheduleScan = debounce(() => {
    const elapsed = Date.now() - lastBadgeScanAt;
    if (elapsed >= MIN_BADGE_SCAN_INTERVAL_MS) {
      runScan();
      return;
    }

    if (!pendingBadgeScanTimer) {
      pendingBadgeScanTimer = setTimeout(runScan, MIN_BADGE_SCAN_INTERVAL_MS - elapsed);
    }
  }, 900);

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      'aria-label',
      'class',
      'data-badge',
      'data-count',
      'data-unread',
      'style',
      'title',
    ],
  });

  window.addEventListener('focus', scheduleScan, true);
  window.addEventListener('pageshow', scheduleScan, true);
  window.addEventListener('resize', scheduleScan, true);
  document.addEventListener('visibilitychange', scheduleScan, true);

  setInterval(scheduleScan, PERIODIC_BADGE_SCAN_INTERVAL_MS);
  [0, 1500, 5000].forEach((delay) => setTimeout(scheduleScan, delay));
}

function start() {
  startPopupSolver();
  startZaloUnreadObserver();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
