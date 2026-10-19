# Original User Request

## Initial Request — 2026-10-19T05:24:59Z

Nâng cấp màn hình Cài đặt hiện tại của hệ thống POS GÓC Coffee thành Hồ sơ Quản lý (Admin Profile) chuẩn hóa nhận diện thương hiệu (#214E34), tích hợp quản lý nhân viên tối giản, công cụ dọn dẹp dữ liệu hóa đơn lịch sử theo ngày với cơ chế an toàn nhiều bước, và thiết lập nền tảng phân quyền tài khoản (Admin/Staff).

Working directory: d:\gocoffe
Integrity mode: development

Stitch Reference Screen: projects/13227652853407273330/screens/c2c381f6320e42e9b48ab8a9ac2e9e90 (GÓC POS – Hồ sơ Quản lý)

## Requirements

### R1. Hồ sơ Quản lý (Management Profile) & Thanh điều hướng
- Cập nhật thanh điều hướng đáy (`BottomNav`): Đổi nhãn tab thứ 5 thành "Quản lý" và biểu tượng sang `ShieldCheck` mang nhận diện quản trị POS.
- Chuyển đổi màn hình tab thành Hồ sơ Quản lý chuyên nghiệp với Header hiển thị vai trò Quản lý (Admin) và avatar mặc định tông màu thương hiệu `#214E34`. Mặc định vai trò phiên đăng nhập hiện tại là Quản lý (Admin).
- Tích hợp liền mạch toàn bộ các cấu hình vận hành của quán từ phiên bản trước: Thông tin chi nhánh, ca làm việc, mật khẩu WiFi in hóa đơn, tài khoản nhận tiền VietQR (MBBank), bảng trạng thái kết nối Supabase Cloud.
- Hiển thị khối thông tin Phân quyền tài khoản chuẩn bị cho Giai đoạn 2 (bảng đối chiếu quyền giữa Quản lý và Nhân viên) và nút Đăng xuất an toàn ở cuối trang.

### R2. Quản lý Nhân viên Tối giản (Minimal Staff Management)
- Thiết lập giao diện và state quản lý danh sách nhân viên tinh gọn, chỉ bao gồm hai thông tin nghiệp vụ: Tên nhân viên và Trạng thái hoạt động (Đang hoạt động / Tạm ngưng). Không thu thập bất kỳ dữ liệu cá nhân nhạy cảm nào khác.
- Hỗ trợ đầy đủ các thao tác: Thêm nhân viên mới (mặc định trạng thái Đang hoạt động), Sửa tên nhân viên, Bật/Tắt chuyển đổi nhanh trạng thái hoạt động trực tiếp trên từng thẻ nhân viên.
- Cung cấp dữ liệu mẫu khởi tạo gồm ít nhất 3 nhân viên tương thích với lịch sử thu ngân trong hệ thống POS.

### R3. Quản lý & Dọn dẹp Dữ liệu Bán hàng An toàn (Safe Hard-Delete with Auto-Backup)
- Cung cấp 3 chế độ lựa chọn phạm vi dữ liệu lịch sử bán hàng đã hoàn tất: Theo khoảng ngày (Từ ngày... Đến ngày...), Xóa dữ liệu từ trước đến một mốc ngày, hoặc Xóa toàn bộ lịch sử đã hoàn tất.
- Quy trình an toàn 4 bước bắt buộc:
  1. **Xem trước (Preview):** Tính toán và hiển thị chính xác số lượng hóa đơn hoàn tất bị ảnh hưởng và tổng doanh thu tương ứng theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`, trường `finished_at` / `paid_at`).
  2. **Cảnh báo ảnh hưởng:** Hiển thị thông báo rõ ràng về việc báo cáo doanh thu lịch sử sẽ bị thay đổi sau khi dọn dẹp.
  3. **Tự động sao lưu (Auto-backup):** Tự động tạo và tải xuống máy người dùng tệp tin sao lưu dữ liệu JSON (`backup_orders_<timestamp>.json`) trước khi xóa.
  4. **Xác nhận 2 bước:** Yêu cầu người dùng xác nhận dứt điểm trước khi thực hiện xóa vĩnh viễn khỏi LocalStorage và Supabase.
- Tuyệt đối bảo vệ: Chỉ xử lý các đơn hàng đã thanh toán hoàn toàn (`completed`). Nghiêm cấm xóa hoặc tác động tới các bàn đang phục vụ (`serving`, `awaiting_payment`), danh mục món, thực đơn, topping, danh sách nhân viên, thông tin cấu hình quán và lịch sử phiên.

### R4. Nền tảng Phân quyền RBAC & Cơ sở dữ liệu Supabase
- Chuẩn bị file migration / schema SQL bổ sung cho Supabase bao gồm bảng `staff_profiles` (id, name, status, role, created_at, updated_at) và `data_cleanup_jobs` (id, cleanup_mode, date_range, orders_count, total_amount, performed_by, backup_file_name, created_at) kèm theo chính sách bảo mật Row Level Security (RLS).
- Đồng bộ dữ liệu nhân viên hai chiều với Supabase khi có kết nối mạng (Hybrid Offline-Safe).

## Acceptance Criteria

### Giao diện & Trải nghiệm
- [ ] Tab thứ 5 trên `BottomNav` hiển thị nhãn "Quản lý" với icon `ShieldCheck`; nhấp vào chuyển đến màn hình Hồ sơ Quản lý mượt mà.
- [ ] Giao diện Hồ sơ Quản lý tuân thủ thiết kế chuẩn Glassmorphism, tông màu chủ đạo `#214E34`, hiển thị sắc nét trên khung hình Mobile 390px lẫn chế độ toàn màn hình Desktop.
- [ ] Toàn bộ thông tin cấu hình quán (Chi nhánh, Ca làm, WiFi, VietQR) và trạng thái Supabase Cloud hiển thị đầy đủ và lưu trữ thành công khi cập nhật.

### Nghiệp vụ Quản lý Nhân viên
- [ ] Thêm được nhân viên mới; nhân viên mới xuất hiện ngay trong danh sách với huy hiệu "Đang hoạt động".
- [ ] Sửa được tên nhân viên trực tiếp và lưu thành công.
- [ ] Nhấn nút chuyển đổi trạng thái sẽ chuyển đổi qua lại giữa "Đang hoạt động" (badge xanh lá) và "Tạm ngưng" (badge xám/cam), số lượng nhân viên hoạt động ở tiêu đề cập nhật tương ứng.
- [ ] Dữ liệu nhân viên được lưu bền vững vào LocalStorage và đồng bộ lên Supabase nếu có kết nối.

### Quy trình Dọn dẹp Dữ liệu Bán hàng
- [ ] Khi chọn khoảng ngày hoặc mốc ngày, bảng Xem trước liệt kê chính xác số đơn hoàn thành và tổng tiền doanh thu tương ứng trong khoảng thời gian đó (xét theo múi giờ Việt Nam).
- [ ] Nhấn thực hiện dọn dẹp sẽ kích hoạt trình duyệt tự động tải xuống file `.json` chứa dữ liệu các đơn hàng sắp xóa.
- [ ] Modal cảnh báo và xác nhận 2 bước hiển thị rõ ràng thông điệp cảnh báo tác động đến doanh thu trước khi cho phép xác nhận lần cuối.
- [ ] Sau khi xác nhận xóa, các đơn hàng hoàn tất trong phạm vi đã chọn bị xóa khỏi danh sách lịch sử và các bảng báo cáo cập nhật tương ứng.
- [ ] Các bàn đang có khách ngồi (`serving`, `awaiting_payment`), thực đơn, danh mục và cấu hình quán hoàn toàn nguyên vẹn, không bị xóa.

### Kiểm thử & Tích hợp
- [ ] Lệnh `npm run build` thực thi thành công không có lỗi cú pháp hoặc lỗi import TypeScript/JSX nào.
- [ ] Không làm phá vỡ bất kỳ tính năng POS cốt lõi hiện có: Sơ đồ bàn, Gọi món, Thanh toán hóa đơn, Tách/Gộp bàn, Quản lý thực đơn, Báo cáo doanh thu.
