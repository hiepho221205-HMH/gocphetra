-- ============================================================================
-- GÓC POS - ADMIN-ONLY ACCOUNT CREDENTIAL MANAGEMENT
-- Migration: 20261027000000_admin_credentials_management.sql
-- Description:
-- 1. Secure RPC: admin_update_user_credentials (Change email & reset password with Admin Re-authentication)
-- 2. Update admin_create_staff_account RPC (Restrict new accounts strictly to 'staff' or 'manager', enforce pw length >= 6)
-- 3. PostgreSQL Database Trigger on auth.users to block any non-admin from updating email/password
-- 4. Immutable Audit Logging for all credential modifications (NEVER logging plain passwords)
-- ============================================================================

-- 1. SECURE RPC: ADMIN CẬP NHẬT THÔNG TIN ĐĂNG NHẬP (EMAIL & MẬT KHẨU)
CREATE OR REPLACE FUNCTION public.admin_update_user_credentials(
    p_target_user_id UUID,
    p_new_email TEXT DEFAULT NULL,
    p_new_password TEXT DEFAULT NULL,
    p_admin_password TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_admin_pw_hash TEXT;
    v_target_name TEXT;
    v_target_role TEXT;
    v_clean_email TEXT;
    v_new_pw_hash TEXT;
    v_email_changed BOOLEAN := FALSE;
    v_password_changed BOOLEAN := FALSE;
    v_active_admin_count INT;
BEGIN
    v_caller_id := auth.uid();

    -- 1.1. Kiểm tra quyền hạn: CHỈ ADMIN mới có quyền cập nhật thông tin đăng nhập
    IF v_caller_id IS NOT NULL THEN
        v_caller_role := public.get_current_user_role();
        IF v_caller_role != 'admin' THEN
            RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền quản lý và cập nhật thông tin đăng nhập nhân sự.';
        END IF;

        -- 1.2. Xác thực lại Quản trị viên (Admin Re-authentication) nếu có mật khẩu truyền vào
        IF p_admin_password IS NOT NULL AND p_admin_password != '' THEN
            SELECT encrypted_password INTO v_admin_pw_hash
            FROM auth.users
            WHERE id = v_caller_id;

            IF v_admin_pw_hash IS NULL OR crypt(p_admin_password, v_admin_pw_hash) != v_admin_pw_hash THEN
                RAISE EXCEPTION 'Xác thực bảo mật thất bại: Mật khẩu xác thực Quản trị viên không chính xác.';
            END IF;
        END IF;
    ELSE
        v_caller_role := 'admin';
    END IF;

    -- 1.3. Kiểm tra mục tiêu nhân sự
    SELECT name, role INTO v_target_name, v_target_role
    FROM public.profiles
    WHERE id = p_target_user_id;

    IF v_target_name IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ nhân sự với mã ID: %', p_target_user_id;
    END IF;

    -- 1.4. Thay đổi Email (nếu có yêu cầu)
    IF p_new_email IS NOT NULL AND TRIM(p_new_email) != '' THEN
        v_clean_email := LOWER(TRIM(p_new_email));

        -- Kiểm tra định dạng email
        IF v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
            RAISE EXCEPTION 'Địa chỉ email "%" không hợp lệ.', v_clean_email;
        END IF;

        -- Kiểm tra trùng lặp với người dùng khác
        IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_clean_email AND id != p_target_user_id) THEN
            RAISE EXCEPTION 'Email "%" đã được đăng ký bởi tài khoản khác trong hệ thống.', v_clean_email;
        END IF;

        -- Cập nhật auth.users
        UPDATE auth.users
        SET email = v_clean_email,
            email_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_target_user_id;

        -- Cập nhật public.profiles
        UPDATE public.profiles
        SET email = v_clean_email,
            updated_at = NOW()
        WHERE id = p_target_user_id;

        -- Cập nhật public.staff_profiles nếu có
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_profiles') THEN
            UPDATE public.staff_profiles
            SET email = v_clean_email,
                updated_at = NOW()
            WHERE id = p_target_user_id;
        END IF;

        v_email_changed := TRUE;
    END IF;

    -- 1.5. Đặt lại Mật khẩu (nếu có yêu cầu)
    IF p_new_password IS NOT NULL AND TRIM(p_new_password) != '' THEN
        IF LENGTH(TRIM(p_new_password)) < 6 THEN
            RAISE EXCEPTION 'Mật khẩu phải chứa ít nhất 6 ký tự để bảo đảm an toàn hệ thống.';
        END IF;

        v_new_pw_hash := crypt(TRIM(p_new_password), gen_salt('bf'));

        -- Cập nhật auth.users
        UPDATE auth.users
        SET encrypted_password = v_new_pw_hash,
            updated_at = NOW()
        WHERE id = p_target_user_id;

        v_password_changed := TRUE;
    END IF;

    -- Kiểm tra nếu không có gì thay đổi
    IF NOT v_email_changed AND NOT v_password_changed THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Không có thông tin đăng nhập nào cần cập nhật.',
            'target_user_id', p_target_user_id
        );
    END IF;

    -- 1.6. Ghi Audit Log bất biến (TUYỆT ĐỐI KHÔNG GHI MẬT KHẨU)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        INSERT INTO public.audit_logs (
            action,
            actor_id,
            target_user_id,
            old_role,
            new_role,
            note,
            created_at
        ) VALUES (
            'UPDATE_CREDENTIALS',
            v_caller_id,
            p_target_user_id,
            v_target_role,
            v_target_role,
            format('Quản trị viên cập nhật thông tin đăng nhập cho "%s" (%s): email_changed=%s, password_changed=%s',
                v_target_name, v_target_role, v_email_changed, v_password_changed),
            NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Đã cập nhật thông tin đăng nhập cho nhân sự "%s" thành công.', v_target_name),
        'target_user_id', p_target_user_id,
        'email_changed', v_email_changed,
        'password_changed', v_password_changed,
        'email', v_clean_email
    );
END;
$$;

-- 2. CẬP NHẬT RPC: ADMIN TẠO NHÂN VIÊN MỚI (CHẶN TẠO ADMIN, ENFORCE MẬT KHẨU >= 6 KÝ TỰ)
CREATE OR REPLACE FUNCTION public.admin_create_staff_account(
    p_email TEXT,
    p_password TEXT,
    p_name TEXT,
    p_role TEXT DEFAULT 'staff',
    p_phone TEXT DEFAULT '',
    p_shift_name TEXT DEFAULT 'Ca Sáng (06:30 - 14:30)',
    p_notes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_new_user_id UUID;
    v_clean_email TEXT;
    v_clean_name TEXT;
    v_clean_phone TEXT;
    v_effective_role TEXT;
    v_encrypted_pw TEXT;
    v_clean_pw TEXT;
BEGIN
    -- 2.1. Quyền kiểm tra: CHỈ ADMIN HOẶC MANAGER ĐƯỢC TẠO
    IF auth.uid() IS NOT NULL THEN
        v_caller_role := public.get_current_user_role();
        IF v_caller_role NOT IN ('admin', 'manager') THEN
            RAISE EXCEPTION 'Truy cập bị từ chối: Bạn không có quyền tạo tài khoản nhân sự.';
        END IF;
    ELSE
        v_caller_role := 'admin';
    END IF;

    v_clean_name := TRIM(p_name);
    IF v_clean_name = '' THEN
        RAISE EXCEPTION 'Họ và tên nhân viên không được để trống.';
    END IF;

    v_clean_email := LOWER(TRIM(p_email));
    IF v_clean_email = '' THEN
        RAISE EXCEPTION 'Email nhân viên không được để trống.';
    END IF;

    IF v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Địa chỉ email "%" không đúng định dạng.', v_clean_email;
    END IF;

    v_clean_pw := TRIM(COALESCE(p_password, '123456'));
    IF LENGTH(v_clean_pw) < 6 THEN
        RAISE EXCEPTION 'Mật khẩu phải chứa ít nhất 6 ký tự.';
    END IF;

    v_clean_phone := TRIM(p_phone);

    -- 2.2. Khóa bảo mật: Tuyệt đối không cho tạo quyền Admin qua form thêm nhân viên
    -- Bổ nhiệm Quản trị viên (Admin) chỉ thực hiện qua Page Phân quyền riêng (RbacMainPage)
    IF v_caller_role = 'admin' THEN
        IF p_role = 'admin' THEN
            RAISE EXCEPTION 'Khóa bảo mật: Không thể tạo trực tiếp tài khoản Quản trị viên (Admin) từ form này. Vui lòng phân quyền tại trang Phân quyền Tài khoản.';
        END IF;
        v_effective_role := CASE WHEN p_role = 'manager' THEN 'manager' ELSE 'staff' END;
    ELSE
        -- Manager chỉ tạo được Staff
        v_effective_role := 'staff';
    END IF;

    -- 2.3. Kiểm tra trùng lặp email trong profiles hoặc auth.users
    IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_clean_email) THEN
        RAISE EXCEPTION 'Email % đã được đăng ký trên hệ thống.', v_clean_email;
    END IF;

    IF v_clean_phone != '' AND EXISTS (SELECT 1 FROM public.profiles WHERE phone = v_clean_phone) THEN
        RAISE EXCEPTION 'Số điện thoại % đã được sử dụng bởi nhân viên khác.', v_clean_phone;
    END IF;

    -- 2.4. Sinh UUID mới và Hash mật khẩu
    v_new_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(v_clean_pw, gen_salt('bf'));

    -- 2.5. Tạo bản ghi trong auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_new_user_id,
        'authenticated',
        'authenticated',
        v_clean_email,
        v_encrypted_pw,
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', array['email']),
        jsonb_build_object('name', v_clean_name, 'role', v_effective_role, 'phone', v_clean_phone),
        FALSE,
        NOW(),
        NOW()
    );

    -- 2.6. Tạo bản ghi trong public.profiles
    INSERT INTO public.profiles (
        id, email, name, role, status, phone, shift_name, notes, created_at, updated_at
    ) VALUES (
        v_new_user_id, v_clean_email, v_clean_name, v_effective_role, 'active', v_clean_phone, p_shift_name, p_notes, NOW(), NOW()
    );

    -- 2.7. Tạo bản ghi trong public.user_roles
    INSERT INTO public.user_roles (
        user_id, role, created_at, updated_at
    ) VALUES (
        v_new_user_id, v_effective_role, NOW(), NOW()
    );

    -- 2.8. Ghi Audit Log bất biến (TUYỆT ĐỐI KHÔNG GHI MẬT KHẨU)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        INSERT INTO public.audit_logs (
            action,
            actor_id,
            target_user_id,
            old_role,
            new_role,
            note,
            created_at
        ) VALUES (
            'CREATE_STAFF_ACCOUNT',
            auth.uid(),
            v_new_user_id,
            NULL,
            v_effective_role,
            format('Tạo mới tài khoản nhân sự "%s" (%s) với email %s', v_clean_name, v_effective_role, v_clean_email),
            NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_new_user_id,
        'email', v_clean_email,
        'name', v_clean_name,
        'role', v_effective_role
    );
END;
$$;

-- 3. POSTGRES TRIGGER: BẢO VỆ AUTH.USERS KHỎI THAO TÁC UPDATE CREDENTIALS TỪ NON-ADMIN
-- Ngăn chặn triệt để Manager / Staff gọi trực tiếp supabase.auth.updateUser({ email, password })
CREATE OR REPLACE FUNCTION public.guard_auth_user_credentials_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_uid UUID;
    v_caller_role TEXT;
BEGIN
    -- Nếu có thay đổi encrypted_password hoặc email trên auth.users
    IF (NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password) OR (NEW.email IS DISTINCT FROM OLD.email) THEN
        v_caller_uid := auth.uid();
        -- Nếu thay đổi được gọi thông qua phiên đăng nhập JWT (auth.uid() tồn tại)
        IF v_caller_uid IS NOT NULL THEN
            v_caller_role := public.get_current_user_role();
            IF v_caller_role != 'admin' THEN
                RAISE EXCEPTION 'Chính sách bảo mật GÓC POS: Manager và Staff không có quyền tự thay đổi email hoặc mật khẩu. Mọi thay đổi phải do Quản trị viên (Admin) thực hiện.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_auth_user_credentials_update ON auth.users;
CREATE TRIGGER trg_guard_auth_user_credentials_update
BEFORE UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.guard_auth_user_credentials_update();
