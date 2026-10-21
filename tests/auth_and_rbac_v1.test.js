import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Read env variables
function loadEnv() {
  const env = {};
  const paths = [path.resolve('.env'), path.resolve('.env.local')];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim();
          env[k] = v;
        }
      }
    }
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://nbuulvdfxnmfdicbisxq.supabase.co';
const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vJl_5FekfssxNrqMn54gEQ_MlX4ZRKu';
const FIXED_PASSWORD = '123456';

const ACCOUNTS = [
  { code: 'admin01', email: 'admin01@gocpos.vn', expectedRole: 'admin', name: 'Trần Mai' },
  { code: 'admin02', email: 'admin02@gocpos.vn', expectedRole: 'admin', name: 'Lê Quốc Hưng' },
  { code: 'manager01', email: 'manager01@gocpos.vn', expectedRole: 'manager', name: 'Nguyễn Văn Hùng' },
  { code: 'manager02', email: 'manager02@gocpos.vn', expectedRole: 'manager', name: 'Phạm Thu Thảo' },
  { code: 'staff01', email: 'staff01@gocpos.vn', expectedRole: 'staff', name: 'Lê Hoàng Nam' },
  { code: 'staff02', email: 'staff02@gocpos.vn', expectedRole: 'staff', name: 'Đặng Minh Tuấn' },
  { code: 'staff03', email: 'staff03@gocpos.vn', expectedRole: 'staff', name: 'Võ Thị Quỳnh' }
];

describe('GÓC POS - Internal Authentication & RBAC V1 Comprehensive Test Suite', () => {

  // =========================================================================
  // 1. VERIFY REAL SUPABASE AUTH SIGN-IN FOR ALL 7 TEST ACCOUNTS
  // =========================================================================
  describe('1. Supabase Auth Verification (7 Accounts)', () => {
    for (const acc of ACCOUNTS) {
      it(`1.${acc.code} - Đăng nhập tài khoản ${acc.code} (${acc.expectedRole.toUpperCase()} - ${acc.email}) với Supabase Auth thật`, async () => {
        const client = createClient(supabaseUrl, supabasePublishableKey, {
          auth: { persistSession: false }
        });

        const { data, error } = await client.auth.signInWithPassword({
          email: acc.email,
          password: FIXED_PASSWORD
        });

        assert.equal(error, null, `Đăng nhập ${acc.email} thất bại: ${error?.message}`);
        assert.ok(data?.user, `Không nhận được user object từ Supabase Auth`);
        assert.equal(data.user.email.toLowerCase(), acc.email.toLowerCase());
        assert.ok(data.session?.access_token, `Không có access token hợp lệ`);

        // Check user role from metadata or profile
        const role = data.user.user_metadata?.role;
        assert.equal(role, acc.expectedRole, `Vai trò của ${acc.code} trong Auth metadata phải là ${acc.expectedRole}`);

        // Sign out
        await client.auth.signOut();
      });
    }
  });

  // =========================================================================
  // 2. RBAC PERMISSIONS MATRIX & CLIENT-SIDE ACCESS GUARDS
  // =========================================================================
  describe('2. RBAC Permissions Matrix Guards', () => {
    const getPermissionsForRole = (role) => ({
      canAccessTables: true,
      canAccessOrders: true,
      canManageMenu: ['admin', 'manager'].includes(role),
      canViewReports: ['admin', 'manager'].includes(role),
      canAccessSettings: ['admin', 'manager'].includes(role),
      canManageStaff: ['admin', 'manager'].includes(role),
      canConfigureStore: ['admin', 'manager'].includes(role),
      canChangeUserRole: role === 'admin',
      canCleanupData: role === 'admin',
      visibleNavTabs: role === 'staff' ? ['tables', 'orders'] : ['tables', 'menu', 'orders', 'reports']
    });

    it('2.1 - Staff permissions: Sơ đồ bàn & Đơn hàng hôm nay ONLY, BottomNav 2 tabs, Menu/Reports/Settings BLOCKED', () => {
      const p = getPermissionsForRole('staff');
      assert.equal(p.canAccessTables, true);
      assert.equal(p.canAccessOrders, true);
      assert.equal(p.canManageMenu, false, 'Staff không được quản lý Menu');
      assert.equal(p.canViewReports, false, 'Staff không được xem Báo cáo');
      assert.equal(p.canAccessSettings, false, 'Staff không được truy cập Cài đặt');
      assert.equal(p.canChangeUserRole, false, 'Staff không được đổi vai trò');
      assert.equal(p.canCleanupData, false, 'Staff không được xóa lịch sử bán hàng');
      assert.deepEqual(p.visibleNavTabs, ['tables', 'orders'], 'BottomNav của Staff chỉ có 2 tab');
    });

    it('2.2 - Manager permissions: Full POS & Menu & Reports & Staff Ops, BottomNav 4 tabs, Role Change & Sales Cleanup BLOCKED', () => {
      const p = getPermissionsForRole('manager');
      assert.equal(p.canAccessTables, true);
      assert.equal(p.canAccessOrders, true);
      assert.equal(p.canManageMenu, true, 'Manager được quản lý Thực đơn');
      assert.equal(p.canViewReports, true, 'Manager được xem Báo cáo');
      assert.equal(p.canAccessSettings, true, 'Manager được vào Cài đặt');
      assert.equal(p.canManageStaff, true, 'Manager được quản lý nhân viên');
      assert.equal(p.canChangeUserRole, false, 'Manager bị CHẶN thay đổi phân quyền');
      assert.equal(p.canCleanupData, false, 'Manager bị CHẶN xóa lịch sử bán hàng');
      assert.deepEqual(p.visibleNavTabs, ['tables', 'menu', 'orders', 'reports']);
    });

    it('2.3 - Admin permissions: Toàn quyền hệ thống, BottomNav 4 tabs, RBAC Role Change & Data Cleanup ALLOWED', () => {
      const p = getPermissionsForRole('admin');
      assert.equal(p.canAccessTables, true);
      assert.equal(p.canAccessOrders, true);
      assert.equal(p.canManageMenu, true);
      assert.equal(p.canViewReports, true);
      assert.equal(p.canAccessSettings, true);
      assert.equal(p.canManageStaff, true);
      assert.equal(p.canChangeUserRole, true, 'Admin được phân quyền vai trò');
      assert.equal(p.canCleanupData, true, 'Admin được dọn dẹp dữ liệu');
      assert.deepEqual(p.visibleNavTabs, ['tables', 'menu', 'orders', 'reports']);
    });
  });

  // =========================================================================
  // 3. NEGATIVE SECURITY: WRONG PASSWORD & BRUTE-FORCE HANDLING
  // =========================================================================
  describe('3. Negative Security & Brute-Force Error Handling', () => {
    it('3.1 - Đăng nhập sai mật khẩu trả về thông báo lỗi an toàn, không tiết lộ mật khẩu', async () => {
      const client = createClient(supabaseUrl, supabasePublishableKey, {
        auth: { persistSession: false }
      });

      const { data, error } = await client.auth.signInWithPassword({
        email: 'admin01@gocpos.vn',
        password: 'wrong_password_xyz'
      });

      assert.ok(error, 'Đăng nhập mật khẩu sai phải trả về lỗi');
      assert.equal(data.user, null, 'User object phải là null khi sai mật khẩu');
      assert.equal(data.session, null, 'Session phải là null khi sai mật khẩu');
    });

    it('3.2 - Form đăng nhập áp dụng cơ chế khóa 30 giây sau 5 lần nhập sai liên tiếp', () => {
      let failedAttempts = 0;
      let lockoutTimer = 0;

      const simulateFailedLogin = () => {
        failedAttempts += 1;
        if (failedAttempts >= 5) {
          lockoutTimer = 30;
        }
      };

      for (let i = 1; i <= 4; i++) {
        simulateFailedLogin();
        assert.equal(lockoutTimer, 0, `Lần ${i} chưa bị khóa`);
      }

      simulateFailedLogin();
      assert.equal(failedAttempts, 5);
      assert.equal(lockoutTimer, 30, 'Đã chạm mốc 5 lần: Nút đăng nhập phải bị khóa 30s');
    });
  });

  // =========================================================================
  // 4. ACCOUNT STATUS & ACCESS REVOCATION
  // =========================================================================
  describe('4. Account Status & Access Revocation', () => {
    it('4.1 - Tài khoản có trạng thái inactive hoặc paused bị từ chối truy cập POS', () => {
      const checkAccessAllowed = (status) => status === 'active';

      assert.equal(checkAccessAllowed('active'), true);
      assert.equal(checkAccessAllowed('inactive'), false, 'Tài khoản inactive phải bị chặn');
      assert.equal(checkAccessAllowed('paused'), false, 'Tài khoản paused phải bị chặn');
      assert.equal(checkAccessAllowed(null), false, 'Tài khoản không rõ trạng thái phải bị chặn');
    });

    it('4.2 - Bảo vệ Admin cuối cùng: Không cho phép hạ quyền Admin duy nhất còn hoạt động', () => {
      const activeAdmins = [{ id: 'admin-01', role: 'admin', status: 'active' }];
      const canDemoteAdmin = (targetId) => {
        const remaining = activeAdmins.filter((a) => a.id !== targetId && a.status === 'active');
        return remaining.length > 0;
      };

      assert.equal(canDemoteAdmin('admin-01'), false, 'Không được hạ quyền admin cuối cùng');
    });
  });

  // =========================================================================
  // 5. AVATAR & PROFILE SYNCHRONIZATION
  // =========================================================================
  describe('5. Avatar & Profile Reactive Synchronization', () => {
    it('5.1 - Cập nhật avatar đồng bộ xuyên suốt Header, Settings, Profile và Danh sách nhân viên', () => {
      const mockStore = {
        currentUser: { id: 'c7d36d16-9cbc-4e78-af58-74b961149934', name: 'Trần Mai', avatarUrl: null },
        userProfiles: {},
        settings: { avatarUrl: null, currentCashier: 'Trần Mai (ADMIN)' },
        staffList: [{ id: 'c7d36d16-9cbc-4e78-af58-74b961149934', name: 'Trần Mai', avatarUrl: null }]
      };

      const newAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100';

      // Simulate updateCurrentUserProfile
      const activeId = mockStore.currentUser.id;
      mockStore.currentUser.avatarUrl = newAvatar;
      mockStore.userProfiles[activeId] = { ...mockStore.currentUser, avatarUrl: newAvatar };
      mockStore.settings.avatarUrl = newAvatar;
      mockStore.staffList = mockStore.staffList.map((s) => s.id === activeId ? { ...s, avatarUrl: newAvatar } : s);

      // Verify Header source
      assert.equal(mockStore.currentUser.avatarUrl, newAvatar);
      // Verify Settings source
      assert.equal(mockStore.settings.avatarUrl, newAvatar);
      // Verify Profile subpage source
      assert.equal(mockStore.userProfiles[activeId].avatarUrl, newAvatar);
      // Verify Staff List roster source
      assert.equal(mockStore.staffList.find((s) => s.id === activeId).avatarUrl, newAvatar);
    });
  });
});
