import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Bluetooth, ChefHat, Loader2, Receipt } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { getBluetoothPrinterStatus, isBluetoothSupported } from '../../utils/bluetoothPrinter';

export default function SaveOrderPrintPromptModal({
  isOpen,
  tableName = '',
  itemCount = 0,
  totalItemCount = 0,
  isAdditional = false,
  onConfirmPrint,
  onDismiss
}) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingScope, setPrintingScope] = useState('new'); // 'new' | 'all'
  const [btStatus, setBtStatus] = useState(() => getBluetoothPrinterStatus());

  useEffect(() => {
    if (isOpen) {
      setBtStatus(getBluetoothPrinterStatus());
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handlePrint = async (method = 'bluetooth', scope = 'new') => {
    triggerHaptic('medium');
    setIsPrinting(true);
    setPrintingScope(scope);
    try {
      if (onConfirmPrint) {
        await onConfirmPrint({ method, scope });
      }
    } catch (err) {
      console.warn('Lỗi khi in phiếu chế biến:', err);
    } finally {
      setIsPrinting(false);
      setBtStatus(getBluetoothPrinterStatus());
    }
  };

  const handleClose = () => {
    triggerHaptic('light');
    if (onDismiss) {
      onDismiss();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-prompt-title"
      >
        {/* Header with decorative badge */}
        <div className="pt-6 pb-4 px-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-forest-50 border border-forest-100/80 flex items-center justify-center text-forest-800 shadow-xs">
            <ChefHat className="w-7 h-7" />
          </div>

          <h3 
            id="print-prompt-title" 
            className="text-base font-extrabold text-gray-900 leading-snug"
          >
            Đơn đã được lưu.
          </h3>
          
          <p className="mt-1 text-sm font-semibold text-gray-700">
            Bạn có muốn in danh sách món cần làm không?
          </p>

          {(tableName || itemCount > 0) && (
            <div className="mt-3 py-2 px-3 bg-amber-50/80 border border-amber-200/60 rounded-xl inline-flex items-center gap-2 text-xs font-bold text-amber-900 flex-wrap justify-center">
              {tableName && <span>Bàn: <strong className="font-black text-forest-950">{tableName}</strong></span>}
              {tableName && itemCount > 0 && <span className="text-amber-300">•</span>}
              {itemCount > 0 && <span>{itemCount} món {isAdditional ? 'mới ' : ''}cần chế biến</span>}
              {isAdditional && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-200/80 text-amber-950 uppercase tracking-tight">
                  Gọi thêm
                </span>
              )}
            </div>
          )}

          {/* Bluetooth Connection Status Badge */}
          {btStatus.isSupported && (
            <div className="mt-2.5 flex justify-center">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                  btStatus.isConnected
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                <Bluetooth className={`w-3.5 h-3.5 ${btStatus.isConnected ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span>
                  {btStatus.isConnected
                    ? `Máy in: ${btStatus.deviceName || 'Đã kết nối'}`
                    : 'Chưa ghép Bluetooth'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-5 pt-2 bg-gray-50/60 border-t border-gray-100 flex flex-col gap-2.5">
          {/* Primary Action: Bluetooth Print & Pair (like bill) */}
          <button
            type="button"
            onClick={() => handlePrint('bluetooth', 'new')}
            disabled={isPrinting}
            className="w-full min-h-[46px] py-3 px-4 rounded-2xl bg-forest-900 hover:bg-forest-950 active:scale-[0.98] text-white font-extrabold text-sm shadow-md shadow-forest-900/15 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
          >
            {isPrinting && printingScope === 'new' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
                <span>{btStatus.isConnected ? 'Đang gửi lệnh in...' : 'Đang kết nối & in...'}</span>
              </>
            ) : btStatus.isSupported ? (
              <>
                <Bluetooth className={`w-4 h-4 ${btStatus.isConnected ? 'text-emerald-400' : 'text-blue-200'}`} />
                <span>
                  {isAdditional
                    ? `Có, in món mới thêm (${itemCount} món)`
                    : btStatus.isConnected
                    ? 'Có, in Bluetooth'
                    : 'Có, ghép & in Bluetooth'}
                </span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 text-emerald-300" />
                <span>{isAdditional ? `Có, in món mới thêm (${itemCount} món)` : 'Có, in phiếu'}</span>
              </>
            )}
          </button>

          {/* Secondary Action: In toàn bộ các món (chỉ hiển thị từ đợt 2 trở đi khi isAdditional = true) */}
          {isAdditional && (
            <button
              type="button"
              onClick={() => handlePrint('bluetooth', 'all')}
              disabled={isPrinting}
              className="w-full min-h-[46px] py-2.5 px-4 rounded-2xl bg-white hover:bg-emerald-50 active:scale-[0.98] text-forest-900 border-2 border-forest-800 font-extrabold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
              title="Kết nối Bluetooth và in toàn bộ tất cả các món đang có trong bàn"
            >
              {isPrinting && printingScope === 'all' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-forest-800" />
                  <span>Đang in toàn bộ các món...</span>
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4 text-forest-800 stroke-[2.2]" />
                  <span>
                    In toàn bộ các món {totalItemCount > 0 ? `(${totalItemCount} món)` : ''}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Optional System Print / PDF Fallback */}
          {btStatus.isSupported && (
            <button
              type="button"
              onClick={() => handlePrint('browser', 'new')}
              disabled={isPrinting}
              className="w-full min-h-[38px] py-2 px-3 rounded-2xl bg-gray-100/90 hover:bg-gray-200 active:scale-[0.98] text-gray-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="In qua hộp thoại máy in trình duyệt hoặc lưu PDF"
            >
              <Printer className="w-3.5 h-3.5 text-gray-500" />
              <span>In qua hệ thống / PDF</span>
            </button>
          )}

          {/* Exit / Dismiss Button */}
          <button
            type="button"
            onClick={handleClose}
            disabled={isPrinting}
            className="w-full min-h-[42px] py-2.5 px-4 rounded-2xl bg-white hover:bg-gray-100 active:scale-[0.98] text-gray-600 hover:text-gray-900 font-bold text-sm border border-gray-200/90 shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <span>Thoát</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
