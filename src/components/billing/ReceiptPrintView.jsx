import React, { useState, useEffect } from 'react';
import { usePos } from '../../store/PosContext';
import { formatVND } from '../../utils/currency';
import {
  Printer,
  X,
  Bluetooth,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react';
import {
  isBluetoothSupported,
  connectBluetoothPrinter,
  getBluetoothPrinterStatus,
  printReceipt57mm
} from '../../utils/bluetoothPrinter';
import { triggerHaptic } from '../../utils/haptics';

export default function ReceiptPrintView({ isOpen, onClose, order, isPrePrint = false }) {
  const { settings, showToast } = usePos();
  const [btStatus, setBtStatus] = useState({ isSupported: false, isConnected: false, deviceName: null });
  const [isPrintingBt, setIsPrintingBt] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBtStatus(getBluetoothPrinterStatus());
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const handleBrowserPrint = () => {
    triggerHaptic('light');
    window.print();
  };

  const handleBluetoothPrint = async () => {
    triggerHaptic('medium');
    setIsPrintingBt(true);

    try {
      if (!isBluetoothSupported()) {
        showToast?.('Trình duyệt không hỗ trợ Web Bluetooth. Đang chuyển sang in trình duyệt!', 'info');
        window.print();
        return;
      }

      // If not connected, initiate connection dialog first
      if (!btStatus.isConnected) {
        showToast?.('Vui lòng chọn máy in Bluetooth từ danh sách...', 'info');
        const res = await connectBluetoothPrinter();
        setBtStatus(getBluetoothPrinterStatus());
        showToast?.(`Đã kết nối máy in: ${res.deviceName}`, 'success');
      }

      // Print order
      await printReceipt57mm(
        { ...order, isPrePrint },
        settings,
        { useNoAccents: settings.printNoAccents !== false }
      );
      showToast?.('Đã in hóa đơn 57mm qua Bluetooth thành công!', 'success');
    } catch (err) {
      console.warn('Bluetooth print failed:', err);
      showToast?.(err.message || 'Không thể in qua Bluetooth. Thử in trình duyệt!', 'error');
    } finally {
      setIsPrintingBt(false);
      setBtStatus(getBluetoothPrinterStatus());
    }
  };

  const discountAmount = Math.round((order.subtotal || 0) * ((order.discountPercent || 0) / 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      {/* 57mm Receipt Modal Frame */}
      <div className="w-full max-w-[340px] clay-card overflow-hidden flex flex-col max-h-[95vh] border border-gray-100 shadow-2xl">
        {/* Controls Header (Hidden on Print) */}
        <div className="px-3.5 py-3 bg-gradient-to-r from-gray-50 to-gray-100/90 flex items-center justify-between border-b border-gray-200/80 print:hidden shrink-0">
          <div className="flex items-center space-x-1.5 text-xs font-black text-gray-800">
            <Printer className="w-4 h-4 text-forest-800" />
            <span>{isPrePrint ? 'Phiếu Tạm Tính' : 'Hóa Đơn'} (57mm)</span>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Quick BT Print Button */}
            <button
              type="button"
              onClick={handleBluetoothPrint}
              disabled={isPrintingBt}
              className={`px-2.5 py-1.5 text-[11px] font-black rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer ${
                btStatus.isConnected
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-forest-800 hover:bg-forest-900 text-white'
              }`}
              title={btStatus.isConnected ? `In qua ${btStatus.deviceName}` : 'Kết nối & In Bluetooth'}
            >
              {isPrintingBt ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bluetooth className="w-3.5 h-3.5" />
              )}
              <span>{btStatus.isConnected ? 'In BT' : 'Kết nối BT'}</span>
            </button>

            {/* Browser Print Fallback */}
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="p-1.5 rounded-xl clay-inset text-gray-700 hover:text-gray-900 cursor-pointer"
              title="In qua trình duyệt (window.print)"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full clay-inset flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bluetooth Status Sub-Banner */}
        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-[10px] font-bold text-gray-500 print:hidden shrink-0">
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${btStatus.isConnected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {btStatus.isConnected ? btStatus.deviceName : 'Chưa ghép nối máy in Bluetooth'}
          </span>
          <span className="text-gray-400">Khổ K57 (32 cột)</span>
        </div>

        {/* Scrollable Printable Thermal Receipt Container (Standard 57mm Monospaced layout) */}
        <div className="overflow-y-auto p-3 flex justify-center bg-gray-100/50">
          {/* Simulated 57mm Thermal Paper Roll */}
          <div
            id="printable-receipt-57mm"
            className="w-[230px] p-3 bg-white text-gray-900 text-[11px] font-mono leading-tight shadow-md border-x border-gray-200/80 rounded-sm relative select-none"
            style={{
              backgroundImage: 'radial-gradient(#f0f0f0 10%, transparent 10%)',
              backgroundSize: '12px 12px'
            }}
          >
            {/* Top Paper Tear Sawtooth */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-repeat-x bg-[length:6px_4px] bg-gradient-to-r from-transparent" />

            {/* Header */}
            <div className="text-center pb-2.5 border-b border-dashed border-gray-400 space-y-0.5">
              <h2 className="font-extrabold text-sm tracking-tight uppercase text-black font-sans">
                GÓC • Phê & Trà
              </h2>
              <p className="text-[9.5px] text-gray-600 font-sans">{settings.branchAddress || 'Chi nhánh trung tâm'}</p>
              <p className="text-[9.5px] text-gray-600 font-sans">Hotline: {settings.hotline || '0901234567'}</p>
              <p className="text-[9.5px] text-gray-600 font-sans">Wifi: {settings.wifiPassword || 'GocCoffee2026'}</p>

              <div className="mt-1.5 pt-1 border-t border-dashed border-gray-300 font-extrabold text-[10.5px] uppercase tracking-wide">
                {isPrePrint ? '--- PHIẾU TẠM TÍNH ---' : '--- HÓA ĐƠN THANH TOÁN ---'}
              </div>
            </div>

            {/* Metadata (32 columns aligned) */}
            <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Số HD:</span>
                <span className="font-bold">{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Bàn:</span>
                <span className="font-bold">{order.tableName || 'Mang về'}</span>
              </div>
              <div className="flex justify-between">
                <span>Thu ngân:</span>
                <span>{order.cashier || (settings.currentCashier || '').split('(')[0] || 'Thu ngân'}</span>
              </div>
              <div className="flex justify-between">
                <span>Thời gian:</span>
                <span>{new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
              </div>
            </div>

            {/* 3-Column Items Table (16 - 4 - 12) */}
            <div className="py-2 border-b border-dashed border-gray-400">
              <div className="flex justify-between font-black text-[10px] pb-1 border-b border-gray-300 mb-1">
                <span className="w-[110px] text-left truncate">Tên món</span>
                <span className="w-[28px] text-center">SL</span>
                <span className="flex-1 text-right">T.Tiền</span>
              </div>

              <div className="space-y-1">
                {(order.items || []).map((it, idx) => (
                  <div key={idx} className="text-[10px]">
                    <div className="flex justify-between items-baseline">
                      <span className="w-[110px] font-bold text-gray-900 truncate">
                        {it.name}{it.size ? ` (${it.size})` : ''}
                      </span>
                      <span className="w-[28px] text-center font-bold">{it.quantity}</span>
                      <span className="flex-1 text-right font-black font-mono">
                        {formatVND(it.lineTotal || (it.price || 0) * it.quantity)}
                      </span>
                    </div>
                    {it.toppings && it.toppings.length > 0 && (
                      <div className="text-[9px] text-gray-500 pl-1.5">
                        + {it.toppings.map((tp) => tp.name).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Tiền hàng:</span>
                <span className="font-mono">{formatVND(order.subtotal || order.total || 0)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>Giảm giá ({order.discountPercent}%):</span>
                  <span className="font-mono">-{formatVND(discountAmount)}</span>
                </div>
              )}

              {order.surcharge > 0 && (
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>Phụ phí:</span>
                  <span className="font-mono">+{formatVND(order.surcharge)}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-400 font-black text-xs text-black">
                <span>TỔNG CỘNG:</span>
                <span className="text-sm font-mono">{formatVND(order.total || 0)}</span>
              </div>

              <div className="flex justify-between text-[9.5px] text-gray-500 pt-0.5">
                <span>Hình thức:</span>
                <span className="font-bold">
                  {order.paymentMethod === 'vietqr' ? 'Chuyển khoản VietQR' : 'Tiền mặt'}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-2.5 text-[9px] text-gray-500 font-sans space-y-0.5">
              <p className="font-bold text-gray-800">CẢM ƠN QUÝ KHÁCH & HẸN GẶP LẠI!</p>
              <p>Khởi tạo từ GÓC POS • Khổ giấy 57mm</p>
            </div>
          </div>
        </div>

        {/* Bottom Quick Action */}
        <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between gap-2 print:hidden shrink-0">
          <button
            type="button"
            onClick={handleBluetoothPrint}
            disabled={isPrintingBt}
            className="flex-1 py-2.5 px-3 rounded-xl clay-btn-primary text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
          >
            {isPrintingBt ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bluetooth className="w-4 h-4" />
            )}
            <span>{btStatus.isConnected ? 'In Bluetooth Ngay (0.3s)' : 'Ghép Nối & In Bluetooth'}</span>
          </button>
        </div>
      </div>

      {/* Embedded CSS for 57mm Browser Printing Fallback */}
      <style>{`
        @media print {
          @page {
            size: 58mm auto;
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-receipt-57mm, #printable-receipt-57mm * {
            visibility: visible !important;
          }
          #printable-receipt-57mm {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 57mm !important;
            max-width: 57mm !important;
            margin: 0 !important;
            padding: 2mm 3mm !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
