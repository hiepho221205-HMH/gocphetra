-- ==============================================================================
-- GÓC Coffee POS - RBAC 3-Tier Security, Soft-Delete Archive & Audit System
-- Migration: 20261021000000_rbac_roles_rls_and_audit.sql
-- Roles: admin, manager, staff
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
    branch_id TEXT DEFAULT 'main',
    is_demo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. USER ROLES TABLE (Decoupled & Server-Managed Source of Truth)
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
    action TEXT NOT NULL, -- 'role_change', 'price_change', 'topping_change', 'order_archived', 'payment_recorded'
    resource TEXT NOT NULL, -- 'user_roles', 'menu_items', 'toppings', 'orders', 'payments'
    resource_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. EXTEND ORDERS TABLE WITH SOFT-DELETE & DEMO COLUMNS
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'main';

-- Extend tables with is_demo & branch_id for strict isolation
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'main';

-- Extend payments with is_demo & branch_id
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'main';

-- Performance & Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_orders_soft_delete ON public.orders(is_deleted, status, business_date);
CREATE INDEX IF NOT EXISTS idx_orders_is_demo ON public.orders(is_demo, branch_id);
CREATE INDEX IF NOT EXISTS idx_tables_is_demo ON public.tables(is_demo, branch_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action, created_at);

-- 6. SECURITY HELPER FUNCTIONS (SECURITY DEFINER with locked search_path)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_role public.app_role;
BEGIN
    IF auth.uid() IS NULL THEN
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

-- 7. SECURE RPC: ADMIN CHANGE USER ROLE
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

    -- Safeguard: Prevent demoting the last remaining Admin
    IF v_target_old_role = 'admin'::public.app_role AND p_new_role != 'admin'::public.app_role THEN
        SELECT COUNT(*) INTO v_admin_count
        FROM public.user_roles
        WHERE role = 'admin'::public.app_role AND user_id != p_target_user_id;

        IF v_admin_count = 0 THEN
            RAISE EXCEPTION 'Hành động bị chặn: Không thể hạ quyền tài khoản Admin cuối cùng của hệ thống.';
        END IF;
    END IF;

    -- Execute role update in user_roles
    UPDATE public.user_roles
    SET role = p_new_role, updated_at = NOW()
    WHERE user_id = p_target_user_id;

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

-- 8. SECURE RPC: ADMIN SOFT-DELETE / ARCHIVE ORDERS
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
    -- Verify caller is Admin
    v_caller_role := public.get_current_user_role();
    IF v_caller_role != 'admin'::public.app_role THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền lưu trữ/xóa dữ liệu lịch sử.';
    END IF;

    IF p_order_ids IS NULL OR array_length(p_order_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'count', 0, 'message', 'Danh sách hóa đơn rỗng.');
    END IF;

    -- Safeguard: Protect active dining tables (serving / awaiting_payment)
    SELECT COUNT(*) INTO v_active_count
    FROM public.orders
    WHERE id = ANY(p_order_ids) AND status IN ('serving', 'awaiting_payment');

    IF v_active_count > 0 THEN
        RAISE EXCEPTION 'Hành động bị chặn: Có % đơn hàng đang phục vụ tại bàn. Không được xóa đơn đang mở!', v_active_count;
    END IF;

    -- Calculate revenue of target orders for audit
    SELECT COALESCE(SUM(total), 0) INTO v_total_revenue
    FROM public.orders
    WHERE id = ANY(p_order_ids) AND is_deleted = FALSE;

    -- Perform Soft-Delete
    UPDATE public.orders
    SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = auth.uid()
    WHERE id = ANY(p_order_ids) AND is_deleted = FALSE;

    GET DIAGNOSTICS v_archived_count = ROW_COUNT;

    -- Record Audit Log
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

-- 9. CONFIGURE ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 9.1 Profiles & User Roles
DROP POLICY IF EXISTS "Profiles Read" ON public.profiles;
CREATE POLICY "Profiles Read" ON public.profiles
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "User Roles Read" ON public.user_roles;
CREATE POLICY "User Roles Read" ON public.user_roles
    FOR SELECT TO anon, authenticated USING (true);

-- 9.2 Audit Logs (Admin & Manager Read Only, No Direct Client Insert/Update/Delete)
DROP POLICY IF EXISTS "Audit Logs Read" ON public.audit_logs;
CREATE POLICY "Audit Logs Read" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_manager_or_admin());

-- 9.3 Orders Policies
DROP POLICY IF EXISTS "Orders RLS Select" ON public.orders;
CREATE POLICY "Orders RLS Select" ON public.orders
    FOR SELECT TO anon, authenticated
    USING (
        -- Soft-deleted orders are hidden from normal operational view
        is_deleted = FALSE AND (
            -- Admin & Manager can view all non-deleted orders
            public.is_manager_or_admin()
            OR
            -- Staff can ONLY view active serving orders OR completed orders of TODAY (Vietnam timezone)
            (
                status IN ('serving', 'awaiting_payment')
                OR business_date = public.current_vietnam_date()
                OR (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
            )
            OR
            auth.uid() IS NULL -- Fallback for offline/anon mode
        )
    );

DROP POLICY IF EXISTS "Orders RLS Insert" ON public.orders;
CREATE POLICY "Orders RLS Insert" ON public.orders
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Orders RLS Update" ON public.orders;
CREATE POLICY "Orders RLS Update" ON public.orders
    FOR UPDATE TO anon, authenticated
    USING (
        -- Staff & Manager can never set is_deleted = TRUE
        (public.is_admin() OR is_deleted = FALSE)
    )
    WITH CHECK (
        (public.is_admin() OR is_deleted = FALSE)
    );

DROP POLICY IF EXISTS "Orders RLS Delete" ON public.orders;
CREATE POLICY "Orders RLS Delete" ON public.orders
    FOR DELETE TO anon, authenticated
    USING (false); -- Physical hard delete is strictly FORBIDDEN! All removals use admin_archive_orders()

-- 9.4 Menu Items & Toppings & Categories
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

-- 9.5 Tables
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

-- 9.6 Settings
DROP POLICY IF EXISTS "Settings Read" ON public.settings;
CREATE POLICY "Settings Read" ON public.settings
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Settings Write" ON public.settings;
CREATE POLICY "Settings Write" ON public.settings
    FOR ALL TO authenticated
    USING (public.is_manager_or_admin())
    WITH CHECK (public.is_manager_or_admin());
