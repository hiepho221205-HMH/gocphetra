import { describe, it, expect } from 'vitest';
import { validateOrder, validatePayment } from '../../src/utils/validators.js';
import { reconcileTablesAndOrders, rolloverPastUnpaidOrders } from '../../src/utils/reconciler.js';

describe('Zod Validation for GÓC POS', () => {
  it('validates a valid order object successfully', () => {
    const rawOrder = {
      id: 'ORD-999001',
      tableId: 'B01',
      tableName: 'Bàn 1',
      status: 'serving',
      cashier: 'Trần Mai',
      customerCount: 2,
      items: [
        {
          productId: 'prod-1',
          name: 'Cà phê Đen Đá',
          quantity: 2,
          unitPrice: 25000,
          basePrice: 25000,
          lineTotal: 50000
        }
      ],
      discountPercent: 0,
      surcharge: 0,
      subtotal: 50000,
      total: 50000,
      paidAmount: 0,
      remainingAmount: 50000
    };

    const result = validateOrder(rawOrder);
    expect(result.success).toBe(true);
    expect(result.data.total).toBe(50000);
  });

  it('rejects an order with invalid status', () => {
    const rawOrder = {
      id: 'ORD-999002',
      status: 'invalid_status',
      items: []
    };
    const result = validateOrder(rawOrder);
    expect(result.success).toBe(false);
  });

  it('validates a payment record', () => {
    const payment = {
      id: 'PAY-12345',
      orderId: 'ORD-999001',
      amount: 50000,
      paymentMethod: 'cash',
      paymentStatus: 'completed',
      paidAt: new Date().toISOString(),
      businessDate: '2026-10-21',
      cashierId: 'staff-01'
    };
    const result = validatePayment(payment);
    expect(result.success).toBe(true);
  });
});

describe('State Reconciler & Rollover', () => {
  it('correctly associates active order with occupied table', () => {
    const tables = [
      { id: 'B01', name: 'Bàn 1', status: 'occupied', activeOrderId: 'ORD-101' },
      { id: 'B02', name: 'Bàn 2', status: 'empty', activeOrderId: null }
    ];
    const orders = {
      'ORD-101': {
        id: 'ORD-101',
        tableId: 'B01',
        status: 'serving',
        items: [{ productId: 'p1', name: 'Trà', quantity: 1, unitPrice: 20000, lineTotal: 20000 }]
      }
    };

    const res = reconcileTablesAndOrders(tables, orders, []);
    expect(res.reconciledTables.find(t => t.id === 'B01').status).toBe('occupied');
    expect(res.reconciledOrders['ORD-101']).toBeDefined();
  });
});
