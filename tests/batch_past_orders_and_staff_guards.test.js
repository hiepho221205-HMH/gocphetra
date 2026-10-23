/**
 * GÓC POS — Automated Test Suite: Batch Historical Payment & Staff Date Navigation Guards
 * Covers TEST A, B, C, D, E according to specification.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getVietnamTodayString,
  addDaysToDateString,
  formatShortDate
} from '../src/utils/dateTime.js';

test('Batch Historical Payment & Staff Date Navigation Guards', async (t) => {
  const todayStr = getVietnamTodayString();
  const yesterdayStr = addDaysToDateString(todayStr, -1);
  const twoDaysAgoStr = addDaysToDateString(todayStr, -2);

  // Mock POS State Environment
  class MockPosSystem {
    constructor(role = 'admin') {
      this.currentRole = role;
      this.currentUser = { id: 'usr-1', name: role === 'admin' ? 'Quản lý' : 'Nhân viên', role };
      this.tables = [
        { id: 'T1', name: 'Bàn 01', status: 'occupied', activeOrderId: 'ORD-LIVE-01' }
      ];
      this.orders = {
        'ORD-LIVE-01': { id: 'ORD-LIVE-01', tableId: 'T1', status: 'serving', total: 45000 }
      };
      this.payments = [];
      this.auditLogs = [];
      this.orderHistory = [
        // Yesterday unpaid orders
        {
          id: 'ORD-PAST-01',
          tableName: 'Bàn 02',
          businessDate: yesterdayStr,
          status: 'unpaid_carried_over',
          paymentStatus: 'unpaid',
          total: 65000,
          remainingAmount: 65000,
          items: [{ name: 'Cà phê muối', quantity: 2, lineTotal: 65000 }]
        },
        {
          id: 'ORD-PAST-02',
          tableName: 'Bàn 03',
          businessDate: yesterdayStr,
          status: 'unpaid_carried_over',
          paymentStatus: 'unpaid',
          total: 80000,
          remainingAmount: 80000,
          items: [{ name: 'Trà sen vàng', quantity: 2, lineTotal: 80000 }]
        },
        // Yesterday completed order
        {
          id: 'ORD-PAST-COMPLETED',
          tableName: 'Bàn 04',
          businessDate: yesterdayStr,
          status: 'completed',
          paymentStatus: 'paid',
          paidAmount: 50000,
          total: 50000,
          paymentBusinessDate: yesterdayStr
        },
        // Two days ago order (all completed)
        {
          id: 'ORD-OLDER-COMPLETED',
          tableName: 'Bàn 05',
          businessDate: twoDaysAgoStr,
          status: 'completed',
          paymentStatus: 'paid',
          paidAmount: 120000,
          total: 120000,
          paymentBusinessDate: twoDaysAgoStr
        }
      ];
    }

    get canViewPastOrders() {
      return ['admin', 'manager'].includes(this.currentRole);
    }

    get canBatchSettlePastOrders() {
      return ['admin', 'manager'].includes(this.currentRole);
    }

    get visibleOrderHistory() {
      if (this.currentRole === 'staff') {
        return this.orderHistory.filter((ord) => {
          const ordDate = ord.businessDate;
          return ordDate === todayStr;
        });
      }
      return this.orderHistory;
    }

    batchProcessHistoricalPayments({ orderIds, paymentMethod = 'cash', cashier = null }) {
      if (this.currentRole === 'staff') {
        return { success: false, error: 'Permission denied: Staff cannot process historical payments' };
      }

      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return { success: false, error: 'Empty order list' };
      }

      const targetOrders = this.orderHistory.filter(
        (o) => orderIds.includes(o.id) && o.status !== 'completed' && o.paymentStatus !== 'paid'
      );

      if (targetOrders.length === 0) {
        return { success: false, error: 'No unpaid orders found' };
      }

      const cashierName = cashier || this.currentUser.name;
      const paidAt = new Date().toISOString();
      let totalAmountCollected = 0;
      const updatedOrders = [];

      targetOrders.forEach((targetOrder) => {
        const payAmount = Number(targetOrder.remainingAmount) || Number(targetOrder.total) || 0;
        totalAmountCollected += payAmount;
        const paymentId = 'PAY_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        const paymentRecord = {
          id: paymentId,
          orderId: targetOrder.id,
          amount: payAmount,
          paymentMethod,
          paymentStatus: 'completed',
          paidAt,
          businessDate: todayStr,
          cashierId: cashierName,
          createdAt: paidAt
        };

        const updated = {
          ...targetOrder,
          status: 'completed',
          paymentStatus: 'paid',
          paidAmount: payAmount,
          remainingAmount: 0,
          paymentMethod,
          paidAt,
          paymentBusinessDate: todayStr,
          finishedAt: paidAt
        };

        this.payments.unshift(paymentRecord);
        updatedOrders.push(updated);
      });

      const updatedMap = new Map(updatedOrders.map((o) => [o.id, o]));
      this.orderHistory = this.orderHistory.map((ord) => updatedMap.get(ord.id) || ord);

      this.auditLogs.unshift({
        action: 'batch_historical_payment',
        ordersCount: updatedOrders.length,
        totalRevenue: totalAmountCollected,
        performedBy: cashierName
      });

      return {
        success: true,
        processedCount: updatedOrders.length,
        totalAmount: totalAmountCollected,
        orders: updatedOrders
      };
    }
  }

  await t.test('TEST A — Admin processes "Thanh toán tất cả" for past date with unpaid orders', () => {
    const pos = new MockPosSystem('admin');
    const unpaidYesterday = pos.orderHistory.filter(
      (o) => o.businessDate === yesterdayStr && (o.status === 'unpaid_carried_over' || o.paymentStatus !== 'paid')
    );

    assert.equal(unpaidYesterday.length, 2, 'Found 2 unpaid orders for yesterday');
    const expectedTotal = 65000 + 80000; // 145,000 VND

    const res = pos.batchProcessHistoricalPayments({
      orderIds: unpaidYesterday.map((o) => o.id),
      paymentMethod: 'cash',
      cashier: 'Quản lý'
    });

    assert.equal(res.success, true);
    assert.equal(res.processedCount, 2);
    assert.equal(res.totalAmount, expectedTotal);

    // Verify orders are updated to completed
    const updated1 = pos.orderHistory.find((o) => o.id === 'ORD-PAST-01');
    assert.equal(updated1.status, 'completed');
    assert.equal(updated1.paymentStatus, 'paid');
    assert.equal(updated1.paymentBusinessDate, todayStr, 'Cash-basis: paymentBusinessDate is today');

    const updated2 = pos.orderHistory.find((o) => o.id === 'ORD-PAST-02');
    assert.equal(updated2.status, 'completed');
    assert.equal(updated2.paymentStatus, 'paid');

    // Verify payments recorded
    assert.equal(pos.payments.length, 2);
    assert.equal(pos.payments[0].paymentMethod, 'cash');
    assert.equal(pos.payments[0].businessDate, todayStr);

    // Verify audit log
    assert.equal(pos.auditLogs.length, 1);
    assert.equal(pos.auditLogs[0].action, 'batch_historical_payment');
  });

  await t.test('TEST B — When all orders for a date are completed, unpaid count is 0', () => {
    const pos = new MockPosSystem('admin');
    // For twoDaysAgoStr, all orders are completed
    const unpaidTwoDaysAgo = pos.orderHistory.filter(
      (o) => o.businessDate === twoDaysAgoStr && (o.status === 'unpaid_carried_over' || o.paymentStatus !== 'paid')
    );
    assert.equal(unpaidTwoDaysAgo.length, 0, 'Zero unpaid orders for twoDaysAgo');

    // Calling batchProcessHistoricalPayments with already completed orders must safely fail
    const res = pos.batchProcessHistoricalPayments({
      orderIds: ['ORD-OLDER-COMPLETED'],
      paymentMethod: 'cash'
    });
    assert.equal(res.success, false);
    assert.equal(res.error, 'No unpaid orders found');
  });

  await t.test('TEST C — Staff role permissions: blocked from past orders and batch payment', () => {
    const pos = new MockPosSystem('staff');
    assert.equal(pos.canViewPastOrders, false);
    assert.equal(pos.canBatchSettlePastOrders, false);
    assert.equal(pos.visibleOrderHistory.length, 0, 'Staff visibleOrderHistory excludes past orders');
  });

  await t.test('TEST D — Unauthorized access prevention (Staff calling batch payment directly)', () => {
    const pos = new MockPosSystem('staff');
    const res = pos.batchProcessHistoricalPayments({
      orderIds: ['ORD-PAST-01', 'ORD-PAST-02'],
      paymentMethod: 'cash'
    });

    assert.equal(res.success, false);
    assert.ok(res.error.includes('Permission denied'));
    // Ensure orders remain unchanged
    const order1 = pos.orderHistory.find((o) => o.id === 'ORD-PAST-01');
    assert.equal(order1.status, 'unpaid_carried_over');
    assert.equal(order1.paymentStatus, 'unpaid');
  });

  await t.test('TEST E — Active dining tables and current orders are strictly untouched', () => {
    const pos = new MockPosSystem('admin');
    const tableBefore = JSON.parse(JSON.stringify(pos.tables[0]));
    const liveOrderBefore = JSON.parse(JSON.stringify(pos.orders['ORD-LIVE-01']));

    pos.batchProcessHistoricalPayments({
      orderIds: ['ORD-PAST-01'],
      paymentMethod: 'cash'
    });

    // Verify Active Dining floor isolation
    assert.deepEqual(pos.tables[0], tableBefore, 'Active dining table remains 100% untouched');
    assert.deepEqual(pos.orders['ORD-LIVE-01'], liveOrderBefore, 'Active serving order remains 100% untouched');
  });
});
