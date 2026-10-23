import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DIST_DIR = path.resolve('dist');
const MIME_TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer(port = 4176) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0].split('#')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(DIST_DIR, reqPath);
      const targetPath = (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) ? filePath : path.join(DIST_DIR, 'index.html');
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
  });
}

async function runOrderAndCheckoutAudit() {
  const server = await startServer(4176);
  const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
  });

  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });

  const results = {};

  try {
    // 1. Login
    console.log('Logging in as Admin on port 4176...');
    await page.goto('http://127.0.0.1:4176/#/login');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Admin')), { timeout: 10000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Admin'));
      if (btn) btn.click();
    });
    await sleep(300);
    await page.evaluate(() => {
      const submit = document.querySelector('[data-testid="login-submit-button"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Vào ca'));
      if (submit) submit.click();
    });
    await page.waitForFunction(() => document.body.textContent.includes('Trần Mai') || document.body.textContent.includes('Khu vực bàn'), { timeout: 15000 });
    console.log('   Authenticated!');

    // 2. Click Table 1 to enter Order View
    console.log('\nNavigating into Order View (Table 1)...');
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid^="table-card-"]')) || [];
      if (cards.length > 0) {
        cards[0].click();
      } else {
        // Fallback: click first button or card containing Bàn
        const tableBtn = Array.from(document.querySelectorAll('button, div')).find(el => el.textContent.includes('Bàn 01') || el.textContent.includes('Bàn 1'));
        if (tableBtn) tableBtn.click();
      }
    });
    await sleep(1500);

    // Audit Order View
    console.log('Auditing Order View...');
    const orderRes = await lighthouse('http://127.0.0.1:4176/#/tables', {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3 },
      throttlingMethod: 'simulate'
    });

    results['Order View'] = {
      performance: Math.round((orderRes.lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((orderRes.lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((orderRes.lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((orderRes.lhr.categories.seo?.score || 0) * 100)
    };
    console.log(`   ✅ Order View: P=${results['Order View'].performance} | A=${results['Order View'].accessibility} | BP=${results['Order View'].bestPractices} | SEO=${results['Order View'].seo}`);

    // 3. Open Bill Checkout Modal
    console.log('\nOpening Bill Checkout Modal...');
    await page.evaluate(() => {
      const checkoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Hóa đơn') || b.textContent.includes('Thanh toán') || b.textContent.includes('Tính tiền'));
      if (checkoutBtn) checkoutBtn.click();
    });
    await sleep(1500);

    // Audit Checkout / Payment View
    console.log('Auditing Payment / Bill Checkout View...');
    const checkoutRes = await lighthouse('http://127.0.0.1:4176/#/tables', {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3 },
      throttlingMethod: 'simulate'
    });

    results['Payment / Checkout'] = {
      performance: Math.round((checkoutRes.lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((checkoutRes.lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((checkoutRes.lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((checkoutRes.lhr.categories.seo?.score || 0) * 100)
    };
    console.log(`   ✅ Payment / Checkout: P=${results['Payment / Checkout'].performance} | A=${results['Payment / Checkout'].accessibility} | BP=${results['Payment / Checkout'].bestPractices} | SEO=${results['Payment / Checkout'].seo}`);

    fs.writeFileSync('scripts/lighthouse_order_checkout_report.json', JSON.stringify(results, null, 2));

  } finally {
    await browser.close();
    await chrome.kill();
    server.close();
  }
}

runOrderAndCheckoutAudit();
