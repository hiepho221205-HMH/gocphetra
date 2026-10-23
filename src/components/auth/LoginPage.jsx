import React, { useState, useEffect } from 'react';
import { usePos } from '../../store/PosContext';
import { Coffee, Mail, Lock, Eye, EyeOff, AlertCircle, ShieldAlert, CheckCircle, HelpCircle, ArrowRight, Loader2, Sparkles } from 'lucide-react';
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
    <main id="main-content" tabIndex="-1" className="h-[100dvh] max-h-[100dvh] w-full bg-[#EAEFEA] flex flex-col items-center justify-center p-0 sm:py-3 sm:px-4 font-sans select-none overflow-hidden">
      {/* Mobile Device Frame Container (Fixed 390px default mockup with rounded frame & speaker notch) */}
      <div className="w-full max-w-[400px] h-[100dvh] max-h-[100dvh] sm:h-[844px] sm:max-h-[92vh] sm:rounded-[40px] sm:border-[8px] sm:border-[#1E2E22] ambient-clay-bg flex flex-col relative shadow-2xl overflow-hidden transition-all">
        
        {/* Mobile Mockup Speaker Notch */}
        <div className="hidden sm:flex items-center justify-center pt-2.5 pb-1 bg-white/60 backdrop-blur-md shrink-0 border-b border-black/5">
          <div className="w-20 h-4 bg-[#1E2E22] rounded-full flex items-center justify-end px-2 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-forest-900 border border-white/20"></span>
          </div>
        </div>

        {/* Ambient Pastel Lighting Glows (Reference Image 1 & 2) */}
        <div className="absolute top-0 -left-10 w-52 h-52 bg-rose-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 -right-10 w-60 h-60 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-64 h-64 bg-emerald-200/35 rounded-full blur-3xl pointer-events-none" />

        {/* Scrollable Form Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-between px-5 pt-6 pb-6 overflow-y-auto no-scrollbar">
          
          {/* Header Brand */}
          <div className="text-center pt-1">
            {/* 3D Tactile Brand Icon Disc */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl clay-disc-forest shadow-float mb-3">
              <Coffee className="w-10 h-10 text-white stroke-[2.3]" />
            </div>
            
            <h1 className="text-2xl font-black text-forest-900 tracking-tight leading-tight">
              GÓC <span className="font-semibold text-forest-600 text-lg">• Phê & Trà</span>
            </h1>
            <p className="text-gray-500 text-xs font-semibold mt-1">
              Hệ thống POS Vận hành & Bán hàng
            </p>
          </div>

          {/* Login Card (Soft UI / Claymorphic #FFFFFF Card with deep soft shadow) */}
          <div className="clay-card p-6 mt-3 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-forest-900 tracking-tight">
                  Đăng nhập ca
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#E8F3EB] text-forest-800 border border-emerald-200 uppercase tracking-wider">
                  Nội bộ
                </span>
              </div>
              <p className="text-[11.5px] text-gray-500 mt-0.5">
                Nhập tài khoản nhân viên được cấp để mở ca làm việc
              </p>
            </div>

            {/* Error Notification Alert */}
            {(errorMessage || authError) && (
              <div
                role="alert"
                className="bg-red-50/90 border border-red-200 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-red-700 animate-fadeIn shadow-xs"
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

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Email Input */}
              <div className="space-y-1">
                <label htmlFor="login-email" className="text-[11.5px] font-bold text-gray-700 block">
                  Email nhân viên
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    id="login-email" data-testid="login-email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin01@gocpos.vn"
                    autoComplete="email"
                    disabled={isSubmitting || lockoutTimer > 0}
                    className="w-full pl-10 pr-3.5 py-3 clay-input text-gray-800 text-sm font-medium placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-[11.5px] font-bold text-gray-700">
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowForgotModal(true);
                    }}
                    className="text-[11px] text-forest-700 hover:text-forest-900 font-bold hover:underline cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="login-password" data-testid="login-password-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    autoComplete="current-password"
                    disabled={isSubmitting || lockoutTimer > 0}
                    className="w-full pl-10 pr-11 py-3 clay-input text-gray-800 text-sm font-medium placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowPassword(!showPassword);
                    }}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Primary 3D Pill CTA */}
              <button
                type="submit"
                data-testid="login-submit-button"
                disabled={isSubmitting || lockoutTimer > 0 || !email || !password}
                className="w-full mt-2 py-3.5 clay-btn-primary disabled:opacity-50 disabled:cursor-not-allowed font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer touch-target shadow-float"
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

            {/* Quick-fill Pills for testing/convenience */}
            <div className="pt-2 border-t border-gray-100/80">
              <span className="text-[10px] font-bold text-gray-600 block mb-1.5 uppercase tracking-wider text-center">
                Tài khoản mẫu thử nghiệm
              </span>
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin01@gocpos.vn', '123456')}
                  className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-bold border border-blue-200/80 transition-colors cursor-pointer"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('manager01@gocpos.vn', '123456')}
                  className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold border border-emerald-200/80 transition-colors cursor-pointer"
                >
                  Quản lý
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('staff01@gocpos.vn', '123456')}
                  className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 text-[11px] font-bold border border-amber-200/80 transition-colors cursor-pointer"
                >
                  Thu ngân
                </button>
              </div>
            </div>
          </div>

          {/* Footer Security Badge */}
          <div className="text-center pt-3 pb-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full clay-pill text-forest-800 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Bảo mật Supabase Auth • Phân quyền RBAC</span>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">
              GÓC POS v1.0 • Chỉ dành cho nhân sự nội bộ quán
            </p>
          </div>
        </div>

        {/* Forgot Password / In-store Help Modal */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
            <div className="clay-card w-full max-w-sm p-6 space-y-4 text-center">
              <div className="w-14 h-14 rounded-3xl clay-disc-green mx-auto flex items-center justify-center">
                <HelpCircle className="w-7 h-7 text-white stroke-[2.3]" />
              </div>
              <div>
                <h3 className="font-black text-forest-900 text-lg">
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
                  className="w-full py-3 clay-btn-primary font-bold text-xs touch-target"
                >
                  Đã hiểu, quay lại đăng nhập
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
