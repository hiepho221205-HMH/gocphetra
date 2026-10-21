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

    server.listen(port, () => {
      console.log(`Mobile QA test server running on http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function runMobileRbacEmulation() {
  const server = await startServer(4174);
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const viewports = [
    { name: '360px', width: 360, height: 780 },
    { name: '390px', width: 390, height: 844 },
    { name: '430px', width: 430, height: 932 }
  ];

  try {
    for (const vp of viewports) {
      console.log(`\n============================================================`);
      console.log(`  Emulating RBAC Mobile Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      console.log(`============================================================`);

      const page = await browser.newPage();
      page.on('console', msg => {
        if (msg.type() === 'error' || msg.text().includes('Lỗi') || msg.text().includes('Error')) {
          console.log(`[PAGE ${msg.type().toUpperCase()}]:`, msg.text());
        }
      });
      page.on('pageerror', err => {
        console.error('[PAGE RUNTIME ERROR]:', err);
      });
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
      });

      // Enable QA demo role switcher flag before loading page
      await page.evaluateOnNewDocument(() => {
        window.__ENABLE_DEMO_SWITCHER__ = true;
        try {
          localStorage.removeItem('goc_pos_role_v4');
        } catch (e) {}
      });

      await page.goto('http://localhost:4174', { waitUntil: 'networkidle0' });
      await page.evaluate(() => {
        try {
          localStorage.clear();
        } catch (e) {}
      });
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-testid="shared-page-header"]', { timeout: 6000 });

      // 1. Verify Demo Role Switcher is rendered
      const switcherExists = await page.$('[data-testid="demo-role-switcher"]');
      console.log(`[${vp.name}] Demo Role Switcher rendered: ${Boolean(switcherExists)}`);
      if (!switcherExists) throw new Error('Demo Role Switcher must be rendered when flag is active');

      // 2. Default role is Admin -> 4 tabs in BottomNav
      const adminTabs = await page.$$eval('[data-testid^="bottom-nav-"]', els => els.map(e => e.getAttribute('data-testid')));
      console.log(`[${vp.name}] Admin BottomNav Tabs (${adminTabs.length}): ${adminTabs.join(', ')}`);
      if (adminTabs.length !== 4) {
        throw new Error(`Expected 4 tabs for Admin, found ${adminTabs.length}`);
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `admin_${vp.name}.png`) });

      // 3. ADMIN SETTINGS PAGE VERIFICATION (5 CARDS)
      console.log(`[${vp.name}] Admin opening Settings page...`);
      await page.waitForSelector('[data-testid="header-avatar-button"]', { visible: true });
      await page.evaluate(() => {
        document.querySelector('[data-testid="header-avatar-button"]').click();
      });
      await page.waitForSelector('[data-testid="management-profile-view"]', { timeout: 4000 });

      const adminCardProfile = await page.$('[data-testid="profile-management-nav-card"]');
      const adminCardStaff = await page.$('[data-testid="staff-management-nav-card"]');
      const adminCardStore = await page.$('[data-testid="store-config-nav-card"]');
      const adminCardData = await page.$('[data-testid="data-cleanup-nav-card"]');
      const adminCardRbac = await page.$('[data-testid="rbac-permissions-nav-card"]');

      if (!adminCardProfile || !adminCardStaff || !adminCardStore || !adminCardData || !adminCardRbac) {
        throw new Error('Admin must see all 5 cards in Settings: Profile, Staff, Store, Data Cleanup, RBAC');
      }
      console.log(`[${vp.name}] ✅ Admin Settings correctly displays all 5 Cards!`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `admin_settings_${vp.name}.png`) });

      // Admin navigates into Staff Management Hub
      console.log(`[${vp.name}] Admin opening Staff Management Hub (/staff)...`);
      await page.evaluate(() => {
        document.querySelector('[data-testid="staff-management-nav-card"]').click();
      });
      await page.waitForSelector('[data-testid="staff-management-redesigned-section"]', { timeout: 4000 });

      const kpiTotal = await page.$('[data-testid="kpi-total-staff"]');
      const kpiActive = await page.$('[data-testid="kpi-active-staff"]');
      const kpiPaused = await page.$('[data-testid="kpi-paused-staff"]');
      const cardList = await page.$('[data-testid="nav-staff-list-card"]');
      const cardCreate = await page.$('[data-testid="nav-staff-create-card"]');

      if (!kpiTotal || !kpiActive || !kpiPaused || !cardList || !cardCreate) {
        throw new Error('Admin must see 3 KPI cards and 2 vivid functional navigation cards on /staff Hub');
      }
      console.log(`[${vp.name}] ✅ Admin Staff Management Hub displays 3 KPI cards & 2 Vivid Functional Cards!`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `admin_staff_hub_${vp.name}.png`) });

      // Admin opens Page 1: Danh sách nhân viên (/staff/list)
      console.log(`[${vp.name}] Admin navigating to Staff List Page (/staff/list)...`);
      await page.evaluate(() => {
        document.querySelector('[data-testid="nav-staff-list-card"]').click();
      });
      await page.waitForSelector('[data-testid="staff-list-page"]', { timeout: 3000 });
      const searchInput = await page.$('[data-testid="staff-search-input"]');
      const rosterList = await page.$('[data-testid="staff-roster-list"]');
      const duplicateAddBtn = await page.$('[data-testid="staff-list-add-btn"]');

      if (!searchInput || !rosterList) {
        throw new Error('Staff List page must display search input and roster list');
      }
      if (duplicateAddBtn !== null) {
        throw new Error('Staff List Header must NOT contain duplicate + Thêm NV button');
      }
      console.log(`[${vp.name}] ✅ Verified: Duplicate + Thêm NV button is completely removed from /staff/list!`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `admin_staff_list_${vp.name}.png`) });

      // Test Delete Staff Modal on staff-03
      console.log(`[${vp.name}] Admin testing Delete Staff Modal on staff-03...`);
      await page.evaluate(() => {
        document.querySelector('[data-testid="delete-staff-btn-staff-03"]').click();
      });
      await page.waitForSelector('[data-testid="delete-staff-modal-container"]', { timeout: 3000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `admin_staff_delete_modal_${vp.name}.png`) });

      // Cancel modal
      await page.evaluate(() => {
        document.querySelector('[data-testid="cancel-delete-staff-btn"]').click();
      });
      await new Promise(r => setTimeout(r, 200));

      // Return to Hub /staff from /staff/list
      console.log(`[${vp.name}] Admin clicking Back from /staff/list to /staff...`);
      await page.evaluate(() => {
        document.querySelector('[data-testid="staff-list-back-btn"]').click();
      });
      await page.waitForSelector('[data-testid="staff-management-redesigned-section"]', { timeout: 3000 });
      console.log(`[${vp.name}] ✅ Successfully returned to /staff Hub from /staff/list!`);

      // Admin opens Page 2: Thêm nhân viên (/staff/create)
      console.log(`[${vp.name}] Admin navigating to Staff Create Page (/staff/create)...`);
      await page.evaluate(() => {
        document.querySelector('[data-testid="nav-staff-create-card"]').click();
      });
      await page.waitForSelector('[data-testid="staff-create-page"]', { timeout: 3000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `admin_staff_add_form_${vp.name}.png`) });

      // Test Dirty Form Confirmation Modal:
      console.log(`[${vp.name}] Testing Dirty Form Confirmation Modal on /staff/create...`);
      await page.type('[data-testid="staff-input-name"]', 'Võ Thị Sáu');
      await page.evaluate(() => {
        document.querySelector('[data-testid="cancel-staff-form-top-btn"]').click();
      });
      await page.waitForSelector('[data-testid="unsaved-changes-modal"]', { timeout: 3000 });
      console.log(`[${vp.name}] ✅ Unsaved changes modal appeared correctly on dirty form exit!`);

      // Test 'Ở lại chỉnh sửa' (Stay)
      await page.evaluate(() => {
        document.querySelector('[data-testid="stay-on-form-btn"]').click();
      });
      await new Promise(r => setTimeout(r, 200));

      // Test 'Hủy thay đổi' (Discard) -> Returns directly to /staff
      console.log(`[${vp.name}] Confirming discard changes and verifying return to /staff...`);
      await page.evaluate(() => {
        document.querySelector('[data-testid="cancel-staff-form-top-btn"]').click();
      });
      await page.waitForSelector('[data-testid="unsaved-changes-modal"]', { timeout: 3000 });
      await page.evaluate(() => {
        document.querySelector('[data-testid="confirm-discard-changes-btn"]').click();
      });
      await page.waitForSelector('[data-testid="staff-management-redesigned-section"]', { timeout: 3000 });
      console.log(`[${vp.name}] ✅ Returned strictly to /staff Hub (NOT /staff/list)!`);

      // Return to main Settings
      await page.evaluate(() => {
        document.querySelector('[data-testid="staff-subpage-back-btn"]').click();
      });
      await page.waitForSelector('[data-testid="management-profile-view"]', { timeout: 4000 });

      // Return to main tables
      await page.evaluate(() => {
        document.querySelector('[data-testid="settings-back-button"]').click();
      });
      await page.waitForSelector('[data-testid="shared-page-header"]', { timeout: 4000 });

      // 4. MANAGER ROLE VERIFICATION (3 CARDS)
      console.log(`[${vp.name}] Switching to Manager role...`);
      await page.click('[data-testid="demo-switch-to-manager-btn"]');
      await new Promise(r => setTimeout(r, 600));

      const managerTabs = await page.$$eval('[data-testid^="bottom-nav-"]', els => els.map(e => e.getAttribute('data-testid')));
      console.log(`[${vp.name}] Manager BottomNav Tabs (${managerTabs.length}): ${managerTabs.join(', ')}`);
      if (managerTabs.length !== 4) {
        throw new Error(`Expected 4 tabs for Manager, got ${managerTabs.length}`);
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `manager_${vp.name}.png`) });

      // Manager Settings Page
      console.log(`[${vp.name}] Manager opening Settings page...`);
      await page.waitForSelector('[data-testid="header-avatar-button"]', { visible: true });
      await page.evaluate(() => {
        document.querySelector('[data-testid="header-avatar-button"]').click();
      });
      await page.waitForSelector('[data-testid="management-profile-view"]', { timeout: 4000 });

      const mgrCardProfile = await page.$('[data-testid="profile-management-nav-card"]');
      const mgrCardStaff = await page.$('[data-testid="staff-management-nav-card"]');
      const mgrCardStore = await page.$('[data-testid="store-config-nav-card"]');
      const mgrCardData = await page.$('[data-testid="data-cleanup-nav-card"]');
      const mgrCardRbac = await page.$('[data-testid="rbac-permissions-nav-card"]');

      if (!mgrCardProfile || !mgrCardStaff || !mgrCardStore) {
        throw new Error('Manager must see Profile, Staff, and Store Config cards');
      }
      if (mgrCardData !== null) {
        throw new Error('Manager must NOT see Data Cleanup card');
      }
      if (mgrCardRbac !== null) {
        throw new Error('Manager must NOT see RBAC card');
      }
      console.log(`[${vp.name}] ✅ Manager Settings correctly displays 3 Cards (Profile, Staff, Store) and hides Data/RBAC!`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `manager_settings_${vp.name}.png`) });

      // Check Manager in Staff Hub & List
      console.log(`[${vp.name}] Manager opening Staff Management Hub (/staff)...`);
      await page.evaluate(() => {
        document.querySelector('[data-testid="staff-management-nav-card"]').click();
      });
      await page.waitForSelector('[data-testid="staff-management-redesigned-section"]', { timeout: 3000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `manager_staff_hub_${vp.name}.png`) });

      // Manager opens Staff List Page
      console.log(`[${vp.name}] Manager opening Staff List Page (/staff/list)...`);
      await page.evaluate(() => {
        document.querySelector('[data-testid="nav-staff-list-card"]').click();
      });
      await page.waitForSelector('[data-testid="staff-list-page"]', { timeout: 3000 });

      // Manager MUST NOT see Delete button and MUST see locked Admin indicator
      const mgrDeleteBtn = await page.$('[data-testid="delete-staff-btn-staff-03"]');
      const lockedAdminIndicator = await page.$('[data-testid="locked-admin-indicator-staff-01"]');

      if (mgrDeleteBtn !== null) {
        throw new Error('Manager must NOT see Delete Staff button');
      }
      if (!lockedAdminIndicator) {
        throw new Error('Manager must see locked Admin indicator and not be able to modify Admin account');
      }
      console.log(`[${vp.name}] ✅ Manager strictly blocked from Delete action and Admin modification!`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `manager_staff_subpage_${vp.name}.png`) });

      // Return to Staff Hub, then main settings, then to tables
      await page.evaluate(() => {
        document.querySelector('[data-testid="staff-list-back-btn"]').click();
      });
      await page.waitForSelector('[data-testid="staff-management-redesigned-section"]', { timeout: 3000 });
      await page.evaluate(() => {
        document.querySelector('[data-testid="staff-subpage-back-btn"]').click();
      });
      await page.waitForSelector('[data-testid="management-profile-view"]', { timeout: 3000 });
      await page.evaluate(() => {
        document.querySelector('[data-testid="settings-back-button"]').click();
      });
      await page.waitForSelector('[data-testid="shared-page-header"]', { timeout: 3000 });

      // 5. STAFF ROLE VERIFICATION (1 CARD)
      console.log(`[${vp.name}] Switching to Staff role...`);
      await page.click('[data-testid="demo-switch-to-staff-btn"]');
      await new Promise(r => setTimeout(r, 600));

      const staffTabs = await page.$$eval('[data-testid^="bottom-nav-"]', els => els.map(e => e.getAttribute('data-testid')));
      console.log(`[${vp.name}] Staff BottomNav Tabs (${staffTabs.length}): ${staffTabs.join(', ')}`);
      if (staffTabs.length !== 2) {
        throw new Error(`Expected 2 tabs for Staff (tables, orders), got ${staffTabs.length}`);
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `staff_${vp.name}.png`) });

      // Staff Settings Page
      console.log(`[${vp.name}] Staff opening Settings page...`);
      await page.waitForSelector('[data-testid="header-avatar-button"]', { visible: true });
      await page.evaluate(() => {
        document.querySelector('[data-testid="header-avatar-button"]').click();
      });
      await page.waitForSelector('[data-testid="management-profile-view"]', { timeout: 4000 });

      const staffCardProfile = await page.$('[data-testid="profile-management-nav-card"]');
      const staffCardStaff = await page.$('[data-testid="staff-management-nav-card"]');
      const staffCardStore = await page.$('[data-testid="store-config-nav-card"]');
      const staffCardData = await page.$('[data-testid="data-cleanup-nav-card"]');
      const staffCardRbac = await page.$('[data-testid="rbac-permissions-nav-card"]');

      if (!staffCardProfile) {
        throw new Error('Staff must see Profile Management card');
      }
      if (staffCardStaff !== null || staffCardStore !== null || staffCardData !== null || staffCardRbac !== null) {
        throw new Error('Staff must NOT see Staff, Store, Data, or RBAC cards');
      }
      console.log(`[${vp.name}] ✅ Staff Settings correctly displays ONLY 1 Card (Profile Management)!`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `staff_settings_${vp.name}.png`) });

      // Staff opens Profile Edit subpage
      console.log(`[${vp.name}] Staff opening Profile Edit subpage...`);
      await page.evaluate(() => {
        document.querySelector('[data-testid="profile-management-nav-card"]').click();
      });
      await page.waitForSelector('[data-testid="profile-edit-subpage"]', { timeout: 3000 });

      const roleBadge = await page.$('[data-testid="profile-role-badge"]');
      if (!roleBadge) throw new Error('Profile Edit subpage must render locked role badge');
      console.log(`[${vp.name}] ✅ Profile Edit subpage rendered with locked role badge!`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `staff_profile_edit_${vp.name}.png`) });

      // Return to main settings, then to tables
      await page.evaluate(() => {
        document.querySelector('[data-testid="profile-edit-back-btn"]').click();
      });
      await page.waitForSelector('[data-testid="management-profile-view"]', { timeout: 3000 });
      await page.evaluate(() => {
        document.querySelector('[data-testid="settings-back-button"]').click();
      });
      await page.waitForSelector('[data-testid="shared-page-header"]', { timeout: 3000 });
      await page.waitForSelector('[data-testid="shared-page-header"]', { timeout: 3000 });

      // 6. Staff attempts unauthorized route #reports
      console.log(`[${vp.name}] Staff testing unauthorized route #reports...`);
      await page.evaluate(() => { window.location.hash = '#reports'; });
      await new Promise(r => setTimeout(r, 400));

      const accessDenied = await page.$('[data-testid="access-denied-view"]');
      console.log(`[${vp.name}] AccessDeniedView rendered on #reports: ${Boolean(accessDenied)}`);
      if (!accessDenied) {
        throw new Error('AccessDeniedView must be rendered when Staff accesses #reports');
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `staff_denied_${vp.name}.png`) });

      console.log(`[${vp.name}] ✅ All RBAC Mobile UI checks PASSED!`);
      await page.close();
    }

    console.log('\n============================================================');
    console.log('  ALL MOBILE RBAC EMULATION TESTS (360/390/430px) PASSED!');
    console.log('============================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

runMobileRbacEmulation().catch((err) => {
  console.error('❌ Mobile RBAC Emulation Error:', err);
  process.exit(1);
});
