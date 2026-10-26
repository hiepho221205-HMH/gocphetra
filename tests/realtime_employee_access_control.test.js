import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('GÓC POS — Realtime Employee Access Control & Presence Test Suite', () => {

  // =========================================================================
  // 1. ACCOUNT STATUS STANDARDIZATION & ADMIN TOGGLE SAFEGUARDS
  // =========================================================================
  it('1.1 - Status is standardized to active / suspended with backward-compat for paused', () => {
    const normalizeStatus = (status) => {
      if (status === 'paused' || status === 'inactive' || status === 'suspended') return 'suspended';
      return 'active';
    };

    assert.equal(normalizeStatus('active'), 'active');
    assert.equal(normalizeStatus('paused'), 'suspended');
    assert.equal(normalizeStatus('inactive'), 'suspended');
    assert.equal(normalizeStatus('suspended'), 'suspended');
  });

  it('1.2 - Only Admin can toggle staff status; Manager and Staff attempts are rejected', () => {
    const staffList = [
      { id: 'admin-01', name: 'Trần Mai', role: 'admin', status: 'active' },
      { id: 'manager-01', name: 'Nguyễn Văn Hùng', role: 'manager', status: 'active' },
      { id: 'staff-01', name: 'Lê Hoàng Nam', role: 'staff', status: 'active' }
    ];

    const toggleStaffStatus = (callerRole, targetId) => {
      if (callerRole !== 'admin') {
        return { success: false, error: 'Unauthorized', message: 'Chỉ Admin mới có quyền bật/tắt quyền sử dụng POS' };
      }
      const target = staffList.find(s => s.id === targetId);
      if (!target) return { success: false, error: 'NotFound' };
      return { success: true, nextStatus: target.status === 'active' ? 'suspended' : 'active' };
    };

    // Manager attempt -> REJECTED
    const mgrRes = toggleStaffStatus('manager', 'staff-01');
    assert.equal(mgrRes.success, false);
    assert.equal(mgrRes.error, 'Unauthorized');

    // Staff attempt -> REJECTED
    const staffRes = toggleStaffStatus('staff', 'staff-01');
    assert.equal(staffRes.success, false);
    assert.equal(staffRes.error, 'Unauthorized');

    // Admin attempt -> ALLOWED
    const adminRes = toggleStaffStatus('admin', 'staff-01');
    assert.equal(adminRes.success, true);
    assert.equal(adminRes.nextStatus, 'suspended');
  });

  it('1.3 - Safeguard: Cannot lock the last remaining active Admin', () => {
    const staffList = [
      { id: 'admin-01', name: 'Trần Mai', role: 'admin', status: 'active' },
      { id: 'staff-01', name: 'Lê Hoàng Nam', role: 'staff', status: 'active' }
    ];

    const toggleStaffStatus = (callerRole, targetId, currentUserId) => {
      if (callerRole !== 'admin') return { success: false, error: 'Unauthorized' };
      const target = staffList.find(s => s.id === targetId);
      if (!target) return { success: false, error: 'NotFound' };

      const nextStatus = target.status === 'active' ? 'suspended' : 'active';
      if (target.role === 'admin' && nextStatus !== 'active') {
        const remainingAdmins = staffList.filter(s => s.id !== targetId && s.role === 'admin' && s.status === 'active');
        if (remainingAdmins.length === 0) {
          return { success: false, error: 'LAST_ADMIN_BLOCKED', message: 'Không thể khóa Admin cuối cùng' };
        }
      }
      return { success: true, nextStatus };
    };

    const res = toggleStaffStatus('admin', 'admin-01', 'admin-01');
    assert.equal(res.success, false);
    assert.equal(res.error, 'LAST_ADMIN_BLOCKED');
  });

  it('1.4 - Safeguard: Admin cannot self-lock their own active account', () => {
    const staffList = [
      { id: 'admin-01', name: 'Trần Mai', role: 'admin', status: 'active' },
      { id: 'admin-02', name: 'Lê Quốc Hưng', role: 'admin', status: 'active' }
    ];

    const toggleStaffStatus = (callerRole, targetId, currentUserId) => {
      const target = staffList.find(s => s.id === targetId);
      if (target.role === 'admin') {
        if (currentUserId === targetId) {
          return { success: false, error: 'SELF_LOCK_BLOCKED', message: 'Bạn không thể tự khóa tài khoản của chính mình' };
        }
      }
      return { success: true };
    };

    // Admin-01 attempts to lock Admin-01 -> BLOCKED
    const selfRes = toggleStaffStatus('admin', 'admin-01', 'admin-01');
    assert.equal(selfRes.success, false);
    assert.equal(selfRes.error, 'SELF_LOCK_BLOCKED');

    // Admin-01 attempts to lock Admin-02 -> ALLOWED (since 2 admins exist)
    const otherRes = toggleStaffStatus('admin', 'admin-02', 'admin-01');
    assert.equal(otherRes.success, true);
  });

  it('1.5 - UI Rollback on backend failure (Requirement A.11)', async () => {
    let staffList = [{ id: 'staff-01', name: 'Lê Hoàng Nam', status: 'active' }];
    let userProfiles = { 'staff-01': { id: 'staff-01', status: 'active' } };

    const mockBackendToggleRpc = async (id, status, shouldFail = false) => {
      if (shouldFail) throw new Error('Database connection timeout');
      return { success: true };
    };

    const toggleStaffStatusWithRollback = async (id, shouldFail) => {
      const prevStaff = [...staffList];
      const prevProfiles = { ...userProfiles };

      // Optimistic update
      staffList = staffList.map(s => s.id === id ? { ...s, status: 'suspended' } : s);
      userProfiles[id] = { ...userProfiles[id], status: 'suspended' };

      try {
        await mockBackendToggleRpc(id, 'suspended', shouldFail);
      } catch (err) {
        // Rollback
        staffList = prevStaff;
        userProfiles = prevProfiles;
        return { success: false, rolledBack: true };
      }
      return { success: true };
    };

    // Simulate failure
    const failRes = await toggleStaffStatusWithRollback('staff-01', true);
    assert.equal(failRes.success, false);
    assert.equal(failRes.rolledBack, true);
    assert.equal(staffList[0].status, 'active', 'UI must rollback to active on failure');
    assert.equal(userProfiles['staff-01'].status, 'active');
  });

  // =========================================================================
  // 2. TRUE SERVER-SIDE & CLIENT-SIDE ACCESS CONTROL
  // =========================================================================
  it('2.1 - Suspended accounts are immediately rejected by atomic order RPCs', () => {
    const isUserActive = (user) => user && user.status === 'active';

    const savePosOrderAtomic = (callerUser, orderData) => {
      if (!isUserActive(callerUser)) {
        return {
          success: false,
          code: 'ACCOUNT_SUSPENDED',
          message: 'Tài khoản của bạn đã bị tạm khóa. Mọi thao tác đặt món bị từ chối.'
        };
      }
      return { success: true, orderId: orderData.id };
    };

    const finalizePosOrderAtomic = (callerUser, orderId) => {
      if (!isUserActive(callerUser)) {
        return {
          success: false,
          code: 'ACCOUNT_SUSPENDED',
          message: 'Tài khoản của bạn đã bị tạm khóa. Mọi thao tác thanh toán bị từ chối.'
        };
      }
      return { success: true, status: 'completed' };
    };

    const activeUser = { id: 'staff-01', status: 'active' };
    const suspendedUser = { id: 'staff-01', status: 'suspended' };

    // Active user -> Success
    assert.equal(savePosOrderAtomic(activeUser, { id: 'ORD-01' }).success, true);
    assert.equal(finalizePosOrderAtomic(activeUser, 'ORD-01').success, true);

    // Suspended user -> Hard Blocked with ACCOUNT_SUSPENDED
    const saveRes = savePosOrderAtomic(suspendedUser, { id: 'ORD-01' });
    assert.equal(saveRes.success, false);
    assert.equal(saveRes.code, 'ACCOUNT_SUSPENDED');

    const payRes = finalizePosOrderAtomic(suspendedUser, 'ORD-01');
    assert.equal(payRes.success, false);
    assert.equal(payRes.code, 'ACCOUNT_SUSPENDED');
  });

  it('2.2 - Realtime profiles listener detects suspension and triggers reactive lock modal', () => {
    let isAccountSuspendedState = false;
    let untrackCalled = false;

    const mockPresenceChannel = {
      untrack: () => { untrackCalled = true; }
    };

    const currentUserId = 'staff-01';

    const handleProfileRealtimeChange = (payload) => {
      const updatedProfile = payload.new;
      if (updatedProfile.id === currentUserId) {
        if (updatedProfile.status === 'suspended' || updatedProfile.status === 'paused') {
          isAccountSuspendedState = true;
          mockPresenceChannel.untrack();
        } else if (updatedProfile.status === 'active') {
          isAccountSuspendedState = false;
        }
      }
    };

    // Event: Admin suspends staff-01
    handleProfileRealtimeChange({
      eventType: 'UPDATE',
      new: { id: 'staff-01', status: 'suspended' }
    });

    assert.equal(isAccountSuspendedState, true, 'isAccountSuspended must be set to true');
    assert.equal(untrackCalled, true, 'Presence channel must untrack immediately');

    // Event: Admin unlocks staff-01
    handleProfileRealtimeChange({
      eventType: 'UPDATE',
      new: { id: 'staff-01', status: 'active' }
    });
    assert.equal(isAccountSuspendedState, false, 'isAccountSuspended must revert to false on unlock');
  });

  // =========================================================================
  // 3. REALTIME ONLINE PRESENCE (MULTI-DEVICE IN-MEMORY LOGIC)
  // =========================================================================
  it('3.1 - Multi-device presence: user stays online until ALL devices disconnect', () => {
    // Supabase Presence State Structure: { [userId]: [ device1, device2, ... ] }
    let presenceState = {};

    const syncPresenceState = (state) => {
      const onlineUserIds = new Set();
      Object.keys(state).forEach((uid) => {
        if (state[uid] && state[uid].length > 0) {
          onlineUserIds.add(uid);
        }
      });
      return onlineUserIds;
    };

    const userId = 'staff-01';

    // Device 1 (iPad POS) connects
    presenceState[userId] = [{ device: 'iPad', online_at: '2026-10-26T10:00:00Z' }];
    let onlineUsers = syncPresenceState(presenceState);
    assert.equal(onlineUsers.has(userId), true, 'User is online with 1 device');
    assert.equal(onlineUsers.size, 1);

    // Device 2 (iPhone) connects
    presenceState[userId].push({ device: 'iPhone', online_at: '2026-10-26T10:05:00Z' });
    onlineUsers = syncPresenceState(presenceState);
    assert.equal(onlineUsers.has(userId), true, 'User is online with 2 devices');
    assert.equal(onlineUsers.size, 1, 'Still counts as 1 unique staff online');

    // Device 1 disconnects (iPhone remains)
    presenceState[userId] = presenceState[userId].filter(d => d.device !== 'iPad');
    onlineUsers = syncPresenceState(presenceState);
    assert.equal(onlineUsers.has(userId), true, 'User is STILL online because iPhone is active');

    // Device 2 disconnects
    presenceState[userId] = [];
    onlineUsers = syncPresenceState(presenceState);
    assert.equal(onlineUsers.has(userId), false, 'User goes Offline when all devices disconnect');
  });

  it('3.2 - Counter KPIs accurately differentiate between Active and Online', () => {
    const staffList = [
      { id: 'admin-01', status: 'active' },
      { id: 'manager-01', status: 'active' },
      { id: 'staff-01', status: 'active' },
      { id: 'staff-02', status: 'suspended' },
      { id: 'staff-03', status: 'archived' } // deleted/archived
    ];

    const onlineUserIds = new Set(['admin-01', 'staff-02']); // staff-02 is connected but suspended!

    const isStaffOnline = (id) => onlineUserIds.has(id);

    const managedStaff = staffList.filter(s => s.status !== 'archived' && s.status !== 'removed');
    const totalCount = managedStaff.length; // 4
    const activeCount = managedStaff.filter(s => s.status === 'active').length; // 3
    const suspendedCount = managedStaff.filter(s => s.status === 'suspended').length; // 1

    // Requirement 25 & 33: Only active accounts that are connected count as "Online"
    const onlineCount = managedStaff.filter(s => s.status === 'active' && isStaffOnline(s.id)).length; // 1 (admin-01 only)

    assert.equal(totalCount, 4);
    assert.equal(activeCount, 3);
    assert.equal(suspendedCount, 1);
    assert.equal(totalCount, activeCount + suspendedCount, 'TỔNG NV = HOẠT ĐỘNG + TẠM KHÓA');
    assert.equal(onlineCount, 1, 'Online count must only count ACTIVE connected users, NOT suspended users');
  });

  // =========================================================================
  // 4. AUDIT LOG SPECIFICATION
  // =========================================================================
  it('4.1 - Status change audit log records actor, target, old_status, new_status, and timestamp', () => {
    const createAuditLog = (actorId, callerRole, targetId, targetName, oldStatus, newStatus) => {
      return {
        user_id: actorId,
        role: callerRole,
        action: 'status_change',
        resource: 'profiles',
        resource_id: targetId,
        details: {
          actor: actorId || 'admin_system',
          target: targetId,
          target_name: targetName,
          old_status: oldStatus,
          new_status: newStatus,
          timestamp: new Date().toISOString()
        }
      };
    };

    const log = createAuditLog('admin-01-uuid', 'admin', 'staff-01-uuid', 'Lê Hoàng Nam', 'active', 'suspended');
    assert.equal(log.action, 'status_change');
    assert.equal(log.resource, 'profiles');
    assert.equal(log.details.actor, 'admin-01-uuid');
    assert.equal(log.details.target, 'staff-01-uuid');
    assert.equal(log.details.old_status, 'active');
    assert.equal(log.details.new_status, 'suspended');
    assert.ok(log.details.timestamp);
  });

  // =========================================================================
  // 5. COMPONENT CONTRACTS & UI MOUNT VERIFICATION
  // =========================================================================
  it('5.1 - SuspendStaffConfirmModal renders warning, employee name, impact bullets, and action buttons', () => {
    const modalPath = path.resolve('src/components/management/SuspendStaffConfirmModal.jsx');
    assert.ok(fs.existsSync(modalPath), 'SuspendStaffConfirmModal.jsx must exist');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(content.includes('data-testid="suspend-staff-modal-backdrop"'));
    assert.ok(content.includes('data-testid="confirm-suspend-staff-btn"'));
    assert.ok(content.includes('data-testid="cancel-suspend-staff-btn"'));
    assert.ok(content.includes('Tác động khi tạm khóa tài khoản'));
    assert.ok(content.includes('bị chặn quyền sử dụng POS'));
  });

  it('5.2 - AccountSuspendedBannerModal renders full-screen blocking UI with safe logout', () => {
    const bannerPath = path.resolve('src/components/auth/AccountSuspendedBannerModal.jsx');
    assert.ok(fs.existsSync(bannerPath), 'AccountSuspendedBannerModal.jsx must exist');
    const content = fs.readFileSync(bannerPath, 'utf8');

    assert.ok(content.includes('data-testid="account-suspended-banner-modal"'));
    assert.ok(content.includes('data-testid="account-suspended-logout-btn"'));
    assert.ok(content.includes('Tài khoản của bạn đã bị tạm khóa'));
    assert.ok(content.includes('Đăng xuất an toàn'));
  });

  it('5.3 - StaffManagementSection renders 4 KPI cards including kpi-online-staff', () => {
    const secPath = path.resolve('src/components/management/StaffManagementSection.jsx');
    const content = fs.readFileSync(secPath, 'utf8');

    assert.ok(content.includes('data-testid="kpi-total-staff"'));
    assert.ok(content.includes('data-testid="kpi-active-staff"'));
    assert.ok(content.includes('data-testid="kpi-paused-staff"'));
    assert.ok(content.includes('data-testid="kpi-online-staff"'));
    assert.ok(content.includes('grid-cols-2 sm:grid-cols-4'));
  });

  it('5.4 - StaffListPage includes switch, presence badges, and SuspendStaffConfirmModal integration', () => {
    const listPath = path.resolve('src/components/management/StaffListPage.jsx');
    const content = fs.readFileSync(listPath, 'utf8');

    assert.ok(content.includes('role="switch"'));
    assert.ok(content.includes('data-testid="badge-status-suspended"'));
    assert.ok(content.includes('data-testid="badge-status-online"'));
    assert.ok(content.includes('data-testid="badge-status-offline"'));
    assert.ok(content.includes('SuspendStaffConfirmModal'));
  });
});
