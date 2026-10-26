import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, LogOut, Lock } from 'lucide-react';

export default function AccountSuspendedBannerModal({ isOpen, onLogout }) {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      data-testid="account-suspended-banner-modal"
      className="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center space-y-4 border border-rose-200 animate-scaleUp">
        {/* Warning Icon Badge */}
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border-2 border-rose-100 shadow-md">
          <ShieldAlert className="w-8 h-8 stroke-[2.2]" />
        </div>

        {/* Title & Explanation */}
        <div className="space-y-1.5">
          <h2 className="text-base font-black text-gray-900 tracking-tight leading-tight">
            Tài khoản của bạn đã bị tạm khóa
          </h2>
          <p className="text-xs text-rose-600 font-bold">
            Quyền truy cập hệ thống POS đã bị tạm dừng
          </p>
        </div>

        {/* Description */}
        <div className="p-3.5 bg-rose-50/70 rounded-2xl border border-rose-100 text-[11.5px] text-gray-700 leading-relaxed text-left">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>
              Quản trị viên đã tạm khóa quyền sử dụng của tài khoản này. Toàn bộ thao tác bán hàng, tạo đơn và thanh toán bị từ chối. Vui lòng liên hệ Quản trị viên cửa hàng để được hỗ trợ.
            </span>
          </div>
        </div>

        {/* Action Button: Safe Logout */}
        <div className="pt-2">
          <button
            type="button"
            data-testid="account-suspended-logout-btn"
            onClick={onLogout}
            className="w-full py-3 px-4 rounded-xl bg-forest-900 hover:bg-forest-950 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất an toàn</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
