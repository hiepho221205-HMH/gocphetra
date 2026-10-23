/**
 * GÓC POS — Kitchen & Bar Preparation Ticket Engine Test Suite
 * Automated tests for item signatures, diff computation, ticket models,
 * cumulative snapshot merges, and ESC/POS thermal byte buffers.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateItemSignature,
  normalizeToppingsList,
  computeKitchenItemsDiff,
  mergeSentItems,
  buildKitchenTicketModel,
  DEFAULT_KITCHEN_TICKET_SETTINGS
} from '../src/utils/kitchenTicketEngine.js';
import {
  buildKitchenTicketThermalBytes
} from '../src/utils/bluetoothPrinter.js';

test('Kitchen Ticket Engine — Signature & Normalization', async (t) => {
  await t.test('normalizeToppingsList sorts and cleans string and object toppings deterministically', () => {
    const list1 = ['Trân châu đen', 'Kem Cheese'];
    const list2 = [{ name: 'Kem Cheese' }, { name: 'Trân châu đen' }];
    assert.deepEqual(normalizeToppingsList(list1), ['Kem Cheese', 'Trân châu đen']);
    assert.deepEqual(normalizeToppingsList(list2), ['Kem Cheese', 'Trân châu đen']);
  });

  await t.test('generateItemSignature produces identical signature regardless of topping order', () => {
    const itemA = { id: 'cf-muoi', size: 'L', toppings: ['Kem Cheese', 'Trân châu'], notes: 'Ít đá' };
    const itemB = { id: 'cf-muoi', size: 'L', toppings: ['Trân châu', 'Kem Cheese'], notes: 'ít đá' };
    assert.equal(generateItemSignature(itemA), generateItemSignature(itemB));
  });

  await t.test('generateItemSignature distinguishes different size, toppings, or special notes', () => {
    const base = { id: 'cf-muoi', size: 'M', toppings: [], notes: '' };
    const diffSize = { id: 'cf-muoi', size: 'L', toppings: [], notes: '' };
    const diffNote = { id: 'cf-muoi', size: 'M', toppings: [], notes: 'Không đường' };
    const diffTop = { id: 'cf-muoi', size: 'M', toppings: ['Thạch'], notes: '' };

    assert.notEqual(generateItemSignature(base), generateItemSignature(diffSize));
    assert.notEqual(generateItemSignature(base), generateItemSignature(diffNote));
    assert.notEqual(generateItemSignature(base), generateItemSignature(diffTop));
  });
});

test('Kitchen Ticket Engine — Smart Diff Computation', async (t) => {
  await t.test('Initial order (no previously sent items) returns all items with full quantity', () => {
    const cart = [
      { id: 'item-1', name: 'Cà phê muối', quantity: 2, size: 'L' },
      { id: 'item-2', name: 'Trà sen vàng', quantity: 1, size: 'M' }
    ];

    const result = computeKitchenItemsDiff(cart, [], 'diff');
    assert.equal(result.hasChanges, true);
    assert.equal(result.totalDeltaCount, 3);
    assert.equal(result.diffItems.length, 2);
    assert.equal(result.diffItems[0].quantity, 2);
    assert.equal(result.diffItems[0].isAdditional, false);
    assert.equal(result.diffItems[1].quantity, 1);
  });

  await t.test('Unchanged order returns empty diff (hasChanges: false)', () => {
    const cart = [
      { id: 'item-1', name: 'Cà phê muối', quantity: 2, size: 'L' }
    ];
    const sent = [
      { id: 'item-1', name: 'Cà phê muối', quantity: 2, size: 'L' }
    ];

    const result = computeKitchenItemsDiff(cart, sent, 'diff');
    assert.equal(result.hasChanges, false);
    assert.equal(result.totalDeltaCount, 0);
    assert.equal(result.diffItems.length, 0);
  });

  await t.test('Adding a brand new item only returns the newly added item', () => {
    const sent = [
      { id: 'item-1', name: 'Cà phê muối', quantity: 2, size: 'L' }
    ];
    const cart = [
      { id: 'item-1', name: 'Cà phê muối', quantity: 2, size: 'L' },
      { id: 'item-2', name: 'Espresso sữa non', quantity: 1, size: '' }
    ];

    const result = computeKitchenItemsDiff(cart, sent, 'diff');
    assert.equal(result.hasChanges, true);
    assert.equal(result.totalDeltaCount, 1);
    assert.equal(result.diffItems.length, 1);
    assert.equal(result.diffItems[0].id, 'item-2');
    assert.equal(result.diffItems[0].quantity, 1);
    assert.equal(result.diffItems[0].isAdditional, false);
  });

  await t.test('Increasing item quantity only prints the delta quantity with isAdditional: true', () => {
    const sent = [
      { id: 'item-1', name: 'Cà phê muối', quantity: 2, size: 'L' }
    ];
    // Increased from 2 to 3
    const cart = [
      { id: 'item-1', name: 'Cà phê muối', quantity: 3, size: 'L' }
    ];

    const result = computeKitchenItemsDiff(cart, sent, 'diff');
    assert.equal(result.hasChanges, true);
    assert.equal(result.totalDeltaCount, 1);
    assert.equal(result.diffItems.length, 1);
    assert.equal(result.diffItems[0].quantity, 1); // 3 - 2 = 1
    assert.equal(result.diffItems[0].isAdditional, true);
  });

  await t.test('printMode "all" returns all items in cart even if previously sent', () => {
    const sent = [
      { id: 'item-1', name: 'Cà phê muối', quantity: 2, size: 'L' }
    ];
    const cart = [
      { id: 'item-1', name: 'Cà phê muối', quantity: 2, size: 'L' }
    ];

    const result = computeKitchenItemsDiff(cart, sent, 'all');
    assert.equal(result.hasChanges, true);
    assert.equal(result.totalDeltaCount, 2);
    assert.equal(result.diffItems.length, 1);
    assert.equal(result.diffItems[0].quantity, 2);
  });
});

test('Kitchen Ticket Engine — Cumulative Snapshot Merging', () => {
  const previouslySent = [
    { id: 'item-1', name: 'Cà phê muối', quantity: 2, size: 'L' }
  ];
  const newlyPrinted = [
    { id: 'item-1', name: 'Cà phê muối', quantity: 1, size: 'L' },
    { id: 'item-2', name: 'Trà sen', quantity: 1, size: 'M' }
  ];

  const merged = mergeSentItems(previouslySent, newlyPrinted);
  assert.equal(merged.length, 2);

  const item1 = merged.find(it => it.id === 'item-1');
  assert.equal(item1.quantity, 3); // 2 + 1

  const item2 = merged.find(it => it.id === 'item-2');
  assert.equal(item2.quantity, 1);
});

test('Kitchen Ticket Engine — Ticket Model Strict Isolation & ESC/POS Bytes', async (t) => {
  const diffItems = [
    { id: 'it-1', name: 'Cà phê muối GÓC', size: 'L', quantity: 2, toppings: ['Kem cheese béo mặn'], notes: 'Ít ngọt, nhiều đá' },
    { id: 'it-2', name: 'Trà hoa đậu biếc', size: 'M', quantity: 1, isAdditional: true, toppings: [], notes: '' }
  ];

  const model = buildKitchenTicketModel({
    order: { id: 'ORD-9988', tableName: 'Bàn B02' },
    table: { id: 'tbl-2', name: 'Bàn B02' },
    diffItems,
    settings: {
      kitchenTicketSettings: {
        enabled: true,
        paperWidth: '58mm',
        showTable: true,
        showOrderId: true,
        showTime: true,
        showToppings: true,
        showNotes: true,
        showItemCount: true
      }
    },
    currentUser: { name: 'Nguyễn Văn A' }
  });

  await t.test('Model correctly structures preparation metadata', () => {
    assert.equal(model.tableName, 'Bàn B02');
    assert.equal(model.orderId, 'ORD-9988');
    assert.equal(model.totalQuantity, 3);
    assert.equal(model.items.length, 2);
    assert.equal(model.items[0].name, 'Cà phê muối GÓC');
    assert.equal(model.items[0].toppings[0], 'Kem cheese béo mặn');
    assert.equal(model.items[0].notes, 'Ít ngọt, nhiều đá');
  });

  await t.test('Model strictly contains NO pricing, financial totals, or payment fields', () => {
    assert.equal(model.price, undefined);
    assert.equal(model.subtotal, undefined);
    assert.equal(model.total, undefined);
    assert.equal(model.vietqr, undefined);
    assert.equal(model.wifiPassword, undefined);
  });

  await t.test('buildKitchenTicketThermalBytes generates valid ESC/POS byte sequence', () => {
    const bytes = buildKitchenTicketThermalBytes(model);
    assert.ok(bytes instanceof Uint8Array);
    assert.ok(bytes.length > 50);

    const textDecoder = new TextDecoder('utf-8');
    const textOutput = textDecoder.decode(bytes);

    // Must have Header and Big Table Name
    assert.ok(textOutput.includes('PHIẾU CHẾ BIẾN'), 'Ticket must have title PHIẾU CHẾ BIẾN');
    assert.ok(textOutput.includes('BÀN: BÀN B02'), 'Ticket must include table name');
    assert.ok(textOutput.includes('Cà phê muối GÓC'), 'Ticket must include item name');
    assert.ok(textOutput.includes('Kem cheese béo mặn'), 'Ticket must include toppings');
    assert.ok(textOutput.includes('Ít ngọt, nhiều đá'), 'Ticket must include notes');
    assert.ok(textOutput.includes('x 2'), 'Ticket must include quantity');
    assert.ok(textOutput.includes('TỔNG SỐ LƯỢNG:'), 'Ticket must include total count summary');

    // Strict Negative Security: Must NOT contain financial or payment terms
    assert.ok(!textOutput.includes('VNĐ'), 'Ticket must not contain VNĐ');
    assert.ok(!textOutput.includes('đơn giá'), 'Ticket must not contain unit price');
    assert.ok(!textOutput.includes('Thành tiền'), 'Ticket must not contain line total');
    assert.ok(!textOutput.includes('TỔNG CỘNG TIỀN'), 'Ticket must not contain revenue');
    assert.ok(!textOutput.includes('VietQR'), 'Ticket must not contain VietQR');
  });
});
