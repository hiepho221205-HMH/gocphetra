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
  '.ico': 'image/x-icon'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer(port = 4178) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0].split('#')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(DIST_DIR, reqPath);
      const targetPath = (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) ? filePath : path.join(DIST_DIR, 'index.html');
      const ext = path.extname(targetPath);

      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(targetPath).pipe(res);
    });

    server.listen(port, () => {
      console.log(`[Server] Static server running at http://127.0.0.1:${port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

async function runBenchmark() {
  const server = await startServer(4178);
  const chrome = await chromeLauncher.launch({
    chromePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=1280,800'
    ]
  });

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${chrome.port}`,
    defaultViewport: { width: 1280, height: 800 }
  });

  const results = {
    timestamp: new Date().toISOString(),
    coldStartLoggedOut: {},
    sessionRestoreLoggedIn: {},
    networkSummary: {}
  };

  try {
    const page = await browser.newPage();

    // 1. MEASURE COLD START (Logged Out / First Load)
    console.log('\n--- 1. Testing Cold Start (Logged Out) ---');
    const requests = [];
    page.on('request', (req) => {
      requests.push({
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType()
      });
    });

    const startCold = Date.now();
    await page.goto('http://127.0.0.1:4178', { waitUntil: 'domcontentloaded' });
    const domLoadedCold = Date.now() - startCold;

    // Wait until login screen or auth spinner settles
    await page.waitForSelector('input[type="email"], [data-testid="login-button"]', { timeout: 10000 });
    const coldInteractive = Date.now() - startCold;

    console.log(`Cold DOM Content Loaded: ${domLoadedCold} ms`);
    console.log(`Cold Interactive (Login Form Ready): ${coldInteractive} ms`);

    const supabaseCallsCold = requests.filter(r => r.url.includes('supabase.co')).length;
    console.log(`Cold Supabase network requests: ${supabaseCallsCold}`);

    results.coldStartLoggedOut = {
      domContentLoadedMs: domLoadedCold,
      interactiveMs: coldInteractive,
      supabaseRequests: supabaseCallsCold,
      totalRequests: requests.length
    };

    // 2. LOG IN AND MEASURE LOGIN TO TABLES TRANSITION
    console.log('\n--- 2. Performing Login as Admin ---');
    await page.type('input[type="email"]', 'admin01@gocpos.vn');
    await page.type('input[type="password"]', '123456');

    const startLogin = Date.now();
    await page.click('button[type="submit"]');

    // Wait for welcome screen or tables view
    try {
      await page.waitForFunction(() => {
        return document.body.innerText.includes('Bàn') || document.body.innerText.includes('TIẾP TỤC') || document.body.innerText.includes('Sơ đồ bàn');
      }, { timeout: 15000 });
    } catch (_) {}

    // If welcome screen shown, click continue
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const contBtn = buttons.find(b => b.textContent.includes('TIẾP TỤC') || b.textContent.includes('Vào hệ thống'));
      if (contBtn) contBtn.click();
    });

    await page.waitForFunction(() => {
      return document.body.innerText.includes('Bàn') || document.body.innerText.includes('Sơ đồ bàn');
    }, { timeout: 15000 });
    const loginToTablesMs = Date.now() - startLogin;
    console.log(`Login to Tables view: ${loginToTablesMs} ms`);

    // Let any background cloud sync complete
    await sleep(2000);

    // 3. MEASURE SESSION RESTORE (Reload with stored token)
    console.log('\n--- 3. Testing Session Restore (Page Reload with Auth Token) ---');
    const restoreRequests = [];
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');

    let supabaseRequestsRestore = 0;
    const requestUrls = [];
    const allDetailedRequests = [];

    page.on('request', (req) => {
      if (req.url().includes('supabase.co')) {
        supabaseRequestsRestore++;
        requestUrls.push(`${req.method()} ${req.url().split('?')[0]}`);
        allDetailedRequests.push(`${req.method()} ${req.url()}`);
      }
    });

    const startReload = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    const reloadDomLoaded = Date.now() - startReload;

    // Wait until tables view is visible
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Bàn') || document.body.innerText.includes('Sơ đồ bàn');
    }, { timeout: 10000 });
    const sessionRestoreInteractive = Date.now() - startReload;

    console.log(`Session Restore DOM Content Loaded: ${reloadDomLoaded} ms`);
    console.log(`Session Restore Tables View Ready: ${sessionRestoreInteractive} ms`);

    // Wait for background sync to settle
    await sleep(2500);

    console.log(`Session Restore Supabase queries count: ${supabaseRequestsRestore}`);
    console.log('All queries during restore:');
    allDetailedRequests.forEach((u, idx) => console.log(`  [${idx + 1}] ${u}`));

    results.sessionRestoreLoggedIn = {
      domContentLoadedMs: reloadDomLoaded,
      tablesReadyMs: sessionRestoreInteractive,
      supabaseRequests: supabaseRequestsRestore,
      uniqueQueries: [...new Set(requestUrls)]
    };

    console.log('\n--- 4. Tab Navigation Responsiveness ---');
    // Tab switching test
    const tabClickStart = Date.now();
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const menuTab = tabs.find(b => b.textContent.includes('Thực đơn') || b.textContent.includes('Menu'));
      if (menuTab) menuTab.click();
    });
    await sleep(200);
    const tabSwitchMs = Date.now() - tabClickStart;
    console.log(`Tab switch latency: ${tabSwitchMs} ms`);

    results.tabSwitchMs = tabSwitchMs;

    fs.writeFileSync('scripts/startup_benchmark_results.json', JSON.stringify(results, null, 2));
    console.log('\nResults saved to scripts/startup_benchmark_results.json');

  } catch (err) {
    console.error('Benchmark error:', err);
  } finally {
    await browser.close();
    chrome.kill();
    server.close();
  }
}

runBenchmark();
