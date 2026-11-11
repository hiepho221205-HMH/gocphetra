import { useState, useEffect, useCallback } from 'react';

/**
 * usePwaInstall Hook
 * 
 * Manages PWA installation lifecycle across Chrome (Chromium/Android/Desktop) and iOS Safari:
 * 1. Captures `beforeinstallprompt` for 1-click native Chrome/Edge install.
 * 2. Detects standalone mode (whether app is already running as installed PWA).
 * 3. Identifies iOS Safari to provide targeted "Add to Home Screen" visual instructions.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIosPrompt, setShowIosPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Check if running in standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    setIsInstalled(isStandalone);

    // 2. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios|android/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Listen for Chrome / Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
    };

    // 4. Listen for successful app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log('[PWA] Ứng dụng GÓC POS đã được cài đặt thành công!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] Người dùng đã chấp nhận cài đặt.');
        setIsInstalled(true);
      } else {
        console.log('[PWA] Người dùng đã từ chối cài đặt.');
      }
      setDeferredPrompt(null);
      return { success: choiceResult.outcome === 'accepted' };
    }

    if (isIOS && !isInstalled) {
      // On iOS Safari, open guided sheet
      setShowIosPrompt(true);
      return { success: false, isIOS: true };
    }

    return { success: false };
  }, [deferredPrompt, isIOS, isInstalled]);

  return {
    isInstallable: Boolean(deferredPrompt) || (isIOS && !isInstalled),
    isInstalled,
    isIOS,
    showIosPrompt,
    setShowIosPrompt,
    triggerInstall
  };
}
