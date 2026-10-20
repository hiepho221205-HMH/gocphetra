import React, { useState, useRef } from 'react';
import { usePos } from '../../store/PosContext';
import {
  ArrowLeft,
  Camera,
  User,
  ShieldCheck,
  Store,
  Clock,
  Wifi,
  Phone,
  LogOut,
  Trash2,
  Sliders,
  CheckCircle2
} from 'lucide-react';

export default function ProfileView({ onBack }) {
  const { settings, updateSettings, showToast, setActiveTab } = usePos();
  const fileInputRef = useRef(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const cashierRaw = settings?.currentCashier || 'Trần Mai (Mã NV: NV-08)';
  const displayName = cashierRaw.split('(')[0].trim() || 'Trần Mai';
  const staffCodeMatch = cashierRaw.match(/NV-\w+/);
  const staffCode = staffCodeMatch ? staffCodeMatch[0] : 'NV-08';

  const branchName = settings?.branchName || 'Chi nhánh 01 - Trụ sở chính';
  const shiftName = settings?.shiftName || 'Ca Sáng (06:30 - 14:30)';
  const hotline = settings?.hotline || '1900 88 99 22';
  const wifiPass = settings?.wifiPassword || 'goccaphe2026';
  const avatarUrl = settings?.avatarUrl || null;

  // Handle Photo Upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WebP)', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Dung lượng ảnh tối đa là 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result;
      if (base64Data) {
        updateSettings({ avatarUrl: base64Data });
        showToast('Đã cập nhật ảnh đại diện thành công!', 'success');
      }
    };
    reader.onerror = () => {
      showToast('Không thể đọc file ảnh. Vui lòng thử lại.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    updateSettings({ avatarUrl: null });
    showToast('Đã xóa ảnh đại diện, chuyển về mặc định', 'info');
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    showToast(`Đã đăng xuất ca trực của ${displayName}`, 'info');
    if (onBack) onBack();
    else setActiveTab('tables');
  };

  return (
    <div data-testid="profile-view" className="min-h-full bg-[#F4F6F4] text-xs pb-28">
      {/* 1. Header riêng của Profile với nút Back */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-4 pt-3.5 pb-3 border-b border-gray-100 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack || (() => setActiveTab('tables'))}
            data-testid="profile-back-button"
            className="p-2 rounded-xl bg-forest-50 hover:bg-forest-100 text-[#214E34] transition-colors border border-forest-100 active:scale-95 flex items-center justify-center cursor-pointer"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
          <div>
            <h1 className="text-base font-black text-[#214E34] tracking-tight leading-none">
              Hồ sơ nhân viên
            </h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Thông tin phiên ca trực & tài khoản
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className="px-2.5 py-1.5 rounded-lg bg-[#EBF5ED] text-[#214E34] hover:bg-[#D4E8DB] transition-colors font-bold text-[11px] flex items-center gap-1 border border-[#D4E8DB]"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Quản lý</span>
        </button>
      </div>

      <div className="px-4 pt-5 space-y-4 max-w-lg mx-auto">
        {/* 2. Avatar Card lớn & Đổi ảnh */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex flex-col items-center text-center">
          <div className="relative inline-flex items-center justify-center mb-3">
            <div className="w-[88px] h-[88px] rounded-full p-[3px] bg-gradient-to-tr from-[#D4E8DB] via-[#E8F5EE] to-[#009E78] ring-4 ring-[#D4E8DB]/40 shadow-md">
              <div className="w-full h-full rounded-full overflow-hidden bg-[#214E34] text-white flex items-center justify-center relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-11 h-11 text-white stroke-[1.8]" />
                )}
              </div>
            </div>

            {/* Nút camera đổi ảnh gắn trên avatar */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Thay đổi ảnh đại diện"
              className="absolute bottom-0 right-0 p-2 rounded-full bg-[#009E78] hover:bg-[#008967] text-white shadow-md border-2 border-white active:scale-90 transition-transform cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          <h2 className="text-lg font-black text-gray-900 tracking-tight">
            {displayName}
          </h2>

          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-forest-50 text-forest-800 border border-forest-200/80 text-[11px] font-bold">
              <ShieldCheck className="w-3 h-3 text-[#009E78]" />
              <span>Quản lý • Admin</span>
            </span>
            <span className="text-[11px] text-gray-400 font-mono font-medium">
              {staffCode}
            </span>
          </div>

          <p className="text-[11.5px] text-gray-500 font-medium mt-1">
            GÓC – Phê & Trà
          </p>

          {/* Action buttons for Avatar */}
          <div className="flex items-center gap-2 mt-4 w-full pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 px-3 rounded-xl bg-forest-50 hover:bg-forest-100 text-[#214E34] font-bold text-xs transition-colors flex items-center justify-center gap-1.5 border border-forest-100"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Đổi ảnh</span>
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="py-2 px-3 rounded-xl bg-gray-50 hover:bg-rose-50 text-gray-600 hover:text-rose-600 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 border border-gray-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa ảnh</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. Thông tin ca trực & vận hành */}
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Store className="w-4 h-4 text-[#214E34]" />
            <span className="font-extrabold text-sm text-[#214E34]">Thông tin ca trực hiện tại</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-700" />
                <span className="text-gray-600 font-medium">Ca làm việc</span>
              </div>
              <span className="font-bold text-gray-900">{shiftName}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-700" />
                <span className="text-gray-600 font-medium">Chi nhánh</span>
              </div>
              <span className="font-bold text-gray-900">{branchName}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-700" />
                <span className="text-gray-600 font-medium">Hotline hỗ trợ</span>
              </div>
              <span className="font-bold text-gray-900 font-mono">{hotline}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-700" />
                <span className="text-gray-600 font-medium">Mật khẩu Wi-Fi</span>
              </div>
              <span className="font-bold text-gray-900 font-mono">{wifiPass}</span>
            </div>
          </div>
        </div>

        {/* 4. Nút Đăng xuất ca trực */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            data-testid="profile-logout-button"
            className="w-full py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 border border-rose-200 transition-colors active:scale-98 cursor-pointer shadow-xs"
          >
            <LogOut className="w-4 h-4 stroke-[2.2]" />
            <span>Đăng xuất phiên làm việc</span>
          </button>
        </div>
      </div>

      {/* Modal xác nhận đăng xuất */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3.5 shadow-2xl text-center border border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-black text-gray-900 text-sm">Xác nhận đăng xuất ca trực?</h3>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                Bạn sắp kết thúc phiên làm việc của thu ngân <strong>{displayName}</strong>. Các hóa đơn chưa lưu sẽ không bị mất dữ liệu.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-colors shadow-xs"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
