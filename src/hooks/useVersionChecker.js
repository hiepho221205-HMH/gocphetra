import { useState, useEffect, useCallback } from 'react';
import { APP_VERSION } from '../config/version';

export function useVersionChecker() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [newVersion, setNewVersion] = useState(null);
  const [newReleaseName, setNewReleaseName] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkForUpdates = useCallback(async () => {
    // Only check in production or if version.json is reachable
    setIsChecking(true);
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.version && data.version !== APP_VERSION) {
          setHasUpdate(true);
          setNewVersion(data.version);
          setNewReleaseName(data.releaseName || '');
        } else {
          setHasUpdate(false);
        }
      }
    } catch {
      // Offline or network error - ignore silently
    } finally {
      setIsChecking(false);
    }
  }, []);

  const applyUpdate = () => {
    // Graceful refresh when the cashier is ready
    window.location.reload();
  };

  useEffect(() => {
    // Check on initial mount
    checkForUpdates();

    // Check when user returns to tab (wake from sleep/switch back)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Periodic check every 10 minutes
    const interval = setInterval(checkForUpdates, 10 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [checkForUpdates]);

  return {
    currentVersion: APP_VERSION,
    hasUpdate,
    newVersion,
    newReleaseName,
    isChecking,
    checkForUpdates,
    applyUpdate
  };
}
