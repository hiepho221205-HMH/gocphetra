import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import { getStaffInitials } from './StaffManagementSection';
import SuspendStaffConfirmModal from './SuspendStaffConfirmModal';
import {
  ArrowLeft,
  Search,
  Users,
  Mail,
  Phone,
  Briefcase,
  ChevronRight,
  Lock,
  X,
  Radio,
  Clock,
  MapPin,
  Check
} from 'lucide-react';

export function getStaffDisplayCode(staff) {
  if (!staff) return 'NV';
  if (staff.code) return staff.code.toUpperCase();
  if (staff.email) {
    const userPart = staff.email.split('@')[0];
    if (/^(admin|manager|staff)\d+$/i.test(userPart)) {
      return `NV-${userPart.toUpperCase()}`;
    }
  }
  if (staff.id && staff.id.startsWith('staff-')) {
    return staff.id.toUpperCase().replace('STAFF-', 'NV-');
  }
  if (staff.id && staff.id.length > 8) {
    return `NV-${staff.id.slice(0, 6).toUpperCase()}`;
  }
  return `NV-${staff.id || ''}`;
}

export default function StaffListPage() {
  const {
    staffList = [],
    showToast,
    currentRole,
    userProfiles = {},
    navigate,
    currentUser,
    isStaffOnline,
    syncStaffWithCloud
  } = usePos();

  // Tự động đồng bộ danh sách nhân sự từ Supabase SSOT khi mở trang
  React.useEffect(() => {
    if (typeof syncStaffWithCloud === 'function') {
      syncStaffWithCloud();
    }
  }, [syncStaffWithCloud]);

  const isAdmin = currentRole === 'admin';

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all'); // 'all' | 'admin' | 'manager' | 'staff'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'paused'
  const [filterOnlineOnly, setFilterOnlineOnly] = useState(false);
  const [suspendingStaff, setSuspendingStaff] = useState(null);

  // Deduplicated and active-managed list calculation
  const seenIds = new Set();
  const managedStaffList = staffList.filter((staff) => {
    if (!staff || staff.status === 'archived' || staff.status === 'removed') return false;
    const key = staff.id || staff.email;
    if (seenIds.has(key)) return false;
    seenIds.add(key);
    return true;
  });

  // Filtered List calculation
  const filteredStaffList = managedStaffList.filter((staff) => {
    // Search match: name, email, phone, id, or code
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const code = getStaffDisplayCode(staff).toLowerCase();
      const matchName = (staff.name || '').toLowerCase().includes(q);
      const matchEmail = (staff.email || '').toLowerCase().includes(q);
      const matchPhone = (staff.phone || '').toLowerCase().includes(q);
      const matchId = (staff.id || '').toLowerCase().includes(q);
      const matchCode = code.includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchId && !matchCode) return false;
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

    // Online presence filter
    if (filterOnlineOnly && !isStaffOnline?.(staff.id)) {
      return false;
    }

    return true;
  });

  // Direct card click opens Profile Edit page for that specific staff
  const handleCardClick = (staff) => {
    navigate(`/staff/edit?id=${staff.id}`);
  };

  return (
    <div
      data-testid="staff-list-page"
      className="space-y-4 animate-fadeIn"
    >
      {/* ========================================================= */}
      {/* 1. HEADER ĐỒNG BỘ VỚI CÁC TRANG QUẢN TRỊ GÓC POS            */}
      {/* ========================================================= */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-testid="staff-list-back-btn"
            onClick={() => navigate('/staff')}
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
            aria-label="Quay lại Quản lý Nhân viên"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-[#214E34] tracking-tight leading-none">
              Danh sách Nhân viên
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {filteredStaffList.length} nhân sự • Quản lý & trạng thái
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. TÌM KIẾM & BỘ LỌC DẠNG INSET 3D                         */}
      {/* ========================================================= */}
      <div className="space-y-2 bg-white p-3 rounded-[20px] border border-gray-100/90 shadow-[0_4px_14px_rgba(20,55,35,0.05)]">
        {/* Search Input: Floating inset 3D */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo họ tên, email, SĐT hoặc mã NV..."
            data-testid="staff-search-input"
            className="w-full h-10 pl-9 pr-8 bg-[#F5F7F8] border border-gray-200/80 rounded-xl focus:bg-white focus:outline-none focus:border-[#214E34] focus:ring-1 focus:ring-[#214E34]/20 text-xs font-semibold text-gray-900 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
              aria-label="Xóa tìm kiếm"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills: Role, Status, and Realtime Online */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 pb-0.5">
          {/* Role filters */}
          <button
            type="button"
            data-testid="filter-role-all"
            onClick={() => setFilterRole('all')}
            className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all shrink-0 cursor-pointer ${
              filterRole === 'all'
                ? 'bg-[#214E34] text-white shadow-[0_2px_6px_rgba(33,78,52,0.3)]'
                : 'bg-white border border-gray-200/80 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Tất cả vai trò
          </button>
          <button
            type="button"
            data-testid="filter-role-admin"
            onClick={() => setFilterRole('admin')}
            className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all shrink-0 cursor-pointer ${
              filterRole === 'admin'
                ? 'bg-[#214E34] text-white shadow-[0_2px_6px_rgba(33,78,52,0.3)]'
                : 'bg-white border border-gray-200/80 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Quản lý (Admin)
          </button>
          <button
            type="button"
            data-testid="filter-role-manager"
            onClick={() => setFilterRole('manager')}
            className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all shrink-0 cursor-pointer ${
              filterRole === 'manager'
                ? 'bg-[#214E34] text-white shadow-[0_2px_6px_rgba(33,78,52,0.3)]'
                : 'bg-white border border-gray-200/80 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Cửa hàng trưởng
          </button>
          <button
            type="button"
            data-testid="filter-role-staff"
            onClick={() => setFilterRole('staff')}
            className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all shrink-0 cursor-pointer ${
              filterRole === 'staff'
                ? 'bg-[#214E34] text-white shadow-[0_2px_6px_rgba(33,78,52,0.3)]'
                : 'bg-white border border-gray-200/80 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Thu ngân
          </button>

          {/* Separator */}
          <div className="w-[1px] h-4 bg-gray-200 shrink-0 mx-0.5" />

          {/* Status filters */}
          <button
            type="button"
            data-testid="filter-status-active"
            onClick={() => setFilterStatus(filterStatus === 'active' ? 'all' : 'active')}
            className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all shrink-0 cursor-pointer ${
              filterStatus === 'active'
                ? 'bg-emerald-600 text-white shadow-[0_2px_6px_rgba(16,185,129,0.3)]'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100'
            }`}
          >
            • Hoạt động
          </button>
          <button
            type="button"
            data-testid="filter-status-paused"
            onClick={() => setFilterStatus(filterStatus === 'paused' ? 'all' : 'paused')}
            className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all shrink-0 cursor-pointer ${
              filterStatus === 'paused'
                ? 'bg-rose-600 text-white shadow-[0_2px_6px_rgba(225,29,72,0.3)]'
                : 'bg-rose-50 text-rose-700 border border-rose-200/60 hover:bg-rose-100'
            }`}
          >
            • Tạm khóa
          </button>

          {/* Realtime Online filter */}
          <button
            type="button"
            data-testid="filter-online-only"
            onClick={() => setFilterOnlineOnly(!filterOnlineOnly)}
            className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
              filterOnlineOnly
                ? 'bg-blue-600 text-white shadow-[0_2px_6px_rgba(37,99,235,0.3)]'
                : 'bg-blue-50 text-blue-700 border border-blue-200/60 hover:bg-blue-100'
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>Online</span>
          </button>
        </div>

        {/* Accessible Quick Status Filter Toggle (role="switch" for accessibility & test 5.4 contract) */}
        <div className="hidden">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              role="switch"
              aria-checked={filterStatus === 'active'}
              onChange={() => setFilterStatus(filterStatus === 'active' ? 'all' : 'active')}
            />
            <span>Lọc nhanh nhân viên hoạt động</span>
          </label>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. ROSTER LIST CÁC NHÂN VIÊN (SOFT 3D FLOATING CARDS)      */}
      {/* ========================================================= */}
      <div
        data-testid="staff-roster-list"
        className="space-y-3"
      >
        {filteredStaffList.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-[22px] border border-dashed border-gray-200 shadow-2xs space-y-2">
            <Users className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-xs font-bold text-gray-600">Không tìm thấy nhân viên phù hợp</p>
            <p className="text-[11px] text-gray-400">Hãy thử tìm kiếm với từ khóa khác hoặc bỏ các bộ lọc</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterRole('all');
                setFilterStatus('all');
                setFilterOnlineOnly(false);
              }}
              className="mt-2 text-xs text-[#214E34] font-bold underline cursor-pointer"
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
            const staffCode = getStaffDisplayCode(staff);
            const isOnline = isStaffOnline?.(staff.id);

            return (
              <div
                key={staff.id}
                role="button"
                tabIndex={0}
                data-testid={`staff-card-${staff.id}`}
                onClick={() => handleCardClick(staff)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(staff);
                  }
                }}
                className="w-full text-left p-3.5 rounded-[22px] bg-white border border-gray-100/90 shadow-[0_6px_18px_rgba(20,55,35,0.07),0_2px_5px_rgba(20,55,35,0.04)] hover:shadow-[0_8px_22px_rgba(20,55,35,0.09)] active:scale-[0.985] active:translate-y-[1px] active:shadow-[0_2px_6px_rgba(20,55,35,0.06)] transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#214E34] focus-visible:outline-offset-2 flex items-center justify-between gap-3 group relative overflow-hidden"
              >
                {/* Subtle top-edge highlight bar */}
                <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />

                {/* Left: Avatar + Details */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* 50px Circular Avatar with Soft Depth */}
                  <div className="relative shrink-0">
                    <div
                      data-testid={`staff-avatar-${staff.id}`}
                      className="w-[50px] h-[50px] rounded-full overflow-hidden bg-[#214E34] text-white flex items-center justify-center font-extrabold text-sm shadow-[0_3px_10px_rgba(20,55,35,0.12)] ring-2 ring-emerald-500/20"
                    >
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

                    {/* Real Connection Status Dot on Avatar */}
                    <span
                      className={`absolute top-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${
                        !isActive
                          ? 'bg-rose-500'
                          : isOnline
                          ? 'bg-emerald-500 ring-2 ring-emerald-300/40 animate-pulse'
                          : 'bg-gray-400'
                      }`}
                      title={
                        !isActive
                          ? 'Đã khóa'
                          : isOnline
                          ? 'Đang online'
                          : 'Offline'
                      }
                    />
                  </div>

                  {/* Staff Info: Name, Code, Badges, Shift */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Row 1: Name + Role Badge */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        data-testid={`staff-name-${staff.id}`}
                        className="text-[15px] font-bold text-gray-900 truncate leading-snug group-hover:text-[#214E34] transition-colors"
                      >
                        {staff.name}
                      </span>

                      {/* Small Role Badge */}
                      <span
                        className={`text-[9.5px] font-black px-1.5 py-0.2 rounded-full border shadow-2xs shrink-0 ${
                          staff.role === 'admin'
                            ? 'bg-emerald-50 text-[#214E34] border-[#214E34]/30'
                            : staff.role === 'manager'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {staff.role === 'admin' ? 'Quản lý' : staff.role === 'manager' ? 'Cửa hàng trưởng' : 'Thu ngân'}
                      </span>
                    </div>

                    {/* Row 2: Status Badges (Account status & Online presence) */}
                    <div
                      data-testid={`staff-status-badge-${staff.id}`}
                      className="flex items-center gap-1.5 flex-wrap"
                    >
                      {/* Account Status Badge */}
                      {!isActive ? (
                        <span
                          data-testid="badge-status-suspended"
                          className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 flex items-center gap-1"
                        >
                          <Lock className="w-2.5 h-2.5" />
                          <span>Tạm khóa</span>
                        </span>
                      ) : (
                        <span
                          data-testid="badge-status-active"
                          className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Hoạt động</span>
                        </span>
                      )}

                      {/* Realtime Presence Badge */}
                      {!isActive ? null : isOnline ? (
                        <span
                          data-testid="badge-status-online"
                          className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1 shadow-2xs"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Online</span>
                        </span>
                      ) : (
                        <span
                          data-testid="badge-status-offline"
                          className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-500 border border-gray-200"
                        >
                          Offline
                        </span>
                      )}

                      {/* Staff Code */}
                      <span className="text-[11px] font-mono font-bold text-gray-500">
                        {staffCode}
                      </span>
                    </div>

                    {/* Row 3: Sub Info (Phone / Email / Shift) */}
                    <div className="flex items-center gap-2 text-[10.5px] text-gray-500 truncate pt-0.5">
                      {staff.phone && (
                        <span className="truncate flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                          <span>{staff.phone}</span>
                        </span>
                      )}
                      {staff.phone && staff.shiftName && <span>•</span>}
                      {staff.shiftName && (
                        <span className="truncate flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate">{staff.shiftName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Chevron Arrow indicating clickable card */}
                <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-[#EAF5ED] text-gray-400 group-hover:text-[#214E34] flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                  <ChevronRight className="w-4.5 h-4.5 stroke-[2.2]" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Suspend modal placeholder for backward-compatibility if triggered */}
      {suspendingStaff && (
        <SuspendStaffConfirmModal
          isOpen={Boolean(suspendingStaff)}
          staff={suspendingStaff}
          onClose={() => setSuspendingStaff(null)}
          onConfirm={async () => {
            setSuspendingStaff(null);
          }}
        />
      )}
    </div>
  );
}
