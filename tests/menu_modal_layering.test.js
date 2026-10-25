import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const menuViewPath = path.join(__dirname, '../src/components/menu/MenuManagementView.jsx');
const toastPath = path.join(__dirname, '../src/components/common/Toast.jsx');
const bottomNavPath = path.join(__dirname, '../src/components/common/BottomNav.jsx');

describe('GÓC POS — Menu Modal Layering, React Portal & Stacking Suite', () => {
  const menuCode = fs.readFileSync(menuViewPath, 'utf8');
  const toastCode = fs.readFileSync(toastPath, 'utf8');
  const bottomNavCode = fs.readFileSync(bottomNavPath, 'utf8');

  it('1.1 - MenuManagementView imports createPortal from react-dom', () => {
    assert.match(menuCode, /import\s*\{[^}]*createPortal[^}]*\}\s*from\s*['"]react-dom['"]/);
  });

  it('1.2 - Item Modal (isItemModalOpen) uses createPortal(..., document.body)', () => {
    assert.ok(menuCode.includes('isItemModalOpen &&'), 'Must check isItemModalOpen');
    assert.match(
      menuCode,
      /isItemModalOpen\s*&&\s*createPortal\s*\(\s*<div[\s\S]*?role="dialog"[\s\S]*?document\.body\s*\)/,
      'isItemModalOpen must be portaled directly to document.body'
    );
  });

  it('1.3 - Category Modal (isCategoryModalOpen) uses createPortal(..., document.body)', () => {
    assert.ok(menuCode.includes('isCategoryModalOpen &&'), 'Must check isCategoryModalOpen');
    assert.match(
      menuCode,
      /isCategoryModalOpen\s*&&\s*createPortal\s*\(\s*<div[\s\S]*?role="dialog"[\s\S]*?document\.body\s*\)/,
      'isCategoryModalOpen must be portaled directly to document.body'
    );
  });

  it('1.4 - Stacking Context: Modal uses z-[9000] and exceeds BottomNav (z-40)', () => {
    assert.ok(bottomNavCode.includes('z-40'), 'BottomNav must be z-40');
    assert.ok(
      menuCode.includes('z-[9000]'),
      'Menu modals must use standardized z-[9000] to sit completely above BottomNav and App Shell'
    );
  });

  it('1.5 - Pinned Action Footer with safe-area-inset-bottom is enforced', () => {
    assert.ok(
      menuCode.includes('safe-area-inset-bottom'),
      'Must contain safe-area-inset-bottom padding for modern mobile devices'
    );
    assert.match(
      menuCode,
      /pb-\[max\(14px,env\(safe-area-inset-bottom,14px\)\)\]/,
      'Must have responsive safe area bottom inset'
    );
  });

  it('1.6 - Independent scroll container (overflow-y-auto, overscroll-contain) is configured', () => {
    assert.ok(
      menuCode.includes('overflow-y-auto') && menuCode.includes('overscroll-contain'),
      'Form body must have isolated smooth scroll with overscroll-contain'
    );
  });

  it('1.7 - Anti double-submit & loading spinner on save item', () => {
    assert.ok(menuCode.includes('isSavingItem'), 'Must have isSavingItem state');
    assert.ok(menuCode.includes('disabled={isSavingItem}'), 'Buttons must disable while saving');
    assert.ok(menuCode.includes('Đang lưu...'), 'Must render loading feedback text');
  });

  it('1.8 - Body scroll lock and Escape key listener are registered', () => {
    assert.match(
      menuCode,
      /document\.body\.style\.overflow\s*=\s*['"]hidden['"]/,
      'Must lock body scroll when modal opens'
    );
    assert.match(
      menuCode,
      /e\.key\s*===\s*['"]Escape['"]/,
      'Must handle Escape key to dismiss top modal'
    );
  });

  it('1.9 - Toast container is elevated to z-[9999] so alerts appear above portaled modals', () => {
    assert.ok(
      toastCode.includes('z-[9999]'),
      'Toast must be at z-[9999] to display above modals'
    );
  });
});
