import React, { useState, useEffect } from 'react';
import { ArrowLeft, Store, Check, Save } from 'lucide-react';
import { triggerHaptic } from '../../../../utils/haptics';
import UnsavedChangesModal from '../UnsavedChangesModal';

/**
 * StoreInfoConfigSubpage - Subpage 1: Thông tin quán
 * Quản lý tên quán, địa chỉ, hotline, chi nhánh và thu ngân mặc định.
 * Lưu độc lập, không ghi đè các cấu hình khác.
 */
export default function StoreInfoConfigSubpage({
  settings,
  updateSettings,
  showToast,
  onBack
}) {
  const [branchName, setBranchName] = useState(settings?.branchName || 'Chi nhánh 01 - Trụ sở chính');
  const [storeName, setStoreName] = useState(settings?.storeName || settings?.branchName || 'GÓC');
  const [branchAddress, setBranchAddress] = useState(settings?.branchAddress || settings?.storeAddress || '18A Võ Văn Dũng, Phường An Nhơn, Bình Định');
  const [hotline, setHotline] = useState(settings?.hotline || settings?.contactPhone || '1900 88 99 22');
  const [cashier, setCashier] = useState(settings?.currentCashier || 'Thu ngân');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Dirty State Detection
  const initialValues = {
    storeName: settings?.storeName || settings?.branchName || 'GÓC',
    branchName: settings?.branchName || 'Chi nhánh 01 - Trụ sở chính',
    branchAddress: settings?.branchAddress || settings?.storeAddress || '18A Võ Văn Dũng, Phường An Nhơn, Bình Định',
    hotline: settings?.hotline || settings?.contactPhone || '1900 88 99 22',
    cashier: settings?.currentCashier || 'Thu ngân'
  };

  const isDirty =
    storeName !== initialValues.storeName ||
    branchName !== initialValues.branchName ||
    branchAddress !== initialValues.branchAddress ||
    hotline !== initialValues.hotline ||
    cashier !== initialValues.cashier;

  // Browser Popstate Safeguard
  useEffect(() => {
    const handlePopState = (e) => {
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

  const handleSave = async (e) => {
    e.preventDefault();
    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      await updateSettings?.({
        storeName: storeName.trim(),
        branchName: branchName.trim(),
        branchAddress: branchAddress.trim(),
        storeAddress: branchAddress.trim(),
        hotline: hotline.trim(),
        contactPhone: hotline.trim(),
        currentCashier: cashier.trim()
      });

      showToast?.('Đã lưu thông tin quán thành công!', 'success');
    } catch (err) {
      showToast?.('Lỗi khi lưu thông tin quán: ' + (err.message || 'Thử lại sau'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="store-info-config-subpage"
      className="space-y-4 animate-slideInRight text-xs pb-24 max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
        <button
          type="button"
          onClick={handleBackClick}
          className="touch-target p-2 rounded-2xl bg-white border border-gray-200/80 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
          title="Quay lại Settings Hub"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <Store className="w-4 h-4 text-[#059669]" />
            <h2 className="text-base font-black text-forest-950 tracking-tight leading-none">
              Thông tin Quán
            </h2>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Cấu hình tên thương hiệu, chi nhánh, địa chỉ và thông tin liên hệ
          </p>
        </div>
      </div>

      {/* Main Form Fields */}
      <form onSubmit={handleSave} className="space-y-3.5">
        <div className="clay-card p-4 sm:p-5 rounded-[24px] bg-white border border-white/95 shadow-xs space-y-3.5">
          {/* Tên Quán */}
          <div>
            <label className="block text-gray-800 font-bold mb-1">
              Tên Quán (Thương hiệu in trên bill) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="VD: GÓC - PHÊ & TRÀ"
              className="clay-input w-full h-11 px-3.5 bg-gray-50/80 border border-gray-200/80 rounded-2xl focus:bg-white focus:outline-none focus:border-[#214E34] font-bold text-forest-950 text-sm"
            />
          </div>

          {/* Chi nhánh */}
          <div>
            <label className="block text-gray-800 font-bold mb-1">
              Tên Chi nhánh <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="VD: Chi nhánh 01 - Trụ sở chính"
              className="clay-input w-full h-11 px-3.5 bg-gray-50/80 border border-gray-200/80 rounded-2xl focus:bg-white focus:outline-none focus:border-[#214E34] text-xs font-semibold"
            />
          </div>

          {/* Địa chỉ */}
          <div>
            <label className="block text-gray-800 font-bold mb-1">
              Địa chỉ Cửa hàng <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={branchAddress}
              onChange={(e) => setBranchAddress(e.target.value)}
              placeholder="Số nhà, đường, phường, quận/huyện, tỉnh/thành"
              className="clay-input w-full h-11 px-3.5 bg-gray-50/80 border border-gray-200/80 rounded-2xl focus:bg-white focus:outline-none focus:border-[#214E34] text-xs"
            />
          </div>

          {/* Hotline & Thu ngân Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-800 font-bold mb-1">
                Số Hotline <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={hotline}
                onChange={(e) => setHotline(e.target.value)}
                placeholder="VD: 1900 88 99 22"
                className="clay-input w-full h-11 px-3.5 bg-gray-50/80 border border-gray-200/80 rounded-2xl focus:bg-white focus:outline-none focus:border-[#214E34] font-mono font-bold text-xs"
              />
            </div>

            <div>
              <label className="block text-gray-800 font-bold mb-1">
                Thu ngân mặc định
              </label>
              <input
                type="text"
                value={cashier}
                onChange={(e) => setCashier(e.target.value)}
                placeholder="Tên thu ngân ca hiện tại"
                className="clay-input w-full h-11 px-3.5 bg-gray-50/80 border border-gray-200/80 rounded-2xl focus:bg-white focus:outline-none focus:border-[#214E34] text-xs font-medium"
              />
            </div>
          </div>
        </div>

        {/* Sticky Footer Save Button */}
        <div className="sticky bottom-4 z-20 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="touch-target btn-press w-full py-3.5 bg-[#214E34] hover:bg-[#183926] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 text-sm cursor-pointer transition-all active:scale-[0.98]"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Đang lưu thông tin quán...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Lưu cấu hình Thông tin quán</span>
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
