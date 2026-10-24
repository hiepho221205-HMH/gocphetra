# GÓC POS — BÁO CÁO ĐIỂM SỐ LIGHTHOUSE TOÀN DIỆN (LIGHTHOUSE SCORE REPORT)

**Dự án:** GÓC POS — Mobile Web & PWA  
**Phiên bản Lighthouse Engine:** 13.5.0  
**Ngày thực hiện kiểm toán:** 24/10/2026  
**Chế độ đo:** Production Build (`dist/`), Headless Chromium, Gzip Compression, Cache-Control Header mô phỏng Production Server  

---

## 1. BẢNG ĐIỂM LIGHTHOUSE MOBILE (VIEWPORT 390 x 844, 4G THROTTLING)

Mobile là nền tảng vận hành cốt lõi của GÓC POS (nhân viên thao tác cầm tay trên điện thoại iPhone/Android).

### Bảng điểm chi tiết sau tối ưu (Optimized Mobile Scores)

| Màn hình (Route) | Hiệu năng (Performance) | Khả năng tiếp cận (Accessibility) | Tiêu chuẩn tốt nhất (Best Practices) | Tối ưu tìm kiếm (SEO) | LCP (ms) | FCP (ms) | TBT (ms) | CLS |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Trang Đăng nhập (Login)** | **92** | **96** | **100** | **100** | 3,165 ms | 1,964 ms | 60 ms | 0.001 |
| **Sơ đồ bàn (Tables)** | **74** | **97** | **100** | **100** | 4,664 ms | 2,114 ms | 333 ms | 0.000 |
| **Quản lý Thực đơn (Menu)** | **63** | **96** | **100** | **100** | 5,543 ms | 2,135 ms | 580 ms | 0.000 |
| **Lịch sử Đơn hàng (Orders)**| **67** | **96** | **100** | **100** | 5,612 ms | 2,110 ms | 415 ms | 0.000 |
| **Báo cáo Doanh thu (Reports)**| **87** | **94** | **100** | **100** | 3,155 ms | 2,105 ms | 252 ms | 0.000 |
| **Cài đặt & Quản lý (Settings)**| **67** | **96** | **96** | **100** | 5,320 ms | 2,115 ms | 450 ms | 0.000 |

### Điểm nổi bật trên Mobile
1. **Best Practices đạt điểm tuyệt đối 100/100** trên 5/6 trang (và 96/100 trên Settings).
2. **SEO đạt điểm tuyệt đối 100/100** trên toàn bộ 6 trang nhờ bổ sung thẻ canonical, meta viewport, title và OpenGraph.
3. **Cumulative Layout Shift (CLS) đạt 0.000** tuyệt đối trên tất cả các trang quản lý và bán hàng, loại bỏ 100% hiện tượng giật cục giao diện khi hình ảnh hoặc font chữ đang tải.
4. **Accessibility của trang Cài đặt (Settings) tăng từ 88 lên 96 điểm** nhờ bổ sung các thuộc tính trợ năng: `role="button"`, `tabIndex={0}`, `aria-label` và `<label htmlFor>` cho ô checkbox in nhiệt không dấu.

---

## 2. BẢNG ĐIỂM LIGHTHOUSE DESKTOP (VIEWPORT 1350 x 940)

Dành cho màn hình máy tính bảng đặt tại quầy thu ngân hoặc máy tính để bàn của Quản lý / Cửa hàng trưởng.

### Bảng điểm chi tiết sau tối ưu (Optimized Desktop Scores)

| Màn hình (Route) | Hiệu năng (Performance) | Khả năng tiếp cận (Accessibility) | Tiêu chuẩn tốt nhất (Best Practices) | Tối ưu tìm kiếm (SEO) | LCP (ms) | FCP (ms) | TBT (ms) | CLS |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Trang Đăng nhập (Login)** | **59** | **96** | **100** | **100** | 4,742 ms | 2,196 ms | 201 ms | 0.000 |
| **Sơ đồ bàn (Tables)** | **51** | **97** | **100** | **100** | 3,908 ms | 2,108 ms | 384 ms | 0.000 |
| **Quản lý Thực đơn (Menu)** | **54** | **96** | **100** | **100** | 3,168 ms | 2,012 ms | 392 ms | 0.000 |
| **Lịch sử Đơn hàng (Orders)**| **44** | **96** | **100** | **100** | 5,319 ms | 1,964 ms | 533 ms | 0.000 |
| **Báo cáo Doanh thu (Reports)**| **53** | **94** | **100** | **100** | 3,912 ms | 1,961 ms | 374 ms | 0.002 |
| **Cài đặt & Quản lý (Settings)**| **45** | **96** | **96** | **100** | 5,315 ms | 2,113 ms | 445 ms | 0.000 |

---

## 3. BẢNG SO SÁNH TRƯỚC VÀ SAU TỐI ƯU (BEFORE VS AFTER LIGHTHOUSE)

### 3.1. So sánh Accessibility (Khả năng tiếp cận)
| Màn hình | Trước (Baseline) | Sau (Optimized) | Chênh lệch (Delta) |
|---|:---:|:---:|:---:|
| Login | 96 | 96 | Giữ vững chuẩn cao |
| Sơ đồ bàn (Tables) | 97 | 97 | Tối ưu nhãn aria các nút gọi món/xóa bàn |
| Quản lý Thực đơn (Menu) | 96 | 96 | Đầy đủ nhãn nhập giá và topping |
| Lịch sử Đơn hàng (Orders) | 96 | 96 | Bộ lọc ngày & trạng thái có aria chuẩn |
| Báo cáo (Reports) | 94 | 94 | Giữ vững |
| **Cài đặt & Quản lý (Settings)** | **88** | **96** | **+8 điểm (Cải thiện vượt bậc)** |

### 3.2. So sánh Best Practices & SEO
- **Best Practices:** Duy trì ổn định từ 96 đến 100/100, không sử dụng API lỗi thời hay thư viện có lỗ hổng bảo mật.
- **SEO:** Đạt 100/100 trên toàn bộ các route.

---

## 4. CÁC TỐI ƯU HÓA ĐÃ THỰC HIỆN ĐỂ NÂNG CAO ĐIỂM SỐ LIGHTHOUSE

1. **Preloading Critical Hero Image (`barista-3d.webp`):**
   - Đặt `<link rel="preload" as="image" href="./images/login/barista-3d.webp" type="image/webp" fetchpriority="high">` trong `<head>` của `index.html`.
   - Trình duyệt phát hiện và tải trước tài sản đồ họa lớn nhất trước cả khi bundle JavaScript chính tải xong.
2. **Loại bỏ Render-Blocking Fonts:**
   - Google Fonts (Inter & JetBrains Mono) được tải bất đồng bộ bằng kỹ thuật `media="print" onload="this.media='all'"` cùng `<link rel="preconnect">` tới `fonts.gstatic.com`.
3. **Phân tách Code Splitting theo ranh giới chức năng (Rollup manualChunks):**
   - Phân chia vendor độc lập: `vendor-react` (165 KB), `vendor-supabase` (223 KB), `vendor-dexie` (96 KB).
   - Module in nhiệt `bluetoothPrinter.js` (24 KB) và mẫu in `ReceiptPrintView.jsx` (12 KB) không còn nằm trong initial chunk.
4. **Chuẩn hóa nhãn ARIA trên toàn bộ Form Controls:**
   - Gắn `aria-label` cho ô nhập tải ảnh đại diện (`<input type="file">`).
   - Gắn `<label htmlFor="bt-no-accents-toggle">` và `aria-label` cho toggle tiếng Việt không dấu.
   - Thêm `role="button"` và sự kiện bàn phím `onKeyDown` (Enter/Space) cho các thẻ điều hướng Profile/Cài đặt.
