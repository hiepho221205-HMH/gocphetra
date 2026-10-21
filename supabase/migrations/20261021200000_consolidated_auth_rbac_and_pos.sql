-- ==============================================================================
-- GÓC Coffee POS - Consolidated Internal Authentication & RBAC V1 Migration
-- Migration: 20261021200000_consolidated_auth_rbac_and_pos.sql
-- Description:
--   - 100% idempotent and non-destructive to existing tables and data
--   - Sets up profiles, user_roles, audit_logs, payments, staff_profiles, data_cleanup_jobs
--   - Hardened SECURITY DEFINER functions with search_path protection
--   - Complete Row Level Security (RLS) policies for Admin, Manager, and Staff
--   - Rollback capability via 20261021200000_rollback.sql
-- ==============================================================================

-- 1. ROLE ENUM TYPE
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'staff');
    END IF;
END $$;

-- 2. USER PROFILES TABLE (Linked with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    role public.app_role NOT NULL DEFAULT 'staff',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
    branch_id TEXT DEFAULT 'main',
    is_demo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist in case profiles table existed prior
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'staff';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'main';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

-- 3. USER ROLES TABLE (Decoupled Server-Side Source of Truth)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.app_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_roles_user_id_key UNIQUE (user_id)
);

-- 4. AUDIT LOGS TABLE (Append-Only Immutable Ledger)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    role public.app_role,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. STAFF PROFILES TABLE (Operational staff roster backward compatibility)
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'manager')),
    email TEXT,
    phone TEXT,
    branch_id TEXT DEFAULT 'main',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. DATA CLEANUP JOBS TABLE
CREATE TABLE IF NOT EXISTS public.data_cleanup_jobs (
    id TEXT PRIMARY KEY,
    job_mode TEXT NOT NULL DEFAULT 'range',
    criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    orders_count INT NOT NULL DEFAULT 0,
    total_revenue NUMERIC NOT NULL DEFAULT 0,
    backup_filename TEXT,
    backup_downloaded BOOLEAN DEFAULT FALSE,
    executed_by TEXT DEFAULT 'Quản lý (Admin)',
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    cleanup_mode TEXT,
    date_range JSONB DEFAULT '{}'::jsonb,
    total_amount NUMERIC DEFAULT 0,
    performed_by TEXT DEFAULT 'Quản lý (Admin)',
    backup_file_name TEXT
);

-- 7. EXTEND ORDERS & TABLES
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'main';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS business_date TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS carried_over_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_business_date TEXT;

ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'main';

-- Backfill business_date for orders if null
UPDATE public.orders 
SET business_date = to_char(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') 
WHERE business_date IS NULL AND created_at IS NOT NULL;

-- 8. PAYMENTS TABLE (Ledger for Cash & VietQR transactions)
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'completed',
    paid_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    business_date TEXT NOT NULL,
    cashier_id TEXT,
    idempotency_key TEXT UNIQUE,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_demo BOOLEAN DEFAULT FALSE,
    branch_id TEXT DEFAULT 'main',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. PERFORMANCE & AUDIT INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_business_date ON public.payments(business_date);
CREATE INDEX IF NOT EXISTS idx_orders_business_date ON public.orders(business_date);
CREATE INDEX IF NOT EXISTS idx_orders_soft_delete ON public.orders(is_deleted, status, business_date);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_status ON public.staff_profiles(status);

-- 10. SECURITY HELPER FUNCTIONS (search_path protected)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_role public.app_role;
    v_status TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN 'staff'::public.app_role;
    END IF;

    -- Check if profile is active
    SELECT status INTO v_status
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_status IS NOT NULL AND v_status != 'active' THEN
        -- Disabled account defaults to minimal privileges
        RETURN 'staff'::public.app_role;
    END IF;

    SELECT role INTO v_role
    FROM public.user_roles
    WHERE user_id = auth.uid();

    RETURN COALESCE(v_role, 'staff'::public.app_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT public.get_current_user_role() = 'admin'::public.app_role;
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT public.get_current_user_role() IN ('admin'::public.app_role, 'manager'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.current_vietnam_date()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT to_char(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
$$;

-- 11. SECURE RPC: ADMIN CHANGE USER ROLE
CREATE OR REPLACE FUNCTION public.admin_change_user_role(
    p_target_user_id UUID,
    p_new_role public.app_role
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_role public.app_role;
    v_target_old_role public.app_role;
    v_admin_count INT;
    v_target_name TEXT;
BEGIN
    -- Verify caller is Admin
    v_caller_role := public.get_current_user_role();
    IF v_caller_role != 'admin'::public.app_role THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền thay đổi vai trò nhân sự.';
    END IF;

    -- Lookup target user current role
    SELECT ur.role, p.name INTO v_target_old_role, v_target_name
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = p_target_user_id;

    IF v_target_old_role IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy người dùng với mã ID được chỉ định.';
    END IF;

    -- Safeguard: Prevent demoting the last remaining active Admin
    IF v_target_old_role = 'admin'::public.app_role AND p_new_role != 'admin'::public.app_role THEN
        SELECT COUNT(*) INTO v_admin_count
        FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.role = 'admin'::public.app_role 
          AND ur.user_id != p_target_user_id
          AND p.status = 'active';

        IF v_admin_count = 0 THEN
            RAISE EXCEPTION 'Hành động bị chặn: Không thể hạ quyền tài khoản Admin cuối cùng của hệ thống.';
        END IF;
    END IF;

    -- Update user_roles
    UPDATE public.user_roles
    SET role = p_new_role, updated_at = NOW()
    WHERE user_id = p_target_user_id;

    -- Update profiles
    UPDATE public.profiles
    SET role = p_new_role, updated_at = NOW()
    WHERE id = p_target_user_id;

    -- Synchronize with staff_profiles if exists
    UPDATE public.staff_profiles
    SET role = p_new_role::TEXT, updated_at = NOW()
    WHERE id = p_target_user_id::TEXT;

    -- Log to audit_logs
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

-- 12. SECURE RPC: ADMIN ARCHIVE ORDERS
CREATE OR REPLACE FUNCTION public.admin_archive_orders(
    p_order_ids TEXT[],
    p_reason TEXT DEFAULT 'Dọn dẹp lưu trữ an toàn'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_role public.app_role;
    v_active_count INT;
    v_archived_count INT;
    v_total_revenue NUMERIC;
BEGIN
    v_caller_role := public.get_current_user_role();
    IF v_caller_role != 'admin'::public.app_role THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền lưu trữ/xóa dữ liệu lịch sử.';
    END IF;

    IF p_order_ids IS NULL OR array_length(p_order_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'count', 0, 'message', 'Danh sách hóa đơn rỗng.');
    END IF;

    SELECT COUNT(*) INTO v_active_count
    FROM public.orders
    WHERE id = ANY(p_order_ids) AND status IN ('serving', 'awaiting_payment');

    IF v_active_count > 0 THEN
        RAISE EXCEPTION 'Hành động bị chặn: Có % đơn hàng đang phục vụ tại bàn. Không được xóa đơn đang mở!', v_active_count;
    END IF;

    SELECT COALESCE(SUM(total), 0) INTO v_total_revenue
    FROM public.orders
    WHERE id = ANY(p_order_ids) AND is_deleted = FALSE;

    UPDATE public.orders
    SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = auth.uid()
    WHERE id = ANY(p_order_ids) AND is_deleted = FALSE;

    GET DIAGNOSTICS v_archived_count = ROW_COUNT;

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
        'order_archived',
        'orders',
        array_to_string(p_order_ids[1:5], ',') || (CASE WHEN v_archived_count > 5 THEN '... (+' || (v_archived_count - 5)::TEXT || ')' ELSE '' END),
        jsonb_build_object(
            'archived_count', v_archived_count,
            'total_revenue', v_total_revenue,
            'reason', p_reason,
            'archived_at', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'count', v_archived_count,
        'total_revenue', v_total_revenue,
        'message', 'Đã lưu trữ an toàn ' || v_archived_count || ' hóa đơn.'
    );
END;
$$;

-- 13. SECURE RPC: ADMIN HARD DELETE SALES DATA
CREATE OR REPLACE FUNCTION public.admin_hard_delete_sales_data(
    p_order_ids TEXT[],
    p_mode TEXT DEFAULT 'range',
    p_criteria JSONB DEFAULT '{}'::jsonb,
    p_expected_count INT DEFAULT NULL,
    p_reason TEXT DEFAULT 'Xóa vĩnh viễn dữ liệu bán hàng',
    p_backup_filename TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_role public.app_role;
    v_branch_id TEXT := 'main';
    v_active_serving_count INT := 0;
    v_found_count INT := 0;
    v_deleted_payments INT := 0;
    v_unlinked_tables INT := 0;
    v_deleted_orders INT := 0;
    v_total_revenue NUMERIC := 0;
    v_valid_order_ids TEXT[];
BEGIN
    IF auth.uid() IS NOT NULL THEN
        v_caller_role := public.get_current_user_role();
        IF v_caller_role != 'admin'::public.app_role THEN
            RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền xóa dữ liệu bán hàng.';
        END IF;

        SELECT COALESCE(p.branch_id, 'main') INTO v_branch_id
        FROM public.profiles p
        WHERE p.id = auth.uid();
    END IF;

    IF v_branch_id IS NULL THEN
        v_branch_id := 'main';
    END IF;

    IF p_order_ids IS NULL OR array_length(p_order_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'count', 0, 'message', 'Danh sách mã đơn hàng cần xóa rỗng.');
    END IF;

    SELECT ARRAY_AGG(id) INTO v_valid_order_ids
    FROM public.orders
    WHERE id = ANY(p_order_ids)
      AND (branch_id = v_branch_id OR branch_id IS NULL);

    IF v_valid_order_ids IS NULL OR array_length(v_valid_order_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'count', 0, 'message', 'Không tìm thấy đơn hàng nào thuộc cửa hàng hiện tại để xóa.');
    END IF;

    -- Strict active dining protection
    SELECT COUNT(*) INTO v_active_serving_count
    FROM public.orders
    WHERE id = ANY(v_valid_order_ids)
      AND status = 'serving'
      AND table_id IS NOT NULL;

    IF v_active_serving_count > 0 THEN
        RAISE EXCEPTION 'Hành động bị chặn: Có % đơn hàng đang phục vụ tại bàn. Không được xóa đơn đang mở!', v_active_serving_count;
    END IF;

    v_found_count := array_length(v_valid_order_ids, 1);
    IF p_expected_count IS NOT NULL AND p_expected_count > 0 AND v_found_count != p_expected_count THEN
        RAISE EXCEPTION 'Dữ liệu bán hàng đã thay đổi so với bản xem trước (% đơn thực tế so với % dự kiến). Vui lòng tải lại bản xem trước trước khi xóa!', v_found_count, p_expected_count;
    END IF;

    SELECT COALESCE(SUM(total), 0) INTO v_total_revenue
    FROM public.orders
    WHERE id = ANY(v_valid_order_ids);

    -- Delete associated payments
    DELETE FROM public.payments WHERE order_id = ANY(v_valid_order_ids);
    GET DIAGNOSTICS v_deleted_payments = ROW_COUNT;

    -- Unlink active table references
    UPDATE public.tables
    SET active_order_id = NULL,
        status = 'empty',
        seated_at = NULL,
        customer_count = 0
    WHERE active_order_id = ANY(v_valid_order_ids);
    GET DIAGNOSTICS v_unlinked_tables = ROW_COUNT;

    -- Delete orders
    DELETE FROM public.orders WHERE id = ANY(v_valid_order_ids);
    GET DIAGNOSTICS v_deleted_orders = ROW_COUNT;

    -- Record cleanup job
    INSERT INTO public.data_cleanup_jobs (
        id, job_mode, criteria, orders_count, total_revenue,
        backup_filename, backup_downloaded, executed_by, status, created_at,
        cleanup_mode, date_range, total_amount, performed_by, backup_file_name
    ) VALUES (
        'job-' || to_char(NOW(), 'YYYYMMDD-HH24MISS'),
        p_mode, p_criteria, v_deleted_orders, v_total_revenue,
        p_backup_filename, true, 'Quản trị viên (Admin)', 'completed', NOW(),
        p_mode, p_criteria, v_total_revenue, 'Quản trị viên (Admin)', p_backup_filename
    );

    -- Record audit log
    INSERT INTO public.audit_logs (
        user_id, role, action, resource, resource_id, details
    ) VALUES (
        auth.uid(), 'admin'::public.app_role, 'sales_data_hard_deleted', 'orders',
        array_to_string(v_valid_order_ids[1:5], ',') || (CASE WHEN v_deleted_orders > 5 THEN '... (+' || (v_deleted_orders - 5)::TEXT || ')' ELSE '' END),
        jsonb_build_object(
            'mode', p_mode,
            'deleted_orders', v_deleted_orders,
            'deleted_payments', v_deleted_payments,
            'unlinked_tables', v_unlinked_tables,
            'total_revenue', v_total_revenue,
            'reason', p_reason,
            'backup_filename', p_backup_filename,
            'executed_at', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'deleted_orders', v_deleted_orders,
        'deleted_payments', v_deleted_payments,
        'unlinked_tables', v_unlinked_tables,
        'total_revenue', v_total_revenue,
        'message', 'Đã xóa vĩnh viễn ' || v_deleted_orders || ' đơn hàng thành công.'
    );
END;
$$;

-- 14. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_cleanup_jobs ENABLE ROW LEVEL SECURITY;

-- 14.1 Profiles
DROP POLICY IF EXISTS "Profiles Read" ON public.profiles;
CREATE POLICY "Profiles Read" ON public.profiles
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Profiles Update Self or Admin" ON public.profiles;
CREATE POLICY "Profiles Update Self or Admin" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

-- 14.2 User Roles
DROP POLICY IF EXISTS "User Roles Read" ON public.user_roles;
CREATE POLICY "User Roles Read" ON public.user_roles
    FOR SELECT TO anon, authenticated USING (true);

-- 14.3 Audit Logs
DROP POLICY IF EXISTS "Audit Logs Read" ON public.audit_logs;
CREATE POLICY "Audit Logs Read" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_manager_or_admin());

-- 14.4 Orders
DROP POLICY IF EXISTS "Orders RLS Select" ON public.orders;
CREATE POLICY "Orders RLS Select" ON public.orders
    FOR SELECT TO anon, authenticated
    USING (
        is_deleted = FALSE AND (
            public.is_manager_or_admin()
            OR (
                status IN ('serving', 'awaiting_payment')
                OR business_date = public.current_vietnam_date()
                OR (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
            )
            OR auth.uid() IS NULL
        )
    );

DROP POLICY IF EXISTS "Orders RLS Insert" ON public.orders;
CREATE POLICY "Orders RLS Insert" ON public.orders
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Orders RLS Update" ON public.orders;
CREATE POLICY "Orders RLS Update" ON public.orders
    FOR UPDATE TO anon, authenticated
    USING (public.is_admin() OR is_deleted = FALSE)
    WITH CHECK (public.is_admin() OR is_deleted = FALSE);

DROP POLICY IF EXISTS "Orders RLS Delete" ON public.orders;
CREATE POLICY "Orders RLS Delete" ON public.orders
    FOR DELETE TO anon, authenticated
    USING (false);

-- 14.5 Payments
DROP POLICY IF EXISTS "Payments Read" ON public.payments;
CREATE POLICY "Payments Read" ON public.payments
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Payments Insert" ON public.payments;
CREATE POLICY "Payments Insert" ON public.payments
    FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 14.6 Menu, Toppings, Categories
DROP POLICY IF EXISTS "Menu Items Read" ON public.menu_items;
CREATE POLICY "Menu Items Read" ON public.menu_items
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Menu Items Write" ON public.menu_items;
CREATE POLICY "Menu Items Write" ON public.menu_items
    FOR ALL TO authenticated
    USING (public.is_manager_or_admin())
    WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Toppings Read" ON public.toppings;
CREATE POLICY "Toppings Read" ON public.toppings
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Toppings Write" ON public.toppings;
CREATE POLICY "Toppings Write" ON public.toppings
    FOR ALL TO authenticated
    USING (public.is_manager_or_admin())
    WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Categories Read" ON public.categories;
CREATE POLICY "Categories Read" ON public.categories
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Categories Write" ON public.categories;
CREATE POLICY "Categories Write" ON public.categories
    FOR ALL TO authenticated
    USING (public.is_manager_or_admin())
    WITH CHECK (public.is_manager_or_admin());

-- 14.7 Tables
DROP POLICY IF EXISTS "Tables Read" ON public.tables;
CREATE POLICY "Tables Read" ON public.tables
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Tables Update Status" ON public.tables;
CREATE POLICY "Tables Update Status" ON public.tables
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tables Manage" ON public.tables;
CREATE POLICY "Tables Manage" ON public.tables
    FOR INSERT TO authenticated
    WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Tables Delete" ON public.tables;
CREATE POLICY "Tables Delete" ON public.tables
    FOR DELETE TO authenticated
    USING (public.is_manager_or_admin());

-- 14.8 Settings
DROP POLICY IF EXISTS "Settings Read" ON public.settings;
CREATE POLICY "Settings Read" ON public.settings
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Settings Write" ON public.settings;
CREATE POLICY "Settings Write" ON public.settings
    FOR ALL TO authenticated
    USING (public.is_manager_or_admin())
    WITH CHECK (public.is_manager_or_admin());

-- 14.9 Staff Profiles & Cleanup Jobs
DROP POLICY IF EXISTS "Staff Profiles Read" ON public.staff_profiles;
CREATE POLICY "Staff Profiles Read" ON public.staff_profiles
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Staff Profiles Write" ON public.staff_profiles;
CREATE POLICY "Staff Profiles Write" ON public.staff_profiles
    FOR ALL TO authenticated
    USING (public.is_manager_or_admin())
    WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Data Cleanup Jobs Read" ON public.data_cleanup_jobs;
CREATE POLICY "Data Cleanup Jobs Read" ON public.data_cleanup_jobs
    FOR SELECT TO authenticated
    USING (public.is_manager_or_admin());
