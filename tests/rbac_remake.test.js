import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_STAFF, DEMO_ACCOUNTS } from '../src/data/initialData.js';
import { getTabFromRoute, parseRouteFromLocation } from '../src/utils/router.js';

describe('GÓC POS — RBAC Module Remake Unit & Integration Tests', () => {

  // Mock Context Simulator for RBAC Remake
  class RbacRemakeSimulator {
    constructor(currentRole = 'admin') {
      this.currentRole = currentRole;
      this.currentUser = DEMO_ACCOUNTS[currentRole] || DEMO_ACCOUNTS.admin;
      this.staffList = JSON.parse(JSON.stringify(INITIAL_STAFF));
      this.userProfiles = {
        'staff-01': { id: 'staff-01', name: 'Nguyễn Văn Quản Trị', role: 'admin', phone: '0901234567', email: 'admin@gocpos.vn' },
        'staff-02': { id: 'staff-02', name: 'Trần Thị Quản Lý', role: 'manager', phone: '0912345678', email: 'manager@gocpos.vn' },
        'staff-03': { id: 'staff-03', name: 'Lê Văn Thu Ngân', role: 'staff', phone: '0923456789', email: 'cashier@gocpos.vn' }
      };
      this.auditLogs = [];
    }

    get canChangeUserRole() {
      return this.currentRole === 'admin';
    }

    // 4 KPI computation
    get stats() {
      const total = this.staffList.length;
      const adminCount = this.staffList.filter((s) => s.role === 'admin').length;
      const managerCount = this.staffList.filter((s) => s.role === 'manager').length;
      const staffCount = this.staffList.filter((s) => s.role === 'staff').length;
      return { total, adminCount, managerCount, staffCount };
    }

    // Search and filter
    filterStaff(searchTerm = '', roleFilter = 'all', statusFilter = 'all') {
      return this.staffList.filter((staff) => {
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase();
          const profile = this.userProfiles[staff.id] || {};
          const nameMatch = staff.name?.toLowerCase().includes(query);
          const idMatch = staff.id?.toLowerCase().includes(query);
          const phoneMatch = (staff.phone || profile.phone || '').toLowerCase().includes(query);
          const emailMatch = (staff.email || profile.email || '').toLowerCase().includes(query);
          if (!nameMatch && !idMatch && !phoneMatch && !emailMatch) return false;
        }

        if (roleFilter !== 'all' && staff.role !== roleFilter) return false;
        if (statusFilter !== 'all' && staff.status !== statusFilter) return false;
        return true;
      });
    }

    // Role change with safeguard & audit log
    changeUserRole(targetStaffId, newRole, note = '') {
      if (!this.canChangeUserRole) {
        throw new Error('403 Forbidden: Chỉ Quản trị viên (Admin) mới có quyền đổi vai trò nhân sự.');
      }

      if (!['admin', 'manager', 'staff'].includes(newRole)) {
        throw new Error('Vai trò không hợp lệ');
      }

      const target = this.staffList.find((s) => s.id === targetStaffId);
      if (!target) {
        throw new Error('Không tìm thấy nhân viên');
      }

      // Safeguard: Prevent demoting last Admin
      if (target.role === 'admin' && newRole !== 'admin') {
        const remainingAdmins = this.staffList.filter(
          (s) => s.id !== targetStaffId && s.role === 'admin' && s.status === 'active'
        );
        if (remainingAdmins.length === 0) {
          throw new Error('Hành động bị chặn: Không thể hạ quyền tài khoản Admin duy nhất của hệ thống!');
        }
      }

      const oldRole = target.role;
      target.role = newRole;
      target.updatedAt = new Date().toISOString();

      if (this.userProfiles[targetStaffId]) {
        this.userProfiles[targetStaffId].role = newRole;
      }

      const newAuditLog = {
        id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: this.currentUser?.id || 'admin-local',
        performedBy: this.currentUser?.name || 'Quản trị viên',
        role: this.currentRole,
        action: 'role_change',
        resource: 'user_roles',
        resourceId: targetStaffId,
        details: {
          targetName: target.name,
          oldRole,
          newRole,
          note: note ? note.trim() : '',
          changedAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString()
      };
      this.auditLogs.unshift(newAuditLog);

      return { success: true, targetId: targetStaffId, oldRole, newRole };
    }
  }

  // =========================================================================
  // 1. KPI THỐNG KÊ & TÌM KIẾM, BỘ LỌC
  // =========================================================================
  it('1.1 - Computes 4 KPI statistics (Tổng NV, Admin, Manager, Staff) accurately', () => {
    const sim = new RbacRemakeSimulator('admin');
    const { total, adminCount, managerCount, staffCount } = sim.stats;

    assert.equal(total, sim.staffList.length, 'Total staff count matches roster');
    assert.equal(adminCount, 1, 'Initial seeded Admin count is 1');
    assert.equal(managerCount, 1, 'Initial seeded Manager count is 1');
    assert.equal(staffCount, sim.staffList.length - 2, 'Initial seeded Staff count matches');
    assert.equal(adminCount + managerCount + staffCount, total, 'Sum of roles equals total');
  });

  it('1.2 - Search filters roster by name, staff ID, phone number, and email', () => {
    const sim = new RbacRemakeSimulator('admin');

    // Search by name
    const byName = sim.filterStaff('Trần Mai');
    assert.equal(byName.length, 1);
    assert.equal(byName[0].id, 'staff-01');

    // Search by ID
    const byId = sim.filterStaff('staff-02');
    assert.equal(byId.length, 1);
    assert.equal(byId[0].id, 'staff-02');

    // Search by phone
    const byPhone = sim.filterStaff('0987654321');
    assert.equal(byPhone.length, 1);
    assert.equal(byPhone[0].id, 'staff-03');

    // Search by email
    const byEmail = sim.filterStaff('admin@gocpos.vn');
    assert.equal(byEmail.length, 1);
    assert.equal(byEmail[0].id, 'staff-01');
  });

  it('1.3 - Dual-layer filters (Role and Status) narrow results correctly', () => {
    const sim = new RbacRemakeSimulator('admin');

    // Role filter
    const adminsOnly = sim.filterStaff('', 'admin', 'all');
    assert.ok(adminsOnly.every((s) => s.role === 'admin'));

    const managersOnly = sim.filterStaff('', 'manager', 'all');
    assert.ok(managersOnly.every((s) => s.role === 'manager'));

    // Status filter
    const activeOnly = sim.filterStaff('', 'all', 'active');
    assert.ok(activeOnly.every((s) => s.status === 'active'));

    // Combined filter
    const activeStaff = sim.filterStaff('', 'staff', 'active');
    assert.ok(activeStaff.every((s) => s.role === 'staff' && s.status === 'active'));
  });

  // =========================================================================
  // 2. THAY ĐỔI VAI TRÒ, GHI CHÚ & ĐỒNG BỘ PROFILE
  // =========================================================================
  it('2.1 - Admin promotes Staff to Manager with note, updates roster, userProfiles and auditLogs', () => {
    const sim = new RbacRemakeSimulator('admin');
    const result = sim.changeUserRole('staff-03', 'manager', 'Thăng cấp Quản lý ca tối');

    assert.ok(result.success);
    assert.equal(result.oldRole, 'staff');
    assert.equal(result.newRole, 'manager');

    // Verify staffList
    const staff3 = sim.staffList.find((s) => s.id === 'staff-03');
    assert.equal(staff3.role, 'manager');

    // Verify userProfiles sync
    assert.equal(sim.userProfiles['staff-03'].role, 'manager');

    // Verify Audit Log
    assert.equal(sim.auditLogs.length, 1);
    const log = sim.auditLogs[0];
    assert.equal(log.action, 'role_change');
    assert.equal(log.resourceId, 'staff-03');
    assert.equal(log.details.oldRole, 'staff');
    assert.equal(log.details.newRole, 'manager');
    assert.equal(log.details.note, 'Thăng cấp Quản lý ca tối');

    // Verify KPI reflects the promotion
    const newStats = sim.stats;
    assert.equal(newStats.managerCount, 2);
    assert.equal(newStats.staffCount, sim.staffList.length - 3);
  });

  it('2.2 - System SAFEGUARD: Demoting the last remaining active Admin is strictly blocked', () => {
    const sim = new RbacRemakeSimulator('admin');
    // staff-01 is the only Admin
    assert.equal(sim.staffList.filter((s) => s.role === 'admin').length, 1);

    assert.throws(() => {
      sim.changeUserRole('staff-01', 'manager', 'Thử hạ quyền admin cuối cùng');
    }, /Hành động bị chặn: Không thể hạ quyền tài khoản Admin duy nhất của hệ thống!/);

    // staff-01 remains Admin
    assert.equal(sim.staffList.find((s) => s.id === 'staff-01').role, 'admin');
  });

  // =========================================================================
  // 3. ZERO-TRUST RBAC ACCESS GUARDS
  // =========================================================================
  it('3.1 - Manager and Staff are STRICTLY BLOCKED from changing roles', () => {
    const simManager = new RbacRemakeSimulator('manager');
    assert.throws(() => {
      simManager.changeUserRole('staff-03', 'admin');
    }, /403 Forbidden/);

    const simStaff = new RbacRemakeSimulator('staff');
    assert.throws(() => {
      simStaff.changeUserRole('staff-02', 'admin');
    }, /403 Forbidden/);
  });

  it('3.2 - getTabFromRoute maps /rbac* routes to "settings" tab on bottom bar', () => {
    assert.equal(getTabFromRoute('/rbac'), 'settings');
    assert.equal(getTabFromRoute('/rbac/detail'), 'settings');
    assert.equal(getTabFromRoute('/rbac/role'), 'settings');
    assert.equal(getTabFromRoute('/rbac/audit'), 'settings');
  });

  // =========================================================================
  // 4. UI ARCHITECTURE & SCOPE COMPLIANCE CONTRACTS
  // =========================================================================
  it('4.1 - Scope Contract: Quick Action Menu (4) and Account Deletion Popup (5) are NOT implemented', () => {
    const rbacMainPath = path.resolve('src/components/rbac/RbacMainPage.jsx');
    const rbacMainContent = fs.readFileSync(rbacMainPath, 'utf8');

    // Quick action menu modal should not exist in RbacMainPage
    assert.ok(!rbacMainContent.includes('QuickActionMenu'), 'QuickActionMenu is not included');
    assert.ok(!rbacMainContent.includes('DeleteAccountModal'), 'DeleteAccountModal is not included');
  });

  it('4.2 - Legacy Matrix Deletion: Obsolete 3-role comparison table is removed from UI render', () => {
    const rbacMainPath = path.resolve('src/components/rbac/RbacMainPage.jsx');
    const rbacMainContent = fs.readFileSync(rbacMainPath, 'utf8');

    assert.ok(!rbacMainContent.includes('Bảng đối chiếu Ma trận Quyền hạn 3 Vai trò'), 'Obsolete comparison matrix removed');
    assert.ok(!rbacMainContent.includes('isMatrixExpanded'), 'Obsolete expandable matrix removed');
  });

  it('4.3 - Card styling contract: Cards use full-width box-border without touch-target inline-flex distortion', () => {
    const rbacMainPath = path.resolve('src/components/rbac/RbacMainPage.jsx');
    const rbacMainContent = fs.readFileSync(rbacMainPath, 'utf8');

    assert.ok(rbacMainContent.includes('w-full box-border min-h-[64px]'), 'Card has full width and min-height');
    assert.ok(!rbacMainContent.includes('touch-target btn-press bg-white rounded-2xl'), 'Card does not use touch-target inline-flex');
  });

  it('4.4 - Staff Detail UI Contract: "Sửa thông tin" button is completely removed', () => {
    const detailPath = path.resolve('src/components/rbac/StaffDetailSubpage.jsx');
    const detailContent = fs.readFileSync(detailPath, 'utf8');

    assert.ok(!detailContent.includes('detail-edit-profile-btn'), 'Edit profile button is removed');
    assert.ok(!detailContent.includes('Sửa thông tin'), 'Edit profile label is removed');
  });

  it('4.5 - Sole Admin Safeguard UI Contract: Role change is prevented/hidden for sole active Admin', () => {
    const detailPath = path.resolve('src/components/rbac/StaffDetailSubpage.jsx');
    const detailContent = fs.readFileSync(detailPath, 'utf8');

    assert.ok(detailContent.includes('isSoleAdmin'), 'isSoleAdmin guard is implemented');
    assert.ok(detailContent.includes('sole-admin-notice-badge'), 'Sole admin notice badge is rendered');
    assert.ok(detailContent.includes('h-12 min-h-[48px] max-h-[52px]'), 'Change role button has 48-52px height');
  });

  it('4.6 - Back Navigation Contract: ManagementProfileView synchronizes currentView on /settings', () => {
    const mgmtPath = path.resolve('src/components/management/ManagementProfileView.jsx');
    const mgmtContent = fs.readFileSync(mgmtPath, 'utf8');

    assert.ok(mgmtContent.includes("if (currentRoute === '/settings')"), 'Syncs currentView to main on /settings');
    assert.ok(mgmtContent.includes('RbacMainPage onBack='), 'Passes onBack handler to RbacMainPage');
  });
});
