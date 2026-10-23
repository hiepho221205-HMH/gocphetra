import React from 'react';
import { Eye } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

/**
 * ViewOrderIconButton Component
 * Compact, minimalist eye-icon button used consistently across:
 * - TableCard (Tables floorplan)
 * - OrderView (Bottom action bar)
 * - OrderHistoryView (Serving order cards)
 */
export default function ViewOrderIconButton({
  onClick,
  disabled = false,
  size = 'md',
  className = '',
  title = 'Xem đơn',
  ariaLabel = 'Xem đơn'
}) {
  const handleClick = (e) => {
    if (disabled) return;
    triggerHaptic('light');
    onClick?.(e);
  };

  const sizeClasses = {
    sm: 'w-[34px] h-[34px] min-w-[34px] min-h-[34px] rounded-[12px]',
    md: 'w-[38px] h-[38px] min-w-[38px] min-h-[38px] rounded-[14px]',
    lg: 'w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-[16px]'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-[18px] h-[18px]'
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`touch-target flex items-center justify-center transition-all cursor-pointer select-none shrink-0 active:scale-95 ${
        sizeClasses[size] || sizeClasses.md
      } ${
        disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50 shadow-none'
          : 'clay-pill-btn text-[#214E34] hover:bg-emerald-50/60 hover:text-forest-900 shadow-xs'
      } ${className}`}
    >
      <Eye className={`${iconSizes[size] || iconSizes.md} stroke-[2.2]`} />
    </button>
  );
}
