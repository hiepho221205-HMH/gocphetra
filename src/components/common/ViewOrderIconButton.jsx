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
  variant = 'neutral', // 'neutral' | 'amber'
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
    md: 'w-10 h-10 min-w-[40px] min-h-[40px] rounded-[14px]',
    lg: 'w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-[16px]'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-[18px] h-[18px]'
  };

  const variantClasses = {
    amber: disabled
      ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-50 shadow-none'
      : 'bg-[#FFF3D6] hover:bg-[#FFEEC2] text-[#174D36] border border-[#F3E2B8] shadow-[0_2px_8px_rgba(23,77,54,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)]',
    neutral: disabled
      ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50 shadow-none'
      : 'clay-pill-btn text-[#214E34] hover:bg-emerald-50/60 hover:text-forest-900 shadow-xs'
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
        variantClasses[variant] || variantClasses.neutral
      } ${className}`}
    >
      <Eye className={`${iconSizes[size] || iconSizes.md} stroke-[2.2]`} />
    </button>
  );
}
