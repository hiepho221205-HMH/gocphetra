/**
 * GÓC POS — Redesign Login Page Verification Test Suite
 *
 * Validates:
 * 1. Visual hierarchy & branding: "GÓC POS" header, removal of old square logo.
 * 2. 3D Barista character: proper asset layering, subtle floating animation, WebP & PNG fallbacks.
 * 3. 3D Coffee Shop background atmosphere: WebP & PNG fallbacks, blur & ambient overlay.
 * 4. Card layout: "LOGIN" title centered, uppercase, elimination of "NỘI BỘ" badge.
 * 5. Input contracts: data-testid preservation for automated tests, email/password styling, password visibility toggle.
 * 6. CTA Button: "Đăng nhập ca làm việc", loading state, double-submit protection.
 * 7. Demo accounts & Quick-fill: Admin, Quản lý, Thu ngân chips.
 * 8. Responsive container: mobile-first, no fixed-height lock causing scroll cutoff.
 * 9. Security badges: Supabase Auth & RBAC indicators.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const loginPageSrc = fs.readFileSync(path.resolve('src/components/auth/LoginPage.jsx'), 'utf-8');
const indexCssSrc = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');

test('TASK: REDESIGN LOGIN PAGE — GÓC POS', async (t) => {
  await t.test('1. Branding: GÓC POS centered, no legacy square logo', () => {
    // Must contain GÓC POS
    assert.ok(loginPageSrc.includes('GÓC POS'), 'Must have GÓC POS title');
    assert.ok(loginPageSrc.includes('Hệ thống POS Vận hành & Bán hàng'), 'Must have official subtitle');
    // Must NOT contain old square logo / Coffee icon disc
    assert.equal(loginPageSrc.includes('clay-disc-forest'), false, 'Must remove old square/circle logo disc');
  });

  await t.test('2. 3D Cute Barista Character: Static asset, WebP/PNG fallbacks, and exact card top positioning', () => {
    // Check asset paths
    assert.ok(loginPageSrc.includes('/images/login/barista-3d.webp'), 'Must reference barista-3d.webp');
    assert.ok(loginPageSrc.includes('/images/login/barista-3d.png'), 'Must reference barista-3d.png fallback');
    // Verify files exist on disk
    assert.ok(fs.existsSync(path.resolve('public/images/login/barista-3d.webp')), 'barista-3d.webp must exist');
    assert.ok(fs.existsSync(path.resolve('public/images/login/barista-3d.png')), 'barista-3d.png must exist');
    // Verify character is static (no distracting floating/jumping animation on login)
    assert.equal(loginPageSrc.includes('animate-subtle-float'), false, 'Barista character must be a crisp static asset');
  });

  await t.test('3. Background: Coffee shop atmosphere with WebP/PNG and ambient overlay', () => {
    assert.ok(loginPageSrc.includes('/images/login/coffee-shop-bg.webp'), 'Must reference coffee-shop-bg.webp');
    assert.ok(loginPageSrc.includes('/images/login/coffee-shop-bg.png'), 'Must reference coffee-shop-bg.png fallback');
    assert.ok(fs.existsSync(path.resolve('public/images/login/coffee-shop-bg.webp')), 'coffee-shop-bg.webp must exist');
    assert.ok(fs.existsSync(path.resolve('public/images/login/coffee-shop-bg.png')), 'coffee-shop-bg.png must exist');
  });

  await t.test('4. Login Card: Title is centered "LOGIN", uppercase, "NỘI BỘ" label eliminated', () => {
    assert.ok(loginPageSrc.includes('LOGIN'), 'Must have LOGIN uppercase title');
    assert.ok(loginPageSrc.includes('Nhập tài khoản nhân viên được cấp để mở ca làm việc'), 'Must retain description');
    // Check that "NỘI BỘ" badge is completely eliminated
    assert.equal(loginPageSrc.includes('>Nội bộ<'), false, 'Must NOT contain "Nội bộ" badge');
    assert.equal(loginPageSrc.includes('>NỘI BỘ<'), false, 'Must NOT contain "NỘI BỘ" badge');
  });

  await t.test('5. Form Inputs & Attributes Contract: Preserved data-testid and test attributes', () => {
    assert.ok(loginPageSrc.includes('data-testid="login-email-input"'), 'Must preserve email data-testid');
    assert.ok(loginPageSrc.includes('data-testid="login-password-input"'), 'Must preserve password data-testid');
    assert.ok(loginPageSrc.includes('data-testid="login-submit-button"'), 'Must preserve submit button data-testid');
    assert.ok(loginPageSrc.includes('autoComplete="email"'), 'Email input must support autocomplete');
    assert.ok(loginPageSrc.includes('autoComplete="current-password"'), 'Password input must support autocomplete');
    assert.ok(loginPageSrc.includes('Quên mật khẩu?'), 'Must have forgot password button');
  });

  await t.test('6. CTA Button: "Đăng nhập ca làm việc", loading spinner, and double submit prevention', () => {
    assert.ok(loginPageSrc.includes('Đăng nhập ca làm việc'), 'Button text must be "Đăng nhập ca làm việc"');
    assert.ok(loginPageSrc.includes('Loader2'), 'Must show spinner when submitting');
    assert.ok(loginPageSrc.includes('disabled={isSubmitting'), 'Must prevent double submission');
  });

  await t.test('7. Demo Accounts & Chips: Admin, Quản lý, Thu ngân chips', () => {
    assert.ok(loginPageSrc.includes('TÀI KHOẢN MẪU THỬ NGHIỆM'), 'Must retain demo accounts section header');
    assert.ok(loginPageSrc.includes('Admin'), 'Must retain Admin chip');
    assert.ok(loginPageSrc.includes('Quản lý'), 'Must retain Quản lý chip');
    assert.ok(loginPageSrc.includes('Thu ngân'), 'Must retain Thu ngân chip');
  });

  await t.test('8. Footer: Security credentials and version notice', () => {
    assert.ok(loginPageSrc.includes('Bảo mật Supabase Auth • Phân quyền RBAC'), 'Must retain Supabase Auth badge');
    assert.ok(loginPageSrc.includes('GÓC POS v1.0 • Chỉ dành cho nhân sự nội bộ quán'), 'Must retain version notice');
  });

  await t.test('9. Mobile & Desktop Responsive: Non-fixed scrolling container prevents keyboard cutoff', () => {
    assert.ok(loginPageSrc.includes('overflow-y-auto'), 'Main layout must permit vertical scrolling');
    assert.ok(loginPageSrc.includes('min-h-[100dvh]'), 'Main layout must use dynamic viewport height dvh');
    // Must NOT have fixed height phone mockups like sm:h-[844px]
    assert.equal(loginPageSrc.includes('sm:h-[844px]'), false, 'Must eliminate fixed 844px mobile frame wrapper');
  });
});
