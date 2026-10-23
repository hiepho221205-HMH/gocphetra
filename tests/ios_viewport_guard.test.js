import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('iOS Viewport & App Shell Stability Guard Suite', () => {
  it('src/index.css must lock html, body, #root with position: fixed and inset: 0', () => {
    const cssPath = path.resolve('src/index.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.ok(
      css.includes('position: fixed;'),
      'src/index.css must define position: fixed on root elements to prevent WebKit document scrolling'
    );
    assert.ok(
      css.includes('inset: 0;'),
      'src/index.css must define inset: 0 on root elements'
    );
    assert.ok(
      css.includes('overflow: hidden;'),
      'src/index.css must define overflow: hidden on root elements'
    );
  });

  it('src/index.css must enforce font-size: 16px on mobile to block iOS WebKit auto-zoom', () => {
    const cssPath = path.resolve('src/index.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.ok(
      css.includes('font-size: 16px !important;') || css.includes('font-size: 16px;'),
      'src/index.css must specify 16px font-size on inputs for mobile viewports'
    );
    assert.ok(
      css.includes('@media (max-width: 639px)'),
      'src/index.css must target mobile screens (< 640px) for the 16px font-size rule'
    );
  });

  it('src/hooks/useIosKeyboardFix.js must handle focusin, focusout and staggered restoration', () => {
    const hookPath = path.resolve('src/hooks/useIosKeyboardFix.js');
    const hookCode = fs.readFileSync(hookPath, 'utf8');

    assert.ok(hookCode.includes('focusin'), 'useIosKeyboardFix must listen to focusin');
    assert.ok(hookCode.includes('focusout'), 'useIosKeyboardFix must listen to focusout');
    assert.ok(hookCode.includes('visualViewport'), 'useIosKeyboardFix must monitor visualViewport');
    assert.ok(
      hookCode.includes('window.scrollTo({ top: 0, left: 0, behavior: \'instant\' })') ||
      hookCode.includes('window.scrollTo'),
      'useIosKeyboardFix must reset window scroll offset'
    );
    assert.ok(
      hookCode.includes('setTimeout(resetScrollOffset, 350)'),
      'useIosKeyboardFix must include staggered timeout for iOS keyboard dismissal animation'
    );
  });

  it('MenuManagementView and OrderView search inputs must explicitly use text-[16px]', () => {
    const menuPath = path.resolve('src/components/menu/MenuManagementView.jsx');
    const menuCode = fs.readFileSync(menuPath, 'utf8');
    assert.ok(
      menuCode.includes('text-[16px]'),
      'MenuManagementView search input must include text-[16px] for mobile viewports'
    );

    const orderPath = path.resolve('src/components/ordering/OrderView.jsx');
    const orderCode = fs.readFileSync(orderPath, 'utf8');
    assert.ok(
      orderCode.includes('text-[16px]'),
      'OrderView search input must include text-[16px] for mobile viewports'
    );
  });

  it('src/App.jsx must lock outer frame with fixed inset-0 on mobile', () => {
    const appPath = path.resolve('src/App.jsx');
    const appCode = fs.readFileSync(appPath, 'utf8');
    assert.ok(
      appCode.includes('fixed inset-0'),
      'src/App.jsx root element must include fixed inset-0 to prevent viewport displacement'
    );
  });
});
