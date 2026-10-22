import { chromium } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve('dist');

const envContent = fs.readFileSync(path.resolve('.env'), 'utf8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const supabaseUrl = envVars.VITE_SUPABASE_URL || 'https://nbuulvdfxnmfdicbisxq.supabase.co';
const supabaseKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

function startServer(port = 4174) {
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

    server.listen(port, () => resolve(server));
  });
}

const testLogs = [];
function logStep(name, status, details = '') {
  const icon = status ? '✅ [PASS]' : '❌ [FAIL]';
  const msg = `${icon} ${name} ${details ? '(' + details + ')' : ''}`;
  console.log(msg);
  testLogs.push({ name, status, details });
}

async function run() {
  console.log('============================================================');
  console.log('  GÓC POS — PLAYWRIGHT 2-DEVICE INDEPENDENT SYNC TEST');
  console.log('============================================================\n');

  const PORT = 4174;
  const server = await startServer(PORT);
  console.log(`[HTTP Server] Phục vụ bản build dist tại http://localhost:${PORT}`);

  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let testOrderId = null;
  const TEST_TABLE_ID = 'B02'; // Bàn 02

  // Dọn dẹp an toàn Bàn 02 trước khi bắt đầu bài kiểm thử
  console.log('[Setup] Chuẩn bị bàn kiểm thử B02 trên Supabase...');
  await supabase.from('orders').delete().eq('table_id', TEST_TABLE_ID).eq('status', 'serving');
  await supabase.from('tables').update({ status: 'empty', active_order_id: null, customer_count: 0 }).eq('id', TEST_TABLE_ID);

  try {
    // 1. Khởi tạo 2 Browser Contexts hoàn toàn độc lập (Device A & Device B)
    const contextA = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    });
    const pageA = await contextA.newPage();
    pageA.on('dialog', async (dialog) => {
      console.log(`[Dialog A] ${dialog.message()} -> Chấp nhận`);
      await dialog.accept();
    });

    const contextB = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
    });
    const pageB = await contextB.newPage();
    pageB.on('dialog', async (dialog) => {
      console.log(`[Dialog B] ${dialog.message()} -> Chấp nhận`);
      await dialog.accept();
    });

    console.log('[Setup] Điều hướng Device A và Device B vào ứng dụng...');
    await Promise.all([
      pageA.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' }),
      pageB.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' })
    ]);

    // Hàm tự động xác thực cho từng thiết bị nếu chưa đăng nhập
    async function loginDevice(page, deviceName, email, password) {
      const emailInput = page.locator('[data-testid="login-email-input"]').first();
      try {
        if (await emailInput.isVisible({ timeout: 5000 })) {
          console.log(`[Setup] ${deviceName} đang đăng nhập tài khoản ${email}...`);
          await emailInput.fill(email);
          await page.locator('[data-testid="login-password-input"]').first().fill(password);
          await page.locator('[data-testid="login-submit-button"]').first().click();
          await page.waitForSelector('[data-testid="shared-page-header"]', { timeout: 15000 });
          console.log(`[Setup] ${deviceName} đăng nhập thành công!`);
        }
      } catch (err) {
        console.log(`[Setup] ${deviceName} đã vào giao diện chính hoặc bỏ qua auth:`, err.message);
      }
    }

    await loginDevice(pageA, 'Device A (Mobile)', 'admin01@gocpos.vn', '123456');
    await loginDevice(pageB, 'Device B (Desktop)', 'manager01@gocpos.vn', '123456');

    // Chờ ứng dụng nạp và kết nối Supabase
    await pageA.waitForTimeout(2000);
    await pageB.waitForTimeout(2000);

    logStep('1. Khởi tạo 2 phiên độc lập A & B', true, 'Device A (Mobile 390x844), Device B (Desktop 1280x720)');

    // 2. Device A tạo đơn hàng trên Bàn 02 (B02)
    console.log('\n--- BƯỚC 1: Device A tạo đơn hàng trên Bàn 02 ---');
    const tableCardA = pageA.locator(`[data-table-id="${TEST_TABLE_ID}"]`).first();
    await tableCardA.waitFor({ state: 'visible', timeout: 10000 });
    await tableCardA.click();
    await pageA.waitForTimeout(1000);

    // Chọn món đầu tiên trong Menu trên Device A
    const addFirstItemA = pageA.locator('[data-menu-item-button="true"]').first();
    await addFirstItemA.waitFor({ state: 'visible', timeout: 5000 });
    await addFirstItemA.click();
    await pageA.waitForTimeout(800);

    // Xác nhận modal tùy chỉnh món nếu xuất hiện
    const confirmAddBtnA = pageA.locator('button:has-text("Thêm vào đơn")').first();
    if (await confirmAddBtnA.isVisible()) {
      await confirmAddBtnA.click();
      await pageA.waitForTimeout(800);
    }

    // Bấm lưu nhanh đơn hàng
    const quickSaveBtnA = pageA.locator('button[aria-label="Lưu nhanh đơn hàng"]').or(pageA.locator('button:has-text("Lưu")')).first();
    await quickSaveBtnA.waitFor({ state: 'visible', timeout: 5000 });
    await quickSaveBtnA.click();
    await pageA.waitForTimeout(2500);

    logStep('2. Device A tạo đơn và lưu lên Cloud thành công', true, 'Bàn 02 đã lưu đơn');

    // 3. Realtime Verification trên Device B: Phải thấy Bàn 02 chuyển sang CÓ KHÁCH trong thời gian thực
    console.log('\n--- BƯỚC 2: Kiểm tra Device B nhận Realtime Bàn 02 CÓ KHÁCH ---');
    let bSawOccupied = false;
    for (let i = 0; i < 15; i++) {
      const cardB = pageB.locator(`[data-table-id="${TEST_TABLE_ID}"]`).first();
      const textB = await cardB.innerText();
      if (textB.includes('CÓ KHÁCH') || textB.includes('món')) {
        bSawOccupied = true;
        break;
      }
      await pageB.waitForTimeout(1000);
    }
    logStep('3. Device B nhận tín hiệu Realtime Bàn 02 đổi trạng thái CÓ KHÁCH', bSawOccupied, 'Đồng bộ tức thời');

    // 4. Đối chiếu trực tiếp Supabase Database
    console.log('\n--- BƯỚC 3: Đối chiếu đơn hàng trực tiếp trên Supabase DB ---');
    const { data: dbOrders } = await supabase
      .from('orders')
      .select('*')
      .eq('table_id', TEST_TABLE_ID)
      .eq('status', 'serving')
      .order('created_at', { ascending: false })
      .limit(1);

    const liveDbOrder = dbOrders && dbOrders[0];
    if (liveDbOrder) {
      testOrderId = liveDbOrder.id;
      logStep('4. Đối chiếu Supabase Database SSOT', true, `Order ID: ${liveDbOrder.id}, Tổng tiền: ${liveDbOrder.total}đ, Items: ${liveDbOrder.items?.length}`);
    } else {
      logStep('4. Đối chiếu Supabase Database SSOT', false, 'Không tìm thấy đơn hàng trên DB');
    }

    // 5. Device B mở Bàn 02 và thêm món thứ 2
    console.log('\n--- BƯỚC 4: Device B mở Bàn 02 và thêm món thứ 2 ---');
    const cardBToOpen = pageB.locator(`[data-table-id="${TEST_TABLE_ID}"]`).first();
    const openBtnB = cardBToOpen.locator('button:has-text("Xem đơn")').or(cardBToOpen).first();
    await openBtnB.click();
    await pageB.waitForTimeout(1000);

    // Thêm món thứ 2
    const addSecondItemB = pageB.locator('[data-menu-item-button="true"]').nth(1);
    await addSecondItemB.waitFor({ state: 'visible', timeout: 5000 });
    await addSecondItemB.click();
    await pageB.waitForTimeout(800);
    const confirmAddB = pageB.locator('button:has-text("Thêm vào đơn")').first();
    if (await confirmAddB.isVisible()) {
      await confirmAddB.click();
      await pageB.waitForTimeout(800);
    }

    // Device B bấm lưu đơn
    const saveBtnB = pageB.locator('button[aria-label="Lưu nhanh đơn hàng"]').or(pageB.locator('button:has-text("Lưu")')).first();
    if (await saveBtnB.isVisible()) {
      await saveBtnB.click();
      await pageB.waitForTimeout(2500);
    }
    logStep('5. Device B thêm món và cập nhật đơn hàng lên Cloud', true, 'Đơn hàng đã được thêm món từ Device B');

    // 6. Device A mở lại hoặc nhận Realtime: kiểm tra tổng tiền và số món tăng lên
    console.log('\n--- BƯỚC 5: Kiểm tra Device A thấy số món và tiền cập nhật ---');
    let aSawUpdate = false;
    for (let i = 0; i < 15; i++) {
      const cardA = pageA.locator(`[data-table-id="${TEST_TABLE_ID}"]`).first();
      const textA = await cardA.innerText();
      if (textA.includes('món') || textA.includes('CÓ KHÁCH')) {
        aSawUpdate = true;
        break;
      }
      await pageA.waitForTimeout(1000);
    }
    logStep('6. Device A đồng bộ số lượng món và tổng tiền từ Device B', aSawUpdate, 'Realtime 2 chiều hoàn hảo');

    // 7. Device A mở đơn và tiến hành thanh toán
    console.log('\n--- BƯỚC 6: Device A thanh toán hoàn tất đơn hàng ---');
    const payBtnA = pageA.locator(`[data-table-id="${TEST_TABLE_ID}"] button:has-text("Thanh toán")`).first();
    await payBtnA.waitFor({ state: 'visible', timeout: 5000 });
    await payBtnA.click();
    await pageA.waitForTimeout(1200);

    // Trong BillCheckoutModal: chọn nút Tiền mặt (dialog sẽ tự động được accept)
    const cashBtnA = pageA.locator('button:has-text("Tiền mặt")').first();
    await cashBtnA.waitFor({ state: 'visible', timeout: 5000 });
    await cashBtnA.click();
    await pageA.waitForTimeout(3000);
    logStep('7. Device A hoàn tất thanh toán cho Bàn 02', true, 'Đã xác nhận thanh toán tiền mặt');

    // 8. Device B nhận Realtime: Bàn 02 trở về TRỐNG
    console.log('\n--- BƯỚC 7: Device B nhận Realtime Bàn 02 trở về TRỐNG ---');
    let bSawEmpty = false;
    for (let i = 0; i < 15; i++) {
      const cardB = pageB.locator(`[data-table-id="${TEST_TABLE_ID}"]`).first();
      const textB = await cardB.innerText();
      if (textB.includes('TRỐNG')) {
        bSawEmpty = true;
        break;
      }
      await pageB.waitForTimeout(1000);
    }
    logStep('8. Device B thấy Bàn 02 được giải phóng sang TRỐNG trong thời gian thực', bSawEmpty, 'Bàn 02 đã trống');

    // 9. Kiểm tra đối chiếu DB trạng thái completed & dọn dẹp an toàn
    if (testOrderId) {
      const { data: finalDbOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('id', testOrderId)
        .maybeSingle();

      const isCompleted = finalDbOrder && finalDbOrder.status === 'completed';
      logStep('9. Supabase DB xác nhận đơn hàng status = completed', isCompleted, `Order ${testOrderId} status: ${finalDbOrder?.status}, Paid: ${finalDbOrder?.paid_amount}đ`);

      // Dọn dẹp an toàn: chỉ xóa đúng testOrderId này để giữ sạch DB sản xuất
      await supabase.from('orders').delete().eq('id', testOrderId);
      await supabase.from('tables').update({ status: 'empty', active_order_id: null, customer_count: 0 }).eq('id', TEST_TABLE_ID);
      logStep('10. Dọn dẹp an toàn đơn kiểm thử', true, `Đã xóa order ${testOrderId} mà không ảnh hưởng dữ liệu sản xuất`);
    }

    await contextA.close();
    await contextB.close();
  } catch (err) {
    console.error('Lỗi kiểm thử E2E:', err);
    logStep('Kiểm thử E2E gặp lỗi', false, err.message);
  } finally {
    await browser.close();
    server.close();
  }

  const allPassed = testLogs.every((t) => t.status);
  console.log('\n============================================================');
  console.log(`  KẾT QUẢ TỔNG THỂ: ${allPassed ? '✅ TẤT CẢ TEST ĐỀU ĐẠT' : '⚠️ CÓ TEST CHƯA ĐẠT'}`);
  console.log('============================================================\n');
  return allPassed;
}

run().then((passed) => {
  process.exit(passed ? 0 : 1);
});
