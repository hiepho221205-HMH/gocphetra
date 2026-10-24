import React, { useState, useRef } from 'react';
import { usePos } from '../../store/PosContext';
import {
  ArrowLeft,
  User,
  Camera,
  Trash2,
  Lock,
  Check,
  Phone,
  FileText,
  ShieldCheck
} from 'lucide-react';

export default function ProfileEditSubpage({ onBack }) {
  const {
    currentUser,
    currentRole,
    userProfiles = {},
    updateCurrentUserProfile,
    showToast,
    settings
  } = usePos();

  const fileInputRef = useRef(null);

  const activeId = currentUser?.id || (currentRole === 'admin' ? 'staff-01' : currentRole === 'manager' ? 'staff-02' : 'staff-03');
  const profile = userProfiles[activeId] || {};

  const [displayName, setDisplayName] = useState(
    profile.name || currentUser?.name || (currentRole === 'admin' ? 'Trần Mai' : currentRole === 'manager' ? 'Nguyễn Văn Hùng' : 'Lê Hoàng Nam')
  );
  const [phone, setPhone] = useState(profile.phone || '');
  const [notes, setNotes] = useState(profile.notes || '');
  const [avatarUrl, setAvatarUrl] = useState(
    profile.avatarUrl !== undefined ? profile.avatarUrl : (settings?.avatarUrl || null)
  );
  const [imageError, setImageError] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast?.('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WebP)', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast?.('Dung lượng ảnh tối đa là 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      if (base64) {
        setImageError(false);
        setAvatarUrl(base64);
        }
    };
    reader.onerror = () => {
      showToast?.('Không thể đọc file ảnh. Vui lòng thử lại.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(null);
    setImageError(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanName = displayName.trim();
    if (!cleanName) {
      showToast?.('Tên hiển thị không được để trống!', 'error');
      return;
    }

    setSaving(true);
    try {
      updateCurrentUserProfile?.({
        name: cleanName,
        avatarUrl,
        phone: phone.trim(),
        notes: notes.trim()
      });
      onBack?.();
    } catch (err) {
      showToast?.(err.message || 'Lỗi khi cập nhật hồ sơ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel =
    currentRole === 'admin'
      ? 'Quản trị viên (Admin)'
      : currentRole === 'manager'
      ? 'Cửa hàng trưởng (Manager)'
      : 'Thu ngân (Staff)';

  const roleBadgeStyle =
    currentRole === 'admin'
      ? 'bg-forest-50 text-forest-900 border-forest-200'
      : currentRole === 'manager'
      ? 'bg-blue-50 text-blue-900 border-blue-200'
      : 'bg-amber-50 text-amber-900 border-amber-200';

  return (
    <div
      data-testid="profile-edit-subpage"
      className="space-y-4 animate-slideInRight text-xs"
    >
      {/* Header bar */}
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-gray-100">
        <button
          type="button"
          onClick={onBack}
          data-testid="profile-edit-back-btn"
          className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
          aria-label="Quay lại cài đặt"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
            Quản lý Profile
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Cập nhật ảnh đại diện, tên hiển thị & thông tin cá nhân
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Avatar Card */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs flex flex-col items-center text-center space-y-3">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-[#214E34] text-white flex items-center justify-center shadow-md ring-4 ring-[#214E34]/15">
              {avatarUrl && !imageError ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-white stroke-[1.8]" />
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              data-testid="edit-avatar-upload-trigger"
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#009E78] text-white hover:bg-[#008766] border-2 border-white shadow-md active:scale-90 transition-all cursor-pointer flex items-center justify-center"
              aria-label="Chọn ảnh mới"
              title="Chọn ảnh mới"
            >
              <Camera className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-forest-50 text-forest-800 border border-forest-200/80 hover:bg-forest-100 transition-colors cursor-pointer"
            >
              Đổi ảnh đại diện
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                data-testid="edit-avatar-remove-btn"
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa ảnh</span>
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400">
            Hỗ trợ PNG, JPG, WebP. Tối đa 2MB. Tự động đồng bộ với thanh tiêu đề.
          </p>
        </div>

        {/* Thông tin cá nhân */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs space-y-3.5">
          {/* Tên hiển thị */}
          <div>
            <label className="block text-gray-700 font-bold mb-1 text-xs">
              Tên hiển thị <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập họ và tên thu ngân"
                data-testid="profile-display-name-input"
                className="w-full h-10 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-medium text-gray-900 text-xs"
              />
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Tên này sẽ hiển thị trên Header, hóa đơn thanh toán và báo cáo ca.
            </p>
          </div>

          {/* Số điện thoại liên hệ */}
          <div>
            <label className="block text-gray-700 font-bold mb-1 text-xs">
              Số điện thoại liên hệ
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ví dụ: 0901234567"
                data-testid="profile-phone-input"
                className="w-full h-10 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-medium text-gray-900 text-xs"
              />
              <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Ghi chú ca / Chức danh phụ */}
          <div>
            <label className="block text-gray-700 font-bold mb-1 text-xs">
              Ghi chú ca làm việc
            </label>
            <div className="relative">
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú phân công hoặc chức danh..."
                data-testid="profile-notes-input"
                className="w-full p-2.5 pl-9 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-medium text-gray-900 text-xs resize-none"
              />
              <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Vai trò hệ thống - KHÓA BẢO MẬT (READ-ONLY) */}
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-gray-700 font-bold mb-1 text-xs flex items-center gap-1.5">
              <span>Vai trò hệ thống</span>
              <span className="text-[10px] font-semibold text-gray-400">(Bảo mật • Chỉ đọc)</span>
            </label>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200/80">
              <div className="flex items-center gap-2">
                <span
                  data-testid="profile-role-badge"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${roleBadgeStyle}`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{roleLabel}</span>
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium">
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                <span>Đã khóa</span>
              </div>
            </div>
            <p className="text-[10.5px] text-gray-400 mt-1.5 leading-relaxed">
              🔒 <strong>Chính sách phân quyền:</strong> Vai trò được quản lý tập trung bởi Quản trị viên (Admin). Bạn không thể tự thay đổi vai trò hoặc cấp quyền cho tài khoản của mình.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onBack}
            data-testid="profile-edit-cancel-btn"
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors cursor-pointer text-xs"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={saving}
            data-testid="profile-edit-save-btn"
            className="flex-1 py-3 bg-forest-800 hover:bg-forest-900 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-xs disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
