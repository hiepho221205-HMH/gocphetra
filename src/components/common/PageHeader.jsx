import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import { User } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

const TAB_CONFIG = {
  tables: {
    title: 'Sơ đồ bàn',
    subtitle: 'Quản lý trạng thái bàn & gọi món nhanh'
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
 * - Right: Circular avatar (48-52px) with subtle mint accent border (#D4E8DB) & online indicator
 * - Persistent sticky positioning, safe-area aware, high-contrast, mobile-first 360-430px
 */
export default function PageHeader({ onOpenSettings, onOpenProfile }) {
  const { activeTab, settings, setActiveTab, currentUser, userProfiles, canAccessSettings, showToast } = usePos();
  const [imageError, setImageError] = useState(false);

  const config = TAB_CONFIG[activeTab] || TAB_CONFIG.tables;
  const activeId = currentUser?.id;
  const userProfile = (activeId && userProfiles?.[activeId]) || currentUser || {};
  const avatarUrl = userProfile.avatarUrl || settings?.avatarUrl || null;
  const displayName = userProfile.name || currentUser?.name || settings?.currentCashier?.split('(')[0]?.trim() || 'Trần Mai';

  const handleAvatarClick = () => {
    triggerHaptic('light');
    if (!canAccessSettings) {
      showToast?.('Từ chối quyền: Nhân viên không được phép truy cập Cài đặt hệ thống!', 'error');
      return;
    }
    if (onOpenSettings) {
      onOpenSettings();
    } else if (onOpenProfile) {
      onOpenProfile();
    } else {
      setActiveTab('settings');
    }
  };

  return (
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

        {/* Right: Circular 48px Avatar with Mint Border (#D4E8DB) */}
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
            className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#10B981] rounded-full border-2 border-white shadow-xs"
          />
        </button>
      </div>
    </header>
  );
}
