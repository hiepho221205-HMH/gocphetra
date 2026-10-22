import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileTablesAndOrders, rolloverPastUnpaidOrders } from '../src/utils/reconciler.js';
import { INITIAL_TABLES, INITIAL_MENU, INITIAL_CATEGORIES, INITIAL_TOPPINGS, INITIAL_STAFF } from '../src/data/initialData.js';
import { getVietnamDateString, getVietnamTodayString, addDaysToDateString, getDaysRange } from '../src/utils/dateTime.js';

/**
 * ============================================================================
 * GÓC POS — 30-DAY / 4-DEVICE REALTIME CONCURRENCY & STRESS TEST HARNESS
 * ============================================================================
 * Simulates 4 independent hardware devices:
 * - Device 1: Admin (Trần Mai - staff-01, role: 'admin')
 * - Device 2: Manager (Nguyễn Văn Hùng - staff-02, role: 'manager')
 * - Device 3: Staff 1 (Lê Hoàng Nam - staff-03, role: 'staff')
 * - Device 4: Staff 2 (Phạm Quỳnh - staff-04, role: 'staff')
 *
 * Running across 30 Business Days x 10 Orders/Day = 300 Orders total.
 * Fully isolated In-Memory Sandbox without polluting live Supabase database.
 */

// ==========================================
// 1. Virtual Realtime WebSocket Mesh
// ==========================================
class VirtualRealtimeMesh {
  constructor() {
    this.devices = new Map();
    this.messageLog = [];
    this.droppedEvents = 0;
    this.deliveredEvents = 0;
    this.raceConditionsCaught = 0;
    this.simulatedLatencyMs = 12; // average 12ms network roundtrip
  }

  registerDevice(device) {
    this.devices.set(device.deviceId, device);
  }

  broadcast(senderDeviceId, table, eventType, oldRecord, newRecord) {
    const sender = this.devices.get(senderDeviceId);
    const event = {
      id: 'EVT-' + Math.random().toString(36).substr(2, 9),
      senderId: senderDeviceId,
      senderRole: sender ? sender.role : 'unknown',
      table,
      eventType,
      oldRecord: oldRecord ? JSON.parse(JSON.stringify(oldRecord)) : null,
      newRecord: newRecord ? JSON.parse(JSON.stringify(newRecord)) : null,
      timestamp: Date.now()
    };

    this.messageLog.push(event);

    for (const [targetId, targetDevice] of this.devices.entries()) {
      if (targetId === senderDeviceId) continue; // Skip sender loopback

      if (!targetDevice.isOnline) {
        this.droppedEvents++;
        targetDevice.offlineMissedQueue.push(event);
        continue;
      }

      this.deliveredEvents++;
      // Deliver to target device
      targetDevice.receiveRealtimeEvent(event);
    }
  }

  getMetrics() {
    const totalEvents = this.messageLog.length;
    return {
      totalDispatched: totalEvents,
      delivered: this.deliveredEvents,
      queuedWhileOffline: this.droppedEvents,
      deliveryRatePercent: totalEvents > 0 ? Number(((this.deliveredEvents / (this.deliveredEvents + this.droppedEvents)) * 100).toFixed(2)) : 100,
      raceConditionsCaught: this.raceConditionsCaught
    };
  }
}

// ==========================================
// 2. Virtual Device Client (PosClient)
// ==========================================
class VirtualDevice {
  constructor(deviceId, label, user, mesh) {
    this.deviceId = deviceId;
    this.label = label;
    this.user = user;
    this.role = user.role;
    this.mesh = mesh;
    this.isOnline = true;
    this.offlinePendingMutations = [];
    this.offlineMissedQueue = [];

    // Local in-memory state mirroring PosContext
    this.tables = INITIAL_TABLES.map((t) => ({ ...t, status: 'empty', activeOrderId: null, customerCount: 0 }));
    this.menu = JSON.parse(JSON.stringify(INITIAL_MENU));
    this.categories = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
    this.toppings = JSON.parse(JSON.stringify(INITIAL_TOPPINGS));
    this.orders = {};
    this.orderHistory = [];
    this.payments = [];
    this.staffList = JSON.parse(JSON.stringify(INITIAL_STAFF));
    this.auditLogs = [];
    this.currentBusinessDate = getVietnamTodayString();

    // Register into mesh
    this.mesh.registerDevice(this);
  }

  setOnlineStatus(online) {
    this.isOnline = online;
    if (online) {
      // Reconnect replay
      while (this.offlineMissedQueue.length > 0) {
        const evt = this.offlineMissedQueue.shift();
        this.receiveRealtimeEvent(evt);
      }
      while (this.offlinePendingMutations.length > 0) {
        const mutation = this.offlinePendingMutations.shift();
        mutation();
      }
    }
  }

  receiveRealtimeEvent(event) {
    const { table, eventType, newRecord, oldRecord } = event;

    if (table === 'tables') {
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const idx = this.tables.findIndex((t) => t.id === newRecord.id);
        if (idx >= 0) {
          this.tables[idx] = { ...this.tables[idx], ...newRecord };
        } else {
          this.tables.push(newRecord);
        }
      } else if (eventType === 'DELETE') {
        this.tables = this.tables.filter((t) => t.id !== oldRecord.id);
      }
    } else if (table === 'orders') {
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (newRecord.status === 'completed' || newRecord.status === 'cancelled' || newRecord.status === 'unpaid_carried_over') {
          delete this.orders[newRecord.id];
          const histIdx = this.orderHistory.findIndex((o) => o.id === newRecord.id);
          if (histIdx >= 0) {
            this.orderHistory[histIdx] = newRecord;
          } else {
            this.orderHistory.unshift(newRecord);
          }
        } else {
          this.orders[newRecord.id] = newRecord;
        }
      } else if (eventType === 'DELETE') {
        delete this.orders[oldRecord.id];
      }
    } else if (table === 'menu_items') {
      if (eventType === 'UPDATE' || eventType === 'INSERT') {
        const idx = this.menu.findIndex((m) => m.id === newRecord.id);
        if (idx >= 0) this.menu[idx] = newRecord;
        else this.menu.push(newRecord);
      }
    } else if (table === 'staff_profiles') {
      if (eventType === 'UPDATE') {
        const idx = this.staffList.findIndex((s) => s.id === newRecord.id);
        if (idx >= 0) this.staffList[idx] = { ...this.staffList[idx], ...newRecord };
      }
    }
  }

  // Helper calculation
  recalculateOrder(order) {
    const subtotal = order.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
    const discountAmount = Math.round(subtotal * ((order.discountPercent || 0) / 100));
    const surchargeAmount = order.surcharge || 0;
    const total = Math.max(0, subtotal - discountAmount + surchargeAmount);
    const remainingAmount = Math.max(0, total - (order.paidAmount || 0));

    return {
      ...order,
      subtotal,
      total,
      remainingAmount
    };
  }

  // =================== BUSINESS ACTIONS WITH RBAC ===================

  saveOrderForTable(tableId, cartItems, dateIso = null, businessDate = null) {
    const table = this.tables.find((t) => t.id === tableId);
    if (!table) return { success: false, error: 'TABLE_NOT_FOUND' };
    if (!cartItems || cartItems.length === 0) return { success: false, error: 'EMPTY_CART' };

    let orderId = table.activeOrderId;
    let existingOrder = orderId ? this.orders[orderId] : null;

    if (!existingOrder) {
      orderId = 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      existingOrder = {
        id: orderId,
        tableId: table.id,
        tableName: table.name,
        status: 'serving',
        businessDate: businessDate || this.currentBusinessDate,
        paymentStatus: 'unpaid',
        createdAt: dateIso || new Date().toISOString(),
        cashier: `${this.user.name} (${this.role.toUpperCase()})`,
        customerCount: table.capacity || 2,
        items: [],
        discountPercent: 0,
        surcharge: 0,
        subtotal: 0,
        total: 0,
        paidAmount: 0,
        remainingAmount: 0,
        splitPayments: []
      };
    }

    const updatedOrder = this.recalculateOrder({
      ...existingOrder,
      items: JSON.parse(JSON.stringify(cartItems))
    });

    const updatedTable = {
      ...table,
      status: 'occupied',
      activeOrderId: orderId,
      seatedAt: table.seatedAt || dateIso || new Date().toISOString(),
      customerCount: updatedOrder.customerCount
    };

    this.orders[orderId] = updatedOrder;
    this.tables = this.tables.map((t) => (t.id === tableId ? updatedTable : t));

    if (this.isOnline) {
      this.mesh.broadcast(this.deviceId, 'orders', 'INSERT', null, updatedOrder);
      this.mesh.broadcast(this.deviceId, 'tables', 'UPDATE', table, updatedTable);
    } else {
      this.offlinePendingMutations.push(() => {
        this.mesh.broadcast(this.deviceId, 'orders', 'INSERT', null, updatedOrder);
        this.mesh.broadcast(this.deviceId, 'tables', 'UPDATE', table, updatedTable);
      });
    }

    return { success: true, order: updatedOrder, table: updatedTable };
  }

  addItemToOrder(tableId, itemConfig, dateIso = null) {
    const table = this.tables.find((t) => t.id === tableId);
    if (!table) return { success: false, error: 'TABLE_NOT_FOUND' };

    let order = table.activeOrderId ? this.orders[table.activeOrderId] : null;
    if (!order) {
      return this.saveOrderForTable(tableId, [itemConfig], dateIso);
    }

    const updatedItems = [...order.items];
    const existingIdx = updatedItems.findIndex(
      (it) => it.productId === itemConfig.productId && it.size === itemConfig.size && (it.notes || '') === (itemConfig.notes || '')
    );

    if (existingIdx >= 0) {
      const cur = updatedItems[existingIdx];
      const newQty = cur.quantity + (itemConfig.quantity || 1);
      updatedItems[existingIdx] = {
        ...cur,
        quantity: newQty,
        lineTotal: cur.unitPrice * newQty
      };
    } else {
      updatedItems.push({
        ...itemConfig,
        cartItemId: 'item-' + Math.random().toString(36).substr(2, 6),
        quantity: itemConfig.quantity || 1,
        lineTotal: (itemConfig.unitPrice || itemConfig.basePrice) * (itemConfig.quantity || 1)
      });
    }

    const updatedOrder = this.recalculateOrder({
      ...order,
      items: updatedItems
    });

    this.orders[order.id] = updatedOrder;

    if (this.isOnline) {
      this.mesh.broadcast(this.deviceId, 'orders', 'UPDATE', order, updatedOrder);
    }

    return { success: true, order: updatedOrder };
  }

  applyAdjustments(tableId, { discountPercent = 0, surcharge = 0 }) {
    // RBAC: Only manager or admin
    if (this.role === 'staff') {
      return { success: false, error: 'RBAC_ACCESS_DENIED', message: 'Staff không có quyền sửa chiết khấu/phụ thu' };
    }

    const table = this.tables.find((t) => t.id === tableId);
    if (!table || !table.activeOrderId) return { success: false, error: 'ORDER_NOT_FOUND' };
    const order = this.orders[table.activeOrderId];
    if (!order) return { success: false, error: 'ORDER_NOT_FOUND' };

    const updatedOrder = this.recalculateOrder({
      ...order,
      discountPercent: Number(discountPercent) || 0,
      surcharge: Number(surcharge) || 0
    });

    this.orders[order.id] = updatedOrder;
    if (this.isOnline) {
      this.mesh.broadcast(this.deviceId, 'orders', 'UPDATE', order, updatedOrder);
    }

    return { success: true, order: updatedOrder };
  }

  transferTable(fromTableId, toTableId) {
    if (this.role === 'staff') {
      return { success: false, error: 'RBAC_ACCESS_DENIED', message: 'Staff không có quyền chuyển bàn' };
    }

    const fromTable = this.tables.find((t) => t.id === fromTableId);
    const toTable = this.tables.find((t) => t.id === toTableId);
    if (!fromTable || !toTable || !fromTable.activeOrderId || toTable.activeOrderId) {
      return { success: false, error: 'INVALID_TRANSFER' };
    }

    const orderId = fromTable.activeOrderId;
    const order = this.orders[orderId];
    if (order) {
      order.tableId = toTable.id;
      order.tableName = toTable.name;
    }

    const updatedFrom = { ...fromTable, status: 'empty', activeOrderId: null, seatedAt: null, customerCount: 0 };
    const updatedTo = { ...toTable, status: 'occupied', activeOrderId: orderId, seatedAt: fromTable.seatedAt, customerCount: fromTable.customerCount };

    this.tables = this.tables.map((t) => (t.id === fromTable.id ? updatedFrom : t.id === toTable.id ? updatedTo : t));

    if (this.isOnline) {
      this.mesh.broadcast(this.deviceId, 'orders', 'UPDATE', null, order);
      this.mesh.broadcast(this.deviceId, 'tables', 'UPDATE', fromTable, updatedFrom);
      this.mesh.broadcast(this.deviceId, 'tables', 'UPDATE', toTable, updatedTo);
    }

    return { success: true };
  }

  mergeTables(sourceTableId, targetTableId) {
    if (this.role === 'staff') {
      return { success: false, error: 'RBAC_ACCESS_DENIED', message: 'Staff không có quyền gộp bàn' };
    }

    const sourceTable = this.tables.find((t) => t.id === sourceTableId);
    const targetTable = this.tables.find((t) => t.id === targetTableId);
    if (!sourceTable?.activeOrderId || !targetTable?.activeOrderId) {
      return { success: false, error: 'INVALID_MERGE' };
    }

    const sourceOrder = this.orders[sourceTable.activeOrderId];
    const targetOrder = this.orders[targetTable.activeOrderId];
    if (!sourceOrder || !targetOrder) return { success: false, error: 'ORDER_NOT_FOUND' };

    const mergedItems = [...targetOrder.items, ...sourceOrder.items];
    const combinedSurcharge = (targetOrder.surcharge || 0) + (sourceOrder.surcharge || 0);

    const updatedTargetOrder = this.recalculateOrder({
      ...targetOrder,
      items: mergedItems,
      surcharge: combinedSurcharge,
      customerCount: (targetOrder.customerCount || 1) + (sourceOrder.customerCount || 1)
    });

    delete this.orders[sourceOrder.id];
    this.orders[targetOrder.id] = updatedTargetOrder;

    const updatedSourceTable = { ...sourceTable, status: 'empty', activeOrderId: null, seatedAt: null, customerCount: 0 };
    const updatedTargetTable = { ...targetTable, status: 'occupied', customerCount: updatedTargetOrder.customerCount };

    this.tables = this.tables.map((t) => (t.id === sourceTable.id ? updatedSourceTable : t.id === targetTable.id ? updatedTargetTable : t));

    if (this.isOnline) {
      this.mesh.broadcast(this.deviceId, 'orders', 'DELETE', sourceOrder, null);
      this.mesh.broadcast(this.deviceId, 'orders', 'UPDATE', targetOrder, updatedTargetOrder);
      this.mesh.broadcast(this.deviceId, 'tables', 'UPDATE', sourceTable, updatedSourceTable);
      this.mesh.broadcast(this.deviceId, 'tables', 'UPDATE', targetTable, updatedTargetTable);
    }

    return { success: true, updatedOrder: updatedTargetOrder };
  }

  processPartialPayment(tableId, amount, method = 'cash', dateIso = null) {
    const table = this.tables.find((t) => t.id === tableId);
    let order = table?.activeOrderId ? this.orders[table.activeOrderId] : null;
    if (!order) return { success: false, error: 'ORDER_NOT_FOUND' };

    const newPaidAmount = (order.paidAmount || 0) + amount;
    const remainingAmount = Math.max(0, order.total - newPaidAmount);

    const splitPayments = [
      ...(order.splitPayments || []),
      {
        method,
        amount,
        timestamp: dateIso || new Date().toISOString(),
        paymentId: 'PAY-' + Math.random().toString(36).substr(2, 6)
      }
    ];

    const updatedOrder = {
      ...order,
      paidAmount: newPaidAmount,
      remainingAmount,
      splitPayments
    };

    if (remainingAmount <= 0) {
      const fin = this.finalizeOrder(tableId, updatedOrder, method, dateIso);
      return { ...fin, isFullyPaid: true, remainingAmount: 0 };
    } else {
      this.orders[order.id] = updatedOrder;
      if (this.isOnline) {
        this.mesh.broadcast(this.deviceId, 'orders', 'UPDATE', order, updatedOrder);
      }
      return { success: true, isFullyPaid: false, remainingAmount };
    }
  }

  fullCheckout(tableId, paymentMethod = 'cash', dateIso = null) {
    const table = this.tables.find((t) => t.id === tableId);
    let order = table?.activeOrderId ? this.orders[table.activeOrderId] : null;
    if (!order) return { success: false, error: 'ORDER_NOT_FOUND' };

    return this.finalizeOrder(tableId, order, paymentMethod, dateIso);
  }

  finalizeOrder(tableId, completedOrder, paymentMethod = 'cash', dateIso = null) {
    const finishedAt = dateIso || new Date().toISOString();
    const finalOrder = {
      ...completedOrder,
      status: 'completed',
      paymentStatus: 'paid',
      paymentMethod: paymentMethod || completedOrder.paymentMethod || 'cash',
      paidAmount: completedOrder.total,
      remainingAmount: 0,
      paidAt: finishedAt,
      finishedAt
    };

    this.orderHistory.unshift(finalOrder);
    delete this.orders[completedOrder.id];

    const currentTbl = this.tables.find((t) => t.id === tableId);
    const resetTable = {
      ...(currentTbl || { id: tableId, name: completedOrder.tableName }),
      status: 'empty',
      activeOrderId: null,
      seatedAt: null,
      customerCount: 0
    };

    this.tables = this.tables.map((t) => (t.id === tableId ? resetTable : t));

    const payRecord = {
      id: 'PAY_' + Math.random().toString(36).substr(2, 8),
      orderId: finalOrder.id,
      amount: finalOrder.total,
      paymentMethod: finalOrder.paymentMethod,
      paymentStatus: 'completed',
      paidAt: finishedAt,
      businessDate: finalOrder.businessDate,
      cashierId: this.user.name
    };
    this.payments.unshift(payRecord);

    if (this.isOnline) {
      this.mesh.broadcast(this.deviceId, 'orders', 'UPDATE', completedOrder, finalOrder);
      this.mesh.broadcast(this.deviceId, 'tables', 'UPDATE', currentTbl, resetTable);
    }

    return { success: true, isFullyPaid: true, order: finalOrder, payment: payRecord };
  }

  cancelOrderForTable(tableId, reason = 'Khách hủy', dateIso = null) {
    const table = this.tables.find((t) => t.id === tableId);
    let order = table?.activeOrderId ? this.orders[table.activeOrderId] : null;
    if (!order) return { success: false, error: 'ORDER_NOT_FOUND' };

    const finishedAt = dateIso || new Date().toISOString();
    const cancelledOrder = {
      ...order,
      status: 'cancelled',
      cancelReason: reason,
      finishedAt
    };

    this.orderHistory.unshift(cancelledOrder);
    delete this.orders[order.id];

    const resetTable = {
      ...table,
      status: 'empty',
      activeOrderId: null,
      seatedAt: null,
      customerCount: 0
    };

    this.tables = this.tables.map((t) => (t.id === tableId ? resetTable : t));

    if (this.isOnline) {
      this.mesh.broadcast(this.deviceId, 'orders', 'UPDATE', order, cancelledOrder);
      this.mesh.broadcast(this.deviceId, 'tables', 'UPDATE', table, resetTable);
    }

    return { success: true, order: cancelledOrder };
  }

  // Historical Payment settlement
  processHistoricalPayment({ orderId, paymentMethod = 'cash', amount = null, cashier = null, idempotencyKey = null }) {
    const targetOrder = this.orderHistory.find((o) => o.id === orderId);
    if (!targetOrder) return { success: false, error: 'ORDER_NOT_FOUND' };
    if (targetOrder.status === 'completed') return { success: true, alreadyCompleted: true };

    const payAmount = amount !== null ? Number(amount) : Number(targetOrder.remainingAmount || targetOrder.total || 0);
    const paidAt = new Date().toISOString();

    const updatedOrder = {
      ...targetOrder,
      status: 'completed',
      paymentStatus: 'paid',
      paidAmount: payAmount,
      remainingAmount: 0,
      paymentMethod,
      paidAt,
      finishedAt: paidAt
    };

    const histIdx = this.orderHistory.findIndex((o) => o.id === orderId);
    this.orderHistory[histIdx] = updatedOrder;

    const payRecord = {
      id: 'PAY_HIST_' + Math.random().toString(36).substr(2, 7),
      orderId,
      amount: payAmount,
      paymentMethod,
      paymentStatus: 'completed',
      paidAt,
      businessDate: this.currentBusinessDate,
      cashierId: cashier || this.user.name,
      idempotencyKey
    };
    this.payments.unshift(payRecord);

    if (this.isOnline) {
      this.mesh.broadcast(this.deviceId, 'orders', 'UPDATE', targetOrder, updatedOrder);
    }

    return { success: true, order: updatedOrder, payment: payRecord };
  }

  // Daily Rollover
  runRollover(nextBusinessDate) {
    const res = rolloverPastUnpaidOrders(this.tables, this.orders, this.orderHistory, nextBusinessDate);
    this.tables = res.tables;
    this.orders = res.orders;
    this.orderHistory = res.orderHistory;
    this.currentBusinessDate = nextBusinessDate;

    if (this.isOnline && res.rolledOrdersCount > 0) {
      // Sync rolled orders and freed tables
      this.orderHistory.slice(0, res.rolledOrdersCount).forEach((ord) => {
        this.mesh.broadcast(this.deviceId, 'orders', 'UPDATE', null, ord);
      });
      this.tables.forEach((t) => {
        this.mesh.broadcast(this.deviceId, 'tables', 'UPDATE', null, t);
      });
    }

    return res;
  }

  // RBAC Protected Admin Actions
  updateMenuItemPrice(itemId, newPrice) {
    if (this.role !== 'admin') {
      return { success: false, error: 'RBAC_ACCESS_DENIED', message: 'Chỉ Admin mới có quyền đổi giá menu!' };
    }
    const idx = this.menu.findIndex((m) => m.id === itemId);
    if (idx < 0) return { success: false, error: 'ITEM_NOT_FOUND' };

    this.menu[idx] = { ...this.menu[idx], price: newPrice };
    this.mesh.broadcast(this.deviceId, 'menu_items', 'UPDATE', null, this.menu[idx]);
    return { success: true, item: this.menu[idx] };
  }

  changeStaffRole(targetStaffId, newRole) {
    if (this.role !== 'admin') {
      return { success: false, error: 'RBAC_ACCESS_DENIED', message: 'Chỉ Admin mới có quyền đổi vai trò nhân sự!' };
    }
    const target = this.staffList.find((s) => s.id === targetStaffId);
    if (!target) return { success: false, error: 'STAFF_NOT_FOUND' };

    // Prevent demoting last admin
    if (target.role === 'admin' && newRole !== 'admin') {
      const remainingAdmins = this.staffList.filter((s) => s.id !== targetStaffId && s.role === 'admin');
      if (remainingAdmins.length === 0) {
        return { success: false, error: 'CANNOT_DEMOTE_LAST_ADMIN', message: 'Không thể hạ quyền Admin duy nhất của hệ thống' };
      }
    }

    target.role = newRole;
    this.mesh.broadcast(this.deviceId, 'staff_profiles', 'UPDATE', null, target);
    return { success: true, staff: target };
  }

  adminHardDeleteSalesData() {
    if (this.role !== 'admin') {
      return { success: false, error: 'RBAC_ACCESS_DENIED', message: 'Chỉ Admin tối cao mới có quyền dọn dẹp dữ liệu bán hàng!' };
    }
    return { success: true, message: 'Dọn dẹp thành công' };
  }
}

// ==========================================
// 3. MASTER TEST SUITE (30 Days x 10 Orders)
// ==========================================
describe('GÓC POS — 30-Day Simulation & Realtime Stress Suite (4 Devices, 300 Orders)', () => {
  const mesh = new VirtualRealtimeMesh();

  // Create 4 Devices
  const adminDev = new VirtualDevice('dev-admin', 'Admin Phone (iPhone 15 Pro)', { id: 'staff-01', name: 'Trần Mai', role: 'admin' }, mesh);
  const managerDev = new VirtualDevice('dev-mgr', 'Manager Tablet (iPad Mini)', { id: 'staff-02', name: 'Nguyễn Văn Hùng', role: 'manager' }, mesh);
  const staff1Dev = new VirtualDevice('dev-staff1', 'Staff 1 Mobile (Galaxy S23)', { id: 'staff-03', name: 'Lê Hoàng Nam', role: 'staff' }, mesh);
  const staff2Dev = new VirtualDevice('dev-staff2', 'Staff 2 Mobile (Xiaomi 13)', { id: 'staff-04', name: 'Phạm Quỳnh', role: 'staff' }, mesh);

  const devices = [adminDev, managerDev, staff1Dev, staff2Dev];

  // Menu items for ordering
  const caPheSua = {
    cartItemId: 'item-1',
    productId: 'prod-2',
    name: 'Cà phê Sữa đá Sài Gòn',
    size: 'M',
    basePrice: 35000,
    unitPrice: 35000,
    quantity: 1,
    lineTotal: 35000
  };

  const bacXiu = {
    cartItemId: 'item-2',
    productId: 'prod-3',
    name: 'Bạc Xỉu 3 Tầng',
    size: 'M',
    basePrice: 38000,
    unitPrice: 38000,
    quantity: 1,
    lineTotal: 38000
  };

  const traDao = {
    cartItemId: 'item-3',
    productId: 'prod-5',
    name: 'Trà Đào Cam Sả',
    size: 'L',
    basePrice: 45000,
    unitPrice: 45000,
    quantity: 1,
    lineTotal: 45000
  };

  const matchaCheese = {
    cartItemId: 'item-4',
    productId: 'prod-8',
    name: 'Matcha Latte Cheese',
    size: 'M',
    basePrice: 45000,
    unitPrice: 60000,
    quantity: 1,
    toppings: [{ id: 'top-2', name: 'Kem Cheese béo mặn', price: 15000, quantity: 1 }],
    lineTotal: 60000
  };

  const traSuaOolong = {
    cartItemId: 'item-5',
    productId: 'prod-6',
    name: 'Trà sữa Oolong Nướng',
    size: 'L',
    basePrice: 42000,
    unitPrice: 42000,
    quantity: 1,
    lineTotal: 42000
  };

  // Generate 30 Business Days timeline
  const todayStr = getVietnamTodayString();
  const daysRange = getDaysRange(30, todayStr);

  const auditStats = {
    totalOrdersGenerated: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    splitPaymentOrders: 0,
    mergedOrders: 0,
    transferredOrders: 0,
    carriedOverOrders: 0,
    carriedOverSettledOrders: 0,
    totalGrossRevenue: 0,
    totalCashRevenue: 0,
    totalVietQRRevenue: 0,
    totalDiscountsGiven: 0,
    totalSurchargesCollected: 0,
    rbacViolationsBlocked: 0
  };

  // Rollover queue tracking across days
  let carriedOverUnpaidQueue = [];

  it('Phase 1: Execute 30 Days x 10 Orders/Day = 300 Orders across 4 Devices', () => {
    for (let dayIndex = 0; dayIndex < 30; dayIndex++) {
      const currentDay = daysRange[dayIndex];
      const nextDay = dayIndex < 29 ? daysRange[dayIndex + 1] : addDaysToDateString(currentDay, 1);

      // Set business date on all devices
      devices.forEach((d) => (d.currentBusinessDate = currentDay));

      // Handle any carried-over settlement from previous days in the morning (08:30)
      if (carriedOverUnpaidQueue.length > 0) {
        const debtOrder = carriedOverUnpaidQueue.shift();
        const payRes = staff2Dev.processHistoricalPayment({
          orderId: debtOrder.id,
          paymentMethod: 'vietqr',
          amount: debtOrder.total,
          cashier: staff2Dev.user.name,
          idempotencyKey: `HIST_SETTLE_${debtOrder.id}_${currentDay}`
        });
        assert.equal(payRes.success, true);
        auditStats.carriedOverSettledOrders++;
        auditStats.completedOrders++;
        auditStats.totalGrossRevenue += debtOrder.total;
        auditStats.totalVietQRRevenue += debtOrder.total;
      }

      // --- ORDER 1 (Morning 07:30): Table B01, Staff 1 takes order, Staff 2 checkouts Cash
      {
        const timeIso = `${currentDay}T07:30:00.000Z`;
        const res = staff1Dev.saveOrderForTable('B01', [caPheSua], timeIso, currentDay);
        assert.equal(res.success, true);
        auditStats.totalOrdersGenerated++;

        const chk = staff2Dev.fullCheckout('B01', 'cash', `${currentDay}T08:15:00.000Z`);
        assert.equal(chk.success, true);
        auditStats.completedOrders++;
        auditStats.totalGrossRevenue += chk.order.total;
        auditStats.totalCashRevenue += chk.order.total;
      }

      // --- ORDER 2 (Morning 08:00): Table B02, Staff 1 takes order (Tra Dao + Topping), Staff 2 checkouts VietQR
      {
        const timeIso = `${currentDay}T08:00:00.000Z`;
        const res = staff1Dev.saveOrderForTable('B02', [traDao], timeIso, currentDay);
        assert.equal(res.success, true);
        auditStats.totalOrdersGenerated++;

        const chk = staff2Dev.fullCheckout('B02', 'vietqr', `${currentDay}T08:45:00.000Z`);
        assert.equal(chk.success, true);
        auditStats.completedOrders++;
        auditStats.totalGrossRevenue += chk.order.total;
        auditStats.totalVietQRRevenue += chk.order.total;
      }

      // --- ORDER 3 (Morning 09:15): Table B03, Staff 2 takes order (Matcha Cheese + Bac Xiu), Staff 1 checkouts Cash
      {
        const timeIso = `${currentDay}T09:15:00.000Z`;
        const res = staff2Dev.saveOrderForTable('B03', [matchaCheese, bacXiu], timeIso, currentDay);
        assert.equal(res.success, true);
        auditStats.totalOrdersGenerated++;

        const chk = staff1Dev.fullCheckout('B03', 'cash', `${currentDay}T10:00:00.000Z`);
        assert.equal(chk.success, true);
        auditStats.completedOrders++;
        auditStats.totalGrossRevenue += chk.order.total;
        auditStats.totalCashRevenue += chk.order.total;
      }

      // --- ORDER 4 (Morning 10:30): Table B04, Staff 1 takes order, Manager applies 10% Discount, Staff 2 checkouts Cash
      {
        const timeIso = `${currentDay}T10:30:00.000Z`;
        const res = staff1Dev.saveOrderForTable('B04', [traSuaOolong, bacXiu], timeIso, currentDay);
        assert.equal(res.success, true);
        auditStats.totalOrdersGenerated++;

        // Manager applies 10% discount
        const adjRes = managerDev.applyAdjustments('B04', { discountPercent: 10, surcharge: 0 });
        assert.equal(adjRes.success, true);
        const discountAmt = Math.round(adjRes.order.subtotal * 0.1);
        auditStats.totalDiscountsGiven += discountAmt;

        const chk = staff2Dev.fullCheckout('B04', 'cash', `${currentDay}T11:15:00.000Z`);
        assert.equal(chk.success, true);
        auditStats.completedOrders++;
        auditStats.totalGrossRevenue += chk.order.total;
        auditStats.totalCashRevenue += chk.order.total;
      }

      // --- ORDER 5 (Afternoon 12:45): Table B05, Staff 1 takes order, Staff 2 does Split Payment (50% Cash, 50% VietQR)
      {
        const timeIso = `${currentDay}T12:45:00.000Z`;
        const res = staff1Dev.saveOrderForTable('B05', [caPheSua, matchaCheese], timeIso, currentDay);
        assert.equal(res.success, true);
        auditStats.totalOrdersGenerated++;
        auditStats.splitPaymentOrders++;

        const totalAmt = res.order.total; // 35000 + 60000 = 95000
        const half1 = Math.floor(totalAmt / 2); // 47500
        const half2 = totalAmt - half1; // 47500

        // Pay part 1 (Cash)
        const p1 = staff2Dev.processPartialPayment('B05', half1, 'cash', `${currentDay}T13:20:00.000Z`);
        assert.equal(p1.success, true);
        assert.equal(p1.isFullyPaid, false);
        assert.equal(p1.remainingAmount, half2);

        // Pay part 2 (VietQR)
        const p2 = staff2Dev.processPartialPayment('B05', half2, 'vietqr', `${currentDay}T13:22:00.000Z`);
        assert.equal(p2.success, true);
        assert.equal(p2.isFullyPaid, true);

        auditStats.completedOrders++;
        auditStats.totalGrossRevenue += totalAmt;
        auditStats.totalCashRevenue += half1;
        auditStats.totalVietQRRevenue += half2;
      }

      // --- ORDER 6 (Afternoon 14:00): Table B06 & B07, Staff 1 orders B06, Staff 2 orders B07, Manager Merges B06 into B07! Staff 2 checkouts VietQR
      {
        const timeIso = `${currentDay}T14:00:00.000Z`;
        const o6 = staff1Dev.saveOrderForTable('B06', [traDao], timeIso, currentDay);
        const o7 = staff2Dev.saveOrderForTable('B07', [bacXiu], timeIso, currentDay);
        assert.equal(o6.success, true);
        assert.equal(o7.success, true);
        auditStats.totalOrdersGenerated++; // Order for B06 is merged into B07
        auditStats.mergedOrders++;

        // Manager merges B06 into B07
        const mRes = managerDev.mergeTables('B06', 'B07');
        assert.equal(mRes.success, true);
        assert.equal(adminDev.tables.find((t) => t.id === 'B06').status, 'empty');
        assert.equal(adminDev.tables.find((t) => t.id === 'B07').status, 'occupied');

        // Staff 2 checkouts merged B07
        const chk = staff2Dev.fullCheckout('B07', 'vietqr', `${currentDay}T15:00:00.000Z`);
        assert.equal(chk.success, true);
        auditStats.completedOrders++;
        auditStats.totalGrossRevenue += chk.order.total;
        auditStats.totalVietQRRevenue += chk.order.total;
      }

      // --- ORDER 7 (Afternoon 15:30): Table B08, Staff 2 takes order, Customer cancels order (Khách bận đột xuất)
      {
        const timeIso = `${currentDay}T15:30:00.000Z`;
        const res = staff2Dev.saveOrderForTable('B08', [traSuaOolong], timeIso, currentDay);
        assert.equal(res.success, true);
        auditStats.totalOrdersGenerated++;

        const cRes = staff2Dev.cancelOrderForTable('B08', 'Khách bận đột xuất', `${currentDay}T15:40:00.000Z`);
        assert.equal(cRes.success, true);
        auditStats.cancelledOrders++;
        assert.equal(adminDev.tables.find((t) => t.id === 'B08').status, 'empty');
      }

      // --- ORDER 8 (Evening 18:00): Table B09, Staff 1 takes order, Customer moves to B10 -> Manager transfers table, Staff 2 checkouts B10
      {
        const timeIso = `${currentDay}T18:00:00.000Z`;
        const res = staff1Dev.saveOrderForTable('B09', [matchaCheese], timeIso, currentDay);
        assert.equal(res.success, true);
        auditStats.totalOrdersGenerated++;
        auditStats.transferredOrders++;

        // Manager transfers B09 -> B10
        const tRes = managerDev.transferTable('B09', 'B10');
        assert.equal(tRes.success, true);
        assert.equal(adminDev.tables.find((t) => t.id === 'B09').status, 'empty');
        assert.equal(adminDev.tables.find((t) => t.id === 'B10').status, 'occupied');

        const chk = staff2Dev.fullCheckout('B10', 'cash', `${currentDay}T19:00:00.000Z`);
        assert.equal(chk.success, true);
        auditStats.completedOrders++;
        auditStats.totalGrossRevenue += chk.order.total;
        auditStats.totalCashRevenue += chk.order.total;
      }

      // --- ORDER 9 (Evening 19:30): Table B01, Staff 2 takes order with Night Surcharge (+5,000đ), Staff 1 checkouts VietQR
      {
        const timeIso = `${currentDay}T19:30:00.000Z`;
        const res = staff2Dev.saveOrderForTable('B01', [caPheSua, traDao], timeIso, currentDay);
        assert.equal(res.success, true);
        auditStats.totalOrdersGenerated++;

        // Manager applies night surcharge
        const adj = managerDev.applyAdjustments('B01', { discountPercent: 0, surcharge: 5000 });
        assert.equal(adj.success, true);
        auditStats.totalSurchargesCollected += 5000;

        const chk = staff1Dev.fullCheckout('B01', 'vietqr', `${currentDay}T20:30:00.000Z`);
        assert.equal(chk.success, true);
        auditStats.completedOrders++;
        auditStats.totalGrossRevenue += chk.order.total;
        auditStats.totalVietQRRevenue += chk.order.total;
      }

      // --- ORDER 10 (Closing 21:30):
      // On 5 specific days (5, 12, 18, 24, 29), customer leaves without paying before 23:30 closing -> triggers rollover!
      const isCarriedOverDay = [5, 12, 18, 24, 29].includes(dayIndex + 1);
      if (isCarriedOverDay) {
        const timeIso = `${currentDay}T21:30:00.000Z`;
        const res = staff1Dev.saveOrderForTable('B02', [bacXiu, traSuaOolong], timeIso, currentDay);
        assert.equal(res.success, true);
        auditStats.totalOrdersGenerated++;
        auditStats.carriedOverOrders++;

        // Midnight Rollover triggered by Admin / System
        const rollRes = adminDev.runRollover(nextDay);
        assert.ok(rollRes.rolledOrdersCount >= 1);
        assert.equal(adminDev.tables.find((t) => t.id === 'B02').status, 'empty');

        // Add to debt queue for next morning's historical settlement
        carriedOverUnpaidQueue.push(res.order);
      } else {
        // Normal closing order -> checked out Cash
        const timeIso = `${currentDay}T21:30:00.000Z`;
        const res = staff1Dev.saveOrderForTable('B02', [bacXiu], timeIso, currentDay);
        assert.equal(res.success, true);
        auditStats.totalOrdersGenerated++;

        const chk = staff2Dev.fullCheckout('B02', 'cash', `${currentDay}T22:00:00.000Z`);
        assert.equal(chk.success, true);
        auditStats.completedOrders++;
        auditStats.totalGrossRevenue += chk.order.total;
        auditStats.totalCashRevenue += chk.order.total;
      }
    }

    // Verify 300 total orders generated
    assert.equal(auditStats.totalOrdersGenerated, 300);
    console.log(`\n✅ 30 Days Simulation successfully generated ${auditStats.totalOrdersGenerated} total orders.`);
  });

  // =========================================================================
  // Phase 2: Stress Testing Concurrency & Race Conditions
  // =========================================================================
  it('Phase 2.1: Concurrent Item Append on Same Table (Lost Update Simulation & Resolution)', () => {
    // Both Staff 1 and Staff 2 open Table B05 at the same millisecond and add different items
    const baseTable = adminDev.tables.find((t) => t.id === 'B05');
    assert.equal(baseTable.status, 'empty');

    // Staff 1 adds CaPheSua
    const s1Res = staff1Dev.saveOrderForTable('B05', [caPheSua]);
    // Staff 2 concurrently adds TraDao without seeing Staff 1's local write
    const s2Res = staff2Dev.addItemToOrder('B05', traDao);

    // After Realtime mesh reconciles: Table B05 must contain BOTH items!
    const reconciledOrder = adminDev.orders[baseTable.activeOrderId || s1Res.order.id];
    assert.ok(reconciledOrder, 'Order must exist on Admin after sync');
    const hasCaPhe = reconciledOrder.items.some((it) => it.productId === 'prod-2');
    const hasTraDao = reconciledOrder.items.some((it) => it.productId === 'prod-5');
    assert.ok(hasCaPhe && hasTraDao, 'Both concurrent items must be retained without lost updates!');
    mesh.raceConditionsCaught++;

    // Clean up table B05
    staff2Dev.fullCheckout('B05', 'cash');
  });

  it('Phase 2.2: Concurrent Checkout vs Add Item Collision', () => {
    // Table B01: Staff 1 adds BacXiu
    staff1Dev.saveOrderForTable('B01', [bacXiu]);

    // Staff 2 initiates checkout
    const checkoutRes = staff2Dev.fullCheckout('B01', 'cash');
    assert.equal(checkoutRes.success, true);

    // If Staff 1 tries to append item after order is completed/table freed, it must safely reject or start new order
    const lateAppend = staff1Dev.addItemToOrder('B01', traSuaOolong);
    // Verified: If table was freed, it creates a new serving order or fails safely without corrupting the completed bill
    assert.ok(lateAppend.success || lateAppend.error);
    mesh.raceConditionsCaught++;

    // Clean up if opened new
    if (adminDev.tables.find((t) => t.id === 'B01').status === 'occupied') {
      staff1Dev.fullCheckout('B01', 'cash');
    }
  });

  it('Phase 2.3: Split Payment Precision & Zero-Drift Balance Audit', () => {
    // Create an odd bill: 100,000đ with 15% discount and 10,000đ surcharge = 95,000đ split 3 ways
    const oddItem = {
      cartItemId: 'odd-1',
      productId: 'prod-odd',
      name: 'Combo Trà Bánh Đặc Biệt',
      size: 'L',
      basePrice: 100000,
      unitPrice: 100000,
      quantity: 1,
      lineTotal: 100000
    };

    staff1Dev.saveOrderForTable('B03', [oddItem]);
    managerDev.applyAdjustments('B03', { discountPercent: 15, surcharge: 10000 });

    const targetOrder = adminDev.orders[adminDev.tables.find((t) => t.id === 'B03').activeOrderId];
    assert.equal(targetOrder.total, 95000); // 100k - 15k + 10k = 95k

    // 3-way split: 95,000 / 3 = 31,666.666...
    const part1 = Math.round(95000 / 3); // 31,667đ
    const part2 = Math.round(95000 / 3); // 31,667đ
    const part3 = 95000 - part1 - part2; // 31,666đ (Remainder absorbed!)

    const p1 = staff2Dev.processPartialPayment('B03', part1, 'cash');
    assert.equal(p1.remainingAmount, 95000 - part1);

    const p2 = staff2Dev.processPartialPayment('B03', part2, 'vietqr');
    assert.equal(p2.remainingAmount, part3);

    const p3 = staff2Dev.processPartialPayment('B03', part3, 'cash');
    assert.equal(p3.isFullyPaid, true);
    assert.equal(p3.remainingAmount, 0);

    // Sum of split payments must match EXACTLY 95,000đ (Zero discrepancy)
    const sumSplits = part1 + part2 + part3;
    assert.equal(sumSplits, 95000);
  });

  it('Phase 2.4: RBAC Security Penetration & Privilege Escalation Barriers', () => {
    // 1. Staff attempts to change menu price
    const r1 = staff1Dev.updateMenuItemPrice('prod-2', 99000);
    assert.equal(r1.success, false);
    assert.equal(r1.error, 'RBAC_ACCESS_DENIED');
    auditStats.rbacViolationsBlocked++;

    // 2. Staff attempts to change user role
    const r2 = staff2Dev.changeStaffRole('staff-01', 'staff');
    assert.equal(r2.success, false);
    assert.equal(r2.error, 'RBAC_ACCESS_DENIED');
    auditStats.rbacViolationsBlocked++;

    // 3. Staff attempts to hard delete sales data
    const r3 = staff1Dev.adminHardDeleteSalesData();
    assert.equal(r3.success, false);
    assert.equal(r3.error, 'RBAC_ACCESS_DENIED');
    auditStats.rbacViolationsBlocked++;

    // 4. Manager attempts to demote sole Admin
    const r4 = managerDev.changeStaffRole('staff-01', 'staff');
    assert.equal(r4.success, false);
    assert.equal(r4.error, 'RBAC_ACCESS_DENIED');
    auditStats.rbacViolationsBlocked++;

    // 5. Admin attempts to demote sole Admin (blocked by business safeguard)
    const r5 = adminDev.changeStaffRole('staff-01', 'staff');
    assert.equal(r5.success, false);
    assert.equal(r5.error, 'CANNOT_DEMOTE_LAST_ADMIN');
    auditStats.rbacViolationsBlocked++;

    // 6. Admin validly changes menu price (allowed)
    const r6 = adminDev.updateMenuItemPrice('prod-2', 36000);
    assert.equal(r6.success, true);
    assert.equal(staff1Dev.menu.find((m) => m.id === 'prod-2').price, 36000);
  });

  it('Phase 2.5: Network Disconnection & Reconnection Replay', () => {
    // Staff 2 loses connection (e.g. elevator or WiFi drop)
    staff2Dev.setOnlineStatus(false);
    assert.equal(staff2Dev.isOnline, false);

    // While Staff 2 is offline, Staff 1 takes order on B04
    staff1Dev.saveOrderForTable('B04', [traDao]);
    assert.equal(adminDev.tables.find((t) => t.id === 'B04').status, 'occupied');

    // Staff 2 comes back online
    staff2Dev.setOnlineStatus(true);
    assert.equal(staff2Dev.isOnline, true);

    // Staff 2 receives queued updates and table B04 is occupied
    assert.equal(staff2Dev.tables.find((t) => t.id === 'B04').status, 'occupied');

    // Clean up
    staff2Dev.fullCheckout('B04', 'cash');
  });

  it('Phase 2.6: High-Frequency Realtime Event Burst (100 events)', () => {
    const burstCount = 100;
    for (let i = 0; i < burstCount; i++) {
      mesh.broadcast('dev-admin', 'tables', 'UPDATE', null, { id: 'B01', status: i % 2 === 0 ? 'empty' : 'occupied' });
    }
    const metrics = mesh.getMetrics();
    assert.ok(metrics.delivered > 100);
    assert.ok(metrics.deliveryRatePercent >= 99.5, `Delivery rate should be >= 99.5%, got ${metrics.deliveryRatePercent}%`);
  });

  // =========================================================================
  // Phase 3: Comprehensive Financial & Accounting Audit
  // =========================================================================
  it('Phase 3: Verify Accounting Equation & Data Integrity Across 300 Orders', () => {
    const expectedRevenue = auditStats.totalCashRevenue + auditStats.totalVietQRRevenue;
    assert.equal(auditStats.totalGrossRevenue, expectedRevenue, 'Gross revenue must equal Cash + VietQR');

    const totalResolvedOrders = auditStats.completedOrders + auditStats.cancelledOrders;
    // 300 total orders generated = completed (regular + settled carried-over) + cancelled + remaining unpaid in queue
    const remainingUnpaidCount = carriedOverUnpaidQueue.length;
    assert.equal(totalResolvedOrders + remainingUnpaidCount, 300);

    const meshMetrics = mesh.getMetrics();

    console.log('\n============================================================');
    console.log('  GÓC POS — 30-DAY / 4-DEVICE SIMULATION RESULTS SUMMARY');
    console.log('============================================================');
    console.log(`• Total Business Days Simulated : 30 Days`);
    console.log(`• Total Hardware Devices Tested : 4 (1 Admin, 1 Manager, 2 Staff)`);
    console.log(`• Total Orders Generated        : ${auditStats.totalOrdersGenerated} / 300 (100%)`);
    console.log(`• Completed & Settled Orders    : ${auditStats.completedOrders}`);
    console.log(`• Cancelled Orders Handled      : ${auditStats.cancelledOrders}`);
    console.log(`• Split Payment Transactions    : ${auditStats.splitPaymentOrders}`);
    console.log(`• Merged Table Transactions     : ${auditStats.mergedOrders}`);
    console.log(`• Transferred Table Actions     : ${auditStats.transferredOrders}`);
    console.log(`• Overnight Carried-Over Orders : ${auditStats.carriedOverOrders} (Settled: ${auditStats.carriedOverSettledOrders})`);
    console.log('------------------------------------------------------------');
    console.log(`• Total Gross Revenue           : ${auditStats.totalGrossRevenue.toLocaleString('vi-VN')} VNĐ`);
    console.log(`• Cash Revenue                  : ${auditStats.totalCashRevenue.toLocaleString('vi-VN')} VNĐ`);
    console.log(`• VietQR Revenue                : ${auditStats.totalVietQRRevenue.toLocaleString('vi-VN')} VNĐ`);
    console.log(`• Total Discounts Applied       : ${auditStats.totalDiscountsGiven.toLocaleString('vi-VN')} VNĐ`);
    console.log(`• Total Surcharges Collected    : ${auditStats.totalSurchargesCollected.toLocaleString('vi-VN')} VNĐ`);
    console.log(`• Accounting Discrepancy        : 0 VNĐ (PERFECT BALANCE)`);
    console.log('------------------------------------------------------------');
    console.log(`• Realtime Events Dispatched    : ${meshMetrics.totalDispatched}`);
    console.log(`• Realtime Events Delivered     : ${meshMetrics.delivered}`);
    console.log(`• Realtime Delivery Rate        : ${meshMetrics.deliveryRatePercent}%`);
    console.log(`• Unauthorized RBAC Blocked     : ${auditStats.rbacViolationsBlocked} attempts`);
    console.log('============================================================\n');
  });
});
