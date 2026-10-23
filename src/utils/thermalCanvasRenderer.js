/**
 * GÓC POS — Thermal Canvas Graphic Renderer
 * Renders full-fidelity Vietnamese receipts and kitchen tickets onto HTML5 Canvas
 * and converts them to 1-bit monochrome ESC/POS raster bitmaps (GS v 0).
 * 
 * Used for "In Đồ Họa Có Dấu" (Graphic Accents Mode) ensuring 100% Vietnamese
 * diacritics without relying on printer hardware ROM codepages.
 */

import { imageToEscPosRasterBytes } from './thermalLogoProcessor.js';

// Standard 203 DPI dot densities
export const CANVAS_WIDTH_58MM = 384; // 8 dots/mm * 48mm printable
export const CANVAS_WIDTH_80MM = 576; // 8 dots/mm * 72mm printable

/**
 * Word wraps text for canvas rendering
 */
function wrapCanvasText(ctx, text = '', maxWidth = 360) {
  if (!text) return [];
  const words = text.split(' ');
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
 * Loads an image from a URL or data URL for drawing onto canvas
 */
function loadCanvasImage(url) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Image === 'undefined' || !url) {
      return resolve(null);
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Renders a canonical ReceiptModel onto an HTML5 Canvas with full Vietnamese diacritics.
 * 
 * @param {object} model - ReceiptModel from receiptEngine
 * @param {object} [options]
 * @returns {Promise<HTMLCanvasElement|null>}
 */
export async function renderReceiptToCanvas(model, options = {}) {
  if (typeof document === 'undefined') return null;

  const is80 = model.paperWidth === '80mm';
  const width = is80 ? CANVAS_WIDTH_80MM : CANVAS_WIDTH_58MM;
  const padding = is80 ? 18 : 12;
  const contentWidth = width - padding * 2;

  // Measurement Canvas to determine dynamic total height
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = width;
  measureCanvas.height = 2000;
  const mctx = measureCanvas.getContext('2d');

  const FONT_FAMILY = '"Segoe UI", Roboto, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
  const fontTitle = `bold ${is80 ? 26 : 21}px ${FONT_FAMILY}`;
  const fontSubtitle = `bold ${is80 ? 20 : 17}px ${FONT_FAMILY}`;
  const fontHeading = `bold ${is80 ? 22 : 18}px ${FONT_FAMILY}`;
  const fontBody = `normal ${is80 ? 18 : 15}px ${FONT_FAMILY}`;
  const fontBold = `bold ${is80 ? 18 : 15}px ${FONT_FAMILY}`;
  const fontSmall = `normal ${is80 ? 16 : 13}px ${FONT_FAMILY}`;
  const fontBigTotal = `bold ${is80 ? 26 : 22}px ${FONT_FAMILY}`;

  // Optional Logo preload
  let logoImg = null;
  if (model.settings?.showLogo) {
    const logoSrc = model.store?.logoThermalUrl || model.store?.logoOriginalUrl || options.logoSource;
    if (logoSrc) {
      logoImg = await loadCanvasImage(logoSrc);
    }
  }

  // Pre-calculate height
  let y = padding;

  if (logoImg) {
    const logoMaxW = is80 ? 220 : 160;
    const aspect = logoImg.height / (logoImg.width || 1);
    const logoW = Math.min(logoMaxW, logoImg.width);
    const logoH = logoW * aspect;
    y += logoH + 12;
  }

  if (model.settings?.showStoreName !== false) y += is80 ? 34 : 28;
  if (model.settings?.showAddress !== false && model.store?.storeAddress) {
    mctx.font = fontSmall;
    const addrLines = wrapCanvasText(mctx, model.store.storeAddress, contentWidth);
    y += addrLines.length * (is80 ? 22 : 18) + 4;
  }
  if (model.settings?.showPhone !== false && model.store?.contactPhone) y += is80 ? 24 : 20;

  y += 18; // Separator
  y += is80 ? 30 : 26; // Title
  if (model.isReprint) y += is80 ? 22 : 18;
  y += 18; // Separator

  // Metadata
  const metaCount = [
    model.settings?.showOrderId !== false,
    model.settings?.showTable !== false,
    model.settings?.showOrderTime !== false,
    model.settings?.showReceiptTime !== false
  ].filter(Boolean).length;
  y += metaCount * (is80 ? 24 : 20) + 14;

  // Items
  const items = model.items || [];
  mctx.font = fontBold;
  items.forEach((it) => {
    const itemTitle = `${it.name || 'Món'}${it.size ? ` (${it.size})` : ''}`;
    const titleLines = wrapCanvasText(mctx, itemTitle, contentWidth);
    y += titleLines.length * (is80 ? 24 : 20);

    if (it.toppings && it.toppings.length > 0) {
      mctx.font = fontSmall;
      const topStr = `+ ${it.toppings.map((t) => t.name || t).join(', ')}`;
      const topLines = wrapCanvasText(mctx, topStr, contentWidth - 16);
      y += topLines.length * (is80 ? 20 : 16);
      mctx.font = fontBold;
    }
    if (it.notes) {
      mctx.font = fontSmall;
      const noteLines = wrapCanvasText(mctx, `* ${it.notes}`, contentWidth - 16);
      y += noteLines.length * (is80 ? 20 : 16);
      mctx.font = fontBold;
    }
    y += (is80 ? 24 : 20) + 6; // Price row
  });

  y += 18; // Separator

  // Financial summary
  y += is80 ? 26 : 22; // Subtotal
  if (model.discountAmount > 0) y += is80 ? 24 : 20;
  if (model.surcharge > 0) y += is80 ? 24 : 20;
  y += 16; // Double line
  y += is80 ? 34 : 28; // Total
  y += 16; // Double line
  y += is80 ? 26 : 22; // Payment method
  y += 18; // Separator

  if (model.settings?.showWifi !== false && model.store?.wifiPassword && model.store?.wifiOnReceipt !== false) {
    y += is80 ? 24 : 20;
  }
  if (model.settings?.showFooter !== false && model.footerText) {
    mctx.font = fontSmall;
    const footLines = wrapCanvasText(mctx, model.footerText, contentWidth);
    y += footLines.length * (is80 ? 22 : 18) + 6;
  }
  y += padding + 16; // Final padding

  const totalHeight = Math.ceil(y);

  // Real Rendering Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  // Fill White Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, totalHeight);

  // Fill Black Text
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;

  let curY = padding;

  // 1. Draw Logo
  if (logoImg) {
    const logoMaxW = is80 ? 220 : 160;
    const aspect = logoImg.height / (logoImg.width || 1);
    const logoW = Math.min(logoMaxW, logoImg.width);
    const logoH = logoW * aspect;
    const logoX = (width - logoW) / 2;
    ctx.drawImage(logoImg, logoX, curY, logoW, logoH);
    curY += logoH + 12;
  }

  // 2. Store Header
  ctx.textAlign = 'center';
  if (model.settings?.showStoreName !== false) {
    ctx.font = fontTitle;
    ctx.fillText(model.store?.storeName || 'GÓC • PHÊ & TRÀ', width / 2, curY + (is80 ? 24 : 20));
    curY += is80 ? 32 : 26;
  }

  if (model.settings?.showAddress !== false && model.store?.storeAddress) {
    ctx.font = fontSmall;
    const addrLines = wrapCanvasText(ctx, model.store.storeAddress, contentWidth);
    addrLines.forEach((l) => {
      ctx.fillText(l, width / 2, curY + (is80 ? 18 : 15));
      curY += is80 ? 22 : 18;
    });
  }

  if (model.settings?.showPhone !== false && model.store?.contactPhone) {
    ctx.font = fontSmall;
    ctx.fillText(`Hotline: ${model.store.contactPhone}`, width / 2, curY + (is80 ? 18 : 15));
    curY += is80 ? 24 : 20;
  }

  // Line helper
  const drawLine = (yPos, dashed = false) => {
    ctx.beginPath();
    if (dashed) {
      ctx.setLineDash([4, 4]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.moveTo(padding, yPos);
    ctx.lineTo(width - padding, yPos);
    ctx.stroke();
  };

  curY += 8;
  drawLine(curY);
  curY += 12;

  // 3. Receipt Title
  ctx.font = fontHeading;
  ctx.textAlign = 'center';
  ctx.fillText(model.isPrePrint ? 'PHIẾU TẠM TÍNH' : 'HÓA ĐƠN THANH TOÁN', width / 2, curY + (is80 ? 20 : 16));
  curY += is80 ? 28 : 24;

  if (model.isReprint) {
    ctx.font = fontSmall;
    ctx.fillText(`[IN LẠI LẦN ${model.reprintCount}]`, width / 2, curY + (is80 ? 16 : 13));
    curY += is80 ? 22 : 18;
  }

  drawLine(curY);
  curY += 14;

  // 4. Metadata
  const drawRow = (leftText, rightText, font = fontBody) => {
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.fillText(leftText, padding, curY + (is80 ? 18 : 15));
    ctx.textAlign = 'right';
    ctx.fillText(rightText, width - padding, curY + (is80 ? 18 : 15));
    curY += is80 ? 24 : 20;
  };

  if (model.settings?.showOrderId !== false) {
    drawRow('Số HĐ:', model.receiptNumber || model.orderId || 'N/A');
  }
  if (model.settings?.showTable !== false) {
    drawRow('Bàn:', model.tableName || 'Mang về');
  }
  if (model.settings?.showOrderTime !== false) {
    drawRow('Giờ gọi món:', model.orderCreatedAtFormatted || '--:--');
  }
  if (model.settings?.showReceiptTime !== false) {
    drawRow('Giờ xuất HĐ:', model.receiptIssuedAtFormatted || '--:--');
  }

  curY += 4;
  drawLine(curY, true);
  curY += 12;

  // 5. Items List
  items.forEach((it) => {
    const itemTitle = `${it.name || 'Món'}${it.size ? ` (${it.size})` : ''}`;
    const qty = it.quantity || 1;
    const unitPriceStr = it.unitPriceFormatted || `${(it.effectiveUnitPrice || it.price || 0).toLocaleString('vi-VN')}đ`;
    const lineTotalStr = it.lineTotalFormatted || `${(it.lineTotal || 0).toLocaleString('vi-VN')}đ`;

    ctx.font = fontBold;
    ctx.textAlign = 'left';
    const titleLines = wrapCanvasText(ctx, itemTitle, contentWidth);
    titleLines.forEach((l) => {
      ctx.fillText(l, padding, curY + (is80 ? 18 : 15));
      curY += is80 ? 24 : 20;
    });

    if (it.toppings && it.toppings.length > 0) {
      ctx.font = fontSmall;
      const topStr = `+ ${it.toppings.map((t) => t.name || t).join(', ')}`;
      const topLines = wrapCanvasText(ctx, topStr, contentWidth - 16);
      topLines.forEach((tl) => {
        ctx.fillText(tl, padding + 12, curY + (is80 ? 16 : 13));
        curY += is80 ? 20 : 16;
      });
    }

    if (it.notes) {
      ctx.font = fontSmall;
      const noteLines = wrapCanvasText(ctx, `* ${it.notes}`, contentWidth - 16);
      noteLines.forEach((nl) => {
        ctx.fillText(nl, padding + 12, curY + (is80 ? 16 : 13));
        curY += is80 ? 20 : 16;
      });
    }

    // Line 2: Qty x UnitPrice and LineTotal
    drawRow(`${qty} x ${unitPriceStr}`, lineTotalStr, fontBody);
    curY += 4;
  });

  drawLine(curY, true);
  curY += 12;

  // 6. Summary
  drawRow('Tiền hàng:', model.subtotalFormatted || `${(model.subtotal || 0).toLocaleString('vi-VN')}đ`, fontBody);
  if (model.discountAmount > 0) {
    drawRow(`Giảm giá (${model.discountPercent}%):`, `-${model.discountAmountFormatted}`, fontBody);
  }
  if (model.surcharge > 0) {
    drawRow('Phụ phí:', `+${model.surchargeFormatted}`, fontBody);
  }

  curY += 4;
  drawLine(curY);
  curY += 3;
  drawLine(curY);
  curY += 10;

  // Double Bold Total
  ctx.font = fontBigTotal;
  ctx.textAlign = 'left';
  ctx.fillText('TỔNG CỘNG:', padding, curY + (is80 ? 22 : 18));
  ctx.textAlign = 'right';
  ctx.fillText(model.totalFormatted || `${(model.total || 0).toLocaleString('vi-VN')}đ`, width - padding, curY + (is80 ? 22 : 18));
  curY += is80 ? 32 : 26;

  drawLine(curY);
  curY += 3;
  drawLine(curY);
  curY += 12;

  // Payment Method
  drawRow('Hình thức:', model.paymentMethodLabel || 'Tiền mặt', fontBody);

  curY += 4;
  drawLine(curY, true);
  curY += 12;

  // 7. Footer
  ctx.textAlign = 'center';
  if (model.settings?.showWifi !== false && model.store?.wifiPassword && model.store?.wifiOnReceipt !== false) {
    ctx.font = fontSmall;
    ctx.fillText(`Wifi: ${model.store.wifiPassword}`, width / 2, curY + (is80 ? 18 : 14));
    curY += is80 ? 22 : 18;
  }
  if (model.settings?.showFooter !== false && model.footerText) {
    ctx.font = fontSmall;
    const footLines = wrapCanvasText(ctx, model.footerText, contentWidth);
    footLines.forEach((fl) => {
      ctx.fillText(fl, width / 2, curY + (is80 ? 18 : 14));
      curY += is80 ? 22 : 18;
    });
  }

  return canvas;
}

/**
 * Renders a KitchenTicketModel onto an HTML5 Canvas with full Vietnamese diacritics.
 * 
 * @param {object} ticketModel - Output of buildKitchenTicketModel()
 * @param {object} [options]
 * @returns {Promise<HTMLCanvasElement|null>}
 */
export async function renderKitchenTicketToCanvas(ticketModel, options = {}) {
  if (typeof document === 'undefined') return null;

  const is80 = ticketModel.paperWidth === '80mm';
  const width = is80 ? CANVAS_WIDTH_80MM : CANVAS_WIDTH_58MM;
  const padding = is80 ? 18 : 12;
  const contentWidth = width - padding * 2;

  const FONT_FAMILY = '"Segoe UI", Roboto, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
  const fontTitle = `bold ${is80 ? 28 : 22}px ${FONT_FAMILY}`;
  const fontTable = `bold ${is80 ? 36 : 28}px ${FONT_FAMILY}`;
  const fontHeading = `bold ${is80 ? 22 : 18}px ${FONT_FAMILY}`;
  const fontBody = `normal ${is80 ? 18 : 15}px ${FONT_FAMILY}`;
  const fontBold = `bold ${is80 ? 19 : 16}px ${FONT_FAMILY}`;
  const fontSmall = `normal ${is80 ? 16 : 13}px ${FONT_FAMILY}`;

  // Measurement Canvas
  const mCanvas = document.createElement('canvas');
  mCanvas.width = width;
  mCanvas.height = 2000;
  const mctx = mCanvas.getContext('2d');

  let y = padding;
  y += is80 ? 34 : 28; // PHIẾU CHẾ BIẾN
  if (ticketModel.printMode === 'diff') y += is80 ? 24 : 20;
  y += 16; // Separator

  if (ticketModel.tableName) {
    y += is80 ? 44 : 36; // Big Table Name
    y += 16; // Separator
  }

  y += (is80 ? 24 : 20) * 3 + 12; // Metadata

  const items = ticketModel.items || [];
  mctx.font = fontBold;
  items.forEach((it) => {
    const itemTitle = `${it.name || 'Món'}${it.size ? ` (${it.size})` : ''}`;
    const lines = wrapCanvasText(mctx, itemTitle, contentWidth - 60);
    y += lines.length * (is80 ? 26 : 22);

    if (it.toppings && it.toppings.length > 0) {
      mctx.font = fontSmall;
      const topStr = `+ ${it.toppings.join(', ')}`;
      const topLines = wrapCanvasText(mctx, topStr, contentWidth - 20);
      y += topLines.length * (is80 ? 20 : 16);
      mctx.font = fontBold;
    }
    if (it.notes) {
      mctx.font = fontSmall;
      const noteLines = wrapCanvasText(mctx, `* Ghi chú: ${it.notes}`, contentWidth - 20);
      y += noteLines.length * (is80 ? 20 : 16);
      mctx.font = fontBold;
    }
    y += 12;
  });

  y += 18; // Separator
  y += is80 ? 32 : 26; // Total Quantity
  y += padding + 16;

  const totalHeight = Math.ceil(y);

  // Render Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, totalHeight);

  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;

  let curY = padding;

  const drawLine = (yPos, dashed = false) => {
    ctx.beginPath();
    if (dashed) ctx.setLineDash([4, 4]);
    else ctx.setLineDash([]);
    ctx.moveTo(padding, yPos);
    ctx.lineTo(width - padding, yPos);
    ctx.stroke();
  };

  // 1. Header
  ctx.textAlign = 'center';
  ctx.font = fontTitle;
  ctx.fillText('PHIẾU CHẾ BIẾN', width / 2, curY + (is80 ? 24 : 18));
  curY += is80 ? 32 : 26;

  if (ticketModel.printMode === 'diff') {
    ctx.font = fontSmall;
    ctx.fillText('MÓN GỌI THÊM', width / 2, curY + (is80 ? 18 : 14));
    curY += is80 ? 24 : 20;
  }

  curY += 6;
  drawLine(curY);
  curY += 12;

  // 2. Big Table Name
  if (ticketModel.tableName) {
    ctx.font = fontTable;
    ctx.textAlign = 'center';
    ctx.fillText(ticketModel.tableName.toUpperCase(), width / 2, curY + (is80 ? 32 : 26));
    curY += is80 ? 40 : 34;
    drawLine(curY);
    curY += 12;
  }

  // 3. Metadata
  const drawMeta = (label, val) => {
    ctx.font = fontBody;
    ctx.textAlign = 'left';
    ctx.fillText(label, padding, curY + (is80 ? 18 : 15));
    ctx.textAlign = 'right';
    ctx.fillText(val, width - padding, curY + (is80 ? 18 : 15));
    curY += is80 ? 24 : 20;
  };

  if (ticketModel.orderId) drawMeta('Mã đơn:', `#${ticketModel.orderId}`);
  if (ticketModel.printedAtDisplay) drawMeta('Thời gian:', ticketModel.printedAtDisplay);
  if (ticketModel.ticketNumber) drawMeta('Số phiếu:', ticketModel.ticketNumber);

  curY += 6;
  drawLine(curY, true);
  curY += 14;

  // 4. Items List
  items.forEach((it) => {
    const itemTitle = `${it.name || 'Món'}${it.size ? ` (${it.size})` : ''}`;
    const qtyText = `x ${it.quantity}`;

    ctx.font = fontBold;
    ctx.textAlign = 'left';
    const lines = wrapCanvasText(ctx, itemTitle, contentWidth - 60);
    lines.forEach((l, idx) => {
      ctx.fillText(l, padding, curY + (is80 ? 20 : 16));
      if (idx === 0) {
        ctx.textAlign = 'right';
        ctx.fillText(qtyText, width - padding, curY + (is80 ? 20 : 16));
        ctx.textAlign = 'left';
      }
      curY += is80 ? 24 : 20;
    });

    if (it.toppings && it.toppings.length > 0) {
      ctx.font = fontSmall;
      const topStr = `+ ${it.toppings.join(', ')}`;
      const topLines = wrapCanvasText(ctx, topStr, contentWidth - 20);
      topLines.forEach((tl) => {
        ctx.fillText(tl, padding + 12, curY + (is80 ? 16 : 13));
        curY += is80 ? 20 : 16;
      });
    }

    if (it.notes) {
      ctx.font = fontSmall;
      const noteLines = wrapCanvasText(ctx, `* Ghi chú: ${it.notes}`, contentWidth - 20);
      noteLines.forEach((nl) => {
        ctx.fillText(nl, padding + 12, curY + (is80 ? 16 : 13));
        curY += is80 ? 20 : 16;
      });
    }

    curY += 8;
  });

  drawLine(curY);
  curY += 14;

  // 5. Total Quantity
  ctx.font = fontBold;
  ctx.textAlign = 'left';
  ctx.fillText('TỔNG SỐ LƯỢNG:', padding, curY + (is80 ? 22 : 18));
  ctx.textAlign = 'right';
  ctx.fillText(`${ticketModel.totalQuantity || 0} món`, width - padding, curY + (is80 ? 22 : 18));
  curY += is80 ? 30 : 24;

  return canvas;
}

/**
 * Builds ESC/POS GS v 0 binary byte sequence for Graphic Mode Receipt
 */
export async function buildReceiptGraphicThermalBytes(model, options = {}) {
  const canvas = await renderReceiptToCanvas(model, options);
  if (!canvas) {
    throw new Error('Không thể tạo canvas đồ họa hóa đơn');
  }

  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rasterBytes = imageToEscPosRasterBytes(imgData);

  // Prepend INIT, append Feed & Cut
  const totalLen = 2 + rasterBytes.length + 6;
  const result = new Uint8Array(totalLen);
  result.set([0x1b, 0x40], 0); // ESC @ (INIT)
  result.set(rasterBytes, 2);
  result.set([0x1b, 0x64, 0x03, 0x1d, 0x56, 0x41, 0x10], 2 + rasterBytes.length); // FEED_3 + CUT

  return result;
}

/**
 * Builds ESC/POS GS v 0 binary byte sequence for Graphic Mode Kitchen Ticket
 */
export async function buildKitchenTicketGraphicThermalBytes(ticketModel, options = {}) {
  const canvas = await renderKitchenTicketToCanvas(ticketModel, options);
  if (!canvas) {
    throw new Error('Không thể tạo canvas đồ họa phiếu chế biến');
  }

  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rasterBytes = imageToEscPosRasterBytes(imgData);

  const totalLen = 2 + rasterBytes.length + 6;
  const result = new Uint8Array(totalLen);
  result.set([0x1b, 0x40], 0); // ESC @ (INIT)
  result.set(rasterBytes, 2);
  result.set([0x1b, 0x64, 0x03, 0x1d, 0x56, 0x41, 0x10], 2 + rasterBytes.length); // FEED_3 + CUT

  return result;
}
