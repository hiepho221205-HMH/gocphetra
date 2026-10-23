import React, { useState } from 'react';
import { Banknote, AlertTriangle, X, Loader2, CheckCircle2 } from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { formatShortDate } from '../../utils/dateTime';
import { triggerHaptic } from '../../utils/haptics';

export default function BatchHistoricalPaymentModal({
  isOpen,
  onClose,
  date,
  orders = [],
  onConfirm
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const totalAmount = (orders || []).reduce(
    (sum, o) => sum + (Number(o.remainingAmount) || Number(o.total) || 0),
    0
  );

  const handleConfirm = async () => {
    if (isSubmitting) return;
    triggerHaptic('medium');
    setIsSubmitting(true);
    try {
      if (onConfirm) {
        await onConfirm();
      }
    } catch (err) {
      console.warn('Lỗi khi thực hiện thanh toán hàng loạt:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    triggerHaptic('light');
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-payment-title"
      >
        {/* Header Icon & Title */}
        <div className="pt-6 pb-3 px-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-xs">
            <Banknote className="w-7 h-7 text-red-600" />
          </div>

          <h3
            id="batch-payment-title"
            className="text-base font-black text-gray-900 leading-snug tracking-tight"
          >
            Xác nhận thanh toán tất cả
          </h3>

          <p className="mt-1 text-xs text-gray-600 font-medium">
            Bạn có chắc muốn thanh toán toàn bộ đơn chưa thu tiền của ngày{' '}
            <strong className="text-gray-900 font-bold">{formatShortDate(date)}</strong> không?
          </p>
        </div>

        {/* Summary Card */}
        <div className="px-6 pb-4 space-y-2.5">
          <div className="p-3 bg-red-50/70 border border-red-200/80 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center justify-between text-gray-700 font-semibold">
              <span>Số lượng đơn:</span>
              <span className="font-extrabold text-gray-900 text-sm">
                {orders.length} đơn
              </span>
            </div>

            <div className="flex items-center justify-between text-gray-700 font-semibold border-t border-red-100 pt-1.5">
              <span>Tổng số tiền cần thu:</span>
              <span className="font-black text-red-600 text-base">
                {formatVND(totalAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between text-gray-700 font-semibold border-t border-red-100 pt-1.5">
              <span>Hình thức thanh toán:</span>
              <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px]">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Tiền mặt (Cash)</span>
              </span>
            </div>
          </div>

          {/* Operational Safety Notice */}
          <div className="p-2.5 bg-amber-50/80 border border-amber-200/70 rounded-xl flex items-start gap-2 text-[10.5px] text-amber-900 leading-tight">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Thao tác sẽ thu tiền hàng loạt cho <b>{orders.length} đơn</b> và ghi nhận doanh thu vào ca làm việc hiện tại.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-5 pt-2 bg-gray-50/70 border-t border-gray-100 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full min-h-[46px] py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-extrabold text-sm shadow-md shadow-red-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý thu tiền...</span>
              </>
            ) : (
              <>
                <Banknote className="w-4 h-4 text-red-200" />
                <span>Xác nhận thanh toán ({formatVND(totalAmount)})</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl bg-white hover:bg-gray-100 active:scale-[0.98] text-gray-700 hover:text-gray-900 font-bold text-sm border border-gray-200 shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Hủy</span>
          </button>
        </div>
      </div>
    </div>
  );
}
