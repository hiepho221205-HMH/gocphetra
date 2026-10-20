import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import { useVersionChecker } from '../../hooks/useVersionChecker';
import { APP_VERSION, BUILD_DATE, RELEASE_NAME } from '../../config/version';
import { exportPosBackup } from '../../utils/storageMigrator';
import StaffManagementSection from './StaffManagementSection';
import StoreConfigSubpage from './StoreConfigSubpage';
import DataCleanupSection from './DataCleanupSection';
import RbacPermissionsTable from './RbacPermissionsTable';
import SafeLogoutModal from './SafeLogoutModal';
import ProfileNavCard from './ProfileNavCard';
import {
  User,
  Users,
  Store,
  Database,
  ShieldCheck,
  ArrowLeft,
  Smartphone,
  Monitor,
  LogOut
} from 'lucide-react';

export default function ManagementProfileView() {
  const {
    settings,
    showToast,
    deviceMode,
    toggleDeviceMode,
    resetAllData,
    setActiveTab,
    cloudStatus
  } = usePos();

  const { hasUpdate, newVersion, applyUpdate } = useVersionChecker();
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Subpage Navigation: 'main' | 'staff' | 'store-config' | 'data-cleanup' | 'rbac'
  const [currentView, setCurrentView] = useState('main');

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    showToast('Đã đăng xuất phiên làm việc Quản lý', 'info');
    setActiveTab('tables');
  };

  const cashierRaw = settings?.currentCashier || 'Trần Mai (Mã NV: NV-08)';
  const displayName = cashierRaw.split('(')[0].trim() || 'Trần Mai';
  const branchName = settings?.branchName || 'Chi nhánh 01 - Trụ sở chính';
  const shiftName = settings?.shiftName || 'Ca Sáng (06:30 - 14:30)';
  const shiftDisplay = shiftName.split('(')[0].trim() || 'Ca Sáng';

  // Subpage 1: Quản lý nhân viên
  if (currentView === 'staff') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs space-y-4 animate-slideInRight">
        <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setCurrentView('main')}
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
              Quản lý Nhân viên
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Danh sách & trạng thái hoạt động thu ngân
            </p>
          </div>
        </div>

        {/* SLOT: SECTION 1 - QUẢN LÝ NHÂN VIÊN TỐI GIẢN (MILESTONE 2: StaffManagementSection) */}
        <StaffManagementSection />
      </div>
    );
  }

  // Subpage 2: Cấu hình quán & VietQR
  if (currentView === 'store-config') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <StoreConfigSubpage onBack={() => setCurrentView('main')} />
      </div>
    );
  }

  // Subpage 3: Dữ liệu bán hàng
  if (currentView === 'data-cleanup') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs space-y-4 animate-slideInRight">
        <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setCurrentView('main')}
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
              Dữ liệu Bán hàng
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Dọn dẹp lịch sử hóa đơn an toàn với auto-backup
            </p>
          </div>
        </div>

        {/* SLOT: SECTION 2 - DỌN DẸP DỮ LIỆU BÁN HÀNG AN TOÀN (MILESTONE 3: DataCleanupSection) */}
        <DataCleanupSection />
      </div>
    );
  }

  // Subpage 4: Phân quyền tài khoản
  if (currentView === 'rbac') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs space-y-4 animate-slideInRight">
        <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setCurrentView('main')}
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
              Phân quyền Tài khoản
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Ma trận quyền hạn Quản lý (Admin) & Nhân viên
            </p>
          </div>
        </div>

        <RbacPermissionsTable />
      </div>
    );
  }

  return (
    <div
      data-testid="management-profile-view"
      className="px-4 pt-3 pb-28 text-xs"
    >
      {/* ========================================================= */}
      {/* 1. PROFILE HEADER: CĂN GIỮA PHÍA TRÊN CÙNG                */}
      {/* ========================================================= */}
      <div className="flex flex-col items-center text-center">
        {/* Avatar tròn 84px nền #214E34 với icon User trắng & online ping dot */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-[84px] h-[84px] rounded-full bg-[#214E34] text-white flex items-center justify-center shadow-lg shadow-forest-900/20 ring-4 ring-[#214E34]/15">
            <User className="w-11 h-11 text-white stroke-[1.8]" />
          </div>

          {/* Chấm xanh trạng thái hoạt động (online ping indicator) */}
          <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white shadow-2xs" />
          </span>
        </div>

        {/* Tên quản lý lấy từ dữ liệu hiện tại (spacing 8-12px) */}
        <h2 className="text-lg font-black text-gray-900 tracking-tight mt-3">
          {displayName}
        </h2>

        {/* Badge "Quản lý • Admin" (spacing 8-12px) */}
        <div className="mt-2">
          <span
            data-role="Quản lý (Admin)"
            title="Quản lý (Admin)"
            className="inline-flex items-center px-3 py-0.5 rounded-full bg-forest-50 text-forest-800 border border-forest-200/80 text-[11.5px] font-bold shadow-2xs"
          >
            Quản lý • Admin
          </span>
        </div>

        {/* Dòng thương hiệu "GÓC – Phê & Trà" (spacing 8-12px) */}
        <p className="text-xs text-gray-500 font-medium tracking-wide mt-2">
          GÓC – Phê & Trà
        </p>
      </div>

      {/* ========================================================= */}
      {/* 2. DANH SÁCH 4 CARD CHỨC NĂNG PASTEL ĐỘC LẬP (Spacing 24px)*/}
      {/* ========================================================= */}
      <div className="mt-6 space-y-3">
        {/* Card 1: Quản lý nhân viên (Pastel Xanh lá nhạt #EAF5ED) */}
        <ProfileNavCard
          title="Quản lý nhân viên"
          description="Danh sách & trạng thái thu ngân"
          icon={Users}
          bgColor="#EAF5ED"
          iconColor="#214E34"
          iconBgColor="rgba(33, 78, 52, 0.12)"
          onClick={() => setCurrentView('staff')}
          testId="staff-management-nav-card"
        />

        {/* Card 2: Cấu hình quán & VietQR (Pastel Xanh dương nhạt #EAF3FA) */}
        <ProfileNavCard
          title="Cấu hình quán & VietQR"
          description="Chi nhánh, ca làm việc, WiFi & VietQR"
          icon={Store}
          bgColor="#EAF3FA"
          iconColor="#1D4ED8"
          iconBgColor="rgba(29, 78, 216, 0.12)"
          onClick={() => setCurrentView('store-config')}
          testId="store-config-nav-card"
        />

        {/* Card 3: Dữ liệu bán hàng (Pastel Cam nhạt #FFF4E5) */}
        <ProfileNavCard
          title="Dữ liệu bán hàng"
          description="Dọn dẹp an toàn & sao lưu đơn hàng lịch sử"
          icon={Database}
          bgColor="#FFF4E5"
          iconColor="#D97706"
          iconBgColor="rgba(217, 119, 6, 0.12)"
          onClick={() => setCurrentView('data-cleanup')}
          testId="data-cleanup-nav-card"
        />

        {/* Card 4: Phân quyền (Pastel Tím nhạt #F1EDFA) */}
        <ProfileNavCard
          title="Phân quyền"
          description="Ma trận quyền hạn Quản lý (Admin) & Nhân viên"
          icon={ShieldCheck}
          bgColor="#F1EDFA"
          iconColor="#7C3AED"
          iconBgColor="rgba(124, 58, 237, 0.12)"
          onClick={() => setCurrentView('rbac')}
          testId="rbac-permissions-nav-card"
        />
      </div>

      {/* ========================================================= */}
      {/* 3. CHẾ ĐỘ HIỂN THỊ POS & THIẾT BỊ                         */}
      {/* ========================================================= */}
      <div className="mt-4 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-forest-50 text-forest-800 flex items-center justify-center">
              {deviceMode === 'mobile' ? (
                <Smartphone className="w-4 h-4 text-forest-700" />
              ) : (
                <Monitor className="w-4 h-4 text-forest-700" />
              )}
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-xs">Chế độ hiển thị POS</h4>
              <p className="text-[10px] text-gray-400">
                {deviceMode === 'mobile' ? 'Khung chuẩn Mobile 390px' : 'Toàn màn hình (Desktop/Tablet)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="toggle-device-mode-btn"
            onClick={toggleDeviceMode}
            className="touch-target btn-press px-2.5 py-1.5 text-xs font-bold rounded-xl border border-forest-800/20 bg-forest-50/70 text-forest-900 hover:bg-forest-100 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            {deviceMode === 'mobile' ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-forest-700" />
                <span>Mở rộng Desktop</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-forest-700" />
                <span>Khung Mobile (390px)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. NÚT ĐĂNG XUẤT AN TOÀN                                  */}
      {/* ========================================================= */}
      <div className="mt-4 pt-1">
        <button
          type="button"
          data-testid="logout-trigger-btn"
          onClick={() => setShowLogoutModal(true)}
          className="touch-target btn-press w-full py-3 px-4 bg-rose-50/80 hover:bg-rose-100 text-rose-800 border border-rose-200/80 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-2xs"
        >
          <LogOut className="w-4 h-4 text-rose-600" />
          <span>Đăng xuất tài khoản POS</span>
        </button>

        <p className="text-center text-[10.5px] text-gray-400 mt-2.5">
          GÓC POS v{APP_VERSION} • {RELEASE_NAME}
        </p>
      </div>

      {/* Modal xác nhận đăng xuất an toàn */}
      <SafeLogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
        cashierName={displayName}
      />
    </div>
  );
}
