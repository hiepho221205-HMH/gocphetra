import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Lock, Eye, EyeOff, Loader2, X, Check } from 'lucide-react';

export default function AdminReauthModal({
  isOpen,
  onClose,
  onConfirm,
  targetStaffName = '',
  actionDescription = 'thay đổi thông tin đăng nhập',
  isSubmitting = false,
  errorMessage = ''
}) {
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setAdminPassword('');
      setShowPassword(false);
      setLocalError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (errorMessage) {
      setLocalError(errorMessage);
    }
  }, [errorMessage]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setLocalError('Vui lòng nhập mật khẩu Quản trị viên để xác nhận!');
      return;
    }
    setLocalError('');
    onConfirm?.(adminPassword);
  };

  return (
    <div
      data-testid="admin-reauth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose?.();
      }}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 space-y-4 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-forest-50 text-[#214E34] flex items-center justify-center shrink-0 border border-[#214E34]/20 shadow-xs">
              <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 tracking-tight leading-tight">
                Xác thực Quản trị viên
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Bảo vệ an toàn thông tin đăng nhập
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Note */}
        <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/70 text-[11.5px] text-amber-900 space-y-1">
          <p className="font-bold">
            Thao tác nhạy cảm: {actionDescription}
          </p>
          <p className="text-amber-800 leading-relaxed text-[11px]">
            Hệ thống yêu cầu xác nhận mật khẩu hiện tại của bạn (Quản trị viên) trước khi thực hiện thao tác trên tài khoản của <strong>{targetStaffName}</strong>.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
              <span>Mật khẩu Admin của bạn</span>
              <span className="text-[10px] text-rose-500 font-semibold">* Bắt buộc</span>
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                required
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  if (localError) setLocalError('');
                }}
                placeholder="Nhập mật khẩu Admin..."
                data-testid="input-admin-reauth-password"
                className="w-full h-11 pl-9 pr-10 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#214E34] focus:ring-1 focus:ring-[#214E34]/20 text-xs font-semibold text-gray-900 transition-all"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {localError && (
              <p className="text-[11px] text-rose-600 font-bold animate-shake">
                {localError}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              data-testid="cancel-reauth-btn"
              className="flex-1 py-2.5 px-3 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-bold active:scale-95 transition-all cursor-pointer text-center disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !adminPassword.trim()}
              data-testid="btn-confirm-reauth"
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#214E34] hover:bg-[#1a3d28] text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.2]" />
                  <span>Xác nhận & Cập nhật</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
