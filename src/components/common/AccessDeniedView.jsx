import React from 'react';
import { usePos } from '../../store/PosContext';
import { ShieldAlert, ArrowLeft, Home, Lock } from 'lucide-react';

export default function AccessDeniedView({ onBack, requiredRole = 'Quản lý (Manager/Admin)' }) {
  const { currentRole, setActiveTab } = usePos();

  const roleLabels = {
    admin: 'Quản lý (Admin)',
    manager: 'Cửa hàng trưởng (Manager)',
    staff: 'Nhân viên thu ngân (Staff)'
  };

  return (
    <div
      data-testid="access-denied-view"
      className="p-5 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 animate-fadeIn"
    >
      <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 border border-rose-200/80 flex items-center justify-center shadow-lg shadow-rose-900/10 animate-bounce">
        <Lock className="w-8 h-8 stroke-[2.2]" />
      </div>

      <div className="space-y-1.5 max-w-xs">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>403 Không đủ quyền truy cập</span>
        </span>
        <h2 className="text-lg font-black text-gray-900 tracking-tight">
          Khu vực bị giới hạn
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Tài khoản của bạn đang có vai trò <strong>{roleLabels[currentRole] || currentRole}</strong>, không có quyền truy cập vào mục này.
        </p>
        <p className="text-[11px] text-gray-400 bg-gray-50 p-2.5 rounded-xl border border-gray-100 mt-2">
          Yêu cầu cấp quyền: <strong>{requiredRole}</strong>.
          {currentRole === 'staff' && ' Nhân viên chỉ được thao tác Sơ đồ bàn, Gọi món, Xem đơn và Thanh toán trong ngày.'}
        </p>
      </div>

      <div className="pt-2 flex items-center gap-2 w-full max-w-xs">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            data-testid="access-denied-back-btn"
            className="touch-target btn-press flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('tables')}
          data-testid="access-denied-home-btn"
          className="touch-target btn-press flex-1 py-2.5 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
        >
          <Home className="w-4 h-4" />
          <span>Về Sơ đồ bàn</span>
        </button>
      </div>
    </div>
  );
}
