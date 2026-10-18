import React from 'react';
import { usePos } from '../../store/PosContext';
import { formatVND } from '../../utils/currency';
import { Printer, X } from 'lucide-react';

export default function ReceiptPrintView({ isOpen, onClose, order, isPrePrint = false }) {
  const { settings } = usePos();

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const discountAmount = Math.round((order.subtotal || 0) * ((order.discountPercent || 0) / 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-float overflow-hidden border border-gray-200 flex flex-col max-h-[95vh]">
        {/* Modal Controls Header (Hidden on print) */}
        <div className="px-4 py-2.5 bg-gray-100 flex items-center justify-between border-b border-gray-200 print:hidden">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-gray-700">
            <Printer className="w-4 h-4 text-forest-800" />
            <span>{isPrePrint ? 'Phiếu Tạm Tính' : 'Hóa Đơn Thanh Toán'}</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={handlePrint}
              className="px-2.5 py-1 text-xs font-bold bg-forest-800 text-white rounded-lg hover:bg-forest-900 transition-colors"
            >
              In ngay
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt (80mm width standard) */}
        <div id="printable-receipt" className="p-4 overflow-y-auto text-xs font-mono text-gray-800 leading-relaxed bg-white">
          {/* Header */}
          <div className="text-center pb-3 border-b border-dashed border-gray-300">
            <h2 className="font-extrabold text-base tracking-tight uppercase text-black font-sans">
              GÓC • Phê & Trà
            </h2>
            <p className="text-[10px] text-gray-500 font-sans mt-0.5">{settings.branchAddress}</p>
            <p className="text-[10px] text-gray-500 font-sans">Hotline: {settings.hotline}</p>
            <p className="text-[10px] text-gray-500 font-sans">Wifi: {settings.wifiPassword}</p>

            <div className="mt-2 text-xs font-bold uppercase tracking-wider font-sans">
              {isPrePrint ? '--- PHIẾU TẠM TÍNH ---' : '--- HÓA ĐƠN THANH TOÁN ---'}
            </div>
          </div>

          {/* Metadata */}
          <div className="py-2.5 border-b border-dashed border-gray-300 text-[11px] space-y-0.5">
            <div className="flex justify-between">
              <span>Số hóa đơn:</span>
              <span className="font-bold">{order.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Bàn:</span>
              <span className="font-bold">{order.tableName}</span>
            </div>
            <div className="flex justify-between">
              <span>Thu ngân:</span>
              <span>{order.cashier || settings.currentCashier.split('(')[0]}</span>
            </div>
            <div className="flex justify-between">
              <span>Thời gian:</span>
              <span>{new Date().toLocaleString('vi-VN')}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-2.5 border-b border-dashed border-gray-300">
            <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-gray-200 mb-1.5">
              <span className="w-1/2">Tên món</span>
              <span className="w-1/6 text-center">SL</span>
              <span className="w-1/3 text-right">T.Tiền</span>
            </div>

            <div className="space-y-1.5">
              {order.items.map((it, idx) => (
                <div key={idx} className="text-[11px]">
                  <div className="flex justify-between">
                    <span className="w-1/2 font-semibold truncate">{it.name} ({it.size})</span>
                    <span className="w-1/6 text-center">{it.quantity}</span>
                    <span className="w-1/3 text-right font-bold">{formatVND(it.lineTotal)}</span>
                  </div>
                  {it.toppings && it.toppings.length > 0 && (
                    <div className="text-[10px] text-gray-500 pl-2">
                      + {it.toppings.map((tp) => tp.name).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="py-2.5 border-b border-dashed border-gray-300 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span>Tạm tính:</span>
              <span>{formatVND(order.subtotal)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Giảm giá ({order.discountPercent}%):</span>
                <span>-{formatVND(discountAmount)}</span>
              </div>
            )}

            {order.surcharge > 0 && (
              <div className="flex justify-between">
                <span>Phụ thu / Thuế:</span>
                <span>+{formatVND(order.surcharge)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-extrabold text-black pt-1 border-t border-gray-200">
              <span>TỔNG CỘNG:</span>
              <span>{formatVND(order.total)}</span>
            </div>

            {order.paidAmount > 0 && (
              <div className="flex justify-between font-semibold pt-0.5">
                <span>Đã thanh toán:</span>
                <span>{formatVND(order.paidAmount)}</span>
              </div>
            )}

            {order.remainingAmount > 0 && (
              <div className="flex justify-between font-bold text-rose-700">
                <span>Còn nợ lại:</span>
                <span>{formatVND(order.remainingAmount)}</span>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="text-center pt-3 text-[10px] text-gray-500 font-sans space-y-0.5">
            <p className="font-semibold text-gray-700">CẢM ƠN QUÝ KHÁCH VÀ HẸN GẶP LẠI!</p>
            <p>Hóa đơn điện tử khởi tạo từ hệ thống GÓC POS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
