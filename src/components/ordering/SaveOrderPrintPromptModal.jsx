import React, { useState } from 'react';
import { Printer, X, Check, ChefHat, Loader2 } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export default function SaveOrderPrintPromptModal({
  isOpen,
  tableName = '',
  itemCount = 0,
  onConfirmPrint,
  onDismiss
}) {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const handlePrint = async () => {
    triggerHaptic('medium');
    setIsPrinting(true);
    try {
      if (onConfirmPrint) {
        await onConfirmPrint();
      }
    } catch (err) {
      console.warn('Lỗi khi in phiếu chế biến:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleClose = () => {
    triggerHaptic('light');
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
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
            <div className="mt-3 py-2 px-3 bg-amber-50/80 border border-amber-200/60 rounded-xl inline-flex items-center gap-2 text-xs font-bold text-amber-900">
              {tableName && <span>Bàn: <strong className="font-black text-forest-950">{tableName}</strong></span>}
              {tableName && itemCount > 0 && <span className="text-amber-300">•</span>}
              {itemCount > 0 && <span>{itemCount} món cần chế biến</span>}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-5 pt-2 bg-gray-50/60 border-t border-gray-100 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="w-full min-h-[46px] py-3 px-4 rounded-2xl bg-forest-900 hover:bg-forest-950 active:scale-[0.98] text-white font-extrabold text-sm shadow-md shadow-forest-900/15 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
          >
            {isPrinting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang gửi lệnh in...</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 text-emerald-300" />
                <span>Có, in phiếu</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleClose}
            disabled={isPrinting}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl bg-white hover:bg-gray-100 active:scale-[0.98] text-gray-700 hover:text-gray-900 font-bold text-sm border border-gray-200/90 shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Thoát</span>
          </button>
        </div>
      </div>
    </div>
  );
}
