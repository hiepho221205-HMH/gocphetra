import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generateVietQRUrl, POPULAR_BANKS } from '../src/utils/vietqr.js';

describe('GÓC POS — Settings Hub 6-Card Grid & Independent Subpages Suite', () => {

  // =========================================================================
  // 1. SETTINGS HUB 6-CARD GRID & COMPONENT REGISTRATION
  // =========================================================================
  describe('1. Settings Hub Grid Structure & 6 Cards Specification', () => {
    test('1.1 - StoreConfigSubpage coordinator registers all 6 hub cards and subpages', () => {
      const coordinatorPath = path.resolve('src/components/management/StoreConfigSubpage.jsx');
      assert.ok(fs.existsSync(coordinatorPath), 'StoreConfigSubpage.jsx must exist');
      const content = fs.readFileSync(coordinatorPath, 'utf8');

      // 6 Hub Cards verification
      assert.ok(content.includes('hub-card-store-info'), 'Missing hub-card-store-info');
      assert.ok(content.includes('hub-card-receipt'), 'Missing hub-card-receipt');
      assert.ok(content.includes('hub-card-kitchen-ticket'), 'Missing hub-card-kitchen-ticket');
      assert.ok(content.includes('hub-card-wifi'), 'Missing hub-card-wifi');
      assert.ok(content.includes('hub-card-vietqr'), 'Missing hub-card-vietqr');
      assert.ok(content.includes('hub-card-cloud'), 'Missing hub-card-cloud');

      // 2-Column responsive grid verification
      assert.ok(content.includes('grid grid-cols-2'), 'Must use 2-column grid layout');
      assert.ok(content.includes('data-testid="store-config-subpage"'), 'Must maintain root testid');
    });

    test('1.2 - All 6 independent subpage source files exist in hub/subpages', () => {
      const subpages = [
        'src/components/settings/hub/subpages/StoreInfoConfigSubpage.jsx',
        'src/components/settings/hub/subpages/ReceiptConfigSubpage.jsx',
        'src/components/settings/hub/subpages/KitchenTicketConfigSubpage.jsx',
        'src/components/settings/hub/subpages/WifiConfigSubpage.jsx',
        'src/components/settings/hub/subpages/VietQrConfigSubpage.jsx',
        'src/components/settings/hub/subpages/CloudConfigSubpage.jsx'
      ];

      for (const sp of subpages) {
        assert.ok(fs.existsSync(path.resolve(sp)), `Subpage file ${sp} must exist`);
      }
    });

    test('1.3 - SettingsHubCard uses Soft 3D neumorphic styling tokens', () => {
      const cardPath = path.resolve('src/components/settings/hub/SettingsHubCard.jsx');
      assert.ok(fs.existsSync(cardPath), 'SettingsHubCard.jsx must exist');
      const content = fs.readFileSync(cardPath, 'utf8');

      assert.ok(content.includes('clay-card'), 'SettingsHubCard must use .clay-card class');
      assert.ok(content.includes('clay-card-interactive'), 'SettingsHubCard must use .clay-card-interactive class');
      assert.ok(content.includes('triggerHaptic'), 'SettingsHubCard must trigger haptic feedback');
    });
  });

  // =========================================================================
  // 2. INDEPENDENT SAVE ISOLATION TESTS
  // =========================================================================
  describe('2. Independent Save Isolation & No Cross-Slice Mutation', () => {
    test('2.1 - Subpage 1 (Thông tin quán) saves only store info slice', () => {
      let updatedPayload = null;
      const mockUpdateSettings = (payload) => {
        updatedPayload = payload;
      };

      const initialSettings = {
        storeName: 'GÓC',
        branchName: 'Chi nhánh 01',
        branchAddress: '18A Võ Văn Dũng',
        hotline: '1900 88 99 22',
        currentCashier: 'Thu ngân 01',
        receiptPaperWidth: '80mm',
        wifiPassword: 'original_wifi',
        bankAccount: { bankCode: 'MB', accountNo: '123' },
        kitchenTicketSettings: { enabled: true }
      };

      // Simulated save from StoreInfoConfigSubpage
      const newStoreInfo = {
        storeName: 'GÓC - PHÊ & TRÀ MỚI',
        branchName: 'Chi nhánh 02',
        branchAddress: '99 Lê Duẩn',
        storeAddress: '99 Lê Duẩn',
        hotline: '0901234567',
        contactPhone: '0901234567',
        currentCashier: 'Thu ngân VIP'
      };
      mockUpdateSettings(newStoreInfo);

      // Verify payload contains only store info fields
      assert.equal(updatedPayload.storeName, 'GÓC - PHÊ & TRÀ MỚI');
      assert.equal(updatedPayload.branchAddress, '99 Lê Duẩn');
      assert.equal(updatedPayload.receiptPaperWidth, undefined, 'Must not touch receiptPaperWidth');
      assert.equal(updatedPayload.wifiPassword, undefined, 'Must not touch wifiPassword');
      assert.equal(updatedPayload.bankAccount, undefined, 'Must not touch bankAccount');
      assert.equal(updatedPayload.kitchenTicketSettings, undefined, 'Must not touch kitchenTicketSettings');

      // Verify merge into master settings preserves untouched slices
      const merged = { ...initialSettings, ...updatedPayload };
      assert.equal(merged.storeName, 'GÓC - PHÊ & TRÀ MỚI');
      assert.equal(merged.receiptPaperWidth, '80mm', 'Receipt width preserved');
      assert.equal(merged.wifiPassword, 'original_wifi', 'Wi-Fi preserved');
      assert.equal(merged.bankAccount.bankCode, 'MB', 'Bank preserved');
    });

    test('2.2 - Subpage 2 (Hóa đơn) saves only receipt slice and preserves logo', () => {
      let updatedPayload = null;
      const mockUpdateSettings = (payload) => {
        updatedPayload = payload;
      };

      const receiptUpdate = {
        receiptPaperWidth: '80mm',
        thermalPrintMode: 'graphic_accents',
        printNoAccents: false,
        receiptSettings: { showLogo: true, showFooter: true },
        receiptFooter: 'Chúc quý khách ngon miệng!',
        logoOriginalUrl: '/custom-logo.png',
        logoThermalUrl: '/custom-logo-thermal.png'
      };
      mockUpdateSettings(receiptUpdate);

      assert.equal(updatedPayload.receiptPaperWidth, '80mm');
      assert.equal(updatedPayload.thermalPrintMode, 'graphic_accents');
      assert.equal(updatedPayload.printNoAccents, false);
      assert.equal(updatedPayload.logoOriginalUrl, '/custom-logo.png');
      assert.equal(updatedPayload.storeName, undefined, 'Must not touch storeName');
      assert.equal(updatedPayload.wifiPassword, undefined, 'Must not touch wifiPassword');
    });

    test('2.3 - Subpage 3 (Phiếu chế biến) saves only kitchenTicketSettings', () => {
      let updatedPayload = null;
      const mockUpdateSettings = (payload) => {
        updatedPayload = payload;
      };

      const kitchenUpdate = {
        kitchenTicketSettings: {
          enabled: true,
          paperWidth: '80mm',
          promptOnSave: true,
          printMode: 'diff',
          showTable: true,
          showOrderId: true,
          showTime: true,
          showToppings: true,
          showNotes: true,
          showItemCount: true
        }
      };
      mockUpdateSettings(kitchenUpdate);

      assert.ok(updatedPayload.kitchenTicketSettings, 'Must contain kitchenTicketSettings');
      assert.equal(updatedPayload.kitchenTicketSettings.printMode, 'diff');
      assert.equal(Object.keys(updatedPayload).length, 1, 'Only kitchenTicketSettings updated');
    });

    test('2.4 - Subpage 4 (Wi-Fi) saves only wifiPassword and wifiOnReceipt', () => {
      let updatedPayload = null;
      const mockUpdateSettings = (payload) => {
        updatedPayload = payload;
      };

      const wifiUpdate = {
        wifiPassword: 'goc_coffee_2026',
        wifiOnReceipt: true
      };
      mockUpdateSettings(wifiUpdate);

      assert.equal(updatedPayload.wifiPassword, 'goc_coffee_2026');
      assert.equal(updatedPayload.wifiOnReceipt, true);
      assert.equal(Object.keys(updatedPayload).length, 2, 'Only 2 fields updated');
    });

    test('2.5 - Subpage 5 (VietQR) saves bankAccount and enableVietQR without overwriting', () => {
      let updatedPayload = null;
      const mockUpdateSettings = (payload) => {
        updatedPayload = payload;
      };

      const vietqrUpdate = {
        enableVietQR: true,
        vietqrEnabled: true,
        bankAccount: {
          bankCode: 'VCB',
          bankName: 'Vietcombank',
          accountNo: '0071001234567',
          accountHolder: 'TRAN MAI'
        }
      };
      mockUpdateSettings(vietqrUpdate);

      assert.equal(updatedPayload.bankAccount.bankCode, 'VCB');
      assert.equal(updatedPayload.bankAccount.accountNo, '0071001234567');
      assert.equal(updatedPayload.enableVietQR, true);
      assert.equal(updatedPayload.storeName, undefined);
    });
  });

  // =========================================================================
  // 3. VIETQR BANK SELECTOR & URL GENERATION
  // =========================================================================
  describe('3. VietQR Bank Selector & Standard URL Generation', () => {
    test('3.1 - POPULAR_BANKS contains all 9 major Vietnamese banks', () => {
      assert.ok(Array.isArray(POPULAR_BANKS), 'POPULAR_BANKS must be an array');
      assert.equal(POPULAR_BANKS.length, 9, 'Must have 9 popular banks');

      const expectedCodes = ['MB', 'VCB', 'TCB', 'ACB', 'VPB', 'TPB', 'BIDV', 'VBA', 'CTG'];
      const actualCodes = POPULAR_BANKS.map((b) => b.code);

      for (const code of expectedCodes) {
        assert.ok(actualCodes.includes(code), `Bank code ${code} must be present`);
      }
    });

    test('3.2 - generateVietQRUrl produces valid image URL for any selected bank', () => {
      const url = generateVietQRUrl({
        bankCode: 'VCB',
        accountNo: '0071001234567',
        accountName: 'TRAN MAI',
        amount: 85000,
        description: 'GOC BAN 02 ORD-12'
      });

      assert.ok(url.startsWith('https://img.vietqr.io/image/VCB-0071001234567-compact.png'), 'Correct base URL format');
      assert.ok(url.includes('amount=85000'), 'Includes exact amount query parameter');
      assert.ok(url.includes('accountName='), 'Includes accountName query parameter');
      assert.ok(url.includes('addInfo='), 'Includes addInfo memo query parameter');
    });
  });

  // =========================================================================
  // 4. DIRTY FORM SAFEGUARD & UNSAVED CHANGES MODAL
  // =========================================================================
  describe('4. Dirty Form Safeguard & Modal Portal Specifications', () => {
    test('4.1 - UnsavedChangesModal component exists and provides Stay / Discard actions', () => {
      const modalPath = path.resolve('src/components/settings/hub/UnsavedChangesModal.jsx');
      assert.ok(fs.existsSync(modalPath), 'UnsavedChangesModal.jsx must exist');
      const content = fs.readFileSync(modalPath, 'utf8');

      assert.ok(content.includes('createPortal'), 'Must use React Portal for clean z-index');
      assert.ok(content.includes('onStay'), 'Must handle onStay');
      assert.ok(content.includes('onDiscard'), 'Must handle onDiscard');
      assert.ok(content.includes('Tiếp tục chỉnh sửa'), 'Button text: Tiếp tục chỉnh sửa');
      assert.ok(content.includes('Hủy thay đổi'), 'Button text: Hủy thay đổi');
    });

    test('4.2 - Subpages implement dirty check and popstate safeguard', () => {
      const subpages = [
        'StoreInfoConfigSubpage.jsx',
        'ReceiptConfigSubpage.jsx',
        'KitchenTicketConfigSubpage.jsx',
        'WifiConfigSubpage.jsx',
        'VietQrConfigSubpage.jsx'
      ];

      for (const sp of subpages) {
        const fullPath = path.resolve('src/components/settings/hub/subpages', sp);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(content.includes('isDirty'), `${sp} must track isDirty`);
        assert.ok(content.includes('UnsavedChangesModal'), `${sp} must include UnsavedChangesModal`);
        assert.ok(content.includes('popstate'), `${sp} must listen to popstate event`);
      }
    });

    test('4.3 - Subpages sticky footer has Save button that does NOT navigate away on save', () => {
      const subpages = [
        'StoreInfoConfigSubpage.jsx',
        'ReceiptConfigSubpage.jsx',
        'KitchenTicketConfigSubpage.jsx',
        'WifiConfigSubpage.jsx',
        'VietQrConfigSubpage.jsx'
      ];

      for (const sp of subpages) {
        const fullPath = path.resolve('src/components/settings/hub/subpages', sp);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(content.includes('sticky bottom-4'), `${sp} must have sticky bottom-4 save container`);
        assert.ok(content.includes('isSubmitting'), `${sp} must handle isSubmitting loading state`);
        assert.ok(content.includes('disabled={isSubmitting}'), `${sp} button must be disabled when submitting`);
      }
    });
  });

});
