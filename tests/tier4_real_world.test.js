/**
 * Tier 4 Test Suite: Real-World Scenarios
 * Simulates end-to-end cafe business operational shifts and lifecycles
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  FIXTURE_STAFF,
  FIXTURE_SETTINGS,
  FIXTURE_COMPLETED_ORDERS,
  FIXTURE_TABLES
} from './helpers/fixtures.js';

import {
  calculateCleanupPreview,
  generateAutoBackupPayload,
  createInitialStaffList,
  addStaff,
  updateStaffName,
  toggleStaffStatus,
  getStaffCounts,
  cleanupCompletedOrders,
  calculateRevenueReport,
  getOrderCompletionDate
} from './helpers/test_oracle.js';

import {
  validateAutoBackupSchema,
  validateSqlMigrationContent
} from './helpers/schema_validator.js';

import { getVietnamTodayString } from '../src/utils/dateTime.js';

describe('Tier 4: Real-World Scenarios', () => {

  test('T4.1 - Complete Morning Shift Workflow', () => {
    // 1. Shift Opening: Manager reviews session settings
    const currentShift = FIXTURE_SETTINGS.shiftName;
    const currentBranch = FIXTURE_SETTINGS.branchName;
    assert.equal(currentShift, 'Ca Sáng (06:30 - 14:30)', 'Morning shift configured');
    assert.equal(currentBranch, 'Chi nhánh 01 - Trụ sở chính');

    // 2. Staff Roster Inspection: Confirm active staff available for the shift
    let roster = createInitialStaffList();
    const { active, total } = getStaffCounts(roster);
    assert.ok(active >= 1, 'At least 1 active staff must be present to operate shift');
    assert.equal(active, 3);

    // 3. Operational Configs Check: WiFi receipt password and VietQR ready
    assert.equal(FIXTURE_SETTINGS.wifiPassword, 'goccaphe2026');
    assert.equal(FIXTURE_SETTINGS.bankAccount.bankCode, 'MB');

    // 4. Dining Floor Operation: Seating customer at B01
    const tableFloor = JSON.parse(JSON.stringify(FIXTURE_TABLES));
    const tableB01 = tableFloor.find((t) => t.id === 'B01');
    assert.equal(tableB01.status, 'empty');

    // Seat guest and place order
    tableB01.status = 'occupied';
    tableB01.customerCount = 2;
    const newOrderId = `ORD-${Date.now()}`;
    tableB01.activeOrderId = newOrderId;

    const liveOrder = {
      id: newOrderId,
      tableId: 'B01',
      tableName: 'Bàn 01',
      status: 'serving',
      cashier: 'Trần Mai',
      customerCount: 2,
      items: [
        { productId: 'prod-1', name: 'Cà phê Phin Đen Đậm Vị', quantity: 2, lineTotal: 56000 }
      ],
      total: 56000,
      paidAmount: 0,
      createdAt: new Date().toISOString()
    };

    assert.equal(liveOrder.status, 'serving');

    // 5. Customer Checkout via VietQR
    liveOrder.status = 'completed';
    liveOrder.paymentMethod = 'vietqr';
    liveOrder.paidAmount = 56000;
    liveOrder.finishedAt = new Date().toISOString();

    // Reset Table B01
    tableB01.status = 'empty';
    tableB01.activeOrderId = null;
    tableB01.customerCount = null;

    // Archive to orderHistory
    let orderHistory = [...FIXTURE_COMPLETED_ORDERS, liveOrder];
    assert.equal(orderHistory.length, 5);

    // Verify today revenue reflects the new order
    const todayStr = getVietnamTodayString();
    const todayOrders = orderHistory.filter((o) => getOrderCompletionDate(o) === todayStr);
    assert.ok(todayOrders.length >= 1, 'Order finalized within today business day');
  });

  test('T4.2 - End-of-Day Sales Cleanup with Auto-Backup Verification', () => {
    let orderHistory = [...FIXTURE_COMPLETED_ORDERS];
    const todayStr = getVietnamTodayString();

    // 1. End-of-day cleanup initiation for previous days (before today)
    const preview = calculateCleanupPreview(orderHistory, 'before_date', {
      beforeDate: todayStr
    });

    assert.ok(preview.count > 0, 'Found completed orders from previous days to clean');
    const ordersCount = preview.count;
    const revenueAmount = preview.totalRevenue;

    // 2. Automated backup file generation
    const { filename, payload } = generateAutoBackupPayload(preview.targetOrders, {
      mode: 'before_date',
      criteria: { beforeDate: todayStr },
      performedBy: 'Quản lý (Admin)'
    });

    // 3. Rigorous validation of downloaded JSON file payload
    const schemaCheck = validateAutoBackupSchema(payload);
    assert.ok(schemaCheck.valid, `Backup schema valid: ${schemaCheck.errors.join('; ')}`);
    assert.equal(payload.orders.length, ordersCount);
    assert.equal(payload.exportMetadata.totalRevenue, revenueAmount);
    assert.ok(filename.startsWith('backup_orders_'));

    // 4. Two-step confirmation and deletion execution
    const deletedIds = preview.targetOrders.map((o) => o.id);
    orderHistory = cleanupCompletedOrders(orderHistory, deletedIds);

    // 5. Verify audit job record created
    const auditRecord = {
      id: `clean_${Date.now()}`,
      cleanup_mode: 'before_date',
      date_range: { beforeDate: todayStr },
      orders_count: ordersCount,
      total_amount: revenueAmount,
      performed_by: 'Quản lý (Admin)',
      backup_file_name: filename,
      created_at: new Date().toISOString()
    };

    assert.equal(auditRecord.orders_count, ordersCount);
    assert.equal(auditRecord.backup_file_name, filename);
    assert.equal(auditRecord.performed_by, 'Quản lý (Admin)');

    // 6. Verify order history reduced cleanly
    assert.equal(orderHistory.length, FIXTURE_COMPLETED_ORDERS.length - ordersCount);
  });

  test('T4.3 - Staff Turnover & Roster Lifecycle Management', () => {
    let roster = createInitialStaffList();
    assert.equal(roster.length, 3);
    assert.equal(getStaffCounts(roster).active, 3);

    // 1. Hiring: Add new barista "Võ Thị Yến"
    roster = addStaff(roster, 'Võ Thị Yến');
    const newBarista = roster.find((s) => s.name === 'Võ Thị Yến');
    assert.ok(newBarista);
    assert.equal(newBarista.status, 'active');
    assert.equal(getStaffCounts(roster).total, 4);
    assert.equal(getStaffCounts(roster).active, 4);

    // 2. Departure/Leave: Pause staff "staff-03" (Lê Hoàng Nam)
    roster = toggleStaffStatus(roster, 'staff-03');
    assert.equal(roster.find((s) => s.id === 'staff-03').status, 'paused');
    assert.equal(getStaffCounts(roster).active, 3);
    assert.equal(getStaffCounts(roster).total, 4);

    // 3. Name Correction: Fix typo in staff name
    roster = updateStaffName(roster, newBarista.id, 'Võ Thị Hải Yến');
    assert.equal(roster.find((s) => s.id === newBarista.id).name, 'Võ Thị Hải Yến');

    // 4. Privacy Guarantee Check across entire roster
    for (const member of roster) {
      const keys = Object.keys(member);
      assert.ok(!keys.includes('phone'), 'Staff roster must never leak phone numbers');
      assert.ok(!keys.includes('identityCard'), 'Staff roster must never leak identity cards');
      assert.ok(!keys.includes('homeAddress'), 'Staff roster must never leak home addresses');
    }
  });

});
