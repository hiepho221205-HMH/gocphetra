import { useState, useEffect, useCallback } from 'react';

/**
 * useIosKeyboardFix Hook
 *
 * Solves iOS WebKit virtual keyboard viewport displacement and scroll drift:
 * 1. Monitors window.visualViewport height and offset changes to detect when on-screen keyboard is visible.
 * 2. Unconditionally resets document and window scroll positions upon focusin, focusout, and viewport resize.
 * 3. Applies staggered restoration intervals (0ms, 50ms, 150ms, 350ms) to counteract iOS WebKit's slide-down animation delay.
 * 4. Exposes `isKeyboardOpen` state so bottom action bars and nav bars can adapt gracefully.
 */
export function useIosKeyboardFix() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const resetScrollOffset = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Unconditionally restore window & document scroll offsets to 0
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }

    if (document.documentElement && document.documentElement.scrollTop !== 0) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body && document.body.scrollTop !== 0) {
      document.body.scrollTop = 0;
    }

    const rootEl = document.getElementById('root');
    if (rootEl && rootEl.scrollTop !== 0) {
      rootEl.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;

    const handleViewportChange = () => {
      if (!vv) return;
      // When visualViewport height shrinks significantly or offset drifts, keyboard is active
      const heightDifference = window.innerHeight - vv.height;
      const isOpen = heightDifference > 100 || vv.offsetTop > 0 || vv.pageTop > 0;

      setIsKeyboardOpen((prev) => {
        if (prev && !isOpen) {
          // Keyboard just closed - reset scroll offset with staggered timers
          requestAnimationFrame(resetScrollOffset);
          setTimeout(resetScrollOffset, 50);
          setTimeout(resetScrollOffset, 150);
          setTimeout(resetScrollOffset, 350);
        }
        return isOpen;
      });

      // If keyboard is closed or visualViewport has drifted, force restoration
      if (!isOpen && (vv.pageTop > 0 || vv.offsetTop > 0 || window.scrollY > 0)) {
        resetScrollOffset();
      }
    };

    const handleFocusIn = (e) => {
      const targetTag = e.target?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || e.target?.isContentEditable) {
        setIsKeyboardOpen(true);
        requestAnimationFrame(resetScrollOffset);
        setTimeout(resetScrollOffset, 80);
      }
    };

    const handleFocusOut = (e) => {
      const targetTag = e.target?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || e.target?.isContentEditable) {
        setIsKeyboardOpen(false);
        // Staggered scroll resets upon input blur to cover iOS keyboard slide-down animation
        requestAnimationFrame(resetScrollOffset);
        setTimeout(resetScrollOffset, 50);
        setTimeout(resetScrollOffset, 150);
        setTimeout(resetScrollOffset, 350);
      }
    };

    if (vv) {
      vv.addEventListener('resize', handleViewportChange);
      vv.addEventListener('scroll', handleViewportChange);
    }
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleViewportChange);
        vv.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, [resetScrollOffset]);

  return { isKeyboardOpen, resetScrollOffset };
}
