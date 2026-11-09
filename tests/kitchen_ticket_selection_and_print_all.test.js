import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('FEATURE: Kitchen Print Selection Modal (Chọn món hoặc In toàn bộ cho Bếp)', async (t) => {
  const modalPath = path.resolve('src/components/orders/OrderDetailsModal.jsx');
  const modalSrc = fs.readFileSync(modalPath, 'utf-8');

  const enginePath = path.resolve('src/utils/kitchenTicketEngine.js');
  const engineSrc = fs.readFileSync(enginePath, 'utf-8');

  await t.test('1. OrderDetailsModal defines state and open handler for Kitchen Print Selection Modal', () => {
    assert.ok(
      modalSrc.includes('isKitchenPrintModalOpen'),
      'Must maintain isKitchenPrintModalOpen boolean state'
    );
    assert.ok(
      modalSrc.includes('printSelectionMap'),
      'Must maintain printSelectionMap state for items selection & qty'
    );
    assert.ok(
      modalSrc.includes('handleOpenKitchenPrintModal'),
      'Must define handleOpenKitchenPrintModal to initialize selection map'
    );
  });

  await t.test('2. Implements quick scope filters: Chỉ món mới, Tất cả, and Bỏ chọn', () => {
    assert.ok(
      modalSrc.includes('handleSelectOnlyUnsent'),
      'Must implement handleSelectOnlyUnsent to filter only unprinted items'
    );
    assert.ok(
      modalSrc.includes('handleSelectAllForPrint'),
      'Must implement handleSelectAllForPrint to select all items'
    );
    assert.ok(
      modalSrc.includes('handleDeselectAllForPrint'),
      'Must implement handleDeselectAllForPrint to clear selection'
    );
    assert.ok(
      modalSrc.includes('⚡ Chỉ món mới'),
      'Must render quick filter button for unprinted items'
    );
    assert.ok(
      modalSrc.includes('Tất cả ('),
      'Must render quick filter button for all items'
    );
  });

  await t.test('3. Supports quantity stepper per item for partial kitchen printing', () => {
    assert.ok(
      modalSrc.includes('handleStepPrintQty'),
      'Must implement handleStepPrintQty handler'
    );
    assert.ok(
      modalSrc.includes('handleToggleItemSelection'),
      'Must implement handleToggleItemSelection handler'
    );
    assert.ok(
      modalSrc.includes('Math.min(maxQty, Math.max(1, currentQty + delta))'),
      'Must clamp print quantity between 1 and total ordered quantity'
    );
  });

  await t.test('4. Provides dual execution actions: In toàn bộ and In món đã chọn', () => {
    assert.ok(
      modalSrc.includes('handleExecuteKitchenPrint({ isAll: true })'),
      'Must provide trigger for In toàn bộ'
    );
    assert.ok(
      modalSrc.includes('handleExecuteKitchenPrint({ isAll: false })'),
      'Must provide trigger for In món đã chọn'
    );
    assert.ok(
      modalSrc.includes('In toàn bộ'),
      'Must render button labeled In toàn bộ'
    );
    assert.ok(
      modalSrc.includes('In đã chọn ('),
      'Must render button labeled In đã chọn with selected count'
    );
  });

  await t.test('5. Auto-saves table order before sending kitchen print command', () => {
    const fnBody = modalSrc.match(/handleExecuteKitchenPrint[\s\S]*?finally/)?.[0] || '';
    assert.ok(
      fnBody.includes('saveOrderForTable(table.id, items)'),
      'Must call saveOrderForTable before executeKitchenTicketPrint'
    );
    assert.ok(
      fnBody.indexOf('saveOrderForTable') < fnBody.indexOf('executeKitchenTicketPrint'),
      'saveOrderForTable must execute prior to executeKitchenTicketPrint'
    );
  });

  await t.test('6. Accurately updates item badge display in table order details', () => {
    assert.ok(
      modalSrc.includes('Đã gửi bếp'),
      'Must render "Đã gửi bếp" badge when fully printed'
    );
    assert.ok(
      modalSrc.includes('Đã gửi {printedQty}/{qty}'),
      'Must render fraction badge when partially printed'
    );
    assert.ok(
      modalSrc.includes('Món mới'),
      'Must render "Món mới" badge when unprinted'
    );
  });

  await t.test('7. Updates printed_quantity and persists print record in PosContext', () => {
    assert.ok(
      modalSrc.includes('recordKitchenTicketPrint(table.id, updatedItems, model)'),
      'Must call recordKitchenTicketPrint with updated items'
    );
    assert.ok(
      modalSrc.includes('Math.min(Number(it.quantity) || 1, currentPrinted + addQty)'),
      'Must increment printed_quantity by qtyToPrint without exceeding total'
    );
  });

  await t.test('8. kitchenTicketEngine buildKitchenTicketModel supports itemsToPrint & diffItems', () => {
    assert.ok(
      engineSrc.includes('itemsToPrint = null'),
      'buildKitchenTicketModel must accept itemsToPrint'
    );
    assert.ok(
      engineSrc.includes('sourceItems = (itemsToPrint && Array.isArray(itemsToPrint) && itemsToPrint.length > 0)'),
      'Must prioritize itemsToPrint over diffItems'
    );
    assert.ok(
      engineSrc.includes('reprintNote'),
      'buildKitchenTicketModel must support reprintNote'
    );
  });
});
