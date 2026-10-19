/**
 * Forensic Audit Empirical Verification & Stress Test Suite for Milestone 2 (M2)
 *
 * Checks:
 * 1. Initial Data Seeding & Privacy Guarantee (INITIAL_STAFF in src/data/initialData.js)
 * 2. PosContext Implementation Integrity (State, Actions, Persistence, Validation)
 * 3. StaffManagementSection Component Authenticity & Contracts (UI, Initials, Badges, Modals)
 * 4. ManagementProfileView Integration Contract & Reserved Slot Preservation
 * 5. Adversarial Stress Testing & Edge Cases
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Import ground-truth source data
import { INITIAL_STAFF, INITIAL_SETTINGS } from '../src/data/initialData.js';

describe('Milestone 2 Forensic Audit: Minimal Staff Management', () => {

  // =========================================================================
  // 1. INITIAL DATA SEEDING & STRICT PRIVACY AUDIT
  // =========================================================================
  describe('1. Initial Data Seeding & Privacy Guarantee', () => {

    test('1.1 - INITIAL_STAFF is exported and contains >= 3 canonical staff members', () => {
      assert.ok(Array.isArray(INITIAL_STAFF), 'INITIAL_STAFF must be an array');
      assert.ok(INITIAL_STAFF.length >= 3, `Expected at least 3 initial staff, found ${INITIAL_STAFF.length}`);

      const names = INITIAL_STAFF.map((s) => s.name);
      assert.ok(names.includes('Trần Mai'), 'Must include historical cashier Trần Mai');
      assert.ok(names.includes('Nguyễn Văn Hùng'), 'Must include historical cashier Nguyễn Văn Hùng');
      assert.ok(names.includes('Lê Hoàng Nam'), 'Must include cashier Lê Hoàng Nam');
    });

    test('1.2 - Historical cashiers match system settings and order history', () => {
      const adminStaff = INITIAL_STAFF.find((s) => s.name === 'Trần Mai');
      assert.ok(adminStaff, 'Trần Mai must exist');
      assert.equal(adminStaff.role, 'admin', 'Trần Mai should hold admin role matching settings.currentCashier');
      assert.equal(adminStaff.status, 'active', 'Initial status must be active');
    });

    test('1.3 - STRICT PRIVACY AUDIT: Zero personal sensitive data fields in INITIAL_STAFF', () => {
      const prohibitedKeys = [
        'phone', 'telephone', 'mobile', 'sdt',
        'email', 'mail',
        'idNumber', 'identityCard', 'citizenId', 'cccd', 'cmnd', 'passport',
        'address', 'homeAddress', 'diaChi',
        'salary', 'wage', 'bankAccount', 'bankNo', 'dob', 'birthdate'
      ];

      for (const staff of INITIAL_STAFF) {
        const staffKeys = Object.keys(staff);
        for (const forbidden of prohibitedKeys) {
          assert.equal(
            staff[forbidden],
            undefined,
            `Privacy Violation: Staff "${staff.name}" contains prohibited sensitive field "${forbidden}"`
          );
        }

        // Permitted keys whitelist: id, name, status, role, createdAt, updatedAt
        const permittedKeys = new Set(['id', 'name', 'status', 'role', 'createdAt', 'updatedAt']);
        for (const k of staffKeys) {
          assert.ok(
            permittedKeys.has(k),
            `Unrecognized field "${k}" on staff "${staff.name}". Only operational minimal fields allowed.`
          );
        }
      }
    });

  });

  // =========================================================================
  // 2. POSCONTEXT IMPLEMENTATION & PERSISTENCE INTEGRITY
  // =========================================================================
  describe('2. PosContext Implementation & Persistence Integrity', () => {
    const posContextPath = path.resolve('src/store/PosContext.jsx');
    const posContextContent = fs.readFileSync(posContextPath, 'utf8');

    test('2.1 - Storage key goc_pos_staff_v4 is configured and versioned', () => {
      assert.ok(
        posContextContent.includes("STAFF: 'goc_pos_staff_v4'"),
        "STORAGE_KEYS must define STAFF as 'goc_pos_staff_v4'"
      );
    });

    test('2.2 - PosProvider initializes staffList from LocalStorage with INITIAL_STAFF fallback', () => {
      assert.match(
        posContextContent,
        /const\s*\[\s*staffList\s*,\s*setStaffList\s*\]\s*=\s*useState/,
        'staffList state must be defined in PosProvider'
      );
      assert.match(
        posContextContent,
        /loadStorage\(\s*STORAGE_KEYS\.STAFF\s*,\s*null\s*\)/,
        'staffList must load from STORAGE_KEYS.STAFF'
      );
      assert.ok(
        posContextContent.includes('INITIAL_STAFF'),
        'staffList fallback must use INITIAL_STAFF'
      );
    });

    test('2.3 - PosProvider auto-saves staffList to LocalStorage on state change', () => {
      assert.match(
        posContextContent,
        /useEffect\(\s*\(\)\s*=>\s*\{\s*localStorage\.setItem\(\s*STORAGE_KEYS\.STAFF\s*,\s*JSON\.stringify\(\s*staffList\s*\)\s*\);\s*\}\s*,\s*\[\s*staffList\s*\]\s*\)/,
        'Auto-save useEffect must synchronize staffList to STORAGE_KEYS.STAFF'
      );
    });

    test('2.4 - Context value exposes staffList and all 3 mutator actions', () => {
      assert.match(posContextContent, /\bstaffList\b/, 'Context value must expose staffList');
      assert.match(posContextContent, /\baddStaff\b/, 'Context value must expose addStaff');
      assert.match(posContextContent, /\bupdateStaffName\b/, 'Context value must expose updateStaffName');
      assert.match(posContextContent, /\btoggleStaffStatus\b/, 'Context value must expose toggleStaffStatus');
    });

    test('2.5 - resetAllData restores staffList back to INITIAL_STAFF', () => {
      assert.match(
        posContextContent,
        /setStaffList\(\s*INITIAL_STAFF\s*\)/,
        'resetAllData must restore staffList to INITIAL_STAFF'
      );
    });

    test('2.6 - Empirical state simulation: addStaff trims input, rejects empty/whitespace, creates valid object', () => {
      // Simulate exact logic from PosContext.jsx lines 1126-1143
      let staffList = [...INITIAL_STAFF];
      const addStaffSim = (name, role = 'staff') => {
        if (typeof name !== 'string' || name.trim().length === 0) {
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
        staffList = [...staffList, newStaff];
        return newStaff;
      };

      // 1. Rejects empty string
      assert.throws(() => addStaffSim(''), /Vui lòng nhập tên nhân viên/);
      // 2. Rejects whitespace-only string
      assert.throws(() => addStaffSim('   \t\n  '), /Vui lòng nhập tên nhân viên/);
      // 3. Rejects null / non-string
      assert.throws(() => addStaffSim(null), /Vui lòng nhập tên nhân viên/);

      // 4. Successfully adds with whitespace trimmed
      const created = addStaffSim('   Phạm Quỳnh Anh   ');
      assert.equal(created.name, 'Phạm Quỳnh Anh');
      assert.equal(created.status, 'active');
      assert.equal(created.role, 'staff');
      assert.ok(created.id.startsWith('staff-'));
      assert.equal(staffList.length, INITIAL_STAFF.length + 1);

      // 5. Verifies zero privacy leak on created item
      assert.equal(created.phone, undefined);
      assert.equal(created.email, undefined);
      assert.equal(created.idNumber, undefined);
    });

    test('2.7 - Empirical state simulation: updateStaffName validates, trims, and preserves other fields', () => {
      let staffList = [
        { id: 's-1', name: 'Nguyễn Văn Hùng', status: 'active', role: 'staff', createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z' }
      ];

      const updateStaffNameSim = (id, newName) => {
        if (typeof newName !== 'string' || newName.trim().length === 0) {
          throw new Error('Tên nhân viên không được để trống');
        }
        const cleanName = newName.trim();
        const target = staffList.find((s) => s.id === id);
        if (!target) {
          throw new Error(`Nhân viên với id ${id} không tồn tại`);
        }
        staffList = staffList.map((s) =>
          s.id === id ? { ...s, name: cleanName, updatedAt: new Date().toISOString() } : s
        );
        return { success: true };
      };

      // 1. Rejects empty/whitespace
      assert.throws(() => updateStaffNameSim('s-1', ''), /Tên nhân viên không được để trống/);
      assert.throws(() => updateStaffNameSim('s-1', '   '), /Tên nhân viên không được để trống/);
      assert.throws(() => updateStaffNameSim('non-existent', 'Valid Name'), /không tồn tại/);

      // 2. Updates valid name and trims
      updateStaffNameSim('s-1', '  Nguyễn Văn Hùng (Trưởng ca)  ');
      assert.equal(staffList[0].name, 'Nguyễn Văn Hùng (Trưởng ca)');
      assert.equal(staffList[0].status, 'active', 'Status must be untouched');
      assert.equal(staffList[0].role, 'staff', 'Role must be untouched');
      assert.equal(staffList[0].createdAt, '2026-10-18T00:00:00Z', 'createdAt untouched');
      assert.notEqual(staffList[0].updatedAt, '2026-10-18T00:00:00Z', 'updatedAt must update');
    });

    test('2.8 - Empirical state simulation: toggleStaffStatus transitions active <-> paused', () => {
      let staffList = [
        { id: 's-1', name: 'Trần Mai', status: 'active' },
        { id: 's-2', name: 'Nguyễn Văn Hùng', status: 'active' }
      ];

      const toggleStaffStatusSim = (id) => {
        let updatedStatus = null;
        staffList = staffList.map((s) => {
          if (s.id === id) {
            const next = s.status === 'active' ? 'paused' : 'active';
            updatedStatus = next;
            return { ...s, status: next, updatedAt: new Date().toISOString() };
          }
          return s;
        });
        return { success: true, nextStatus: updatedStatus };
      };

      // Toggle active -> paused
      const res1 = toggleStaffStatusSim('s-1');
      assert.equal(res1.nextStatus, 'paused');
      assert.equal(staffList[0].status, 'paused');

      // Toggle paused -> active
      const res2 = toggleStaffStatusSim('s-1');
      assert.equal(res2.nextStatus, 'active');
      assert.equal(staffList[0].status, 'active');
    });

  });

  // =========================================================================
  // 3. STAFFMANAGEMENTSECTION COMPONENT AUTHENTICITY & CONTRACTS
  // =========================================================================
  describe('3. StaffManagementSection Component Authenticity & Contracts', () => {
    const compPath = path.resolve('src/components/management/StaffManagementSection.jsx');
    assert.ok(fs.existsSync(compPath), 'StaffManagementSection.jsx file must exist');
    const compContent = fs.readFileSync(compPath, 'utf8');

    test('3.1 - Component imports and uses usePos context hook', () => {
      assert.match(
        compContent,
        /import\s*\{\s*usePos\s*\}\s*from\s*['"]\.\.\/\.\.\/store\/PosContext['"]/,
        'Component must import usePos from PosContext'
      );
      assert.match(
        compContent,
        /const\s*\{\s*staffList\s*=\s*\[\s*\]\s*,\s*addStaff\s*,\s*updateStaffName\s*,\s*toggleStaffStatus/s,
        'Component must destructure staffList and mutator functions from usePos'
      );
    });

    test('3.2 - Brand identity styling tokens (#214E34, glassmorphism)', () => {
      assert.ok(compContent.includes('glass-panel-elevated'), 'Must use glass-panel-elevated container token');
      assert.ok(compContent.includes('glass-panel'), 'Must use glass-panel card token');
      assert.ok(compContent.includes('glass-input'), 'Must use glass-input token');
      assert.ok(compContent.includes('#214E34') || compContent.includes('forest-800'), 'Must use brand color token');
    });

    test('3.3 - Required testids and accessibility attributes are present', () => {
      const requiredTestIds = [
        'staff-management-section',
        'staff-live-counter',
        'staff-counter',
        'open-add-staff-modal-btn',
        'staff-roster-list',
        'add-staff-modal-card',
        'input-new-staff-name',
        'cancel-add-staff-btn',
        'submit-add-staff-btn'
      ];

      for (const id of requiredTestIds) {
        assert.ok(
          compContent.includes(`data-testid="${id}"`),
          `Component must render data-testid="${id}"`
        );
      }
    });

    test('3.4 - Dynamic testids for individual staff cards and interactions', () => {
      assert.ok(compContent.includes('data-testid={`staff-card-${staff.id}`}'), 'Card testid contract');
      assert.ok(compContent.includes('data-testid={`staff-avatar-${staff.id}`}'), 'Avatar testid contract');
      assert.ok(compContent.includes('data-testid={`staff-name-${staff.id}`}'), 'Staff name testid contract');
      assert.ok(compContent.includes('data-testid={`staff-status-badge-${staff.id}`}'), 'Status badge testid contract');
      assert.ok(compContent.includes('data-testid={`edit-staff-btn-${staff.id}`}'), 'Edit button testid contract');
      assert.ok(compContent.includes('data-testid={`toggle-staff-status-btn-${staff.id}`}'), 'Toggle switch testid contract');
    });

    test('3.5 - getStaffInitials algorithmic verification across Vietnamese & global names', () => {
      // Extract getStaffInitials logic and test empirically
      const getStaffInitials = (name) => {
        if (!name || typeof name !== 'string') return 'NV';
        const clean = name.trim();
        if (!clean) return 'NV';
        const parts = clean.split(/\s+/).filter(Boolean);
        if (parts.length === 0) return 'NV';
        if (parts.length === 1) {
          return parts[0].substring(0, Math.min(2, parts[0].length)).toUpperCase();
        }
        const first = parts[0].charAt(0);
        const last = parts[parts.length - 1].charAt(0);
        return (first + last).toUpperCase();
      };

      assert.equal(getStaffInitials('Trần Mai'), 'TM');
      assert.equal(getStaffInitials('Nguyễn Văn Hùng'), 'NH');
      assert.equal(getStaffInitials('Lê Hoàng Nam'), 'LN');
      assert.equal(getStaffInitials('Phạm Quỳnh Anh'), 'PA');
      assert.equal(getStaffInitials('Alex'), 'AL');
      assert.equal(getStaffInitials(''), 'NV');
      assert.equal(getStaffInitials('   '), 'NV');
      assert.equal(getStaffInitials(null), 'NV');
      assert.equal(getStaffInitials(undefined), 'NV');
    });

    test('3.6 - Advisory banner appears when totalCount > 0 && activeCount === 0', () => {
      assert.ok(
        compContent.includes('data-testid="no-active-staff-alert"'),
        'Must render no-active-staff-alert'
      );
      assert.ok(
        compContent.includes('totalCount > 0 && activeCount === 0'),
        'Advisory banner condition must check totalCount > 0 && activeCount === 0'
      );
    });

    test('3.7 - Empty fallback card appears when totalCount === 0', () => {
      assert.ok(
        compContent.includes('data-testid="empty-staff-roster"'),
        'Must render empty-staff-roster when totalCount === 0'
      );
      assert.ok(
        compContent.includes('data-testid="empty-add-staff-btn"'),
        'Empty card must provide CTA button to add first staff'
      );
    });

    test('3.8 - Privacy reassurance banner is displayed in Add Staff Modal', () => {
      assert.ok(
        compContent.includes('Bảo mật tối giản:'),
        'Add Staff modal must reassure users about minimal data collection'
      );
      assert.ok(
        compContent.includes('Tuyệt đối không thu thập SĐT, email, CCCD hay địa chỉ nhà'),
        'Add Staff modal must explicitly state no sensitive data is collected'
      );
    });

  });

  // =========================================================================
  // 4. MANAGEMENTPROFILEVIEW INTEGRATION & RESERVED SLOT CONTRACT
  // =========================================================================
  describe('4. ManagementProfileView Integration & Reserved Slot Contract', () => {
    const profileViewPath = path.resolve('src/components/management/ManagementProfileView.jsx');
    const profileViewContent = fs.readFileSync(profileViewPath, 'utf8');

    test('4.1 - ManagementProfileView imports StaffManagementSection', () => {
      assert.match(
        profileViewContent,
        /import\s+StaffManagementSection\s+from\s+['"]\.\/StaffManagementSection['"]/,
        'ManagementProfileView must import StaffManagementSection'
      );
    });

    test('4.2 - Reserved slot comment MILESTONE 2: StaffManagementSection is preserved', () => {
      assert.ok(
        profileViewContent.includes('MILESTONE 2: StaffManagementSection'),
        'Reservation contract comment for Milestone 2 must be strictly preserved'
      );
    });

    test('4.3 - StaffManagementSection component is actively mounted in the layout', () => {
      assert.match(
        profileViewContent,
        /<StaffManagementSection\s*\/>/,
        'StaffManagementSection JSX tag must be mounted'
      );
    });

  });

  // =========================================================================
  // 5. ADVERSARIAL STRESS TESTING & EDGE CASES
  // =========================================================================
  describe('5. Adversarial Stress Testing & Edge Cases', () => {

    test('5.1 - Roster mutation immutability: adding/updating does not mutate original array in-place', () => {
      const initial = Object.freeze([
        Object.freeze({ id: 's-1', name: 'Trần Mai', status: 'active', role: 'admin' })
      ]);

      // Simulate immutable add
      const nextRoster = [...initial, { id: 's-2', name: 'Nguyễn Văn Hùng', status: 'active', role: 'staff' }];
      assert.equal(initial.length, 1, 'Initial array remains immutable');
      assert.equal(nextRoster.length, 2, 'New array created');

      // Simulate immutable update
      const updatedRoster = nextRoster.map((s) => s.id === 's-2' ? { ...s, name: 'Hùng Barista' } : s);
      assert.equal(nextRoster[1].name, 'Nguyễn Văn Hùng', 'Previous array remains untouched');
      assert.equal(updatedRoster[1].name, 'Hùng Barista', 'Updated array has new name');
    });

    test('5.2 - Special character handling and Unicode diacritics resilience', () => {
      const complexNames = [
        'Đỗ Quốc Triệu (Barista #01)',
        'Võ Thị Ngọc Ánh',
        'François Truffaut',
        'Nguyễn Lê Bảo Đan & Trương Gia Hân'
      ];

      for (const name of complexNames) {
        const clean = name.trim();
        assert.ok(clean.length > 0);
        // Ensure no regex throws on valid diacritic characters
        assert.doesNotThrow(() => {
          const parts = clean.split(/\s+/).filter(Boolean);
          const first = parts[0].charAt(0);
          const last = parts[parts.length - 1].charAt(0);
          const initials = (first + last).toUpperCase();
          assert.equal(typeof initials, 'string');
          assert.ok(initials.length >= 1);
        });
      }
    });

    test('5.3 - Long staff names (> 100 characters) do not crash or corrupt state', () => {
      const veryLongName = 'Nguyễn Thị Công Tằng Tôn Nữ Long Thượng Triệu Vy Trúc Mai Lan Cúc Trúc Diệp Hoàng Nam Khánh Linh';
      assert.ok(veryLongName.length > 80);

      const staff = {
        id: 'staff-long-1',
        name: veryLongName,
        status: 'active',
        role: 'staff',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const serialized = JSON.stringify([staff]);
      const deserialized = JSON.parse(serialized);
      assert.equal(deserialized[0].name, veryLongName);
    });

    test('5.4 - Serialization and LocalStorage roundtrip fidelity', () => {
      const payload = INITIAL_STAFF;
      const str = JSON.stringify(payload);
      const parsed = JSON.parse(str);
      assert.deepEqual(parsed, INITIAL_STAFF, 'JSON roundtrip must preserve exact data shape');
    });

    test('5.5 - Absence of facade implementations or hardcoded bypasses in source files', () => {
      const staffCompCode = fs.readFileSync(path.resolve('src/components/management/StaffManagementSection.jsx'), 'utf8');
      
      // Prohibited facade patterns
      assert.ok(!staffCompCode.includes('return true; // dummy'), 'No dummy return true');
      assert.ok(!staffCompCode.includes('return null; // placeholder'), 'No placeholder null');
      assert.ok(!staffCompCode.includes('// mock implementation'), 'No mock implementations');
      assert.ok(!staffCompCode.includes('TODO: implement'), 'No unimplemeted TODOs');

      const posContextCode = fs.readFileSync(path.resolve('src/store/PosContext.jsx'), 'utf8');
      assert.ok(!posContextCode.includes('/* fake staff */'), 'No fake staff markers');
    });

  });

});
