import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_TABLES, INITIAL_MENU, INITIAL_TOPPINGS, INITIAL_STAFF, DEMO_ACCOUNTS } from '../src/data/initialData.js';
import { getVietnamTodayString, getVietnamDateString, addDaysToDateString } from '../src/utils/dateTime.js';

describe('RBAC 3-Tier Permission Guards & Negative Security Tests', () => {

  // Mock Context Simulator implementing the exact business rules of PosContext
  class RbacPosSimulator {
    constructor(initialRole = 'staff') {
      this.currentRole = initialRole;
      this.currentUser = DEMO_ACCOUNTS[initialRole] || DEMO_ACCOUNTS.staff;
      this.tables = JSON.parse(JSON.stringify(INITIAL_TABLES));
      this.menu = JSON.parse(JSON.stringify(INITIAL_MENU));
      this.toppings = JSON.parse(JSON.stringify(INITIAL_TOPPINGS));
      this.staffList = JSON.parse(JSON.stringify(INITIAL_STAFF));
      this.orders = {};
      this.orderHistory = [];
      this.auditLogs = [];
      this.simulatedToday = getVietnamTodayString();
    }

    setRole(role) {
      if (!['admin', 'manager', 'staff'].includes(role)) {
        throw new Error('Vai trò không hợp lệ');
      }
      this.currentRole = role;
      this.currentUser = DEMO_ACCOUNTS[role];
    }

    // Role-based visibility for order history
    get visibleOrderHistory() {
      if (this.currentRole === 'staff') {
        return this.orderHistory.filter((o) => {
          const ordDate = o.businessDate || (o.finishedAt ? getVietnamDateString(o.finishedAt) : null);
          return ordDate === this.simulatedToday;
        });
      }
      return this.orderHistory;
    }

    // --- Order Operations ---
    createOrder(tableId, items = [{ productId: 'prod-1', name: 'Cà phê Đen Đá', quantity: 2, lineTotal: 44000 }], businessDate = null) {
      const table = this.tables.find((t) => t.id === tableId);
      if (!table) return { success: false, message: 'Bàn không tồn tại' };

      const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
      const newOrder = {
        id: orderId,
        tableId: table.id,
        tableName: table.name,
        status: 'serving',
        businessDate: businessDate || this.simulatedToday,
        items,
        subtotal,
        total: subtotal,
        paidAmount: 0,
        createdAt: new Date().toISOString()
      };

      this.orders[orderId] = newOrder;
      table.status = 'occupied';
      table.activeOrderId = orderId;
      return { success: true, order: newOrder };
    }

    checkoutOrder(orderId, paymentMethod = 'cash') {
      const order = this.orders[orderId];
      if (!order) return { success: false, message: 'Đơn không tồn tại' };

      const finishedOrder = {
        ...order,
        status: 'completed',
        paymentStatus: 'paid',
        paymentMethod,
        paidAmount: order.total,
        finishedAt: new Date().toISOString()
      };

      delete this.orders[orderId];
      this.orderHistory.unshift(finishedOrder);

      const table = this.tables.find((t) => t.id === order.tableId);
      if (table) {
        table.status = 'empty';
        table.activeOrderId = null;
      }
      return { success: true, order: finishedOrder };
    }

    // --- Menu Guards ---
    updateMenuItem(itemId, updates) {
      if (this.currentRole === 'staff') {
        throw new Error('403 Forbidden: Staff không được quyền chỉnh sửa thực đơn!');
      }
      const item = this.menu.find((m) => m.id === itemId);
      if (!item) return false;
      Object.assign(item, updates);
      return true;
    }

    // --- Role Change Guards ---
    changeUserRole(targetStaffId, newRole) {
      if (this.currentRole !== 'admin') {
        throw new Error('403 Forbidden: Chỉ Admin mới có quyền thay đổi vai trò nhân sự!');
      }
      const target = this.staffList.find((s) => s.id === targetStaffId);
      if (!target) throw new Error('Không tìm thấy nhân viên');

      // Safeguard: Prevent demoting last Admin
      if (target.role === 'admin' && newRole !== 'admin') {
        const remainingAdmins = this.staffList.filter((s) => s.id !== targetStaffId && s.role === 'admin');
        if (remainingAdmins.length === 0) {
          throw new Error('400 Bad Request: Không thể hạ quyền tài khoản Admin cuối cùng của hệ thống!');
        }
      }

      const oldRole = target.role;
      target.role = newRole;
      this.auditLogs.unshift({
        action: 'role_change',
        resourceId: targetStaffId,
        details: { oldRole, newRole, targetName: target.name },
        timestamp: new Date().toISOString()
      });
      return { success: true, oldRole, newRole };
    }

    // --- Cleanup & Soft-Delete Guards ---
    archiveOrders(orderIds = []) {
      if (this.currentRole !== 'admin') {
        throw new Error('403 Forbidden: Chỉ Quản trị viên (Admin) mới có quyền lưu trữ/xóa dữ liệu lịch sử!');
      }

      // Safeguard: Check if any active serving orders
      const hasActive = Object.values(this.orders).some((o) => orderIds.includes(o.id) && ['serving', 'awaiting_payment'].includes(o.status));
      if (hasActive) {
        throw new Error('400 Bad Request: Không được phép xóa đơn hàng đang phục vụ tại bàn!');
      }

      const idSet = new Set(orderIds);
      this.orderHistory = this.orderHistory.filter((o) => !idSet.has(o.id));
      this.auditLogs.unshift({
        action: 'order_archived',
        count: orderIds.length,
        timestamp: new Date().toISOString()
      });
      return { success: true, count: orderIds.length };
    }
  }

  // =========================================================================
  // 1. STAFF ROLE GUARDS & BOUNDARIES
  // =========================================================================
  it('1.1 - Staff is ALLOWED to create orders, settle bill, and release table to empty', () => {
    const sim = new RbacPosSimulator('staff');
    const createRes = sim.createOrder('B01');
    assert.ok(createRes.success);
    assert.equal(sim.tables.find((t) => t.id === 'B01').status, 'occupied');

    const checkoutRes = sim.checkoutOrder(createRes.order.id, 'cash');
    assert.ok(checkoutRes.success);
    assert.equal(sim.tables.find((t) => t.id === 'B01').status, 'empty');
    assert.equal(sim.visibleOrderHistory.length, 1);
  });

  it('1.2 - Staff is ALLOWED to serve orders past midnight until completion', () => {
    const sim = new RbacPosSimulator('staff');
    const yesterdayStr = addDaysToDateString(sim.simulatedToday, -1);
    
    // Order opened yesterday at 23:30 (before midnight)
    const midnightOrderRes = sim.createOrder('B04', [{ productId: 'prod-2', name: 'Cà phê Sữa Đá', quantity: 1, lineTotal: 25000 }], yesterdayStr);
    assert.ok(midnightOrderRes.success);
    assert.equal(midnightOrderRes.order.businessDate, yesterdayStr);
    assert.equal(midnightOrderRes.order.status, 'serving');

    // Staff past midnight can still see the occupied table and complete payment
    assert.ok(sim.orders[midnightOrderRes.order.id], 'Order remains active in quầy phục vụ');
    const settleRes = sim.checkoutOrder(midnightOrderRes.order.id, 'vietqr');
    assert.ok(settleRes.success);
    assert.equal(settleRes.order.status, 'completed');
    assert.equal(sim.tables.find((t) => t.id === 'B04').status, 'empty');
  });

  it('1.3 - Staff is STRICTLY FORBIDDEN from viewing past days completed orders', () => {
    const sim = new RbacPosSimulator('staff');
    const yesterdayStr = addDaysToDateString(sim.simulatedToday, -1);

    // Seed 1 order yesterday and 1 order today
    sim.orderHistory = [
      { id: 'ORD-TODAY-01', businessDate: sim.simulatedToday, status: 'completed', total: 50000 },
      { id: 'ORD-YESTERDAY-01', businessDate: yesterdayStr, status: 'completed', total: 60000 }
    ];

    // Staff sees only today's order
    const staffVisible = sim.visibleOrderHistory;
    assert.equal(staffVisible.length, 1);
    assert.equal(staffVisible[0].id, 'ORD-TODAY-01');
    assert.ok(!staffVisible.some((o) => o.id === 'ORD-YESTERDAY-01'), 'Past day order must be hidden from Staff');

    // Manager and Admin see both orders
    sim.setRole('manager');
    assert.equal(sim.visibleOrderHistory.length, 2);

    sim.setRole('admin');
    assert.equal(sim.visibleOrderHistory.length, 2);
  });

  it('1.4 - Staff is STRICTLY FORBIDDEN from modifying menu items, prices, or toppings', () => {
    const sim = new RbacPosSimulator('staff');
    assert.throws(() => {
      sim.updateMenuItem('prod-1', { basePrice: 99000 });
    }, /403 Forbidden/);
  });

  it('1.5 - Staff is STRICTLY FORBIDDEN from changing roles or deleting sales history', () => {
    const sim = new RbacPosSimulator('staff');
    assert.throws(() => {
      sim.changeUserRole('staff-02', 'admin');
    }, /403 Forbidden/);

    assert.throws(() => {
      sim.archiveOrders(['ORD-01']);
    }, /403 Forbidden/);
  });

  // =========================================================================
  // 2. MANAGER ROLE GUARDS & BOUNDARIES
  // =========================================================================
  it('2.1 - Manager is ALLOWED full POS operations, menu editing, and full history', () => {
    const sim = new RbacPosSimulator('manager');
    // Allowed menu edit
    const updateRes = sim.updateMenuItem('prod-1', { basePrice: 28000 });
    assert.ok(updateRes);
    assert.equal(sim.menu.find((m) => m.id === 'prod-1').basePrice, 28000);

    // Allowed full history
    sim.orderHistory = [
      { id: 'ORD-1', businessDate: '2026-10-18', status: 'completed' },
      { id: 'ORD-2', businessDate: '2026-10-19', status: 'completed' }
    ];
    assert.equal(sim.visibleOrderHistory.length, 2);
  });

  it('2.2 - Manager is STRICTLY FORBIDDEN from changing roles or self-promoting to Admin', () => {
    const sim = new RbacPosSimulator('manager');
    assert.throws(() => {
      sim.changeUserRole('staff-02', 'admin');
    }, /403 Forbidden/);

    assert.throws(() => {
      sim.changeUserRole('staff-03', 'manager');
    }, /403 Forbidden/);
  });

  it('2.3 - Manager is STRICTLY FORBIDDEN from deleting sales history', () => {
    const sim = new RbacPosSimulator('manager');
    assert.throws(() => {
      sim.archiveOrders(['ORD-1']);
    }, /403 Forbidden/);
  });

  // =========================================================================
  // 3. ADMIN ROLE GUARDS & SYSTEM SAFEGUARDS
  // =========================================================================
  it('3.1 - Admin is ALLOWED to promote Staff to Manager and demote Manager to Staff', () => {
    const sim = new RbacPosSimulator('admin');
    // 1. Promote staff-03 to manager
    const promoteRes = sim.changeUserRole('staff-03', 'manager');
    assert.ok(promoteRes.success);
    assert.equal(sim.staffList.find((s) => s.id === 'staff-03').role, 'manager');
    assert.equal(sim.auditLogs[0].action, 'role_change');

    // 2. Demote staff-03 back to staff
    const demoteRes = sim.changeUserRole('staff-03', 'staff');
    assert.ok(demoteRes.success);
    assert.equal(sim.staffList.find((s) => s.id === 'staff-03').role, 'staff');
  });

  it('3.2 - System SAFEGUARD: Admin cannot demote the last remaining Admin', () => {
    const sim = new RbacPosSimulator('admin');
    // staff-01 is currently the only Admin
    assert.equal(sim.staffList.filter((s) => s.role === 'admin').length, 1);

    assert.throws(() => {
      sim.changeUserRole('staff-01', 'staff');
    }, /Không thể hạ quyền tài khoản Admin cuối cùng/);
  });

  it('3.3 - System SAFEGUARD: Admin cannot delete active serving orders with cleanup tool', () => {
    const sim = new RbacPosSimulator('admin');
    const orderRes = sim.createOrder('B02');
    const activeOrderId = orderRes.order.id;

    assert.throws(() => {
      sim.archiveOrders([activeOrderId]);
    }, /Không được phép xóa đơn hàng đang phục vụ tại bàn/);

    // Active order remains unharmed
    assert.ok(sim.orders[activeOrderId]);
    assert.equal(sim.tables.find((t) => t.id === 'B02').status, 'occupied');
  });
});
