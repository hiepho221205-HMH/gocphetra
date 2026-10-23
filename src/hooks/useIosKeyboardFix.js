import { useState, useEffect, useCallback } from 'react';

/**
 * useIosKeyboardFix Hook
 *
 * Solves iOS WebKit virtual keyboard viewport displacement and scroll drift:
 * 1. Monitors window.visualViewport height changes to detect when on-screen keyboard is visible.
 * 2. On keyboard dismissal (visualViewport expansion or input focusout), checks if window.scrollY
 *    or document scroll offset was introduced by WebKit's automatic scroll-into-view.
 * 3. Instantly restores scroll position to (0, 0) without intrusive animations or unstable timeouts.
 * 4. Exposes `isKeyboardOpen` state so bottom action bars and nav bars can adapt gracefully.
 */
export function useIosKeyboardFix() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const resetScrollOffset = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Reset window & document scroll offsets if WebKit pushed them
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
    if (document.documentElement && document.documentElement.scrollTop !== 0) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body && document.body.scrollTop !== 0) {
      document.body.scrollTop = 0;
    }

    // Check #root element
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
      // When visualViewport height shrinks significantly compared to innerHeight, keyboard is open
      const heightDifference = window.innerHeight - vv.height;
      const isOpen = heightDifference > 140;

      setIsKeyboardOpen((prev) => {
        if (prev && !isOpen) {
          // Keyboard just closed - reset scroll offset
          requestAnimationFrame(resetScrollOffset);
          setTimeout(resetScrollOffset, 60);
        }
        return isOpen;
      });

      // If keyboard is closed but visualViewport.pageTop has drifted, reset
      if (!isOpen && (vv.pageTop > 0 || window.scrollY > 0)) {
        resetScrollOffset();
      }
    };

    const handleFocusOut = (e) => {
      const targetTag = e.target?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || e.target?.isContentEditable) {
        // Schedule scroll resets upon input blur
        requestAnimationFrame(resetScrollOffset);
        setTimeout(resetScrollOffset, 80);
        setTimeout(resetScrollOffset, 200);
      }
    };

    if (vv) {
      vv.addEventListener('resize', handleViewportChange);
      vv.addEventListener('scroll', handleViewportChange);
    }
    window.addEventListener('focusout', handleFocusOut);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleViewportChange);
        vv.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, [resetScrollOffset]);

  return { isKeyboardOpen, resetScrollOffset };
}
