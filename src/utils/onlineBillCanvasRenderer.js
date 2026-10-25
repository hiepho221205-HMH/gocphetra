/**
 * GÓC POS — Online Bill Canvas Graphic Renderer & Exporter
 * Renders high-fidelity, high-DPI (2x Retina) digital receipts as standalone PNG images.
 * Designed according to minimalist white receipt specification matching reference design:
 * - Prominent store branding: GÓC PHÊ - TRÀ (bold uppercase)
 * - Accurate store address and contact phone from settings
 * - Date & Time in Asia/Ho_Chi_Minh timezone, Table name, Order ID, Customer name
 * - Dashed dividing lines between items
 * - Item title in bold uppercase, line below [Quantity] x [Unit price] and [Line total]
 * - Financial summary: Subtotal, Discount, Surcharge, Grand Total in brand color #214E34
 * - Payment status badge: "CHƯA THANH TOÁN" vs "ĐÃ THANH TOÁN"
 * - Courteous closing message and GÓC POS signature
 */

import { formatVND } from './currency.js';
import { formatReceiptDateTime } from './receiptEngine.js';

const FONT_FAMILY = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/**
 * Word wraps text for canvas rendering
 */
function wrapText(ctx, text = '', maxWidth = 340) {
  if (!text) return [];
  const words = String(text).split(' ');
  const lines = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + ' ' + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Draws a rounded rectangle path
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draws a horizontal dashed line across content width
 */
function drawDashedLine(ctx, x1, y, x2, color = '#E5E7EB', dash = [4, 4], lineWidth = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Calculates dynamic height required to render receipt without cutoffs
 */
function calculateReceiptLayout(model, contentWidth, ctx) {
  const isPaid = model.order?.status === 'completed' || model.isPaid;
  const storeName = model.store?.storeName || 'GÓC PHÊ - TRÀ';
  const storeAddress = model.store?.storeAddress || '76A Võ Văn Dũng, P. An Nhơn, Gia Lai';
  const contactPhone = model.store?.contactPhone || '0369623489';

  ctx.font = `800 13px ${FONT_FAMILY}`;
  const addressLines = wrapText(ctx, `ĐC: ${storeAddress}`, contentWidth);

  let height = 0;
  height += 28; // top outer padding
  height += 30; // Store Name
  height += addressLines.length * 18; // Store Address
  height += 20; // Contact phone
  height += 20; // spacing before card inner

  // Inner Card header: Date, Table, Order Code, Customer
  height += 18; // inner card top padding
  height += 46; // Date & Order Code / Customer block
  height += 16; // spacing before dashed separator
  height += 14; // dashed separator margin

  // Items
  const items = model.items || [];
  for (const it of items) {
    ctx.font = `800 14px ${FONT_FAMILY}`;
    const nameLines = wrapText(ctx, (it.name || 'MÓN').toUpperCase(), contentWidth - 24);
    height += nameLines.length * 20; // item name
    height += 22; // qty x price row
    if (it.toppings && it.toppings.length > 0) {
      height += it.toppings.length * 16; // toppings
    }
    if (it.notes) {
      height += 16;
    }
    height += 18; // dashed separator between items
  }

  // Financial summary
  height += 8; // spacing
  height += 24; // Subtotal
  if (model.discountAmount > 0) {
    height += 22; // Discount
  }
  if (model.surcharge > 0) {
    height += 22; // Surcharge
  }
  height += 14; // dashed separator before total
  height += 36; // Big Total (Tổng cộng)
  height += 16; // spacing before badge

  // Payment Status Badge
  height += 36; // status pill

  // Footer note
  height += 22; // margin
  height += 20; // Thank you text
  height += 18; // Branding text
  height += 28; // inner card bottom padding
  height += 24; // outer bottom padding

  return Math.max(500, Math.ceil(height));
}

/**
 * Renders high-DPI HTML5 Canvas for the Digital Receipt
 * @param {object} model - Canonical receipt model from receiptEngine
 * @returns {HTMLCanvasElement}
 */
export function renderOnlineBillToCanvas(model) {
  if (typeof document === 'undefined') return null;

  // Visual layout dimensions in CSS pixels
  const CARD_WIDTH = 420;
  const INNER_PADDING = 24;
  const CONTENT_WIDTH = CARD_WIDTH - INNER_PADDING * 2;
  const SCALE = 2; // 2x Retina rendering for pin-sharp typography

  // 1. First pass: Measure required dynamic canvas height
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  const measuredHeight = calculateReceiptLayout(model, CONTENT_WIDTH, mctx);

  // 2. Setup actual canvas with Retina backing
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * SCALE;
  canvas.height = measuredHeight * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // Smooth rendering settings
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 3. Ambient Soft Pastel Background (matching GÓC POS mobile aesthetic)
  ctx.fillStyle = '#F5F7F4';
  ctx.fillRect(0, 0, CARD_WIDTH, measuredHeight);

  // 4. White Card Surface
  const cardX = 14;
  const cardY = 14;
  const cardW = CARD_WIDTH - cardX * 2;
  const cardH = measuredHeight - cardY * 2;
  const cardRadius = 24;

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(160, 175, 200, 0.22)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.fill();
  ctx.restore();

  // Subtle Card Border
  ctx.save();
  ctx.strokeStyle = '#EEF2F6';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.stroke();
  ctx.restore();

  // 5. Draw Content Inside White Card
  let curY = cardY + 22;
  const contentLeft = cardX + 18;
  const contentRight = cardX + cardW - 18;
  const printableWidth = contentRight - contentLeft;

  // Store Title
  const storeName = (model.store?.storeName || 'GÓC PHÊ - TRÀ').toUpperCase();
  ctx.fillStyle = '#111827';
  ctx.font = `900 20px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.fillText(storeName, contentLeft, curY);
  curY += 22;

  // Store Address & Hotline
  const storeAddress = model.store?.storeAddress || '76A Võ Văn Dũng, P. An Nhơn, Gia Lai';
  const contactPhone = model.store?.contactPhone || '0369623489';

  ctx.fillStyle = '#374151';
  ctx.font = `600 12px ${FONT_FAMILY}`;
  const addressLines = wrapText(ctx, `ĐC: ${storeAddress}`, printableWidth);
  for (const line of addressLines) {
    ctx.fillText(line, contentLeft, curY);
    curY += 16;
  }
  ctx.fillText(`ĐT: ${contactPhone}`, contentLeft, curY);
  curY += 18;

  // Subtle separator after store info
  drawDashedLine(ctx, contentLeft, curY, contentRight, '#E5E7EB', [4, 4]);
  curY += 16;

  // Metadata: Date, Time, Order ID, Table, Customer
  const formattedDateTime = formatReceiptDateTime(model.receiptIssuedAt || model.orderCreatedAt);
  const tableLabel = model.table ? `Bàn: ${model.table}` : 'Bàn mang đi';
  const orderCode = model.orderId ? `#${model.orderId}` : '#ORD-GOC';
  const customerName = model.order?.customerName || model.order?.customer || 'Khách lẻ';

  ctx.font = `600 12px ${FONT_FAMILY}`;
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'left';
  ctx.fillText(`Ngày: ${formattedDateTime}`, contentLeft, curY);

  ctx.textAlign = 'right';
  ctx.fillText(`KH: ${customerName}`, contentRight, curY);
  curY += 18;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#4B5563';
  ctx.fillText(`${tableLabel} • ${orderCode}`, contentLeft, curY);
  curY += 14;

  drawDashedLine(ctx, contentLeft, curY, contentRight, '#E5E7EB', [4, 4]);
  curY += 18;

  // 6. Line Items
  const items = model.items || [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const itemName = (it.name || 'Món').toUpperCase();
    const qty = it.quantity || 1;
    const unitPrice = it.effectiveUnitPrice || it.price || 0;
    const lineTotal = it.lineTotal || (qty * unitPrice);

    // Item Title
    ctx.font = `800 13.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'left';
    const nameLines = wrapText(ctx, itemName, printableWidth);
    for (const line of nameLines) {
      ctx.fillText(line, contentLeft, curY);
      curY += 18;
    }

    // Row: [Quantity] x [Unit Price] (Left) ...... [Line Total] (Right)
    ctx.font = `700 12.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#374151';
    ctx.textAlign = 'left';
    ctx.fillText(`${qty} x ${formatVND(unitPrice)}`, contentLeft, curY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#111827';
    ctx.font = `800 13px ${FONT_FAMILY}`;
    ctx.fillText(formatVND(lineTotal), contentRight, curY);
    curY += 16;

    // Optional Toppings
    if (it.toppings && it.toppings.length > 0) {
      ctx.font = `500 11px ${FONT_FAMILY}`;
      ctx.fillStyle = '#6B7280';
      ctx.textAlign = 'left';
      for (const tp of it.toppings) {
        const topPrice = tp.priceOverride || tp.price || 0;
        const tpLabel = `+ ${tp.name}${topPrice > 0 ? ` (${formatVND(topPrice)})` : ''}`;
        ctx.fillText(tpLabel, contentLeft + 8, curY);
        curY += 15;
      }
    }

    // Optional notes
    if (it.notes) {
      ctx.font = `italic 11px ${FONT_FAMILY}`;
      ctx.fillStyle = '#6B7280';
      ctx.textAlign = 'left';
      ctx.fillText(`Ghi chú: ${it.notes}`, contentLeft + 8, curY);
      curY += 15;
    }

    curY += 4;
    drawDashedLine(ctx, contentLeft, curY, contentRight, '#F3F4F6', [3, 3]);
    curY += 14;
  }

  // 7. Financial Summary
  const subtotal = model.subtotal || 0;
  const discountAmount = model.discountAmount || 0;
  const discountPercent = model.discountPercent || 0;
  const surcharge = model.surcharge || 0;
  const grandTotal = model.total || (subtotal - discountAmount + surcharge);
  const totalItemCount = (model.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);

  // Subtotal
  ctx.font = `600 12.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#4B5563';
  ctx.textAlign = 'left';
  ctx.fillText('Tổng tiền hàng', contentLeft, curY);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#111827';
  ctx.font = `700 12.5px ${FONT_FAMILY}`;
  ctx.fillText(formatVND(subtotal), contentRight, curY);
  curY += 20;

  // Discount (if any)
  if (discountAmount > 0) {
    ctx.font = `600 12px ${FONT_FAMILY}`;
    ctx.fillStyle = '#047857';
    ctx.textAlign = 'left';
    ctx.fillText(`Chiết khấu (${discountPercent}%)`, contentLeft, curY);
    ctx.textAlign = 'right';
    ctx.font = `700 12px ${FONT_FAMILY}`;
    ctx.fillText(`-${formatVND(discountAmount)}`, contentRight, curY);
    curY += 18;
  }

  // Surcharge (if any)
  if (surcharge > 0) {
    ctx.font = `600 12px ${FONT_FAMILY}`;
    ctx.fillStyle = '#4B5563';
    ctx.textAlign = 'left';
    ctx.fillText('Phụ thu / Phí dịch vụ', contentLeft, curY);
    ctx.textAlign = 'right';
    ctx.font = `700 12px ${FONT_FAMILY}`;
    ctx.fillText(`+${formatVND(surcharge)}`, contentRight, curY);
    curY += 18;
  }

  curY += 4;
  drawDashedLine(ctx, contentLeft, curY, contentRight, '#D1D5DB', [4, 4], 1.2);
  curY += 22;

  // GRAND TOTAL (Tổng cộng) Highlighted in #214E34
  ctx.textAlign = 'left';
  ctx.fillStyle = '#111827';
  ctx.font = `800 14px ${FONT_FAMILY}`;
  ctx.fillText(`Tổng cộng (${totalItemCount})`, contentLeft, curY);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#214E34'; // Bold Brand Green
  ctx.font = `900 20px ${FONT_FAMILY}`;
  ctx.fillText(formatVND(grandTotal), contentRight, curY);
  curY += 26;

  // 8. Payment Status Badge
  const isPaid = model.order?.status === 'completed' || model.isPaid;
  const statusW = printableWidth;
  const statusH = 34;
  const badgeX = contentLeft;
  const badgeY = curY;

  ctx.save();
  if (isPaid) {
    ctx.fillStyle = '#ECFDF5'; // emerald-50
    ctx.strokeStyle = '#A7F3D0'; // emerald-200
  } else {
    ctx.fillStyle = '#FFFBEB'; // amber-50
    ctx.strokeStyle = '#FDE68A'; // amber-200
  }
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, badgeX, badgeY, statusW, statusH, 12);
  ctx.fill();
  ctx.stroke();

  ctx.font = `800 12px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  if (isPaid) {
    ctx.fillStyle = '#065F46'; // emerald-800
    const methodStr = model.paymentMethodLabel ? ` • ${model.paymentMethodLabel.toUpperCase()}` : '';
    ctx.fillText(`✔ ĐÃ THANH TOÁN${methodStr}`, badgeX + statusW / 2, badgeY + 21);
  } else {
    ctx.fillStyle = '#92400E'; // amber-800
    ctx.fillText('⏳ CHƯA THANH TOÁN', badgeX + statusW / 2, badgeY + 21);
  }
  ctx.restore();
  curY += statusH + 20;

  // 9. Footer Closing Message & Brand
  ctx.textAlign = 'center';
  ctx.font = `600 11.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#6B7280';
  ctx.fillText(model.store?.receiptFooter || 'Cảm ơn quý khách và hẹn gặp lại!', cardX + cardW / 2, curY);
  curY += 16;

  ctx.font = `600 10.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#9CA3AF';
  ctx.fillText('Một sản phẩm của GÓC POS', cardX + cardW / 2, curY);

  return canvas;
}

/**
 * Generates a standard PNG filename based on order ID: GOC-HoaDon-[MaDon].png
 * @param {string|number} orderId
 * @returns {string}
 */
export function getOnlineBillFileName(orderId) {
  const cleanId = String(orderId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '');
  return `GOC-HoaDon-${cleanId}.png`;
}

/**
 * Exports canonical receipt model as PNG Blob
 * @param {object} model
 * @returns {Promise<Blob>}
 */
export function exportOnlineBillBlob(model) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = renderOnlineBillToCanvas(model);
      if (!canvas) {
        return reject(new Error('Không thể khởi tạo Canvas trình xuất hóa đơn.'));
      }
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Lỗi chuyển đổi Canvas sang Blob PNG.'));
        }
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Exports canonical receipt model as File object ready for Web Share API
 * @param {object} model
 * @returns {Promise<File>}
 */
export async function exportOnlineBillFile(model) {
  const blob = await exportOnlineBillBlob(model);
  const fileName = getOnlineBillFileName(model.orderId || model.order?.id);
  return new File([blob], fileName, { type: 'image/png' });
}

/**
 * Triggers direct browser download of the PNG receipt
 * @param {object} model
 * @returns {Promise<string>} downloaded filename
 */
export async function downloadOnlineBillImage(model) {
  const blob = await exportOnlineBillBlob(model);
  const fileName = getOnlineBillFileName(model.orderId || model.order?.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return fileName;
}
