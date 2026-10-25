import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X, Utensils } from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { triggerHaptic } from '../../utils/haptics';
import { motion, AnimatePresence, useReducedMotion, useMotionTokens } from '../../lib/animateUi';

/**
 * DeleteActiveOrderModal
 * Modal xác nhận xóa đơn và giải phóng bàn.
 * Render qua React Portal trực tiếp ra document.body với z-index cao (z-[9999]),
 * căn giữa màn hình (Centered Dialog) và độc lập hoàn toàn khỏi vùng cuộn hoặc BottomNav.
 */
export default function DeleteActiveOrderModal({
  isOpen,
  onClose,
  table,
  order,
  onConfirm
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { spring, transition } = useMotionTokens();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isDeleting) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen && !table) return null;

  const tableName = table?.name || 'Bàn';
  const tableArea = table?.area || 'Khu vực chính';
  const itemCount = order?.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;
  const totalAmount = order?.total || 0;

  const handleConfirm = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    triggerHaptic('warning');
    try {
      await onConfirm?.();
      onClose();
    } catch (err) {
      console.error('Delete order error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (isDeleting) return;
    triggerHaptic('light');
    onClose();
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && table && (
        <motion.div
          key="delete-order-backdrop"
          data-testid="delete-active-order-modal-backdrop"
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-[3px] flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : transition.fade}
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-order-modal-title"
        >
          <motion.div
            key="delete-order-card"
            data-testid="delete-active-order-modal-container"
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.94, y: 8 }}
            transition={shouldReduceMotion ? { duration: 0 } : spring.dialog}
            className="w-full max-w-sm bg-white rounded-[28px] shadow-2xl p-5 sm:p-6 space-y-4 border border-rose-100/90 my-auto max-h-[calc(100vh-32px)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Header Icon & Title */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-2xs shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600 stroke-[2.2]" />
                </div>
                <div>
                  <h3
                    id="delete-order-modal-title"
                    className="font-black text-sm text-gray-900 tracking-tight"
                  >
                    Xóa đơn của bàn này?
                  </h3>
                  <p className="text-[11px] text-gray-500 font-semibold">
                    Thao tác giải phóng bàn ngay lập tức
                  </p>
                </div>
              </div>
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                transition={spring.press}
                onClick={handleClose}
                disabled={isDeleting}
                data-testid="close-delete-order-modal-btn"
                aria-label="Đóng"
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* 2. Table & Order Target Information Card */}
            <div className="p-3.5 bg-gray-50/90 rounded-2xl border border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-[#214E34]">
                    {tableName}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {tableArea}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-[#214E34]">
                    {formatVND(totalAmount)}
                  </span>
                </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-600 font-semibold pt-1 border-t border-gray-200/60">
            <Utensils className="w-3.5 h-3.5 text-gray-400" />
            <span>Đang phục vụ: <b>{itemCount} món</b></span>
            {order?.id && (
              <span className="text-[11px] text-gray-400 ml-auto font-mono">
                #{order.id.slice(-6)}
              </span>
            )}
          </div>

          {/* Quick list of items preview if available */}
          {Array.isArray(order?.items) && order.items.length > 0 && (
            <div className="max-h-24 overflow-y-auto space-y-1 pt-1 pr-1 text-[11px] text-gray-600 no-scrollbar">
              {order.items.map((it, idx) => (
                <div key={it.id || idx} className="flex justify-between items-center text-[10.5px]">
                  <span className="truncate max-w-[190px]">
                    {it.quantity}x {it.name}
                  </span>
                  <span className="text-gray-500 font-medium shrink-0">
                    {formatVND(it.finalPrice || it.price || 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Warning Notice Box */}
        <div className="space-y-1.5 text-[11px] leading-relaxed text-gray-600 bg-rose-50/70 p-3 rounded-2xl border border-rose-100/90">
          <div className="flex items-center gap-1.5 text-rose-900 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Cảnh báo dữ liệu:</span>
          </div>
          <p className="text-gray-700 text-[11px]">
            Hành động này sẽ xóa toàn bộ món đã order của bàn và giải phóng bàn. Dữ liệu của đơn này sẽ <b>không được lưu</b>.
          </p>
        </div>

        {/* 4. Modal Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <motion.button
            type="button"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
            transition={spring.press}
            onClick={handleClose}
            disabled={isDeleting}
            data-testid="cancel-delete-order-btn"
            className="touch-target flex-1 py-2.5 h-11 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors text-xs disabled:opacity-50 cursor-pointer"
          >
            Hủy
          </motion.button>
          <motion.button
            type="button"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
            transition={spring.press}
            onClick={handleConfirm}
            disabled={isDeleting}
            data-testid="confirm-delete-order-btn"
            className="touch-target flex-1 py-2.5 h-11 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md shadow-rose-600/20 transition-colors flex items-center justify-center gap-1.5 text-xs disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Đang xóa...' : 'Xóa bàn'}</span>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
