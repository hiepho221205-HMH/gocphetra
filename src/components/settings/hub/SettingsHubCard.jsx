import React from 'react';
import { ChevronRight } from 'lucide-react';
import { triggerHaptic } from '../../../utils/haptics';

/**
 * SettingsHubCard - Soft 3D Neumorphic Card for the 2-Column Settings Hub Grid
 * Mobile-First (390px), tactile press feedback, pastel icon container, multi-layer shadow
 */
export default function SettingsHubCard({
  title,
  subtitle,
  icon: Icon,
  badge,
  iconColor = '#214E34',
  iconBgColor = 'rgba(33, 78, 52, 0.1)',
  badgeColor,
  badgeBgColor,
  onClick,
  testId
}) {
  const handleClick = () => {
    triggerHaptic('light');
    onClick?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title}
      data-testid={testId}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="clay-card clay-card-interactive group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-[22px] sm:rounded-[26px] bg-white border border-white/95 select-none outline-none focus-visible:ring-2 focus-visible:ring-[#214E34]/50 transition-all duration-200 cursor-pointer min-h-[132px] sm:min-h-[140px]"
    >
      {/* Top Row: 3D Pastel Icon & Optional Status Badge / Arrow */}
      <div className="flex items-start justify-between gap-2 w-full">
        <div
          style={{ backgroundColor: iconBgColor, color: iconColor }}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-[16px] flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105"
        >
          {Icon && <Icon className="w-5 h-5 stroke-[2.2]" />}
        </div>

        {badge ? (
          <span
            style={{
              color: badgeColor || iconColor,
              backgroundColor: badgeBgColor || iconBgColor
            }}
            className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full shrink-0 truncate max-w-[90px]"
          >
            {badge}
          </span>
        ) : (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 group-hover:text-forest-800 group-hover:translate-x-0.5 transition-all">
            <ChevronRight className="w-4 h-4 stroke-[2.2]" />
          </div>
        )}
      </div>

      {/* Bottom Content: Title & Subtitle */}
      <div className="mt-2.5 space-y-0.5">
        <h3 className="font-black text-xs sm:text-[13px] text-forest-950 tracking-tight leading-tight line-clamp-1 group-hover:text-forest-800 transition-colors">
          {title}
        </h3>
        <p className="text-[10.5px] sm:text-[11px] text-gray-500 font-medium leading-tight line-clamp-2">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
