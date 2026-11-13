import { useState, useEffect, useCallback } from 'react';
import { APP_VERSION } from '../config/version';

/**
 * Compare two semver strings to determine if remote is strictly newer than local.
 * e.g. isNewerVersion('2.0.1', '2.0.0') -> true
 *      isNewerVersion('1.2.0', '2.0.0') -> false
 */
export function isNewerVersion(remote, local) {
  if (!remote || !local) return false;
  if (remote === local) return false;
  const parse = (v) =>
    String(v)
      .trim()
      .replace(/^v/i, '')
      .split('.')
      .map((p) => {
        const num = parseInt(p, 10);
        return Number.isFinite(num) ? num : 0;
      });

  const r = parse(remote);
  const l = parse(local);
  const maxLen = Math.max(r.length, l.length);
  for (let i = 0; i < maxLen; i++) {
    const rVal = r[i] !== undefined ? r[i] : 0;
    const lVal = l[i] !== undefined ? l[i] : 0;
    if (rVal > lVal) return true;
    if (rVal < lVal) return false;
  }
  return false;
}

export function useVersionChecker() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [newVersion, setNewVersion] = useState(null);
  const [newReleaseName, setNewReleaseName] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.sessionStorage
        ? window.sessionStorage.getItem('gocoffe_dismissed_update_version')
        : null;
    } catch {
      return null;
    }
  });

  const checkForUpdates = useCallback(async () => {
    setIsChecking(true);
    try {
      const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
      const versionUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}version.json?t=${Date.now()}`;
      const res = await fetch(versionUrl, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.version && isNewerVersion(data.version, APP_VERSION)) {
          setNewVersion(data.version);
          setNewReleaseName(data.releaseName || '');
          const currentDismissed = typeof window !== 'undefined' && window.sessionStorage
            ? window.sessionStorage.getItem('gocoffe_dismissed_update_version')
            : dismissedVersion;
          if (data.version !== currentDismissed) {
            setHasUpdate(true);
          } else {
            setHasUpdate(false);
          }
        } else {
          setHasUpdate(false);
        }
      }
    } catch {
      // Offline or network error - ignore silently
    } finally {
      setIsChecking(false);
    }
  }, [dismissedVersion]);

  const dismissUpdate = useCallback(() => {
    setHasUpdate(false);
    if (newVersion) {
      setDismissedVersion(newVersion);
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem('gocoffe_dismissed_update_version', newVersion);
        }
      } catch {
        // Ignore storage errors
      }
    }
  }, [newVersion]);

  const applyUpdate = () => {
    // Force refresh from server without cache
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
    applyUpdate,
    dismissUpdate
  };
}
