import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DIST_DIR = path.resolve('dist');
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer(port = 4180) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0].split('#')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(DIST_DIR, reqPath);
      const targetPath = (fs.existsSync(filePath) && fs.statSync(filePath).isFile())
        ? filePath
        : path.join(DIST_DIR, 'index.html');
      const ext = path.extname(targetPath);
      const isAsset = reqPath.startsWith('/assets/');
      const cacheControl = isAsset ? 'public, max-age=31536000, immutable' : 'no-cache';
      const acceptsGzip = (req.headers['accept-encoding'] || '').includes('gzip');
      const compressible = ['.html', '.js', '.css', '.json', '.svg'].includes(ext);

      if (acceptsGzip && compressible) {
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'text/plain',
          'Content-Encoding': 'gzip',
          'Cache-Control': cacheControl
        });
        fs.createReadStream(targetPath).pipe(zlib.createGzip()).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': cacheControl
        });
        fs.createReadStream(targetPath).pipe(res);
      }
    });

    server.listen(port, () => resolve(server));
    server.on('error', reject);
  });
}

async function auditSinglePage(url, chromePort, mode = 'mobile') {
  const isMobile = mode === 'mobile';
  const flags = {
    port: chromePort,
    output: 'json',
    logLevel: 'error',
    formFactor: isMobile ? 'mobile' : 'desktop',
    screenEmulation: isMobile
      ? { mobile: true, width: 390, height: 844, deviceScaleFactor: 3 }
      : { mobile: false, width: 1366, height: 768, deviceScaleFactor: 1 },
    throttlingMethod: 'simulate'
  };

  const res = await lighthouse(url, flags);
  const lhr = res.lhr;

  return {
    performance: Math.round((lhr.categories.performance?.score || 0) * 100),
    accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
    bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
    seo: Math.round((lhr.categories.seo?.score || 0) * 100),
    fcpMs: Math.round(lhr.audits['first-contentful-paint']?.numericValue || 0),
    lcpMs: Math.round(lhr.audits['largest-contentful-paint']?.numericValue || 0),
    cls: Number((lhr.audits['cumulative-layout-shift']?.numericValue || 0).toFixed(3)),
    tbtMs: Math.round(lhr.audits['total-blocking-time']?.numericValue || 0),
    speedIndex: Math.round(lhr.audits['speed-index']?.numericValue || 0)
  };
}

async function main() {
  const server = await startServer(4180);
  const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

  console.log('============================================================');
  console.log('🏁 GÓC POS — FULL-SYSTEM BASELINE LIGHTHOUSE & PERFORMANCE AUDIT');
  console.log('============================================================\n');

  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--window-size=1280,800'
    ]
  });

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${chrome.port}`
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });

  const baselineReport = {
    timestamp: new Date().toISOString(),
    mobile: {},
    desktop: {}
  };

  try {
    // 1. Audit Login View (Mobile & Desktop)
    console.log('[1/7] Auditing Login View...');
    baselineReport.mobile['Login'] = await auditSinglePage('http://127.0.0.1:4180/#/login', chrome.port, 'mobile');
    console.log(`  📱 Mobile Login: P=${baselineReport.mobile['Login'].performance} A=${baselineReport.mobile['Login'].accessibility} BP=${baselineReport.mobile['Login'].bestPractices} SEO=${baselineReport.mobile['Login'].seo} LCP=${baselineReport.mobile['Login'].lcpMs}ms TBT=${baselineReport.mobile['Login'].tbtMs}ms`);

    baselineReport.desktop['Login'] = await auditSinglePage('http://127.0.0.1:4180/#/login', chrome.port, 'desktop');
    console.log(`  💻 Desktop Login: P=${baselineReport.desktop['Login'].performance} A=${baselineReport.desktop['Login'].accessibility} BP=${baselineReport.desktop['Login'].bestPractices} SEO=${baselineReport.desktop['Login'].seo}`);

    // Log in as Admin for authenticated pages
    console.log('\nAuthenticating as Admin (admin01@gocpos.vn)...');
    await page.goto('http://127.0.0.1:4180/#/login');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Admin')), { timeout: 10000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Admin'));
      if (btn) btn.click();
    });
    await sleep(300);
    await page.evaluate(() => {
      const submit = document.querySelector('[data-testid="login-submit-button"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Vào ca') || b.textContent.includes('Đăng nhập'));
      if (submit) submit.click();
    });

    // Handle Login Success transition if shown
    await sleep(2500);
    await page.evaluate(() => {
      const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('BẮT ĐẦU'));
      if (startBtn) startBtn.click();
    });
    await sleep(1000);
    console.log('   Authenticated into Tables view!');

    // 2. Table Grid / Sơ đồ bàn
    console.log('\n[2/7] Auditing Table Grid (Sơ đồ bàn)...');
    baselineReport.mobile['Tables'] = await auditSinglePage('http://127.0.0.1:4180/#/tables', chrome.port, 'mobile');
    console.log(`  📱 Mobile Tables: P=${baselineReport.mobile['Tables'].performance} A=${baselineReport.mobile['Tables'].accessibility} BP=${baselineReport.mobile['Tables'].bestPractices} SEO=${baselineReport.mobile['Tables'].seo}`);
    baselineReport.desktop['Tables'] = await auditSinglePage('http://127.0.0.1:4180/#/tables', chrome.port, 'desktop');
    console.log(`  💻 Desktop Tables: P=${baselineReport.desktop['Tables'].performance} A=${baselineReport.desktop['Tables'].accessibility} BP=${baselineReport.desktop['Tables'].bestPractices} SEO=${baselineReport.desktop['Tables'].seo}`);

    // 3. Menu Management
    console.log('\n[3/7] Auditing Menu Management (Thực đơn)...');
    baselineReport.mobile['Menu'] = await auditSinglePage('http://127.0.0.1:4180/#/menu', chrome.port, 'mobile');
    console.log(`  📱 Mobile Menu: P=${baselineReport.mobile['Menu'].performance} A=${baselineReport.mobile['Menu'].accessibility} BP=${baselineReport.mobile['Menu'].bestPractices} SEO=${baselineReport.mobile['Menu'].seo}`);
    baselineReport.desktop['Menu'] = await auditSinglePage('http://127.0.0.1:4180/#/menu', chrome.port, 'desktop');
    console.log(`  💻 Desktop Menu: P=${baselineReport.desktop['Menu'].performance} A=${baselineReport.desktop['Menu'].accessibility} BP=${baselineReport.desktop['Menu'].bestPractices} SEO=${baselineReport.desktop['Menu'].seo}`);

    // 4. Order History
    console.log('\n[4/7] Auditing Order History (Đơn hàng)...');
    baselineReport.mobile['Orders'] = await auditSinglePage('http://127.0.0.1:4180/#/orders', chrome.port, 'mobile');
    console.log(`  📱 Mobile Orders: P=${baselineReport.mobile['Orders'].performance} A=${baselineReport.mobile['Orders'].accessibility} BP=${baselineReport.mobile['Orders'].bestPractices} SEO=${baselineReport.mobile['Orders'].seo}`);
    baselineReport.desktop['Orders'] = await auditSinglePage('http://127.0.0.1:4180/#/orders', chrome.port, 'desktop');
    console.log(`  💻 Desktop Orders: P=${baselineReport.desktop['Orders'].performance} A=${baselineReport.desktop['Orders'].accessibility} BP=${baselineReport.desktop['Orders'].bestPractices} SEO=${baselineReport.desktop['Orders'].seo}`);

    // 5. Dashboard / Reports
    console.log('\n[5/7] Auditing Dashboard / Reports (Báo cáo)...');
    baselineReport.mobile['Reports'] = await auditSinglePage('http://127.0.0.1:4180/#/reports', chrome.port, 'mobile');
    console.log(`  📱 Mobile Reports: P=${baselineReport.mobile['Reports'].performance} A=${baselineReport.mobile['Reports'].accessibility} BP=${baselineReport.mobile['Reports'].bestPractices} SEO=${baselineReport.mobile['Reports'].seo}`);
    baselineReport.desktop['Reports'] = await auditSinglePage('http://127.0.0.1:4180/#/reports', chrome.port, 'desktop');
    console.log(`  💻 Desktop Reports: P=${baselineReport.desktop['Reports'].performance} A=${baselineReport.desktop['Reports'].accessibility} BP=${baselineReport.desktop['Reports'].bestPractices} SEO=${baselineReport.desktop['Reports'].seo}`);

    // 6. Settings & Management
    console.log('\n[6/7] Auditing Settings (Cài đặt & Quản lý)...');
    baselineReport.mobile['Settings'] = await auditSinglePage('http://127.0.0.1:4180/#/settings', chrome.port, 'mobile');
    console.log(`  📱 Mobile Settings: P=${baselineReport.mobile['Settings'].performance} A=${baselineReport.mobile['Settings'].accessibility} BP=${baselineReport.mobile['Settings'].bestPractices} SEO=${baselineReport.mobile['Settings'].seo}`);
    baselineReport.desktop['Settings'] = await auditSinglePage('http://127.0.0.1:4180/#/settings', chrome.port, 'desktop');
    console.log(`  💻 Desktop Settings: P=${baselineReport.desktop['Settings'].performance} A=${baselineReport.desktop['Settings'].accessibility} BP=${baselineReport.desktop['Settings'].bestPractices} SEO=${baselineReport.desktop['Settings'].seo}`);

    // Save JSON
    const isOptimized = process.argv.includes('--optimized');
    const outPath = isOptimized
      ? 'scripts/lighthouse_comprehensive_optimized.json'
      : 'scripts/lighthouse_comprehensive_baseline.json';
    fs.writeFileSync(outPath, JSON.stringify(baselineReport, null, 2));
    console.log('\n============================================================');
    console.log(`✅ COMPREHENSIVE ${isOptimized ? 'OPTIMIZED' : 'BASELINE'} REPORT SAVED TO: ${outPath}`);
    console.log('============================================================\n');

    console.log('📊 MOBILE SUMMARY:');
    console.table(baselineReport.mobile);
    console.log('📊 DESKTOP SUMMARY:');
    console.table(baselineReport.desktop);

  } finally {
    await browser.close();
    await chrome.kill();
    server.close();
  }
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
