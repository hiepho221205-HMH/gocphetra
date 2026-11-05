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
  isSameOrderItem,
  consolidateOrderItems,
  computeKitchenItemsDiff,
  computeKitchenItemsToPrint,
  mergeSentItems,
  buildKitchenTicketModel,
  formatItemSize,
  DEFAULT_KITCHEN_TICKET_SETTINGS
} from '../src/utils/kitchenTicketEngine.js';
import {
  buildKitchenTicketThermalBytes,
  executeKitchenTicketPrint
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

  await t.test('executeKitchenTicketPrint routes browser method to onBrowserFallback', async () => {
    let fallbackCalled = false;
    let fallbackModel = null;
    const result = await executeKitchenTicketPrint({
      ticketModel: model,
      method: 'browser',
      onBrowserFallback: (m) => {
        fallbackCalled = true;
        fallbackModel = m;
      }
    });

    assert.equal(result.success, true);
    assert.equal(fallbackCalled, true);
    assert.equal(fallbackModel.orderId, 'ORD-9988');
  });

  await t.test('executeKitchenTicketPrint in non-Bluetooth environments gracefully falls back to browser', async () => {
    let toastMsg = '';
    let fallbackCalled = false;
    const result = await executeKitchenTicketPrint({
      ticketModel: model,
      method: 'bluetooth',
      showToast: (msg) => {
        toastMsg = msg;
      },
      onBrowserFallback: () => {
        fallbackCalled = true;
      }
    });

    assert.equal(result.success, true);
    assert.equal(result.fallbackToBrowser, true);
    assert.equal(fallbackCalled, true);
    assert.ok(toastMsg.includes('Trình duyệt không hỗ trợ Web Bluetooth'));
  });

  await t.test('Multi-round ordering: detects previous prints and tags ticket with isAdditionalOrder', () => {
    const round1Order = {
      id: 'ORD-101',
      tableName: 'Bàn 01',
      items: [
        { cartItemId: 'it-1', name: 'Cà phê muối', quantity: 2, size: 'L', is_printed: true }
      ]
    };

    // Round 2 items added
    const round2Diff = [
      { cartItemId: 'it-2', name: 'Trà đào cam sả', quantity: 1, size: 'M', is_printed: false }
    ];

    const modelRound2 = buildKitchenTicketModel({
      order: round1Order,
      diffItems: round2Diff
    });

    assert.equal(modelRound2.isAdditionalOrder, true);
    assert.equal(modelRound2.items.length, 1);
    assert.equal(modelRound2.items[0].isAdditional, true);
    assert.equal(modelRound2.totalQuantity, 1);

    const bytesRound2 = buildKitchenTicketThermalBytes(modelRound2);
    const textRound2 = new TextDecoder().decode(bytesRound2);
    assert.ok(textRound2.includes('[MÓN GỌI THÊM]'), 'Additional round ticket must include [MÓN GỌI THÊM]');
    assert.ok(textRound2.includes('Trà đào cam sả'), 'Must include new item');
    assert.ok(!textRound2.includes('Cà phê muối'), 'Must NOT include old item already printed in Round 1');
  });

  await t.test('Print ALL items mode: prints all items from table with [TOÀN BỘ CÁC MÓN] header tag', () => {
    const tableOrder = {
      id: 'ORD-101',
      tableName: 'Bàn 12',
      items: [
        { cartItemId: 'it-1', name: 'Cà phê muối', quantity: 2, size: 'L', printed_quantity: 2 },
        { cartItemId: 'it-2', name: 'Trà đào cam sả', quantity: 1, size: 'M', printed_quantity: 0 }
      ]
    };

    const allItems = tableOrder.items.map((it) => ({
      ...it,
      qtyToPrint: it.quantity,
      quantity: it.quantity
    }));

    const modelAll = buildKitchenTicketModel({
      order: tableOrder,
      diffItems: allItems,
      printMode: 'all',
      ticketTag: 'TOÀN BỘ CÁC MÓN'
    });

    assert.equal(modelAll.ticketTag, 'TOÀN BỘ CÁC MÓN');
    assert.equal(modelAll.items.length, 2);
    assert.equal(modelAll.totalQuantity, 3);

    const bytesAll = buildKitchenTicketThermalBytes(modelAll);
    const textAll = new TextDecoder().decode(bytesAll);
    assert.ok(textAll.includes('[TOÀN BỘ CÁC MÓN]'), 'Thermal bytes must include [TOÀN BỘ CÁC MÓN]');
    assert.ok(textAll.includes('Cà phê muối'), 'Must include item 1');
    assert.ok(textAll.includes('x 2'), 'Must include full qty for item 1');
    assert.ok(textAll.includes('Trà đào cam sả'), 'Must include item 2');
    assert.ok(textAll.includes('x 1'), 'Must include full qty for item 2');
  });
});

test('Kitchen Ticket Engine — Delta Quantity (printed_quantity) Computation', async (t) => {
  await t.test('Round 1: Initial order with printed_quantity=0 calculates exact qtyToPrint', () => {
    const items = [
      { id: '1', name: 'Cà phê muối', quantity: 2, printed_quantity: 0 },
      { id: '2', name: 'Trà sen vàng', quantity: 1, printed_quantity: 0 }
    ];

    const result = computeKitchenItemsToPrint(items);
    assert.equal(result.hasChanges, true);
    assert.equal(result.totalQtyToPrint, 3);
    assert.equal(result.itemsToPrint.length, 2);
    assert.equal(result.itemsToPrint[0].qtyToPrint, 2);
    assert.equal(result.itemsToPrint[0].isAdditional, false);
    assert.equal(result.itemsToPrint[1].qtyToPrint, 1);
  });

  await t.test('All items already printed (printed_quantity === quantity) returns hasChanges: false', () => {
    const items = [
      { id: '1', name: 'Cà phê muối', quantity: 2, printed_quantity: 2 },
      { id: '2', name: 'Trà sen vàng', quantity: 1, printed_quantity: 1 }
    ];

    const result = computeKitchenItemsToPrint(items);
    assert.equal(result.hasChanges, false);
    assert.equal(result.totalQtyToPrint, 0);
    assert.equal(result.itemsToPrint.length, 0);
  });

  await t.test('Round 2: Incrementing existing item quantity from 2 to 3 only prints delta of 1', () => {
    const items = [
      { id: '1', name: 'Cà phê muối', quantity: 3, printed_quantity: 2 },
      { id: '2', name: 'Trà sen vàng', quantity: 1, printed_quantity: 1 }
    ];

    const result = computeKitchenItemsToPrint(items);
    assert.equal(result.hasChanges, true);
    assert.equal(result.totalQtyToPrint, 1);
    assert.equal(result.itemsToPrint.length, 1);
    assert.equal(result.itemsToPrint[0].name, 'Cà phê muối');
    assert.equal(result.itemsToPrint[0].qtyToPrint, 1);
    assert.equal(result.itemsToPrint[0].quantity, 1);
    assert.equal(result.itemsToPrint[0].isAdditional, true);
  });

  await t.test('Round 2: Calling a brand new item plus incrementing existing item', () => {
    const items = [
      { id: '1', name: 'Cà phê muối', quantity: 4, printed_quantity: 2 }, // +2
      { id: '2', name: 'Trà đào cam sả', quantity: 2, printed_quantity: 0 } // +2 brand new
    ];

    const result = computeKitchenItemsToPrint(items);
    assert.equal(result.hasChanges, true);
    assert.equal(result.totalQtyToPrint, 4);
    assert.equal(result.itemsToPrint.length, 2);
    assert.equal(result.itemsToPrint[0].qtyToPrint, 2);
    assert.equal(result.itemsToPrint[0].isAdditional, true);
    assert.equal(result.itemsToPrint[1].qtyToPrint, 2);
    assert.equal(result.itemsToPrint[1].isAdditional, false);
  });

  await t.test('Reduced quantity (quantity < printed_quantity) is excluded from print', () => {
    const items = [
      { id: '1', name: 'Cà phê muối', quantity: 1, printed_quantity: 2 }
    ];

    const result = computeKitchenItemsToPrint(items);
    assert.equal(result.hasChanges, false);
    assert.equal(result.totalQtyToPrint, 0);
    assert.equal(result.itemsToPrint.length, 0);
  });

  await t.test('User scenario: Initial "Cà phê sữa đá x2" then adding 1 more prints ONLY delta "x1", not all previous or zero', () => {
    // 1. Ban đầu trong bàn có cà phê sữa đá x2 (đã in chế biến đợt 1)
    const initialOrderItems = [
      {
        id: 'prod-cf02',
        productId: 'prod-cf02',
        name: 'Cà phê sữa đá',
        size: 'Std',
        toppings: [],
        notes: '',
        quantity: 2,
        printed_quantity: 2
      }
    ];

    // Kiểm tra đợt 1 đã in xong: không in lại
    const checkRound1 = computeKitchenItemsToPrint(initialOrderItems);
    assert.equal(checkRound1.hasChanges, false, 'Không in lại món cũ khi chưa có thay đổi');
    assert.equal(checkRound1.totalQtyToPrint, 0);

    // 2. Thêm 1 cà phê sữa đá trùng món cũ -> quantity tăng lên 3, printed_quantity vẫn là 2
    const round2MergedItems = [
      {
        ...initialOrderItems[0],
        quantity: 3,
        printed_quantity: 2
      }
    ];

    const round2Result = computeKitchenItemsToPrint(round2MergedItems);
    assert.equal(round2Result.hasChanges, true, 'Phải in khi có món gọi thêm');
    assert.equal(round2Result.totalQtyToPrint, 1, 'Chỉ in đúng số lượng mới thêm (1 ly)');
    assert.equal(round2Result.itemsToPrint.length, 1);
    assert.equal(round2Result.itemsToPrint[0].name, 'Cà phê sữa đá');
    assert.equal(round2Result.itemsToPrint[0].qtyToPrint, 1);
    assert.equal(round2Result.itemsToPrint[0].quantity, 1, 'Số lượng trên phiếu chế biến đúng bằng 1');
    assert.equal(round2Result.itemsToPrint[0].totalOrderQuantity, 3, 'Tổng số lượng đơn giữ nguyên 3');
    assert.equal(round2Result.itemsToPrint[0].isAdditional, true, 'Đánh dấu món gọi thêm');

    // Tạo model in và kiểm tra ESC/POS bytes
    const ticketModel = buildKitchenTicketModel({
      order: { id: 'ORD-TEST', tableName: 'Bàn 02' },
      diffItems: round2Result.itemsToPrint
    });
    assert.equal(ticketModel.totalQuantity, 1);
    assert.equal(ticketModel.isAdditionalOrder, true);

    const bytes = buildKitchenTicketThermalBytes(ticketModel);
    const textOutput = new TextDecoder('utf-8').decode(bytes);
    assert.ok(textOutput.includes('Cà phê sữa đá'), 'Phiếu in có tên món');
    assert.ok(textOutput.includes('x 1'), 'Phiếu in chế biến chỉ in x 1');
    assert.ok(!textOutput.includes('x 3'), 'Tuyệt đối KHÔNG in tổng số lượng 3 của toàn bộ món cũ');
    assert.ok(!textOutput.includes('x 2'), 'Tuyệt đối KHÔNG in số lượng 2 cũ');

    // 3. Giả lập in thành công: printed_quantity được cập nhật lên 3
    const afterPrintItems = [
      {
        ...round2MergedItems[0],
        printed_quantity: 3
      }
    ];
    const checkAfterPrint = computeKitchenItemsToPrint(afterPrintItems);
    assert.equal(checkAfterPrint.hasChanges, false, 'Sau khi in xong không in lặp lại');
    assert.equal(checkAfterPrint.totalQtyToPrint, 0);
  });

  await t.test('Handling duplicate lines across separate items array rows via consolidateOrderItems', () => {
    // Trường hợp món bị phân làm 2 dòng (dòng 1 đã in x2, dòng 2 mới thêm x1)
    const separateRows = [
      { id: 'cf', productId: 'cf', name: 'Cà phê sữa đá', size: 'Std', quantity: 2, printed_quantity: 2 },
      { id: 'cf', productId: 'cf', name: 'Cà phê sữa đá', size: 'Std', quantity: 1, printed_quantity: 0 }
    ];

    const consolidated = consolidateOrderItems(separateRows);
    assert.equal(consolidated.length, 1);
    assert.equal(consolidated[0].quantity, 3);
    assert.equal(consolidated[0].printed_quantity, 2);

    const result = computeKitchenItemsToPrint(separateRows);
    assert.equal(result.hasChanges, true);
    assert.equal(result.totalQtyToPrint, 1);
    assert.equal(result.itemsToPrint.length, 1);
    assert.equal(result.itemsToPrint[0].qtyToPrint, 1);
  });

  await t.test('isSameOrderItem matches items with identical config and distinguishes variations', () => {
    const itemA = { productId: 'cf', name: 'Cà phê sữa đá', size: 'Std', notes: '', toppings: ['Trân châu'] };
    const itemB = { id: 'cf', name: 'Cà phê sữa đá', size: 'std', note: '', toppings: [{ name: 'Trân châu' }] };
    assert.equal(isSameOrderItem(itemA, itemB), true, 'Phải nhận diện cùng món dù khác cấu trúc id/productId hoặc hoa/thường');

    const itemDiffSize = { ...itemA, size: 'L' };
    assert.equal(isSameOrderItem(itemA, itemDiffSize), false, 'Khác size là 2 dòng riêng');

    const itemDiffNote = { ...itemA, notes: 'Ít đường' };
    assert.equal(isSameOrderItem(itemA, itemDiffNote), false, 'Khác ghi chú là 2 dòng riêng');
  });
});

test('Kitchen Ticket Engine — Size Formatting (Suppress Std/Mặc định, Keep Explicit Sizes)', async (t) => {
  await t.test('formatItemSize returns empty string for standard/default size labels', () => {
    assert.equal(formatItemSize('Std'), '');
    assert.equal(formatItemSize('std'), '');
    assert.equal(formatItemSize('(Std)'), '');
    assert.equal(formatItemSize('Standard'), '');
    assert.equal(formatItemSize('(Standard)'), '');
    assert.equal(formatItemSize('Mặc định'), '');
    assert.equal(formatItemSize('(Mặc định)'), '');
    assert.equal(formatItemSize('mac dinh'), '');
    assert.equal(formatItemSize('default'), '');
    assert.equal(formatItemSize('Default'), '');
    assert.equal(formatItemSize(''), '');
    assert.equal(formatItemSize(null), '');
    assert.equal(formatItemSize(undefined), '');
  });

  await t.test('formatItemSize preserves explicit size labels', () => {
    assert.equal(formatItemSize('S'), 'S');
    assert.equal(formatItemSize('M'), 'M');
    assert.equal(formatItemSize('(M)'), 'M');
    assert.equal(formatItemSize('L'), 'L');
    assert.equal(formatItemSize('XL'), 'XL');
    assert.equal(formatItemSize('Ly lớn'), 'Ly lớn');
  });

  await t.test('buildKitchenTicketModel strips standard size from model and retains explicit size', () => {
    const diffItems = [
      { id: 'it-1', name: 'Nước dừa', size: 'Std', quantity: 2 },
      { id: 'it-2', name: 'Espresso nóng', size: 'Mặc định', quantity: 1 },
      { id: 'it-3', name: 'Trà đào cam sả', size: 'M', quantity: 1 }
    ];

    const model = buildKitchenTicketModel({
      order: { id: 'ORD-936241', tableName: 'Bàn 01' },
      table: { id: 'tbl-1', name: 'Bàn 01' },
      diffItems
    });

    assert.equal(model.items[0].name, 'Nước dừa');
    assert.equal(model.items[0].size, '', 'Nước dừa (Std) phải được chuẩn hóa thành size rỗng');
    assert.equal(model.items[0].rawSize, 'Std');

    assert.equal(model.items[1].name, 'Espresso nóng');
    assert.equal(model.items[1].size, '', 'Espresso nóng (Mặc định) phải được chuẩn hóa thành size rỗng');
    assert.equal(model.items[1].rawSize, 'Mặc định');

    assert.equal(model.items[2].name, 'Trà đào cam sả');
    assert.equal(model.items[2].size, 'M', 'Trà đào cam sả size M phải được giữ nguyên');
  });

  await t.test('buildKitchenTicketThermalBytes prints clean item names without (Std) on thermal tickets', () => {
    const diffItems = [
      { id: 'it-1', name: 'Nước dừa', size: 'Std', quantity: 2 },
      { id: 'it-2', name: 'Trà đào cam sả', size: 'M', quantity: 1 }
    ];

    const model = buildKitchenTicketModel({
      order: { id: 'ORD-936241', tableName: 'Bàn 01' },
      table: { id: 'tbl-1', name: 'Bàn 01' },
      diffItems
    });

    const bytes = buildKitchenTicketThermalBytes(model);
    const textOutput = new TextDecoder('utf-8').decode(bytes);

    // Must contain clean 'Nước dừa' and must NOT contain 'Nước dừa (Std)' or 'Nước dừa (Mặc định)'
    assert.ok(textOutput.includes('Nước dừa'), 'Ticket must include Nước dừa');
    assert.ok(!textOutput.includes('Nước dừa (Std)'), 'Ticket must NOT contain Nước dừa (Std)');
    assert.ok(!textOutput.includes('Nước dừa (Mặc định)'), 'Ticket must NOT contain Nước dừa (Mặc định)');

    // Must preserve 'Trà đào cam sả (M)'
    assert.ok(textOutput.includes('Trà đào cam sả (M)'), 'Ticket must include Trà đào cam sả (M)');
  });
});
