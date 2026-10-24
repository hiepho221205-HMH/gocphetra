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
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function startServer(port = 4173) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0].split('#')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(DIST_DIR, reqPath);
      const targetPath = (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) ? filePath : path.join(DIST_DIR, 'index.html');
      const ext = path.extname(targetPath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(targetPath).pipe(res);
    });
    server.listen(port, () => resolve(server));
  });
}

async function testClick() {
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

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // Click Admin
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await (await b.getProperty('innerText')).jsonValue();
    if (text.includes('Admin')) {
      await b.click();
      break;
    }
  }

  // Submit login
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Evaluating button click via page.evaluate...');
  const clickResult = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="login-success-continue-btn"]');
    if (!btn) return { found: false };
    btn.click();
    return { found: true, text: btn.innerText };
  });

  console.log('Click result:', clickResult);
  await new Promise(r => setTimeout(r, 2000));

  console.log('URL after evaluate click:', page.url());
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body Text after click:\n', bodyText.substring(0, 300).replace(/\n/g, ' '));

  await browser.close();
  await chrome.kill();
  server.close();
}

testClick().catch(console.error);
