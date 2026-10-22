# GÓC POS — STORE CONFIGURATION IMPLEMENTATION REPORT
**Dự án:** GÓC – PHÊ & TRÀ POS  
**Mục tiêu:** Chuẩn hóa dữ liệu cấu hình cửa hàng, đồng bộ Supabase & Dexie IndexedDB, phân quyền RBAC và giao diện Cấu hình Quán & Hóa đơn.

---

## 1. TỔNG QUAN KIẾN TRÚC

Trang cấu hình đã được nâng cấp toàn diện và đổi tên thành:
**Cấu hình Quán & Hóa đơn**

Hệ thống được chia thành 4 nhóm chức năng rõ ràng theo phong cách thiết kế hiện tại (xanh lá `#214E34`, card bo tròn 3xl, bóng đổ mềm, mobile-first):

### A. Thông tin Cửa hàng & Logo
- **Tên quán:** `store_name` (in đậm trên bill, mặc định: "GÓC").
- **Địa chỉ:** `store_address` (mặc định: "18A Võ Văn Dũng, Phường An Nhơn, Bình Định").
- **Hotline liên hệ:** `contact_phone` (mặc định: "1900 88 99 22").
- **Thu ngân mặc định:** `currentCashier`.
- **Logo quán in nhiệt:**
  - Hỗ trợ tải file PNG, JPG, JPEG, SVG, WEBP (tối đa 10MB).
  - Tích hợp bộ xử lý client-side tự động tối ưu cho máy in nhiệt đơn sắc.
  - Bộ xem trước 2 tab: Ảnh gốc và Bản in nhiệt 1-bit Floyd-Steinberg dithered.
  - Cho phép thay đổi hoặc xóa logo bất kỳ lúc nào.

### B. Cấu hình Hóa đơn & Khổ giấy in
- **Khổ giấy mặc định:** Tùy chọn chuyển đổi tức thì giữa **58mm (K58 - 32 cột)** và **80mm (K80 - 48 cột)**.
- **Tùy chọn hiển thị trên hóa đơn (Toggles):**
  - Hiển thị logo
  - Hiển thị tên quán
  - Hiển thị địa chỉ
  - Hiển thị số điện thoại
  - Hiển thị mã hóa đơn (#ORD)
  - Hiển thị số bàn
  - Hiển thị thời gian gọi món (`order.created_at`)
  - Hiển thị thời gian xuất hóa đơn (`receipt.issued_at`)
  - Hiển thị mật khẩu Wi-Fi
  - Hiển thị lời cảm ơn chân trang
- **Lời cảm ơn cuối bill:** Ô nhập tự do, mặc định: `"Cảm ơn quý khách và hẹn gặp lại!"`.
- **Nút "In thử mẫu":** Mở modal xem trước hóa đơn với dữ liệu giả lập để nhân viên kiểm tra kích thước và bố cục thực tế.

### C. Wi-Fi Khách hàng
- Ô nhập mật khẩu Wi-Fi.
- Nút "Sao chép mật khẩu" phản hồi xúc giác (Haptic) và thông báo Toast.
- Tùy chọn Bật/Tắt in Wi-Fi trên hóa đơn.

### D. Thanh toán & VietQR
- **Số tài khoản MBBank:** `0988776655`.
- **Chủ tài khoản:** `QUAN CA PHE GOC`.
- **Huy hiệu kết nối:** "MBBank Đã liên kết".
- **VietQR:** Tự động tạo mã VietQR động theo từng đơn hàng trên màn hình thanh toán. Hóa đơn bill thanh toán không in mã QR (theo chỉ đạo nghiệp vụ để tránh khách chuyển trùng).

---

## 2. LOẠI BỎ CA LÀM VIỆC & MỐC THỜI GIAN CHÍNH XÁC

- **Ca làm việc:** Đã loại bỏ hoàn toàn ô nhập "Ca làm việc" khỏi giao diện cấu hình hóa đơn bill. Giá trị ngầm được bảo toàn trong state để các báo cáo tài chính nội bộ không bị ảnh hưởng.
- **Thời gian gọi món:** Lấy chính xác từ `order.created_at` (hoặc `order.createdAt`) từ cơ sở dữ liệu.
- **Thời gian xuất hóa đơn:** Lấy chính xác từ `receipt.issued_at` (thời điểm thanh toán hoàn tất).
- **Múi giờ & Định dạng:** Chuẩn hóa `DD/MM/YYYY HH:mm` theo múi giờ `Asia/Ho_Chi_Minh` (GMT+7).

---

## 3. CƠ CHẾ ĐỒNG BỘ SUPABASE & PHÂN QUYỀN RBAC

- **Bảng `public.store_settings`:**
  - `store_id` (TEXT PRIMARY KEY DEFAULT `'default_store'`)
  - `store_name`, `store_address`, `contact_phone`, `logo_original_url`, `logo_thermal_url`
  - `receipt_paper_width`, `receipt_settings` (JSONB), `receipt_footer`
  - `wifi_password`, `wifi_on_receipt`, `bank_code`, `bank_account`, `bank_account_name`, `vietqr_enabled`
  - `updated_at` (TIMESTAMPTZ)
- **Cơ chế Dual-Write & Adaptive Schema:**
  - Ghi dữ liệu đồng thời vào bảng `store_settings` và bảng `settings` (`key = 'pos_config'`).
  - Hỗ trợ `schemaCapabilities` tự phát hiện: Nếu môi trường chưa chạy migration, hệ thống tự động fallback về `settings.pos_config` mà không gây gián đoạn hay lỗi màn hình trắng.
- **Phân quyền RBAC:**
  - `Admin` & `Manager`: Được quyền chỉnh sửa và lưu cấu hình cửa hàng.
  - `Staff`: Chỉ có quyền đọc cấu hình để phục vụ in hóa đơn và vận hành bán hàng.

---

## 4. BẢO VỆ DỮ LIỆU HIỆN HỮU

- Dữ liệu quán thực tế tại Bình Định (`18A Võ Văn Dũng`, MBBank `0988776655`, Hotline `1900 88 99 22`, WiFi `xincamon`) được giữ nguyên trọn vẹn.
- Không tự ý ghi đè dữ liệu rỗng hoặc giá trị mẫu.
