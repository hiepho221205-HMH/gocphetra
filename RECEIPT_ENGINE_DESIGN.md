# GÓC POS — RECEIPT ENGINE DESIGN
**Dự án:** GÓC – PHÊ & TRÀ POS  
**Module:** `src/utils/receiptEngine.js` & `src/components/billing/ReceiptPrintView.jsx`

---

## 1. NGUỒN DỮ LIỆU CHUẨN HÓA (UNIFIED RECEIPT PAYLOAD)

Receipt Engine sử dụng mô hình dữ liệu tập trung duy nhất:
```
Receipt Payload = Store Settings + Order + Items + Payment + Receipt Snapshot Record
```

Toàn bộ các nơi phát hành hoặc xem lại hóa đơn (`BillCheckoutModal`, `OrderHistoryView`, `OrderDetailsModal`, `StoreConfigSubpage`) đều sử dụng chung hàm `buildReceiptModel()` để đảm bảo tổng tiền, giảm giá, phụ phí và thời gian luôn đồng nhất 100%.

---

## 2. QUY CÁCH KHỔ GIẤY IN NHIỆT

### Khổ K58 (58mm Paper Roll)
- **Độ rộng in khả dụng:** 48mm (~384 dots tại mật độ 8 dots/mm - 203 DPI).
- **Số ký tự mỗi dòng (Font A):** Đúng 32 ký tự.
- **Bố cục bảng món ăn (16 - 4 - 12):**
  - Tên món: 16 ký tự (căn trái).
  - Số lượng: 4 ký tự (căn giữa).
  - Thành tiền: 12 ký tự (căn phải).
- **Cơ chế ngắt dòng (Wrap text):** Khi tên món dài hơn 16 ký tự, engine tự động ngắt xuống dòng tiếp theo tại ranh giới từ mà không cắt ngắn hoặc làm xô lệch cột số lượng và đơn giá.

### Khổ K80 (80mm Paper Roll)
- **Độ rộng in khả dụng:** 72mm (~576 dots tại 203 DPI).
- **Số ký tự mỗi dòng (Font A):** Đúng 48 ký tự.
- **Bố cục bảng món ăn (26 - 6 - 16):**
  - Tên món: 26 ký tự (căn trái).
  - Số lượng: 6 ký tự (căn giữa).
  - Thành tiền: 16 ký tự (căn phải).

---

## 3. CƠ CHẾ SNAPSHOT BẤT BIẾN (IMMUTABLE RECEIPTS)

Khi một đơn hàng được thanh toán (`finalizeOrder`), hệ thống tự động sinh bản ghi snapshot lưu vào bảng `public.receipts`:
- `id`: Mã hóa đơn duy nhất (VD: `REC-ORD-430186-...`).
- `order_id`: Liên kết khóa ngoại với đơn hàng.
- `store_snapshot` (JSONB): Đóng băng tên quán, địa chỉ, số điện thoại, mật khẩu wifi và logo tại thời điểm xuất hóa đơn.
- `order_snapshot` (JSONB): Đóng băng danh sách món, số lượng, giá bán, giảm giá, phụ phí và thời gian.
- `issued_at`: Ghi nhận chính xác thời điểm xuất hóa đơn ban đầu.
- `reprint_count`: Đếm số lần in lại.
- `last_reprinted_at`: Thời điểm in lại gần nhất.

**Lợi ích nghiệp vụ:**
Nếu cửa hàng thay đổi địa chỉ hoặc hotline trong tương lai, việc in lại hóa đơn của tháng trước vẫn giữ nguyên địa chỉ và hotline lịch sử chính xác của thời điểm đó.

---

## 4. BẢO VỆ DOANH THU & CHỐNG TÁC DỤNG PHỤ (ZERO SIDE-EFFECTS)

- Việc xem trước (Preview) hoặc in lại (Reprint) hóa đơn là các hàm thuần túy (pure functions), tuyệt đối **không tự động tạo giao dịch thanh toán mới** và **không làm tăng doanh thu cửa hàng**.
- Phân biệt minh bạch giữa:
  - `--- PHIẾU TẠM TÍNH ---`: Áp dụng cho đơn đang phục vụ hoặc khách yêu cầu xem bill trước khi trả tiền.
  - `--- HÓA ĐƠN THANH TOÁN ---`: Áp dụng cho đơn đã hoàn tất thu tiền.
  - Khi in lại: Bổ sung huy hiệu `[IN LẠI LẦN {n}]`.
