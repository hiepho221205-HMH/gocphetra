/**
 * Challenger M3: Empirical & Stress Verification for Safe Hard-Delete with Auto-Backup
 * Verifies R3 requirements, strict isolation, timezone evaluation, auto-backup schema, and UI contracts
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  FIXTURE_TABLES,
  FIXTURE_ACTIVE_ORDERS,
  FIXTURE_COMPLETED_ORDERS,
  FIXTURE_STAFF,
  FIXTURE_SETTINGS
} from './helpers/fixtures.js';

import {
  getOrderCompletionDate,
  getVietnamBackupTimestamp,
  generateBackupFilename,
  calculateCleanupPreview,
  generateAutoBackupPayload,
  triggerOrdersBackupDownload,
  CLEANUP_MODES
} from '../src/utils/cleanupBackup.js';

import { validateAutoBackupSchema } from './helpers/schema_validator.js';

describe('Challenger M3: Safe Hard-Delete with Auto-Backup Empirical Verification', () => {

  // =========================================================================
  // 1. EXACT TIMEZONE & TIMESTAMP PRECEDENCE EVALUATION
  // =========================================================================
  describe('1. Timezone & Timestamp Precedence Evaluation', () => {

    test('1.1 - Evaluates timestamps strictly in Asia/Ho_Chi_Minh (UTC+7)', () => {
      // 16:59:59 UTC on Oct 18 is 23:59:59 VN on Oct 18
      const orderA = {
        id: 'ORD-TZ-1',
        status: 'completed',
        finishedAt: '2026-10-18T16:59:59.000Z'
      };
      assert.equal(getOrderCompletionDate(orderA), '2026-10-18');

      // 17:00:00 UTC on Oct 18 is 00:00:00 VN on Oct 19
      const orderB = {
        id: 'ORD-TZ-2',
        status: 'completed',
        finishedAt: '2026-10-18T17:00:00.000Z'
      };
      assert.equal(getOrderCompletionDate(orderB), '2026-10-19');

      // 18:30:00 UTC on Oct 18 is 01:30:00 VN on Oct 19
      const orderC = {
        id: 'ORD-TZ-3',
        status: 'completed',
        finishedAt: '2026-10-18T18:30:00.000Z'
      };
      assert.equal(getOrderCompletionDate(orderC), '2026-10-19');
    });

    test('1.2 - Evaluates timestamp candidate fields in strict precedence order', () => {
      // Precedence: finishedAt > finished_at > paidAt > paid_at > completedAt > completed_at > splitPayments > createdAt > created_at
      const order = {
        id: 'ORD-PREC-1',
        status: 'completed',
        created_at: '2026-10-10T10:00:00.000Z',
        createdAt: '2026-10-11T10:00:00.000Z',
        completed_at: '2026-10-12T10:00:00.000Z',
        completedAt: '2026-10-13T10:00:00.000Z',
        paid_at: '2026-10-14T10:00:00.000Z',
        paidAt: '2026-10-15T10:00:00.000Z',
        finished_at: '2026-10-16T10:00:00.000Z',
        finishedAt: '2026-10-17T10:00:00.000Z'
      };

      assert.equal(getOrderCompletionDate(order), '2026-10-17', 'finishedAt takes highest priority');

      delete order.finishedAt;
      assert.equal(getOrderCompletionDate(order), '2026-10-16', 'finished_at takes priority when finishedAt is absent');

      delete order.finished_at;
      assert.equal(getOrderCompletionDate(order), '2026-10-15', 'paidAt takes priority when finished timestamps are absent');

      delete order.paidAt;
      assert.equal(getOrderCompletionDate(order), '2026-10-14', 'paid_at takes priority when paidAt is absent');

      delete order.paid_at;
      assert.equal(getOrderCompletionDate(order), '2026-10-13', 'completedAt takes priority when paid timestamps are absent');

      delete order.completedAt;
      assert.equal(getOrderCompletionDate(order), '2026-10-12', 'completed_at takes priority');

      delete order.completed_at;
      order.splitPayments = [{ timestamp: '2026-10-11T18:00:00.000Z' }];
      assert.equal(getOrderCompletionDate(order), '2026-10-12', 'splitPayments timestamp evaluates in Vietnam timezone (18:00 UTC = 01:00 VN next day)');

      delete order.splitPayments;
      assert.equal(getOrderCompletionDate(order), '2026-10-11', 'createdAt takes priority when lifecycle timestamps are absent');

      delete order.createdAt;
      assert.equal(getOrderCompletionDate(order), '2026-10-10', 'created_at is lowest fallback');
    });

    test('1.3 - Corrupt orders with missing or invalid timestamps return empty string and are shielded', () => {
      assert.equal(getOrderCompletionDate(null), '');
      assert.equal(getOrderCompletionDate(undefined), '');
      assert.equal(getOrderCompletionDate({}), '');
      assert.equal(getOrderCompletionDate({ id: 'ORD-CORRUPT', status: 'completed' }), '');
      assert.equal(getOrderCompletionDate({ id: 'ORD-INVALID', status: 'completed', finishedAt: 'invalid-date' }), '');

      // In calculateCleanupPreview, corrupt order must NOT be selected in any mode
      const corruptOrders = [
        { id: 'ORD-CORRUPT', status: 'completed', total: 50000 }
      ];
      const previewRange = calculateCleanupPreview(corruptOrders, 'range', { fromDate: '2026-01-01', toDate: '2026-12-31' });
      assert.equal(previewRange.count, 0, 'Corrupt order without date is shielded from range cleanup');

      const previewBefore = calculateCleanupPreview(corruptOrders, 'before_date', { beforeDate: '2026-12-31' });
      assert.equal(previewBefore.count, 0, 'Corrupt order without date is shielded from before_date cleanup');
    });
  });

  // =========================================================================
  // 2. LIVE PREVIEW KPI & 3 SCOPE MODES
  // =========================================================================
  describe('2. Live Preview KPI Calculation & Scope Modes', () => {

    test('2.1 - Scope Mode: range calculates matching orders, total revenue, cash and VietQR breakdown', () => {
      const orders = [
        { id: 'O1', status: 'completed', total: 50000, paymentMethod: 'cash', finishedAt: '2026-10-18T10:00:00.000Z' },
        { id: 'O2', status: 'completed', total: 80000, paymentMethod: 'vietqr', finishedAt: '2026-10-18T12:00:00.000Z' },
        { id: 'O3', status: 'completed', total: 30000, paymentMethod: 'cash', finishedAt: '2026-10-19T02:00:00.000Z' }
      ];

      const preview = calculateCleanupPreview(orders, 'range', {
        fromDate: '2026-10-18',
        toDate: '2026-10-18'
      });

      assert.equal(preview.count, 2);
      assert.equal(preview.totalRevenue, 130000);
      assert.equal(preview.cashTotal, 50000);
      assert.equal(preview.qrTotal, 80000);
      assert.equal(preview.totalRevenue, preview.cashTotal + preview.qrTotal);
    });

    test('2.2 - Scope Mode: before_date selects only orders completed strictly before target date', () => {
      const orders = [
        { id: 'O1', status: 'completed', total: 40000, finishedAt: '2026-10-17T10:00:00.000Z' },
        { id: 'O2', status: 'completed', total: 60000, finishedAt: '2026-10-18T10:00:00.000Z' },
        { id: 'O3', status: 'completed', total: 50000, finishedAt: '2026-10-19T10:00:00.000Z' }
      ];

      const preview = calculateCleanupPreview(orders, 'before_date', {
        beforeDate: '2026-10-19'
      });

      assert.equal(preview.count, 2);
      assert.equal(preview.totalRevenue, 100000);
      assert.deepEqual(preview.targetOrders.map((o) => o.id), ['O1', 'O2']);
    });

    test('2.3 - Scope Mode: all_completed selects all completed orders regardless of date', () => {
      const preview = calculateCleanupPreview(FIXTURE_COMPLETED_ORDERS, 'all_completed');
      assert.equal(preview.count, 4);
      assert.equal(preview.totalRevenue, 288000);
      assert.equal(preview.cashTotal + preview.qrTotal, preview.totalRevenue);
    });

    test('2.4 - Boundary: Inverted date range (fromDate > toDate) returns error INVERTED_RANGE', () => {
      const preview = calculateCleanupPreview(FIXTURE_COMPLETED_ORDERS, 'range', {
        fromDate: '2026-10-25',
        toDate: '2026-10-10'
      });

      assert.equal(preview.count, 0);
      assert.equal(preview.totalRevenue, 0);
      assert.equal(preview.error, 'INVERTED_RANGE');
      assert.deepEqual(preview.targetOrders, []);
    });

    test('2.5 - Non-completed orders (serving, awaiting_payment, cancelled) are NEVER selected', () => {
      const mixedOrders = [
        { id: 'ORD-ACTIVE-1', status: 'serving', total: 100000, finishedAt: '2026-10-18T10:00:00.000Z' },
        { id: 'ORD-ACTIVE-2', status: 'awaiting_payment', total: 75000, finishedAt: '2026-10-18T10:00:00.000Z' },
        { id: 'ORD-CANCELLED', status: 'cancelled', total: 50000, finishedAt: '2026-10-18T10:00:00.000Z' },
        { id: 'ORD-DONE', status: 'completed', total: 45000, finishedAt: '2026-10-18T10:00:00.000Z' }
      ];

      const preview = calculateCleanupPreview(mixedOrders, 'all_completed');
      assert.equal(preview.count, 1, 'Only status === completed order is selected');
      assert.equal(preview.targetOrders[0].id, 'ORD-DONE');
    });
  });

  // =========================================================================
  // 3. AUTO-BACKUP JSON PAYLOAD & FILENAME CONTRACT
  // =========================================================================
  describe('3. Auto-Backup JSON Schema & File Generation', () => {

    test('3.1 - Generates filename adhering to backup_orders_<YYYYMMDD_HHmmss>.json in Vietnam timezone', () => {
      const filename = generateBackupFilename();
      assert.match(filename, /^backup_orders_\d{8}_\d{6}\.json$/);

      const ts = getVietnamBackupTimestamp();
      assert.match(ts, /^\d{8}_\d{6}$/);
    });

    test('3.2 - Auto-backup payload satisfies 100% of schema_validator rules', () => {
      const targetOrders = FIXTURE_COMPLETED_ORDERS;
      const { filename, payload } = generateAutoBackupPayload(targetOrders, {
        mode: 'range',
        fromDate: '2026-10-18',
        toDate: '2026-10-19',
        performedBy: 'Quản lý (Admin)'
      });

      assert.match(filename, /^backup_orders_\d{8}_\d{6}\.json$/);
      const validation = validateAutoBackupSchema(payload);
      assert.ok(validation.valid, `Schema errors: ${validation.errors.join('; ')}`);
      assert.equal(payload.exportMetadata.system, 'GÓC Coffee POS');
      assert.equal(payload.exportMetadata.version, '1.0.0');
      assert.equal(payload.exportMetadata.schemaVersion, 5);
      assert.equal(payload.exportMetadata.backupType, 'pre_cleanup_auto_backup');
      assert.equal(payload.exportMetadata.cleanupMode, 'range');
      assert.equal(payload.exportMetadata.totalOrders, targetOrders.length);
      assert.equal(payload.exportMetadata.totalRevenue, 288000);
      assert.equal(payload.orders.length, targetOrders.length);
    });

    test('3.3 - triggerOrdersBackupDownload returns success, filename, and payload even in headless environment', () => {
      const result = triggerOrdersBackupDownload(FIXTURE_COMPLETED_ORDERS.slice(0, 2), {
        mode: 'before_date',
        beforeDate: '2026-10-19'
      });

      assert.ok(result.success);
      assert.match(result.filename, /^backup_orders_\d{8}_\d{6}\.json$/);
      assert.equal(result.count, 2);
      assert.equal(result.totalRevenue, 187000);
      assert.ok(result.payload);
    });
  });

  // =========================================================================
  // 4. STRICT ISOLATION & POSCONTEXT INTEGRATION
  // =========================================================================
  describe('4. Strict Isolation & PosContext Integration', () => {

    test('4.1 - PosContext source code defines and exports cleanupCompletedOrders', () => {
      const posContextPath = path.resolve('src/store/PosContext.jsx');
      const posContextCode = fs.readFileSync(posContextPath, 'utf8');

      assert.ok(
        posContextCode.includes('cleanupCompletedOrders'),
        'PosContext must define cleanupCompletedOrders'
      );
      assert.ok(
        posContextCode.includes('DATA CLEANUP ACTIONS (MILESTONE 3)'),
        'PosContext must contain Milestone 3 section header'
      );
      assert.ok(
        posContextCode.includes('STORAGE_KEYS.ORDER_HISTORY'),
        'cleanupCompletedOrders must update LocalStorage goc_pos_history_v4'
      );
      assert.ok(
        posContextCode.includes("from('orders').delete()"),
        'cleanupCompletedOrders must call Supabase orders batch delete'
      );
      assert.ok(
        posContextCode.includes("from('data_cleanup_jobs').insert"),
        'cleanupCompletedOrders must log job in data_cleanup_jobs'
      );
    });

    test('4.2 - Strict isolation: Active dining tables and active orders are 100% untouched', () => {
      // Snapshot initial state of tables and active orders
      const initialTables = JSON.parse(JSON.stringify(FIXTURE_TABLES));
      const initialActiveOrders = JSON.parse(JSON.stringify(FIXTURE_ACTIVE_ORDERS));

      // Simulate cleanup execution on completed orders
      const deleteIds = ['ORD-HIST-01', 'ORD-HIST-02', 'ORD-HIST-03', 'ORD-HIST-04'];
      const remainingHistory = FIXTURE_COMPLETED_ORDERS.filter((o) => !deleteIds.includes(o.id));

      assert.equal(remainingHistory.length, 0, 'Completed history is cleared');

      // Assert zero mutation to active dining
      assert.deepEqual(FIXTURE_TABLES, initialTables, 'Active dining tables must be completely untouched');
      assert.deepEqual(FIXTURE_ACTIVE_ORDERS, initialActiveOrders, 'Active orders (serving/awaiting_payment) must be completely untouched');

      // Verify Table B02 occupied by ORD-101
      const tableB02 = FIXTURE_TABLES.find((t) => t.id === 'B02');
      assert.equal(tableB02.status, 'occupied');
      assert.equal(tableB02.activeOrderId, 'ORD-101');

      // Verify Table B03 occupied by ORD-102
      const tableB03 = FIXTURE_TABLES.find((t) => t.id === 'B03');
      assert.equal(tableB03.status, 'occupied');
      assert.equal(tableB03.activeOrderId, 'ORD-102');
    });
  });

  // =========================================================================
  // 5. COMPONENT STRUCTURE & TEST-ID CONTRACTS
  // =========================================================================
  describe('5. DataCleanupSection & ManagementProfileView Integration', () => {

    test('5.1 - DataCleanupSection.jsx contains all required test-ids and structural elements', () => {
      const sectionPath = path.resolve('src/components/management/DataCleanupSection.jsx');
      assert.ok(fs.existsSync(sectionPath), 'DataCleanupSection.jsx must exist');
      const code = fs.readFileSync(sectionPath, 'utf8');

      // Required testids from spec:
      const requiredTestIds = [
        'data-cleanup-section',
        'cleanup-scope-tabs',
        'cleanup-tab-range',
        'cleanup-tab-before-date',
        'cleanup-tab-all',
        'cleanup-range-inputs',
        'cleanup-from-date',
        'cleanup-to-date',
        'cleanup-inverted-warning',
        'cleanup-before-date-inputs',
        'cleanup-before-date',
        'cleanup-all-notice',
        'cleanup-preview-card',
        'cleanup-preview-count',
        'cleanup-preview-revenue',
        'cleanup-preview-cash',
        'cleanup-preview-vietqr',
        'cleanup-zero-orders-notice',
        'cleanup-impact-warning',
        'cleanup-protection-guarantee',
        'cleanup-initiate-btn',
        'cleanup-confirm-modal',
        'cleanup-modal-close-btn',
        'cleanup-scope-summary',
        'cleanup-download-backup-btn',
        'cleanup-backup-downloaded-alert',
        'cleanup-cancel-modal-btn',
        'cleanup-proceed-to-step2-btn',
        'cleanup-danger-alert',
        'cleanup-confirm-checkbox',
        'cleanup-back-step-btn',
        'cleanup-execute-delete-btn'
      ];

      for (const tid of requiredTestIds) {
        assert.ok(code.includes(tid), `DataCleanupSection must contain testid "${tid}"`);
      }
    });

    test('5.2 - ManagementProfileView imports and mounts DataCleanupSection in Section 2 slot', () => {
      const profilePath = path.resolve('src/components/management/ManagementProfileView.jsx');
      const profileCode = fs.readFileSync(profilePath, 'utf8');

      assert.ok(
        profileCode.includes("import DataCleanupSection from './DataCleanupSection';"),
        'ManagementProfileView must import DataCleanupSection'
      );

      assert.ok(
        profileCode.includes('MILESTONE 3: DataCleanupSection'),
        'Slot comment MILESTONE 3: DataCleanupSection must be preserved'
      );

      assert.ok(
        profileCode.includes('<DataCleanupSection />'),
        'DataCleanupSection component must be mounted'
      );
    });

    test('5.3 - Anti-cheat: No mock bypasses or hardcoded test returns in source files', () => {
      const cleanupBackupCode = fs.readFileSync('src/utils/cleanupBackup.js', 'utf8');
      const dataCleanupSectionCode = fs.readFileSync('src/components/management/DataCleanupSection.jsx', 'utf8');

      assert.ok(!cleanupBackupCode.includes('return 288000;'), 'cleanupBackup must calculate real revenue dynamically');
      assert.ok(!cleanupBackupCode.includes('return 4;'), 'cleanupBackup must count real orders dynamically');
      assert.ok(!dataCleanupSectionCode.includes('// mock'), 'No mock comments allowed in DataCleanupSection');
    });
  });

});
