import React, { useState, useRef, useEffect } from 'react';
import { usePos } from '../../store/PosContext';
import { useVersionChecker } from '../../hooks/useVersionChecker';
import { APP_VERSION, BUILD_DATE, RELEASE_NAME } from '../../config/version';
import { exportPosBackup } from '../../utils/storageMigrator';
import ProfileEditSubpage from './ProfileEditSubpage';
import StaffManagementSection from './StaffManagementSection';
import StaffListPage from './StaffListPage';
import StaffCreatePage from './StaffCreatePage';
import StoreConfigSubpage from './StoreConfigSubpage';
import DataCleanupSection from './DataCleanupSection';
import RbacPermissionsTable from './RbacPermissionsTable';
import RbacMainPage from '../rbac/RbacMainPage';
import StaffDetailSubpage from '../rbac/StaffDetailSubpage';
import RoleChangeSubpage from '../rbac/RoleChangeSubpage';
import RoleAuditLogSection from '../rbac/RoleAuditLogSection';
import SafeLogoutModal from './SafeLogoutModal';
import ProfileNavCard from './ProfileNavCard';
import AccessDeniedView from '../common/AccessDeniedView';
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
    cloudStatus,
    currentRole,
    currentUser,
    userProfiles = {},
    updateCurrentUserProfile,
    canManageStaff,
    canConfigureStore,
    canCleanupData,
    canChangeUserRole,
    currentRoute = '/settings',
    navigate
  } = usePos();

  const fileInputRef = useRef(null);
  const [imageError, setImageError] = useState(false);
  const { hasUpdate, newVersion, applyUpdate } = useVersionChecker();
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Subpage Navigation: 'main' | 'profile' | 'staff' | 'store-config' | 'data-cleanup' | 'rbac'
  const [currentView, setCurrentView] = useState('main');

  // Tự động đồng bộ currentView về 'main' khi route là /settings
  useEffect(() => {
    if (currentRoute === '/settings') {
      setCurrentView('main');
    }
  }, [currentRoute]);

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    showToast('Đã đăng xuất phiên làm việc POS', 'info');
    setActiveTab('tables');
  };

  const activeId = currentUser?.id || (currentRole === 'admin' ? 'staff-01' : currentRole === 'manager' ? 'staff-02' : 'staff-03');
  const userProfile = userProfiles[activeId] || {};

  const cashierRaw = settings?.currentCashier || 'Trần Mai (Mã NV: NV-08)';
  const displayName = userProfile.name || currentUser?.name || cashierRaw.split('(')[0].trim() || 'Trần Mai';
  const avatarUrl = userProfile.avatarUrl !== undefined ? userProfile.avatarUrl : (settings?.avatarUrl || null);

  // Xử lý upload ảnh đại diện nhanh qua camera icon
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast?.('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WebP)', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast?.('Dung lượng ảnh tối đa là 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result;
      if (base64Data) {
        setImageError(false);
        if (typeof updateCurrentUserProfile === 'function') {
          updateCurrentUserProfile({ avatarUrl: base64Data });
        } else {
          updateSettings({ avatarUrl: base64Data });
        }
      }
    };
    reader.onerror = () => {
      showToast?.('Không thể đọc file ảnh. Vui lòng thử lại.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    if (typeof updateCurrentUserProfile === 'function') {
      updateCurrentUserProfile({ avatarUrl: null });
    } else {
      updateSettings({ avatarUrl: null });
    }
    setImageError(false);
  };

  // Subpage 0: Quản lý Profile (All Roles)
  if (currentView === 'profile') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <ProfileEditSubpage onBack={() => setCurrentView('main')} />
      </div>
    );
  }

  // Route Guard: Nếu Staff truy cập /staff* trực tiếp -> Hiển thị AccessDeniedView
  if (currentRoute.startsWith('/staff') && !canManageStaff) {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <AccessDeniedView
          requiredRole="Cửa hàng trưởng hoặc Quản lý (Manager/Admin)"
          onBack={() => {
            setCurrentView('main');
            navigate('/settings');
          }}
        />
      </div>
    );
  }

  // Subpage 1B: Danh sách nhân viên (/staff/list)
  if (currentRoute === '/staff/list') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <StaffListPage />
      </div>
    );
  }

  // Subpage 1C: Thêm / Sửa nhân viên (/staff/create)
  if (currentRoute === '/staff/create') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <StaffCreatePage />
      </div>
    );
  }

  // Subpage 1A: Quản lý nhân viên - Hub chính (/staff hoặc currentView === 'staff')
  if (currentRoute === '/staff' || currentView === 'staff') {
    if (!canManageStaff) {
      return (
        <div className="px-4 pt-3.5 pb-24 text-xs text-center space-y-3">
          <p className="text-rose-600 font-bold">Từ chối quyền: Bạn không có quyền quản lý nhân viên.</p>
          <button
            type="button"
            onClick={() => {
              setCurrentView('main');
              navigate('/settings');
            }}
            className="px-3 py-1.5 bg-gray-100 rounded-xl font-bold"
          >
            Quay lại
          </button>
        </div>
      );
    }
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs space-y-4 animate-slideInRight">
        <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
          <button
            type="button"
            data-testid="staff-subpage-back-btn"
            onClick={() => {
              setCurrentView('main');
              navigate('/settings');
            }}
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
              Quản lý Nhân viên
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Điều hướng chức năng & tổng quan nhân sự
            </p>
          </div>
        </div>

        <StaffManagementSection />
      </div>
    );
  }

  // Subpage 2: Cấu hình quán & VietQR (Admin & Manager)
  if (currentView === 'store-config') {
    if (!canConfigureStore) {
      return (
        <div className="px-4 pt-3.5 pb-24 text-xs text-center space-y-3">
          <p className="text-rose-600 font-bold">Từ chối quyền: Bạn không có quyền cấu hình quán.</p>
          <button
            type="button"
            onClick={() => setCurrentView('main')}
            className="px-3 py-1.5 bg-gray-100 rounded-xl font-bold"
          >
            Quay lại
          </button>
        </div>
      );
    }
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <StoreConfigSubpage onBack={() => setCurrentView('main')} />
      </div>
    );
  }

  // Subpage 3: Dữ liệu bán hàng (Admin Only)
  if (currentView === 'data-cleanup') {
    if (!canCleanupData) {
      return (
        <div className="px-4 pt-3.5 pb-24 text-xs text-center space-y-3">
          <p className="text-rose-600 font-bold">Từ chối quyền: Chỉ Quản trị viên (Admin) mới có quyền dọn dẹp dữ liệu!</p>
          <button
            type="button"
            onClick={() => setCurrentView('main')}
            className="px-3 py-1.5 bg-gray-100 rounded-xl font-bold"
          >
            Quay lại
          </button>
        </div>
      );
    }
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs space-y-4 animate-slideInRight">
        <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
          <button
            type="button"
            data-testid="staff-subpage-back-btn"
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

  // Route Guard: Nếu Staff hoặc Manager truy cập /rbac* trực tiếp -> Hiển thị AccessDeniedView
  if (currentRoute.startsWith('/rbac') && !canChangeUserRole) {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <AccessDeniedView
          requiredRole="Quản trị viên (Admin)"
          onBack={() => {
            setCurrentView('main');
            navigate('/settings');
          }}
        />
      </div>
    );
  }

  // RBAC Subpage 4B: Chi tiết nhân viên (/rbac/detail)
  if (currentRoute === '/rbac/detail') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <StaffDetailSubpage />
      </div>
    );
  }

  // RBAC Subpage 4C: Thay đổi vai trò (/rbac/role)
  if (currentRoute === '/rbac/role') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <RoleChangeSubpage />
      </div>
    );
  }

  // RBAC Subpage 4D: Nhật ký phân quyền (/rbac/audit)
  if (currentRoute === '/rbac/audit') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <RoleAuditLogSection />
      </div>
    );
  }

  // RBAC Subpage 4A: Trang chính phân quyền (/rbac hoặc currentView === 'rbac')
  if (currentRoute === '/rbac' || currentView === 'rbac') {
    if (!canChangeUserRole) {
      return (
        <div className="px-4 pt-3.5 pb-24 text-xs text-center space-y-3">
          <p className="text-rose-600 font-bold">Từ chối quyền: Chỉ Quản trị viên (Admin) mới có quyền phân quyền hệ thống!</p>
          <button
            type="button"
            onClick={() => {
              setCurrentView('main');
              navigate('/settings');
            }}
            className="px-3 py-1.5 bg-gray-100 rounded-xl font-bold"
          >
            Quay lại
          </button>
        </div>
      );
    }
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <RbacMainPage onBack={() => {
          setCurrentView('main');
          navigate('/settings');
        }} />
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

        {/* Tên quản lý/nhân viên lấy từ profile đồng bộ */}
        <h2 className="text-lg font-black text-gray-900 tracking-tight mt-2.5">
          {displayName}
        </h2>

        {/* Badge Vai trò theo phiên làm việc (Admin / Manager / Staff) */}
        <div className="mt-1.5">
          <span
            data-role={currentRole === 'admin' ? 'Quản lý (Admin)' : currentRole === 'manager' ? 'Cửa hàng trưởng (Manager)' : 'Thu ngân (Staff)'}
            title={currentRole === 'admin' ? 'Quản lý (Admin)' : currentRole === 'manager' ? 'Cửa hàng trưởng (Manager)' : 'Thu ngân (Staff)'}
            className={`inline-flex items-center px-3 py-0.5 rounded-full text-[11.5px] font-bold shadow-2xs ${
              currentRole === 'admin'
                ? 'bg-forest-50 text-forest-800 border border-forest-200/80'
                : currentRole === 'manager'
                ? 'bg-blue-50 text-blue-800 border border-blue-200/80'
                : 'bg-amber-50 text-amber-800 border border-amber-200/80'
            }`}
          >
            {currentRole === 'admin' ? 'Quản lý • Admin' : currentRole === 'manager' ? 'Cửa hàng trưởng • Manager' : 'Thu ngân • Staff'}
          </span>
        </div>

        {/* Dòng thương hiệu "GÓC – Phê & Trà" */}
        <p className="text-xs text-gray-500 font-medium tracking-wide mt-1.5">
          GÓC – Phê & Trà
        </p>
      </div>

      {/* ========================================================= */}
      {/* 2. DANH SÁCH CARD CHỨC NĂNG PHÂN THEO ROLE (AUTO COLLAPSE) */}
      {/* ========================================================= */}
      <div className="mt-5 space-y-3">
        {/* Card 0: Quản lý Profile (All Roles: Admin, Manager, Staff) */}
        <ProfileNavCard
          title="Quản lý Profile"
          description="Chỉnh sửa ảnh đại diện, tên hiển thị & thông tin cá nhân"
          icon={User}
          bgColor="#F0F4FF"
          iconColor="#4F46E5"
          iconBgColor="rgba(79, 70, 229, 0.12)"
          onClick={() => setCurrentView('profile')}
          testId="profile-management-nav-card"
        />

        {/* Card 1: Quản lý nhân viên (Admin & Manager) */}
        {canManageStaff && (
          <ProfileNavCard
            title="Quản lý nhân viên"
            description="Danh sách & trạng thái thu ngân"
            icon={Users}
            bgColor="#EAF5ED"
            iconColor="#214E34"
            iconBgColor="rgba(33, 78, 52, 0.12)"
            onClick={() => {
              setCurrentView('staff');
              navigate('/staff');
            }}
            testId="staff-management-nav-card"
          />
        )}

        {/* Card 2: Cấu hình quán & VietQR (Admin & Manager) */}
        {canConfigureStore && (
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
        )}

        {/* Card 3: Dữ liệu bán hàng (Admin Only) */}
        {canCleanupData && (
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
        )}

        {/* Card 4: Phân quyền (Admin Only) */}
        {canChangeUserRole && (
          <ProfileNavCard
            title="Phân quyền"
            description="Quản trị vai trò & bảo mật tài khoản nhân sự"
            icon={ShieldCheck}
            bgColor="#F1EDFA"
            iconColor="#7C3AED"
            iconBgColor="rgba(124, 58, 237, 0.12)"
            onClick={() => {
              setCurrentView('rbac');
              navigate('/rbac');
            }}
            testId="rbac-permissions-nav-card"
          />
        )}
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
