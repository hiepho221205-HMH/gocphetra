import React, { useState } from 'react';
import {
  AlertTriangle,
  Trash2,
  X,
  ShieldAlert,
  CheckCircle2,
  User,
  Shield,
  Briefcase,
  Coffee
} from 'lucide-react';

export default function DeleteStaffConfirmModal({
  isOpen,
  onClose,
  staff,
  onConfirm
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !staff) return null;

  const handleConfirm = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onConfirm(staff.id);
      onClose();
    } finally {
      setIsDeleting(false);
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
      data-testid="delete-staff-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={!isDeleting ? onClose : undefined}
    >
      <div
        data-testid="delete-staff-modal-container"
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 space-y-4 border border-rose-100 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Icon + Title */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-2xs">
              <ShieldAlert className="w-5 h-5 text-rose-600 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 tracking-tight">
                Xác nhận xóa nhân sự
              </h3>
              <p className="text-[11px] text-gray-500">
                Thao tác quản trị cấp cao không thể hoàn tác
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            data-testid="close-delete-staff-modal-btn"
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Staff Target Information Card */}
        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E3D29] text-white flex items-center justify-center font-extrabold text-xs shadow-2xs overflow-hidden shrink-0">
            {staff.avatarUrl ? (
              <img src={staff.avatarUrl} alt={staff.name} className="w-full h-full object-cover" />
            ) : (
              <span>{staff.name ? staff.name.charAt(0).toUpperCase() : 'NV'}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4
              data-testid="delete-target-staff-name"
              className="font-extrabold text-xs text-gray-900 truncate"
            >
              {staff.name}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] font-bold px-2 py-0.2 rounded-md border ${roleBadgeStyle}`}>
                {roleLabel}
              </span>
              <span className="text-[10px] text-gray-400">• Mã: {staff.id}</span>
            </div>
          </div>
        </div>

        {/* Consequence Bullet List (Chính sách an toàn & toàn vẹn dữ liệu) */}
        <div className="space-y-2 text-[11px] leading-relaxed text-gray-600 bg-rose-50/50 p-3 rounded-2xl border border-rose-100/80">
          <div className="flex items-start gap-2 text-rose-900 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>Hệ quả sau khi xóa nhân viên:</span>
          </div>
          <ul className="space-y-1.5 pl-6 list-disc text-gray-700 text-[10.5px]">
            <li>
              <strong>Thu hồi quyền & phiên làm việc:</strong> Nhân viên sẽ mất quyền truy cập và bị đăng xuất khỏi hệ thống ngay lập tức.
            </li>
            <li>
              <strong>Xóa khỏi danh sách vận hành:</strong> Không còn hiển thị trong danh sách chọn thu ngân phục vụ ca.
            </li>
            <li className="text-emerald-900 font-medium">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" />
                Bảo toàn 100% lịch sử bán hàng:
              </span>{' '}
              Hóa đơn, thanh toán và báo cáo doanh thu trong quá khứ được giữ nguyên vẹn (thu ngân cũ hiển thị kèm nhãn nhận diện chấm đỏ).
            </li>
          </ul>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            data-testid="cancel-delete-staff-btn"
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-xs disabled:opacity-50 cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            data-testid="confirm-delete-staff-btn"
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 text-xs disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
