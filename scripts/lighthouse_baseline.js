import zlib from 'zlib';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import http from 'http';
import fs from 'fs';
import path from 'path';

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

function startServer(port = 4173) {
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
        // SPA navigation fallback ONLY for extensionless routes
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
      console.log(`[Static Server] running on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

async function runLighthouseAudit() {
  const server = await startServer(4173);
  
  // Launch Chrome with chrome-launcher
  const chromePath = fs.existsSync('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    : undefined;

  const chrome = await chromeLauncher.launch({
    chromePath: chromePath,
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
  });

  try {
    console.log(`[Lighthouse] Connected to Chrome on port ${chrome.port}. Running mobile audit...`);
    
    // Mobile audit (default for POS)
    const runnerResultMobile = await lighthouse('http://127.0.0.1:4173', {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      formFactor: 'mobile',
      screenEmulation: {
        mobile: true,
        width: 390,
        height: 844,
        deviceScaleFactor: 3
      },
      throttlingMethod: 'simulate'
    });

    const scoresMobile = {
      performance: Math.round((runnerResultMobile.lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((runnerResultMobile.lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((runnerResultMobile.lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((runnerResultMobile.lhr.categories.seo?.score || 0) * 100)
    };

    console.log('\n============================================================');
    console.log('📊 LIGHTHOUSE BEFORE (BASELINE) - MOBILE');
    console.log('============================================================');
    console.log(`Performance   : ${scoresMobile.performance}/100`);
    console.log(`Accessibility : ${scoresMobile.accessibility}/100`);
    console.log(`Best Practices: ${scoresMobile.bestPractices}/100`);
    console.log(`SEO           : ${scoresMobile.seo}/100`);
    console.log('------------------------------------------------------------');

    console.log('[Lighthouse] Running desktop audit...');
    // Desktop audit
    const runnerResultDesktop = await lighthouse('http://127.0.0.1:4173', {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      formFactor: 'desktop',
      screenEmulation: {
        mobile: false,
        width: 1350,
        height: 940,
        deviceScaleFactor: 1
      },
      throttling: {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1,
        requestLatencyMs: 0,
        downloadThroughputKbps: 0,
        uploadThroughputKbps: 0
      },
      throttlingMethod: 'simulate'
    });

    const scoresDesktop = {
      performance: Math.round((runnerResultDesktop.lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((runnerResultDesktop.lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((runnerResultDesktop.lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((runnerResultDesktop.lhr.categories.seo?.score || 0) * 100)
    };

    console.log('\n============================================================');
    console.log('📊 LIGHTHOUSE BEFORE (BASELINE) - DESKTOP');
    console.log('============================================================');
    console.log(`Performance   : ${scoresDesktop.performance}/100`);
    console.log(`Accessibility : ${scoresDesktop.accessibility}/100`);
    console.log(`Best Practices: ${scoresDesktop.bestPractices}/100`);
    console.log(`SEO           : ${scoresDesktop.seo}/100`);
    console.log('------------------------------------------------------------');

    // Extract failed or imperfect audits from mobile
    const audits = runnerResultMobile.lhr.audits;
    const issues = Object.keys(audits)
      .filter(k => audits[k].score !== null && audits[k].score < 1)
      .map(k => ({
        id: k,
        title: audits[k].title,
        score: audits[k].score,
        displayValue: audits[k].displayValue || '',
        description: audits[k].description?.slice(0, 160)
      }));

    console.log('\n⚠️ KEY AUDIT ISSUES TO ADDRESS (Mobile):');
    issues.forEach(iss => {
      console.log(`- [${iss.title}] (score: ${iss.score}) ${iss.displayValue ? '(' + iss.displayValue + ')' : ''}`);
      if (['render-blocking-insight', 'render-blocking-resources', 'image-delivery-insight'].includes(iss.id)) {
        console.log('   Details:', audits[iss.id]?.details?.items);
      }
    });

    // Save report
    const baseline = {
      timestamp: new Date().toISOString(),
      mobile: scoresMobile,
      desktop: scoresDesktop,
      failedAuditsMobile: issues
    };

    fs.writeFileSync('scripts/lighthouse_baseline.json', JSON.stringify(baseline, null, 2));
    console.log('\n✅ Baseline report saved to scripts/lighthouse_baseline.json');

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await chrome.kill();
    server.close();
  }
}

runLighthouseAudit();
