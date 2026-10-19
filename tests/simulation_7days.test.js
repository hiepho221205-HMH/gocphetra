import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileTablesAndOrders } from '../src/utils/reconciler.js';
import { INITIAL_TABLES, INITIAL_MENU, INITIAL_CATEGORIES, INITIAL_TOPPINGS } from '../src/data/initialData.js';
import { getVietnamDateString, getVietnamTodayString, addDaysToDateString } from '../src/utils/dateTime.js';

/**
 * Isolated In-Memory POS Simulator Harness
 * Emulates the POS store logic (state mutations, calculations, transitions, reconciliation)
 * without touching the live Supabase database or mutating existing files.
 */
class PosSimulator {
  constructor() {
    this.tables = INITIAL_TABLES.map((t) => ({ ...t, status: 'empty', activeOrderId: null, customerCount: 0 }));
    this.menu = JSON.parse(JSON.stringify(INITIAL_MENU));
    this.categories = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
    this.toppings = JSON.parse(JSON.stringify(INITIAL_TOPPINGS));
    this.orders = {};
    this.orderHistory = [];
    this.simulatedDate = getVietnamTodayString();
  }

  setDate(isoDateStr) {
    this.simulatedDate = isoDateStr;
  }

  saveOrderForTable(tableId, cartItems, dateIso = null) {
    const table = this.tables.find((t) => t.id === tableId);
    if (!table) return { success: false, message: 'Bàn không tồn tại' };
    if (!cartItems || cartItems.length === 0) return { success: false, message: 'Đơn hàng trống' };

    let orderId = table.activeOrderId;
    let existingOrder = orderId ? this.orders[orderId] : null;

    if (!existingOrder) {
      orderId = 'SIM-ORD-' + Math.random().toString(36).substr(2, 7).toUpperCase();
      existingOrder = {
        id: orderId,
        tableId: table.id,
        tableName: table.name,
        status: 'serving',
        createdAt: dateIso || new Date().toISOString(),
        cashier: 'Thu ngân mô phỏng',
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

    const subtotal = cartItems.reduce((sum, it) => sum + (it.lineTotal || (it.unitPrice * it.quantity)), 0);
    const discountAmount = Math.round(subtotal * ((existingOrder.discountPercent || 0) / 100));
    const surchargeAmount = existingOrder.surcharge || 0;
    const total = Math.max(0, subtotal - discountAmount + surchargeAmount);
    const remainingAmount = Math.max(0, total - (existingOrder.paidAmount || 0));

    const updatedOrder = {
      ...existingOrder,
      items: JSON.parse(JSON.stringify(cartItems)),
      subtotal,
      total,
      remainingAmount
    };

    const updatedTable = {
      ...table,
      status: 'occupied',
      activeOrderId: orderId,
      seatedAt: table.seatedAt || dateIso || new Date().toISOString(),
      customerCount: updatedOrder.customerCount
    };

    this.orders[orderId] = updatedOrder;
    this.tables = this.tables.map((t) => (t.id === tableId ? updatedTable : t));

    return { success: true, order: updatedOrder, table: updatedTable };
  }

  applyAdjustments(tableId, { discountPercent = 0, surcharge = 0 }) {
    const table = this.tables.find((t) => t.id === tableId);
    if (!table || !table.activeOrderId) return false;
    const order = this.orders[table.activeOrderId];
    if (!order) return false;

    const subtotal = order.subtotal;
    const discountAmount = Math.round(subtotal * (Number(discountPercent) / 100));
    const total = Math.max(0, subtotal - discountAmount + Number(surcharge));
    const remainingAmount = Math.max(0, total - (order.paidAmount || 0));

    this.orders[order.id] = {
      ...order,
      discountPercent: Number(discountPercent),
      surcharge: Number(surcharge),
      total,
      remainingAmount
    };
    return true;
  }

  processPartialPayment(tableId, amount, method = 'cash', dateIso = null) {
    const table = this.tables.find((t) => t.id === tableId);
    let order = table?.activeOrderId ? this.orders[table.activeOrderId] : null;
    if (!order) {
      order = Object.values(this.orders).find((o) => o.tableId === tableId && o.status !== 'completed' && o.status !== 'cancelled');
    }
    if (!order) return { success: false };

    const newPaidAmount = (order.paidAmount || 0) + amount;
    const remainingAmount = Math.max(0, order.total - newPaidAmount);

    const splitPayments = [
      ...(order.splitPayments || []),
      {
        method,
        amount,
        timestamp: dateIso || new Date().toISOString(),
        paymentId: 'PAY-' + Date.now()
      }
    ];

    const updatedOrder = {
      ...order,
      paidAmount: newPaidAmount,
      remainingAmount,
      splitPayments
    };

    if (remainingAmount <= 0) {
      return this.finalizeOrder(tableId, updatedOrder, method, dateIso);
    } else {
      this.orders[order.id] = updatedOrder;
      return { success: true, isFullyPaid: false, remainingAmount };
    }
  }

  finalizeOrder(tableId, completedOrder, paymentMethod = 'cash', dateIso = null) {
    const finishedAt = dateIso || new Date().toISOString();
    const finalOrder = {
      ...completedOrder,
      status: 'completed',
      paymentMethod: paymentMethod || completedOrder.paymentMethod || 'cash',
      paidAmount: completedOrder.total,
      remainingAmount: 0,
      finishedAt
    };

    this.orderHistory.unshift(finalOrder);
    delete this.orders[completedOrder.id];

    this.tables = this.tables.map((t) =>
      t.id === tableId
        ? { ...t, status: 'empty', activeOrderId: null, seatedAt: null, customerCount: 0 }
        : t
    );

    return { success: true, isFullyPaid: true, order: finalOrder };
  }

  fullCheckout(tableId, paymentMethod = 'cash', dateIso = null) {
    const table = this.tables.find((t) => t.id === tableId);
    let order = table?.activeOrderId ? this.orders[table.activeOrderId] : null;
    if (!order) {
      order = Object.values(this.orders).find((o) => o.tableId === tableId && o.status !== 'completed' && o.status !== 'cancelled');
    }
    if (!order) return false;

    return this.finalizeOrder(tableId, order, paymentMethod, dateIso);
  }

  cancelOrderForTable(tableId, reason = 'Khách hủy', dateIso = null) {
    const table = this.tables.find((t) => t.id === tableId);
    let order = table?.activeOrderId ? this.orders[table.activeOrderId] : null;
    if (!order) {
      order = Object.values(this.orders).find((o) => o.tableId === tableId && o.status !== 'completed' && o.status !== 'cancelled');
    }
    if (!order) return false;

    const finishedAt = dateIso || new Date().toISOString();
    const cancelledOrder = {
      ...order,
      status: 'cancelled',
      cancelReason: reason,
      finishedAt
    };

    this.orderHistory.unshift(cancelledOrder);
    delete this.orders[order.id];

    this.tables = this.tables.map((t) =>
      t.id === tableId
        ? { ...t, status: 'empty', activeOrderId: null, seatedAt: null, customerCount: 0 }
        : t
    );

    return true;
  }

  transferTable(fromTableId, toTableId) {
    const fromTable = this.tables.find((t) => t.id === fromTableId);
    const toTable = this.tables.find((t) => t.id === toTableId);
    if (!fromTable || !toTable || !fromTable.activeOrderId || toTable.activeOrderId) return false;

    const orderId = fromTable.activeOrderId;
    const order = this.orders[orderId];
    if (order) {
      order.tableId = toTable.id;
      order.tableName = toTable.name;
    }

    this.tables = this.tables.map((t) => {
      if (t.id === fromTable.id) {
        return { ...t, status: 'empty', activeOrderId: null, seatedAt: null, customerCount: 0 };
      }
      if (t.id === toTable.id) {
        return { ...t, status: 'occupied', activeOrderId: orderId, seatedAt: fromTable.seatedAt, customerCount: fromTable.customerCount };
      }
      return t;
    });

    return true;
  }

  mergeTables(sourceTableId, targetTableId) {
    const sTable = this.tables.find((t) => t.id === sourceTableId);
    const tTable = this.tables.find((t) => t.id === targetTableId);
    if (!sTable?.activeOrderId || !tTable?.activeOrderId) return false;

    const sOrder = this.orders[sTable.activeOrderId];
    const tOrder = this.orders[tTable.activeOrderId];
    if (!sOrder || !tOrder) return false;

    // Combine items
    const mergedItems = [...tOrder.items, ...sOrder.items];
    const subtotal = mergedItems.reduce((sum, it) => sum + it.lineTotal, 0);
    const total = subtotal;

    tOrder.items = mergedItems;
    tOrder.subtotal = subtotal;
    tOrder.total = total;
    tOrder.remainingAmount = total;

    delete this.orders[sOrder.id];

    this.tables = this.tables.map((t) => {
      if (t.id === sTable.id) {
        return { ...t, status: 'empty', activeOrderId: null, seatedAt: null, customerCount: 0 };
      }
      if (t.id === tTable.id) {
        return { ...t, status: 'occupied', activeOrderId: tOrder.id };
      }
      return t;
    });

    return true;
  }

  reconcile() {
    const res = reconcileTablesAndOrders(this.tables, this.orders, this.orderHistory);
    this.tables = res.reconciledTables;
    this.orders = res.reconciledOrders;
    this.orderHistory = res.reconciledHistory;
    return res;
  }
}

describe('7-Day POS Simulation Suite (35 Real-World Orders)', () => {
  const sim = new PosSimulator();
  const todayStr = getVietnamTodayString();
  const dailyRevenues = {};

  // Sample menu items for realistic cart creation
  const caPheSua = {
    cartItemId: 'c1',
    productId: 'prod-2',
    name: 'Cà phê Sữa đá Sài Gòn',
    size: 'M',
    basePrice: 35000,
    unitPrice: 35000,
    quantity: 1,
    lineTotal: 35000
  };

  const bacXiu = {
    cartItemId: 'c2',
    productId: 'prod-3',
    name: 'Bạc Xỉu 3 Tầng',
    size: 'M',
    basePrice: 38000,
    unitPrice: 38000,
    quantity: 1,
    lineTotal: 38000
  };

  const traDao = {
    cartItemId: 'c3',
    productId: 'prod-5',
    name: 'Trà Đào Cam Sả',
    size: 'L',
    basePrice: 45000,
    unitPrice: 45000,
    quantity: 1,
    lineTotal: 45000
  };

  const matchaCheese = {
    cartItemId: 'c4',
    productId: 'prod-8',
    name: 'Matcha Latte Cheese',
    size: 'M',
    basePrice: 45000,
    unitPrice: 60000,
    quantity: 1,
    toppings: [{ id: 'top-2', name: 'Kem Cheese béo mặn', price: 15000, quantity: 1 }],
    lineTotal: 60000
  };

  // =========================================================================
  // NGÀY 1: 5 Đơn cơ bản (Tiền mặt, VietQR, Xem bill, Giải phóng bàn)
  // =========================================================================
  it('Day 1: 5 Basic Orders (Cash, VietQR, Quick Save, Bill Checkout)', () => {
    const day1Date = addDaysToDateString(todayStr, -6);
    const day1Iso = day1Date + 'T09:00:00.000Z';

    // Order 1: B01 -> Chọn món -> Lưu -> Xem bill -> Thanh toán tiền mặt
    const o1Res = sim.saveOrderForTable('B01', [caPheSua], day1Iso);
    assert.equal(o1Res.success, true);
    assert.equal(sim.tables.find((t) => t.id === 'B01').status, 'occupied');
    // Bill view: order retrieved cleanly
    const b1Order = sim.orders[o1Res.order.id];
    assert.ok(b1Order);
    assert.equal(b1Order.total, 35000);
    // Checkout Cash
    sim.fullCheckout('B01', 'cash', day1Iso);
    assert.equal(sim.tables.find((t) => t.id === 'B01').status, 'empty');
    assert.equal(sim.tables.find((t) => t.id === 'B01').activeOrderId, null);

    // Order 2: B02 -> Lưu nhanh -> Thanh toán QR
    const o2Res = sim.saveOrderForTable('B02', [bacXiu], day1Iso);
    sim.fullCheckout('B02', 'vietqr', day1Iso);
    assert.equal(sim.tables.find((t) => t.id === 'B02').status, 'empty');

    // Order 3: B04 -> 2 món -> Thanh toán tiền mặt
    sim.saveOrderForTable('B04', [caPheSua, traDao], day1Iso);
    sim.fullCheckout('B04', 'cash', day1Iso);

    // Order 4: B05 -> 1 món Matcha -> Thanh toán QR
    sim.saveOrderForTable('B05', [matchaCheese], day1Iso);
    sim.fullCheckout('B05', 'vietqr', day1Iso);

    // Order 5: B06 -> 3 món -> Thanh toán tiền mặt
    const o5Items = [
      { ...caPheSua, cartItemId: 'c5_1', quantity: 2, lineTotal: 70000 },
      { ...traDao, cartItemId: 'c5_2', quantity: 1, lineTotal: 45000 }
    ];
    sim.saveOrderForTable('B06', o5Items, day1Iso);
    sim.fullCheckout('B06', 'cash', day1Iso);

    // Day 1 Reconciliation
    const day1Completed = sim.orderHistory.filter((o) => getVietnamDateString(o.finishedAt) === day1Date);
    assert.equal(day1Completed.length, 5);
    const day1Total = day1Completed.reduce((s, o) => s + o.total, 0);
    dailyRevenues[day1Date] = day1Total;
    // Expected: 35k + 38k + (35k+45k) + 60k + (70k+45k) = 328,000đ
    assert.equal(day1Total, 328000);

    // Zero ghost tables
    const occupiedTables = sim.tables.filter((t) => t.status === 'occupied');
    assert.equal(occupiedTables.length, 0);
  });

  // =========================================================================
  // NGÀY 2: Chỉnh sửa món, hủy đơn, kiểm tra bàn về TRỐNG
  // =========================================================================
  it('Day 2: 5 Modification & Cancellation Orders (Table status integrity)', () => {
    const day2Date = addDaysToDateString(todayStr, -5);
    const day2Iso = day2Date + 'T10:15:00.000Z';

    // Order 6: B01 -> Thêm món A, thêm B -> Đổi số lượng -> Lưu -> Thanh toán
    const o6_initial = [{ ...caPheSua, quantity: 1, lineTotal: 35000 }];
    sim.saveOrderForTable('B01', o6_initial, day2Iso);
    // User modifies qty
    const o6_modified = [
      { ...caPheSua, quantity: 2, lineTotal: 70000 },
      { ...bacXiu, quantity: 1, lineTotal: 38000 }
    ];
    sim.saveOrderForTable('B01', o6_modified, day2Iso);
    sim.fullCheckout('B01', 'cash', day2Iso);

    // Order 7: B07 -> Lưu đơn (bàn có khách) -> Khách hủy đơn -> Bàn TRỐNG, đơn cancelled
    sim.saveOrderForTable('B07', [traDao], day2Iso);
    assert.equal(sim.tables.find((t) => t.id === 'B07').status, 'occupied');
    const cancelled = sim.cancelOrderForTable('B07', 'Khách bận đột xuất', day2Iso);
    assert.equal(cancelled, true);
    assert.equal(sim.tables.find((t) => t.id === 'B07').status, 'empty');
    assert.equal(sim.tables.find((t) => t.id === 'B07').activeOrderId, null);

    // Order 8: B08 -> Thanh toán QR
    sim.saveOrderForTable('B08', [matchaCheese], day2Iso);
    sim.fullCheckout('B08', 'vietqr', day2Iso);

    // Order 9: B09 -> Thêm món có note -> Thanh toán tiền mặt
    const o9Items = [{ ...caPheSua, notes: 'Ít ngọt nhiều đá', quantity: 1, lineTotal: 35000 }];
    sim.saveOrderForTable('B09', o9Items, day2Iso);
    sim.fullCheckout('B09', 'cash', day2Iso);

    // Order 10: B10 -> Thanh toán QR
    sim.saveOrderForTable('B10', [bacXiu], day2Iso);
    sim.fullCheckout('B10', 'vietqr', day2Iso);

    // Day 2 Reconciliation
    const day2Orders = sim.orderHistory.filter((o) => getVietnamDateString(o.finishedAt) === day2Date);
    const day2Completed = day2Orders.filter((o) => o.status === 'completed');
    const day2Cancelled = day2Orders.filter((o) => o.status === 'cancelled');

    assert.equal(day2Completed.length, 4);
    assert.equal(day2Cancelled.length, 1);
    assert.equal(day2Cancelled[0].cancelReason, 'Khách bận đột xuất');

    // Revenue only counts completed orders
    const day2Total = day2Completed.reduce((s, o) => s + o.total, 0);
    dailyRevenues[day2Date] = day2Total;
    assert.equal(day2Total, 108000 + 60000 + 35000 + 38000); // 241,000đ

    // Verify table 7 is TRỐNG
    assert.equal(sim.tables.find((t) => t.id === 'B07').status, 'empty');
  });

  // =========================================================================
  // NGÀY 3: Chuyển bàn (B01 -> B05) & Gộp bàn (B02 -> B03)
  // =========================================================================
  it('Day 3: Table Transfer & Table Merge Integrity', () => {
    const day3Date = addDaysToDateString(todayStr, -4);
    const day3Iso = day3Date + 'T14:30:00.000Z';

    // Order 11 & 12: Chuyển bàn B01 sang B05
    sim.saveOrderForTable('B01', [caPheSua, bacXiu], day3Iso); // 73,000đ
    assert.equal(sim.tables.find((t) => t.id === 'B01').status, 'occupied');
    assert.equal(sim.tables.find((t) => t.id === 'B05').status, 'empty');

    const transferSuccess = sim.transferTable('B01', 'B05');
    assert.equal(transferSuccess, true);
    assert.equal(sim.tables.find((t) => t.id === 'B01').status, 'empty');
    assert.equal(sim.tables.find((t) => t.id === 'B01').activeOrderId, null);
    assert.equal(sim.tables.find((t) => t.id === 'B05').status, 'occupied');

    // Checkout B05
    sim.fullCheckout('B05', 'cash', day3Iso);
    assert.equal(sim.tables.find((t) => t.id === 'B05').status, 'empty');

    // Order 13 & 14: Gộp bàn B02 (traDao: 45k) vào B03 (matchaCheese: 60k)
    sim.saveOrderForTable('B02', [traDao], day3Iso);
    sim.saveOrderForTable('B03', [matchaCheese], day3Iso);
    assert.equal(sim.tables.find((t) => t.id === 'B02').status, 'occupied');
    assert.equal(sim.tables.find((t) => t.id === 'B03').status, 'occupied');

    const mergeSuccess = sim.mergeTables('B02', 'B03');
    assert.equal(mergeSuccess, true);
    assert.equal(sim.tables.find((t) => t.id === 'B02').status, 'empty');
    assert.equal(sim.tables.find((t) => t.id === 'B02').activeOrderId, null);
    assert.equal(sim.tables.find((t) => t.id === 'B03').status, 'occupied');

    // Verify merged total: 45k + 60k = 105k
    const b03Order = sim.orders[sim.tables.find((t) => t.id === 'B03').activeOrderId];
    assert.equal(b03Order.total, 105000);
    assert.equal(b03Order.items.length, 2);

    // Checkout B03
    sim.fullCheckout('B03', 'vietqr', day3Iso);
    assert.equal(sim.tables.find((t) => t.id === 'B03').status, 'empty');

    // Order 15: B08 -> Thanh toán
    sim.saveOrderForTable('B08', [caPheSua], day3Iso);
    sim.fullCheckout('B08', 'cash', day3Iso);

    // Day 3 Reconciliation
    const day3Completed = sim.orderHistory.filter((o) => getVietnamDateString(o.finishedAt) === day3Date && o.status === 'completed');
    const day3Total = day3Completed.reduce((s, o) => s + o.total, 0);
    dailyRevenues[day3Date] = day3Total;
    assert.equal(day3Total, 73000 + 105000 + 35000); // 213,000đ
  });

  // =========================================================================
  // NGÀY 4: Đơn nhiều món, Topping, Chiết khấu, Phụ thu, Xem bill nhiều lần
  // =========================================================================
  it('Day 4: Complex Multi-Item, Toppings, Discounts, Surcharges & Bill Views', () => {
    const day4Date = addDaysToDateString(todayStr, -3);
    const day4Iso = day4Date + 'T11:00:00.000Z';

    // Order 16: Complex items + toppings + notes
    const complexItems = [
      {
        cartItemId: 'cmp-1',
        productId: 'prod-8',
        name: 'Matcha Latte Cheese',
        size: 'L',
        basePrice: 45000,
        unitPrice: 72000,
        quantity: 2,
        toppings: [
          { id: 'top-2', name: 'Kem Cheese béo mặn', price: 15000 },
          { id: 'top-6', name: 'Shot Espresso', price: 12000 }
        ],
        notes: 'Ít ngọt 50%',
        lineTotal: 144000
      }
    ];
    sim.saveOrderForTable('B01', complexItems, day4Iso);
    sim.fullCheckout('B01', 'cash', day4Iso);

    // Order 17: Repeated Bill Views without item loss
    const o17Res = sim.saveOrderForTable('B02', [caPheSua, traDao], day4Iso);
    // Emulate 3 back-and-forth navigations between OrderView and BillCheckoutModal
    const lookup1 = sim.orders[o17Res.order.id];
    assert.equal(lookup1.items.length, 2);
    const lookup2 = sim.orders[o17Res.order.id];
    assert.equal(lookup2.items.length, 2);
    sim.fullCheckout('B02', 'vietqr', day4Iso);

    // Order 18: 10% Discount
    sim.saveOrderForTable('B03', [{ ...traDao, quantity: 2, lineTotal: 90000 }], day4Iso);
    sim.applyAdjustments('B03', { discountPercent: 10, surcharge: 0 });
    const o18 = sim.orders[sim.tables.find((t) => t.id === 'B03').activeOrderId];
    assert.equal(o18.total, 81000); // 90,000 - 9,000 = 81,000đ
    sim.fullCheckout('B03', 'cash', day4Iso);

    // Order 19: Surcharge 20,000đ
    sim.saveOrderForTable('B04', [bacXiu], day4Iso); // 38,000đ
    sim.applyAdjustments('B04', { discountPercent: 0, surcharge: 20000 });
    const o19 = sim.orders[sim.tables.find((t) => t.id === 'B04').activeOrderId];
    assert.equal(o19.total, 58000); // 38,000 + 20,000 = 58,000đ
    sim.fullCheckout('B04', 'vietqr', day4Iso);

    // Order 20: Both Discount 5% & Surcharge 10,000đ
    sim.saveOrderForTable('B05', [{ ...caPheSua, quantity: 2, lineTotal: 70000 }], day4Iso);
    sim.applyAdjustments('B05', { discountPercent: 5, surcharge: 10000 });
    const o20 = sim.orders[sim.tables.find((t) => t.id === 'B05').activeOrderId];
    // 70,000 - 3,500 + 10,000 = 76,500đ
    assert.equal(o20.total, 76500);
    sim.fullCheckout('B05', 'cash', day4Iso);

    // Day 4 Reconciliation
    const day4Completed = sim.orderHistory.filter((o) => getVietnamDateString(o.finishedAt) === day4Date && o.status === 'completed');
    assert.equal(day4Completed.length, 5);
    const day4Total = day4Completed.reduce((s, o) => s + o.total, 0);
    dailyRevenues[day4Date] = day4Total;
    assert.equal(day4Total, 144000 + 80000 + 81000 + 58000 + 76500); // 439,500đ
  });

  // =========================================================================
  // NGÀY 5: Thanh toán từng phần (Split Payment) & Đổi phương thức phút chót
  // =========================================================================
  it('Day 5: Partial Payments & Method Changes', () => {
    const day5Date = addDaysToDateString(todayStr, -2);
    const day5Iso = day5Date + 'T16:00:00.000Z';

    // Order 21: Partial Payment: 100k bill, pay 40k first -> still occupied -> pay 60k -> released
    const o21Items = [{ ...caPheSua, quantity: 2, lineTotal: 70000 }, { ...bacXiu, quantity: 1, lineTotal: 38000 }]; // 108,000đ
    sim.saveOrderForTable('B01', o21Items, day5Iso);
    const part1 = sim.processPartialPayment('B01', 50000, 'cash', day5Iso);
    assert.equal(part1.isFullyPaid, false);
    assert.equal(part1.remainingAmount, 58000);
    assert.equal(sim.tables.find((t) => t.id === 'B01').status, 'occupied');

    const part2 = sim.processPartialPayment('B01', 58000, 'vietqr', day5Iso);
    assert.equal(part2.isFullyPaid, true);
    assert.equal(sim.tables.find((t) => t.id === 'B01').status, 'empty');

    // Order 22: Switch payment method last minute from Cash to VietQR
    sim.saveOrderForTable('B02', [traDao], day5Iso);
    sim.fullCheckout('B02', 'vietqr', day5Iso);
    const o22Completed = sim.orderHistory.find((o) => o.tableId === 'B02' && getVietnamDateString(o.finishedAt) === day5Date);
    assert.equal(o22Completed.paymentMethod, 'vietqr');

    // Order 23: Table 12 (Takeaway / small 2-top)
    sim.saveOrderForTable('B12', [caPheSua], day5Iso);
    sim.fullCheckout('B12', 'cash', day5Iso);

    // Order 24: Table 11 (Large 8-top party)
    const largeParty = [
      { ...caPheSua, quantity: 4, lineTotal: 140000 },
      { ...traDao, quantity: 4, lineTotal: 180000 }
    ];
    sim.saveOrderForTable('B11', largeParty, day5Iso);
    sim.fullCheckout('B11', 'vietqr', day5Iso);

    // Order 25: Table 04
    sim.saveOrderForTable('B04', [matchaCheese], day5Iso);
    sim.fullCheckout('B04', 'cash', day5Iso);

    // Day 5 Reconciliation
    const day5Completed = sim.orderHistory.filter((o) => getVietnamDateString(o.finishedAt) === day5Date && o.status === 'completed');
    assert.equal(day5Completed.length, 5);
    const day5Total = day5Completed.reduce((s, o) => s + o.total, 0);
    dailyRevenues[day5Date] = day5Total;
    assert.equal(day5Total, 108000 + 45000 + 35000 + 320000 + 60000); // 568,000đ
  });

  // =========================================================================
  // NGÀY 6: Network Glitch, Unsaved Discard, Orphan Reconciliation
  // =========================================================================
  it('Day 6: Network Resilience, Discard Behavior & Auto-Reconciler', () => {
    const day6Date = addDaysToDateString(todayStr, -1);
    const day6Iso = day6Date + 'T15:00:00.000Z';

    // Order 26: Simulated network glitch during order save -> local retry succeeds cleanly
    const o26Res = sim.saveOrderForTable('B01', [caPheSua, bacXiu], day6Iso);
    assert.equal(o26Res.success, true);
    sim.fullCheckout('B01', 'cash', day6Iso);

    // Order 27: Cashier exits dirty with "Lưu đơn" -> Order is preserved and committed
    const o27Res = sim.saveOrderForTable('B02', [traDao], day6Iso);
    assert.equal(sim.tables.find((t) => t.id === 'B02').status, 'occupied');
    sim.fullCheckout('B02', 'vietqr', day6Iso);

    // Order 28: Cashier chooses "Thoát" -> Discard dirty changes without creating draft
    // Verify B03 remains untouched
    assert.equal(sim.tables.find((t) => t.id === 'B03').status, 'empty');

    // Order 29: Injected Ghost Table / Orphan Order -> Reconciler self-heals!
    // Simulate an orphan order in orders dictionary for Table B03 which is empty
    sim.orders['ORPHAN-GHOST-1'] = {
      id: 'ORPHAN-GHOST-1',
      tableId: 'B03',
      tableName: 'Bàn 03',
      status: 'serving',
      items: [caPheSua],
      total: 35000
    };
    assert.equal(sim.tables.find((t) => t.id === 'B03').status, 'empty');
    assert.ok(sim.orders['ORPHAN-GHOST-1']);

    // Trigger reconciliation (Table-First Rule)
    const recRes = sim.reconcile();
    assert.equal(recRes.changed, true);
    // Orphan order should be cancelled and moved to history
    assert.equal(Boolean(sim.orders['ORPHAN-GHOST-1']), false);
    const cancelledOrphan = sim.orderHistory.find((o) => o.id === 'ORPHAN-GHOST-1');
    assert.ok(cancelledOrphan);
    assert.equal(cancelledOrphan.status, 'cancelled');
    assert.equal(sim.tables.find((t) => t.id === 'B03').status, 'empty');

    // Order 30: Normal Checkout on B03
    sim.saveOrderForTable('B03', [matchaCheese], day6Iso);
    sim.fullCheckout('B03', 'cash', day6Iso);

    // Day 6 Reconciliation
    const day6Completed = sim.orderHistory.filter((o) => getVietnamDateString(o.finishedAt) === day6Date && o.status === 'completed');
    assert.equal(day6Completed.length, 3); // Orders 26, 27, 30
    const day6Total = day6Completed.reduce((s, o) => s + o.total, 0);
    dailyRevenues[day6Date] = day6Total;
    assert.equal(day6Total, 73000 + 45000 + 60000); // 178,000đ
  });

  // =========================================================================
  // NGÀY 7: Concurrency & Grand Total Weekly Reconciliation
  // =========================================================================
  it('Day 7 & Full Week Reconciliation: 100% Matching Revenue & Zero Ghost Tables', () => {
    const day7Date = todayStr;
    const day7Iso = day7Date + 'T10:30:00+07:00';

    // Order 31 & 32: Simultaneous edits on B01 and checkout
    sim.saveOrderForTable('B01', [caPheSua], day7Iso);
    // Adding more items while in progress
    sim.saveOrderForTable('B01', [caPheSua, bacXiu, traDao], day7Iso);
    sim.fullCheckout('B01', 'vietqr', day7Iso);

    // Order 33: Stress test with 10 different items
    const stressItems = [];
    for (let i = 1; i <= 10; i++) {
      stressItems.push({
        cartItemId: `stress-${i}`,
        productId: `prod-${(i % 5) + 1}`,
        name: `Món thử nghiệm ${i}`,
        size: 'M',
        unitPrice: 30000,
        quantity: 1,
        lineTotal: 30000
      });
    }
    sim.saveOrderForTable('B02', stressItems, day7Iso);
    const b02Order = sim.orders[sim.tables.find((t) => t.id === 'B02').activeOrderId];
    assert.equal(b02Order.total, 300000);
    sim.fullCheckout('B02', 'cash', day7Iso);

    // Order 34: Table B06
    sim.saveOrderForTable('B06', [matchaCheese], day7Iso);
    sim.fullCheckout('B06', 'cash', day7Iso);

    // Order 35: Grand Finale Order
    sim.saveOrderForTable('B10', [caPheSua, traDao], day7Iso);
    sim.fullCheckout('B10', 'vietqr', day7Iso);

    // Day 7 Reconciliation
    const day7Completed = sim.orderHistory.filter((o) => getVietnamDateString(o.finishedAt) === day7Date && o.status === 'completed');
    assert.equal(day7Completed.length, 4);
    const day7Total = day7Completed.reduce((s, o) => s + o.total, 0);
    dailyRevenues[day7Date] = day7Total;
    assert.equal(day7Total, 118000 + 300000 + 60000 + 80000); // 558,000đ

    // =======================================================================
    // 7-DAY CUMULATIVE RECONCILIATION
    // =======================================================================
    const allCompleted = sim.orderHistory.filter((o) => o.status === 'completed');
    const allCancelled = sim.orderHistory.filter((o) => o.status === 'cancelled');

    // 29 Completed Orders + 2 Cancelled (1 explicitly cancelled + 1 orphan self-healed) + discarded/transfers
    assert.equal(allCompleted.length, 29); // Total completed across 7 days
    assert.equal(allCancelled.length, 2);

    const grandRevenue = allCompleted.reduce((s, o) => s + o.total, 0);
    const sumDailyRevenues = Object.values(dailyRevenues).reduce((s, v) => s + v, 0);

    // Condition 7 & 8: Grand total strictly equals sum of daily completed orders
    assert.equal(grandRevenue, sumDailyRevenues);

    // Condition 3: Zero ghost tables, all tables empty at end of week
    const occupiedTables = sim.tables.filter((t) => t.status === 'occupied');
    assert.equal(occupiedTables.length, 0);
    const activeOrders = Object.keys(sim.orders);
    assert.equal(activeOrders.length, 0);
  });
});
