/**
 * GÓC POS — Web Bluetooth Printing & ESC/POS 57mm Engine (Phase 4)
 * High-performance Bluetooth Thermal Receipt Printing (57mm / 58mm standard)
 */

import { formatVND } from './currency.js';
import { formatVietnamDisplayDate } from './dateTime.js';
import { wrapText } from './receiptEngine.js';
import {
  buildReceiptGraphicThermalBytes,
  buildKitchenTicketGraphicThermalBytes
} from './thermalCanvasRenderer.js';

// Target paper width: 57mm / 58mm (standard 32 characters per line in Font A)
export const LINE_WIDTH_57MM = 32;
// Target paper width: 80mm (standard 48 characters per line in Font A)
export const LINE_WIDTH_80MM = 48;

// Storage keys for remembered printer
const BT_STORAGE_KEY = 'goc_pos_bt_printer_name';
const BT_USE_NO_ACCENTS_KEY = 'goc_pos_bt_use_no_accents';

// Active Web Bluetooth connection references
let connectedDevice = null;
let printCharacteristic = null;

/**
 * Checks if Web Bluetooth API is supported in current browser environment
 */
export function isBluetoothSupported() {
  return typeof navigator !== 'undefined' && Boolean(navigator.bluetooth);
}

/**
 * Normalizes Vietnamese text by removing all diacritics.
 * Essential for 58mm mini printers whose ROM only supports standard ASCII.
 */
export function removeVietnameseDiacritics(str = '') {
  if (!str) return '';
  return str
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/₫/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^ -~\n\r\t]/g, ''); // keep only printable ASCII + whitespace
}

/**
 * Formats currency safely for thermal printers (ending in 'd' in no-accents mode to avoid '-æ')
 */
export function formatThermalCurrency(amount, useNoAccents = true) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return useNoAccents ? '0d' : '0đ';
  }
  const formattedNum = amount.toLocaleString('vi-VN');
  return useNoAccents ? `${formattedNum}d` : `${formattedNum}đ`;
}

/**
 * Formats a 3-column table row for 57mm paper (exactly 32 characters width):
 * - Item name: 16 characters (left aligned)
 * - Quantity: 4 characters (centered)
 * - Price: 12 characters (right aligned)
 */
export function formatTableRow57mm(col1 = '', col2 = '', col3 = '') {
  const c1Max = 16;
  const c2Max = 4;
  const c3Max = 12;

  // Truncate or pad col1
  let c1 = String(col1).slice(0, c1Max).padEnd(c1Max, ' ');

  // Center col2
  let s2 = String(col2).slice(0, c2Max);
  const padLeft = Math.floor((c2Max - s2.length) / 2);
  const padRight = c2Max - s2.length - padLeft;
  let c2 = ' '.repeat(Math.max(0, padLeft)) + s2 + ' '.repeat(Math.max(0, padRight));

  // Right-align col3
  let c3 = String(col3).slice(0, c3Max).padStart(c3Max, ' ');

  return c1 + c2 + c3;
}

/**
 * Formats a key-value row (e.g. "Tổng tiền: ............. 55.000đ")
 */
export function formatKeyValue57mm(key = '', val = '') {
  const k = String(key);
  const v = String(val);
  const spaceNeeded = LINE_WIDTH_57MM - k.length - v.length;
  if (spaceNeeded <= 0) {
    return k + ' ' + v;
  }
  return k + ' '.repeat(spaceNeeded) + v;
}

/**
 * Centers a text line within 32 characters
 */
export function centerText57mm(text = '') {
  const str = String(text);
  if (str.length >= LINE_WIDTH_57MM) return str.slice(0, LINE_WIDTH_57MM);
  const left = Math.floor((LINE_WIDTH_57MM - str.length) / 2);
  const right = LINE_WIDTH_57MM - str.length - left;
  return ' '.repeat(left) + str + ' '.repeat(right);
}

/**
 * Generates a dashed separator line of 32 dashes
 */
export function separator57mm(char = '-') {
  return char.repeat(LINE_WIDTH_57MM);
}

/**
 * Formats a 3-column table row for 80mm paper (48 characters width):
 * - Item name: 26 characters (left aligned)
 * - Quantity: 6 characters (centered)
 * - Price: 16 characters (right aligned)
 */
export function formatTableRow80mm(col1 = '', col2 = '', col3 = '') {
  const c1Max = 26;
  const c2Max = 6;
  const c3Max = 16;

  let c1 = String(col1).slice(0, c1Max).padEnd(c1Max, ' ');

  let s2 = String(col2).slice(0, c2Max);
  const padLeft = Math.floor((c2Max - s2.length) / 2);
  const padRight = c2Max - s2.length - padLeft;
  let c2 = ' '.repeat(Math.max(0, padLeft)) + s2 + ' '.repeat(Math.max(0, padRight));

  let c3 = String(col3).slice(0, c3Max).padStart(c3Max, ' ');

  return c1 + c2 + c3;
}

/**
 * Formats a key-value row for 80mm paper (48 characters width)
 */
export function formatKeyValue80mm(key = '', val = '') {
  const k = String(key);
  const v = String(val);
  const spaceNeeded = LINE_WIDTH_80MM - k.length - v.length;
  if (spaceNeeded <= 0) {
    return k + ' ' + v;
  }
  return k + ' '.repeat(spaceNeeded) + v;
}

/**
 * Centers a text line within 48 characters
 */
export function centerText80mm(text = '') {
  const str = String(text);
  if (str.length >= LINE_WIDTH_80MM) return str.slice(0, LINE_WIDTH_80MM);
  const left = Math.floor((LINE_WIDTH_80MM - str.length) / 2);
  const right = LINE_WIDTH_80MM - str.length - left;
  return ' '.repeat(left) + str + ' '.repeat(right);
}

/**
 * Generates a dashed separator line of 48 dashes
 */
export function separator80mm(char = '-') {
  return char.repeat(LINE_WIDTH_80MM);
}

/**
 * ESC/POS Command Byte Constants
 */
export const ESC_POS = {
  INIT: [0x1b, 0x40], // Initialize printer
  ALIGN_LEFT: [0x1b, 0x61, 0x00],
  ALIGN_CENTER: [0x1b, 0x61, 0x01],
  ALIGN_RIGHT: [0x1b, 0x61, 0x02],
  BOLD_ON: [0x1b, 0x45, 0x01],
  BOLD_OFF: [0x1b, 0x45, 0x00],
  DOUBLE_HEIGHT: [0x1d, 0x21, 0x01],
  DOUBLE_WIDTH_HEIGHT: [0x1d, 0x21, 0x11],
  NORMAL_SIZE: [0x1d, 0x21, 0x00],
  FEED_3: [0x1b, 0x64, 0x03],
  FEED_5: [0x1b, 0x64, 0x05],
  CUT: [0x1d, 0x56, 0x00] // Full cut
};

/**
 * Converts a string into Uint8Array bytes (ASCII or UTF-8)
 */
export function textToBytes(str = '', useNoAccents = false) {
  const processed = useNoAccents ? removeVietnameseDiacritics(str) : str;
  const encoder = new TextEncoder();
  return encoder.encode(processed);
}

/**
 * Connects to a Web Bluetooth Thermal Printer
 */
export async function connectBluetoothPrinter() {
  if (!isBluetoothSupported()) {
    throw new Error('Trình duyệt hiện tại không hỗ trợ Web Bluetooth. Vui lòng dùng Chrome hoặc Edge.');
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
        { services: ['e7810a0a-4426-4888-8868-34fb4cd201e1'] },
        { services: ['49535343-fe7d-4ae5-8fa9-9fafd205e455'] },
        { services: ['0000af30-0000-1000-8000-00805f9b34fb'] },
        { services: ['0000ff00-0000-1000-8000-00805f9b34fb'] }
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a0a-4426-4888-8868-34fb4cd201e1',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000af30-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb'
      ]
    });

    const server = await device.gatt.connect();

    // Iterate through known services to find a writable characteristic
    let foundChar = null;
    const services = await server.getPrimaryServices();

    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const c of characteristics) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            foundChar = c;
            break;
          }
        }
      } catch (_) {}
      if (foundChar) break;
    }

    if (!foundChar) {
      throw new Error('Không tìm thấy kênh ghi dữ liệu (Writable Characteristic) trên máy in.');
    }

    connectedDevice = device;
    printCharacteristic = foundChar;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BT_STORAGE_KEY, device.name || 'Máy in Bluetooth 57mm');
    }

    device.addEventListener('gattserverdisconnected', () => {
      connectedDevice = null;
      printCharacteristic = null;
    });

    return {
      success: true,
      deviceName: device.name || 'Máy in Bluetooth 57mm'
    };
  } catch (err) {
    console.warn('Lỗi kết nối Bluetooth Printer:', err);
    throw err;
  }
}

/**
 * Disconnects active Bluetooth printer
 */
export function disconnectBluetoothPrinter() {
  if (connectedDevice && connectedDevice.gatt.connected) {
    connectedDevice.gatt.disconnect();
  }
  connectedDevice = null;
  printCharacteristic = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(BT_STORAGE_KEY);
  }
}

/**
 * Returns the current printer connection status
 */
export function getBluetoothPrinterStatus() {
  const supported = isBluetoothSupported();
  const connected = Boolean(connectedDevice && connectedDevice.gatt && connectedDevice.gatt.connected && printCharacteristic);
  const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem(BT_STORAGE_KEY) : null;
  return {
    isSupported: supported,
    isConnected: connected,
    deviceName: connected ? (connectedDevice?.name || savedName || 'Máy in Bluetooth') : savedName
  };
}

/**
 * Sends a raw byte array chunk-by-chunk to the Bluetooth printer (preventing BLE buffer overflow)
 */
export async function sendRawToPrinter(byteArray) {
  if (!printCharacteristic) {
    throw new Error('Chưa kết nối máy in Bluetooth.');
  }

  const CHUNK_SIZE = 100; // 100 bytes chunk for BLE characteristic write
  for (let i = 0; i < byteArray.length; i += CHUNK_SIZE) {
    const chunk = byteArray.slice(i, i + CHUNK_SIZE);
    if (printCharacteristic.writeValueWithoutResponse) {
      await printCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await printCharacteristic.writeValue(chunk);
    }
    // Small delay between chunks to let thermal printer hardware buffer process
    await new Promise((r) => setTimeout(r, 20));
  }
}

/**
 * Builds ESC/POS Byte Buffer for a Customer Receipt (57mm format)
 */
export function buildReceipt57mmBytes(order, settings = {}, options = {}) {
  const useNoAccents = options.useNoAccents === true;
  const bytes = [];

  const addBytes = (arr) => {
    for (let i = 0; i < arr.length; i++) bytes.push(arr[i]);
  };

  const addText = (str) => {
    const b = textToBytes(str, useNoAccents);
    addBytes(b);
  };

  const addLine = (str = '') => {
    addText(str + '\n');
  };

  // 1. Initialize
  addBytes(ESC_POS.INIT);

  // 2. Header (Centered, Double Size Title)
  addBytes(ESC_POS.ALIGN_CENTER);
  addBytes(ESC_POS.BOLD_ON);
  addBytes(ESC_POS.DOUBLE_WIDTH_HEIGHT);
  addLine('GÓC • PHÊ & TRÀ');
  addBytes(ESC_POS.NORMAL_SIZE);
  addBytes(ESC_POS.BOLD_OFF);

  if (settings.branchAddress) addLine(settings.branchAddress);
  if (settings.hotline) addLine(`Hotline: ${settings.hotline}`);

  addLine(separator57mm('='));
  addBytes(ESC_POS.BOLD_ON);
  addLine(order.isPrePrint ? '--- PHIẾU TẠM TÍNH ---' : '--- HÓA ĐƠN THANH TOÁN ---');
  addBytes(ESC_POS.BOLD_OFF);
  addLine(separator57mm('='));

  // 3. Metadata (Left aligned)
  addBytes(ESC_POS.ALIGN_LEFT);
  addLine(formatKeyValue57mm('Số HĐ:', order.id || 'N/A'));
  addLine(formatKeyValue57mm('Bàn:', order.tableName || 'Mang về'));
  addLine(formatKeyValue57mm('Giờ gọi món:', (order.createdAt || '').slice(11, 16) || '--:--'));
  addLine(formatKeyValue57mm('Giờ xuất HĐ:', new Date().toTimeString().slice(0, 5)));
  addLine(separator57mm('-'));

  // 4. Items List (Clean 2-line layout without table headers)
  const items = order.items || [];
  items.forEach((it) => {
    const itemTitle = `${it.name || 'Món'}${it.size ? ` (${it.size})` : ''}`;
    const qty = it.quantity || 1;
    const lineTotal = Number(it.lineTotal || (Number(it.price || it.basePrice || 0) * qty));
    const effectiveUnitPrice = qty > 0 ? Math.round(lineTotal / qty) : Number(it.price || 0);

    // Line 1: Item title
    const titleLines = wrapText(itemTitle, LINE_WIDTH_57MM);
    titleLines.forEach((l) => addLine(l));

    // Toppings indent
    if (it.toppings && it.toppings.length > 0) {
      const topNames = it.toppings.map((tp) => tp.name).join(', ');
      addLine(`  + ${topNames}`.slice(0, LINE_WIDTH_57MM));
    }
    // Notes indent
    if (it.notes) {
      addLine(`  * ${it.notes}`.slice(0, LINE_WIDTH_57MM));
    }

    // Line 2: Qty x Unit price and Line total
    addLine(formatKeyValue57mm(`${qty} x ${formatThermalCurrency(effectiveUnitPrice, useNoAccents)}`, formatThermalCurrency(lineTotal, useNoAccents)));
  });

  addLine(separator57mm('-'));

  // 5. Financial Summary
  addLine(formatKeyValue57mm('Tiền hàng:', formatThermalCurrency(order.subtotal || order.total || 0, useNoAccents)));

  if (order.discountPercent > 0) {
    const discAmt = Math.round(((order.subtotal || 0) * order.discountPercent) / 100);
    addLine(formatKeyValue57mm(`Giảm giá (${order.discountPercent}%):`, `-${formatThermalCurrency(discAmt, useNoAccents)}`));
  }

  if (order.surcharge > 0) {
    addLine(formatKeyValue57mm('Phụ phí:', `+${formatThermalCurrency(order.surcharge, useNoAccents)}`));
  }

  addLine(separator57mm('='));
  addBytes(ESC_POS.BOLD_ON);
  addBytes(ESC_POS.DOUBLE_HEIGHT);
  addLine(formatKeyValue57mm('TỔNG CỘNG:', formatThermalCurrency(order.total || 0, useNoAccents)));
  addBytes(ESC_POS.NORMAL_SIZE);
  addBytes(ESC_POS.BOLD_OFF);
  addLine(separator57mm('='));

  // 6. Payment Info
  const methodLabel = order.paymentMethod === 'vietqr' ? 'Chuyển khoản VietQR' : 'Tiền mặt';
  addLine(formatKeyValue57mm('Hình thức:', methodLabel));
  addLine(separator57mm('-'));

  // 7. Footer Note (Single WiFi above thank you message)
  addBytes(ESC_POS.ALIGN_CENTER);
  if (settings.wifiPassword && settings.wifiOnReceipt !== false) {
    addLine(`Wifi: ${settings.wifiPassword}`);
  }
  addLine('Cảm ơn quý khách và hẹn gặp lại!');

  // 8. Feed & Cut
  addBytes(ESC_POS.FEED_3);
  addBytes(ESC_POS.CUT);

  return new Uint8Array(bytes);
}

/**
 * Builds ESC/POS Byte Buffer for Daily Revenue Close Slip (57mm format)
 */
export function buildDailyClose57mmBytes(report, settings = {}, options = {}) {
  const useNoAccents = options.useNoAccents === true;
  const bytes = [];

  const addBytes = (arr) => {
    for (let i = 0; i < arr.length; i++) bytes.push(arr[i]);
  };

  const addText = (str) => {
    const b = textToBytes(str, useNoAccents);
    addBytes(b);
  };

  const addLine = (str = '') => {
    addText(str + '\n');
  };

  addBytes(ESC_POS.INIT);
  addBytes(ESC_POS.ALIGN_CENTER);
  addBytes(ESC_POS.BOLD_ON);
  addLine('GÓC • PHÊ & TRÀ');
  addLine('PHIẾU CHỐT DOANH THU NGÀY');
  addBytes(ESC_POS.BOLD_OFF);
  addLine(separator57mm('='));

  addBytes(ESC_POS.ALIGN_LEFT);
  addLine(formatKeyValue57mm('Ngày:', report.date || 'Hiện tại'));
  addLine(formatKeyValue57mm('Giờ chốt:', new Date().toLocaleTimeString('vi-VN')));
  addLine(separator57mm('-'));

  addBytes(ESC_POS.BOLD_ON);
  addLine(formatKeyValue57mm('TỔNG DOANH THU:', formatThermalCurrency(report.totalRevenue || 0, useNoAccents)));
  addBytes(ESC_POS.BOLD_OFF);
  addLine(separator57mm('-'));

  addLine(formatKeyValue57mm('Tiền mặt:', formatThermalCurrency(report.cashTotal || 0, useNoAccents)));
  addLine(formatKeyValue57mm('VietQR:', formatThermalCurrency(report.qrTotal || 0, useNoAccents)));
  addLine(formatKeyValue57mm('Tổng số đơn:', `${report.totalOrders || 0} đơn`));
  addLine(formatKeyValue57mm('Giá trị TB/đơn:', formatThermalCurrency(report.averageOrderValue || 0, useNoAccents)));

  if (report.totalDiscount > 0) {
    addLine(formatKeyValue57mm('Tổng giảm giá:', `-${formatThermalCurrency(report.totalDiscount, useNoAccents)}`));
  }
  if (report.totalSurcharge > 0) {
    addLine(formatKeyValue57mm('Tổng phụ phí:', `+${formatThermalCurrency(report.totalSurcharge, useNoAccents)}`));
  }

  // Top Products
  if (report.topProducts && report.topProducts.length > 0) {
    addLine(separator57mm('-'));
    addBytes(ESC_POS.BOLD_ON);
    addLine('TOP MÓN BÁN CHẠY:');
    addBytes(ESC_POS.BOLD_OFF);
    report.topProducts.slice(0, 5).forEach((p, idx) => {
      addLine(`${idx + 1}. ${p.name}: ${p.quantity} ly (${formatThermalCurrency(p.revenue, useNoAccents)})`.slice(0, LINE_WIDTH_57MM));
    });
  }

  addLine(separator57mm('='));
  addBytes(ESC_POS.ALIGN_CENTER);
  addLine('Đã kiểm toán và đóng sổ');
  addLine('GÓC POS Enterprise');

  addBytes(ESC_POS.FEED_3);
  addBytes(ESC_POS.CUT);

  return new Uint8Array(bytes);
}

/**
 * High-level Action: Print a 57mm Customer Receipt
 */
export async function printReceipt57mm(order, settings = {}, options = {}) {
  const bytes = buildReceipt57mmBytes(order, settings, options);
  await sendRawToPrinter(bytes);
  return true;
}

/**
 * Builds ESC/POS Byte Buffer for any Thermal Paper Width (58mm / 80mm)
 * from a normalized ReceiptModel.
 *
 * @param {object} model - Canonical ReceiptModel from receiptEngine
 * @param {object} [options]
 * @param {Uint8Array} [options.logoRasterBytes] - Pre-rendered monochrome 1-bit raster
 * @param {boolean} [options.useNoAccents]
 * @returns {Uint8Array}
 */
export function buildReceiptThermalBytes(model, options = {}) {
  const is80 = model.paperWidth === '80mm';
  const lineWidth = is80 ? LINE_WIDTH_80MM : LINE_WIDTH_57MM;
  const useNoAccents = options.useNoAccents === true;
  const bytes = [];

  const addBytes = (arr) => {
    for (let i = 0; i < arr.length; i++) bytes.push(arr[i]);
  };

  const addText = (str) => {
    const b = textToBytes(str, useNoAccents);
    addBytes(b);
  };

  const addLine = (str = '') => {
    addText(str + '\n');
  };

  const sep = (char = '-') => char.repeat(lineWidth);
  const kv = (k, v) => {
    const kStr = String(k);
    const vStr = String(v);
    const space = lineWidth - kStr.length - vStr.length;
    return space <= 0 ? kStr + ' ' + vStr : kStr + ' '.repeat(space) + vStr;
  };

  // 1. Initialize
  addBytes(ESC_POS.INIT);

  // 2. Logo Raster (if provided & enabled)
  if (model.settings?.showLogo && options.logoRasterBytes && options.logoRasterBytes.length > 0) {
    addBytes(ESC_POS.ALIGN_CENTER);
    addBytes(options.logoRasterBytes);
    addLine('');
  }

  // 3. Header
  addBytes(ESC_POS.ALIGN_CENTER);
  if (model.settings?.showStoreName !== false) {
    addBytes(ESC_POS.BOLD_ON);
    addBytes(ESC_POS.DOUBLE_WIDTH_HEIGHT);
    addLine(model.store?.storeName || 'GÓC • PHÊ & TRÀ');
    addBytes(ESC_POS.NORMAL_SIZE);
    addBytes(ESC_POS.BOLD_OFF);
  }

  if (model.settings?.showAddress !== false && model.store?.storeAddress) {
    addLine(model.store.storeAddress);
  }
  if (model.settings?.showPhone !== false && model.store?.contactPhone) {
    addLine(`Hotline: ${model.store.contactPhone}`);
  }
  // Single WiFi is placed exclusively in footer per design specification

  addLine(sep('='));
  addBytes(ESC_POS.BOLD_ON);
  addLine(model.isPrePrint ? '--- PHIẾU TẠM TÍNH ---' : '--- HÓA ĐƠN THANH TOÁN ---');
  if (model.isReprint) {
    addLine(`[IN LẠI LẦN ${model.reprintCount}]`);
  }
  addBytes(ESC_POS.BOLD_OFF);
  addLine(sep('='));

  // 4. Metadata
  addBytes(ESC_POS.ALIGN_LEFT);
  if (model.settings?.showOrderId !== false) {
    addLine(kv('Số HĐ:', model.receiptNumber || model.orderId));
  }
  if (model.settings?.showTable !== false) {
    addLine(kv('Bàn:', model.tableName || 'Mang về'));
  }
  if (model.settings?.showOrderTime !== false) {
    addLine(kv('Giờ gọi món:', model.orderCreatedAtFormatted || '--:--'));
  }
  if (model.settings?.showReceiptTime !== false) {
    addLine(kv('Giờ xuất HĐ:', model.receiptIssuedAtFormatted || '--:--'));
  }
  addLine(sep('-'));

  // 5. Items List (Clean 2-line layout without table headers)
  const items = model.items || [];

  items.forEach((it) => {
    const itemTitle = `${it.name || 'Món'}${it.size ? ` (${it.size})` : ''}`;
    const qty = it.quantity || 1;
    const rawUnitPrice = it.unitPriceFormatted || `${(it.effectiveUnitPrice || it.price || 0).toLocaleString('vi-VN')}đ`;
    const rawLineTotal = it.lineTotalFormatted || `${(it.lineTotal || 0).toLocaleString('vi-VN')}đ`;
    const unitPriceStr = useNoAccents ? rawUnitPrice.replace(/đ/g, 'd') : rawUnitPrice;
    const lineTotalStr = useNoAccents ? rawLineTotal.replace(/đ/g, 'd') : rawLineTotal;

    // Line 1: Item title (word-wrapped across full paper width)
    const titleLines = wrapText(itemTitle, lineWidth);
    titleLines.forEach((l) => addLine(l));

    // Toppings indent
    if (it.toppings && it.toppings.length > 0) {
      const topNames = it.toppings.map((tp) => tp.name).join(', ');
      addLine(`  + ${topNames}`.slice(0, lineWidth));
    }
    // Notes indent
    if (it.notes) {
      addLine(`  * ${it.notes}`.slice(0, lineWidth));
    }

    // Line 2: Qty x Unit price and Line total
    addLine(kv(`${qty} x ${unitPriceStr}`, lineTotalStr));
  });

  addLine(sep('-'));

  // 6. Financial Summary
  const fmt = (val) => (useNoAccents ? String(val || '').replace(/đ/g, 'd') : String(val || ''));

  addLine(kv('Tiền hàng:', fmt(model.subtotalFormatted)));
  if (model.discountAmount > 0) {
    addLine(kv(`Giảm giá (${model.discountPercent}%):`, `-${fmt(model.discountAmountFormatted)}`));
  }
  if (model.surcharge > 0) {
    addLine(kv('Phụ phí:', `+${fmt(model.surchargeFormatted)}`));
  }

  addLine(sep('='));
  addBytes(ESC_POS.BOLD_ON);
  addBytes(ESC_POS.DOUBLE_HEIGHT);
  addLine(kv('TỔNG CỘNG:', fmt(model.totalFormatted)));
  addBytes(ESC_POS.NORMAL_SIZE);
  addBytes(ESC_POS.BOLD_OFF);
  addLine(sep('='));

  // 7. Payment Method
  addLine(kv('Hình thức:', model.paymentMethodLabel));
  addLine(sep('-'));

  // 8. Footer (Single WiFi above thank you message)
  addBytes(ESC_POS.ALIGN_CENTER);
  if (model.settings?.showWifi !== false && model.store?.wifiPassword && model.store?.wifiOnReceipt !== false) {
    addLine('Wifi: ' + model.store.wifiPassword);
  }
  if (model.settings?.showFooter !== false && model.footerText) {
    addLine(model.footerText);
  }

  // 9. Feed & Cut
  addBytes(ESC_POS.FEED_3);
  addBytes(ESC_POS.CUT);

  return new Uint8Array(bytes);
}

/**
 * Generates raw ESC/POS binary bytes for Kitchen / Bar Preparation Tickets
 * STRICTLY OMITS ALL PRICING, SUB-TOTALS, DISCOUNTS, REVENUE, VIETQR, AND WIFI.
 * Features extra-large Table Name, item quantity, toppings, and special notes.
 * 
 * @param {object} ticketModel - Output of buildKitchenTicketModel()
 * @param {object} [options]
 * @returns {Uint8Array}
 */
export function buildKitchenTicketThermalBytes(ticketModel, options = {}) {
  const is80 = ticketModel.paperWidth === '80mm';
  const lineWidth = is80 ? LINE_WIDTH_80MM : LINE_WIDTH_57MM;
  const useNoAccents = options.useNoAccents === true;
  const bytes = [];

  const addBytes = (arr) => {
    for (let i = 0; i < arr.length; i++) bytes.push(arr[i]);
  };

  const addText = (str) => {
    const b = textToBytes(str, useNoAccents);
    addBytes(b);
  };

  const addLine = (str = '') => {
    addText(str + '\n');
  };

  const sep = (char = '-') => char.repeat(lineWidth);
  const kv = (k, v) => {
    const kStr = String(k);
    const vStr = String(v);
    const space = lineWidth - kStr.length - vStr.length;
    return space <= 0 ? kStr + ' ' + vStr : kStr + ' '.repeat(space) + vStr;
  };

  // 1. Initialize
  addBytes(ESC_POS.INIT);

  // 2. Title Header: PHIẾU CHẾ BIẾN
  addBytes(ESC_POS.ALIGN_CENTER);
  addBytes(ESC_POS.BOLD_ON);
  addBytes(ESC_POS.DOUBLE_HEIGHT);
  addLine('PHIẾU CHẾ BIẾN');
  addBytes(ESC_POS.NORMAL_SIZE);
  addBytes(ESC_POS.BOLD_OFF);
  addLine(sep('='));

  // 3. Highlighted Table Name (Big, bold font for kitchen visibility)
  if (ticketModel.settings?.showTable !== false && ticketModel.tableName) {
    addBytes(ESC_POS.ALIGN_CENTER);
    addBytes(ESC_POS.BOLD_ON);
    addBytes(ESC_POS.DOUBLE_WIDTH_HEIGHT);
    addLine(`BÀN: ${ticketModel.tableName.toUpperCase()}`);
    addBytes(ESC_POS.NORMAL_SIZE);
    addBytes(ESC_POS.BOLD_OFF);
    addLine(sep('-'));
  }

  // 4. Ticket Metadata (Left Aligned)
  addBytes(ESC_POS.ALIGN_LEFT);
  if (ticketModel.settings?.showOrderId !== false && ticketModel.orderId) {
    addLine(`Mã đơn: #${ticketModel.orderId}`);
  }
  if (ticketModel.settings?.showTime !== false && ticketModel.printedAtDisplay) {
    addLine(`Thời gian: ${ticketModel.printedAtDisplay}`);
  }
  if (ticketModel.ticketNumber) {
    addLine(`Số phiếu: ${ticketModel.ticketNumber}`);
  }
  addLine(sep('-'));

  // 5. Items to prepare
  const items = ticketModel.items || [];
  if (items.length === 0) {
    addLine('(Không có món mới cần làm)');
  } else {
    items.forEach((it, idx) => {
      const idxNum = it.index || idx + 1;
      const extraTag = it.isAdditional ? ' [MÓN THÊM]' : '';
      const sizeTag = it.size ? ` (${it.size})` : '';

      addBytes(ESC_POS.BOLD_ON);
      addLine(`${idxNum}. ${it.name}${sizeTag}${extraTag}`);
      addBytes(ESC_POS.BOLD_OFF);

      // Toppings
      if (ticketModel.settings?.showToppings !== false && Array.isArray(it.toppings) && it.toppings.length > 0) {
        it.toppings.forEach((top) => {
          addLine(`   + ${top}`);
        });
      }

      // Notes
      if (ticketModel.settings?.showNotes !== false && it.notes) {
        addLine(`   * Ghi chú: ${it.notes}`);
      }

      // Quantity row (prominent)
      addBytes(ESC_POS.BOLD_ON);
      addLine(kv('   Số lượng:', `x ${it.quantity}`));
      addBytes(ESC_POS.BOLD_OFF);

      if (idx < items.length - 1) {
        addLine(sep('.'));
      }
    });
  }

  // 6. Total items summary
  addLine(sep('='));
  if (ticketModel.settings?.showItemCount !== false) {
    addBytes(ESC_POS.ALIGN_LEFT);
    addBytes(ESC_POS.BOLD_ON);
    addBytes(ESC_POS.DOUBLE_HEIGHT);
    addLine(kv('TỔNG SỐ LƯỢNG:', `${ticketModel.totalQuantity || 0} món`));
    addBytes(ESC_POS.NORMAL_SIZE);
    addBytes(ESC_POS.BOLD_OFF);
    addLine(sep('='));
  }

  // 7. Feed & Cut
  addBytes(ESC_POS.FEED_3);
  addBytes(ESC_POS.CUT);

  return new Uint8Array(bytes);
}

/**
 * Universal Action: Print any Thermal Receipt model
 * Automatically honors settings.thermalPrintMode ('text_no_accents' | 'graphic_accents')
 * @param {object} receiptModel
 * @param {object} [options]
 */
export async function printReceiptThermal(receiptModel, options = {}) {
  const thermalPrintMode =
    options.thermalPrintMode ||
    options.settings?.thermalPrintMode ||
    receiptModel.settings?.thermalPrintMode ||
    'text_no_accents';

  if (thermalPrintMode === 'graphic_accents' && typeof document !== 'undefined') {
    try {
      const graphicBytes = await buildReceiptGraphicThermalBytes(receiptModel, options);
      await sendRawToPrinter(graphicBytes);
      return true;
    } catch (err) {
      console.warn('Graphic receipt print failed, falling back to clean text mode:', err);
    }
  }

  // Text Mode (Hardware font ASCII without diacritics - fast & clean)
  const bytes = buildReceiptThermalBytes(receiptModel, {
    ...options,
    useNoAccents: true
  });
  await sendRawToPrinter(bytes);
  return true;
}

/**
 * Universal Action: Print Kitchen / Bar Preparation Ticket directly to Thermal Printer
 * Automatically honors settings.thermalPrintMode ('text_no_accents' | 'graphic_accents')
 * @param {object} ticketModel - Output of buildKitchenTicketModel()
 * @param {object} [options]
 */
export async function printKitchenTicketThermal(ticketModel, options = {}) {
  const thermalPrintMode =
    options.thermalPrintMode ||
    options.settings?.thermalPrintMode ||
    ticketModel.settings?.thermalPrintMode ||
    'text_no_accents';

  if (thermalPrintMode === 'graphic_accents' && typeof document !== 'undefined') {
    try {
      const graphicBytes = await buildKitchenTicketGraphicThermalBytes(ticketModel, options);
      await sendRawToPrinter(graphicBytes);
      return true;
    } catch (err) {
      console.warn('Graphic kitchen ticket print failed, falling back to clean text mode:', err);
    }
  }

  // Text Mode (Hardware font ASCII without diacritics - fast & clean)
  const bytes = buildKitchenTicketThermalBytes(ticketModel, {
    ...options,
    useNoAccents: true
  });
  await sendRawToPrinter(bytes);
  return true;
}

/**
 * High-level Action: Execute Kitchen / Preparation Ticket print with Web Bluetooth pairing
 * and graceful browser print fallback. Matches the Bluetooth workflow of bill printing.
 *
 * @param {object} params
 * @param {object} params.ticketModel - Model returned from buildKitchenTicketModel()
 * @param {object} [params.settings] - App / Store settings
 * @param {string} [params.method='bluetooth'] - 'bluetooth' | 'browser'
 * @param {Function} [params.showToast] - PosContext showToast handler
 * @param {Function} [params.onBrowserFallback] - Callback to trigger browser system print
 * @returns {Promise<{ success: boolean, cancelled?: boolean, fallbackToBrowser?: boolean }>}
 */
export async function executeKitchenTicketPrint({
  ticketModel,
  settings = {},
  method = 'bluetooth',
  showToast,
  onBrowserFallback
}) {
  // 1. If explicitly requested browser print
  if (method === 'browser') {
    if (onBrowserFallback) {
      onBrowserFallback(ticketModel);
    }
    return { success: true };
  }

  // 2. Check Web Bluetooth support
  if (!isBluetoothSupported()) {
    showToast?.('Trình duyệt không hỗ trợ Web Bluetooth. Đang chuyển sang in trình duyệt!', 'info');
    if (onBrowserFallback) {
      onBrowserFallback(ticketModel);
    }
    return { success: true, fallbackToBrowser: true };
  }

  // 3. Check connection status; if not connected, initiate pairing dialog
  const btStatus = getBluetoothPrinterStatus();
  if (!btStatus.isConnected) {
    try {
      const res = await connectBluetoothPrinter();
    } catch (err) {
      console.warn('Bluetooth pairing failed or cancelled:', err);
      // User dismissed or cancelled the device chooser dialog
      if (err.name === 'NotFoundError' || err.message?.toLowerCase().includes('cancel')) {
        return { success: false, cancelled: true };
      }
      showToast?.(err.message || 'Không thể kết nối máy in Bluetooth. Thử in qua trình duyệt!', 'error');
      return { success: false };
    }
  }

  // 4. Print via Bluetooth thermal printer
  try {
    await printKitchenTicketThermal(ticketModel, {
      settings,
      thermalPrintMode: settings?.thermalPrintMode
    });
    return { success: true };
  } catch (printErr) {
    console.warn('Bluetooth thermal kitchen ticket print failed:', printErr);
    showToast?.(printErr.message || 'Lỗi gửi lệnh in tới máy in Bluetooth. Chuyển sang in hệ thống!', 'error');
    if (onBrowserFallback) {
      onBrowserFallback(ticketModel);
    }
    return { success: true, fallbackToBrowser: true };
  }
}

/**
 * High-level Action: Print 57mm Daily Revenue Close Slip
 */
export async function printDailyClose57mm(report, settings = {}, options = {}) {
  const bytes = buildDailyClose57mmBytes(report, settings, options);
  await sendRawToPrinter(bytes);
  return true;
}
