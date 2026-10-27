import React, { useState, useEffect, useRef } from 'react';
import { usePos } from '../../store/PosContext';
import { getStaffInitials } from '../../utils/router';
import { uploadStaffAvatarToStorage, updateUserProfile } from '../../lib/supabase';
import {
  ArrowLeft,
  Camera,
  User,
  Shield,
  Briefcase,
  Coffee,
  Sparkles,
  Info,
  AlertTriangle,
  Lock,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  Key
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

export default function StaffCreatePage() {
  const {
    staffList = [],
    saveStaffMember,
    showToast,
    currentRole,
    userProfiles = {},
    routeParams = {},
    navigate
  } = usePos();

  const isAdmin = currentRole === 'admin';
  const fileInputRef = useRef(null);
  const selectedFileRef = useRef(null);

  // Check if we are in Edit mode via URL query param: ?edit=[id]
  const editStaffId = routeParams?.edit || null;
  const editingStaff = editStaffId ? staffList.find((s) => s.id === editStaffId) : null;
  const isEditMode = Boolean(editingStaff);

  // Target destination based on entry mode
  // If editing an existing staff member (opened from /staff/list) -> destination is /staff/list
  // If adding new staff member (opened from /staff) -> destination is /staff
  const targetDestination = isEditMode ? '/staff/list' : '/staff';

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('staff');
  const [formBranchId, setFormBranchId] = useState('main');
  const [formShiftName, setFormShiftName] = useState('Ca Sáng (06:30 - 14:30)');
  const [formStatus, setFormStatus] = useState('active');
  const [formAvatarUrl, setFormAvatarUrl] = useState(null);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Snapshot initial values to determine isDirty
  const initialValuesRef = useRef(null);

  // Initialize or populate form
  useEffect(() => {
    if (editingStaff) {
      const profile = userProfiles[editingStaff.id] || {};
      const init = {
        name: editingStaff.name || '',
        email: editingStaff.email || profile.email || '',
        phone: editingStaff.phone || profile.phone || '',
        role: editingStaff.role || 'staff',
        branchId: editingStaff.branchId || 'main',
        shiftName: editingStaff.shiftName || 'Ca Sáng (06:30 - 14:30)',
        status: editingStaff.status || 'active',
        avatarUrl: editingStaff.avatarUrl || profile.avatarUrl || null,
        notes: editingStaff.notes || profile.notes || ''
      };
      initialValuesRef.current = init;
      setFormName(init.name);
      setFormEmail(init.email);
      setFormPhone(init.phone);
      setFormRole(init.role);
      setFormBranchId(init.branchId);
      setFormShiftName(init.shiftName);
      setFormStatus(init.status);
      setFormAvatarUrl(init.avatarUrl);
      setFormNotes(init.notes);
    } else {
      const init = {
        name: '',
        email: '',
        phone: '',
        role: 'staff',
        branchId: 'main',
        shiftName: 'Ca Sáng (06:30 - 14:30)',
        status: 'active',
        avatarUrl: null,
        notes: ''
      };
      initialValuesRef.current = init;
      setFormName('');
      setFormEmail('');
      setFormPhone('');
      setFormRole('staff');
      setFormBranchId('main');
      setFormShiftName('Ca Sáng (06:30 - 14:30)');
      setFormStatus('active');
      setFormAvatarUrl(null);
      setFormNotes('');
    }
    setFormError('');
  }, [editingStaff, editStaffId, userProfiles]);

  // Determine if form has unsaved modifications
  const isDirty = Boolean(
    initialValuesRef.current && (
      formName !== initialValuesRef.current.name ||
      formEmail !== initialValuesRef.current.email ||
      formPhone !== initialValuesRef.current.phone ||
      formRole !== initialValuesRef.current.role ||
      formBranchId !== initialValuesRef.current.branchId ||
      formShiftName !== initialValuesRef.current.shiftName ||
      formStatus !== initialValuesRef.current.status ||
      formAvatarUrl !== initialValuesRef.current.avatarUrl ||
      formNotes !== initialValuesRef.current.notes ||
      (!isEditMode && (formPassword !== '' || formConfirmPassword !== ''))
    )
  );

  // Warn on tab/browser close if form is dirty
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handlePhotoUpload = async (e) => {
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

    selectedFileRef.current = file;

    if (editingStaff?.id) {
      try {
        const uploadRes = await uploadStaffAvatarToStorage(file, editingStaff.id);
        if (uploadRes && uploadRes.success && uploadRes.publicUrl) {
          setFormAvatarUrl(uploadRes.publicUrl);
          showToast?.('Đã tải ảnh lên kho lưu trữ đám mây!', 'success');
          return;
        }
      } catch (_) {}
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      if (base64) {
        setFormAvatarUrl(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRequestBack = () => {
    if (isDirty) {
      setShowExitModal(true);
    } else {
      navigate(targetDestination);
    }
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    navigate(targetDestination);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError('Vui lòng nhập họ và tên nhân viên');
      return;
    }

    const cleanPhone = formPhone.trim();
    const cleanEmail = formEmail.trim().toLowerCase();

    // Chống trùng lặp số điện thoại
    if (cleanPhone) {
      const dupPhone = staffList.find(
        (s) => s.id !== (editingStaff?.id || '') && (s.phone || '').trim() === cleanPhone
      );
      if (dupPhone) {
        setFormError(`Số điện thoại "${cleanPhone}" đã được sử dụng bởi ${dupPhone.name}!`);
        return;
      }
    }

    // Chống trùng lặp email
    if (cleanEmail) {
      const dupEmail = staffList.find(
        (s) => s.id !== (editingStaff?.id || '') && (s.email || '').trim().toLowerCase() === cleanEmail
      );
      if (dupEmail) {
        setFormError(`Email "${cleanEmail}" đã được sử dụng bởi ${dupEmail.name}!`);
        return;
      }
    }

    // Khi tạo mới: bắt buộc email hợp lệ và mật khẩu khởi tạo
    if (!isEditMode) {
      if (!cleanEmail) {
        setFormError('Vui lòng nhập Email đăng nhập cho nhân viên mới');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        setFormError('Định dạng email đăng nhập không hợp lệ!');
        return;
      }
      if (!formPassword) {
        setFormError('Vui lòng nhập mật khẩu khởi tạo cho tài khoản');
        return;
      }
      if (formPassword.length < 6) {
        setFormError('Mật khẩu đăng nhập phải có ít nhất 6 ký tự!');
        return;
      }
      if (formPassword !== formConfirmPassword) {
        setFormError('Mật khẩu xác nhận không khớp với mật khẩu đã nhập!');
        return;
      }
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (typeof saveStaffMember === 'function') {
        const result = await saveStaffMember({
          id: editingStaff ? editingStaff.id : null,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          role: isAdmin ? formRole : 'staff',
          branchId: formBranchId,
          shiftName: formShiftName,
          status: formStatus,
          avatarUrl: formAvatarUrl,
          notes: formNotes.trim(),
          password: formPassword || '123456'
        });

        if (result?.staff?.id && selectedFileRef.current && !editingStaff) {
          try {
            const uploadRes = await uploadStaffAvatarToStorage(selectedFileRef.current, result.staff.id);
            if (uploadRes?.success && uploadRes?.publicUrl) {
              await updateUserProfile(result.staff.id, { avatarUrl: uploadRes.publicUrl });
            }
          } catch (_) {}
        }
      }
      navigate(targetDestination);
    } catch (err) {
      setFormError(err.message || 'Lỗi khi lưu thông tin nhân viên');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="staff-create-page"
      className="space-y-4 animate-fadeIn"
    >
      {/* Container testid compatibility */}
      <div data-testid="staff-form-subtab" className="space-y-4">
        {/* ========================================================= */}
        {/* 1. HEADER CÓ NÚT BACK TƯỜNG MINH VỀ TRANG GỐC             */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              data-testid="cancel-staff-form-top-btn"
              onClick={handleRequestBack}
              className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
              aria-label="Quay lại"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
                {isEditMode ? 'Chỉnh sửa Nhân viên' : 'Thêm Nhân viên Mới'}
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {isEditMode
                  ? `Mã: ${editingStaff.id.toUpperCase().replace('STAFF-', 'NV-')}`
                  : 'Hồ sơ thu ngân, ca trực & thông tin liên hệ'}
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. FORM NHẬP LIỆU                                         */}
        {/* ========================================================= */}
        <form onSubmit={handleSubmit} className="space-y-3.5 bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs">
          {/* Error Banner */}
          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* A. AVATAR UPLOADER */}
          <div className="flex flex-col items-center py-1">
            <div className="relative">
              <div className="w-[72px] h-[72px] rounded-full overflow-hidden bg-[#214E34] text-white flex items-center justify-center shadow-md ring-4 ring-[#214E34]/15">
                {formAvatarUrl ? (
                  <img
                    src={formAvatarUrl}
                    alt={formName || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : formName ? (
                  <span className="text-base font-black">
                    {getStaffInitials(formName)}
                  </span>
                ) : (
                  <User className="w-9 h-9 text-white stroke-[1.8]" />
                )}
              </div>

              {/* Camera Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#009E78] text-white hover:bg-[#008766] border-2 border-white shadow-sm flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                title="Tải ảnh đại diện"
              >
                <Camera className="w-3 h-3 stroke-[2.2]" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>

            {formAvatarUrl && (
              <button
                type="button"
                onClick={() => setFormAvatarUrl(null)}
                className="mt-1 text-[11px] text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
              >
                Xóa ảnh đã chọn
              </button>
            )}
            <p className="text-[10.5px] text-gray-400 mt-1">Ảnh đại diện nhân viên (PNG, JPG tối đa 2MB)</p>
          </div>

          {/* B. HỌ VÀ TÊN */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
              <span>Họ và tên</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              data-testid="staff-input-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="VD: Trần Mai, Nguyễn Văn Hùng..."
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 text-xs font-semibold text-gray-900"
            />
          </div>

          {/* C. EMAIL ĐĂNG NHẬP */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>Email đăng nhập</span>
                {!isEditMode && <span className="text-rose-500">*</span>}
              </span>
              <span className="text-[10px] text-gray-400 font-normal">Tài khoản Supabase Auth</span>
            </label>
            <input
              type="email"
              required={!isEditMode}
              data-testid="staff-input-email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="nhanvien@gocpos.vn"
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 text-xs font-semibold text-gray-900 shadow-2xs"
            />
            <p className="text-[10px] text-gray-400">
              Email dùng để định danh và đăng nhập vào ứng dụng GÓC POS.
            </p>
          </div>

          {/* D. MẬT KHẨU KHỞI TẠO (CHỈ HIỂN THỊ KHI TẠO MỚI) */}
          {!isEditMode && (
            <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#214E34]/15 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                <div className="w-5 h-5 rounded-lg bg-[#214E34]/10 text-[#214E34] flex items-center justify-center">
                  <Key className="w-3 h-3" />
                </div>
                <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-wide">
                  Thông tin đăng nhập ban đầu
                </h4>
              </div>

              {/* Mật khẩu */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>Mật khẩu khởi tạo</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-gray-400">Tối thiểu 6 ký tự</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    data-testid="staff-input-password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Nhập mật khẩu cho nhân viên..."
                    className="w-full h-10 pl-3 pr-10 bg-white border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 text-xs font-semibold text-gray-900"
                  />
                  <button
                    type="button"
                    data-testid="toggle-show-create-password"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors p-0.5 cursor-pointer"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password strength bar */}
                {formPassword && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-500 font-medium">Độ mạnh mật khẩu:</span>
                      <span className={`font-bold ${getPasswordStrength(formPassword).color}`}>
                        {getPasswordStrength(formPassword).label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${getPasswordStrength(formPassword).percent} ${getPasswordStrength(formPassword).barColor}`} />
                    </div>
                  </div>
                )}
              </div>

              {/* Xác nhận mật khẩu */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>Xác nhận mật khẩu</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  {formConfirmPassword && (
                    <span className={`text-[10px] font-bold ${formPassword === formConfirmPassword ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {formPassword === formConfirmPassword ? '✓ Khớp' : '✕ Chưa khớp'}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    data-testid="staff-input-confirm-password"
                    value={formConfirmPassword}
                    onChange={(e) => setFormConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu để xác nhận..."
                    className="w-full h-10 pl-3 pr-10 bg-white border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 text-xs font-semibold text-gray-900"
                  />
                  <button
                    type="button"
                    data-testid="toggle-show-create-confirm-password"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors p-0.5 cursor-pointer"
                    aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-forest-50/70 border border-forest-200/60 text-[10.5px] text-forest-800 flex items-start gap-1.5 leading-snug">
                <Shield className="w-3.5 h-3.5 text-forest-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Quản trị tập trung:</strong> Chỉ Quản trị viên (Admin) mới có quyền thiết lập và thay đổi thông tin đăng nhập của nhân sự.
                </span>
              </div>
            </div>
          )}

          {/* D. SỐ ĐIỆN THOẠI */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Số điện thoại</label>
            <input
              type="tel"
              data-testid="staff-input-phone"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="09xx xxx xxx"
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 text-xs font-semibold text-gray-900"
            />
          </div>

          {/* E. VAI TRÒ (RBAC RESTRICTION) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
              <span>Vai trò hệ thống</span>
              {!isAdmin && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                  Cố định: Thu ngân
                </span>
              )}
            </label>

            {isAdmin ? (
              <div className="space-y-1.5">
                <select
                  data-testid="staff-select-role"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 text-xs font-bold text-gray-900"
                >
                  <option value="staff">Thu ngân (Staff) — Chỉ thao tác bán hàng & ca trực</option>
                  <option value="manager">Cửa hàng trưởng (Manager) — Vận hành, menu & báo cáo</option>
                  {isEditMode && editingStaff?.role === 'admin' && (
                    <option value="admin">Quản lý (Admin) — Toàn quyền hệ thống</option>
                  )}
                </select>

                {/* Ghi chú bảo mật cho Admin */}
                <div className="text-[10.5px] text-gray-500 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-forest-700" />
                  <span>
                    Khóa bảo mật: Không thể tạo thêm Quản trị viên cấp cao (Admin) từ form này.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 flex items-center justify-between">
                <span>Thu ngân (Staff)</span>
                <span className="text-[10.5px] text-gray-500 font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Cửa hàng trưởng chỉ quản lý nhân viên cấp Thu ngân
                </span>
              </div>
            )}
          </div>

          {/* F. CHI NHÁNH & CA LÀM VIỆC */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Chi nhánh</label>
              <select
                data-testid="staff-select-branch"
                value={formBranchId}
                onChange={(e) => setFormBranchId(e.target.value)}
                className="w-full h-10 px-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 text-xs font-semibold text-gray-900"
              >
                <option value="main">Chi nhánh Chính (Q.1)</option>
                <option value="branch-2">Chi nhánh 2 (Q.3)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Ca làm việc</label>
              <select
                data-testid="staff-select-shift"
                value={formShiftName}
                onChange={(e) => setFormShiftName(e.target.value)}
                className="w-full h-10 px-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 text-xs font-semibold text-gray-900"
              >
                <option value="Ca Sáng (06:30 - 14:30)">Ca Sáng (06:30 - 14:30)</option>
                <option value="Ca Chiều (14:30 - 22:30)">Ca Chiều (14:30 - 22:30)</option>
                <option value="Ca Tối (17:00 - 23:00)">Ca Tối (17:00 - 23:00)</option>
                <option value="Full-time (08:00 - 17:00)">Full-time (08:00 - 17:00)</option>
              </select>
            </div>
          </div>

          {/* G. TRẠNG THÁI HOẠT ĐỘNG */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Trạng thái tài khoản</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="staff-status-active"
                onClick={() => setFormStatus('active')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  formStatus === 'active'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Đang hoạt động</span>
              </button>

              <button
                type="button"
                data-testid="staff-status-paused"
                onClick={() => setFormStatus('paused')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  formStatus === 'paused'
                    ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-500/20'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Tạm khóa</span>
              </button>
            </div>
          </div>

          {/* H. GHI CHÚ */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Ghi chú nhân sự</label>
            <textarea
              rows={2}
              data-testid="staff-input-notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Kinh nghiệm pha chế, bằng cấp, ghi chú nội bộ..."
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 text-xs font-medium text-gray-900 resize-none"
            />
          </div>

          {/* I. BUTTONS: SUBMIT & CANCEL */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              data-testid="cancel-staff-form-btn"
              onClick={handleRequestBack}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="submit-staff-form-btn"
              className="flex-1 py-2.5 rounded-xl bg-[#214E34] hover:bg-[#1E3D29] text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isEditMode ? 'Lưu thay đổi' : 'Thêm nhân viên'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================= */}
      {/* 3. MODAL XÁC NHẬN HỦY THAY ĐỔI CHƯA LƯU (DIRTY FORM MODAL) */}
      {/* ========================================================= */}
      {showExitModal && (
        <div
          data-testid="unsaved-changes-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
        >
          <div className="w-full max-w-[340px] bg-white rounded-2xl p-5 shadow-2xl border border-gray-100 space-y-4 animate-scaleUp">
            {/* Header warning icon */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/80">
                <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900 tracking-tight leading-tight">
                  Thay đổi chưa lưu
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Bạn có chắc chắn muốn rời khỏi?
                </p>
              </div>
            </div>

            {/* Warning Message */}
            <p className="text-xs text-gray-600 font-medium leading-relaxed">
              Các thông tin nhân sự bạn vừa nhập chưa được lưu lại. Nếu rời khỏi bây giờ, toàn bộ thay đổi sẽ bị hủy.
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                data-testid="confirm-discard-changes-btn"
                onClick={handleConfirmExit}
                className="flex-1 py-2.5 px-3 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-bold active:scale-95 transition-all cursor-pointer text-center"
              >
                Hủy thay đổi
              </button>
              <button
                type="button"
                data-testid="stay-on-form-btn"
                onClick={() => setShowExitModal(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#214E34] hover:bg-[#1E3D29] text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer text-center"
              >
                Ở lại chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
