import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_TABLES } from '../src/data/initialData.js';

/**
 * ============================================================================
 * GÓC POS — PHASE 1 AUTOMATED VERIFICATION SUITE
 * ============================================================================
 * Validates Phase 1: Realtime Hardening, Billing Lock, and OCC Conflict Guard
 * 1. Billing Lock acquisition, 180s timeout, and release
 * 2. Manager/Admin force-unlock capability vs Staff restriction
 * 3. OCC Version Check preventing silent Lost Updates
 * 4. Split Payment remainder absorption (Zero-drift balance)
 * 5. Visibility change re-sync threshold (>5s)
 */

class Phase1Harness {
  constructor() {
    this.tables = JSON.parse(JSON.stringify(INITIAL_TABLES)).map((t) => ({
      ...t,
      status: 'empty',
      activeOrderId: null,
      customerCount: 0,
      billingLock: null
    }));
    this.orders = {};
    this.lastSyncTime = Date.now();
  }

  isTableBillingLocked(table) {
    if (!table || !table.billingLock) return null;
    const now = Date.now();
    const lockedAt = Number(table.billingLock.lockedAt) || 0;
    if (now - lockedAt >= 180000) {
      return null;
    }
    return table.billingLock;
  }

  acquireBillingLock(tableId, user) {
    const table = this.tables.find((t) => t.id === tableId);
    if (!table) return { success: false, message: 'Bàn không tồn tại' };

    const activeLock = this.isTableBillingLocked(table);
    if (activeLock && activeLock.lockedById !== user.id) {
      return { success: false, lockedBy: activeLock.staffName };
    }

    const lockObj = {
      lockedById: user.id,
      staffName: user.name,
      lockedAt: Date.now()
    };

    table.billingLock = lockObj;
    return { success: true, lock: lockObj };
  }

  releaseBillingLock(tableId, user, force = false) {
    const table = this.tables.find((t) => t.id === tableId);
    if (!table || !table.billingLock) return { success: true };

    const activeLock = this.isTableBillingLocked(table);
    if (activeLock && activeLock.lockedById !== user.id && !force && user.role === 'staff') {
      return { success: false, message: 'Chỉ Quản lý hoặc Admin mới có quyền mở khóa cưỡng chế!' };
    }

    table.billingLock = null;
    return { success: true };
  }

  saveOrderForTable(tableId, items, user, expectedVersion = null) {
    const table = this.tables.find((t) => t.id === tableId);
    if (!table) return { success: false, message: 'Bàn không tồn tại' };

    // Check billing lock
    const activeLock = this.isTableBillingLocked(table);
    if (activeLock && activeLock.lockedById !== user.id) {
      return { success: false, locked: true, message: `Bàn đang tính tiền bởi ${activeLock.staffName}` };
    }

    let orderId = table.activeOrderId;
    let existingOrder = orderId ? this.orders[orderId] : null;

    // OCC Version Check
    if (
      existingOrder &&
      expectedVersion !== null &&
      expectedVersion !== undefined &&
      (existingOrder.version || 1) > expectedVersion
    ) {
      return {
        success: false,
        conflict: true,
        currentOrder: JSON.parse(JSON.stringify(existingOrder)),
        message: 'Đơn hàng vừa được cập nhật bởi nhân viên khác, vui lòng tải lại bàn'
      };
    }

    const nextVersion = existingOrder ? (existingOrder.version || 1) + 1 : 1;

    if (!existingOrder) {
      orderId = 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      existingOrder = {
        id: orderId,
        tableId: table.id,
        tableName: table.name,
        status: 'serving',
        items: [],
        total: 0,
        paidAmount: 0,
        remainingAmount: 0,
        splitPayments: [],
        version: nextVersion
      };
    }

    const subtotal = items.reduce((sum, it) => sum + (it.lineTotal || it.unitPrice * it.quantity), 0);
    const updatedOrder = {
      ...existingOrder,
      items: JSON.parse(JSON.stringify(items)),
      subtotal,
      total: subtotal,
      remainingAmount: subtotal - (existingOrder.paidAmount || 0),
      version: nextVersion
    };

    table.status = 'occupied';
    table.activeOrderId = orderId;
    this.orders[orderId] = updatedOrder;

    return { success: true, order: updatedOrder, table };
  }

  processPartialPayment(tableId, amount, isFinal = false) {
    const table = this.tables.find((t) => t.id === tableId);
    const order = table?.activeOrderId ? this.orders[table.activeOrderId] : null;
    if (!order) return { success: false };

    let payAmount = Number(amount) || 0;
    const currentRemaining = order.remainingAmount > 0 ? order.remainingAmount : Math.max(0, order.total - (order.paidAmount || 0));

    // Remainder absorption
    if (payAmount >= currentRemaining || isFinal) {
      payAmount = currentRemaining;
    }

    const newPaidAmount = (order.paidAmount || 0) + payAmount;
    const remainingAmount = Math.max(0, order.total - newPaidAmount);

    order.paidAmount = newPaidAmount;
    order.remainingAmount = remainingAmount;
    order.splitPayments.push({ amount: payAmount, timestamp: new Date().toISOString() });

    if (remainingAmount <= 0) {
      order.status = 'completed';
      table.status = 'empty';
      table.activeOrderId = null;
      table.billingLock = null; // Lock released on finish
      return { success: true, isFullyPaid: true, remainingAmount: 0 };
    }

    return { success: true, isFullyPaid: false, remainingAmount };
  }

  checkVisibilityReSync(nowTimestamp) {
    const elapsed = nowTimestamp - this.lastSyncTime;
    return elapsed >= 5000;
  }
}

describe('Phase 1 Verification: Realtime Hardening & Billing Lock Protocol', () => {
  const harness = new Phase1Harness();

  const userStaff1 = { id: 'staff-03', name: 'Lê Hoàng Nam', role: 'staff' };
  const userStaff2 = { id: 'staff-04', name: 'Phạm Quỳnh', role: 'staff' };
  const userManager = { id: 'staff-02', name: 'Nguyễn Văn Hùng', role: 'manager' };
  const userAdmin = { id: 'staff-01', name: 'Trần Mai', role: 'admin' };

  it('1. Billing Lock Acquisition & Mutual Exclusion', () => {
    // Staff 1 opens checkout on B01
    const lock1 = harness.acquireBillingLock('B01', userStaff1);
    assert.equal(lock1.success, true);
    assert.equal(harness.tables.find((t) => t.id === 'B01').billingLock.lockedById, userStaff1.id);

    // Staff 2 attempts to checkout B01 simultaneously -> REJECTED
    const lock2 = harness.acquireBillingLock('B01', userStaff2);
    assert.equal(lock2.success, false);
    assert.equal(lock2.lockedBy, userStaff1.name);

    // Staff 1 releases lock when done
    harness.releaseBillingLock('B01', userStaff1);
    assert.equal(harness.tables.find((t) => t.id === 'B01').billingLock, null);
  });

  it('2. Billing Lock 180s Auto-Unlock Safeguard', () => {
    // Staff 1 locks B02
    harness.acquireBillingLock('B02', userStaff1);
    const tableB02 = harness.tables.find((t) => t.id === 'B02');
    assert.ok(tableB02.billingLock);

    // Simulate 181 seconds passed without checkout (device walked away)
    tableB02.billingLock.lockedAt = Date.now() - 181000;

    // Check lock status -> expired
    const activeLock = harness.isTableBillingLocked(tableB02);
    assert.equal(activeLock, null);

    // Staff 2 can now acquire lock cleanly
    const lock2 = harness.acquireBillingLock('B02', userStaff2);
    assert.equal(lock2.success, true);
    assert.equal(tableB02.billingLock.lockedById, userStaff2.id);

    harness.releaseBillingLock('B02', userStaff2);
  });

  it('3. Billing Lock Force-Unlock (Admin/Manager vs Staff RBAC)', () => {
    // Staff 1 locks B03
    harness.acquireBillingLock('B03', userStaff1);

    // Staff 2 tries force-unlock without authority -> REJECTED
    const resStaff2 = harness.releaseBillingLock('B03', userStaff2, false);
    assert.equal(resStaff2.success, false);
    assert.ok(resStaff2.message.includes('Chỉ Quản lý hoặc Admin'));

    // Manager performs force-unlock -> SUCCESS
    const resMgr = harness.releaseBillingLock('B03', userManager, true);
    assert.equal(resMgr.success, true);
    assert.equal(harness.tables.find((t) => t.id === 'B03').billingLock, null);
  });

  it('4. Block Adding Items to a Billing-Locked Table', () => {
    // Staff 1 locks B04 for billing
    harness.acquireBillingLock('B04', userStaff1);

    // Staff 2 attempts to save an order on B04 -> BLOCKED!
    const addRes = harness.saveOrderForTable('B04', [{ name: 'Cà phê', unitPrice: 35000, quantity: 1 }], userStaff2);
    assert.equal(addRes.success, false);
    assert.equal(addRes.locked, true);
    assert.ok(addRes.message.includes('Bàn đang tính tiền'));

    harness.releaseBillingLock('B04', userStaff1);
  });

  it('5. OCC Version Conflict Detection (Prevent Silent Lost Update)', () => {
    // Initial order on B05: Cà phê sữa
    const o1 = harness.saveOrderForTable('B05', [{ name: 'Cà phê sữa', unitPrice: 35000, quantity: 1 }], userStaff1);
    assert.equal(o1.success, true);
    assert.equal(o1.order.version, 1);

    // Staff A and Staff B both loaded order at version 1
    const staffAVersion = 1;
    const staffBVersion = 1;

    // Staff A saves 2 drinks first -> version advances to 2
    const saveA = harness.saveOrderForTable(
      'B05',
      [{ name: 'Cà phê sữa', unitPrice: 35000, quantity: 2 }],
      userStaff1,
      staffAVersion
    );
    assert.equal(saveA.success, true);
    assert.equal(saveA.order.version, 2);

    // Staff B tries to save with stale version 1 -> CONFLICT INTERCEPTED!
    const saveB = harness.saveOrderForTable(
      'B05',
      [{ name: 'Cà phê sữa', unitPrice: 35000, quantity: 1 }, { name: 'Trà đào', unitPrice: 45000, quantity: 1 }],
      userStaff2,
      staffBVersion
    );
    assert.equal(saveB.success, false);
    assert.equal(saveB.conflict, true);
    assert.equal(saveB.currentOrder.version, 2);

    // Staff B receives fresh order at version 2 and saves cleanly
    const freshVersion = saveB.currentOrder.version;
    const saveBRetry = harness.saveOrderForTable(
      'B05',
      [{ name: 'Cà phê sữa', unitPrice: 35000, quantity: 2 }, { name: 'Trà đào', unitPrice: 45000, quantity: 1 }],
      userStaff2,
      freshVersion
    );
    assert.equal(saveBRetry.success, true);
    assert.equal(saveBRetry.order.version, 3);
  });

  it('6. Split Payment Remainder Absorption (Zero-Drift Balance)', () => {
    // Create an odd bill: 95,000đ on B06
    harness.saveOrderForTable('B06', [{ name: 'Combo đặc biệt', unitPrice: 95000, quantity: 1 }], userStaff1);
    const order = harness.orders[harness.tables.find((t) => t.id === 'B06').activeOrderId];
    assert.equal(order.total, 95000);

    // Split into 3 payments: 31,667đ + 31,667đ + final payment
    const p1 = harness.processPartialPayment('B06', 31667);
    assert.equal(p1.isFullyPaid, false);
    assert.equal(p1.remainingAmount, 95000 - 31667); // 63333

    const p2 = harness.processPartialPayment('B06', 31667);
    assert.equal(p2.isFullyPaid, false);
    assert.equal(p2.remainingAmount, 63333 - 31667); // 31666

    // 3rd payment absorbs exact remainder with isFinal=true
    const p3 = harness.processPartialPayment('B06', 31667, true);
    assert.equal(p3.isFullyPaid, true);
    assert.equal(p3.remainingAmount, 0);

    // Confirm total split payments equals exactly total bill
    const sumPaid = order.splitPayments.reduce((s, p) => s + p.amount, 0);
    assert.equal(sumPaid, 95000);
    assert.equal(order.status, 'completed');
    assert.equal(harness.tables.find((t) => t.id === 'B06').status, 'empty');
  });

  it('7. Visibility Re-sync Threshold Verification', () => {
    const t0 = harness.lastSyncTime;

    // 2 seconds later -> should NOT re-sync
    assert.equal(harness.checkVisibilityReSync(t0 + 2000), false);

    // 4.9 seconds later -> should NOT re-sync
    assert.equal(harness.checkVisibilityReSync(t0 + 4900), false);

    // 5.1 seconds later -> SHOULD re-sync
    assert.equal(harness.checkVisibilityReSync(t0 + 5100), true);

    // 30 seconds later (mobile sleep) -> SHOULD re-sync
    assert.equal(harness.checkVisibilityReSync(t0 + 30000), true);
  });
});
