# Quy Trình Quản Lý Di Trú Database (Supabase Migrations)

Thư mục này chứa các file di trú cấu trúc PostgreSQL theo trình tự thời gian cho hệ thống **GÓC Coffee POS**.

---

## ⚠️ Nguyên Tắc Di Trú Bất Biến (Expand & Contract)

Khi phát triển tính năng lớn (Voucher, Khuyến mãi, Quản lý kho, KDS Bếp, Phân quyền nhân viên), bắt buộc tuân thủ quy tắc 3 bước:

### 1. Pha 1: Expand (Mở rộng)
* Luôn thêm cột mới có giá trị `DEFAULT` hoặc cho phép `NULL`.
* Không đổi tên cột cũ, không xóa cột cũ.
* Tạo bảng mới với RLS Policy tương ứng.
* *Lý do:* Thiết bị thu ngân chạy phiên bản cũ và phiên bản mới đều hoạt động trơn tru.

### 2. Pha 2: Deploy Code (Phát hành mã nguồn)
* Đẩy mã nguồn frontend mới lên GitHub và Cloudflare Pages.
* Toàn bộ nhân viên tại quán tải bản cập nhật mới.

### 3. Pha 3: Contract (Thu hẹp)
* Sau 1-2 tuần khi 100% thiết bị đã chuyển sang mã nguồn mới, tạo file migration mới để dọn dẹp các cột cũ nếu cần.

---

## 命名 Quy tắc đặt tên file:
`YYYYMMDDHHMMSS_ten_mo_ta_tinh_nang.sql`
* *Ví dụ:* `20261101120000_add_voucher_promotions.sql`
