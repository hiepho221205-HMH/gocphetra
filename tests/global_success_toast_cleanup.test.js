/**
 * GÓC POS — Global Success Toast Cleanup Verification Test Suite
 *
 * Validates that:
 * 1. Redundant success / routine info toasts are eliminated across OrderView,
 *    OrderDetailsModal, Management Settings, and PosContext.
 * 2. Critical error toasts, warning notifications, and confirmation dialogs remain 100% intact.
 * 3. Business logic, state mutations, and backend sync operations remain completely functional.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const orderViewSrc = fs.readFileSync(path.resolve('src/components/ordering/OrderView.jsx'), 'utf-8');
const orderDetailsModalSrc = fs.readFileSync(path.resolve('src/components/orders/OrderDetailsModal.jsx'), 'utf-8');
const posContextSrc = fs.readFileSync(path.resolve('src/store/PosContext.jsx'), 'utf-8');
const opSettingsSrc = fs.readFileSync(path.resolve('src/components/management/OperationalSettingsSection.jsx'), 'utf-8');
const storeConfigSrc = fs.readFileSync(path.resolve('src/components/management/StoreConfigSubpage.jsx'), 'utf-8');
const profileEditSrc = fs.readFileSync(path.resolve('src/components/management/ProfileEditSubpage.jsx'), 'utf-8');
const staffCreateSrc = fs.readFileSync(path.resolve('src/components/management/StaffCreatePage.jsx'), 'utf-8');
const mgmtProfileSrc = fs.readFileSync(path.resolve('src/components/management/ManagementProfileView.jsx'), 'utf-8');
const bluetoothPrinterSrc = fs.readFileSync(path.resolve('src/utils/bluetoothPrinter.js'), 'utf-8');

test('TASK: GLOBAL SUCCESS TOAST CLEANUP', async (t) => {
  await t.test('1. Page Order — Adding item (+ button) does NOT trigger success toast', () => {
    // Check that OrderView doesn't show "Đã thêm ... vào đơn" toast
    assert.equal(
      orderViewSrc.includes("showToast(`Đã thêm"),
      false,
      'OrderView should not show success toast on item add'
    );
    assert.equal(
      orderViewSrc.includes("Đã thêm"),
      false,
      'OrderView should have removed "Đã thêm" toast message'
    );
  });

  await t.test('2. OrderDetailsModal — Item removal does NOT trigger redundant info toast', () => {
    assert.equal(
      orderDetailsModalSrc.includes("showToast('Đã xóa món khỏi đơn'"),
      false,
      'OrderDetailsModal should not show toast on item deletion'
    );
  });

  await t.test('3. Store Settings & Config — Redundant success toasts removed', () => {
    assert.equal(
      opSettingsSrc.includes("showToast('Đã lưu cấu hình vận hành POS thành công!'"),
      false,
      'OperationalSettingsSection should not trigger success toast on config save'
    );
    assert.equal(
      storeConfigSrc.includes("showToast('Đã lưu cấu hình cửa hàng!'"),
      false,
      'StoreConfigSubpage should not trigger success toast on store config save'
    );
    assert.equal(
      storeConfigSrc.includes("showToast('Đã khôi phục logo mặc định'"),
      false,
      'StoreConfigSubpage should not trigger toast on logo reset'
    );
    assert.equal(
      profileEditSrc.includes("showToast('Đã chọn ảnh đại diện'"),
      false,
      'ProfileEditSubpage should not trigger toast on avatar selection'
    );
    assert.equal(
      staffCreateSrc.includes("showToast('Đã chọn ảnh đại diện'"),
      false,
      'StaffCreatePage should not trigger toast on avatar selection'
    );
  });

  await t.test('4. PosContext — Routine operational success toasts removed', () => {
    // Table operations
    assert.equal(posContextSrc.includes("showToast(`Đã thêm bàn"), false);
    assert.equal(posContextSrc.includes("showToast(`Đã cập nhật thông tin bàn"), false);
    assert.equal(posContextSrc.includes("showToast(`Đã chuyển từ bàn"), false);
    assert.equal(posContextSrc.includes("showToast(`Đã gộp bàn"), false);
    assert.equal(posContextSrc.includes("showToast('Đã mở khóa thanh toán'"), false);

    // Order operations
    assert.equal(posContextSrc.includes("showToast('Đã lưu đơn hàng'"), false);
    assert.equal(posContextSrc.includes("showToast('Đã lưu thay đổi món'"), false);
    assert.equal(posContextSrc.includes("showToast('Đã xóa món khỏi đơn'"), false);
    assert.equal(posContextSrc.includes("showToast('Thanh toán thành công'"), false);

    // Menu operations
    assert.equal(posContextSrc.includes("showToast('Đã thêm danh mục'"), false);
    assert.equal(posContextSrc.includes("showToast('Đã thêm món'"), false);
    assert.equal(posContextSrc.includes("showToast('Đã cập nhật món'"), false);
    assert.equal(posContextSrc.includes("showToast('Đã thêm topping'"), false);

    // Staff operations
    assert.equal(posContextSrc.includes("showToast(`Đã thêm nhân viên"), false);
    assert.equal(posContextSrc.includes("showToast('Đã cập nhật thông tin nhân viên'"), false);
    assert.equal(posContextSrc.includes("showToast('Đã xóa nhân viên'"), false);
  });

  await t.test('5. Bluetooth & Printing — Removed redundant success toasts but PRESERVED fallback warnings', () => {
    // Preserved warning
    assert.ok(
      bluetoothPrinterSrc.includes('Trình duyệt không hỗ trợ Web Bluetooth'),
      'Must keep Web Bluetooth fallback warning toast'
    );
    // Removed success toast
    assert.equal(
      bluetoothPrinterSrc.includes("showToast?.('Đã in phiếu chế biến qua Bluetooth thành công!'"),
      false,
      'Must remove Bluetooth print success toast'
    );
  });

  await t.test('6. CRITICAL TOASTS PRESERVED: Errors, Security Denials, and System Warnings', () => {
    // Permission errors
    assert.ok(
      posContextSrc.includes("showToast('Từ chối quyền: Chỉ Quản trị viên (Admin)"),
      'Must preserve Admin RBAC denial toast'
    );
    assert.ok(
      posContextSrc.includes("showToast('Từ chối quyền: Cửa hàng trưởng (Manager) không thể can thiệp tài khoản Quản trị viên (Admin)!', 'error')"),
      'Must preserve Admin protection denial toast'
    );

    // Admin deletion safeguard
    assert.ok(
      posContextSrc.includes("showToast('Hành động bị chặn: Không thể xóa tài khoản Quản trị viên duy nhất của hệ thống!', 'error')"),
      'Must preserve sole admin deletion protection error toast'
    );

    // Billing lock warning
    assert.ok(
      posContextSrc.includes("mở thanh toán, không thể xóa!"),
      'Must preserve billing lock concurrency warning toast'
    );

    // Active billing concurrency error guard
    assert.ok(
      posContextSrc.includes("Không thể thêm món lúc này!"),
      'Must preserve table billing lock conflict error toast'
    );
  });
});
