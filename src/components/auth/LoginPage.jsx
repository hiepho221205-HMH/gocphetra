import React, { useState, useEffect } from 'react';
import { usePos } from '../../store/PosContext';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ShieldAlert, HelpCircle, ArrowRight, Loader2 } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export default function LoginPage() {
  const { loginWithEmail, authError, isAuthLoading } = usePos();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Brute-force rate limiting: 5 failed attempts -> 30s lockout
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  useEffect(() => {
    let timer;
    if (lockoutTimer > 0) {
      timer = setInterval(() => {
        setLockoutTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTimer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutTimer > 0 || isSubmitting) return;

    triggerHaptic('medium');
    setErrorMessage('');
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Vui lòng nhập địa chỉ email');
      triggerHaptic('warning');
      return;
    }
    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu');
      triggerHaptic('warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginWithEmail(trimmedEmail, password);
      if (!res.success) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        triggerHaptic('error');

        if (nextAttempts >= 5) {
          setLockoutTimer(30);
          setErrorMessage('Bạn đã nhập sai 5 lần. Nút đăng nhập tạm khóa trong 30 giây để bảo mật.');
        } else {
          setErrorMessage(res.message || 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.');
        }
      } else {
        triggerHaptic('success');
        setFailedAttempts(0);
        setLockoutTimer(0);
      }
    } catch {
      triggerHaptic('error');
      setErrorMessage('Lỗi kết nối máy chủ xác thực. Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (roleEmail, rolePass) => {
    triggerHaptic('light');
    setEmail(roleEmail);
    setPassword(rolePass);
  };

  return (
    <main
      id="main-content"
      tabIndex="-1"
      className="relative min-h-[100dvh] w-full flex flex-col items-center justify-between p-3 sm:p-5 font-sans select-none overflow-x-hidden overflow-y-auto"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))'
      }}
    >
      {/* 1. Background Atmosphere: 3D Coffee Shop with Soft Blur */}
      <div className="fixed inset-0 z-0 pointer-events-none select-none">
        <picture>
          <source type="image/webp" srcSet="/images/login/coffee-shop-bg.webp" />
          <img
            src="/images/login/coffee-shop-bg.png"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-center filter blur-[1px] scale-[1.02]"
          />
        </picture>
        {/* Soft Ambient Overlay for Optimal Contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FEFDFB]/30 via-transparent to-[#F2EFE9]/40" />
      </div>

      {/* 2. Main Login Stack Container (Compact Mobile First) */}
      <div className="relative z-10 w-full max-w-[360px] sm:max-w-[390px] flex flex-col items-center my-auto py-1 sm:py-3">
        
        {/* A. Top Branding Header */}
        <div className="text-center mb-1 select-none">
          <h1 className="text-2xl sm:text-3xl font-black text-[#1C412C] tracking-tight leading-none drop-shadow-xs">
            GÓC POS
          </h1>
          <p className="text-[11px] sm:text-xs font-semibold text-[#526658] mt-1 tracking-normal">
            Hệ thống POS Vận hành & Bán hàng
          </p>
        </div>

        {/* B. 3D Barista Character (Mobile Scaled & Positioned Cleanly) */}
        <div className="relative z-20 flex justify-center -mb-4 sm:-mb-5 pointer-events-none select-none">
          <picture className="inline-block">
            <source type="image/webp" srcSet="/images/login/barista-3d.webp" />
            <img
              src="/images/login/barista-3d.png"
              alt="3D Coffee Barista"
              className="w-32 sm:w-40 md:w-44 h-auto max-h-[135px] object-contain drop-shadow-md select-none"
              draggable={false}
              width={160}
              height={160}
              fetchPriority="high"
            />
          </picture>
        </div>

        {/* C. Soft Clay 3D Login Card */}
        <div className="relative z-10 w-full login-card-3d bg-white p-4 sm:p-6 pt-5 sm:pt-6 space-y-3.5 shadow-xl">
          
          {/* Card Title & Subtitle */}
          <div className="text-center space-y-0.5">
            <h2 className="text-lg sm:text-xl font-black text-[#1C412C] tracking-wide uppercase">
              LOGIN
            </h2>
            <p className="text-[11px] sm:text-xs text-[#697A70] font-medium leading-relaxed">
              Nhập tài khoản nhân viên được cấp để mở ca làm việc
            </p>
          </div>

          {/* Error Notification Alert */}
          {(errorMessage || authError) && (
            <div
              role="alert"
              className="bg-red-50/95 border border-red-200/90 rounded-2xl p-2.5 flex items-start gap-2 text-xs text-red-700 animate-fadeIn shadow-xs"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-semibold leading-relaxed">
                {errorMessage || authError}
              </div>
            </div>
          )}

          {/* Lockout Countdown Alert */}
          {lockoutTimer > 0 && (
            <div
              role="alert"
              className="bg-amber-50 border border-amber-200 rounded-2xl p-2.5 flex items-center gap-2 text-xs text-amber-800 animate-pulse"
            >
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-semibold">
                Tạm khóa bảo vệ: Vui lòng đợi {lockoutTimer}s
              </span>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email Input */}
            <div className="space-y-1">
              <label htmlFor="login-email" className="text-[11px] sm:text-xs font-bold text-[#2A3B30] block">
                Email nhân viên
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8A9C92]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  id="login-email"
                  data-testid="login-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin01@gocpos.vn"
                  autoComplete="email"
                  disabled={isSubmitting || lockoutTimer > 0}
                  className="w-full pl-9 pr-3 py-2.5 login-input-3d text-[#1F2A24] text-xs sm:text-sm font-medium placeholder:text-[#95A59C]"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-[11px] sm:text-xs font-bold text-[#2A3B30]">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowForgotModal(true);
                  }}
                  className="text-[11px] text-[#255C3A] hover:text-[#193F27] font-bold hover:underline cursor-pointer transition-colors"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8A9C92]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  data-testid="login-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  autoComplete="current-password"
                  disabled={isSubmitting || lockoutTimer > 0}
                  className="w-full pl-9 pr-10 py-2.5 login-input-3d text-[#1F2A24] text-xs sm:text-sm font-medium placeholder:text-[#95A59C]"
                />
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowPassword(!showPassword);
                  }}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8A9C92] hover:text-[#4A5D52] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Primary Login Pill CTA Button */}
            <button
              type="submit"
              data-testid="login-submit-button"
              disabled={isSubmitting || lockoutTimer > 0 || !email || !password}
              className="w-full mt-1.5 py-3 rounded-full bg-gradient-to-r from-[#2B6641] to-[#1E4C30] hover:from-[#245737] hover:to-[#173B25] active:scale-[0.98] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 touch-target"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Đang xác thực...</span>
                </>
              ) : lockoutTimer > 0 ? (
                <span>Tạm khóa ({lockoutTimer}s)</span>
              ) : (
                <>
                  <span>Đăng nhập ca làm việc</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick-fill Pills for testing / demo (Compact Mobile Grid) */}
          <div className="pt-1.5">
            <div className="relative flex items-center justify-center mb-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200/70" />
              </div>
              <span className="relative px-2 bg-white text-[9px] sm:text-[10px] font-bold text-[#7E8F84] uppercase tracking-wider">
                TÀI KHOẢN MẪU THỬ NGHIỆM
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin01@gocpos.vn', '123456')}
                className="px-2 py-1.5 rounded-xl bg-[#E3EFFD] text-[#1E65CC] hover:bg-[#D5E7FC] text-[11px] sm:text-xs font-bold border border-[#C9E0FC] transition-colors cursor-pointer active:scale-95 shadow-2xs text-center truncate flex items-center justify-center gap-1"
              >
                <span>👑</span>
                <span>Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('manager01@gocpos.vn', '123456')}
                className="px-2 py-1.5 rounded-xl bg-[#E2F6EA] text-[#1A7C49] hover:bg-[#D4F1E0] text-[11px] sm:text-xs font-bold border border-[#C5EDD4] transition-colors cursor-pointer active:scale-95 shadow-2xs text-center truncate flex items-center justify-center gap-1"
              >
                <span>📋</span>
                <span>Quản lý</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('staff01@gocpos.vn', '123456')}
                className="px-2 py-1.5 rounded-xl bg-[#FEF1DF] text-[#BC670B] hover:bg-[#FDE7C9] text-[11px] sm:text-xs font-bold border border-[#FDE0BC] transition-colors cursor-pointer active:scale-95 shadow-2xs text-center truncate flex items-center justify-center gap-1"
              >
                <span>☕</span>
                <span>Thu ngân</span>
              </button>
            </div>
          </div>
        </div>

        {/* D. Footer Security Badges */}
        <div className="text-center pt-3 pb-1 space-y-0.5 select-none">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#1C412C]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
            <span>Bảo mật Supabase Auth • Phân quyền RBAC</span>
          </div>
          <p className="text-[10px] text-[#55695D] font-medium">
            GÓC POS v1.0 • Chỉ dành cho nhân sự nội bộ quán
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3.5 shadow-2xl text-center border border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-[#E2F6EA] text-[#1A7C49] flex items-center justify-center mx-auto shadow-xs">
              <HelpCircle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-black text-[#1C412C] text-base">Cấp lại mật khẩu</h3>
              <p className="text-gray-600 text-xs mt-1.5 leading-relaxed">
                Hệ thống GÓC POS vận hành nội bộ theo tài khoản được phân quyền. Vui lòng liên hệ Quản trị viên (Admin) hoặc Cửa hàng trưởng để được reset mật khẩu ca làm việc.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowForgotModal(false);
                }}
                className="w-full py-2.5 rounded-full bg-[#214E34] hover:bg-[#193F27] text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
