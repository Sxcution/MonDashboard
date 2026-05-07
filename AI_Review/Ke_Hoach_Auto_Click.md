# KẾ HOẠCH TÍCH HỢP AUTO CLICK (MACRO) VÀO MON DASHBOARD

## 1. Mục Tiêu
Tích hợp khả năng điều khiển chuột và bàn phím tự động vào Dashboard để thao tác nhanh trên các app giả lập (ViewPhone, WeChat...) thông qua Menu của từng Card.

## 2. Tận Dụng Tài Nguyên Có Sẵn (AutoKey Codebase)
Qua rà soát thư mục `C:\Users\Mon\Desktop\Protect\Mon Apps\Main\Apps\AutoKey`, chúng ta đã có sẵn các module cực kỳ chất lượng để tái sử dụng, không cần code lại từ đầu:

| Module AutoKey | Đường dẫn gốc | Công dụng tái sử dụng |
| :--- | :--- | :--- |
| **`mouse_backend.py`** | `.../utils/mouse_backend.py` | Cung cấp class `MouseBackend` với hàm `move_absolute(x, y)` để di chuyển chuột chính xác pixel và `SendInput` để click. Đây là core engine. |
| **`window_utils.py`** | `.../utils/window_utils.py` | Hàm `get_foreground_window_rect()` giúp xác định vị trí cửa sổ ViewPhone để tính toạ độ tương đối (tránh click trượt khi cửa sổ bị di chuyển). |
| **`direct_input.py`** | `.../utils/direct_input.py` | Dùng để gửi phím tắt (nếu cần) một cách low-level (qua mặt được các anti-cheat hoặc app khó tính). |

**Giải pháp:**  
Copy nguyên thư mục `utils` của AutoKey sang `Mon Dashboard/app/core/automation` để tích hợp.

## 3. Kiến Trúc Hệ Thống (Frontend -> MySQL -> Backend -> AutoKey)

### Bước 1: Database (Lưu Toạ Độ)
Thêm các trường vào bảng `cards` hoặc tạo bảng riêng `card_macros` để lưu toạ độ đặc thù cho từng Card.
*   `wechat_icon_x`: Toạ độ X của icon WeChat trên ViewPhone.
*   `wechat_icon_y`: Toạ độ X của icon WeChat trên ViewPhone.
*   `viewphone_window_title`: Tên cửa sổ ViewPhone tương ứng (để tìm window).

### Bước 2: Frontend (UI/UX)
1.  **Chế độ Config (Setup):**
    *   Thêm nút **"Cài đặt Auto"** trên mỗi Card.
    *   Khi bấm: Dashboard sẽ hiện Overlay hướng dẫn *"Di chuột vào icon WeChat và bấm F8 để lưu"*.
    *   Frontend lắng nghe Global Hotkey hoặc gọi API chờ backend bắt toạ độ chuột hiện tại (`pyautogui.position()`).
2.  **Chế độ Run (Context Menu):**
    *   Thêm item **"Mở WeChat (Auto)"** vào Context Menu chuột phải.
    *   Khi click: Gọi API `/api/automation/open_app?card_id=34&app=wechat`.

### Bước 3: Backend (Flask Logic)
1.  **API `POST /api/automation/coordinate`**:
    *   Nhận `card_id` và toạ độ `(x, y)`. Loot vị trí chuột hiện tại và lưu vào DB.
2.  **API `POST /api/automation/execute`**:
    *   Nhận lệnh click.
    *   Lấy toạ độ từ DB.
    *   Kiểm tra cửa sổ ViewPhone có đang mở không (dùng `window_utils`).
    *   Active cửa sổ đó (dùng `pygetwindow` hoặc `ctypes`).
    *   Dùng `mouse_backend` di chuột đến và click đúp.

## 4. Kịch Bản Chi Tiết (Ví dụ: Card 34 mở WeChat)
1.  Người dùng click phải Card 34 -> "Mở WeChat".
2.  Backend đọc DB: Card 34 có toạ độ WeChat tại `(100, 200)` so với góc cửa sổ "ViewPhone-34".
3.  Backend tìm cửa sổ có tên "ViewPhone-34".
    *   Thấy cửa sổ đang ở vị trí màn hình `(500, 500)`.
    *   => Toạ độ thực tế cần click = `(500+100, 500+200) = (600, 700)`.
4.  Backend gọi `mouse_backend.move_absolute(600, 700)`.
5.  Backend gọi `mouse_backend.click()`.
6.  Xong phim.

## 5. Các Rủi Ro & Lưu Ý
*   **Resolution:** Nếu window ViewPhone bị thay đổi kích thước (resize), toạ độ sẽ sai. -> **Giải pháp:** Bắt buộc ViewPhone chạy ở size cố định hoặc tính toạ độ theo % tỷ lệ.
*   **Background:** Chuột thực tế sẽ bị chiếm quyền điều khiển trong 1-2 giây. User không nên di chuột lung tung lúc đang chạy lệnh.

## 6. Lộ Trình Thực Hiện (Dự kiến: 2-3h)
1.  **Phase 1:** Copy thư viện `utils` từ AutoKey sang Dashboard. Cài thêm `pyautogui`.
2.  **Phase 2:** Tạo API Backend (Lưu toạ độ, Thực thi Webhook).
3.  **Phase 3:** Làm UI "Setup toạ độ" trên Dashboard (nút bấm để bắt đầu mode capture).
4.  **Phase 4:** Test thực tế trên 1 Card.

---
*File báo cáo được tạo tự động bởi AI Assistant.*
