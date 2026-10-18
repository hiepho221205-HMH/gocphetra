/**
 * Format number to Vietnamese Dong currency string
 * Example: 45000 -> "45.000đ"
 */
export function formatVND(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '0đ';
  }
  return amount.toLocaleString('vi-VN') + 'đ';
}

/**
 * Format compact VND for badges or space-constrained areas
 * Example: 45000 -> "45k"
 */
export function formatCompactVND(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '0k';
  }
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(1).replace('.0', '') + 'tr';
  }
  if (amount >= 1000) {
    return Math.round(amount / 1000) + 'k';
  }
  return amount + 'đ';
}
