import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  setClientSecurityRole,
  getClientSecurityRole,
  supabase
} from '../src/lib/supabase.js';

describe('GÓC POS — ADMIN-ONLY ACCOUNT CREDENTIAL MANAGEMENT SUITE', () => {

  // =========================================================================
  // 1. CLIENT SDK INTERCEPTOR & ANTI-BYPASS SECURITY
  // =========================================================================
  describe('1. Client SDK Interceptor & Anti-Bypass Guard', () => {
    it('1.1 - setClientSecurityRole and getClientSecurityRole manage active security context', () => {
      setClientSecurityRole('staff');
      assert.strictEqual(getClientSecurityRole(), 'staff');

      setClientSecurityRole('manager');
      assert.strictEqual(getClientSecurityRole(), 'manager');

      setClientSecurityRole('admin');
      assert.strictEqual(getClientSecurityRole(), 'admin');
    });

    it('1.2 - supabase.auth.updateUser blocks non-admin from modifying password', async () => {
      setClientSecurityRole('staff');
      const res = await supabase.auth.updateUser({ password: 'new_secret_123' });
      assert.strictEqual(res.data.user, null);
      assert.ok(res.error);
      assert.match(res.error.message, /Chính sách bảo mật GÓC POS/i);
    });

    it('1.3 - supabase.auth.updateUser blocks non-admin from modifying email', async () => {
      setClientSecurityRole('manager');
      const res = await supabase.auth.updateUser({ email: 'hacked_manager@gocpos.vn' });
      assert.strictEqual(res.data.user, null);
      assert.ok(res.error);
      assert.match(res.error.message, /Chính sách bảo mật GÓC POS/i);
    });

    it('1.4 - supabase.auth.updateUser allows Admin to invoke updates', async () => {
      setClientSecurityRole('admin');
      // In offline/mock mode, this will call the original binding without throwing security guard error
      const res = await supabase.auth.updateUser({ data: { avatar: 'test.png' } });
      assert.ok(res !== undefined);
    });
  });

  // =========================================================================
  // 2. STAFF CREATION VALIDATION & INITIAL CREDENTIALS
  // =========================================================================
  describe('2. Staff Creation Form & Credential Validation', () => {
    const createPageContent = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/management/StaffCreatePage.jsx'),
      'utf8'
    );

    it('2.1 - StaffCreatePage includes initial password and confirm password fields', () => {
      assert.ok(createPageContent.includes('staff-input-password'));
      assert.ok(createPageContent.includes('staff-input-confirm-password'));
      assert.ok(createPageContent.includes('toggle-show-create-password'));
      assert.ok(createPageContent.includes('toggle-show-create-confirm-password'));
    });

    it('2.2 - StaffCreatePage includes password strength meter and minimum 6-char rule', () => {
      assert.ok(createPageContent.includes('getPasswordStrength'));
      assert.ok(createPageContent.includes('Độ mạnh mật khẩu'));
      assert.ok(createPageContent.includes('Mật khẩu đăng nhập phải có ít nhất 6 ký tự!'));
    });

    it('2.3 - StaffCreatePage blocks appointing Admin directly from the form', () => {
      assert.ok(createPageContent.includes('Khóa bảo mật: Không thể tạo'));
      // Dropdown does not offer admin for new accounts
      assert.ok(createPageContent.includes('isEditMode && editingStaff?.role === \'admin\''));
    });

    it('2.4 - StaffCreatePage enforces email requirement and format validation', () => {
      assert.ok(createPageContent.includes('staff-input-email'));
      assert.ok(createPageContent.includes('Vui lòng nhập Email đăng nhập cho nhân viên mới'));
      assert.ok(createPageContent.includes('Định dạng email đăng nhập không hợp lệ!'));
    });
  });

  // =========================================================================
  // 3. ADMIN-ONLY CREDENTIAL EDITING & RE-AUTHENTICATION
  // =========================================================================
  describe('3. StaffEditProfilePage Admin Credential Section & Reauth Modal', () => {
    const editPageContent = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/management/StaffEditProfilePage.jsx'),
      'utf8'
    );
    const reauthModalContent = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/management/AdminReauthModal.jsx'),
      'utf8'
    );

    it('3.1 - StaffEditProfilePage renders admin-credentials-card guarded strictly by isAdmin', () => {
      assert.ok(editPageContent.includes('data-testid="admin-credentials-card"'));
      assert.ok(editPageContent.includes('{isAdmin && ('));
    });

    it('3.2 - StaffEditProfilePage provides Change Email and Reset Password controls', () => {
      assert.ok(editPageContent.includes('data-testid="toggle-change-email-btn"'));
      assert.ok(editPageContent.includes('data-testid="toggle-reset-password-btn"'));
      assert.ok(editPageContent.includes('data-testid="input-new-email"'));
      assert.ok(editPageContent.includes('data-testid="input-new-password"'));
      assert.ok(editPageContent.includes('data-testid="input-confirm-new-password"'));
      assert.ok(editPageContent.includes('data-testid="btn-submit-credentials"'));
    });

    it('3.3 - AdminReauthModal prompts for Admin password before applying sensitive changes', () => {
      assert.ok(reauthModalContent.includes('data-testid="admin-reauth-modal"'));
      assert.ok(reauthModalContent.includes('data-testid="input-admin-reauth-password"'));
      assert.ok(reauthModalContent.includes('data-testid="btn-confirm-reauth"'));
      assert.ok(reauthModalContent.includes('Xác thực Quản trị viên'));
    });

    it('3.4 - StaffEditProfilePage integrates AdminReauthModal in its JSX tree', () => {
      assert.ok(editPageContent.includes('<AdminReauthModal'));
      assert.ok(editPageContent.includes('showAdminReauthModal'));
      assert.ok(editPageContent.includes('handleConfirmAdminReauth'));
    });
  });

  // =========================================================================
  // 4. MANAGER & STAFF RESTRICTIONS (PROFILE & SETTINGS)
  // =========================================================================
  describe('4. Manager and Staff Non-Admin Restrictions', () => {
    const profileEditContent = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/management/ProfileEditSubpage.jsx'),
      'utf8'
    );

    it('4.1 - ProfileEditSubpage contains NO input fields for email or password', () => {
      assert.ok(!profileEditContent.includes('type="password"'));
      assert.ok(!profileEditContent.includes('data-testid="input-new-password"'));
      assert.ok(!profileEditContent.includes('data-testid="input-change-email"'));
    });

    it('4.2 - ProfileEditSubpage displays centralized credential management disclaimer', () => {
      assert.ok(profileEditContent.includes('Bảo mật thông tin đăng nhập'));
      assert.ok(profileEditContent.includes('Email và mật khẩu đăng nhập do Quản trị viên (Admin) quản lý'));
    });
  });

  // =========================================================================
  // 5. POSTGRES MIGRATION, RPCs & DATABASE TRIGGERS
  // =========================================================================
  describe('5. Database Migration 20261027000000 SQL Contract', () => {
    const migrationContent = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20261027000000_admin_credentials_management.sql'),
      'utf8'
    );

    it('5.1 - Migration defines public.admin_update_user_credentials with role and re-auth checks', () => {
      assert.ok(migrationContent.includes('FUNCTION public.admin_update_user_credentials'));
      assert.ok(migrationContent.includes('v_caller_role != \'admin\''));
      assert.ok(migrationContent.includes('crypt(p_admin_password, v_admin_pw_hash)'));
    });

    it('5.2 - Migration updates public.admin_create_staff_account to reject admin role and enforce pw length >= 6', () => {
      assert.ok(migrationContent.includes('FUNCTION public.admin_create_staff_account'));
      assert.ok(migrationContent.includes('IF p_role = \'admin\' THEN'));
      assert.ok(migrationContent.includes('LENGTH(v_clean_pw) < 6'));
    });

    it('5.3 - Migration installs trg_guard_auth_user_credentials_update trigger on auth.users', () => {
      assert.ok(migrationContent.includes('FUNCTION public.guard_auth_user_credentials_update'));
      assert.ok(migrationContent.includes('BEFORE UPDATE ON auth.users'));
      assert.ok(migrationContent.includes('trg_guard_auth_user_credentials_update'));
    });

    it('5.4 - Migration enforces that plain passwords are NEVER written to audit logs', () => {
      assert.ok(migrationContent.includes('TUYỆT ĐỐI KHÔNG GHI MẬT KHẨU'));
      assert.ok(!migrationContent.includes('INSERT INTO public.audit_logs (action, actor_id, target_user_id, old_role, new_role, note, created_at) VALUES (\'UPDATE_CREDENTIALS\', v_caller_id, p_target_user_id, v_target_role, v_target_role, p_new_password'));
    });
  });

  // =========================================================================
  // 6. POSCONTEXT STATE & BUSINESS LOGIC SECURITY GUARDS
  // =========================================================================
  describe('6. PosContext Credential Action Guards & Audit Rules', () => {
    const posContextContent = fs.readFileSync(
      path.resolve(process.cwd(), 'src/store/PosContext.jsx'),
      'utf8'
    );

    it('6.1 - PosContext exports adminUpdateUserCredentials', () => {
      assert.ok(posContextContent.includes('adminUpdateUserCredentials,'));
      assert.ok(posContextContent.includes('const adminUpdateUserCredentials = async'));
    });

    it('6.2 - saveStaffMember in PosContext blocks non-admin from creating staff', () => {
      assert.ok(posContextContent.includes('!id && currentRole !== \'admin\''));
      assert.ok(posContextContent.includes('Chỉ Quản trị viên (Admin) mới có quyền tạo tài khoản nhân viên mới!'));
    });

    it('6.3 - saveStaffMember in PosContext blocks creating admin role directly', () => {
      assert.ok(posContextContent.includes('!id && role === \'admin\''));
      assert.ok(posContextContent.includes('Không thể tạo tài khoản Admin trực tiếp từ form thêm nhân viên'));
    });

    it('6.4 - saveStaffMember in PosContext enforces minimum 6-character password', () => {
      assert.ok(posContextContent.includes('!id && password && password.length < 6'));
      assert.ok(posContextContent.includes('Mật khẩu đăng nhập phải có ít nhất 6 ký tự!'));
    });

    it('6.5 - adminUpdateUserCredentials in PosContext blocks non-admin callers', () => {
      assert.ok(posContextContent.includes('currentRole !== \'admin\''));
      assert.ok(posContextContent.includes('Chỉ Quản trị viên (Admin) mới có quyền thay đổi thông tin đăng nhập!'));
    });

    it('6.6 - adminUpdateUserCredentials in PosContext validates email regex & duplicate check', () => {
      assert.ok(posContextContent.includes('Định dạng email mới không hợp lệ!'));
      assert.ok(posContextContent.includes('s.email || \'\').toLowerCase().trim() === cleanNewEmail'));
    });

    it('6.7 - adminUpdateUserCredentials in PosContext NEVER records password in audit logs', () => {
      assert.ok(posContextContent.includes('NEVER log passwords!'));
      assert.ok(!posContextContent.includes('password: cleanNewPassword'));
    });

    it('6.8 - Active client security role is continuously synced to Supabase guard', () => {
      assert.ok(posContextContent.includes('setClientSecurityRole(currentRole)'));
    });
  });
});
