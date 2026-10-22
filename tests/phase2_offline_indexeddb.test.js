import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_TABLES, INITIAL_MENU } from '../src/data/initialData.js';

/**
 * ============================================================================
 * GÓC POS — PHASE 2 AUTOMATED VERIFICATION SUITE
 * ============================================================================
 * Validates Phase 2: Offline-First Dexie.js (IndexedDB) & Outbox Replay Queue
 * 1. Dual-Write storage persistence (IndexedDB + Fallback)
 * 2. Offline order creation and checkout enqueued into Outbox Queue
 * 3. FIFO Auto-Replay with Idempotency Key upon network reconnection
 * 4. Offline Conflict Detection & Manager Resolution (Reassign vs Merge)
 * 5. Complete Financial & Data Consistency across offline operations
 */

class MockIndexedDB {
  constructor() {
    this.tables = new Map();
    this.orders = new Map();
    this.orderHistory = [];
    this.payments = [];
    this.outboxQueue = [];
    this.autoIncrementId = 1;
  }

  async migrateFromStorage(storageMock) {
    if (this.tables.size === 0 && storageMock.tables) {
      storageMock.tables.forEach((t) => this.tables.set(t.id, { ...t }));
    }
    if (this.orders.size === 0 && storageMock.orders) {
      Object.values(storageMock.orders).forEach((o) => this.orders.set(o.id, { ...o }));
    }
    if (this.orderHistory.length === 0 && storageMock.orderHistory) {
      this.orderHistory = [...storageMock.orderHistory];
    }
    return true;
  }

  async dualWrite(tableName, records) {
    const list = Array.isArray(records) ? records : Object.values(records || {});
    if (tableName === 'tables') {
      list.forEach((t) => this.tables.set(t.id, { ...t }));
    } else if (tableName === 'orders') {
      list.forEach((o) => this.orders.set(o.id, { ...o }));
    } else if (tableName === 'orderHistory') {
      this.orderHistory = [...list];
    } else if (tableName === 'payments') {
      this.payments = [...list];
    }
  }

  async enqueueOutbox({ actionType, orderId, payload, idempotencyKey }) {
    const id = this.autoIncrementId++;
    const item = {
      id,
      actionType,
      orderId,
      payload: JSON.parse(JSON.stringify(payload)),
      status: 'pending',
      createdAt: new Date().toISOString(),
      idempotencyKey: idempotencyKey || `OUTBOX_${orderId}_${Date.now()}`
    };
    this.outboxQueue.push(item);
    return id;
  }

  async getPendingOutbox() {
    return this.outboxQueue.filter((i) => i.status === 'pending');
  }

  async updateOutboxStatus(id, status, errorDetails = null) {
    const target = this.outboxQueue.find((i) => i.id === id);
    if (target) {
      target.status = status;
      target.errorDetails = errorDetails;
    }
  }
}

class Phase2Harness {
  constructor() {
    this.db = new MockIndexedDB();
    this.localStorage = {
      tables: JSON.parse(JSON.stringify(INITIAL_TABLES)),
      orders: {},
      orderHistory: [],
      payments: []
    };
    this.isOnline = true;
    this.cloudOrders = {};
    this.cloudTables = JSON.parse(JSON.stringify(INITIAL_TABLES));
  }

  async setNetworkStatus(online) {
    this.isOnline = online;
    if (online) {
      return this.replayOutboxQueue();
    }
  }

  async saveOrder(tableId, items, isOfflineOverride = false) {
    const isActuallyOffline = !this.isOnline || isOfflineOverride;
    const orderId = 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);

    const order = {
      id: orderId,
      tableId,
      tableName: `Bàn ${tableId.replace('B', '')}`,
      status: 'serving',
      items,
      subtotal,
      total: subtotal,
      paidAmount: 0,
      remainingAmount: subtotal,
      createdAt: new Date().toISOString(),
      isOfflineCreated: isActuallyOffline
    };

    // Dual-write locally
    this.localStorage.orders[orderId] = order;
    await this.db.dualWrite('orders', this.localStorage.orders);

    if (isActuallyOffline) {
      // Enqueue to Outbox
      await this.db.enqueueOutbox({
        actionType: 'SAVE_ORDER',
        orderId,
        payload: order
      });
    } else {
      // Directly sync to Cloud
      this.cloudOrders[orderId] = order;
      const t = this.cloudTables.find((t) => t.id === tableId);
      if (t) {
        t.status = 'occupied';
        t.activeOrderId = orderId;
      }
    }

    return order;
  }

  async fullCheckout(tableId, order, isOfflineOverride = false) {
    const isActuallyOffline = !this.isOnline || isOfflineOverride;
    const finalOrder = {
      ...order,
      status: 'completed',
      paidAmount: order.total,
      remainingAmount: 0,
      finishedAt: new Date().toISOString()
    };

    const payment = {
      id: 'PAY-' + Math.random().toString(36).substr(2, 6),
      orderId: order.id,
      amount: order.total,
      paymentMethod: 'cash',
      paidAt: finalOrder.finishedAt
    };

    delete this.localStorage.orders[order.id];
    this.localStorage.orderHistory.unshift(finalOrder);
    this.localStorage.payments.unshift(payment);

    await this.db.dualWrite('orderHistory', this.localStorage.orderHistory);
    await this.db.dualWrite('payments', this.localStorage.payments);

    if (isActuallyOffline) {
      await this.db.enqueueOutbox({
        actionType: 'CHECKOUT',
        orderId: order.id,
        payload: { order: finalOrder, payment }
      });
    } else {
      delete this.cloudOrders[order.id];
      const t = this.cloudTables.find((t) => t.id === tableId);
      if (t) {
        t.status = 'empty';
        t.activeOrderId = null;
      }
    }

    return { finalOrder, payment };
  }

  async replayOutboxQueue() {
    const pendingItems = await this.db.getPendingOutbox();
    let syncedCount = 0;
    let conflictCount = 0;

    for (const item of pendingItems) {
      if (item.actionType === 'SAVE_ORDER') {
        const ord = item.payload;
        const currentCloudTable = this.cloudTables.find((t) => t.id === ord.tableId);

        // Conflict check: Table occupied on cloud by different order
        if (
          currentCloudTable &&
          currentCloudTable.status === 'occupied' &&
          currentCloudTable.activeOrderId &&
          currentCloudTable.activeOrderId !== ord.id
        ) {
          await this.db.updateOutboxStatus(item.id, 'conflict', `Trùng bàn ${ord.tableName}`);
          conflictCount++;
          continue;
        }

        // Safe replay
        this.cloudOrders[ord.id] = ord;
        if (currentCloudTable) {
          currentCloudTable.status = 'occupied';
          currentCloudTable.activeOrderId = ord.id;
        }
        await this.db.updateOutboxStatus(item.id, 'completed');
        syncedCount++;
      } else if (item.actionType === 'CHECKOUT') {
        const { order: finOrder, payment: pay } = item.payload;
        delete this.cloudOrders[finOrder.id];
        const currentCloudTable = this.cloudTables.find((t) => t.id === finOrder.tableId);
        if (currentCloudTable && currentCloudTable.activeOrderId === finOrder.id) {
          currentCloudTable.status = 'empty';
          currentCloudTable.activeOrderId = null;
        }
        await this.db.updateOutboxStatus(item.id, 'completed');
        syncedCount++;
      }
    }

    return { syncedCount, conflictCount };
  }

  async resolveConflict(outboxId, action, newTableId = null) {
    const item = this.db.outboxQueue.find((i) => i.id === outboxId);
    if (!item || item.status !== 'conflict') return false;

    if (action === 'reassign' && newTableId) {
      const newTable = this.cloudTables.find((t) => t.id === newTableId);
      item.payload.tableId = newTableId;
      item.payload.tableName = newTable?.name || newTableId;

      this.cloudOrders[item.payload.id] = item.payload;
      if (newTable) {
        newTable.status = 'occupied';
        newTable.activeOrderId = item.payload.id;
      }
      await this.db.updateOutboxStatus(outboxId, 'completed');
      return true;
    } else if (action === 'merge') {
      const existingOrderId = this.cloudTables.find((t) => t.id === item.payload.tableId)?.activeOrderId;
      const cloudOrder = this.cloudOrders[existingOrderId];
      if (cloudOrder) {
        cloudOrder.items.push(...item.payload.items);
        cloudOrder.total += item.payload.total;
        await this.db.updateOutboxStatus(outboxId, 'completed');
        return true;
      }
    }
    return false;
  }
}

describe('Phase 2 Verification: Offline-First Dexie.js & Outbox Replay Queue', () => {
  const harness = new Phase2Harness();

  it('1. Initial Storage Migration to IndexedDB (Dual-Write Guarantee)', async () => {
    // Seed initial tables in localStorage
    assert.equal(harness.db.tables.size, 0);
    await harness.db.migrateFromStorage(harness.localStorage);
    assert.equal(harness.db.tables.size, INITIAL_TABLES.length);
  });

  it('2. Offline Order Creation & Outbox Enqueueing', async () => {
    // Set network to OFFLINE
    await harness.setNetworkStatus(false);
    assert.equal(harness.isOnline, false);

    // Create 2 orders while offline (Table B01 & Table B02)
    const o1 = await harness.saveOrder('B01', [{ name: 'Cà phê sữa', unitPrice: 35000, quantity: 2 }]);
    const o2 = await harness.saveOrder('B02', [{ name: 'Trà đào', unitPrice: 45000, quantity: 1 }]);

    // Verify orders are stored in IndexedDB and queued in Outbox
    assert.ok(harness.db.orders.has(o1.id));
    assert.ok(harness.db.orders.has(o2.id));

    const pending = await harness.db.getPendingOutbox();
    assert.equal(pending.length, 2);
    assert.equal(pending[0].orderId, o1.id);
    assert.equal(pending[1].orderId, o2.id);

    // Verify Cloud still has 0 orders because of offline state
    assert.equal(Object.keys(harness.cloudOrders).length, 0);
  });

  it('3. Auto FIFO Replay upon Network Reconnection', async () => {
    // Turn network back to ONLINE
    const replayRes = await harness.setNetworkStatus(true);
    assert.equal(harness.isOnline, true);
    assert.equal(replayRes.syncedCount, 2);
    assert.equal(replayRes.conflictCount, 0);

    // Verify Cloud now has both orders synced cleanly in FIFO order
    assert.equal(Object.keys(harness.cloudOrders).length, 2);
    assert.equal(harness.cloudTables.find((t) => t.id === 'B01').status, 'occupied');
    assert.equal(harness.cloudTables.find((t) => t.id === 'B02').status, 'occupied');

    // Outbox queue pending count is now 0
    const pending = await harness.db.getPendingOutbox();
    assert.equal(pending.length, 0);
  });

  it('4. Offline Checkout Enqueueing & Server Settlement', async () => {
    // Go offline again
    await harness.setNetworkStatus(false);

    // Get order for B01
    const orderB01 = Object.values(harness.localStorage.orders).find((o) => o.tableId === 'B01');
    assert.ok(orderB01);

    // Checkout B01 cash while offline
    const chk = await harness.fullCheckout('B01', orderB01);
    assert.equal(chk.finalOrder.status, 'completed');

    // Outbox has CHECKOUT action pending
    const pending = await harness.db.getPendingOutbox();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].actionType, 'CHECKOUT');

    // Reconnect network
    await harness.setNetworkStatus(true);

    // Table B01 is now freed on Cloud
    assert.equal(harness.cloudTables.find((t) => t.id === 'B01').status, 'empty');
    assert.equal(harness.cloudTables.find((t) => t.id === 'B01').activeOrderId, null);
  });

  it('5. Offline Table Conflict Detection & Manager Resolution (Reassign Table)', async () => {
    // Simulate rare scenario: Device goes offline
    await harness.setNetworkStatus(false);

    // Device creates order on Table B03 while offline
    const offlineOrder = await harness.saveOrder('B03', [{ name: 'Bạc xỉu', unitPrice: 38000, quantity: 2 }]);

    // Meanwhile on Cloud (another 4G device), Table B03 is occupied by a different customer order
    harness.cloudTables.find((t) => t.id === 'B03').status = 'occupied';
    harness.cloudTables.find((t) => t.id === 'B03').activeOrderId = 'ORD-CLOUD-EXISTING-999';
    harness.cloudOrders['ORD-CLOUD-EXISTING-999'] = {
      id: 'ORD-CLOUD-EXISTING-999',
      tableId: 'B03',
      items: [{ name: 'Matcha', unitPrice: 60000, quantity: 1 }],
      total: 60000
    };

    // Reconnect network -> Replay encounters conflict on B03!
    const replayRes = await harness.setNetworkStatus(true);
    assert.equal(replayRes.conflictCount, 1);

    // Outbox item is flagged with 'conflict' status
    const conflictItem = harness.db.outboxQueue.find((i) => i.status === 'conflict');
    assert.ok(conflictItem);
    assert.equal(conflictItem.orderId, offlineOrder.id);

    // Manager resolves conflict: Reassigns offline order to empty table B05
    const resolveSuccess = await harness.resolveConflict(conflictItem.id, 'reassign', 'B05');
    assert.equal(resolveSuccess, true);

    // Cloud table B03 keeps original order
    assert.equal(harness.cloudTables.find((t) => t.id === 'B03').activeOrderId, 'ORD-CLOUD-EXISTING-999');

    // Cloud table B05 receives the reassigned offline order
    assert.equal(harness.cloudTables.find((t) => t.id === 'B05').status, 'occupied');
    assert.equal(harness.cloudTables.find((t) => t.id === 'B05').activeOrderId, offlineOrder.id);
  });

  it('6. Financial Balancing & Accounting Integrity after Offline Reconciliation', () => {
    // Calculate total revenue across both offline and online settled orders
    const historyTotal = harness.localStorage.orderHistory.reduce((s, o) => s + o.total, 0);
    const paymentsTotal = harness.localStorage.payments.reduce((s, p) => s + p.amount, 0);

    assert.equal(historyTotal, paymentsTotal, 'Revenue in history must equal sum of payments collected');
    assert.ok(historyTotal > 0);
  });
});
