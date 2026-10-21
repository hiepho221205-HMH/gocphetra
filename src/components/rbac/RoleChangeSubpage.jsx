import React, { useState, useMemo } from 'react';
import { usePos } from '../../store/PosContext';
import { getStaffInitials } from '../../utils/router';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  X
} from 'lucide-react';

export default function RoleChangeSubpage() {
  const {
    staffList = [],
    userProfiles = {},
    currentRole,
    changeUserRole,
    showToast,
    routeParams = {},
    navigate
  } = usePos();

  const staffId = routeParams.id || (staffList[0]?.id);
  const staff = useMemo(() => {
    return staffList.find((s) => s.id === staffId) || staffList[0] || null;
  }, [staffList, staffId]);

  const [selectedRole, setSelectedRole] = useState(staff?.role || 'staff');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Safeguard: Kiểm tra xem có phải hạ quyền Admin cuối cùng không
  const isDemotingLastAdmin = useMemo(() => {
    if (staff.role === 'admin' && selectedRole !== 'admin') {
      const activeAdmins = staffList.filter(
        (s) => s.id !== staff.id && s.role === 'admin' && s.status === 'active'
      );
      return activeAdmins.length === 0;
    }
    return false;
  }, [staff, selectedRole, staffList]);

  // Kiểm tra vai trò không thay đổi
  const isUnchanged = selectedRole === staff.role;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isDemotingLastAdmin) {
      showToast?.('Hành động bị chặn: Không thể hạ quyền tài khoản Admin duy nhất của hệ thống!', 'error');
      return;
    }
    if (isUnchanged) {
      showToast?.('Vai trò được chọn trùng với vai trò hiện tại của nhân sự.', 'info');
      navigate(`/rbac/detail?id=${staff.id}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changeUserRole(staff.id, selectedRole, note);
      if (res && res.success) {
        navigate(`/rbac/detail?id=${staff.id}`);
      }
    } catch (err) {
      showToast?.(err.message || 'Lỗi khi cập nhật vai trò', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ROLES_INFO = [
    {
      id: 'admin',
      name: 'Admin (Quản trị viên)',
      icon: Shield,
      tagColor: 'text-purple-700 bg-purple-50 border-purple-200',
      activeBorder: 'border-purple-600 bg-purple-50/40 ring-2 ring-purple-600/20',
      desc: 'Toàn quyền quản trị hệ thống: Quản lý nhân viên, phân quyền vai trò, cấu hình cửa hàng & VietQR, dọn dẹp dữ liệu bán hàng an toàn.'
    },
    {
      id: 'manager',
      name: 'Manager (Quản lý cửa hàng)',
      icon: UserCog,
      tagColor: 'text-blue-700 bg-blue-50 border-blue-200',
      activeBorder: 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20',
      desc: 'Vận hành quầy thu ngân đầy đủ, cập nhật danh mục & giá bán món, xem báo cáo doanh thu kinh doanh. Không được đổi quyền hay xóa dữ liệu.'
    },
    {
      id: 'staff',
      name: 'Staff (Nhân viên thu ngân)',
      icon: Briefcase,
      tagColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      activeBorder: 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20',
      desc: 'Phục vụ bàn, tạo & sửa món trong đơn, gửi bếp, thanh toán hóa đơn và xem lịch sử đơn trong ngày. Bị khóa xem doanh thu tổng và chỉnh sửa menu/giá.'
    }
  ];

  return (
    <div className="space-y-4 animate-fadeIn pb-12" data-testid="role-change-subpage">
      {/* 1. Header có nút Back */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-testid="role-change-back-btn"
            onClick={() => navigate(`/rbac/detail?id=${staff.id}`)}
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
            aria-label="Quay lại Chi tiết nhân viên"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
              Thay đổi Vai trò
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Cập nhật quyền hạn truy cập tài khoản
            </p>
          </div>
        </div>
      </div>

      {/* 2. Thẻ nhân viên tóm tắt */}
      <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-2xs flex items-center gap-3">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={staff.name}
              className="w-11 h-11 rounded-full object-cover border-2 border-forest-800/15 shadow-2xs"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-forest-50 border-2 border-forest-800/20 text-forest-900 font-black text-xs flex items-center justify-center shadow-2xs">
              {initials}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-gray-900 text-xs truncate">{staff.name}</h3>
            <span className="text-[10px] font-mono text-gray-400">#{staff.id}</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Vai trò hiện tại:{' '}
            <strong className="text-forest-900 capitalize font-bold">
              {staff.role === 'admin' ? 'Admin' : staff.role === 'manager' ? 'Manager' : 'Staff'}
            </strong>
          </div>
        </div>
      </div>

      {/* 3. Safeguard Warning nếu vi phạm hạ quyền Admin cuối cùng */}
      {isDemotingLastAdmin && (
        <div
          data-testid="last-admin-safeguard-warning"
          className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-rose-900 animate-fadeIn"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-rose-900">Cảnh báo bảo mật hệ thống!</h4>
            <p className="text-[11px] text-rose-800 leading-relaxed">
              Đây là tài khoản <strong>Admin duy nhất đang hoạt động</strong> trong hệ thống GÓC POS. Không thể hạ quyền tài khoản này vì hệ thống bắt buộc phải duy trì ít nhất 1 Quản trị viên để quản trị.
            </p>
          </div>
        </div>
      )}

      {/* 4. Danh sách 3 Thẻ Vai trò */}
      <div className="space-y-2.5">
        <div className="text-xs font-bold text-gray-900 px-0.5">
          Chọn vai trò mới cho nhân sự:
        </div>

        <div className="space-y-2.5" data-testid="role-options-list">
          {ROLES_INFO.map((roleItem) => {
            const isSelected = selectedRole === roleItem.id;
            const isCurrent = staff.role === roleItem.id;
            const Icon = roleItem.icon;

            return (
              <div
                key={roleItem.id}
                data-testid={`role-card-${roleItem.id}`}
                onClick={() => setSelectedRole(roleItem.id)}
                className={`touch-target btn-press p-3.5 rounded-2xl border transition-all cursor-pointer relative shadow-2xs ${
                  isSelected
                    ? roleItem.activeBorder
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${roleItem.tagColor}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-gray-900 text-xs">
                          {roleItem.name}
                        </h4>
                        {isCurrent && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                            Hiện tại
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        {roleItem.desc}
                      </p>
                    </div>
                  </div>

                  {/* Radio check icon */}
                  <div className="shrink-0 mt-0.5">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-forest-800 border-forest-800 text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Nhập Lý do / Ghi chú (Tùy chọn) */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-gray-400" />
          <span>Lý do / Ghi chú thay đổi (tùy chọn)</span>
        </label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ví dụ: Thăng cấp Cửa hàng trưởng ca sáng, điều chuyển vị trí..."
          data-testid="role-change-note-input"
          className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-forest-800/30 focus:border-forest-800 transition-all shadow-2xs resize-none"
        />
      </div>

      {/* 6. Action buttons */}
      <div className="pt-2 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          data-testid="role-change-cancel-btn"
          disabled={isSubmitting}
          onClick={() => navigate(`/rbac/detail?id=${staff.id}`)}
          className="touch-target btn-press py-2.5 px-3 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
        >
          <span>Hủy bỏ</span>
        </button>

        <button
          type="button"
          data-testid="role-change-submit-btn"
          disabled={isSubmitting || isDemotingLastAdmin}
          onClick={handleSubmit}
          className="touch-target btn-press py-2.5 px-3 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>Lưu thay đổi vai trò</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
