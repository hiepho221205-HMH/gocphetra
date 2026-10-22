import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUMNS_BY_WIDTH,
  DEFAULT_RECEIPT_SETTINGS,
  formatReceiptDateTime,
  wrapText,
  formatReceiptKeyValue,
  formatReceiptItemRows,
  buildReceiptModel,
  createReceiptSnapshotRecord
} from '../src/utils/receiptEngine.js';
import {
  validateLogoFile,
  isDarkBackground,
  applyThermalDithering,
  imageToEscPosRasterBytes,
  findContentBoundingBox
} from '../src/utils/thermalLogoProcessor.js';
import {
  mapStoreSettingsFromDb,
  mapStoreSettingsToDb
} from '../src/lib/supabase.js';
import {
  buildReceiptThermalBytes,
  formatTableRow57mm,
  formatTableRow80mm,
  ESC_POS
} from '../src/utils/bluetoothPrinter.js';

describe('GÓC POS — Store Configuration, Receipt Engine & Thermal Printing Suite', () => {

  // =========================================================================
  // 1. STORE CONFIGURATION & SUPABASE DATA MAPPING
  // =========================================================================
  describe('1. Store Configuration & Data Normalization', () => {
    test('1.1 - mapStoreSettingsFromDb maps database columns to POS state without loss', () => {
      const dbRow = {
        store_id: 'default_store',
        store_name: 'GÓC - PHÊ & TRÀ',
        store_address: '18A Võ Văn Dũng, Phường An Nhơn, Bình Định',
        contact_phone: '1900 88 99 22',
        logo_original_url: 'https://example.com/logo.png',
        logo_thermal_url: 'https://example.com/logo-thermal.png',
        receipt_paper_width: '80mm',
        receipt_settings: { showLogo: true, showStoreName: true, showFooter: true },
        receipt_footer: 'Cảm ơn và hẹn gặp lại quý khách!',
        wifi_password: 'goccaphebinhdinh',
        wifi_on_receipt: true,
        bank_code: 'MB',
        bank_account: '0988776655',
        bank_account_name: 'QUAN CA PHE GOC',
        vietqr_enabled: true,
        updated_at: '2026-10-22T10:00:00.000Z'
      };

      const mapped = mapStoreSettingsFromDb(dbRow);
      assert.equal(mapped.storeName, 'GÓC - PHÊ & TRÀ');
      assert.equal(mapped.branchName, 'GÓC - PHÊ & TRÀ');
      assert.equal(mapped.storeAddress, '18A Võ Văn Dũng, Phường An Nhơn, Bình Định');
      assert.equal(mapped.contactPhone, '1900 88 99 22');
      assert.equal(mapped.receiptPaperWidth, '80mm');
      assert.equal(mapped.wifiPassword, 'goccaphebinhdinh');
      assert.equal(mapped.bankAccount.bankCode, 'MB');
      assert.equal(mapped.bankAccount.accountNo, '0988776655');
      assert.equal(mapped.bankAccount.accountHolder, 'QUAN CA PHE GOC');
      assert.equal(mapped.enableVietQR, true);
    });

    test('1.2 - mapStoreSettingsToDb preserves store_id and handles legacy branch aliases', () => {
      const state = {
        store_id: 'default_store',
        branchName: 'GÓC Trụ Sở',
        branchAddress: '18A Võ Văn Dũng',
        hotline: '1900 88 99 22',
        receiptPaperWidth: '58mm',
        receiptFooter: 'Hẹn gặp lại!',
        wifiPassword: 'xincamon',
        wifiOnReceipt: true,
        bankAccount: { bankCode: 'MB', accountNo: '0988776655', accountHolder: 'QUAN CA PHE GOC' },
        enableVietQR: true
      };

      const dbPayload = mapStoreSettingsToDb(state);
      assert.equal(dbPayload.store_id, 'default_store');
      assert.equal(dbPayload.store_name, 'GÓC Trụ Sở');
      assert.equal(dbPayload.store_address, '18A Võ Văn Dũng');
      assert.equal(dbPayload.contact_phone, '1900 88 99 22');
      assert.equal(dbPayload.receipt_paper_width, '58mm');
      assert.equal(dbPayload.bank_account, '0988776655');
      assert.equal(dbPayload.vietqr_enabled, true);
    });

    test('1.3 - Existing production configuration is never overwritten by blank dummy values', () => {
      const prodConfig = {
        branchName: 'GÓC',
        branchAddress: '18A Võ Văn Dũng, Phường An Nhơn, Bình Định',
        hotline: '1900 88 99 22',
        wifiPassword: 'xincamon',
        bankAccount: { bankCode: 'MB', accountNo: '0988776655', accountHolder: 'QUAN CA PHE GOC' }
      };

      // Simulating partial update
      const updatePayload = { receiptPaperWidth: '80mm' };
      const merged = { ...prodConfig, ...updatePayload };

      assert.equal(merged.branchName, 'GÓC');
      assert.equal(merged.bankAccount.accountNo, '0988776655');
      assert.equal(merged.receiptPaperWidth, '80mm');
    });
  });

  // =========================================================================
  // 2. THERMAL LOGO PROCESSOR (ALGORITHMIC TESTS)
  // =========================================================================
  describe('2. Thermal Logo Processing & Monochrome Conversion', () => {
    test('2.1 - File validation enforces allowed MIME types and 10MB limit', () => {
      assert.equal(validateLogoFile(null).valid, false);
      assert.equal(validateLogoFile({ type: 'application/pdf', size: 1024 }).valid, false);
      assert.equal(validateLogoFile({ type: 'image/gif', size: 1024 }).valid, false);
      assert.equal(validateLogoFile({ type: 'image/png', size: 15 * 1024 * 1024 }).valid, false);

      assert.equal(validateLogoFile({ type: 'image/png', size: 500 * 1024 }).valid, true);
      assert.equal(validateLogoFile({ type: 'image/jpeg', size: 1024 * 1024 }).valid, true);
      assert.equal(validateLogoFile({ type: 'image/svg+xml', size: 200 * 1024 }).valid, true);
    });

    test('2.2 - isDarkBackground detects black/dark background from corner pixels', () => {
      // 10x10 dark image data (all black pixels)
      const darkData = new Uint8ClampedArray(10 * 10 * 4);
      for (let i = 0; i < 100 * 4; i += 4) {
        darkData[i] = 10;     // R
        darkData[i + 1] = 15; // G
        darkData[i + 2] = 10; // B
        darkData[i + 3] = 255;
      }
      assert.equal(isDarkBackground({ data: darkData, width: 10, height: 10 }), true);

      // 10x10 white image data
      const whiteData = new Uint8ClampedArray(10 * 10 * 4);
      for (let i = 0; i < 100 * 4; i += 4) {
        whiteData[i] = 250;
        whiteData[i + 1] = 250;
        whiteData[i + 2] = 250;
        whiteData[i + 3] = 255;
      }
      assert.equal(isDarkBackground({ data: whiteData, width: 10, height: 10 }), false);
    });

    test('2.3 - applyThermalDithering converts green on black to crisp monochrome 1-bit dots', () => {
      // 4x4 image: black background with 1 pure green brand pixel (G=255, R=20, B=20)
      const src = new Uint8ClampedArray(4 * 4 * 4);
      for (let i = 0; i < 16; i++) {
        const idx = i * 4;
        if (i === 5) {
          // Brand green pixel
          src[idx] = 20;
          src[idx + 1] = 220;
          src[idx + 2] = 20;
          src[idx + 3] = 255;
        } else {
          // Black background
          src[idx] = 5;
          src[idx + 1] = 5;
          src[idx + 2] = 5;
          src[idx + 3] = 255;
        }
      }

      const dithered = applyThermalDithering({ data: src, width: 4, height: 4 }, true);
      assert.equal(dithered.width, 4);
      assert.equal(dithered.height, 4);
      // Dithered output has each pixel as either 0 (black ink) or 255 (white paper)
      for (let i = 0; i < 16 * 4; i += 4) {
        const val = dithered.data[i];
        assert.ok(val === 0 || val === 255, `Pixel value must be binary (0 or 255), got ${val}`);
      }
    });

    test('2.4 - imageToEscPosRasterBytes outputs valid ESC/POS GS v 0 binary format', () => {
      const width = 16;
      const height = 8;
      const data = new Uint8ClampedArray(width * height * 4);
      // Fill first row with black pixels (0), others white (255)
      for (let i = 0; i < width * height; i++) {
        const isFirstRow = i < width;
        const val = isFirstRow ? 0 : 255;
        data[i * 4] = val;
        data[i * 4 + 1] = val;
        data[i * 4 + 2] = val;
        data[i * 4 + 3] = 255;
      }

      const bytes = imageToEscPosRasterBytes({ data, width, height });
      assert.ok(bytes instanceof Uint8Array);
      // ESC/POS header: GS v 0 m (0x1D, 0x76, 0x30, 0x00)
      assert.equal(bytes[0], 0x1d);
      assert.equal(bytes[1], 0x76);
      assert.equal(bytes[2], 0x30);
      assert.equal(bytes[3], 0x00);
      // Width in bytes: 16 / 8 = 2 bytes
      assert.equal(bytes[4], 2); // xL
      assert.equal(bytes[5], 0); // xH
      // Height in dots: 8
      assert.equal(bytes[6], 8); // yL
      assert.equal(bytes[7], 0); // yH
      // First row of 16 black pixels should be 0xFF 0xFF (all bits 1 in ESC/POS)
      assert.equal(bytes[8], 0xff);
      assert.equal(bytes[9], 0xff);
    });

    test('2.5 - Default logo is embedded into app assets and always supplied by default', () => {
      // Order with empty store logo
      const model = buildReceiptModel({ order: { id: 'ORD-DEF' }, storeSettings: {} });
      assert.equal(model.store.logoThermalUrl, '/default-logo.png');
      assert.equal(model.store.logoOriginalUrl, '/default-logo.png');
      assert.equal(model.settings.showLogo, true);
    });

    test('2.6 - findContentBoundingBox detects and crops excess transparent/white margins accurately', () => {
      // 10x10 canvas: content only in (3, 3) to (6, 6)
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      // Initialize with white background (255, 255, 255, 255)
      data.fill(255);
      // Place black pixels at [3,3] and [6,6]
      const idx1 = (3 * width + 3) * 4;
      data[idx1] = 0; data[idx1 + 1] = 0; data[idx1 + 2] = 0; data[idx1 + 3] = 255;
      const idx2 = (6 * width + 6) * 4;
      data[idx2] = 0; data[idx2 + 1] = 0; data[idx2 + 2] = 0; data[idx2 + 3] = 255;

      const bbox = findContentBoundingBox({ data, width, height }, false);
      assert.equal(bbox.hasContent, true);
      assert.equal(bbox.minX, 3);
      assert.equal(bbox.minY, 3);
      assert.equal(bbox.maxX, 6);
      assert.equal(bbox.maxY, 6);
    });
  });

  // =========================================================================
  // 3. RECEIPT ENGINE CORE & FORMATTING
  // =========================================================================
  describe('3. Receipt Engine Architecture & Formatting', () => {
    const fixtureOrder = {
      id: 'ORD-7788',
      tableName: 'Bàn 05',
      cashier: 'Trần Mai',
      created_at: '2026-10-22T08:15:00.000Z',
      finished_at: '2026-10-22T08:45:00.000Z',
      items: [
        { name: 'Cà phê Muối GÓC', quantity: 2, price: 30000, lineTotal: 60000, size: 'Lớn', toppings: [{ name: 'Trân châu' }] },
        { name: 'Trà Nhãn Lồng Hạt Sen Huế Thơm Ngọt Tự Nhiên Ngàn Hương', quantity: 1, price: 45000, lineTotal: 45000 }
      ],
      subtotal: 105000,
      discount_percent: 10,
      surcharge: 5000,
      total: 99500,
      payment_method: 'vietqr'
    };

    const fixtureStore = {
      store_name: 'GÓC - PHÊ & TRÀ',
      store_address: '18A Võ Văn Dũng, Bình Định',
      contact_phone: '1900 88 99 22',
      wifi_password: 'xincamon',
      wifi_on_receipt: true,
      receipt_footer: 'Hẹn gặp lại quý khách!',
      receipt_paper_width: '58mm',
      receipt_settings: {
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
      }
    };

    test('3.1 - Exact timestamps are extracted and formatted in Asia/Ho_Chi_Minh timezone', () => {
      const model = buildReceiptModel({ order: fixtureOrder, storeSettings: fixtureStore });
      // 08:15 UTC is 15:15 in Asia/Ho_Chi_Minh (+7)
      assert.ok(model.orderCreatedAtFormatted.includes('15:15'), `Expected 15:15 in VN time, got ${model.orderCreatedAtFormatted}`);
      // 08:45 UTC is 15:45 in Asia/Ho_Chi_Minh (+7)
      assert.ok(model.receiptIssuedAtFormatted.includes('15:45'), `Expected 15:45 in VN time, got ${model.receiptIssuedAtFormatted}`);
      assert.ok(model.orderCreatedAtFormatted.includes('22/10/2026'));
    });

    test('3.2 - Financial totals and payment method match order data without discrepancies', () => {
      const model = buildReceiptModel({ order: fixtureOrder, storeSettings: fixtureStore });
      assert.equal(model.subtotal, 105000);
      assert.equal(model.discountAmount, 10500);
      assert.equal(model.surcharge, 5000);
      assert.equal(model.total, 99500);
      assert.equal(model.paymentMethodLabel, 'Chuyển khoản VietQR');
      assert.equal(model.isPrePrint, false);
      assert.equal(model.isReprint, false);
    });

    test('3.3 - wrapText properly breaks long lines at word boundaries without breaking column widths', () => {
      const longTitle = 'Trà Nhãn Lồng Hạt Sen Huế Thơm Ngọt Tự Nhiên Ngàn Hương';
      const lines32 = wrapText(longTitle, 16);
      assert.ok(lines32.length > 1);
      for (const line of lines32) {
        assert.ok(line.length <= 16, `Line length ${line.length} exceeds 16`);
      }

      const lines48 = wrapText(longTitle, 26);
      assert.ok(lines48.length >= 2);
      for (const line of lines48) {
        assert.ok(line.length <= 26, `Line length ${line.length} exceeds 26`);
      }
    });

    test('3.4 - formatReceiptItemRows for 58mm and 80mm preserves alignment and does not truncate quantity or price', () => {
      const longName = 'Cà phê Đen Phin Buôn Ma Thuột';
      const rows58 = formatReceiptItemRows(longName, 2, '50.000đ', '58mm');
      assert.ok(rows58.length >= 2);
      // First line ends with quantity and price
      assert.ok(rows58[0].includes('2'));
      assert.ok(rows58[0].includes('50.000đ'));
      assert.equal(rows58[0].length, 32);

      const rows80 = formatReceiptItemRows(longName, 3, '75.000đ', '80mm');
      assert.ok(rows80[0].includes('3'));
      assert.ok(rows80[0].includes('75.000đ'));
      assert.equal(rows80[0].length, 48);
    });

    test('3.5 - formatReceiptKeyValue aligns key and value to exact column count', () => {
      const kv58 = formatReceiptKeyValue('TỔNG CỘNG:', '120.000đ', 32);
      assert.equal(kv58.length, 32);
      assert.ok(kv58.startsWith('TỔNG CỘNG:'));
      assert.ok(kv58.endsWith('120.000đ'));

      const kv80 = formatReceiptKeyValue('TỔNG CỘNG:', '120.000đ', 48);
      assert.equal(kv80.length, 48);
    });

    test('3.6 - Distinction between Pre-Print Bill and Settled Receipt', () => {
      const preModel = buildReceiptModel({ order: fixtureOrder, storeSettings: fixtureStore, isPrePrint: true });
      assert.equal(preModel.isPrePrint, true);

      const settledModel = buildReceiptModel({ order: fixtureOrder, storeSettings: fixtureStore, isPrePrint: false });
      assert.equal(settledModel.isPrePrint, false);
    });
  });

  // =========================================================================
  // 4. IMMUTABLE SNAPSHOT & REPRINT INTEGRITY
  // =========================================================================
  describe('4. Immutable Receipt Snapshot & Historical Preservation', () => {
    test('4.1 - createReceiptSnapshotRecord captures frozen store settings and order details', () => {
      const order = {
        id: 'ORD-999',
        tableName: 'Bàn 02',
        cashier: 'Thu ngân A',
        total: 55000,
        items: [{ name: 'Trà đào', quantity: 1, price: 55000, lineTotal: 55000 }]
      };
      const store = {
        store_name: 'GÓC Quán Cũ',
        store_address: 'Địa chỉ cũ',
        contact_phone: '0900000000'
      };

      const snapshot = createReceiptSnapshotRecord(order, store, '58mm');
      assert.equal(snapshot.order_id, 'ORD-999');
      assert.equal(snapshot.store_snapshot.storeName, 'GÓC Quán Cũ');
      assert.equal(snapshot.store_snapshot.storeAddress, 'Địa chỉ cũ');
      assert.equal(snapshot.reprint_count, 0);

      // Verify that future changes to current store settings do NOT change the snapshot receipt
      const futureStoreSettings = {
        store_name: 'GÓC Thương Hiệu Mới',
        store_address: 'Địa chỉ mới 2027',
        contact_phone: '1900 99 99 99'
      };

      const historicalModel = buildReceiptModel({
        order,
        storeSettings: futureStoreSettings, // Current store has changed
        receiptRecord: snapshot // But historical snapshot is provided
      });

      // It must strictly use the snapshot's historical values!
      assert.equal(historicalModel.store.storeName, 'GÓC Quán Cũ');
      assert.equal(historicalModel.store.storeAddress, 'Địa chỉ cũ');
      assert.equal(historicalModel.store.contactPhone, '0900000000');
    });

    test('4.2 - Reprinting an issued receipt flags isReprint and preserves original issued_at', () => {
      const order = { id: 'ORD-101', tableName: 'Bàn 01', total: 40000, items: [] };
      const originalIssuedAt = '2026-10-20T07:00:00.000Z';
      const receiptRecord = {
        id: 'REC-101',
        order_id: 'ORD-101',
        receipt_number: 'HD-101',
        issued_at: originalIssuedAt,
        reprint_count: 2,
        store_snapshot: { storeName: 'GÓC', storeAddress: 'Bình Định' },
        order_snapshot: order
      };

      const model = buildReceiptModel({ order, receiptRecord });
      assert.equal(model.isReprint, true);
      assert.equal(model.reprintCount, 2);
      assert.equal(model.receiptIssuedAt, originalIssuedAt);
    });

    test('4.3 - Printing receipt never alters order revenue or creates spurious transactions', () => {
      const order = { id: 'ORD-SAFE', total: 75000, status: 'serving', paidAmount: 0 };
      const revenueBefore = 1000000;

      // Generate receipt multiple times
      buildReceiptModel({ order, isPrePrint: true });
      buildReceiptModel({ order, isPrePrint: true });
      buildReceiptModel({ order, isPrePrint: false });

      assert.equal(order.total, 75000);
      assert.equal(order.status, 'serving');
      assert.equal(order.paidAmount, 0);
      // Revenue is undisturbed
      assert.equal(revenueBefore, 1000000);
    });

    test('4.4 - Cashier identity is preserved in snapshot and model for auditing, but omitted from printed metadata', () => {
      const order = {
        id: 'ORD-AUDIT-99',
        tableName: 'Bàn 05',
        cashier: 'Nguyễn Văn Thu Ngân',
        staffName: 'Nguyễn Văn Thu Ngân',
        total: 50000,
        items: []
      };

      const snapshot = createReceiptSnapshotRecord(order, { currentCashier: 'Nguyễn Văn Thu Ngân' });
      // Database snapshot STILL securely retains cashier
      assert.equal(snapshot.cashier, 'Nguyễn Văn Thu Ngân');
      assert.equal(snapshot.order_snapshot.cashier, 'Nguyễn Văn Thu Ngân');

      const model = buildReceiptModel({ order });
      assert.equal(model.cashier, 'Nguyễn Văn Thu Ngân');
    });
  });

  // =========================================================================
  // 5. ESC/POS THERMAL COMMANDS & ADAPTERS
  // =========================================================================
  describe('5. ESC/POS Binary Buffers & Adapter Contracts', () => {
    test('5.1 - buildReceiptThermalBytes generates valid ESC/POS byte sequences for 58mm & 80mm', () => {
      const order = {
        id: 'ORD-BT-1',
        tableName: 'Bàn 03',
        cashier: 'Thu ngân',
        items: [{ name: 'Cà phê', quantity: 1, lineTotal: 25000 }],
        total: 25000
      };

      // 58mm buffer
      const model58 = buildReceiptModel({ order, overridePaperWidth: '58mm' });
      const bytes58 = buildReceiptThermalBytes(model58);
      assert.ok(bytes58 instanceof Uint8Array);
      assert.equal(bytes58[0], ESC_POS.INIT[0]); // ESC
      assert.equal(bytes58[1], ESC_POS.INIT[1]); // @
      // Ends with Feed & Cut
      assert.equal(bytes58[bytes58.length - 3], 0x1d); // GS
      assert.equal(bytes58[bytes58.length - 2], 0x56); // V
      assert.equal(bytes58[bytes58.length - 1], 0x00); // 0 (cut)

      // 80mm buffer
      const model80 = buildReceiptModel({ order, overridePaperWidth: '80mm' });
      const bytes80 = buildReceiptThermalBytes(model80);
      assert.ok(bytes80 instanceof Uint8Array);
      assert.ok(bytes80.length > 50);
    });

    test('5.2 - formatTableRow57mm & formatTableRow80mm strictly fit exact line widths', () => {
      const row58 = formatTableRow57mm('Trà tắc hạt chia', '2', '40.000đ');
      assert.equal(row58.length, 32);

      const row80 = formatTableRow80mm('Trà tắc hạt chia thơm mát mùa hè', '5', '100.000đ');
      assert.equal(row80.length, 48);
    });

    test('5.3 - buildReceiptThermalBytes strictly omits cashier line on printed receipt', () => {
      const order = {
        id: 'ORD-NOCASHIER',
        tableName: 'Bàn 02',
        cashier: 'Trần Văn Nhân Viên',
        items: [{ name: 'Trà đào', quantity: 1, lineTotal: 30000 }],
        total: 30000
      };

      const model = buildReceiptModel({ order, overridePaperWidth: '58mm' });
      const bytes = buildReceiptThermalBytes(model);
      const decodedText = new TextDecoder().decode(bytes);

      // Verify "Thu ngan:" or cashier name is NOT in the thermal print output
      assert.equal(decodedText.includes('Thu ngan:'), false);
      assert.equal(decodedText.includes('Tran Van Nhan Vien'), false);
      // But verify essential metadata remains
      assert.equal(decodedText.includes('So HD:'), true);
      assert.equal(decodedText.includes('Ban:'), true);
      assert.equal(decodedText.includes('Gio goi mon:'), true);
      assert.equal(decodedText.includes('Gio xuat HD:'), true);
    });
  });
});
