/**
 * GÓC POS — Web Bluetooth Printing & ESC/POS 57mm Engine (Phase 4)
 * High-performance Bluetooth Thermal Receipt Printing (57mm / 58mm standard)
 */

import { formatVND } from './currency.js';
import { formatVietnamDisplayDate } from './dateTime.js';

// Target paper width: 57mm / 58mm (standard 32 characters per line in Font A)
export const LINE_WIDTH_57MM = 32;

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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^ -~\n\r\t]/g, ''); // keep only printable ASCII + whitespace
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
export function textToBytes(str = '', useNoAccents = true) {
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
  const useNoAccents = options.useNoAccents !== false;
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
  addLine('GOC - PHE & TRA');
  addBytes(ESC_POS.NORMAL_SIZE);
  addBytes(ESC_POS.BOLD_OFF);

  if (settings.branchAddress) addLine(settings.branchAddress);
  if (settings.hotline) addLine(`Hotline: ${settings.hotline}`);
  if (settings.wifiPassword) addLine(`Wifi: ${settings.wifiPassword}`);

  addLine(separator57mm('='));
  addBytes(ESC_POS.BOLD_ON);
  addLine(order.isPrePrint ? '--- PHIEU TAM TINH ---' : '--- HOA DON THANH TOAN ---');
  addBytes(ESC_POS.BOLD_OFF);
  addLine(separator57mm('='));

  // 3. Metadata (Left aligned)
  addBytes(ESC_POS.ALIGN_LEFT);
  addLine(formatKeyValue57mm('So HD:', order.id || 'N/A'));
  addLine(formatKeyValue57mm('Ban:', order.tableName || 'Mang ve'));
  addLine(formatKeyValue57mm('Thu ngan:', order.cashier || 'Thu ngan'));
  addLine(formatKeyValue57mm('Gio vao:', (order.createdAt || '').slice(11, 16) || '--:--'));
  addLine(formatKeyValue57mm('Gio ra:', new Date().toTimeString().slice(0, 5)));
  addLine(separator57mm('-'));

  // 4. Items Header (3 columns: 16 - 4 - 12)
  addBytes(ESC_POS.BOLD_ON);
  addLine(formatTableRow57mm('Ten mon', 'SL', 'T.Tien'));
  addBytes(ESC_POS.BOLD_OFF);
  addLine(separator57mm('-'));

  // 5. Items List
  const items = order.items || [];
  items.forEach((it) => {
    const itemTitle = `${it.name || 'Mon'}${it.size ? ` (${it.size})` : ''}`;
    const qtyStr = String(it.quantity || 1);
    const priceStr = formatVND(it.lineTotal || (it.price || 0) * it.quantity);

    addLine(formatTableRow57mm(itemTitle, qtyStr, priceStr));

    // Toppings indent
    if (it.toppings && it.toppings.length > 0) {
      const topNames = it.toppings.map((tp) => tp.name).join(', ');
      addLine(`  + ${topNames}`.slice(0, LINE_WIDTH_57MM));
    }
  });

  addLine(separator57mm('-'));

  // 6. Financial Summary
  addLine(formatKeyValue57mm('Tong tien hang:', formatVND(order.subtotal || order.total || 0)));

  if (order.discountPercent > 0) {
    const discAmt = Math.round(((order.subtotal || 0) * order.discountPercent) / 100);
    addLine(formatKeyValue57mm(`Giam gia (${order.discountPercent}%):`, `-${formatVND(discAmt)}`));
  }

  if (order.surcharge > 0) {
    addLine(formatKeyValue57mm('Phu phi:', `+${formatVND(order.surcharge)}`));
  }

  addLine(separator57mm('='));
  addBytes(ESC_POS.BOLD_ON);
  addBytes(ESC_POS.DOUBLE_HEIGHT);
  addLine(formatKeyValue57mm('TONG CONG:', formatVND(order.total || 0)));
  addBytes(ESC_POS.NORMAL_SIZE);
  addBytes(ESC_POS.BOLD_OFF);
  addLine(separator57mm('='));

  // 7. Payment Info
  const methodLabel = order.paymentMethod === 'vietqr' ? 'Chuyen khoan VietQR' : 'Tien mat';
  addLine(formatKeyValue57mm('Hinh thuc:', methodLabel));

  // 8. Footer Note
  addBytes(ESC_POS.ALIGN_CENTER);
  addLine('');
  addLine('Cam on quy khach & Hen gap lai!');
  addLine('Pass wifi: ' + (settings.wifiPassword || 'GocCoffee2026'));

  // 9. Feed & Cut
  addBytes(ESC_POS.FEED_5);
  addBytes(ESC_POS.CUT);

  return new Uint8Array(bytes);
}

/**
 * Builds ESC/POS Byte Buffer for Daily Revenue Close Slip (57mm format)
 */
export function buildDailyClose57mmBytes(report, settings = {}, options = {}) {
  const useNoAccents = options.useNoAccents !== false;
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
  addLine('GOC - PHE & TRA');
  addLine('PHIEU CHOT DOANH THU NGAY');
  addBytes(ESC_POS.BOLD_OFF);
  addLine(separator57mm('='));

  addBytes(ESC_POS.ALIGN_LEFT);
  addLine(formatKeyValue57mm('Ngay:', report.date || 'Hien tai'));
  addLine(formatKeyValue57mm('Gio chot:', new Date().toLocaleTimeString('vi-VN')));
  addLine(separator57mm('-'));

  addBytes(ESC_POS.BOLD_ON);
  addLine(formatKeyValue57mm('TONG DOANH THU:', formatVND(report.totalRevenue || 0)));
  addBytes(ESC_POS.BOLD_OFF);
  addLine(separator57mm('-'));

  addLine(formatKeyValue57mm('Tien mat:', formatVND(report.cashTotal || 0)));
  addLine(formatKeyValue57mm('VietQR:', formatVND(report.qrTotal || 0)));
  addLine(formatKeyValue57mm('Tong so don:', `${report.totalOrders || 0} don`));
  addLine(formatKeyValue57mm('Gia tri TB/don:', formatVND(report.averageOrderValue || 0)));

  if (report.totalDiscount > 0) {
    addLine(formatKeyValue57mm('Tong giam gia:', `-${formatVND(report.totalDiscount)}`));
  }
  if (report.totalSurcharge > 0) {
    addLine(formatKeyValue57mm('Tong phu phi:', `+${formatVND(report.totalSurcharge)}`));
  }

  // Top Products
  if (report.topProducts && report.topProducts.length > 0) {
    addLine(separator57mm('-'));
    addBytes(ESC_POS.BOLD_ON);
    addLine('TOP MON BAN CHAY:');
    addBytes(ESC_POS.BOLD_OFF);
    report.topProducts.slice(0, 5).forEach((p, idx) => {
      addLine(`${idx + 1}. ${p.name}: ${p.quantity} ly (${formatVND(p.revenue)})`.slice(0, LINE_WIDTH_57MM));
    });
  }

  addLine(separator57mm('='));
  addBytes(ESC_POS.ALIGN_CENTER);
  addLine('Da kiem toan va dong so');
  addLine('GOC POS Enterprise v4');

  addBytes(ESC_POS.FEED_5);
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
 * High-level Action: Print 57mm Daily Revenue Close Slip
 */
export async function printDailyClose57mm(report, settings = {}, options = {}) {
  const bytes = buildDailyClose57mmBytes(report, settings, options);
  await sendRawToPrinter(bytes);
  return true;
}
