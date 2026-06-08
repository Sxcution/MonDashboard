/**
 * STool Dashboard - Global JavaScript Functions
 * File này chứa các functions dùng chung cho toàn bộ ứng dụng
 */

// ===== TOAST NOTIFICATION FUNCTION =====
/**
 * Hiển thị toast notification (Bootstrap Toast)
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại thông báo ('success', 'error', 'info')
 * @param {string} title - Tiêu đề tùy chỉnh (optional)
 */
function showToast(message, type = 'success', title = 'Thông báo') {
    const toastEl = document.getElementById('liveToast');
    const toastHeader = document.getElementById('toastHeader');
    const toastTitle = document.getElementById('toastTitle');
    const toastBody = document.getElementById('toastBody');

    if (!toastEl) {
        console.warn('Toast element not found!');
        return;
    }

    const normalizedType = type === 'danger' ? 'error' : type;
    const labelMap = {
        success: 'Thông báo',
        info: title || 'Thông báo',
        warning: 'Cảnh báo',
        error: 'Lỗi'
    };
    const classMap = {
        success: ['bg-success', 'text-white'],
        info: ['bg-info', 'text-white'],
        warning: ['bg-warning', 'text-dark'],
        error: ['bg-danger', 'text-white']
    };
    const toastType = labelMap[normalizedType] ? normalizedType : 'info';
    const cleanMessage = String(message || '').replace(/\s+/g, ' ').trim();

    toastHeader.className = 'toast-header d-none';
    toastTitle.textContent = labelMap[toastType];
    toastBody.textContent = `${labelMap[toastType]}: ${cleanMessage}`;
    toastEl.className = 'toast dashboard-toast';
    toastEl.classList.add(...classMap[toastType]);

    // Show toast
    const toast = new bootstrap.Toast(toastEl, { delay: 2600 });
    toast.show();
}

// ===== GLOBAL HELPERS =====
// Bạn có thể thêm các helper functions khác vào đây
// Ví dụ: formatDate, formatNumber, debounce, throttle, etc.


// ===== MODAL KEYBOARD SHORTCUTS =====
/**
 * Xử lý phím Enter và Esc cho tất cả modal
 * - Enter: Kích hoạt nút primary/danger trong modal
 * - Esc: Đóng modal (Bootstrap tự xử lý, nhưng có thể custom)
 */
document.addEventListener('DOMContentLoaded', function () {
    // Lắng nghe sự kiện khi modal được hiển thị
    document.addEventListener('shown.bs.modal', function (event) {
        const modal = event.target as HTMLElement;

        // Tìm nút primary hoặc danger trong modal (ưu tiên danger cho modal xóa)
        const dangerBtn = modal.querySelector('.modal-footer .btn-danger');
        const primaryBtn = modal.querySelector('.modal-footer .btn-primary');
        const actionBtn = (dangerBtn || primaryBtn) as HTMLButtonElement | null;

        // Handler cho phím Enter
        const enterHandler = function (e) {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                // Không áp dụng nếu đang focus vào textarea
                if (document.activeElement.tagName === 'TEXTAREA') {
                    return;
                }

                e.preventDefault();
                if (actionBtn && !actionBtn.disabled) {
                    actionBtn.click();
                }
            }
        };

        // Thêm event listener
        modal.addEventListener('keydown', enterHandler);

        // Cleanup khi modal bị đóng
        modal.addEventListener('hidden.bs.modal', function () {
            modal.removeEventListener('keydown', enterHandler);
        }, { once: true });
    });
});

/* === Smart Token Feature === */

/**
 * 📋 Hàm copy text vào clipboard
 * @param {string} textToCopy - Đoạn text cần copy
 */
async function copyToClipboard(textToCopy) {
    try {
        await navigator.clipboard.writeText(textToCopy);

        // 🔍 Tạo thông báo "Đã copy"
        const tempDiv = document.createElement('div');
        tempDiv.textContent = `Đã copy: ${textToCopy}`;
        tempDiv.style.cssText = `
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.7); color: white; padding: 8px 15px;
            border-radius: 5px; font-size: 14px; z-index: 1000;
            transition: opacity 0.5s ease-out;
        `;
        document.body.appendChild(tempDiv);
        setTimeout(() => {
            tempDiv.style.opacity = '0';
            setTimeout(() => tempDiv.remove(), 500);
        }, 1500);

    } catch (err) {
        console.error('🔍 Không thể copy:', err);
    }
}

/**
 * 🚀 Hàm chính để tìm và thay thế các token
 * @param {HTMLElement} container - Phần tử HTML (ví dụ: div) chứa nội dung cần xử lý
 */
function processSmartTokens(container) {
    if (!container) return;

    // 🔍 Định nghĩa Regular Expressions
    const mentionRegex = /(^|\s|[\.,;!?()])(@[a-zA-Z0-9_]{3,32})(?![a-zA-Z0-9_])/g;
    const numberRegex = /(?<![a-zA-Z0-9])(\d{4,})(?![a-zA-Z0-9])/g; // >= 4 chữ số

    // 🔍 Dùng TreeWalker để chỉ duyệt qua các Text Node (hiệu quả nhất)
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                // 🔍 Bỏ qua các node đã xử lý hoặc trong script/style
                if (node.parentElement.closest('script, style, .smart-token')) {
                    return NodeFilter.FILTER_REJECT;
                }
                // 🔍 Chỉ xử lý node có ký tự @ hoặc số (tối ưu)
                if (node.nodeValue.includes('@') || /\d{4,}/.test(node.nodeValue)) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_REJECT;
            }
        }
    );

    const nodesToProcess = [];
    while (walker.nextNode()) {
        nodesToProcess.push(walker.currentNode);
    }

    // 🔍 Xử lý các node (phải làm sau khi duyệt xong để tránh lỗi)
    nodesToProcess.forEach(textNode => {
        const parent = textNode.parentNode;
        const text = textNode.nodeValue;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        // 🔍 Tạo mảng chứa tất cả các vị trí khớp (@ và số)
        const matches = [];
        let match;

        // 🔍 Tìm @username
        while ((match = mentionRegex.exec(text)) !== null) {
            const startIndex = match.index + match[1].length;
            matches.push({
                start: startIndex,
                end: startIndex + match[2].length,
                text: match[2]
            });
        }
        mentionRegex.lastIndex = 0; // Reset

        // 🔍 Tìm số
        while ((match = numberRegex.exec(text)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[1].length,
                text: match[1]
            });
        }
        numberRegex.lastIndex = 0; // Reset

        // 🔍 Sắp xếp các match theo vị trí bắt đầu
        matches.sort((a, b) => a.start - b.start);

        // 🔍 Bọc các match bằng <span>
        matches.forEach(m => {
            if (m.start > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, m.start)));
            }
            const span = document.createElement('span');
            span.className = 'smart-token';
            span.textContent = m.text;
            span.dataset.copyValue = m.text; // Lưu giá trị vào data- attribute
            fragment.appendChild(span);
            lastIndex = m.end;
        });

        // 🔍 Thêm phần text còn lại
        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }

        // 🔍 Thay thế text node cũ bằng fragment mới
        if (fragment.childNodes.length > 0) {
            parent.replaceChild(fragment, textNode);
        }
    });
}

/* === Kết thúc Smart Token Feature === */

/* === Kích hoạt Smart Token (Chỉ áp dụng cho tab Ghi chú) === */

document.addEventListener('DOMContentLoaded', () => {
    // Chỉ chạy Smart Token nếu đang ở trang Ghi chú (/notes)
    if (window.location.pathname === '/notes' || window.location.pathname.startsWith('/notes/')) {
        console.log('🔍 Smart Token: Activating for Notes tab.');

        // Xác định vùng chứa nội dung cho Notes
        const notesContainer = document.getElementById('notes-container');
        const notesDetailContent = document.getElementById('notes-detail-content');

        // ⚠️ CHỈ chạy nếu tìm thấy Notes container
        if (!notesDetailContent && !notesContainer) {
            console.log('🔍 Smart Token: Notes container not found, skipping.');
            return;
        }

        const containerToProcess = notesDetailContent || notesContainer;

        // Chạy hàm xử lý ban đầu
        processSmartTokens(containerToProcess);

        // Thêm trình nghe sự kiện Click (dùng event delegation)
        containerToProcess.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            // Kiểm tra xem có click đúng vào .smart-token không
            if (target.classList.contains('smart-token') && target.dataset.copyValue) {
                event.preventDefault();
                copyToClipboard(target.dataset.copyValue);
            }
        });

        // ❌ DISABLED MutationObserver - Notes đã có auto-detect riêng
        // MutationObserver gây conflict với auto-detect trong editor
        console.log('🔍 Smart Token: MutationObserver disabled (Notes has its own auto-detection).');

        /* COMMENTED OUT TO PREVENT CONFLICTS
        // Observer để xử lý nội dung được load động (AJAX) trong Ghi chú
        if (window.MutationObserver) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // Chỉ xử lý nếu node được thêm vào trong container của Notes
                                if (containerToProcess.contains(node)) {
                                    console.log('🔍 Smart Token: Processing dynamically added content in Notes.');
                                    processSmartTokens(node);
                                }
                            }
                        });
                    }
                });
            });

            // Quan sát thay đổi trong container của Notes
            observer.observe(containerToProcess, {
                childList: true,
                subtree: true
            });
        }
        */
    }
});

/* === Kết thúc Kích hoạt Smart Token === */

/* === GLOBAL CONTEXT MENU HELPERS === */

/**
 * Tính toán vị trí menu (lật thông minh) sao cho không tràn màn hình.
 * @param {HTMLElement} menu - Phần tử DOM của menu.
 * @param {number} x - Tọa độ X của chuột.
 * @param {number} y - Tọa độ Y của chuột.
 */
function positionContextMenuSmart(menu, x, y) {
    if (!menu) return;

    // Tạm bật kiểu "có mặt trên DOM" để đo kích thước thực
    const prevVis = menu.style.visibility;
    const prevDisp = menu.style.display;
    menu.style.visibility = 'hidden';
    menu.style.display = 'block';

    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const MARGIN = 8; // tránh dính sát chuột và mép màn hình

    // Xem có đủ chỗ bên phải / bên dưới không
    const placeRight = (x + rect.width + MARGIN <= vw);
    const placeDown = (y + rect.height + MARGIN <= vh);

    // Nếu không đủ chỗ thì lật qua trái / lật lên trên
    let left = placeRight ? (x + MARGIN) : (x - rect.width - MARGIN);
    let top = placeDown ? (y + MARGIN) : (y - rect.height - MARGIN);

    // Clamp để menu không chọc lọt ra ngoài khi quá sát mép
    left = Math.min(Math.max(left, MARGIN), vw - rect.width - MARGIN);
    top = Math.min(Math.max(top, MARGIN), vh - rect.height - MARGIN);

    // Ghi vị trí cuối
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    // Khôi phục trạng thái hiển thị trước đó
    menu.style.visibility = prevVis || '';
    menu.style.display = ''; // luôn clear inline display để .show hoạt động
}

/**
 * Căn chỉnh các .submenu con bên trong menu sao cho không bay ra ngoài mép.
 * @param {HTMLElement} menu - Phần tử DOM của menu cha.
 */
function positionAllSubmenusForMenu(menu) {
    if (!menu) return;

    const submenuItems = menu.querySelectorAll('.has-submenu');
    submenuItems.forEach(item => {
        const submenu = item.querySelector('.submenu');
        if (!submenu) return;

        // reset mặc định: submenu mở về bên phải, từ trên xuống
        submenu.style.left = '100%';
        submenu.style.right = 'auto';
        submenu.style.top = '0';
        submenu.style.bottom = 'auto';

        const itemRect = item.getBoundingClientRect();
        const submenuRect = submenu.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Nếu tràn phải -> bung sang trái
        if (itemRect.right + submenuRect.width > vw) {
            submenu.style.left = 'auto';
            submenu.style.right = '100%';
        }

        // Nếu tràn dưới -> đính đáy lên trên (bung ngược lên)
        if (itemRect.top + submenuRect.height > vh) {
            submenu.style.top = 'auto';
            submenu.style.bottom = '0';
        }
    });
}
/* === Alt + C Color Inspector === */
(() => {
    let enabled = false;
    let currentHex = '';

    const tip = document.createElement('div');
    const box = document.createElement('div');

    Object.assign(tip.style, {
        position: 'fixed',
        zIndex: '999999',
        pointerEvents: 'none',
        padding: '8px 10px',
        borderRadius: '8px',
        background: 'rgba(15,15,18,.95)',
        color: '#fff',
        font: '12px Consolas, monospace',
        boxShadow: '0 8px 24px rgba(0,0,0,.35)',
        whiteSpace: 'pre',
        display: 'none',
    });

    Object.assign(box.style, {
        position: 'fixed',
        zIndex: '999998',
        pointerEvents: 'none',
        border: '1px solid #00E5FF',
        boxShadow: '0 0 0 9999px rgba(0,0,0,.08)',
        display: 'none',
    });

    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(tip);
        document.body.appendChild(box);
    });

    const toHex = (value: string) => {
        const nums = value.match(/\d+/g);
        if (!nums || nums.length < 3) return value;
        return '#' + nums.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
    };

    const pickBestBg = (el: Element | null): string => {
        let node: Element | null = el;
        while (node && node !== document.documentElement) {
            const bg = getComputedStyle(node).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
            node = node.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor;
    };

    const update = (e: MouseEvent) => {
        if (!enabled) return;

        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        if (!el || el === tip || el === box) return;

        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        const bg = pickBestBg(el);
        const fg = cs.color;
        const bd = cs.borderTopColor;
        const fill = cs.fill;
        const stroke = cs.stroke;

        currentHex = toHex(bg);

        tip.textContent =
            `Alt+C: ON | Click copy bg
TAG: ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + String(el.className).trim().replace(/\s+/g, '.') : ''}
bg:     ${toHex(bg)} ${bg}
text:   ${toHex(fg)} ${fg}
border: ${toHex(bd)} ${bd}
fill:   ${fill}
stroke: ${stroke}`;

        tip.style.left = `${Math.min(e.clientX + 14, window.innerWidth - 320)}px`;
        tip.style.top = `${Math.min(e.clientY + 14, window.innerHeight - 150)}px`;
        tip.style.display = 'block';

        box.style.left = `${rect.left}px`;
        box.style.top = `${rect.top}px`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
        box.style.display = 'block';
    };

    const hide = () => {
        tip.style.display = 'none';
        box.style.display = 'none';
    };

    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            enabled = !enabled;
            if (!enabled) hide();
            console.log(`[Color Inspector] ${enabled ? 'ON' : 'OFF'}`);
        }
    });

    document.addEventListener('mousemove', update);

    document.addEventListener('click', async (e) => {
        if (!enabled || !currentHex) return;
        e.preventDefault();
        e.stopPropagation();
        await navigator.clipboard.writeText(currentHex);
        tip.textContent += `\n\nCopied: ${currentHex}`;
    }, true);

    document.addEventListener('mouseleave', hide);
})();