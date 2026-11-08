import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('FEATURE: OrderDetailsModal Kitchen Ticket Print Button & 2-Row Footer', async (t) => {
  const modalPath = path.resolve('src/components/orders/OrderDetailsModal.jsx');
  const modalSrc = fs.readFileSync(modalPath, 'utf-8');

  await t.test('1. Includes Printer icon from lucide-react', () => {
    assert.match(
      modalSrc,
      /import\s*\{[^}]*Printer[^}]*\}\s*from\s*['"]lucide-react['"]/,
      'Must import Printer icon from lucide-react'
    );
  });

  await t.test('2. Implements handlePrintKitchenTicket with auto-save & diff/reprint logic', () => {
    assert.ok(
      modalSrc.includes('handlePrintKitchenTicket'),
      'Must define handlePrintKitchenTicket handler'
    );
    assert.ok(
      modalSrc.includes('computeKitchenItemsToPrint'),
      'Must compute items to print via diff engine'
    );
    assert.ok(
      modalSrc.includes('buildKitchenTicketModel'),
      'Must build kitchen ticket model'
    );
    assert.ok(
      modalSrc.includes('executeKitchenTicketPrint'),
      'Must trigger printer execution'
    );
    assert.ok(
      modalSrc.includes('IN LẠI CHO BẾP'),
      'Must handle fallback reprint tag when all items were already sent'
    );
    assert.ok(
      modalSrc.includes('recordKitchenTicketPrint'),
      'Must record kitchen ticket print and update printed_quantity'
    );
  });

  await t.test('3. Footer implements 2-row layout with amber In phiếu bếp button', () => {
    assert.ok(
      modalSrc.includes('In phiếu bếp'),
      'Must contain text "In phiếu bếp"'
    );
    assert.ok(
      modalSrc.includes('from-amber-500 to-amber-600'),
      'In phiếu bếp button must have amber gradient styling'
    );
    assert.ok(
      modalSrc.includes('aria-label="In phiếu chế biến cho bếp"'),
      'In phiếu bếp button must have correct accessible label'
    );
  });
});
