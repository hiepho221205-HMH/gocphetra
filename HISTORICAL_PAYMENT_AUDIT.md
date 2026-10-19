# BÁO CÁO KIỂM TOÁN VÀ ĐẶC TẢ HỆ THỐNG: KẾT CHUYỂN ĐƠN QUA NGÀY & THU TIỀN ĐƠN CŨ (DAILY ROLLOVER & HISTORICAL PAYMENT)

**Hệ thống:** GÓC Coffee POS (PWA & Supabase Backend)  
**Thời gian kiểm toán:** 20/10/2026  
**Chi nhánh:** GÓC Coffee — Chi nhánh 1  
**Múi giờ vận hành:** `Asia/Ho_Chi_Minh` (GMT+7)

---

## 1. TỔNG QUAN VÀ MỤC TIÊU TRIỂN KHAI

Hệ thống POS GÓC Coffee trước đây gặp thách thức khi quán đóng cửa vào cuối ngày: các đơn hàng chưa thanh toán (`serving`) của ngày cũ vẫn giữ chiếm giữ bàn sang sáng hôm sau, dẫn tới xung đột bàn khi mở ca mới; hoặc nếu can thiệp tự động huỷ/xoá đơn thì gây thất thoát dữ liệu và làm sai lệch doanh thu.

Super Task **Daily Order Rollover & Historical Payment** đã giải quyết triệt để vấn đề này với 5 nguyên tắc cốt lõi:

1. **Tuyệt đối không Auto-Cancel hay Auto-Delete:** Bảo toàn 100% chi tiết đơn hàng, món ăn, topping, ghi chú và giá bán dưới ngày kinh doanh phát sinh ban đầu (`business_date`).
2. **Giải phóng bàn tức thì qua đêm (Overnight Table Release):** Đúng 00:00 (hoặc khi mở ứng dụng ở ca làm việc đầu tiên ngày mới), tất cả bàn có đơn chưa thanh toán của ngày cũ lập tức chuyển về trạng thái Trống (`empty`) để sẵn sàng đón khách mới.
3. **Cách ly bàn đa ngày tuyệt đối (Strict Multi-Day Table Isolation):** Khách mới ngồi vào Bàn X trong ngày hôm nay hoàn toàn độc lập với đơn nợ hôm qua của Bàn X. Thao tác thu tiền đơn nợ hôm qua **KHÔNG BAO GIỜ** can thiệp, giải phóng hay ghi đè lên phiên ăn uống đang phục vụ trên Bàn X hôm nay.
4. **Ghi nhận doanh thu theo thực thu (Cash-Basis Revenue Attribution):** Thu tiền đơn cũ vào ngày nào thì tiền được ghi nhận vào sổ quỹ và báo cáo doanh thu của ngày đó (`payment_business_date`), không hồi tố làm sai lệch sổ quỹ quá khứ.
5. **Chống trùng lặp và xung đột đồng thời (Idempotency & Concurrency Safety):** Khóa giao dịch bằng `idempotency_key` và Stored Procedure nguyên tử tại database, ngăn chặn việc thu tiền trùng lặp khi 2 thu ngân cùng thao tác hoặc mạng lag giật.

---

## 2. BẢNG ĐỐI CHIẾU TRẠNG THÁI VÀ LUỒNG DỮ LIỆU

```
+---------------------------------------------------------------------------------------------------+
| NGÀY N (Hôm qua): Khách Bàn 03 gọi Cà phê muối (35.000đ) chưa kịp tính tiền                        |
|   orders.status = 'serving'                                                                       |
|   orders.business_date = '2026-10-14'                                                             |
|   tables.status = 'occupied' (activeOrderId: 'ORD-...')                                           |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
                                       00:00 NỬA ĐÊM (ROLLOVER)
                                                  │
                                                  ▼
+---------------------------------------------------------------------------------------------------+
| KẾT CHUYỂN TỰ ĐỘNG (Auto Catch-up Rollover):                                                      |
|   1. orders.status = 'unpaid_carried_over'                                                        |
|   2. orders.carried_over_at = NOW()                                                               |
|   3. tables.status = 'empty' (activeOrderId: null) ---> Bàn 03 sẵn sàng đón khách mới             |
|   4. orders.business_date VẪN LÀ '2026-10-14' (Không thay đổi ngày phát sinh)                      |
+---------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
                                  SÁNG HÔM SAU (NGÀY N+1 - 2026-10-15)
                                                  │
                                                  ▼
+---------------------------------------------------------------------------------------------------+
| 08:30: Khách mới vào ngồi Bàn 03 (Đơn #201: 2 Espresso - 50.000đ)                                  |
|   tables.status = 'occupied' (activeOrderId: '#201')                                              |
|                                                                                                   |
| 14:15: Khách hôm qua quay lại thanh toán 35.000đ cho Đơn #103                                     |
|   - Thu ngân vào Lịch sử đơn hàng -> Chọn ngày 2026-10-14 -> Tab "Chưa thanh toán"               |
|   - Bấm "Thu tiền" trên thẻ Đơn #103 (Modal xác nhận tiền mặt hoặc VietQR)                        |
|                                                                                                   |
| KẾT QUẢ THU TIỀN:                                                                                 |
|   1. Đơn #103: status = 'completed', payment_status = 'paid', payment_business_date = '2026-10-15'|
|   2. Bảng payments: Ghi nhận 1 bản ghi 35.000đ với business_date = '2026-10-15'                   |
|   3. Bàn 03: VẪN TIẾP TỤC GIỮ TRẠNG THÁI 'occupied' VỚI ĐƠN #201 (CÁCH LY TUYỆT ĐỐI)!           |
|   4. Báo cáo Doanh thu: Ngày 2026-10-14 giữ nguyên; Ngày 2026-10-15 cộng thêm 35.000đ            |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. KIẾN TRÚC DATABASE VÀ RECONCILER

### 3.1 Migration SQL (`supabase/migrations/20261020100000_daily_rollover_and_payments.sql`)
- Mở rộng bảng `orders`:
  * `business_date DATE NOT NULL DEFAULT CURRENT_DATE`
  * `carried_over_at TIMESTAMPTZ`
  * `payment_status VARCHAR(30) DEFAULT 'unpaid'` (`unpaid`, `partially_paid`, `paid`, `refunded`)
  * `paid_at TIMESTAMPTZ`
  * `payment_business_date DATE`
- Tạo bảng sổ quỹ thanh toán bất biến `payments`:
  * `id TEXT PRIMARY KEY`
  * `order_id TEXT REFERENCES orders(id)`
  * `amount NUMERIC(12,2) NOT NULL`
  * `payment_method VARCHAR(30) NOT NULL`
  * `payment_status VARCHAR(30) NOT NULL`
  * `paid_at TIMESTAMPTZ NOT NULL`
  * `business_date DATE NOT NULL`
  * `cashier_id TEXT`
  * `idempotency_key TEXT UNIQUE`
  * `notes TEXT`
- Stored Procedures nguyên tử:
  * `rollover_daily_orders(p_target_business_date DATE)`: Quét mọi đơn `serving` có `business_date < target`, chuyển thành `unpaid_carried_over`, đồng thời giải phóng bàn tương ứng nếu bàn đó đang trỏ tới chính đơn này.
  * `process_historical_payment(...)`: Kiểm tra khóa idempotency, cập nhật đơn hàng thành `completed`, chèn bản ghi vào `payments`, tuyệt đối không động đến bảng `tables`.

### 3.2 Lớp Reconciler (`src/utils/reconciler.js`)
- Đã bổ sung logic bảo vệ đơn `unpaid_carried_over` khỏi bị tự động chuyển thành `cancelled` khi đối soát với danh sách bàn trống.
- Bổ sung hàm pure-function `rolloverPastUnpaidOrders(tables, orders, orderHistory, currentBusinessDate)` phục vụ chạy offline, client catch-up và unit/simulation testing.

### 3.3 Lớp State & POS Context (`src/store/PosContext.jsx`)
- Tự động gọi `runCatchupRollover()` khi khởi động ứng dụng POS để xử lý mọi đơn hàng của ngày cũ nếu thiết bị vừa mở sau ca đêm.
- Phân định rõ ràng:
  * `orders`: Chỉ lưu trữ đơn đang phục vụ (`serving`) của ngày hiện tại gắn trên các bàn.
  * `orderHistory`: Lưu trữ toàn bộ đơn đã hoàn thành (`completed`), đơn huỷ (`cancelled`), và đơn chưa thanh toán ngày cũ (`unpaid_carried_over`).
- Cung cấp hàm `processHistoricalPayment({ orderId, paymentMethod, amount, notes })` đồng bộ dữ liệu đa kênh (Local State -> IndexedDB/LocalStorage -> Supabase RPC).

---

## 4. ĐẶC TẢ GIAO DIỆN NGƯỜI DÙNG (UI/UX CONTRACT)

| Màn hình / Component | Vị trí / Hành vi | Quy chuẩn thiết kế & Trải nghiệm |
| :--- | :--- | :--- |
| **Tab Bar Lịch sử đơn hàng** (`OrderHistoryView.jsx`) | **Ngày hôm nay (`selectedDate === today`):**<br>Tab 1: "Đang phục vụ" (đếm số bàn đang ăn)<br>Tab 2: "Đã hoàn thành" | Nút tab bo góc 12px, font-medium, màu xanh chủ đạo `#214E34`, badge số lượng đếm chuẩn xác. |
| **Tab Bar Lịch sử đơn hàng** (`OrderHistoryView.jsx`) | **Ngày cũ trong quá khứ (`selectedDate < today`):**<br>Tab 1: "Chưa thanh toán" (Badge màu cam cảnh báo)<br>Tab 2: "Đã hoàn thành" | Thẻ đơn hàng có nút **"Thu tiền"** màu xanh ngọc `#009E78` cạnh nút "Xem đơn", chiều cao tối thiểu 44px đạt chuẩn touch mobile. |
| **Thẻ Đơn hàng ngày cũ** (`OrderHistoryView.jsx`) | Thẻ đơn đã thu tiền ở ngày khác: Hiển thị badge `Đã thu ngày DD/MM/YYYY` | Phân biệt rõ đơn phát sinh ngày cũ được thu trễ, tránh nhầm lẫn sổ quỹ. |
| **Modal Thu tiền đơn cũ** (`HistoricalPaymentModal.jsx`) | Mở khi bấm "Thu tiền" trên card hoặc trong modal chi tiết | Hiển thị Banner cảnh báo: *"Thao tác này chỉ ghi nhận thanh toán cho đơn hàng ngày cũ, không làm ảnh hưởng đến trạng thái bàn hiện tại."* Cho phép chọn Tiền mặt hoặc VietQR, có nút chống double-click. |
| **Chi tiết đơn hàng** (`OrderDetailsModal.jsx`) | Mở xem đơn cũ | Chế độ Read-only: vô hiệu hoá sửa món, thanh footer có nút "Đóng" và nút "Thu tiền" nếu đơn chưa thanh toán. |
| **Báo cáo doanh thu** (`ReportsView.jsx`) | Báo cáo doanh thu theo ngày | Gom nhóm doanh thu theo `paymentBusinessDate` (ngày thực thu), phản ánh chính xác lượng tiền mặt và chuyển khoản vào ca trực hôm nay. |

---

## 5. KẾT QUẢ KIỂM THỬ MÔ PHỎNG 7 NGÀY (35 ĐƠN HÀNG THỰC TẾ)

Bộ kiểm thử tự động `tests/simulation_historical_payment.test.js` đã thực hiện mô phỏng toàn diện kịch bản kinh doanh thực tế kéo dài 7 ngày liên tiếp từ ngày 14/10/2026 đến 20/10/2026:

```
============================================================
  7-DAY HISTORICAL ROLLOVER & SETTLEMENT AUDIT PASSED!
  Total Orders Simulated   : 35
  Completed Orders Paid    : 28
  Active Serving Orders    : 2
  Total Revenue Collected  : 1.094.000đ
  Revenue Discrepancy      : 0đ (100% Match)
  Ghost Tables Detected    : 0 (Zero)
============================================================

▶ Super Task: 7-Day Simulation Suite (35 Real-World Orders) — Daily Rollover & Historical Payments
  ✔ Day 1 (2026-10-14): 5 Orders Created — 2 completed, 3 left unpaid overnight
  ✔ Day 2 (2026-10-15): Overnight Rollover frees tables & preserves orders without auto-cancellation
  ✔ Day 2 (2026-10-15): Strict Table Isolation — Paying Day 1 Order 3 does NOT affect new dining on Table 3
  ✔ Day 3 (2026-10-16): Delayed payment of 2-day-old order (Day 1 Order 4) via VietQR
  ✔ Day 4 (2026-10-17): Strict Revenue Boundary — Day 1 cash-basis revenue remains 60k
  ✔ Day 5 (2026-10-18): Idempotency check prevents duplicate payments and race conditions
  ✔ Day 6 (2026-10-19): Date Tab Filter Contract conforms strictly to user specifications
  ✔ Day 7 (2026-10-20): Final Simulation & Total 35-Order Holistic Integrity Audit
✔ Super Task: 7-Day Simulation Suite (35 Real-World Orders) (26.5ms)
```

### Chi tiết các cam kết kỹ thuật được xác minh 100%:
1. **Khớp sổ cái 100%:** Tổng tiền ghi nhận trên bảng `payments` (1.094.000đ) khớp từng đồng xu với tổng `paidAmount` của 28 đơn hàng đã hoàn tất.
2. **Không có bàn ảo (Zero Ghost Tables):** Tất cả bàn trống đều có `activeOrderId: null` và `customerCount: 0`. Bàn có khách trỏ đúng vào đơn đang phục vụ thực tế.
3. **Không mất món (Zero Lost Items):** 100% các đơn hoàn tất đều bảo toàn đầy đủ danh sách món, số lượng, đơn giá và thành tiền.
4. **Không tự ý huỷ đơn (Zero Lost/Cancelled Orders):** Không có bất kỳ đơn hàng nào bị huỷ hoặc biến mất trong suốt chu kỳ 7 ngày.

---

## 6. KẾT LUẬN VÀ HƯỚNG DẪN VẬN HÀNH

Hệ thống đã sẵn sàng đưa vào vận hành thực tế. 
- Khi đến kỳ chuyển giao ca hoặc đóng quán cuối ngày, nhân viên thu ngân có thể yên tâm bàn giao ca hoặc tắt app mà không lo bàn bị khoá cứng vào sáng hôm sau.
- Khách nợ hoặc chuyển khoản muộn ngày hôm sau có thể được tra cứu nhanh theo ngày cũ và thu tiền trong vòng 2 chạm trên thiết bị di động, tự động hạch toán chuẩn xác vào doanh thu ca trực hiện tại.
