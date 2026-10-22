/**
 * GÓC POS — Receipt Engine
 * Unified receipt data model, immutable snapshotting, and formatting engine
 * supporting 58mm (32 columns) and 80mm (48 columns) thermal paper.
 */

import { formatVND } from './currency.js';
import { formatVietnamDisplayDate, getVietnamTodayString } from './dateTime.js';

export const PAPER_WIDTHS = {
  K58: '58mm',
  K80: '80mm'
};

export const COLUMNS_BY_WIDTH = {
  '58mm': 32,
  '80mm': 48
};

export const DEFAULT_RECEIPT_SETTINGS = {
  showLogo: true,
  showStoreName: true,
  showAddress: true,
  showPhone: true,
  showOrderId: true,
  showTable: true,
  showOrderTime: true,
  showReceiptTime: true,
  showWifi: true,
  showFooter: true
};

/**
 * Formats a date string into Vietnam timezone DD/MM/YYYY HH:mm
 * @param {string|Date} dateInput
 * @returns {string}
 */
export function formatReceiptDateTime(dateInput) {
  if (!dateInput) return '--/--/---- --:--';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return String(dateInput);
  }
}

/**
 * Wraps text into lines that do not exceed maxWidth
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
export function wrapText(text = '', maxWidth = 32) {
  if (!text) return [''];
  const words = String(text).split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      if (word.length > maxWidth) {
        // Break long word
        for (let i = 0; i < word.length; i += maxWidth) {
          lines.push(word.slice(i, i + maxWidth));
        }
      } else {
        currentLine = word;
      }
    } else if ((currentLine + ' ' + word).length <= maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      if (word.length > maxWidth) {
        for (let i = 0; i < word.length; i += maxWidth) {
          lines.push(word.slice(i, i + maxWidth));
        }
        currentLine = '';
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Formats a key-value pair aligned to paper width (e.g. "Tổng cộng: ................. 55.000đ")
 * @param {string} key
 * @param {string} val
 * @param {number} totalWidth
 * @returns {string}
 */
export function formatReceiptKeyValue(key = '', val = '', totalWidth = 32) {
  const k = String(key);
  const v = String(val);
  const spaceNeeded = totalWidth - k.length - v.length;
  if (spaceNeeded <= 0) {
    return k + ' ' + v;
  }
  return k + ' '.repeat(spaceNeeded) + v;
}

/**
 * Formats an order item row with clean multi-line wrapping:
 * 58mm: Item name (16) | Qty (4) | Total (12) = 32 cols
 * 80mm: Item name (26) | Qty (6) | Total (16) = 48 cols
 *
 * @param {string} name
 * @param {number|string} qty
 * @param {number|string} priceFormatted
 * @param {'58mm'|'80mm'} paperWidth
 * @returns {string[]} Array of lines for thermal print
 */
export function formatReceiptItemRows(name, qty, priceFormatted, paperWidth = '58mm') {
  const is80 = paperWidth === '80mm';
  const nameWidth = is80 ? 26 : 16;
  const qtyWidth = is80 ? 6 : 4;
  const priceWidth = is80 ? 16 : 12;

  const nameLines = wrapText(name, nameWidth);
  const qtyStr = String(qty).slice(0, qtyWidth).padStart(qtyWidth, ' ');
  const priceStr = String(priceFormatted).slice(0, priceWidth).padStart(priceWidth, ' ');

  const result = [];

  // First line contains first line of name, Qty, and Price
  const firstCol = nameLines[0].padEnd(nameWidth, ' ');
  result.push(`${firstCol}${qtyStr}${priceStr}`);

  // Subsequent lines for wrapped name with blank Qty and Price
  for (let i = 1; i < nameLines.length; i++) {
    const wrappedCol = nameLines[i].padEnd(nameWidth, ' ');
    result.push(`${wrappedCol}${' '.repeat(qtyWidth + priceWidth)}`);
  }

  return result;
}

/**
 * Normalizes input order, store settings, and optional receipt snapshot
 * into a single canonical Receipt Model.
 *
 * @param {object} params
 * @param {object} params.order
 * @param {object} params.storeSettings
 * @param {object} [params.receiptRecord]
 * @param {boolean} [params.isPrePrint]
 * @param {'58mm'|'80mm'} [params.overridePaperWidth]
 * @returns {object} Canonical Receipt Data
 */
export function buildReceiptModel({
  order = {},
  storeSettings = {},
  receiptRecord = null,
  isPrePrint = false,
  overridePaperWidth = null
}) {
  // If a historical receipt snapshot exists, prioritize immutable store and order snapshot
  const store = receiptRecord?.store_snapshot || {
    storeName: storeSettings.store_name || storeSettings.branchName || 'GÓC',
    storeAddress: storeSettings.store_address || storeSettings.branchAddress || '18A Võ Văn Dũng, Phường An Nhơn, Bình Định',
    contactPhone: storeSettings.contact_phone || storeSettings.hotline || '1900 88 99 22',
    wifiPassword: storeSettings.wifi_password || storeSettings.wifiPassword || 'xincamon',
    wifiOnReceipt: storeSettings.wifi_on_receipt !== false && storeSettings.wifiOnReceipt !== false,
    logoOriginalUrl: storeSettings.logo_original_url || storeSettings.logoOriginalUrl || '/default-logo.png',
    logoThermalUrl: storeSettings.logo_thermal_url || storeSettings.logoThermalUrl || '/default-logo.png',
    receiptFooter: storeSettings.receipt_footer || storeSettings.receiptFooter || 'Cảm ơn quý khách và hẹn gặp lại!',
    receiptSettings: storeSettings.receipt_settings || storeSettings.receiptSettings || DEFAULT_RECEIPT_SETTINGS,
    bankAccount: storeSettings.bankAccount || {
      bankCode: storeSettings.bank_code || 'MB',
      accountNo: storeSettings.bank_account || '0988776655',
      accountHolder: storeSettings.bank_account_name || 'QUAN CA PHE GOC'
    }
  };

  const activeSettings = {
    ...DEFAULT_RECEIPT_SETTINGS,
    ...(store.receiptSettings || {})
  };

  const paperWidth = overridePaperWidth || receiptRecord?.paper_width || storeSettings.receipt_paper_width || storeSettings.receiptPaperWidth || '58mm';
  const totalCols = COLUMNS_BY_WIDTH[paperWidth] || 32;

  // Timestamps
  const orderCreatedAt = order.created_at || order.createdAt || new Date().toISOString();
  const receiptIssuedAt = receiptRecord?.issued_at || order.finished_at || order.finishedAt || new Date().toISOString();

  // Financial calculations
  const subtotal = Number(order.subtotal || order.total || 0);
  const discountPercent = Number(order.discount_percent || order.discountPercent || 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const surcharge = Number(order.surcharge || 0);
  const total = Number(order.total || (subtotal - discountAmount + surcharge));
  const paidAmount = Number(order.paid_amount || order.paidAmount || (order.status === 'completed' ? total : 0));

  // Payment method label
  let paymentMethodLabel = 'Tiền mặt';
  const method = order.payment_method || order.paymentMethod;
  if (method === 'vietqr' || method === 'bank_transfer') {
    paymentMethodLabel = 'Chuyển khoản VietQR';
  } else if (method === 'card') {
    paymentMethodLabel = 'Thẻ POS';
  } else if (method === 'mixed') {
    paymentMethodLabel = 'Thanh toán nhiều đợt';
  }

  // Items extraction
  const items = (order.items || []).map((it) => ({
    name: it.name || 'Món',
    size: it.size && it.size !== 'Std' && it.size !== 'Mặc định' ? it.size : '',
    quantity: Number(it.quantity || 1),
    price: Number(it.price || it.basePrice || it.unitPrice || 0),
    lineTotal: Number(it.lineTotal || (Number(it.price || it.basePrice || 0) * Number(it.quantity || 1))),
    toppings: it.toppings || [],
    notes: it.notes || ''
  }));

  // Reprint tracking
  const reprintCount = receiptRecord?.reprint_count || 0;
  const isReprint = Boolean(receiptRecord && reprintCount > 0);

  return {
    receiptId: receiptRecord?.id || `REC-${order.id || Date.now()}`,
    receiptNumber: receiptRecord?.receipt_number || `#${order.id || 'N/A'}`,
    orderId: order.id || 'N/A',
    tableName: order.table_name || order.tableName || 'Mang về',
    cashier: order.cashier || (storeSettings.currentCashier || '').split('(')[0].trim() || 'Thu ngân',
    isPrePrint: Boolean(isPrePrint),
    isReprint,
    reprintCount,
    paperWidth,
    totalCols,
    orderCreatedAt,
    orderCreatedAtFormatted: formatReceiptDateTime(orderCreatedAt),
    receiptIssuedAt,
    receiptIssuedAtFormatted: formatReceiptDateTime(receiptIssuedAt),
    items,
    subtotal,
    subtotalFormatted: formatVND(subtotal),
    discountPercent,
    discountAmount,
    discountAmountFormatted: formatVND(discountAmount),
    surcharge,
    surchargeFormatted: formatVND(surcharge),
    total,
    totalFormatted: formatVND(total),
    paidAmount,
    paidAmountFormatted: formatVND(paidAmount),
    paymentMethod: method || 'cash',
    paymentMethodLabel,
    store,
    settings: activeSettings,
    footerText: store.receiptFooter || 'Cảm ơn quý khách và hẹn gặp lại!'
  };
}

/**
 * Creates snapshot payload for storage in Supabase `receipts` table
 * @param {object} order
 * @param {object} storeSettings
 * @param {'58mm'|'80mm'} paperWidth
 * @returns {object} Receipt DB Record
 */
export function createReceiptSnapshotRecord(order, storeSettings, paperWidth = '58mm') {
  const now = new Date().toISOString();
  const receiptId = `REC-${order.id}-${Date.now().toString(36)}`;
  const receiptNumber = `HD-${order.id}`;

  return {
    id: receiptId,
    order_id: order.id,
    store_id: storeSettings.store_id || 'default_store',
    receipt_number: receiptNumber,
    store_snapshot: {
      storeName: storeSettings.store_name || storeSettings.branchName || 'GÓC',
      storeAddress: storeSettings.store_address || storeSettings.branchAddress || '18A Võ Văn Dũng, Phường An Nhơn, Bình Định',
      contactPhone: storeSettings.contact_phone || storeSettings.hotline || '1900 88 99 22',
      wifiPassword: storeSettings.wifi_password || storeSettings.wifiPassword || 'xincamon',
      wifiOnReceipt: storeSettings.wifi_on_receipt !== false && storeSettings.wifiOnReceipt !== false,
      logoOriginalUrl: storeSettings.logo_original_url || storeSettings.logoOriginalUrl || '/default-logo.png',
      logoThermalUrl: storeSettings.logo_thermal_url || storeSettings.logoThermalUrl || '/default-logo.png',
      receiptFooter: storeSettings.receipt_footer || storeSettings.receiptFooter || 'Cảm ơn quý khách và hẹn gặp lại!',
      receiptSettings: storeSettings.receipt_settings || storeSettings.receiptSettings || DEFAULT_RECEIPT_SETTINGS,
      bankAccount: storeSettings.bankAccount || {
        bankCode: storeSettings.bank_code || 'MB',
        accountNo: storeSettings.bank_account || '0988776655',
        accountHolder: storeSettings.bank_account_name || 'QUAN CA PHE GOC'
      }
    },
    order_snapshot: {
      id: order.id,
      tableName: order.table_name || order.tableName || 'Mang về',
      cashier: order.cashier || 'Thu ngân',
      customerCount: order.customer_count || order.customerCount || 1,
      items: order.items || [],
      subtotal: order.subtotal || order.total || 0,
      discountPercent: order.discount_percent || order.discountPercent || 0,
      surcharge: order.surcharge || 0,
      total: order.total || 0,
      paidAmount: order.paid_amount || order.paidAmount || order.total || 0,
      paymentMethod: order.payment_method || order.paymentMethod || 'cash',
      createdAt: order.created_at || order.createdAt || now,
      finishedAt: order.finished_at || order.finishedAt || now
    },
    cashier: order.cashier || 'Thu ngân',
    paper_width: paperWidth,
    issued_at: now,
    reprint_count: 0,
    last_reprinted_at: null,
    created_at: now
  };
}
