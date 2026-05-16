Bạn đang refactor repo Sxcution/MonDashboard.
C:\Users\Mon\Desktop\Protect\Mon Dashboard


MỤC TIÊU CHUNG
- Chuyển frontend JavaScript inline sang TypeScript dần dần.
- KHÔNG rewrite backend Python Flask.
- Giữ nguyên API hiện có.
- Refactor từng bước nhỏ, mỗi bước phải chạy được.
- Ưu tiên giảm độ phình của template HTML trước khi chuyển TypeScript sâu.

==================================================
MASTER RULE
==================================================

1. Không rewrite toàn bộ Flask backend.
2. Không đổi schema SQLite nếu không được yêu cầu.
3. Không đụng dữ liệu trong thư mục data/.
4. Không đổi API hiện có:
   - /notes/api/*
   - /mxh/api/*
   - /image/api/*
5. Không convert toàn bộ một lần.
6. Không thay đổi UI lớn nếu chưa cần.
7. Không tự ý thay đổi hành vi business logic.
8. Không tự ý xóa code cũ nếu chưa test tương thích.
9. Mọi bước phải build/test được trước khi tiếp tục.
10. Sau mỗi bước phải dừng lại và báo cáo.
11. Nếu chưa chắc chắn, chọn phương án ít phá cấu trúc hiện tại nhất.
12. Giữ Bootstrap hiện tại.
13. Chỉ refactor frontend trước, backend giữ ổn định.
14. Mục tiêu đầu tiên là:
    - giảm độ phình template
    - tách CSS
    - tách JS
    - giảm inline script/style
15. Chưa dùng React.
16. Sau khi frontend sạch hơn mới chuyển dần sang TypeScript modules.

==================================================
ĐÁNH GIÁ KIẾN TRÚC HIỆN TẠI
==================================================

Backend hiện tại:
- Flask + Blueprint
- SQLite
- OpenCV/Pillow
- API route đã bắt đầu chia module
=> backend nhìn chung đang đúng hướng.

Frontend hiện tại:
- HTML template đang quá lớn
- CSS inline quá nhiều
- JavaScript inline quá nhiều
- Một file ôm quá nhiều trách nhiệm

Ví dụ:
mxh.html hiện khoảng ~5865 dòng và đang chứa cùng lúc:
- HTML layout
- modal
- inline CSS
- inline JS
- animation
- render card
- search/filter
- auto refresh
- inline edit
- context menu
- WeChat logic
- badge logic
- flip card
- API call
- DOM manipulation

Đây là kiểu “all-in-one template”.
Lúc đầu làm nhanh, nhưng càng về sau càng khó:
- debug
- maintain
- refactor
- thêm feature
- chuyển TypeScript

==================================================
MỤC TIÊU REFACTOR GIAI ĐOẠN 1
==================================================

Mục tiêu giai đoạn đầu KHÔNG PHẢI rewrite toàn bộ frontend.

Mục tiêu đúng là:

1. Tách page-specific CSS khỏi template
2. Tách page-specific JS khỏi template
3. Giảm inline code
4. Giữ nguyên UI hiện tại
5. Giữ nguyên behavior hiện tại
6. Làm project dễ kiểm soát hơn
7. Sau đó mới chuyển dần sang TypeScript

==================================================
KIẾN TRÚC TÔI MUỐN
==================================================

MỨC 1 — TÁCH FILE CƠ BẢN

app/templates/mxh.html
app/static/css/mxh.css
app/static/js/mxh.js
app/static/css/style.css

Trong đó:

style.css:
- chỉ giữ:
  - global style
  - theme
  - navbar
  - base layout
  - shared utilities

mxh.css:
- toàn bộ CSS riêng tab MXH

mxh.js:
- toàn bộ JS riêng tab MXH

mxh.html:
- chỉ giữ:
  - HTML structure
  - modal HTML
  - container HTML
  - mount point
  - minimal inline script nếu thật sự cần

Sau khi tách:
mxh.html lý tưởng chỉ còn khoảng 500–1000 dòng.

==================================================
YÊU CẦU CHO mxh.html
==================================================

Trong mxh.html:
- loại bỏ phần lớn:
  - <style>
  - inline JS lớn
- load CSS/JS ngoài:

<link rel="stylesheet" href="{{ url_for('static', filename='css/mxh.css') }}">

<script src="{{ url_for('static', filename='js/mxh.js') }}"></script>

Nếu base.html có block scripts cuối body:
- ưu tiên load JS trong block scripts.

==================================================
GIAI ĐOẠN 2 — TÁCH JS SÂU HƠN
==================================================

Sau khi mxh.js vẫn quá lớn, tiếp tục tách:

app/static/js/mxh/state.js
- chứa:
  - mxhAccounts
  - mxhGroups
  - activeFilter
  - selectedAccount
  - state chung

app/static/js/mxh/api.js
- toàn bộ fetch API

app/static/js/mxh/render.js
- render card
- render badge
- render account
- render group

app/static/js/mxh/filters.js
- search
- filter
- sort

app/static/js/mxh/context-menu.js
- menu chuột phải

app/static/js/mxh/inline-edit.js
- inline edit card/account

app/static/js/mxh/flip-card.js
- flipCardToAccount
- flip animation logic

app/static/js/mxh/init.js
- startup
- bind event
- initialize page

==================================================
QUAN TRỌNG
==================================================

KHÔNG nhảy thẳng tới kiến trúc phức tạp ngay.

Làm theo thứ tự:
1. tách mxh.css
2. tách mxh.js
3. test ổn
4. mới tách sâu tiếp

==================================================
YÊU CẦU GIỮ NGUYÊN HÀNH VI
==================================================

Sau refactor, phải giữ nguyên:
- search
- filter
- sort
- card flip
- context menu
- inline edit
- badge
- auto refresh
- WeChat logic
- modal behavior
- animation
- Bootstrap behavior

Không được làm thay đổi UX hiện tại.

==================================================
VỀ CSS
==================================================

Hiện tại:
- style.css đang ôm quá nhiều thứ:
  - global
  - MXH
  - Notes
  - Image
  - page-specific style

Điều này không tốt.

Mục tiêu:
- style.css chỉ giữ global/shared.
- page-specific CSS phải tách riêng.

KHÔNG ưu tiên xóa !important trước.

Lý do:
Khi CSS còn trộn lẫn:
- rất khó debug
- rất khó biết lỗi do:
  - HTML
  - CSS
  - JS

Cách an toàn:
1. tách CSS trước
2. test ổn
3. sau đó mới cleanup !important

==================================================
VỀ NOTES
==================================================

notes.html cũng đang quá lớn (~3200 dòng).

Nhưng:
Notes phức tạp hơn MXH vì có:
- editor
- selection
- profile span
- image preview
- code preview
- rich content

=> dễ vỡ hơn.

THỨ TỰ ĐÚNG:
1. Refactor MXH trước
2. Tách CSS/JS MXH
3. Test kỹ MXH
4. Sau đó mới xử lý Notes

==================================================
TYPECRIPT ROADMAP
==================================================

Sau khi frontend sạch hơn:

BƯỚC TIẾP:
- tạo frontend TypeScript structure
- dùng Vite vanilla-ts
- chuyển JS modules dần sang TS

Ví dụ tương lai:

frontend/src/api/
frontend/src/types/
frontend/src/mxh/
frontend/src/image-editor/

Nhưng CHƯA làm ngay lúc này.

==================================================
MỤC TIÊU CUỐI
==================================================

Mục tiêu cuối cùng:
- frontend dễ maintain
- giảm inline JS/CSS
- dễ debug
- dễ chuyển TypeScript
- dễ mở rộng image editor
- dễ thêm feature mới
- giảm phụ thuộc template khổng lồ

==================================================
TASK HIỆN TẠI
==================================================

Chỉ thực hiện:
1. Tách mxh.html:
   - tách CSS sang app/static/css/mxh.css
   - tách JS sang app/static/js/mxh.js
2. Giữ nguyên UI/behavior.
3. Không refactor Notes.
4. Không chuyển TypeScript ở bước này.
5. Không đổi API/backend.
6. Sau khi xong:
   - báo danh sách file đã sửa
   - báo những inline CSS/JS nào còn lại
   - báo những phần nào nên tách tiếp
   - dừng lại chờ lệnh tiếp theo.
   ----------------------------------------------------------------------------------------------------------------------------------------------
   
==================================================
CẬP NHẬT TIẾN ĐỘ REFACTOR MXH
==================================================

Trạng thái hiện tại:
- Đang ở Giai đoạn 1: làm sạch frontend MXH trước khi chuyển TypeScript.
- Chưa chuyển TypeScript.
- Chưa refactor Notes.
- Chưa đổi backend Flask.
- Chưa đổi API hiện có.
- Chưa đổi schema SQLite.
- Chưa đụng dữ liệu trong thư mục data/.

--------------------------------------------------
BƯỚC 1 - ĐÃ HOÀN THÀNH
--------------------------------------------------

Đã tách mxh.html thành các file riêng:

1. app/templates/mxh.html
   - Giữ lại HTML structure, modal HTML, container HTML.
   - Đã bỏ block <style> lớn.
   - Đã bỏ 2 block <script> lớn.
   - Đã load CSS riêng:
     <link rel="stylesheet" href="{{ url_for('static', filename='css/mxh.css') }}">
   - Đã load JS riêng trong block scripts:
     <script src="{{ url_for('static', filename='js/mxh.js') }}"></script>
   - Sau refactor còn khoảng 557 dòng.

2. app/static/css/mxh.css
   - Chứa CSS riêng của trang MXH.
   - Đã chuyển CSS inline lớn từ mxh.html sang đây.
   - Đã chuyển tiếp các inline style còn lại trong template sang class CSS.

3. app/static/js/mxh.js
   - Chứa JS riêng của trang MXH.
   - Đã chuyển 2 block script lớn từ mxh.html sang đây.
   - Đã chuyển các handler onclick còn lại trong template sang event listener:
     - mxh-submit-notice-btn -> submitNotice()
     - btn-reset-scan-history -> resetScanHistory(this)

Kết quả sau bước 1:
- mxh.html không còn <style> inline.
- mxh.html không còn <script> inline lớn.
- mxh.html không còn style=.
- mxh.html không còn onclick=.
- mxh.html không còn inline on...= trong template.
- UI/behavior hiện tại được giữ nguyên theo hướng tách cơ học, ít thay đổi logic nhất.

Đã kiểm tra:
- node --check app/static/js/mxh.js: OK
- python -m compileall app: OK
- Jinja parse mxh.html: OK
- Jinja render smoke với stub url_for/request: OK
- git diff --check: OK

Ghi chú kiểm tra:
- Không chạy Flask app thật vì create_app() gọi ensure_database(), có thể chạm vào data/.
- Giữ đúng rule: không đụng dữ liệu trong thư mục data/.

--------------------------------------------------
INLINE CÒN LẠI
--------------------------------------------------

Trong mxh.html:
- Không còn inline style=.
- Không còn onclick=.
- Không còn inline script lớn.
- Không còn inline style block.

Trong mxh.js:
- Vẫn còn inline style= trong các HTML string do render logic tạo ra.
- Vẫn còn onclick= trong các HTML string do render logic tạo ra.
- Các phần này chưa xử lý ở bước 1 để tránh thay đổi behavior quá rộng.

Các cụm còn inline trong mxh.js nên xử lý dần:
- renderGroupsNav
- render stats badge
- renderCardFace
- render account/card HTML
- context menu HTML
- phone history HTML
- scan history HTML
- notice preview HTML

--------------------------------------------------
ĐANG Ở GIAI ĐOẠN NÀO
--------------------------------------------------

Giai đoạn 1 gần hoàn tất phần tách file cơ bản:

Đã xong:
1. Tách CSS riêng MXH.
2. Tách JS riêng MXH.
3. Giảm mạnh độ phình mxh.html.
4. Dọn inline style/onclick trong template MXH.

Chưa làm:
1. Chưa tách sâu mxh.js thành nhiều module nhỏ.
2. Chưa chuyển sang TypeScript.
3. Chưa cleanup toàn bộ inline style trong HTML string render.
4. Chưa cleanup style.css global/shared.
5. Chưa refactor Notes.

--------------------------------------------------
BƯỚC TIẾP THEO ĐỀ XUẤT
--------------------------------------------------

Bước tiếp theo nên làm nhỏ, an toàn:

1. Xử lý inline trong mxh.js theo từng cụm render nhỏ.
   Ưu tiên thứ tự:
   - renderGroupsNav
   - stats badge
   - scan history HTML
   - phone history HTML
   - context menu HTML

2. Không tách module ngay nếu mxh.js vẫn còn nhiều inline render string.
   Lý do:
   - Nếu tách module quá sớm, rất dễ kéo theo dependency global phức tạp.
   - Nên làm sạch render HTML trước, rồi mới tách file sâu.

3. Sau khi mxh.js sạch hơn, mới tách tiếp:
   - app/static/js/mxh/state.js
   - app/static/js/mxh/api.js
   - app/static/js/mxh/render.js
   - app/static/js/mxh/filters.js
   - app/static/js/mxh/context-menu.js
   - app/static/js/mxh/inline-edit.js
   - app/static/js/mxh/flip-card.js
   - app/static/js/mxh/init.js

4. Sau khi các module JS ổn định, mới bắt đầu roadmap TypeScript/Vite.

--------------------------------------------------
NGUYÊN TẮC CHO BƯỚC TIẾP THEO
--------------------------------------------------

- Mỗi lần chỉ xử lý một cụm nhỏ trong mxh.js.
- Không đổi API/backend.
- Không đổi business logic.
- Không đổi UI lớn.
- Sau mỗi cụm phải chạy:
  - node --check app/static/js/mxh.js
  - Jinja parse/render smoke nếu có sửa template
  - python -m compileall app nếu có lý do cần kiểm tra toàn repo
- Xong mỗi bước phải dừng lại báo cáo.

--------------------------------------------------
CẬP NHẬT BỔ SUNG - BƯỚC 2 ĐÃ HOÀN THÀNH
--------------------------------------------------

Đã làm tiếp sau Bước 1:

1. Làm sạch inline trong app/static/js/mxh.js
   - Đã bỏ toàn bộ style= trong HTML string render.
   - Đã bỏ toàn bộ onclick= trong HTML string render.
   - Đã bỏ các inline handler còn lại:
     - onblur=
     - onkeydown=
     - oncontextmenu=
     - onfocus=

2. Chuyển inline render style sang class CSS trong app/static/css/mxh.css
   Các nhóm đã chuyển:
   - card top badge
   - group badge
   - platform/group icon color
   - scan countdown
   - nearby countdown
   - notice line
   - disabled/die info
   - card layout/card body
   - editable field style
   - stats panel item style
   - context menu item/icon style
   - phone history row/button style
   - scan history row style
   - notice preview content style

3. Chuyển inline JS handler sang delegated event listener
   - Group select trong renderGroupsNav:
     data-mxh-select-group + click listener
   - Stats quick filter:
     data-quick-filter + delegated click listener
   - Phone history copy:
     data-copy-phone + delegated click listener
   - Card context menu:
     data-card-id/data-account-id/data-platform + delegated contextmenu listener
   - Inline edit:
     editable-field data-field/data-account-id + delegated blur/keydown listener

Kết quả hiện tại:
- app/templates/mxh.html còn khoảng 557 dòng.
- app/static/css/mxh.css khoảng 1018 dòng.
- app/static/js/mxh.js khoảng 4867 dòng.
- mxh.html không còn inline style/script/onclick.
- mxh.js không còn HTML string chứa style=.
- mxh.js không còn HTML string chứa onclick=.
- mxh.js không còn HTML string chứa onblur/onkeydown/oncontextmenu/onfocus.

Đã kiểm tra sau Bước 2:
- node --check app/static/js/mxh.js: OK
- python -m compileall app: OK
- Jinja parse mxh.html: OK
- Jinja render smoke với stub url_for/request: OK
- git diff --check: OK
- rg kiểm tra inline event/style trong mxh.html + mxh.js: 0 kết quả

Ghi chú:
- Vẫn không chạy Flask app thật vì create_app() gọi ensure_database(), có thể chạm data/.
- Không đổi backend.
- Không đổi API.
- Không đổi schema SQLite.
- Không refactor Notes.
- Chưa chuyển TypeScript.

--------------------------------------------------
ĐANG DỪNG Ở ĐÂU
--------------------------------------------------

Đã hoàn thành phần sạch template và sạch inline render cơ bản của MXH.

Điểm dừng hiện tại là trước bước phức tạp:
- Tách app/static/js/mxh.js thành nhiều module nhỏ.

Lý do đây là bước phức tạp:
- mxh.js hiện còn nhiều biến global dùng chéo nhau.
- render, state, API, inline edit, context menu, auto refresh đang phụ thuộc lẫn nhau.
- Nếu tách module vội, dễ vỡ behavior:
  - auto refresh
  - inline edit
  - card flip
  - context menu
  - WeChat scan/nearby logic
  - badge/notice preview

--------------------------------------------------
BƯỚC TIẾP THEO ĐỀ XUẤT
--------------------------------------------------

Bước tiếp theo nên là chuẩn bị tách module, không chuyển TypeScript ngay:

1. Vẽ dependency map nhẹ cho mxh.js
   - nhóm state global
   - nhóm API fetch
   - nhóm render
   - nhóm event binding
   - nhóm WeChat helpers
   - nhóm context menu
   - nhóm inline edit
   - nhóm notice/badge preview

2. Tách file đầu tiên ít rủi ro:
   app/static/js/mxh/api.js
   - chỉ chứa fetch wrapper/API call thuần
   - chưa động vào render/state sâu nếu chưa cần

3. Sau đó tách tiếp:
   app/static/js/mxh/state.js
   app/static/js/mxh/render.js
   app/static/js/mxh/context-menu.js
   app/static/js/mxh/inline-edit.js
   app/static/js/mxh/notice-preview.js
   app/static/js/mxh/init.js

4. Chỉ sau khi module JS ổn định mới tạo roadmap TypeScript/Vite.

--------------------------------------------------
CẬP NHẬT BỔ SUNG - BƯỚC 3 ĐÃ HOÀN THÀNH
--------------------------------------------------

Đã bắt đầu bước phức tạp theo hướng an toàn:
- Chưa chuyển sang ES module.
- Chưa chuyển TypeScript.
- Chưa đổi backend/API.
- Chưa tách state/render sâu.
- Chỉ tách lớp API ra trước bằng classic script global để giảm rủi ro scope.

Đã tạo file mới:

1. app/static/js/mxh/api.js
   - Tạo global window.MXHApi.
   - Gom endpoint/fetch logic của MXH vào một nơi.
   - Các nhóm API đã đưa vào:
     - groups
     - accounts
     - cards
     - sub accounts
     - move account
     - status/toggle status
     - scan/reset scan
     - rescue
     - notice
     - notice preview fallback endpoints
     - phone history
     - scan history
     - nearby people

Đã cập nhật template:

1. app/templates/mxh.html
   - Load API helper trước mxh.js:
     <script src="{{ url_for('static', filename='js/mxh/api.js') }}"></script>
     <script src="{{ url_for('static', filename='js/mxh.js') }}"></script>

Đã cập nhật app/static/js/mxh.js:
- Không còn gọi fetch() trực tiếp.
- Toàn bộ fetch trực tiếp đã chuyển sang MXHApi.
- Endpoint/fetch logic /mxh/api/* đã chuyển sang api.js.
- mxh.js chỉ còn một chuỗi log debug có chứa /mxh/api/accounts/...; không còn fetch trực tiếp.
- mxh.js vẫn giữ state/render/event logic hiện tại để tránh vỡ behavior.

Kết quả hiện tại:
- app/templates/mxh.html khoảng 558 dòng.
- app/static/css/mxh.css khoảng 1018 dòng.
- app/static/js/mxh/api.js khoảng 176 dòng.
- app/static/js/mxh.js khoảng 4726 dòng.

Đã kiểm tra sau Bước 3:
- node --check app/static/js/mxh/api.js: OK
- node --check app/static/js/mxh.js: OK
- python -m compileall app: OK
- Jinja parse mxh.html: OK
- Jinja render smoke với stub url_for/request: OK
- git diff --check: OK
- Kiểm tra mxh.html + mxh.js:
  - không còn style=
  - không còn onclick=
  - không còn onblur/onkeydown/oncontextmenu/onfocus
  - không còn fetch()

--------------------------------------------------
ĐANG DỪNG Ở ĐÂU SAU BƯỚC 3
--------------------------------------------------

Đã hoàn thành bước tách API helper đầu tiên.

Điểm phức tạp tiếp theo:
- Tách state.js và render.js.

Lý do phức tạp hơn API:
- state hiện dùng nhiều biến let/const trong mxh.js:
  - mxhGroups
  - mxhAccounts
  - currentContextAccountId
  - currentContextCardId
  - activeGroupId
  - activeFilter
  - activeViewFilter
  - cardStates
  - lockedStates
  - forceFullRebuildOnce
  - render/refresh flags
- render và event handler đang đọc/ghi trực tiếp các biến này.
- Nếu tách state ngay mà không có wrapper rõ ràng, dễ vỡ:
  - auto refresh
  - quick filter
  - card flip
  - inline edit
  - context menu

Bước tiếp theo đề xuất:

1. Tách state bằng wrapper trước, không chuyển toàn bộ biến ngay:
   app/static/js/mxh/state.js
   - tạo window.MXHState
   - đưa cardStates/lockedStates và các hàm:
     - getCardState
     - setCardState
     - requestFullRebuild
   - đây là phần ít phụ thuộc DOM hơn render.

2. Sau khi state wrapper ổn mới tách render:
   app/static/js/mxh/render.js
   - renderGroupsNav
   - updateStatsPanels
   - renderMXHAccounts
   - renderCardFace

3. Chưa nên tách TypeScript/Vite ở thời điểm này.

--------------------------------------------------
BƯỚC 4 - ĐÃ HOÀN THÀNH
--------------------------------------------------

Đã làm tiếp sau Bước 3:

1. Tạo app/static/js/mxh/state.js
   - Tạo global window.MXHState.
   - Chuyển phần state ít phụ thuộc DOM ra khỏi mxh.js:
     - cardStates
     - lockedStates
     - forceFullRebuildOnce
   - Chuyển các helper state:
     - getCardState
     - setCardState
     - deleteCardState
     - clearCardActiveAccounts
     - requestFullRebuild
     - consumeFullRebuild
   - mxh.js dùng MXHState thông qua alias để giữ behavior cũ.

2. Tạo app/static/js/mxh/utils.js
   - Tạo global window.MXHUtils.
   - Chuyển các helper thuần, ít phụ thuộc DOM:
     - areGroupsEqual
     - debounce
     - throttle
     - escapeHtml
     - getPlatformColor
     - getPlatformIconClass
     - getContainerTypeIcon
     - getContainerTypeColorClass
     - getContainerTypeTitle
   - mxh.js dùng MXHUtils thông qua alias.

3. Cập nhật app/templates/mxh.html
   - Load helper theo thứ tự:
     <script src="{{ url_for('static', filename='js/mxh/utils.js') }}"></script>
     <script src="{{ url_for('static', filename='js/mxh/state.js') }}"></script>
     <script src="{{ url_for('static', filename='js/mxh/api.js') }}"></script>
     <script src="{{ url_for('static', filename='js/mxh.js') }}"></script>
   - Thứ tự này giữ mxh.js luôn chạy sau utils/state/api.

Kết quả hiện tại:
- app/templates/mxh.html khoảng 560 dòng.
- app/static/css/mxh.css khoảng 1018 dòng.
- app/static/js/mxh/utils.js khoảng 101 dòng.
- app/static/js/mxh/state.js khoảng 69 dòng.
- app/static/js/mxh/api.js khoảng 176 dòng.
- app/static/js/mxh.js khoảng 4605 dòng.

Đã kiểm tra sau Bước 4:
- node --check app/static/js/mxh/utils.js: OK
- node --check app/static/js/mxh/state.js: OK
- node --check app/static/js/mxh/api.js: OK
- node --check app/static/js/mxh.js: OK
- python -m compileall app: OK
- Jinja parse mxh.html: OK
- Jinja render smoke với stub url_for/request: OK
- git diff --check: OK, chỉ có warning line ending LF/CRLF của Git cho mxh.html.
- Kiểm tra mxh.html + mxh.js:
  - không còn style=
  - không còn onclick=
  - không còn onblur/onkeydown/oncontextmenu/onfocus
  - không còn fetch() trong mxh.js

--------------------------------------------------
ĐANG Ở ĐÂU SAU BƯỚC 4
--------------------------------------------------

Đã hoàn thành các phần tách an toàn:
1. CSS riêng MXH.
2. JS riêng MXH.
3. Dọn inline trong template.
4. Dọn inline handler/style trong HTML string của mxh.js.
5. Tách API helper.
6. Tách state wrapper nhỏ.
7. Tách pure utils.

Chưa làm:
1. Chưa tách render.js.
2. Chưa tách context-menu.js.
3. Chưa tách inline-edit.js.
4. Chưa tách flip-card.js.
5. Chưa tách init.js.
6. Chưa chuyển TypeScript/Vite.
7. Chưa cleanup style.css global/shared.
8. Chưa refactor Notes.

Điểm phức tạp tiếp theo:
- Tách render.js là bước lớn hơn vì render đang phụ thuộc nhiều biến trạng thái và event handler:
  - mxhAccounts
  - mxhGroups
  - activeGroupId
  - activeFilter
  - activeViewFilter
  - selected/hover/context state
  - scheduleRender
  - inline edit
  - card flip
  - context menu
  - badge/notice/WeChat logic

Bước tiếp theo nên làm:
1. Trước khi tách render.js, lập dependency map cho các hàm render chính:
   - renderGroupsNav
   - updateStatsPanels
   - renderMXHAccounts
   - renderCardFace
2. Sau đó tách render theo wrapper global window.MXHRender, chưa dùng ES module.
3. Chỉ khi render wrapper chạy ổn mới tách context-menu/inline-edit/flip-card.
4. Vẫn chưa nên chuyển TypeScript ở bước kế tiếp.

--------------------------------------------------
BƯỚC 5 - ĐÃ LẬP DEPENDENCY MAP, CHƯA TÁCH RENDER
--------------------------------------------------

Đã đọc các hàm render chính trong app/static/js/mxh.js:
- renderGroupsNav
- renderCardFace
- updateStatsPanels
- renderMXHAccounts

Dependency map sơ bộ:

1. renderGroupsNav
   - Đọc state:
     - mxhAccounts
     - mxhGroups
     - activeGroupId
   - Gọi helper:
     - calculateGroupBadge
     - getGroupBadgeMarkup
     - getPlatformIconClass
     - escapeHtml
     - applyMXHDynamicStyles
     - updateMainNavBadge
     - selectGroup
   - Đụng DOM:
     - #mxh-groups-nav
     - innerHTML
     - addEventListener cho data-mxh-select-group

2. renderCardFace
   - Đọc account/card data:
     - account
     - allAccounts
     - card_id
     - platform
     - status
     - notice
     - WeChat date/scan/nearby fields
   - Gọi helper:
     - getAccountBorderClass
     - getPlatformIconClass
     - getPlatformColor
     - getContainerTypeIcon
     - getContainerTypeColorClass
     - getContainerTypeTitle
     - ensureNoticeParsed
     - calculateTimeDifferenceInHours
     - canScanWeChat
     - canScanWeChatHK
     - isNearbyPeopleActive
     - escapeHtml
   - Trả HTML string có nhiều class/data attribute phục vụ event delegation.

3. updateStatsPanels
   - Nhận tabAccounts.
   - Đọc state:
     - activeFilter
   - Gọi helper:
     - getAccountCreatedDateForStats
     - isAccountDisabledForStats
     - calculateTimeDifferenceInHours
     - canScanWeChat
     - canScanWeChatHK
     - ensureNoticeParsed
     - needsHongKongNumber
     - isNearbyPeopleActive
   - Đụng DOM:
     - #mxh-stats-accounts
     - #mxh-stats-cards
     - innerHTML
     - addEventListener click cho stats-clickable

4. renderMXHAccounts
   - Đọc/ghi render flags:
     - isInitialRenderComplete
     - lastRenderedGroupId
     - isRendering
   - Đọc state:
     - mxhAccounts
     - activeGroupId
     - activeViewFilter
     - mxhSearchQuery
   - Gọi helper:
     - isMXHInlineEditing
     - updateStatsPanels
     - MXHState.consumeFullRebuild
     - getCardState
     - getCardBadge
     - renderCardFace
     - applyMXHDynamicStyles
     - initializeTooltips
     - updateCardVisibility
   - Đụng DOM:
     - #mxh-accounts-container
     - innerHTML

Kết luận sau map:
- Chưa nên tách render.js bằng cách copy thẳng hàm vì sẽ kéo theo quá nhiều biến private trong mxh.js.
- Bước tách render cần một wrapper rõ ràng, ví dụ:
  - window.MXHRender.renderGroupsNav(ctx)
  - window.MXHRender.renderCardFace(ctx, account, allAccounts, side)
  - window.MXHRender.updateStatsPanels(ctx, tabAccounts)
  - window.MXHRender.renderMXHAccounts(ctx, options)
- ctx cần truyền state/getter/helper cần thiết thay vì để render.js đọc global rải rác.
- Đây là điểm phức tạp tiếp theo, nên dừng trước khi tách render để tránh vỡ behavior.

--------------------------------------------------
BƯỚC 6 - ĐÃ TÁCH RENDER CORE
--------------------------------------------------

Đã làm tiếp sau Bước 5:

1. Tạo app/static/js/mxh/render.js
   - Tạo global window.MXHRender.
   - Chuyển các hàm render core sang render.js:
     - getGroupBadgeMarkup
     - renderGroupsNav
     - renderCardFace
     - updateStatsPanels
     - renderMXHAccounts

2. Cập nhật app/static/js/mxh.js
   - Thêm getRenderContext().
   - getRenderContext truyền state/helper cần thiết cho MXHRender bằng getter/delegate.
   - mxh.js vẫn giữ các function name cũ để các call site hiện tại không đổi:
     - renderGroupsNav()
     - renderCardFace()
     - updateStatsPanels()
     - renderMXHAccounts()
   - Các function này hiện chỉ delegate sang MXHRender.
   - Không đổi API/backend/business logic.

3. Cập nhật app/templates/mxh.html
   - Load render.js trước mxh.js:
     <script src="{{ url_for('static', filename='js/mxh/render.js') }}"></script>

Kết quả hiện tại:
- app/templates/mxh.html khoảng 561 dòng.
- app/static/css/mxh.css khoảng 1018 dòng.
- app/static/js/mxh/utils.js khoảng 101 dòng.
- app/static/js/mxh/state.js khoảng 69 dòng.
- app/static/js/mxh/api.js khoảng 176 dòng.
- app/static/js/mxh/render.js khoảng 562 dòng.
- app/static/js/mxh.js khoảng 4122 dòng.

Đã kiểm tra sau Bước 6:
- node --check app/static/js/mxh/utils.js: OK
- node --check app/static/js/mxh/state.js: OK
- node --check app/static/js/mxh/api.js: OK
- node --check app/static/js/mxh/render.js: OK
- node --check app/static/js/mxh.js: OK
- python -m compileall app: OK
- Jinja render smoke với stub url_for/request: OK
- Thứ tự load script OK:
  - utils.js
  - state.js
  - api.js
  - render.js
  - mxh.js
- git diff --check: OK, chỉ có warning LF/CRLF của Git cho mxh.html.
- Kiểm tra mxh.html + mxh.js + render.js:
  - không còn style=
  - không còn onclick=
  - không còn onblur/onkeydown/oncontextmenu/onfocus
  - không còn fetch() ngoài api.js

Đang ở đâu sau Bước 6:
- Giai đoạn 2 đã bắt đầu theo hướng classic global wrapper, chưa dùng ES module.
- render.js đã tách được phần render core.
- mxh.js vẫn còn lớn vì còn:
  - context menu
  - modal submit/edit/delete/move
  - inline edit
  - phone history
  - scan history
  - notice preview
  - init/event binding
  - filter/updateCardVisibility

Bước tiếp theo nên làm:
1. Tách context menu thành app/static/js/mxh/context-menu.js.
2. Sau đó tách inline edit thành app/static/js/mxh/inline-edit.js.
3. Sau đó tách phone/scan history hoặc init/event binding.
4. Vẫn chưa chuyển TypeScript/Vite ở bước kế tiếp.

--------------------------------------------------
BƯỚC 7 - ĐÃ TÁCH CARD CONTEXT MENU
--------------------------------------------------

Đã làm tiếp sau Bước 6:

1. Tạo app/static/js/mxh/context-menu.js
   - Tạo global window.MXHContextMenu.
   - Chuyển phần dựng/hiển thị card context menu ra khỏi mxh.js:
     - showCardContextMenu
     - positionContextMenuSmart
     - bindSubmenuPositioning
     - hideCardContextMenu
   - Giữ các data-action hiện có để click handler cũ vẫn hoạt động:
     - switch-account
     - add-sub-*
     - status-*
     - scan-wechat
     - scan-history
     - reset-scan
     - delete
     - edit
     - copy-phone
     - nearby-active
     - toggle-notice
     - cancel-notice
     - move-account

2. Cập nhật app/static/js/mxh.js
   - window.handleCardContextMenu hiện delegate sang MXHContextMenu.showCardContextMenu.
   - positionContextMenuSmart hiện delegate sang MXHContextMenu.positionContextMenuSmart.
   - hideCardContextMenu hiện delegate sang MXHContextMenu.hideCardContextMenu.
   - Submenu hover positioning chuyển sang MXHContextMenu.bindSubmenuPositioning(document).
   - Click action handler vẫn giữ trong mxh.js để chưa kéo theo modal/API/edit/delete/move.

3. Cập nhật app/templates/mxh.html
   - Load context-menu.js trước mxh.js:
     <script src="{{ url_for('static', filename='js/mxh/context-menu.js') }}"></script>

Kết quả hiện tại:
- app/templates/mxh.html khoảng 562 dòng.
- app/static/css/mxh.css khoảng 1018 dòng.
- app/static/js/mxh/utils.js khoảng 101 dòng.
- app/static/js/mxh/state.js khoảng 69 dòng.
- app/static/js/mxh/api.js khoảng 176 dòng.
- app/static/js/mxh/render.js khoảng 562 dòng.
- app/static/js/mxh/context-menu.js khoảng 276 dòng.
- app/static/js/mxh.js khoảng 3850 dòng.

Đã kiểm tra sau Bước 7:
- node --check toàn bộ JS MXH hiện tại: OK
  - utils.js
  - state.js
  - api.js
  - render.js
  - context-menu.js
  - mxh.js
- python -m compileall app: OK
- Jinja render smoke với stub url_for/request: OK
- Thứ tự load script OK:
  - utils.js
  - state.js
  - api.js
  - render.js
  - context-menu.js
  - mxh.js
- git diff --check: OK, chỉ có warning LF/CRLF của Git cho mxh.html.
- Kiểm tra mxh.html + mxh.js + render.js + context-menu.js:
  - không còn style=
  - không còn onclick=
  - không còn onblur/onkeydown/oncontextmenu/onfocus
  - không còn fetch() ngoài api.js

Đang ở đâu sau Bước 7:
- render core đã tách.
- card context menu đã tách phần UI/position.
- mxh.js vẫn còn các action handler của context menu để giữ ổn định.

Bước tiếp theo nên làm:
1. Tách inline-edit.js vì phần này đang còn khá độc lập:
   - saveInlineField
   - bindInlineEditEvents
   - editable-field focus/blur/keydown
2. Sau đó mới tách action handler của context menu hoặc modal logic.
3. Chưa chuyển TypeScript/Vite.

--------------------------------------------------
BƯỚC 11 - ĐÃ TÁCH FILTER CORE
--------------------------------------------------

Đã làm tiếp sau Bước 10:

1. Tạo app/static/js/mxh/filters.js
   - Tạo global window.MXHFilters.
   - Chuyển filter core:
     - applyQuickFilter
     - updateCardVisibility
   - Giữ nguyên behavior:
     - quick stat filter
     - search dimming
     - filter dimming
     - sort theo creation_date/creation_date_newest
     - active filter class

2. Cập nhật app/static/js/mxh.js
   - applyQuickFilter delegate sang MXHFilters.applyQuickFilter.
   - updateCardVisibility delegate sang MXHFilters.updateCardVisibility.
   - getRenderContext thêm setter cho:
     - activeFilter
     - activeViewFilter
     - mxhSearchQuery

3. Cập nhật app/templates/mxh.html
   - Load thêm:
     <script src="{{ url_for('static', filename='js/mxh/filters.js') }}"></script>

Kết quả hiện tại:
- app/templates/mxh.html khoảng 567 dòng.
- app/static/css/mxh.css khoảng 1018 dòng.
- app/static/js/mxh/utils.js khoảng 101 dòng.
- app/static/js/mxh/state.js khoảng 69 dòng.
- app/static/js/mxh/api.js khoảng 176 dòng.
- app/static/js/mxh/filters.js khoảng 169 dòng.
- app/static/js/mxh/render.js khoảng 562 dòng.
- app/static/js/mxh/context-menu.js khoảng 276 dòng.
- app/static/js/mxh/inline-edit.js khoảng 246 dòng.
- app/static/js/mxh/phone-history.js khoảng 132 dòng.
- app/static/js/mxh/scan-history.js khoảng 82 dòng.
- app/static/js/mxh/notice-preview.js khoảng 234 dòng.
- app/static/js/mxh.js khoảng 3035 dòng.

Đã kiểm tra sau Bước 11:
- node --check toàn bộ JS MXH hiện tại: OK
- python -m compileall app: OK
- Jinja render smoke với stub url_for/request: OK
- Thứ tự load script OK:
  - utils.js
  - state.js
  - api.js
  - filters.js
  - render.js
  - context-menu.js
  - inline-edit.js
  - phone-history.js
  - scan-history.js
  - notice-preview.js
  - mxh.js
- git diff --check: OK, chỉ có warning LF/CRLF của Git cho mxh.html.
- Kiểm tra mxh.html + các JS đã tách:
  - không còn style=
  - không còn onclick=
  - không còn onblur/onkeydown/oncontextmenu/onfocus
  - không còn fetch() ngoài api.js

Đang ở đâu sau Bước 11:
- Phần core render/filter/api/history/inline/context/notice đã tách.
- mxh.js còn khoảng 3035 dòng.
- Phần còn lại chủ yếu là:
  - DOMContentLoaded init/event binding
  - modal CRUD account/card
  - context menu action handler
  - WeChat modal/apply/reset logic
  - background context menu/view filter
  - legacy submenu helpers

Bước tiếp theo nên làm:
1. Dừng ở đây để test thủ công MXH kỹ trong browser trước khi tách modal/action handler.
2. Nếu tiếp tục, bước phức tạp kế là modal/account-actions.js vì đụng nhiều flow create/update/delete/move/reset.
3. Chưa chuyển TypeScript/Vite.

--------------------------------------------------
BƯỚC 10 - ĐÃ TÁCH NOTICE PREVIEW
--------------------------------------------------

Đã làm tiếp sau Bước 9:

1. Tạo app/static/js/mxh/notice-preview.js
   - Tạo global window.MXHNoticePreview.
   - Chuyển IIFE notice preview ra khỏi mxh.js:
     - hover preview
     - click action preview
     - position preview theo badge
     - nút Ok
     - nút Tắt Thông Báo
   - Vẫn dùng MXHApi:
     - getNoticeData
     - disableNotice

2. Cập nhật app/static/js/mxh.js
   - Khối IIFE notice preview lớn được thay bằng:
     MXHNoticePreview.init(getRenderContext());
   - getRenderContext thêm showAlert wrapper để giữ fallback cũ.

3. Cập nhật app/templates/mxh.html
   - Load thêm:
     <script src="{{ url_for('static', filename='js/mxh/notice-preview.js') }}"></script>

Kết quả hiện tại:
- app/templates/mxh.html khoảng 566 dòng.
- app/static/css/mxh.css khoảng 1018 dòng.
- app/static/js/mxh/utils.js khoảng 101 dòng.
- app/static/js/mxh/state.js khoảng 69 dòng.
- app/static/js/mxh/api.js khoảng 176 dòng.
- app/static/js/mxh/render.js khoảng 562 dòng.
- app/static/js/mxh/context-menu.js khoảng 276 dòng.
- app/static/js/mxh/inline-edit.js khoảng 246 dòng.
- app/static/js/mxh/phone-history.js khoảng 132 dòng.
- app/static/js/mxh/scan-history.js khoảng 82 dòng.
- app/static/js/mxh/notice-preview.js khoảng 234 dòng.
- app/static/js/mxh.js khoảng 3220 dòng.

Đã kiểm tra sau Bước 10:
- node --check toàn bộ JS MXH hiện tại: OK
- python -m compileall app: OK
- Jinja render smoke với stub url_for/request: OK
- Thứ tự load script OK:
  - utils.js
  - state.js
  - api.js
  - render.js
  - context-menu.js
  - inline-edit.js
  - phone-history.js
  - scan-history.js
  - notice-preview.js
  - mxh.js
- git diff --check: OK, chỉ có warning LF/CRLF của Git cho mxh.html.
- Kiểm tra mxh.html + các JS đã tách:
  - không còn style=
  - không còn onclick=
  - không còn onblur/onkeydown/oncontextmenu/onfocus
  - không còn fetch() ngoài api.js

Đang ở đâu sau Bước 10:
- mxh.js đã giảm từ template khổng lồ xuống còn khoảng 3220 dòng JS chính.
- Các phần đã có file riêng:
  - css/mxh.css
  - js/mxh/utils.js
  - js/mxh/state.js
  - js/mxh/api.js
  - js/mxh/render.js
  - js/mxh/context-menu.js
  - js/mxh/inline-edit.js
  - js/mxh/phone-history.js
  - js/mxh/scan-history.js
  - js/mxh/notice-preview.js

Bước tiếp theo nên làm:
1. Tách filters.js:
   - applyQuickFilter
   - updateCardVisibility
   - search input handler
   - filter dropdown handler
2. Sau đó tách modal/account-actions.js.
3. Chưa chuyển TypeScript/Vite.

--------------------------------------------------
BƯỚC 9 - ĐÃ TÁCH PHONE HISTORY VÀ SCAN HISTORY
--------------------------------------------------

Đã làm tiếp sau Bước 8:

1. Tạo app/static/js/mxh/phone-history.js
   - Tạo global window.MXHPhoneHistory.
   - Chuyển logic lịch sử SĐT:
     - loadPhoneHistory
     - copyPhoneHistory
     - bindControls
   - Vẫn dùng MXHApi:
     - getPhoneHistory
     - addPhoneHistory
     - deletePhoneHistory

2. Tạo app/static/js/mxh/scan-history.js
   - Tạo global window.MXHScanHistory.
   - Chuyển logic lịch sử quét:
     - fetchScanHistoryData
     - openScanHistoryModal
     - resetScanHistory
     - bindControls
   - Vẫn dùng MXHApi:
     - getScanHistory
     - deleteScanHistory

3. Cập nhật app/static/js/mxh.js
   - loadPhoneHistory delegate sang MXHPhoneHistory.
   - window.copyPhoneHistory delegate sang MXHPhoneHistory.
   - fetchScanHistoryData/openScanHistoryModal/resetScanHistory delegate sang MXHScanHistory.
   - Event binding của phone/scan history chuyển sang wrapper bindControls.

4. Cập nhật app/templates/mxh.html
   - Load thêm:
     <script src="{{ url_for('static', filename='js/mxh/phone-history.js') }}"></script>
     <script src="{{ url_for('static', filename='js/mxh/scan-history.js') }}"></script>

Kết quả hiện tại:
- app/templates/mxh.html khoảng 565 dòng.
- app/static/css/mxh.css khoảng 1018 dòng.
- app/static/js/mxh/utils.js khoảng 101 dòng.
- app/static/js/mxh/state.js khoảng 69 dòng.
- app/static/js/mxh/api.js khoảng 176 dòng.
- app/static/js/mxh/render.js khoảng 562 dòng.
- app/static/js/mxh/context-menu.js khoảng 276 dòng.
- app/static/js/mxh/inline-edit.js khoảng 246 dòng.
- app/static/js/mxh/phone-history.js khoảng 132 dòng.
- app/static/js/mxh/scan-history.js khoảng 82 dòng.
- app/static/js/mxh.js khoảng 3459 dòng.

Đã kiểm tra sau Bước 9:
- node --check toàn bộ JS MXH hiện tại: OK
- python -m compileall app: OK
- Jinja render smoke với stub url_for/request: OK
- Thứ tự load script OK:
  - utils.js
  - state.js
  - api.js
  - render.js
  - context-menu.js
  - inline-edit.js
  - phone-history.js
  - scan-history.js
  - mxh.js
- git diff --check: OK, chỉ có warning LF/CRLF của Git cho mxh.html.
- Kiểm tra mxh.html + các JS đã tách:
  - không còn style=
  - không còn onclick=
  - không còn onblur/onkeydown/oncontextmenu/onfocus
  - không còn fetch() ngoài api.js

Đang ở đâu sau Bước 9:
- Các phần ít phụ thuộc nhất đã tách xong.
- mxh.js còn khoảng 3459 dòng.
- Phần còn lại phức tạp hơn vì nằm ở init/event binding, filter/updateCardVisibility, modal CRUD, notice preview, context action handler.

Bước tiếp theo nên làm:
1. Tách filters.js:
   - applyQuickFilter
   - updateCardVisibility
   - filter dropdown/search handlers
2. Hoặc tách notice-preview.js nếu muốn giảm một IIFE độc lập ở cuối file.
3. Chưa chuyển TypeScript/Vite.

--------------------------------------------------
BƯỚC 8 - ĐÃ TÁCH INLINE EDIT
--------------------------------------------------

Đã làm tiếp sau Bước 7:

1. Tạo app/static/js/mxh/inline-edit.js
   - Tạo global window.MXHInlineEdit.
   - Chuyển phần inline edit ra khỏi mxh.js:
     - normalizeValue
     - formatDisplay
     - syncEditableDom
     - saveInlineEdit
     - quickUpdateField
     - setupEditableFields

2. Cập nhật app/static/js/mxh.js
   - Thêm các setter/helper cần thiết vào getRenderContext:
     - setMXHInlineEditActive
     - clearMXHInlineEditSelection
     - setMXHCommitInlineEditOnBlur
     - shouldHoldMXHInlineEditOnBlur
     - captureMXHInlineEditSelection
     - loadMXHData
     - scheduleRender
     - showToast wrapper
   - window.saveInlineEdit hiện delegate sang MXHInlineEdit.saveInlineEdit.
   - quickUpdateField hiện delegate sang MXHInlineEdit.quickUpdateField.
   - setupEditableFields hiện delegate sang MXHInlineEdit.setupEditableFields.
   - Không đổi endpoint/API; vẫn dùng MXHApi.updateAccount.

3. Cập nhật app/templates/mxh.html
   - Load inline-edit.js trước mxh.js:
     <script src="{{ url_for('static', filename='js/mxh/inline-edit.js') }}"></script>

Kết quả hiện tại:
- app/templates/mxh.html khoảng 563 dòng.
- app/static/css/mxh.css khoảng 1018 dòng.
- app/static/js/mxh/utils.js khoảng 101 dòng.
- app/static/js/mxh/state.js khoảng 69 dòng.
- app/static/js/mxh/api.js khoảng 176 dòng.
- app/static/js/mxh/render.js khoảng 562 dòng.
- app/static/js/mxh/context-menu.js khoảng 276 dòng.
- app/static/js/mxh/inline-edit.js khoảng 246 dòng.
- app/static/js/mxh.js khoảng 3615 dòng.

Đã kiểm tra sau Bước 8:
- node --check toàn bộ JS MXH hiện tại: OK
  - utils.js
  - state.js
  - api.js
  - render.js
  - context-menu.js
  - inline-edit.js
  - mxh.js
- python -m compileall app: OK
- Jinja render smoke với stub url_for/request: OK
- Thứ tự load script OK:
  - utils.js
  - state.js
  - api.js
  - render.js
  - context-menu.js
  - inline-edit.js
  - mxh.js
- git diff --check: OK, chỉ có warning LF/CRLF của Git cho mxh.html.
- Kiểm tra mxh.html + mxh.js + render.js + context-menu.js + inline-edit.js:
  - không còn style=
  - không còn onclick=
  - không còn onblur/onkeydown/oncontextmenu/onfocus
  - không còn fetch() ngoài api.js

Đang ở đâu sau Bước 8:
- MXH đã có các wrapper riêng:
  - api.js
  - state.js
  - utils.js
  - render.js
  - context-menu.js
  - inline-edit.js
- mxh.js còn khoảng 3615 dòng, chủ yếu là:
  - modal create/edit/delete/move account
  - context menu action handler
  - phone history
  - scan history
  - notice preview
  - filters/search/init

Bước tiếp theo nên làm:
1. Tách phone-history.js và scan-history.js vì API helper đã có endpoint riêng.
2. Hoặc tách filters.js nếu muốn gom search/filter/updateCardVisibility trước.
3. Chưa chuyển TypeScript/Vite.

--------------------------------------------------
TÓM TẮT HIỆN TẠI SAU BƯỚC 11
--------------------------------------------------

Ghi chú:
- Các mục Bước 9, Bước 10, Bước 11 đã được cập nhật ở phía trên trong file này.
- Trạng thái chuẩn mới nhất là: đã hoàn thành đến Bước 11.

Đã tách xong trong đợt này:
1. app/static/css/mxh.css
2. app/static/js/mxh.js
3. app/static/js/mxh/utils.js
4. app/static/js/mxh/state.js
5. app/static/js/mxh/api.js
6. app/static/js/mxh/filters.js
7. app/static/js/mxh/render.js
8. app/static/js/mxh/context-menu.js
9. app/static/js/mxh/inline-edit.js
10. app/static/js/mxh/phone-history.js
11. app/static/js/mxh/scan-history.js
12. app/static/js/mxh/notice-preview.js

Kích thước hiện tại:
- app/templates/mxh.html khoảng 567 dòng.
- app/static/js/mxh.js khoảng 3035 dòng.

Đã kiểm tra mới nhất sau Bước 11:
- node --check toàn bộ JS MXH: OK.
- python -m compileall app: OK.
- Jinja render smoke mxh.html: OK.
- git diff --check: OK, chỉ còn warning LF/CRLF của Git cho mxh.html.
- Không còn fetch() ngoài app/static/js/mxh/api.js.
- Không còn style=/onclick=/onblur=/onkeydown=/oncontextmenu=/onfocus trong mxh.html và các JS đã tách.

Điểm nên dừng:
- Bước phức tạp kế tiếp là modal/account-actions.js.
- Lý do: phần này đụng create/update/delete/move/reset, context action handler, WeChat modal, Bootstrap modal state và nhiều API flow cùng lúc.
- Nên test thủ công MXH trước khi tách tiếp phần modal/action handler.

Chưa làm:
- Chưa refactor Notes.
- Chưa đổi backend/API/schema/data.
- Chưa chuyển TypeScript/Vite.

--------------------------------------------------
CẬP NHẬT TIẾN ĐỘ REFACTOR MXH - SAU BƯỚC 14
--------------------------------------------------

Bước 12 - Sửa và tách background context menu:
- Đã kiểm tra lỗi "context menu ngoài vùng card MXH không hoạt động".
- Nguyên nhân: menu nền là phần tử có sẵn trong template, đang mang class mxh-hidden-initial/display none; hàm định vị chỉ đo kích thước rồi trả display về trạng thái cũ nên menu không hiện ổn định.
- Đã chuyển phần bind/show/hide/click của background context menu sang app/static/js/mxh/context-menu.js.
- Đã sửa mở menu nền bằng cách:
  - bỏ mxh-hidden-initial khi show
  - set display/visibility rõ ràng
  - vẫn dùng positionContextMenuSmart
  - chỉ chặn menu nền khi click vào .mxh-card
- Không đổi HTML structure, API hay backend.

Bước 13 - Tách account rules:
- Tạo app/static/js/mxh/account-rules.js.
- Đã chuyển nhóm pure helper ra khỏi mxh.js:
  - normalizeISOForJS
  - ensureNoticeParsed
  - calculateTimeDifferenceInHours
  - formatAccountAge
  - calculateNearbyCountdown
  - calculateScanCountdown
  - canScanWeChat
  - needsHongKongNumber
  - canScanWeChatHK
  - isEligibleNearbyPeople
  - isNearbyPeopleActive
  - getAccountCreatedDateForStats
  - isAccountDisabledForStats
  - getAccountBorderClass
- mxh.js hiện chỉ giữ alias/wrapper để giữ compatibility với render/filter/context-menu.

Bước 14 - Tách flip-card và modal form helpers:
- Tạo app/static/js/mxh/flip-card.js.
  - Chuyển logic flipCardToAccount và animation flip sang module riêng.
  - mxh.js chỉ còn wrapper gọi MXHFlipCard.flipCardToAccount.
- Tạo app/static/js/mxh/modal-forms.js.
  - Chuyển auto-fill ngày khi mở modal thêm account.
  - Chuyển auto-fill ngày khi mở WeChat modal.
  - Chuyển auto-format input ngày WeChat.
- Cập nhật app/templates/mxh.html để load thêm:
  - js/mxh/account-rules.js
  - js/mxh/flip-card.js
  - js/mxh/modal-forms.js

Kích thước hiện tại:
- app/templates/mxh.html: khoảng 570 dòng.
- app/static/css/mxh.css: khoảng 1018 dòng.
- app/static/js/mxh.js: khoảng 2531 dòng.
- app/static/js/mxh/account-rules.js: khoảng 273 dòng.
- app/static/js/mxh/flip-card.js: khoảng 36 dòng.
- app/static/js/mxh/modal-forms.js: khoảng 116 dòng.
- app/static/js/mxh/context-menu.js: khoảng 373 dòng.

Đã kiểm tra sau Bước 14:
- node --check app/static/js/mxh.js và toàn bộ app/static/js/mxh/*.js: OK.
- python -m compileall app: OK.
- Jinja render smoke mxh.html với stub url_for/request: OK.
- git diff --check: OK, chỉ còn warning LF/CRLF của Git cho app/templates/mxh.html.
- Kiểm tra mxh.html:
  - không còn <style>
  - không còn inline handler style=/onclick=/onblur=/onkeydown=/oncontextmenu=/onfocus
  - chỉ còn script src để load file ngoài.
- fetch() vẫn chỉ nằm trong app/static/js/mxh/api.js.

Trạng thái hiện tại:
- Đã hoàn thành tách cơ bản CSS/JS và nhiều module nhỏ của MXH.
- Đã xử lý bug nhỏ background context menu ngoài card.
- Chưa refactor Notes.
- Chưa đổi backend/API/schema/data.
- Chưa chuyển TypeScript/Vite.

Bước tiếp theo:
- Phần nên cân nhắc tiếp là modal/account-actions.js.
- Đây là bước phức tạp hơn vì đụng nhiều luồng cùng lúc:
  - context menu action handler
  - create/update/delete/move/reset account
  - WeChat modal
  - Bootstrap modal state
  - local optimistic render và API fallback
- Nên test thủ công MXH trước khi tách sâu phần này.
