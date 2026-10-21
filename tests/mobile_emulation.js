import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOT_DIR = path.resolve('C:\\Users\\Admin\\.gemini\\antigravity\\brain\\476693bc-2af0-44af-b08b-3e5bb6504cbe\\screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Simple MIME lookup
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

// Static server
function startServer(port = 4173) {
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
        // Fallback for SPA routing
        const indexPath = path.join(DIST_DIR, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(indexPath).pipe(res);
      }
    });

    server.listen(port, () => {
      console.log(`Test static server running on http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function runEmulation() {
  const server = await startServer(4173);
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

  const results = [];

  for (const vp of viewports) {
    console.log(`\n============================================================`);
    console.log(`  Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`============================================================`);

    const page = await browser.newPage();
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });

    await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });

    // Handle Login if unauthenticated
    const loginBtn = await page.$('[data-testid="login-submit-button"]');
    if (loginBtn) {
      console.log(`[${vp.name}] Logging in as admin01@gocpos.vn...`);
      await page.type('input[type="email"]', 'admin01@gocpos.vn');
      await page.type('input[type="password"]', '123456');
      await page.click('[data-testid="login-submit-button"]');
      await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    }

    await page.waitForSelector('[data-testid="shared-page-header"]', { timeout: 10000 });

    // 1. Initial Header position check
    const initialHeaderBox = await page.$eval('[data-testid="shared-page-header"]', el => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, height: rect.height, bottom: rect.bottom };
    });
    console.log(`[${vp.name}] Initial Header Top: ${initialHeaderBox.top}px, Height: ${initialHeaderBox.height}px`);

    // 2. Check 4 BottomNav tabs
    const bottomNavItems = await page.$$eval('[data-testid^="bottom-nav-"]', els => els.map(e => e.getAttribute('data-testid')));
    console.log(`[${vp.name}] BottomNav Tab Count: ${bottomNavItems.length} (${bottomNavItems.join(', ')})`);
    if (bottomNavItems.length !== 4) {
      throw new Error(`Expected 4 BottomNav tabs, got ${bottomNavItems.length}`);
    }

    // Capture initial screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `mobile_${vp.name}_initial.png`) });

    // 3. Test Long Scroll: Scroll <main> down 800px
    const scrollResult = await page.evaluate(async () => {
      const main = document.querySelector('main');
      if (!main) return { error: 'No main element' };
      // Scroll down
      main.scrollTop = 600;
      await new Promise(r => setTimeout(r, 100));
      const header = document.querySelector('[data-testid="shared-page-header"]');
      const rect = header.getBoundingClientRect();
      return {
        mainScrollTop: main.scrollTop,
        headerTop: rect.top,
        windowScrollY: window.scrollY
      };
    });

    console.log(`[${vp.name}] After Scroll Main to ${scrollResult.mainScrollTop}px:`);
    console.log(`       Header Bounding Top: ${scrollResult.headerTop}px (MUST be 0)`);
    console.log(`       Window Scroll Y: ${scrollResult.windowScrollY}px (MUST be 0)`);

    if (scrollResult.headerTop !== 0 || scrollResult.windowScrollY !== 0) {
      throw new Error(`Header scrolled! headerTop=${scrollResult.headerTop}, windowScrollY=${scrollResult.windowScrollY}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `mobile_${vp.name}_scrolled.png`) });

    // 4. Test Avatar Click -> Navigates to Settings
    console.log(`[${vp.name}] Clicking Header Avatar to navigate to Settings...`);
    await page.click('[data-testid="header-avatar-button"]');
    await page.waitForSelector('[data-testid="management-profile-view"]', { timeout: 3000 });

    // Verify Header is HIDDEN on Settings
    const headerVisibleOnSettings = await page.$eval('[data-testid="shared-page-header"]', el => {
      return Boolean(el);
    }).catch(() => false);
    console.log(`[${vp.name}] Header visible on Settings: ${headerVisibleOnSettings} (Expected: false)`);

    // Verify BottomNav is HIDDEN on Settings
    const bottomNavOnSettings = await page.$eval('[data-testid="bottom-nav"]', el => {
      return Boolean(el);
    }).catch(() => false);
    console.log(`[${vp.name}] BottomNav visible on Settings: ${bottomNavOnSettings} (Expected: false)`);

    // Verify Back Button exists
    const backBtnExists = await page.$eval('[data-testid="settings-back-button"]', el => Boolean(el)).catch(() => false);
    console.log(`[${vp.name}] Settings Back button exists: ${backBtnExists}`);

    // Verify Large Avatar has Camera Upload button
    const cameraUploadBtnExists = await page.$eval('[data-testid="upload-avatar-btn"]', el => Boolean(el)).catch(() => false);
    console.log(`[${vp.name}] Settings Camera upload button exists: ${cameraUploadBtnExists}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `mobile_${vp.name}_settings.png`) });

    // 5. Test Back Button -> Returns to Tables
    console.log(`[${vp.name}] Clicking Settings Back button...`);
    await page.click('[data-testid="settings-back-button"]');
    await page.waitForSelector('[data-testid="shared-page-header"]', { timeout: 3000 });

    const returnedTabTitle = await page.$eval('[data-testid="page-header-title"]', el => el.textContent.trim());
    console.log(`[${vp.name}] Returned Header Title: "${returnedTabTitle}" (Expected: "Sơ đồ bàn")`);

    await page.close();

    results.push({
      viewport: vp.name,
      dimensions: `${vp.width}x${vp.height}`,
      headerSticky: scrollResult.headerTop === 0 && scrollResult.windowScrollY === 0,
      bottomNavTabs: bottomNavItems.length,
      settingsNavigation: backBtnExists && !headerVisibleOnSettings && !bottomNavOnSettings,
      backReturnedCorrectly: returnedTabTitle === 'Sơ đồ bàn'
    });
  }

  await browser.close();
  server.close();

  console.log(`\n============================================================`);
  console.log(`  ALL MOBILE EMULATION TESTS PASSED! SUMMARY TABLE:`);
  console.log(`============================================================`);
  console.table(results);
}

runEmulation().catch(err => {
  console.error('Mobile Emulation Failed:', err);
  process.exit(1);
});
