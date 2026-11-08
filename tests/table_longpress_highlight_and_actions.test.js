import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('FEATURE: Table 3s Long-press Highlight with Quick Rename & Delete Action Icons', async (t) => {
  const cardPath = path.resolve('src/components/tables/TableCard.jsx');
  const cardSrc = fs.readFileSync(cardPath, 'utf-8');

  const gridPath = path.resolve('src/components/tables/TableGrid.jsx');
  const gridSrc = fs.readFileSync(gridPath, 'utf-8');

  await t.test('1. TableCard enforces 3000ms long-press threshold on empty tables only', () => {
    assert.ok(
      cardSrc.includes('3000'),
      'Must configure setTimeout with 3000ms (3 seconds)'
    );
    assert.ok(
      cardSrc.includes('if (isOccupied || isLocked) return;'),
      'Must guard against long-press on occupied or locked tables'
    );
    assert.ok(
      cardSrc.includes('holdTimerRef'),
      'Must maintain holdTimerRef for accurate timer control'
    );
    assert.ok(
      cardSrc.includes('clearTimeout(holdTimerRef.current)'),
      'Must clear timeout on release, move, or unmount to avoid memory leaks'
    );
  });

  await t.test('2. TableCard cancels long-press on scroll or drag > 10px', () => {
    assert.ok(
      cardSrc.includes('const dx = Math.abs(clientX - startPosRef.current.x);'),
      'Must calculate horizontal drag distance'
    );
    assert.ok(
      cardSrc.includes('const dy = Math.abs(clientY - startPosRef.current.y);'),
      'Must calculate vertical drag distance'
    );
    assert.ok(
      cardSrc.includes('if (dx > 10 || dy > 10)'),
      'Must cancel long-press if movement exceeds 10px threshold'
    );
  });

  await t.test('3. TableCard prevents accidental click when 3s long-press triggers', () => {
    assert.ok(
      cardSrc.includes('hasTriggeredHoldRef.current'),
      'Must track whether long-press triggered to suppress standard card click'
    );
    assert.ok(
      cardSrc.includes('onHighlightTable?.(resolvedTable)'),
      'Must dispatch onHighlightTable callback with resolvedTable data'
    );
  });

  await t.test('4. TableGrid renders backdrop blur spotlight overlay', () => {
    assert.ok(
      gridSrc.includes('highlightedTable'),
      'Must maintain highlightedTable state'
    );
    assert.ok(
      gridSrc.includes('backdrop-blur-md') && gridSrc.includes('bg-black/65'),
      'Must render dimmed, blurred background backdrop'
    );
    assert.ok(
      gridSrc.includes('z-[9500]'),
      'Overlay must sit above standard page elements'
    );
  });

  await t.test('5. TableGrid renders 2 action buttons with icons only (no text captions)', () => {
    assert.ok(
      gridSrc.includes('<Pencil className="w-5 h-5 stroke-[2.2]" />'),
      'Must render Pencil icon for table rename'
    );
    assert.ok(
      gridSrc.includes('<Trash2 className="w-5 h-5 stroke-[2.2]" />'),
      'Must render Trash2 icon for table delete'
    );

    // Verify neither button contains visible text spans or captions
    const renameBtnBlock = gridSrc.match(/<button[^>]*handleOpenRename[\s\S]*?<\/button>/)?.[0] || '';
    const deleteBtnBlock = gridSrc.match(/<button[^>]*handleOpenDelete[\s\S]*?<\/button>/)?.[0] || '';

    assert.ok(
      !renameBtnBlock.includes('<span') && !renameBtnBlock.includes('Đổi tên</span>'),
      'Rename button must only contain the icon without visible text caption'
    );
    assert.ok(
      !deleteBtnBlock.includes('<span') && !deleteBtnBlock.includes('Xóa bàn</span>'),
      'Delete button must only contain the icon without visible text caption'
    );
  });

  await t.test('6. TableGrid performs quick rename and confirm delete via PosContext', () => {
    assert.ok(
      gridSrc.includes('updateTable(highlightedTable.id, { name: trimmed })'),
      'Must call updateTable with trimmed name on confirmation'
    );
    assert.ok(
      gridSrc.includes('deleteTable(highlightedTable.id)'),
      'Must call deleteTable with table ID on confirmation'
    );
    assert.ok(
      gridSrc.includes('isRenameDialogOpen'),
      'Must manage isRenameDialogOpen state'
    );
    assert.ok(
      gridSrc.includes('isDeleteDialogOpen'),
      'Must manage isDeleteDialogOpen state'
    );
  });
});
