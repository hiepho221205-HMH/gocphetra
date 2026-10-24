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
      className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center p-3 sm:p-6 font-sans select-none overflow-x-hidden overflow-y-auto"
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

      {/* 2. Main Login Stack Container */}
      <div className="relative z-10 w-full max-w-[390px] sm:max-w-[410px] flex flex-col items-center my-auto py-3 sm:py-5">
        
        {/* A. Top Branding Header */}
        <div className="text-center mb-1 select-none">
          <h1 className="text-3xl sm:text-[34px] font-black text-[#1C412C] tracking-tight leading-none drop-shadow-xs">
            GÓC POS
          </h1>
          <p className="text-xs sm:text-[13px] font-semibold text-[#526658] mt-1.5 tracking-normal">
            Hệ thống POS Vận hành & Bán hàng
          </p>
        </div>

        {/* B. 3D Barista Character (Static Asset, Perfectly Positioned on Card Top Edge) */}
        <div className="relative z-20 flex justify-center -mb-6 sm:-mb-7 pointer-events-none select-none">
          <picture className="inline-block">
            <source type="image/webp" srcSet="/images/login/barista-3d.webp" />
            <img
              src="/images/login/barista-3d.png"
              alt="3D Coffee Barista"
              className="w-56 sm:w-64 h-auto object-contain drop-shadow-md select-none"
              draggable={false}
              width={256}
              height={256}
            />
          </picture>
        </div>

        {/* C. Soft Clay 3D Login Card */}
        <div className="relative z-10 w-full login-card-3d bg-white p-6 sm:p-7 pt-7 sm:pt-8 space-y-4">
          
          {/* Card Title & Subtitle */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl sm:text-[26px] font-black text-[#1C412C] tracking-wide uppercase">
              LOGIN
            </h2>
            <p className="text-xs sm:text-[12.5px] text-[#697A70] font-medium leading-relaxed">
              Nhập tài khoản nhân viên được cấp để mở ca làm việc
            </p>
          </div>

          {/* Error Notification Alert */}
          {(errorMessage || authError) && (
            <div
              role="alert"
              className="bg-red-50/95 border border-red-200/90 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-red-700 animate-fadeIn shadow-xs"
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
              className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-amber-800 animate-pulse"
            >
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-semibold">
                Tạm khóa bảo vệ: Vui lòng đợi {lockoutTimer}s
              </span>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Email Input */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-bold text-[#2A3B30] block">
                Email nhân viên
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A9C92]">
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
                  className="w-full pl-10 pr-3.5 py-3 login-input-3d text-[#1F2A24] text-sm font-medium placeholder:text-[#95A59C]"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-bold text-[#2A3B30]">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowForgotModal(true);
                  }}
                  className="text-xs text-[#255C3A] hover:text-[#193F27] font-bold hover:underline cursor-pointer transition-colors"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A9C92]">
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
                  className="w-full pl-10 pr-11 py-3 login-input-3d text-[#1F2A24] text-sm font-medium placeholder:text-[#95A59C]"
                />
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowPassword(!showPassword);
                  }}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8A9C92] hover:text-[#4A5D52] transition-colors cursor-pointer"
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
              className="w-full mt-2 py-3.5 rounded-full bg-gradient-to-r from-[#2B6641] to-[#1E4C30] hover:from-[#245737] hover:to-[#173B25] active:scale-[0.98] text-white font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 touch-target"
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

          {/* Quick-fill Pills for testing / demo */}
          <div className="pt-2">
            <div className="relative flex items-center justify-center mb-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200/70" />
              </div>
              <span className="relative px-3 bg-white text-[10px] font-bold text-[#7E8F84] uppercase tracking-wider">
                TÀI KHOẢN MẪU THỬ NGHIỆM
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleQuickFill('admin01@gocpos.vn', '123456')}
                className="px-3.5 py-1.5 rounded-full bg-[#E3EFFD] text-[#1E65CC] hover:bg-[#D5E7FC] text-xs font-bold border border-[#C9E0FC] transition-colors cursor-pointer active:scale-95 shadow-2xs"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('manager01@gocpos.vn', '123456')}
                className="px-3.5 py-1.5 rounded-full bg-[#E2F6EA] text-[#1A7C49] hover:bg-[#D4F1E0] text-xs font-bold border border-[#C5EDD4] transition-colors cursor-pointer active:scale-95 shadow-2xs"
              >
                Quản lý
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('staff01@gocpos.vn', '123456')}
                className="px-3.5 py-1.5 rounded-full bg-[#FEF1DF] text-[#BC670B] hover:bg-[#FDE7C9] text-xs font-bold border border-[#FDE0BC] transition-colors cursor-pointer active:scale-95 shadow-2xs"
              >
                Thu ngân
              </button>
            </div>
          </div>
        </div>

        {/* D. Footer Security Badges */}
        <div className="text-center pt-4 pb-2 space-y-1 select-none">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#1C412C]">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
            <span>Bảo mật Supabase Auth • Phân quyền RBAC</span>
          </div>
          <p className="text-[11px] text-[#55695D] font-medium">
            GÓC POS v1.0 • Chỉ dành cho nhân sự nội bộ quán
          </p>
        </div>
      </div>

      {/* 3. In-Store Help / Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="login-card-3d bg-white w-full max-w-sm p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-[#2B6641] to-[#1E4C30] text-white mx-auto flex items-center justify-center shadow-md">
              <HelpCircle className="w-7 h-7 stroke-[2.3]" />
            </div>
            <div>
              <h3 className="font-black text-[#1C412C] text-lg">
                Quên mật khẩu đăng nhập?
              </h3>
              <p className="text-gray-600 text-xs mt-2 leading-relaxed">
                GÓC POS là hệ thống bán hàng nội bộ khép kín. Để bảo đảm an toàn dữ liệu quán, nhân viên vui lòng liên hệ trực tiếp <strong>Cửa hàng trưởng (Manager)</strong> hoặc <strong>Quản trị viên (Admin)</strong> trực ca để được cấp lại mật khẩu mới.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowForgotModal(false);
                }}
                className="w-full py-3 rounded-full bg-gradient-to-r from-[#2B6641] to-[#1E4C30] hover:from-[#245737] hover:to-[#173B25] text-white font-bold text-xs touch-target shadow-md active:scale-95 transition-all"
              >
                Đã hiểu, quay lại đăng nhập
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
