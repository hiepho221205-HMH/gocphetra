/**
 * Web Vibration API Utility for Tactile / Haptic Feedback
 * Safe fallback for environments/devices that don't support vibration
 */

export function triggerHaptic(type = 'light') {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) {
    return;
  }

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate(35);
        break;
      case 'success':
        navigator.vibrate([12, 40, 15]);
        break;
      case 'warning':
        navigator.vibrate([20, 60, 20]);
        break;
      case 'error':
        navigator.vibrate([30, 50, 30, 50, 40]);
        break;
      default:
        if (typeof type === 'number' || Array.isArray(type)) {
          navigator.vibrate(type);
        } else {
          navigator.vibrate(12);
        }
        break;
    }
  } catch {
    // Ignore unsupported browser permission issues
  }
}
