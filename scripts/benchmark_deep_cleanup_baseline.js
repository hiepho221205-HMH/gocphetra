import * as chromeLauncher from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve('dist');
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer(port = 4178) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0].split('#')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(DIST_DIR, reqPath);
      const targetPath = (fs.existsSync(filePath) && fs.statSync(filePath).isFile())
        ? filePath
        : path.join(DIST_DIR, 'index.html');
      const ext = path.extname(targetPath);

      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(targetPath).pipe(res);
    });

    server.listen(port, () => {
      resolve(server);
    });
    server.on('error', reject);
  });
}

function auditBundle() {
  const dir = path.join(DIST_DIR, 'assets');
  let jsBytes = 0;
  let cssBytes = 0;
  const chunkList = [];

  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    files.forEach((f) => {
      const stat = fs.statSync(path.join(dir, f));
      if (f.endsWith('.js')) {
        jsBytes += stat.size;
        chunkList.push({ name: f, sizeKB: Number((stat.size / 1024).toFixed(2)) });
      } else if (f.endsWith('.css')) {
        cssBytes += stat.size;
        chunkList.push({ name: f, sizeKB: Number((stat.size / 1024).toFixed(2)) });
      }
    });
  }

  return {
    totalJsKB: Number((jsBytes / 1024).toFixed(2)),
    totalCssKB: Number((cssBytes / 1024).toFixed(2)),
    totalBundleKB: Number(((jsBytes + cssBytes) / 1024).toFixed(2)),
    chunkCount: chunkList.length,
    chunks: chunkList.sort((a, b) => b.sizeKB - a.sizeKB)
  };
}

async function runBenchmark(mode = 'baseline') {
  console.log(`\n============================================================`);
  console.log(`🚀 GÓC POS — 10-VIEW DEEP PERFORMANCE BENCHMARK (${mode.toUpperCase()})`);
  console.log(`============================================================\n`);

  const bundle = auditBundle();
  console.log(`📦 Bundle Analysis:`);
  console.log(`  - Total JS  : ${bundle.totalJsKB} KB`);
  console.log(`  - Total CSS : ${bundle.totalCssKB} KB`);
  console.log(`  - Total All : ${bundle.totalBundleKB} KB`);
  console.log(`  - Chunks    : ${bundle.chunkCount} files\n`);

  const server = await startServer(4178);

  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--window-size=390,844' // Mobile viewport
    ]
  });

  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${chrome.port}`
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  const cdp = await page.target().createCDPSession();
  await cdp.send('Performance.enable');

  const transitionTimes = {};
  const viewMetrics = {};

  // 1. Cold Load & Login Page
  console.log(`[View 1/10] Auditing Login View (Cold Load)...`);
  const coldStart = performance.now();
  await page.goto('http://localhost:4178/#/login', { waitUntil: 'networkidle2' });
  const coldDuration = performance.now() - coldStart;

  const coldPerfTiming = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((p) => p.name === 'first-contentful-paint')?.startTime || 0;
    return {
      fcp: Math.round(fcp),
      domInteractive: Math.round(nav?.domInteractive || 0),
      domContentLoaded: Math.round(nav?.domContentLoadedEventEnd || 0),
      loadEvent: Math.round(nav?.loadEventEnd || 0)
    };
  });

  const loginMetrics = await page.metrics();
  viewMetrics['Login'] = {
    loadDurationMs: Math.round(coldDuration),
    fcpMs: coldPerfTiming.fcp,
    jsHeapUsedMB: Number((loginMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(2))
  };
  console.log(`  ✔ Login Load: ${Math.round(coldDuration)}ms | FCP: ${coldPerfTiming.fcp}ms | Heap: ${viewMetrics['Login'].jsHeapUsedMB} MB`);

  // Log in as Admin
  console.log(`\nLogging in as Admin for Authenticated Views...`);
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Admin'));
  }, { timeout: 10000 });

  await page.evaluate(() => {
    const adminBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Admin'));
    if (adminBtn) adminBtn.click();
  });
  await sleep(300);

  const loginSubmitStart = performance.now();
  await page.evaluate(() => {
    const submitBtn = document.querySelector('[data-testid="login-submit-button"]') ||
      Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Vào ca'));
    if (submitBtn) submitBtn.click();
  });

  await page.waitForFunction(() => {
    return document.body.textContent.includes('Trần Mai') || document.body.textContent.includes('Khu vực bàn');
  }, { timeout: 15000 });
  const loginToTablesDuration = performance.now() - loginSubmitStart;
  transitionTimes['Login -> Tables'] = Math.round(loginToTablesDuration);
  console.log(`  ✔ Login -> Tables Transition: ${transitionTimes['Login -> Tables']}ms`);

  // 2. Table Management View
  console.log(`\n[View 2/10] Auditing Sơ đồ bàn (Table Management)...`);
  await sleep(500);
  const tablesMetrics = await page.metrics();
  viewMetrics['Tables'] = {
    jsHeapUsedMB: Number((tablesMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(2))
  };
  console.log(`  ✔ Tables View Heap: ${viewMetrics['Tables'].jsHeapUsedMB} MB`);

  // 3. Order / Gọi món
  console.log(`\n[View 3/10] Auditing Order / Gọi món View...`);
  const orderStart = performance.now();
  await page.evaluate(() => {
    const tableCards = Array.from(document.querySelectorAll('div, button'));
    const t1 = tableCards.find((el) => el.textContent && el.textContent.includes('Bàn 01'));
    if (t1) t1.click();
  });
  await page.waitForFunction(() => {
    return document.body.textContent.includes('Thực đơn') || document.body.textContent.includes('Món') || document.body.textContent.includes('Giỏ hàng');
  }, { timeout: 8000 });
  const orderTransition = performance.now() - orderStart;
  transitionTimes['Tables -> OrderView'] = Math.round(orderTransition);
  const orderMetrics = await page.metrics();
  viewMetrics['OrderView'] = {
    transitionMs: Math.round(orderTransition),
    jsHeapUsedMB: Number((orderMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(2))
  };
  console.log(`  ✔ Tables -> OrderView Transition: ${viewMetrics['OrderView'].transitionMs}ms | Heap: ${viewMetrics['OrderView'].jsHeapUsedMB} MB`);

  // Add an item to cart to test active ordering state
  await page.evaluate(() => {
    const itemBtn = Array.from(document.querySelectorAll('button, div')).find((el) =>
      el.textContent && (el.textContent.includes('Cà phê') || el.textContent.includes('Bạc xỉu'))
    );
    if (itemBtn) itemBtn.click();
  });
  await sleep(400);

  // Return to Tables
  await page.evaluate(() => {
    const backBtn = Array.from(document.querySelectorAll('button')).find((b) => b.querySelector('svg') && !b.textContent.trim());
    if (backBtn) backBtn.click();
  });
  await sleep(400);

  // 4. Chi tiết đơn (OrderDetailsModal)
  console.log(`\n[View 4/10] Auditing Chi tiết đơn (Order Details Modal)...`);
  const detailsStart = performance.now();
  await page.evaluate(() => {
    const viewBtn = document.querySelector('[data-testid="view-order-details-button"]') ||
      Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Xem đơn') || b.textContent.includes('Chi tiết'));
    if (viewBtn) viewBtn.click();
  });
  await sleep(400);
  const detailsDuration = performance.now() - detailsStart;
  transitionTimes['Open OrderDetailsModal'] = Math.round(detailsDuration);
  console.log(`  ✔ OrderDetailsModal Open: ${transitionTimes['Open OrderDetailsModal']}ms`);

  // Close details modal
  await page.evaluate(() => {
    const closeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Đóng') || b.textContent.includes('Quay lại'));
    if (closeBtn) closeBtn.click();
  });
  await sleep(300);

  // 5. Thanh toán (BillCheckoutModal)
  console.log(`\n[View 5/10] Auditing Thanh toán (Bill Checkout Modal)...`);
  const checkoutStart = performance.now();
  await page.evaluate(() => {
    const payBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Thanh toán') || b.textContent.includes('Tính tiền'));
    if (payBtn) payBtn.click();
  });
  await sleep(600);
  const checkoutDuration = performance.now() - checkoutStart;
  transitionTimes['Open BillCheckoutModal'] = Math.round(checkoutDuration);
  console.log(`  ✔ BillCheckoutModal Open: ${transitionTimes['Open BillCheckoutModal']}ms`);

  // Close checkout modal
  await page.evaluate(() => {
    const closeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Đóng') || b.textContent.includes('Hủy'));
    if (closeBtn) closeBtn.click();
  });
  await sleep(300);

  // 6. Đơn hàng (Order History View)
  console.log(`\n[View 6/10] Auditing Đơn hàng (Order History View)...`);
  const historyStart = performance.now();
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Đơn hàng') || b.textContent.includes('Lịch sử'));
    if (btn) btn.click();
  });
  await sleep(500);
  transitionTimes['Tables -> OrderHistory'] = Math.round(performance.now() - historyStart);
  const historyMetrics = await page.metrics();
  viewMetrics['OrderHistory'] = {
    transitionMs: transitionTimes['Tables -> OrderHistory'],
    jsHeapUsedMB: Number((historyMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(2))
  };
  console.log(`  ✔ Tables -> OrderHistory: ${viewMetrics['OrderHistory'].transitionMs}ms | Heap: ${viewMetrics['OrderHistory'].jsHeapUsedMB} MB`);

  // 7. Thực đơn (Menu Management View)
  console.log(`\n[View 7/10] Auditing Thực đơn (Menu Management View)...`);
  const menuStart = performance.now();
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Thực đơn'));
    if (btn) btn.click();
  });
  await sleep(500);
  transitionTimes['History -> MenuManagement'] = Math.round(performance.now() - menuStart);
  const menuMetrics = await page.metrics();
  viewMetrics['MenuManagement'] = {
    transitionMs: transitionTimes['History -> MenuManagement'],
    jsHeapUsedMB: Number((menuMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(2))
  };
  console.log(`  ✔ History -> MenuManagement: ${viewMetrics['MenuManagement'].transitionMs}ms | Heap: ${viewMetrics['MenuManagement'].jsHeapUsedMB} MB`);

  // 8. Dashboard (Reports View)
  console.log(`\n[View 8/10] Auditing Dashboard (Reports View)...`);
  const reportsStart = performance.now();
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Báo cáo'));
    if (btn) btn.click();
  });
  await sleep(500);
  transitionTimes['Menu -> Reports'] = Math.round(performance.now() - reportsStart);
  const reportsMetrics = await page.metrics();
  viewMetrics['Reports'] = {
    transitionMs: transitionTimes['Menu -> Reports'],
    jsHeapUsedMB: Number((reportsMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(2))
  };
  console.log(`  ✔ Menu -> Reports: ${viewMetrics['Reports'].transitionMs}ms | Heap: ${viewMetrics['Reports'].jsHeapUsedMB} MB`);

  // 9. Cài đặt & Quản lý (Settings View)
  console.log(`\n[View 9/10] Auditing Cài đặt & Quản lý (Settings View)...`);
  const settingsStart = performance.now();
  await page.evaluate(() => {
    const avatar = document.querySelector('header button, [data-testid="header-avatar-button"]') ||
      Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Trần Mai') || b.querySelector('img'));
    if (avatar) avatar.click();
  });
  await sleep(600);
  transitionTimes['Reports -> Settings'] = Math.round(performance.now() - settingsStart);
  const settingsMetrics = await page.metrics();
  viewMetrics['Settings'] = {
    transitionMs: transitionTimes['Reports -> Settings'],
    jsHeapUsedMB: Number((settingsMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(2))
  };
  console.log(`  ✔ Reports -> Settings: ${viewMetrics['Settings'].transitionMs}ms | Heap: ${viewMetrics['Settings'].jsHeapUsedMB} MB`);

  // 10. Cấu hình Quán & Hóa đơn (Store Config Subpage)
  console.log(`\n[View 10/10] Auditing Cấu hình Quán & Hóa đơn (Store Config Subpage)...`);
  const configStart = performance.now();
  await page.evaluate(() => {
    const configBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Cấu hình') || b.textContent.includes('Quán') || b.textContent.includes('Hóa đơn')
    );
    if (configBtn) configBtn.click();
  });
  await sleep(600);
  transitionTimes['Settings -> StoreConfig'] = Math.round(performance.now() - configStart);
  const configMetrics = await page.metrics();
  viewMetrics['StoreConfig'] = {
    transitionMs: transitionTimes['Settings -> StoreConfig'],
    jsHeapUsedMB: Number((configMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(2))
  };
  console.log(`  ✔ Settings -> StoreConfig: ${viewMetrics['StoreConfig'].transitionMs}ms | Heap: ${viewMetrics['StoreConfig'].jsHeapUsedMB} MB`);

  // Final Summary Report
  const finalMetrics = await page.metrics();
  const report = {
    mode,
    timestamp: new Date().toISOString(),
    bundle,
    viewMetrics,
    transitionTimes,
    summary: {
      totalBundleKB: bundle.totalBundleKB,
      totalJsKB: bundle.totalJsKB,
      totalCssKB: bundle.totalCssKB,
      initialColdLoadMs: viewMetrics['Login'].loadDurationMs,
      fcpMs: viewMetrics['Login'].fcpMs,
      maxHeapMB: Number((finalMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)),
      avgRouteTransitionMs: Math.round(
        Object.values(transitionTimes).reduce((a, b) => a + b, 0) / Object.values(transitionTimes).length
      )
    }
  };

  const outPath = `scripts/${mode}_performance_report.json`;
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n============================================================`);
  console.log(`🎉 BENCHMARK COMPLETE! Results saved to ${outPath}`);
  console.log(`  - Initial Load: ${report.summary.initialColdLoadMs}ms`);
  console.log(`  - FCP         : ${report.summary.fcpMs}ms`);
  console.log(`  - Avg Nav RTT : ${report.summary.avgRouteTransitionMs}ms`);
  console.log(`  - Max JS Heap : ${report.summary.maxHeapMB} MB`);
  console.log(`  - Bundle Total: ${report.summary.totalBundleKB} KB`);
  console.log(`============================================================\n`);

  await browser.close();
  await chrome.kill();
  server.close();

  return report;
}

const modeArg = process.argv.includes('--optimized') ? 'optimized' : 'baseline';
runBenchmark(modeArg).catch((e) => {
  console.error('Fatal benchmark error:', e);
  process.exit(1);
});
