/**
 * Persistent POS Authentication & Grace Period Manager
 * Guarantees zero-logout experience across app updates (PWA), page refreshes (F5/Reload),
 * and network drops/offline shifts in coffee shop environment.
 */

export const PERSISTENT_AUTH_KEY = 'goc_pos_persistent_auth_v1';
export const DEFAULT_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days active shift grace period

/**
 * Saves authenticated staff session snapshot to persistent localStorage.
 * @param {object} profile - Staff profile object (id, name, email, avatarUrl, etc.)
 * @param {string} role - 'admin' | 'manager' | 'staff' | 'barista'
 * @param {object|null} session - Supabase auth session (access_token, refresh_token, etc.)
 */
export function savePersistentSession(profile, role, session = null) {
  if (typeof window === 'undefined' || !window.localStorage || !profile) return false;
  try {
    const payload = {
      userId: profile.id || profile.uid,
      uid: profile.id || profile.uid,
      email: profile.email || '',
      name: profile.name || '',
      role: role || profile.role || 'staff',
      avatarUrl: profile.avatarUrl || null,
      phone: profile.phone || '',
      branchId: profile.branchId || 'main',
      savedAt: Date.now(),
      session: session ? {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user: session.user
      } : null
    };
    window.localStorage.setItem(PERSISTENT_AUTH_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('[PersistentAuth] Không thể lưu snapshot phiên:', err);
    return false;
  }
}

/**
 * Synchronously retrieves persistent session snapshot from localStorage.
 * @returns {object|null}
 */
export function loadPersistentSession() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(PERSISTENT_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.userId || parsed.uid) && parsed.role) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates if snapshot is within allowed grace period (defaults to 30 days).
 * @param {object|null} snapshot
 * @returns {boolean}
 */
export function isSessionGracePeriodValid(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const userId = snapshot.userId || snapshot.uid;
  if (!userId || !snapshot.role) return false;
  const savedAt = Number(snapshot.savedAt) || 0;
  if (!savedAt) return true; // Legacy snapshot without savedAt is assumed valid
  return Date.now() - savedAt < DEFAULT_GRACE_PERIOD_MS;
}

/**
 * Permanently removes persistent session snapshot (called strictly on intentional logout).
 */
export function clearPersistentSession() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(PERSISTENT_AUTH_KEY);
  } catch {}
}
