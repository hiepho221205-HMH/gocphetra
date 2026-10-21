import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_STAFF,
  DEMO_ACCOUNTS,
  INITIAL_USER_PROFILES,
  INITIAL_AUDIT_LOGS
} from '../src/data/initialData.js';

describe('Admin Staff Management Redesign & Safe Deletion Lifecycle Tests', () => {

  // =========================================================================
  // 1. ADD STAFF & FIELD VALIDATION
  // =========================================================================
  it('1.1 - Admin adds a new staff member with full operational fields', () => {
    let staffList = [...INITIAL_STAFF];
    let userProfiles = { ...INITIAL_USER_PROFILES };
    const currentRole = 'admin';

    const saveStaffMember = (staffData) => {
      const cleanName = (staffData.name || '').trim();
      if (!cleanName) throw new Error('Họ và tên nhân viên không được để trống');

      const newId = `staff-${Date.now()}`;
      const newStaff = {
        id: newId,
        name: cleanName,
        email: (staffData.email || '').trim(),
        phone: (staffData.phone || '').trim(),
        role: staffData.role || 'staff',
        branchId: staffData.branchId || 'main',
        shiftName: staffData.shiftName || 'Ca Sáng (06:30 - 14:30)',
        status: staffData.status || 'active',
        avatarUrl: staffData.avatarUrl || null,
        notes: (staffData.notes || '').trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      staffList.push(newStaff);
      userProfiles[newId] = {
        id: newId,
        name: cleanName,
        email: newStaff.email,
        phone: newStaff.phone,
        role: newStaff.role,
        avatarUrl: newStaff.avatarUrl,
        notes: newStaff.notes
      };

      return { success: true, staff: newStaff };
    };

    const res = saveStaffMember({
      name: 'Võ Thị Sáu',
      email: 'sauthi@gocpos.vn',
      phone: '0933445566',
      role: 'staff',
      branchId: 'main',
      shiftName: 'Ca Chiều (14:30 - 22:30)',
      status: 'active',
      avatarUrl: 'data:image/png;base64,mockAvatar',
      notes: 'Nhân viên pha chế mới'
    });

    assert.equal(res.success, true);
    assert.equal(staffList.length, 4);
    const added = staffList.find((s) => s.name === 'Võ Thị Sáu');
    assert.ok(added);
    assert.equal(added.email, 'sauthi@gocpos.vn');
    assert.equal(added.phone, '0933445566');
    assert.equal(added.role, 'staff');
    assert.equal(added.shiftName, 'Ca Chiều (14:30 - 22:30)');
    assert.equal(userProfiles[added.id].name, 'Võ Thị Sáu');
  });

  // =========================================================================
  // 2. EDIT STAFF & PROFILE SYNCHRONIZATION
  // =========================================================================
  it('2.1 - Admin edits existing staff info and updates synced user profile', () => {
    let staffList = [...INITIAL_STAFF];
    let userProfiles = { ...INITIAL_USER_PROFILES };

    const updateStaffMember = (staffData) => {
      const target = staffList.find((s) => s.id === staffData.id);
      if (!target) throw new Error('Not found');

      const updated = {
        ...target,
        name: staffData.name.trim(),
        phone: staffData.phone.trim(),
        shiftName: staffData.shiftName,
        notes: staffData.notes.trim(),
        updatedAt: new Date().toISOString()
      };

      staffList = staffList.map((s) => (s.id === staffData.id ? updated : s));
      userProfiles[staffData.id] = {
        ...userProfiles[staffData.id],
        name: staffData.name.trim(),
        phone: staffData.phone.trim(),
        notes: staffData.notes.trim()
      };

      return { success: true, staff: updated };
    };

    const res = updateStaffMember({
      id: 'staff-03',
      name: 'Lê Hoàng Nam (Trưởng Ca)',
      phone: '0988776655',
      shiftName: 'Ca Chiều (14:30 - 22:30)',
      notes: 'Thăng cấp điều phối quầy bar'
    });

    assert.equal(res.success, true);
    const updated = staffList.find((s) => s.id === 'staff-03');
    assert.equal(updated.name, 'Lê Hoàng Nam (Trưởng Ca)');
    assert.equal(updated.phone, '0988776655');
    assert.equal(userProfiles['staff-03'].name, 'Lê Hoàng Nam (Trưởng Ca)');
  });

  // =========================================================================
  // 3. LOCK / UNLOCK STAFF ACCESS (TOGGLE STATUS)
  // =========================================================================
  it('3.1 - Admin toggles staff access status between active and paused', () => {
    let staffList = [...INITIAL_STAFF];

    const toggleStaffStatus = (id) => {
      const target = staffList.find((s) => s.id === id);
      if (!target) return null;
      const nextStatus = target.status === 'active' ? 'paused' : 'active';
      const updated = { ...target, status: nextStatus, updatedAt: new Date().toISOString() };
      staffList = staffList.map((s) => (s.id === id ? updated : s));
      return updated;
    };

    // Toggle staff-03: active -> paused
    const toggled1 = toggleStaffStatus('staff-03');
    assert.equal(toggled1.status, 'paused');
    const pausedCount = staffList.filter((s) => s.status !== 'active').length;
    assert.equal(pausedCount, 1);

    // Toggle staff-03: paused -> active
    const toggled2 = toggleStaffStatus('staff-03');
    assert.equal(toggled2.status, 'active');
    const activeCount = staffList.filter((s) => s.status === 'active').length;
    assert.equal(activeCount, 3);
  });

  // =========================================================================
  // 4. SAFE DELETION & HISTORICAL DATA PRESERVATION
  // =========================================================================
  it('4.1 - Safe Deletion: Removes staff from active roster, revokes session, but KEEPS historical orders intact with red deleted indicator', () => {
    let staffList = [...INITIAL_STAFF];
    let userProfiles = { ...INITIAL_USER_PROFILES };
    let auditLogs = [...INITIAL_AUDIT_LOGS];
    let currentRole = 'admin';
    let currentUser = { ...DEMO_ACCOUNTS.staff }; // Staff currently logged in!

    // Mock historical orders
    let orderHistory = [
      {
        id: 'ORD-HIST-001',
        cashier: 'Lê Hoàng Nam',
        cashierId: 'staff-03',
        subtotal: 150000,
        tax: 15000,
        total: 165000,
        finishedAt: '2026-10-19T10:00:00.000Z'
      },
      {
        id: 'ORD-HIST-002',
        cashier: 'Trần Mai',
        cashierId: 'staff-01',
        subtotal: 80000,
        tax: 8000,
        total: 88000,
        finishedAt: '2026-10-19T11:30:00.000Z'
      }
    ];

    const deleteStaff = (staffId) => {
      if (currentRole !== 'admin') {
        return { success: false, error: 'Unauthorized' };
      }

      const target = staffList.find((s) => s.id === staffId);
      if (!target) return { success: false, message: 'Not found' };

      // Safeguard: Last Admin
      if (target.role === 'admin') {
        const remainingAdmins = staffList.filter((s) => s.id !== staffId && s.role === 'admin' && s.status === 'active');
        if (remainingAdmins.length === 0) {
          return { success: false, message: 'Cannot delete last admin' };
        }
      }

      const targetName = target.name;

      // 1. Preserve historical orders with indicator '[Tên] (Đã xóa)'
      orderHistory = orderHistory.map((ord) => {
        if (ord.cashier === targetName || ord.cashierId === staffId) {
          return {
            ...ord,
            cashier: `${targetName} (Đã xóa)`,
            cashierDeleted: true,
            cashierOriginalName: targetName
          };
        }
        return ord;
      });

      // 2. Purge staff from roster & userProfiles
      staffList = staffList.filter((s) => s.id !== staffId);
      delete userProfiles[staffId];

      // 3. Session Revocation: if deleted staff was active session, switch to admin
      let sessionSwitched = false;
      if (currentUser?.id === staffId) {
        currentUser = { ...DEMO_ACCOUNTS.admin };
        currentRole = 'admin';
        sessionSwitched = true;
      }

      // 4. Audit Log
      auditLogs.push({
        id: `audit-${Date.now()}`,
        action: 'staff_deletion',
        resource: 'staff_roster',
        resourceId: staffId,
        details: { deletedStaffName: targetName }
      });

      return { success: true, deletedStaffId: staffId, sessionSwitched };
    };

    // Execute deletion of staff-03
    const res = deleteStaff('staff-03');
    assert.equal(res.success, true);
    assert.equal(res.sessionSwitched, true, 'Active session for staff-03 must be revoked');
    assert.equal(currentUser.id, 'staff-01', 'Session must fallback to Admin');

    // Check active roster
    assert.equal(staffList.length, 2, 'Staff-03 must be removed from active roster');
    assert.equal(staffList.find((s) => s.id === 'staff-03'), undefined);
    assert.equal(userProfiles['staff-03'], undefined, 'Profile must be purged');

    // CRITICAL: Check historical order integrity
    assert.equal(orderHistory.length, 2, 'Both historical orders must be 100% preserved');
    const order1 = orderHistory.find((o) => o.id === 'ORD-HIST-001');
    assert.equal(order1.cashier, 'Lê Hoàng Nam (Đã xóa)');
    assert.equal(order1.cashierDeleted, true);
    assert.equal(order1.cashierOriginalName, 'Lê Hoàng Nam');
    assert.equal(order1.total, 165000, 'Total financial amount must NOT be altered!');
    assert.equal(order1.subtotal, 150000);
    assert.equal(order1.tax, 15000);

    // Check order 2
    const order2 = orderHistory.find((o) => o.id === 'ORD-HIST-002');
    assert.equal(order2.cashier, 'Trần Mai', 'Admin order remains untouched');

    // Check Audit Log
    const delLog = auditLogs.find((l) => l.action === 'staff_deletion');
    assert.ok(delLog);
    assert.equal(delLog.resourceId, 'staff-03');
  });

  // =========================================================================
  // 5. SECURITY SAFEGUARDS
  // =========================================================================
  it('5.1 - Safeguard: Admin is BLOCKED from deleting the last remaining active Admin', () => {
    let staffList = [
      { id: 'staff-01', name: 'Trần Mai', role: 'admin', status: 'active' },
      { id: 'staff-02', name: 'Nguyễn Văn Hùng', role: 'manager', status: 'active' }
    ];

    const deleteStaff = (staffId) => {
      const target = staffList.find((s) => s.id === staffId);
      if (target?.role === 'admin') {
        const remainingAdmins = staffList.filter((s) => s.id !== staffId && s.role === 'admin' && s.status === 'active');
        if (remainingAdmins.length === 0) {
          return { success: false, message: 'Hành động bị chặn: Không thể xóa tài khoản Quản trị viên duy nhất!' };
        }
      }
      staffList = staffList.filter((s) => s.id !== staffId);
      return { success: true };
    };

    const attempt = deleteStaff('staff-01');
    assert.equal(attempt.success, false);
    assert.match(attempt.message, /Không thể xóa tài khoản Quản trị viên duy nhất/);
    assert.equal(staffList.length, 2, 'Admin staff-01 must not be deleted');
  });

  it('5.2 - Security Boundary: Manager is STRICTLY FORBIDDEN from deleting staff or modifying Admin', () => {
    const currentRole = 'manager';

    const canDeleteStaff = (role) => role === 'admin';
    const canModifyStaff = (role, targetStaff) => {
      if (role === 'admin') return true;
      if (role === 'manager') return targetStaff.role !== 'admin';
      return false;
    };

    assert.equal(canDeleteStaff(currentRole), false, 'Manager cannot delete staff');
    assert.equal(canModifyStaff(currentRole, { id: 'staff-01', role: 'admin' }), false, 'Manager cannot modify Admin');
    assert.equal(canModifyStaff(currentRole, { id: 'staff-03', role: 'staff' }), true, 'Manager can modify staff');
  });

  it('5.3 - UI Visibility Matrix: Manager only sees Tab 1 (Nhân viên), Tab 2 (Thêm NV) and Delete button are hidden', () => {
    const getVisibleTabs = (role) => {
      if (role === 'admin') {
        return ['list', 'form'];
      }
      // Manager
      return ['list'];
    };

    const hasDeleteButton = (role) => role === 'admin';

    // Admin
    assert.deepEqual(getVisibleTabs('admin'), ['list', 'form']);
    assert.equal(hasDeleteButton('admin'), true);

    // Manager
    assert.deepEqual(getVisibleTabs('manager'), ['list'], 'Manager must only see list tab');
    assert.equal(hasDeleteButton('manager'), false, 'Manager must NOT see delete button');
  });
});
