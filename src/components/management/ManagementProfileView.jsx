import React, { useState, useRef } from 'react';
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
  LogOut,
  Camera
} from 'lucide-react';

export default function ManagementProfileView({ onBack }) {
  const {
    settings,
    updateSettings,
    showToast,
    deviceMode,
    toggleDeviceMode,
    resetAllData,
    setActiveTab,
    cloudStatus
  } = usePos();

  const fileInputRef = useRef(null);
  const [imageError, setImageError] = useState(false);
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
  const avatarUrl = settings?.avatarUrl || null;

  // Xử lý upload ảnh đại diện
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WebP)', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Dung lượng ảnh tối đa là 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result;
      if (base64Data) {
        setImageError(false);
        updateSettings({ avatarUrl: base64Data });
        showToast('Đã cập nhật ảnh đại diện thành công!', 'success');
      }
    };
    reader.onerror = () => {
      showToast('Không thể đọc file ảnh. Vui lòng thử lại.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    updateSettings({ avatarUrl: null });
    setImageError(false);
    showToast('Đã xóa ảnh đại diện, chuyển về mặc định', 'info');
  };

  // Subpage 1: Quản lý nhân viên
  if (currentView === 'staff') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs space-y-4 animate-slideInRight">
        <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setCurrentView('main')}
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
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
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
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
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
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
      {/* 0. TOP BAR VỚI NÚT QUAY LẠI (BACK) DÀNH CHO CÀI ĐẶT       */}
      {/* ========================================================= */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-gray-100">
        <button
          type="button"
          onClick={onBack || (() => setActiveTab('tables'))}
          data-testid="settings-back-button"
          className="p-2 rounded-xl bg-forest-50 hover:bg-forest-100 text-[#214E34] border border-forest-100 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
          aria-label="Quay lại"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-black text-[#214E34] tracking-tight leading-none">
            Cài đặt & Quản lý
          </h1>
          <p className="text-[10.5px] text-gray-500 mt-0.5">
            Hệ thống & thông tin ca trực
          </p>
        </div>
        <div className="w-9" />
      </div>

      {/* ========================================================= */}
      {/* 1. PROFILE HEADER: CĂN GIỮA PHÍA TRÊN CÙNG                */}
      {/* ========================================================= */}
      <div className="flex flex-col items-center text-center mt-2">
        {/* Avatar tròn 84px với ảnh thật hoặc icon User trắng + Nút Camera đổi ảnh */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-[84px] h-[84px] rounded-full overflow-hidden bg-[#214E34] text-white flex items-center justify-center shadow-lg shadow-forest-900/20 ring-4 ring-[#214E34]/15">
            {avatarUrl && !imageError ? (
              <img
                src={avatarUrl}
                alt={displayName}
                onError={() => setImageError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-11 h-11 text-white stroke-[1.8]" />
            )}
          </div>

          {/* Nút icon Camera tròn nhỏ nằm ở góc dưới bên phải Avatar 84px */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-avatar-btn"
            aria-label="Đổi ảnh đại diện"
            title="Đổi ảnh đại diện"
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#009E78] text-white hover:bg-[#008766] border-2 border-white shadow-md active:scale-90 transition-all cursor-pointer flex items-center justify-center"
          >
            <Camera className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>

        {/* Nút xóa ảnh tùy chỉnh nếu đang dùng ảnh cá nhân */}
        {avatarUrl && (
          <button
            type="button"
            onClick={handleRemovePhoto}
            className="mt-1.5 text-[11px] text-rose-600 hover:text-rose-700 font-semibold underline cursor-pointer"
          >
            Xóa ảnh tùy chỉnh
          </button>
        )}

        {/* Tên quản lý lấy từ dữ liệu hiện tại (spacing 8-12px) */}
        <h2 className="text-lg font-black text-gray-900 tracking-tight mt-2.5">
          {displayName}
        </h2>

        {/* Badge "Quản lý • Admin" (spacing 8-12px) */}
        <div className="mt-1.5">
          <span
            data-role="Quản lý (Admin)"
            title="Quản lý (Admin)"
            className="inline-flex items-center px-3 py-0.5 rounded-full bg-forest-50 text-forest-800 border border-forest-200/80 text-[11.5px] font-bold shadow-2xs"
          >
            Quản lý • Admin
          </span>
        </div>

        {/* Dòng thương hiệu "GÓC – Phê & Trà" */}
        <p className="text-xs text-gray-500 font-medium tracking-wide mt-1.5">
          GÓC – Phê & Trà
        </p>
      </div>

      {/* ========================================================= */}
      {/* 2. DANH SÁCH 4 CARD CHỨC NĂNG PASTEL ĐỘC LẬP              */}
      {/* ========================================================= */}
      <div className="mt-5 space-y-3">
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
          className="touch-target btn-press w-full py-3 px-4 bg-rose-50/80 hover:bg-rose-100 text-rose-800 border border-rose-200/80 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
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
