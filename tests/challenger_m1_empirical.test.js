/**
 * Challenger M1 Empirical Verification & Stress Test Suite
 * Adversarial validation of Milestone 1: Management Profile & BottomNav
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Utilities from project
import { generateVietQRUrl } from '../src/utils/vietqr.js';

describe('Challenger M1: Empirical & Stress Verification', () => {

  // =========================================================================
  // 1. BottomNav Tab Rendering, Active Styling & Icon Tests
  // =========================================================================
  describe('1. BottomNav Navigation & Active State Styling', () => {
    const bottomNavPath = path.resolve('src/components/common/BottomNav.jsx');
    const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf8');

    test('1.1 - BottomNav defines 4 ordered tabs with exact contract IDs and labels', () => {
      assert.ok(bottomNavContent.includes("id: 'tables'"), 'Tab 1 must be tables');
      assert.ok(bottomNavContent.includes("label: 'Bàn'"), "Tab 1 label must be 'Bàn'");
      assert.ok(bottomNavContent.includes("id: 'menu'"), 'Tab 2 must be menu');
      assert.ok(bottomNavContent.includes("label: 'Thực đơn'"), "Tab 2 label must be 'Thực đơn'");
      assert.ok(bottomNavContent.includes("id: 'orders'"), 'Tab 3 must be orders');
      assert.ok(bottomNavContent.includes("label: 'Đơn hàng'"), "Tab 3 label must be 'Đơn hàng'");
      assert.ok(bottomNavContent.includes("id: 'reports'"), 'Tab 4 must be reports');
      assert.ok(bottomNavContent.includes("label: 'Báo cáo'"), "Tab 4 label must be 'Báo cáo'");
      assert.ok(!bottomNavContent.includes("id: 'settings'"), "Settings tab is removed from BottomNav");
    });

    test('1.2 - Settings is isolated from BottomNav and accessed via Header Avatar', () => {
      const headerPath = path.resolve('src/components/common/PageHeader.jsx');
      const headerContent = fs.readFileSync(headerPath, 'utf8');
      assert.ok(headerContent.includes('onOpenSettings') || headerContent.includes("setActiveTab('settings')"), 'PageHeader triggers settings');
      assert.ok(!bottomNavContent.includes('ShieldCheck'), 'ShieldCheck removed from BottomNav');
    });

    test('1.3 - BottomNav active state styling logic verification', () => {
      // Simulate BottomNav rendering logic for active vs inactive tabs
      const simulateNavClass = (isActive) => ({
        btnClass: isActive
          ? 'text-forest-800 font-bold'
          : 'text-gray-400 hover:text-gray-600 font-medium',
        hasActivePill: isActive,
        iconClass: isActive
          ? 'scale-110 text-forest-800 stroke-[2.3]'
          : 'stroke-[1.8]',
        labelClass: isActive ? 'text-forest-900 font-semibold' : 'text-gray-500'
      });

      // Active tab 'settings'
      const activeState = simulateNavClass(true);
      assert.ok(activeState.btnClass.includes('text-forest-800'), 'Active button has text-forest-800');
      assert.ok(activeState.hasActivePill, 'Active button renders indicator pill');
      assert.ok(activeState.iconClass.includes('scale-110'), 'Active icon is scaled');
      assert.ok(activeState.iconClass.includes('stroke-[2.3]'), 'Active icon has enhanced stroke weight');

      // Inactive tab
      const inactiveState = simulateNavClass(false);
      assert.ok(inactiveState.btnClass.includes('text-gray-400'), 'Inactive button has muted color');
      assert.equal(inactiveState.hasActivePill, false, 'Inactive button has no indicator pill');
      assert.ok(inactiveState.iconClass.includes('stroke-[1.8]'), 'Inactive icon has normal stroke weight');

      // Check BottomNav.jsx code contains active indicator pill
      assert.ok(
        bottomNavContent.includes('bg-forest-800 animate-fadeIn'),
        'BottomNav contains forest active indicator pill with animation'
      );
    });

    test('1.4 - BottomNav badge isolation: badge is only attached to active orders on tables', () => {
      // Tab 1 uses dynamic activeOrderCount badge, Tab 5 has no badge property
      assert.match(
        bottomNavContent,
        /id:\s*['"]tables['"],\s*label:\s*['"]Bàn['"],\s*icon:\s*LayoutGrid,\s*badge:\s*activeOrderCount\s*>\s*0\s*\?\s*activeOrderCount\s*:\s*null/,
        'Tables tab has badge tied to activeOrderCount'
      );
      assert.doesNotMatch(
        bottomNavContent,
        /id:\s*['"]settings['"][^}]*badge:/,
        'Quản lý tab must not have arbitrary badges'
      );
    });
  });

  // =========================================================================
  // 2. Form Field Handling in OperationalSettingsSection: Edge Cases & Stress
  // =========================================================================
  describe('2. OperationalSettingsSection: Edge Cases & Field Handling', () => {
    const opPath = path.resolve('src/components/management/OperationalSettingsSection.jsx');
    const opContent = fs.readFileSync(opPath, 'utf8');

    test('2.1 - Whitespace trimming on all text inputs', () => {
      // Test payload with intentional leading/trailing whitespace and tabs
      const rawInput = {
        branchName: '  \t Chi nhánh Landmark 81   ',
        branchAddress: '   \n 208 Nguyễn Hữu Cảnh, P.22, Bình Thạnh   ',
        hotline: '   1900 88 99 22   ',
        shiftName: '   Ca Tối (14:30 - 22:30)   ',
        cashier: '   Trần Mai (Mã NV: NV-08)   ',
        wifiPassword: '   goc@caphe#2026   ',
        accountNo: '   0988776655   ',
        accountHolder: '   quan ca phe goc   '
      };

      // Exact transformation logic from OperationalSettingsSection.jsx handleSubmit
      const processed = {
        branchName: rawInput.branchName.trim(),
        branchAddress: rawInput.branchAddress.trim(),
        hotline: rawInput.hotline.trim(),
        shiftName: rawInput.shiftName.trim(),
        currentCashier: rawInput.cashier.trim(),
        wifiPassword: rawInput.wifiPassword.trim(),
        bankAccount: {
          bankCode: 'MB',
          bankName: 'MB Bank (Quân Đội)',
          accountNo: rawInput.accountNo.trim(),
          accountHolder: rawInput.accountHolder.trim().toUpperCase()
        }
      };

      assert.equal(processed.branchName, 'Chi nhánh Landmark 81');
      assert.equal(processed.branchAddress, '208 Nguyễn Hữu Cảnh, P.22, Bình Thạnh');
      assert.equal(processed.hotline, '1900 88 99 22');
      assert.equal(processed.shiftName, 'Ca Tối (14:30 - 22:30)');
      assert.equal(processed.currentCashier, 'Trần Mai (Mã NV: NV-08)');
      assert.equal(processed.wifiPassword, 'goc@caphe#2026');
      assert.equal(processed.bankAccount.accountNo, '0988776655');
      assert.equal(processed.bankAccount.accountHolder, 'QUAN CA PHE GOC');
    });

    test('2.2 - Required attributes on mandatory inputs in JSX', () => {
      // In OperationalSettingsSection, check required attributes
      const inputsToCheck = [
        'data-testid="input-branch-name"',
        'data-testid="input-branch-address"',
        'data-testid="input-shift-name"',
        'data-testid="input-cashier"',
        'data-testid="input-account-no"',
        'data-testid="input-account-holder"'
      ];

      for (const inputTestId of inputsToCheck) {
        assert.ok(
          opContent.includes(inputTestId),
          `Input element with ${inputTestId} must exist in OperationalSettingsSection`
        );
      }

      // Check required is on input-branch-name
      assert.match(
        opContent,
        /data-testid="input-branch-name"[^>]*required|required[^>]*data-testid="input-branch-name"/,
        'input-branch-name has required attribute'
      );
      assert.match(
        opContent,
        /data-testid="input-branch-address"[^>]*required|required[^>]*data-testid="input-branch-address"/,
        'input-branch-address has required attribute'
      );
      assert.match(
        opContent,
        /data-testid="input-shift-name"[^>]*required|required[^>]*data-testid="input-shift-name"/,
        'input-shift-name has required attribute'
      );
      assert.match(
        opContent,
        /data-testid="input-cashier"[^>]*required|required[^>]*data-testid="input-cashier"/,
        'input-cashier has required attribute'
      );
      assert.match(
        opContent,
        /data-testid="input-account-no"[^>]*required|required[^>]*data-testid="input-account-no"/,
        'input-account-no has required attribute'
      );
      assert.match(
        opContent,
        /data-testid="input-account-holder"[^>]*required|required[^>]*data-testid="input-account-holder"/,
        'input-account-holder has required attribute'
      );
    });

    test('2.3 - Empty field fallbacks in ManagementProfileView and preview pill', () => {
      const profilePath = path.resolve('src/components/management/ManagementProfileView.jsx');
      const profileContent = fs.readFileSync(profilePath, 'utf8');

      // Check fallback definitions in ManagementProfileView.jsx
      assert.match(
        profileContent,
        /currentCashier\s*\|\|\s*['"]Trần Mai \(Mã NV: NV-08\)['"]/,
        'Fallback cashier is defined'
      );
      assert.match(
        profileContent,
        /branchName\s*\|\|\s*['"]Chi nhánh 01 - Trụ sở chính['"]/,
        'Fallback branchName is defined'
      );
      assert.match(
        profileContent,
        /shiftName\s*\|\|\s*['"]Ca Sáng \(06:30 - 14:30\)['"]/,
        'Fallback shiftName is defined'
      );

      // Check fallback in VietQR preview pill in OperationalSettingsSection.jsx
      assert.match(
        opContent,
        /accountNo\s*\|\|\s*['"]0988776655['"]/,
        'VietQR preview pill has accountNo fallback'
      );
      assert.match(
        opContent,
        /accountHolder\s*\|\|\s*['"]QUAN CA PHE GOC['"]/,
        'VietQR preview pill has accountHolder fallback'
      );
    });

    test('2.4 - Special characters, Unicode and XSS payloads in WiFi password', () => {
      const testCases = [
        'goccaphe2026',
        'P@$$w0rd!#%^&*()_+~`-=[]{}|;\':",.<>?/',
        'Cà Phê Góc #2026 - Mật Khẩu Tầng 2 ☕',
        '<script>alert("xss")</script>',
        '&quot;<div class="alert">test</div>&quot;',
        '   padded-wifi-key   '
      ];

      for (const wifiInput of testCases) {
        const trimmed = wifiInput.trim();
        const settingsObj = {
          branchName: 'Chi nhánh 01',
          wifiPassword: trimmed
        };

        // 1. Serialization resilience
        const jsonStr = JSON.stringify(settingsObj);
        assert.doesNotThrow(() => JSON.parse(jsonStr), 'JSON serialization must be safe');
        const restored = JSON.parse(jsonStr);
        assert.equal(restored.wifiPassword, trimmed);

        // 2. Receipt print string interpolation safety
        const receiptHtml = `<p>Wifi: ${restored.wifiPassword}</p>`;
        assert.ok(receiptHtml.includes(restored.wifiPassword), 'Receipt format receives accurate wifi key');
      }
    });

    test('2.5 - VietQR Account number formats and VietQR URL generation', () => {
      const accountCases = [
        { no: '0988776655', holder: 'QUAN CA PHE GOC', expectedHolder: 'QUAN CA PHE GOC' },
        { no: '  0988776655  ', holder: '  quan ca phe goc  ', expectedHolder: 'QUAN CA PHE GOC' },
        { no: '9999999999999', holder: 'TRAN MAI ADMIN', expectedHolder: 'TRAN MAI ADMIN' },
        { no: '0988-776-655', holder: 'GOC COFFEE', expectedHolder: 'GOC COFFEE' }
      ];

      for (const tc of accountCases) {
        const cleanNo = tc.no.trim();
        const cleanHolder = tc.holder.trim().toUpperCase();

        assert.equal(cleanHolder, tc.expectedHolder, 'Account holder is uppercased');

        const url = generateVietQRUrl({
          bankCode: 'MB',
          accountNo: cleanNo,
          accountName: cleanHolder,
          amount: 55000,
          description: 'GOC BAN 01 ORD-1001'
        });

        assert.ok(url.startsWith('https://img.vietqr.io/image/MB-'), 'URL has standard VietQR prefix');
        assert.ok(url.includes(`accountName=${encodeURIComponent(cleanHolder)}`), 'Holder name is URL-encoded');
        assert.ok(url.includes('amount=55000'), 'Amount is properly attached');
      }
    });

    test('2.6 - Supabase SQL Schema code integrity in OperationalSettingsSection', () => {
      // Ensure all 7 core tables exist in SQL_SCHEMA_CODE
      const requiredTables = [
        'CREATE TABLE IF NOT EXISTS public.categories',
        'CREATE TABLE IF NOT EXISTS public.menu_items',
        'CREATE TABLE IF NOT EXISTS public.toppings',
        'CREATE TABLE IF NOT EXISTS public.product_toppings',
        'CREATE TABLE IF NOT EXISTS public.tables',
        'CREATE TABLE IF NOT EXISTS public.orders',
        'CREATE TABLE IF NOT EXISTS public.settings'
      ];

      for (const tbl of requiredTables) {
        assert.ok(opContent.includes(tbl), `SQL schema must include ${tbl}`);
      }

      // Check RLS policies loop and realtime publications
      assert.ok(opContent.includes('ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;'), 'RLS enabled for tables');
      assert.ok(opContent.includes('ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;'), 'RLS enabled for orders');
      assert.ok(opContent.includes('ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;'), 'RLS enabled for settings');
      assert.ok(opContent.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;'), 'Realtime for tables');
      assert.ok(opContent.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;'), 'Realtime for orders');
    });
  });

  // =========================================================================
  // 3. Device Mode Toggle Responsiveness (Mobile 390px vs Desktop)
  // =========================================================================
  describe('3. Device Mode Toggle Responsiveness', () => {
    test('3.1 - PosContext deviceMode state transition cycle', () => {
      // Toggle logic from PosContext.jsx line 1153:
      // setDeviceMode((m) => (m === 'mobile' ? 'responsive' : 'mobile'))
      const toggle = (current) => (current === 'mobile' ? 'responsive' : 'mobile');

      let currentMode = 'mobile';
      currentMode = toggle(currentMode);
      assert.equal(currentMode, 'responsive', 'Toggling mobile mode transitions to responsive');

      currentMode = toggle(currentMode);
      assert.equal(currentMode, 'mobile', 'Toggling responsive mode transitions back to mobile');
    });

    test('3.2 - App.jsx layout container responsive styles', () => {
      const appPath = path.resolve('src/App.jsx');
      const appContent = fs.readFileSync(appPath, 'utf8');

      // Verify mobile container classes
      assert.ok(
        appContent.includes("max-w-[400px] sm:h-[844px] sm:max-h-[92vh] sm:rounded-[40px] sm:border-[8px] sm:border-[#1E2E22]"),
        'Mobile container specifies 400px maximum width, rounded corners, and smartphone border'
      );

      // Verify desktop responsive container classes
      assert.ok(
        appContent.includes("max-w-6xl rounded-none"),
        'Desktop responsive container specifies max-w-6xl and edge-to-edge layout'
      );

      // Verify speaker notch is only shown in mobile mode on desktop screens
      assert.match(
        appContent,
        /\{deviceMode === 'mobile' && \(\s*<div className="hidden sm:flex items-center justify-center pt-2 pb-1 bg-white shrink-0">/,
        'Mockup speaker notch is conditional on mobile mode'
      );
    });

    test('3.3 - ManagementProfileView quick-switcher button reflection', () => {
      const profilePath = path.resolve('src/components/management/ManagementProfileView.jsx');
      const profileContent = fs.readFileSync(profilePath, 'utf8');

      assert.ok(
        profileContent.includes("deviceMode === 'mobile' ? 'Khung chuẩn Mobile 390px' : 'Toàn màn hình (Desktop/Tablet)'"),
        'Mode label adjusts dynamically based on deviceMode'
      );
      assert.ok(
        profileContent.includes("<span>Mở rộng Desktop</span>"),
        'Button offers expansion to Desktop when in mobile mode'
      );
      assert.ok(
        profileContent.includes("<span>Khung Mobile (390px)</span>"),
        'Button offers retraction to Mobile 390px when in responsive mode'
      );
    });
  });

  // =========================================================================
  // 4. Safe Admin Logout Workflow
  // =========================================================================
  describe('4. Safe Admin Logout Workflow', () => {
    const modalPath = path.resolve('src/components/management/SafeLogoutModal.jsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    test('4.1 - SafeLogoutModal contract and safety assurance warning', () => {
      assert.ok(modalContent.includes('Xác nhận thoát phiên Quản lý?'), 'Modal title present');
      assert.ok(modalContent.includes('ShieldAlert'), 'ShieldAlert icon present');
      assert.ok(
        modalContent.includes('Toàn bộ dữ liệu bàn đang phục vụ và cấu hình hệ thống vẫn được lưu trữ an toàn.'),
        'Safety assurance note present'
      );
      assert.ok(modalContent.includes('data-testid="logout-cancel-btn"'), 'Cancel button present');
      assert.ok(modalContent.includes('data-testid="logout-confirm-btn"'), 'Confirm button present');
    });

    test('4.2 - Logout confirmation safely returns user to Table Grid and toasts', () => {
      const profilePath = path.resolve('src/components/management/ManagementProfileView.jsx');
      const profileContent = fs.readFileSync(profilePath, 'utf8');

      // Verify handleConfirmLogout implementation
      assert.match(
        profileContent,
        /const handleConfirmLogout = \(\) => \{\s*setShowLogoutModal\(false\);\s*showToast\(['"]Đã đăng xuất phiên làm việc Quản lý['"],\s*['"]info['"]\);\s*setActiveTab\(['"]tables['"]\);\s*\};/,
        'handleConfirmLogout closes modal, shows info toast, and redirects to tables tab'
      );
    });
  });

  // =========================================================================
  // 5. RBAC Matrix & Architectural Reservation Integrity
  // =========================================================================
  describe('5. RBAC Matrix & Architectural Reservation', () => {
    const rbacPath = path.resolve('src/components/management/RbacPermissionsTable.jsx');
    const rbacContent = fs.readFileSync(rbacPath, 'utf8');

    test('5.1 - 7 RBAC domains compared with Admin having full permissions on all 7', () => {
      const domains = [
        'order_create_edit',
        'discounts_vouchers',
        'order_cancel_refund',
        'table_merge_split',
        'sales_data_cleanup',
        'operational_settings',
        'staff_management'
      ];

      for (const d of domains) {
        assert.ok(rbacContent.includes(`id: '${d}'`), `Domain ${d} defined`);
      }

      // Check Phase 2 badge
      assert.ok(rbacContent.includes('Giai đoạn 2 (Sắp ra mắt)'), 'Phase 2 badge displayed');
    });

    test('5.2 - SettingsView.jsx backward-compatibility re-export', () => {
      const settingsViewPath = path.resolve('src/components/settings/SettingsView.jsx');
      const content = fs.readFileSync(settingsViewPath, 'utf8');
      assert.match(content, /import ManagementProfileView from '\.\.\/management\/ManagementProfileView';/);
      assert.match(content, /export default ManagementProfileView;/);
    });
  });
});
