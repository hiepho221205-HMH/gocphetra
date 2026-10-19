import React from 'react';
import { ShieldAlert, AlertTriangle, LogOut } from 'lucide-react';

export default function SafeLogoutModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div
      data-testid="safe-logout-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4 animate-fadeIn"
    >
      <div
        data-testid="safe-logout-modal-card"
        className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl border border-gray-100 text-center"
      >
        {/* Warning Icon */}
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert className="w-6 h-6 text-rose-600" />
        </div>

        {/* Modal Headings */}
        <div className="space-y-1.5">
          <h3 className="font-extrabold text-forest-900 text-sm">
            Xác nhận thoát phiên Quản lý?
          </h3>
          <p className="text-gray-500 text-xs leading-relaxed">
            Bạn đang chuẩn bị đăng xuất khỏi tài khoản <strong>Quản lý (Admin)</strong>. Hệ thống sẽ kết thúc phiên quản trị và đưa bạn về màn hình <strong>Sơ đồ bàn</strong>.
          </p>
        </div>

        {/* Safety Assurance Note */}
        <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-2.5 text-[11px] text-amber-900 text-left flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>Toàn bộ dữ liệu bàn đang phục vụ và cấu hình hệ thống vẫn được lưu trữ an toàn.</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            data-testid="logout-cancel-btn"
            onClick={onClose}
            className="touch-target btn-press flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
          >
            Ở lại
          </button>
          <button
            type="button"
            data-testid="logout-confirm-btn"
            onClick={onConfirm}
            className="touch-target btn-press flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất ngay</span>
          </button>
        </div>
      </div>
    </div>
  );
}
