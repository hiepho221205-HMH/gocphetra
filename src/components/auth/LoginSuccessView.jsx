import React, { useState, useEffect, useRef } from 'react';
import { Check, ArrowRight, Crown, Users, User, ShieldAlert, BarChart3, ClipboardCheck, Coffee, Monitor } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

const ROLE_CONFIGS = {
  admin: {
    roleBadge: 'ADMIN',
    icon: Crown,
    badgeBg: 'bg-[#E2F6EA] text-[#1A7C49] border-[#C5EDD4]',
    imageWebp: '/images/login-success/admin-3d.webp',
    imagePng: '/images/login-success/admin-3d.png',
    title: 'ĐĂNG NHẬP THÀNH CÔNG',
    defaultName: 'Trần Mai',
    greetingLine1: 'Chào mừng bạn quay trở lại!',
    greetingLine2: 'Bạn đã đăng nhập với quyền quản trị hệ thống.',
    destRoute: '/tables',
    buttonText: 'BẮT ĐẦU',
    decorLeft: {
      icon: Crown,
      color: 'bg-amber-100 text-amber-700 border-amber-200/80',
      pos: 'top-6 -left-3 sm:left-1'
    },
    decorRight: {
      icon: BarChart3,
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200/80',
      pos: 'top-10 -right-3 sm:right-1'
    }
  },
  manager: {
    roleBadge: 'QUẢN LÝ',
    icon: Users,
    badgeBg: 'bg-[#E2F6EA] text-[#1A7C49] border-[#C5EDD4]',
    imageWebp: '/images/login-success/manager-3d.webp',
    imagePng: '/images/login-success/manager-3d.png',
    title: 'ĐĂNG NHẬP THÀNH CÔNG',
    defaultName: 'Nguyễn Văn Hùng',
    greetingLine1: 'Chào mừng bạn quay trở lại!',
    greetingLine2: 'Bạn đã đăng nhập với quyền quản lý cửa hàng.',
    destRoute: '/tables',
    buttonText: 'BẮT ĐẦU',
    decorLeft: {
      icon: ClipboardCheck,
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200/80',
      pos: 'top-8 -left-3 sm:left-1'
    },
    decorRight: {
      icon: Users,
      color: 'bg-teal-100 text-teal-800 border-teal-200/80',
      pos: 'top-6 -right-3 sm:right-1'
    }
  },
  staff: {
    roleBadge: 'NHÂN VIÊN',
    icon: User,
    badgeBg: 'bg-[#E2F6EA] text-[#1A7C49] border-[#C5EDD4]',
    imageWebp: '/images/login-success/staff-3d.webp',
    imagePng: '/images/login-success/staff-3d.png',
    title: 'ĐĂNG NHẬP THÀNH CÔNG',
    defaultName: 'Lê Hoàng Nam',
    greetingLine1: 'Chào mừng bạn quay trở lại!',
    greetingLine2: 'Bạn đã đăng nhập với quyền nhân viên.',
    destRoute: '/tables',
    buttonText: 'BẮT ĐẦU',
    decorLeft: {
      icon: Monitor,
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200/80',
      pos: 'top-10 -left-3 sm:left-1'
    },
    decorRight: {
      icon: Coffee,
      color: 'bg-amber-100 text-amber-800 border-amber-200/80',
      pos: 'top-8 -right-3 sm:right-1'
    }
  }
};

export default function LoginSuccessView({ role = 'staff', user, onContinue }) {
  const normalizedRole = (role || '').toLowerCase();
  const config = ROLE_CONFIGS[normalizedRole];
  const autoAdvanceTimer = useRef(null);
  const [imgError, setImgError] = useState(false);

  // Play haptic success feedback once on mount
  useEffect(() => {
    triggerHaptic('success');
    // Optional gentle auto-advance fallback after 4.5 seconds
    autoAdvanceTimer.current = setTimeout(() => {
      if (onContinue) onContinue();
    }, 4500);

    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, [onContinue]);

  const handleContinue = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
    }
    triggerHaptic('medium');
    if (onContinue) {
      onContinue();
    }
  };

  // Safe Guard: Invalid / Unassigned Role
  if (!config) {
    return (
      <main
        id="main-content"
        className="min-h-[100dvh] w-full bg-[#F8FAF7] flex flex-col items-center justify-center p-6 text-center select-none"
      >
        <div className="w-full max-w-sm login-card-3d bg-white p-7 space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-red-700 tracking-tight">
            Tài khoản chưa được phân quyền
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            Hệ thống không tìm thấy vai trò phân quyền hợp lệ cho tài khoản này. Vui lòng liên hệ Quản trị viên (Admin) để kích hoạt quyền truy cập.
          </p>
          <button
            type="button"
            onClick={handleContinue}
            className="w-full py-3 rounded-full bg-gray-800 text-white font-bold text-xs hover:bg-gray-900 transition-colors cursor-pointer"
          >
            Quay lại đăng nhập
          </button>
        </div>
      </main>
    );
  }

  const RoleIcon = config.icon;
  const DecorLeft = config.decorLeft.icon;
  const DecorRight = config.decorRight.icon;
  const displayName = user?.name || config.defaultName;

  return (
    <main
      id="main-content"
      tabIndex="-1"
      className="relative min-h-[100dvh] w-full bg-gradient-to-b from-[#F6F8F5] via-[#F4F7F4] to-[#EEF3EE] flex flex-col items-center justify-between p-3 sm:p-5 font-sans select-none overflow-x-hidden overflow-y-auto animate-fadeIn"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))'
      }}
    >
      {/* Ambient background pastel glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-200/35 rounded-full blur-3xl" />
        <div className="absolute top-10 right-10 w-48 h-48 bg-amber-100/30 rounded-full blur-2xl" />
      </div>

      {/* 1. Top Branding Header */}
      <div className="relative z-10 text-center pt-1 sm:pt-4 mb-1 select-none">
        <div className="inline-flex items-center justify-center gap-2 text-[#1C412C] font-black text-2xl sm:text-3xl tracking-tight drop-shadow-2xs">
          <span className="text-[#3D8157] font-semibold text-lg sm:text-xl">&gt;</span>
          <span>GÓC POS</span>
          <span className="text-[#3D8157] font-semibold text-lg sm:text-xl">&lt;</span>
        </div>
        <p className="text-xs sm:text-[13px] font-semibold text-[#526658] mt-0.5 tracking-normal">
          Hệ thống POS Vận hành &amp; Bán hàng
        </p>
      </div>

      {/* 2. Character & Success Details Stack (Mobile Compact) */}
      <div className="relative z-10 w-full max-w-[360px] sm:max-w-[400px] flex flex-col items-center my-auto py-1">
        
        {/* Character Stage with Floating Badges */}
        <div className="relative w-full flex items-center justify-center pt-1">
          
          {/* Role Floating Badge Left */}
          <div className={`absolute ${config.decorLeft.pos} z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-2xl ${config.decorLeft.color} border shadow-md flex items-center justify-center animate-fadeIn`}>
            <DecorLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>

          {/* Role Floating Badge Right */}
          <div className={`absolute ${config.decorRight.pos} z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-2xl ${config.decorRight.color} border shadow-md flex items-center justify-center animate-fadeIn`}>
            <DecorRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>

          {/* 3D Character Asset with Graceful Fallback */}
          {!imgError ? (
            <picture className="relative z-10 inline-block pointer-events-none select-none">
              <source type="image/webp" srcSet={config.imageWebp} />
              <img
                src={config.imagePng}
                alt={config.roleBadge}
                onError={() => setImgError(true)}
                className="w-36 sm:w-44 md:w-48 h-auto max-h-[175px] sm:max-h-[210px] object-contain drop-shadow-lg select-none"
                draggable={false}
                width={192}
                height={240}
              />
            </picture>
          ) : (
            <div className="relative z-10 w-32 h-32 rounded-3xl bg-white shadow-xl flex items-center justify-center border border-emerald-100">
              <RoleIcon className="w-14 h-14 text-emerald-700 animate-pulse" />
            </div>
          )}
        </div>

        {/* Green Checkmark Circle Button */}
        <div className="relative z-30 -mt-5 mb-2 animate-scale-check">
          <div className="w-11 h-11 rounded-full bg-[#1A7C49] text-white flex items-center justify-center shadow-lg shadow-emerald-900/25 border-2 border-white">
            <Check className="w-5 h-5 stroke-[3]" />
          </div>
        </div>

        {/* Text Content */}
        <div className="text-center space-y-1.5 px-3">
          <h1 className="text-xl sm:text-2xl font-black text-[#1C412C] tracking-tight leading-snug">
            {config.title}
          </h1>

          {/* Personalized User Name */}
          <p className="text-sm sm:text-base font-extrabold text-[#1B432C]">
            Xin chào, <span className="text-[#1A7C49]">{displayName}</span>!
          </p>

          {/* Role Pill Badge */}
          <div>
            <div className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border ${config.badgeBg} font-black text-xs sm:text-sm tracking-wider uppercase shadow-2xs`}>
              <RoleIcon className="w-3.5 h-3.5 stroke-[2.4]" />
              <span>Vai trò: {config.roleBadge}</span>
            </div>
          </div>

          {/* Greeting message */}
          <div className="pt-0.5 space-y-0.5">
            <p className="text-xs sm:text-sm text-[#4A5D52] font-semibold">
              {config.greetingLine1}
            </p>
            <p className="text-[11px] sm:text-xs text-[#697E72] font-medium leading-relaxed">
              {config.greetingLine2}
            </p>
          </div>

          {/* Action CTA Button */}
          <div className="pt-3 sm:pt-4 flex justify-center w-full">
            <button
              type="button"
              data-testid="login-success-continue-btn"
              onClick={handleContinue}
              className="w-full max-w-[260px] sm:max-w-xs py-3 px-6 rounded-full bg-gradient-to-r from-[#2B6641] to-[#1E4C30] hover:from-[#245737] hover:to-[#173B25] active:scale-[0.98] text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 cursor-pointer transition-all duration-150 touch-target"
            >
              <span>{config.buttonText}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              <span className="sr-only">Tiếp tục</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Footer Subtle Note */}
      <div className="relative z-10 text-center pb-1 pt-2 select-none">
        <p className="text-[10px] sm:text-[11px] text-[#607768] font-semibold">
          GÓC POS • Phiên làm việc đã kích hoạt an toàn
        </p>
      </div>
    </main>
  );
}
