import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Shared Sticky Header (Foodgo Layout) & Settings Management Contract Tests', () => {
  const headerPath = path.resolve('src/components/common/PageHeader.jsx');
  const bluetoothBadgePath = path.resolve('src/components/common/BluetoothStatusBadge.jsx');
  const profilePath = path.resolve('src/components/management/ManagementProfileView.jsx');
  const posContentPath = path.resolve('src/components/pos/PosContent.jsx');
  const tableGridPath = path.resolve('src/components/tables/TableGrid.jsx');
  const menuPath = path.resolve('src/components/menu/MenuManagementView.jsx');
  const ordersPath = path.resolve('src/components/orders/OrderHistoryView.jsx');
  const reportsPath = path.resolve('src/components/reports/ReportsView.jsx');

  const headerContent = fs.readFileSync(headerPath, 'utf8');
  const bluetoothBadgeContent = fs.readFileSync(bluetoothBadgePath, 'utf8');
  const profileContent = fs.readFileSync(profilePath, 'utf8');
  const posContent = fs.readFileSync(posContentPath, 'utf8');
  const tableGridContent = fs.readFileSync(tableGridPath, 'utf8');
  const menuContent = fs.readFileSync(menuPath, 'utf8');
  const ordersContent = fs.readFileSync(ordersPath, 'utf8');
  const reportsContent = fs.readFileSync(reportsPath, 'utf8');

  // =========================================================================
  // 1. Shared PageHeader Component & Styling
  // =========================================================================
  it('1.1 - PageHeader defines correct title and subtitle mappings for 4 tabs', () => {
    assert.ok(headerContent.includes("title: 'Sơ đồ bàn'"), 'Tab tables must map to Sơ đồ bàn');
    assert.ok(headerContent.includes("title: 'Thực đơn'"), 'Tab menu must map to Thực đơn');
    assert.ok(headerContent.includes("title: 'Đơn hàng'"), 'Tab orders must map to Đơn hàng');
    assert.ok(headerContent.includes("title: 'Báo cáo'"), 'Tab reports must map to Báo cáo');
    assert.ok(!headerContent.includes("title: 'Quản lý quán'"), 'Tab settings must not be in PageHeader');
  });

  it('1.2 - PageHeader enforces Foodgo typography: 26-28px bold title in #214E34 & 12.5px subtitle', () => {
    // Title style check
    assert.ok(
      headerContent.includes('text-[26px]') || headerContent.includes('text-[28px]'),
      'Header title must be 26-28px'
    );
    assert.ok(headerContent.includes('text-[#214E34]'), 'Header title must use brand color #214E34');
    assert.ok(headerContent.includes('font-black') || headerContent.includes('font-bold'), 'Header title must be bold/black');

    // Subtitle style check
    assert.ok(headerContent.includes('text-[12.5px]') || headerContent.includes('text-xs'), 'Subtitle must be 12-13px');
  });

  it('1.3 - PageHeader avatar button is circular (48-52px) with mint border #D4E8DB and online indicator', () => {
    // Dimensions check
    assert.ok(headerContent.includes('w-12 h-12') || headerContent.includes('w-[48px]') || headerContent.includes('w-[50px]'), 'Avatar must be 48-52px');
    assert.ok(headerContent.includes('rounded-full'), 'Avatar must be circular');

    // Mint border check (#D4E8DB)
    assert.ok(headerContent.includes('#D4E8DB'), 'Avatar must have mint accent #D4E8DB');

    // Online indicator check
    assert.ok(headerContent.includes('#009E78'), 'Online dot must use status green #009E78');
  });

  it('1.4 - PageHeader provides User icon fallback when no avatar image is available', () => {
    assert.ok(headerContent.includes('User'), 'PageHeader must import User icon');
    assert.ok(headerContent.includes('!imageError'), 'PageHeader must handle image loading error fallback');
  });

  it('1.5 - PageHeader is sticky with backdrop blur and subtle elevation', () => {
    assert.ok(headerContent.includes('sticky top-0'), 'PageHeader must be sticky at the top');
    assert.ok(headerContent.includes('backdrop-blur'), 'PageHeader must have backdrop-blur');
    assert.ok(headerContent.includes('z-20'), 'PageHeader must have z-index elevation');
  });

  it('1.6 - BluetoothStatusBadge renders compact 3D clay circle (38x38px) with status LED indicator', () => {
    assert.ok(bluetoothBadgeContent.includes('w-[38px] h-[38px]'), 'Must be compact 38x38px');
    assert.ok(bluetoothBadgeContent.includes('rounded-full'), 'Must be circular');
    assert.ok(bluetoothBadgeContent.includes('data-testid="header-bluetooth-button"'), 'Must have testid');
    assert.ok(bluetoothBadgeContent.includes('animate-ping'), 'Must support ping animation when printing/reconnecting');
    assert.ok(bluetoothBadgeContent.includes('colorTheme.dotBg'), 'Must include LED indicator dot');
  });

  // =========================================================================
  // 2. Settings ManagementProfileView Component & Functionality
  // =========================================================================
  it('2.1 - ManagementProfileView includes dedicated header with back button', () => {
    assert.ok(profileContent.includes('ArrowLeft'), 'ManagementProfileView must have back button with ArrowLeft');
    assert.ok(profileContent.includes('data-testid="settings-back-button"'), 'Back button testid must exist');
    assert.ok(profileContent.includes('Cài đặt & Quản lý'), 'Title must be Cài đặt & Quản lý');
    assert.ok(profileContent.includes('sticky top-0'), 'Settings header must be sticky at the top');
  });

  it('2.2 - ManagementProfileView provides avatar upload and removal functionality', () => {
    assert.ok(profileContent.includes('type="file"'), 'Must have file input for photo upload');
    assert.ok(profileContent.includes('handlePhotoUpload'), 'Must have photo upload handler');
    assert.ok(profileContent.includes('handleRemovePhoto'), 'Must have photo removal handler');
    assert.ok(profileContent.includes('avatarUrl'), 'Must bind to settings.avatarUrl');
  });

  it('2.3 - ManagementProfileView displays real cashier, shift, branch, and logout workflow', () => {
    assert.ok(profileContent.includes('currentCashier'), 'Must read cashier from settings');
    assert.ok(profileContent.includes('shiftName'), 'Must read shift from settings');
    assert.ok(profileContent.includes('branchName'), 'Must read branch from settings');
    assert.ok(profileContent.includes('handleConfirmLogout'), 'Must have logout confirmation handler');
    assert.ok(profileContent.includes('SafeLogoutModal'), 'Must have logout confirmation modal');
  });

  // =========================================================================
  // 3. App Integration & Header Isolation
  // =========================================================================
  it('3.1 - PosContent renders PageHeader only for 4 main tabs and hides it during active ordering and settings', () => {
    assert.ok(posContent.includes('<PageHeader'), 'PosContent must render PageHeader');
    assert.ok(
      posContent.includes("!activeOrderingTable && ['tables', 'menu', 'orders', 'reports'].includes(activeTab)"),
      'PageHeader must be scoped to 4 main tabs and hidden during active table ordering or settings'
    );
  });

  it('3.2 - PosContent routes avatar click directly to SettingsView with onBack', () => {
    assert.ok(posContent.includes("activeTab === 'settings'"), 'PosContent must route settings tab');
    assert.ok(posContent.includes('<SettingsView onBack='), 'PosContent must render SettingsView with onBack');
  });

  // =========================================================================
  // 4. Duplicate Headings Removal Verification
  // =========================================================================
  it('4.1 - TableGrid has removed duplicate inner "Sơ đồ bàn" heading', () => {
    assert.ok(!tableGridContent.includes('mb-2.5">\n        <h2'), 'TableGrid must not have redundant heading container');
    assert.ok(!tableGridContent.includes('<h2 className="text-lg font-black text-forest-900 tracking-tight leading-none">\n          Sơ đồ bàn'), 'Duplicate heading Sơ đồ bàn must be removed');
  });

  it('4.2 - MenuManagementView has removed duplicate inner "Thực đơn" heading', () => {
    assert.ok(!menuContent.includes('Tiêu đề trang: Thực đơn'), 'MenuManagementView must not have redundant title comment');
    assert.ok(!menuContent.includes('Quản lý danh mục, món bán & công thức topping'), 'Redundant subtitle in menu must be removed');
  });

  it('4.3 - OrderHistoryView has removed duplicate inner "Đơn hàng" heading', () => {
    assert.ok(!ordersContent.includes('1. HEADER ================= */\n      <div className="mb-2.5">\n        <h2'), 'OrderHistoryView must not have redundant header block');
    assert.ok(!ordersContent.includes('Theo dõi đơn đang phục vụ và hóa đơn đã hoàn tất theo ngày'), 'Redundant subtitle in orders must be removed');
  });

  it('4.4 - ReportsView has removed duplicate inner "Báo cáo" heading', () => {
    assert.ok(!reportsContent.includes('1. HEADER ================= */\n      <div>\n        <h2'), 'ReportsView must not have redundant header block');
    assert.ok(!reportsContent.includes('Theo dõi doanh thu bán hàng & phương thức thanh toán'), 'Redundant subtitle in reports must be removed');
  });
});
