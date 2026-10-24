import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import {
  ArrowLeft,
  Store,
  FileText,
  ChefHat,
  Wifi,
  CreditCard,
  Database,
  ShieldCheck,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import SettingsHubCard from '../settings/hub/SettingsHubCard';
import StoreInfoConfigSubpage from '../settings/hub/subpages/StoreInfoConfigSubpage';
import ReceiptConfigSubpage from '../settings/hub/subpages/ReceiptConfigSubpage';
import KitchenTicketConfigSubpage from '../settings/hub/subpages/KitchenTicketConfigSubpage';
import WifiConfigSubpage from '../settings/hub/subpages/WifiConfigSubpage';
import VietQrConfigSubpage from '../settings/hub/subpages/VietQrConfigSubpage';
import CloudConfigSubpage from '../settings/hub/subpages/CloudConfigSubpage';

/**
 * StoreConfigSubpage - Settings Hub Coordinator
 * Grid 2 cột trên mobile (390px), Soft 3D Neumorphism, 6 trang cấu hình độc lập.
 */
export default function StoreConfigSubpage({ onBack }) {
  const {
    settings,
    updateSettings,
    showToast,
    cloudStatus,
    isSyncing,
    syncFromCloud,
    seedToCloud,
    uploadStoreLogo
  } = usePos();

  // Active subpage state: null | 'store-info' | 'receipt' | 'kitchen-ticket' | 'wifi' | 'vietqr' | 'cloud'
  const [activeSubpage, setActiveSubpage] = useState(null);

  // Subpage 1: Thông tin quán
  if (activeSubpage === 'store-info') {
    return (
      <StoreInfoConfigSubpage
        settings={settings}
        updateSettings={updateSettings}
        showToast={showToast}
        onBack={() => setActiveSubpage(null)}
      />
    );
  }

  // Subpage 2: Hóa đơn & In ấn
  if (activeSubpage === 'receipt') {
    return (
      <ReceiptConfigSubpage
        settings={settings}
        updateSettings={updateSettings}
        uploadStoreLogo={uploadStoreLogo}
        showToast={showToast}
        onBack={() => setActiveSubpage(null)}
      />
    );
  }

  // Subpage 3: Phiếu chế biến (Bếp / Bar)
  if (activeSubpage === 'kitchen-ticket') {
    return (
      <KitchenTicketConfigSubpage
        settings={settings}
        updateSettings={updateSettings}
        showToast={showToast}
        onBack={() => setActiveSubpage(null)}
      />
    );
  }

  // Subpage 4: Wi-Fi Khách hàng
  if (activeSubpage === 'wifi') {
    return (
      <WifiConfigSubpage
        settings={settings}
        updateSettings={updateSettings}
        showToast={showToast}
        onBack={() => setActiveSubpage(null)}
      />
    );
  }

  // Subpage 5: Tài khoản & VietQR
  if (activeSubpage === 'vietqr') {
    return (
      <VietQrConfigSubpage
        settings={settings}
        updateSettings={updateSettings}
        showToast={showToast}
        onBack={() => setActiveSubpage(null)}
      />
    );
  }

  // Subpage 6: Cloud & Dữ liệu
  if (activeSubpage === 'cloud') {
    return (
      <CloudConfigSubpage
        cloudStatus={cloudStatus}
        isSyncing={isSyncing}
        syncFromCloud={syncFromCloud}
        seedToCloud={seedToCloud}
        showToast={showToast}
        onBack={() => setActiveSubpage(null)}
      />
    );
  }

  // Main Settings Hub View (Grid 2 Cột)
  return (
    <div
      data-testid="store-config-subpage"
      className="space-y-4 animate-slideInRight text-xs pb-20 max-w-2xl mx-auto"
    >
      {/* Top Header Navigation */}
      <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onBack?.();
          }}
          className="touch-target p-2 rounded-2xl bg-white border border-gray-200/80 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
          title="Quay lại Quản lý"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-black text-forest-950 tracking-tight leading-none">
            Cấu hình Quán & Hóa đơn
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">
            Settings Hub 6 danh mục cấu hình độc lập, lưu riêng từng phần
          </p>
        </div>
      </div>

      {/* 2-Column Settings Hub Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Card 1: Thông tin quán */}
        <SettingsHubCard
          title="Thông tin Quán"
          subtitle="Tên quán, địa chỉ, hotline & ca thu ngân"
          icon={Store}
          iconColor="#059669"
          iconBgColor="rgba(5, 150, 105, 0.12)"
          badge="Cơ bản"
          badgeColor="#059669"
          badgeBgColor="rgba(5, 150, 105, 0.1)"
          onClick={() => setActiveSubpage('store-info')}
          testId="hub-card-store-info"
        />

        {/* Card 2: Hóa đơn & In ấn */}
        <SettingsHubCard
          title="Hóa đơn & In ấn"
          subtitle="Khổ K58/K80, logo nhiệt, chế độ in bill"
          icon={FileText}
          iconColor="#2563EB"
          iconBgColor="rgba(37, 99, 235, 0.12)"
          badge={settings?.receiptPaperWidth || '58mm'}
          badgeColor="#2563EB"
          badgeBgColor="rgba(37, 99, 235, 0.1)"
          onClick={() => setActiveSubpage('receipt')}
          testId="hub-card-receipt"
        />

        {/* Card 3: Phiếu chế biến */}
        <SettingsHubCard
          title="Phiếu Chế biến"
          subtitle="Bếp & Bar, in món mới/toàn đơn"
          icon={ChefHat}
          iconColor="#D97706"
          iconBgColor="rgba(217, 119, 6, 0.12)"
          badge={settings?.kitchenTicketSettings?.enabled !== false ? 'Bật' : 'Tắt'}
          badgeColor={settings?.kitchenTicketSettings?.enabled !== false ? '#D97706' : '#6B7280'}
          badgeBgColor={settings?.kitchenTicketSettings?.enabled !== false ? 'rgba(217, 119, 6, 0.1)' : 'rgba(107, 114, 128, 0.1)'}
          onClick={() => setActiveSubpage('kitchen-ticket')}
          testId="hub-card-kitchen-ticket"
        />

        {/* Card 4: Wi-Fi khách */}
        <SettingsHubCard
          title="Wi-Fi Khách"
          subtitle="Mật khẩu Wi-Fi & in lên chân bill"
          icon={Wifi}
          iconColor="#7C3AED"
          iconBgColor="rgba(124, 58, 237, 0.12)"
          badge={settings?.wifiPassword ? 'Đã cài' : 'Chưa có'}
          badgeColor="#7C3AED"
          badgeBgColor="rgba(124, 58, 237, 0.1)"
          onClick={() => setActiveSubpage('wifi')}
          testId="hub-card-wifi"
        />

        {/* Card 5: VietQR */}
        <SettingsHubCard
          title="Tài khoản & VietQR"
          subtitle="Ngân hàng nhận tiền, mã QR động"
          icon={CreditCard}
          iconColor="#0D9488"
          iconBgColor="rgba(13, 148, 136, 0.12)"
          badge={settings?.bankAccount?.bankCode || 'MB'}
          badgeColor="#0D9488"
          badgeBgColor="rgba(13, 148, 136, 0.1)"
          onClick={() => setActiveSubpage('vietqr')}
          testId="hub-card-vietqr"
        />

        {/* Card 6: Cloud & Dữ liệu */}
        <SettingsHubCard
          title="Cloud & Dữ liệu"
          subtitle="Supabase Postgres, trạng thái & sync"
          icon={Database}
          iconColor="#E11D48"
          iconBgColor="rgba(225, 29, 72, 0.12)"
          badge={cloudStatus?.connected ? 'Online' : 'Offline'}
          badgeColor={cloudStatus?.connected ? '#059669' : '#D97706'}
          badgeBgColor={cloudStatus?.connected ? 'rgba(5, 150, 105, 0.1)' : 'rgba(217, 119, 6, 0.1)'}
          onClick={() => setActiveSubpage('cloud')}
          testId="hub-card-cloud"
        />
      </div>

      {/* Overview Soft Banner */}
      <div className="clay-card p-4 rounded-[22px] bg-white border border-white/95 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <span className="font-extrabold text-forest-950 text-xs block truncate">
              {settings?.storeName || settings?.branchName || 'GÓC - PHÊ & TRÀ'}
            </span>
            <span className="text-[10px] text-gray-500 block truncate">
              {settings?.branchAddress || 'Chi nhánh hoạt động chuẩn PWA'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80 font-bold text-[10px]">
          <CheckCircle2 className="w-3 h-3" />
          <span>Sẵn sàng</span>
        </div>
      </div>
    </div>
  );
}
