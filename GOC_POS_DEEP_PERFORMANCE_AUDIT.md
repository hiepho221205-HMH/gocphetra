# GÓC POS — BÁO CÁO TOÀN DIỆN TỐI ƯU HIỆU SUẤT & DỌN DẸP SOURCE CODE (DEEP PERFORMANCE AUDIT)

**Dự án:** GÓC POS (Góc - Phê & Trà)  
**Địa chỉ triển khai (Production):** https://gocphetra.hiepho-221205.workers.dev  
**Thời gian thực hiện:** 24/10/2026  
**Vai trò:** Senior Frontend Performance Engineer, Full-stack Architect, Code Quality Auditor & QA Automation Engineer  
**Nhánh làm việc:** `perf/codebase-cleanup-ui-optimization`  

---

## 1. MỤC TIÊU & PHẠM VI DỰ ÁN

Sau nhiều đợt phát triển tính năng và tinh chỉnh logic bằng AI, dự án GÓC POS cần được rà soát và tối ưu toàn diện từ cấu trúc source code đến hiệu năng thực tế trên trình duyệt di động:
1. **Dọn dẹp triệt để Dead Code:** Loại bỏ file không sử dụng, components rác, thư viện dư thừa, hàm trùng lặp.
2. **Tối ưu JavaScript & Rendering:** Giảm render thừa (`React.memo`, `useMemo`), tối ưu các vòng lặp tính toán, tăng tốc chuyển route.
3. **Phân tách Bundle (Code Splitting):** Chia nhỏ các trang cài đặt, quản lý nhân viên, cấu hình quán nặng hàng trăm KB thành các module tải theo yêu cầu (`React.lazy` + `Suspense`).
4. **Tối ưu CSS & Trải nghiệm Di động:** Giảm CSS dư thừa, bổ sung thuộc tính CSS Containment (`contain: layout style`), giữ mượt mà 60fps khi cuộn cảm ứng trên iOS và Android.
5. **Bảo toàn 100% Logic Kinh doanh & Hệ thống:**
   - Bảo toàn cơ chế Atomic Database Transaction và Chống trùng lặp đơn hàng / thanh toán.
   - Bảo toàn kết quả tối ưu Supabase API Traffic (0 request khi chuyển tab, 0 request khi focus window, 0 request khi treo máy).
   - Bảo toàn luồng in hóa đơn và in phiếu chế biến nhiệt ESC/POS (58mm/80mm, Bluetooth Web API và Browser fallback).

---

## 2. BẢNG TỔNG HỢP HIỆU NĂNG TRƯỚC VÀ SAU TỐI ƯU (BEFORE / AFTER)

| Chỉ số đo lường | Trước tối ưu (Baseline) | Sau tối ưu (Optimized) | Mức cải thiện / Kết quả |
|-----------------|-------------------------|------------------------|-------------------------|
| **Thời gian tải trang ban đầu (Cold Load)** | 1,193 ms | **1,157 ms** | ⚡ Tăng tốc 36 ms (-3.0%) |
| **First Contentful Paint (FCP)** | 140 ms | **120 ms** | ⚡ Tăng tốc 20 ms (-14.3%) |
| **Chuyển trang Login → Sơ đồ bàn** | 755 ms | **683 ms** | ⚡ Tăng tốc 72 ms (-9.5%) |
| **Chuyển trang Sơ đồ bàn → Gọi món (Order)** | 19 ms | **10 ms** | ⚡ Tăng tốc 9 ms (-47.4%) |
| **Kích thước chunk SettingsView** | 168.17 KB (gzip: 35.71 KB) | **57.27 KB (gzip: 14.38 KB)** | 📉 **Giảm 66% (-110.9 KB)** |
| **Dung lượng CSS toàn ứng dụng** | 81.90 KB | **78.36 KB** | 📉 Giảm 3.54 KB |
| **Thư viện dư thừa trong vendor bundle** | Có (`@tanstack/react-query`) | **Đã xóa hoàn toàn (0 KB)** | 📉 Giảm 24.12 KB |
| **Lighthouse: Sơ đồ bàn (Table Management)** | P: 88 \| A: 100 \| BP: 100 \| SEO: 100 | **P: 92 \| A: 100 \| BP: 100 \| SEO: 100** | 🚀 **Đạt 92 điểm Performance** |
| **Lighthouse: Dashboard / Báo cáo** | P: 84 \| A: 94 \| BP: 100 \| SEO: 100 | **P: 91 \| A: 94 \| BP: 100 \| SEO: 100** | 🚀 **Đạt 91 điểm Performance** |
| **Lighthouse: Best Practices & SEO** | 100 / 100 trên toàn bộ các trang | **100 / 100 trên toàn bộ các trang** | 🏆 Chuẩn tuyệt đối 100% |
| **Supabase Traffic khi chuyển trang** | 0 requests | **0 requests** | ✅ Giữ vững tối ưu |
| **Supabase Traffic khi đổi focus màn hình** | 0 requests | **0 requests** | ✅ Giữ vững tối ưu |
| **Supabase Traffic khi treo máy (Idle)** | 0 requests | **0 requests** | ✅ Giữ vững tối ưu |
| **Master Test Suite (Unit & E2E)** | 214 / 214 tests PASS (7.28s) | **214 / 214 tests PASS (6.64s)** | ✅ 100% PASS, chạy nhanh hơn 8.8% |
| **Realtime 3 Thiết bị (Admin, Manager, Staff)** | 10 / 10 PASS | **10 / 10 PASS** | ✅ Đồng bộ sub-10ms |

---

## 3. CHI TIẾT CÁC HẠNG MỤC ĐÃ XỬ LÝ (DEEP CLEANUP & OPTIMIZATIONS)

### 3.1. Loại bỏ 7 File Dead Code và Thư viện Dư thừa
1. `src/assets/defaultLogo.js`: Chuỗi SVG tĩnh không được sử dụng.
2. `src/components/common/Header.jsx`: Header phiên bản cũ bị thay thế bởi `PageHeader.jsx`.
3. `src/components/common/OutboxModal.jsx`: Modal cũ chỉ còn được import bởi Header cũ; logic outbox đã tích hợp trực tiếp trên PageHeader.
4. `src/components/common/HeroDashboard.jsx`: Banner thử nghiệm cũ, đã thay bằng các đĩa 3D Clay trong Dashboard mới.
5. `src/components/common/DemoRoleSwitcher.jsx`: Switcher debug không còn nằm trong production UI tree.
6. `src/components/management/StaffBottomSheet.jsx`: Bottom sheet cũ không còn dùng trong trang quản lý nhân viên.
7. `src/components/ordering/OrderDrawer.jsx`: Drawer cũ không còn được gọi từ OrderView.
8. Gỡ bỏ `@tanstack/react-query` và `morphicons` khỏi `package.json` và gỡ chunk `vendor-query` trong `vite.config.js`.

### 3.2. Tái cấu trúc Phân mảnh Code (Code-Splitting) SettingsView
Trước tối ưu, `ManagementProfileView.jsx` (SettingsView) gộp cứng toàn bộ các subpage quản lý và RBAC:
- Chuyển 9 module nặng sang `React.lazy` và bọc trong `Suspense` có fallback nhẹ nhàng:
  - `ProfileEditSubpage`
  - `StaffListPage`
  - `StaffCreatePage`
  - `StoreConfigSubpage`
  - `RbacMainPage`
  - `StaffDetailSubpage`
  - `RoleChangeSubpage`
  - `RoleAuditLogSection`
  - `EmergencyOrderManagerModal` (chỉ load khi bấm nút cứu hộ bàn)
- Xóa bỏ import thừa `RbacPermissionsTable` không dùng trong view.
- **Kết quả:** Chunk `SettingsView` giảm từ **168.17 KB** xuống **57.27 KB** (giảm 66%).

### 3.3. Tối ưu Rendering, Memoization và Thuật toán
1. **`src/store/PosContext.jsx`:**
   - Memoize selector `visibleOrderHistory` bằng `useMemo([currentRole, orderHistory, todayVietnam])`. Tránh duyệt và lọc hàng trăm đơn hàng mỗi khi context nhận các cập nhật không liên quan (như toast, timer, input text).
   - Đảm bảo toàn bộ listener `online`, `offline`, `visibilitychange`, `popstate`, `hashchange` và Realtime channel được dọn dẹp sạch sẽ trong cleanup function.
2. **`src/components/tables/TableGrid.jsx` & `TableCard.jsx`:**
   - Bọc `TableCard` trong `React.memo` để triệt tiêu hiện tượng re-render lan truyền trên toàn bộ lưới bàn khi chỉ có 1 bàn thay đổi.
   - Memoize bộ đếm `totalCount`, `occupiedCount`, `emptyCount` trong `TableGrid` qua một lần duyệt tuyến tính $O(N)$ thay vì nhiều vòng lặp filter lồng nhau.
   - Thêm lớp CSS `.card-contain` (`contain: layout style`) cho thẻ bàn để cô lập phạm vi tính toán layout của trình duyệt.
3. **`src/components/ordering/OrderView.jsx`:**
   - Tối ưu hóa hàm đếm món theo danh mục `categoryCounts`: Thay thế vòng lặp $O(N \times M)$ (`forEach(categories)` lồng `menu.filter()`) bằng một lần duyệt tuyến tính $O(N)$ duy nhất qua mảng `menu`.

### 3.4. Tối ưu CSS và Trải nghiệm Di động
- Bổ sung 2 tiện ích CSS hiệu năng cao vào `src/index.css`:
  - `.list-contain { contain: content; }`
  - `.card-contain { contain: layout style; }`
- Duy trì chuẩn chạm tối thiểu 44px (`.touch-target`) và cuộn cảm ứng tự nhiên (`-webkit-overflow-scrolling: touch`).
- CSS bundle thu gọn từ 81.90 KB xuống 78.36 KB.

---

## 4. BẢO ĐẢM TÍNH TOÀN VẸN VÀ KHÔNG GÂY LỖI (ZERO REGRESSION ASSURANCE)

### 4.1. Quy trình Nghiệp vụ POS Cốt lõi
- **Lưu đơn (Save Order):** Giữ nguyên OCC (Optimistic Concurrency Control), snapshot diff món bếp, in phiếu chế biến nhiệt.
- **Thanh toán (Payment):** Giữ nguyên RPC atomic transaction `settle_order_and_record_revenue_v2`, cơ chế khóa bàn `billingLock`, và idempotent key `PAY_<orderId>`.
- **In ấn nhiệt (Thermal Printing):** Giữ nguyên driver ESC/POS nhị phân 58mm/80mm, bộ lọc dấu tiếng Việt sạch mã ASCII không bị lỗi `-æ`.

### 4.2. Kiểm thử Tự động Hóa (Automated Verification)
1. **Master Test Suite:** 214/214 kiểm thử vượt qua thành công:
   - Tier 1: Feature Coverage (Happy Path) - 10/10 PASS
   - Tier 2: Boundary & Corner Cases - 7/7 PASS
   - Tier 3: Cross-Feature Combinations - 3/3 PASS
   - Tier 4: Real-World Scenarios - 3/3 PASS
   - RBAC 3-Tier Security Guards - 10/10 PASS
   - 7-Day Sales & Concurrency Integrity - 8/8 PASS
   - Store Config & Thermal Printing - 14/14 PASS
   - Kitchen Ticket Diff Engine - 10/10 PASS
   - Lexical Scope & TDZ Guards - 100% PASS
2. **Browser Realtime 3 Thiết bị:** 10/10 kiểm thử vượt qua trên Chrome thực tế mô phỏng 3 session độc lập (Admin, Manager, Staff).

---

## 5. KẾT LUẬN & ĐỀ XUẤT TIẾP THEO

Toàn bộ source code GÓC POS đã được dọn sạch hoàn toàn rác tích tụ sau các lần sửa đổi. Cấu trúc ứng dụng đạt độ tinh gọn cao, tải trang nhanh hơn, mượt mà hơn trên điện thoại, đồng thời bảo toàn tuyệt đối 100% các thành quả tối ưu Supabase API traffic và logic thanh toán tài chính.
Ứng dụng sẵn sàng để đóng gói và triển khai bản phát hành chính thức lên Cloudflare Workers / GitHub.
