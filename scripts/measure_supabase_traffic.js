import * as chromeLauncher from 'chrome-launcher';
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

function startServer(port = 4175) {
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
      console.log(`[Server] Static preview server running at http://localhost:${port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

async function runTrafficMeasurement(durationSeconds = 60, options = {}) {
  const isQuick = process.argv.includes('--quick');
  const actualDuration = isQuick ? 15 : (options.durationSeconds || durationSeconds);
  const server = await startServer(4175);

  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=1280,800'
    ]
  });

  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${chrome.port}`
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Traffic Tracker
  const trafficLog = [];
  const endpointCounts = {};
  const methodCounts = {};
  const statusCounts = {};

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('supabase.co')) {
      const parsed = new URL(url);
      const endpoint = parsed.pathname;
      const method = req.method();
      endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + 1;
      methodCounts[method] = (methodCounts[method] || 0) + 1;
      trafficLog.push({
        time: Date.now(),
        url,
        endpoint,
        method,
        resourceType: req.resourceType(),
        postData: req.postData() ? req.postData().slice(0, 100) : null
      });
    }
  });

  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('supabase.co')) {
      const status = res.status();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
  });

  console.log(`\n============================================================`);
  console.log(`  GÓC Coffee POS — Supabase Traffic Measurement`);
  console.log(`============================================================\n`);

  // Phase 1: App Initial Load
  console.log(`[Phase 1] Navigating to http://localhost:4175 ...`);
  const initialLoadStart = Date.now();
  await page.goto('http://localhost:4175', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);
  const initialLoadCount = trafficLog.length;
  console.log(`✔ App loaded. Supabase requests during initial load: ${initialLoadCount}`);

  // Phase 2: Per-Page Navigation Traffic
  console.log(`\n[Phase 2] Measuring traffic across POS navigation tabs...`);
  const pageNavTraffic = {};

  const tabs = [
    { name: 'Table Management (tables)', selector: '[data-tab="tables"]' },
    { name: 'Menu Management (menu)', selector: '[data-tab="menu"]' },
    { name: 'Order History (history)', selector: '[data-tab="history"]' },
    { name: 'Reports / Dashboard (reports)', selector: '[data-tab="reports"]' },
    { name: 'Settings (settings)', selector: '[data-tab="settings"]' },
    { name: 'Return to Table Management', selector: '[data-tab="tables"]' }
  ];

  for (const tab of tabs) {
    const countBefore = trafficLog.length;
    try {
      const btn = await page.$(tab.selector);
      if (btn) {
        await btn.click();
        await sleep(1500);
      } else {
        // Fallback by evaluating setActiveTab or clicking by text
        await page.evaluate((tabName) => {
          const btns = Array.from(document.querySelectorAll('button'));
          const match = btns.find(b => b.textContent?.includes(tabName));
          if (match) match.click();
        }, tab.name.split(' ')[0]);
        await sleep(1500);
      }
    } catch (e) {
      console.warn(`Tab click error for ${tab.name}:`, e.message);
    }
    const countAfter = trafficLog.length;
    const tabDelta = countAfter - countBefore;
    pageNavTraffic[tab.name] = tabDelta;
    console.log(`  - ${tab.name}: ${tabDelta} requests`);
  }

  // Phase 3: Focus Shift Simulation (5 window focus events)
  console.log(`\n[Phase 3] Simulating 5 window focus shifts...`);
  const focusCountBefore = trafficLog.length;
  for (let i = 1; i <= 5; i++) {
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await sleep(600);
  }
  const focusCountAfter = trafficLog.length;
  const focusDelta = focusCountAfter - focusCountBefore;
  console.log(`✔ 5 focus events triggered: ${focusDelta} Supabase requests (${(focusDelta / 5).toFixed(1)} reqs/focus)!`);

  // Phase 4: Idle Session Measurement
  console.log(`\n[Phase 4] Measuring traffic during idle session (${actualDuration}s with 0 user interaction)...`);
  const idleCountBefore = trafficLog.length;
  const intervalSeconds = 10;
  const steps = Math.ceil(actualDuration / intervalSeconds);

  for (let s = 1; s <= steps; s++) {
    await sleep(intervalSeconds * 1000);
    const currentIdleRequests = trafficLog.length - idleCountBefore;
    console.log(`  [Idle ${s * intervalSeconds}s / ${actualDuration}s] Total idle requests so far: ${currentIdleRequests}`);
  }
  const idleCountAfter = trafficLog.length;
  const totalIdleRequests = idleCountAfter - idleCountBefore;
  console.log(`✔ Idle session complete. Total requests during idle: ${totalIdleRequests}`);

  // Summary Report
  const totalRequests = trafficLog.length;
  console.log(`\n============================================================`);
  console.log(`  SUPABASE TRAFFIC AUDIT SUMMARY`);
  console.log(`============================================================`);
  console.log(`Total Supabase Requests Tracked : ${totalRequests}`);
  console.log(`- Initial App Load Requests     : ${initialLoadCount}`);
  console.log(`- Page Navigation Requests      : ${Object.values(pageNavTraffic).reduce((a, b) => a + b, 0)}`);
  console.log(`- 5 Focus Events Requests       : ${focusDelta}`);
  console.log(`- Idle Session Requests (${actualDuration}s) : ${totalIdleRequests}`);

  console.log(`\nRequests by Endpoint:`);
  for (const [ep, count] of Object.entries(endpointCounts)) {
    console.log(`  ${ep.padEnd(35)} : ${count}`);
  }

  console.log(`\nRequests by Method:`);
  for (const [m, count] of Object.entries(methodCounts)) {
    console.log(`  ${m.padEnd(10)} : ${count}`);
  }

  console.log(`\nResponses by HTTP Status:`);
  for (const [st, count] of Object.entries(statusCounts)) {
    console.log(`  HTTP ${st.padEnd(6)} : ${count}`);
  }

  const results = {
    totalRequests,
    initialLoadCount,
    pageNavTraffic,
    focusDelta,
    focusEventsTested: 5,
    requestsPerFocus: focusDelta / 5,
    totalIdleRequests,
    idleDurationSeconds: actualDuration,
    endpointCounts,
    methodCounts,
    statusCounts,
    trafficLog,
    timestamp: new Date().toISOString()
  };

  const isOptimized = process.argv.includes('--optimized');
  const defaultOutput = isOptimized ? 'scripts/supabase_traffic_optimized.json' : 'scripts/supabase_traffic_baseline.json';
  const outputPath = options.outputPath || defaultOutput;
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${outputPath}`);

  await browser.close();
  await chrome.kill();
  server.close();

  return results;
}

const duration = process.argv.includes('--full') ? 300 : (process.argv.includes('--quick') ? 15 : 60);
runTrafficMeasurement(duration).catch((err) => {
  console.error('Fatal measurement error:', err);
  process.exit(1);
});
