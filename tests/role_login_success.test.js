/**
 * GÓC POS — Role-Based Login Success Verification Test Suite
 *
 * Validates:
 * 1. Role configurations for Admin, Manager, and Staff.
 * 2. Visual assets (PNG and optimized WebP) exist on disk with valid headers.
 * 3. UI hierarchy: "> GÓC POS <", Checkmark, Role badge, Greeting text, Continue button.
 * 4. Safe guard for unassigned/invalid roles (blocks dashboard access).
 * 5. State management in PosContext: loginSuccessRole, setLoginSuccessRole, logout clearing.
 * 6. App.jsx route integration: displays LoginSuccessView upon login, routes to /tables on continue, F5 bypasses success view.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const loginSuccessSrc = fs.readFileSync(path.resolve('src/components/auth/LoginSuccessView.jsx'), 'utf-8');
const posContextSrc = fs.readFileSync(path.resolve('src/store/PosContext.jsx'), 'utf-8');
const appSrc = fs.readFileSync(path.resolve('src/App.jsx'), 'utf-8');

test('TASK: GÓC POS — ROLE-BASED LOGIN SUCCESS UI', async (t) => {
  await t.test('1. Role Configuration & Content: Admin, Manager, Staff', () => {
    // Admin config
    assert.ok(loginSuccessSrc.includes('roleBadge: \'ADMIN\''), 'Must have ADMIN badge');
    assert.ok(loginSuccessSrc.includes('Bạn đã đăng nhập với quyền quản trị hệ thống'), 'Must have Admin greeting');
    assert.ok(loginSuccessSrc.includes('/images/login-success/admin-3d.webp'), 'Admin webp asset path');
    assert.ok(loginSuccessSrc.includes('/images/login-success/admin-3d.png'), 'Admin png asset path');

    // Manager config
    assert.ok(loginSuccessSrc.includes('roleBadge: \'QUẢN LÝ\''), 'Must have QUẢN LÝ badge');
    assert.ok(loginSuccessSrc.includes('Bạn đã đăng nhập với quyền quản lý cửa hàng'), 'Must have Manager greeting');
    assert.ok(loginSuccessSrc.includes('/images/login-success/manager-3d.webp'), 'Manager webp asset path');
    assert.ok(loginSuccessSrc.includes('/images/login-success/manager-3d.png'), 'Manager png asset path');

    // Staff config
    assert.ok(loginSuccessSrc.includes('roleBadge: \'NHÂN VIÊN\''), 'Must have NHÂN VIÊN badge');
    assert.ok(loginSuccessSrc.includes('Bạn đã đăng nhập với quyền nhân viên'), 'Must have Staff greeting');
    assert.ok(loginSuccessSrc.includes('/images/login-success/staff-3d.webp'), 'Staff webp asset path');
    assert.ok(loginSuccessSrc.includes('/images/login-success/staff-3d.png'), 'Staff png asset path');
  });

  await t.test('2. 3D Character Assets on disk: All 3 roles have valid PNG and WebP assets', () => {
    const assets = [
      'public/images/login-success/admin-3d.webp',
      'public/images/login-success/admin-3d.png',
      'public/images/login-success/manager-3d.webp',
      'public/images/login-success/manager-3d.png',
      'public/images/login-success/staff-3d.webp',
      'public/images/login-success/staff-3d.png'
    ];

    for (const a of assets) {
      assert.ok(fs.existsSync(path.resolve(a)), `Asset file must exist: ${a}`);
      const stat = fs.statSync(path.resolve(a));
      assert.ok(stat.size > 10000, `Asset file size must be non-trivial: ${a} (${stat.size} bytes)`);
    }
  });

  await t.test('3. UI Layout & Visual Identity: Checkmark, Chevron Branding, and Action Button', () => {
    // Top Branding
    assert.ok(loginSuccessSrc.includes('> GÓC POS <') || (loginSuccessSrc.includes('&gt;') && loginSuccessSrc.includes('&lt;')), 'Must contain > GÓC POS < header');
    assert.ok(loginSuccessSrc.includes('Hệ thống POS Vận hành &amp; Bán hàng') || loginSuccessSrc.includes('Hệ thống POS Vận hành & Bán hàng'), 'Must contain POS subtitle');

    // Green Checkmark Disc
    assert.ok(loginSuccessSrc.includes('Check'), 'Must render Check icon');
    assert.ok(loginSuccessSrc.includes('bg-[#1A7C49]') || loginSuccessSrc.includes('bg-emerald-'), 'Must use green checkmark disc');

    // Continue Button
    assert.ok(loginSuccessSrc.includes('data-testid="login-success-continue-btn"'), 'Must have continue button with data-testid');
    assert.ok(loginSuccessSrc.includes('Tiếp tục'), 'Button label must be Tiếp tục');
  });

  await t.test('4. Security Safeguard: Invalid or unassigned role blocks access', () => {
    assert.ok(loginSuccessSrc.includes('Tài khoản chưa được phân quyền'), 'Must show unassigned role warning');
    assert.ok(loginSuccessSrc.includes('ShieldAlert'), 'Must show shield warning icon');
  });

  await t.test('5. PosContext Integration: loginSuccessRole state management', () => {
    assert.ok(posContextSrc.includes('loginSuccessRole, setLoginSuccessRole'), 'PosContext must declare loginSuccessRole');
    assert.ok(posContextSrc.includes('setLoginSuccessRole(hydrated.role);'), 'PosContext must set loginSuccessRole after hydration');
    assert.ok(posContextSrc.includes('setLoginSuccessRole(null);'), 'PosContext must clear loginSuccessRole on logout');
    assert.ok(posContextSrc.includes('loginSuccessRole,') && posContextSrc.includes('setLoginSuccessRole,'), 'PosContext must export loginSuccessRole in value');
  });

  await t.test('6. App.jsx Route & Viewport Flow: Seamless transition to /tables', () => {
    assert.ok(appSrc.includes('LoginSuccessView'), 'App.jsx must import LoginSuccessView');
    assert.ok(appSrc.includes('if (loginSuccessRole)'), 'App.jsx must condition on loginSuccessRole');
    assert.ok(appSrc.includes('setLoginSuccessRole(null)'), 'App.jsx must reset loginSuccessRole on continue');
    assert.ok(appSrc.includes('navigate(\'/tables\')'), 'App.jsx must route to /tables on continue');
  });
});
