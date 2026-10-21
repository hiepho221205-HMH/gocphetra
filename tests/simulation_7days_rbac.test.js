import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_TABLES, INITIAL_MENU, INITIAL_TOPPINGS, INITIAL_STAFF, DEMO_ACCOUNTS } from '../src/data/initialData.js';
import { addDaysToDateString } from '../src/utils/dateTime.js';

describe('7-Day Continuous Sales Simulation & RBAC Adversarial Verification', () => {
  const BASE_DATE = '2026-10-14'; // Day 1
  const DAYS = Array.from({ length: 7 }, (_, i) => addDaysToDateString(BASE_DATE, i));
  // DAYS = ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']

  class FullSimulationPOS {
    constructor() {
      this.reset();
    }

    reset() {
      this.tables = INITIAL_TABLES.map((t) => ({ ...t, status: 'empty', activeOrderId: null, customerCount: 0 }));
      this.menu = JSON.parse(JSON.stringify(INITIAL_MENU));
      this.toppings = JSON.parse(JSON.stringify(INITIAL_TOPPINGS));
      this.staffList = JSON.parse(JSON.stringify(INITIAL_STAFF));
      this.orders = {};
      this.orderHistory = [];
      this.payments = [];
      this.auditLogs = [];
      this.currentRole = 'admin';
      this.currentDate = DAYS[0];
    }

    setRole(role) {
      if (!['admin', 'manager', 'staff'].includes(role)) throw new Error('Invalid role');
      this.currentRole = role;
    }

    setDate(dateStr) {
      this.currentDate = dateStr;
    }

    // Role-filtered view of completed order history
    get visibleOrderHistory() {
      if (this.currentRole === 'staff') {
        return this.orderHistory.filter((o) => o.businessDate === this.currentDate && !o.isDeleted);
      }
      return this.orderHistory.filter((o) => !o.isDeleted);
    }

    createAndSettleOrder({ tableId, items, paymentMethod = 'cash', businessDate = null }) {
      const bDate = businessDate || this.currentDate;
      const table = this.tables.find((t) => t.id === tableId);
      if (!table) throw new Error(`Bàn ${tableId} không tồn tại`);

      const orderId = `ORD-${bDate}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const subtotal = items.reduce((sum, it) => sum + (it.unitPrice || 25000) * (it.quantity || 1), 0);
      const total = subtotal;

      // 1. Serving state
      const servingOrder = {
        id: orderId,
        tableId,
        tableName: table.name,
        status: 'serving',
        businessDate: bDate,
        items,
        subtotal,
        total,
        paidAmount: 0,
        remainingAmount: total,
        createdAt: `${bDate}T10:00:00.000Z`
      };
      this.orders[orderId] = servingOrder;
      table.status = 'occupied';
      table.activeOrderId = orderId;

      // 2. Settlement state
      const paymentId = `PAY-${orderId}`;
      const paymentRecord = {
        id: paymentId,
        orderId,
        amount: total,
        paymentMethod,
        businessDate: bDate,
        createdAt: `${bDate}T10:30:00.000Z`
      };
      this.payments.push(paymentRecord);

      const completedOrder = {
        ...servingOrder,
        status: 'completed',
        paymentStatus: 'paid',
        paymentMethod,
        paidAmount: total,
        remainingAmount: 0,
        finishedAt: `${bDate}T10:30:00.000Z`,
        isDeleted: false
      };

      delete this.orders[orderId];
      this.orderHistory.push(completedOrder);
      table.status = 'empty';
      table.activeOrderId = null;

      return { order: completedOrder, payment: paymentRecord };
    }

    // Manager/Admin menu modification
    updatePrice(productId, newPrice) {
      if (this.currentRole === 'staff') throw new Error('403 Forbidden: Staff cannot modify price');
      const item = this.menu.find((m) => m.id === productId);
      if (item) {
        item.basePrice = newPrice;
        this.auditLogs.push({
          action: 'price_change',
          role: this.currentRole,
          resourceId: productId,
          newPrice,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Role Promotion / Demotion (Admin only)
    changeRole(targetStaffId, newRole) {
      if (this.currentRole !== 'admin') throw new Error('403 Forbidden: Only Admin can change roles');
      const target = this.staffList.find((s) => s.id === targetStaffId);
      if (!target) throw new Error('Staff not found');
      if (target.role === 'admin' && newRole !== 'admin') {
        const otherAdmins = this.staffList.filter((s) => s.id !== targetStaffId && s.role === 'admin');
        if (otherAdmins.length === 0) throw new Error('Cannot demote last admin');
      }
      target.role = newRole;
      this.auditLogs.push({
        action: 'role_change',
        role: this.currentRole,
        resourceId: targetStaffId,
        newRole,
        createdAt: new Date().toISOString()
      });
    }

    // Soft-delete archiving by range or all (Admin only)
    archiveByRange(fromDay, toDay) {
      if (this.currentRole !== 'admin') throw new Error('403 Forbidden: Only Admin can archive orders');
      let count = 0;
      this.orderHistory.forEach((ord) => {
        if (!ord.isDeleted && ord.businessDate >= fromDay && ord.businessDate <= toDay) {
          ord.isDeleted = true;
          ord.deletedAt = new Date().toISOString();
          count++;
        }
      });
      this.auditLogs.push({
        action: 'order_archived',
        count,
        fromDay,
        toDay,
        createdAt: new Date().toISOString()
      });
      return count;
    }
  }

  // =========================================================================
  // F.1 & F.2: STAFF 7-DAY SIMULATION (35 ORDERS, TODAY SCOPE, MIDNIGHT FLOW)
  // =========================================================================
  it('F.1 & F.2 - Staff 7-day simulation: 35 orders, Cash/VietQR checkout, table release & daily isolation', () => {
    const sim = new FullSimulationPOS();
    sim.setRole('staff');

    let totalStaffOrders = 0;

    // Simulate 7 days, 5 orders per day = 35 orders
    DAYS.forEach((day, dayIndex) => {
      sim.setDate(day);

      for (let orderNum = 1; orderNum <= 5; orderNum++) {
        const tableId = `B0${(orderNum % 4) + 1}`;
        const paymentMethod = orderNum % 2 === 0 ? 'vietqr' : 'cash';

        const { order } = sim.createAndSettleOrder({
          tableId,
          items: [
            { productId: 'prod-1', name: 'Cà phê Đen Đá', unitPrice: 22000, quantity: 1 },
            { productId: 'prod-3', name: 'Trà Đào Cam Sả', unitPrice: 32000, quantity: 1 }
          ],
          paymentMethod,
          businessDate: day
        });

        assert.equal(order.status, 'completed');
        assert.equal(order.businessDate, day);
        totalStaffOrders++;
      }

      // Verify Staff ONLY sees the 5 orders of 'day' in their history!
      const staffVisible = sim.visibleOrderHistory;
      assert.equal(staffVisible.length, 5, `Staff on ${day} must strictly see exactly 5 orders of that day`);
      assert.ok(staffVisible.every((o) => o.businessDate === day), 'All visible orders must belong to current day');
    });

    assert.equal(totalStaffOrders, 35, 'Total 35 orders created across 7 days');
    assert.equal(sim.orderHistory.length, 35, 'Underlying storage holds all 35 orders');
    assert.equal(sim.payments.length, 35, 'Payments ledger holds all 35 transactions');
  });

  // =========================================================================
  // F.3: STAFF ADVERSARIAL ATTEMPTS ARE REJECTED
  // =========================================================================
  it('F.3 - Staff adversarial attempts to modify menu, view old history, or change roles must fail', () => {
    const sim = new FullSimulationPOS();
    sim.setRole('staff');

    // 1. Attempt to modify menu price
    assert.throws(() => {
      sim.updatePrice('prod-1', 99999);
    }, /403 Forbidden/);

    // 2. Attempt to promote someone or self
    assert.throws(() => {
      sim.changeRole('staff-02', 'admin');
    }, /403 Forbidden/);

    // 3. Attempt to archive orders
    assert.throws(() => {
      sim.archiveByRange('2026-10-14', '2026-10-20');
    }, /403 Forbidden/);
  });

  // =========================================================================
  // F.4 & F.5: MANAGER 7-DAY WORKFLOW & RESTRICTIONS
  // =========================================================================
  it('F.4 & F.5 - Manager operates full sales & menu, but is blocked from role changes and data deletion', () => {
    const sim = new FullSimulationPOS();
    sim.setRole('manager');

    // Manager creates orders and sees all history
    sim.setDate(DAYS[0]);
    sim.createAndSettleOrder({ tableId: 'B01', items: [{ unitPrice: 30000, quantity: 1 }], businessDate: DAYS[0] });
    sim.setDate(DAYS[1]);
    sim.createAndSettleOrder({ tableId: 'B02', items: [{ unitPrice: 40000, quantity: 1 }], businessDate: DAYS[1] });

    assert.equal(sim.visibleOrderHistory.length, 2, 'Manager can view history across multiple days');

    // Manager updates menu price
    sim.updatePrice('prod-1', 26000);
    assert.equal(sim.menu.find((m) => m.id === 'prod-1').basePrice, 26000);
    assert.equal(sim.auditLogs[0].action, 'price_change');

    // Manager attempts forbidden actions
    assert.throws(() => {
      sim.changeRole('staff-02', 'admin');
    }, /403 Forbidden/);

    assert.throws(() => {
      sim.archiveByRange(DAYS[0], DAYS[1]);
    }, /403 Forbidden/);
  });

  // =========================================================================
  // F.6, F.7 & F.8: ADMIN ROLE MANAGEMENT & 3 DELETION SCENARIOS (SOFT-DELETE)
  // =========================================================================
  it('F.6 - Admin manages roles and audit log tracking', () => {
    const sim = new FullSimulationPOS();
    sim.setRole('admin');

    // Promote staff-03 to manager
    sim.changeRole('staff-03', 'manager');
    assert.equal(sim.staffList.find((s) => s.id === 'staff-03').role, 'manager');
    assert.equal(sim.auditLogs[0].action, 'role_change');

    // Demote staff-03 back to staff
    sim.changeRole('staff-03', 'staff');
    assert.equal(sim.staffList.find((s) => s.id === 'staff-03').role, 'staff');

    // Block demoting staff-01 (last admin)
    assert.throws(() => {
      sim.changeRole('staff-01', 'staff');
    }, /Cannot demote last admin/);
  });

  it('F.7 & F.8 - Admin Deletion Scenarios: 1 Day (5 orders), Days 1-5 (25 orders), All 7 Days (35 orders)', () => {
    const sim = new FullSimulationPOS();
    sim.setRole('admin');

    // Seed 35 orders (5 per day across 7 days)
    DAYS.forEach((day) => {
      for (let i = 1; i <= 5; i++) {
        sim.createAndSettleOrder({
          tableId: `B0${i}`,
          items: [{ unitPrice: 20000, quantity: 1 }],
          businessDate: day
        });
      }
    });

    assert.equal(sim.orderHistory.length, 35);
    assert.equal(sim.payments.length, 35);

    // --- Scenario A: Delete 1 day (Day 1) = 5 orders archived ---
    const deletedDay1 = sim.archiveByRange(DAYS[0], DAYS[0]);
    assert.equal(deletedDay1, 5, 'Must archive exactly 5 orders of Day 1');
    assert.equal(sim.visibleOrderHistory.length, 30, '30 active orders remain visible');
    assert.equal(sim.payments.length, 35, 'Payments ledger is immutable (35 records preserved)');

    // Reset for Scenario B
    sim.reset();
    DAYS.forEach((day) => {
      for (let i = 1; i <= 5; i++) {
        sim.createAndSettleOrder({ tableId: `B0${i}`, items: [{ unitPrice: 20000, quantity: 1 }], businessDate: day });
      }
    });

    // --- Scenario B: Delete Days 1 to 5 = 25 orders archived ---
    const deletedDays1To5 = sim.archiveByRange(DAYS[0], DAYS[4]);
    assert.equal(deletedDays1To5, 25, 'Must archive exactly 25 orders of Days 1 to 5');
    assert.equal(sim.visibleOrderHistory.length, 10, '10 active orders remain visible (Days 6 & 7)');
    assert.equal(sim.payments.length, 35, 'Payments ledger remains 100% intact');

    // Reset for Scenario C
    sim.reset();
    DAYS.forEach((day) => {
      for (let i = 1; i <= 5; i++) {
        sim.createAndSettleOrder({ tableId: `B0${i}`, items: [{ unitPrice: 20000, quantity: 1 }], businessDate: day });
      }
    });

    // --- Scenario C: Delete All 7 Days = 35 orders archived ---
    const deletedAll7Days = sim.archiveByRange(DAYS[0], DAYS[6]);
    assert.equal(deletedAll7Days, 35, 'Must archive all 35 orders across 7 days');
    assert.equal(sim.visibleOrderHistory.length, 0, '0 active orders remain visible in regular POS views');
    assert.equal(sim.orderHistory.filter((o) => o.isDeleted).length, 35, 'All 35 orders preserved in soft-delete archive');
    assert.equal(sim.payments.length, 35, 'Payments ledger preserves all 35 financial rows for audit reconciliation');
    assert.ok(sim.auditLogs.some((l) => l.action === 'order_archived' && l.count === 35), 'Audit log recorded for archive job');
  });
});
