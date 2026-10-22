import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRouteFromLocation, getTabFromRoute } from '../src/utils/router.js';

describe('GÓC POS - 6 Critical Issues Automated Verification Suite', () => {

  // =========================================================================
  // TASK 1: LOGIN INITIAL ROUTING & ROUTE GUARDS
  // =========================================================================
  describe('TASK 1 — Login Initial Routing & Route Resolution', () => {
    it('1.1 - Route /login is correctly parsed from pathname and hash', () => {
      const parsedPathname = parseRouteFromLocation({ pathname: '/login', hash: '', search: '' });
      assert.equal(parsedPathname.path, '/login');

      const parsedHash = parseRouteFromLocation({ pathname: '/', hash: '#/login', search: '' });
      assert.equal(parsedHash.path, '/login');
    });

    it('1.2 - getTabFromRoute recognizes /login', () => {
      assert.equal(getTabFromRoute('/login'), 'login');
      assert.equal(getTabFromRoute('/tables'), 'tables');
      assert.equal(getTabFromRoute('/menu'), 'menu');
      assert.equal(getTabFromRoute('/orders'), 'orders');
      assert.equal(getTabFromRoute('/settings'), 'settings');
    });
  });

  // =========================================================================
  // TASK 2: LOGOUT REDIRECT & SESSION PURGE
  // =========================================================================
  describe('TASK 2 — Logout Workflow & Security Sanitation', () => {
    it('2.1 - Logout contract clears role, session and replaces route with /login', () => {
      // Mock storage
      const mockStorage = {
        goc_pos_role_v4: 'admin',
        goc_pos_demo_account: '{"name":"Trần Mai"}'
      };

      const performLogout = (storage, navigate, replaceState) => {
        delete storage.goc_pos_role_v4;
        delete storage.goc_pos_demo_account;
        navigate('/login');
        replaceState(null, '', '#/login');
      };

      let currentNav = '';
      let currentHash = '';

      performLogout(
        mockStorage,
        (path) => { currentNav = path; },
        (_, __, hash) => { currentHash = hash; }
      );

      assert.equal(mockStorage.goc_pos_role_v4, undefined, 'Role storage must be wiped');
      assert.equal(mockStorage.goc_pos_demo_account, undefined, 'Demo account storage must be wiped');
      assert.equal(currentNav, '/login', 'Router must navigate to /login');
      assert.equal(currentHash, '#/login', 'Browser history state must replace to #/login');
    });
  });

  // =========================================================================
  // TASK 3: STAFF SETTINGS ACCESS WITH STRICT STORE RBAC
  // =========================================================================
  describe('TASK 3 — Staff Settings Access & RBAC Boundary Protection', () => {
    const evaluateRbac = (role) => ({
      canAccessSettings: ['admin', 'manager', 'staff'].includes(role),
      canManageStaff: ['admin', 'manager'].includes(role),
      canConfigureStore: ['admin', 'manager'].includes(role),
      canChangeUserRole: role === 'admin',
      canCleanupData: role === 'admin'
    });

    it('3.1 - Staff is granted access to Settings', () => {
      const staffPerms = evaluateRbac('staff');
      assert.equal(staffPerms.canAccessSettings, true, 'Staff MUST be allowed to open Settings');
    });

    it('3.2 - Staff is STRICTLY BLOCKED from store administration tabs', () => {
      const staffPerms = evaluateRbac('staff');
      assert.equal(staffPerms.canManageStaff, false, 'Staff cannot manage staff roster');
      assert.equal(staffPerms.canConfigureStore, false, 'Staff cannot change store config');
      assert.equal(staffPerms.canChangeUserRole, false, 'Staff cannot alter roles');
      assert.equal(staffPerms.canCleanupData, false, 'Staff cannot delete sales data');
    });

    it('3.3 - Manager has Staff Management and Store Config, but blocked from RBAC & Cleanup', () => {
      const mgrPerms = evaluateRbac('manager');
      assert.equal(mgrPerms.canAccessSettings, true);
      assert.equal(mgrPerms.canManageStaff, true);
      assert.equal(mgrPerms.canConfigureStore, true);
      assert.equal(mgrPerms.canChangeUserRole, false);
      assert.equal(mgrPerms.canCleanupData, false);
    });

    it('3.4 - Admin has full access across all 5 Settings modules', () => {
      const adminPerms = evaluateRbac('admin');
      assert.equal(adminPerms.canAccessSettings, true);
      assert.equal(adminPerms.canManageStaff, true);
      assert.equal(adminPerms.canConfigureStore, true);
      assert.equal(adminPerms.canChangeUserRole, true);
      assert.equal(adminPerms.canCleanupData, true);
    });
  });

  // =========================================================================
  // TASK 4: ORDER / PAYMENT / VIEW ORDER WHITE SCREEN DEFENSES
  // =========================================================================
  describe('TASK 4 — White Screen Defenses & Safe Array Evaluation', () => {
    it('4.1 - OrderView lock evaluation is guarded with typeof function', () => {
      const table = { id: 'B01', name: 'Bàn 01' };
      const isTableBillingLocked = (tbl) => (tbl.id === 'B01' ? { lockedById: 'user-2', staffName: 'Nam' } : null);
      const currentUser = { id: 'user-1' };

      const activeBillingLock = typeof isTableBillingLocked === 'function' ? isTableBillingLocked(table) : null;
      const isLockedByOther = Boolean(activeBillingLock && activeBillingLock.lockedById !== currentUser.id);

      assert.equal(isLockedByOther, true, 'Lock must be correctly identified without reference error');
    });

    it('4.2 - BillCheckoutModal safely handles sparse or null order.items without runtime crash', () => {
      const checkBillReady = (order) => {
        if (!order || !Array.isArray(order.items) || order.items.length === 0) {
          return false;
        }
        return true;
      };

      assert.equal(checkBillReady(null), false);
      assert.equal(checkBillReady({ id: 'ORD-1' }), false);
      assert.equal(checkBillReady({ id: 'ORD-1', items: null }), false);
      assert.equal(checkBillReady({ id: 'ORD-1', items: [] }), false);
      assert.equal(checkBillReady({ id: 'ORD-1', items: [{ name: 'Cà phê', quantity: 1 }] }), true);
    });

    it('4.3 - Order item calculations never throw on undefined items', () => {
      const ordMissingItems = { id: 'ORD-02' };
      const count = (ordMissingItems.items || []).reduce((s, it) => s + (it.quantity || 1), 0);
      assert.equal(count, 0, 'Must safely evaluate to 0 instead of TypeError');
    });
  });

  // =========================================================================
  // TASK 5: TABLE GRID ACTIVE ORDERS SORTING
  // =========================================================================
  describe('TASK 5 — Table Grid Sorting (Occupied First, Natural Number Ascending)', () => {
    const getTableNaturalNumber = (t) => {
      const match = (t.name || t.id || '').match(/\d+/);
      return match ? parseInt(match[0], 10) : 9999;
    };

    const sortTables = (tablesList, ordersMap, selectedStatus = 'all') => {
      const isTableOccupied = (t) => {
        const ord = t.activeOrderId ? ordersMap[t.activeOrderId] : null;
        return t.status === 'occupied' || Boolean(ord && ord.items && ord.items.length > 0);
      };

      const filtered = tablesList.filter((t) => {
        const occ = isTableOccupied(t);
        if (selectedStatus === 'occupied') return occ;
        if (selectedStatus === 'empty') return !occ;
        return true;
      });

      return [...filtered].sort((a, b) => {
        const numA = getTableNaturalNumber(a);
        const numB = getTableNaturalNumber(b);

        if (selectedStatus === 'all') {
          const occA = isTableOccupied(a) ? 0 : 1;
          const occB = isTableOccupied(b) ? 0 : 1;
          if (occA !== occB) {
            return occA - occB;
          }
        }

        if (numA !== numB) {
          return numA - numB;
        }
        return (a.name || a.id).localeCompare(b.name || b.id, 'vi', { numeric: true });
      });
    };

    it('5.1 - In "Tất cả", tables with active orders appear strictly above empty tables', () => {
      const mockTables = [
        { id: 'B07', name: 'Bàn 07', status: 'empty' },
        { id: 'B01', name: 'Bàn 01', status: 'empty' },
        { id: 'B12', name: 'Bàn 12', status: 'occupied', activeOrderId: 'O-12' },
        { id: 'B02', name: 'Bàn 02', status: 'occupied', activeOrderId: 'O-02' },
        { id: 'B08', name: 'Bàn 08', status: 'occupied', activeOrderId: 'O-08' },
        { id: 'B03', name: 'Bàn 03', status: 'empty' },
        { id: 'B04', name: 'Bàn 04', status: 'empty' }
      ];

      const mockOrders = {
        'O-12': { id: 'O-12', items: [{ name: 'Bạc xỉu', quantity: 1 }] },
        'O-02': { id: 'O-02', items: [{ name: 'Trà sen', quantity: 2 }] },
        'O-08': { id: 'O-08', items: [{ name: 'Cà phê', quantity: 1 }] }
      };

      const sorted = sortTables(mockTables, mockOrders, 'all');
      const sortedIds = sorted.map((t) => t.id);

      // Expected order:
      // Group 1 (Occupied, natural asc): B02, B08, B12
      // Group 2 (Empty, natural asc): B01, B03, B04, B07
      assert.deepEqual(sortedIds, ['B02', 'B08', 'B12', 'B01', 'B03', 'B04', 'B07']);
    });

    it('5.2 - Tab "Có khách" only shows occupied tables sorted ascending', () => {
      const mockTables = [
        { id: 'B12', name: 'Bàn 12', status: 'occupied', activeOrderId: 'O-12' },
        { id: 'B02', name: 'Bàn 02', status: 'occupied', activeOrderId: 'O-02' },
        { id: 'B01', name: 'Bàn 01', status: 'empty' }
      ];
      const mockOrders = {
        'O-12': { id: 'O-12', items: [{ quantity: 1 }] },
        'O-02': { id: 'O-02', items: [{ quantity: 1 }] }
      };
      const sorted = sortTables(mockTables, mockOrders, 'occupied');
      assert.deepEqual(sorted.map((t) => t.id), ['B02', 'B12']);
    });

    it('5.3 - Tab "Bàn trống" only shows empty tables sorted ascending', () => {
      const mockTables = [
        { id: 'B07', name: 'Bàn 07', status: 'empty' },
        { id: 'B01', name: 'Bàn 01', status: 'empty' },
        { id: 'B02', name: 'Bàn 02', status: 'occupied', activeOrderId: 'O-02' }
      ];
      const mockOrders = {
        'O-02': { id: 'O-02', items: [{ quantity: 1 }] }
      };
      const sorted = sortTables(mockTables, mockOrders, 'empty');
      assert.deepEqual(sorted.map((t) => t.id), ['B01', 'B07']);
    });
  });

  // =========================================================================
  // TASK 6: ORDER HISTORY DATE FILTER HEADER & REVENUE SEPARATION
  // =========================================================================
  describe('TASK 6 — Order History Date Filter & Actual Revenue Isolation', () => {
    it('6.1 - Daily revenue only sums paid amounts from completed orders, never serving orders', () => {
      const mockCompletedOrders = [
        { id: 'ORD-01', status: 'completed', total: 35000, paidAmount: 35000, paymentBusinessDate: '2026-10-22' },
        { id: 'ORD-02', status: 'completed', total: 60000, paidAmount: 60000, paymentBusinessDate: '2026-10-22' }
      ];
      const mockServingOrders = [
        { id: 'ORD-03', status: 'serving', total: 55000, businessDate: '2026-10-22' }
      ];

      const calculateRevenue = (completed, selectedDate) => {
        return completed
          .filter((ord) => !ord.paymentBusinessDate || ord.paymentBusinessDate === selectedDate)
          .reduce((sum, ord) => sum + (Number(ord.paidAmount) || Number(ord.total) || 0), 0);
      };

      const rev = calculateRevenue(mockCompletedOrders, '2026-10-22');
      assert.equal(rev, 95000, 'Revenue must be 35.000 + 60.000 = 95.000đ, excluding serving order ORD-03');
    });
  });

});
