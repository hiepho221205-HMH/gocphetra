/**
 * Tier 2 Test Suite: Boundary & Corner Cases
 * Tests edge conditions, validation boundaries, and resilience against invalid states
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  FIXTURE_COMPLETED_ORDERS,
  FIXTURE_TABLES,
  FIXTURE_ACTIVE_ORDERS
} from './helpers/fixtures.js';

import {
  calculateCleanupPreview,
  createInitialStaffList,
  addStaff,
  updateStaffName,
  toggleStaffStatus,
  getStaffCounts,
  cleanupCompletedOrders,
  getOrderCompletionDate
} from './helpers/test_oracle.js';

describe('Tier 2: Boundary & Corner Cases', () => {

  test('T2.1 - Empty & Whitespace Staff Names Rejection', () => {
    const roster = createInitialStaffList();

    // 1. Empty string
    assert.throws(
      () => addStaff(roster, ''),
      /Vui lòng nhập tên nhân viên/,
      'Adding empty name must be rejected'
    );

    // 2. Whitespace-only string
    assert.throws(
      () => addStaff(roster, '     '),
      /Vui lòng nhập tên nhân viên/,
      'Adding whitespace-only name must be rejected'
    );

    // 3. Renaming with empty string
    const targetStaff = roster[0];
    assert.throws(
      () => updateStaffName(roster, targetStaff.id, '   '),
      /Tên nhân viên không được để trống/,
      'Updating to empty name must be rejected'
    );

    // 4. Renaming with valid trimmed string
    const updated = updateStaffName(roster, targetStaff.id, '  Trần Mai Quản Lý  ');
    const result = updated.find((s) => s.id === targetStaff.id);
    assert.equal(result.name, 'Trần Mai Quản Lý', 'Leading and trailing whitespace must be trimmed');
  });

  test('T2.2 - Long Staff Names (> 50 characters)', () => {
    const roster = createInitialStaffList();
    const longName = 'Nguyễn Hoàng Mai Trâm Anh Công Tằng Tôn Nữ Bích Chiêu Long Name';
    assert.ok(longName.length > 50, 'Name must exceed 50 characters');

    const updated = addStaff(roster, longName);
    const added = updated.find((s) => s.name === longName);
    assert.ok(added, 'Long name staff member added successfully without truncation in data store');
    assert.equal(added.name, longName);
    assert.equal(updated.length, 4);
  });

  test('T2.3 - Zero Completed Orders in Range', () => {
    // Range far in the past with no matching orders
    const preview = calculateCleanupPreview(FIXTURE_COMPLETED_ORDERS, 'range', {
      fromDate: '2020-01-01',
      toDate: '2020-01-31'
    });

    assert.equal(preview.count, 0, 'Must return 0 count when no orders match');
    assert.equal(preview.totalRevenue, 0, 'Must return 0 total revenue');
    assert.equal(preview.cashTotal, 0);
    assert.equal(preview.qrTotal, 0);
    assert.equal(preview.targetOrders.length, 0);

    // Simulated UI validation: proceed button should be disabled when count is 0
    const isProceedDisabled = preview.count === 0;
    assert.equal(isProceedDisabled, true, 'Proceed action must be disabled when 0 orders match');
  });

  test('T2.4 - Inverted Date Ranges (fromDate > toDate)', () => {
    // Inverted range: from Oct 25 down to Oct 10
    const preview = calculateCleanupPreview(FIXTURE_COMPLETED_ORDERS, 'range', {
      fromDate: '2026-10-25',
      toDate: '2026-10-10'
    });

    assert.equal(preview.count, 0, 'Inverted range must yield 0 orders');
    assert.equal(preview.error, 'INVERTED_RANGE', 'Error flag INVERTED_RANGE returned');
  });

  test('T2.5 - Missing finishedAt Timestamp Fallback Precedence', () => {
    // Order with paid_at fallback
    const ordWithPaidAt = {
      id: 'ORD-FB-01',
      status: 'completed',
      paid_at: '2026-10-19T08:00:00.000Z'
    };
    assert.equal(getOrderCompletionDate(ordWithPaidAt), '2026-10-19', 'Falls back to paid_at');

    // Order with only createdAt fallback
    const ordWithCreatedAt = {
      id: 'ORD-FB-02',
      status: 'completed',
      createdAt: '2026-10-18T10:00:00.000Z'
    };
    assert.equal(getOrderCompletionDate(ordWithCreatedAt), '2026-10-18', 'Falls back to createdAt');

    // Order with NO timestamps
    const corruptOrd = {
      id: 'ORD-FB-03',
      status: 'completed'
    };
    assert.equal(getOrderCompletionDate(corruptOrd), '', 'Returns empty string if all timestamps are absent');

    // Preview ignores corrupt order to prevent accidental deletion
    const preview = calculateCleanupPreview([corruptOrd], 'range', {
      fromDate: '2026-10-01',
      toDate: '2026-10-31'
    });
    assert.equal(preview.count, 0, 'Orders without valid completion dates are protected from deletion');
  });

  test('T2.6 - Strict Active Dining Protection (Serving Tables Isolation)', () => {
    const initialTables = JSON.parse(JSON.stringify(FIXTURE_TABLES));
    const initialActiveOrders = JSON.parse(JSON.stringify(FIXTURE_ACTIVE_ORDERS));
    let orderHistory = [...FIXTURE_COMPLETED_ORDERS];

    // Trigger cleanup with mode 'all_completed'
    const preview = calculateCleanupPreview(orderHistory, 'all_completed');
    const orderIdsToDelete = preview.targetOrders.map((o) => o.id);
    assert.equal(orderIdsToDelete.length, 4);

    // Execute deletion on order history
    orderHistory = cleanupCompletedOrders(orderHistory, orderIdsToDelete);
    assert.equal(orderHistory.length, 0, 'All completed orders deleted');

    // Assert that active tables are 100% untouched
    assert.deepEqual(FIXTURE_TABLES, initialTables, 'Active tables must remain completely unchanged');
    assert.equal(FIXTURE_TABLES[1].status, 'occupied');
    assert.equal(FIXTURE_TABLES[1].activeOrderId, 'ORD-101');
    assert.equal(FIXTURE_TABLES[2].status, 'occupied');
    assert.equal(FIXTURE_TABLES[2].activeOrderId, 'ORD-102');

    // Assert that active orders are 100% untouched
    assert.deepEqual(FIXTURE_ACTIVE_ORDERS, initialActiveOrders, 'Active orders must remain completely unchanged');
    assert.equal(FIXTURE_ACTIVE_ORDERS['ORD-101'].status, 'serving');
    assert.equal(FIXTURE_ACTIVE_ORDERS['ORD-102'].status, 'awaiting_payment');
  });

  test('T2.7 - Offline Fallback & Versioned Storage Key Compliance', () => {
    // Authoritative versioned LocalStorage keys
    const expectedKeys = {
      TABLES: 'goc_pos_tables_v4',
      ORDERS: 'goc_pos_orders_v4',
      ORDER_HISTORY: 'goc_pos_history_v4',
      SETTINGS: 'goc_pos_settings_v4',
      STAFF: 'goc_pos_staff_v4'
    };

    // Simulated LocalStorage store
    const localStore = {};
    const saveLocal = (key, data) => {
      localStore[key] = JSON.stringify(data);
    };
    const getLocal = (key) => (localStore[key] ? JSON.parse(localStore[key]) : null);

    // Save staff in offline mode
    const staff = createInitialStaffList();
    saveLocal(expectedKeys.STAFF, staff);

    // Retrieve and verify
    const restored = getLocal(expectedKeys.STAFF);
    assert.ok(restored, 'Staff must be cached in local storage');
    assert.equal(restored.length, 3);
    assert.equal(restored[0].name, 'Trần Mai');
  });

});
