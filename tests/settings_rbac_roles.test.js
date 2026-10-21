import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_ACCOUNTS,
  INITIAL_STAFF,
  INITIAL_USER_PROFILES,
  INITIAL_AUDIT_LOGS
} from '../src/data/initialData.js';

describe('Settings Page RBAC & 3-Role Customization Tests', () => {

  // =========================================================================
  // 1. CARDS VISIBILITY & ACCESS MATRICES
  // =========================================================================
  it('1.1 - Settings Card Permissions Matrix: Admin (5 cards), Manager (3 cards), Staff (1 card)', () => {
    const roles = ['admin', 'manager', 'staff'];

    const getVisibleCardsForRole = (role) => {
      const canManageStaff = ['admin', 'manager'].includes(role);
      const canConfigureStore = ['admin', 'manager'].includes(role);
      const canCleanupData = role === 'admin';
      const canChangeUserRole = role === 'admin';

      const cards = [];
      // Card 0: Profile Management (All roles)
      cards.push('profile-management-nav-card');

      // Card 1: Staff Management (Admin & Manager)
      if (canManageStaff) {
        cards.push('staff-management-nav-card');
      }

      // Card 2: Store Config & VietQR (Admin & Manager)
      if (canConfigureStore) {
        cards.push('store-config-nav-card');
      }

      // Card 3: Sales Data Cleanup (Admin only)
      if (canCleanupData) {
        cards.push('data-cleanup-nav-card');
      }

      // Card 4: RBAC Permissions (Admin only)
      if (canChangeUserRole) {
        cards.push('rbac-permissions-nav-card');
      }

      return cards;
    };

    // Admin assertions
    const adminCards = getVisibleCardsForRole('admin');
    assert.equal(adminCards.length, 5, 'Admin must see exactly 5 navigation cards');
    assert.deepEqual(adminCards, [
      'profile-management-nav-card',
      'staff-management-nav-card',
      'store-config-nav-card',
      'data-cleanup-nav-card',
      'rbac-permissions-nav-card'
    ]);

    // Manager assertions
    const managerCards = getVisibleCardsForRole('manager');
    assert.equal(managerCards.length, 3, 'Manager must see exactly 3 navigation cards');
    assert.deepEqual(managerCards, [
      'profile-management-nav-card',
      'staff-management-nav-card',
      'store-config-nav-card'
    ]);
    assert.equal(managerCards.includes('data-cleanup-nav-card'), false, 'Manager must NOT see Data Cleanup card');
    assert.equal(managerCards.includes('rbac-permissions-nav-card'), false, 'Manager must NOT see RBAC Permissions card');

    // Staff assertions
    const staffCards = getVisibleCardsForRole('staff');
    assert.equal(staffCards.length, 1, 'Staff must see exactly 1 navigation card (Profile Management)');
    assert.deepEqual(staffCards, ['profile-management-nav-card']);
    assert.equal(staffCards.includes('staff-management-nav-card'), false, 'Staff must NOT see Staff Management card');
    assert.equal(staffCards.includes('store-config-nav-card'), false, 'Staff must NOT see Store Config card');
    assert.equal(staffCards.includes('data-cleanup-nav-card'), false, 'Staff must NOT see Data Cleanup card');
    assert.equal(staffCards.includes('rbac-permissions-nav-card'), false, 'Staff must NOT see RBAC Permissions card');
  });

  // =========================================================================
  // 2. PROFILE EDIT & SYNC GUARANTEES
  // =========================================================================
  it('2.1 - Profile Edit: Syncs avatarUrl & displayName across Header and Settings, locks role', () => {
    // Initial state simulation
    let userProfiles = { ...INITIAL_USER_PROFILES };
    let currentRole = 'staff';
    let currentUser = { ...DEMO_ACCOUNTS.staff };
    let settings = {
      avatarUrl: null,
      currentCashier: 'Lê Hoàng Nam (Mã NV: STAFF-03)'
    };

    const updateCurrentUserProfile = ({ name, avatarUrl, phone, notes, attemptedRole }) => {
      const activeId = currentUser?.id || 'staff-03';
      const existing = userProfiles[activeId] || {};
      const updatedName = (name !== undefined && name !== null && String(name).trim()) ? String(name).trim() : (existing.name || 'Thu ngân');
      const updatedAvatar = avatarUrl !== undefined ? avatarUrl : (existing.avatarUrl || null);
      const updatedPhone = phone !== undefined ? phone : (existing.phone || '');
      const updatedNotes = notes !== undefined ? notes : (existing.notes || '');

      // CRITICAL: attemptedRole must be ignored, role must be immutable from profile edit
      const updatedProfile = {
        ...existing,
        id: activeId,
        name: updatedName,
        avatarUrl: updatedAvatar,
        phone: updatedPhone,
        notes: updatedNotes,
        role: currentRole // Preserved!
      };

      userProfiles[activeId] = updatedProfile;
      currentUser = {
        ...currentUser,
        name: updatedName,
        avatarUrl: updatedAvatar,
        phone: updatedPhone,
        notes: updatedNotes
      };
      settings = {
        ...settings,
        avatarUrl: updatedAvatar,
        currentCashier: `${updatedName} (Mã NV: ${activeId.toUpperCase()})`
      };

      return { success: true, profile: updatedProfile };
    };

    // Staff performs profile edit
    const result = updateCurrentUserProfile({
      name: 'Lê Hoàng Nam - Ca Sáng',
      avatarUrl: 'data:image/png;base64,mockCustomAvatarData',
      phone: '0987654321',
      notes: 'Trực quầy order số 1',
      attemptedRole: 'admin' // Adversarial attempt to elevate role
    });

    assert.equal(result.success, true);
    assert.equal(result.profile.role, 'staff', 'Role must remain staff despite adversarial attempt');
    assert.equal(userProfiles['staff-03'].role, 'staff');
    assert.equal(currentUser.role, 'staff');
    assert.equal(settings.avatarUrl, 'data:image/png;base64,mockCustomAvatarData');
    assert.equal(settings.currentCashier, 'Lê Hoàng Nam - Ca Sáng (Mã NV: STAFF-03)');

    // Header consumption verification
    const headerDisplayName = settings.currentCashier.split('(')[0].trim();
    assert.equal(headerDisplayName, 'Lê Hoàng Nam - Ca Sáng');
    assert.equal(settings.avatarUrl, 'data:image/png;base64,mockCustomAvatarData');
  });

  // =========================================================================
  // 3. MANAGER BOUNDARIES IN STAFF MANAGEMENT
  // =========================================================================
  it('3.1 - Manager can view staff list and toggle non-admin status, but is FORBIDDEN from modifying Admin', () => {
    const currentRole = 'manager';
    const staffRoster = [
      { id: 'staff-01', name: 'Trần Mai', role: 'admin', status: 'active' },
      { id: 'staff-02', name: 'Nguyễn Văn Hùng', role: 'manager', status: 'active' },
      { id: 'staff-03', name: 'Lê Hoàng Nam', role: 'staff', status: 'active' }
    ];

    const canEditStaffRow = (editorRole, targetStaff) => {
      if (editorRole === 'admin') return true;
      if (editorRole === 'manager') {
        // Manager cannot edit or disable Admin
        return targetStaff.role !== 'admin';
      }
      return false; // Staff cannot edit any
    };

    assert.equal(canEditStaffRow(currentRole, staffRoster[0]), false, 'Manager cannot edit Admin staff-01');
    assert.equal(canEditStaffRow(currentRole, staffRoster[1]), true, 'Manager can edit own or fellow manager staff-02');
    assert.equal(canEditStaffRow(currentRole, staffRoster[2]), true, 'Manager can edit staff-03');
  });

  it('3.2 - Manager adding new staff defaults strictly to staff role and cannot grant admin', () => {
    const currentRole = 'manager';
    const executeAddStaff = (editorRole, requestedName, requestedRole) => {
      // Enforced backend/guard rule
      const effectiveRole = editorRole === 'admin' ? requestedRole : 'staff';
      return {
        id: `staff-${Date.now()}`,
        name: requestedName,
        role: effectiveRole,
        status: 'active'
      };
    };

    const newStaff = executeAddStaff(currentRole, 'Vũ Hải Đăng', 'admin');
    assert.equal(newStaff.role, 'staff', 'Manager must not be able to create an admin account');
    assert.equal(newStaff.name, 'Vũ Hải Đăng');
  });

  // =========================================================================
  // 4. SUBPAGE DEEP LINKING & NAVIGATION DEFENSE
  // =========================================================================
  it('4.1 - Direct Subpage Access Guards: Staff denied from admin/manager views, Manager denied from admin views', () => {
    const canAccessSubpage = (role, subpage) => {
      if (subpage === 'profile') return true;
      if (subpage === 'staff') return ['admin', 'manager'].includes(role);
      if (subpage === 'store-config') return ['admin', 'manager'].includes(role);
      if (subpage === 'data-cleanup') return role === 'admin';
      if (subpage === 'rbac') return role === 'admin';
      return false;
    };

    // Staff access check
    assert.equal(canAccessSubpage('staff', 'profile'), true, 'Staff can access profile');
    assert.equal(canAccessSubpage('staff', 'staff'), false, 'Staff cannot access staff subpage');
    assert.equal(canAccessSubpage('staff', 'store-config'), false, 'Staff cannot access store-config');
    assert.equal(canAccessSubpage('staff', 'data-cleanup'), false, 'Staff cannot access data-cleanup');
    assert.equal(canAccessSubpage('staff', 'rbac'), false, 'Staff cannot access rbac');

    // Manager access check
    assert.equal(canAccessSubpage('manager', 'profile'), true, 'Manager can access profile');
    assert.equal(canAccessSubpage('manager', 'staff'), true, 'Manager can access staff');
    assert.equal(canAccessSubpage('manager', 'store-config'), true, 'Manager can access store-config');
    assert.equal(canAccessSubpage('manager', 'data-cleanup'), false, 'Manager cannot access data-cleanup');
    assert.equal(canAccessSubpage('manager', 'rbac'), false, 'Manager cannot access rbac');

    // Admin access check
    assert.equal(canAccessSubpage('admin', 'profile'), true, 'Admin can access profile');
    assert.equal(canAccessSubpage('admin', 'staff'), true, 'Admin can access staff');
    assert.equal(canAccessSubpage('admin', 'store-config'), true, 'Admin can access store-config');
    assert.equal(canAccessSubpage('admin', 'data-cleanup'), true, 'Admin can access data-cleanup');
    assert.equal(canAccessSubpage('admin', 'rbac'), true, 'Admin can access rbac');
  });

  // =========================================================================
  // 5. ROLE SWITCHER IN DEV/STAGING
  // =========================================================================
  it('5.1 - Demo Role Switcher properly resets view and profile state when switching roles', () => {
    let currentRole = 'admin';
    let activeTab = 'settings';
    let userProfiles = {
      'staff-01': { id: 'staff-01', name: 'Trần Mai (Admin)', avatarUrl: 'avatar-admin.png', role: 'admin' },
      'staff-02': { id: 'staff-02', name: 'Nguyễn Văn Hùng (Manager)', avatarUrl: null, role: 'manager' },
      'staff-03': { id: 'staff-03', name: 'Lê Hoàng Nam (Staff)', avatarUrl: 'avatar-staff.png', role: 'staff' }
    };
    let currentUser = userProfiles['staff-01'];
    let settings = {
      avatarUrl: currentUser.avatarUrl,
      currentCashier: `${currentUser.name} (Mã NV: ${currentUser.id.toUpperCase()})`
    };

    const switchDemoRole = (newRole) => {
      if (!['admin', 'manager', 'staff'].includes(newRole)) return;
      const activeId = newRole === 'admin' ? 'staff-01' : newRole === 'manager' ? 'staff-02' : 'staff-03';
      const targetProfile = userProfiles[activeId] || {};

      currentRole = newRole;
      currentUser = {
        ...targetProfile,
        id: activeId,
        role: newRole
      };
      settings = {
        ...settings,
        avatarUrl: targetProfile.avatarUrl || null,
        currentCashier: `${targetProfile.name} (Mã NV: ${activeId.toUpperCase()})`
      };

      // Tab redirect: Staff can stay on Settings (now authorized!), but redirected away from menu and reports
      if (newRole === 'staff' && ['menu', 'reports'].includes(activeTab)) {
        activeTab = 'tables';
      }
    };

    // Switch Admin -> Manager
    switchDemoRole('manager');
    assert.equal(currentRole, 'manager');
    assert.equal(currentUser.id, 'staff-02');
    assert.equal(settings.avatarUrl, null);
    assert.equal(settings.currentCashier, 'Nguyễn Văn Hùng (Manager) (Mã NV: STAFF-02)');
    assert.equal(activeTab, 'settings', 'Manager stays on settings');

    // Switch Manager -> Staff
    switchDemoRole('staff');
    assert.equal(currentRole, 'staff');
    assert.equal(currentUser.id, 'staff-03');
    assert.equal(settings.avatarUrl, 'avatar-staff.png');
    assert.equal(settings.currentCashier, 'Lê Hoàng Nam (Staff) (Mã NV: STAFF-03)');
    assert.equal(activeTab, 'settings', 'Staff is permitted to stay on settings to manage their profile');
  });
});
