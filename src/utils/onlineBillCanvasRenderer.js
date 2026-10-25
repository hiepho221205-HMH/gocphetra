/**
 * GÓC POS — Online Bill Canvas Graphic Renderer & Exporter
 * Renders high-fidelity, high-DPI (2x Retina) digital receipts as standalone PNG images.
 * Redesigned with a modern, premium aesthetic:
 * - Ambient Pastel Aurora Glow background (linear-gradient 135deg + multi-color radial glowing accents)
 * - Centered white card with rounded corners (30px radius) and subtle drop shadow
 * - Subtle GÓC brand watermark (opacity ~0.07) at center of the card
 * - Centered minimalist Header: Store name in bold uppercase, address, contact hotline
 * - Balanced metadata block: Date/Time in Asia/Ho_Chi_Minh, Order ID, Table/Takeaway, Cashier/Customer
 * - Elegant dashed dividers between items and financial blocks
 * - Item titles in bold uppercase with quantity × unit price and line totals
 * - Prominent Grand Total in brand color #214E34
 * - Full-width payment status badge: "✔ ĐÃ THANH TOÁN" (mint pastel) vs "⏳ CHƯA THANH TOÁN" (warm amber pastel)
 * - Courteous closing message and GÓC POS signature
 * - Dynamic height hugging content with uniform 32px padding (no excess bottom whitespace)
 * - Standard filename: GOC-HoaDon-[MaDon].png
 */

import { formatVND } from './currency.js';
import { formatReceiptDateTime } from './receiptEngine.js';

const FONT_FAMILY = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Global cache for GÓC watermark logo image
let cachedLogoImage = null;
let logoLoadPromise = null;

/**
 * Preloads the official GÓC brand logo for canvas watermarking
 * @returns {Promise<HTMLImageElement|null>}
 */
export function preloadLogoImage() {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(null);
  }
  if (cachedLogoImage && cachedLogoImage.complete && cachedLogoImage.naturalWidth > 0) {
    return Promise.resolve(cachedLogoImage);
  }
  if (logoLoadPromise) {
    return logoLoadPromise;
  }

  logoLoadPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedLogoImage = img;
      resolve(img);
    };
    img.onerror = () => {
      // Graceful fallback if image load fails
      resolve(null);
    };
    // Primary path in public/images, fallback to default-logo
    img.src = '/images/goc-logo.png';
  });

  return logoLoadPromise;
}

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
function drawDashedLine(ctx, x1, y, x2, color = '#E5E7EB', dash = [5, 4], lineWidth = 1) {
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
 * Draws a soft glowing radial spot on the background canvas
 */
function drawGlowSpot(ctx, x, y, radius, colorHex, alpha = 0.35) {
  ctx.save();
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, colorHex);
  grad.addColorStop(0.5, colorHex);
  grad.addColorStop(1, 'transparent');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Calculates dynamic height required to render receipt without cutoffs or dead whitespace
 */
function calculateReceiptLayout(model, printableWidth, ctx) {
  const storeAddress = model.store?.storeAddress || '76A Võ Văn Dũng, P. An Nhơn, Gia Lai';

  ctx.font = `600 12px ${FONT_FAMILY}`;
  const addressLines = wrapText(ctx, `ĐC: ${storeAddress}`, printableWidth);

  let height = 0;
  // Card top internal padding
  height += 28;

  // Header: Store Name, Address, Hotline
  height += 28; // Store Name
  height += addressLines.length * 17; // Store Address
  height += 18; // Contact Hotline
  height += 14; // Spacing before dashed separator

  // Separator
  height += 14;

  // Meta block: Date, Order ID, Table, Cashier/Customer
  height += 46;
  height += 14; // Separator

  // Items
  const items = model.items || [];
  for (const it of items) {
    ctx.font = `800 13.5px ${FONT_FAMILY}`;
    const nameLines = wrapText(ctx, (it.name || 'MÓN').toUpperCase(), printableWidth - 90);
    height += nameLines.length * 19; // Item Name
    height += 19; // Qty x Unit Price line
    if (it.toppings && it.toppings.length > 0) {
      height += it.toppings.length * 15; // Toppings
    }
    if (it.notes) {
      height += 15; // Notes
    }
    height += 14; // Dashed separator between items
  }

  // Financial summary
  height += 6;
  height += 22; // Subtotal
  if (model.discountAmount > 0) {
    height += 20; // Discount
  }
  if (model.surcharge > 0) {
    height += 20; // Surcharge
  }
  height += 12; // Separator before total
  height += 36; // Big Total (Tổng cộng)
  height += 16; // Spacing before badge

  // Payment Status Badge
  height += 38; // Badge height

  // Footer note
  height += 20; // Spacing
  height += 18; // Thank you text
  height += 16; // Branding text
  height += 28; // Card bottom internal padding

  return Math.ceil(height);
}

/**
 * Renders high-DPI HTML5 Canvas for the Digital Receipt with Pastel Aurora Glow
 * @param {object} model - Canonical receipt model from receiptEngine
 * @param {HTMLImageElement|null} [logoImg=null] - Optional preloaded logo image for watermark
 * @returns {HTMLCanvasElement}
 */
export function renderOnlineBillToCanvas(model, logoImg = cachedLogoImage) {
  if (typeof document === 'undefined') return null;

  // Visual layout dimensions in CSS pixels
  const CARD_WIDTH = 420;
  const CANVAS_PADDING_X = 32;
  const CANVAS_PADDING_Y = 32;
  const CANVAS_WIDTH = CARD_WIDTH + CANVAS_PADDING_X * 2; // 484px
  const CARD_INTERNAL_PADDING = 24;
  const PRINTABLE_WIDTH = CARD_WIDTH - CARD_INTERNAL_PADDING * 2;
  const SCALE = 2; // 2x Retina rendering for crisp typography

  // 1. Measure required card height dynamically based on exact content
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  const cardHeight = calculateReceiptLayout(model, PRINTABLE_WIDTH, mctx);
  const canvasHeight = cardHeight + CANVAS_PADDING_Y * 2;

  // 2. Setup actual canvas with Retina backing
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH * SCALE;
  canvas.height = canvasHeight * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 3. Render Pastel Aurora Glow Background (Static representation of conic/radial gradients)
  const bgGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, canvasHeight);
  bgGrad.addColorStop(0, '#FFE8F3'); // Soft pink
  bgGrad.addColorStop(0.48, '#EDF6FC'); // Soft clean ice
  bgGrad.addColorStop(1, '#D9F3FF'); // Soft baby blue
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);

  // Soft glowing aurora spots replicating pastel conic blur
  drawGlowSpot(ctx, CANVAS_WIDTH * 0.15, canvasHeight * 0.15, 200, '#FF9AA2', 0.40); // Soft pink
  drawGlowSpot(ctx, CANVAS_WIDTH * 0.85, canvasHeight * 0.20, 220, '#FFDAC1', 0.45); // Pastel peach
  drawGlowSpot(ctx, CANVAS_WIDTH * 0.08, canvasHeight * 0.55, 190, '#E2F0CB', 0.35); // Mint green
  drawGlowSpot(ctx, CANVAS_WIDTH * 0.90, canvasHeight * 0.85, 230, '#A2E4FF', 0.40); // Baby blue
  drawGlowSpot(ctx, CANVAS_WIDTH * 0.20, canvasHeight * 0.82, 210, '#C9AFFF', 0.38); // Lavender

  // Subtle ambient radial overlay
  const ambientOverlay = ctx.createRadialGradient(
    CANVAS_WIDTH / 2, canvasHeight / 2, 80,
    CANVAS_WIDTH / 2, canvasHeight / 2, canvasHeight / 1.5
  );
  ambientOverlay.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
  ambientOverlay.addColorStop(1, 'rgba(0, 0, 0, 0.04)');
  ctx.fillStyle = ambientOverlay;
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);

  // 4. Centered White Card with 30px rounded corners & soft shadow
  const cardX = CANVAS_PADDING_X;
  const cardY = CANVAS_PADDING_Y;
  const cardW = CARD_WIDTH;
  const cardH = cardHeight;
  const cardRadius = 30;

  // Drop shadow
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(100, 116, 139, 0.18)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 10;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.fill();
  ctx.restore();

  // Crisp subtle border
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.stroke();
  ctx.restore();

  // 5. Watermark Logo at Center of the Card (Opacity 0.07)
  const cardCenterX = cardX + cardW / 2;
  const cardCenterY = cardY + cardH / 2;
  const watermarkSize = Math.min(cardW * 0.65, 240);

  ctx.save();
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    ctx.globalAlpha = 0.07;
    ctx.drawImage(
      logoImg,
      cardCenterX - watermarkSize / 2,
      cardCenterY - watermarkSize / 2,
      watermarkSize,
      watermarkSize
    );
  } else {
    // Elegant vector text fallback watermark if image is unavailable
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = '#214E34';
    ctx.font = `900 84px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GÓC', cardCenterX, cardCenterY - 10);
    ctx.font = `800 18px ${FONT_FAMILY}`;
    ctx.fillText('— PHÊ • TRÀ —', cardCenterX, cardCenterY + 44);
  }
  ctx.restore();

  // 6. Draw Content Inside White Card
  let curY = cardY + 28;
  const contentLeft = cardX + CARD_INTERNAL_PADDING;
  const contentRight = cardX + cardW - CARD_INTERNAL_PADDING;
  const printableWidth = contentRight - contentLeft;

  // ================= HEADER =================
  const storeName = (model.store?.storeName || 'GÓC PHÊ – TRÀ').toUpperCase();
  const storeAddress = model.store?.storeAddress || '76A Võ Văn Dũng, P. An Nhơn, Gia Lai';
  const contactPhone = model.store?.contactPhone || '0369623489';

  ctx.fillStyle = '#0F172A';
  ctx.font = `900 20px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText(storeName, cardCenterX, curY);
  curY += 20;

  ctx.fillStyle = '#475569';
  ctx.font = `600 12px ${FONT_FAMILY}`;
  const addressLines = wrapText(ctx, `ĐC: ${storeAddress}`, printableWidth);
  for (const line of addressLines) {
    ctx.fillText(line, cardCenterX, curY);
    curY += 17;
  }
  ctx.fillText(`Hotline: ${contactPhone}`, cardCenterX, curY);
  curY += 16;

  // Dashed separator after store info
  drawDashedLine(ctx, contentLeft, curY, contentRight, '#E2E8F0', [5, 4]);
  curY += 16;

  // ================= METADATA BLOCK =================
  const formattedDateTime = formatReceiptDateTime(model.receiptIssuedAt || model.orderCreatedAt);
  const tableLabel = model.table ? `Bàn: ${model.table}` : 'Mang đi';
  const orderCode = model.orderId ? `#${model.orderId}` : '#ORD-GOC';
  const customerName = model.order?.customerName || model.order?.customer || 'Khách lẻ';

  ctx.font = `600 12px ${FONT_FAMILY}`;
  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'left';
  ctx.fillText(`Ngày: ${formattedDateTime}`, contentLeft, curY);

  ctx.textAlign = 'right';
  ctx.fillText(`Mã đơn: ${orderCode}`, contentRight, curY);
  curY += 18;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#214E34'; // Highlight table in brand green
  ctx.font = `700 12px ${FONT_FAMILY}`;
  ctx.fillText(`Khu vực: ${tableLabel}`, contentLeft, curY);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#475569';
  ctx.font = `600 12px ${FONT_FAMILY}`;
  ctx.fillText(`KH: ${customerName}`, contentRight, curY);
  curY += 14;

  drawDashedLine(ctx, contentLeft, curY, contentRight, '#E2E8F0', [5, 4]);
  curY += 16;

  // ================= ITEMS LIST =================
  const items = model.items || [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const itemName = (it.name || 'Món').toUpperCase();
    const qty = it.quantity || 1;
    const unitPrice = it.effectiveUnitPrice || it.price || 0;
    const lineTotal = it.lineTotal || (qty * unitPrice);

    // Item Title (Left) + Line Total (Right)
    ctx.font = `800 13.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'left';

    const nameLines = wrapText(ctx, itemName, printableWidth - 95);
    for (let l = 0; l < nameLines.length; l++) {
      ctx.fillText(nameLines[l], contentLeft, curY);
      if (l === 0) {
        ctx.textAlign = 'right';
        ctx.fillText(formatVND(lineTotal), contentRight, curY);
        ctx.textAlign = 'left';
      }
      curY += 18;
    }

    // Row: [Quantity] x [Unit Price] (Left)
    ctx.font = `600 12px ${FONT_FAMILY}`;
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'left';
    ctx.fillText(`${qty} × ${formatVND(unitPrice)}`, contentLeft, curY);
    curY += 16;

    // Optional Toppings
    if (it.toppings && it.toppings.length > 0) {
      ctx.font = `500 11px ${FONT_FAMILY}`;
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'left';
      for (const tp of it.toppings) {
        const topPrice = tp.priceOverride || tp.price || 0;
        const tpLabel = `+ ${tp.name}${topPrice > 0 ? ` (${formatVND(topPrice)})` : ''}`;
        ctx.fillText(tpLabel, contentLeft + 6, curY);
        curY += 15;
      }
    }

    // Optional notes
    if (it.notes) {
      ctx.font = `italic 11px ${FONT_FAMILY}`;
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'left';
      ctx.fillText(`Ghi chú: ${it.notes}`, contentLeft + 6, curY);
      curY += 15;
    }

    curY += 4;
    drawDashedLine(ctx, contentLeft, curY, contentRight, '#F1F5F9', [3, 3]);
    curY += 14;
  }

  // ================= FINANCIAL SUMMARY =================
  const subtotal = model.subtotal || 0;
  const discountAmount = model.discountAmount || 0;
  const discountPercent = model.discountPercent || 0;
  const surcharge = model.surcharge || 0;
  const grandTotal = model.total || (subtotal - discountAmount + surcharge);
  const totalItemCount = (model.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);

  // Subtotal (Tổng tiền hàng)
  ctx.font = `600 12px ${FONT_FAMILY}`;
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'left';
  ctx.fillText(`Tổng tiền hàng (${totalItemCount} món)`, contentLeft, curY);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 12.5px ${FONT_FAMILY}`;
  ctx.fillText(formatVND(subtotal), contentRight, curY);
  curY += 20;

  // Discount (if any)
  if (discountAmount > 0) {
    ctx.font = `600 12px ${FONT_FAMILY}`;
    ctx.fillStyle = '#059669'; // Emerald
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
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    ctx.fillText('Phụ thu / Phí dịch vụ', contentLeft, curY);
    ctx.textAlign = 'right';
    ctx.font = `700 12px ${FONT_FAMILY}`;
    ctx.fillText(`+${formatVND(surcharge)}`, contentRight, curY);
    curY += 18;
  }

  curY += 4;
  drawDashedLine(ctx, contentLeft, curY, contentRight, '#CBD5E1', [5, 4], 1.2);
  curY += 22;

  // GRAND TOTAL (TỔNG CỘNG) Highlighted in #214E34
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = `800 14px ${FONT_FAMILY}`;
  ctx.fillText('TỔNG CỘNG', contentLeft, curY);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#214E34'; // Bold Brand Green
  ctx.font = `900 22px ${FONT_FAMILY}`;
  ctx.fillText(formatVND(grandTotal), contentRight, curY);
  curY += 26;

  // ================= PAYMENT STATUS BADGE =================
  const isPaid = model.order?.status === 'completed' || model.isPaid;
  const statusW = printableWidth;
  const statusH = 38;
  const badgeX = contentLeft;
  const badgeY = curY;

  ctx.save();
  if (isPaid) {
    ctx.fillStyle = '#ECFDF5'; // Mint pastel bg
    ctx.strokeStyle = '#A7F3D0'; // Mint border
  } else {
    ctx.fillStyle = '#FFFBEB'; // Warm cream/amber pastel bg
    ctx.strokeStyle = '#FDE68A'; // Warm amber border
  }
  ctx.lineWidth = 1.2;
  drawRoundedRect(ctx, badgeX, badgeY, statusW, statusH, 12);
  ctx.fill();
  ctx.stroke();

  ctx.font = `800 12.5px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  if (isPaid) {
    ctx.fillStyle = '#065F46'; // Emerald dark text
    const methodStr = model.paymentMethodLabel ? ` • ${model.paymentMethodLabel.toUpperCase()}` : '';
    ctx.fillText(`✔ ĐÃ THANH TOÁN${methodStr}`, badgeX + statusW / 2, badgeY + 24);
  } else {
    ctx.fillStyle = '#92400E'; // Amber dark text
    ctx.fillText('⏳ CHƯA THANH TOÁN', badgeX + statusW / 2, badgeY + 24);
  }
  ctx.restore();
  curY += statusH + 20;

  // ================= FOOTER =================
  ctx.textAlign = 'center';
  ctx.font = `600 12px ${FONT_FAMILY}`;
  ctx.fillStyle = '#475569';
  ctx.fillText(model.store?.receiptFooter || 'Cảm ơn quý khách và hẹn gặp lại!', cardCenterX, curY);
  curY += 18;

  ctx.font = `600 10.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('Một sản phẩm của GÓC POS', cardCenterX, curY);

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
export async function exportOnlineBillBlob(model) {
  // Preload logo for watermark if not ready yet
  const logo = await preloadLogoImage();
  const canvas = renderOnlineBillToCanvas(model, logo);

  if (!canvas) {
    throw new Error('Không thể khởi tạo Canvas trình xuất hóa đơn.');
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Lỗi chuyển đổi Canvas sang Blob PNG.'));
      }
    }, 'image/png');
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
