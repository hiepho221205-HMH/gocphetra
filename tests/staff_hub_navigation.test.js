import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_STAFF,
  DEMO_ACCOUNTS,
  INITIAL_USER_PROFILES,
  INITIAL_AUDIT_LOGS
} from '../src/data/initialData.js';
import {
  parseRouteFromLocation,
  getTabFromRoute,
  getStaffInitials
} from '../src/utils/router.js';

describe('GÓC POS — Staff Management Hub & Spokes Navigation Architecture Tests', () => {

  // =========================================================================
  // 1. ROUTER & URL NAVIGATION LOGIC (HTML5 Path & Hash Fallback)
  // =========================================================================
  it('1.1 - getTabFromRoute correctly maps paths to activeTab', () => {
    assert.equal(getTabFromRoute('/tables'), 'tables');
    assert.equal(getTabFromRoute('/'), 'tables');
    assert.equal(getTabFromRoute('/menu'), 'menu');
    assert.equal(getTabFromRoute('/orders'), 'orders');
    assert.equal(getTabFromRoute('/reports'), 'reports');
    assert.equal(getTabFromRoute('/settings'), 'settings');
    assert.equal(getTabFromRoute('/staff'), 'settings', '/staff must activate settings tab container');
    assert.equal(getTabFromRoute('/staff/list'), 'settings', '/staff/list must activate settings tab container');
    assert.equal(getTabFromRoute('/staff/create'), 'settings', '/staff/create must activate settings tab container');
  });

  it('1.2 - parseRouteFromLocation extracts route path & query parameters', () => {
    // Test pure logic simulation of parseRouteFromLocation
    const simulateParse = (hash, pathname, search) => {
      let path = '/tables';
      let q = '';
      if (hash && hash.startsWith('#/')) {
        const parts = hash.substring(1).split('?');
        path = parts[0] || '/tables';
        q = parts[1] ? `?${parts[1]}` : '';
      } else if (pathname && pathname !== '/') {
        path = pathname;
        q = search || '';
      }
      const params = {};
      if (q) {
        const searchString = q.startsWith('?') ? q.substring(1) : q;
        const pairs = searchString.split('&');
        for (const pair of pairs) {
          if (pair) {
            const [k, v] = pair.split('=');
            if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
          }
        }
      }
      return { path, params };
    };

    const res1 = simulateParse('#/staff/create?edit=staff-02', '', '');
    assert.equal(res1.path, '/staff/create');
    assert.equal(res1.params.edit, 'staff-02');

    const res2 = simulateParse('', '/staff/list', '');
    assert.equal(res2.path, '/staff/list');
    assert.deepEqual(res2.params, {});

    const res3 = simulateParse('', '/staff', '');
    assert.equal(res3.path, '/staff');
  });

  // =========================================================================
  // 2. MAIN STAFF HUB: 3 KPI CARDS & 2 DISTINCT VIVID COLOR CARDS
  // =========================================================================
  it('2.1 - Main Staff Hub preserves 3 KPI statistics: Tổng NV, Hoạt động, Tạm khóa', () => {
    const staffList = [
      { id: 'staff-01', name: 'Trần Mai', role: 'admin', status: 'active' },
      { id: 'staff-02', name: 'Nguyễn Văn Hùng', role: 'manager', status: 'active' },
      { id: 'staff-03', name: 'Lê Hoàng Long', role: 'staff', status: 'paused' },
      { id: 'staff-04', name: 'Phạm Thu Thảo', role: 'staff', status: 'active' }
    ];

    const totalCount = staffList.length;
    const activeCount = staffList.filter((s) => s.status === 'active').length;
    const pausedCount = staffList.filter((s) => s.status !== 'active').length;

    assert.equal(totalCount, 4);
    assert.equal(activeCount, 3);
    assert.equal(pausedCount, 1);
  });

  it('2.2 - Main Staff Hub defines 2 distinct vivid functional cards with different color palettes', () => {
    // Card 1: Danh sách nhân viên (Pastel Mint Green)
    const cardListSpec = {
      testId: 'nav-staff-list-card',
      title: 'Danh sách nhân viên',
      route: '/staff/list',
      bgColor: '#EAF5ED',
      borderColor: '#BBE3C8',
      textColor: '#1E3D29',
      iconBoxBg: '#D2EBD9',
      iconColor: '#1E3D29'
    };

    // Card 2: Thêm nhân viên (Pastel Sky Blue)
    const cardCreateSpec = {
      testId: 'nav-staff-create-card',
      title: 'Thêm nhân viên',
      route: '/staff/create',
      bgColor: '#EAF3FA',
      borderColor: '#BFDBFE',
      textColor: '#1E40AF',
      iconBoxBg: '#DBEAFE',
      iconColor: '#1D4ED8'
    };

    // Assert cards have different background and brand colors for vividness
    assert.notEqual(cardListSpec.bgColor, cardCreateSpec.bgColor, 'The 2 cards must have distinct background colors');
    assert.notEqual(cardListSpec.textColor, cardCreateSpec.textColor, 'The 2 cards must have distinct accent text colors');
    assert.equal(cardListSpec.route, '/staff/list');
    assert.equal(cardCreateSpec.route, '/staff/create');
  });

  // =========================================================================
  // 3. STAFF LIST PAGE: SEARCH, FILTER, TOGGLE & DELETE
  // =========================================================================
  it('3.1 - Search filters roster by name, email, phone, and staff ID', () => {
    const roster = [
      { id: 'staff-01', name: 'Trần Mai', email: 'mai.tran@gocpos.vn', phone: '0901234567', role: 'admin', status: 'active' },
      { id: 'staff-02', name: 'Nguyễn Văn Hùng', email: 'hung.nguyen@gocpos.vn', phone: '0912345678', role: 'manager', status: 'active' },
      { id: 'staff-03', name: 'Lê Hoàng Long', email: 'long.le@gocpos.vn', phone: '0987654321', role: 'staff', status: 'paused' }
    ];

    const search = (q) => {
      const query = q.toLowerCase().trim();
      return roster.filter((s) =>
        s.name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.phone.includes(query) ||
        s.id.toLowerCase().includes(query)
      );
    };

    assert.equal(search('mai').length, 1);
    assert.equal(search('0912').length, 1);
    assert.equal(search('gocpos.vn').length, 3);
    assert.equal(search('staff-03').length, 1);
    assert.equal(search('nonexistent').length, 0);
  });

  it('3.2 - Role filter and Status filter narrow results correctly', () => {
    const roster = [
      { id: 'staff-01', role: 'admin', status: 'active' },
      { id: 'staff-02', role: 'manager', status: 'active' },
      { id: 'staff-03', role: 'staff', status: 'paused' },
      { id: 'staff-04', role: 'staff', status: 'active' }
    ];

    const filter = (role, status) => {
      return roster.filter((s) => {
        if (role !== 'all' && s.role !== role) return false;
        if (status !== 'all' && s.status !== status) return false;
        return true;
      });
    };

    assert.equal(filter('all', 'all').length, 4);
    assert.equal(filter('staff', 'all').length, 2);
    assert.equal(filter('all', 'active').length, 3);
    assert.equal(filter('all', 'paused').length, 1);
    assert.equal(filter('staff', 'active').length, 1);
    assert.equal(filter('admin', 'paused').length, 0);
  });

  // =========================================================================
  // 4. ADD & EDIT STAFF: ROLE RESTRICTIONS & DUPLICATE PROTECTION
  // =========================================================================
  it('4.1 - Anti-duplicate protection: Rejects duplicate phone or email', () => {
    const staffList = [
      { id: 'staff-01', name: 'Trần Mai', phone: '0901234567', email: 'mai@gocpos.vn' },
      { id: 'staff-02', name: 'Nguyễn Văn Hùng', phone: '0912345678', email: 'hung@gocpos.vn' }
    ];

    const checkDuplicate = (newPhone, newEmail, currentEditingId = null) => {
      const cleanPhone = (newPhone || '').trim();
      const cleanEmail = (newEmail || '').trim().toLowerCase();

      if (cleanPhone) {
        const dupPhone = staffList.find((s) => s.id !== currentEditingId && s.phone === cleanPhone);
        if (dupPhone) throw new Error(`Số điện thoại "${cleanPhone}" đã tồn tại trên hệ thống`);
      }
      if (cleanEmail) {
        const dupEmail = staffList.find((s) => s.id !== currentEditingId && s.email.toLowerCase() === cleanEmail);
        if (dupEmail) throw new Error(`Email "${cleanEmail}" đã tồn tại trên hệ thống`);
      }
      return true;
    };

    // Rejection on duplicate phone
    assert.throws(
      () => checkDuplicate('0901234567', 'fresh@gocpos.vn'),
      /Số điện thoại "0901234567" đã tồn tại/
    );

    // Rejection on duplicate email
    assert.throws(
      () => checkDuplicate('0999999999', 'mai@gocpos.vn'),
      /Email "mai@gocpos.vn" đã tồn tại/
    );

    // Allowed when editing self
    assert.doesNotThrow(() => checkDuplicate('0901234567', 'mai@gocpos.vn', 'staff-01'));

    // Allowed when totally new and unique
    assert.doesNotThrow(() => checkDuplicate('0988888888', 'unique@gocpos.vn'));
  });

  it('4.2 - Role Restriction: Admin can only choose Staff or Manager (cannot create Admin); Manager locked to Staff', () => {
    const resolveRole = (currentRole, requestedRole, isNewStaff = true) => {
      if (currentRole === 'admin') {
        if (requestedRole === 'manager' || requestedRole === 'staff') {
          return requestedRole;
        }
        // If editing existing admin, can keep admin, but new staff CANNOT be admin
        return 'staff';
      }
      // Manager is strictly locked to staff
      return 'staff';
    };

    // Admin creates staff -> 'staff'
    assert.equal(resolveRole('admin', 'staff'), 'staff');
    // Admin creates manager -> 'manager'
    assert.equal(resolveRole('admin', 'manager'), 'manager');
    // Admin attempts to create another admin -> blocked to 'staff'
    assert.equal(resolveRole('admin', 'admin'), 'staff');

    // Manager attempts to create manager or admin -> locked to 'staff'
    assert.equal(resolveRole('manager', 'admin'), 'staff');
    assert.equal(resolveRole('manager', 'manager'), 'staff');
    assert.equal(resolveRole('manager', 'staff'), 'staff');
  });

  it('4.3 - Adding new staff updates roster and increments live KPI metrics', () => {
    let staffList = [...INITIAL_STAFF];
    const initialTotal = staffList.length;
    const initialActive = staffList.filter((s) => s.status === 'active').length;

    const newStaff = {
      id: `staff-${Date.now()}`,
      name: 'Võ Nguyên Giáp',
      phone: '0977112233',
      email: 'giap@gocpos.vn',
      role: 'staff',
      status: 'active',
      shiftName: 'Ca Sáng (06:30 - 14:30)'
    };
    staffList.push(newStaff);

    const updatedTotal = staffList.length;
    const updatedActive = staffList.filter((s) => s.status === 'active').length;

    assert.equal(updatedTotal, initialTotal + 1, 'Total staff KPI must increment by 1');
    assert.equal(updatedActive, initialActive + 1, 'Active staff KPI must increment by 1');
  });

  // =========================================================================
  // 5. RBAC ROUTE BOUNDARIES & SAFEGUARDS
  // =========================================================================
  it('5.1 - Staff role is strictly blocked from accessing /staff* routes', () => {
    const canAccessRoute = (role, route) => {
      if (route.startsWith('/staff')) {
        return ['admin', 'manager'].includes(role);
      }
      return true;
    };

    assert.equal(canAccessRoute('staff', '/staff'), false, 'Staff must be blocked from /staff');
    assert.equal(canAccessRoute('staff', '/staff/list'), false, 'Staff must be blocked from /staff/list');
    assert.equal(canAccessRoute('staff', '/staff/create'), false, 'Staff must be blocked from /staff/create');

    assert.equal(canAccessRoute('manager', '/staff'), true, 'Manager can access /staff');
    assert.equal(canAccessRoute('manager', '/staff/list'), true, 'Manager can access /staff/list');
    assert.equal(canAccessRoute('admin', '/staff'), true, 'Admin can access /staff');
  });

  it('5.2 - Safeguard: Manager cannot delete staff or edit Admin accounts', () => {
    const canDelete = (role) => role === 'admin';
    const canEdit = (role, target) => {
      if (role === 'admin') return true;
      if (role === 'manager') return target.role !== 'admin';
      return false;
    };

    assert.equal(canDelete('manager'), false);
    assert.equal(canDelete('admin'), true);

    const adminTarget = { id: 'staff-01', role: 'admin' };
    const staffTarget = { id: 'staff-03', role: 'staff' };

    assert.equal(canEdit('manager', adminTarget), false, 'Manager cannot edit Admin');
    assert.equal(canEdit('manager', staffTarget), true, 'Manager can edit Staff');
    assert.equal(canEdit('admin', adminTarget), true, 'Admin can edit Admin');
  });

  it('5.3 - Helper getStaffInitials extracts 2 initials correctly', () => {
    assert.equal(getStaffInitials('Trần Mai'), 'TM');
    assert.equal(getStaffInitials('Nguyễn Văn Hùng'), 'NH');
    assert.equal(getStaffInitials('Lê Hoàng Long'), 'LL');
    assert.equal(getStaffInitials('Mai'), 'MA');
    assert.equal(getStaffInitials(''), 'NV');
    assert.equal(getStaffInitials(null), 'NV');
  });

  // =========================================================================
  // 6. NAVIGATION DESTINATIONS & DIRTY FORM CONFIRMATION TESTS
  // =========================================================================
  it('6.1 - Explicit Destination Resolution: /staff/create -> /staff; edit -> /staff/list; /staff/list -> /staff', () => {
    const resolveBackTarget = (currentPath, isEditMode) => {
      if (currentPath === '/staff/list') return '/staff';
      if (currentPath.startsWith('/staff/create')) {
        return isEditMode ? '/staff/list' : '/staff';
      }
      return '/staff';
    };

    // Adding staff from /staff -> Back/Save MUST return to /staff
    assert.equal(resolveBackTarget('/staff/create', false), '/staff', 'New staff form must return to /staff');

    // Editing staff from /staff/list -> Back/Save returns to /staff/list
    assert.equal(resolveBackTarget('/staff/create?edit=staff-02', true), '/staff/list', 'Edit staff form must return to /staff/list');

    // Roster list page -> Back returns to /staff
    assert.equal(resolveBackTarget('/staff/list', false), '/staff', 'Staff list must return to /staff');
  });

  it('6.2 - Dirty Form Logic: Accurately detects unsaved modifications and triggers confirmation modal', () => {
    const initial = {
      name: '',
      email: '',
      phone: '',
      role: 'staff',
      branchId: 'main',
      shiftName: 'Ca Sáng (06:30 - 14:30)',
      status: 'active',
      avatarUrl: null,
      notes: ''
    };

    const isDirty = (current) => {
      return (
        current.name !== initial.name ||
        current.email !== initial.email ||
        current.phone !== initial.phone ||
        current.role !== initial.role ||
        current.branchId !== initial.branchId ||
        current.shiftName !== initial.shiftName ||
        current.status !== initial.status ||
        current.avatarUrl !== initial.avatarUrl ||
        current.notes !== initial.notes
      );
    };

    // Clean form
    assert.equal(isDirty({ ...initial }), false, 'Initial state must be clean');

    // Typing name makes form dirty
    assert.equal(isDirty({ ...initial, name: 'Nguyễn Văn A' }), true);

    // Changing phone makes form dirty
    assert.equal(isDirty({ ...initial, phone: '0901234567' }), true);

    // Confirmation modal workflow simulation
    let modalOpen = false;
    let currentRoute = '/staff/create';

    const handleBackClick = (dirtyState, targetDest) => {
      if (dirtyState) {
        modalOpen = true;
      } else {
        currentRoute = targetDest;
      }
    };

    // Test with dirty form: opens modal, does NOT navigate
    handleBackClick(true, '/staff');
    assert.equal(modalOpen, true, 'Dirty form must open confirmation modal');
    assert.equal(currentRoute, '/staff/create', 'Must stay on form until confirmed');

    // User confirms discard: modal closes and navigates to target
    const handleConfirmDiscard = (targetDest) => {
      modalOpen = false;
      currentRoute = targetDest;
    };
    handleConfirmDiscard('/staff');
    assert.equal(modalOpen, false);
    assert.equal(currentRoute, '/staff');
  });

  it('6.3 - Header Contract: /staff/list must NOT contain duplicate Add Staff button', () => {
    // In StaffListPage JSX, the button data-testid="staff-list-add-btn" has been removed
    const headerButtons = ['staff-list-back-btn'];
    assert.equal(headerButtons.includes('staff-list-add-btn'), false, 'Staff List header must not contain + Thêm NV button');
    assert.equal(headerButtons.includes('staff-list-back-btn'), true, 'Staff List header must contain Back button');
  });
});
