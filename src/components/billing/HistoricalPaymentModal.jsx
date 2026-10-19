import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePos } from '../../store/PosContext';
import {
  X,
  Banknote,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Coffee,
  Receipt,
  Loader2
} from 'lucide-react';
import { formatVND } from '../../utils/currency';
import {
  getVietnamTodayString,
  getVietnamDateString,
  formatVietnamDisplayDate,
  formatShortDate
} from '../../utils/dateTime';

export default function HistoricalPaymentModal({
  isOpen,
  onClose,
  order,
  onSuccess
}) {
  const { processHistoricalPayment, settings } = usePos();
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'vietqr'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const todayStr = getVietnamTodayString();
  const originalDate = order?.businessDate || (order?.createdAt ? getVietnamDateString(order.createdAt) : '');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('cash');
      setIsSubmitting(false);
      setErrorMsg('');
    }
  }, [isOpen, order]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !order) return null;

  const totalAmount = Number(order.remainingAmount) > 0 ? Number(order.remainingAmount) : Number(order.total) || 0;
  const items = order.items || [];
  const cashierName = (settings?.currentCashier || 'Thu ngân').split('(')[0].trim();

  const handleConfirmPayment = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const idempotencyKey = `HIST_PAY_${order.id}_${Date.now()}`;
      const result = await processHistoricalPayment({
        orderId: order.id,
        paymentMethod,
        amount: totalAmount,
        cashier: cashierName,
        idempotencyKey
      });

      if (result && result.success) {
        if (onSuccess) {
          onSuccess(result.order);
        }
        onClose();
      } else {
        setErrorMsg(result?.error || 'Có lỗi khi ghi nhận thanh toán. Vui lòng thử lại!');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Lỗi thu tiền đơn cũ:', err);
      setErrorMsg('Lỗi hệ thống: ' + (err.message || err));
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hist-payment-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp">
        {/* ================= HEADER ================= */}
        <div className="px-4 py-3 bg-[#214E34] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-400/30">
              <Banknote className="w-4 h-4" />
            </div>
            <div>
              <h3 id="hist-payment-title" className="font-black text-sm text-white leading-tight">
                Thu tiền đơn ngày cũ
              </h3>
              <p className="text-[11px] text-emerald-200/90 font-medium">
                {order.tableName} • Ngày {formatShortDate(originalDate)}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================= BODY ================= */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-stone-800">
          {/* Isolation & Cash-basis attribution Notice */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-[11.5px] leading-relaxed">
              <p className="font-bold text-amber-950">
                Ghi nhận doanh thu vào hôm nay ({formatShortDate(todayStr)})
              </p>
              <p className="text-amber-800">
                Đơn hàng phát sinh từ ngày cũ. Sau khi thu tiền, dòng tiền sẽ tính vào ca hiện tại và <b>hoàn toàn không làm ảnh hưởng</b> đến bàn trên sơ đồ ngày hôm nay.
              </p>
            </div>
          </div>

          {/* Order Details Preview */}
          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-stone-200">
              <span className="font-mono font-bold text-stone-500">#{order.id}</span>
              <span className="font-semibold text-stone-600 flex items-center gap-1 text-[11px]">
                <Clock className="w-3 h-3 text-stone-400" />
                {order.createdAt ? new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>

            {/* Item list */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex-1 truncate pr-2">
                    <span className="font-bold text-stone-800">{it.name}</span>
                    <span className="text-[11px] text-stone-500 ml-1">x{it.quantity}</span>
                    {it.sizeName && <span className="text-[10px] text-emerald-800 ml-1">({it.sizeName})</span>}
                  </div>
                  <span className="font-semibold text-stone-700 shrink-0">
                    {formatVND(it.lineTotal || (it.unitPrice * it.quantity))}
                  </span>
                </div>
              ))}
            </div>

            {/* Total Row */}
            <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">Tổng tiền cần thu:</span>
              <span className="text-base font-black text-[#214E34]">
                {formatVND(totalAmount)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Hình thức thanh toán:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setPaymentMethod('cash')}
                className={`min-h-[46px] p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-xs ring-1 ring-amber-400'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Banknote className={`w-4 h-4 ${paymentMethod === 'cash' ? 'text-amber-600' : 'text-stone-400'}`} />
                <span>Tiền mặt</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setPaymentMethod('vietqr')}
                className={`min-h-[46px] p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  paymentMethod === 'vietqr'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs ring-1 ring-emerald-400'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <QrCode className={`w-4 h-4 ${paymentMethod === 'vietqr' ? 'text-emerald-600' : 'text-stone-400'}`} />
                <span>Chuyển khoản VietQR</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* ================= FOOTER ================= */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 active:scale-97 transition-colors disabled:opacity-50"
          >
            Đóng
          </button>

          <button
            type="button"
            disabled={isSubmitting || totalAmount <= 0}
            onClick={handleConfirmPayment}
            className="flex-2 min-h-[44px] px-4 py-2 rounded-xl text-xs font-black text-white bg-[#009E78] hover:bg-[#008666] active:scale-97 shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Đang xử lý thu tiền...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Xác nhận thu {formatVND(totalAmount)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
