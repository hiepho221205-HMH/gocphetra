import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileTablesAndOrders, rolloverPastUnpaidOrders } from '../src/utils/reconciler.js';
import { INITIAL_TABLES, INITIAL_MENU } from '../src/data/initialData.js';
import { getVietnamDateString, getVietnamTodayString, formatShortDate } from '../src/utils/dateTime.js';

/**
 * High-Fidelity POS Simulation Harness for Daily Rollover & Historical Payments
 * Strictly enforces Table Isolation, Idempotency, and Cash-Basis Revenue Attribution.
 */
class HistoricalPosSimulator {
  constructor() {
    this.tables = Array.from({ length: 20 }, (_, i) => {
      const num = i + 1;
      return {
        id: `t${num}`,
        name: `Bàn ${num < 10 ? '0' + num : num}`,
        capacity: 4,
        status: 'empty',
        activeOrderId: null,
        customerCount: 0,
        seatedAt: null
      };
    });
    this.menu = JSON.parse(JSON.stringify(INITIAL_MENU));
    this.orders = {}; // Active orders (serving)
    this.orderHistory = []; // Historical orders (completed or unpaid_carried_over)
    this.payments = []; // Immutable payment ledger
    this.currentBusinessDate = '2026-10-14';
  }

  setDate(dateStr) {
    this.currentBusinessDate = dateStr;
  }

  // Create or save order for a table on the current business date
  saveOrderForTable(tableId, cartItems, customDate = null) {
    const table = this.tables.find((t) => t.id === tableId);
    if (!table) return { success: false, message: 'Bàn không tồn tại' };

    const bDate = customDate || this.currentBusinessDate;
    let orderId = table.activeOrderId;
    let existingOrder = orderId ? this.orders[orderId] : null;

    if (!existingOrder) {
      orderId = 'ORD-' + bDate.replace(/-/g, '') + '-' + tableId;
      existingOrder = {
        id: orderId,
        tableId: table.id,
        tableName: table.name,
        status: 'serving',
        businessDate: bDate,
        paymentStatus: 'unpaid',
        createdAt: `${bDate}T09:00:00.000Z`,
        cashier: 'Thu ngân',
        customerCount: 2,
        items: [],
        subtotal: 0,
        total: 0,
        paidAmount: 0,
        remainingAmount: 0,
        splitPayments: []
      };
    }

    const subtotal = cartItems.reduce((sum, it) => sum + (it.lineTotal || (it.unitPrice * it.quantity)), 0);
    const total = subtotal;

    const updatedOrder = {
      ...existingOrder,
      items: JSON.parse(JSON.stringify(cartItems)),
      subtotal,
      total,
      remainingAmount: total
    };

    const updatedTable = {
      ...table,
      status: 'occupied',
      activeOrderId: orderId,
      customerCount: 2,
      seatedAt: existingOrder.createdAt
    };

    this.orders[orderId] = updatedOrder;
    this.tables = this.tables.map((t) => (t.id === tableId ? updatedTable : t));

    return { success: true, order: updatedOrder, table: updatedTable };
  }

  // Same-day immediate checkout
  checkoutTable(tableId, paymentMethod = 'cash', customDate = null) {
    const table = this.tables.find((t) => t.id === tableId);
    if (!table || !table.activeOrderId) return false;
    const order = this.orders[table.activeOrderId];
    if (!order) return false;

    const bDate = customDate || this.currentBusinessDate;
    const paidAt = `${bDate}T10:30:00.000Z`;
    const paymentId = 'PAY-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const paymentRecord = {
      id: paymentId,
      orderId: order.id,
      amount: order.total,
      paymentMethod,
      paymentStatus: 'completed',
      paidAt,
      businessDate: bDate,
      cashierId: order.cashier,
      idempotencyKey: `CHECKOUT_${order.id}`,
      notes: `Thanh toán tại bàn ${order.tableName}`,
      createdAt: paidAt
    };
    this.payments.push(paymentRecord);

    const completedOrder = {
      ...order,
      status: 'completed',
      paymentStatus: 'paid',
      paidAmount: order.total,
      remainingAmount: 0,
      paymentMethod,
      paidAt,
      paymentBusinessDate: bDate,
      finishedAt: paidAt
    };

    this.orderHistory.unshift(completedOrder);
    delete this.orders[order.id];

    this.tables = this.tables.map((t) =>
      t.id === tableId
        ? { ...t, status: 'empty', activeOrderId: null, customerCount: 0, seatedAt: null }
        : t
    );

    return { success: true, order: completedOrder };
  }

  // Daily Rollover execution
  rolloverToNewDay(nextBusinessDate) {
    this.setDate(nextBusinessDate);
    const result = rolloverPastUnpaidOrders(
      this.tables,
      this.orders,
      this.orderHistory,
      nextBusinessDate
    );
    this.tables = result.tables;
    this.orders = result.orders;
    this.orderHistory = result.orderHistory;
    return result;
  }

  // Historical Payment collection for past carried-over orders
  processHistoricalPayment({ orderId, paymentMethod = 'cash', amount = null, cashier = 'Thu ngân', idempotencyKey = null }) {
    // 1. Idempotency Check
    if (idempotencyKey) {
      const existingPay = this.payments.find((p) => p.idempotencyKey === idempotencyKey);
      if (existingPay) {
        return { success: true, alreadyProcessed: true, payment: existingPay };
      }
    }

    // 2. Find order in history
    const orderIndex = this.orderHistory.findIndex((o) => o.id === orderId);
    if (orderIndex < 0) {
      return { success: false, error: 'Order not found' };
    }

    const order = this.orderHistory[orderIndex];
    if (order.status === 'completed') {
      return { success: true, alreadyCompleted: true, order };
    }

    const payAmount = amount !== null ? Number(amount) : Number(order.total);
    const paidAt = `${this.currentBusinessDate}T14:00:00.000Z`;
    const paymentId = 'HIST-PAY-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const paymentRecord = {
      id: paymentId,
      orderId,
      amount: payAmount,
      paymentMethod,
      paymentStatus: 'completed',
      paidAt,
      businessDate: this.currentBusinessDate,
      cashierId: cashier,
      idempotencyKey,
      notes: `Thu tiền đơn cũ ngày ${order.businessDate}`,
      createdAt: paidAt
    };
    this.payments.push(paymentRecord);

    const updatedOrder = {
      ...order,
      status: 'completed',
      paymentStatus: 'paid',
      paidAmount: payAmount,
      remainingAmount: 0,
      paymentMethod,
      paidAt,
      paymentBusinessDate: this.currentBusinessDate,
      finishedAt: paidAt
    };

    this.orderHistory[orderIndex] = updatedOrder;

    // CRITICAL: Tables array is untouched!
    return { success: true, payment: paymentRecord, order: updatedOrder };
  }

  // Cash-basis revenue attribution query
  getCashBasisRevenue(businessDate) {
    return this.payments
      .filter((p) => p.businessDate === businessDate && p.paymentStatus === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
  }

  // Get orders by creation/business date
  getOrdersForDate(businessDate) {
    const unpaid = this.orderHistory.filter((o) => o.status === 'unpaid_carried_over' && o.businessDate === businessDate);
    const completed = this.orderHistory.filter((o) => o.status === 'completed' && o.businessDate === businessDate);
    const serving = Object.values(this.orders).filter((o) => o.businessDate === businessDate);
    return { unpaid, completed, serving };
  }
}

describe('Super Task: 7-Day Simulation Suite (35 Real-World Orders) — Daily Rollover & Historical Payments', () => {
  const sim = new HistoricalPosSimulator();

  const itemCf = (name, unitPrice, qty = 1) => ({
    name,
    unitPrice,
    quantity: qty,
    lineTotal: unitPrice * qty
  });

  // ==========================================================================
  // DAY 1 (2026-10-14): 5 Orders (2 paid same-day, 3 unpaid left overnight)
  // ==========================================================================
  it('Day 1 (2026-10-14): 5 Orders Created — 2 completed, 3 left unpaid overnight', () => {
    sim.setDate('2026-10-14');

    // Order 1: Table 1 -> Cà phê sữa (28k), completed with Cash
    sim.saveOrderForTable('t1', [itemCf('Cà phê sữa', 28000, 1)]);
    sim.checkoutTable('t1', 'cash');

    // Order 2: Table 2 -> Bạc xỉu (32k), completed with VietQR
    sim.saveOrderForTable('t2', [itemCf('Bạc xỉu', 32000, 1)]);
    sim.checkoutTable('t2', 'vietqr');

    // Order 3: Table 3 -> Cà phê muối (35k), left unpaid
    sim.saveOrderForTable('t3', [itemCf('Cà phê muối', 35000, 1)]);

    // Order 4: Table 4 -> Trà đào cam sả (38k), left unpaid
    sim.saveOrderForTable('t4', [itemCf('Trà đào cam sả', 38000, 1)]);

    // Order 5: Table 5 -> Trà vải nhiệt đới (39k), left unpaid
    sim.saveOrderForTable('t5', [itemCf('Trà vải nhiệt đới', 39000, 1)]);

    // Pre-rollover assertions
    assert.equal(Object.keys(sim.orders).length, 3, '3 active serving orders left');
    assert.equal(sim.orderHistory.length, 2, '2 completed orders in history');
    assert.equal(sim.getCashBasisRevenue('2026-10-14'), 60000, 'Day 1 cash-basis revenue = 28k + 32k = 60k');
  });

  // ==========================================================================
  // DAY 2 (2026-10-15): Rollover Day 1 -> Overnight Release & Table Isolation
  // ==========================================================================
  it('Day 2 (2026-10-15): Overnight Rollover frees tables & preserves orders without auto-cancellation', () => {
    // Midnight rollover executes
    const rollResult = sim.rolloverToNewDay('2026-10-15');

    assert.equal(rollResult.rolledOrdersCount, 3, '3 unpaid orders rolled over');
    assert.equal(rollResult.releasedTablesCount, 3, '3 tables freed');

    // Verify tables 3, 4, 5 are completely empty
    ['t3', 't4', 't5'].forEach((tId) => {
      const tbl = sim.tables.find((t) => t.id === tId);
      assert.equal(tbl.status, 'empty', `Table ${tId} must be empty`);
      assert.equal(tbl.activeOrderId, null, `Table ${tId} activeOrderId must be null`);
    });

    // Verify orders are NOT deleted or cancelled
    const d1Orders = sim.getOrdersForDate('2026-10-14');
    assert.equal(d1Orders.unpaid.length, 3, '3 carried-over unpaid orders under 2026-10-14');
    d1Orders.unpaid.forEach((ord) => {
      assert.equal(ord.status, 'unpaid_carried_over', 'Status must be unpaid_carried_over');
      assert.equal(ord.paymentStatus, 'unpaid', 'Payment status must be unpaid');
      assert.ok(ord.items.length > 0, 'Items must be preserved 100%');
    });
  });

  it('Day 2 (2026-10-15): Strict Table Isolation — Paying Day 1 Order 3 does NOT affect new dining on Table 3', () => {
    // New customer sits at Table 3 on Day 2!
    const newD2Order = sim.saveOrderForTable('t3', [itemCf('Espresso', 25000, 2)]);
    assert.equal(newD2Order.table.status, 'occupied');
    const d2ActiveOrderId = newD2Order.order.id;

    // Staff collects payment for Day 1 Order 3 (Bàn 3 - 35,000đ)
    const d1Order3 = sim.orderHistory.find((o) => o.tableId === 't3' && o.status === 'unpaid_carried_over');
    assert.ok(d1Order3, 'Day 1 Order 3 must exist');

    const payResult = sim.processHistoricalPayment({
      orderId: d1Order3.id,
      paymentMethod: 'cash',
      amount: 35000,
      cashier: 'Thu ngân Ca Sáng'
    });

    assert.equal(payResult.success, true);
    assert.equal(payResult.order.status, 'completed');
    assert.equal(payResult.order.paymentBusinessDate, '2026-10-15');

    // CRITICAL CHECK: Table 3 must STILL be occupied with Day 2 Order!
    const freshTable3 = sim.tables.find((t) => t.id === 't3');
    assert.equal(freshTable3.status, 'occupied', 'Table 3 MUST remain occupied');
    assert.equal(freshTable3.activeOrderId, d2ActiveOrderId, 'Table 3 activeOrderId must still be Day 2 order');

    // Add remaining Day 2 orders (Order 7: t1 checkout, Order 8: t2 checkout, Order 9: t6 unpaid, Order 10: t7 unpaid)
    sim.saveOrderForTable('t1', [itemCf('Trà ô long sữa', 40000, 1)]);
    sim.checkoutTable('t1', 'cash'); // Order 7

    sim.saveOrderForTable('t2', [itemCf('Sinh tố xoài', 42000, 1)]);
    sim.checkoutTable('t2', 'vietqr'); // Order 8

    sim.saveOrderForTable('t6', [itemCf('Americano', 29000, 1)]); // Order 9 (unpaid)
    sim.saveOrderForTable('t7', [itemCf('Capuchino', 45000, 1)]); // Order 10 (unpaid)

    // Complete Day 2 active order on t3 as well
    sim.checkoutTable('t3', 'cash'); // Order 6 completed

    // Cash-basis revenue check on Day 2:
    // Order 6 (50k) + Order 7 (40k) + Order 8 (42k) + Historical collection of D1 Order 3 (35k) = 167,000đ
    assert.equal(sim.getCashBasisRevenue('2026-10-15'), 167000, 'Day 2 cash revenue includes historical collection');
  });

  // ==========================================================================
  // DAY 3 (2026-10-16): Multi-Day Delayed Payment (Paid on Day 3 via VietQR)
  // ==========================================================================
  it('Day 3 (2026-10-16): Delayed payment of 2-day-old order (Day 1 Order 4) via VietQR', () => {
    sim.rolloverToNewDay('2026-10-16');

    // Verify Day 2 unpaids (Order 9 on t6, Order 10 on t7) rolled over
    const ord9 = sim.orderHistory.find((o) => o.tableId === 't6' && o.status === 'unpaid_carried_over');
    assert.ok(ord9, 'Order 9 is carried over');

    // Day 1 Order 4 (Trà đào cam sả - 38k) paid today (Day 3) via VietQR
    const d1Order4 = sim.orderHistory.find((o) => o.tableId === 't4' && o.status === 'unpaid_carried_over');
    assert.ok(d1Order4, 'Day 1 Order 4 is still unpaid');

    const payResult = sim.processHistoricalPayment({
      orderId: d1Order4.id,
      paymentMethod: 'vietqr',
      amount: 38000,
      cashier: 'Thu ngân Ca Chiều'
    });

    assert.equal(payResult.success, true);
    assert.equal(payResult.order.status, 'completed');
    assert.equal(payResult.order.paymentMethod, 'vietqr');
    assert.equal(payResult.order.paymentBusinessDate, '2026-10-16');

    // Add Day 3 orders: Orders 11, 12, 13 (completed), Orders 14, 15 (unpaid)
    sim.saveOrderForTable('t1', [itemCf('Matcha Latte', 45000, 1)]);
    sim.checkoutTable('t1', 'vietqr'); // Order 11

    sim.saveOrderForTable('t2', [itemCf('Cacao Nóng', 36000, 1)]);
    sim.checkoutTable('t2', 'cash'); // Order 12

    sim.saveOrderForTable('t3', [itemCf('Trà đen macchiato', 38000, 1)]);
    sim.checkoutTable('t3', 'cash'); // Order 13

    sim.saveOrderForTable('t8', [itemCf('Trà xoài macchiato', 40000, 1)]); // Order 14 (unpaid)
    sim.saveOrderForTable('t9', [itemCf('Cà phê dừa', 42000, 1)]); // Order 15 (unpaid)

    // Day 3 cash revenue = 38k (hist VietQR) + 45k (ord11) + 36k (ord12) + 38k (ord13) = 157,000đ
    assert.equal(sim.getCashBasisRevenue('2026-10-16'), 157000);
  });

  // ==========================================================================
  // DAY 4 (2026-10-17): Strict Revenue Boundary Attribution
  // ==========================================================================
  it('Day 4 (2026-10-17): Strict Revenue Boundary — Day 1 cash-basis revenue remains 60k', () => {
    sim.rolloverToNewDay('2026-10-17');

    // Day 1 Order 5 (Trà vải nhiệt đới - 39k) paid on Day 4
    const d1Order5 = sim.orderHistory.find((o) => o.tableId === 't5' && o.status === 'unpaid_carried_over');
    assert.ok(d1Order5);

    sim.processHistoricalPayment({
      orderId: d1Order5.id,
      paymentMethod: 'cash',
      amount: 39000
    });

    // Verify all 5 Day 1 orders are now completed
    const d1Orders = sim.getOrdersForDate('2026-10-14');
    assert.equal(d1Orders.unpaid.length, 0, 'Zero unpaid orders remain from Day 1');
    assert.equal(d1Orders.completed.length, 5, 'All 5 Day 1 orders are now completed');

    // Crucial check: Day 1 cash revenue is STILL 60,000đ (the 2 paid on Day 1)
    assert.equal(sim.getCashBasisRevenue('2026-10-14'), 60000, 'Day 1 cash basis strictly un-altered');

    // Day 4 orders: Orders 16, 17, 18 (completed), Orders 19, 20 (unpaid)
    sim.saveOrderForTable('t1', [itemCf('Cold Brew Cam Sả', 45000, 1)]);
    sim.checkoutTable('t1', 'cash'); // Order 16

    sim.saveOrderForTable('t2', [itemCf('Cold Brew Truyền thống', 42000, 1)]);
    sim.checkoutTable('t2', 'vietqr'); // Order 17

    sim.saveOrderForTable('t3', [itemCf('Kombucha Dâu tằm', 48000, 1)]);
    sim.checkoutTable('t3', 'vietqr'); // Order 18

    sim.saveOrderForTable('t10', [itemCf('Trà chanh sả gừng', 30000, 1)]); // Order 19 (unpaid)
    sim.saveOrderForTable('t11', [itemCf('Sinh tố bơ', 45000, 1)]); // Order 20 (unpaid)

    // Day 4 revenue = 39k (hist Order 5) + 45k + 42k + 48k = 174,000đ
    assert.equal(sim.getCashBasisRevenue('2026-10-17'), 174000);
  });

  // ==========================================================================
  // DAY 5 (2026-10-18): Idempotency & Concurrency Double-Payment Protection
  // ==========================================================================
  it('Day 5 (2026-10-18): Idempotency check prevents duplicate payments and race conditions', () => {
    sim.rolloverToNewDay('2026-10-18');

    // Pay Day 2 Order 9 (Table 6 - 29k) with Idempotency Key
    const d2Order9 = sim.orderHistory.find((o) => o.tableId === 't6' && o.status === 'unpaid_carried_over');
    assert.ok(d2Order9);

    const key = 'IDEMP_TX_9999';
    const pay1 = sim.processHistoricalPayment({
      orderId: d2Order9.id,
      paymentMethod: 'cash',
      amount: 29000,
      idempotencyKey: key
    });
    assert.equal(pay1.success, true);
    assert.equal(pay1.alreadyProcessed, undefined);

    const initialPaymentsCount = sim.payments.length;

    // Immediate duplicate call with same idempotency key
    const pay2 = sim.processHistoricalPayment({
      orderId: d2Order9.id,
      paymentMethod: 'cash',
      amount: 29000,
      idempotencyKey: key
    });
    assert.equal(pay2.success, true);
    assert.equal(pay2.alreadyProcessed, true, 'Second call must be flagged alreadyProcessed');
    assert.equal(sim.payments.length, initialPaymentsCount, 'Payments count must NOT increase');

    // Call without key on already completed order
    const pay3 = sim.processHistoricalPayment({
      orderId: d2Order9.id,
      paymentMethod: 'vietqr',
      amount: 29000
    });
    assert.equal(pay3.success, true);
    assert.equal(pay3.alreadyCompleted, true, 'Subsequent call returns alreadyCompleted');
    assert.equal(sim.payments.length, initialPaymentsCount, 'Payments count must NOT increase');

    // Add Day 5 orders: 21, 22, 23 (completed), 24, 25 (unpaid)
    sim.saveOrderForTable('t1', [itemCf('Cà phê kem béo', 38000, 1)]);
    sim.checkoutTable('t1', 'cash'); // Order 21

    sim.saveOrderForTable('t2', [itemCf('Trà lài kem cheese', 42000, 1)]);
    sim.checkoutTable('t2', 'vietqr'); // Order 22

    sim.saveOrderForTable('t3', [itemCf('Nước ép cam tươi', 35000, 1)]);
    sim.checkoutTable('t3', 'cash'); // Order 23

    sim.saveOrderForTable('t12', [itemCf('Sữa tươi trân châu đường đen', 40000, 1)]); // Order 24
    sim.saveOrderForTable('t13', [itemCf('Trà ô long tứ quý', 32000, 1)]); // Order 25

    // Day 5 revenue = 29k (hist Order 9) + 38k + 42k + 35k = 144,000đ
    assert.equal(sim.getCashBasisRevenue('2026-10-18'), 144000);
  });

  // ==========================================================================
  // DAY 6 (2026-10-19): UI Date Tab Filter Contract
  // ==========================================================================
  it('Day 6 (2026-10-19): Date Tab Filter Contract conforms strictly to user specifications', () => {
    sim.rolloverToNewDay('2026-10-19');

    // Pay Day 2 Order 10 (Table 7 - 45k)
    const d2Order10 = sim.orderHistory.find((o) => o.tableId === 't7' && o.status === 'unpaid_carried_over');
    sim.processHistoricalPayment({
      orderId: d2Order10.id,
      paymentMethod: 'vietqr',
      amount: 45000
    });

    // Check Day 2 orders in UI filter:
    const d2Orders = sim.getOrdersForDate('2026-10-15');
    assert.equal(d2Orders.unpaid.length, 0, 'Day 2 has zero unpaid left');
    assert.equal(d2Orders.completed.length, 5, 'All 5 Day 2 orders now completed');

    // Both Order 9 and Order 10 have paymentBusinessDate !== '2026-10-15'
    const histPaidOrder = d2Orders.completed.find((o) => o.id === d2Order10.id);
    assert.equal(histPaidOrder.paymentBusinessDate, '2026-10-19');
    assert.ok(histPaidOrder.paymentBusinessDate !== histPaidOrder.businessDate, 'Flagged as delayed collection');

    // Add Day 6 orders: 26, 27, 28 (completed), 29, 30 (unpaid)
    sim.saveOrderForTable('t1', [itemCf('Americano đá', 28000, 1)]);
    sim.checkoutTable('t1', 'cash'); // Order 26

    sim.saveOrderForTable('t2', [itemCf('Trà sen vàng', 45000, 1)]);
    sim.checkoutTable('t2', 'vietqr'); // Order 27

    sim.saveOrderForTable('t3', [itemCf('Cà phê cốt dừa', 40000, 1)]);
    sim.checkoutTable('t3', 'cash'); // Order 28

    sim.saveOrderForTable('t14', [itemCf('Trà xanh đậu đỏ', 35000, 1)]); // Order 29
    sim.saveOrderForTable('t15', [itemCf('Sinh tố dâu', 45000, 1)]); // Order 30

    // Day 6 revenue = 45k (hist Order 10) + 28k + 45k + 40k = 158,000đ
    assert.equal(sim.getCashBasisRevenue('2026-10-19'), 158000);
  });

  // ==========================================================================
  // DAY 7 (2026-10-20): 35 Orders Total Audit & Zero-Leakage Reconciliation
  // ==========================================================================
  it('Day 7 (2026-10-20): Final Simulation & Total 35-Order Holistic Integrity Audit', () => {
    sim.rolloverToNewDay('2026-10-20');

    // Settle remaining carried-over orders from Day 3 & Day 4:
    // Order 14 (t8 - 40k), Order 15 (t9 - 42k), Order 19 (t10 - 30k)
    ['t8', 't9', 't10'].forEach((tId) => {
      const ord = sim.orderHistory.find((o) => o.tableId === tId && o.status === 'unpaid_carried_over');
      if (ord) {
        sim.processHistoricalPayment({
          orderId: ord.id,
          paymentMethod: 'cash',
          amount: ord.total
        });
      }
    });

    // Add Day 7 orders: 31, 32, 33 (completed), 34, 35 (serving active)
    sim.saveOrderForTable('t1', [itemCf('Espresso Con Panna', 35000, 1)]);
    sim.checkoutTable('t1', 'cash'); // Order 31

    sim.saveOrderForTable('t2', [itemCf('Latte Hạnh Nhân', 48000, 1)]);
    sim.checkoutTable('t2', 'vietqr'); // Order 32

    sim.saveOrderForTable('t3', [itemCf('Trà sữa Oolong nướng', 39000, 1)]);
    sim.checkoutTable('t3', 'cash'); // Order 33

    sim.saveOrderForTable('t4', [itemCf('Trà xoài chanh leo', 38000, 1)]); // Order 34 (serving)
    sim.saveOrderForTable('t5', [itemCf('Affogato', 42000, 1)]); // Order 35 (serving)

    // 1. Audit Total Order Count across all days
    const totalOrdersCreated = Object.keys(sim.orders).length + sim.orderHistory.length;
    assert.equal(totalOrdersCreated, 35, 'Exactly 35 real-world orders created across 7 days');

    // 2. Audit Ledger Matching: Sum(Payments) === Sum(Completed Orders Paid Amount)
    const completedOrders = sim.orderHistory.filter((o) => o.status === 'completed');
    const totalCompletedPaidAmount = completedOrders.reduce((sum, o) => sum + o.paidAmount, 0);
    const totalLedgerPaymentsAmount = sim.payments.reduce((sum, p) => sum + p.amount, 0);

    assert.equal(
      totalLedgerPaymentsAmount,
      totalCompletedPaidAmount,
      'Immutable payment ledger MUST match 100% of completed orders revenue'
    );

    // 3. Audit Zero Ghost Tables
    sim.tables.forEach((t) => {
      if (t.status === 'empty') {
        assert.equal(t.activeOrderId, null, `Empty table ${t.id} must have null activeOrderId`);
        assert.equal(t.customerCount, 0, `Empty table ${t.id} must have 0 customerCount`);
      } else if (t.status === 'occupied') {
        assert.ok(t.activeOrderId, `Occupied table ${t.id} must have activeOrderId`);
        assert.ok(sim.orders[t.activeOrderId], `Occupied table ${t.id} must reference an active order in service`);
      }
    });

    // 4. Audit Zero Lost Items: Every completed order has valid items with correct line totals
    completedOrders.forEach((o) => {
      assert.ok(o.items.length > 0, `Order ${o.id} must contain items`);
      const calcTotal = o.items.reduce((s, it) => s + it.lineTotal, 0);
      assert.equal(calcTotal, o.total, `Order ${o.id} total must match sum of line items`);
      assert.equal(o.remainingAmount, 0, `Completed order ${o.id} must have 0 remainingAmount`);
    });

    // 5. Audit Zero Cancelled or Deleted Unpaid Orders
    const cancelledOrders = sim.orderHistory.filter((o) => o.status === 'cancelled');
    assert.equal(cancelledOrders.length, 0, 'ZERO orders were automatically cancelled or lost');

    console.log('\n============================================================');
    console.log('  7-DAY HISTORICAL ROLLOVER & SETTLEMENT AUDIT PASSED!');
    console.log(`  Total Orders Simulated   : ${totalOrdersCreated}`);
    console.log(`  Completed Orders Paid    : ${completedOrders.length}`);
    console.log(`  Active Serving Orders    : ${Object.keys(sim.orders).length}`);
    console.log(`  Total Revenue Collected  : ${totalLedgerPaymentsAmount.toLocaleString('vi-VN')}đ`);
    console.log('  Revenue Discrepancy      : 0đ (100% Match)');
    console.log('  Ghost Tables Detected    : 0 (Zero)');
    console.log('============================================================\n');
  });
});
