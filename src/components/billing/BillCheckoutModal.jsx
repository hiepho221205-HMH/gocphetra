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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="w-full max-w-sm bg-white rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm text-gray-500 font-medium">Bàn này chưa có món nào để lên bill!</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-forest-800 text-white rounded-xl text-xs font-semibold"
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
    if (window.confirm(`Xác nhận thu tiền mặt ${formatVND(total)} cho ${table.name}?`)) {
      setIsCheckingOut(true);
      try {
        const success = fullCheckout(table.id, 'cash');
        if (success) {
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-float overflow-hidden flex flex-col max-h-[94vh] animate-slideUp">
        {/* Header */}
        <div className="px-4 py-3 bg-forest-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="font-extrabold text-sm tracking-tight">Hóa đơn • {table.name}</h3>
              <p className="text-[10.5px] text-emerald-200">Mã đơn: {order.id}</p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                requestBillForTable(table.id);
                setIsPrePrint(true);
                setShowPrintModal(true);
              }}
              title="In tạm tính"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Bill Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Action: Thêm món bổ sung */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-forest-50 border border-forest-200/60">
            <div className="text-[11px] text-forest-900 font-medium">Khách muốn gọi thêm món?</div>
            <button
              onClick={() => {
                onClose();
                onGoBackToOrder(table);
              }}
              className="touch-target px-2.5 h-7 bg-white text-forest-800 font-bold text-xs rounded-lg border border-forest-300 hover:bg-forest-100 flex items-center gap-1 shadow-2xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Thêm món</span>
            </button>
          </div>

          {/* Items Summary */}
          <div className="space-y-2 border-b border-gray-100 pb-3">
            <div className="flex items-center justify-between font-bold text-gray-500 uppercase text-[10px] tracking-wider">
              <span>Món đã gọi ({order.items.length})</span>
              <span>Thành tiền</span>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {order.items.map((it) => (
                <div key={it.cartItemId} className="flex justify-between items-start text-xs">
                  <div>
                    <span className="font-semibold text-gray-800">{it.name}</span>{' '}
                    <span className="text-[10px] text-gray-400 font-bold">x{it.quantity}</span>
                    {it.toppings && it.toppings.length > 0 && (
                      <div className="text-[10px] text-gray-400 pl-1">
                        + {it.toppings.map((tp) => tp.name).join(', ')}
                      </div>
                    )}
                  </div>
                  <span className="font-bold text-gray-900">{formatVND(it.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Discounts & Surcharges Section */}
          <div className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Chiết khấu / Giảm giá (%)
              </label>
              <div className="grid grid-cols-5 gap-1">
                {[0, 5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleApplyDiscount(pct)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      currentDiscount === pct
                        ? 'bg-forest-800 text-white border-forest-800 shadow-2xs'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Surcharge input */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-gray-600 font-medium text-[11px]">Phụ thu / Phí dịch vụ:</span>
              <div className="relative w-28">
                <input
                  type="number"
                  step="1000"
                  placeholder="0"
                  value={currentSurcharge || ''}
                  onChange={(e) => handleApplySurcharge(e.target.value)}
                  className="w-full px-2 py-1 text-right text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-forest-800"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                  đ
                </span>
              </div>
            </div>
          </div>

          {/* Price Calculation Card */}
          <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-1.5">
            <div className="flex justify-between text-gray-500">
              <span>Tạm tính:</span>
              <span>{formatVND(subtotal)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Giảm giá ({currentDiscount}%):</span>
                <span>-{formatVND(discountAmount)}</span>
              </div>
            )}

            {currentSurcharge > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Phụ thu:</span>
                <span>+{formatVND(currentSurcharge)}</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-2 border-t border-gray-200 font-extrabold text-forest-900">
              <span className="text-sm">Tổng thanh toán:</span>
              <span className="text-xl tracking-tight text-forest-900">{formatVND(total)}</span>
            </div>
          </div>
        </div>

        {/* Footer Payment Triggers */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-100 space-y-2">
          {/* Quick Actions Bar */}
          <div className="grid grid-cols-2 gap-2">
            {/* Merge Tables Button */}
            <button
              type="button"
              onClick={() => setShowMergeModal(true)}
              className="touch-target btn-press py-2 px-3 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <GitMerge className="w-4 h-4 text-forest-700" />
              <span>Gộp bàn</span>
            </button>

            {/* Print Receipt Button */}
            <button
              type="button"
              onClick={() => {
                setIsPrePrint(false);
                setShowPrintModal(true);
              }}
              className="touch-target btn-press py-2 px-3 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
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
              className="touch-target btn-press py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <Banknote className="w-4 h-4" />
              <span>{isCheckingOut ? 'Đang xử lý...' : `Tiền mặt (${formatVND(total)})`}</span>
            </button>

            {/* VietQR Button */}
            <button
              type="button"
              disabled={isCheckingOut}
              onClick={() => setShowQRModal(true)}
              className="touch-target btn-press py-2.5 px-3 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <QrCode className="w-4 h-4 text-emerald-300" />
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
