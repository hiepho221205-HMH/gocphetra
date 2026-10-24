import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Wifi,
  Copy,
  CheckCircle2,
  Check
} from 'lucide-react';
import { triggerHaptic } from '../../../../utils/haptics';
import UnsavedChangesModal from '../UnsavedChangesModal';

/**
 * WifiConfigSubpage - Subpage 4: Wi-Fi Khách hàng
 * Quản lý mật khẩu Wi-Fi của quán và tùy chọn tự động in lên hóa đơn.
 * Lưu độc lập, hỗ trợ sao chép nhanh mật khẩu.
 */
export default function WifiConfigSubpage({
  settings,
  updateSettings,
  showToast,
  onBack
}) {
  const [wifiPassword, setWifiPassword] = useState(settings?.wifiPassword || 'xincamon');
  const [wifiOnReceipt, setWifiOnReceipt] = useState(settings?.wifiOnReceipt !== false);
  const [copiedWifi, setCopiedWifi] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Baseline dirty check
  const initialRef = useRef({
    wifiPassword: settings?.wifiPassword || 'xincamon',
    wifiOnReceipt: settings?.wifiOnReceipt !== false
  });

  const isDirty =
    wifiPassword !== initialRef.current.wifiPassword ||
    wifiOnReceipt !== initialRef.current.wifiOnReceipt;

  useEffect(() => {
    const handlePopState = () => {
      if (isDirty) {
        window.history.pushState(null, '', window.location.href);
        setShowDiscardModal(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDirty]);

  const handleBackClick = () => {
    triggerHaptic('light');
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      onBack?.();
    }
  };

  const handleCopyWifi = () => {
    triggerHaptic('light');
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(wifiPassword);
      setCopiedWifi(true);
      showToast?.('Đã sao chép mật khẩu Wi-Fi!', 'success');
      setTimeout(() => setCopiedWifi(false), 2000);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      await updateSettings?.({
        wifiPassword: wifiPassword.trim(),
        wifiOnReceipt
      });

      initialRef.current = {
        wifiPassword: wifiPassword.trim(),
        wifiOnReceipt
      };

      showToast?.('Đã lưu cấu hình Wi-Fi thành công!', 'success');
    } catch (err) {
      showToast?.('Lỗi khi lưu cấu hình Wi-Fi: ' + (err.message || 'Thử lại sau'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="wifi-config-subpage"
      className="space-y-4 animate-slideInRight text-xs pb-24 max-w-2xl mx-auto"
    >
      {/* Top Header */}
      <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
        <button
          type="button"
          onClick={handleBackClick}
          className="touch-target p-2 rounded-2xl bg-white border border-gray-200/80 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
          title="Quay lại Settings Hub"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-4 h-4 text-[#7C3AED]" />
            <h2 className="text-base font-black text-forest-950 tracking-tight leading-none">
              Wi-Fi Khách hàng
            </h2>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">
            Cấu hình mật khẩu phát cho khách và tùy chọn in chân hóa đơn
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-3.5">
        <div className="clay-card p-4 sm:p-5 rounded-[24px] bg-white border border-white/95 shadow-xs space-y-4">
          <div>
            <label className="block text-gray-800 font-bold mb-1.5">
              Mật khẩu Wi-Fi của quán
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder="Nhập mật khẩu WiFi"
                className="clay-input flex-1 h-11 px-3.5 bg-gray-50/80 border border-gray-200/80 rounded-2xl focus:bg-white focus:outline-none focus:border-[#214E34] font-mono font-bold text-forest-950 text-sm"
              />
              <button
                type="button"
                onClick={handleCopyWifi}
                className="h-11 px-3.5 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-800 border border-indigo-200/80 rounded-2xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs active:scale-[0.98]"
              >
                {copiedWifi ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[10.5px] text-gray-400 mt-1">
              Thu ngân có thể bấm nút sao chép nhanh để gửi cho khách khi cần.
            </p>
          </div>

          <div className="p-3.5 bg-gray-50/90 rounded-2xl border border-gray-200/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 text-xs">
                In mật khẩu Wi-Fi trên hóa đơn
              </span>
              <input
                type="checkbox"
                checked={wifiOnReceipt}
                onChange={(e) => setWifiOnReceipt(e.target.checked)}
                className="w-4 h-4 accent-[#214E34] rounded cursor-pointer"
              />
            </div>
            <p className="text-[10.5px] text-gray-500 leading-tight">
              Khi bật, dòng "Wi-Fi: {wifiPassword || '...'}" sẽ xuất hiện ở chân bill gửi khách hàng.
            </p>
          </div>
        </div>

        {/* Sticky Save Button */}
        <div className="sticky bottom-4 z-20 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="touch-target btn-press w-full py-3.5 bg-[#214E34] hover:bg-[#183926] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 text-sm cursor-pointer transition-all active:scale-[0.98]"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Đang lưu cấu hình Wi-Fi...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Lưu cấu hình Wi-Fi</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Dirty Warning Modal */}
      <UnsavedChangesModal
        isOpen={showDiscardModal}
        onStay={() => setShowDiscardModal(false)}
        onDiscard={() => {
          setShowDiscardModal(false);
          onBack?.();
        }}
      />
    </div>
  );
}
