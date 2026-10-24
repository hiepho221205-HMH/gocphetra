# GÓC POS — BÁO CÁO DỌN DẸP MÃ NGUỒN & TECHNICAL DEBT (CODE CLEANUP REPORT)

**Dự án:** GÓC POS  
**Ngày thực hiện:** 24/10/2026  
**Chế độ thực thi:** DEEP CODEBASE REFACTORING & DEPENDENCY PRUNING  

---

## 1. MỤC TIÊU DỌN DẸP

Trải qua nhiều lần nâng cấp tính năng thông qua hỗ trợ tự động, dự án GÓC POS đã tích tụ một số thành phần dư thừa:
- Các component prototype sơ khai không còn được import vào cây component chính.
- Các file tiện ích thử nghiệm (validator Zod) không được tích hợp vào luồng chạy ứng dụng.
- Các gói dependency khai báo trong `package.json` nhưng không có bất kỳ câu lệnh `import` nào trong source code `src/`.
- Các câu lệnh import tĩnh (static imports) module nặng nề trong component thường dùng, làm phình to chunk JavaScript chính.

---

## 2. CHI TIẾT CÁC FILE MÃ NGUỒN ĐÃ ĐƯỢC XÓA BỎ

Dựa trên phân tích tham chiếu tĩnh (AST lexical grep) và kiểm tra TDZ (Temporal Dead Zone), 3 file mồ côi đã được xác minh không có bất kỳ liên kết nào trong ứng dụng và đã được xóa bỏ:

| Đường dẫn file | Kích thước | Lý do xóa bỏ | Trạng thái kiểm tra |
|---|:---:|---|:---:|
| `src/components/ordering/CartItemList.jsx` | 94 dòng (2.8 KB) | Component prototype giỏ hàng cũ. Giao diện gọi món hiện tại (`OrderView.jsx`) sử dụng inline claymorphic cart panel tối ưu riêng cho mobile 390px. | 0 references |
| `src/components/ordering/MenuItemCard.jsx` | 81 dòng (2.6 KB) | Component prototype hiển thị card món độc lập cũ. `OrderView.jsx` đã chuyển sang hiển thị lưới 2 cột tích hợp nút thêm món và chấm trạng thái còn/hết hàng trực tiếp. | 0 references |
| `src/utils/validators.js` | 134 dòng (3.9 KB) | Schema validator dùng thư viện `zod` viết thử nghiệm, không nằm trong luồng dữ liệu runtime của POS (POS sử dụng IndexedDB Dexie và Supabase schema validation tự động). | 0 references |

---

## 3. CẮT GIẢM DEPENDENCY TRONG `package.json`

Sau khi quét toàn bộ thư mục `src/` và `tests/`, đã xác định 3 dependency hoàn toàn không được sử dụng trong mã nguồn:

| Gói phụ thuộc (Package) | Phiên bản cũ | Tình trạng sử dụng trong code | Hành động thực hiện |
|---|:---:|---|:---:|
| `clsx` | `^2.1.1` | 0 câu lệnh import trong `src/` (dự án sử dụng chuỗi template literals Tailwind chuẩn) | **Gỡ bỏ hoàn toàn** |
| `tailwind-merge` | `^2.6.0` | 0 câu lệnh import trong `src/` | **Gỡ bỏ hoàn toàn** |
| `zod` | `^4.6.7` | Chỉ xuất hiện trong file mồ côi `validators.js` đã xóa | **Gỡ bỏ hoàn toàn** |

**Kết quả từ lệnh `npm uninstall clsx tailwind-merge zod`:**
- Loại bỏ 5 package phụ thuộc khỏi `node_modules` và `package-lock.json`.
- Giảm thiểu rủi ro bảo mật tiềm ẩn và thời gian chạy `npm install` trên CI/CD.
- Không gây ảnh hưởng đến bất kỳ tính năng bán hàng hay hiển thị nào của giao diện.

---

## 4. TỐI ƯU HÓA IMPORT & CODE-SPLITTING THEO NHU CẦU (DYNAMIC IMPORT)

### 4.1. Tách module máy in nhiệt Bluetooth (`bluetoothPrinter.js`)
- **Trước tối ưu:** Cả `OrderView.jsx` và `ManagementProfileView.jsx` đều import tĩnh `bluetoothPrinter.js` (24.35 KB, kéo theo cả bộ giải mã đồ họa `thermalCanvasRenderer.js` 619 dòng và `thermalLogoProcessor.js`).
- **Sau tối ưu:**
  - Chuyển thành Dynamic Import (`await import('../../utils/bluetoothPrinter')`) chỉ kích hoạt khi người dùng thực sự bấm các nút:
    - *In phiếu bếp* trong OrderView.
    - *Tìm & Ghép nối máy in* trong Cài đặt.
    - *In thử nghiệm 57mm* trong Cài đặt.
  - Các hàm kiểm tra đơn giản như `isBluetoothSupported` được chuyển thành inline helper một dòng (`Boolean(navigator.bluetooth)`).
  - Kết quả: Khi mở Cài đặt hoặc Gọi món, thiết bị không cần tải 25 KB mã in nhiệt nếu không sử dụng Bluetooth.

### 4.2. Tách module xem trước hóa đơn (`ReceiptPrintView.jsx`)
- Trong `StoreConfigSubpage.jsx`, `ReceiptPrintView` (12.21 KB) được cô lập vào khối điều kiện `showTestPrintModal && (...)` và bọc trong `<Suspense fallback={null}>`, giảm tải dung lượng khi truy cập cấu hình chi nhánh.

---

## 5. DỌN DẸP & HỢP NHẤT STATE MANAGEMENT TRONG `PosContext.jsx`

1. **Gom cụm chốt doanh thu (`batchUpsertDailyClosuresToCloud`):**
   - Loại bỏ các vòng lặp gửi request đơn lẻ từng ngày lên Supabase.
   - Thêm bộ đệm tham chiếu `dailyClosuresRef` đồng bộ với bộ nhớ IndexedDB để ngăn hiện tượng re-upload doanh thu cũ mỗi khi reload trang.
2. **Dọn dẹp sao chép dữ liệu trong `OrderView.jsx`:**
   - Thay thế `JSON.parse(JSON.stringify(existingItems))` bằng hàm sao chép trực tiếp `fastCloneCartItems`:
     ```javascript
     function fastCloneCartItems(items) {
       if (!Array.isArray(items)) return [];
       return items.map((it) => ({
         ...it,
         toppings: Array.isArray(it.toppings) ? it.toppings.map((tp) => ({ ...tp })) : []
       }));
     }
     ```
   - Cắt giảm 100% chi phí parse chuỗi JSON lặp đi lặp lại khi chuyển bàn và cập nhật món.

---

## 6. KIỂM CHỨNG TÍNH TOÀN VẸN VÀ KHÔNG GÂY LỖI REGRESSION

- Chạy kiểm tra tĩnh AST bằng công cụ `tdz_scope_guard.test.js`: **0 Temporal Dead Zone violations** trên toàn bộ cây thư mục `src/`.
- Chạy toàn bộ master test runner: **272 / 272 tests passed** trong **8.83s**.
- Chạy `npm run build`: Hoàn tất trong **4.92s** với 0 warning và 0 error.
