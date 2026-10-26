import React, { useState, useMemo } from 'react';
import { usePos } from '../../store/PosContext';
import { getStaffInitials } from '../../utils/router';
import { getStaffDisplayCode } from '../management/StaffListPage';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  Search,
  X,
  ChevronRight,
  History,
  Lock,
  ArrowLeft,
  UserCog,
  Briefcase
} from 'lucide-react';

export default function RbacMainPage({ onBack }) {
  const {
    staffList = [],
    currentRole,
    userProfiles = {},
    currentRoute,
    navigate
  } = usePos();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'admin' | 'manager' | 'staff'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
    } else {
      navigate('/settings');
    }
  };

  // Thống kê 4 KPIs (chỉ tính nhân sự đang quản lý, loại trừ archived/removed)
  const stats = useMemo(() => {
    const managedStaff = staffList.filter((s) => s.status !== 'archived' && s.status !== 'removed');
    const total = managedStaff.length;
    const adminCount = managedStaff.filter((s) => s.role === 'admin').length;
    const managerCount = managedStaff.filter((s) => s.role === 'manager').length;
    const staffCount = managedStaff.filter((s) => s.role === 'staff').length;
    return { total, adminCount, managerCount, staffCount };
  }, [staffList]);

  // Lọc danh sách nhân viên
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      if (staff.status === 'archived' || staff.status === 'removed') return false;
      // 1. Lọc theo tìm kiếm
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const profile = userProfiles[staff.id] || {};
        const nameMatch = staff.name?.toLowerCase().includes(query);
        const idMatch = staff.id?.toLowerCase().includes(query);
        const phoneMatch = (staff.phone || profile.phone || '').toLowerCase().includes(query);
        const emailMatch = (staff.email || profile.email || '').toLowerCase().includes(query);
        const codeMatch = getStaffDisplayCode(staff).toLowerCase().includes(query);
        if (!nameMatch && !idMatch && !phoneMatch && !emailMatch && !codeMatch) return false;
      }

      // 2. Lọc theo vai trò
      if (roleFilter !== 'all' && staff.role !== roleFilter) {
        return false;
      }

      // 3. Lọc theo trạng thái
      if (statusFilter !== 'all' && staff.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [staffList, searchTerm, roleFilter, statusFilter, userProfiles]);

  const handleCardClick = (staffId) => {
    navigate(`/rbac/detail?id=${staffId}`);
  };

  return (
    <div className="space-y-4 animate-fadeIn" data-testid="rbac-main-page">
      {/* 1. Header có nút Back */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-testid="rbac-back-to-settings-btn"
            onClick={handleBack}
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
            aria-label="Quay lại Cài đặt"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
              Phân quyền Tài khoản
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Quản trị vai trò & phân quyền bảo mật POS
            </p>
          </div>
        </div>

        {/* Nút tắt sang Nhật ký hoạt động */}
        <button
          type="button"
          data-testid="rbac-nav-to-audit-btn"
          onClick={() => navigate('/rbac/audit')}
          className="touch-target btn-press px-2.5 py-1.5 rounded-xl border border-forest-800/20 bg-forest-50 text-forest-900 hover:bg-forest-100 transition-colors flex items-center gap-1.5 text-xs font-bold shadow-2xs"
        >
          <History className="w-3.5 h-3.5 text-forest-700" />
          <span>Nhật ký</span>
        </button>
      </div>

      {/* 2. Top Banner: Giới thiệu hệ thống RBAC */}
      <div className="bg-gradient-to-br from-forest-900 via-forest-800 to-forest-950 text-white rounded-2xl p-3.5 shadow-sm border border-forest-700/50 relative overflow-hidden">
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-400/20 border border-emerald-400/30 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            </span>
            <span className="text-[11px] font-bold text-emerald-200 tracking-wide uppercase">
              Hệ thống RBAC 3 cấp độ
            </span>
          </div>
          <p className="text-xs text-stone-200 leading-relaxed">
            Chỉ Quản trị viên (Admin) được toàn quyền phân cấp và điều chỉnh quyền truy cập nhân sự cho hệ thống GÓC POS.
          </p>
        </div>
      </div>

      {/* 3. Khối 4 Card Thống kê KPIs sinh động */}
      <div className="grid grid-cols-2 gap-2.5" data-testid="rbac-kpi-grid">
        {/* Card 1: Tổng NV */}
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider">
              Tổng NV
            </span>
            <div className="text-xl font-black text-gray-900 leading-none" data-testid="kpi-total-staff">
              {stats.total}
            </div>
            <span className="text-[10px] text-gray-400">Nhân sự toàn quán</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Admin */}
        <div className="bg-[#FAF5FF] rounded-2xl p-3 border border-purple-100 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10.5px] font-semibold text-purple-700 uppercase tracking-wider">
              Admin
            </span>
            <div className="text-xl font-black text-purple-900 leading-none" data-testid="kpi-admin-count">
              {stats.adminCount}
            </div>
            <span className="text-[10px] text-purple-500">Quản trị toàn quyền</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Manager */}
        <div className="bg-[#EFF6FF] rounded-2xl p-3 border border-blue-100 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10.5px] font-semibold text-blue-700 uppercase tracking-wider">
              Manager
            </span>
            <div className="text-xl font-black text-blue-900 leading-none" data-testid="kpi-manager-count">
              {stats.managerCount}
            </div>
            <span className="text-[10px] text-blue-500">Cửa hàng trưởng</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
            <UserCog className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Staff */}
        <div className="bg-[#F0FDF4] rounded-2xl p-3 border border-emerald-100 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10.5px] font-semibold text-emerald-700 uppercase tracking-wider">
              Staff
            </span>
            <div className="text-xl font-black text-emerald-900 leading-none" data-testid="kpi-staff-count">
              {stats.staffCount}
            </div>
            <span className="text-[10px] text-emerald-600">Thu ngân & phục vụ</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 4. Thanh tìm kiếm */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm theo tên, mã NV, email hoặc SĐT..."
          data-testid="rbac-search-input"
          className="w-full pl-10 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-forest-800/30 focus:border-forest-800 transition-all shadow-2xs"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="touch-target p-1 text-gray-400 hover:text-gray-600 absolute right-2.5 top-1/2 -translate-y-1/2"
            aria-label="Xóa tìm kiếm"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 5. Bộ lọc 2 lớp: Vai trò & Trạng thái */}
      <div className="space-y-2">
        {/* Lọc theo vai trò */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" data-testid="rbac-role-filters">
          <span className="text-[10.5px] font-bold text-gray-400 shrink-0 mr-1">Vai trò:</span>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'admin', label: 'Admin' },
            { id: 'manager', label: 'Manager' },
            { id: 'staff', label: 'Staff' }
          ].map((chip) => {
            const isSelected = roleFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setRoleFilter(chip.id)}
                data-testid={`filter-role-${chip.id}`}
                className={`touch-target px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors whitespace-nowrap shadow-2xs cursor-pointer ${
                  isSelected
                    ? 'bg-forest-800 text-white shadow-xs'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-forest-50'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Lọc theo trạng thái */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" data-testid="rbac-status-filters">
          <span className="text-[10.5px] font-bold text-gray-400 shrink-0 mr-1">Trạng thái:</span>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'active', label: 'Đang hoạt động' },
            { id: 'inactive', label: 'Tạm khóa' }
          ].map((chip) => {
            const isSelected = statusFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                data-testid={`filter-status-${chip.id}`}
                className={`touch-target px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors whitespace-nowrap shadow-2xs cursor-pointer ${
                  isSelected
                    ? 'bg-gray-800 text-white shadow-xs'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Danh sách Nhân sự (Compact Card Roster) */}
      <div className="space-y-2 pt-1" data-testid="rbac-staff-cards-list">
        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold px-0.5">
          <span>Danh sách nhân sự ({filteredStaff.length})</span>
          <span className="text-[10px] text-gray-400">Chạm để xem chi tiết & đổi quyền</span>
        </div>

        {filteredStaff.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-2xs space-y-2">
            <Users className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-xs font-bold text-gray-700">Không tìm thấy nhân sự phù hợp</p>
            <p className="text-[11px] text-gray-400">
              Thử xóa từ khóa tìm kiếm hoặc đổi bộ lọc vai trò/trạng thái.
            </p>
          </div>
        ) : (
          filteredStaff.map((staff) => {
            const profile = userProfiles[staff.id] || {};
            const initials = getStaffInitials(staff.name);
            const avatarUrl = staff.avatarUrl || profile.avatarUrl;
            const isStaffAdmin = staff.role === 'admin';
            const isStaffManager = staff.role === 'manager';
            const isActive = staff.status === 'active';

            return (
              <div
                key={staff.id}
                data-testid={`rbac-staff-card-${staff.id}`}
                onClick={() => handleCardClick(staff.id)}
                className="btn-press w-full box-border min-h-[64px] bg-white rounded-2xl p-3 sm:p-3.5 border border-gray-100 hover:border-forest-800/30 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-3 cursor-pointer"
              >
                {/* Trái: Avatar & Thông tin */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative shrink-0 w-11 h-11">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={staff.name}
                        className="w-11 h-11 rounded-full object-cover border-2 border-forest-800/10 shadow-2xs"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-forest-50 border-2 border-forest-800/15 text-forest-900 font-black text-xs flex items-center justify-center shadow-2xs">
                        {initials}
                      </div>
                    )}
                    {/* Chấm trạng thái */}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        isActive ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      title={isActive ? 'Đang hoạt động' : 'Tạm khóa'}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h4 className="font-bold text-gray-900 text-xs truncate max-w-[150px] sm:max-w-[180px]">
                        {staff.name}
                      </h4>
                      <span className="text-[10px] font-mono font-medium text-gray-400 shrink-0">
                        #{getStaffDisplayCode(staff)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Badge Vai trò */}
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border shadow-2xs ${
                          isStaffAdmin
                            ? 'bg-purple-50 text-purple-900 border-purple-200'
                            : isStaffManager
                            ? 'bg-blue-50 text-blue-900 border-blue-200'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        }`}
                      >
                        {isStaffAdmin ? 'Admin' : isStaffManager ? 'Manager' : 'Staff'}
                      </span>

                      {/* Badge Trạng thái */}
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                          isActive
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {isActive ? 'Hoạt động' : 'Tạm khóa'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Phải: Chevron right */}
                <div className="shrink-0 text-gray-400 pl-1">
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
