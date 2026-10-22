# GÓC POS — PRINT COMPATIBILITY REPORT
**Dự án:** GÓC – PHÊ & TRÀ POS  
**Phạm vi kiểm thử:** Android, iOS (iPhone/iPad), Desktop PC, PWA & Máy in nhiệt 58mm/80mm

---

## 1. MA TRẬN TƯƠNG THÍCH THEO MÔI TRƯỜNG & THIẾT BỊ

| Nền tảng | Trình duyệt / Môi trường | In qua Hộp thoại Hệ thống (`window.print()`) | In Web Bluetooth ESC/POS | Xuất PDF | Ghi chú & Đánh giá |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Android** | Chrome / Edge | ✅ **PASS** | ✅ **PASS** | ✅ **PASS** | Hỗ trợ đầy đủ Web Bluetooth API. In trực tiếp không cần cài app trung gian. |
| **Android** | PWA Installed (Standalone) | ✅ **PASS** | ✅ **PASS** | ✅ **PASS** | Hoạt động trơn tru như ứng dụng native. |
| **iOS / iPadOS** | Safari (Web) | ✅ **PASS** | ⚠️ *Cần app cầu nối* | ✅ **PASS** | Apple Safari không mở Web Bluetooth API. Tự động fallback sang In hệ thống (AirPrint) hoặc xuất PDF. |
| **iOS / iPadOS** | PWA Home Screen | ✅ **PASS** | ⚠️ *Cần app cầu nối* | ✅ **PASS** | Hộp thoại in hệ thống mở mượt mà theo đúng khổ giấy 58mm/80mm. |
| **Desktop Windows** | Chrome / Edge / Brave | ✅ **PASS** | ✅ **PASS** | ✅ **PASS** | In qua Bluetooth hoặc máy in nhiệt cắm cổng USB/LAN. |
| **macOS** | Safari / Chrome | ✅ **PASS** | ✅ **PASS** (Chrome) | ✅ **PASS** | Safari in qua CUPS driver; Chrome hỗ trợ Bluetooth. |

> [!NOTE]
> **Đánh giá về Web Bluetooth trên iOS:**
> Theo tiêu chuẩn bảo mật của Apple, WebKit/Safari trên iOS hiện tại không hỗ trợ Web Bluetooth trực tiếp từ trình duyệt web. Do đó, trên iOS, giải pháp tối ưu số 1 không phát sinh chi phí là **In qua Hộp thoại Hệ thống (AirPrint / System Print)** với CSS khổ giấy chính xác hoặc sử dụng máy in nhiệt hỗ trợ WiFi/LAN mạng nội bộ.

---

## 2. KIẾN TRÚC PRINT ADAPTERS ĐỘC LẬP

Hệ thống được thiết kế theo mẫu Adapter mở rộng:

1. **`BrowserPrintAdapter` (Universal Core):**
   - Áp dụng CSS `@page` với kích thước chuyên biệt:
     - 58mm: `@page { size: 58mm auto; margin: 0; }`
     - 80mm: `@page { size: 80mm auto; margin: 0; }`
   - Loại bỏ hoàn toàn header/footer mặc định của trình duyệt (URL, tiêu đề trang, số trang).
   - Đảm bảo chất lượng in sắc nét cao trên mọi máy in hệ điều hành nhận diện được.
2. **`BluetoothPrintAdapter` (ESC/POS High Performance):**
   - Kết nối trực tiếp qua Web Bluetooth GATT Service (hỗ trợ các UUID thông dụng: `000018f0`, `e7810a0a`, `49535343`, `0000af30`, `0000ff00`).
   - Tốc độ in cực nhanh (~0.3s - 0.5s).
   - Truyền tải lệnh in ảnh logo đơn sắc trực tiếp từ buffer nhị phân.
3. **Khả năng mở rộng tương lai (Future-Proof):**
   - Có thể bổ sung `NetworkPrintAdapter` (in cổng 9100 socket TCP qua WiFi/LAN) hoặc `CapacitorPrintAdapter` nếu đóng gói app Android APK native mà không cần thay đổi Receipt Engine.

---

## 3. CÁC TÍNH NĂNG CẦN KIỂM THỬ VỚI MÁY IN VẬT LÝ THẬT

1. **Kiểm tra độ đậm nhạt (Density) của đầu nhiệt:** Tùy thuộc vào cuộn giấy nhiệt của quán (giấy K57 hay K80 nhạy nhiệt cao hay thấp).
2. **Kiểm tra dao cắt tự động (Auto-Cutter):** Máy in 80mm có dao cắt tự động nhận lệnh `GS V 0x00`. Một số dòng máy 58mm mini xé tay sẽ bỏ qua lệnh cắt.
3. **Mã trang ký tự tiếng Việt (Codepage):** Nếu ROM máy in nhiệt không nạp bảng mã UTF-8 tiếng Việt, chế độ in không dấu (`removeVietnameseDiacritics`) sẽ tự động được kích hoạt để bill in ra không bị lỗi ký tự rác.
