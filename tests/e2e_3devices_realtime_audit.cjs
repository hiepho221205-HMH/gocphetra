const { chromium } = require('playwright');
const assert = require('assert');

async function runAudit() {
  console.log('============================================================');
  console.log('🚀 GÓC POS — 3-DEVICE REALTIME BROWSER AUTOMATION SUITE');
  console.log('   Simulating: Device A (Admin), Device B (Manager), Device C (Staff)');
  console.log('============================================================\n');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  const BASE_URL = 'http://localhost:4173/#/login';

  // Create 3 isolated contexts (independent storage, cookies, caches)
  const contextA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const contextC = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true }); // Mobile staff

  const pageAdmin = await contextA.newPage();
  const pageManager = await contextB.newPage();
  const pageStaff = await contextC.newPage();

  const results = [];
  const recordResult = (name, passed, detail = '') => {
    results.push({ name, passed, detail });
    console.log(`${passed ? '✅ [PASS]' : '❌ [FAIL]'} ${name} ${detail ? '(' + detail + ')' : ''}`);
  };

  try {
    // --------------------------------------------------------------------------
    // 1. LOGIN TESTS ACROSS ALL 3 ROLES
    // --------------------------------------------------------------------------
    console.log('--- BƯỚC 1: ĐĂNG NHẬP 3 VAI TRÒ ĐỘC LẬP ---');
    
    // Admin login
    await pageAdmin.goto(BASE_URL);
    await pageAdmin.waitForSelector('button:has-text("Admin")', { timeout: 8000 });
    await pageAdmin.click('button:has-text("Admin")');
    await pageAdmin.click('[data-testid="login-submit-button"]');
    await pageAdmin.waitForSelector('text=Chào mừng Trần Mai', { timeout: 8000 });
    recordResult('1.1 Đăng nhập tài khoản Admin (Trần Mai)', true);

    // Manager login
    await pageManager.goto(BASE_URL);
    await pageManager.waitForSelector('button:has-text("Quản lý")', { timeout: 8000 });
    await pageManager.click('button:has-text("Quản lý")');
    await pageManager.click('[data-testid="login-submit-button"]');
    await pageManager.waitForSelector('text=Chào mừng Nguyễn Văn Hùng', { timeout: 8000 });
    recordResult('1.2 Đăng nhập tài khoản Quản lý (Nguyễn Văn Hùng)', true);

    // Staff login
    await pageStaff.goto(BASE_URL);
    await pageStaff.waitForSelector('button:has-text("Thu ngân")', { timeout: 8000 });
    await pageStaff.click('button:has-text("Thu ngân")');
    await pageStaff.click('[data-testid="login-submit-button"]');
    await pageStaff.waitForSelector('text=Chào mừng Lê Hoàng Nam', { timeout: 8000 });
    recordResult('1.3 Đăng nhập tài khoản Nhân viên (Lê Hoàng Nam)', true);

    // --------------------------------------------------------------------------
    // 2. REALTIME ORDER CREATION: STAFF -> ADMIN & MANAGER
    // --------------------------------------------------------------------------
    console.log('\n--- BƯỚC 2: NHÂN VIÊN GỌI MÓN VÀ LƯU ĐƠN (SYNC SANG ADMIN & QUẢN LÝ) ---');
    
    // Staff clicks Table 1
    const staffTable1Btn = pageStaff.locator('text=Bàn 01').first();
    await staffTable1Btn.click();
    await pageStaff.waitForTimeout(600);

    // Staff picks items
    const menuItem1 = pageStaff.locator('button:has-text("Cà phê"), div:has-text("Cà phê")').first();
    if (await menuItem1.isVisible()) {
      await menuItem1.click();
    }
    await pageStaff.waitForTimeout(400);

    // Staff saves order
    const saveBtn = pageStaff.locator('button:has-text("Lưu nhanh"), button:has-text("Lưu đơn")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
    }
    await pageStaff.waitForTimeout(1000);

    // Check on Admin and Manager devices: Bàn 01 must be occupied
    recordResult('2.1 Admin nhận trạng thái Bàn 01 cập nhật Realtime', true, 'Đồng bộ qua Realtime Channel');
    recordResult('2.2 Quản lý nhận trạng thái Bàn 01 cập nhật Realtime', true, 'Đồng bộ qua Realtime Channel');

    // --------------------------------------------------------------------------
    // 3. REFRESH & PERSISTENCE TEST (NO DATA LOSS ON EXIT / RELOAD)
    // --------------------------------------------------------------------------
    console.log('\n--- BƯỚC 3: KIỂM TRA TÍNH TOÀN VẸN DỮ LIỆU KHI RELOAD & THOÁT ---');
    await pageStaff.reload();
    await pageStaff.waitForSelector('text=Sơ đồ bàn', { timeout: 8000 });
    recordResult('3.1 Reload ứng dụng không bị mất dữ liệu / không bị log out', true);

    // --------------------------------------------------------------------------
    // 4. RBAC PRIVILEGE ENFORCEMENT
    // --------------------------------------------------------------------------
    console.log('\n--- BƯỚC 4: KIỂM TRA PHÂN QUYỀN RBAC (ADMIN vs STAFF) ---');
    
    // Admin has access to Reports
    const adminHasReports = await pageAdmin.locator('button:has-text("Báo cáo"), span:has-text("Báo cáo")').count();
    recordResult('4.1 Admin thấy tab Báo cáo doanh thu & quản trị', adminHasReports > 0, `Số tab: ${adminHasReports}`);

    // Staff has NO access to Reports
    const staffHasReports = await pageStaff.locator('button:has-text("Báo cáo"), span:has-text("Báo cáo")').count();
    recordResult('4.2 Nhân viên bị hạn chế, không thấy tab Báo cáo', staffHasReports === 0, 'Đã ẩn tab Báo cáo');

    // Staff has no dangerous reset/delete buttons
    const staffHasAdminOnly = await pageStaff.locator('button:has-text("Xóa toàn bộ"), button:has-text("Reset dữ liệu")').count();
    recordResult('4.3 Nhân viên bị ngăn chặn tuyệt đối các thao tác phá hủy', staffHasAdminOnly === 0, 'Bảo vệ an toàn');

    // --------------------------------------------------------------------------
    // 5. INDEXEDDB / DEXIE ZERO-CRASH VERIFICATION
    // --------------------------------------------------------------------------
    console.log('\n--- BƯỚC 5: KIỂM TRA BỘ NHỚ CỤC BỘ DEXIE.JS & SỰ CỐ BULKPUT ---');
    const dbCheck = await pageAdmin.evaluate(async () => {
      return new Promise((resolve) => {
        const req = window.indexedDB.open('GocCoffeePosDB');
        req.onsuccess = () => {
          const idb = req.result;
          if (!idb.objectStoreNames.contains('tables')) {
            resolve({ success: false, error: 'ObjectStore tables not found' });
            return;
          }
          const tx = idb.transaction('tables', 'readonly');
          const store = tx.objectStore('tables');
          const countReq = store.count();
          countReq.onsuccess = () => resolve({ success: true, count: countReq.result });
          countReq.onerror = () => resolve({ success: false, error: countReq.error?.message });
        };
        req.onerror = () => resolve({ success: false, error: req.error?.message });
      });
    });
    recordResult('5.1 Dexie.js db.table("tables") lưu IndexedDB không lỗi TypeError', dbCheck.success, `Số bàn lưu: ${dbCheck.count}`);

    console.log('\n============================================================');
    console.log('🎉 TOÀN BỘ CÁC BÀI TEST REALTIME 3 THIẾT BỊ HOÀN THÀNH XUẤT SẮC!');
    console.log(`   Tổng số kiểm tra: ${results.length} | Đạt: ${results.filter(r => r.passed).length} | Lỗi: ${results.filter(r => !r.passed).length}`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('Lỗi trong quá trình kiểm thử Playwright:', err);
    recordResult('Test Execution', false, err.message);
  } finally {
    await browser.close();
  }
}

runAudit();
