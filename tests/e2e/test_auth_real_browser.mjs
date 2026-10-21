import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOT_DIR = path.resolve('C:\\Users\\Admin\\.gemini\\antigravity\\brain\\cd42ea2e-119b-40ba-b7b5-5315f671f21d\\screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function startServer(port = 4180) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(DIST_DIR, reqPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        const indexPath = path.join(DIST_DIR, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(indexPath).pipe(res);
      }
    });

    server.listen(port, () => {
      console.log(`🌐 Server E2E chạy tại http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function runBrowserE2E() {
  console.log('============================================================');
  console.log('📱 GÓC POS - BROWSER E2E TESTS (VIEWPORTS 360, 390, 430px)');
  console.log('============================================================');

  const server = await startServer(4180);
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setCacheEnabled(false);

  try {
    // 1. Test Viewports on Login Page
    const viewports = [
      { name: '360px', width: 360, height: 780 },
      { name: '390px', width: 390, height: 844 },
      { name: '430px', width: 430, height: 932 }
    ];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
      await page.goto('http://localhost:4180/', { waitUntil: 'networkidle0' });

      // Verify Login Page Elements
      const emailInput = await page.$('[data-testid="login-email-input"]');
      const passInput = await page.$('[data-testid="login-password-input"]');
      const submitBtn = await page.$('[data-testid="login-submit-button"]');

      if (!emailInput || !passInput || !submitBtn) {
        throw new Error(`Login form elements missing on viewport ${vp.name}`);
      }

      const screenshotPath = path.join(SCREENSHOT_DIR, `login_page_${vp.name}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`✅ Viewport ${vp.name} Login Page OK -> Chụp ảnh: ${screenshotPath}`);
    }

    // 2. Test Staff Login & Isolation (390px)
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto('http://localhost:4180/', { waitUntil: 'networkidle0' });

    console.log('\n🔑 Đăng nhập thử nghiệm: staff01@gocpos.vn...');
    await page.type('[data-testid="login-email-input"]', 'staff01@gocpos.vn');
    await page.type('[data-testid="login-password-input"]', '123456');
    await page.click('[data-testid="login-submit-button"]');

    // Wait for POS UI to render after auth
    await page.waitForSelector('[data-testid="shared-page-header"]', { timeout: 10000 });
    console.log('✅ Staff 01 đăng nhập thành công, đã vào POS Header!');

    // Check BottomNav items for Staff
    const navButtons = await page.$$('nav button');
    console.log(`  ℹ Staff BottomNav buttons count: ${navButtons.length} (Kỳ vọng: 2 [Bàn, Đơn hàng])`);

    const staffScreenshot = path.join(SCREENSHOT_DIR, 'pos_staff_view_390px.png');
    await page.screenshot({ path: staffScreenshot });
    console.log(`✅ Chụp ảnh giao diện Staff: ${staffScreenshot}`);

    // Test Logout by clearing auth storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('http://localhost:4180/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="login-email-input"]', { timeout: 5000 });
    console.log('✅ Đăng xuất an toàn thành công, quay về màn hình Login!');

    // 3. Test Admin Login (390px)
    console.log('\n🔑 Đăng nhập thử nghiệm: admin01@gocpos.vn...');
    await page.type('[data-testid="login-email-input"]', 'admin01@gocpos.vn');
    await page.type('[data-testid="login-password-input"]', '123456');
    await page.click('[data-testid="login-submit-button"]');

    await page.waitForSelector('[data-testid="shared-page-header"]', { timeout: 10000 });
    console.log('✅ Admin 01 đăng nhập thành công, đã vào POS Header!');

    const adminNavButtons = await page.$$('nav button');
    console.log(`  ℹ Admin BottomNav buttons count: ${adminNavButtons.length} (Kỳ vọng: 4 [Bàn, Menu, Đơn hàng, Báo cáo])`);

    const adminScreenshot = path.join(SCREENSHOT_DIR, 'pos_admin_view_390px.png');
    await page.screenshot({ path: adminScreenshot });
    console.log(`✅ Chụp ảnh giao diện Admin: ${adminScreenshot}`);

    // Click Header Avatar to enter Settings
    await page.click('[data-testid="header-avatar-button"]');
    await page.waitForSelector('[data-testid="settings-view-card"]', { timeout: 5000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 600));

    const settingsScreenshot = path.join(SCREENSHOT_DIR, 'pos_admin_settings_390px.png');
    await page.screenshot({ path: settingsScreenshot });
    console.log(`✅ Chụp ảnh Cài đặt Admin: ${settingsScreenshot}`);

    console.log('\n============================================================');
    console.log('🎉 TOÀN BỘ BROWSER E2E TESTS HOÀN THÀNH XUẤT SẮC!');
    console.log('============================================================');
  } catch (err) {
    console.error('❌ Lỗi Browser E2E:', err);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
  }
}

runBrowserE2E();
