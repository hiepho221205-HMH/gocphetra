import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOT_DIR = path.resolve('C:\\Users\\Admin\\.gemini\\antigravity\\brain\\6bb248b7-7cd7-4bae-9eb1-80900f01ca9f\\screenshots');

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

function startServer(port = 4175) {
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
      console.log(`RBAC QA test server running on http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function runRbacScreenshots() {
  const server = await startServer(4175);
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const viewports = [
    { name: '360px', width: 360, height: 780 },
    { name: '390px', width: 390, height: 844 },
    { name: '430px', width: 430, height: 932 }
  ];

  try {
    for (const vp of viewports) {
      console.log(`\n============================================================`);
      console.log(`  Capturing RBAC Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      console.log(`============================================================`);

      const page = await browser.newPage();
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
      });

      await page.evaluateOnNewDocument(() => {
        window.__ENABLE_DEMO_SWITCHER__ = true;
      });

      // 1. Màn hình chính Phân quyền (/rbac)
      await page.goto('http://localhost:4175/#/rbac', { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 600));

      const mainPath = path.join(SCREENSHOT_DIR, `rbac_main_${vp.name}.png`);
      await page.screenshot({ path: mainPath });
      console.log(`  [OK] Saved: rbac_main_${vp.name}.png`);

      // 2. Màn hình Chi tiết nhân viên thường (/rbac/detail?id=staff-03)
      await page.goto('http://localhost:4175/#/rbac/detail?id=staff-03', { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 600));

      const detailPath = path.join(SCREENSHOT_DIR, `rbac_detail_${vp.name}.png`);
      await page.screenshot({ path: detailPath });
      console.log(`  [OK] Saved: rbac_detail_${vp.name}.png`);

      // 2B. Màn hình Chi tiết nhân viên Admin duy nhất (/rbac/detail?id=staff-01) - Không có nút Thay đổi vai trò
      await page.goto('http://localhost:4175/#/rbac/detail?id=staff-01', { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 600));

      const detailAdminPath = path.join(SCREENSHOT_DIR, `rbac_detail_sole_admin_${vp.name}.png`);
      await page.screenshot({ path: detailAdminPath });
      console.log(`  [OK] Saved: rbac_detail_sole_admin_${vp.name}.png`);

      // 3. Màn hình Thay đổi vai trò (/rbac/role?id=staff-03)
      await page.goto('http://localhost:4175/#/rbac/role?id=staff-03', { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 600));

      const rolePath = path.join(SCREENSHOT_DIR, `rbac_role_${vp.name}.png`);
      await page.screenshot({ path: rolePath });
      console.log(`  [OK] Saved: rbac_role_${vp.name}.png`);

      // 4. Màn hình Nhật ký phân quyền (/rbac/audit)
      await page.goto('http://localhost:4175/#/rbac/audit', { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 600));

      const auditPath = path.join(SCREENSHOT_DIR, `rbac_audit_${vp.name}.png`);
      await page.screenshot({ path: auditPath });
      console.log(`  [OK] Saved: rbac_audit_${vp.name}.png`);

      // 5. Test Luồng Back: Cài đặt -> Phân quyền -> Back -> Cài đặt
      await page.goto('http://localhost:4175/#/settings', { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 500));
      await page.waitForSelector('[data-testid="rbac-permissions-nav-card"]', { timeout: 3000 });
      await page.click('[data-testid="rbac-permissions-nav-card"]');
      await new Promise(r => setTimeout(r, 500));
      await page.waitForSelector('[data-testid="rbac-back-to-settings-btn"]', { timeout: 3000 });
      await page.click('[data-testid="rbac-back-to-settings-btn"]');
      await new Promise(r => setTimeout(r, 500));
      await page.waitForSelector('[data-testid="management-profile-view"]', { timeout: 3000 });
      const backOkPath = path.join(SCREENSHOT_DIR, `rbac_back_to_settings_${vp.name}.png`);
      await page.screenshot({ path: backOkPath });
      console.log(`  [OK] Back to Settings verified & saved: rbac_back_to_settings_${vp.name}.png`);

      // 6. Màn hình Từ chối truy cập (AccessDeniedView) khi đăng nhập Staff
      await page.goto('http://localhost:4175/#/tables', { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 400));
      await page.click('[data-testid="demo-switch-to-staff-btn"]');
      await new Promise(r => setTimeout(r, 400));
      await page.evaluate(() => { window.location.hash = '#/rbac'; });
      await new Promise(r => setTimeout(r, 500));

      const deniedPath = path.join(SCREENSHOT_DIR, `rbac_denied_${vp.name}.png`);
      await page.screenshot({ path: deniedPath });
      console.log(`  [OK] Saved: rbac_denied_${vp.name}.png`);

      // Chuyển lại Admin cho viewport tiếp theo
      await page.click('[data-testid="demo-switch-to-admin-btn"]');
      await new Promise(r => setTimeout(r, 300));

      await page.close();
    }

    console.log('\n[ALL SCREENSHOTS CAPTURED SUCCESSFULLY]');
  } catch (err) {
    console.error('Screenshot capture error:', err);
  } finally {
    await browser.close();
    server.close();
  }
}

runRbacScreenshots();
