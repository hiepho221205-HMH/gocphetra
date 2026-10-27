import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve('public/screenshots');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function capture() {
  console.log('Capturing real browser layout screenshots...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new'
  });

  const page = await browser.newPage();

  // 1. Mobile Login Screen
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`${APP_URL}/#/login`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(OUT_DIR, '01_login_mobile.png') });
  console.log('✓ Captured 01_login_mobile.png');

  // 2. Desktop Login Screen
  await page.setViewport({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(OUT_DIR, '02_login_desktop.png') });
  console.log('✓ Captured 02_login_desktop.png');

  // Login as Admin
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.type('input[type="email"]', 'admin01@gocpos.vn');
  await page.type('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2500));

  // 3. Mobile Table Grid
  await page.screenshot({ path: path.join(OUT_DIR, '03_tables_mobile.png') });
  console.log('✓ Captured 03_tables_mobile.png');

  // 4. Mobile Menu Tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const t = tabs.find(el => el.textContent.includes('Thực đơn'));
    if (t) t.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '04_menu_mobile.png') });
  console.log('✓ Captured 04_menu_mobile.png');

  // 5. Mobile Orders Tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const t = tabs.find(el => el.textContent.includes('Đơn hàng'));
    if (t) t.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '05_orders_mobile.png') });
  console.log('✓ Captured 05_orders_mobile.png');

  // 6. Mobile Reports Tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const t = tabs.find(el => el.textContent.includes('Báo cáo'));
    if (t) t.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '06_reports_mobile.png') });
  console.log('✓ Captured 06_reports_mobile.png');

  // 7. Mobile Settings Tab
  await page.evaluate(() => window.location.hash = '#/settings');
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '07_settings_mobile.png') });
  console.log('✓ Captured 07_settings_mobile.png');

  // 8. Desktop Settings
  await page.setViewport({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(OUT_DIR, '08_settings_desktop.png') });
  console.log('✓ Captured 08_settings_desktop.png');

  // 9. Desktop Tables
  await page.evaluate(() => window.location.hash = '#/tables');
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '09_tables_desktop.png') });
  console.log('✓ Captured 09_tables_desktop.png');

  await browser.close();
  console.log('All real browser screenshots captured successfully!');
}

capture().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
