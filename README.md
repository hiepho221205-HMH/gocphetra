# GÓC – Phê & Trà POS ☕📱

> Hệ thống quản lý bán hàng (POS) chuyên biệt cho quán cà phê & trà, thiết kế Mobile-First Glassmorphism chuẩn nhận diện `#214E34 & #FFFFFF`. Tích hợp đồng bộ dữ liệu đám mây thời gian thực với **Supabase Cloud (PostgreSQL)** và hỗ trợ thanh toán VietQR tự động.

---

## 🚀 Tính Năng Chính

* **Sơ đồ bàn tương tác**: Quản lý 12+ bàn theo khu vực, hiển thị thời gian khách ngồi, đổi bàn và gộp bàn thông minh.
* **Gọi món & Tùy chỉnh (Customizer)**: Hỗ trợ chọn size (M/L), định lượng đá, độ ngọt và topping (chung/riêng theo món) với giá override linh hoạt.
* **Thanh toán đa phương thức**: Tiền mặt, tách lượt thanh toán (split payments), in tạm tính và sinh mã VietQR ngân hàng (MBBank) kèm số tiền động.
* **Đồng bộ Đám mây 2 chiều (Supabase Realtime)**:
  * Kiến trúc **Cache-First (Offline-safe)**: Mở trang tức thì dưới 100ms dựa trên LocalStorage cache.
  * Tự động đồng bộ trạng thái bàn và đơn hàng giữa các thiết bị nhân viên/thu ngân qua WebSockets.
  * Tự động bảo vệ và đẩy đơn hàng cục bộ lên Cloud khi có mạng trở lại.
* **Báo cáo doanh thu & Thống kê**: Tổng hợp doanh thu thực thu theo mốc thời gian (1 ngày, 3 ngày, 7 ngày, 30 ngày), phân bổ doanh thu Tiền mặt vs VietQR, giá trị đơn trung bình (AOV).
* **Quản trị thực đơn & Topping**: Thêm/sửa/xóa món, danh mục, bật/tắt trạng thái hết hàng tức thì.

---

## 🛠️ Công Nghệ Sử Dụng

* **Frontend**: React 18, Vite 6, Tailwind CSS, Lucide Icons, `clsx`, `tailwind-merge`.
* **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL 15+, PostgREST, Realtime Replication, Row Level Security).
* **Triển khai**: Sẵn sàng deploy tĩnh trên **Cloudflare Pages**, Vercel hoặc Netlify.

---

## 📦 Cài Đặt & Chạy Môi Trường Phát Triển

### 1. Cài đặt thư viện:
```bash
npm install
```

### 2. Thiết lập Biến môi trường:
Tạo file `.env` từ mẫu `.env.example`:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### 3. Chạy ứng dụng ở chế độ dev:
```bash
npm run dev
```
Mở trình duyệt tại: `http://localhost:3000`

### 4. Build bản chạy thực tế (Production):
```bash
npm run build
```
Thư mục xuất bản: `dist/`

---

## 🗄️ Khởi Tạo Cơ Sở Dữ Liệu Supabase

Toàn bộ mã SQL DDL cho 7 bảng, phân quyền Row Level Security (RLS) và Realtime đã được đóng gói tại file:
👉 **[`supabase/schema.sql`](supabase/schema.sql)**

1. Mở **SQL Editor** trên Supabase Dashboard.
2. Sao chép toàn bộ nội dung trong `supabase/schema.sql` và dán vào SQL Editor.
3. Nhấn **Run** để khởi tạo các bảng:
   * `categories`
   * `menu_items`
   * `toppings`
   * `product_toppings`
   * `tables`
   * `orders`
   * `settings`
4. Vào tab **Cài đặt** trên ứng dụng POS và bấm **"Đẩy dữ liệu lên Cloud"** để nạp dữ liệu mẫu ban đầu.

---

## ☁️ Triển Khai Lên Cloudflare Pages

1. **Framework preset**: `Vite` (hoặc `None`)
2. **Build command**: `npm run build`
3. **Build output directory**: `dist`
4. **Environment Variables**:
   * `NODE_VERSION`: `20`
   * `VITE_SUPABASE_URL`: URL dự án Supabase của bạn.
   * `VITE_SUPABASE_PUBLISHABLE_KEY`: Khóa Publishable Key từ Supabase.

---

## 📄 Bản Quyền

Bản quyền © 2026 Quán Cà Phê GÓC. Bảo lưu mọi quyền.
