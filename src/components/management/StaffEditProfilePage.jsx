import React, { useState, useEffect, useRef } from 'react';
import { usePos } from '../../store/PosContext';
import { getStaffInitials } from './StaffManagementSection';
import { getStaffDisplayCode } from './StaffListPage';
import SuspendStaffConfirmModal from './SuspendStaffConfirmModal';
import AdminReauthModal from './AdminReauthModal';
import UnsavedChangesModal from '../settings/hub/UnsavedChangesModal';
import {
  ArrowLeft,
  Camera,
  User,
  Shield,
  Briefcase,
  Phone,
  Mail,
  Lock,
  Check,
  X,
  AlertCircle,
  Loader2,
  Trash2,
  Sparkles,
  Radio,
  Key,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';


function getPasswordStrength(pwd) {
  if (!pwd) return { score: 0, label: 'Chưa nhập', color: 'text-gray-400', barColor: 'bg-gray-200', percent: 'w-0' };
  if (pwd.length < 6) return { score: 1, label: 'Quá ngắn (tối thiểu 6 ký tự)', color: 'text-rose-500', barColor: 'bg-rose-500', percent: 'w-1/4' };
  let score = 1;
  if (pwd.length >= 8) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[a-zA-Z]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  if (score <= 2) return { score: 2, label: 'Yếu', color: 'text-amber-600', barColor: 'bg-amber-500', percent: 'w-2/4' };
  if (score <= 3) return { score: 3, label: 'Trung bình', color: 'text-blue-600', barColor: 'bg-blue-500', percent: 'w-3/4' };
  return { score: 4, label: 'Mạnh', color: 'text-emerald-600', barColor: 'bg-emerald-600', percent: 'w-full' };
}

export default function StaffEditProfilePage() {
  const {
    staffList = [],
    saveStaffMember,
    toggleStaffStatus,
    adminUpdateUserCredentials,
    showToast,
    currentRole,
    currentUser,
    userProfiles = {},
    routeParams = {},
    navigate,
    isStaffOnline,
    syncStaffWithCloud
  } = usePos();

  const isAdmin = currentRole === 'admin';
  const fileInputRef = useRef(null);

  // Target staff id from URL query / params (?id=... or ?edit=...)
  const targetStaffId = routeParams?.id || routeParams?.edit || null;
  const staff = staffList.find((s) => s.id === targetStaffId) || null;
  const profile = staff ? (userProfiles[staff.id] || {}) : {};

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [shiftName, setShiftName] = useState('Ca Sáng (06:30 - 14:30)');
  const [branchId, setBranchId] = useState('main');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('active');
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Modals & submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Admin Credential Management states
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [credentialFormError, setCredentialFormError] = useState('');
  const [showAdminReauthModal, setShowAdminReauthModal] = useState(false);
  const [isSubmittingCredentials, setIsSubmittingCredentials] = useState(false);
  const [reauthErrorMessage, setReauthErrorMessage] = useState('');

  // Initial snapshot to calculate dirty status
  const initialSnapshotRef = useRef(null);

  // Initialize form when staff is found
  useEffect(() => {
    if (staff) {
      const initValues = {
        name: staff.name || profile.name || '',
        phone: staff.phone || profile.phone || '',
        shiftName: staff.shiftName || profile.shiftName || 'Ca Sáng (06:30 - 14:30)',
        branchId: staff.branchId || profile.branchId || 'main',
        notes: staff.notes || profile.notes || '',
        status: staff.status || 'active',
        avatarUrl: staff.avatarUrl || profile.avatarUrl || null
      };
      initialSnapshotRef.current = initValues;
      setName(initValues.name);
      setPhone(initValues.phone);
      setShiftName(initValues.shiftName);
      setBranchId(initValues.branchId);
      setNotes(initValues.notes);
      setStatus(initValues.status);
      setAvatarUrl(initValues.avatarUrl);
    }
  }, [staff?.id]);

  // Compute isDirty
  const isDirty = Boolean(
    initialSnapshotRef.current && (
      name.trim() !== initialSnapshotRef.current.name.trim() ||
      phone.trim() !== initialSnapshotRef.current.phone.trim() ||
      shiftName !== initialSnapshotRef.current.shiftName ||
      branchId !== initialSnapshotRef.current.branchId ||
      notes.trim() !== initialSnapshotRef.current.notes.trim() ||
      status !== initialSnapshotRef.current.status ||
      avatarUrl !== initialSnapshotRef.current.avatarUrl
    )
  );

  // Back button handler with dirty safeguard
  const handleBackClick = () => {
    if (isDirty) {
      setShowExitModal(true);
    } else {
      navigate('/staff/list');
    }
  };

  // Avatar upload handler (Max 2MB, preview via Data URL)
  const handleAvatarFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast?.('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP)!', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast?.('Dung lượng ảnh tối đa là 2MB. Vui lòng chọn ảnh nhỏ hơn!', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      if (base64) {
        setAvatarUrl(base64);
        showToast?.('Đã tải ảnh lên! Nhấn "Lưu thay đổi" để xác nhận.', 'info');
      }
    };
    reader.onerror = () => {
      showToast?.('Không thể đọc file ảnh. Vui lòng thử lại!', 'error');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    showToast?.('Đã xóa ảnh đại diện.', 'info');
  };


  // Credential Management handlers (Admin only)
  const handleRequestUpdateCredentials = () => {
    if (!isAdmin) {
      showToast?.('Từ chối quyền: Chỉ Quản trị viên (Admin) mới có quyền đổi email hoặc mật khẩu!', 'error');
      return;
    }

    const cleanNewEmail = newEmail.trim().toLowerCase();
    const cleanNewPassword = newPassword.trim();

    if (!showChangeEmail && !showResetPassword) {
      setCredentialFormError('Vui lòng chọn Đổi Email hoặc Đặt lại Mật khẩu!');
      return;
    }

    if (showChangeEmail) {
      if (!cleanNewEmail) {
        setCredentialFormError('Vui lòng nhập địa chỉ Email mới!');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanNewEmail)) {
        setCredentialFormError('Định dạng Email mới không hợp lệ!');
        return;
      }
      // Check duplicate
      const dup = staffList.find(
        (s) => s.id !== staff?.id && (s.email || '').toLowerCase().trim() === cleanNewEmail
      );
      if (dup) {
        setCredentialFormError(`Email "${cleanNewEmail}" đã được sử dụng bởi ${dup.name}!`);
        return;
      }
    }

    if (showResetPassword) {
      if (!cleanNewPassword) {
        setCredentialFormError('Vui lòng nhập Mật khẩu mới!');
        return;
      }
      if (cleanNewPassword.length < 6) {
        setCredentialFormError('Mật khẩu mới phải có tối thiểu 6 ký tự!');
        return;
      }
      if (cleanNewPassword !== confirmNewPassword.trim()) {
        setCredentialFormError('Xác nhận mật khẩu mới không khớp!');
        return;
      }
    }

    setCredentialFormError('');
    setReauthErrorMessage('');
    setShowAdminReauthModal(true);
  };

  const handleConfirmAdminReauth = async (adminPassword) => {
    if (!adminUpdateUserCredentials) {
      setReauthErrorMessage('Tính năng cập nhật thông tin đăng nhập chưa sẵn sàng');
      return;
    }

    setIsSubmittingCredentials(true);
    setReauthErrorMessage('');

    try {
      const res = await adminUpdateUserCredentials({
        targetUserId: staff?.id,
        newEmail: showChangeEmail && newEmail.trim() ? newEmail.trim().toLowerCase() : null,
        newPassword: showResetPassword && newPassword.trim() ? newPassword.trim() : null,
        adminPassword
      });

      if (res && res.success) {
        setShowAdminReauthModal(false);
        setNewEmail('');
        setNewPassword('');
        setConfirmNewPassword('');
        setShowChangeEmail(false);
        setShowResetPassword(false);
        setCredentialFormError('');
      } else {
        setReauthErrorMessage(res?.message || 'Mật khẩu Quản trị viên không chính xác hoặc không đủ quyền!');
      }
    } catch (err) {
      setReauthErrorMessage(err.message || 'Lỗi khi cập nhật thông tin đăng nhập');
    } finally {
      setIsSubmittingCredentials(false);
    }
  };

  // Safeguards for Status Switch
  const isTargetAdmin = staff?.role === 'admin';
  const isActive = status === 'active';
  const isSelf = currentUser?.id === staff?.id;
  const isLastActiveAdmin =
    isTargetAdmin &&
    isActive &&
    staffList.filter((s) => s.role === 'admin' && s.status === 'active' && s.id !== staff?.id).length === 0;

  const handleStatusToggle = () => {
    if (!isAdmin) {
      showToast?.('Từ chối quyền: Chỉ Quản trị viên (Admin) mới có quyền bật/tắt quyền sử dụng POS!', 'error');
      return;
    }

    if (isLastActiveAdmin) {
      showToast?.('Hành động bị chặn: Không thể khóa Quản trị viên duy nhất của hệ thống!', 'error');
      return;
    }

    if (isSelf && isTargetAdmin) {
      showToast?.('Hành động bị chặn: Bạn không thể tự khóa tài khoản Quản trị viên của chính mình!', 'error');
      return;
    }

    if (isActive) {
      // Show confirmation modal before locking
      setShowSuspendModal(true);
    } else {
      // Direct activate
      setStatus('active');
    }
  };

  // Save changes handler
  const handleSaveChanges = async (e) => {
    e?.preventDefault();
    if (!staff) return;

    const cleanName = name.trim();
    if (!cleanName) {
      setValidationError('Họ và tên nhân viên không được để trống!');
      showToast?.('Họ và tên nhân viên không được để trống!', 'error');
      return;
    }
    setValidationError('');

    setIsSubmitting(true);
    try {
      const result = await saveStaffMember({
        id: staff.id,
        name: cleanName,
        phone: phone.trim(),
        email: staff.email || profile.email || '',
        role: staff.role || 'staff',
        branchId,
        shiftName,
        status,
        avatarUrl,
        notes: notes.trim()
      });

      if (result?.success !== false) {
        // Sync with cloud SSOT
        if (typeof syncStaffWithCloud === 'function') {
          syncStaffWithCloud();
        }
        navigate('/staff/list');
      }
    } catch (err) {
      console.error('Lỗi khi lưu profile nhân viên:', err);
      showToast?.(err?.message || 'Có lỗi xảy ra khi lưu thông tin nhân viên!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Empty state if staff not found
  if (!staff) {
    return (
      <div className="space-y-4 animate-fadeIn" data-testid="staff-edit-not-found">
        <div className="flex items-center pb-2 border-b border-gray-100">
          <button
            type="button"
            data-testid="staff-edit-back-btn"
            onClick={() => navigate('/staff/list')}
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="ml-2.5">
            <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
              Hồ sơ Nhân viên
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Không tìm thấy thông tin</p>
          </div>
        </div>

        <div className="p-8 text-center bg-white rounded-[22px] border border-gray-100 shadow-[0_6px_18px_rgba(20,55,35,0.07)] space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-sm font-bold text-gray-800">Không tìm thấy nhân viên</h3>
          <p className="text-xs text-gray-500">Tài khoản này có thể đã bị xóa hoặc đường dẫn không hợp lệ.</p>
          <button
            type="button"
            onClick={() => navigate('/staff/list')}
            className="px-4 py-2 bg-[#214E34] text-white rounded-xl text-xs font-bold hover:bg-[#1a3d28] active:scale-95 transition-all cursor-pointer shadow-md"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  const staffCode = getStaffDisplayCode(staff);
  const initials = getStaffInitials(staff.name);
  const currentAvatar = avatarUrl || staff.avatarUrl || profile.avatarUrl;
  const isOnline = isStaffOnline?.(staff.id);

  return (
    <div
      data-testid="staff-edit-profile-page"
      className="space-y-4 pb-28 animate-fadeIn"
    >
      {/* ========================================================= */}
      {/* 1. HEADER ĐỒNG BỘ VỚI CÁC TRANG QUẢN TRỊ GÓC POS            */}
      {/* ========================================================= */}
      <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-testid="staff-edit-back-btn"
            onClick={handleBackClick}
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
            aria-label="Quay lại danh sách nhân viên"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-[#214E34] tracking-tight leading-none">
              Chỉnh sửa Profile
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Hồ sơ & quyền truy cập • {staffCode}
            </p>
          </div>
        </div>

        {/* Unsaved indicator */}
        {isDirty && (
          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 animate-pulse">
            Chưa lưu
          </span>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. 3D HERO CARD: AVATAR, TÊN, CODE, ROLE, STATUS, PRESENCE  */}
      {/* ========================================================= */}
      <div
        data-testid="staff-edit-hero-card"
        className="relative overflow-hidden rounded-[22px] bg-gradient-to-b from-[#EAF5ED]/70 via-white to-white border border-white/80 shadow-[0_6px_18px_rgba(20,55,35,0.07),0_2px_5px_rgba(20,55,35,0.04)] p-4.5 flex flex-col items-center text-center space-y-3"
      >
        {/* Subtle decorative glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#214E34]/5 rounded-full blur-2xl pointer-events-none" />

        {/* Large 80px Avatar with Camera Action */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-[#214E34] text-white flex items-center justify-center font-black text-xl shadow-[0_4px_12px_rgba(20,55,35,0.15)] ring-3 ring-emerald-500/25">
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={staff.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          {/* Online / Presence status dot on avatar */}
          <span
            className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
              status !== 'active'
                ? 'bg-rose-500'
                : isOnline
                ? 'bg-emerald-500'
                : 'bg-gray-400'
            }`}
            title={
              status !== 'active'
                ? 'Tài khoản đang bị tạm khóa'
                : isOnline
                ? 'Đang online realtime'
                : 'Offline'
            }
          />

          {/* Camera upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-avatar-btn"
            className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#214E34] text-white shadow-md hover:bg-[#1a3d28] active:scale-90 transition-all cursor-pointer border-2 border-white"
            title="Tải ảnh đại diện mới (tối đa 2MB)"
            aria-label="Tải ảnh đại diện mới"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFileSelect}
          />
        </div>

        {/* Remove photo option if avatar exists */}
        {currentAvatar && (
          <button
            type="button"
            onClick={handleRemoveAvatar}
            className="text-[10.5px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Gỡ ảnh đại diện</span>
          </button>
        )}

        {/* Name & Code */}
        <div className="space-y-1 w-full">
          <h3 className="text-base font-black text-gray-900 tracking-tight leading-snug">
            {name || staff.name}
          </h3>
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <span className="font-mono text-[11px] font-bold text-gray-600 bg-gray-100/90 px-2 py-0.5 rounded-full border border-gray-200/60 shadow-2xs">
              {staffCode}
            </span>

            {/* Read-only Role Badge */}
            <span
              data-testid="hero-role-badge"
              className={`text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs ${
                staff.role === 'admin'
                  ? 'bg-emerald-50 text-[#214E34] border-[#214E34]/30'
                  : staff.role === 'manager'
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {staff.role === 'admin' ? 'Quản lý (Admin)' : staff.role === 'manager' ? 'Cửa hàng trưởng' : 'Thu ngân (Staff)'}
            </span>
          </div>
        </div>

        {/* Badges row: Account status + Online presence */}
        <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
          {/* Account status badge */}
          {status === 'active' ? (
            <span
              data-testid="badge-hero-status-active"
              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1 shadow-2xs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Đang hoạt động</span>
            </span>
          ) : (
            <span
              data-testid="badge-hero-status-suspended"
              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 flex items-center gap-1 shadow-2xs"
            >
              <Lock className="w-2.5 h-2.5" />
              <span>Tạm khóa</span>
            </span>
          )}

          {/* Realtime Presence status */}
          {status !== 'active' ? (
            <span
              data-testid="badge-hero-presence-locked"
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200"
            >
              Đã khóa truy cập
            </span>
          ) : isOnline ? (
            <span
              data-testid="badge-hero-presence-online"
              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1 shadow-2xs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Đang online</span>
            </span>
          ) : (
            <span
              data-testid="badge-hero-presence-offline"
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200"
            >
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Validation alert banner */}
      {validationError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{validationError}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. FORM CHIA THÀNH 4 NHÓM CARD 3D NHẸ                      */}
      {/* ========================================================= */}
      <form onSubmit={handleSaveChanges} className="space-y-3.5">
        {/* CARD 1: THÔNG TIN CÁ NHÂN */}
        <div className="p-4 rounded-[20px] bg-white border border-gray-100/90 shadow-[0_6px_18px_rgba(20,55,35,0.06),0_2px_5px_rgba(20,55,35,0.03)] space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
            <div className="w-6 h-6 rounded-lg bg-[#214E34]/10 text-[#214E34] flex items-center justify-center">
              <User className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">
              Thông tin cá nhân
            </h4>
          </div>

          {/* Họ và tên */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-700 flex items-center justify-between">
              <span>Họ và tên <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-gray-400 font-normal">Bắt buộc</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationError) setValidationError('');
              }}
              placeholder="Nhập họ và tên nhân viên..."
              data-testid="input-staff-name"
              className="w-full h-11 px-3.5 bg-[#F5F7F8] border border-gray-200/80 rounded-xl focus:bg-white focus:outline-none focus:border-[#214E34] focus:ring-1 focus:ring-[#214E34]/20 text-xs font-semibold text-gray-900 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]"
            />
          </div>

          {/* Mã nhân viên (Read-only) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-700 flex items-center justify-between">
              <span>Mã nhân viên</span>
              <span className="text-[10px] text-gray-400 font-normal flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> Chỉ đọc
              </span>
            </label>
            <div
              data-testid="input-staff-code-readonly"
              className="w-full h-11 px-3.5 bg-gray-100/70 border border-gray-200/60 rounded-xl flex items-center justify-between text-xs font-mono font-bold text-gray-600 select-all"
            >
              <span>{staffCode}</span>
              <Lock className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <p className="text-[10px] text-gray-400 italic">Mã định danh nội bộ do hệ thống quản lý tự động.</p>
          </div>
        </div>

        {/* CARD 2: THÔNG TIN LIÊN HỆ */}
        <div className="p-4 rounded-[20px] bg-white border border-gray-100/90 shadow-[0_6px_18px_rgba(20,55,35,0.06),0_2px_5px_rgba(20,55,35,0.03)] space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
            <div className="w-6 h-6 rounded-lg bg-[#214E34]/10 text-[#214E34] flex items-center justify-center">
              <Phone className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">
              Thông tin liên hệ
            </h4>
          </div>

          {/* Số điện thoại */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-700">
              Số điện thoại liên hệ
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0912345678"
                data-testid="input-staff-phone"
                className="w-full h-11 pl-9 pr-3.5 bg-[#F5F7F8] border border-gray-200/80 rounded-xl focus:bg-white focus:outline-none focus:border-[#214E34] focus:ring-1 focus:ring-[#214E34]/20 text-xs font-semibold text-gray-900 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]"
              />
              <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3.5" />
            </div>
          </div>

          {/* Email đăng nhập (Read-only) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-700 flex items-center justify-between">
              <span>Email tài khoản Auth</span>
              <span className="text-[10px] text-gray-400 font-normal flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> Chỉ đọc
              </span>
            </label>
            <div
              data-testid="input-staff-email-readonly"
              className="w-full h-11 pl-9 pr-3.5 bg-gray-100/70 border border-gray-200/60 rounded-xl flex items-center justify-between text-xs font-medium text-gray-600 relative select-all"
            >
              <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3.5" />
              <span className="truncate">{staff.email || profile.email || 'Chưa liên kết email'}</span>
              <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-2" />
            </div>
            <p className="text-[10px] text-gray-400 italic">
              Email dùng để đăng nhập Supabase Auth.
            </p>
          </div>
        </div>

        {/* CARD: THÔNG TIN ĐĂNG NHẬP & BẢO MẬT (CHỈ QUẢN TRỊ VIÊN) */}
        {isAdmin && (
          <div
            data-testid="admin-credentials-card"
            className="p-4 rounded-[20px] bg-white border border-gray-100/90 shadow-[0_6px_18px_rgba(20,55,35,0.06),0_2px_5px_rgba(20,55,35,0.03)] space-y-3.5"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#214E34]/10 text-[#214E34] flex items-center justify-center">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">
                  Thông tin đăng nhập & Bảo mật
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF5ED] text-[#214E34] border border-[#214E34]/20 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" />
                <span>Chỉ Admin</span>
              </span>
            </div>

            {/* Current Email Display */}
            <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-200/70 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] text-gray-400 font-medium">Email đăng nhập hiện tại</div>
                <div className="text-xs font-mono font-bold text-gray-900 truncate">
                  {staff.email || profile.email || 'Chưa thiết lập'}
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Auth SSOT
              </span>
            </div>

            {/* Action toggles: Đổi Email / Đặt lại Mật khẩu */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                data-testid="toggle-change-email-btn"
                onClick={() => {
                  setShowChangeEmail(!showChangeEmail);
                  if (credentialFormError) setCredentialFormError('');
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  showChangeEmail
                    ? 'bg-[#EAF5ED] border-[#214E34] text-[#214E34] ring-2 ring-[#214E34]/15 shadow-2xs'
                    : 'bg-gray-50 text-gray-700 border-gray-200/80 hover:bg-gray-100'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{showChangeEmail ? 'Đang đổi Email' : 'Đổi Email'}</span>
              </button>

              <button
                type="button"
                data-testid="toggle-reset-password-btn"
                onClick={() => {
                  setShowResetPassword(!showResetPassword);
                  if (credentialFormError) setCredentialFormError('');
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  showResetPassword
                    ? 'bg-[#EAF5ED] border-[#214E34] text-[#214E34] ring-2 ring-[#214E34]/15 shadow-2xs'
                    : 'bg-gray-50 text-gray-700 border-gray-200/80 hover:bg-gray-100'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>{showResetPassword ? 'Đang đặt MK' : 'Đặt lại Mật khẩu'}</span>
              </button>
            </div>

            {/* Error in credential form */}
            {credentialFormError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{credentialFormError}</span>
              </div>
            )}

            {/* Form Đổi Email */}
            {showChangeEmail && (
              <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#214E34]/20 space-y-2.5 animate-fadeIn">
                <label className="text-[11px] font-bold text-gray-700 flex items-center justify-between">
                  <span>Địa chỉ Email mới</span>
                  <span className="text-[10px] text-gray-400">Kiểm tra trùng lặp tự động</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      if (credentialFormError) setCredentialFormError('');
                    }}
                    placeholder="nhanvien_moi@gocpos.vn"
                    data-testid="input-new-email"
                    className="w-full h-10 pl-9 pr-3.5 bg-white border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#214E34] text-xs font-medium text-gray-900 shadow-2xs"
                  />
                  <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                </div>
              </div>
            )}

            {/* Form Đặt lại Mật khẩu */}
            {showResetPassword && (
              <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#214E34]/20 space-y-2.5 animate-fadeIn">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 flex items-center justify-between">
                    <span>Mật khẩu mới</span>
                    <span className="text-[10px] text-gray-400">Tối thiểu 6 ký tự</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (credentialFormError) setCredentialFormError('');
                      }}
                      placeholder="Nhập mật khẩu mới..."
                      data-testid="input-new-password"
                      className="w-full h-10 pl-9 pr-10 bg-white border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#214E34] text-xs font-medium text-gray-900 shadow-2xs"
                    />
                    <Key className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                    <button
                      type="button"
                      data-testid="toggle-show-new-password"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors p-0.5 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password strength meter */}
                  {newPassword && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-500 font-medium">Độ mạnh:</span>
                        <span className={`font-bold ${getPasswordStrength(newPassword).color}`}>
                          {getPasswordStrength(newPassword).label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${getPasswordStrength(newPassword).percent} ${getPasswordStrength(newPassword).barColor}`} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm new password */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 flex items-center justify-between">
                    <span>Xác nhận mật khẩu mới</span>
                    {confirmNewPassword && (
                      <span className={`text-[10px] font-bold ${newPassword === confirmNewPassword ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {newPassword === confirmNewPassword ? '✓ Khớp' : '✕ Chưa khớp'}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => {
                        setConfirmNewPassword(e.target.value);
                        if (credentialFormError) setCredentialFormError('');
                      }}
                      placeholder="Nhập lại mật khẩu mới..."
                      data-testid="input-confirm-new-password"
                      className="w-full h-10 pl-9 pr-10 bg-white border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#214E34] text-xs font-medium text-gray-900 shadow-2xs"
                    />
                    <Key className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                    <button
                      type="button"
                      data-testid="toggle-show-confirm-new-password"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors p-0.5 cursor-pointer"
                    >
                      {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Execute Credential Change Button */}
            {(showChangeEmail || showResetPassword) && (
              <button
                type="button"
                data-testid="btn-submit-credentials"
                onClick={handleRequestUpdateCredentials}
                className="w-full py-2.5 px-3 rounded-xl bg-[#214E34] hover:bg-[#1a3d28] text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Xác nhận cập nhật thông tin đăng nhập</span>
              </button>
            )}

            <p className="text-[10px] text-gray-400 italic">
              🔒 Thao tác thay đổi email hoặc mật khẩu yêu cầu xác thực lại mật khẩu của Quản trị viên (Admin Re-authentication) để đảm bảo an toàn.
            </p>
          </div>
        )}

        {/* CARD 3: THÔNG TIN CÔNG VIỆC */}
        <div className="p-4 rounded-[20px] bg-white border border-gray-100/90 shadow-[0_6px_18px_rgba(20,55,35,0.06),0_2px_5px_rgba(20,55,35,0.03)] space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
            <div className="w-6 h-6 rounded-lg bg-[#214E34]/10 text-[#214E34] flex items-center justify-center">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">
              Thông tin công việc
            </h4>
          </div>

          {/* Chi nhánh */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-700">Chi nhánh trực thuộc</label>
            <div className="w-full h-11 px-3.5 bg-gray-100/70 border border-gray-200/60 rounded-xl flex items-center justify-between text-xs font-semibold text-gray-700">
              <span>Chi nhánh chính - GÓC Coffee (Quận 1, TP.HCM)</span>
              <span className="text-[10px] text-gray-400 font-mono">DEFAULT</span>
            </div>
          </div>

          {/* Ca làm việc */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-700">Ca làm việc chỉ định</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: 'Ca Sáng (06:30 - 14:30)', label: 'Ca Sáng', time: '06:30 - 14:30' },
                { id: 'Ca Chiều (14:00 - 22:00)', label: 'Ca Chiều', time: '14:00 - 22:00' },
                { id: 'Ca Tối (17:00 - 23:00)', label: 'Ca Tối', time: '17:00 - 23:00' },
                { id: 'Ca Linh hoạt (Theo lịch)', label: 'Linh hoạt', time: 'Lịch tuần' }
              ].map((shift) => {
                const isSelected = shiftName === shift.id;
                return (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => setShiftName(shift.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#EAF5ED] border-[#214E34] text-[#214E34] shadow-2xs font-bold'
                        : 'bg-[#F5F7F8] border-gray-200/80 text-gray-700 hover:bg-gray-100 font-medium'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold leading-tight">{shift.label}</div>
                      <div className="text-[10px] opacity-75">{shift.time}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 stroke-[2.5]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ghi chú nội bộ */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-700">Ghi chú nội bộ</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú kỹ năng, trách nhiệm hoặc phân công đặc thù..."
              maxLength={200}
              data-testid="input-staff-notes"
              className="w-full p-2.5 bg-[#F5F7F8] border border-gray-200/80 rounded-xl focus:bg-white focus:outline-none focus:border-[#214E34] focus:ring-1 focus:ring-[#214E34]/20 text-xs font-medium text-gray-900 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] resize-none"
            />
            <div className="text-right text-[10px] text-gray-400">
              {notes.length}/200 ký tự
            </div>
          </div>
        </div>

        {/* CARD 4: QUYỀN SỬ DỤNG TÀI KHOẢN (SWITCH HOẠT ĐỘNG / TẠM KHÓA) */}
        <div className="p-4 rounded-[20px] bg-white border border-gray-100/90 shadow-[0_6px_18px_rgba(20,55,35,0.06),0_2px_5px_rgba(20,55,35,0.03)] space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
            <div className="w-6 h-6 rounded-lg bg-[#214E34]/10 text-[#214E34] flex items-center justify-center">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">
              Quyền sử dụng tài khoản
            </h4>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50/80 border border-gray-200/70">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-gray-900">
                    Trạng thái hoạt động
                  </span>
                  <span
                    className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full border ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {isActive ? 'Được phép dùng POS' : 'Bị tạm khóa'}
                  </span>
                </div>
                <p className="text-[10.5px] text-gray-500 mt-0.5">
                  {isActive
                    ? 'Tài khoản được đăng nhập, nhận ca và thao tác bán hàng bình thường.'
                    : 'Tài khoản bị chặn mọi quyền truy cập và thao tác bán hàng POS.'}
                </p>
              </div>

              {/* Status Switch (Admin-only guard) */}
              {!isAdmin ? (
                <div
                  title="Chỉ Quản trị viên (Admin) mới có quyền bật/tắt tài khoản"
                  className="flex items-center gap-1 text-[10.5px] text-gray-400 font-bold p-1"
                >
                  <Lock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Khóa</span>
                </div>
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  aria-label="Bật hoặc tạm khóa quyền sử dụng tài khoản"
                  data-testid="toggle-staff-status-switch"
                  onClick={handleStatusToggle}
                  disabled={isLastActiveAdmin || (isSelf && isTargetAdmin)}
                  title={
                    isLastActiveAdmin
                      ? 'Không thể khóa Quản trị viên duy nhất của hệ thống'
                      : isSelf && isTargetAdmin
                      ? 'Bạn không thể tự khóa tài khoản của chính mình'
                      : isActive
                      ? 'Nhấn để tạm khóa tài khoản'
                      : 'Nhấn để kích hoạt lại tài khoản'
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                    isActive ? 'bg-emerald-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                      isActive ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              )}
            </div>

            {/* Manager disclaimer if not admin */}
            {!isAdmin && (
              <p className="text-[10.5px] text-amber-700 bg-amber-50/80 p-2 rounded-lg border border-amber-200/60 font-medium">
                Cửa hàng trưởng (Manager) chỉ có quyền xem trạng thái. Vui lòng liên hệ Quản trị viên (Admin) để khóa hoặc kích hoạt tài khoản.
              </p>
            )}

            {/* Safeguard warnings for Admin */}
            {isAdmin && isLastActiveAdmin && (
              <p className="text-[10.5px] text-rose-700 bg-rose-50/80 p-2 rounded-lg border border-rose-200/60 font-medium">
                Đây là tài khoản Quản trị viên (Admin) đang hoạt động duy nhất. Hệ thống không cho phép khóa tài khoản này.
              </p>
            )}
            {isAdmin && isSelf && isTargetAdmin && !isLastActiveAdmin && (
              <p className="text-[10.5px] text-amber-700 bg-amber-50/80 p-2 rounded-lg border border-amber-200/60 font-medium">
                Bạn đang đăng nhập bằng tài khoản này. Để đảm bảo an toàn phiên làm việc, bạn không thể tự khóa chính mình.
              </p>
            )}
          </div>
        </div>
      </form>

      {/* ========================================================= */}
      {/* 4. PINNED ACTION FOOTER: LƯU THAY ĐỔI (SOFT 3D)           */}
      {/* ========================================================= */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] z-40 max-w-md mx-auto">
        <button
          type="button"
          onClick={handleSaveChanges}
          disabled={!isDirty || isSubmitting}
          data-testid="save-profile-btn"
          className="w-full h-12 rounded-2xl bg-[#214E34] hover:bg-[#1a3d28] text-white font-black text-sm tracking-wide shadow-[0_4px_14px_rgba(33,78,52,0.25)] active:scale-[0.985] active:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Đang lưu thay đổi...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Lưu thay đổi</span>
            </>
          )}
        </button>
      </div>

      {/* Modal xác nhận rời đi khi có thay đổi chưa lưu */}
      <UnsavedChangesModal
        isOpen={showExitModal}
        onStay={() => setShowExitModal(false)}
        onDiscard={() => {
          setShowExitModal(false);
          navigate('/staff/list');
        }}
      />

      {/* Modal xác nhận tạm khóa tài khoản */}
      <AdminReauthModal
        isOpen={showAdminReauthModal}
        onClose={() => {
          setShowAdminReauthModal(false);
          setReauthErrorMessage('');
        }}
        onConfirm={handleConfirmAdminReauth}
        targetStaffName={staff?.name || 'nhân viên'}
        actionDescription={
          showChangeEmail && showResetPassword
            ? 'đổi email đăng nhập và đặt lại mật khẩu'
            : showChangeEmail
            ? 'đổi email đăng nhập'
            : 'đặt lại mật khẩu'
        }
        isSubmitting={isSubmittingCredentials}
        errorMessage={reauthErrorMessage}
      />

      <SuspendStaffConfirmModal
        isOpen={showSuspendModal}
        staff={staff}
        onClose={() => setShowSuspendModal(false)}
        onConfirm={async () => {
          setStatus('suspended');
          setShowSuspendModal(false);
          showToast?.(`Đã đánh dấu tạm khóa tài khoản ${staff.name}. Nhấn "Lưu thay đổi" để hoàn tất.`, 'info');
        }}
      />
    </div>
  );
}
