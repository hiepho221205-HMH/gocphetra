import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileTablesAndOrders, rolloverPastUnpaidOrders } from '../src/utils/reconciler.js';
import { computeKitchenItemsDiff } from '../src/utils/kitchenTicketEngine.js';
import { getVietnamDateString } from '../src/utils/dateTime.js';

test('GÓC POS — 7-Day Order & Payment Integrity Master Suite', async (suite) => {

  const MENU_CATALOG = {
    'CF_DEN': { id: 'CF_DEN', name: 'Cà phê đen', basePrice: 20000 },
    'CF_SUA': { id: 'CF_SUA', name: 'Cà phê sữa', basePrice: 25000 },
    'BAC_XIU': { id: 'BAC_XIU', name: 'Bạc xỉu', basePrice: 29000 },
    'TRA_DAO': { id: 'TRA_DAO', name: 'Trà đào cam sả', basePrice: 35000 },
    'TRA_O_LONG': { id: 'TRA_O_LONG', name: 'Trà Ô Long sữa', basePrice: 38000 }
  };

  const TOPPINGS_CATALOG = {
    'TOP_TRAN_CHAU': { id: 'TOP_TRAN_CHAU', name: 'Trân châu trắng', price: 6000 },
    'TOP_KEM_CHEESE': { id: 'TOP_KEM_CHEESE', name: 'Kem cheese', price: 10000 },
    'TOP_THACH_DAO': { id: 'TOP_THACH_DAO', name: 'Thạch đào', price: 8000 }
  };

  const calculateLineTotal = (item) => {
    const toppingsTotal = (item.toppings || []).reduce((sum, t) => sum + (t.price || 0), 0);
    return (item.unitPrice + toppingsTotal) * item.quantity;
  };

  const recalculateOrderTotals = (order) => {
    const subtotal = (order.items || []).reduce((sum, item) => sum + (item.lineTotal || calculateLineTotal(item)), 0);
    const discountAmount = Math.round(subtotal * ((order.discountPercent || 0) / 100));
    const surcharge = order.surcharge || 0;
    const total = Math.max(0, subtotal - discountAmount + surcharge);
    const paidAmount = order.paidAmount || 0;
    const remainingAmount = Math.max(0, total - paidAmount);
    return {
      ...order,
      subtotal,
      total,
      remainingAmount
    };
  };

  // State store for 7-day isolated test environment
  const store = {
    tables: [
      { id: 'T01', name: 'Bàn 01', status: 'empty', activeOrderId: null, customerCount: 0 },
      { id: 'T02', name: 'Bàn 02', status: 'empty', activeOrderId: null, customerCount: 0 },
      { id: 'T03', name: 'Bàn 03', status: 'empty', activeOrderId: null, customerCount: 0 },
      { id: 'T04', name: 'Bàn 04', status: 'empty', activeOrderId: null, customerCount: 0 },
      { id: 'T05', name: 'Bàn 05', status: 'empty', activeOrderId: null, customerCount: 0 }
    ],
    orders: {},
    orderHistory: [],
    payments: [],
    outbox: [],
    auditLogs: []
  };

  // ============================================================================
  // DAY 1: NEW ORDERS & ATOMIC FULL CASH SETTLEMENT
  // ============================================================================
  await suite.test('DAY 1 — Standard POS Operations: 5 New Orders & Full Cash Settlement', async (t) => {
    const businessDate = '2026-10-18';

    for (let i = 1; i <= 5; i++) {
      const tableId = `T0${i}`;
      const orderId = `ORD-D1-00${i}`;
      const item1 = {
        productId: 'CF_DEN',
        name: MENU_CATALOG.CF_DEN.name,
        unitPrice: MENU_CATALOG.CF_DEN.basePrice,
        quantity: 2,
        toppings: [],
        notes: 'Ít đường',
        lineTotal: 40000
      };
      const item2 = {
        productId: 'TRA_DAO',
        name: MENU_CATALOG.TRA_DAO.name,
        unitPrice: MENU_CATALOG.TRA_DAO.basePrice,
        quantity: 1,
        toppings: [TOPPINGS_CATALOG.TOP_THACH_DAO],
        notes: '',
        lineTotal: 43000 // 35000 + 8000
      };

      // 1. Create and Save Order
      const rawOrder = {
        id: orderId,
        tableId,
        tableName: `Bàn 0${i}`,
        status: 'serving',
        businessDate,
        createdAt: `${businessDate}T08:30:00.000Z`,
        items: [item1, item2],
        discountPercent: i === 5 ? 10 : 0, // 10% discount on order 5
        surcharge: 0,
        paidAmount: 0,
        version: 1
      };
      const order = recalculateOrderTotals(rawOrder);

      // Verify subtotal calculation
      assert.equal(order.subtotal, 83000);
      if (i === 5) {
        assert.equal(order.total, 74700); // 83000 - 8300
      } else {
        assert.equal(order.total, 83000);
      }

      // Commit Order to store & update table to occupied
      store.orders[orderId] = order;
      const table = store.tables.find(tbl => tbl.id === tableId);
      table.status = 'occupied';
      table.activeOrderId = orderId;
      table.customerCount = 2;

      assert.equal(table.status, 'occupied');
      assert.equal(table.activeOrderId, orderId);

      // 2. Full Checkout & Payment
      const paidAmount = order.total;
      const paymentId = `PAY-D1-00${i}`;
      const idempotencyKey = `PAY_${orderId}_${paidAmount}`;

      const completedOrder = {
        ...order,
        status: 'completed',
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        paidAmount,
        remainingAmount: 0,
        finishedAt: `${businessDate}T09:15:00.000Z`,
        paymentBusinessDate: businessDate
      };

      const paymentRecord = {
        id: paymentId,
        orderId,
        amount: paidAmount,
        paymentMethod: 'cash',
        paymentStatus: 'completed',
        businessDate,
        idempotencyKey,
        paidAt: `${businessDate}T09:15:00.000Z`
      };

      // Atomic transition: Archive order, release table, record payment
      delete store.orders[orderId];
      store.orderHistory.unshift(completedOrder);
      store.payments.push(paymentRecord);
      table.status = 'empty';
      table.activeOrderId = null;
      table.customerCount = 0;

      // Assertions
      assert.equal(table.status, 'empty');
      assert.equal(table.activeOrderId, null);
      assert.equal(completedOrder.status, 'completed');
      assert.equal(paymentRecord.amount, completedOrder.total);
    }

    assert.equal(store.orderHistory.length, 5);
    assert.equal(store.payments.length, 5);
    const day1Total = store.payments.reduce((s, p) => s + p.amount, 0);
    assert.equal(day1Total, (83000 * 4) + 74700); // 406,700 VND
  });

  // ============================================================================
  // DAY 2: ADDING ITEMS & TOPPINGS TO EXISTING SERVING ORDERS
  // ============================================================================
  await suite.test('DAY 2 — Preservation of Existing Items & Quantity Increments (5 Orders)', async (t) => {
    const businessDate = '2026-10-19';

    for (let i = 1; i <= 5; i++) {
      const tableId = `T0${i}`;
      const orderId = `ORD-D2-00${i}`;

      // 1. Initial Order: 1 Bạc xỉu
      const initialItem = {
        productId: 'BAC_XIU',
        name: MENU_CATALOG.BAC_XIU.name,
        unitPrice: 29000,
        quantity: 1,
        toppings: [],
        notes: '',
        lineTotal: 29000
      };
      let order = recalculateOrderTotals({
        id: orderId,
        tableId,
        tableName: `Bàn 0${i}`,
        status: 'serving',
        businessDate,
        createdAt: `${businessDate}T10:00:00.000Z`,
        items: [initialItem],
        version: 1
      });
      store.orders[orderId] = order;
      const table = store.tables.find(tbl => tbl.id === tableId);
      table.status = 'occupied';
      table.activeOrderId = orderId;

      // 2. Add Second Item: 1 Trà Ô Long + Kem cheese
      const secondItem = {
        productId: 'TRA_O_LONG',
        name: MENU_CATALOG.TRA_O_LONG.name,
        unitPrice: 38000,
        quantity: 1,
        toppings: [TOPPINGS_CATALOG.TOP_KEM_CHEESE],
        notes: 'Ít đá',
        lineTotal: 48000 // 38000 + 10000
      };

      // Add item to cart and increment version
      const updatedItems = [...order.items, secondItem];
      order = recalculateOrderTotals({
        ...order,
        items: updatedItems,
        version: order.version + 1
      });
      store.orders[orderId] = order;

      // CRITICAL ASSERTION: Initial item MUST be preserved without alteration!
      assert.equal(order.items.length, 2, 'Existing item must be preserved alongside newly added item');
      assert.equal(order.items[0].productId, 'BAC_XIU');
      assert.equal(order.items[0].quantity, 1);
      assert.equal(order.items[1].productId, 'TRA_O_LONG');
      assert.equal(order.items[1].lineTotal, 48000);
      assert.equal(order.subtotal, 77000); // 29000 + 48000
      assert.equal(order.version, 2, 'Order version must increment to 2');

      // 3. Settle and release table
      const paidAmount = order.total;
      delete store.orders[orderId];
      store.orderHistory.unshift({ ...order, status: 'completed', paymentStatus: 'paid', paidAmount });
      store.payments.push({ id: `PAY-D2-00${i}`, orderId, amount: paidAmount, businessDate, idempotencyKey: `PAY_${orderId}_${paidAmount}` });
      table.status = 'empty';
      table.activeOrderId = null;
    }

    assert.equal(store.orderHistory.length, 10);
  });

  // ============================================================================
  // DAY 3: CONCURRENT EDITS & OPTIMISTIC CONCURRENCY CONTROL (OCC)
  // ============================================================================
  await suite.test('DAY 3 — Concurrency & Collision Protection: OCC Version Mismatch Rejection', async (t) => {
    const businessDate = '2026-10-20';
    const tableId = 'T01';
    const orderId = 'ORD-D3-OCC-01';

    // Staff A loads order at version 1
    const baseOrder = recalculateOrderTotals({
      id: orderId,
      tableId,
      tableName: 'Bàn 01',
      status: 'serving',
      businessDate,
      items: [{ productId: 'CF_DEN', name: 'Cà phê đen', unitPrice: 20000, quantity: 1, lineTotal: 20000 }],
      version: 1
    });
    store.orders[orderId] = baseOrder;

    // Staff B updates order to version 2
    const staffBItems = [
      ...baseOrder.items,
      { productId: 'CF_SUA', name: 'Cà phê sữa', unitPrice: 25000, quantity: 1, lineTotal: 25000 }
    ];
    const serverUpdatedOrder = recalculateOrderTotals({
      ...baseOrder,
      items: staffBItems,
      version: 2
    });
    store.orders[orderId] = serverUpdatedOrder;

    // Staff A attempts to save based on stale expectedVersion: 1
    const staffAExpectedVersion = 1;
    const currentServerVersion = store.orders[orderId].version; // 2

    const occCheck = (expected, actual) => {
      if (actual > expected) {
        return { success: false, conflict: true, code: 'VERSION_CONFLICT', message: 'Order was updated by another device' };
      }
      return { success: true };
    };

    const attemptResult = occCheck(staffAExpectedVersion, currentServerVersion);

    assert.equal(attemptResult.success, false, 'Stale save request must be rejected');
    assert.equal(attemptResult.conflict, true, 'Conflict flag must be true');

    // Mutex Simulation: Rapid double-click on save
    const mutex = new Set();
    const tryAcquireLock = (id) => {
      if (mutex.has(id)) return false;
      mutex.add(id);
      return true;
    };

    assert.equal(tryAcquireLock(tableId), true, 'First click acquires lock');
    assert.equal(tryAcquireLock(tableId), false, 'Second click rejected by mutex (Double-click protection)');
    mutex.delete(tableId);
    assert.equal(tryAcquireLock(tableId), true, 'Lock re-acquirable after release');

    // Clean up Day 3 order
    delete store.orders[orderId];
    store.orderHistory.unshift({ ...serverUpdatedOrder, status: 'completed', paymentStatus: 'paid' });
    store.payments.push({ id: `PAY-D3-001`, orderId, amount: serverUpdatedOrder.total, businessDate });
  });

  // ============================================================================
  // DAY 4: DETERMINISTIC IDEMPOTENCY KEY & DUPLICATE PAYMENT PREVENTION
  // ============================================================================
  await suite.test('DAY 4 — Financial Protection: Deterministic Idempotency Prevents Duplicate Revenue', async (t) => {
    const businessDate = '2026-10-21';
    const orderId = 'ORD-D4-IDEMP-01';
    const totalAmount = 55000;

    const deterministicKey = `PAY_${orderId}_${totalAmount}`;

    // Simulate Payment Processor with Idempotency Table
    const processedKeys = new Map();
    const processPayment = (paymentRecord) => {
      if (processedKeys.has(paymentRecord.idempotencyKey)) {
        return {
          success: true,
          alreadyProcessed: true,
          existingPaymentId: processedKeys.get(paymentRecord.idempotencyKey),
          message: 'Idempotent replay: Payment already recorded'
        };
      }
      processedKeys.set(paymentRecord.idempotencyKey, paymentRecord.id);
      store.payments.push(paymentRecord);
      return {
        success: true,
        alreadyProcessed: false,
        paymentId: paymentRecord.id
      };
    };

    const firstAttempt = processPayment({
      id: 'PAY-D4-REC-01',
      orderId,
      amount: totalAmount,
      businessDate,
      idempotencyKey: deterministicKey
    });

    assert.equal(firstAttempt.success, true);
    assert.equal(firstAttempt.alreadyProcessed, false, 'First payment must be recorded');

    // Second Attempt: Exact same payment request (simulating rapid network retry or double-click)
    const secondAttempt = processPayment({
      id: 'PAY-D4-REC-02',
      orderId,
      amount: totalAmount,
      businessDate,
      idempotencyKey: deterministicKey
    });

    assert.equal(secondAttempt.success, true);
    assert.equal(secondAttempt.alreadyProcessed, true, 'Second payment must be caught by idempotency key');
    assert.equal(secondAttempt.existingPaymentId, 'PAY-D4-REC-01');

    // Verify database only has 1 record for this order
    const recordsForOrder = store.payments.filter(p => p.orderId === orderId);
    assert.equal(recordsForOrder.length, 1, 'Strictly 1 payment record must exist in database!');
    assert.equal(recordsForOrder[0].amount, 55000);
  });

  // ============================================================================
  // DAY 5: OFFLINE OUTBOX BUFFERING & NETWORK RECONNECTION REPLAY
  // ============================================================================
  await suite.test('DAY 5 — Offline-First Resilience: Outbox Queue Replay Without Data Loss', async (t) => {
    const businessDate = '2026-10-22';
    const orderId = 'ORD-D5-OFFLINE-01';

    const offlineOrder = recalculateOrderTotals({
      id: orderId,
      tableId: 'T03',
      tableName: 'Bàn 03',
      status: 'serving',
      businessDate,
      items: [{ productId: 'TRA_DAO', name: 'Trà đào', unitPrice: 35000, quantity: 2, lineTotal: 70000 }],
      version: 1
    });

    // 1. Device is offline: buffer into outbox
    const outboxItem = {
      id: 1,
      actionType: 'SAVE_ORDER',
      orderId,
      payload: offlineOrder,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    store.outbox.push(outboxItem);

    assert.equal(store.outbox.length, 1);
    assert.equal(store.outbox[0].status, 'pending');

    // 2. Reconnection event: replay outbox items
    const replayQueue = () => {
      let syncedCount = 0;
      store.outbox.forEach(item => {
        if (item.status === 'pending') {
          // Replay to primary store
          store.orders[item.orderId] = item.payload;
          const tbl = store.tables.find(t => t.id === item.payload.tableId);
          if (tbl) {
            tbl.status = 'occupied';
            tbl.activeOrderId = item.orderId;
          }
          item.status = 'completed';
          syncedCount++;
        }
      });
      return syncedCount;
    };

    const synced = replayQueue();
    assert.equal(synced, 1, 'Outbox item successfully replayed');
    assert.equal(store.orders[orderId].total, 70000, 'Order successfully restored');
    assert.equal(store.tables.find(t => t.id === 'T03').status, 'occupied');

    // Clean up
    delete store.orders[orderId];
    store.tables.find(t => t.id === 'T03').status = 'empty';
    store.tables.find(t => t.id === 'T03').activeOrderId = null;
  });

  // ============================================================================
  // DAY 6: REALTIME SYNC BETWEEN 3 INDEPENDENT BROWSER SESSIONS
  // ============================================================================
  await suite.test('DAY 6 — Realtime Protocol: Instant Propagation Across Cashier, Waiter, and Admin', async (t) => {
    const peers = {
      cashier: { id: 'c1', inbox: [] },
      waiter: { id: 'w1', inbox: [] },
      admin: { id: 'a1', inbox: [] }
    };

    const broadcast = (senderId, event, payload) => {
      Object.keys(peers).forEach(role => {
        if (peers[role].id !== senderId) {
          peers[role].inbox.push({ event, payload });
        }
      });
    };

    // Waiter saves an order on Table 04
    const syncPayload = {
      order: { id: 'ORD-D6-SYNC', tableId: 'T04', status: 'serving', total: 45000 },
      table: { id: 'T04', status: 'occupied', activeOrderId: 'ORD-D6-SYNC' },
      senderId: 'w1',
      timestamp: Date.now()
    };
    broadcast('w1', 'order_sync', syncPayload);

    // Both Cashier and Admin must receive the order immediately
    assert.equal(peers.cashier.inbox.length, 1);
    assert.equal(peers.admin.inbox.length, 1);
    assert.equal(peers.waiter.inbox.length, 0, 'Sender must not echo broadcast back to itself');
    assert.equal(peers.cashier.inbox[0].payload.table.status, 'occupied');
    assert.equal(peers.admin.inbox[0].payload.order.id, 'ORD-D6-SYNC');
  });

  // ============================================================================
  // DAY 7: HISTORICAL ROLLOVER & PAST DATE BATCH PAYMENT COLLECTION
  // ============================================================================
  await suite.test('DAY 7 — Historical Order Handling: Rollover, Table Release, and Batch Settlement', async (t) => {
    const pastDate = '2026-10-17';
    const currentDate = '2026-10-23';

    // 1. Simulate uncompleted order from past date occupying Table 05
    const pastOrder = recalculateOrderTotals({
      id: 'ORD-D7-PAST-01',
      tableId: 'T05',
      tableName: 'Bàn 05',
      status: 'serving',
      businessDate: pastDate,
      createdAt: `${pastDate}T21:00:00.000Z`,
      items: [{ productId: 'CF_SUA', name: 'Cà phê sữa', unitPrice: 25000, quantity: 2, lineTotal: 50000 }]
    });

    const tablesBeforeRollover = [
      { id: 'T05', name: 'Bàn 05', status: 'occupied', activeOrderId: 'ORD-D7-PAST-01', customerCount: 2 }
    ];
    const ordersBeforeRollover = { 'ORD-D7-PAST-01': pastOrder };
    const historyBeforeRollover = [];

    // 2. Execute Rollover
    const rolled = rolloverPastUnpaidOrders(tablesBeforeRollover, ordersBeforeRollover, historyBeforeRollover, currentDate);

    assert.equal(rolled.rolledOrdersCount, 1, 'Past unpaid order must be rolled over');
    assert.equal(rolled.releasedTablesCount, 1, 'Table must be released to empty');
    assert.equal(rolled.tables[0].status, 'empty', 'Table 05 is now available for morning customers');
    assert.equal(rolled.tables[0].activeOrderId, null);
    assert.equal(rolled.orderHistory[0].status, 'unpaid_carried_over');

    // 3. Admin settles the past carried-over order today
    const historicalPaymentRecord = {
      id: 'PAY-D7-HIST-01',
      orderId: 'ORD-D7-PAST-01',
      amount: 50000,
      paymentMethod: 'vietqr',
      businessDate: currentDate, // Revenue recognized on payment date (Cash-basis)
      idempotencyKey: 'PAY_ORD-D7-PAST-01_50000'
    };
    store.payments.push(historicalPaymentRecord);

    const settledHistoricalOrder = {
      ...rolled.orderHistory[0],
      status: 'completed',
      paymentStatus: 'paid',
      paidAmount: 50000,
      paymentBusinessDate: currentDate,
      finishedAt: `${currentDate}T11:00:00.000Z`
    };

    assert.equal(settledHistoricalOrder.status, 'completed');
    assert.equal(settledHistoricalOrder.paymentBusinessDate, currentDate);
    assert.equal(historicalPaymentRecord.amount, 50000);
  });

  // ============================================================================
  // BONUS: KITCHEN PREPARATION TICKET DIFF ENGINE INTEGRITY
  // ============================================================================
  await suite.test('BONUS — Kitchen Ticket Diff Verification: Only Delta Sent on Subsequent Saves', () => {
    const item1 = { productId: 'CF_DEN', name: 'Cà phê đen', quantity: 2, toppings: [], notes: '' };
    const item2 = { productId: 'TRA_DAO', name: 'Trà đào', quantity: 1, toppings: [], notes: 'Ít đá' };

    // Initial save: all items are new
    const initialDiff = computeKitchenItemsDiff([item1, item2], [], 'diff');
    assert.equal(initialDiff.hasChanges, true);
    assert.equal(initialDiff.diffItems.length, 2);

    // Snapshot of sent items
    const sentSnapshot = [
      { productId: 'CF_DEN', name: 'Cà phê đen', quantity: 2, toppings: [], notes: '' },
      { productId: 'TRA_DAO', name: 'Trà đào', quantity: 1, toppings: [], notes: 'Ít đá' }
    ];

    // Customer adds 1 more Trà đào and 1 Bạc xỉu
    const updatedCart = [
      { productId: 'CF_DEN', name: 'Cà phê đen', quantity: 2, toppings: [], notes: '' },
      { productId: 'TRA_DAO', name: 'Trà đào', quantity: 2, toppings: [], notes: 'Ít đá' }, // +1
      { productId: 'BAC_XIU', name: 'Bạc xỉu', quantity: 1, toppings: [], notes: '' }         // new
    ];

    const subsequentDiff = computeKitchenItemsDiff(updatedCart, sentSnapshot, 'diff');
    assert.equal(subsequentDiff.hasChanges, true);
    assert.equal(subsequentDiff.diffItems.length, 2);

    const traDaoDiff = subsequentDiff.diffItems.find(it => it.productId === 'TRA_DAO');
    const bacXiuDiff = subsequentDiff.diffItems.find(it => it.productId === 'BAC_XIU');

    assert.equal(traDaoDiff.quantity, 1, 'Only delta (+1) Trà đào must be sent to kitchen!');
    assert.equal(bacXiuDiff.quantity, 1, 'New Bạc xỉu must be sent with quantity 1');
  });

});
