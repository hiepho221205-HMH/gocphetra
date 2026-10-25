import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ArrowLeft, Edit3 } from 'lucide-react';
import { triggerHaptic } from '../../../utils/haptics';
import { motion, AnimatePresence, useReducedMotion, useMotionTokens } from '../../../lib/animateUi';

/**
 * UnsavedChangesModal - Soft 3D Confirmation Popup for unsaved changes
 * Rendered via createPortal to prevent z-index and overflow issues on iOS/Android PWA
 */
export default function UnsavedChangesModal({
  isOpen,
  onStay,
  onDiscard
}) {
  const { spring, transition } = useMotionTokens();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onStay?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onStay]);

  const handleStay = () => {
    triggerHaptic('light');
    onStay?.();
  };

  const handleDiscard = () => {
    triggerHaptic('medium');
    onDiscard?.();
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="unsaved-changes-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-changes-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : transition.fade}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[3px]"
          onClick={handleStay}
        >
          <motion.div
            key="unsaved-changes-card"
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.94, y: 8 }}
            transition={shouldReduceMotion ? { duration: 0 } : spring.dialog}
            onClick={(e) => e.stopPropagation()}
            className="clay-card w-full max-w-sm bg-white rounded-[28px] p-5 sm:p-6 shadow-2xl border border-white/90 space-y-4 text-center"
          >
            {/* Soft 3D Amber/Coral Warning Disc */}
            <div className="w-13 h-13 mx-auto rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shadow-xs">
              <AlertCircle className="w-7 h-7 stroke-[2.2]" />
            </div>

            {/* Text Details */}
            <div className="space-y-1.5">
              <h3
                id="unsaved-changes-title"
                className="text-base font-black text-forest-950 tracking-tight"
              >
                Thay đổi chưa được lưu!
              </h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                Bạn có các thông tin cấu hình đang chỉnh sửa dở dang. Nếu quay lại Hub bây giờ, các thay đổi chưa lưu này sẽ bị hủy bỏ.
              </p>
            </div>

            {/* Actions Grid */}
            <div className="space-y-2 pt-1">
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                transition={spring.press}
                onClick={handleStay}
                className="touch-target w-full py-3 px-4 bg-[#214E34] hover:bg-[#183926] text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer text-xs"
              >
                <Edit3 className="w-4 h-4" />
                <span>Tiếp tục chỉnh sửa</span>
              </motion.button>

              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                transition={spring.press}
                onClick={handleDiscard}
                className="touch-target w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100/80 text-rose-700 font-bold rounded-2xl border border-rose-200/80 flex items-center justify-center gap-2 transition-all cursor-pointer text-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Hủy thay đổi & Quay lại</span>
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
