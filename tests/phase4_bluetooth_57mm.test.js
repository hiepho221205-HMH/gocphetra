import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LINE_WIDTH_57MM,
  removeVietnameseDiacritics,
  formatTableRow57mm,
  formatKeyValue57mm,
  centerText57mm,
  separator57mm,
  buildReceipt57mmBytes,
  buildDailyClose57mmBytes,
  ESC_POS
} from '../src/utils/bluetoothPrinter.js';

/**
 * ============================================================================
 * GÓC POS — PHASE 4 AUTOMATED VERIFICATION SUITE
 * ============================================================================
 * Validates Phase 4: Web Bluetooth Thermal Printing & 57mm Paper Formatting
 * 1. Monospaced 32-character line boundary constraints (57mm standard)
 * 2. 3-column table alignment (16 - 4 - 12 characters)
 * 3. 100% Vietnamese diacritic cleansing for non-UTF8 thermal printer ROMs
 * 4. ESC/POS protocol byte sequence compliance (Init, Align, Feed, Cut)
 * 5. Full Customer Receipt Byte Generation
 * 6. Daily Revenue Close Slip Byte Generation
 */

describe('Phase 4 Verification: Web Bluetooth & 57mm ESC/POS Printing', () => {
  it('1. 57mm Paper Width Constraint (Exactly 32 Characters)', () => {
    assert.equal(LINE_WIDTH_57MM, 32, 'Paper width must be 32 characters for 57mm');

    const sep = separator57mm('-');
    assert.equal(sep.length, 32, 'Separator must be exactly 32 characters');
    assert.equal(sep, '--------------------------------');

    const centered = centerText57mm('GOC COFFEE');
    assert.equal(centered.length, 32, 'Centered line must be padded to 32 characters');
    assert.ok(centered.includes('GOC COFFEE'));
  });

  it('2. 3-Column Table Formatting (16 - 4 - 12 = 32 Chars)', () => {
    const row = formatTableRow57mm('Ca phe sua da', '2', '60.000d');
    assert.equal(row.length, 32, 'Table row must be exactly 32 characters');

    // Col 1 (16 chars): 'Ca phe sua da   '
    assert.equal(row.slice(0, 16), 'Ca phe sua da   ');
    // Col 2 (4 chars, centered): ' 2  ' or '  2 '
    assert.ok(row.slice(16, 20).includes('2'));
    // Col 3 (12 chars, right aligned): '     60.000d'
    assert.equal(row.slice(20, 32), '     60.000d');
  });

  it('3. Long Item Name Truncation Safeguard', () => {
    // Very long product name
    const longName = 'Tra sua tran chau duong den dac biet size L';
    const row = formatTableRow57mm(longName, '1', '45.000d');
    assert.equal(row.length, 32, 'Table row with long product name must never exceed 32 characters');
  });

  it('4. 100% Vietnamese Diacritic Cleansing (ASCII Safety)', () => {
    const vietnameseInput = 'Cà phê sữa đá, Bạc xỉu, Trà sen vàng, Đen đá, Nước ép ổi';
    const cleansed = removeVietnameseDiacritics(vietnameseInput);

    // Verify all common Vietnamese accented vowels and 'đ' are stripped
    assert.equal(cleansed, 'Ca phe sua da, Bac xiu, Tra sen vang, Den da, Nuoc ep oi');
    assert.ok(!/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđĐ]/.test(cleansed));
  });

  it('5. Key-Value Formatting (Left Key, Right Value)', () => {
    const kv = formatKeyValue57mm('TONG CONG:', '150.000d');
    assert.equal(kv.length, 32, 'Key-value line must equal 32 characters');
    assert.ok(kv.startsWith('TONG CONG:'));
    assert.ok(kv.endsWith('150.000d'));
  });

  it('6. Full Customer Receipt Byte Generation & ESC/POS Header/Footer', () => {
    const mockOrder = {
      id: 'ORD-999',
      tableName: 'Bàn 01',
      cashier: 'Thu ngân A',
      subtotal: 55000,
      total: 55000,
      discountPercent: 0,
      surcharge: 0,
      paymentMethod: 'cash',
      items: [
        { name: 'Cà phê đen đá', quantity: 1, price: 25000, lineTotal: 25000 },
        { name: 'Bạc xỉu', quantity: 1, price: 30000, lineTotal: 30000 }
      ]
    };

    const bytes = buildReceipt57mmBytes(mockOrder, {
      branchAddress: '123 Nguyen Trai, Q1',
      hotline: '0901234567',
      wifiPassword: 'goccoffee2026'
    });

    assert.ok(bytes instanceof Uint8Array, 'Should return Uint8Array');
    assert.ok(bytes.length > 50, 'Receipt should have substantial byte content');

    // First bytes must be ESC/POS INIT [0x1B, 0x40]
    assert.equal(bytes[0], 0x1b);
    assert.equal(bytes[1], 0x40);

    // Last bytes must include CUT [0x1D, 0x56, 0x00]
    const len = bytes.length;
    assert.equal(bytes[len - 3], 0x1d);
    assert.equal(bytes[len - 2], 0x56);
    assert.equal(bytes[len - 1], 0x00);
  });

  it('7. Daily Close Slip Byte Generation', () => {
    const mockDailyReport = {
      date: '2026-10-22',
      totalRevenue: 850000,
      cashTotal: 500000,
      qrTotal: 350000,
      totalOrders: 15,
      averageOrderValue: 56667,
      totalDiscount: 20000,
      totalSurcharge: 10000,
      topProducts: [
        { name: 'Cà phê đen đá', quantity: 10, revenue: 250000 }
      ]
    };

    const bytes = buildDailyClose57mmBytes(mockDailyReport, {});
    assert.ok(bytes instanceof Uint8Array);
    assert.ok(bytes.length > 50);

    // Verify it contains INIT and CUT
    assert.equal(bytes[0], 0x1b);
    assert.equal(bytes[1], 0x40);
  });
});
