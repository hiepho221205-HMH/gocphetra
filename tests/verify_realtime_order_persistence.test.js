import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileTablesAndOrders, rolloverPastUnpaidOrders } from '../src/utils/reconciler.js';
import { getVietnamDateString, getVietnamTodayString } from '../src/utils/dateTime.js';

test('Verification: Realtime Order Persistence & Anti-Wipeout Safeguards', async (t) => {
  await t.test('1. Timezone Boundary: Late-night Vietnam orders (UTC previous day) are NOT wiped out on startup rollover', () => {
    // Current VN date: 2026-10-22
    const todayVn = getVietnamTodayString();
    
    // Simulate order created at 2026-10-22 01:30 AM VN time (which is 2026-10-21 18:30 UTC)
    const lateNightOrder = {
      id: 'ORD-VN-NIGHT',
      tableId: 'B01',
      tableName: 'Bàn 01',
      status: 'serving',
      createdAt: '2026-10-21T18:30:00.000Z', // UTC ISO string with yesterday's UTC date
      items: [{ name: 'Cà phê muối', quantity: 2, lineTotal: 70000 }],
      total: 70000,
      paidAmount: 0,
      remainingAmount: 70000,
      version: 1
    };

    const tables = [
      { id: 'B01', name: 'Bàn 01', status: 'occupied', activeOrderId: 'ORD-VN-NIGHT', customerCount: 2 }
    ];
    const orders = { 'ORD-VN-NIGHT': lateNightOrder };
    const history = [];

    // Prior to fix, substring(0, 10) gave '2026-10-21', triggering a false rollover and destroying the order!
    // With getVietnamDateString, '2026-10-21T18:30:00.000Z' correctly resolves to '2026-10-22' (today).
    const rolled = rolloverPastUnpaidOrders(tables, orders, history, todayVn);

    assert.equal(rolled.rolledOrdersCount, 0, 'Late night order created today in VN time must NOT be rolled over');
    assert.ok(rolled.orders['ORD-VN-NIGHT'], 'Order must remain active in orders');
    assert.equal(rolled.tables[0].status, 'occupied', 'Table must remain occupied');
    assert.equal(rolled.tables[0].activeOrderId, 'ORD-VN-NIGHT', 'Table must keep its activeOrderId');
  });

  await t.test('2. Self-Healing Reconciler: Tables marked empty by mistake do not cancel serving orders with items', () => {
    const tableOutOfSync = { id: 'B02', name: 'Bàn 02', status: 'empty', activeOrderId: null };
    const activeOrder = {
      id: 'ORD-SAFE-01',
      tableId: 'B02',
      tableName: 'Bàn 02',
      status: 'serving',
      items: [{ name: 'Bạc xỉu', quantity: 1, lineTotal: 32000 }],
      total: 32000
    };

    const reconciled = reconcileTablesAndOrders([tableOutOfSync], { 'ORD-SAFE-01': activeOrder }, []);

    // Reconciler self-heals: table is restored to occupied, order is preserved
    assert.equal(reconciled.reconciledTables[0].status, 'occupied', 'Table must self-heal to occupied');
    assert.equal(reconciled.reconciledTables[0].activeOrderId, 'ORD-SAFE-01', 'Table activeOrderId must point to order');
    assert.ok(reconciled.reconciledOrders['ORD-SAFE-01'], 'Order must NOT be cancelled or wiped out');
    assert.equal(reconciled.reconciledOrders['ORD-SAFE-01'].status, 'serving');
  });

  await t.test('3. Realtime Broadcast Protocol: Instant delivery between devices', async () => {
    // Mock Broadcast channel
    const peers = [];
    const createMockPeer = (id) => ({
      id,
      inbox: [],
      onBroadcast(event, cb) {
        this.handler = cb;
      },
      broadcast(event, payload) {
        peers.forEach(p => {
          if (p.id !== id && p.handler) {
            p.handler({ payload });
          }
        });
      }
    });

    const staff1 = createMockPeer('staff1');
    const staff2 = createMockPeer('staff2');
    const admin = createMockPeer('admin');
    peers.push(staff1, staff2, admin);

    let staff2Received = null;
    let adminReceived = null;

    staff2.onBroadcast('order_sync', (msg) => { staff2Received = msg.payload; });
    admin.onBroadcast('order_sync', (msg) => { adminReceived = msg.payload; });

    // Staff 1 creates order on B03
    const orderPayload = {
      order: { id: 'ORD-B03', tableId: 'B03', tableName: 'Bàn 03', status: 'serving', items: [{ name: 'Trà đào' }] },
      table: { id: 'B03', status: 'occupied', activeOrderId: 'ORD-B03' },
      senderId: 'staff1'
    };

    staff1.broadcast('order_sync', orderPayload);

    assert.ok(staff2Received, 'Staff 2 must receive order_sync instantly');
    assert.equal(staff2Received.order.id, 'ORD-B03');
    assert.ok(adminReceived, 'Admin must receive order_sync instantly');
    assert.equal(adminReceived.table.status, 'occupied');
  });
});
