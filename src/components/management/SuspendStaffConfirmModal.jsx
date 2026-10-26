import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Lock,
  X,
  ShieldAlert,
  Shield,
  Briefcase,
  Coffee,
  Loader2
} from 'lucide-react';
import { getStaffDisplayCode } from './StaffListPage';

export default function SuspendStaffConfirmModal({
  isOpen,
  onClose,
  staff,
  onConfirm
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Escape key listener & Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !staff) return null;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm(staff.id);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleLabel =
    staff.role === 'admin'
      ? 'Quản trị viên (Admin)'
      : staff.role === 'manager'
      ? 'Cửa hàng trưởng (Manager)'
      : 'Thu ngân (Staff)';

  const roleBadgeStyle =
    staff.role === 'admin'
      ? 'bg-forest-50 text-forest-800 border-forest-200'
      : staff.role === 'manager'
      ? 'bg-blue-50 text-blue-800 border-blue-200'
      : 'bg-amber-50 text-amber-800 border-amber-200';

  return (
    <div
      data-testid="suspend-staff-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={!isSubmitting ? onClose : undefined}
    >
      <div
        data-testid="suspend-staff-modal-container"
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 space-y-4 border border-amber-100 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Icon + Title */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-2xs">
              <Lock className="w-5 h-5 text-amber-600 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 tracking-tight">
                Tạm khóa tài khoản
              </h3>
              <p className="text-[11px] text-gray-500">
                Ngăn quyền truy cập POS của nhân viên
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="close-suspend-staff-modal-btn"
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40 cursor-pointer"
            aria-label="Đóng modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Staff Target Card */}
        <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-200/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1E3D29] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
            {staff.name ? staff.name.split(' ').map((w) => w[0]).filter(Boolean).slice(-2).join('').toUpperCase() : 'NV'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-xs text-gray-900 truncate">
                {staff.name}
              </span>
              <span className={`text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-full border ${roleBadgeStyle}`}>
                {roleLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10.5px] text-gray-500 mt-0.5 truncate">
              <span className="font-mono font-bold text-gray-700">
                {getStaffDisplayCode(staff)}
              </span>
              {staff.email && (
                <>
                  <span>•</span>
                  <span className="truncate">{staff.email}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Impact Warning Notice */}
        <div className="bg-amber-50/80 rounded-2xl p-3 border border-amber-200/60 space-y-1.5 text-[11px] text-amber-900 leading-snug">
          <div className="flex items-center gap-1.5 font-bold text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Tác động khi tạm khóa tài khoản:</span>
          </div>
          <ul className="list-disc pl-4 space-y-1 text-amber-800/90 text-[10.5px]">
            <li>Nhân viên sẽ <strong>bị chặn quyền sử dụng POS</strong> ngay lập tức.</li>
            <li>Phiên làm việc trên mọi thiết bị sẽ bị tạm dừng và từ chối tạo đơn/thanh toán.</li>
            <li>Lịch sử hóa đơn và doanh thu đã bán trước đó vẫn được <strong>bảo toàn 100%</strong>.</li>
            <li>Quản trị viên có thể bật lại quyền truy cập bất cứ lúc nào bằng nút Switch.</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="cancel-suspend-staff-btn"
            className="flex-1 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            data-testid="confirm-suspend-staff-btn"
            className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/20 disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang khóa...</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Xác nhận khóa</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
