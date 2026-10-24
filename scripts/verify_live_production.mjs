/**
 * GÓC POS — Live Cloudflare Production Smoke & Flow Verification
 * URL: https://gocphetra.hiepho-221205.workers.dev
 */

import * as chromeLauncher from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const PROD_URL = 'https://gocphetra.hiepho-221205.workers.dev';
const SCREENSHOT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\7f9fc78f-bc53-4578-bca9-2ad91483c4a2\\screenshots';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function verifyProduction() {
  console.log('============================================================');
  console.log(`🚀 VERIFYING LIVE PRODUCTION: ${PROD_URL}`);
  console.log('============================================================\n');

  const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
  });

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${chrome.port}`
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });

  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.toString()));

  const results = [];
  const logCheck = (title, pass, note = '') => {
    results.push({ title, pass, note });
    console.log(`${pass ? '  ✅' : '  ❌'} ${title} ${note ? '(' + note + ')' : ''}`);
  };

  try {
    console.log('Navigating to Live Production URL...');
    const resp = await page.goto(PROD_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    logCheck('Production HTTP Status', resp.status() === 200, `Status: ${resp.status()}`);
    await sleep(1000);

    // 1. Verify Login Screen on Production
    const title = await page.title();
    logCheck('Production Page Title', title.includes('GÓC'), `Title: ${title}`);

    const hasLoginCard = await page.evaluate(() => Boolean(document.querySelector('form')));
    logCheck('Production Login Form Rendered', hasLoginCard);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_mobile_login.png') });

    // 2. Admin Flow on Production
    console.log('\n--- Live Flow: Admin ---');
    await page.waitForSelector('input[type="email"]:not([disabled])');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const adminBtn = btns.find(b => b.innerText.includes('Admin'));
      if (adminBtn) adminBtn.click();
    });
    await sleep(200);

    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });
    await page.waitForSelector('[data-testid="login-success-continue-btn"]', { timeout: 15000 });

    const adminSuccessText = await page.evaluate(() => document.body.innerText);
    logCheck('Admin Login Success UI on Production', adminSuccessText.includes('ĐĂNG NHẬP THÀNH CÔNG') && adminSuccessText.includes('ADMIN'));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_admin_success.png') });

    // Advance to /tables
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="login-success-continue-btn"]');
      if (btn) btn.click();
    });
    await sleep(2000);
    const postAdminUrl = page.url();
    const postAdminBody = await page.evaluate(() => document.body.innerText);
    logCheck('Admin Enters Sơ đồ bàn on Production', postAdminUrl.includes('/tables') || postAdminBody.includes('Sơ đồ bàn'));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_tables_admin.png') });

    // 3. Logout
    console.log('\n--- Live Flow: Logout & Manager ---');
    await page.evaluate(async () => {
      if (window.__gocLogout) await window.__gocLogout();
    });
    await page.waitForSelector('input[type="email"]:not([disabled])', { timeout: 15000 });
    logCheck('Logout Works on Production', page.url().includes('/login'));

    // 4. Manager Flow
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const mgrBtn = btns.find(b => b.innerText.includes('Quản lý'));
      if (mgrBtn) mgrBtn.click();
    });
    await sleep(200);

    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });
    await page.waitForSelector('[data-testid="login-success-continue-btn"]', { timeout: 15000 });
    const mgrSuccessText = await page.evaluate(() => document.body.innerText);
    logCheck('Manager Login Success UI on Production', mgrSuccessText.includes('QUẢN LÝ'));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_manager_success.png') });

    // Advance to /tables
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="login-success-continue-btn"]');
      if (btn) btn.click();
    });
    await sleep(2000);
    logCheck('Manager Enters Sơ đồ bàn on Production', page.url().includes('/tables') || (await page.evaluate(() => document.body.innerText)).includes('Sơ đồ bàn'));

    // 5. Logout & Staff Flow
    console.log('\n--- Live Flow: Logout & Staff ---');
    await page.evaluate(async () => {
      if (window.__gocLogout) await window.__gocLogout();
    });
    await page.waitForSelector('input[type="email"]:not([disabled])', { timeout: 15000 });

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const staffBtn = btns.find(b => b.innerText.includes('Thu ngân'));
      if (staffBtn) staffBtn.click();
    });
    await sleep(200);

    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });
    await page.waitForSelector('[data-testid="login-success-continue-btn"]', { timeout: 15000 });
    const staffSuccessText = await page.evaluate(() => document.body.innerText);
    logCheck('Staff Login Success UI on Production', staffSuccessText.includes('NHÂN VIÊN'));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_staff_success.png') });

    // Advance to /tables
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="login-success-continue-btn"]');
      if (btn) btn.click();
    });
    await sleep(2000);
    logCheck('Staff Enters Sơ đồ bàn on Production', page.url().includes('/tables') || (await page.evaluate(() => document.body.innerText)).includes('Sơ đồ bàn'));

    // Check page errors
    logCheck('Zero Uncaught Page Errors on Production', pageErrors.length === 0, `${pageErrors.length} errors`);

  } catch (err) {
    console.error('Production Verification Error:', err);
    logCheck('Live Verification Succeeded', false, err.message);
  } finally {
    await browser.close();
    await chrome.kill();
  }

  const allPassed = results.every(r => r.pass);
  console.log('\n============================================================');
  console.log(`PRODUCTION STATUS: ${allPassed ? 'ALL VERIFICATIONS PASSED ✅' : 'SOME VERIFICATIONS FAILED ❌'}`);
  console.log('============================================================');

  if (!allPassed) process.exit(1);
}

verifyProduction().catch(console.error);
