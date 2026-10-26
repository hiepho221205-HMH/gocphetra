import React, { useState, useMemo } from 'react';
import { usePos } from '../../store/PosContext';
import { getStaffInitials } from '../../utils/router';
import { getStaffDisplayCode } from '../management/StaffListPage';
import { formatVietnamDateTime } from '../../utils/dateTime';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  User,
  Mail,
  Phone,
  Calendar,
  Building,
  Clock,
  Laptop,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  UserCheck,
  History,
  KeyRound,
  Smartphone,
  Info
} from 'lucide-react';

export default function StaffDetailSubpage() {
  const {
    staffList = [],
    userProfiles = {},
    auditLogs = [],
    currentRole,
    routeParams = {},
    navigate
  } = usePos();

  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'history' | 'device'

  // Tìm nhân viên theo id từ routeParams
  const staffId = routeParams.id || (staffList[0]?.id);
  const staff = useMemo(() => {
    return staffList.find((s) => s.id === staffId) || staffList[0] || null;
  }, [staffList, staffId]);

  // Kiểm tra nếu nhân sự này là Admin duy nhất trong hệ thống
  const isSoleAdmin = useMemo(() => {
    if (staff?.role === 'admin') {
      const activeAdmins = staffList.filter((s) => s.role === 'admin' && s.status === 'active');
      return activeAdmins.length <= 1;
    }
    return false;
  }, [staff, staffList]);

  if (!staff) {
    return (
      <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-2xs space-y-3">
        <p className="text-xs font-bold text-gray-700">Không tìm thấy thông tin nhân viên</p>
        <button
          type="button"
          onClick={() => navigate('/rbac')}
          className="touch-target px-3 py-1.5 bg-forest-800 text-white rounded-xl text-xs font-bold"
        >
          Quay lại danh sách phân quyền
        </button>
      </div>
    );
  }

  const profile = userProfiles[staff.id] || {};
  const initials = getStaffInitials(staff.name);
  const avatarUrl = staff.avatarUrl || profile.avatarUrl;
  const isStaffAdmin = staff.role === 'admin';
  const isStaffManager = staff.role === 'manager';
  const isActive = staff.status === 'active';

  // Lọc lịch sử hoạt động liên quan đến nhân sự này
  const staffAuditLogs = useMemo(() => {
    return (auditLogs || []).filter(
      (log) =>
        log.resourceId === staff.id ||
        log.targetStaffId === staff.id ||
        log.userId === staff.id ||
        (log.details && log.details.targetName === staff.name)
    );
  }, [auditLogs, staff]);

  return (
    <div className="space-y-4 animate-fadeIn pb-12" data-testid="staff-detail-subpage">
      {/* 1. Header có nút Back */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-testid="detail-back-to-rbac-btn"
            onClick={() => navigate('/rbac')}
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
            aria-label="Quay lại Phân quyền"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
              Chi tiết Nhân viên
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Hồ sơ phân quyền & lịch sử tài khoản
            </p>
          </div>
        </div>

        {/* Badge trạng thái */}
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold border shadow-2xs ${
            isActive
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <span>{isActive ? 'Đang hoạt động' : 'Tạm khóa'}</span>
        </span>
      </div>

      {/* 2. Profile Card Tổng quan */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs space-y-3">
        <div className="flex items-start gap-3.5">
          {/* Avatar lớn */}
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={staff.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-forest-800/15 shadow-xs"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-forest-50 border-2 border-forest-800/20 text-forest-900 font-black text-lg flex items-center justify-center shadow-xs">
                {initials}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                isActive ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
          </div>

          {/* Thông tin chính */}
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-gray-900 text-sm truncate">
                {staff.name}
              </h3>
              <span className="text-[10px] font-mono font-medium text-gray-400">
                #{getStaffDisplayCode(staff)}
              </span>
            </div>

            {/* Badge Vai trò to rõ */}
            <div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border shadow-2xs ${
                  isStaffAdmin
                    ? 'bg-purple-50 text-purple-900 border-purple-200'
                    : isStaffManager
                    ? 'bg-blue-50 text-blue-900 border-blue-200'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                }`}
              >
                <Shield className="w-3 h-3" />
                <span>Vai trò: {isStaffAdmin ? 'Admin (Quản trị viên)' : isStaffManager ? 'Manager (Quản lý)' : 'Staff (Nhân viên)'}</span>
              </span>
            </div>

            {/* Thông tin liên hệ nhanh */}
            <div className="space-y-0.5 pt-1 text-[11px] text-gray-500">
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate">{staff.email || profile.email || 'Chưa cập nhật email'}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>{staff.phone || profile.phone || 'Chưa cập nhật SĐT'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Khối 3 Tab thông tin */}
      <div className="space-y-3">
        {/* Thanh chuyển tab */}
        <div className="flex bg-gray-100 p-1 rounded-xl gap-1 text-xs font-bold" data-testid="detail-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            data-testid="tab-btn-info"
            className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
              activeTab === 'info'
                ? 'bg-white text-forest-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Thông tin chung
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            data-testid="tab-btn-history"
            className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-forest-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Lịch sử ({staffAuditLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('device')}
            data-testid="tab-btn-device"
            className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
              activeTab === 'device'
                ? 'bg-white text-forest-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Thiết bị
          </button>
        </div>

        {/* Nội dung Tab 1: Thông tin chung */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs space-y-3.5 animate-fadeIn" data-testid="tab-content-info">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-forest-800" />
                <span>Phạm vi quyền hạn ({staff.role.toUpperCase()})</span>
              </h4>

              <div className="bg-forest-50/50 rounded-xl p-3 border border-forest-800/10 text-xs text-gray-700 leading-relaxed space-y-1.5">
                {isStaffAdmin && (
                  <p>
                    <strong className="text-forest-900">Quản trị viên (Admin):</strong> Toàn quyền trên toàn hệ thống. Có quyền thay đổi vai trò nhân sự, cấu hình cửa hàng & VietQR, dọn dẹp dữ liệu bán hàng an toàn và quản lý chi tiết toàn bộ chức năng POS.
                  </p>
                )}
                {isStaffManager && (
                  <p>
                    <strong className="text-blue-900">Quản lý (Manager):</strong> Vận hành thu ngân đầy đủ, cập nhật danh mục thực đơn, điều chỉnh giá bán và xem báo cáo doanh thu kinh doanh. Không có quyền đổi vai trò nhân sự hoặc xóa lịch sử bán hàng.
                  </p>
                )}
                {!isStaffAdmin && !isStaffManager && (
                  <p>
                    <strong className="text-emerald-900">Nhân viên (Staff):</strong> Phục vụ khách hàng tại bàn, tạo và gửi đơn xuống bếp, thanh toán đơn hàng và xem lịch sử hóa đơn trong ngày. Bị khóa xem doanh thu tổng và chỉnh sửa menu/giá.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
              <div className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                <div className="flex items-center gap-1.5 text-gray-400 text-[10.5px] font-semibold">
                  <Building className="w-3.5 h-3.5" />
                  <span>Chi nhánh</span>
                </div>
                <div className="font-bold text-gray-800 mt-0.5">
                  GÓC Coffee - Trụ sở chính
                </div>
              </div>

              <div className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                <div className="flex items-center gap-1.5 text-gray-400 text-[10.5px] font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Ca phân bổ</span>
                </div>
                <div className="font-bold text-gray-800 mt-0.5">
                  Ca sáng / Ca xoay
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nội dung Tab 2: Lịch sử hoạt động */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs space-y-3 animate-fadeIn" data-testid="tab-content-history">
            <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-forest-800" />
              <span>Nhật ký hoạt động tài khoản</span>
            </h4>

            {staffAuditLogs.length === 0 ? (
              <div className="text-center py-6 text-gray-400 space-y-1">
                <Info className="w-6 h-6 mx-auto text-gray-300" />
                <p className="text-xs">Chưa có lịch sử thay đổi vai trò nào cho nhân sự này.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {staffAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10.5px] text-gray-500">
                      <span className="font-bold text-forest-900">
                        {log.action === 'role_change' ? 'Thay đổi vai trò' : log.action}
                      </span>
                      <span>{log.createdAt ? formatVietnamDateTime(log.createdAt) : 'Gần đây'}</span>
                    </div>
                    {log.details && (
                      <div className="text-gray-700 text-[11px]">
                        Vai trò:{' '}
                        <span className="font-bold text-gray-500">{log.details.oldRole}</span>
                        {' ➔ '}
                        <span className="font-bold text-forest-800">{log.details.newRole}</span>
                        {log.details.note && (
                          <div className="text-gray-500 italic mt-0.5">
                            Ghi chú: "{log.details.note}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nội dung Tab 3: Thiết bị đăng nhập */}
        {activeTab === 'device' && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs space-y-3 animate-fadeIn" data-testid="tab-content-device">
            <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-forest-800" />
              <span>Thiết bị POS & Phiên đăng nhập</span>
            </h4>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-forest-50 text-forest-800 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">Thiết bị POS di động #01</div>
                    <div className="text-[10px] text-gray-400">Chrome Mobile 390px • Quầy Thu ngân</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Online
                </span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">Máy tính bảng phụ quầy pha chế</div>
                    <div className="text-[10px] text-gray-400">Tablet iPad Mini • Bếp & Bar</div>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400">
                  Hôm qua
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Bottom Action Bar: Duy nhất nút Thay đổi vai trò (hoặc ẩn nếu là Admin duy nhất) */}
      <div className="pt-2">
        {!isSoleAdmin ? (
          <button
            type="button"
            data-testid="detail-change-role-btn"
            onClick={() => navigate(`/rbac/role?id=${staff.id}`)}
            className="btn-press w-full h-12 min-h-[48px] max-h-[52px] rounded-[14px] bg-forest-800 hover:bg-forest-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>Thay đổi vai trò</span>
          </button>
        ) : (
          <div
            data-testid="sole-admin-notice-badge"
            className="w-full p-3 rounded-[14px] bg-amber-50 border border-amber-200 text-center text-xs text-amber-900 font-bold flex items-center justify-center gap-2 shadow-2xs"
          >
            <Shield className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Tài khoản Admin duy nhất của hệ thống (Không đổi quyền)</span>
          </div>
        )}
      </div>
    </div>
  );
}
