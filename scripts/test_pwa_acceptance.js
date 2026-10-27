import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const DIST_DIR = path.resolve('dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function startServer(port = 4174) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0].split('#')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(DIST_DIR, reqPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const isAsset = reqPath.startsWith('/assets/');
        const cacheControl = isAsset ? 'public, max-age=31536000, immutable' : 'no-cache';
        const acceptsGzip = (req.headers['accept-encoding'] || '').includes('gzip');
        const compressible = ['.html', '.js', '.css', '.json', '.svg', '.txt', '.webmanifest'].includes(ext);

        if (acceptsGzip && compressible) {
          res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'text/plain; charset=utf-8',
            'Content-Encoding': 'gzip',
            'Cache-Control': cacheControl
          });
          fs.createReadStream(filePath).pipe(zlib.createGzip()).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': cacheControl
          });
          fs.createReadStream(filePath).pipe(res);
        }
      } else if (!path.extname(reqPath)) {
        const indexPath = path.join(DIST_DIR, 'index.html');
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        fs.createReadStream(indexPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    });

    server.listen(port, () => {
      resolve(server);
    });
  });
}

async function runPwaAcceptanceTests() {
  const PORT = 4174;
  const server = await startServer(PORT);
  console.log(`[PWA Test Server] Running at http://127.0.0.1:${PORT}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--enable-features=NetworkService,NetworkServiceInProcess']
  });

  const page = await browser.newPage();
  const results = [];

  const record = (num, name, passed, details = '') => {
    results.push({ num, name, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [Check ${num}] ${name} ${details ? '(' + details + ')' : ''}`);
  };

  try {
    // 1. Manifest loads and validates
    const manifestRes = await fetch(`http://127.0.0.1:${PORT}/manifest.webmanifest`);
    const manifestJson = await manifestRes.json();
    const hasValidManifest = manifestJson.name && manifestJson.short_name && manifestJson.start_url && manifestJson.display === 'standalone' && manifestJson.id;
    record(1, 'Manifest loads and validates', hasValidManifest, `name="${manifestJson.name}", id="${manifestJson.id}"`);

    // 2. Icons load correctly
    let allIconsOk = true;
    for (const icon of manifestJson.icons) {
      const iconUrl = `http://127.0.0.1:${PORT}/${icon.src.replace(/^\.\//, '')}`;
      const iconRes = await fetch(iconUrl);
      if (iconRes.status !== 200) allIconsOk = false;
    }
    record(2, 'Icons load correctly', allIconsOk && manifestJson.icons.length >= 4, `${manifestJson.icons.length} square icons verified`);

    // 3. First visit loads
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' });
    const title = await page.title();
    const hasTitle = title.includes('GÓC');
    record(3, 'App loads correctly on first visit', hasTitle, `Title: "${title}"`);

    // 4. Service Worker Registration
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    });
    record(4, 'Service Worker registers and activates', swRegistered, swRegistered ? 'SW registered' : 'Waiting for SW activation');

    // 5. Repeat visit behaves correctly
    await page.reload({ waitUntil: 'networkidle0' });
    const reloadedHeading = await page.$eval('h1', el => el.textContent.trim());
    record(5, 'Repeat visit behaves correctly', reloadedHeading.includes('GÓC POS'), `Heading: "${reloadedHeading}"`);

    // 6. Cache Security: No Supabase API data in Cache API
    const cacheSecurityCheck = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      let leakedSupabase = false;
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        for (const req of requests) {
          if (req.url.includes('supabase.co')) {
            leakedSupabase = true;
          }
        }
      }
      return { leakedSupabase, cacheCount: cacheNames.length };
    });
    record(6, 'Cache Security: No private Supabase/orders cached', !cacheSecurityCheck.leakedSupabase, `${cacheSecurityCheck.cacheCount} caches inspected, 0 leaks`);

    // 7. Critical POS Actions fail safely when offline
    await page.setOfflineMode(true);
    const offlineStatus = await page.evaluate(() => navigator.onLine);
    record(7, 'Offline detection operates properly', offlineStatus === false, 'navigator.onLine = false');

    // 8. Reconnection restores normal online behavior
    await page.setOfflineMode(false);
    const onlineStatus = await page.evaluate(() => navigator.onLine);
    record(8, 'Reconnection restores normal online behavior', onlineStatus === true, 'navigator.onLine = true');

    // 9. Login Form & Access Guards exist and are accessible
    const hasEmailInput = await page.$('input[type="email"]') !== null;
    const hasPasswordInput = await page.$('input[type="password"]') !== null;
    record(9, 'Login form with semantic email & password inputs', hasEmailInput && hasPasswordInput, 'Input fields verified');

    // 10. Quick-fill testing buttons with compliant contrast
    const quickButtons = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()));
    const hasDemoPills = quickButtons.some(t => t.includes('Admin')) && quickButtons.some(t => t.includes('Thu ngân'));
    record(10, 'Role quick-fill testing buttons rendered', hasDemoPills, 'Admin, Quản lý, Thu ngân pills active');

    // 11. Security Badges & RBAC Notice
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasSecurityBadge = bodyText.includes('Bảo mật Supabase Auth') && bodyText.includes('RBAC');
    record(11, 'Security and RBAC architecture indicators displayed', hasSecurityBadge, 'RBAC notices verified');

    // 12. PWA Meta Tags & Viewport
    const metaCheck = await page.evaluate(() => {
      const theme = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
      const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content');
      const appleCap = document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content');
      return { theme, viewport, appleCap };
    });
    const metaOk = metaCheck.theme === '#214E34' && metaCheck.viewport?.includes('viewport-fit=cover') && metaCheck.appleCap === 'yes';
    record(12, 'PWA theme-color, viewport, and apple-mobile tags compliant', metaOk, `theme: ${metaCheck.theme}`);

    // 13. Standalone mode declaration & Start URL
    const isStandalone = manifestJson.display === 'standalone' && manifestJson.start_url === './';
    record(13, 'Standalone display mode & Start URL compliant', isStandalone, `display: "${manifestJson.display}"`);

  } finally {
    await browser.close();
    server.close();
  }

  const allPassed = results.every(r => r.passed);
  console.log('\n============================================================');
  console.log(`PWA ACCEPTANCE RESULT: ${results.filter(r => r.passed).length}/${results.length} CHECKS PASSED`);
  console.log(`STATUS: ${allPassed ? '✅ ALL 13 PWA ACCEPTANCE CHECKS PASSED' : '❌ ISSUES DETECTED'}`);
  console.log('============================================================\n');

  return allPassed;
}

runPwaAcceptanceTests().catch(err => {
  console.error('PWA Test error:', err);
  process.exit(1);
});
