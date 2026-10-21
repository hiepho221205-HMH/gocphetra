import React, { useState, useEffect } from 'react';
import { X, Check, User, Shield, AlertCircle, Lock } from 'lucide-react';
import { usePos } from '../../store/PosContext';

export default function StaffBottomSheet({
  isOpen,
  onClose,
  staffToEdit = null,
  onSave
}) {
  const { currentRole, showToast } = usePos();
  const isAdmin = currentRole === 'admin';

  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('staff'); // 'admin' | 'staff'
  const [status, setStatus] = useState('active'); // 'active' | 'inactive'
  const [error, setError] = useState('');

  useEffect(() => {
    if (staffToEdit) {
      setDisplayName(staffToEdit.name || '');
      setRole(staffToEdit.role || 'staff');
      setStatus(staffToEdit.status || 'active');
    } else {
      setDisplayName('');
      setRole('staff');
      setStatus('active');
    }
    setError('');
  }, [staffToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanName = (displayName || '').trim();
    if (!cleanName) {
      setError('Vui lòng nhập tên nhân viên');
      return;
    }

    // RBAC: Manager is strictly forbidden from granting 'admin' role!
    const effectiveRole = isAdmin ? role : (staffToEdit ? staffToEdit.role : 'staff');
    if (!isAdmin && role === 'admin' && (!staffToEdit || staffToEdit.role !== 'admin')) {
      showToast?.('Từ chối quyền: Chỉ Quản trị viên (Admin) mới có quyền cấp vai trò Quản lý!', 'error');
      return;
    }

    onSave({
      id: staffToEdit ? staffToEdit.id : null,
      name: cleanName,
      role: effectiveRole,
      status
    });
    onClose();
  };

  return (
    <div
      data-testid="staff-bottom-sheet-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center animate-fadeIn"
      onClick={onClose}
    >
      <div
        data-testid="staff-bottom-sheet-container"
        className="w-full max-w-[400px] bg-white rounded-t-[28px] shadow-2xl p-5 space-y-4 animate-slideUp border-t border-forest-800/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle bar */}
        <div className="w-12 h-1.5 rounded-full bg-gray-300 mx-auto -mt-1 mb-2" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-forest-950">
              {staffToEdit ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}
            </h3>
            <p className="text-[11px] text-gray-500">
              Thiết lập tên hiển thị & trạng thái ca làm việc
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notice */}
        {error && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Tên nhân viên */}
          <div>
            <label className="block text-gray-700 font-bold mb-1">
              Tên nhân viên <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                required
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Ví dụ: Nguyễn Văn A"
                className="w-full h-11 pl-9 pr-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-medium text-gray-900"
              />
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
            </div>
          </div>

          {/* Vai trò */}
          <div>
            <label className="block text-gray-700 font-bold mb-1">Vai trò phục vụ</label>
            {isAdmin ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="role-option-staff"
                  onClick={() => setRole('staff')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    role === 'staff'
                      ? 'bg-forest-50 border-forest-600 text-forest-900 shadow-2xs'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Nhân viên ca</span>
                </button>

                <button
                  type="button"
                  data-testid="role-option-admin"
                  onClick={() => setRole('admin')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    role === 'admin'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-2xs'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Quản lý ca</span>
                </button>
              </div>
            ) : (
              <div
                data-testid="locked-role-display"
                className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200"
              >
                <span className="font-bold text-gray-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-forest-700" />
                  {staffToEdit?.role === 'admin'
                    ? 'Quản lý (Admin)'
                    : staffToEdit?.role === 'manager'
                    ? 'Cửa hàng trưởng (Manager)'
                    : 'Nhân viên ca (Staff)'}
                </span>
                <span className="text-[10.5px] text-gray-400 flex items-center gap-1 font-medium">
                  <Lock className="w-3 h-3 text-gray-400" />
                  <span>Chỉ Admin đổi vai trò</span>
                </span>
              </div>
            )}
          </div>

          {/* Trạng thái hoạt động */}
          <div>
            <label className="block text-gray-700 font-bold mb-1">Trạng thái hoạt động</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  status === 'active'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs ring-1 ring-emerald-500/30'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Đang hoạt động</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('inactive')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  status === 'inactive'
                    ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-2xs ring-1 ring-amber-500/30'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Tạm ngưng</span>
              </button>
            </div>
          </div>

          {/* Ghi chú hướng dẫn nghiệp vụ */}
          <div className="p-3 bg-forest-50/60 rounded-xl border border-forest-100 text-[11px] text-forest-900 leading-relaxed">
            💡 <strong>Quy chuẩn bảo mật:</strong> Không thu thập số điện thoại hay thông tin cá nhân. Nhân viên ở trạng thái <em>Đang hoạt động</em> sẽ xuất hiện trong danh sách ghi nhận thu ngân khi tạo đơn.
          </div>

          {/* Action Footer */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-forest-800 hover:bg-forest-900 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{staffToEdit ? 'Lưu thay đổi' : 'Thêm nhân viên'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
