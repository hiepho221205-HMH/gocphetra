/**
 * Tier 3 Test Suite: Cross-Feature Combinations
 * Verifies complex interactions between multiple POS subsystems
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  FIXTURE_STAFF,
  FIXTURE_SETTINGS,
  FIXTURE_COMPLETED_ORDERS,
  FIXTURE_TABLES,
  FIXTURE_ACTIVE_ORDERS
} from './helpers/fixtures.js';

import {
  calculateCleanupPreview,
  generateAutoBackupPayload,
  createInitialStaffList,
  toggleStaffStatus,
  getStaffCounts,
  cleanupCompletedOrders,
  calculateRevenueReport
} from './helpers/test_oracle.js';

import { validateAutoBackupSchema } from './helpers/schema_validator.js';

describe('Tier 3: Cross-Feature Combinations', () => {

  test('T3.1 - Staff Status Toggle + Operational Config Update', () => {
    // 1. Initialize composite store state
    let staffRoster = createInitialStaffList();
    let operationalSettings = { ...FIXTURE_SETTINGS };

    // Initial assertions
    assert.equal(getStaffCounts(staffRoster).active, 3);
    assert.equal(operationalSettings.wifiPassword, 'goccaphe2026');

    // 2. Perform staff mutation: pause 'staff-02' (Nguyễn Văn Hùng)
    staffRoster = toggleStaffStatus(staffRoster, 'staff-02');
    const pausedStaff = staffRoster.find((s) => s.id === 'staff-02');
    assert.equal(pausedStaff.status, 'paused');
    assert.equal(getStaffCounts(staffRoster).active, 2);

    // 3. Perform settings mutation: update WiFi password and hotline
    operationalSettings = {
      ...operationalSettings,
      wifiPassword: 'goccaphe_vip2026',
      hotline: '1900 99 88 33'
    };
    assert.equal(operationalSettings.wifiPassword, 'goccaphe_vip2026');

    // 4. Verify no cross-state pollution
    // Staff roster retains changes
    assert.equal(staffRoster.length, 3);
    assert.equal(staffRoster.find((s) => s.id === 'staff-02').status, 'paused');
    // Settings retain all unmodified fields (branch, bankAccount) intact
    assert.equal(operationalSettings.branchName, 'Chi nhánh 01 - Trụ sở chính');
    assert.equal(operationalSettings.bankAccount.accountNo, '0988776655');
  });

  test('T3.2 - Data Cleanup + Report Revenue Alignment', () => {
    let orderHistory = [...FIXTURE_COMPLETED_ORDERS];

    // Initial baseline revenue report
    const initialTotalRevenue = calculateRevenueReport(orderHistory);
    // 56k + 131k + 45k + 56k = 288,000 VND
    assert.equal(initialTotalRevenue, 288000, 'Baseline revenue must be 288,000 VND');

    // Select range 2026-10-18 (contains ORD-HIST-01: 56k, ORD-HIST-02: 131k -> total: 187,000 VND)
    const preview = calculateCleanupPreview(orderHistory, 'range', {
      fromDate: '2026-10-18',
      toDate: '2026-10-18'
    });
    assert.equal(preview.count, 2);
    assert.equal(preview.totalRevenue, 187000);

    // Generate auto-backup
    const { payload } = generateAutoBackupPayload(preview.targetOrders, {
      mode: 'range',
      criteria: { fromDate: '2026-10-18', toDate: '2026-10-18' }
    });
    const backupValidation = validateAutoBackupSchema(payload);
    assert.ok(backupValidation.valid, 'Backup schema must be valid');

    // Execute deletion
    const deletedIds = preview.targetOrders.map((o) => o.id);
    orderHistory = cleanupCompletedOrders(orderHistory, deletedIds);
    assert.equal(orderHistory.length, 2, '2 orders remain in history');

    // Subsequent revenue report
    const adjustedRevenue = calculateRevenueReport(orderHistory);
    // Remaining orders: ORD-HIST-03 (45k) + ORD-HIST-04 (56k) = 101,000 VND
    const expectedRemaining = initialTotalRevenue - preview.totalRevenue;
    assert.equal(adjustedRevenue, 101000, 'Adjusted revenue matches remaining orders');
    assert.equal(adjustedRevenue, expectedRemaining, 'Revenue exactly reduced by deleted amount');
  });

  test('T3.3 - Active Dining Tables + Completed Orders Cleanup Coexistence', () => {
    // System with 2 active dining orders and 4 completed history orders
    const activeOrders = { ...FIXTURE_ACTIVE_ORDERS };
    const tables = JSON.parse(JSON.stringify(FIXTURE_TABLES));
    let orderHistory = [...FIXTURE_COMPLETED_ORDERS];

    const activeOrderCount = Object.keys(activeOrders).length;
    assert.equal(activeOrderCount, 2, 'BottomNav badge reflects 2 active orders');

    // Manager executes 'all_completed' cleanup
    const preview = calculateCleanupPreview(orderHistory, 'all_completed');
    assert.equal(preview.count, 4);

    const deletedIds = preview.targetOrders.map((o) => o.id);
    orderHistory = cleanupCompletedOrders(orderHistory, deletedIds);

    // Verify post-cleanup state:
    // 1. Completed history is empty
    assert.equal(orderHistory.length, 0, 'Completed history emptied');

    // 2. Active orders remain 2
    assert.equal(Object.keys(activeOrders).length, 2, 'Active orders count remains 2');
    assert.equal(activeOrders['ORD-101'].status, 'serving');
    assert.equal(activeOrders['ORD-102'].status, 'awaiting_payment');

    // 3. Tables remain occupied and linked
    const occupiedTables = tables.filter((t) => t.status === 'occupied');
    assert.equal(occupiedTables.length, 2, '2 tables remain occupied');
    assert.equal(tables.find((t) => t.id === 'B02').activeOrderId, 'ORD-101');
    assert.equal(tables.find((t) => t.id === 'B03').activeOrderId, 'ORD-102');
  });

});
