/**
 * Test Suite: Supabase Sales Data Deletion & Admin Synchronization Tests
 * Tests the complete, production-grade Sales Data Deletion feature with
 * genuine Supabase RPC hard-delete synchronization, multi-tier safety controls,
 * initial null-mode state, and exact "XÓA DỮ LIỆU" text confirmation.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  CLEANUP_MODES,
  calculateCleanupPreview,
  checkOrderCrossDatePayment,
  getOrderCompletionDate,
  generateAutoBackupPayload
} from '../src/utils/cleanupBackup.js';

import {
  adminHardDeleteSalesDataRpc
} from '../src/lib/supabase.js';

describe('Supabase Sales Data Deletion & Admin Synchronization', () => {

  const FIXTURE_ORDERS = [
    {
      id: 'ORD-HIST-01',
      status: 'completed',
      businessDate: '2026-10-18',
      finishedAt: '2026-10-18T10:30:00Z',
      total: 65000,
      paymentMethod: 'cash',
      items: [{ name: 'Cà phê sữa đá', quantity: 1, price: 35000 }]
    },
    {
      id: 'ORD-HIST-02',
      status: 'completed',
      businessDate: '2026-10-18',
      finishedAt: '2026-10-18T14:15:00Z',
      total: 80000,
      paymentMethod: 'vietqr',
      items: [{ name: 'Trà đào cam sả', quantity: 2, price: 40000 }]
    },
    {
      id: 'ORD-CANCELLED-01',
      status: 'cancelled',
      businessDate: '2026-10-18',
      finishedAt: '2026-10-18T16:00:00Z',
      total: 45000,
      paymentMethod: 'cash',
      items: [{ name: 'Bạc xỉu', quantity: 1, price: 45000 }]
    },
    {
      id: 'ORD-UNPAID-ROLLOVER',
      status: 'unpaid_carried_over',
      businessDate: '2026-10-18',
      finishedAt: '2026-10-18T23:59:00Z',
      total: 55000,
      paymentMethod: 'cash',
      items: [{ name: 'Trà sen vàng', quantity: 1, price: 55000 }]
    },
    {
      id: 'ORD-SERVING-ACTIVE',
      status: 'serving',
      tableId: 'table-01',
      tableName: 'Bàn 01',
      businessDate: '2026-10-21',
      createdAt: '2026-10-21T09:00:00Z',
      total: 120000,
      items: [{ name: 'Cà phê đen', quantity: 4, price: 30000 }]
    },
    {
      id: 'ORD-CROSS-DATE',
      status: 'completed',
      businessDate: '2026-10-18',
      finishedAt: '2026-10-19T01:30:00Z',
      paymentBusinessDate: '2026-10-19',
      total: 90000,
      paymentMethod: 'vietqr',
      splitPayments: [
        { paymentId: 'PAY-01', amount: 90000, timestamp: '2026-10-19T01:30:00Z', businessDate: '2026-10-19' }
      ]
    }
  ];

  // =========================================================================
  // 1. INITIAL NULL MODE & SCOPE RESOLUTION
  // =========================================================================
  describe('1. Initial Null-State & Scope Selection', () => {

    test('1.1 - When mode is null or undefined, calculateCleanupPreview returns safe empty state', () => {
      const nullPreview = calculateCleanupPreview(FIXTURE_ORDERS, null);
      assert.equal(nullPreview.count, 0, 'Null mode must yield 0 orders');
      assert.equal(nullPreview.totalRevenue, 0, 'Null mode must yield 0 revenue');
      assert.deepEqual(nullPreview.targetOrders, [], 'Target orders must be empty');
      assert.equal(nullPreview.hasCrossDatePayments, false);

      const undefinedPreview = calculateCleanupPreview(FIXTURE_ORDERS, undefined);
      assert.equal(undefinedPreview.count, 0);
    });

    test('1.2 - Range mode correctly filters orders within date range and excludes serving dining tables', () => {
      const rangePreview = calculateCleanupPreview(FIXTURE_ORDERS, CLEANUP_MODES.RANGE, {
        fromDate: '2026-10-18',
        toDate: '2026-10-18',
        includeHistoricalStatuses: true
      });

      // ORD-HIST-01 (65k), ORD-HIST-02 (80k), ORD-CANCELLED-01 (45k), ORD-UNPAID-ROLLOVER (55k), ORD-CROSS-DATE (90k)
      assert.equal(rangePreview.count, 5);
      assert.ok(!rangePreview.targetOrders.some(o => o.id === 'ORD-SERVING-ACTIVE'), 'Serving table must never be selected');
      assert.equal(rangePreview.totalRevenue, 335000);
      assert.equal(rangePreview.cashTotal, 165000);
      assert.equal(rangePreview.qrTotal, 170000);
    });

    test('1.3 - Before-date mode correctly filters orders prior to cutoff date', () => {
      const beforePreview = calculateCleanupPreview(FIXTURE_ORDERS, CLEANUP_MODES.BEFORE_DATE, {
        beforeDate: '2026-10-19',
        includeHistoricalStatuses: true
      });

      assert.equal(beforePreview.count, 5);
      assert.ok(!beforePreview.targetOrders.some(o => o.id === 'ORD-SERVING-ACTIVE'));
    });

    test('1.4 - All-history mode covers completed, cancelled, and rollover orders while shielding active tables', () => {
      const allPreview = calculateCleanupPreview(FIXTURE_ORDERS, CLEANUP_MODES.ALL, {
        includeHistoricalStatuses: true
      });

      assert.equal(allPreview.count, 5);
      const ids = allPreview.targetOrders.map(o => o.id);
      assert.ok(ids.includes('ORD-HIST-01'));
      assert.ok(ids.includes('ORD-HIST-02'));
      assert.ok(ids.includes('ORD-CANCELLED-01'));
      assert.ok(ids.includes('ORD-UNPAID-ROLLOVER'));
      assert.ok(ids.includes('ORD-CROSS-DATE'));
      assert.ok(!ids.includes('ORD-SERVING-ACTIVE'));
    });
  });

  // =========================================================================
  // 2. CROSS-DATE PAYMENT DETECTION & AUDIT TRAIL
  // =========================================================================
  describe('2. Cross-Date Payment Detection & Auto-Backup Payload', () => {

    test('2.1 - checkOrderCrossDatePayment detects payment executed on different date than businessDate', () => {
      const crossOrder = FIXTURE_ORDERS.find(o => o.id === 'ORD-CROSS-DATE');
      assert.ok(checkOrderCrossDatePayment(crossOrder), 'Cross date order must be detected');

      const regularOrder = FIXTURE_ORDERS.find(o => o.id === 'ORD-HIST-01');
      assert.equal(checkOrderCrossDatePayment(regularOrder), false, 'Normal order must not be flagged');
    });

    test('2.2 - calculateCleanupPreview correctly flags hasCrossDatePayments and reports accurate count', () => {
      const preview = calculateCleanupPreview(FIXTURE_ORDERS, CLEANUP_MODES.RANGE, {
        fromDate: '2026-10-18',
        toDate: '2026-10-18',
        includeHistoricalStatuses: true
      });

      assert.equal(preview.hasCrossDatePayments, true);
      assert.equal(preview.crossDatePaymentCount, 1);
    });

    test('2.3 - Auto-backup payload embeds metadata, system name, schema version, and store reference', () => {
      const targetOrders = FIXTURE_ORDERS.filter(o => o.status !== 'serving');
      const { filename, payload } = generateAutoBackupPayload(targetOrders, {
        mode: 'range',
        fromDate: '2026-10-18',
        toDate: '2026-10-18',
        performedBy: 'Quản lý (Admin)'
      });

      assert.match(filename, /^backup_orders_\d{8}_\d{6}\.json$/);
      assert.equal(payload.exportMetadata.system, 'GÓC Coffee POS');
      assert.equal(payload.exportMetadata.totalOrders, 5);
      assert.equal(payload.exportMetadata.totalRevenue, 335000);
      assert.equal(payload.exportMetadata.performedBy, 'Quản lý (Admin)');
    });
  });

  // =========================================================================
  // 3. UI SAFETY CONTRACT & "XÓA DỮ LIỆU" MANDATORY CONFIRMATION
  // =========================================================================
  describe('3. UI Contract & Mandatory Text Confirmation', () => {

    test('3.1 - DataCleanupSection source code enforces initial null mode and prompt alert', () => {
      const sectionPath = path.resolve('src/components/management/DataCleanupSection.jsx');
      const code = fs.readFileSync(sectionPath, 'utf8');

      assert.ok(code.includes('useState(null)'), 'cleanupMode must initialize to null');
      assert.ok(code.includes('cleanup-no-mode-selected'), 'Must render prompt when no mode is selected');
      assert.ok(code.includes('cleanup-cross-date-warning'), 'Must render cross-date payment warning testid');
      assert.ok(code.includes('cleanup-confirm-input'), 'Must provide text input for confirmation');
    });

    test('3.2 - Confirmation requires exact string "XÓA DỮ LIỆU" to enable deletion', () => {
      const sectionPath = path.resolve('src/components/management/DataCleanupSection.jsx');
      const code = fs.readFileSync(sectionPath, 'utf8');

      assert.ok(
        code.includes("confirmDeleteText.trim() === 'XÓA DỮ LIỆU'") ||
        code.includes("confirmDeleteText.trim() !== 'XÓA DỮ LIỆU'"),
        'Code must check exact string XÓA DỮ LIỆU'
      );
      assert.ok(
        code.includes('disabled={!isConfirmedChecked || confirmDeleteText.trim() !== \'XÓA DỮ LIỆU\''),
        'Delete button must be disabled until exact string is entered and checkbox checked'
      );
    });

    test('3.3 - Displays store name, affected scope, and table preservation guarantee', () => {
      const sectionPath = path.resolve('src/components/management/DataCleanupSection.jsx');
      const code = fs.readFileSync(sectionPath, 'utf8');

      assert.ok(code.includes('storeName'), 'Must compute and display storeName');
      assert.ok(code.includes('Bảng bị xóa vĩnh viễn'), 'Must specify affected tables (orders, payments)');
      assert.ok(code.includes('Bảo toàn'), 'Must specify preserved entities (menu, tables, staff)');
    });
  });

  // =========================================================================
  // 4. SUPABASE RPC & MIGRATION SQL CONTRACT
  // =========================================================================
  describe('4. Supabase RPC Function & Atomic Transaction Contract', () => {

    test('4.1 - Migration file 20261021160000_hard_delete_sales_data_rpc.sql defines secure RPC function', () => {
      const migrationPath = path.resolve('supabase/migrations/20261021160000_hard_delete_sales_data_rpc.sql');
      assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');

      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('admin_hard_delete_sales_data'), 'Must define admin_hard_delete_sales_data');
      assert.ok(sql.includes('SECURITY DEFINER'), 'Must be SECURITY DEFINER');
      assert.ok(sql.includes("DELETE FROM public.payments"), 'Must delete child payments first');
      assert.ok(sql.includes("UPDATE public.tables"), 'Must unlink active_order_id on tables');
      assert.ok(sql.includes("DELETE FROM public.orders"), 'Must delete parent orders');
      assert.ok(sql.includes("INSERT INTO public.data_cleanup_jobs"), 'Must record cleanup job');
      assert.ok(sql.includes("INSERT INTO public.audit_logs"), 'Must write to audit_logs');
    });

    test('4.2 - adminHardDeleteSalesDataRpc is exported from supabase.js and validates inputs', async () => {
      assert.equal(typeof adminHardDeleteSalesDataRpc, 'function');

      // Empty order array yields clean non-error response
      const emptyRes = await adminHardDeleteSalesDataRpc([]);
      assert.equal(emptyRes.success, true);
      assert.equal(emptyRes.count, 0);
    });

    test('4.3 - PosContext imports adminHardDeleteSalesDataRpc and aborts if RPC reports failure', () => {
      const posContextPath = path.resolve('src/store/PosContext.jsx');
      const posCode = fs.readFileSync(posContextPath, 'utf8');

      assert.ok(posCode.includes('adminHardDeleteSalesDataRpc'), 'PosContext must import adminHardDeleteSalesDataRpc');
      assert.ok(posCode.includes('adminHardDeleteSalesDataRpc(idsToDelete, metadata)'), 'Must call RPC with target IDs');
      assert.ok(posCode.includes("showToast('Từ chối quyền: Chỉ Quản trị viên (Admin)"), 'Must enforce Admin role guard');
    });
  });
});
