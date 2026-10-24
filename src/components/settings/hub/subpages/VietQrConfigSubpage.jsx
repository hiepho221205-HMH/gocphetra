import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  CreditCard,
  QrCode,
  Check,
  Building,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { triggerHaptic } from '../../../../utils/haptics';
import { generateVietQRUrl, POPULAR_BANKS } from '../../../../utils/vietqr';
import UnsavedChangesModal from '../UnsavedChangesModal';

/**
 * VietQrConfigSubpage - Subpage 5: Thanh toán & VietQR
 * Quản lý tài khoản ngân hàng nhận tiền chuyển khoản và tạo mã QR động.
 * Lưu độc lập, có preview trực tiếp mã VietQR sinh ra.
 */
export default function VietQrConfigSubpage({
  settings,
  updateSettings,
  showToast,
  onBack
}) {
  const currentBank = settings?.bankAccount || {};
  const [bankCode, setBankCode] = useState(currentBank.bankCode || 'MB');
  const [accountNo, setAccountNo] = useState(currentBank.accountNo || '0988776655');
  const [accountHolder, setAccountHolder] = useState(currentBank.accountHolder || 'QUAN CA PHE GOC');
  const [enableVietQR, setEnableVietQR] = useState(settings?.enableVietQR !== false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Baseline dirty check
  const initialRef = useRef({
    bankCode: currentBank.bankCode || 'MB',
    accountNo: currentBank.accountNo || '0988776655',
    accountHolder: currentBank.accountHolder || 'QUAN CA PHE GOC',
    enableVietQR: settings?.enableVietQR !== false
  });

  const isDirty =
    bankCode !== initialRef.current.bankCode ||
    accountNo !== initialRef.current.accountNo ||
    accountHolder !== initialRef.current.accountHolder ||
    enableVietQR !== initialRef.current.enableVietQR;

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

  const handleSave = async (e) => {
    e.preventDefault();
    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      const selectedBankObj = POPULAR_BANKS.find((b) => b.code === bankCode);
      const bankName = selectedBankObj ? selectedBankObj.name : bankCode;

      await updateSettings?.({
        enableVietQR,
        vietqrEnabled: enableVietQR,
        bankAccount: {
          ...settings?.bankAccount,
          bankCode,
          bankName,
          accountNo: accountNo.trim(),
          accountHolder: accountHolder.trim().toUpperCase()
        }
      });

      initialRef.current = {
        bankCode,
        accountNo: accountNo.trim(),
        accountHolder: accountHolder.trim().toUpperCase(),
        enableVietQR
      };

      showToast?.('Đã lưu cấu hình VietQR thành công!', 'success');
    } catch (err) {
      showToast?.('Lỗi khi lưu cấu hình VietQR: ' + (err.message || 'Thử lại sau'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate demo QR url for live preview
  const previewQrUrl = generateVietQRUrl({
    bankCode,
    accountNo: accountNo || '0988776655',
    accountName: accountHolder || 'QUAN CA PHE GOC',
    amount: 55000,
    description: 'GOC TEST 55K'
  });

  return (
    <div
      data-testid="vietqr-config-subpage"
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
            <CreditCard className="w-4 h-4 text-[#0D9488]" />
            <h2 className="text-base font-black text-forest-950 tracking-tight leading-none">
              Tài khoản & VietQR
            </h2>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">
            Cấu hình ngân hàng, tài khoản nhận chuyển khoản và mã QR động
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-3.5">
        {/* Form Fields Card */}
        <div className="clay-card p-4 sm:p-5 rounded-[24px] bg-white border border-white/95 shadow-xs space-y-3.5">
          {/* Ngân hàng Dropdown */}
          <div>
            <label className="block text-gray-800 font-bold mb-1">
              Ngân hàng thụ hưởng <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="clay-input w-full h-11 px-3.5 pr-10 bg-gray-50/80 border border-gray-200/80 rounded-2xl focus:bg-white focus:outline-none focus:border-[#214E34] font-bold text-forest-950 text-xs appearance-none cursor-pointer"
              >
                {POPULAR_BANKS.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.code} - {bank.name}
                  </option>
                ))}
              </select>
              <Building className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Số tài khoản */}
          <div>
            <label className="block text-gray-800 font-bold mb-1">
              Số tài khoản ngân hàng <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
              placeholder="VD: 0988776655"
              className="clay-input w-full h-11 px-3.5 bg-gray-50/80 border border-gray-200/80 rounded-2xl focus:bg-white focus:outline-none focus:border-[#214E34] font-mono font-extrabold text-forest-950 text-sm tracking-wide"
            />
          </div>

          {/* Chủ tài khoản */}
          <div>
            <label className="block text-gray-800 font-bold mb-1">
              Tên chủ tài khoản <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
              placeholder="VD: QUAN CA PHE GOC"
              className="clay-input w-full h-11 px-3.5 bg-gray-50/80 border border-gray-200/80 rounded-2xl focus:bg-white focus:outline-none focus:border-[#214E34] font-bold uppercase text-xs"
            />
          </div>

          {/* Toggle Enable VietQR */}
          <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 text-xs">
                Kích hoạt thanh toán VietQR động trong POS
              </span>
              <input
                type="checkbox"
                checked={enableVietQR}
                onChange={(e) => setEnableVietQR(e.target.checked)}
                className="w-4 h-4 accent-[#214E34] rounded cursor-pointer"
              />
            </div>
            <p className="text-[10.5px] text-emerald-800/90 leading-tight">
              Mã VietQR động tự sinh theo số tiền từng đơn hàng trên màn hình thanh toán. Hóa đơn bill in ra sẽ ghi rõ phương thức thanh toán và không in QR để tránh khách chuyển trùng.
            </p>
          </div>
        </div>

        {/* Live VietQR Preview Card */}
        <div className="clay-card p-4 sm:p-5 rounded-[24px] bg-white border border-white/95 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-[#0D9488]" />
              <span>Xem trước Mã VietQR mẫu</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              NAPAS 247
            </span>
          </div>

          <div className="bg-gray-50/90 p-4 rounded-2xl border border-gray-200/80 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-32 h-32 bg-white rounded-xl border border-gray-200 p-1 flex items-center justify-center shrink-0 shadow-inner">
              <img
                src={previewQrUrl}
                alt="VietQR Preview"
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>

            <div className="flex-1 space-y-1.5 text-center sm:text-left text-xs">
              <div className="font-extrabold text-forest-950 text-sm">
                {bankCode} - {accountNo || '0988776655'}
              </div>
              <div className="font-bold text-gray-600 uppercase text-[11px]">
                {accountHolder || 'QUAN CA PHE GOC'}
              </div>
              <p className="text-[10.5px] text-gray-500 leading-tight pt-1">
                Khách hàng quét mã bằng ứng dụng ngân hàng bất kỳ để chuyển khoản tự động kèm nội dung đơn hàng.
              </p>
            </div>
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
                <span>Đang lưu cấu hình VietQR...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Lưu cấu hình VietQR</span>
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
