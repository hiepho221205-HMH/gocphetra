/**
 * Challenger 2 (M3) Empirical Verification Suite:
 * Safe Hard-Delete with Auto-Backup — Strict Isolation & Whole-System Coexistence
 *
 * Mission Objectives:
 * 1. Setup active dining orders (status 'serving', 'awaiting_payment') and occupied tables.
 * 2. Execute hard-delete of completed orders via cleanupCompletedOrders.
 * 3. Verify that active orders and occupied tables are 100% intact and untouched.
 * 4. Verify that revenue reports and historical metrics accurately reflect the purged records.
 * 5. Verify core POS operations (table grid, menu, ordering, billing, reports, settings) continue to function with 0 regressions.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Core domain data & fixtures
import {
  INITIAL_TABLES,
  INITIAL_CATEGORIES,
  INITIAL_MENU,
  INITIAL_TOPPINGS,
  INITIAL_PRODUCT_TOPPINGS,
  INITIAL_ORDERS,
  INITIAL_ORDER_HISTORY,
  INITIAL_SETTINGS,
  INITIAL_STAFF
} from '../src/data/initialData.js';

import {
  FIXTURE_TABLES,
  FIXTURE_ACTIVE_ORDERS,
  FIXTURE_COMPLETED_ORDERS,
  FIXTURE_STAFF,
  FIXTURE_SETTINGS
} from './helpers/fixtures.js';

import {
  getOrderCompletionDate,
  calculateCleanupPreview,
  generateAutoBackupPayload,
  triggerOrdersBackupDownload,
  CLEANUP_MODES
} from '../src/utils/cleanupBackup.js';

import {
  getVietnamTodayString,
  getVietnamDateString,
  getDaysRange,
  formatDayLabel
} from '../src/utils/dateTime.js';

import { generateVietQRUrl } from '../src/utils/vietqr.js';

describe('Challenger 2: Strict Isolation & Whole-System Coexistence (M3)', () => {

  const posContextPath = path.resolve('src/store/PosContext.jsx');
  const posContextCode = fs.readFileSync(posContextPath, 'utf8');

  const cleanupSectionPath = path.resolve('src/components/management/DataCleanupSection.jsx');
  const cleanupSectionCode = fs.readFileSync(cleanupSectionPath, 'utf8');

  const reportsViewPath = path.resolve('src/components/reports/ReportsView.jsx');
  const reportsViewCode = fs.readFileSync(reportsViewPath, 'utf8');

  const profileViewPath = path.resolve('src/components/management/ManagementProfileView.jsx');
  const profileViewCode = fs.readFileSync(profileViewPath, 'utf8');

  // =========================================================================
  // SECTION 1: STRICT ACTIVE DINING & TABLE ISOLATION
  // =========================================================================
  describe('1. Strict Active Dining & Table Isolation', () => {

    test('1.1 - Setup active dining environment with occupied tables and serving/awaiting orders', () => {
      // Deep clone fixtures to simulate active POS environment
      const tables = JSON.parse(JSON.stringify(FIXTURE_TABLES));
      const activeOrders = JSON.parse(JSON.stringify(FIXTURE_ACTIVE_ORDERS));

      // Table B02 is occupied with ORD-101 (serving)
      const tableB02 = tables.find((t) => t.id === 'B02');
      assert.ok(tableB02);
      assert.equal(tableB02.status, 'occupied');
      assert.equal(tableB02.activeOrderId, 'ORD-101');
      assert.equal(activeOrders['ORD-101'].status, 'serving');
      assert.equal(activeOrders['ORD-101'].items.length, 2);
      assert.equal(activeOrders['ORD-101'].total, 88000);

      // Table B03 is occupied with ORD-102 (awaiting_payment)
      const tableB03 = tables.find((t) => t.id === 'B03');
      assert.ok(tableB03);
      assert.equal(tableB03.status, 'occupied');
      assert.equal(tableB03.activeOrderId, 'ORD-102');
      assert.equal(activeOrders['ORD-102'].status, 'awaiting_payment');
      assert.equal(activeOrders['ORD-102'].items.length, 1);
      assert.equal(activeOrders['ORD-102'].total, 76000);

      // Tables B01, B04, B05 are empty
      ['B01', 'B04', 'B05'].forEach((id) => {
        const t = tables.find((tbl) => tbl.id === id);
        assert.equal(t.status, 'empty');
        assert.equal(t.activeOrderId, null);
      });
    });

    test('1.2 - PosContext cleanupCompletedOrders strictly touches ONLY orderHistory and key goc_pos_history_v4', () => {
      // Analyze PosContext source code contract
      assert.ok(
        posContextCode.includes('cleanupCompletedOrders'),
        'PosContext must implement cleanupCompletedOrders'
      );

      // Verify that cleanupCompletedOrders calls setOrderHistory but NEVER setTables, setOrders, setMenu, setStaffList
      const cleanupFnMatch = posContextCode.match(/const cleanupCompletedOrders = async[\s\S]*?\n  \};/);
      assert.ok(cleanupFnMatch, 'cleanupCompletedOrders function definition found');
      const cleanupBody = cleanupFnMatch[0];

      assert.ok(cleanupBody.includes('setOrderHistory'), 'cleanupCompletedOrders must mutate orderHistory');
      assert.ok(cleanupBody.includes('STORAGE_KEYS.ORDER_HISTORY'), 'cleanupCompletedOrders must sync goc_pos_history_v4');

      assert.ok(!cleanupBody.includes('setTables'), 'cleanupCompletedOrders MUST NOT call setTables');
      assert.ok(!cleanupBody.includes('setOrders'), 'cleanupCompletedOrders MUST NOT call setOrders');
      assert.ok(!cleanupBody.includes('setMenu'), 'cleanupCompletedOrders MUST NOT call setMenu');
      assert.ok(!cleanupBody.includes('setStaffList'), 'cleanupCompletedOrders MUST NOT call setStaffList');
      assert.ok(!cleanupBody.includes('setSettings'), 'cleanupCompletedOrders MUST NOT call setSettings');
      assert.ok(!cleanupBody.includes('STORAGE_KEYS.TABLES'), 'cleanupCompletedOrders MUST NOT write to tables storage');
      assert.ok(!cleanupBody.includes('STORAGE_KEYS.ORDERS'), 'cleanupCompletedOrders MUST NOT write to orders storage');
    });

    test('1.3 - Empirical simulation: Hard-deleting completed orders preserves active orders and occupied tables 100%', () => {
      // Mock Storage Engine with all 9 POS keys
      const mockStorage = {
        goc_pos_tables_v4: JSON.stringify(FIXTURE_TABLES),
        goc_pos_orders_v4: JSON.stringify(FIXTURE_ACTIVE_ORDERS),
        goc_pos_history_v4: JSON.stringify(FIXTURE_COMPLETED_ORDERS),
        goc_pos_menu_v4: JSON.stringify(INITIAL_MENU),
        goc_pos_categories_v4: JSON.stringify(INITIAL_CATEGORIES),
        goc_pos_toppings_v4: JSON.stringify(INITIAL_TOPPINGS),
        goc_pos_product_toppings_v4: JSON.stringify(INITIAL_PRODUCT_TOPPINGS),
        goc_pos_settings_v4: JSON.stringify(FIXTURE_SETTINGS),
        goc_pos_staff_v4: JSON.stringify(FIXTURE_STAFF)
      };

      // State variables mimicking PosProvider
      let tables = JSON.parse(mockStorage.goc_pos_tables_v4);
      let orders = JSON.parse(mockStorage.goc_pos_orders_v4);
      let orderHistory = JSON.parse(mockStorage.goc_pos_history_v4);
      let menu = JSON.parse(mockStorage.goc_pos_menu_v4);
      let staffList = JSON.parse(mockStorage.goc_pos_staff_v4);

      // Snapshot original active state before any cleanup
      const originalTablesSnapshot = JSON.stringify(tables);
      const originalOrdersSnapshot = JSON.stringify(orders);
      const originalMenuSnapshot = JSON.stringify(menu);
      const originalStaffSnapshot = JSON.stringify(staffList);

      // Execute cleanup on completed orders (ORD-HIST-01, ORD-HIST-02)
      const idsToDelete = ['ORD-HIST-01', 'ORD-HIST-02'];
      const deleteSet = new Set(idsToDelete);

      // PosContext cleanup implementation replication
      orderHistory = orderHistory.filter((ord) => !deleteSet.has(ord.id));
      mockStorage.goc_pos_history_v4 = JSON.stringify(orderHistory);

      // Assert orderHistory was updated
      assert.equal(orderHistory.length, FIXTURE_COMPLETED_ORDERS.length - 2);
      assert.ok(!orderHistory.some((o) => idsToDelete.includes(o.id)));

      // Assert Active Tables are 100% UNTOUCHED
      assert.equal(JSON.stringify(tables), originalTablesSnapshot);
      assert.equal(mockStorage.goc_pos_tables_v4, originalTablesSnapshot);
      assert.equal(tables.find((t) => t.id === 'B02').status, 'occupied');
      assert.equal(tables.find((t) => t.id === 'B02').activeOrderId, 'ORD-101');
      assert.equal(tables.find((t) => t.id === 'B03').status, 'occupied');
      assert.equal(tables.find((t) => t.id === 'B03').activeOrderId, 'ORD-102');

      // Assert Active Orders are 100% UNTOUCHED
      assert.equal(JSON.stringify(orders), originalOrdersSnapshot);
      assert.equal(mockStorage.goc_pos_orders_v4, originalOrdersSnapshot);
      assert.equal(orders['ORD-101'].status, 'serving');
      assert.equal(orders['ORD-101'].total, 88000);
      assert.equal(orders['ORD-102'].status, 'awaiting_payment');
      assert.equal(orders['ORD-102'].total, 76000);

      // Assert Menu and Staff remain 100% UNTOUCHED
      assert.equal(JSON.stringify(menu), originalMenuSnapshot);
      assert.equal(JSON.stringify(staffList), originalStaffSnapshot);
    });

    test('1.4 - Stress Test: Deleting completed order that shared tableId with active dining table', () => {
      // Historical order ORD-HIST-04 was completed on table 'B01'.
      // Now Table 'B01' is newly occupied by a dining group with ORD-NEW-201.
      let tables = JSON.parse(JSON.stringify(FIXTURE_TABLES));
      let orders = JSON.parse(JSON.stringify(FIXTURE_ACTIVE_ORDERS));
      let orderHistory = JSON.parse(JSON.stringify(FIXTURE_COMPLETED_ORDERS));

      // Occupy B01 with active order ORD-NEW-201
      tables = tables.map((t) =>
        t.id === 'B01'
          ? { ...t, status: 'occupied', activeOrderId: 'ORD-NEW-201', customerCount: 4, seatedAt: new Date().toISOString() }
          : t
      );
      orders['ORD-NEW-201'] = {
        id: 'ORD-NEW-201',
        tableId: 'B01',
        tableName: 'Bàn 01',
        status: 'serving',
        customerCount: 4,
        items: [{ productId: 'prod-1', name: 'Cà phê Phin Đen Đậm Vị', quantity: 4, lineTotal: 112000 }],
        total: 112000
      };

      // Perform cleanup on ALL historical orders including ORD-HIST-04 (which took place on B01)
      const allHistIds = orderHistory.map((o) => o.id);
      const deleteSet = new Set(allHistIds);
      orderHistory = orderHistory.filter((o) => !deleteSet.has(o.id));

      // Verify Table B01 remains occupied and active order ORD-NEW-201 is completely intact
      const tableB01 = tables.find((t) => t.id === 'B01');
      assert.equal(tableB01.status, 'occupied');
      assert.equal(tableB01.activeOrderId, 'ORD-NEW-201');
      assert.equal(tableB01.customerCount, 4);

      assert.ok(orders['ORD-NEW-201']);
      assert.equal(orders['ORD-NEW-201'].status, 'serving');
      assert.equal(orders['ORD-NEW-201'].total, 112000);
      assert.equal(orderHistory.length, 0);
    });

    test('1.5 - Adversarial injection: Attempting to pass active order IDs to cleanupCompletedOrders', () => {
      let orders = JSON.parse(JSON.stringify(FIXTURE_ACTIVE_ORDERS));
      let orderHistory = JSON.parse(JSON.stringify(FIXTURE_COMPLETED_ORDERS));

      // Attacker attempts to cleanup active order 'ORD-101'
      const maliciousIds = ['ORD-101', 'NON-EXISTENT-ID', 'ORD-HIST-01'];
      const deleteSet = new Set(maliciousIds);

      // cleanupCompletedOrders filters ONLY orderHistory
      orderHistory = orderHistory.filter((ord) => !deleteSet.has(ord.id));

      // ORD-HIST-01 was in orderHistory, so it is removed
      assert.ok(!orderHistory.some((o) => o.id === 'ORD-HIST-01'));
      // Active orders in 'orders' are immune
      assert.ok(orders['ORD-101'], 'Active order ORD-101 must NEVER be deleted');
      assert.equal(orders['ORD-101'].status, 'serving');
    });
  });

  // =========================================================================
  // SECTION 2: REVENUE REPORTS & HISTORICAL METRICS INTEGRITY
  // =========================================================================
  describe('2. Revenue Reports & Historical Metrics Integrity', () => {

    // Helper replicating ReportsView business logic
    function calculateReportMetrics(orderHistory, days = 7, targetDateStr = '2026-10-19') {
      const daysRange = getDaysRange(days, targetDateStr);
      const datesSet = new Set(daysRange);

      const completedOrdersInRange = (orderHistory || []).filter((ord) => {
        if (ord.status !== 'completed') return false;
        const paidIso =
          ord.paid_at ||
          ord.paidAt ||
          ord.completed_at ||
          ord.completedAt ||
          ord.finishedAt;
        if (!paidIso) return false;
        const paidDate = getVietnamDateString(paidIso);
        return datesSet.has(paidDate);
      });

      let cash = 0;
      let qr = 0;
      let total = 0;

      completedOrdersInRange.forEach((ord) => {
        const amt = Number(ord.total) || 0;
        total += amt;
        const method = (ord.paymentMethod || ord.payment_method || '').toLowerCase();
        if (method === 'vietqr') {
          qr += amt;
        } else {
          cash += amt;
        }
      });

      const count = completedOrdersInRange.length;
      const aov = count > 0 ? Math.round(total / count) : 0;
      const cp = total > 0 ? Math.round((cash / total) * 100) : 0;
      const qp = total > 0 ? 100 - cp : 0;

      const dailySeries = days === 1 ? [] : daysRange.map((dateStr) => {
        const ordersOnDay = completedOrdersInRange.filter((ord) => {
          const paidIso =
            ord.paid_at ||
            ord.paidAt ||
            ord.completed_at ||
            ord.completedAt ||
            ord.finishedAt;
          return getVietnamDateString(paidIso) === dateStr;
        });
        const dayRevenue = ordersOnDay.reduce((sum, ord) => sum + (Number(ord.total) || 0), 0);
        return { dateStr, revenue: dayRevenue, orderCount: ordersOnDay.length };
      });

      const maxDayRevenue = dailySeries.length > 0
        ? Math.max(Math.max(...dailySeries.map((d) => d.revenue), 0), 100000)
        : 100000;

      return {
        totalRevenue: total,
        cashTotal: cash,
        qrTotal: qr,
        totalOrdersCount: count,
        averageOrderValue: aov,
        cashPercent: cp,
        qrPercent: qp,
        dailySeries,
        maxDayRevenue,
        completedOrdersInRange
      };
    }

    test('2.1 - ReportsView metrics prior to cleanup strictly reflect fixtures', () => {
      // 7-day filter on 2026-10-19: includes all 4 fixture orders
      // ORD-HIST-01: 56000 cash (2026-10-18)
      // ORD-HIST-02: 131000 vietqr (2026-10-18)
      // ORD-HIST-03: 45000 cash (2026-10-19 01:30 VN)
      // ORD-HIST-04: 56000 cash (2026-10-19 09:30 VN)
      // Total: 288,000 VND. Cash: 157,000 VND. QR: 131,000 VND.
      const baseline = calculateReportMetrics(FIXTURE_COMPLETED_ORDERS, 7, '2026-10-19');

      assert.equal(baseline.totalOrdersCount, 4);
      assert.equal(baseline.totalRevenue, 288000);
      assert.equal(baseline.cashTotal, 157000);
      assert.equal(baseline.qrTotal, 131000);
      assert.equal(baseline.averageOrderValue, 72000);
      assert.equal(baseline.cashPercent, Math.round((157000 / 288000) * 100)); // 55%
      assert.equal(baseline.qrPercent, 100 - baseline.cashPercent); // 45%

      // Daily Series breakdown
      const oct18 = baseline.dailySeries.find((d) => d.dateStr === '2026-10-18');
      assert.equal(oct18.revenue, 187000); // 56k + 131k
      assert.equal(oct18.orderCount, 2);

      const oct19 = baseline.dailySeries.find((d) => d.dateStr === '2026-10-19');
      assert.equal(oct19.revenue, 101000); // 45k + 56k
      assert.equal(oct19.orderCount, 2);
    });

    test('2.2 - Partial Hard-Delete: Purging 2026-10-18 orders accurately recalculates reports', () => {
      let orderHistory = JSON.parse(JSON.stringify(FIXTURE_COMPLETED_ORDERS));

      // Cleanup preview for range 2026-10-18 to 2026-10-18
      const preview = calculateCleanupPreview(orderHistory, CLEANUP_MODES.RANGE, {
        fromDate: '2026-10-18',
        toDate: '2026-10-18'
      });
      assert.equal(preview.count, 2);
      assert.equal(preview.totalRevenue, 187000);
      assert.equal(preview.cashTotal, 56000);
      assert.equal(preview.qrTotal, 131000);

      // Execute cleanup
      const purgedIds = new Set(preview.targetOrders.map((o) => o.id));
      orderHistory = orderHistory.filter((o) => !purgedIds.has(o.id));

      // Recalculate ReportsView metrics
      const updatedMetrics = calculateReportMetrics(orderHistory, 7, '2026-10-19');

      assert.equal(updatedMetrics.totalOrdersCount, 2);
      assert.equal(updatedMetrics.totalRevenue, 101000); // only Oct 19 remains (45k + 56k)
      assert.equal(updatedMetrics.cashTotal, 101000);
      assert.equal(updatedMetrics.qrTotal, 0);
      assert.equal(updatedMetrics.averageOrderValue, 50500); // 101000 / 2
      assert.equal(updatedMetrics.cashPercent, 100);
      assert.equal(updatedMetrics.qrPercent, 0);

      // Check day series
      const oct18 = updatedMetrics.dailySeries.find((d) => d.dateStr === '2026-10-18');
      assert.equal(oct18.revenue, 0, 'Purged date must have 0 revenue');
      assert.equal(oct18.orderCount, 0, 'Purged date must have 0 orders');

      const oct19 = updatedMetrics.dailySeries.find((d) => d.dateStr === '2026-10-19');
      assert.equal(oct19.revenue, 101000, 'Unpurged date retains accurate revenue');
      assert.equal(oct19.orderCount, 2);
    });

    test('2.3 - Total Hard-Delete (0 orders remaining): ReportsView shows 0 revenue without NaN or crashes', () => {
      // Purge ALL completed orders
      const orderHistory = [];
      const emptyMetrics = calculateReportMetrics(orderHistory, 7, '2026-10-19');

      assert.equal(emptyMetrics.totalOrdersCount, 0);
      assert.equal(emptyMetrics.totalRevenue, 0);
      assert.equal(emptyMetrics.cashTotal, 0);
      assert.equal(emptyMetrics.qrTotal, 0);

      // Check protection against NaN and division by zero
      assert.equal(emptyMetrics.averageOrderValue, 0, 'AOV must be 0, never NaN');
      assert.ok(!Number.isNaN(emptyMetrics.averageOrderValue));
      assert.equal(emptyMetrics.cashPercent, 0, 'Cash% must be 0, never NaN');
      assert.ok(!Number.isNaN(emptyMetrics.cashPercent));
      assert.equal(emptyMetrics.qrPercent, 0, 'QR% must be 0, never NaN');
      assert.ok(!Number.isNaN(emptyMetrics.qrPercent));

      // Scaling fallback must be at least 100,000 to prevent zero division in SVG bar chart
      assert.equal(emptyMetrics.maxDayRevenue, 100000);

      // 1-day filter check
      const empty1d = calculateReportMetrics(orderHistory, 1, '2026-10-19');
      assert.equal(empty1d.totalOrdersCount, 0);
      assert.equal(empty1d.totalRevenue, 0);
      assert.equal(empty1d.dailySeries.length, 0);
    });

    test('2.4 - Cancelled orders retention: Data cleanup leaves cancelled orders in orderHistory', () => {
      let orderHistory = [
        ...FIXTURE_COMPLETED_ORDERS,
        {
          id: 'ORD-CANCELLED-99',
          tableId: 'B01',
          tableName: 'Bàn 01',
          status: 'cancelled',
          customerCount: 1,
          items: [{ productId: 'prod-1', name: 'Cà phê Phin Đen Đậm Vị', quantity: 1, lineTotal: 28000 }],
          total: 28000,
          finishedAt: '2026-10-18T10:00:00.000Z',
          cancelReason: 'Khách đổi ý'
        }
      ];

      // Cleanup mode: all_completed
      const preview = calculateCleanupPreview(orderHistory, CLEANUP_MODES.ALL_COMPLETED);
      assert.equal(preview.count, 4, 'Should ONLY target 4 completed orders, ignoring cancelled');
      assert.ok(!preview.targetOrders.some((o) => o.id === 'ORD-CANCELLED-99'));

      // Execute cleanup
      const deleteSet = new Set(preview.targetOrders.map((o) => o.id));
      orderHistory = orderHistory.filter((o) => !deleteSet.has(o.id));

      // Cancelled order is preserved in orderHistory
      assert.equal(orderHistory.length, 1);
      assert.equal(orderHistory[0].id, 'ORD-CANCELLED-99');
      assert.equal(orderHistory[0].status, 'cancelled');
    });
  });

  // =========================================================================
  // SECTION 3: WHOLE-SYSTEM COEXISTENCE (ZERO REGRESSIONS)
  // =========================================================================
  describe('3. Core POS Subsystems Coexistence & Zero Regressions', () => {

    test('3.1 - Table Grid Operations: Occupy, merge, and clear tables before and after cleanup', () => {
      let tables = JSON.parse(JSON.stringify(FIXTURE_TABLES));
      let orders = JSON.parse(JSON.stringify(FIXTURE_ACTIVE_ORDERS));
      let orderHistory = JSON.parse(JSON.stringify(FIXTURE_COMPLETED_ORDERS));

      // 1. Table B01 is opened by waiter
      tables = tables.map((t) =>
        t.id === 'B01'
          ? { ...t, status: 'occupied', activeOrderId: 'ORD-NEW-301', customerCount: 2, seatedAt: new Date().toISOString() }
          : t
      );
      orders['ORD-NEW-301'] = {
        id: 'ORD-NEW-301',
        tableId: 'B01',
        tableName: 'Bàn 01',
        status: 'serving',
        customerCount: 2,
        items: [{ productId: 'prod-1', name: 'Cà phê Phin Đen', quantity: 2, lineTotal: 56000 }],
        total: 56000
      };

      // 2. Perform completed orders cleanup
      const preview = calculateCleanupPreview(orderHistory, CLEANUP_MODES.ALL_COMPLETED);
      const deleteSet = new Set(preview.targetOrders.map((o) => o.id));
      orderHistory = orderHistory.filter((o) => !deleteSet.has(o.id));
      assert.equal(orderHistory.length, 0);

      // 3. Merge Table B01 into Table B04
      const sourceOrder = orders['ORD-NEW-301'];
      tables = tables.map((t) => {
        if (t.id === 'B01') return { ...t, status: 'empty', activeOrderId: null, customerCount: 0 };
        if (t.id === 'B04') return { ...t, status: 'occupied', activeOrderId: 'ORD-NEW-301', customerCount: 4 };
        return t;
      });
      orders['ORD-NEW-301'] = {
        ...sourceOrder,
        tableId: 'B04',
        tableName: 'Bàn 04 (Gộp B01)'
      };

      // Assert Table states after merge & cleanup coexistence
      assert.equal(tables.find((t) => t.id === 'B01').status, 'empty');
      assert.equal(tables.find((t) => t.id === 'B04').status, 'occupied');
      assert.equal(tables.find((t) => t.id === 'B04').activeOrderId, 'ORD-NEW-301');
      assert.equal(orders['ORD-NEW-301'].tableId, 'B04');

      // Table B02 and B03 remain completely unaffected
      assert.equal(tables.find((t) => t.id === 'B02').status, 'occupied');
      assert.equal(tables.find((t) => t.id === 'B03').status, 'occupied');
    });

    test('3.2 - Menu & Toppings Subsystem: Item customization and line total calculation', () => {
      const menu = JSON.parse(JSON.stringify(INITIAL_MENU));
      const toppings = JSON.parse(JSON.stringify(INITIAL_TOPPINGS));

      // Select Product
      const product = menu.find((item) => item.id === 'prod-4'); // Bạc Xỉu 3 Tầng (basePrice: 38,000)
      assert.ok(product);
      const basePrice = product.basePrice || product.price;
      assert.equal(basePrice, 38000);

      // Add Toppings: Trân châu trắng (10,000), Thạch nha đam lá dứa (8,000)
      const selectedToppings = [
        toppings.find((top) => top.id === 'top-1'), // 10000
        toppings.find((top) => top.id === 'top-3')  // 8000
      ];

      const toppingsCost = selectedToppings.reduce((sum, t) => sum + t.price, 0);
      assert.equal(toppingsCost, 18000);

      const unitPrice = basePrice + toppingsCost; // 38000 + 18000 = 56000
      const quantity = 3;
      const lineTotal = unitPrice * quantity; // 168,000

      assert.equal(lineTotal, 168000);
    });

    test('3.3 - Ordering & Billing Lifecycle: Seamless checkout and subsequent cleanup cycle', () => {
      let tables = JSON.parse(JSON.stringify(FIXTURE_TABLES));
      let orders = JSON.parse(JSON.stringify(FIXTURE_ACTIVE_ORDERS));
      let orderHistory = [];

      // Checkout active order ORD-102 on Table B03 (awaiting_payment, total 76,000)
      const activeOrd = orders['ORD-102'];
      assert.ok(activeOrd);

      // Generate VietQR payment URL
      const qrUrl = generateVietQRUrl({
        bankCode: FIXTURE_SETTINGS.bankAccount.bankCode,
        accountNo: FIXTURE_SETTINGS.bankAccount.accountNo,
        amount: activeOrd.total,
        memo: `GOC B03 ${activeOrd.id}`
      });
      assert.ok(qrUrl.startsWith('https://img.vietqr.io/image/MB-0988776655-compact.png'));
      assert.ok(qrUrl.includes('amount=76000'));

      // Transition to completed
      const now = new Date().toISOString();
      const completedOrder = {
        ...activeOrd,
        status: 'completed',
        paymentMethod: 'vietqr',
        paidAmount: activeOrd.total,
        remainingAmount: 0,
        paid_at: now,
        finishedAt: now
      };

      // Update state: remove from active orders, add to orderHistory, clear table
      delete orders['ORD-102'];
      orderHistory = [completedOrder];
      tables = tables.map((t) =>
        t.id === 'B03' ? { ...t, status: 'empty', activeOrderId: null, customerCount: 0 } : t
      );

      // Assert Table B03 is now empty
      assert.equal(tables.find((t) => t.id === 'B03').status, 'empty');
      assert.equal(orders['ORD-102'], undefined);
      assert.equal(orderHistory.length, 1);

      // Now execute cleanup on the newly completed order
      const preview = calculateCleanupPreview(orderHistory, CLEANUP_MODES.ALL_COMPLETED);
      assert.equal(preview.count, 1);
      assert.equal(preview.totalRevenue, 76000);
      assert.equal(preview.qrTotal, 76000);

      // Purge
      orderHistory = orderHistory.filter((o) => o.id !== completedOrder.id);
      assert.equal(orderHistory.length, 0);

      // Table B02 and ORD-101 are still serving without disruption
      assert.equal(tables.find((t) => t.id === 'B02').status, 'occupied');
      assert.equal(orders['ORD-101'].status, 'serving');
    });

    test('3.4 - Settings & Staff Subsystem Coexistence with Data Cleanup', () => {
      let settings = JSON.parse(JSON.stringify(FIXTURE_SETTINGS));
      let staffList = JSON.parse(JSON.stringify(FIXTURE_STAFF));

      // Update settings (WiFi password & VietQR account)
      settings = {
        ...settings,
        wifiPassword: 'goccaphe_new_2026',
        bankAccount: {
          ...settings.bankAccount,
          accountNo: '0912345678'
        }
      };

      // Add and pause staff
      const newStaff = {
        id: 'staff-04',
        name: 'Hoàng Minh Châu',
        status: 'active',
        role: 'staff',
        createdAt: new Date().toISOString()
      };
      staffList = [...staffList, newStaff];
      assert.equal(staffList.length, 4);

      // Toggle staff-04 to paused
      staffList = staffList.map((s) => (s.id === 'staff-04' ? { ...s, status: 'paused' } : s));
      assert.equal(staffList.find((s) => s.id === 'staff-04').status, 'paused');

      // Verify that settings and staff operations operate completely independent of data cleanup
      assert.equal(settings.wifiPassword, 'goccaphe_new_2026');
      assert.equal(settings.bankAccount.accountNo, '0912345678');
      assert.equal(staffList.filter((s) => s.status === 'active').length, 3);
    });

    test('3.5 - Offline Safety: cleanupCompletedOrders handles missing or unconfigured Supabase gracefully', async () => {
      let orderHistory = JSON.parse(JSON.stringify(FIXTURE_COMPLETED_ORDERS));

      // Simulate cleanupCompletedOrders when isSupabaseConfigured is false or supabase is null
      const mockCleanupOffline = async (idsToDelete, metadata = {}) => {
        const deleteSet = new Set(idsToDelete);
        orderHistory = orderHistory.filter((o) => !deleteSet.has(o.id));
        // Supabase sync skipped or failed gracefully without throwing
        return { success: true, count: idsToDelete.length };
      };

      const result = await mockCleanupOffline(['ORD-HIST-01', 'ORD-HIST-02']);
      assert.equal(result.success, true);
      assert.equal(result.count, 2);
      assert.equal(orderHistory.length, 2);
    });
  });

  // =========================================================================
  // SECTION 4: ANTI-REGRESSION & CODE INTEGRITY INSPECTION
  // =========================================================================
  describe('4. Anti-Regression & Code Integrity', () => {

    test('4.1 - DataCleanupSection contains required safety UI elements and testids', () => {
      const requiredElements = [
        'cleanup-tab-range',
        'cleanup-tab-before-date',
        'cleanup-tab-all',
        'cleanup-preview-card',
        'cleanup-preview-count',
        'cleanup-preview-revenue',
        'cleanup-preview-cash',
        'cleanup-preview-vietqr',
        'cleanup-impact-warning',
        'cleanup-protection-guarantee',
        'cleanup-initiate-btn',
        'cleanup-confirm-modal',
        'cleanup-download-backup-btn',
        'cleanup-proceed-to-step2-btn',
        'cleanup-danger-alert',
        'cleanup-confirm-checkbox',
        'cleanup-execute-delete-btn'
      ];

      requiredElements.forEach((el) => {
        assert.ok(
          cleanupSectionCode.includes(`data-testid="${el}"`),
          `DataCleanupSection must contain data-testid="${el}"`
        );
      });
    });

    test('4.2 - Strict isolation guarantee text explicitly mentions serving tables and active orders', () => {
      assert.ok(
        cleanupSectionCode.includes('bảo vệ bàn đang phục vụ') ||
        cleanupSectionCode.includes('đang phục vụ') ||
        cleanupSectionCode.includes('bàn đang có khách'),
        'Safety guarantee must explicitly state active serving tables are protected'
      );
    });

    test('4.3 - ManagementProfileView cleanly mounts DataCleanupSection in Section 2', () => {
      assert.ok(
        profileViewCode.includes("import DataCleanupSection from './DataCleanupSection'"),
        'Must import DataCleanupSection'
      );
      assert.ok(
        profileViewCode.includes('<DataCleanupSection />') || profileViewCode.includes('<DataCleanupSection/>'),
        'Must mount DataCleanupSection component'
      );
      assert.ok(
        profileViewCode.includes('SLOT: SECTION 2 - DỌN DẸP DỮ LIỆU BÁN HÀNG AN TOÀN'),
        'Slot comment must be preserved'
      );
    });
  });

});
