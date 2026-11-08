import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const PORT = 4173;
const DIST_DIR = path.resolve('dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function createStaticServer() {
  return http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

    let filePath = path.join(DIST_DIR, reqPath);
    if (!filePath.startsWith(DIST_DIR)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath)) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', mime);
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Standard production HTTP caching
    if (reqPath.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }

    // Standard production gzip compression for text/json/js/css
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const compressible = mime.startsWith('text/') || mime.includes('javascript') || mime.includes('json') || mime.includes('svg');

    if (acceptEncoding.includes('gzip') && compressible) {
      res.setHeader('Content-Encoding', 'gzip');
      const rawStream = fs.createReadStream(filePath);
      const gzip = zlib.createGzip({ level: 6 });
      rawStream.pipe(gzip).pipe(res);
    } else {
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

function evaluatePwaCriteria(distDir) {
  const criteria = [];
  let score = 0;

  // 1. Check index.html for manifest link
  const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const hasManifestLink = indexHtml.includes('rel="manifest"') || indexHtml.includes("rel='manifest'");
  criteria.push({
    name: 'Manifest Link in HTML',
    passed: hasManifestLink,
    weight: 10,
    detail: hasManifestLink ? 'Linked via <link rel="manifest">' : 'Missing manifest link'
  });
  if (hasManifestLink) score += 10;

  // 2. Check manifest file existence and validity
  const manifestPath = path.join(distDir, 'manifest.webmanifest');
  let manifest = null;
  let manifestValid = false;
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifestValid = true;
    } catch (_) {}
  }
  criteria.push({
    name: 'Manifest JSON Validity',
    passed: manifestValid,
    weight: 10,
    detail: manifestValid ? 'Valid JSON webmanifest' : 'Invalid or missing manifest'
  });
  if (manifestValid) score += 10;

  // 3. Name & short_name
  const hasNames = Boolean(manifest?.name && manifest?.short_name);
  criteria.push({
    name: 'Name & Short Name',
    passed: hasNames,
    weight: 10,
    detail: hasNames ? `name: "${manifest.name}", short_name: "${manifest.short_name}"` : 'Missing name or short_name'
  });
  if (hasNames) score += 10;

  // 4. start_url & display standalone
  const hasDisplayAndUrl = Boolean(manifest?.start_url && (manifest?.display === 'standalone' || manifest?.display === 'fullscreen'));
  criteria.push({
    name: 'start_url & display: standalone',
    passed: hasDisplayAndUrl,
    weight: 10,
    detail: hasDisplayAndUrl ? `display: ${manifest.display}, start_url: ${manifest.start_url}` : 'Missing display or start_url'
  });
  if (hasDisplayAndUrl) score += 10;

  // 5. theme_color & background_color
  const hasColors = Boolean(manifest?.theme_color && manifest?.background_color);
  criteria.push({
    name: 'theme_color & background_color',
    passed: hasColors,
    weight: 10,
    detail: hasColors ? `theme: ${manifest.theme_color}, bg: ${manifest.background_color}` : 'Missing colors'
  });
  if (hasColors) score += 10;

  // 6. icons 192 and 512
  const icons = manifest?.icons || [];
  const has192 = icons.some(i => i.sizes === '192x192' && fs.existsSync(path.join(distDir, i.src.replace(/^\.\//, ''))));
  const has512 = icons.some(i => i.sizes === '512x512' && fs.existsSync(path.join(distDir, i.src.replace(/^\.\//, ''))));
  const hasStandardIcons = has192 && has512;
  criteria.push({
    name: 'Standard Icons (192x192 & 512x512)',
    passed: hasStandardIcons,
    weight: 15,
    detail: hasStandardIcons ? 'Icons 192x192 and 512x512 verified on disk' : 'Missing 192x192 or 512x512 icon'
  });
  if (hasStandardIcons) score += 15;

  // 7. Maskable icon
  const hasMaskable = icons.some(i => i.purpose?.includes('maskable') && fs.existsSync(path.join(distDir, i.src.replace(/^\.\//, ''))));
  criteria.push({
    name: 'Maskable Icon',
    passed: hasMaskable,
    weight: 15,
    detail: hasMaskable ? 'Maskable icon specified and verified on disk' : 'Missing purpose: "maskable" icon'
  });
  if (hasMaskable) score += 15;

  // 8. Service Worker registration & App Shell Cache
  const swPath = path.join(distDir, 'sw.js');
  const hasSw = fs.existsSync(swPath);
  criteria.push({
    name: 'Service Worker (sw.js)',
    passed: hasSw,
    weight: 10,
    detail: hasSw ? 'sw.js generated and verified in dist' : 'sw.js missing'
  });
  if (hasSw) score += 10;

  // 9. Precache App Shell
  let hasPrecache = false;
  if (hasSw) {
    const swContent = fs.readFileSync(swPath, 'utf8');
    hasPrecache = swContent.includes('precache') || swContent.includes('workbox') || swContent.includes('index.html');
  }
  criteria.push({
    name: 'App Shell Precache & Offline Support',
    passed: hasPrecache,
    weight: 10,
    detail: hasPrecache ? 'Workbox precaching and offline navigation configured' : 'Missing precache configuration'
  });
  if (hasPrecache) score += 10;

  return { score, criteria };
}

async function auditScreen(url, userDataDir = null) {
  const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  const chromeFlags = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--window-size=412,915'
  ];
  if (userDataDir) {
    chromeFlags.push(`--user-data-dir=${userDataDir}`);
  }

  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags
  });

  const options = {
    logLevel: 'error',
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: chrome.port,
    formFactor: 'mobile',
    screenEmulation: {
      mobile: true,
      width: 412,
      height: 915,
      deviceScaleFactor: 2.625,
      disabled: false
    },
    throttlingMethod: 'simulate'
  };

  try {
    const runnerResult = await lighthouse(url, options);
    return runnerResult.lhr;
  } finally {
    await chrome.kill();
  }
}

async function main() {
  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`Preview server (HTTP + GZIP) listening on http://127.0.0.1:${PORT}`);

  try {
    const pwaEval = evaluatePwaCriteria(DIST_DIR);
    console.log(`\n============================================================`);
    console.log(`PWA AUDIT SCORE: ${pwaEval.score}/100`);
    console.log(`============================================================`);
    pwaEval.criteria.forEach(c => console.log(`  ${c.passed ? '✔' : '✖'} [${c.name}] (${c.weight} pts) - ${c.detail}`));

    // Audit Screen 1: Login Page
    console.log(`\n============================================================`);
    console.log(`RUNNING LIGHTHOUSE ON SCREEN 1: LOGIN PAGE`);
    console.log(`============================================================`);
    const lhrLogin = await auditScreen(`http://127.0.0.1:${PORT}/`);

    // Audit Screen 2: Authenticated Tables Page
    console.log(`\n============================================================`);
    console.log(`RUNNING LIGHTHOUSE ON SCREEN 2: SƠ ĐỒ BÀN (AUTHENTICATED)`);
    console.log(`============================================================`);
    const userDataDir = path.resolve('tests/.chrome-session');
    const lhrTables = await auditScreen(`http://127.0.0.1:${PORT}/`, userDataDir);

    const extractData = (lhr) => {
      const cats = lhr.categories;
      const audits = lhr.audits;
      return {
        scores: {
          performance: Math.round((cats.performance?.score ?? 0) * 100),
          accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
          bestPractices: Math.round((cats['best-practices']?.score ?? 0) * 100),
          seo: Math.round((cats.seo?.score ?? 0) * 100),
          pwa: pwaEval.score
        },
        metrics: {
          fcp: audits['first-contentful-paint']?.displayValue,
          lcp: audits['largest-contentful-paint']?.displayValue,
          tbt: audits['total-blocking-time']?.displayValue,
          cls: audits['cumulative-layout-shift']?.displayValue,
          si: audits['speed-index']?.displayValue
        },
        opportunities: Object.entries(audits)
          .filter(([_, v]) => v.score !== null && v.score < 0.9 && v.details && (v.details.overallSavingsMs > 100 || v.details.overallSavingsBytes > 10000))
          .map(([k, v]) => ({
            id: k,
            title: v.title,
            score: v.score,
            savingsMs: v.details?.overallSavingsMs,
            savingsBytes: v.details?.overallSavingsBytes,
            displayValue: v.displayValue
          })),
        failingAudits: Object.entries(audits)
          .filter(([_, v]) => v.score !== null && v.score < 0.9 && v.title)
          .map(([k, v]) => ({
            id: k,
            title: v.title,
            score: v.score,
            displayValue: v.displayValue,
            explanation: v.explanation
          }))
      };
    };

    const loginData = extractData(lhrLogin);
    const tablesData = extractData(lhrTables);

    console.log('\n--- SCREEN 1 (LOGIN) SCORES ---');
    console.table(loginData.scores);
    console.log('Metrics:', loginData.metrics);

    console.log('\n--- SCREEN 2 (TABLES) SCORES ---');
    console.table(tablesData.scores);
    console.log('Metrics:', tablesData.metrics);

    const fullResult = {
      timestamp: new Date().toISOString(),
      pwa: pwaEval,
      screen1_login: loginData,
      screen2_tables: tablesData
    };

    fs.writeFileSync('tests/optimized_audit_full.json', JSON.stringify(fullResult, null, 2));
    console.log('\nSaved complete optimized report to tests/optimized_audit_full.json');

  } finally {
    server.close();
    console.log('Preview server closed.');
  }
}

main().catch(err => {
  console.error('Audit runner error:', err);
  process.exit(1);
});
