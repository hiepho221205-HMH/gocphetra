import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import { getStaffInitials } from './StaffManagementSection';
import DeleteStaffConfirmModal from './DeleteStaffConfirmModal';
import {
  ArrowLeft,
  Search,
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Mail,
  Phone,
  Briefcase,
  Shield,
  Coffee,
  UserCheck,
  UserX,
  X,
  Lock
} from 'lucide-react';

export default function StaffListPage() {
  const {
    staffList = [],
    toggleStaffStatus,
    deleteStaff,
    showToast,
    currentRole,
    userProfiles = {},
    navigate
  } = usePos();

  const isAdmin = currentRole === 'admin';

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all'); // 'all' | 'admin' | 'manager' | 'staff'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'paused'
  const [deletingStaff, setDeletingStaff] = useState(null);

  // Filtered List calculation
  const filteredStaffList = staffList.filter((staff) => {
    // Search match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (staff.name || '').toLowerCase().includes(q);
      const matchEmail = (staff.email || '').toLowerCase().includes(q);
      const matchPhone = (staff.phone || '').toLowerCase().includes(q);
      const matchId = (staff.id || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchId) return false;
    }
    // Role filter
    if (filterRole !== 'all' && staff.role !== filterRole) {
      return false;
    }
    // Status filter
    if (filterStatus !== 'all') {
      const isActive = staff.status === 'active';
      if (filterStatus === 'active' && !isActive) return false;
      if (filterStatus === 'paused' && isActive) return false;
    }
    return true;
  });

  const handleEditClick = (staff) => {
    if (!isAdmin && staff.role === 'admin') {
      showToast?.('Từ chối quyền: Cửa hàng trưởng (Manager) không thể can thiệp tài khoản Quản trị viên (Admin)!', 'error');
      return;
    }
    navigate(`/staff/create?edit=${staff.id}`);
  };

  const handleToggle = (staffId) => {
    const target = staffList.find((s) => s.id === staffId);
    if (!isAdmin && target?.role === 'admin') {
      showToast?.('Từ chối quyền: Manager không thể tạm ngưng tài khoản Quản trị viên (Admin)!', 'error');
      return;
    }
    toggleStaffStatus?.(staffId);
  };

  const handleDeleteClick = (staff) => {
    if (!isAdmin) {
      showToast?.('Từ chối quyền: Chỉ Quản trị viên (Admin) mới có quyền xóa nhân viên!', 'error');
      return;
    }
    // Kiểm tra nếu là Admin duy nhất đang hoạt động
    if (staff.role === 'admin') {
      const activeAdmins = staffList.filter((s) => s.role === 'admin' && s.status === 'active' && s.id !== staff.id);
      if (activeAdmins.length === 0) {
        showToast?.('Hành động bị chặn: Không thể xóa tài khoản Quản trị viên duy nhất!', 'error');
        return;
      }
    }
    setDeletingStaff(staff);
  };

  const handleConfirmDelete = async (staffId) => {
    if (typeof deleteStaff === 'function') {
      await deleteStaff(staffId);
    }
  };

  return (
    <div
      data-testid="staff-list-page"
      className="space-y-4 animate-fadeIn"
    >
      {/* ========================================================= */}
      {/* 1. HEADER CÓ NÚT BACK VỀ /staff                            */}
      {/* ========================================================= */}
      <div className="flex items-center pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-testid="staff-list-back-btn"
            onClick={() => navigate('/staff')}
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
              Danh sách Nhân viên
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {filteredStaffList.length} nhân sự • Quản lý & trạng thái
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. TÌM KIẾM & BỘ LỌC THÔNG MINH                            */}
      {/* ========================================================= */}
      <div className="space-y-2 bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo họ tên, email hoặc SĐT..."
            data-testid="staff-search-input"
            className="w-full h-9 pl-8 pr-8 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 text-xs font-medium text-gray-900"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills: Role & Status */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {/* Role filters */}
          <button
            type="button"
            data-testid="filter-role-all"
            onClick={() => setFilterRole('all')}
            className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
              filterRole === 'all'
                ? 'bg-forest-900 text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tất cả vai trò
          </button>
          <button
            type="button"
            data-testid="filter-role-admin"
            onClick={() => setFilterRole('admin')}
            className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
              filterRole === 'admin'
                ? 'bg-forest-900 text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Quản lý (Admin)
          </button>
          <button
            type="button"
            data-testid="filter-role-manager"
            onClick={() => setFilterRole('manager')}
            className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
              filterRole === 'manager'
                ? 'bg-blue-800 text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Cửa hàng trưởng
          </button>
          <button
            type="button"
            data-testid="filter-role-staff"
            onClick={() => setFilterRole('staff')}
            className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
              filterRole === 'staff'
                ? 'bg-emerald-800 text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Thu ngân
          </button>

          {/* Status separator */}
          <div className="w-[1px] h-4 bg-gray-200 self-center mx-0.5" />

          {/* Status filters */}
          <button
            type="button"
            data-testid="filter-status-active"
            onClick={() => setFilterStatus(filterStatus === 'active' ? 'all' : 'active')}
            className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
              filterStatus === 'active'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            • Hoạt động
          </button>
          <button
            type="button"
            data-testid="filter-status-paused"
            onClick={() => setFilterStatus(filterStatus === 'paused' ? 'all' : 'paused')}
            className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
              filterStatus === 'paused'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            • Tạm khóa
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. ROSTER LIST CÁC NHÂN VIÊN                               */}
      {/* ========================================================= */}
      <div
        data-testid="staff-roster-list"
        className="space-y-2.5"
      >
        {filteredStaffList.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-200 space-y-2">
            <Users className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-xs font-bold text-gray-600">Không tìm thấy nhân viên phù hợp</p>
            <p className="text-[11px] text-gray-400">Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterRole('all');
                setFilterStatus('all');
              }}
              className="mt-2 text-xs text-forest-700 font-bold underline cursor-pointer"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        ) : (
          filteredStaffList.map((staff) => {
            const profile = userProfiles[staff.id] || {};
            const avatar = staff.avatarUrl || profile.avatarUrl;
            const initials = getStaffInitials(staff.name);
            const isActive = staff.status === 'active';
            const isTargetAdmin = staff.role === 'admin';
            const isSelf = profile.id === staff.id;

            // Check if this is the last active admin
            const isLastActiveAdmin =
              isTargetAdmin &&
              isActive &&
              staffList.filter((s) => s.role === 'admin' && s.status === 'active').length <= 1;

            return (
              <div
                key={staff.id}
                data-testid={`staff-card-${staff.id}`}
                className={`p-3 rounded-2xl bg-white border transition-all shadow-2xs space-y-2.5 ${
                  isActive ? 'border-gray-100' : 'border-amber-200/80 bg-amber-50/20'
                }`}
              >
                {/* Header card: Avatar + Name + Role Badge + Status Switch */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {/* Avatar tròn 42px */}
                    <div className="relative shrink-0">
                      <div className="w-[42px] h-[42px] rounded-full overflow-hidden bg-[#1E3D29] text-white flex items-center justify-center font-extrabold text-xs shadow-2xs">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={staff.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span>{initials}</span>
                        )}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                          isActive ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                    </div>

                    {/* Name & Role */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-gray-900 truncate">
                          {staff.name}
                        </span>
                        {/* Role pill */}
                        <span
                          className={`text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-full border ${
                            staff.role === 'admin'
                              ? 'bg-forest-50 text-forest-800 border-forest-200'
                              : staff.role === 'manager'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {staff.role === 'admin' ? 'Quản lý' : staff.role === 'manager' ? 'Cửa hàng trưởng' : 'Thu ngân'}
                        </span>
                      </div>

                      {/* Mã NV + Chi nhánh */}
                      <div className="flex items-center gap-2 text-[10.5px] text-gray-500 mt-0.5 truncate">
                        <span className="font-mono font-bold text-gray-700">
                          {staff.id.toUpperCase().replace('STAFF-', 'NV-')}
                        </span>
                        <span>•</span>
                        <span className="truncate">{staff.shiftName || 'Ca Sáng (06:30 - 14:30)'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Toggle Status Switch */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Status Pill Indicator */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                      }`}
                    >
                      {isActive ? 'Hoạt động' : 'Tạm khóa'}
                    </span>

                    {/* Toggle Button */}
                    {(!isAdmin && isTargetAdmin) ? (
                      <div
                        data-testid={`locked-admin-indicator-${staff.id}`}
                        title="Tài khoản Quản trị viên (Khóa bảo mật)"
                        className="p-1 text-gray-400"
                      >
                        <Lock className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-testid={`toggle-staff-btn-${staff.id}`}
                        onClick={() => handleToggle(staff.id)}
                        disabled={isLastActiveAdmin}
                        title={
                          isLastActiveAdmin
                            ? 'Không thể khóa Quản trị viên duy nhất của hệ thống'
                            : isActive
                            ? 'Bấm để tạm khóa tài khoản'
                            : 'Bấm để kích hoạt lại'
                        }
                        className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          isActive ? 'bg-emerald-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                            isActive ? 'left-4.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {/* Info row: SĐT & Email */}
                {(staff.phone || staff.email) && (
                  <div className="flex items-center gap-3 pt-1 border-t border-gray-50 text-[10.5px] text-gray-500">
                    {staff.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span>{staff.phone}</span>
                      </div>
                    )}
                    {staff.email && (
                      <div className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 text-gray-400" />
                        <span className="truncate">{staff.email}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions row: Sửa & Xóa (Admin only) */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                  {/* Nút Sửa */}
                  <button
                    type="button"
                    data-testid={`edit-staff-btn-${staff.id}`}
                    onClick={() => handleEditClick(staff)}
                    disabled={!isAdmin && isTargetAdmin}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200/80 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Edit2 className="w-3 h-3 text-gray-500" />
                    <span>Sửa</span>
                  </button>

                  {/* Nút Xóa (CHỈ ADMIN THẤY) */}
                  {isAdmin && (
                    <button
                      type="button"
                      data-testid={`delete-staff-btn-${staff.id}`}
                      onClick={() => handleDeleteClick(staff)}
                      disabled={isLastActiveAdmin}
                      title={
                        isLastActiveAdmin
                          ? 'Hành động bị chặn: Không thể xóa tài khoản Quản trị viên duy nhất!'
                          : 'Xóa nhân viên an toàn (giữ nguyên lịch sử hóa đơn)'
                      }
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      <span>Xóa</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal xác nhận xóa an toàn */}
      <DeleteStaffConfirmModal
        isOpen={Boolean(deletingStaff)}
        staff={deletingStaff}
        onClose={() => setDeletingStaff(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
