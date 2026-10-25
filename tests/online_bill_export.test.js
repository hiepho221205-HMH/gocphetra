import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getOnlineBillFileName
} from '../src/utils/onlineBillCanvasRenderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const billCheckoutModalPath = path.join(__dirname, '../src/components/billing/BillCheckoutModal.jsx');
const onlineBillModalPath = path.join(__dirname, '../src/components/billing/OnlineBillModal.jsx');
const canvasRendererPath = path.join(__dirname, '../src/utils/onlineBillCanvasRenderer.js');
const orderHistoryViewPath = path.join(__dirname, '../src/components/orders/OrderHistoryView.jsx');

describe('GÓC POS — Online Bill Export & Share Test Suite', () => {
  const checkoutCode = fs.readFileSync(billCheckoutModalPath, 'utf8');
  const modalCode = fs.readFileSync(onlineBillModalPath, 'utf8');
  const rendererCode = fs.readFileSync(canvasRendererPath, 'utf8');
  const historyCode = fs.readFileSync(orderHistoryViewPath, 'utf8');

  // ================= A. CHECKOUT MODAL HEADER & ACTION BUTTONS =================
  it('A.1 - BillCheckoutModal replaces header print button with Share2 icon & Xuất hóa đơn online label', () => {
    assert.ok(
      checkoutCode.includes('Share2') && checkoutCode.includes('title="Xuất hóa đơn online"'),
      'Header must render Share2 button with title "Xuất hóa đơn online"'
    );
    assert.ok(
      checkoutCode.includes('aria-label="Xuất hóa đơn online"'),
      'Header button must provide accessible label "Xuất hóa đơn online"'
    );
  });

  it('A.2 - BillCheckoutModal preserves all bottom payment and management actions intact', () => {
    assert.ok(checkoutCode.includes('Gộp bàn'), 'Must preserve Gộp bàn button');
    assert.ok(checkoutCode.includes('In hóa đơn'), 'Must preserve bottom In hóa đơn button');
    assert.ok(checkoutCode.includes('Tiền mặt'), 'Must preserve Tiền mặt checkout button');
    assert.ok(checkoutCode.includes('VietQR'), 'Must preserve VietQR checkout button');
  });

  it('A.3 - BillCheckoutModal renders OnlineBillModal with current order', () => {
    assert.ok(
      checkoutCode.includes('<OnlineBillModal') && checkoutCode.includes('showOnlineBillModal'),
      'BillCheckoutModal must register and render OnlineBillModal'
    );
  });

  // ================= B. ONLINE BILL PREVIEW MODAL SPECIFICATIONS =================
  it('B.1 - OnlineBillModal uses createPortal(..., document.body) with z-[9500]', () => {
    assert.ok(
      modalCode.includes('createPortal') && modalCode.includes('document.body'),
      'OnlineBillModal must use React Portal to document.body'
    );
    assert.ok(
      modalCode.includes('z-[9500]'),
      'OnlineBillModal must use z-[9500] to sit above BottomNav and App Shell'
    );
  });

  it('B.2 - OnlineBillModal enforces independent scroll and safe-area inset', () => {
    assert.ok(
      modalCode.includes('overflow-y-auto') && modalCode.includes('overscroll-contain'),
      'Preview container must scroll independently'
    );
    assert.ok(
      modalCode.includes('safe-area-inset-bottom'),
      'Pinned action footer must accommodate safe-area-inset-bottom'
    );
  });

  it('B.3 - OnlineBillModal locks body scroll and handles Escape key', () => {
    assert.match(
      modalCode,
      /document\.body\.style\.overflow\s*=\s*['"]hidden['"]/,
      'Must lock body scroll when modal opens'
    );
    assert.match(
      modalCode,
      /e\.key\s*===\s*['"]Escape['"]/,
      'Must handle Escape key to close modal'
    );
  });

  it('B.4 - OnlineBillModal renders Pastel Aurora background & watermark logo in preview', () => {
    assert.ok(modalCode.includes('modal-aurora-spin'), 'Modal must render ambient aurora spin animation');
    assert.ok(modalCode.includes('goc-logo.png'), 'Modal must render GÓC watermark logo');
    assert.ok(modalCode.includes('rounded-[30px]'), 'Card must have 30px rounded corners');
  });

  // ================= C. WEB SHARE API & DOWNLOAD ACTIONS =================
  it('C.1 - OnlineBillModal provides both "Lưu ảnh" and "Chia sẻ" action buttons', () => {
    assert.ok(modalCode.includes('Lưu ảnh'), 'Must render "Lưu ảnh" button');
    assert.ok(modalCode.includes('Chia sẻ'), 'Must render "Chia sẻ" button');
  });

  it('C.2 - Web Share API strictly only sends files (NO text, NO title, NO url)', () => {
    // Strictly verify shareData only contains files
    assert.ok(
      modalCode.includes('files: [file]'),
      'shareData must strictly contain files: [file]'
    );
    assert.ok(
      !modalCode.includes('title: `Hóa đơn GÓC'),
      'shareData must NOT include title'
    );
    assert.ok(
      !modalCode.includes('text: `Hóa đơn thanh toán'),
      'shareData must NOT include text'
    );
    assert.ok(
      !modalCode.includes('url:'),
      'shareData must NOT include url'
    );
  });

  it('C.3 - Web Share API checks navigator.canShare({ files }) with graceful fallback', () => {
    assert.ok(
      modalCode.includes('navigator.canShare') && modalCode.includes('navigator.share'),
      'Must call navigator.canShare and navigator.share'
    );
    assert.ok(
      modalCode.includes('downloadOnlineBillImage'),
      'Must fallback to downloading image when sharing files is unsupported'
    );
    assert.ok(
      modalCode.includes('AbortError'),
      'Must catch and silently ignore AbortError when user dismisses system share sheet'
    );
  });

  // ================= D. CANVAS RENDERER & FILE NAMING CONTRACT =================
  it('D.1 - File naming strictly follows GOC-HoaDon-[MaDon].png format', () => {
    assert.equal(getOnlineBillFileName('ORD-12345'), 'GOC-HoaDon-ORD-12345.png');
    assert.equal(getOnlineBillFileName('#ORD-9988'), 'GOC-HoaDon-ORD-9988.png');
    assert.equal(getOnlineBillFileName('B01_ABC'), 'GOC-HoaDon-B01_ABC.png');
  });

  it('D.2 - Canvas renderer implements 2x Retina scale, Pastel Aurora Glow, and #214E34 grand total', () => {
    assert.ok(rendererCode.includes('SCALE = 2'), 'Canvas must render at 2x scale for Retina clarity');
    assert.ok(rendererCode.includes('#214E34'), 'Canvas must paint grand total in brand color #214E34');
    assert.ok(rendererCode.includes('CHƯA THANH TOÁN'), 'Canvas must support CHƯA THANH TOÁN status badge');
    assert.ok(rendererCode.includes('ĐÃ THANH TOÁN'), 'Canvas must support ĐÃ THANH TOÁN status badge');
    assert.ok(rendererCode.includes('drawDashedLine'), 'Canvas must draw crisp dashed divider lines');
    assert.ok(rendererCode.includes('drawGlowSpot'), 'Canvas must render soft glowing pastel aurora spots');
    assert.ok(rendererCode.includes('cardRadius = 30'), 'Canvas must render card with 30px rounded corners');
  });

  it('D.3 - Canvas renderer exposes blob, file, download, and preload utilities', () => {
    assert.ok(rendererCode.includes('export async function exportOnlineBillBlob'));
    assert.ok(rendererCode.includes('export async function exportOnlineBillFile'));
    assert.ok(rendererCode.includes('export async function downloadOnlineBillImage'));
    assert.ok(rendererCode.includes('export function preloadLogoImage'));
  });

  // ================= E. ORDER HISTORY VIEW INTEGRATION =================
  it('E.1 - OrderHistoryView integrates OnlineBillModal for completed orders', () => {
    assert.ok(
      historyCode.includes('OnlineBillModal') && historyCode.includes('onlineBillOrder'),
      'OrderHistoryView must register OnlineBillModal'
    );
    assert.ok(
      historyCode.includes('Xuất ảnh'),
      'OrderHistoryView must provide "Xuất ảnh" button for past completed orders'
    );
  });
});
