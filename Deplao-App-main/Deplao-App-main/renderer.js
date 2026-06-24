const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

const userDataPath = ipcRenderer.sendSync('get-user-data-path');
const profilesPath = path.join(userDataPath, 'profiles.json');

const profilesList = document.getElementById('profiles-list');

// Load profiles
let profiles = [];
try {
  let saved = null;
  if (fs.existsSync(profilesPath)) {
    saved = fs.readFileSync(profilesPath, 'utf8');
  } else {
    // Migration from localStorage
    saved = localStorage.getItem('mp_profiles');
  }

  if (saved) {
    profiles = JSON.parse(saved);
    let migrated = false;
    profiles.forEach(p => {
      if (!p.partition) {
        p.partition = `persist:nick_${p.id}`;
        migrated = true;
      }
    });
    saveProfiles();
  }
} catch(e) {
  console.error(e);
}

if (profiles.length === 0) {
  profiles = [{ id: Date.now().toString(), name: 'Nick 1', partition: 'persist:nick_1' }];
  saveProfiles();
}

let activeProfileId = profiles[0].id;

function saveProfiles() {
  try {
    fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2), 'utf8');
    // Save backup to localStorage
    localStorage.setItem('mp_profiles', JSON.stringify(profiles));
  } catch (e) {
    console.error('Lỗi khi lưu profile:', e);
  }
}

function applyProfileBadge(id, rawCount) {
  const count = Math.max(0, Number(rawCount) || 0);
  const profile = profiles.find((p) => p.id === id);

  if (profile) {
    profile.badgeCount = count;
  }

  const badge = document.getElementById(`badge-${id}`);
  if (!badge) {
    renderSidebar();
    return;
  }

  if (count > 0) {
    badge.innerText = count > 9 ? '9+' : String(count);
    badge.style.display = 'block';
  } else {
    badge.innerText = '';
    badge.style.display = 'none';
  }
}

function renderSidebar() {
  profilesList.innerHTML = '';
  profiles.forEach(p => {
    const btn = document.createElement('div');
    btn.className = `profile-btn ${p.id === activeProfileId ? 'active' : ''}`;
    btn.title = p.name + ' (Click phải để đổi tên/xóa)';
    
    const span = document.createElement('span');
    span.innerText = p.name.charAt(0).toUpperCase();
    
    // Add avatar image if exists
    if (p.avatar) {
      const img = document.createElement('img');
      img.src = p.avatar.startsWith('http') ? p.avatar : `file://${p.avatar.replace(/\\/g, '/')}`;
      img.style.width = '100%'; img.style.height = '100%'; img.style.borderRadius = '50%';
      img.style.objectFit = 'cover'; img.style.position = 'absolute'; img.style.top = '0'; img.style.left = '0';
      btn.appendChild(img);
      span.style.display = 'none';
    } else {
      btn.appendChild(span);
    }
    
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.id = `badge-${p.id}`;
    const count = p.badgeCount || 0;
    badge.innerText = count > 9 ? '9+' : count;
    badge.style.display = count > 0 ? 'block' : 'none';
    btn.appendChild(badge);
    
    btn.onclick = () => switchProfile(p.id);
    
    btn.oncontextmenu = () => {
      openModal(p);
    };

    // Hỗ trợ kéo thả thay đổi vị trí tài khoản (Drag and Drop reordering)
    btn.draggable = true;
    btn.dataset.id = p.id;

    btn.ondragstart = (e) => {
      btn.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      // Tạm ẩn BrowserView khi kéo để tránh xung đột chuột
      ipcRenderer.send('set-browserview-visibility', false);
    };

    btn.ondragend = () => {
      btn.classList.remove('dragging');
      // Hiện lại BrowserView khi dừng kéo
      ipcRenderer.send('set-browserview-visibility', true);
      
      // Sắp xếp lại danh sách tài khoản dựa trên thứ tự DOM hiện tại
      const newProfiles = [];
      const childNodes = Array.from(profilesList.children);
      childNodes.forEach(child => {
        const profileId = child.dataset.id;
        const found = profiles.find(x => x.id === profileId);
        if (found) {
          newProfiles.push(found);
        }
      });
      profiles = newProfiles;
      saveProfiles();
    };

    btn.ondragover = (e) => {
      e.preventDefault();
      const draggingBtn = document.querySelector('.dragging');
      if (draggingBtn && draggingBtn !== btn) {
        const rect = btn.getBoundingClientRect();
        const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
        profilesList.insertBefore(draggingBtn, next ? btn.nextSibling : btn);
      }
    };
    
    profilesList.appendChild(btn);
  });
}

function switchProfile(id) {
  activeProfileId = id;
  renderSidebar();
  const p = profiles.find(x => x.id === id);
  if (p) {
    ipcRenderer.send('switch-profile', p);
  }
}

// Modal Logic
let editingProfile = null;
let tempAvatarPath = null;
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const nameInput = document.getElementById('profile-name-input');
const platformInput = document.getElementById('profile-platform-input');
const urlInput = document.getElementById('profile-url-input'); // urlInput : Ô nhập URL cho tùy chọn
const avatarPreview = document.getElementById('avatar-preview');
const avatarImg = document.getElementById('avatar-img');
const avatarLetter = document.getElementById('avatar-letter');
const avatarInput = document.getElementById('avatar-input');

platformInput.addEventListener('change', () => {
  if (platformInput.value === 'custom') {
    urlInput.style.display = 'block';
    urlInput.focus();
  } else {
    urlInput.style.display = 'none';
  }
});

function openModal(profileToEdit = null) {
  ipcRenderer.send('set-browserview-visibility', false);
  editingProfile = profileToEdit;
  tempAvatarPath = profileToEdit ? profileToEdit.avatar : null;
  
  modalTitle.innerText = profileToEdit ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản';
  nameInput.value = profileToEdit ? profileToEdit.name : '';
  
  const platformVal = profileToEdit && profileToEdit.platform ? profileToEdit.platform : 'zalo';
  platformInput.value = platformVal;
  
  if (platformVal === 'custom') {
    urlInput.value = profileToEdit && profileToEdit.url ? profileToEdit.url : '';
    urlInput.style.display = 'block';
  } else {
    urlInput.value = '';
    urlInput.style.display = 'none';
  }
  
  document.getElementById('modal-delete').style.display = profileToEdit ? 'block' : 'none';
  
  updateAvatarPreview();
  modalOverlay.style.display = 'flex';
  nameInput.focus();
}

function updateAvatarPreview() {
  if (tempAvatarPath) {
    avatarImg.src = tempAvatarPath.startsWith('http') ? tempAvatarPath : `file://${tempAvatarPath.replace(/\\/g, '/')}`;
    avatarImg.style.display = 'block';
    avatarLetter.style.display = 'none';
  } else {
    avatarImg.style.display = 'none';
    avatarLetter.style.display = 'block';
    avatarLetter.innerText = nameInput.value ? nameInput.value.charAt(0).toUpperCase() : '+';
  }
}

nameInput.addEventListener('input', updateAvatarPreview);

avatarPreview.onclick = () => avatarInput.click();
avatarInput.onchange = (e) => {
  if (e.target.files && e.target.files[0]) {
    tempAvatarPath = e.target.files[0].path;
    updateAvatarPreview();
  }
};

document.getElementById('modal-delete').onclick = () => {
  if (!editingProfile) return;
  const action = confirm(`Bạn có chắc chắn muốn XÓA tài khoản [${editingProfile.name}]?`);
  if (action) {
    if (profiles.length <= 1) {
      alert('Phải có ít nhất 1 tài khoản!');
      return;
    }
    profiles = profiles.filter(x => x.id !== editingProfile.id);
    saveProfiles();
    ipcRenderer.send('delete-profile', editingProfile.id);
    if (activeProfileId === editingProfile.id) switchProfile(profiles[0].id);
    modalOverlay.style.display = 'none';
    renderSidebar();
    ipcRenderer.send('set-browserview-visibility', true);
  }
};

document.getElementById('modal-cancel').onclick = () => {
  modalOverlay.style.display = 'none';
  ipcRenderer.send('set-browserview-visibility', true);
};

document.getElementById('modal-save').onclick = () => {
  const name = nameInput.value.trim();
  if (!name) {
    alert('Vui lòng nhập tên tài khoản!');
    return;
  }
  
  let url = '';
  if (platformInput.value === 'custom') {
    url = urlInput.value.trim();
    if (!url) {
      alert('Vui lòng nhập URL!');
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
  }
  
  if (editingProfile) {
    editingProfile.name = name;
    editingProfile.avatar = tempAvatarPath;
    editingProfile.platform = platformInput.value;
    editingProfile.url = url;
  } else {
    const id = Date.now().toString();
    const p = { id, name, avatar: tempAvatarPath, partition: `persist:nick_${id}`, platform: platformInput.value, url: url };
    profiles.push(p);
    activeProfileId = id;
  }
  
  saveProfiles();
  modalOverlay.style.display = 'none';
  renderSidebar();
  ipcRenderer.send('set-browserview-visibility', true);
  if (!editingProfile) switchProfile(activeProfileId);
};

document.getElementById('btn-add-profile').onclick = () => openModal();

// Toolbar
let isDarkMode = true;
const toggleDarkMode = () => {
  isDarkMode = !isDarkMode;
  document.body.className = isDarkMode ? 'dark-mode' : 'light-mode';
  document.getElementById('icon-sun').style.display = isDarkMode ? 'none' : 'block';
  document.getElementById('icon-moon').style.display = isDarkMode ? 'block' : 'none';
  ipcRenderer.send('set-theme', isDarkMode);
};
document.getElementById('btn-dark-mode').onclick = toggleDarkMode;
document.getElementById('btn-zoom-in').onclick = () => ipcRenderer.send('zoom-in');
document.getElementById('btn-zoom-out').onclick = () => ipcRenderer.send('zoom-out');
document.getElementById('btn-fs').onclick = () => ipcRenderer.send('toggle-fullscreen');
document.getElementById('btn-pin').onclick = () => {
  const btn = document.getElementById('btn-pin');
  const isPinned = btn.style.opacity === '1';
  btn.style.opacity = isPinned ? '0.4' : '1';
  ipcRenderer.send('toggle-always-on-top');
};
document.getElementById('btn-reload').onclick = () => ipcRenderer.send('reload-page');

// IPC Updates from Main
ipcRenderer.on('update-profile-badge', (_event, { id, count }) => {
  applyProfileBadge(id, count);
});

ipcRenderer.on('activate-profile', (_event, { id }) => {
  if (!id) return;
  activeProfileId = id;
  renderSidebar();
});

ipcRenderer.on('update-profile-avatar', (event, { id, avatarUrl }) => {
  const p = profiles.find(x => x.id === id);
  if (p) {
    const isAutoAvatar = !p.avatar || p.avatar.includes('graph.facebook.com') || p.avatar.includes('scontent') || p.avatar.includes('fbcdn');
    if (isAutoAvatar && p.avatar !== avatarUrl) {
      p.avatar = avatarUrl;
      saveProfiles();
      renderSidebar();
    }
  }
});

// Init
const settings = ipcRenderer.sendSync('get-settings');
isDarkMode = settings.isDarkMode;
document.body.className = isDarkMode ? 'dark-mode' : 'light-mode';
document.getElementById('icon-sun').style.display = isDarkMode ? 'none' : 'block';
document.getElementById('icon-moon').style.display = isDarkMode ? 'block' : 'none';
if(settings.alwaysOnTop) {
  document.getElementById('btn-pin').style.opacity = '1';
}

renderSidebar();
ipcRenderer.send('init-profiles', profiles);
switchProfile(activeProfileId);
