import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import VietQRPaymentModal from './VietQRPaymentModal';
import MergeTablesModal from './MergeTablesModal';
import ReceiptPrintView from './ReceiptPrintView';
import {
  X,
  Receipt,
  Printer,
  GitMerge,
  Banknote,
  QrCode,
  Percent,
  PlusCircle,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { triggerHaptic } from '../../utils/haptics';

export default function BillCheckoutModal({ isOpen, onClose, table, onGoBackToOrder, onPaymentSuccess }) {
  const { orders, updateBillAdjustments, fullCheckout, requestBillForTable } = usePos();

  const [discountPercent, setDiscountPercent] = useState(0);
  const [surcharge, setSurcharge] = useState(0);

  // Sub-modals
  const [showQRModal, setShowQRModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isPrePrint, setIsPrePrint] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  if (!isOpen || !table) return null;

  // Resilient order lookup: check table.activeOrderId first, then search orders by tableId
  const order =
    (table.activeOrderId && orders[table.activeOrderId]) ||
    Object.values(orders).find(
      (o) => o.tableId === table.id && o.status !== 'completed' && o.status !== 'cancelled'
    ) ||
    null;

  if (!order || !order.items.length) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
        <div className="w-full max-w-sm clay-card p-6 text-center space-y-3">
          <p className="text-sm text-gray-500 font-bold">Bàn này chưa có món nào để lên bill!</p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 clay-btn-primary text-white text-xs font-black cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const subtotal = order.subtotal || 0;
  const currentDiscount = order.discountPercent || 0;
  const currentSurcharge = order.surcharge || 0;
  const discountAmount = Math.round(subtotal * (currentDiscount / 100));
  const total = order.total || 0;

  const handleApplyDiscount = (pct) => {
    triggerHaptic('light');
    setDiscountPercent(pct);
    updateBillAdjustments(table.id, { discountPercent: pct, surcharge: currentSurcharge });
  };

  const handleApplySurcharge = (val) => {
    const num = Number(val) || 0;
    setSurcharge(num);
    updateBillAdjustments(table.id, { discountPercent: currentDiscount, surcharge: num });
  };

  const handleFullCashCheckout = () => {
    if (isCheckingOut) return;
    triggerHaptic('medium');
    if (window.confirm(`Xác nhận thu tiền mặt ${formatVND(total)} cho ${table.name}?`)) {
      setIsCheckingOut(true);
      try {
        const success = fullCheckout(table.id, 'cash');
        if (success) {
          triggerHaptic('success');
          if (onPaymentSuccess) {
            onPaymentSuccess(table);
          } else {
            onClose();
          }
        }
      } finally {
        setIsCheckingOut(false);
      }
    }
  };

  const handleQRSuccess = () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);
    setShowQRModal(false);
    try {
      const success = fullCheckout(table.id, 'vietqr');
      if (success) {
        triggerHaptic('success');
        if (onPaymentSuccess) {
          onPaymentSuccess(table);
        } else {
          onClose();
        }
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-sm clay-card p-0 rounded-b-none sm:rounded-b-[28px] overflow-hidden flex flex-col max-h-[94vh] animate-slideUp">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#214E34] to-[#2E6744] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-emerald-300 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight">Hóa đơn • {table.name}</h3>
              <p className="text-[10.5px] text-emerald-200 font-semibold">Mã đơn: #{order.id}</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                requestBillForTable(table.id);
                setIsPrePrint(true);
                setShowPrintModal(true);
              }}
              title="In tạm tính"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Scrollable Bill Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Action: Thêm món bổ sung */}
          <div className="flex items-center justify-between p-3 rounded-[16px] bg-emerald-50/80 border border-emerald-200/60 shadow-xs">
            <div className="text-[11px] text-[#214E34] font-bold">Khách muốn gọi thêm món?</div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onClose();
                onGoBackToOrder(table);
              }}
              className="touch-target px-3 h-8 clay-pill-btn text-[#214E34] font-black text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Thêm món</span>
            </button>
          </div>

          {/* Items Summary */}
          <div className="space-y-2 border-b border-gray-100 pb-3">
            <div className="flex items-center justify-between font-extrabold text-gray-400 uppercase text-[10px] tracking-wider">
              <span>Món đã gọi ({order.items.length})</span>
              <span>Thành tiền</span>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {order.items.map((it) => (
                <div key={it.cartItemId} className="flex justify-between items-start text-xs">
                  <div>
                    <span className="font-extrabold text-gray-800">{it.name}</span>{' '}
                    <span className="text-[10px] text-gray-400 font-bold">x{it.quantity}</span>
                    {it.toppings && it.toppings.length > 0 && (
                      <div className="text-[10px] text-gray-400 pl-1 font-medium">
                        + {it.toppings.map((tp) => tp.name).join(', ')}
                      </div>
                    )}
                  </div>
                  <span className="font-black text-gray-900">{formatVND(it.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Discounts & Surcharges Section */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
                Chiết khấu / Giảm giá (%)
              </label>
              <div className="clay-inset p-1 grid grid-cols-5 gap-1">
                {[0, 5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleApplyDiscount(pct)}
                    className={`py-1.5 rounded-[12px] text-xs font-black transition-all cursor-pointer ${
                      currentDiscount === pct
                        ? 'bg-[#214E34] text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Surcharge input */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-gray-600 font-bold text-[11px]">Phụ thu / Phí dịch vụ:</span>
              <div className="relative w-32">
                <input
                  type="number"
                  step="1000"
                  placeholder="0"
                  value={currentSurcharge || ''}
                  onChange={(e) => handleApplySurcharge(e.target.value)}
                  className="w-full px-3 py-1.5 text-right text-xs font-black clay-input text-gray-900"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">
                  đ
                </span>
              </div>
            </div>
          </div>

          {/* Price Calculation Card */}
          <div className="clay-inset p-3.5 space-y-1.5">
            <div className="flex justify-between text-gray-500 font-semibold">
              <span>Tạm tính:</span>
              <span>{formatVND(subtotal)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-800 font-bold">
                <span>Giảm giá ({currentDiscount}%):</span>
                <span>-{formatVND(discountAmount)}</span>
              </div>
            )}

            {currentSurcharge > 0 && (
              <div className="flex justify-between text-gray-600 font-bold">
                <span>Phụ thu:</span>
                <span>+{formatVND(currentSurcharge)}</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-2 border-t border-gray-200/60 font-black text-[#214E34]">
              <span className="text-sm">Tổng thanh toán:</span>
              <span className="text-xl tracking-tight">{formatVND(total)}</span>
            </div>
          </div>
        </div>

        {/* Footer Payment Triggers */}
        <div className="p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 space-y-2.5">
          {/* Quick Actions Bar */}
          <div className="grid grid-cols-2 gap-2">
            {/* Merge Tables Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowMergeModal(true);
              }}
              className="touch-target clay-pill-btn py-2 px-3 text-gray-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <GitMerge className="w-4 h-4 text-[#214E34]" />
              <span>Gộp bàn</span>
            </button>

            {/* Print Receipt Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsPrePrint(false);
                setShowPrintModal(true);
              }}
              className="touch-target clay-pill-btn py-2 px-3 text-gray-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-gray-600" />
              <span>In hóa đơn</span>
            </button>
          </div>

          {/* Full Checkout Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {/* Cash Button */}
            <button
              type="button"
              disabled={isCheckingOut}
              onClick={handleFullCashCheckout}
              className="touch-target clay-btn-primary py-3 px-3 text-white font-black text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Banknote className="w-4 h-4" />
              <span>{isCheckingOut ? 'Đang xử lý...' : `Tiền mặt (${formatVND(total)})`}</span>
            </button>

            {/* VietQR Button */}
            <button
              type="button"
              disabled={isCheckingOut}
              onClick={() => {
                triggerHaptic('medium');
                setShowQRModal(true);
              }}
              className="touch-target clay-pill-btn py-3 px-3 text-[#214E34] font-black text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md"
            >
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span>VietQR</span>
            </button>
          </div>
        </div>
      </div>

      {/* VietQR Modal */}
      <VietQRPaymentModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        amount={total}
        orderInfo={order}
        onConfirmPaid={handleQRSuccess}
      />

      {/* Merge Tables Modal */}
      <MergeTablesModal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        destinationTable={table}
      />

      {/* Thermal Receipt Print Modal */}
      <ReceiptPrintView
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        order={order}
        isPrePrint={isPrePrint}
      />
    </div>
  );
}
