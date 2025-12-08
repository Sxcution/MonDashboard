## Thay đổi: Loại bỏ auto-refresh sau khi chỉnh sửa

### Thay đổi đã thực hiện:

#### 1. Function `makeEditable` (dòng ~8650):
**Trước:**
```javascript
// Reload data to ensure consistency (this will update all cards)
await loadMXHData();
mxhShowToast('Đã cập nhật thành công!', 'success');
```

**Sau:**
```javascript
// Update the global mxhAccounts array to keep data consistent
const accountIndex = mxhAccounts.findIndex(acc => acc.id === accountId);
if (accountIndex !== -1) {
    if (field === 'username' && !isSecondary) {
        mxhAccounts[accountIndex].username = newValue || '.';
    } else if (field === 'phone' && !isSecondary) {
        mxhAccounts[accountIndex].phone = newValue || '.';
    } else if (field === 'secondary_username' && isSecondary) {
        mxhAccounts[accountIndex].secondary_username = newValue || '.';
    } else if (field === 'secondary_phone' && isSecondary) {
        mxhAccounts[accountIndex].secondary_phone = newValue || '.';
    }
}

// Show success message without reloading entire page
mxhShowToast('Đã cập nhật thành công!', 'success');
```

#### 2. Function `makeCardNumberEditable` (dòng ~8790):
**Trước:**
```javascript
// On success, reload all data to ensure correct sorting and display
await loadMXHData();
mxhShowToast('Đã cập nhật và sắp xếp lại!', 'success');
```

**Sau:**
```javascript
// Update the global mxhAccounts array
const accountIndex = mxhAccounts.findIndex(acc => acc.id === accountId);
if (accountIndex !== -1) {
    mxhAccounts[accountIndex].card_name = newNumber;
}

// Update the UI element
const newElement = document.createElement('h6');
newElement.className = 'card-title mb-0';
newElement.style.cursor = 'pointer';
newElement.textContent = newNumber;
newElement.onclick = (e) => makeCardNumberEditable(e, accountId);
input.replaceWith(newElement);

mxhShowToast('Đã cập nhật số thứ tự!', 'success');
```

### Lợi ích:

1. **Không làm gián đoạn người dùng**: Trang không bị refresh khi chỉnh sửa
2. **Tốc độ nhanh hơn**: Chỉ cập nhật UI cục bộ thay vì reload toàn bộ dữ liệu
3. **Trải nghiệm mượt mà**: Người dùng có thể tiếp tục chỉnh sửa nhiều field liên tiếp
4. **Vẫn đảm bảo tính nhất quán**: Cập nhật cả database (qua API) và global array `mxhAccounts`

### Chức năng vẫn hoạt động:

- ✅ Dữ liệu được lưu vào database qua API
- ✅ Global array `mxhAccounts` được cập nhật đồng bộ
- ✅ UI hiển thị giá trị mới ngay lập tức
- ✅ Thông báo toast hiển thị trạng thái
- ✅ Dữ liệu vẫn persistent sau khi refresh trang (do đã lưu vào DB)

### Cách test:
1. Click vào username/phone/card number để chỉnh sửa
2. Nhập giá trị mới và nhấn Enter
3. Kiểm tra giá trị hiển thị ngay lập tức (không có flicker)
4. Không có hiện tượng trang bị reload
5. Có thể tiếp tục chỉnh sửa các field khác liền mạch
6. Refresh trang thủ công để kiểm tra dữ liệu đã được lưu