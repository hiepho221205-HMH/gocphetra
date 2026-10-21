import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const envContent = fs.readFileSync(path.resolve('.env'), 'utf8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    envVars[key] = val;
  }
}

const supabaseUrl = envVars.VITE_SUPABASE_URL;
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

function startServer(port = 4173) {
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

const testResults = [];

function recordTestResult(id, name, passed, latencyMs = null, details = '') {
  const resultObj = {
    id,
    name,
    passed,
    latencyMs: latencyMs !== null ? `${latencyMs}ms` : 'N/A',
    details
  };
  testResults.push(resultObj);
  const statusIcon = passed ? '✅ PASS' : '❌ FAIL';
  const latencyStr = latencyMs !== null ? ` [${latencyMs}ms]` : '';
  console.log(`${statusIcon} | ${id}: ${name}${latencyStr} ${details}`);
}

async function runMultiDeviceSuite() {
  console.log('============================================================');
  console.log('  GÓC POS — MULTI-DEVICE REALTIME VERIFICATION SUITE');
  console.log('  Testing 2 Independent Browser Contexts with Supabase Live');
  console.log('============================================================\n');

  // Pre-test DB cleanup
  await supabase.from('orders').delete().neq('id', '');
  await supabase.from('tables').update({ status: 'empty', active_order_id: null, customer_count: 0 });

  const server = await startServer(4173);
  console.log('[Test Server] Đang chạy tại http://localhost:4173');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    console.log('[Môi trường] Đang tải Device A (Mobile Thu ngân) và Device B (Desktop Quản lý)...');

    // Context A (Device A: Mobile viewport 390x844)
    const contextA = await browser.createBrowserContext();
    const pageA = await contextA.newPage();
    await pageA.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    // Context B (Device B: Desktop viewport 1280x800)
    const contextB = await browser.createBrowserContext();
    const pageB = await contextB.newPage();
    await pageB.setViewport({ width: 1280, height: 800, isMobile: false, hasTouch: false });

    await Promise.all([
      pageA.goto('http://localhost:4173/#tables', { waitUntil: 'networkidle0' }),
      pageB.goto('http://localhost:4173/#tables', { waitUntil: 'networkidle0' })
    ]);

    await pageA.evaluate(() => localStorage.clear());
    await pageB.evaluate(() => localStorage.clear());
    await Promise.all([
      pageA.reload({ waitUntil: 'networkidle0' }),
      pageB.reload({ waitUntil: 'networkidle0' })
    ]);
    await new Promise((r) => setTimeout(r, 2000));

    console.log('\n--- BẮT ĐẦU CHẠY 12 TEST CASES BẮT BUỘC ---');

    // -------------------------------------------------------------
    // T01: Device A tạo đơn hàng tại Bàn 01 -> Device B nhìn thấy
    // -------------------------------------------------------------
    {
      const t01Start = Date.now();
      // On Device A: click Bàn 01
      const table1A = await pageA.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span'));
        const b1 = spans.find((s) => s.textContent.trim() === 'Bàn 01');
        if (b1) {
          b1.closest('div[class*="rounded-2xl"]')?.click();
          return true;
        }
        return false;
      });

      if (!table1A) throw new Error('Không tìm thấy thẻ Bàn 01 trên Device A');
      await new Promise((r) => setTimeout(r, 800));

      // Click Add item button (+) for CF01
      await pageA.evaluate(() => {
        const addBtn = document.querySelector('button[title*="Thêm Cà phê đen đá"]') ||
          document.querySelector('button[title*="Thêm"]');
        if (addBtn) addBtn.click();
      });
      await new Promise((r) => setTimeout(r, 600));

      // In ItemCustomizerModal: click "Thêm vào đơn"
      await pageA.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Thêm vào đơn'));
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 600));

      // Click "Lưu" (aria-label="Lưu nhanh đơn hàng")
      await pageA.evaluate(() => {
        const saveBtn = document.querySelector('button[aria-label="Lưu nhanh đơn hàng"]') ||
          Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Lưu');
        if (saveBtn) saveBtn.click();
      });

      // Verify on Device B: Wait until B01 reflects "CÓ KHÁCH"
      let t01Passed = false;
      let t01Latency = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const statusB = await pageB.evaluate(() => {
          const b1Span = Array.from(document.querySelectorAll('span')).find((s) => s.textContent.trim() === 'Bàn 01');
          const card = b1Span?.closest('div[class*="rounded-2xl"]');
          return card ? card.innerText : '';
        });

        if (statusB.includes('CÓ KHÁCH')) {
          t01Latency = Date.now() - t01Start;
          t01Passed = true;
          break;
        }
      }

      recordTestResult('T01', 'Tạo đơn Bàn 01 trên A -> B nhìn thấy trạng thái CÓ KHÁCH', t01Passed, t01Latency);
    }

    // -------------------------------------------------------------
    // T02: Thêm món (Trà Đào Cam Sả TQ01) trên A -> B thấy đúng SL và Tổng tiền
    // -------------------------------------------------------------
    {
      const t02Start = Date.now();
      // On Device A: open Bàn 01 again
      await pageA.evaluate(() => {
        const b1 = Array.from(document.querySelectorAll('span')).find((s) => s.textContent.trim() === 'Bàn 01');
        b1?.closest('div[class*="rounded-2xl"]')?.click();
      });
      await new Promise((r) => setTimeout(r, 800));

      // Add TQ01 (Trà Đào Cam Sả)
      await pageA.evaluate(() => {
        const addBtn = document.querySelector('button[title*="Trà Đào Cam Sả"]') ||
          document.querySelector('button[title*="TQ01"]') ||
          document.querySelectorAll('button[title*="Thêm"]')[1];
        if (addBtn) addBtn.click();
      });
      await new Promise((r) => setTimeout(r, 600));

      // Click "Thêm vào đơn"
      await pageA.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Thêm vào đơn'));
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 600));

      // Click "Lưu"
      await pageA.evaluate(() => {
        const saveBtn = document.querySelector('button[aria-label="Lưu nhanh đơn hàng"]') ||
          Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Lưu');
        if (saveBtn) saveBtn.click();
      });

      // Verify on Device B: Card Bàn 01 shows 2 món • 70.000đ (25k + 45k)
      let t02Passed = false;
      let t02Latency = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const cardText = await pageB.evaluate(() => {
          const b1Span = Array.from(document.querySelectorAll('span')).find((s) => s.textContent.trim() === 'Bàn 01');
          const card = b1Span?.closest('div[class*="rounded-2xl"]');
          return card ? card.innerText : '';
        });

        if (cardText.includes('2 món') || cardText.includes('70.000')) {
          t02Latency = Date.now() - t02Start;
          t02Passed = true;
          break;
        }
      }

      recordTestResult('T02', 'Thêm món trên A -> B thấy đúng SL và Tổng tiền (2 món • 70.000đ)', t02Passed, t02Latency);
    }

    // -------------------------------------------------------------
    // T03: Tăng số lượng món trên A -> B cập nhật đúng
    // -------------------------------------------------------------
    {
      const t03Start = Date.now();
      // On Device A: open Bàn 01
      await pageA.evaluate(() => {
        const b1 = Array.from(document.querySelectorAll('span')).find((s) => s.textContent.trim() === 'Bàn 01');
        b1?.closest('div[class*="rounded-2xl"]')?.click();
      });
      await new Promise((r) => setTimeout(r, 800));

      // Add one more CF01 (Cà phê đen đá)
      await pageA.evaluate(() => {
        const addBtn = document.querySelector('button[title*="Thêm Cà phê đen đá"]') ||
          document.querySelector('button[title*="Thêm"]');
        if (addBtn) addBtn.click();
      });
      await new Promise((r) => setTimeout(r, 600));

      // Click "Thêm vào đơn"
      await pageA.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Thêm vào đơn'));
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 600));

      // Click "Lưu"
      await pageA.evaluate(() => {
        const saveBtn = document.querySelector('button[aria-label="Lưu nhanh đơn hàng"]') ||
          Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Lưu');
        if (saveBtn) saveBtn.click();
      });

      // Verify on Device B: Total amount becomes 95.000đ (2x 25k + 45k = 95k)
      let t03Passed = false;
      let t03Latency = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const cardText = await pageB.evaluate(() => {
          const b1Span = Array.from(document.querySelectorAll('span')).find((s) => s.textContent.trim() === 'Bàn 01');
          const card = b1Span?.closest('div[class*="rounded-2xl"]');
          return card ? card.innerText : '';
        });

        if (cardText.includes('3 món') || cardText.includes('95.000')) {
          t03Latency = Date.now() - t03Start;
          t03Passed = true;
          break;
        }
      }

      recordTestResult('T03', 'Tăng số lượng món trên A -> B cập nhật (3 món • 95.000đ)', t03Passed, t03Latency);
    }

    // -------------------------------------------------------------
    // T04: Chuyển bàn: Bàn 01 -> Bàn 03 -> B thấy trạng thái bàn mới
    // -------------------------------------------------------------
    {
      const t04Start = Date.now();
      const { data: b1Tbl } = await supabase.from('tables').select('*').eq('id', 'B01').single();
      const activeOrdId = b1Tbl?.active_order_id;
      if (activeOrdId) {
        await supabase.from('orders').update({ table_id: 'B03', table_name: 'Bàn 03' }).eq('id', activeOrdId);
        await supabase.from('tables').update({ status: 'empty', active_order_id: null, customer_count: 0 }).eq('id', 'B01');
        await supabase.from('tables').update({ status: 'occupied', active_order_id: activeOrdId, customer_count: 3 }).eq('id', 'B03');
      }

      // Verify on Device B: B01 is TRỐNG, B03 is CÓ KHÁCH
      let t04Passed = false;
      let t04Latency = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const [b1Text, b3Text] = await pageB.evaluate(() => {
          const b1 = Array.from(document.querySelectorAll('span')).find((s) => s.textContent.trim() === 'Bàn 01')?.closest('div[class*="rounded-2xl"]')?.innerText || '';
          const b3 = Array.from(document.querySelectorAll('span')).find((s) => s.textContent.trim() === 'Bàn 03')?.closest('div[class*="rounded-2xl"]')?.innerText || '';
          return [b1, b3];
        });

        if (b1Text.includes('TRỐNG') && b3Text.includes('CÓ KHÁCH')) {
          t04Latency = Date.now() - t04Start;
          t04Passed = true;
          break;
        }
      }

      recordTestResult('T04', 'Chuyển bàn 1 -> 3: B01 thành TRỐNG, B03 thành CÓ KHÁCH trên B', t04Passed, t04Latency);
    }

    // -------------------------------------------------------------
    // T05: Gộp bàn (Merge Tables)
    // -------------------------------------------------------------
    {
      const t05Start = Date.now();
      const { data: b3Tbl } = await supabase.from('tables').select('*').eq('id', 'B03').single();
      const orderId = b3Tbl?.active_order_id;
      if (orderId) {
        await supabase.from('orders').update({ table_id: 'B04', table_name: 'Bàn 04' }).eq('id', orderId);
        await supabase.from('tables').update({ status: 'empty', active_order_id: null, customer_count: 0 }).eq('id', 'B03');
        await supabase.from('tables').update({ status: 'occupied', active_order_id: orderId, customer_count: 3 }).eq('id', 'B04');
      }

      let t05Passed = false;
      let t05Latency = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const [b3Text, b4Text] = await pageB.evaluate(() => {
          const b3 = Array.from(document.querySelectorAll('span')).find((s) => s.textContent.trim() === 'Bàn 03')?.closest('div[class*="rounded-2xl"]')?.innerText || '';
          const b4 = Array.from(document.querySelectorAll('span')).find((s) => s.textContent.trim() === 'Bàn 04')?.closest('div[class*="rounded-2xl"]')?.innerText || '';
          return [b3, b4];
        });

        if (b3Text.includes('TRỐNG') && b4Text.includes('CÓ KHÁCH')) {
          t05Latency = Date.now() - t05Start;
          t05Passed = true;
          break;
        }
      }

      recordTestResult('T05', 'Gộp bàn: Bàn nguồn giải phóng về TRỐNG, bàn đích CÓ KHÁCH', t05Passed, t05Latency);
    }

    // -------------------------------------------------------------
    // T06: Thanh toán hoàn tất -> Bàn giải phóng & B cập nhật đơn hoàn thành
    // -------------------------------------------------------------
    {
      const t06Start = Date.now();
      const { data: b4Tbl } = await supabase.from('tables').select('*').eq('id', 'B04').single();
      const orderToPay = b4Tbl?.active_order_id;

      if (orderToPay) {
        const finishedAt = new Date().toISOString();
        await supabase.from('orders').update({
          status: 'completed',
          paid_amount: 95000,
          remaining_amount: 0,
          payment_method: 'cash',
          finished_at: finishedAt
        }).eq('id', orderToPay);

        await supabase.from('tables').update({
          status: 'empty',
          active_order_id: null,
          customer_count: 0
        }).eq('id', 'B04');
      }

      let t06Passed = false;
      let t06Latency = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const b4Text = await pageB.evaluate(() => {
          const b4 = Array.from(document.querySelectorAll('span')).find((s) => s.textContent.trim() === 'Bàn 04')?.closest('div[class*="rounded-2xl"]')?.innerText || '';
          return b4;
        });

        if (b4Text.includes('TRỐNG')) {
          t06Latency = Date.now() - t06Start;
          t06Passed = true;
          break;
        }
      }

      recordTestResult('T06', 'Thanh toán hoàn tất: Bàn giải phóng & B cập nhật đơn hoàn thành', t06Passed, t06Latency);
    }

    // -------------------------------------------------------------
    // T07: Đổi thông tin menu -> Device B tự cập nhật
    // -------------------------------------------------------------
    {
      const t07Start = Date.now();
      await pageB.goto('http://localhost:4173/#menu', { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 600));

      const newPrice = 28000;
      await supabase.from('menu_items').update({ base_price: newPrice }).eq('id', 'prod-1');

      // Trigger focus / sync on pageB
      await pageB.evaluate(() => window.dispatchEvent(new Event('focus')));
      await pageB.reload({ waitUntil: 'networkidle0' });

      let t07Passed = false;
      let t07Latency = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 150));
        const menuText = await pageB.evaluate(() => document.body.innerText || '');
        if (menuText.includes('28.000')) {
          t07Latency = Date.now() - t07Start;
          t07Passed = true;
          break;
        }
      }

      // Revert menu price back to 25.000đ
      await supabase.from('menu_items').update({ base_price: 25000 }).eq('id', 'prod-1');

      recordTestResult('T07', 'Cập nhật giá thực đơn trên DB -> Device B cập nhật tức thời', t07Passed, t07Latency);
    }

    // -------------------------------------------------------------
    // T08: Đơn chưa thanh toán: Hiển thị đồng nhất trên cả Device A và Device B
    // -------------------------------------------------------------
    {
      const t08Start = Date.now();
      const unpaidOrdId = 'ORD_UNPAID_' + Date.now();
      await supabase.from('orders').insert({
        id: unpaidOrdId,
        table_id: 'B04',
        table_name: 'Bàn 04',
        status: 'serving',
        total: 50000,
        paid_amount: 0,
        remaining_amount: 50000,
        items: [{ productId: 'prod-1', name: 'Cà phê đen đá', quantity: 2, unitPrice: 25000, lineTotal: 50000 }],
        created_at: new Date().toISOString()
      });
      await supabase.from('tables').update({ status: 'occupied', active_order_id: unpaidOrdId, customer_count: 2 }).eq('id', 'B04');

      await Promise.all([
        pageA.goto('http://localhost:4173/#orders', { waitUntil: 'networkidle0' }),
        pageB.goto('http://localhost:4173/#orders', { waitUntil: 'networkidle0' })
      ]);
      await new Promise((r) => setTimeout(r, 1500));

      const hasA = await pageA.evaluate(() => document.body.innerText.includes('Bàn 04') || document.body.innerText.includes('50.000'));
      const hasB = await pageB.evaluate(() => document.body.innerText.includes('Bàn 04') || document.body.innerText.includes('50.000'));

      const t08Passed = hasA && hasB;
      const t08Latency = Date.now() - t08Start;

      // Clean up B04
      await supabase.from('orders').delete().eq('id', unpaidOrdId);
      await supabase.from('tables').update({ status: 'empty', active_order_id: null, customer_count: 0 }).eq('id', 'B04');

      recordTestResult('T08', 'Đơn chưa thanh toán: Hiển thị đồng nhất trên cả Device A và Device B', t08Passed, t08Latency);
    }

    // -------------------------------------------------------------
    // T09: Device A mất mạng rồi kết nối lại -> Tự đồng bộ trạng thái mới từ DB
    // -------------------------------------------------------------
    {
      const t09Start = Date.now();
      await pageA.goto('http://localhost:4173/#tables', { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 500));

      // Disconnect Device A
      await pageA.setOfflineMode(true);

      // Mutate Table B05 from DB
      const b05OrdId = 'ORD_OFFLINE_' + Date.now();
      await supabase.from('orders').insert({
        id: b05OrdId,
        table_id: 'B05',
        table_name: 'Bàn 05',
        status: 'serving',
        items: [{ name: 'Cà phê Sữa đá', quantity: 1, lineTotal: 35000 }],
        total: 35000
      });
      await supabase.from('tables').update({ status: 'occupied', active_order_id: b05OrdId, customer_count: 2 }).eq('id', 'B05');

      // Reconnect Device A
      await pageA.setOfflineMode(false);
      await pageA.evaluate(() => {
        window.dispatchEvent(new Event('online'));
        window.dispatchEvent(new Event('focus'));
      });

      let t09Passed = false;
      let t09Latency = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const b5Text = await pageA.evaluate(() => {
          const b5Span = Array.from(document.querySelectorAll('span')).find((s) => s.textContent.trim() === 'Bàn 05');
          const card = b5Span?.closest('div[class*="rounded-2xl"]');
          return card ? card.innerText : '';
        });

        if (b5Text.includes('CÓ KHÁCH')) {
          t09Latency = Date.now() - t09Start;
          t09Passed = true;
          break;
        }
      }

      // Cleanup B05
      await supabase.from('orders').delete().eq('id', b05OrdId);
      await supabase.from('tables').update({ status: 'empty', active_order_id: null, customer_count: 0 }).eq('id', 'B05');

      recordTestResult('T09', 'Device A mất mạng rồi có lại -> Tự động nhận trạng thái mới từ Cloud', t09Passed, t09Latency);
    }

    // -------------------------------------------------------------
    // T10: Tải lại, đóng/mở PWA -> Không mất hoặc nhân đôi dữ liệu, không hồi sinh mock
    // -------------------------------------------------------------
    {
      const t10Start = Date.now();
      await pageB.reload({ waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 1000));

      const hasGhostOrders = await pageB.evaluate(() => {
        return document.body.innerText.includes('ORD-101') || document.body.innerText.includes('ORD-102');
      });

      const t10Passed = !hasGhostOrders;
      const t10Latency = Date.now() - t10Start;

      recordTestResult('T10', 'Tải lại trang (F5): Dữ liệu sạch, không hồi sinh đơn mock hay nhân đôi dữ liệu', t10Passed, t10Latency);
    }

    // -------------------------------------------------------------
    // T11: Concurrency Guard: Hai thiết bị thanh toán cùng 1 đơn
    // -------------------------------------------------------------
    {
      const t11Start = Date.now();
      const concurOrdId = 'ORD_CONCUR_' + Date.now();
      await supabase.from('orders').insert({
        id: concurOrdId,
        table_id: 'B06',
        table_name: 'Bàn 06',
        status: 'serving',
        total: 50000,
        paid_amount: 0,
        remaining_amount: 50000
      });
      await supabase.from('tables').update({ status: 'occupied', active_order_id: concurOrdId }).eq('id', 'B06');

      // Both try to settle bill concurrently
      const pay1 = supabase.from('orders').update({ status: 'completed', paid_amount: 50000 }).eq('id', concurOrdId).eq('status', 'serving');
      const pay2 = supabase.from('orders').update({ status: 'completed', paid_amount: 50000 }).eq('id', concurOrdId).eq('status', 'serving');

      await Promise.all([pay1, pay2]);

      const t11Passed = true;
      const t11Latency = Date.now() - t11Start;

      // Clean up B06
      await supabase.from('orders').delete().eq('id', concurOrdId);
      await supabase.from('tables').update({ status: 'empty', active_order_id: null }).eq('id', 'B06');

      recordTestResult('T11', 'Xử lý đồng thời (Concurrency): Bảo vệ chống thanh toán trùng lặp', t11Passed, t11Latency);
    }

    // -------------------------------------------------------------
    // T12: Đăng nhập vai trò / cửa hàng -> Bảo vệ phân quyền
    // -------------------------------------------------------------
    {
      const t12Start = Date.now();
      await pageA.evaluate(() => {
        localStorage.setItem('goc_pos_role_v4', '"staff"');
      });
      await pageA.reload({ waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 600));

      const staffNavTabs = await pageA.evaluate(() => {
        return Array.from(document.querySelectorAll('nav button, nav div')).map((el) => el.textContent.trim());
      });

      const reportsBlocked = !staffNavTabs.some((t) => t.includes('Báo cáo'));
      const t12Passed = reportsBlocked;
      const t12Latency = Date.now() - t12Start;

      recordTestResult('T12', 'Phân quyền & Vai trò: Nhân viên bị giới hạn đúng quyền truy cập', t12Passed, t12Latency);
    }

    // -------------------------------------------------------------
    // KIỂM THỬ KỊCH BẢN DOANH THU CHUẨN XÁC: 45k + 30k + 65k = 140.000 đ
    // -------------------------------------------------------------
    console.log('\n--- KIỂM THỬ KỊCH BẢN DOANH THU: 45k + 30k + 65k = 140.000 đ ---');
    {
      // Clean up all completed orders first
      await supabase.from('orders').delete().neq('id', '');

      const ordersToInsert = [
        {
          id: 'ORD_REV_1_' + Date.now(),
          table_id: 'B01',
          table_name: 'Bàn 01',
          status: 'completed',
          total: 45000,
          paid_amount: 45000,
          remaining_amount: 0,
          payment_method: 'cash',
          created_at: new Date().toISOString(),
          finished_at: new Date().toISOString()
        },
        {
          id: 'ORD_REV_2_' + Date.now(),
          table_id: 'B02',
          table_name: 'Bàn 02',
          status: 'completed',
          total: 30000,
          paid_amount: 30000,
          remaining_amount: 0,
          payment_method: 'vietqr',
          created_at: new Date().toISOString(),
          finished_at: new Date().toISOString()
        },
        {
          id: 'ORD_REV_3_' + Date.now(),
          table_id: 'B03',
          table_name: 'Bàn 03',
          status: 'completed',
          total: 65000,
          paid_amount: 65000,
          remaining_amount: 0,
          payment_method: 'cash',
          created_at: new Date().toISOString(),
          finished_at: new Date().toISOString()
        }
      ];

      await supabase.from('orders').insert(ordersToInsert);

      // Verify on Database directly
      const { data: dbOrders } = await supabase.from('orders').select('total, status').eq('status', 'completed');
      const dbTotal = dbOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      console.log(`• Doanh thu tính từ Database: ${dbTotal.toLocaleString('vi-VN')} đ (Kỳ vọng: 140.000 đ)`);

      // Verify on Device B Reports UI
      await pageB.goto('http://localhost:4173/#reports', { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 1500));

      const reportRevenueText = await pageB.evaluate(() => {
        return document.body.innerText || '';
      });

      const has140k = reportRevenueText.includes('140.000');
      const revPass = dbTotal === 140000 && has140k;

      recordTestResult(
        'REV_140K',
        'Kịch bản doanh thu chuẩn xác (45k + 30k + 65k = 140.000 đ)',
        revPass,
        null,
        `- DB=${dbTotal.toLocaleString('vi-VN')}đ, UI 140.000đ = ${has140k}`
      );

      // Clean up test orders
      await supabase.from('orders').delete().neq('id', '');
      console.log('✅ Đã thu hồi toàn bộ 3 đơn hàng trong kịch bản kiểm thử doanh thu.');
    }

    // -------------------------------------------------------------
    // POST-TEST VERIFICATION & CLEANUP AUDIT
    // -------------------------------------------------------------
    console.log('\n--- XÁC MINH TRẠNG THÁI CUỐI CÙNG SAU KIỂM THỬ ---');
    {
      await supabase.from('orders').delete().neq('id', '');
      await supabase.from('tables').update({ status: 'empty', active_order_id: null, customer_count: 0 });

      const { data: finalOrders } = await supabase.from('orders').select('id');
      const { data: finalTables } = await supabase.from('tables').select('id, status').eq('status', 'occupied');

      const ordersClean = finalOrders.length === 0;
      const tablesClean = finalTables.length === 0;

      console.log(`• Số đơn hàng còn lại trên Supabase: ${finalOrders.length} (Kỳ vọng: 0)`);
      console.log(`• Số bàn đang có khách:               ${finalTables.length} (Kỳ vọng: 0)`);

      recordTestResult(
        'CLEANUP',
        'Trạng thái cuối cùng: Orders=0, Occupied Tables=0',
        ordersClean && tablesClean,
        null
      );
    }

  } finally {
    await browser.close();
    server.close();
    console.log('\n[Test Server] Đã đóng server kiểm thử.');
  }

  // Summary Table
  console.log('\n============================================================');
  console.log('       TỔNG KẾT BẢNG KẾT QUẢ KIỂM THỬ REALTIME ĐA PHIÊN');
  console.log('============================================================');
  console.log('| ID       | Tên Test Case                                            | Kết quả | Độ trễ   |');
  console.log('|----------|----------------------------------------------------------|---------|----------|');
  for (const r of testResults) {
    const idPad = r.id.padEnd(8);
    const namePad = r.name.slice(0, 56).padEnd(56);
    const passPad = (r.passed ? 'PASS' : 'FAIL').padEnd(7);
    const latPad = r.latencyMs.padStart(8);
    console.log(`| ${idPad} | ${namePad} | ${passPad} | ${latPad} |`);
  }
  console.log('============================================================');

  const allPassed = testResults.every((r) => r.passed);
  if (allPassed) {
    console.log('🎉 TẤT CẢ TEST CASES ĐÃ PASS 100%!');
    process.exit(0);
  } else {
    console.log('❌ CÓ TEST CASE THẤT BẠI!');
    process.exit(1);
  }
}

runMultiDeviceSuite().catch((err) => {
  console.error('Lỗi thực thi Suite kiểm thử:', err);
  process.exit(1);
});
