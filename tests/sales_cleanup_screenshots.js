import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOT_DIR = path.resolve('C:\\Users\\Admin\\.gemini\\antigravity\\brain\\6bb248b7-7cd7-4bae-9eb1-80900f01ca9f\\screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

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

function startServer(port = 4176) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(DIST_DIR, reqPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        const indexPath = path.join(DIST_DIR, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(indexPath).pipe(res);
      }
    });

    server.listen(port, () => {
      console.log(`Sales Cleanup QA server running on http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function runCleanupScreenshots() {
  const server = await startServer(4176);
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });

    // Seed mock completed order history and ensure Admin role
    await page.evaluateOnNewDocument(() => {
      window.__ENABLE_DEMO_SWITCHER__ = true;
      const mockHistory = [
        {
          id: 'ORD-HIST-01',
          status: 'completed',
          businessDate: '2026-10-18',
          finishedAt: '2026-10-18T10:30:00Z',
          total: 65000,
          paymentMethod: 'cash',
          tableName: 'Bàn 01'
        },
        {
          id: 'ORD-HIST-02',
          status: 'completed',
          businessDate: '2026-10-18',
          finishedAt: '2026-10-18T14:15:00Z',
          total: 80000,
          paymentMethod: 'vietqr',
          tableName: 'Bàn 02'
        },
        {
          id: 'ORD-HIST-03',
          status: 'completed',
          businessDate: '2026-10-19',
          finishedAt: '2026-10-19T09:00:00Z',
          total: 120000,
          paymentMethod: 'cash',
          tableName: 'Bàn 03'
        }
      ];
      localStorage.setItem('goc_pos_history_v4', JSON.stringify(mockHistory));
      localStorage.setItem('goc_pos_role_v4', JSON.stringify('admin'));
    });

    // 1. Mở trang Cài đặt -> Nhấn vào Card "Dữ liệu bán hàng"
    await page.goto('http://localhost:4176/#/settings', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Click data cleanup nav card
    const cleanupNavCard = await page.waitForSelector('[data-testid="data-cleanup-nav-card"]', { timeout: 4000 });
    await cleanupNavCard.click();
    await new Promise((r) => setTimeout(r, 500));

    // Wait for cleanup section to render
    await page.waitForSelector('[data-testid="data-cleanup-section"]', { timeout: 4000 });

    const initialNullPath = path.join(SCREENSHOT_DIR, 'cleanup_initial_null_390px.png');
    await page.screenshot({ path: initialNullPath });
    console.log('  [OK] Saved: cleanup_initial_null_390px.png');

    // 2. Nhấn chọn Tab "Theo khoảng ngày"
    await page.click('[data-testid="cleanup-tab-range"]');
    await new Promise((r) => setTimeout(r, 400));

    const rangePreviewPath = path.join(SCREENSHOT_DIR, 'cleanup_range_preview_390px.png');
    await page.screenshot({ path: rangePreviewPath });
    console.log('  [OK] Saved: cleanup_range_preview_390px.png');

    // 3. Nhấn nút bắt đầu quy trình dọn dẹp -> Mở Modal Bước 1
    await page.click('[data-testid="cleanup-initiate-btn"]');
    await new Promise((r) => setTimeout(r, 400));

    const modalStep1Path = path.join(SCREENSHOT_DIR, 'cleanup_modal_step1_390px.png');
    await page.screenshot({ path: modalStep1Path });
    console.log('  [OK] Saved: cleanup_modal_step1_390px.png');

    // 4. Nhấn Tải sao lưu -> Chuyển sang Bước 2 (Chưa nhập "XÓA DỮ LIỆU")
    await page.click('[data-testid="cleanup-download-backup-btn"]');
    await new Promise((r) => setTimeout(r, 400));
    await page.click('[data-testid="cleanup-proceed-to-step2-btn"]');
    await new Promise((r) => setTimeout(r, 400));

    const step2LockedPath = path.join(SCREENSHOT_DIR, 'cleanup_modal_step2_locked_390px.png');
    await page.screenshot({ path: step2LockedPath });
    console.log('  [OK] Saved: cleanup_modal_step2_locked_390px.png');

    // 5. Nhập chính xác "XÓA DỮ LIỆU" và tick chọn checkbox -> Nút xóa đỏ được kích hoạt
    await page.type('[data-testid="cleanup-confirm-input"]', 'XÓA DỮ LIỆU');
    await page.click('[data-testid="cleanup-confirm-checkbox"]');
    await new Promise((r) => setTimeout(r, 400));

    const step2UnlockedPath = path.join(SCREENSHOT_DIR, 'cleanup_modal_step2_unlocked_390px.png');
    await page.screenshot({ path: step2UnlockedPath });
    console.log('  [OK] Saved: cleanup_modal_step2_unlocked_390px.png');

    await page.close();
    console.log('\n[ALL SALES CLEANUP SCREENSHOTS CAPTURED SUCCESSFULLY]');
  } catch (err) {
    console.error('Lỗi khi chụp screenshot:', err);
  } finally {
    await browser.close();
    server.close();
  }
}

runCleanupScreenshots();
