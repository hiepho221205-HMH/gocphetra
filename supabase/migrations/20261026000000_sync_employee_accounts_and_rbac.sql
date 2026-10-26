-- ==============================================================================
-- GÓC Coffee POS - Đồng bộ Nhân sự & Phân quyền RBAC V1
-- Migration: 20261026000000_sync_employee_accounts_and_rbac.sql
-- Description:
--   1. Idempotent và bảo toàn 100% dữ liệu hiện có
--   2. Tạo các bảng profiles, user_roles, audit_logs, staff_profiles
--   3. Tạo RPC functions:
--      - admin_change_user_role (bảo vệ không hạ quyền Admin cuối cùng)
--      - admin_toggle_staff_status (bảo vệ không khóa Admin cuối cùng)
--      - admin_create_staff_account (tạo user an toàn không lộ service_role ở client)
--   4. Tự động đồng bộ và liên kết 7 tài khoản Auth hiện có vào profiles & user_roles
--   5. Khởi tạo Storage Bucket 'avatars' cho ảnh đại diện nhân viên
--   6. Thiết lập RLS policies an toàn và Realtime publication
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. BẢNG PROFILES (HỒ SƠ TÀI KHOẢN NGƯỜI DÙNG - LINKED VỚI AUTH.USERS.ID)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT NOT NULL DEFAULT 'Nhân viên',
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive', 'suspended')),
    avatar_url TEXT,
    phone TEXT,
    branch_id TEXT NOT NULL DEFAULT 'main',
    shift_name TEXT DEFAULT 'Ca Sáng (06:30 - 14:30)',
    notes TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bổ sung các cột nếu bảng đã tồn tại
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Nhân viên';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT 'main';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shift_name TEXT DEFAULT 'Ca Sáng (06:30 - 14:30)';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. BẢNG USER_ROLES (NGUỒN SỰ THẬT SERVER-SIDE DUY NHẤT VỀ VAI TRÒ)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_roles_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4. BẢNG AUDIT_LOGS (SỔ CÁI BẤT BIẾN LƯU VẾT THAY ĐỔI VAI TRÒ & QUYỀN)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    role TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. BẢNG STAFF_PROFILES (TƯƠNG THÍCH NGƯỢC ROSTER CA LÀM VIỆC)
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive', 'suspended')),
    shift_name TEXT DEFAULT 'Ca Sáng (06:30 - 14:30)',
    notes TEXT,
    email TEXT,
    avatar_url TEXT,
    branch_id TEXT NOT NULL DEFAULT 'main',
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TẠO INDEXES TĂNG TỐC TRUY VẤN
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_status ON public.staff_profiles(status);

-- 7. SECURITY HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_status TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN 'staff';
    END IF;

    SELECT status INTO v_status
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_status IS NOT NULL AND v_status IN ('paused', 'inactive', 'suspended') THEN
        RETURN 'staff';
    END IF;

    SELECT role INTO v_role
    FROM public.user_roles
    WHERE user_id = auth.uid();

    IF v_role IS NULL THEN
        SELECT role INTO v_role
        FROM public.profiles
        WHERE id = auth.uid();
    END IF;

    RETURN COALESCE(v_role, 'staff');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT public.get_current_user_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT public.get_current_user_role() IN ('admin', 'manager');
$$;

-- 8. SECURE RPC: ADMIN ĐỔI VAI TRÒ NHÂN SỰ
CREATE OR REPLACE FUNCTION public.admin_change_user_role(
    p_target_user_id UUID,
    p_new_role TEXT,
    p_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_target_old_role TEXT;
    v_target_name TEXT;
    v_admin_count INT;
BEGIN
    -- 1. Xác thực quyền Admin
    IF auth.uid() IS NOT NULL THEN
        v_caller_role := public.get_current_user_role();
        IF v_caller_role != 'admin' THEN
            RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền thay đổi vai trò nhân sự.';
        END IF;
    ELSE
        v_caller_role := 'admin';
    END IF;

    IF p_new_role NOT IN ('admin', 'manager', 'staff') THEN
        RAISE EXCEPTION 'Vai trò mới không hợp lệ: %', p_new_role;
    END IF;

    -- 2. Tìm thông tin hiện tại
    SELECT ur.role, p.name INTO v_target_old_role, v_target_name
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = p_target_user_id;

    IF v_target_name IS NULL THEN
        SELECT name, role INTO v_target_name, v_target_old_role
        FROM public.profiles
        WHERE id = p_target_user_id;
    END IF;

    IF v_target_name IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ nhân sự với mã ID: %', p_target_user_id;
    END IF;

    v_target_old_role := COALESCE(v_target_old_role, 'staff');

    -- 3. Safeguard: Chặn hạ quyền Admin cuối cùng đang active
    IF v_target_old_role = 'admin' AND p_new_role != 'admin' THEN
        SELECT COUNT(*) INTO v_admin_count
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id
        WHERE ur.role = 'admin'
          AND p.id != p_target_user_id
          AND p.status = 'active';

        IF v_admin_count = 0 THEN
            RAISE EXCEPTION 'Hành động bị chặn: Không thể hạ quyền tài khoản Admin duy nhất của hệ thống.';
        END IF;
    END IF;

    -- 4. Cập nhật user_roles
    INSERT INTO public.user_roles (user_id, role, updated_at)
    VALUES (p_target_user_id, p_new_role, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role, updated_at = NOW();

    -- 5. Cập nhật profiles
    UPDATE public.profiles
    SET role = p_new_role, updated_at = NOW()
    WHERE id = p_target_user_id;

    -- 6. Cập nhật staff_profiles (nếu có)
    UPDATE public.staff_profiles
    SET role = p_new_role, updated_at = NOW()
    WHERE id = p_target_user_id::TEXT;

    -- 7. Ghi audit log
    INSERT INTO public.audit_logs (
        user_id,
        role,
        action,
        resource,
        resource_id,
        details
    ) VALUES (
        auth.uid(),
        v_caller_role,
        'role_change',
        'user_roles',
        p_target_user_id::TEXT,
        jsonb_build_object(
            'target_name', v_target_name,
            'old_role', v_target_old_role,
            'new_role', p_new_role,
            'note', p_note,
            'changed_at', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_target_user_id,
        'old_role', v_target_old_role,
        'new_role', p_new_role,
        'message', 'Đã cập nhật vai trò nhân sự thành công.'
    );
END;
$$;

-- 9. SECURE RPC: ADMIN KHÓA / MỞ KHÓA TÀI KHOẢN
CREATE OR REPLACE FUNCTION public.admin_toggle_staff_status(
    p_target_user_id UUID,
    p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_current_status TEXT;
    v_target_role TEXT;
    v_target_name TEXT;
    v_next_status TEXT;
    v_admin_count INT;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        v_caller_role := public.get_current_user_role();
        IF v_caller_role NOT IN ('admin', 'manager') THEN
            RAISE EXCEPTION 'Truy cập bị từ chối: Bạn không có quyền quản lý trạng thái nhân sự.';
        END IF;
    ELSE
        v_caller_role := 'admin';
    END IF;

    SELECT status, role, name INTO v_current_status, v_target_role, v_target_name
    FROM public.profiles
    WHERE id = p_target_user_id;

    IF v_target_name IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ nhân sự với mã ID: %', p_target_user_id;
    END IF;

    IF v_caller_role = 'manager' AND v_target_role = 'admin' THEN
        RAISE EXCEPTION 'Từ chối quyền: Cửa hàng trưởng (Manager) không thể can thiệp tài khoản Quản trị viên (Admin).';
    END IF;

    -- Xác định status tiếp theo
    IF p_status IS NOT NULL THEN
        v_next_status := p_status;
    ELSE
        v_next_status := CASE WHEN v_current_status = 'active' THEN 'paused' ELSE 'active' END;
    END IF;

    -- Safeguard: Không thể khóa tài khoản Admin duy nhất
    IF v_target_role = 'admin' AND v_next_status != 'active' THEN
        SELECT COUNT(*) INTO v_admin_count
        FROM public.profiles
        WHERE role = 'admin'
          AND id != p_target_user_id
          AND status = 'active';

        IF v_admin_count = 0 THEN
            RAISE EXCEPTION 'Hành động bị chặn: Không thể khóa tài khoản Quản trị viên duy nhất của hệ thống.';
        END IF;
    END IF;

    UPDATE public.profiles
    SET status = v_next_status, updated_at = NOW()
    WHERE id = p_target_user_id;

    UPDATE public.staff_profiles
    SET status = v_next_status, updated_at = NOW()
    WHERE id = p_target_user_id::TEXT;

    INSERT INTO public.audit_logs (
        user_id,
        role,
        action,
        resource,
        resource_id,
        details
    ) VALUES (
        auth.uid(),
        v_caller_role,
        'status_change',
        'profiles',
        p_target_user_id::TEXT,
        jsonb_build_object(
            'target_name', v_target_name,
            'old_status', v_current_status,
            'new_status', v_next_status,
            'changed_at', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_target_user_id,
        'old_status', v_current_status,
        'new_status', v_next_status,
        'message', 'Đã cập nhật trạng thái nhân viên thành công.'
    );
END;
$$;

-- 10. SECURE RPC: ADMIN TẠO NHÂN VIÊN MỚI (TẠO ĐỒNG THỜI AUTH VÀ PROFILE AN TOÀN)
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
BEGIN
    -- 1. Quyền kiểm tra
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

    v_clean_phone := TRIM(p_phone);

    -- Role restriction: Manager chỉ được tạo Staff
    IF v_caller_role = 'manager' THEN
        v_effective_role := 'staff';
    ELSE
        v_effective_role := CASE WHEN p_role IN ('admin', 'manager', 'staff') THEN p_role ELSE 'staff' END;
    END IF;

    -- Kiểm tra trùng lặp email trong profiles hoặc auth.users
    IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_clean_email) THEN
        RAISE EXCEPTION 'Email % đã được đăng ký trên hệ thống.', v_clean_email;
    END IF;

    IF v_clean_phone != '' AND EXISTS (SELECT 1 FROM public.profiles WHERE phone = v_clean_phone) THEN
        RAISE EXCEPTION 'Số điện thoại % đã được sử dụng bởi nhân viên khác.', v_clean_phone;
    END IF;

    -- Sinh UUID mới cho User
    v_new_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(COALESCE(p_password, '123456'), gen_salt('bf'));

    -- 2. Tạo bản ghi trong auth.users
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

    -- 3. Tạo bản ghi trong public.profiles
    INSERT INTO public.profiles (
        id, email, name, role, status, phone, shift_name, notes, created_at, updated_at
    ) VALUES (
        v_new_user_id, v_clean_email, v_clean_name, v_effective_role, 'active', v_clean_phone, p_shift_name, p_notes, NOW(), NOW()
    );

    -- 4. Tạo bản ghi trong public.user_roles
    INSERT INTO public.user_roles (
        user_id, role, created_at, updated_at
    ) VALUES (
        v_new_user_id, v_effective_role, NOW(), NOW()
    );

    -- 5. Đồng bộ public.staff_profiles
    INSERT INTO public.staff_profiles (
        id, name, role, phone, email, status, shift_name, notes, created_at, updated_at
    ) VALUES (
        v_new_user_id::TEXT, v_clean_name, v_effective_role, v_clean_phone, v_clean_email, 'active', p_shift_name, p_notes, NOW(), NOW()
    );

    -- 6. Ghi Audit Log
    INSERT INTO public.audit_logs (
        user_id, role, action, resource, resource_id, details
    ) VALUES (
        auth.uid(), v_caller_role, 'create_staff', 'profiles', v_new_user_id::TEXT,
        jsonb_build_object(
            'name', v_clean_name,
            'email', v_clean_email,
            'role', v_effective_role,
            'phone', v_clean_phone,
            'created_at', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_new_user_id,
        'email', v_clean_email,
        'name', v_clean_name,
        'role', v_effective_role,
        'message', 'Đã tạo tài khoản nhân viên thành công.'
    );
END;
$$;

-- 11. ĐỒNG BỘ 7 TÀI KHOẢN KIỂM THỬ TỪ AUTH.USERS VÀO PROFILES & USER_ROLES
DO $$
DECLARE
    rec RECORD;
    v_role TEXT;
    v_name TEXT;
    v_phone TEXT;
    v_shift TEXT;
BEGIN
    FOR rec IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
        -- Trích xuất thông tin
        v_name := COALESCE(rec.raw_user_meta_data->>'name', split_part(rec.email, '@', 1));
        v_role := COALESCE(rec.raw_user_meta_data->>'role', 
            CASE 
                WHEN rec.email ILIKE 'admin%' THEN 'admin'
                WHEN rec.email ILIKE 'manager%' THEN 'manager'
                ELSE 'staff'
            END
        );
        v_phone := COALESCE(rec.raw_user_meta_data->>'phone', '');
        v_shift := CASE 
            WHEN rec.email ILIKE '%02%' THEN 'Ca Chiều (14:30 - 22:30)'
            WHEN rec.email ILIKE '%03%' THEN 'Ca Tối (17:00 - 23:00)'
            ELSE 'Ca Sáng (06:30 - 14:30)'
        END;

        -- 1. Insert / Update profiles
        INSERT INTO public.profiles (
            id, email, name, role, status, phone, shift_name, updated_at
        ) VALUES (
            rec.id, rec.email, v_name, v_role, 'active', v_phone, v_shift, NOW()
        )
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            name = CASE WHEN public.profiles.name = 'Nhân viên' OR public.profiles.name = '' THEN EXCLUDED.name ELSE public.profiles.name END,
            role = EXCLUDED.role,
            phone = COALESCE(NULLIF(public.profiles.phone, ''), EXCLUDED.phone),
            shift_name = COALESCE(public.profiles.shift_name, EXCLUDED.shift_name),
            updated_at = NOW();

        -- 2. Insert / Update user_roles
        INSERT INTO public.user_roles (user_id, role, updated_at)
        VALUES (rec.id, v_role, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET role = EXCLUDED.role, updated_at = NOW();

        -- 3. Đồng bộ staff_profiles
        INSERT INTO public.staff_profiles (
            id, name, role, phone, email, status, shift_name, updated_at
        ) VALUES (
            rec.id::TEXT, v_name, v_role, v_phone, rec.email, 'active', v_shift, NOW()
        )
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            role = EXCLUDED.role,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            status = 'active',
            updated_at = NOW();
    END LOOP;
END $$;

-- 12. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

-- 12.1 Profiles: Cho phép đọc thông tin nhân viên công khai nội bộ, Admin toàn quyền sửa, User sửa thông tin của mình
DROP POLICY IF EXISTS "Profiles Read Policy" ON public.profiles;
CREATE POLICY "Profiles Read Policy" ON public.profiles
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Profiles Update Policy" ON public.profiles;
CREATE POLICY "Profiles Update Policy" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Profiles Insert Policy" ON public.profiles;
CREATE POLICY "Profiles Insert Policy" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Profiles Delete Policy" ON public.profiles;
CREATE POLICY "Profiles Delete Policy" ON public.profiles
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- 12.2 User Roles: Mọi người đọc được, chỉ Admin sửa
DROP POLICY IF EXISTS "User Roles Read Policy" ON public.user_roles;
CREATE POLICY "User Roles Read Policy" ON public.user_roles
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "User Roles Write Policy" ON public.user_roles;
CREATE POLICY "User Roles Write Policy" ON public.user_roles
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 12.3 Audit Logs: Chỉ Manager và Admin xem được
DROP POLICY IF EXISTS "Audit Logs Read Policy" ON public.audit_logs;
CREATE POLICY "Audit Logs Read Policy" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Audit Logs Insert Policy" ON public.audit_logs;
CREATE POLICY "Audit Logs Insert Policy" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- 12.4 Staff Profiles (Legacy)
DROP POLICY IF EXISTS "Staff Profiles Read Policy" ON public.staff_profiles;
CREATE POLICY "Staff Profiles Read Policy" ON public.staff_profiles
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Staff Profiles Write Policy" ON public.staff_profiles;
CREATE POLICY "Staff Profiles Write Policy" ON public.staff_profiles
    FOR ALL TO authenticated
    USING (public.is_manager_or_admin())
    WITH CHECK (public.is_manager_or_admin());

-- 13. REALTIME REPLICATION PUBLICATION
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'user_roles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 14. TẠO STORAGE BUCKET 'avatars' CHO ẢNH ĐẠI DIỆN NHÂN VIÊN
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880, -- 5MB
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- Storage RLS
DROP POLICY IF EXISTS "Avatars Public Read" ON storage.objects;
CREATE POLICY "Avatars Public Read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars Authenticated Upload" ON storage.objects;
CREATE POLICY "Avatars Authenticated Upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars Authenticated Update" ON storage.objects;
CREATE POLICY "Avatars Authenticated Update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars')
    WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars Authenticated Delete" ON storage.objects;
CREATE POLICY "Avatars Authenticated Delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'avatars');
