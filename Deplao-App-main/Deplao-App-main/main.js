// ============================================================
//  Ứng dụng Zalo Desktop
//  Nhân: Chromium (Google Chrome)
//  Tác giả: Nguyễn Đình Thọ
// ============================================================

const {
  app,
  BrowserWindow,
  BrowserView,
  shell,
  session,
  Menu,
  MenuItem,
  Tray,
  globalShortcut,
  ipcMain,
  Notification,
  nativeImage,
  nativeTheme,
  dialog,
} = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// ============================================================
//  CẤU HÌNH CHUNG
// ============================================================
const ZALO_URL = 'https://chat.zalo.me';
const APP_ID = 'com.zalo.desktop';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// ============================================================
//  CHỐNG CHẠY TRÙNG LẶP (Single Instance Lock)
// ============================================================
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}

// ============================================================
//  HỆ THỐNG LƯU CÀI ĐẶT
// ============================================================
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

const DEFAULT_SETTINGS = {
  windowBounds: { width: 1200, height: 800 },
  startMinimized: false,
  autoLaunch: false,
  minimizeToTray: true,
  globalHotkey: 'Ctrl+Shift+M',
  currentTheme: 'default',
  isDarkMode: true,
  alwaysOnTop: false,
  blockSeen: false,
  blockTyping: false,
};

function loadSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(data) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) { }
}

// ============================================================
//  BIẾN TOÀN CỤC
// ============================================================
let mainWindow = null;
let tray = null;
let settings = loadSettings();
let isQuitting = false;
let unreadCount = 0;

let browserViews = {}; // { profileId: BrowserView }
let activeProfileId = null;

const badgeStateByProfile = new Map(); // profileId -> { titleCount, domCount, mergedCount }
const profileMetaById = new Map(); // profileId -> { name, platform }

function ensureBadgeState(profileId) {
  if (!badgeStateByProfile.has(profileId)) {
    badgeStateByProfile.set(profileId, {
      titleCount: 0,
      domCount: 0,
      mergedCount: 0,
      hasPublished: false,
      lastDomUpdateAt: 0,
    });
  }
  return badgeStateByProfile.get(profileId);
}

function parseTitleBadgeCount(title = '') {
  const match = String(title).match(/\((\d+)\+?\)/);
  return match ? parseInt(match[1], 10) : 0;
}

function findProfileIdBySender(sender) {
  for (const [profileId, view] of Object.entries(browserViews)) {
    if (view && !view.webContents.isDestroyed() && view.webContents.id === sender.id) {
      return profileId;
    }
  }
  return null;
}

function rememberProfile(profile) {
  if (!profile || !profile.id) return;
  profileMetaById.set(profile.id, {
    name: profile.name || 'ZepLao',
    platform: profile.platform || 'zalo',
    url: profile.url,
  });
}

function sumMergedBadgeCounts() {
  let total = 0;
  for (const state of badgeStateByProfile.values()) {
    total += state.mergedCount || 0;
  }
  return total;
}

function refreshGlobalUnreadBadge() {
  const previousTotal = unreadCount;
  unreadCount = sumMergedBadgeCounts();

  if (unreadCount !== previousTotal) {
    updateBadge(unreadCount);

    if (unreadCount > previousTotal && mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
      mainWindow.flashFrame(true);
    }
  }
}

function publishProfileBadge(profileId) {
  const state = ensureBadgeState(profileId);
  const previousMerged = state.mergedCount || 0;
  const hadPublished = state.hasPublished;
  const nextMerged = Math.max(state.titleCount || 0, state.domCount || 0);
  const profileChanged = state.mergedCount !== nextMerged;

  state.mergedCount = nextMerged;
  state.hasPublished = true;

  if (profileChanged && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-profile-badge', {
      id: profileId,
      count: nextMerged,
    });
  }

  if (hadPublished && nextMerged > previousMerged) {
    showUnreadNotification(profileId, nextMerged);
  }

  refreshGlobalUnreadBadge();
}

function updateProfileDomBadge(profileId, count) {
  const state = ensureBadgeState(profileId);
  state.domCount = Math.max(0, Number(count) || 0);
  state.lastDomUpdateAt = Date.now();
  publishProfileBadge(profileId);
}

const ZALO_UNREAD_SCAN_SCRIPT = String.raw`
(() => {
  const cleanText = (value) => String(value || '').replace(/\u00a0/g, ' ').trim();
  const getBadgeNumber = (text) => {
    const match = cleanText(text).match(/^(\d{1,3})\+?$/);
    if (!match) return 0;
    const number = parseInt(match[1], 10);
    return Number.isFinite(number) && number > 0 ? number : 0;
  };
  const parseRgb = (color) => {
    const match = String(color || '').match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return null;
    return { r: parseInt(match[1], 10), g: parseInt(match[2], 10), b: parseInt(match[3], 10) };
  };
  const isRedLike = (color) => {
    const rgb = parseRgb(color);
    if (!rgb) return false;
    return rgb.r >= 170 && rgb.g <= 135 && rgb.b <= 135 && rgb.r > rgb.g * 1.35 && rgb.r > rgb.b * 1.35;
  };
  const hasRedCssValue = (value) => {
    const matches = String(value || '').matchAll(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/ig);
    for (const match of matches) {
      if (isRedLike('rgb(' + match[1] + ', ' + match[2] + ', ' + match[3] + ')')) return true;
    }
    return false;
  };
  const px = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const maxBorderRadius = (style) => Math.max(
    px(style.borderTopLeftRadius),
    px(style.borderTopRightRadius),
    px(style.borderBottomRightRadius),
    px(style.borderBottomLeftRadius)
  );
  const isVisibleElement = (element, rect) => {
    const box = rect || element.getBoundingClientRect();
    if (!box || box.width <= 0 || box.height <= 0) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (px(style.opacity) <= 0.05) return false;
    return true;
  };
  const hasRedBadgePaint = (style, element) => {
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
  };
  const looksLikeBadgeBox = (element, hasNumber) => {
    const rect = element.getBoundingClientRect();
    if (!isVisibleElement(element, rect)) return false;
    const style = window.getComputedStyle(element);
    if (!hasRedBadgePaint(style, element)) return false;
    const ratio = rect.width / Math.max(rect.height, 1);
    const radius = maxBorderRadius(style);
    const isRounded = radius >= 4 || radius >= Math.min(rect.width, rect.height) * 0.3;
    if (hasNumber) {
      return rect.width >= 10 && rect.width <= 48 && rect.height >= 10 && rect.height <= 32 &&
        ratio >= 0.65 && ratio <= 3.8 && isRounded;
    }
    return rect.width >= 4 && rect.width <= 22 && rect.height >= 4 && rect.height <= 22 &&
      ratio >= 0.55 && ratio <= 1.8 && isRounded;
  };
  const closestBadgeBox = (element, hasNumber) => {
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
      if (hasNumber && !getBadgeNumber(current.textContent)) continue;
      if (!hasNumber && cleanText(current.textContent) !== '') continue;
      if (looksLikeBadgeBox(current, hasNumber)) return current;
    }
    return null;
  };
  const rectOverlapRatio = (a, b) => {
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.right, b.right);
    const bottom = Math.min(a.bottom, b.bottom);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    const overlap = width * height;
    if (overlap <= 0) return 0;
    return overlap / Math.min(Math.max(a.width * a.height, 1), Math.max(b.width * b.height, 1));
  };
  const addBadgeOnce = (badges, element, value) => {
    const rect = element.getBoundingClientRect();
    if (badges.some((badge) => badge.element === element || rectOverlapRatio(badge.rect, rect) > 0.65)) return;
    badges.push({ element, rect, value });
  };
  const badges = [];
  const elements = Array.from(document.querySelectorAll('div,span,b,strong,em,i,p,label'));
  for (const element of elements) {
    const value = getBadgeNumber(element.textContent);
    if (!value) continue;
    const badgeBox = closestBadgeBox(element, true);
    if (badgeBox) addBadgeOnce(badges, badgeBox, value);
  }
  for (const element of elements) {
    if (cleanText(element.textContent) !== '') continue;
    const badgeBox = closestBadgeBox(element, false);
    if (badgeBox) addBadgeOnce(badges, badgeBox, 1);
  }
  return badges.reduce((total, badge) => total + badge.value, 0);
})()
`;

const ZALO_OPEN_FIRST_UNREAD_SCRIPT = String.raw`
(() => {
  const cleanText = (value) => String(value || '').replace(/\u00a0/g, ' ').trim();
  const getBadgeNumber = (text) => {
    const match = cleanText(text).match(/^(\d{1,3})\+?$/);
    if (!match) return 0;
    const number = parseInt(match[1], 10);
    return Number.isFinite(number) && number > 0 ? number : 0;
  };
  const parseRgb = (color) => {
    const match = String(color || '').match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return null;
    return { r: parseInt(match[1], 10), g: parseInt(match[2], 10), b: parseInt(match[3], 10) };
  };
  const isRedLike = (color) => {
    const rgb = parseRgb(color);
    if (!rgb) return false;
    return rgb.r >= 170 && rgb.g <= 135 && rgb.b <= 135 && rgb.r > rgb.g * 1.35 && rgb.r > rgb.b * 1.35;
  };
  const hasRedCssValue = (value) => {
    const matches = String(value || '').matchAll(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/ig);
    for (const match of matches) {
      if (isRedLike('rgb(' + match[1] + ', ' + match[2] + ', ' + match[3] + ')')) return true;
    }
    return false;
  };
  const px = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const maxBorderRadius = (style) => Math.max(
    px(style.borderTopLeftRadius),
    px(style.borderTopRightRadius),
    px(style.borderBottomRightRadius),
    px(style.borderBottomLeftRadius)
  );
  const isVisibleElement = (element, rect) => {
    const box = rect || element.getBoundingClientRect();
    if (!box || box.width <= 0 || box.height <= 0) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (px(style.opacity) <= 0.05) return false;
    return true;
  };
  const hasRedBadgePaint = (style, element) => {
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
  };
  const looksLikeBadgeBox = (element, hasNumber) => {
    const rect = element.getBoundingClientRect();
    if (!isVisibleElement(element, rect)) return false;
    const style = window.getComputedStyle(element);
    if (!hasRedBadgePaint(style, element)) return false;
    const ratio = rect.width / Math.max(rect.height, 1);
    const radius = maxBorderRadius(style);
    const isRounded = radius >= 4 || radius >= Math.min(rect.width, rect.height) * 0.3;
    if (hasNumber) {
      return rect.width >= 10 && rect.width <= 48 && rect.height >= 10 && rect.height <= 32 &&
        ratio >= 0.65 && ratio <= 3.8 && isRounded;
    }
    return rect.width >= 4 && rect.width <= 22 && rect.height >= 4 && rect.height <= 22 &&
      ratio >= 0.55 && ratio <= 1.8 && isRounded;
  };
  const closestBadgeBox = (element, hasNumber) => {
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
      if (hasNumber && !getBadgeNumber(current.textContent)) continue;
      if (!hasNumber && cleanText(current.textContent) !== '') continue;
      if (looksLikeBadgeBox(current, hasNumber)) return current;
    }
    return null;
  };
  const findChatRow = (element) => {
    let best = null;
    for (let current = element, depth = 0; current && depth < 10; depth += 1, current = current.parentElement) {
      const rect = current.getBoundingClientRect();
      if (!isVisibleElement(current, rect)) continue;
      const role = current.getAttribute && current.getAttribute('role');
      const tag = String(current.tagName || '').toLowerCase();
      const style = window.getComputedStyle(current);
      const clickable = role === 'button' || tag === 'button' || tag === 'a' ||
        current.hasAttribute('tabindex') || style.cursor === 'pointer';
      const rowShaped = rect.width >= 160 && rect.height >= 36 && rect.height <= 130;
      if (rowShaped) best = current;
      if (rowShaped && clickable) return current;
    }
    return best;
  };
  const clickElement = (element) => {
    if (!element) return false;
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = element.getBoundingClientRect();
    const x = rect.left + Math.min(Math.max(rect.width * 0.35, 20), rect.width - 8);
    const y = rect.top + rect.height / 2;
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      element.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        button: 0,
      }));
    }
    return true;
  };
  const badges = [];
  const elements = Array.from(document.querySelectorAll('div,span,b,strong,em,i,p,label'));
  for (const element of elements) {
    const value = getBadgeNumber(element.textContent);
    if (!value) continue;
    const badgeBox = closestBadgeBox(element, true);
    const row = badgeBox && findChatRow(badgeBox);
    if (row) badges.push({ badgeBox, row, rect: row.getBoundingClientRect(), value });
  }
  for (const element of elements) {
    if (cleanText(element.textContent) !== '') continue;
    const badgeBox = closestBadgeBox(element, false);
    const row = badgeBox && findChatRow(badgeBox);
    if (row) badges.push({ badgeBox, row, rect: row.getBoundingClientRect(), value: 1 });
  }
  badges.sort((a, b) => (a.rect.top - b.rect.top) || (a.rect.left - b.rect.left));
  return clickElement(badges[0] && badges[0].row);
})()
`;

function startMainZaloBadgePolling(contents, profileId) {
  const poll = async () => {
    if (contents.isDestroyed()) return;
    if (!contents.getURL().includes('zalo.me')) return;
    if (Date.now() - (ensureBadgeState(profileId).lastDomUpdateAt || 0) < 10000) return;

    try {
      const count = await contents.executeJavaScript(ZALO_UNREAD_SCAN_SCRIPT, true);
      updateProfileDomBadge(profileId, count);
    } catch (_) { }
  };

  const interval = setInterval(poll, 15000);
  contents.once('destroyed', () => clearInterval(interval));
  contents.on('did-finish-load', () => setTimeout(poll, 2500));
  setTimeout(poll, 6000);
}

function focusProfile(profileId, openUnread = false) {
  if (!profileId || !mainWindow || mainWindow.isDestroyed()) return;

  activeProfileId = profileId;

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
  mainWindow.flashFrame(false);

  if (mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('activate-profile', { id: profileId });
  }

  updateBrowserViewBounds();

  const view = browserViews[profileId];
  if (!openUnread || !view || view.webContents.isDestroyed()) return;
  if (!view.webContents.getURL().includes('zalo.me')) return;

  setTimeout(() => {
    if (view.webContents.isDestroyed()) return;
    view.webContents.executeJavaScript(ZALO_OPEN_FIRST_UNREAD_SCRIPT, true).catch(() => { });
  }, 500);
}

function showUnreadNotification(profileId, count) {
  if (!Notification.isSupported()) return;
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused() && activeProfileId === profileId) return;

  const meta = profileMetaById.get(profileId) || {};
  const name = meta.name || 'ZepLao';
  const notification = new Notification({
    title: name,
    body: count > 1 ? `${count} tin nhắn chưa đọc` : 'Có tin nhắn mới',
    icon: path.join(__dirname, 'icon.ico'),
    silent: false,
    timeoutType: 'default',
  });

  notification.on('click', () => {
    focusProfile(profileId, true);
  });

  notification.show();
}

// ============================================================
//  TẠO ICON BADGE
// ============================================================
function getAppIconPath() {
  const candidates = [
    path.join(__dirname, 'icon.ico'),
    path.join(__dirname, 'icon.png'),
    '/Users/tiodev/Downloads/Zalo/icon.png',
  ];

  return candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  }) || '';
}

function createBadgeIcon(count) {
  const size = 18;
  const text = count > 9 ? '9+' : String(count);
  const fontSize = count > 9 ? 9 : 11;

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#e74c3c"/>
      <text x="${size / 2}" y="${size / 2 + fontSize / 3}"
            text-anchor="middle" fill="white"
            font-size="${fontSize}" font-weight="bold"
            font-family="Arial, sans-serif">${text}</text>
    </svg>`;

  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  );
}

function createTrayIcon(count = 0) {
  const size = 32;
  const iconPath = getAppIconPath();
  const baseIcon = iconPath
    ? nativeImage.createFromPath(iconPath).resize({ width: size, height: size })
    : nativeImage.createEmpty();

  if (!count || count <= 0) {
    return baseIcon.resize({ width: 16, height: 16 });
  }

  const badgeText = count > 9 ? '9+' : String(count);
  const badgeRadius = count > 9 ? 9 : 8;
  const fontSize = count > 9 ? 8 : 10;
  const baseDataUrl = baseIcon.toDataURL();
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <image href="${baseDataUrl}" width="${size}" height="${size}"/>
      <circle cx="${size - badgeRadius}" cy="${badgeRadius}" r="${badgeRadius}" fill="#e74c3c"/>
      <text x="${size - badgeRadius}" y="${badgeRadius + fontSize / 3}"
            text-anchor="middle" fill="white"
            font-size="${fontSize}" font-weight="bold"
            font-family="Arial, sans-serif">${badgeText}</text>
    </svg>`;

  return nativeImage
    .createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
    .resize({ width: 16, height: 16 });
}

// ============================================================
//  TẠO SYSTEM TRAY
// ============================================================
function createTray() {
  tray = new Tray(createTrayIcon(unreadCount));
  updateTrayMenu();
  tray.setToolTip('Zalo');

  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  tray.on('double-click', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    { label: '💬 Mở Zalo', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    {
      label: '🔄 Tải lại trang', click: () => {
        if (activeProfileId && browserViews[activeProfileId]) {
          browserViews[activeProfileId].webContents.reload();
        }
      }
    },
    { label: '🚀 Khởi động cùng Windows', type: 'checkbox', checked: settings.autoLaunch, click: (item) => toggleAutoLaunch(item.checked) },
    { label: '📌 Thu nhỏ xuống Tray khi đóng', type: 'checkbox', checked: settings.minimizeToTray, click: (item) => { settings.minimizeToTray = item.checked; saveSettings(settings); } },
    { type: 'separator' },
    {
      label: '🛡️ Bảo mật', submenu: [
        { label: 'Chặn hiển thị "Đã xem"', type: 'checkbox', checked: settings.blockSeen, click: (item) => toggleBlockSeen(item.checked) },
        { label: 'Chặn hiển thị "Đang nhập"', type: 'checkbox', checked: settings.blockTyping, click: (item) => toggleBlockTyping(item.checked) }
      ]
    },
    { type: 'separator' },
    { label: '⬇️ Kiểm tra cập nhật', click: () => checkForUpdates(true) },
    { type: 'separator' },
    { label: '❌ Thoát hoàn toàn', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
}

function toggleBlockSeen(enable) {
  settings.blockSeen = enable;
  saveSettings(settings);
}

function toggleBlockTyping(enable) {
  settings.blockTyping = enable;
  saveSettings(settings);
}

// ============================================================
//  AUTO UPDATER
// ============================================================
let isManualUpdateCheck = false;

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Có bản cập nhật mới',
      message: `Đã có bản cập nhật mới v${info.version}. Bạn có muốn tải xuống và cài đặt không?`,
      buttons: ['Tải xuống', 'Bỏ qua']
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    if (isManualUpdateCheck) {
      dialog.showMessageBox({
        title: 'Không có cập nhật',
        message: 'Bạn đang sử dụng phiên bản mới nhất.'
      });
      isManualUpdateCheck = false;
    }
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      title: 'Đã tải xong cập nhật',
      message: 'Bản cập nhật đã được tải xuống. Ứng dụng sẽ khởi động lại để cài đặt.',
      buttons: ['Cài đặt và Khởi động lại']
    }).then(() => {
      isQuitting = true;
      autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    if (isManualUpdateCheck) {
      let errorMessage = err == null ? "Lỗi không xác định" : (err.stack || err).toString();
      if (errorMessage.includes('No published versions on GitHub') || errorMessage.includes('404 Not Found')) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Thông tin cập nhật',
          message: 'Chưa có bản cập nhật nào được phát hành. Bạn đang sử dụng phiên bản mới nhất!'
        });
      } else {
        dialog.showErrorBox('Lỗi cập nhật', errorMessage);
      }
      isManualUpdateCheck = false;
    }
  });

  // Tự động kiểm tra cập nhật khi khởi động
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);
}

function checkForUpdates(manual = false) {
  isManualUpdateCheck = manual;
  autoUpdater.checkForUpdates();
}

function toggleAutoLaunch(enable) {
  settings.autoLaunch = enable;
  saveSettings(settings);
  const exePath = process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe');
  app.setLoginItemSettings({ openAtLogin: enable, path: exePath });
}

// ============================================================
//  QUẢN LÝ BROWSERVIEW
// ============================================================
function updateBrowserViewBounds() {
  if (!mainWindow) return;
  const bounds = mainWindow.getContentBounds();
  const activeView = activeProfileId ? browserViews[activeProfileId] : null;

  for (const [id, view] of Object.entries(browserViews)) {
    if (view === activeView) {
      // Đưa view đang active vào vùng hiển thị
      view.setBounds({
        x: 68,
        y: 0,
        width: Math.max(bounds.width - 68, 0),
        height: Math.max(bounds.height, 0)
      });
      mainWindow.setTopBrowserView(view);
    } else {
      // Đẩy ra off-screen thay vì remove → Chromium vẫn render → MutationObserver vẫn hoạt động
      view.setBounds({ x: -9999, y: -9999, width: 1000, height: 800 });
    }
  }
}

function setupWebContents(contents, profileId) {
  contents.setWindowOpenHandler(({ url }) => {
    const meta = profileId ? profileMetaById.get(profileId) : null;
    let isCustomUrl = false;
    if (meta && meta.platform === 'custom' && meta.url) {
      try {
        const host = new URL(meta.url).hostname;
        if (host && url.includes(host)) {
          isCustomUrl = true;
        }
      } catch (e) {}
    }
    if (url.includes('facebook.com') || url.includes('messenger.com') || url.includes('fbcdn.net') || url.includes('zalo.me') || url.includes('whatsapp.com') || isCustomUrl) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
  


  const syncTitleBadge = (title) => {
    const state = ensureBadgeState(profileId);
    state.titleCount = parseTitleBadgeCount(title);
    publishProfileBadge(profileId);
  };

  contents.on('page-title-updated', (_event, title) => {
    syncTitleBadge(title);
  });

  contents.on('did-finish-load', () => {
    syncTitleBadge(contents.getTitle());
  });

  contents.on('destroyed', () => {
    badgeStateByProfile.delete(profileId);
    refreshGlobalUnreadBadge();
  });

  startMainZaloBadgePolling(contents, profileId);

  contents.on('context-menu', (event, params) => {
    const menu = new Menu();
    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions) {
        menu.append(new MenuItem({ label: suggestion, click: () => contents.replaceMisspelling(suggestion) }));
      }
      if (params.dictionarySuggestions.length > 0) menu.append(new MenuItem({ type: 'separator' }));
    }
    if (params.selectionText) menu.append(new MenuItem({ label: '📋 Sao chép', role: 'copy' }));
    if (params.isEditable) {
      menu.append(new MenuItem({ label: '📋 Dán', role: 'paste' }));
      menu.append(new MenuItem({ label: '✂️ Cắt', role: 'cut' }));
      menu.append(new MenuItem({ label: '📝 Chọn tất cả', role: 'selectAll' }));
    }
    if (params.linkURL) {
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: '🔗 Mở liên kết', click: () => shell.openExternal(params.linkURL) }));
      menu.append(new MenuItem({ label: '📋 Sao chép liên kết', click: () => require('electron').clipboard.writeText(params.linkURL) }));
    }
    if (params.mediaType === 'image') {
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: '💾 Lưu ảnh', click: () => contents.downloadURL(params.srcURL) }));
    }
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({ label: '🔄 Tải lại trang', click: () => contents.reload() }));
    menu.append(new MenuItem({ label: '◀️ Quay lại', enabled: contents.canGoBack(), click: () => contents.goBack() }));
    if (menu.items.length > 0) menu.popup({ window: mainWindow });
  });

  contents.on('did-finish-load', async () => {
    const cssPath = path.join(__dirname, 'custom_style.css');
    try {
      const cssData = fs.readFileSync(cssPath, 'utf8');
      contents.insertCSS(cssData);
    } catch (e) { }
  });



  if (app.isPackaged) {
    contents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) event.preventDefault();
    });
    contents.on('devtools-opened', () => contents.closeDevTools());
  } else {
    contents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) contents.toggleDevTools();
    });
  }
}

// ============================================================
//  TẠO CỬA SỔ CHÍNH
// ============================================================
function createWindow() {
  const { windowBounds } = settings;

  mainWindow = new BrowserWindow({
    width: windowBounds.width || 1200,
    height: windowBounds.height || 800,
    x: windowBounds.x,
    y: windowBounds.y,
    minWidth: 400,
    minHeight: 300,
    title: 'Zalo',
    icon: '/Users/tiodev/Downloads/Zalo/icon.png',
    backgroundColor: settings.isDarkMode ? '#242526' : '#ffffff',
    show: !settings.startMinimized,
    autoHideMenuBar: true,
    titleBarOverlay: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      spellcheck: false,
    },
  });

  app.on('session-created', (sess) => {
    sess.webRequest.onBeforeRequest({ urls: ['*://*.facebook.com/*', '*://*.messenger.com/*', '*://*.zalo.me/*'] }, (details, callback) => {
      let cancel = false;

      // Chặn Đã xem (Block Seen)
      if (settings.blockSeen) {
        if (details.url.includes('/change_read_status.php') || details.url.includes('/ajax/mercury/change_read_status.php') || (details.url.includes('zalo.me') && details.url.includes('/seen'))) {
          cancel = true;
        }
        if (details.uploadData && details.uploadData.length > 0) {
          const body = details.uploadData[0].bytes ? details.uploadData[0].bytes.toString() : '';
          if (body.includes('LSThreadMarkRead') || body.includes('markThreadRead') || body.includes('ThreadMarkReadMutation') || body.includes('"name":"mark_read"')) {
            cancel = true;
          }
        }
      }

      // Chặn Đang nhập (Block Typing)
      if (settings.blockTyping) {
        if (details.url.includes('/typ.php') || details.url.includes('/ajax/messaging/typ.php') || (details.url.includes('zalo.me') && details.url.includes('/typing'))) {
          cancel = true;
        }
        if (details.uploadData && details.uploadData.length > 0) {
          const body = details.uploadData[0].bytes ? details.uploadData[0].bytes.toString() : '';
          if (body.includes('TypingIndicator') || body.includes('LSTypingIndicator') || body.includes('typing_indicator')) {
            cancel = true;
          }
        }
      }

      callback({ cancel });
    });

    sess.setPermissionRequestHandler((webContents, permission, callback) => {
      const url = webContents.getURL();
      const profileId = findProfileIdBySender(webContents);
      const meta = profileId ? profileMetaById.get(profileId) : null;
      let isCustomUrl = false;
      if (meta && meta.platform === 'custom' && meta.url) {
        try {
          const host = new URL(meta.url).hostname;
          if (host && url.includes(host)) {
            isCustomUrl = true;
          }
        } catch (e) {}
      }
      const isAllowed = url.includes('facebook.com') || url.includes('messenger.com') || url.includes('fbcdn.net') || url.includes('zalo.me') || url.includes('whatsapp.com') || isCustomUrl;
      if (isAllowed) {
        const allowedPermissions = [
          'notifications', 'media', 'mediaKeySystem', 'microphone',
          'camera', 'clipboard-read', 'clipboard-sanitized-write',
        ];
        if (allowedPermissions.includes(permission)) {
          callback(true);
          return;
        }
      }
      callback(false);
    });

    sess.setPermissionCheckHandler((webContents, permission) => {
      const url = webContents?.getURL() || '';
      const profileId = webContents ? findProfileIdBySender(webContents) : null;
      const meta = profileId ? profileMetaById.get(profileId) : null;
      let isCustomUrl = false;
      if (meta && meta.platform === 'custom' && meta.url) {
        try {
          const host = new URL(meta.url).hostname;
          if (host && url.includes(host)) {
            isCustomUrl = true;
          }
        } catch (e) {}
      }
      if (url.includes('facebook.com') || url.includes('messenger.com') || url.includes('zalo.me') || url.includes('whatsapp.com') || isCustomUrl) {
        return true;
      }
      return false;
    });
  });

  mainWindow.loadFile('index.html');

  if (app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) event.preventDefault();
    });
    mainWindow.webContents.on('devtools-opened', () => mainWindow.webContents.closeDevTools());
  } else {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) mainWindow.webContents.toggleDevTools();
    });
  }

  mainWindow.on('focus', () => {
    mainWindow.flashFrame(false);
  });

  mainWindow.on('resize', updateBrowserViewBounds);
  mainWindow.on('maximize', updateBrowserViewBounds);
  mainWindow.on('unmaximize', updateBrowserViewBounds);

  mainWindow.on('close', (event) => {
    if (!isQuitting && settings.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }
    settings.windowBounds = mainWindow.getBounds();
    saveSettings(settings);
  });

  // IPC
  function setupBrowserViewForProfile(profile) {
    rememberProfile(profile);
    if (browserViews[profile.id]) return;
    const view = new BrowserView({
      webPreferences: {
        partition: profile.partition,
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: true,
      }
    });
    browserViews[profile.id] = view;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.addBrowserView(view);
      // Initialize it off-screen
      view.setBounds({ x: -9999, y: -9999, width: 1000, height: 800 });
    }
    setupWebContents(view.webContents, profile.id);
    
    let url = ZALO_URL;
    let userAgent = USER_AGENT;
    if (profile.platform === 'whatsapp') {
      url = 'https://web.whatsapp.com';
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    } else if (profile.platform === 'custom') {
      url = profile.url || 'https://google.com';
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }
    
    view.webContents.loadURL(url, { userAgent: userAgent });
  }

  ipcMain.on('init-profiles', (event, profiles) => {
    if (Array.isArray(profiles)) {
      profiles.forEach((profile, index) => {
        rememberProfile(profile);
        setTimeout(() => {
          setupBrowserViewForProfile(profile);
        }, index * 5000); // 5-second stagger to prevent Zalo session conflicts
      });
    }
  });

  // ============================================================
  //  IPC: Nhận badge count từ MutationObserver trong preload.js
  // ============================================================
  
  ipcMain.on('update-red-dot', (event, count) => {
    const profileId = findProfileIdBySender(event.sender);
    if (!profileId) return;

    updateProfileDomBadge(profileId, count);
  });

  ipcMain.on('notification-click', (event) => {
    const profileId = findProfileIdBySender(event.sender) || activeProfileId;
    if (profileId) {
      focusProfile(profileId, true);
    }
  });

  ipcMain.on('switch-profile', (event, profile) => {
    rememberProfile(profile);
    activeProfileId = profile.id;
    setupBrowserViewForProfile(profile);
    updateBrowserViewBounds();
  });

  ipcMain.on('set-browserview-visibility', (event, visible) => {
    if (!mainWindow) return;
    if (visible && activeProfileId && browserViews[activeProfileId]) {
      updateBrowserViewBounds();
    } else {
      // Hide all off-screen
      for (const view of Object.values(browserViews)) {
        view.setBounds({ x: -9999, y: -9999, width: 1000, height: 800 });
      }
    }
  });

  ipcMain.on('delete-profile', (_event, id) => {
    if (browserViews[id]) {
      browserViews[id].webContents.destroy();
      delete browserViews[id];
    }

    badgeStateByProfile.delete(id);
    profileMetaById.delete(id);
    refreshGlobalUnreadBadge();
  });

  ipcMain.on('set-theme', (event, isDark) => {
    settings.isDarkMode = isDark;
    saveSettings(settings);
    nativeTheme.themeSource = isDark ? 'dark' : 'light';
  });

  ipcMain.on('toggle-always-on-top', () => {
    settings.alwaysOnTop = !settings.alwaysOnTop;
    mainWindow.setAlwaysOnTop(settings.alwaysOnTop);
    saveSettings(settings);
  });

  ipcMain.on('toggle-fullscreen', () => {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    setTimeout(updateBrowserViewBounds, 100);
  });

  ipcMain.on('zoom-in', () => {
    if (activeProfileId && browserViews[activeProfileId]) {
      const wc = browserViews[activeProfileId].webContents;
      wc.setZoomLevel(wc.getZoomLevel() + 0.5);
    }
  });

  ipcMain.on('zoom-out', () => {
    if (activeProfileId && browserViews[activeProfileId]) {
      const wc = browserViews[activeProfileId].webContents;
      wc.setZoomLevel(wc.getZoomLevel() - 0.5);
    }
  });

  ipcMain.on('reload-page', () => {
    if (activeProfileId && browserViews[activeProfileId]) {
      browserViews[activeProfileId].webContents.reload();
    }
  });

  ipcMain.on('get-settings', (event) => {
    event.returnValue = {
      isDarkMode: settings.isDarkMode,
      alwaysOnTop: settings.alwaysOnTop,
    };
  });

  ipcMain.on('get-user-data-path', (event) => {
    event.returnValue = app.getPath('userData');
  });
}

// ============================================================
//  CẬP NHẬT BADGE TRÊN TASKBAR & TRAY
// ============================================================
function updateBadge(count) {
  if (!mainWindow) return;
  if (process.platform === 'win32') {
    if (count > 0) {
      try {
        mainWindow.setOverlayIcon(createBadgeIcon(count), `${count} tin nhắn chưa đọc`);
      } catch {
        mainWindow.setOverlayIcon(null, '');
      }
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  }
  if (tray) {
    tray.setImage(createTrayIcon(count));
    tray.setToolTip(count > 0 ? `Zalo — ${count} tin nhắn chưa đọc` : 'Zalo');
  }
}

// ============================================================
//  ĐĂNG KÝ PHÍM TẮT
// ============================================================
function registerGlobalShortcuts() {
  const hotkey = settings.globalHotkey || 'Ctrl+Shift+M';
  try {
    globalShortcut.register(hotkey, () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) { }
}

// ============================================================
//  KHỞI ĐỘNG ỨNG DỤNG
// ============================================================
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  nativeTheme.themeSource = settings.isDarkMode ? 'dark' : 'light';
  createWindow();
  createTray();
  registerGlobalShortcuts();
  setupAutoUpdater();

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ============================================================
//  XỬ LÝ THOÁT
// ============================================================
app.on('before-quit', () => {
  isQuitting = true;
  if (mainWindow) {
    settings.windowBounds = mainWindow.getBounds();
    saveSettings(settings);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
