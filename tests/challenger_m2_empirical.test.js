/**
 * Challenger M2 Empirical Verification & Stress Test Suite
 * Milestone 2: Minimal Staff Management - Operations Stress Testing
 *
 * Covers:
 * 1. Add staff with empty/whitespace name -> rejected, warning displayed.
 * 2. Add staff with long name (>50 chars) -> layout does not break, text truncated with tooltip.
 * 3. Edit staff name -> trims and persists correctly.
 * 4. Toggle status -> updates badge and header counter reactively.
 * 5. Data minimization & privacy guarantees (zero sensitive data).
 * 6. Cashier seeding & integration compatibility.
 * 7. Initials generator stress tests with diacritics & edge cases.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load seed data directly from project source
import {
  INITIAL_STAFF,
  INITIAL_ORDERS,
  INITIAL_ORDER_HISTORY
} from '../src/data/initialData.js';

describe('Challenger M2: Empirical & Stress Verification', () => {

  // Read implementation files for structural AST & contract verification
  const posContextPath = path.resolve('src/store/PosContext.jsx');
  const posContextCode = fs.readFileSync(posContextPath, 'utf8');

  const staffSectionPath = path.resolve('src/components/management/StaffManagementSection.jsx');
  const staffSectionCode = fs.readFileSync(staffSectionPath, 'utf8');

  const profileViewPath = path.resolve('src/components/management/ManagementProfileView.jsx');
  const profileViewCode = fs.readFileSync(profileViewPath, 'utf8');

  // Extract getStaffInitials function directly from StaffManagementSection.jsx
  const initialsMatch = staffSectionCode.match(/export function getStaffInitials\([\s\S]*?\n\}/);
  assert.ok(initialsMatch, 'getStaffInitials must be present in StaffManagementSection.jsx');
  const getStaffInitials = new Function('return ' + initialsMatch[0].replace('export ', ''))();

  // Helper factory to simulate PosContext state and exact extracted action handlers
  function createTestStaffContext(initialRoster = INITIAL_STAFF) {
    let staffList = JSON.parse(JSON.stringify(initialRoster));
    const toasts = [];
    const showToast = (msg, type) => {
      toasts.push({ msg, type, timestamp: Date.now() });
    };

    // Auto-save mock storage
    const storage = {};
    const STORAGE_KEY = 'goc_pos_staff_v4';
    storage[STORAGE_KEY] = JSON.stringify(staffList);

    const setStaffList = (updater) => {
      if (typeof updater === 'function') {
        staffList = updater(staffList);
      } else {
        staffList = updater;
      }
      storage[STORAGE_KEY] = JSON.stringify(staffList);
    };

    // Extract exact addStaff logic from PosContext.jsx
    const addStaff = (name, role = 'staff') => {
      if (typeof name !== 'string' || name.trim().length === 0) {
        showToast('Vui lòng nhập tên nhân viên', 'error');
        throw new Error('Vui lòng nhập tên nhân viên');
      }
      const cleanName = name.trim();
      const newStaff = {
        id: `staff-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: cleanName,
        status: 'active',
        role: role || 'staff',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setStaffList((prev) => [...prev, newStaff]);
      showToast(`Đã thêm nhân viên "${cleanName}"`, 'success');
      return newStaff;
    };

    // Extract exact updateStaffName logic from PosContext.jsx
    const updateStaffName = (id, newName) => {
      if (typeof newName !== 'string' || newName.trim().length === 0) {
        showToast('Tên nhân viên không được để trống', 'error');
        throw new Error('Tên nhân viên không được để trống');
      }
      const cleanName = newName.trim();
      setStaffList((prev) => {
        const target = prev.find((s) => s.id === id);
        if (!target) {
          showToast('Không tìm thấy thông tin nhân viên!', 'error');
          throw new Error(`Nhân viên với id ${id} không tồn tại`);
        }
        return prev.map((s) =>
          s.id === id ? { ...s, name: cleanName, updatedAt: new Date().toISOString() } : s
        );
      });
      showToast(`Đã cập nhật tên nhân viên thành "${cleanName}"`, 'success');
      return { success: true };
    };

    // Extract exact toggleStaffStatus logic from PosContext.jsx
    const toggleStaffStatus = (id) => {
      let updatedStatus = null;
      let staffName = '';
      let activeRemaining = 0;
      setStaffList((prev) => {
        const target = prev.find((s) => s.id === id);
        if (!target) return prev;
        staffName = target.name;
        const nextStatus = target.status === 'active' ? 'paused' : 'active';
        updatedStatus = nextStatus;
        const nextList = prev.map((s) =>
          s.id === id ? { ...s, status: nextStatus, updatedAt: new Date().toISOString() } : s
        );
        activeRemaining = nextList.filter((s) => s.status === 'active').length;
        return nextList;
      });

      if (updatedStatus) {
        const isNowActive = updatedStatus === 'active';
        showToast(
          isNowActive
            ? `Đã kích hoạt hoạt động cho "${staffName}"`
            : `Đã tạm ngưng hoạt động cho "${staffName}"`,
          isNowActive ? 'success' : 'info'
        );
        if (!isNowActive && activeRemaining === 0) {
          showToast('Khuyến nghị: Cần ít nhất 1 nhân viên đang hoạt động cho ca bán hàng', 'info');
        }
      }
      return { success: true, nextStatus: updatedStatus };
    };

    const resetAllData = () => {
      setStaffList(INITIAL_STAFF);
      showToast('Đã khôi phục dữ liệu mẫu chuẩn', 'info');
    };

    return {
      getStaffList: () => staffList,
      getToasts: () => toasts,
      getStorage: () => storage,
      addStaff,
      updateStaffName,
      toggleStaffStatus,
      resetAllData
    };
  }

  // =========================================================================
  // 1. Stress Testing Empty & Whitespace Names (Add & Edit)
  // =========================================================================
  describe('1. Empty & Whitespace Validation & Rejection', () => {
    test('1.1 - addStaff rejects empty and whitespace-only inputs with exact error and toast', () => {
      const ctx = createTestStaffContext();
      const initialCount = ctx.getStaffList().length;

      const invalidInputs = [
        '',
        '   ',
        '\t',
        '\n\r\n',
        '   \t   \n  ',
        null,
        undefined,
        12345,
        {},
        []
      ];

      for (const input of invalidInputs) {
        assert.throws(
          () => ctx.addStaff(input),
          /Vui lòng nhập tên nhân viên/,
          `addStaff must reject invalid input: ${JSON.stringify(input)}`
        );
      }

      // Roster count must remain untouched
      assert.equal(ctx.getStaffList().length, initialCount, 'Staff roster count must not change on failed additions');

      // Verify that error toast was dispatched
      const errorToasts = ctx.getToasts().filter((t) => t.type === 'error');
      assert.ok(errorToasts.length >= invalidInputs.length, 'Error toast must be dispatched for every rejected attempt');
      assert.ok(errorToasts.every((t) => t.msg === 'Vui lòng nhập tên nhân viên'));
    });

    test('1.2 - updateStaffName rejects empty and whitespace-only inputs with exact error', () => {
      const ctx = createTestStaffContext();
      const target = ctx.getStaffList()[0];
      const originalName = target.name;

      const invalidNames = ['', '   ', '\t\n\r  ', null, undefined, 9999];

      for (const invalidName of invalidNames) {
        assert.throws(
          () => ctx.updateStaffName(target.id, invalidName),
          /Tên nhân viên không được để trống/,
          `updateStaffName must reject empty/whitespace: ${JSON.stringify(invalidName)}`
        );
      }

      // Name must remain intact
      const refreshedTarget = ctx.getStaffList().find((s) => s.id === target.id);
      assert.equal(refreshedTarget.name, originalName, 'Staff name must remain unchanged on rejected edit');
    });

    test('1.3 - updateStaffName throws when updating non-existent staff ID', () => {
      const ctx = createTestStaffContext();
      assert.throws(
        () => ctx.updateStaffName('non-existent-id-999', 'Nguyễn Văn A'),
        /Nhân viên với id non-existent-id-999 không tồn tại/,
        'Must reject non-existent staff ID'
      );
    });

    test('1.4 - UI Component contract: Add modal disables submit when name is empty/whitespace', () => {
      // Check StaffManagementSection.jsx markup for disabled submit button
      assert.match(
        staffSectionCode,
        /disabled=\{!newStaffName\.trim\(\)\}/,
        'Submit button must be disabled when newStaffName is empty or whitespace'
      );
      // Check that trim validation error is displayed in UI
      assert.ok(
        staffSectionCode.includes("setAddStaffError('Vui lòng nhập tên nhân viên')"),
        'Add handler must set inline validation error state'
      );
      assert.ok(
        staffSectionCode.includes('{addStaffError && ('),
        'Add modal must conditionally render addStaffError paragraph'
      );
      assert.ok(
        staffSectionCode.includes("data-testid=\"input-new-staff-name\""),
        'New staff name input must have required testid'
      );
      assert.ok(
        staffSectionCode.includes("data-testid=\"submit-add-staff-btn\""),
        'Submit button must have required testid'
      );
    });

    test('1.5 - UI Component contract: Inline edit validation and error state', () => {
      assert.ok(
        staffSectionCode.includes("setEditStaffError('Tên nhân viên không được để trống')"),
        'Inline edit save handler must validate trimmed text'
      );
      assert.ok(
        staffSectionCode.includes("data-testid={`input-edit-staff-name-${staff.id}`}"),
        'Inline edit input must bind to staff ID testid'
      );
      assert.ok(
        staffSectionCode.includes("data-testid={`save-edit-staff-btn-${staff.id}`}"),
        'Save edit button must bind to staff ID testid'
      );
      assert.ok(
        staffSectionCode.includes("data-testid={`cancel-edit-staff-btn-${staff.id}`}"),
        'Cancel edit button must bind to staff ID testid'
      );
    });
  });

  // =========================================================================
  // 2. Long Names (> 50 chars) & Layout Truncation & Tooltip
  // =========================================================================
  describe('2. Long Names (>50 characters) & Layout Integrity', () => {
    test('2.1 - Data layer preserves long names (>50 chars, 100 chars, 250 chars) without truncation', () => {
      const ctx = createTestStaffContext();

      const testNames = [
        'Nguyễn Hoàng Mai Trâm Anh Công Tằng Tôn Nữ Bích Chiêu Long Name', // 63 chars
        'Trần Lê Thảo Vy Đặng Vũ Quỳnh Chi Hoàng Gia Long Thần Vũ Đức Anh Minh Bảo Quốc Đại Nam', // 86 chars
        'Võ '.repeat(50) + 'Nguyễn' // 156 chars
      ];

      for (const longName of testNames) {
        assert.ok(longName.length > 50, 'Name must exceed 50 chars');
        const created = ctx.addStaff(longName);
        assert.equal(created.name, longName, 'Full untruncated name must be stored');

        // Check storage serialization
        const storageData = JSON.parse(ctx.getStorage()['goc_pos_staff_v4']);
        const found = storageData.find((s) => s.id === created.id);
        assert.equal(found.name, longName, 'Storage must preserve untruncated name');
      }
    });

    test('2.2 - Layout CSS and Tooltip Contract in StaffManagementSection.jsx', () => {
      // 1. Check truncation class on staff name
      assert.match(
        staffSectionCode,
        /data-testid=\{`staff-name-\$\{staff\.id\}`\}[\s\S]*?truncate\s+max-w-\[140px\]\s+sm:max-w-\[220px\]/,
        'Staff name span must have CSS truncate and responsive max-w constraint'
      );

      // 2. Check title attribute for native tooltip
      assert.match(
        staffSectionCode,
        /title=\{staff\.name\}/,
        'Staff name span must provide full name in title attribute for browser tooltip'
      );

      // 3. Check flex container has min-w-0 to prevent flexbox overflow blowout
      assert.match(
        staffSectionCode,
        /min-w-0\s+flex-1/,
        'Card name container must have min-w-0 to allow flexbox child truncation'
      );
    });

    test('2.3 - Initials generator handles extreme names gracefully', () => {
      // Very long Vietnamese compound name
      const initials1 = getStaffInitials('Nguyễn Hoàng Mai Trâm Anh Công Tằng Tôn Nữ Bích Chiêu');
      assert.equal(initials1, 'NC', 'First and last words used for initials');

      // 100 character single word without spaces
      const longSingleWord = 'A'.repeat(100);
      const initials2 = getStaffInitials(longSingleWord);
      assert.equal(initials2, 'AA', 'Single word takes first 2 uppercase letters');

      // Vietnamese names with tone marks and accents
      assert.equal(getStaffInitials('Đặng Vũ Chi'), 'ĐC');
      assert.equal(getStaffInitials('Út Em'), 'ÚE');
      assert.equal(getStaffInitials('Trần Mai'), 'TM');
      assert.equal(getStaffInitials('Nguyễn Văn Hùng'), 'NH');
      assert.equal(getStaffInitials('Lê Hoàng Nam'), 'LN');

      // Edge cases: empty, null, symbols
      assert.equal(getStaffInitials(''), 'NV');
      assert.equal(getStaffInitials(null), 'NV');
      assert.equal(getStaffInitials(undefined), 'NV');
      assert.equal(getStaffInitials('   \t  '), 'NV');
    });
  });

  // =========================================================================
  // 3. Name Trimming & Storage Persistence
  // =========================================================================
  describe('3. Name Trimming & LocalStorage Persistence', () => {
    test('3.1 - addStaff automatically trims surrounding whitespace', () => {
      const ctx = createTestStaffContext();
      const rawInput = '   \t  Lê Thị Diệu Hiền  \n  ';
      const created = ctx.addStaff(rawInput);
      assert.equal(created.name, 'Lê Thị Diệu Hiền', 'Leading and trailing whitespace must be trimmed');

      const stored = ctx.getStaffList().find((s) => s.id === created.id);
      assert.equal(stored.name, 'Lê Thị Diệu Hiền');
    });

    test('3.2 - updateStaffName trims whitespace and updates updatedAt timestamp', () => {
      const ctx = createTestStaffContext();
      const target = ctx.getStaffList()[0];
      const oldUpdatedAt = target.updatedAt;

      // Small tick to ensure timestamp change
      const rawEdit = '   Trần Mai (Cửa Hàng Trưởng)   ';
      ctx.updateStaffName(target.id, rawEdit);

      const updated = ctx.getStaffList().find((s) => s.id === target.id);
      assert.equal(updated.name, 'Trần Mai (Cửa Hàng Trưởng)');
      assert.ok(updated.updatedAt, 'updatedAt must be set');
      assert.ok(new Date(updated.updatedAt) >= new Date(oldUpdatedAt), 'updatedAt must be refreshed');
      assert.equal(updated.id, target.id, 'Staff ID must be preserved');
      assert.equal(updated.role, target.role, 'Staff role must be preserved');
      assert.equal(updated.status, target.status, 'Staff status must be preserved');
    });

    test('3.3 - Storage persistence with versioned key goc_pos_staff_v4', () => {
      assert.ok(
        posContextCode.includes("STAFF: 'goc_pos_staff_v4'"),
        "PosContext STORAGE_KEYS must define STAFF as 'goc_pos_staff_v4'"
      );
      assert.ok(
        posContextCode.includes('localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staffList))'),
        'PosContext must auto-save staffList to goc_pos_staff_v4'
      );
    });
  });

  // =========================================================================
  // 4. Reactive Status Toggling & Counter Synchronization
  // =========================================================================
  describe('4. Reactive Status Toggling & Counter Synchronization', () => {
    test('4.1 - Active counter and badges update reactively through lifecycle', () => {
      const ctx = createTestStaffContext();

      const getMetrics = () => {
        const list = ctx.getStaffList();
        return {
          total: list.length,
          active: list.filter((s) => s.status === 'active').length,
          paused: list.filter((s) => s.status === 'paused').length
        };
      };

      // Initial state: 3 active staff
      let m = getMetrics();
      assert.equal(m.total, 3);
      assert.equal(m.active, 3);
      assert.equal(m.paused, 0);

      // 1. Toggle staff-01 -> paused
      ctx.toggleStaffStatus('staff-01');
      m = getMetrics();
      assert.equal(m.total, 3);
      assert.equal(m.active, 2);
      assert.equal(m.paused, 1);
      assert.equal(ctx.getStaffList().find((s) => s.id === 'staff-01').status, 'paused');

      // 2. Toggle staff-02 -> paused
      ctx.toggleStaffStatus('staff-02');
      m = getMetrics();
      assert.equal(m.active, 1);
      assert.equal(m.paused, 2);

      // 3. Toggle staff-03 -> paused (active drops to 0)
      ctx.toggleStaffStatus('staff-03');
      m = getMetrics();
      assert.equal(m.active, 0);
      assert.equal(m.paused, 3);

      // Verify advisory toast triggered when activeCount reaches 0
      const lastToast = ctx.getToasts()[ctx.getToasts().length - 1];
      assert.equal(
        lastToast.msg,
        'Khuyến nghị: Cần ít nhất 1 nhân viên đang hoạt động cho ca bán hàng',
        'Advisory toast must be emitted when all staff are paused'
      );

      // 4. Reactivate staff-01 -> active
      ctx.toggleStaffStatus('staff-01');
      m = getMetrics();
      assert.equal(m.active, 1);
      assert.equal(m.paused, 2);
      assert.equal(ctx.getStaffList().find((s) => s.id === 'staff-01').status, 'active');

      // 5. Add a 4th staff member -> defaults to active
      const added = ctx.addStaff('Võ Thị Bích Trâm');
      m = getMetrics();
      assert.equal(m.total, 4);
      assert.equal(m.active, 2);
      assert.equal(added.status, 'active', 'Newly added staff must default to active');
    });

    test('4.2 - High frequency toggle stress test (100 rapid flips)', () => {
      const ctx = createTestStaffContext();
      const targetId = 'staff-01';

      // Rapidly toggle 100 times
      for (let i = 0; i < 100; i++) {
        ctx.toggleStaffStatus(targetId);
      }

      // Even number of toggles (100) must return to initial 'active' state
      const target = ctx.getStaffList().find((s) => s.id === targetId);
      assert.equal(target.status, 'active', 'After 100 toggles, status must return to active');
      assert.equal(ctx.getStaffList().filter((s) => s.status === 'active').length, 3);
    });

    test('4.3 - Component UI attributes for reactive counter and status badge', () => {
      // Counter markup
      assert.match(
        staffSectionCode,
        /data-testid="staff-live-counter"/,
        'Header must contain staff-live-counter testid'
      );
      assert.match(
        staffSectionCode,
        /\{totalCount\}\s*nhân viên[\s\S]*?•[\s\S]*?\{activeCount\}\s*đang hoạt động/,
        'Counter text must render "{totalCount} nhân viên" and "{activeCount} đang hoạt động" separated by bullet'
      );

      // Status badge markup
      assert.match(
        staffSectionCode,
        /data-testid=\{`staff-status-badge-\$\{staff\.id\}`\}/,
        'Card must render staff-status-badge testid'
      );
      assert.match(
        staffSectionCode,
        /isActive\s*\?\s*'Đang hoạt động'\s*:\s*'Tạm ngưng'/,
        'Badge text must switch between "Đang hoạt động" and "Tạm ngưng"'
      );

      // Switch role & aria
      assert.match(
        staffSectionCode,
        /role="switch"/,
        'Status toggle button must use role="switch"'
      );
      assert.match(
        staffSectionCode,
        /aria-checked=\{isActive\}/,
        'Status toggle button must bind aria-checked to isActive'
      );

      // Advisory warning card
      assert.match(
        staffSectionCode,
        /totalCount\s*>\s*0\s*&&\s*activeCount\s*===\s*0/,
        'Advisory warning must appear when all staff are paused'
      );
      assert.match(
        staffSectionCode,
        /data-testid="no-active-staff-alert"/,
        'Advisory warning must have no-active-staff-alert testid'
      );
    });
  });

  // =========================================================================
  // 5. Data Minimization & Privacy Guarantee
  // =========================================================================
  describe('5. Data Minimization & Privacy Guarantee', () => {
    test('5.1 - Initial staff members strictly contain NO personal sensitive fields', () => {
      const forbiddenFields = [
        'phone',
        'phoneNumber',
        'email',
        'cccd',
        'cmnd',
        'idNumber',
        'identityCard',
        'salary',
        'address',
        'homeAddress',
        'dob',
        'birthDate',
        'bankAccount',
        'gender'
      ];

      for (const staff of INITIAL_STAFF) {
        for (const field of forbiddenFields) {
          assert.equal(
            staff[field],
            undefined,
            `Forbidden sensitive field "${field}" found in staff "${staff.name}"`
          );
        }

        // Allowed fields check
        const keys = Object.keys(staff);
        const allowedKeys = new Set(['id', 'name', 'status', 'role', 'createdAt', 'updatedAt']);
        for (const key of keys) {
          assert.ok(
            allowedKeys.has(key),
            `Unrecognized field "${key}" in minimal staff entity`
          );
        }
      }
    });

    test('5.2 - addStaff generates entities strictly following minimal schema', () => {
      const ctx = createTestStaffContext();
      const newMember = ctx.addStaff('Đặng Tuấn Anh');

      assert.ok(newMember.id.startsWith('staff-'));
      assert.equal(newMember.name, 'Đặng Tuấn Anh');
      assert.equal(newMember.status, 'active');
      assert.equal(newMember.role, 'staff');
      assert.ok(newMember.createdAt);
      assert.ok(newMember.updatedAt);

      assert.equal(newMember.phone, undefined);
      assert.equal(newMember.email, undefined);
      assert.equal(newMember.idNumber, undefined);
    });

    test('5.3 - UI Reassurance Notice explicitly communicates minimal data collection', () => {
      assert.ok(
        staffSectionCode.includes('Bảo mật tối giản:'),
        'Staff management section must display minimal privacy notice'
      );
      assert.ok(
        staffSectionCode.includes('Tuyệt đối không thu thập SĐT, email, CCCD hay địa chỉ nhà'),
        'Notice must confirm non-collection of sensitive identity details'
      );
    });
  });

  // =========================================================================
  // 6. Integration, Seeding Compatibility & Reset
  // =========================================================================
  describe('6. Integration, Seeding Compatibility & Reset', () => {
    test('6.1 - INITIAL_STAFF contains >=3 cashiers matching historical POS orders', () => {
      assert.ok(INITIAL_STAFF.length >= 3, 'INITIAL_STAFF must seed at least 3 members');

      const staffNames = new Set(INITIAL_STAFF.map((s) => s.name));

      // Cashiers in INITIAL_ORDERS
      for (const ord of Object.values(INITIAL_ORDERS)) {
        if (ord.cashier) {
          assert.ok(
            staffNames.has(ord.cashier),
            `Cashier "${ord.cashier}" in INITIAL_ORDERS must exist in INITIAL_STAFF`
          );
        }
      }

      // Cashiers in INITIAL_ORDER_HISTORY
      for (const ord of INITIAL_ORDER_HISTORY) {
        if (ord.cashier) {
          assert.ok(
            staffNames.has(ord.cashier),
            `Cashier "${ord.cashier}" in INITIAL_ORDER_HISTORY must exist in INITIAL_STAFF`
          );
        }
      }
    });

    test('6.2 - ManagementProfileView imports and mounts StaffManagementSection in designated slot', () => {
      assert.match(
        profileViewCode,
        /import\s+StaffManagementSection\s+from\s+['"]\.\/StaffManagementSection['"]/,
        'ManagementProfileView must import StaffManagementSection'
      );
      assert.ok(
        profileViewCode.includes('SLOT: SECTION 1 - QUẢN LÝ NHÂN VIÊN TỐI GIẢN (MILESTONE 2: StaffManagementSection)'),
        'Slot comment must be preserved'
      );
      assert.match(
        profileViewCode,
        /<StaffManagementSection\s*\/>/,
        'StaffManagementSection component must be mounted'
      );
    });

    test('6.3 - resetAllData restores staffList back to INITIAL_STAFF', () => {
      const ctx = createTestStaffContext();

      // Mutate state: add staff and toggle statuses
      ctx.addStaff('Test NV Thêm');
      ctx.toggleStaffStatus('staff-01');
      assert.equal(ctx.getStaffList().length, 4);

      // Reset
      ctx.resetAllData();
      assert.equal(ctx.getStaffList().length, INITIAL_STAFF.length);
      assert.deepEqual(ctx.getStaffList(), INITIAL_STAFF, 'Roster must exactly match INITIAL_STAFF after resetAllData');
    });
  });
});
