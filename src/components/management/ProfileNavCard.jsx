import React from 'react';
import { ChevronRight } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

/**
 * ProfileNavCard - Reusable navigation card with pastel theme for Profile screen
 * Optimized for Mobile-First (390px), uniform width, 76px fixed height, claymorphic border radius
 * @param {string} title - Main title of the card
 * @param {string} description - Brief subtitle/description
 * @param {React.ComponentType} icon - Lucide icon component
 * @param {string} bgColor - Pastel background color
 * @param {string} iconColor - Icon color
 * @param {string} iconBgColor - Background color for icon container
 * @param {() => void} onClick - Callback when clicked
 * @param {string} testId - Optional test id for automation
 */
export default function ProfileNavCard({
  title,
  description,
  icon: Icon,
  bgColor = '#FFFFFF',
  iconColor = '#214E34',
  iconBgColor = 'rgba(33, 78, 52, 0.1)',
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
      onKeyDown={handleKeyDown}
      data-testid={testId}
      onClick={handleClick}
      style={{ backgroundColor: bgColor }}
      className="clay-card clay-card-interactive w-full h-[76px] p-3.5 flex items-center justify-between cursor-pointer max-w-full overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-[#214E34]/50"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
        <div
          style={{ backgroundColor: iconBgColor, color: iconColor }}
          className="w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0 shadow-sm"
        >
          {Icon && <Icon className="w-5 h-5 stroke-[2.2]" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-xs text-gray-900 tracking-tight truncate leading-tight">
            {title}
          </h3>
          <p className="text-[11px] text-gray-500 font-semibold truncate leading-tight mt-1 line-clamp-1">
            {description}
          </p>
        </div>
      </div>
      <div className="flex items-center text-gray-400 group-hover:text-[#214E34] transition-all shrink-0 pl-1">
        <ChevronRight className="w-4 h-4 stroke-[2.5]" />
      </div>
    </div>
  );
}
