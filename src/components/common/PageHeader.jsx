import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import { User, Download, Settings, LogOut } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import BluetoothStatusBadge from './BluetoothStatusBadge';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import PwaInstallBanner from './PwaInstallBanner';

const TAB_CONFIG = {
  tables: {
    title: 'Sơ đồ bàn',
    subtitle: 'Quản lý trạng thái bàn & gọi món nhanh'
  },
  barista: {
    title: 'Danh sách pha chế',
    subtitle: 'Hàng đợi chế biến & tiến độ quầy bar'
  },
  barista_history: {
    title: 'Lịch sử pha chế',
    subtitle: 'Các đơn đã hoàn tất trong ca làm việc'
  },
  menu: {
    title: 'Thực đơn',
    subtitle: 'Quản lý món, phân loại danh mục & topping'
  },
  orders: {
    title: 'Đơn hàng',
    subtitle: 'Quản lý hóa đơn phục vụ & lịch sử'
  },
  reports: {
    title: 'Báo cáo',
    subtitle: 'Thống kê doanh thu & ca làm việc'
  }
};

/**
 * Shared Sticky PageHeader inspired by Foodgo design layout.
 * Features:
 * - Left: Big bold page title (26-28px #214E34) & subtitle (12-13px)
 * - Right: PWA Install Quick Action, Bluetooth Status Badge & Circular Avatar (48-52px)
 * - Persistent sticky positioning, safe-area aware, high-contrast, mobile-first 360-430px
 */
export default function PageHeader({ onOpenSettings, onOpenProfile }) {
  const { activeTab, settings, setActiveTab, currentUser, userProfiles, canAccessSettings, showToast, currentRole, logoutUser, logout } = usePos();
  const [imageError, setImageError] = useState(false);
  const { isInstallable, isInstalled } = usePwaInstall();
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const isBarista = currentUser?.role === 'barista' || currentRole === 'barista';
  let config = TAB_CONFIG[activeTab] || TAB_CONFIG.tables;
  if (isBarista && activeTab === 'tables') {
    config = {
      title: 'Sơ đồ bàn',
      subtitle: 'Vị trí các bàn đang chờ pha chế'
    };
  }
  const activeId = currentUser?.id;
  const userProfile = (activeId && userProfiles?.[activeId]) || currentUser || {};
  const avatarUrl = userProfile.avatarUrl || settings?.avatarUrl || null;
  const displayName = userProfile.name || currentUser?.name || settings?.currentCashier?.split('(')[0]?.trim() || 'Trần Mai';

  const handleAvatarClick = () => {
    triggerHaptic('light');
    setShowProfileMenu(true);
  };

  return (
    <>
      <header
        data-testid="shared-page-header"
        className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 border-b border-white/60 shadow-[0_8px_20px_-4px_rgba(160,175,200,0.12),inset_0_-1px_2px_rgba(255,255,255,0.8)] shrink-0 transition-all duration-200"
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: Big Title & Subtitle */}
          <div className="flex-1 min-w-0 pr-1">
            <h1
              data-testid="page-header-title"
              className="text-[26px] sm:text-[28px] font-black text-[#214E34] tracking-tight leading-tight truncate font-sans"
            >
              {config.title}
            </h1>
            <p
              data-testid="page-header-subtitle"
              className="text-[12.5px] text-gray-500 font-bold truncate mt-0.5 leading-normal"
            >
              {config.subtitle}
            </p>
          </div>

          {/* Right: PWA Install Button, Bluetooth Status Badge & Circular Avatar */}
          <div className="flex items-center gap-2 shrink-0">
            {isInstallable && !isInstalled && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  setShowInstallBanner(true);
                }}
                title="Cài đặt ứng dụng GÓC POS (PWA)"
                aria-label="Cài đặt ứng dụng GÓC POS"
                data-testid="header-pwa-install-button"
                className="relative w-[38px] h-[38px] rounded-full border border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 flex items-center justify-center text-[#214E34] cursor-pointer shadow-[0_4px_10px_-2px_rgba(33,78,52,0.12),inset_0_1px_2px_rgba(255,255,255,0.8)] active:scale-95 transition-all"
              >
                <Download className="w-[18px] h-[18px] text-[#214E34]" />
              </button>
            )}

            <BluetoothStatusBadge />

            <button
              type="button"
              onClick={handleAvatarClick}
              aria-label={`Xem hồ sơ ${displayName}`}
              data-testid="header-avatar-button"
              className="relative shrink-0 w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-[#D4E8DB] via-[#E8F5EE] to-[#D4E8DB] ring-2 ring-[#D4E8DB]/60 hover:ring-[#214E34]/30 active:scale-95 transition-all duration-150 shadow-[0_6px_14px_-2px_rgba(160,175,200,0.35),inset_0_2px_2px_rgba(255,255,255,0.9)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#214E34]"
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-[#EBF5ED] flex items-center justify-center">
                {avatarUrl && !imageError ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#EBF5ED] text-[#214E34] flex items-center justify-center font-bold">
                    <User className="w-6 h-6 text-[#214E34] stroke-[2.2]" />
                  </div>
                )}
              </div>

              {/* Online status indicator dot */}
              <span
                aria-hidden="true"
                className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#009E78] rounded-full border-2 border-white shadow-xs"
              />
            </button>
          </div>
        </div>
      </header>

      {/* PWA Install Sheet Modal */}
      <PwaInstallBanner
        isOpen={showInstallBanner}
        onClose={() => setShowInstallBanner(false)}
      />

      {/* Profile & Fast Logout Modal Popover */}
      {showProfileMenu && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Hồ sơ tài khoản"
          data-testid="header-profile-menu-backdrop"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-end p-4 pt-16 sm:pt-20 animate-fadeIn"
          onClick={() => setShowProfileMenu(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-4 w-72 shadow-2xl border border-gray-100 space-y-3.5 animate-slideDown"
          >
            {/* Header User Card */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-[#EBF5ED] flex items-center justify-center shrink-0 border-2 border-emerald-500/20">
                {avatarUrl && !imageError ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-[#214E34]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-black text-sm text-gray-900 truncate">{displayName}</h4>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {currentRole === 'barista' ? 'Pha chế (Barista)' : currentRole === 'admin' ? 'Quản trị viên' : currentRole === 'manager' ? 'Cửa hàng trưởng' : 'Thu ngân'}
                </span>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">{userProfile.email || currentUser?.email || 'Nội bộ GÓC POS'}</p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="space-y-1.5 pt-0.5">
              {canAccessSettings && (
                <button
                  type="button"
                  data-testid="profile-menu-settings-btn"
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onOpenProfile) onOpenProfile();
                    else if (onOpenSettings) onOpenSettings();
                    else setActiveTab('settings');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-900 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-gray-500" />
                  <span>Cài đặt & Hồ sơ</span>
                </button>
              )}

              <button
                type="button"
                data-testid="header-logout-button"
                onClick={async () => {
                  triggerHaptic('warning');
                  setShowProfileMenu(false);
                  if (typeof logoutUser === 'function') {
                    await logoutUser();
                  } else if (typeof logout === 'function') {
                    await logout();
                  }
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>Đăng xuất ca làm việc</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
