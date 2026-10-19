import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * ProfileNavCard - Reusable navigation card with pastel theme for Profile screen
 * Optimized for Mobile-First (390px), uniform width, 72-76px fixed height, 16px border radius
 * @param {string} title - Main title of the card
 * @param {string} description - Brief subtitle/description (single-line truncate)
 * @param {React.ComponentType} icon - Lucide icon component
 * @param {string} bgColor - Pastel background color (e.g. #EAF5ED)
 * @param {string} iconColor - Icon color
 * @param {string} iconBgColor - Background color for icon container
 * @param {() => void} onClick - Callback when clicked
 * @param {string} testId - Optional test id for automation
 */
export default function ProfileNavCard({
  title,
  description,
  icon: Icon,
  bgColor = '#F8FAFC',
  iconColor = '#214E34',
  iconBgColor = 'rgba(33, 78, 52, 0.1)',
  onClick,
  testId
}) {
  return (
    <div
      data-testid={testId}
      onClick={onClick}
      style={{ backgroundColor: bgColor }}
      className="touch-target btn-press w-full h-[74px] p-3.5 rounded-2xl border border-black/[0.04] shadow-xs flex items-center justify-between cursor-pointer hover:brightness-98 transition-all duration-200 group max-w-full overflow-hidden"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
        <div
          style={{ backgroundColor: iconBgColor, color: iconColor }}
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform"
        >
          {Icon && <Icon className="w-5 h-5 stroke-[2]" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-xs text-gray-900 tracking-tight truncate leading-tight">
            {title}
          </h3>
          <p className="text-[11px] text-gray-500 truncate leading-tight mt-1 line-clamp-1">
            {description}
          </p>
        </div>
      </div>
      <div className="flex items-center text-gray-400 group-hover:text-forest-800 group-hover:translate-x-0.5 transition-all shrink-0 pl-1">
        <ChevronRight className="w-4 h-4 stroke-[2]" />
      </div>
    </div>
  );
}
