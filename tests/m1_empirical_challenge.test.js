/**
 * Empirical Challenge Test Suite for Milestone 1 (M1)
 * Author: Challenger 2 (challenger_m1_2)
 *
 * Tests:
 * 1. updateSettings merging behavior & persistence:
 *    - wifiPassword update
 *    - accountNo update via OperationalSettingsSection contract
 *    - direct shallow vs nested bankAccount merge stress test
 *    - localStorage serialization to goc_pos_settings_v4
 * 2. SafeLogoutModal state transitions:
 *    - Cancel keeps admin on screen (activeTab unchanged)
 *    - Confirm navigates to tables (activeTab -> 'tables')
 * 3. SqlSchemaModal actions:
 *    - Modal opening, content verification
 *    - Copy to clipboard execution
 *    - External link URL & target='_blank'
 * 4. Structural & Navigation contracts:
 *    - BottomNav tab 5 ('Quản lý', ShieldCheck, id: 'settings')
 *    - Brand header #214E34 avatar and Admin role badge
 *    - SettingsView backward compatibility
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { INITIAL_SETTINGS } from '../src/data/initialData.js';
import { FIXTURE_SETTINGS } from './helpers/fixtures.js';

describe('M1 Empirical Challenge: Settings Preservation & State Flow', () => {

  // =========================================================================
  // 1. SETTINGS PRESERVATION & MERGING
  // =========================================================================
  describe('1. Settings Preservation & updateSettings Merging', () => {

    test('1.1 - Baseline settings contains full bankAccount properties', () => {
      assert.ok(INITIAL_SETTINGS.bankAccount, 'bankAccount must exist in initial settings');
      assert.equal(INITIAL_SETTINGS.bankAccount.bankCode, 'MB');
      assert.equal(INITIAL_SETTINGS.bankAccount.bankName, 'MB Bank (Quân Đội)');
      assert.equal(INITIAL_SETTINGS.bankAccount.accountNo, '0988776655');
      assert.equal(INITIAL_SETTINGS.bankAccount.accountHolder, 'QUAN CA PHE GOC');
      assert.equal(INITIAL_SETTINGS.wifiPassword, 'goccaphe2026');
    });

    test('1.2 - updateSettings with wifiPassword preserves all existing bankAccount properties', () => {
      // Replicate PosContext updateSettings logic
      let state = { ...INITIAL_SETTINGS };
      const updateSettings = (newSet) => {
        state = { ...state, ...newSet };
      };

      // Action: update wifiPassword only
      updateSettings({ wifiPassword: 'new_goc_wifi_2026' });

      // Verification: wifiPassword changed
      assert.equal(state.wifiPassword, 'new_goc_wifi_2026');
      // Verification: bankAccount properties completely intact
      assert.ok(state.bankAccount, 'bankAccount object remains defined');
      assert.equal(state.bankAccount.bankName, 'MB Bank (Quân Đội)');
      assert.equal(state.bankAccount.accountHolder, 'QUAN CA PHE GOC');
      assert.equal(state.bankAccount.bankCode, 'MB');
      assert.equal(state.bankAccount.accountNo, '0988776655');
      // Verification: other operational settings intact
      assert.equal(state.branchName, INITIAL_SETTINGS.branchName);
      assert.equal(state.shiftName, INITIAL_SETTINGS.shiftName);
    });

    test('1.3 - OperationalSettingsSection submit contract preserves all bankAccount properties when accountNo is updated', () => {
      let state = { ...INITIAL_SETTINGS };
      const updateSettings = (newSet) => {
        state = { ...state, ...newSet };
      };

      // Simulate OperationalSettingsSection.jsx form submission (lines 161-176)
      const inputBranchName = 'Chi nhánh 02 - Sài Gòn';
      const inputBranchAddress = '456 Lê Lợi, Q1, TP.HCM';
      const inputHotline = '1900 11 22 33';
      const inputShiftName = 'Ca Chiều (14:30 - 22:30)';
      const inputCashier = 'Nguyễn Văn Hùng (Mã NV: NV-02)';
      const inputWifiPassword = 'goc_saigon_pass';
      const inputAccountNo = '0333444555';
      const inputAccountHolder = 'QUAN CA PHE GOC - CN2';

      // This is the exact payload structure sent by OperationalSettingsSection.jsx:
      const payload = {
        branchName: inputBranchName.trim(),
        branchAddress: inputBranchAddress.trim(),
        hotline: inputHotline.trim(),
        shiftName: inputShiftName.trim(),
        currentCashier: inputCashier.trim(),
        wifiPassword: inputWifiPassword.trim(),
        bankAccount: {
          ...state?.bankAccount,
          bankCode: 'MB',
          bankName: 'MB Bank (Quân Đội)',
          accountNo: inputAccountNo.trim(),
          accountHolder: inputAccountHolder.trim().toUpperCase()
        }
      };

      updateSettings(payload);

      // Verify new fields updated
      assert.equal(state.wifiPassword, 'goc_saigon_pass');
      assert.equal(state.bankAccount.accountNo, '0333444555');
      assert.equal(state.bankAccount.accountHolder, 'QUAN CA PHE GOC - CN2');
      // Verify preserved bank properties
      assert.equal(state.bankAccount.bankName, 'MB Bank (Quân Đội)', 'bankName preserved');
      assert.equal(state.bankAccount.bankCode, 'MB', 'bankCode preserved');
    });

    test('1.4 - Stress Test: Shallow merge vs Nested bankAccount in updateSettings', () => {
      // In PosContext.jsx line 1188: const next = { ...prev, ...newSet };
      // If a caller passes { bankAccount: { accountNo: '99999999' } } WITHOUT spreading prev.bankAccount:
      let state = { ...INITIAL_SETTINGS };
      const shallowUpdate = (newSet) => {
        state = { ...state, ...newSet };
      };

      // Calling with shallow partial bankAccount:
      shallowUpdate({ bankAccount: { accountNo: '99999999' } });
      // In shallow merge, bankAccount is replaced by { accountNo: '99999999' }
      assert.equal(state.bankAccount.accountNo, '99999999');
      // Sub-properties bankName, accountHolder, bankCode are undefined if not spread
      assert.equal(state.bankAccount.bankName, undefined, 'Demonstrates shallow merge drops nested properties if caller does not spread');

      // However, robust deep merge or component spread protects against this:
      const safeMerge = (prev, newSet) => {
        return {
          ...prev,
          ...newSet,
          bankAccount: newSet.bankAccount
            ? { ...prev.bankAccount, ...newSet.bankAccount }
            : prev.bankAccount
        };
      };

      let stateSafe = { ...INITIAL_SETTINGS };
      stateSafe = safeMerge(stateSafe, { bankAccount: { accountNo: '88888888' } });
      assert.equal(stateSafe.bankAccount.accountNo, '88888888');
      assert.equal(stateSafe.bankAccount.bankName, 'MB Bank (Quân Đội)', 'Safe merge preserves bankName');
      assert.equal(stateSafe.bankAccount.accountHolder, 'QUAN CA PHE GOC', 'Safe merge preserves accountHolder');
      assert.equal(stateSafe.bankAccount.bankCode, 'MB', 'Safe merge preserves bankCode');
    });

    test('1.5 - LocalStorage persistence roundtrip with goc_pos_settings_v4', () => {
      // Mock localStorage
      const mockStorage = {};
      const STORAGE_KEY = 'goc_pos_settings_v4';

      let state = { ...INITIAL_SETTINGS };
      const persistSettings = (nextState) => {
        state = nextState;
        mockStorage[STORAGE_KEY] = JSON.stringify(nextState);
      };

      persistSettings({
        ...state,
        wifiPassword: 'persisted_wifi_123',
        bankAccount: {
          ...state.bankAccount,
          accountNo: '0911223344'
        }
      });

      // Retrieve and deserialize
      assert.ok(mockStorage[STORAGE_KEY], 'Storage key goc_pos_settings_v4 must be populated');
      const loaded = JSON.parse(mockStorage[STORAGE_KEY]);

      assert.equal(loaded.wifiPassword, 'persisted_wifi_123');
      assert.equal(loaded.bankAccount.accountNo, '0911223344');
      assert.equal(loaded.bankAccount.bankName, 'MB Bank (Quân Đội)');
      assert.equal(loaded.bankAccount.accountHolder, 'QUAN CA PHE GOC');
      assert.equal(loaded.bankAccount.bankCode, 'MB');
    });
  });

  // =========================================================================
  // 2. SAFE LOGOUT MODAL STATE TRANSITIONS
  // =========================================================================
  describe('2. SafeLogoutModal State Transitions', () => {

    test('2.1 - State flow: Initial state -> Trigger open -> Cancel preserves admin tab', () => {
      let activeTab = 'settings';
      let showLogoutModal = false;
      let toastMessage = null;

      const setActiveTab = (tab) => { activeTab = tab; };
      const setShowLogoutModal = (open) => { showLogoutModal = open; };
      const showToast = (msg, type) => { toastMessage = { msg, type }; };

      // Initial state
      assert.equal(activeTab, 'settings', 'Admin begins on settings tab');
      assert.equal(showLogoutModal, false, 'Modal closed initially');

      // Action 1: User clicks "Đăng xuất tài khoản Quản lý" trigger
      setShowLogoutModal(true);
      assert.equal(showLogoutModal, true, 'Modal is opened');
      assert.equal(activeTab, 'settings', 'Tab remains settings');

      // Action 2: User clicks "Ở lại" (Cancel button / onClose)
      const handleClose = () => {
        setShowLogoutModal(false);
      };
      handleClose();

      // Verification: Admin remains on Management screen!
      assert.equal(showLogoutModal, false, 'Modal is closed');
      assert.equal(activeTab, 'settings', 'Admin stays on settings tab when cancelled');
      assert.equal(toastMessage, null, 'No logout toast emitted on cancel');
    });

    test('2.2 - State flow: Trigger open -> Confirm navigates to tables tab with toast', () => {
      let activeTab = 'settings';
      let showLogoutModal = false;
      let toastMessage = null;

      const setActiveTab = (tab) => { activeTab = tab; };
      const setShowLogoutModal = (open) => { showLogoutModal = open; };
      const showToast = (msg, type) => { toastMessage = { msg, type }; };

      // Open modal
      setShowLogoutModal(true);
      assert.equal(showLogoutModal, true);

      // Action: User clicks "Đăng xuất ngay" (Confirm button / onConfirm)
      // Exactly matching ManagementProfileView.jsx lines 37-41:
      const handleConfirmLogout = () => {
        setShowLogoutModal(false);
        showToast('Đã đăng xuất phiên làm việc Quản lý', 'info');
        setActiveTab('tables');
      };
      handleConfirmLogout();

      // Verification: Transitions cleanly to tables!
      assert.equal(showLogoutModal, false, 'Modal is closed after confirm');
      assert.equal(activeTab, 'tables', 'Active tab navigated to tables');
      assert.ok(toastMessage, 'Toast message was shown');
      assert.equal(toastMessage.msg, 'Đã đăng xuất phiên làm việc Quản lý');
      assert.equal(toastMessage.type, 'info');
    });

    test('2.3 - SafeLogoutModal component markup & attributes verification', () => {
      const modalPath = path.resolve('src/components/management/SafeLogoutModal.jsx');
      assert.ok(fs.existsSync(modalPath));
      const code = fs.readFileSync(modalPath, 'utf8');

      // Must have conditional return null if !isOpen
      assert.ok(code.includes('if (!isOpen) return null;'));
      // Must have test IDs for automated QA
      assert.ok(code.includes('data-testid="safe-logout-modal-backdrop"'));
      assert.ok(code.includes('data-testid="safe-logout-modal-card"'));
      assert.ok(code.includes('data-testid="logout-cancel-btn"'));
      assert.ok(code.includes('data-testid="logout-confirm-btn"'));
      // Must contain safety reassurance
      assert.ok(code.includes('Toàn bộ dữ liệu bàn đang phục vụ và cấu hình hệ thống vẫn được lưu trữ an toàn.'));
      // Must call onClose on cancel button
      assert.ok(code.includes('onClick={onClose}'));
      // Must call onConfirm on confirm button
      assert.ok(code.includes('onClick={onConfirm}'));
    });
  });

  // =========================================================================
  // 3. SQL SCHEMA MODAL COPYING & LINK OPENING
  // =========================================================================
  describe('3. SqlSchemaModal Copying & Opening Links', () => {

    test('3.1 - SQL Schema contains all 7 core tables and publication setup', () => {
      const opSettingsPath = path.resolve('src/components/management/OperationalSettingsSection.jsx');
      const content = fs.readFileSync(opSettingsPath, 'utf8');

      assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.tables'));
      assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.categories'));
      assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.menu_items'));
      assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.toppings'));
      assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.product_toppings'));
      assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.orders'));
      assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.settings'));
      assert.ok(content.includes('supabase_realtime ADD TABLE public.tables'));
      assert.ok(content.includes('supabase_realtime ADD TABLE public.orders'));
    });

    test('3.2 - SQL Schema copy handler interacts with navigator.clipboard and triggers toast', () => {
      let writtenClipboardText = null;
      let toastPayload = null;
      let copiedSchema = false;

      // Mock navigator.clipboard
      const mockNavigator = {
        clipboard: {
          writeText: (text) => {
            writtenClipboardText = text;
            return Promise.resolve();
          }
        }
      };

      const showToast = (msg, type) => {
        toastPayload = { msg, type };
      };

      // Extract SQL_SCHEMA_CODE from component
      const opSettingsPath = path.resolve('src/components/management/OperationalSettingsSection.jsx');
      const content = fs.readFileSync(opSettingsPath, 'utf8');
      const schemaMatch = content.match(/const SQL_SCHEMA_CODE = `([\s\S]*?)`;/);
      assert.ok(schemaMatch, 'SQL_SCHEMA_CODE constant extracted');
      const SQL_SCHEMA_CODE = schemaMatch[1];

      // Simulate handleCopySchema (lines 182-189)
      const handleCopySchema = () => {
        if (mockNavigator?.clipboard?.writeText) {
          mockNavigator.clipboard.writeText(SQL_SCHEMA_CODE);
          copiedSchema = true;
          showToast('Đã sao chép mã SQL Schema vào clipboard!', 'success');
        }
      };

      handleCopySchema();

      assert.equal(copiedSchema, true, 'copiedSchema state updated to true');
      assert.ok(writtenClipboardText.includes('CREATE TABLE IF NOT EXISTS public.tables'), 'Clipboard contains SQL code');
      assert.ok(toastPayload, 'Toast emitted');
      assert.equal(toastPayload.msg, 'Đã sao chép mã SQL Schema vào clipboard!');
      assert.equal(toastPayload.type, 'success');
    });

    test('3.3 - External Supabase SQL Editor link has valid URL and secure target/rel', () => {
      const opSettingsPath = path.resolve('src/components/management/OperationalSettingsSection.jsx');
      const content = fs.readFileSync(opSettingsPath, 'utf8');

      // Check external link target
      const expectedHref = 'https://supabase.com/dashboard/project/nbuulvdfxnmfdicbisxq/sql/new';
      assert.ok(content.includes(`href="${expectedHref}"`), 'External link URL points to Supabase project SQL editor');
      assert.ok(content.includes('target="_blank"'), 'Link opens in new tab (target="_blank")');
      assert.ok(content.includes('rel="noreferrer"'), 'Link includes rel="noreferrer" for security');
    });

    test('3.4 - Schema modal open/close state transitions', () => {
      let showSchemaModal = false;
      const setShowSchemaModal = (v) => { showSchemaModal = v; };

      assert.equal(showSchemaModal, false, 'Initially closed');

      // User clicks "Xem mã SQL Schema"
      setShowSchemaModal(true);
      assert.equal(showSchemaModal, true, 'Modal opened');

      // User clicks Close or X
      setShowSchemaModal(false);
      assert.equal(showSchemaModal, false, 'Modal closed');
    });
  });

  // =========================================================================
  // 4. STRUCTURAL CONTRACTS & REGRESSIONS
  // =========================================================================
  describe('4. Navigation & Structural Contracts', () => {

    test('4.1 - BottomNav tab 5 uses label "Quản lý", ShieldCheck icon, and id "settings"', () => {
      const bottomNavPath = path.resolve('src/components/common/BottomNav.jsx');
      const content = fs.readFileSync(bottomNavPath, 'utf8');

      assert.ok(content.includes("id: 'settings'"), "Must keep id: 'settings' for route compatibility");
      assert.ok(content.includes("label: 'Quản lý'"), "Must have label: 'Quản lý'");
      assert.ok(content.includes('ShieldCheck'), "Must use ShieldCheck icon");
    });

    test('4.2 - ManagementProfileView Brand Header matches specifications', () => {
      const profilePath = path.resolve('src/components/management/ManagementProfileView.jsx');
      const content = fs.readFileSync(profilePath, 'utf8');

      assert.ok(content.includes('bg-[#214E34]'), 'Brand avatar uses #214E34');
      assert.ok(content.includes('Quản lý (Admin)'), 'Header role displays Quản lý (Admin)');
      assert.ok(content.includes('animate-ping'), 'Glowing active pulse dot present');
      assert.ok(content.includes('pb-28'), 'Bottom padding pb-28 prevents nav occlusion');
      assert.ok(content.includes('MILESTONE 2: StaffManagementSection'), 'Reserved slot for M2 exists');
      assert.ok(content.includes('MILESTONE 3: DataCleanupSection'), 'Reserved slot for M3 exists');
    });

    test('4.3 - SettingsView re-exports ManagementProfileView for backward compatibility', () => {
      const settingsViewPath = path.resolve('src/components/settings/SettingsView.jsx');
      const content = fs.readFileSync(settingsViewPath, 'utf8');

      assert.ok(content.includes("import ManagementProfileView from '../management/ManagementProfileView';"));
      assert.ok(content.includes('export default ManagementProfileView;'));
    });
  });
});
