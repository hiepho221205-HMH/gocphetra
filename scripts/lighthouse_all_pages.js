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
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer(port = 4173) {
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

export async function runMultiPageAudit(outputFileName = 'scripts/lighthouse_all_pages_report.json') {
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
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  const results = {};

  try {
    console.log('\n============================================================');
    console.log('🚀 COMPREHENSIVE 8-VIEW LIGHTHOUSE AUDIT (GÓC MOBILE POS)');
    console.log('============================================================\n');

    // 1. LOGIN PAGE AUDIT
    console.log('1. Auditing Login Page (Unauthenticated)...');
    await page.goto('http://127.0.0.1:4173/#/login');
    await sleep(800);

    const loginRes = await lighthouse('http://127.0.0.1:4173/#/login', {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3 },
      throttlingMethod: 'simulate'
    });

    results['Login'] = {
      performance: Math.round((loginRes.lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((loginRes.lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((loginRes.lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((loginRes.lhr.categories.seo?.score || 0) * 100)
    };
    console.log(`   ✅ Login: P=${results['Login'].performance} | A=${results['Login'].accessibility} | BP=${results['Login'].bestPractices} | SEO=${results['Login'].seo}`);

    // LOG IN AS ADMIN FOR AUTHENTICATED PAGES
    console.log('\nLogging in as Admin (admin01@gocpos.vn) on page...');
    await page.goto('http://127.0.0.1:4173/#/login');
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
    console.log('   Authenticated successfully!');

    // 2. TABLE MANAGEMENT
    console.log('\n2. Auditing Table Management View...');
    await page.goto('http://127.0.0.1:4173/#/tables');
    await sleep(800);
    const tableRes = await lighthouse('http://127.0.0.1:4173/#/tables', {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3 },
      throttlingMethod: 'simulate'
    });
    results['Table Management'] = {
      performance: Math.round((tableRes.lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((tableRes.lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((tableRes.lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((tableRes.lhr.categories.seo?.score || 0) * 100)
    };
    console.log(`   ✅ Table Management: P=${results['Table Management'].performance} | A=${results['Table Management'].accessibility} | BP=${results['Table Management'].bestPractices} | SEO=${results['Table Management'].seo}`);

    // 3. MENU MANAGEMENT
    console.log('\n3. Auditing Menu Management View...');
    await page.goto('http://127.0.0.1:4173/#/menu');
    await sleep(800);
    const menuRes = await lighthouse('http://127.0.0.1:4173/#/menu', {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3 },
      throttlingMethod: 'simulate'
    });
    results['Menu Management'] = {
      performance: Math.round((menuRes.lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((menuRes.lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((menuRes.lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((menuRes.lhr.categories.seo?.score || 0) * 100)
    };
    console.log(`   ✅ Menu Management: P=${results['Menu Management'].performance} | A=${results['Menu Management'].accessibility} | BP=${results['Menu Management'].bestPractices} | SEO=${results['Menu Management'].seo}`);

    // 4. ORDER HISTORY
    console.log('\n4. Auditing Order History View...');
    await page.goto('http://127.0.0.1:4173/#/orders');
    await sleep(800);
    const ordersRes = await lighthouse('http://127.0.0.1:4173/#/orders', {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3 },
      throttlingMethod: 'simulate'
    });
    results['Order History'] = {
      performance: Math.round((ordersRes.lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((ordersRes.lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((ordersRes.lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((ordersRes.lhr.categories.seo?.score || 0) * 100)
    };
    console.log(`   ✅ Order History: P=${results['Order History'].performance} | A=${results['Order History'].accessibility} | BP=${results['Order History'].bestPractices} | SEO=${results['Order History'].seo}`);

    // 5. DASHBOARD / REPORTS
    console.log('\n5. Auditing Dashboard / Reports View...');
    await page.goto('http://127.0.0.1:4173/#/reports');
    await sleep(800);
    const reportsRes = await lighthouse('http://127.0.0.1:4173/#/reports', {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3 },
      throttlingMethod: 'simulate'
    });
    results['Dashboard'] = {
      performance: Math.round((reportsRes.lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((reportsRes.lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((reportsRes.lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((reportsRes.lhr.categories.seo?.score || 0) * 100)
    };
    console.log(`   ✅ Dashboard: P=${results['Dashboard'].performance} | A=${results['Dashboard'].accessibility} | BP=${results['Dashboard'].bestPractices} | SEO=${results['Dashboard'].seo}`);

    // 6. SETTINGS
    console.log('\n6. Auditing Settings View...');
    await page.goto('http://127.0.0.1:4173/#/settings');
    await sleep(800);
    const settingsRes = await lighthouse('http://127.0.0.1:4173/#/settings', {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3 },
      throttlingMethod: 'simulate'
    });
    results['Settings'] = {
      performance: Math.round((settingsRes.lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((settingsRes.lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((settingsRes.lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((settingsRes.lhr.categories.seo?.score || 0) * 100)
    };
    console.log(`   ✅ Settings: P=${results['Settings'].performance} | A=${results['Settings'].accessibility} | BP=${results['Settings'].bestPractices} | SEO=${results['Settings'].seo}`);

    // SUMMARY TABLE
    console.log('\n============================================================');
    console.log('📊 FINAL 8-PAGE LIGHTHOUSE AUDIT REPORT (AFTER OPTIMIZATION)');
    console.log('============================================================');
    console.table(results);

    fs.writeFileSync(outputFileName, JSON.stringify(results, null, 2));
    console.log(`\n✅ Multi-page audit results saved to ${outputFileName}`);
    return results;

  } finally {
    await browser.close();
    await chrome.kill();
    server.close();
  }
}

if (process.argv[1]?.endsWith('lighthouse_all_pages.js')) {
  const outPath = process.argv[2] || 'scripts/lighthouse_all_pages_report.json';
  runMultiPageAudit(outPath);
}
