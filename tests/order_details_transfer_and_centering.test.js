import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('FEATURE: OrderDetailsModal Transfer Table, Centered Popup & Zero Lag Animation Removal', async (t) => {
  const modalPath = path.resolve('src/components/orders/OrderDetailsModal.jsx');
  const modalSrc = fs.readFileSync(modalPath, 'utf-8');

  await t.test('1. Replaced "Thanh toán" with "Chuyển bàn" button in footer row 2', () => {
    assert.ok(
      modalSrc.includes('Chuyển bàn'),
      'Must contain button labeled "Chuyển bàn"'
    );
    assert.ok(
      modalSrc.includes('ArrowRightLeft'),
      'Must import and use ArrowRightLeft icon for transfer'
    );
    assert.ok(
      modalSrc.includes('aria-label="Chuyển đơn sang bàn trống khác"'),
      'Chuyển bàn button must have accessible aria-label'
    );
    assert.ok(
      modalSrc.includes('bg-gradient-to-r from-blue-600 to-indigo-700'),
      'Chuyển bàn button must have distinct blue/indigo gradient styling'
    );
  });

  await t.test('2. Implements inline table transfer mode with empty tables picker', () => {
    assert.ok(
      modalSrc.includes('isTransferMode'),
      'Must maintain isTransferMode state'
    );
    assert.ok(
      modalSrc.includes('selectedTargetTableId'),
      'Must maintain selectedTargetTableId state'
    );
    assert.ok(
      modalSrc.includes('handleOpenTransferMode'),
      'Must define handleOpenTransferMode handler'
    );
    assert.ok(
      modalSrc.includes('handleConfirmTransfer'),
      'Must define handleConfirmTransfer handler'
    );
    assert.ok(
      modalSrc.includes('transferTable(table.id, selectedTargetTableId)'),
      'Must call PosContext transferTable method'
    );
    assert.ok(
      modalSrc.includes('Hiện không còn bàn trống nào trong quán!'),
      'Must provide graceful fallback when no empty tables are available'
    );
  });

  await t.test('3. Modal popup is centered vertically and horizontally on all viewports', () => {
    assert.ok(
      modalSrc.includes('flex items-center justify-center'),
      'Backdrop must use items-center and justify-center'
    );
    assert.ok(
      modalSrc.includes('rounded-[28px]'),
      'Card must have uniform 28px rounded corners on all sides'
    );
    assert.ok(
      !modalSrc.includes('items-end sm:items-center'),
      'Must NOT use items-end mobile bottom-sheet styling'
    );
    assert.ok(
      !modalSrc.includes('rounded-b-none'),
      'Must NOT use rounded-b-none bottom-sheet styling'
    );
  });

  await t.test('4. Framer motion animations completely removed to eliminate lag', () => {
    assert.ok(
      !modalSrc.includes('motion.div'),
      'Must not use motion.div in OrderDetailsModal'
    );
    assert.ok(
      !modalSrc.includes('motion.button'),
      'Must not use motion.button in OrderDetailsModal'
    );
    assert.ok(
      !modalSrc.includes('AnimatePresence'),
      'Must not import or use AnimatePresence in OrderDetailsModal'
    );
  });
});
