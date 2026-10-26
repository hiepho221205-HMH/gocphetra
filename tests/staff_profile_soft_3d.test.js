import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('GÓC POS — Complete Employee Management UI Redesign (Soft 3D) Test Suite', () => {
  const staffListPath = path.resolve('src/components/management/StaffListPage.jsx');
  const staffEditPath = path.resolve('src/components/management/StaffEditProfilePage.jsx');
  const managementViewPath = path.resolve('src/components/management/ManagementProfileView.jsx');
  const staffSectionPath = path.resolve('src/components/management/StaffManagementSection.jsx');

  const staffListContent = fs.readFileSync(staffListPath, 'utf8');
  const staffEditContent = fs.readFileSync(staffEditPath, 'utf8');
  const managementViewContent = fs.readFileSync(managementViewPath, 'utf8');
  const staffSectionContent = fs.readFileSync(staffSectionPath, 'utf8');

  /* ========================================================================= */
  /* 1. NAVIGATION STRUCTURE CONTRACT                                          */
  /* ========================================================================= */
  describe('1. Navigation Structure & Route Registration', () => {
    it('1.1 - ManagementProfileView registers /staff/edit route for StaffEditProfilePage', () => {
      assert.ok(
        managementViewContent.includes("currentRoute === '/staff/edit'"),
        'Must register /staff/edit route'
      );
      assert.ok(
        managementViewContent.includes('<StaffEditProfilePage />') ||
        managementViewContent.includes('StaffEditProfilePage'),
        'Must render StaffEditProfilePage'
      );
    });

    it('1.2 - Peer navigation: Back from /staff/list explicitly returns to /staff', () => {
      assert.ok(
        staffListContent.includes("navigate('/staff')"),
        'StaffListPage back button must explicitly navigate to /staff'
      );
    });

    it('1.3 - Peer navigation: Back from /staff/edit explicitly returns to /staff/list', () => {
      assert.ok(
        staffEditContent.includes("navigate('/staff/list')"),
        'StaffEditProfilePage back button must explicitly navigate to /staff/list'
      );
    });

    it('1.4 - No uncontrolled navigate(-1) used in StaffListPage or StaffEditProfilePage', () => {
      assert.equal(
        staffListContent.includes('navigate(-1)'),
        false,
        'StaffListPage must not use uncontrolled navigate(-1)'
      );
      assert.equal(
        staffEditContent.includes('navigate(-1)'),
        false,
        'StaffEditProfilePage must not use uncontrolled navigate(-1)'
      );
    });
  });

  /* ========================================================================= */
  /* 2. STAFF LIST PAGE REDESIGN & SOFT 3D CARD CONTRACT                       */
  /* ========================================================================= */
  describe('2. Staff List Page (Soft 3D Floating Cards)', () => {
    it('2.1 - Header has Back button, Title, Subtitle with count, and NO Add Staff button', () => {
      assert.ok(
        staffListContent.includes('data-testid="staff-list-back-btn"'),
        'Header must have back button with testid staff-list-back-btn'
      );
      assert.ok(
        staffListContent.includes('Danh sách Nhân viên'),
        'Header title must be Danh sách Nhân viên'
      );
      assert.equal(
        staffListContent.includes('data-testid="staff-list-add-btn"'),
        false,
        'Staff List header must NOT have + Thêm nhân viên button'
      );
    });

    it('2.2 - Search bar features floating inset 3D styling and Mint/Forest focus', () => {
      assert.ok(
        staffListContent.includes('data-testid="staff-search-input"'),
        'Must have search input with testid staff-search-input'
      );
      assert.ok(
        staffListContent.includes('bg-[#F5F7F8]'),
        'Must use #F5F7F8 background for search input'
      );
      assert.ok(
        staffListContent.includes('shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]'),
        'Must have inset 3D shadow for search input'
      );
    });

    it('2.3 - Filter pills: Active pill uses Forest Green #214E34 and white text', () => {
      assert.ok(
        staffListContent.includes('bg-[#214E34] text-white'),
        'Active pill must use #214E34 background and white text'
      );
      assert.ok(
        staffListContent.includes('data-testid="filter-role-all"') &&
        staffListContent.includes('data-testid="filter-role-admin"') &&
        staffListContent.includes('data-testid="filter-role-manager"') &&
        staffListContent.includes('data-testid="filter-role-staff"'),
        'Role filter pills must be present'
      );
      assert.ok(
        staffListContent.includes('data-testid="filter-status-active"') &&
        staffListContent.includes('data-testid="filter-status-paused"'),
        'Status filter pills must be present'
      );
    });

    it('2.4 - Card is a Floating Surface with rounded 22px and dual-layer Soft 3D shadow', () => {
      assert.ok(
        staffListContent.includes('rounded-[22px]'),
        'Card must use rounded-[22px] border radius'
      );
      assert.ok(
        staffListContent.includes('shadow-[0_6px_18px_rgba(20,55,35,0.07),0_2px_5px_rgba(20,55,35,0.04)]'),
        'Card must use dual-layer Soft 3D shadow'
      );
    });

    it('2.5 - Card interaction: Pressed 3D effect (scale 0.985, translateY 1px)', () => {
      assert.ok(
        staffListContent.includes('active:scale-[0.985]'),
        'Card must scale to 0.985 on press'
      );
      assert.ok(
        staffListContent.includes('active:translate-y-[1px]'),
        'Card must translateY 1px on press'
      );
    });

    it('2.6 - WHOLE CARD IS CLICKABLE to navigate to /staff/edit?id=...', () => {
      assert.ok(
        staffListContent.includes("navigate(`/staff/edit?id=${staff.id}`)"),
        'Clicking card must navigate to /staff/edit with staff id'
      );
    });

    it('2.7 - STRICT REQUIREMENT: NO Sửa, Chi tiết, or Xóa buttons on card', () => {
      // Must not render explicit edit, detail or delete buttons on card
      assert.equal(
        staffListContent.includes('data-testid={`edit-staff-btn-${staff.id}`}'),
        false,
        'Staff list card must NOT have Sửa button'
      );
      assert.equal(
        staffListContent.includes('data-testid={`delete-staff-btn-${staff.id}`}'),
        false,
        'Staff list card must NOT have Xóa button'
      );
    });

    it('2.8 - Card contains circular 50px avatar, presence dot, badges, and ChevronRight', () => {
      assert.ok(
        staffListContent.includes('w-[50px] h-[50px]'),
        'Avatar must be 50px'
      );
      assert.ok(
        staffListContent.includes('ChevronRight'),
        'Card must render ChevronRight indicator'
      );
      assert.ok(
        staffListContent.includes('data-testid="badge-status-suspended"'),
        'Must render suspended badge'
      );
      assert.ok(
        staffListContent.includes('data-testid="badge-status-online"'),
        'Must render online presence badge'
      );
      assert.ok(
        staffListContent.includes('data-testid="badge-status-offline"'),
        'Must render offline presence badge'
      );
    });
  });

  /* ========================================================================= */
  /* 3. DEDICATED STAFF PROFILE EDIT PAGE SPECIFICATIONS                       */
  /* ========================================================================= */
  describe('3. Dedicated Staff Profile Edit Page (StaffEditProfilePage)', () => {
    it('3.1 - Renders 3D Hero Card with 80px avatar and camera upload action', () => {
      assert.ok(
        staffEditContent.includes('data-testid="staff-edit-hero-card"'),
        'Must render staff-edit-hero-card'
      );
      assert.ok(
        staffEditContent.includes('w-20 h-20'),
        'Hero avatar must be 80px (w-20 h-20)'
      );
      assert.ok(
        staffEditContent.includes('data-testid="upload-avatar-btn"'),
        'Hero avatar must render upload-avatar-btn'
      );
    });

    it('3.2 - Role Badge is READ-ONLY with notice that RBAC changes stay in RBAC page', () => {
      assert.ok(
        staffEditContent.includes('data-testid="hero-role-badge"'),
        'Must render read-only hero-role-badge'
      );
      assert.equal(
        staffEditContent.includes('<select') && staffEditContent.includes('formRole'),
        false,
        'Profile edit form must NOT allow changing role directly'
      );
    });

    it('3.3 - Group 1: Thông tin cá nhân (Editable Name, Read-only Code with lock)', () => {
      assert.ok(
        staffEditContent.includes('data-testid="input-staff-name"'),
        'Must have input-staff-name'
      );
      assert.ok(
        staffEditContent.includes('data-testid="input-staff-code-readonly"'),
        'Must have read-only staff code with lock'
      );
    });

    it('3.4 - Group 2: Thông tin liên hệ (Editable Phone, Read-only Auth Email with lock)', () => {
      assert.ok(
        staffEditContent.includes('data-testid="input-staff-phone"'),
        'Must have input-staff-phone'
      );
      assert.ok(
        staffEditContent.includes('data-testid="input-staff-email-readonly"'),
        'Must have read-only auth email with lock'
      );
    });

    it('3.5 - Group 3: Thông tin công việc (Branch, Shift selector, Internal Notes)', () => {
      assert.ok(
        staffEditContent.includes('Ca Sáng') && staffEditContent.includes('Ca Chiều'),
        'Must provide shift selector'
      );
      assert.ok(
        staffEditContent.includes('data-testid="input-staff-notes"'),
        'Must have input-staff-notes textarea'
      );
    });

    it('3.6 - Group 4: Quyền sử dụng tài khoản (Switch with Admin-only guard & Suspend modal)', () => {
      assert.ok(
        staffEditContent.includes('data-testid="toggle-staff-status-switch"'),
        'Must provide status toggle switch'
      );
      assert.ok(
        staffEditContent.includes('SuspendStaffConfirmModal'),
        'Must integrate SuspendStaffConfirmModal for account suspension'
      );
      assert.ok(
        staffEditContent.includes('isLastActiveAdmin'),
        'Must safeguard against suspending the last active admin'
      );
    });

    it('3.7 - Pinned Action Footer with #214E34 Save Button and disabled states', () => {
      assert.ok(
        staffEditContent.includes('data-testid="save-profile-btn"'),
        'Must render save-profile-btn in pinned footer'
      );
      assert.ok(
        staffEditContent.includes('bg-[#214E34]'),
        'Save button must use #214E34'
      );
      assert.ok(
        staffEditContent.includes('disabled={!isDirty || isSubmitting}'),
        'Save button must be disabled when pristine or submitting'
      );
    });

    it('3.8 - Unsaved changes dirty safeguard: prompts UnsavedChangesModal before back navigation', () => {
      assert.ok(
        staffEditContent.includes('UnsavedChangesModal'),
        'Must integrate UnsavedChangesModal'
      );
      assert.ok(
        staffEditContent.includes('if (isDirty)'),
        'Must check isDirty before navigating away'
      );
    });
  });
});
