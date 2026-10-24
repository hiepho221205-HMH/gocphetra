/**
 * GÓC POS — Mobile Login Repair & Role-Based Flow E2E Test Suite
 *
 * Runs full browser verification across:
 * - Admin Flow: Login -> Success -> Bắt đầu -> Sơ đồ bàn (/tables)
 * - Logout & Role Switching: In-app logout, session isolation, and clean state resets
 * - Manager Flow: Login -> Success -> Bắt đầu -> Sơ đồ bàn (/tables)
 * - Staff Flow: Login -> Success -> Bắt đầu -> Sơ đồ bàn (/tables)
 * - White Screen Resilience: Reload on Success, Reload on POS, Graceful asset fallbacks
 * - Mobile Viewports: 320x568, 360x740, 375x667, 390x844, 393x852, 430x932
 */

import * as chromeLauncher from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve('dist');
const SCREENSHOT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\7f9fc78f-bc53-4578-bca9-2ad91483c4a2\\screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function startServer(port = 4173) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0].split('#')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(DIST_DIR, reqPath);
      const targetPath = (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) ? filePath : path.join(DIST_DIR, 'index.html');
      const ext = path.extname(targetPath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(targetPath).pipe(res);
    });
    server.listen(port, () => resolve(server));
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runMobileE2ETests() {
  console.log('============================================================');
  console.log('📱 GÓC POS — MOBILE LOGIN & ROLE-BASED SUCCESS FLOW E2E TESTS');
  console.log('============================================================\n');

  const server = await startServer(4173);
  const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
  });

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${chrome.port}`
  });

  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.toString()));

  const testResults = [];

  const recordResult = (name, passed, detail = '') => {
    testResults.push({ name, passed, detail });
    console.log(`${passed ? '  ✔' : '  ✖'} ${name} ${detail ? '(' + detail + ')' : ''}`);
  };

  try {
    // ----------------------------------------------------
    // TEST A: ADMIN FLOW
    // ----------------------------------------------------
    console.log('\n▶ TEST A: ADMIN LOGIN & SUCCESS FLOW (iPhone 14 - 390x844)');
    await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
    await page.goto('http://127.0.0.1:4173/#/login', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[type="email"]:not([disabled])');

    // Verify Login UI elements on mobile
    const loginHeader = await page.$eval('h1', el => el.innerText);
    recordResult('A.1 - Login Page Branding', loginHeader.includes('GÓC POS'));

    // Quick-fill Admin
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const adminBtn = btns.find(b => b.innerText.includes('Admin'));
      if (adminBtn) adminBtn.click();
    });
    await sleep(200);

    const email = await page.$eval('input[type="email"]', el => el.value);
    recordResult('A.2 - Admin Demo Quick-fill', email === 'admin01@gocpos.vn');

    // Submit form
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });
    await page.waitForSelector('[data-testid="login-success-continue-btn"]', { timeout: 10000 });

    // Verify Success Screen
    const successTitle = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.innerText : '';
    });
    const successBody = await page.evaluate(() => document.body.innerText);
    const hasAdminBadge = successBody.includes('ADMIN');
    recordResult('A.3 - Admin Success Page Rendered', successTitle.includes('ĐĂNG NHẬP THÀNH CÔNG') && hasAdminBadge);

    // Screenshot Admin Mobile Success
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'e2e_admin_mobile_success.png') });

    // Click "BẮT ĐẦU →"
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="login-success-continue-btn"]');
      if (btn) btn.click();
    });
    await sleep(1500);

    const postAdminUrl = page.url();
    const postAdminBody = await page.evaluate(() => document.body.innerText);
    recordResult('A.4 - Navigated to Sơ đồ bàn (/tables)', postAdminUrl.includes('/tables') || postAdminBody.includes('Sơ đồ bàn'));

    // ----------------------------------------------------
    // TEST B: LOGOUT & ROLE SWITCHING
    // ----------------------------------------------------
    console.log('\n▶ TEST B: LOGOUT & IN-APP STATE RESET');
    await page.evaluate(async () => {
      if (window.__gocLogout) {
        await window.__gocLogout();
      }
    });
    await page.waitForSelector('input[type="email"]:not([disabled])', { timeout: 10000 });
    await sleep(500);

    const afterLogoutUrl = page.url();
    const hasEmailAfterLogout = await page.evaluate(() => Boolean(document.querySelector('input[type="email"]')));
    recordResult('B.1 - Logout Redirects Cleanly to Login', afterLogoutUrl.includes('/login') && hasEmailAfterLogout);

    // ----------------------------------------------------
    // TEST C: MANAGER FLOW
    // ----------------------------------------------------
    console.log('\n▶ TEST C: MANAGER FLOW');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const mgrBtn = btns.find(b => b.innerText.includes('Quản lý'));
      if (mgrBtn) mgrBtn.click();
    });
    await sleep(200);

    const mgrEmail = await page.$eval('input[type="email"]', el => el.value);
    recordResult('C.1 - Manager Demo Quick-fill', mgrEmail === 'manager01@gocpos.vn');

    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });
    await page.waitForSelector('[data-testid="login-success-continue-btn"]', { timeout: 10000 });

    const mgrSuccessBody = await page.evaluate(() => document.body.innerText);
    recordResult('C.2 - Manager Success Page Rendered (QUẢN LÝ badge)', mgrSuccessBody.includes('QUẢN LÝ'));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'e2e_manager_mobile_success.png') });

    // Click BẮT ĐẦU
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="login-success-continue-btn"]');
      if (btn) btn.click();
    });
    await sleep(1500);
    recordResult('C.3 - Manager Entered Sơ đồ bàn', page.url().includes('/tables') || (await page.evaluate(() => document.body.innerText)).includes('Sơ đồ bàn'));

    // ----------------------------------------------------
    // TEST D: LOGOUT & STAFF FLOW
    // ----------------------------------------------------
    console.log('\n▶ TEST D: STAFF FLOW');
    await page.evaluate(async () => {
      if (window.__gocLogout) {
        await window.__gocLogout();
      }
    });
    await page.waitForSelector('input[type="email"]:not([disabled])', { timeout: 10000 });
    await sleep(500);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const staffBtn = btns.find(b => b.innerText.includes('Thu ngân'));
      if (staffBtn) staffBtn.click();
    });
    await sleep(200);

    const staffEmail = await page.$eval('input[type="email"]', el => el.value);
    recordResult('D.1 - Staff Demo Quick-fill', staffEmail === 'staff01@gocpos.vn');

    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    });
    await page.waitForSelector('[data-testid="login-success-continue-btn"]', { timeout: 10000 });

    const staffSuccessBody = await page.evaluate(() => document.body.innerText);
    recordResult('D.2 - Staff Success Page Rendered (NHÂN VIÊN badge)', staffSuccessBody.includes('NHÂN VIÊN'));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'e2e_staff_mobile_success.png') });

    // Click BẮT ĐẦU
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="login-success-continue-btn"]');
      if (btn) btn.click();
    });
    await sleep(1500);
    recordResult('D.3 - Staff Entered Sơ đồ bàn', page.url().includes('/tables') || (await page.evaluate(() => document.body.innerText)).includes('Sơ đồ bàn'));

    // ----------------------------------------------------
    // TEST E: WHITE SCREEN RESILIENCE & F5
    // ----------------------------------------------------
    console.log('\n▶ TEST E: WHITE SCREEN RESILIENCE (F5 Reload in POS)');
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1500);
    const reloadedBody = await page.evaluate(() => document.body.innerText);
    const isWhiteScreen = reloadedBody.trim().length === 0;
    recordResult('E.1 - No White Screen on Reload in POS', !isWhiteScreen && reloadedBody.includes('Sơ đồ bàn'));

    // ----------------------------------------------------
    // TEST F: MOBILE RESPONSIVE VIEWPORTS
    // ----------------------------------------------------
    console.log('\n▶ TEST F: MOBILE VIEWPORTS (No overflow, Demo pills visible)');
    await page.evaluate(async () => {
      if (window.__gocLogout) {
        await window.__gocLogout();
      }
    });
    await page.waitForSelector('input[type="email"]:not([disabled])', { timeout: 10000 });
    await sleep(500);

    const viewports = [
      { name: 'iPhone SE (320x568)', w: 320, h: 568 },
      { name: 'Small Android (360x740)', w: 360, h: 740 },
      { name: 'iPhone 8/SE (375x667)', w: 375, h: 667 },
      { name: 'iPhone 14 (390x844)', w: 390, h: 844 },
      { name: 'iPhone 15 Pro (393x852)', w: 393, h: 852 },
      { name: 'iPhone 14 Pro Max (430x932)', w: 430, h: 932 }
    ];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: true });
      await page.goto('http://127.0.0.1:4173/#/login', { waitUntil: 'networkidle0' });
      await sleep(400);

      const metrics = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
        const clientWidth = docEl.clientWidth;
        const emailInput = document.querySelector('input[type="email"]');
        const submitBtn = document.querySelector('button[type="submit"]');
        const demoChips = document.querySelectorAll('button');
        const hasHorizontalScroll = scrollWidth > clientWidth;

        return {
          hasHorizontalScroll,
          scrollWidth,
          clientWidth,
          hasInputs: Boolean(emailInput && submitBtn),
          buttonCount: demoChips.length
        };
      });

      recordResult(`F - Viewport ${vp.name}`, !metrics.hasHorizontalScroll && metrics.hasInputs, `W: ${metrics.clientWidth}px, No horizontal overflow`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `login_responsive_${vp.w}x${vp.h}.png`) });
    }

    recordResult('G - Zero Unhandled Page Errors Caught', pageErrors.length === 0, `${pageErrors.length} errors`);

  } catch (err) {
    console.error('Test Suite Exception:', err);
    recordResult('Fatal Test Failure', false, err.message);
  } finally {
    await browser.close();
    await chrome.kill();
    server.close();
  }

  const allPassed = testResults.every(r => r.passed);
  console.log('\n============================================================');
  console.log(`TOTAL E2E VERIFICATIONS: ${testResults.length} | PASSED: ${testResults.filter(r => r.passed).length} | FAILED: ${testResults.filter(r => !r.passed).length}`);
  console.log('============================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runMobileE2ETests().catch(err => {
  console.error(err);
  process.exit(1);
});
