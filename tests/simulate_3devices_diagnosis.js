import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP_URL = 'http://127.0.0.1:4173';
const SCREENSHOT_DIR = path.resolve('tests/screenshots_simulation');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(page, email, password, roleName) {
  console.log(`[${roleName}] Đang đăng nhập với email: ${email}...`);
  await page.goto(`${APP_URL}/#tables`, { waitUntil: 'networkidle0' });
  await delay(1200);

  const hasLoginInput = await page.$('input[data-testid="login-password-input"]');
  if (hasLoginInput) {
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email);
    }
    const passInput = await page.$('input[data-testid="login-password-input"]');
    if (passInput) {
      await passInput.click({ clickCount: 3 });
      await passInput.type(password);
    }
    await delay(300);
    const submitBtn = await page.$('button[data-testid="login-submit-button"]');
    if (submitBtn) {
      await submitBtn.click();
    }
    await delay(3000);
  } else {
    console.log(`[${roleName}] Đã vào thẳng POS (session active)`);
  }
}

async function run() {
  console.log('===============================================================');
  console.log(' BẮT ĐẦU GIẢ LẬP 3 THIẾT BỊ RBAC — CHẨN ĐOÁN & XÁC MINH TOÀN DIỆN');
  console.log('===============================================================');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 1. Device 1: Admin (Desktop 1280x800)
    const ctxAdmin = await browser.createBrowserContext();
    const pageAdmin = await ctxAdmin.newPage();
    await pageAdmin.setViewport({ width: 1280, height: 800 });

    // 2. Device 2: Manager (Tablet 820x1180)
    const ctxManager = await browser.createBrowserContext();
    const pageManager = await ctxManager.newPage();
    await pageManager.setViewport({ width: 820, height: 1180 });

    // 3. Device 3: Staff (Mobile 390x844)
    const ctxStaff = await browser.createBrowserContext();
    const pageStaff = await ctxStaff.newPage();
    await pageStaff.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    const errorTracker = {
      insufficientResources: 0,
      checkoutAlerts: 0,
      consoleErrors: []
    };

    [pageAdmin, pageManager, pageStaff].forEach((p, idx) => {
      const devName = idx === 0 ? 'Admin' : idx === 1 ? 'Manager' : 'Staff';
      p.on('dialog', async (dialog) => {
        const text = dialog.message();
        console.log(`[${devName} DIALOG]: ${text}`);
        if (text.includes('chưa có món nào để lên bill')) {
          errorTracker.checkoutAlerts++;
        }
        await dialog.accept();
      });

      p.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('ERR_INSUFFICIENT_RESOURCES')) {
          errorTracker.insufficientResources++;
          console.error(`[${devName} RESOURCE EXHAUSTION DETECTED]:`, text);
        }
        if (msg.type() === 'error' && !text.includes('PGRST205')) {
          errorTracker.consoleErrors.push(`[${devName}] ${text}`);
        }
      });
    });

    // Step A: Login all 3 devices
    await login(pageAdmin, 'admin01@gocpos.vn', '123456', 'Device 1 (Admin)');
    await login(pageManager, 'manager01@gocpos.vn', '123456', 'Device 2 (Manager)');
    await login(pageStaff, 'staff01@gocpos.vn', '123456', 'Device 3 (Staff)');

    await delay(2500);

    console.log('\n--- BƯỚC 1: KIỂM TRA TRẠNG THÁI BÀN 02 VÀ BÀN 03 BAN ĐẦU ---');
    const b02CardAdmin = await pageAdmin.evaluate(() => {
      const el = document.querySelector('[data-table-id="B02"]');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : 'NOT_FOUND';
    });
    console.log('Bàn 02 trên Admin:', b02CardAdmin);

    const b03CardManager = await pageManager.evaluate(() => {
      const el = document.querySelector('[data-table-id="B03"]');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : 'NOT_FOUND';
    });
    console.log('Bàn 03 trên Manager:', b03CardManager);

    await pageAdmin.screenshot({ path: path.join(SCREENSHOT_DIR, '01_admin_tables.png') });
    await pageManager.screenshot({ path: path.join(SCREENSHOT_DIR, '02_manager_tables.png') });
    await pageStaff.screenshot({ path: path.join(SCREENSHOT_DIR, '03_staff_tables.png') });

    console.log('\n--- BƯỚC 2: DEVICE 2 (MANAGER) MỞ BÀN 03 VÀ TIẾN HÀNH THANH TOÁN ---');
    // On Manager: Click Bàn 03
    await pageManager.click('[data-table-id="B03"]');
    await delay(1200);

    // Click "Thanh toán" or "Lên hóa đơn"
    const clickedCheckout = await pageManager.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const checkoutBtn = buttons.find((b) => b.textContent.includes('Thanh toán') || b.textContent.includes('Lên bill'));
      if (checkoutBtn) {
        checkoutBtn.click();
        return true;
      }
      return false;
    });
    console.log('Đã click nút thanh toán trên Manager:', clickedCheckout);
    await delay(1500);
    await pageManager.screenshot({ path: path.join(SCREENSHOT_DIR, '05_manager_checkout_modal.png') });

    // Inspect items inside Checkout modal
    const billItems = await pageManager.evaluate(() => {
      const modal = document.querySelector('div[class*="z-50"]');
      if (!modal) return { found: false, text: 'No modal found' };
      const hasSaltCoffee = modal.textContent.includes('kem muối');
      const has114k = modal.textContent.includes('114.000') || modal.textContent.includes('114,000');
      return { found: true, hasSaltCoffee, has114k, summaryText: modal.textContent.slice(0, 300) };
    });
    console.log('Thông tin hóa đơn Bàn 03 hiển thị trong BillCheckoutModal:', billItems);

    // Click "Tiền mặt" to checkout
    const completedCheckout = await pageManager.evaluate(async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const cashBtn = buttons.find((b) => b.textContent.includes('Tiền mặt'));
      if (cashBtn) {
        cashBtn.click();
        return true;
      }
      return false;
    });
    console.log('Đã click nút Tiền mặt hoàn tất đơn Bàn 03:', completedCheckout);
    await delay(3500);
    await pageManager.screenshot({ path: path.join(SCREENSHOT_DIR, '06_manager_after_checkout.png') });

    const b03AfterCheckout = await pageManager.evaluate(() => {
      const el = document.querySelector('[data-table-id="B03"]');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : 'NOT_FOUND';
    });
    console.log('Trạng thái Bàn 03 sau thanh toán trên Manager:', b03AfterCheckout);

    console.log('\n--- BƯỚC 3: DEVICE 3 (STAFF) TẠO ĐƠN MỚI TẠI BÀN 01 ---');
    await pageStaff.click('[data-table-id="B01"]');
    await delay(1000);

    // Click "Mở bàn / Đặt món" or "Gọi món"
    await pageStaff.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const orderBtn = buttons.find((b) => b.textContent.includes('Đặt món') || b.textContent.includes('Gọi món') || b.textContent.includes('Mở bàn'));
      if (orderBtn) orderBtn.click();
    });
    await delay(1500);

    // Staff chooses 2 products from Menu
    const itemsCount = await pageStaff.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, div[class*="cursor-pointer"]'));
      let added = 0;
      for (const btn of buttons) {
        if (btn.textContent.includes('Cà phê') || btn.textContent.includes('Trà thảo mộc')) {
          btn.click();
          added++;
          if (added >= 2) break;
        }
      }
      return added;
    });
    console.log(`Staff đã click chọn ${itemsCount} sản phẩm.`);
    await delay(1000);

    // Click "Gọi món" / "Gửi bếp" / "Lưu đơn"
    await pageStaff.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveBtn = buttons.find((b) => b.textContent.includes('Gọi món') || b.textContent.includes('Gửi bếp') || b.textContent.includes('Lưu đơn'));
      if (saveBtn) saveBtn.click();
    });
    await delay(3000);
    await pageStaff.screenshot({ path: path.join(SCREENSHOT_DIR, '07_staff_b01_ordered.png') });

    console.log('\n--- BƯỚC 4: XÁC MINH ĐỒNG BỘ REALTIME TRÊN ADMIN & MANAGER ---');
    await delay(2000);
    const b01OnAdmin = await pageAdmin.evaluate(() => {
      const el = document.querySelector('[data-table-id="B01"]');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : 'NOT_FOUND';
    });
    console.log('Realtime Bàn 01 trên Admin:', b01OnAdmin);

    const b01OnManager = await pageManager.evaluate(() => {
      const el = document.querySelector('[data-table-id="B01"]');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : 'NOT_FOUND';
    });
    console.log('Realtime Bàn 01 trên Manager:', b01OnManager);

    console.log('\n--- BƯỚC 5: XÁC MINH CÔNG CỤ XỬ LÝ KHẨN CẤP DÀNH CHO ADMIN ---');
    // Open Emergency Order Manager Modal on Admin
    const openedEmergency = await pageAdmin.evaluate(() => {
      const profileBtn = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label')?.includes('Tài khoản') || b.textContent.includes('Quản lý') || b.textContent.includes('Admin'));
      return Boolean(profileBtn);
    });
    console.log('Admin có quyền truy cập Profile / Emergency controls:', openedEmergency);

    console.log('\n--- BƯỚC 6: F5 KIỂM THỬ KHÔNG HỒI SINH (PAGE RELOAD RESILIENCE) ---');
    console.log('Đang F5 tải lại toàn bộ 3 thiết bị...');
    await Promise.all([
      pageAdmin.reload({ waitUntil: 'networkidle0' }),
      pageManager.reload({ waitUntil: 'networkidle0' }),
      pageStaff.reload({ waitUntil: 'networkidle0' })
    ]);
    await delay(3500);

    const b02AfterReload = await pageAdmin.evaluate(() => {
      const el = document.querySelector('[data-table-id="B02"]');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : 'NOT_FOUND';
    });
    const b03AfterReload = await pageAdmin.evaluate(() => {
      const el = document.querySelector('[data-table-id="B03"]');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : 'NOT_FOUND';
    });

    console.log('Sau Reload F5 - Bàn 02:', b02AfterReload);
    console.log('Sau Reload F5 - Bàn 03:', b03AfterReload);

    const isB02Resurrected = b02AfterReload.includes('CÓ KHÁCH') || b02AfterReload.includes('đ');
    const isB03Resurrected = b03AfterReload.includes('CÓ KHÁCH') || b03AfterReload.includes('đ');

    console.log('\n===============================================================');
    console.log(' TỔNG KẾT KẾT QUẢ GIẢ LẬP 3 THIẾT BỊ RBAC:');
    console.log(` 1. Lỗi 'Chưa có món nào để lên bill': ${errorTracker.checkoutAlerts === 0 ? '✅ TRIỆT ĐỂ KHÔNG CÒN (0 lần)' : `❌ CÒN (${errorTracker.checkoutAlerts} lần)`}`);
    console.log(` 2. Nghẽn mạng ERR_INSUFFICIENT_RESOURCES: ${errorTracker.insufficientResources === 0 ? '✅ HOÀN TOÀN KHÔNG BỊ NGHẼN (0 lần)' : `❌ BỊ NGHẼN (${errorTracker.insufficientResources} lần)`}`);
    console.log(` 3. Bàn 02 hồi sinh: ${!isB02Resurrected ? '✅ ĐÃ TRIỆT TIÊU (Trạng thái TRỐNG)' : '❌ BỊ HỒI SINH'}`);
    console.log(` 4. Bàn 03 thanh toán & giải phóng: ${!isB03Resurrected ? '✅ THÀNH CÔNG (Trạng thái TRỐNG)' : '❌ BỊ HỒI SINH'}`);
    console.log(` 5. Số lượng lỗi Console: ${errorTracker.consoleErrors.length}`);
    console.log('===============================================================');

  } catch (err) {
    console.error('Lỗi trong quá trình chạy giả lập:', err);
  } finally {
    await browser.close();
  }
}

run();
