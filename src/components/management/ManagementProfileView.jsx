import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { usePos } from '../../store/PosContext';
import { useVersionChecker } from '../../hooks/useVersionChecker';
import { APP_VERSION, BUILD_DATE, RELEASE_NAME } from '../../config/version';
import { exportPosBackup } from '../../utils/storageMigrator';
import StaffManagementSection from './StaffManagementSection';
import DataCleanupSection from './DataCleanupSection';
import SafeLogoutModal from './SafeLogoutModal';
import ProfileNavCard from './ProfileNavCard';
import AccessDeniedView from '../common/AccessDeniedView';

// Code-split heavy subpages and modals to optimize bundle size and view transition speed
const ProfileEditSubpage = lazy(() => import('./ProfileEditSubpage'));
const StaffListPage = lazy(() => import('./StaffListPage'));
const StaffCreatePage = lazy(() => import('./StaffCreatePage'));
const StaffEditProfilePage = lazy(() => import('./StaffEditProfilePage'));
const StoreConfigSubpage = lazy(() => import('./StoreConfigSubpage'));
const RbacMainPage = lazy(() => import('../rbac/RbacMainPage'));
const StaffDetailSubpage = lazy(() => import('../rbac/StaffDetailSubpage'));
const RoleChangeSubpage = lazy(() => import('../rbac/RoleChangeSubpage'));
const RoleAuditLogSection = lazy(() => import('../rbac/RoleAuditLogSection'));
const EmergencyOrderManagerModal = lazy(() => import('./EmergencyOrderManagerModal'));

const SubpageLoadingFallback = () => (
  <div className="flex-1 min-h-[160px] flex items-center justify-center p-6 text-[#214E34]">
    <div className="flex flex-col items-center gap-2">
      <div className="w-6 h-6 rounded-full border-2 border-[#214E34] border-t-transparent animate-spin"></div>
      <span className="text-[11px] font-bold text-gray-500">Đang tải chức năng...</span>
    </div>
  </div>
);
import {
  isBluetoothSupported,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  getBluetoothPrinterStatus,
  printReceipt57mm
} from '../../utils/bluetoothPrinter';
import {
  Bluetooth,
  Printer,
  User,
  Users,
  Store,
  Database,
  ShieldCheck,
  ArrowLeft,
  Smartphone,
  Monitor,
  LogOut,
  Camera,
  ShieldAlert
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
    navigate,
    logoutUser
  } = usePos();

  const fileInputRef = useRef(null);
  const [imageError, setImageError] = useState(false);
  const { hasUpdate, newVersion, applyUpdate } = useVersionChecker();
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [btStatus, setBtStatus] = useState(() => getBluetoothPrinterStatus());
  const [isConnectingBt, setIsConnectingBt] = useState(false);
  const [isTestingBt, setIsTestingBt] = useState(false);

  useEffect(() => {
    setBtStatus(getBluetoothPrinterStatus());
  }, []);

  const handleConnectBt = async () => {
    setIsConnectingBt(true);
    try {
      if (!isBluetoothSupported()) {
        showToast?.('Trình duyệt không hỗ trợ Web Bluetooth. Vui lòng mở bằng Chrome hoặc Edge!', 'error');
        return;
      }
      const res = await connectBluetoothPrinter();
      setBtStatus(getBluetoothPrinterStatus());
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        showToast?.(err.message || 'Lỗi kết nối máy in Bluetooth', 'error');
      }
    } finally {
      setIsConnectingBt(false);
    }
  };

  const handleDisconnectBt = () => {
    disconnectBluetoothPrinter();
    setBtStatus(getBluetoothPrinterStatus());
  };

  const handleTestPrintBt = async () => {
    setIsTestingBt(true);
    try {
      if (!btStatus.isConnected) {
        showToast?.('Vui lòng kết nối máy in trước khi in thử!', 'error');
        return;
      }
      const mockTestOrder = {
        id: 'TEST-57MM',
        tableName: 'Test In',
        cashier: displayName,
        subtotal: 55000,
        total: 55000,
        discountPercent: 0,
        surcharge: 0,
        paymentMethod: 'cash',
        items: [
          { name: 'Cà phê đen đá (Test)', quantity: 1, price: 25000, lineTotal: 25000 },
          { name: 'Bạc xỉu đặc biệt', quantity: 1, price: 30000, lineTotal: 30000 }
        ]
      };
      await printReceipt57mm(mockTestOrder, settings, {
        useNoAccents: settings?.printNoAccents === true
      });
    } catch (err) {
      showToast?.('Lỗi in thử nghiệm: ' + err.message, 'error');
    } finally {
      setIsTestingBt(false);
    }
  };

  // Subpage Navigation: 'main' | 'profile' | 'staff' | 'store-config' | 'data-cleanup' | 'rbac'
  const [currentView, setCurrentView] = useState('main');

  // Tự động đồng bộ currentView về 'main' khi route là /settings
  useEffect(() => {
    if (currentRoute === '/settings') {
      setCurrentView('main');
    }
  }, [currentRoute]);

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    await logoutUser();
  };

  const branchName = settings?.branchName || 'Chi nhánh 01 - Trụ sở chính';
  const shiftName = settings?.shiftName || 'Ca Sáng (06:30 - 14:30)';

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
        <Suspense fallback={<SubpageLoadingFallback />}>
          <ProfileEditSubpage onBack={() => setCurrentView('main')} />
        </Suspense>
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
        <Suspense fallback={<SubpageLoadingFallback />}>
          <StaffListPage />
        </Suspense>
      </div>
    );
  }

  // Subpage 1D: Chỉnh sửa Profile Nhân viên (/staff/edit)
  if (currentRoute === '/staff/edit') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <Suspense fallback={<SubpageLoadingFallback />}>
          <StaffEditProfilePage />
        </Suspense>
      </div>
    );
  }

  // Subpage 1C: Thêm / Sửa nhân viên (/staff/create)
  if (currentRoute === '/staff/create') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <Suspense fallback={<SubpageLoadingFallback />}>
          <StaffCreatePage />
        </Suspense>
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

        {/* SLOT: SECTION 1 - QUẢN LÝ NHÂN VIÊN TỐI GIẢN (MILESTONE 2: StaffManagementSection) */}
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
        <Suspense fallback={<SubpageLoadingFallback />}>
          <StoreConfigSubpage onBack={() => setCurrentView('main')} />
        </Suspense>
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

        {/* SLOT: SECTION 2 - DỌN DẸP DỮ LIỆU BÁN HÀNG AN TOÀN (MILESTONE 3: DataCleanupSection) */}
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
        <Suspense fallback={<SubpageLoadingFallback />}>
          <StaffDetailSubpage />
        </Suspense>
      </div>
    );
  }

  // RBAC Subpage 4C: Thay đổi vai trò (/rbac/role)
  if (currentRoute === '/rbac/role') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <Suspense fallback={<SubpageLoadingFallback />}>
          <RoleChangeSubpage />
        </Suspense>
      </div>
    );
  }

  // RBAC Subpage 4D: Nhật ký phân quyền (/rbac/audit)
  if (currentRoute === '/rbac/audit') {
    return (
      <div className="px-4 pt-3.5 pb-24 text-xs">
        <Suspense fallback={<SubpageLoadingFallback />}>
          <RoleAuditLogSection />
        </Suspense>
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
        <Suspense fallback={<SubpageLoadingFallback />}>
          <RbacMainPage onBack={() => {
            setCurrentView('main');
            navigate('/settings');
          }} />
        </Suspense>
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

        {/* Card 5: Xử lý Khẩn cấp & Cứu bàn (Admin & Manager) */}
        {['admin', 'manager'].includes(currentRole) && (
          <ProfileNavCard
            title="Xử lý Khẩn cấp & Cứu bàn"
            description="Toàn quyền xóa đơn lỗi, quét đơn ma & mở khóa bàn"
            icon={ShieldAlert}
            bgColor="#FFF1F2"
            iconColor="#E11D48"
            iconBgColor="rgba(225, 29, 72, 0.12)"
            onClick={() => setIsEmergencyModalOpen(true)}
            testId="emergency-manager-nav-card"
          />
        )}
      </div>

      {isEmergencyModalOpen && (
        <Suspense fallback={null}>
          <EmergencyOrderManagerModal
            isOpen={isEmergencyModalOpen}
            onClose={() => setIsEmergencyModalOpen(false)}
          />
        </Suspense>
      )}

      {/* ========================================================= */}
      {/* 3. CHẾ ĐỘ HIỂN THỊ POS & THIẾT BỊ                         */}
      {/* ========================================================= */}
      <div className="mt-4 clay-card p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-[12px] bg-forest-50 text-forest-800 flex items-center justify-center shadow-inner">
              {deviceMode === 'mobile' ? (
                <Smartphone className="w-4 h-4 text-forest-700" />
              ) : (
                <Monitor className="w-4 h-4 text-forest-700" />
              )}
            </div>
            <div>
              <h4 className="font-black text-gray-900 text-xs">Chế độ hiển thị POS</h4>
              <p className="text-[10px] text-gray-400 font-medium">
                {deviceMode === 'mobile' ? 'Khung chuẩn Mobile 390px' : 'Toàn màn hình (Desktop/Tablet)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="toggle-device-mode-btn"
            onClick={toggleDeviceMode}
            className="touch-target btn-press px-3 py-2 text-xs font-black rounded-[16px] clay-btn text-forest-900 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
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
      {/* 3.5. CẤU HÌNH MÁY IN BLUETOOTH (57MM)                      */}
      {/* ========================================================= */}
      <div className="mt-4 clay-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`w-8 h-8 rounded-[12px] flex items-center justify-center shadow-inner ${
              btStatus.isConnected
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-blue-50 text-blue-700'
            }`}>
              <Bluetooth className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-gray-900 text-xs">Máy in Bluetooth (Khổ 57mm)</h4>
              <p className="text-[10px] text-gray-400 font-medium">
                {btStatus.isConnected
                  ? `Đang kết nối: ${btStatus.deviceName}`
                  : 'In hóa đơn nhiệt 1 chạm không dây'}
              </p>
            </div>
          </div>

          <div>
            {btStatus.isConnected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Đã kết nối</span>
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                Chưa kết nối
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {btStatus.isConnected ? (
            <button
              type="button"
              onClick={handleDisconnectBt}
              className="py-2 px-3 text-xs font-bold rounded-xl clay-inset text-rose-700 hover:text-rose-800 cursor-pointer"
            >
              Ngắt kết nối
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnectBt}
              disabled={isConnectingBt}
              className="py-2 px-3 text-xs font-black rounded-xl clay-btn-primary text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Bluetooth className="w-3.5 h-3.5" />
              <span>{isConnectingBt ? 'Đang tìm...' : 'Tìm & Ghép nối'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleTestPrintBt}
            disabled={!btStatus.isConnected || isTestingBt}
            className={`py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              btStatus.isConnected
                ? 'clay-btn text-forest-900 shadow-xs active:scale-95'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isTestingBt ? 'Đang in...' : 'In thử nghiệm'}</span>
          </button>
        </div>

        {/* Toggle print without accents */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-gray-800 text-[11px]">In tiếng Việt không dấu</p>
            <p className="text-[9.5px] text-gray-400">Khuyến nghị 100% để tránh lỗi font máy in mini</p>
          </div>
          <input
            type="checkbox"
            checked={settings?.printNoAccents === true}
            onChange={(e) => updateSettings({ printNoAccents: e.target.checked })}
            className="w-4 h-4 rounded text-forest-800 focus:ring-forest-800 cursor-pointer accent-[#214E34]"
          />
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
          className="touch-target btn-press w-full py-3.5 px-4 bg-gradient-to-r from-rose-50 to-rose-100/90 hover:from-rose-100 hover:to-rose-200 text-rose-800 border border-rose-200/90 rounded-[22px] font-black text-xs flex items-center justify-center gap-2 transition-all shadow-[0_6px_16px_-2px_rgba(244,63,94,0.18),inset_0_2px_2px_rgba(255,255,255,0.95)] cursor-pointer active:scale-95"
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
