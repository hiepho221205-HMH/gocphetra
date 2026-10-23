# GÓC POS — TÀI LIỆU TRIỂN KHAI IN PHIẾU CHẾ BIẾN (KITCHEN & BAR TICKETS)

## 1. TỔNG QUAN HỆ THỐNG
Tài liệu ghi nhận toàn bộ giải pháp thiết kế và hiện thực tính năng **In Phiếu Chế Biến (Kitchen / Bar Preparation Ticket)** cho hệ thống **GÓC POS**, phục vụ trực tiếp cho quầy bar pha chế đồ uống và bếp nấu nướng:
- Tách biệt hoàn toàn hóa đơn thanh toán khách hàng (`CustomerReceiptTemplate`) và phiếu chế biến (`PreparationTicketTemplate`).
- Tối ưu hóa chu trình thao tác của nhân viên phục vụ: Lưu đơn nhanh -> Hỏi in phiếu chế biến -> In nhanh không qua preview -> Tự động chuyển về Sơ đồ bàn.
- Thuật toán Smart Diff thông minh: Chỉ in món mới thêm hoặc số lượng tăng thêm khi gọi thêm đồ uống.
- Tuyệt đối không in giá tiền, doanh thu, phương thức thanh toán, VietQR hay mật khẩu WiFi trên phiếu chế biến.

---

## 2. QUY TRÌNH & HÀNH VI KHI LƯU ĐƠN (WORKFLOW)

### 2.1. Luồng Thao Tác Chuẩn
```
[Nhân viên chọn món / Sửa đơn]
        │
        ▼
   [Bấm LƯU ĐƠN]
        │
        ├── 1. Kiểm tra billing lock & Optimistic Concurrency Control (OCC)
        ├── 2. Lưu đơn thành công vào Supabase (`public.orders`)
        ├── 3. Tính toán chênh lệch món (Diff Engine)
        │
        ▼
[Hiện Popup Xác Nhận]
"Đơn đã được lưu. Bạn có muốn in danh sách món cần làm không?"
  ├── Thông tin bàn & Số lượng món cần làm (vd: Bàn B02 • 3 món cần chế biến)
  │
  ├── [NÚT CHÍNH]: "Có, in phiếu"
  │     ├── Phát lệnh in nhiệt tức thì qua Bluetooth ESC/POS (hoặc hộp thoại in hệ thống)
  │     ├── Ghi nhận lịch sử in vào bảng `public.preparation_tickets`
  │     ├── Cập nhật snapshot món đã in vào `orders.kitchen_sent_items`
  │     └── Tự động điều hướng về Sơ đồ bàn (Tables Floorplan)
  │
  └── [NÚT PHỤ]: "Thoát"
        ├── Giữ nguyên dữ liệu đơn đã lưu thành công
        ├── Lưu trạng thái các món mới là "chưa gửi chế biến" để lần in sau in đúng
        └── Tự động điều hướng về Sơ đồ bàn (Tables Floorplan)
```

### 2.2. Xử Lý Khi Có Sự Cố
- Nếu lưu đơn thất bại (lỗi mạng, xung đột phiên bản OCC): Thông báo lỗi, **tuyệt đối không hiển thị popup in** và không xuất phiếu từ dữ liệu chưa xác nhận.
- Nếu bấm "Thoát": Đơn hàng trên bàn vẫn được ghi nhận an toàn ở trạng thái `serving`, không xóa món hay hoàn tác đơn hàng.

---

## 3. THIẾT KẾ MẪU PHIẾU CHẾ BIẾN (`PreparationTicketTemplate`)

### 3.1. Cấu Trúc Trực Quan (Hỗ trợ cả 58mm và 80mm)
```
================================
         PHIẾU CHẾ BIẾN         
         [MÓN GỌI THÊM]         
================================
VỊ TRÍ PHỤC VỤ
       BÀN: B02 - TẦNG 1        
--------------------------------
Mã đơn: #ORD-9821
Thời gian: 23/10/2026 18:45
Số phiếu: BAR-261023-9821
--------------------------------
1. Cà phê muối GÓC (L)
   + Kem cheese béo mặn
   * GC: Ít đường, nhiều đá
                           x 2
................................
2. Trà sen vàng macchiato (M)
   + Hạt sen thêm
                           x 1
................................
3. Espresso sữa non [THÊM]
   * GC: Đậm vị
                           x 1
================================
TỔNG SỐ LƯỢNG:            4 món
================================
```

### 3.2. Tiêu Chí Thiết Kế Nghiêm Ngặt
1. **Tên Bàn Nổi Bật**: In kích thước lớn (Double Width + Double Height `GS ! 0x11`) để nhân viên quầy bar nhìn rõ từ khoảng cách xa 2-3 mét.
2. **Quy Cách Món**:
   - Tên món in đậm, xuống dòng tự nhiên.
   - Topping: Thụt lề nhẹ, bắt đầu bằng dấu `+ `.
   - Ghi chú: Thụt lề nhẹ, bắt đầu bằng `* GC: `.
   - Số lượng: Định dạng `x [N]`, in đậm, căn phải rõ ràng.
3. **Strict Negative Security**:
   - **KHÔNG** in đơn giá món.
   - **KHÔNG** in thành tiền từng dòng.
   - **KHÔNG** in tổng tiền đơn hàng.
   - **KHÔNG** in chiết khấu, giảm giá hay phụ phí.
   - **KHÔNG** in VietQR hay số tài khoản ngân hàng.
   - **KHÔNG** in mật khẩu WiFi hay lời cảm ơn chân trang.
   - **KHÔNG** in tên thu ngân, hotline, địa chỉ hay logo lớn.

---

## 4. THUẬT TOÁN THÔNG MINH DIFF MÓN MỚI (`kitchenTicketEngine.js`)

### 4.1. Chữ Ký Nhận Diện Món (`generateItemSignature`)
Tạo chuỗi định danh duy nhất theo cú pháp:
`{productId}::{size}::{toppingsNormalized}::{notesNormalized}`
- Chuẩn hóa danh sách topping thành mảng tên/ID đã sắp xếp alphabet để đảm bảo 2 món có cùng topping dù khác thứ tự vẫn khớp chữ ký.
- Phân biệt chính xác giữa các món cùng loại nhưng khác size, khác topping, hoặc khác ghi chú (ví dụ: 1 ly ít ngọt và 1 ly ngọt bình thường là 2 món riêng biệt).

### 4.2. Quy Tắc Tính Toán Chênh Lệch
1. **Đơn mới**: In toàn bộ danh sách món với số lượng hiện tại.
2. **Gọi thêm món mới**: Chỉ in món mới được thêm vào, không in lại các món đã chế biến.
3. **Tăng số lượng món đã gọi**:
   - Đơn cũ: 2 ly Cà phê muối.
   - Khách gọi thêm thành 3 ly.
   - Phiếu in chế biến chỉ xuất: `Cà phê muối [THÊM] x 1`.
4. **Không đổi số lượng hoặc giảm số lượng**: Bỏ qua, không in lại món cũ.
5. **Đổi ghi chú / Topping**: Tạo chữ ký mới và xuất lệnh chế biến cho món đã điều chỉnh.

---

## 5. CẤU HÌNH QUẢN TRỊ ADMIN (`StoreConfigSubpage.jsx`)

Cung cấp Card **"CẤU HÌNH PHIẾU CHẾ BIẾN (BẾP / BAR)"** tại màn hình Quản trị Quán & Hóa đơn với các tùy chọn:
1. **Bật/Tắt in phiếu chế biến**: Công tắc chính toàn hệ thống.
2. **Khổ giấy in phiếu**: 58mm hoặc 80mm độc lập với khổ giấy hóa đơn khách.
3. **Hỏi in phiếu sau khi lưu**: Toggle bật/tắt popup hỏi in.
4. **Chế độ in món**:
   - *Chỉ in món mới thêm (Mặc định - Khuyên dùng)*: Tiết kiệm giấy in nhiệt tối đa.
   - *In toàn bộ món trong đơn*: In lại toàn bộ order mỗi lần bấm lưu.
5. **Chi tiết hiển thị**: Toggle Số bàn to, Mã đơn, Thời gian gửi, Topping, Ghi chú, Tổng số lượng món.
6. **Nút "In thử Phiếu chế biến mẫu"**: Cho phép chủ quán test trực tiếp máy in nhiệt ngay tại trang cài đặt.

---

## 6. KIẾN TRÚC SUPABASE & DATABASE SCHEMA

### Migration: `20261023190000_kitchen_preparation_tickets.sql`
1. Cột `kitchen_sent_items` (JSONB NOT NULL DEFAULT '[]'::jsonb) trong bảng `public.orders`.
2. Cột `kitchen_ticket_settings` (JSONB) trong bảng `public.store_settings`.
3. Bảng `public.preparation_tickets`:
   - `id` (TEXT PRIMARY KEY)
   - `order_id` (TEXT REFERENCES orders ON DELETE CASCADE)
   - `store_id` (TEXT DEFAULT 'default_store')
   - `table_id` (TEXT)
   - `table_name` (TEXT)
   - `ticket_number` (TEXT)
   - `items` (JSONB)
   - `item_count` (INTEGER)
   - `print_mode` (TEXT CHECK ('all', 'diff'))
   - `printed_at` (TIMESTAMPTZ)
   - `printed_by` (TEXT)
   - `printer_type` (TEXT DEFAULT 'thermal')
4. Row-Level Security (RLS):
   - Đọc & Thêm phiếu: Nhân viên (Staff), Quản lý (Manager), Quản trị (Admin).
   - Xóa lịch sử phiếu: Chỉ dành riêng cho Admin/Service Role.

---

## 7. KIỂM THỬ & CHẤT LƯỢNG MÃ NGUỒN

- **Unit Test Suite**: 196/196 tests passing trên toàn bộ hệ thống (`tests/test_runner.js`).
- **Engine Coverage**: 15 tests chuyên sâu cho `kitchen_ticket_engine.test.js` kiểm tra độ chính xác chữ ký món, diff món mới, tăng số lượng, merging snapshot, và định dạng ESC/POS bytes.
- **Production Build**: Biên dịch Vite v6.4.4 thành công 100% không phát sinh bất kỳ lỗi lint, runtime hay build warning nào.
