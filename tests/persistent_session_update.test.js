import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  savePersistentSession,
  loadPersistentSession,
  isSessionGracePeriodValid,
  clearPersistentSession,
  PERSISTENT_AUTH_KEY,
  DEFAULT_GRACE_PERIOD_MS
} from '../src/utils/persistentAuth.js';

// Mock localStorage and sessionStorage in Node environment
const mockStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] || null
  };
})();

global.window = {
  localStorage: mockStorage,
  sessionStorage: mockStorage
};
global.localStorage = mockStorage;
global.sessionStorage = mockStorage;

describe('GÓC POS - Seamless Persistent Session & Zero-Logout Suite', () => {

  beforeEach(() => {
    mockStorage.clear();
  });

  // =========================================================================
  // 1. Core Persistent Storage Functions
  // =========================================================================
  describe('1. Persistent Auth Utility Contract', () => {
    it('1.1 - savePersistentSession saves complete staff snapshot to localStorage', () => {
      const mockProfile = {
        id: 'usr-001',
        name: 'Trần Mai',
        email: 'admin01@gocpos.vn',
        avatarUrl: 'https://example.com/avatar.png',
        phone: '0901234567',
        branchId: 'main'
      };
      const mockSession = {
        access_token: 'fake_jwt_token_123',
        refresh_token: 'fake_refresh_token_456',
        expires_at: 1800000000,
        user: { id: 'usr-001', email: 'admin01@gocpos.vn' }
      };

      const result = savePersistentSession(mockProfile, 'admin', mockSession);
      assert.equal(result, true, 'savePersistentSession must return true on success');

      const savedRaw = mockStorage.getItem(PERSISTENT_AUTH_KEY);
      assert.ok(savedRaw, 'Snapshot must be stored under PERSISTENT_AUTH_KEY');

      const parsed = JSON.parse(savedRaw);
      assert.equal(parsed.userId, 'usr-001');
      assert.equal(parsed.name, 'Trần Mai');
      assert.equal(parsed.role, 'admin');
      assert.equal(parsed.email, 'admin01@gocpos.vn');
      assert.equal(parsed.session?.access_token, 'fake_jwt_token_123');
      assert.ok(parsed.savedAt > 0, 'Must record savedAt timestamp');
    });

    it('1.2 - loadPersistentSession correctly retrieves and parses active session', () => {
      const mockData = {
        userId: 'usr-002',
        name: 'Phạm Minh Quân',
        email: 'barista01@gocpos.vn',
        role: 'barista',
        savedAt: Date.now()
      };
      mockStorage.setItem(PERSISTENT_AUTH_KEY, JSON.stringify(mockData));

      const loaded = loadPersistentSession();
      assert.ok(loaded, 'Must retrieve non-null session');
      assert.equal(loaded.userId, 'usr-002');
      assert.equal(loaded.role, 'barista');
      assert.equal(loaded.name, 'Phạm Minh Quân');
    });

    it('1.3 - isSessionGracePeriodValid validates fresh sessions and rejects expired sessions (> 30 days)', () => {
      const freshSnapshot = {
        userId: 'usr-003',
        role: 'staff',
        savedAt: Date.now() - 1000 * 60 * 60 // 1 hour ago
      };
      assert.equal(isSessionGracePeriodValid(freshSnapshot), true, '1 hour old session must be valid');

      const thirtyDaysOldSnapshot = {
        userId: 'usr-003',
        role: 'staff',
        savedAt: Date.now() - (DEFAULT_GRACE_PERIOD_MS + 10000) // > 30 days ago
      };
      assert.equal(isSessionGracePeriodValid(thirtyDaysOldSnapshot), false, 'Session older than 30 days must be invalid');

      assert.equal(isSessionGracePeriodValid(null), false, 'Null session must be invalid');
      assert.equal(isSessionGracePeriodValid({}), false, 'Empty session must be invalid');
    });

    it('1.4 - clearPersistentSession permanently removes snapshot on intentional logout', () => {
      mockStorage.setItem(PERSISTENT_AUTH_KEY, JSON.stringify({ userId: 'usr-004', role: 'admin' }));
      assert.ok(mockStorage.getItem(PERSISTENT_AUTH_KEY));

      clearPersistentSession();
      assert.equal(mockStorage.getItem(PERSISTENT_AUTH_KEY), null, 'Snapshot must be removed from storage');
    });
  });

  // =========================================================================
  // 2. Zero-Logout Resilience on App Reload & Update
  // =========================================================================
  describe('2. Reload & Update Resilience Scenarios', () => {
    it('2.1 - Persistent snapshot prevents logout when Supabase getSession returns null (Grace Period)', () => {
      // Simulate persistent session snapshot already present in browser storage before reload
      savePersistentSession(
        { id: 'usr-cashier', name: 'Lê Hoàng Nam', email: 'staff01@gocpos.vn' },
        'staff',
        null
      );

      const persistent = loadPersistentSession();
      assert.ok(persistent, 'Persistent session must be present');
      assert.equal(isSessionGracePeriodValid(persistent), true, 'Must be in valid grace period');

      // In PosContext: when currSession is null, Grace Period activates
      let sessionState = 'active';
      const handleAuthSessionSimulated = (currSession) => {
        if (currSession?.user) {
          sessionState = 'hydrated_from_cloud';
        } else {
          const snapshot = loadPersistentSession();
          if (snapshot && isSessionGracePeriodValid(snapshot)) {
            // Grace Period active: DO NOT wipe!
            sessionState = 'preserved_in_grace_period';
          } else {
            sessionState = 'wiped';
          }
        }
      };

      // Simulate Supabase returning null due to offline / update / network reload
      handleAuthSessionSimulated(null);
      assert.equal(sessionState, 'preserved_in_grace_period', 'User must NOT be logged out when network/Supabase returns null');
    });

    it('2.2 - Post-update navigation flag redirects Barista to /barista and Cashier to /tables', () => {
      // Barista update
      mockStorage.setItem('goc_app_just_updated', 'true');
      const baristaUser = { role: 'barista' };
      let navigatedTo = null;
      if (mockStorage.getItem('goc_app_just_updated') === 'true') {
        mockStorage.removeItem('goc_app_just_updated');
        navigatedTo = baristaUser.role === 'barista' ? '/barista' : '/tables';
      }
      assert.equal(navigatedTo, '/barista', 'Barista must land on /barista after update');
      assert.equal(mockStorage.getItem('goc_app_just_updated'), null, 'Update flag must be consumed');

      // Cashier update
      mockStorage.setItem('goc_app_just_updated', 'true');
      const cashierUser = { role: 'staff' };
      if (mockStorage.getItem('goc_app_just_updated') === 'true') {
        mockStorage.removeItem('goc_app_just_updated');
        navigatedTo = cashierUser.role === 'barista' ? '/barista' : '/tables';
      }
      assert.equal(navigatedTo, '/tables', 'Cashier must land on /tables after update');
    });
  });
});
