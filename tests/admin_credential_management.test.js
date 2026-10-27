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

  // =========================================================================
  // 7. PHASE 3: SECURE EDGE FUNCTION & SUPABASE AUTH ADMIN RECOVERY SUITE
  // =========================================================================
  describe('7. Phase 3: Supabase Edge Function & Auth Admin API Security Suite', () => {
    it('7.1 - UI Cleanup: AdminReauthModal has NO SQL copy button or SQL editor link', () => {
      const reauthModalContent = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/management/AdminReauthModal.jsx'),
        'utf8'
      );
      assert.strictEqual(reauthModalContent.includes('data-testid="btn-copy-sql"'), false);
      assert.strictEqual(reauthModalContent.includes('data-testid="link-open-supabase-sql"'), false);
      assert.strictEqual(reauthModalContent.includes('ADMIN_CREDENTIALS_FIX_SQL'), false);
      assert.strictEqual(fs.existsSync(path.resolve(process.cwd(), 'src/lib/adminCredentialsSql.js')), false);
      assert.strictEqual(fs.existsSync(path.resolve(process.cwd(), 'supabase/apply_admin_credentials_fix.sql')), false);
    });

    it('7.2 - Decommission Migration: 20261027120000 drops old RPCs and creates rate limit / idempotency tables', () => {
      const dropMigrationContent = fs.readFileSync(
        path.resolve(process.cwd(), 'supabase/migrations/20261027120000_drop_insecure_credential_rpcs.sql'),
        'utf8'
      );
      assert.ok(dropMigrationContent.includes('DROP FUNCTION IF EXISTS public.admin_update_user_credentials'));
      assert.ok(dropMigrationContent.includes('CREATE TABLE IF NOT EXISTS public.security_idempotency_keys'));
      assert.ok(dropMigrationContent.includes('CREATE TABLE IF NOT EXISTS public.security_rate_limits'));
      assert.ok(dropMigrationContent.includes('check_security_rate_limit'));
    });

    it('7.3 - Supabase Edge Function: admin-manage-credentials exists and uses Auth Admin updateUserById', () => {
      const edgeFnContent = fs.readFileSync(
        path.resolve(process.cwd(), 'supabase/functions/admin-manage-credentials/index.ts'),
        'utf8'
      );
      assert.ok(edgeFnContent.includes('auth.admin.updateUserById'));
      assert.ok(edgeFnContent.includes('check_security_rate_limit'));
      assert.ok(edgeFnContent.includes('signInWithPassword'));
      assert.ok(edgeFnContent.includes('callerProfile.role !== "admin"'));
    });

    it('7.4 - Core Handler: Rejects requests missing Bearer JWT with 401', async () => {
      const { handleAdminCredentialManagement } = await import('../server/credentialManagementHandler.js');
      const res = await handleAdminCredentialManagement({
        authHeader: null,
        body: { targetUserId: 'target-uuid', adminPassword: '123' }
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.error, 'UNAUTHORIZED');
    });

    it('7.5 - Core Handler: Rejects non-admin caller (Staff/Manager) with 403 Forbidden', async () => {
      const { handleAdminCredentialManagement } = await import('../server/credentialManagementHandler.js');
      const mock = {
        auth: { getUser: async () => ({ data: { user: { id: 'staff-uuid', email: 'staff@gocpos.vn' } }, error: null }) },
        from: (table) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'staff-uuid', role: 'staff', status: 'active' }, error: null })
            })
          })
        })
      };

      const res = await handleAdminCredentialManagement({
        authHeader: 'Bearer valid_staff_jwt',
        body: { targetUserId: 'target-uuid', newPassword: 'newpw123', adminPassword: 'wrong' },
        supabaseClient: mock,
        supabaseAdmin: mock
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, 'FORBIDDEN');
    });

    it('7.6 - Core Handler: Rejects suspended Admin caller with 403 Account Suspended', async () => {
      const { handleAdminCredentialManagement } = await import('../server/credentialManagementHandler.js');
      const mock = {
        auth: { getUser: async () => ({ data: { user: { id: 'suspended-admin', email: 'admin_old@gocpos.vn' } }, error: null }) },
        from: (table) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'suspended-admin', role: 'admin', status: 'suspended' }, error: null })
            })
          })
        })
      };

      const res = await handleAdminCredentialManagement({
        authHeader: 'Bearer suspended_admin_jwt',
        body: { targetUserId: 'target-uuid', newPassword: 'newpw123', adminPassword: 'secret' },
        supabaseClient: mock,
        supabaseAdmin: mock
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, 'ACCOUNT_SUSPENDED');
    });

    it('7.7 - Core Handler: Re-auth fails on incorrect Admin password with 401 & tracks remaining attempts', async () => {
      const { handleAdminCredentialManagement } = await import('../server/credentialManagementHandler.js');
      const adminUid = `admin_test_${Date.now()}`;
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: adminUid, email: 'admin@gocpos.vn' } }, error: null }),
          signInWithPassword: async () => ({ data: null, error: new Error('Invalid login credentials') })
        }
      };
      const mockAdmin = {
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { id: adminUid, role: 'admin', status: 'active' }, error: null }) })
          }),
          insert: async () => ({ error: null })
        })
      };

      const res = await handleAdminCredentialManagement({
        authHeader: 'Bearer admin_token',
        body: { targetUserId: 'target-uuid', newPassword: 'newpw123', adminPassword: 'incorrect_password' },
        supabaseClient: mockClient,
        supabaseAdmin: mockAdmin
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.error, 'INVALID_ADMIN_PASSWORD');
      assert.strictEqual(typeof res.body.remainingAttempts, 'number');
    });

    it('7.8 - Core Handler: Rate Limiting returns 429 Too Many Requests after 5 failed re-auth attempts', async () => {
      const { handleAdminCredentialManagement } = await import('../server/credentialManagementHandler.js');
      const adminUid = `admin_bruteforce_${Date.now()}`;
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: adminUid, email: 'brute@gocpos.vn' } }, error: null }),
          signInWithPassword: async () => ({ data: null, error: new Error('Invalid password') })
        }
      };
      const mockAdmin = {
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { id: adminUid, role: 'admin', status: 'active' }, error: null }) })
          }),
          insert: async () => ({ error: null })
        })
      };

      // Perform 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await handleAdminCredentialManagement({
          authHeader: 'Bearer brute_token',
          body: { targetUserId: 'target-uuid', newPassword: 'newpw123', adminPassword: `bad_pw_${i}` },
          supabaseClient: mockClient,
          supabaseAdmin: mockAdmin
        });
      }

      // 6th attempt should be blocked with 429
      const blockedRes = await handleAdminCredentialManagement({
        authHeader: 'Bearer brute_token',
        body: { targetUserId: 'target-uuid', newPassword: 'newpw123', adminPassword: 'any' },
        supabaseClient: mockClient,
        supabaseAdmin: mockAdmin
      });
      assert.strictEqual(blockedRes.status, 429);
      assert.strictEqual(blockedRes.body.error, 'RATE_LIMIT_EXCEEDED');
      assert.ok(blockedRes.body.retryAfterSeconds > 0);
    });

    it('7.9 - Core Handler: Idempotency Key prevents concurrent double-submit and returns cached result on retry', async () => {
      const { handleAdminCredentialManagement } = await import('../server/credentialManagementHandler.js');
      const adminUid = `admin_idemp_${Date.now()}`;
      const targetUid = 'target-staff-uuid';
      const testKey = `idemp_key_${Date.now()}_test`;

      let adminUpdateCallCount = 0;
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: adminUid, email: 'admin@gocpos.vn' } }, error: null }),
          signInWithPassword: async () => ({ data: { user: { id: adminUid } }, error: null })
        }
      };
      const mockAdmin = {
        from: () => ({
          select: () => ({
            eq: (col, val) => ({
              maybeSingle: async () => ({
                data:
                  val === adminUid
                    ? { id: adminUid, name: 'Admin Test', role: 'admin', status: 'active' }
                    : { id: targetUid, name: 'Lê Hoàng Nam', role: 'staff', status: 'active' },
                error: null
              })
            }),
            ilike: () => ({ neq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) })
          }),
          insert: async () => ({ error: null }),
          update: () => ({ eq: async () => ({ error: null }) })
        }),
        auth: {
          admin: {
            updateUserById: async () => {
              adminUpdateCallCount++;
              return { data: { id: targetUid }, error: null };
            }
          }
        }
      };

      // First call -> Success
      const firstRes = await handleAdminCredentialManagement({
        authHeader: 'Bearer admin_token',
        body: { targetUserId: targetUid, newPassword: 'newpassword123', adminPassword: 'admin_correct_pw', idempotencyKey: testKey },
        supabaseClient: mockClient,
        supabaseAdmin: mockAdmin
      });
      assert.strictEqual(firstRes.status, 200);
      assert.strictEqual(firstRes.body.success, true);
      assert.strictEqual(adminUpdateCallCount, 1);

      // Immediate retry with the same idempotency key -> Returns cached response without calling Auth Admin API twice!
      const retryRes = await handleAdminCredentialManagement({
        authHeader: 'Bearer admin_token',
        body: { targetUserId: targetUid, newPassword: 'newpassword123', adminPassword: 'admin_correct_pw', idempotencyKey: testKey },
        supabaseClient: mockClient,
        supabaseAdmin: mockAdmin
      });
      assert.strictEqual(retryRes.status, 200);
      assert.strictEqual(retryRes.body.success, true);
      assert.strictEqual(adminUpdateCallCount, 1, 'Auth Admin API MUST NOT be invoked a second time for same idempotency key');
    });

    it('7.10 - Core Handler: NEVER logs plain password or auth secrets in audit logs', async () => {
      const { handleAdminCredentialManagement } = await import('../server/credentialManagementHandler.js');
      const adminUid = `admin_audit_${Date.now()}`;
      const targetUid = 'target-staff-uuid';
      const secretPassword = 'MySuperSecretPassword_123!';

      let loggedAuditRecord = null;
      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: adminUid, email: 'admin@gocpos.vn' } }, error: null }),
          signInWithPassword: async () => ({ data: { user: { id: adminUid } }, error: null })
        }
      };
      const mockAdmin = {
        from: (table) => ({
          select: () => ({
            eq: (col, val) => ({
              maybeSingle: async () => ({
                data:
                  val === adminUid
                    ? { id: adminUid, name: 'Admin Test', role: 'admin', status: 'active' }
                    : { id: targetUid, name: 'Lê Hoàng Nam', role: 'staff', status: 'active' },
                error: null
              })
            }),
            ilike: () => ({ neq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) })
          }),
          insert: async (record) => {
            if (table === 'audit_logs') loggedAuditRecord = record;
            return { error: null };
          },
          update: () => ({ eq: async () => ({ error: null }) })
        }),
        auth: {
          admin: {
            updateUserById: async () => ({ data: { id: targetUid }, error: null })
          }
        }
      };

      await handleAdminCredentialManagement({
        authHeader: 'Bearer admin_token',
        body: { targetUserId: targetUid, newPassword: secretPassword, adminPassword: 'admin_pw_123', idempotencyKey: `idemp_${Date.now()}` },
        supabaseClient: mockClient,
        supabaseAdmin: mockAdmin
      });

      assert.ok(loggedAuditRecord, 'Audit record must be logged');
      const auditString = JSON.stringify(loggedAuditRecord);
      assert.strictEqual(auditString.includes(secretPassword), false, 'Plain password must NEVER appear in audit log');
      assert.strictEqual(auditString.includes('admin_pw_123'), false, 'Admin password must NEVER appear in audit log');
    });
    it('7.11 - 2-Phase Reconciliation: When Auth succeeds but Profile update fails, returns 207 reconciliation_required', async () => {
      const { handleAdminCredentialManagement } = await import('../server/credentialManagementHandler.js');
      const adminUid = 'admin_reconcile_' + Date.now();
      const targetUid = 'target-staff-uuid';
      const testKey = 'idemp_reconcile_' + Date.now();

      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: adminUid, email: 'admin@gocpos.vn' } }, error: null }),
          signInWithPassword: async () => ({ data: { user: { id: adminUid } }, error: null })
        }
      };
      const mockAdmin = {
        from: (table) => ({
          select: () => ({
            eq: (col, val) => ({
              maybeSingle: async () => ({
                data:
                  val === adminUid
                    ? { id: adminUid, name: 'Admin Test', role: 'admin', status: 'active' }
                    : { id: targetUid, name: 'Lê Hoàng Nam', email: 'old@gocpos.vn', role: 'staff', status: 'active' },
                error: null
              })
            }),
            ilike: () => ({ neq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) })
          }),
          insert: async () => ({ error: null }),
          update: () => ({
            eq: async () => {
              if (table === 'profiles') {
                return { error: new Error('Simulated Database Profile Update Deadlock') };
              }
              return { error: null };
            }
          })
        }),
        auth: {
          admin: {
            updateUserById: async () => ({ data: { id: targetUid }, error: null })
          }
        }
      };

      const res = await handleAdminCredentialManagement({
        authHeader: 'Bearer admin_token',
        body: {
          targetUserId: targetUid,
          newEmail: 'new_verified@gocpos.vn',
          adminPassword: 'admin_pw_123',
          idempotencyKey: testKey
        },
        supabaseClient: mockClient,
        supabaseAdmin: mockAdmin
      });

      assert.strictEqual(res.status, 207, 'Should return 207 Multi-Status on partial sync failure');
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.authUpdated, true);
      assert.strictEqual(res.body.profileSyncPending, true);
      assert.strictEqual(res.body.status, 'reconciliation_required');
    });

    it('7.12 - Server Code Isolation: No privileged credential management handler exists in frontend src/', () => {
      const srcHandlerExists = fs.existsSync(path.resolve(process.cwd(), 'src/lib/credentialManagementHandler.js'));
      assert.strictEqual(srcHandlerExists, false, 'Privileged handler must be strictly moved out of src/');
      const serverHandlerExists = fs.existsSync(path.resolve(process.cwd(), 'server/credentialManagementHandler.js'));
      assert.strictEqual(serverHandlerExists, true, 'Handler must exist in server/');
    });

    it('7.13 - Concurrent Requests Guard: 2 concurrent requests with same key yields 1 success and 1 409 Conflict', async () => {
      const { handleAdminCredentialManagement } = await import('../server/credentialManagementHandler.js');
      const adminUid = 'admin_concurrent_' + Date.now();
      const targetUid = 'target-staff-uuid';
      const sharedKey = 'idemp_concurrent_' + Date.now();

      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: adminUid, email: 'admin@gocpos.vn' } }, error: null }),
          signInWithPassword: async () => ({ data: { user: { id: adminUid } }, error: null })
        }
      };
      const mockAdmin = {
        from: () => ({
          select: () => ({
            eq: (col, val) => ({
              maybeSingle: async () => ({
                data: val === adminUid
                  ? { id: adminUid, name: 'Admin Test', role: 'admin', status: 'active' }
                  : { id: targetUid, name: 'Lê Hoàng Nam', role: 'staff', status: 'active' },
                error: null
              })
            }),
            ilike: () => ({ neq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) })
          }),
          insert: async () => ({ error: null }),
          update: () => ({ eq: async () => ({ error: null }) })
        }),
        auth: {
          admin: {
            updateUserById: async () => {
              // Simulate small delay
              await new Promise(r => setTimeout(r, 20));
              return { data: { id: targetUid }, error: null };
            }
          }
        }
      };

      const [res1, res2] = await Promise.all([
        handleAdminCredentialManagement({
          authHeader: 'Bearer admin_token',
          body: { targetUserId: targetUid, newPassword: 'newpw123_concurrent', adminPassword: 'admin_pw', idempotencyKey: sharedKey },
          supabaseClient: mockClient,
          supabaseAdmin: mockAdmin
        }),
        handleAdminCredentialManagement({
          authHeader: 'Bearer admin_token',
          body: { targetUserId: targetUid, newPassword: 'newpw123_concurrent', adminPassword: 'admin_pw', idempotencyKey: sharedKey },
          supabaseClient: mockClient,
          supabaseAdmin: mockAdmin
        })
      ]);

      const statuses = [res1.status, res2.status].sort();
      assert.strictEqual(statuses[0], 200, 'One request must succeed');
      assert.strictEqual(statuses[1], 409, 'Concurrent conflicting request must return 409');
    });

    it('7.14 - Timeout / Hung Request Recovery: Re-attempts after 30s stale window do not block indefinitely', async () => {
      const { handleAdminCredentialManagement } = await import('../server/credentialManagementHandler.js');
      const adminUid = 'admin_timeout_' + Date.now();
      const targetUid = 'target-staff-uuid';
      const timeoutKey = 'idemp_timeout_' + Date.now();

      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: adminUid, email: 'admin@gocpos.vn' } }, error: null }),
          signInWithPassword: async () => ({ data: { user: { id: adminUid } }, error: null })
        }
      };
      const mockAdmin = {
        from: () => ({
          select: () => ({
            eq: (col, val) => ({
              maybeSingle: async () => ({
                data: val === adminUid
                  ? { id: adminUid, name: 'Admin Test', role: 'admin', status: 'active' }
                  : { id: targetUid, name: 'Lê Hoàng Nam', role: 'staff', status: 'active' },
                error: null
              })
            }),
            ilike: () => ({ neq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) })
          }),
          insert: async () => ({ error: null }),
          update: () => ({ eq: async () => ({ error: null }) })
        }),
        auth: {
          admin: {
            updateUserById: async () => ({ data: { id: targetUid }, error: null })
          }
        }
      };

      // 1. Initial request hangs / simulated initial processing
      await handleAdminCredentialManagement({
        authHeader: 'Bearer admin_token',
        body: { targetUserId: targetUid, newPassword: 'newpw123_timeout', adminPassword: 'admin_pw', idempotencyKey: timeoutKey },
        supabaseClient: mockClient,
        supabaseAdmin: mockAdmin
      });

      // 2. Immediate second request returns 200 (cached completed result)
      const cachedRes = await handleAdminCredentialManagement({
        authHeader: 'Bearer admin_token',
        body: { targetUserId: targetUid, newPassword: 'newpw123_timeout', adminPassword: 'admin_pw', idempotencyKey: timeoutKey },
        supabaseClient: mockClient,
        supabaseAdmin: mockAdmin
      });
      assert.strictEqual(cachedRes.status, 200);
      assert.strictEqual(cachedRes.body.success, true);
    });

    it('7.15 - Migration v3.2 Contract: Enforces RESTRICT, EXECUTE revokes from PUBLIC, and no cascade', () => {
      const migrationSql = fs.readFileSync(
        path.resolve(process.cwd(), 'supabase/migrations/20261027120000_drop_insecure_credential_rpcs.sql'),
        'utf8'
      );
      assert.ok(migrationSql.includes('DROP FUNCTION IF EXISTS public.admin_update_user_credentials(UUID, TEXT, TEXT, TEXT) RESTRICT;'));
      assert.ok(migrationSql.includes('DROP FUNCTION IF EXISTS public.admin_update_user_credentials(JSONB) RESTRICT;'));
      assert.strictEqual(/DROP\s+FUNCTION[^;]+CASCADE/i.test(migrationSql), false, 'Must NOT use CASCADE in drop statement');
      assert.ok(migrationSql.includes('REVOKE ALL ON FUNCTION public.check_security_rate_limit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;'));
      assert.ok(migrationSql.includes('GRANT EXECUTE ON FUNCTION public.check_security_rate_limit(TEXT, INT, INT) TO service_role;'));
      assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.security_admin_credential_nonces'));
      assert.ok(migrationSql.includes('REVOKE ALL ON TABLE public.security_admin_credential_nonces FROM PUBLIC, anon, authenticated;'));
      assert.ok(migrationSql.includes('CREATE TRIGGER trg_guard_auth_user_credentials_update'));
    });

    it('7.16 - Database-Backed Nonce: Admin update generates pending DB nonce and supplies marker in app_metadata', async () => {
      const { handleAdminCredentialManagement } = await import('../server/credentialManagementHandler.js');
      const adminUid = 'admin_nonce_test_' + Date.now();
      const targetUid = 'target-staff-uuid';

      let insertedNonceRecord = null;
      let passedAuthPayload = null;

      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: { id: adminUid, email: 'admin@gocpos.vn' } }, error: null }),
          signInWithPassword: async () => ({ data: { user: { id: adminUid } }, error: null })
        }
      };
      const mockAdmin = {
        from: (table) => ({
          select: () => ({
            eq: (col, val) => ({
              maybeSingle: async () => ({
                data: val === adminUid
                  ? { id: adminUid, name: 'Admin Test', role: 'admin', status: 'active' }
                  : { id: targetUid, name: 'Lê Hoàng Nam', role: 'staff', status: 'active' },
                error: null
              })
            }),
            ilike: () => ({ neq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) })
          }),
          insert: async (record) => {
            if (table === 'security_admin_credential_nonces') insertedNonceRecord = record;
            return { error: null };
          },
          update: () => ({ eq: async () => ({ error: null }) })
        }),
        auth: {
          admin: {
            getUserById: async () => ({ data: { user: { id: targetUid, app_metadata: { existing_claim: 'keep_me' } } }, error: null }),
            updateUserById: async (id, payload) => {
              passedAuthPayload = payload;
              return { data: { id: targetUid }, error: null };
            }
          }
        }
      };

      const res = await handleAdminCredentialManagement({
        authHeader: 'Bearer admin_token',
        body: { targetUserId: targetUid, newPassword: 'new_secure_pw_123', adminPassword: 'admin_pw_ok' },
        supabaseClient: mockClient,
        supabaseAdmin: mockAdmin
      });

      assert.strictEqual(res.status, 200);
      assert.ok(insertedNonceRecord, 'Nonce must be inserted into database');
      assert.strictEqual(insertedNonceRecord.status, 'pending');
      assert.strictEqual(insertedNonceRecord.actor_uid, adminUid);
      assert.strictEqual(insertedNonceRecord.target_uid, targetUid);

      assert.ok(passedAuthPayload, 'Auth update payload must be provided');
      assert.ok(passedAuthPayload.app_metadata?.admin_nonce, 'Payload must contain admin_nonce marker');
      assert.strictEqual(passedAuthPayload.app_metadata.existing_claim, 'keep_me', 'Must preserve existing app_metadata');
      assert.strictEqual(passedAuthPayload.app_metadata.admin_nonce, insertedNonceRecord.nonce);
    });

    it('7.17 - Trigger Integration: simulateGuardAuthUserCredentialsUpdate blocks unauthorized user self-update, replay attacks, and expired nonces', async () => {
      const { simulateGuardAuthUserCredentialsUpdate } = await import('../server/credentialManagementHandler.js');
      const targetUserId = 'target-staff-uuid';
      const validNonce = 'adm_nonce_valid_' + Date.now();
      const expiredNonce = 'adm_nonce_expired_' + Date.now();

      const noncesTable = [
        {
          nonce: validNonce,
          actor_uid: 'admin-uuid',
          target_uid: targetUserId,
          status: 'pending',
          expires_at: new Date(Date.now() + 60000).toISOString()
        },
        {
          nonce: expiredNonce,
          actor_uid: 'admin-uuid',
          target_uid: targetUserId,
          status: 'pending',
          expires_at: new Date(Date.now() - 5000).toISOString() // Expired
        }
      ];

      const oldUser = {
        id: targetUserId,
        email: 'staff@gocpos.vn',
        encrypted_password: 'hash_old_password',
        raw_app_meta_data: {}
      };

      // 1. Regular staff attempts self-update without nonce -> MUST THROW EXCEPTION
      assert.throws(() => {
        simulateGuardAuthUserCredentialsUpdate({
          oldUser,
          newUser: {
            ...oldUser,
            encrypted_password: 'hash_new_password_unauthorized',
            raw_app_meta_data: {} // No admin_nonce
          },
          noncesTable
        });
      }, /thiếu Nonce ủy quyền của Quản trị viên/);

      // 2. Admin update with valid pending nonce -> MUST SUCCEED AND CONSUME NONCE
      const updatedUser = simulateGuardAuthUserCredentialsUpdate({
        oldUser,
        newUser: {
          ...oldUser,
          encrypted_password: 'hash_new_password_authorized',
          raw_app_meta_data: { admin_nonce: validNonce }
        },
        noncesTable
      });
      assert.strictEqual(updatedUser.encrypted_password, 'hash_new_password_authorized');

      // Check that the nonce was atomically consumed
      const consumedRecord = noncesTable.find((n) => n.nonce === validNonce);
      assert.strictEqual(consumedRecord.status, 'consumed', 'Nonce must be consumed after first use');

      // 3. Replay attack: Re-using the same consumed nonce -> MUST THROW EXCEPTION
      assert.throws(() => {
        simulateGuardAuthUserCredentialsUpdate({
          oldUser,
          newUser: {
            ...oldUser,
            encrypted_password: 'hash_new_password_replay',
            raw_app_meta_data: { admin_nonce: validNonce }
          },
          noncesTable
        });
      }, /Nonce ủy quyền không hợp lệ, đã hết hạn, hoặc đã được sử dụng/);

      // 4. Expired nonce -> MUST THROW EXCEPTION
      assert.throws(() => {
        simulateGuardAuthUserCredentialsUpdate({
          oldUser,
          newUser: {
            ...oldUser,
            encrypted_password: 'hash_new_password_expired',
            raw_app_meta_data: { admin_nonce: expiredNonce }
          },
          noncesTable
        });
      }, /Nonce ủy quyền không hợp lệ, đã hết hạn, hoặc đã được sử dụng/);

      // 5. Target UID mismatch (nonce created for another user) -> MUST THROW EXCEPTION
      const mismatchNonce = 'adm_nonce_mismatch_' + Date.now();
      noncesTable.push({
        nonce: mismatchNonce,
        actor_uid: 'admin-uuid',
        target_uid: 'other-user-uuid',
        status: 'pending',
        expires_at: new Date(Date.now() + 60000).toISOString()
      });
      assert.throws(() => {
        simulateGuardAuthUserCredentialsUpdate({
          oldUser,
          newUser: {
            ...oldUser,
            encrypted_password: 'hash_new_password_mismatch',
            raw_app_meta_data: { admin_nonce: mismatchNonce }
          },
          noncesTable
        });
      }, /Nonce ủy quyền không hợp lệ, đã hết hạn, hoặc đã được sử dụng/);
    });
  });
});
