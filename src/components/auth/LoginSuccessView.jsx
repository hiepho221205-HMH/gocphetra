import React, { useEffect, useRef } from 'react';
import { Check, ArrowRight, Crown, Users, User, ShieldAlert, BarChart3, ClipboardCheck, Coffee, Monitor } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

const ROLE_CONFIGS = {
  admin: {
    roleBadge: 'ADMIN',
    icon: Crown,
    badgeBg: 'bg-[#E2F6EA] text-[#1A7C49] border-[#C5EDD4]',
    imageWebp: '/images/login-success/admin-3d.webp',
    imagePng: '/images/login-success/admin-3d.png',
    title: 'Đăng nhập thành công!',
    greetingLine1: 'Chào mừng bạn quay trở lại!',
    greetingLine2: 'Bạn đã đăng nhập với quyền quản trị hệ thống.',
    destRoute: '/tables',
    buttonText: 'Tiếp tục',
    decorLeft: {
      icon: Crown,
      color: 'bg-amber-100 text-amber-700 border-amber-200/80',
      pos: 'top-8 -left-3 sm:left-2'
    },
    decorRight: {
      icon: BarChart3,
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200/80',
      pos: 'top-14 -right-3 sm:right-2'
    }
  },
  manager: {
    roleBadge: 'QUẢN LÝ',
    icon: Users,
    badgeBg: 'bg-[#E2F6EA] text-[#1A7C49] border-[#C5EDD4]',
    imageWebp: '/images/login-success/manager-3d.webp',
    imagePng: '/images/login-success/manager-3d.png',
    title: 'Đăng nhập thành công!',
    greetingLine1: 'Chào mừng bạn quay trở lại!',
    greetingLine2: 'Bạn đã đăng nhập với quyền quản lý cửa hàng.',
    destRoute: '/tables',
    buttonText: 'Tiếp tục',
    decorLeft: {
      icon: ClipboardCheck,
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200/80',
      pos: 'top-10 -left-3 sm:left-2'
    },
    decorRight: {
      icon: Users,
      color: 'bg-teal-100 text-teal-800 border-teal-200/80',
      pos: 'top-8 -right-3 sm:right-2'
    }
  },
  staff: {
    roleBadge: 'NHÂN VIÊN',
    icon: User,
    badgeBg: 'bg-[#E2F6EA] text-[#1A7C49] border-[#C5EDD4]',
    imageWebp: '/images/login-success/staff-3d.webp',
    imagePng: '/images/login-success/staff-3d.png',
    title: 'Đăng nhập thành công!',
    greetingLine1: 'Chào mừng bạn quay trở lại!',
    greetingLine2: 'Bạn đã đăng nhập với quyền nhân viên.',
    destRoute: '/tables',
    buttonText: 'Tiếp tục',
    decorLeft: {
      icon: Monitor,
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200/80',
      pos: 'top-14 -left-3 sm:left-2'
    },
    decorRight: {
      icon: Coffee,
      color: 'bg-amber-100 text-amber-800 border-amber-200/80',
      pos: 'top-10 -right-3 sm:right-2'
    }
  }
};

export default function LoginSuccessView({ role = 'staff', user, onContinue }) {
  const normalizedRole = (role || '').toLowerCase();
  const config = ROLE_CONFIGS[normalizedRole];
  const autoAdvanceTimer = useRef(null);

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

  return (
    <main
      id="main-content"
      tabIndex="-1"
      className="relative min-h-[100dvh] w-full bg-gradient-to-b from-[#F6F8F5] via-[#F4F7F4] to-[#EEF3EE] flex flex-col items-center justify-between p-4 sm:p-6 font-sans select-none overflow-x-hidden overflow-y-auto animate-fadeIn"
    >
      {/* Ambient background pastel glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-200/35 rounded-full blur-3xl" />
        <div className="absolute top-10 right-10 w-48 h-48 bg-amber-100/30 rounded-full blur-2xl" />
      </div>

      {/* 1. Top Branding Header */}
      <div className="relative z-10 text-center pt-3 sm:pt-6 mb-2 select-none">
        <div className="inline-flex items-center justify-center gap-2 text-[#1C412C] font-black text-2xl sm:text-3xl tracking-tight drop-shadow-2xs">
          <span className="text-[#3D8157] font-semibold text-lg sm:text-xl">&gt;</span>
          <span>GÓC POS</span>
          <span className="text-[#3D8157] font-semibold text-lg sm:text-xl">&lt;</span>
        </div>
        <p className="text-xs sm:text-[13px] font-semibold text-[#526658] mt-1 tracking-normal">
          Hệ thống POS Vận hành &amp; Bán hàng
        </p>
      </div>

      {/* 2. Character & Success Details Stack */}
      <div className="relative z-10 w-full max-w-[390px] sm:max-w-[420px] flex flex-col items-center my-auto py-2">
        
        {/* Character Stage with Floating Badges */}
        <div className="relative w-full flex items-center justify-center pt-2">
          
          {/* Role Floating Badge Left */}
          <div className={`absolute ${config.decorLeft.pos} z-20 w-10 h-10 rounded-2xl ${config.decorLeft.color} border shadow-md flex items-center justify-center animate-fadeIn`}>
            <DecorLeft className="w-5 h-5 stroke-[2.2]" />
          </div>

          {/* Role Floating Badge Right */}
          <div className={`absolute ${config.decorRight.pos} z-20 w-10 h-10 rounded-2xl ${config.decorRight.color} border shadow-md flex items-center justify-center animate-fadeIn`}>
            <DecorRight className="w-5 h-5 stroke-[2.2]" />
          </div>

          {/* 3D Character Asset */}
          <picture className="relative z-10 inline-block pointer-events-none select-none">
            <source type="image/webp" srcSet={config.imageWebp} />
            <img
              src={config.imagePng}
              alt={config.roleBadge}
              className="w-52 sm:w-60 h-auto object-contain drop-shadow-lg select-none"
              draggable={false}
              width={240}
              height={320}
            />
          </picture>
        </div>

        {/* Green Checkmark Circle Button */}
        <div className="relative z-30 -mt-6 mb-3 animate-scale-check">
          <div className="w-12 h-12 rounded-full bg-[#1A7C49] text-white flex items-center justify-center shadow-lg shadow-emerald-900/25 border-2 border-white">
            <Check className="w-6 h-6 stroke-[3]" />
          </div>
        </div>

        {/* Text Content */}
        <div className="text-center space-y-2 px-4">
          <h1 className="text-2xl sm:text-[28px] font-black text-[#1C412C] tracking-tight leading-snug">
            {config.title}
          </h1>

          {/* Role Pill Badge */}
          <div>
            <div className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border ${config.badgeBg} font-black text-xs sm:text-sm tracking-wider uppercase shadow-2xs`}>
              <RoleIcon className="w-4 h-4 stroke-[2.4]" />
              <span>{config.roleBadge}</span>
            </div>
          </div>

          {/* Greeting message */}
          <div className="pt-1 space-y-0.5">
            <p className="text-xs sm:text-[13.5px] text-[#4A5D52] font-bold">
              {config.greetingLine1}
            </p>
            <p className="text-xs sm:text-[13px] text-[#697E72] font-medium leading-relaxed">
              {config.greetingLine2}
            </p>
          </div>

          {/* Action CTA Button */}
          <div className="pt-5 flex justify-center w-full">
            <button
              type="button"
              data-testid="login-success-continue-btn"
              onClick={handleContinue}
              className="w-full max-w-[270px] sm:max-w-xs py-3.5 px-8 rounded-full bg-gradient-to-r from-[#2B6641] to-[#1E4C30] hover:from-[#245737] hover:to-[#173B25] active:scale-[0.98] text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 cursor-pointer transition-all duration-150 touch-target"
            >
              <span>{config.buttonText}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Footer Subtle Note */}
      <div className="relative z-10 text-center pb-2 pt-4 select-none">
        <p className="text-[11px] text-[#607768] font-semibold">
          GÓC POS • Phiên làm việc đã kích hoạt an toàn
        </p>
      </div>
    </main>
  );
}
