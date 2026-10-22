-- ==============================================================================
-- GÓC Coffee POS - Supabase Database Schema
-- Run this script in the Supabase Dashboard -> SQL Editor (project_ref: nbuulvdfxnmfdicbisxq)
-- Master Cumulative Schema including Milestone 4 (Staff RBAC & Data Cleanup Audit)
-- ==============================================================================

-- 1. DANH MỤC MÓN (Categories)
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. THỰC ĐƠN / MÓN (Menu Items)
CREATE TABLE IF NOT EXISTS public.menu_items (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    base_price NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    toppings TEXT[] DEFAULT '{}',
    in_stock BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TOPPINGS
CREATE TABLE IF NOT EXISTS public.toppings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    in_stock BOOLEAN DEFAULT TRUE,
    is_global BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LIÊN KẾT MÓN - TOPPING (Product Toppings)
CREATE TABLE IF NOT EXISTS public.product_toppings (
    product_id TEXT REFERENCES public.menu_items(id) ON DELETE CASCADE,
    topping_id TEXT REFERENCES public.toppings(id) ON DELETE CASCADE,
    price_override NUMERIC,
    PRIMARY KEY (product_id, topping_id)
);

-- 5. DANH SÁCH BÀN (Tables)
CREATE TABLE IF NOT EXISTS public.tables (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity INT DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'empty', -- 'empty', 'occupied', 'awaiting_payment'
    active_order_id TEXT,
    customer_count INT DEFAULT 0,
    seated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ĐƠN HÀNG (Orders: cả đơn đang phục vụ & lịch sử đã thanh toán)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    table_id TEXT,
    table_name TEXT,
    status TEXT NOT NULL, -- 'serving', 'awaiting_payment', 'completed', 'cancelled'
    cashier TEXT,
    customer_count INT DEFAULT 1,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    discount_percent NUMERIC DEFAULT 0,
    surcharge NUMERIC DEFAULT 0,
    subtotal NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    remaining_amount NUMERIC DEFAULT 0,
    split_payments JSONB DEFAULT '[]'::jsonb,
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- 7. CÀI ĐẶT QUÁN & VIETQR (Settings)
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7B. STORE SETTINGS CHUYÊN DỤNG (Bảng cấu hình quán chuẩn hóa)
CREATE TABLE IF NOT EXISTS public.store_settings (
    store_id TEXT PRIMARY KEY DEFAULT 'default_store',
    store_name TEXT NOT NULL DEFAULT 'GÓC',
    store_address TEXT NOT NULL DEFAULT '18A Võ Văn Dũng, Phường An Nhơn, Bình Định',
    contact_phone TEXT NOT NULL DEFAULT '1900 88 99 22',
    logo_original_url TEXT,
    logo_thermal_url TEXT,
    receipt_paper_width TEXT NOT NULL DEFAULT '58mm' CHECK (receipt_paper_width IN ('58mm', '80mm')),
    receipt_settings JSONB NOT NULL DEFAULT '{
        "showLogo": true,
        "showStoreName": true,
        "showAddress": true,
        "showPhone": true,
        "showOrderId": true,
        "showTable": true,
        "showOrderTime": true,
        "showReceiptTime": true,
        "showWifi": true,
        "showFooter": true
    }'::jsonb,
    receipt_footer TEXT NOT NULL DEFAULT 'Cảm ơn quý khách và hẹn gặp lại!',
    wifi_password TEXT DEFAULT 'xincamon',
    wifi_on_receipt BOOLEAN NOT NULL DEFAULT TRUE,
    bank_code TEXT DEFAULT 'MB',
    bank_account TEXT DEFAULT '0988776655',
    bank_account_name TEXT DEFAULT 'QUAN CA PHE GOC',
    vietqr_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7C. HÓA ĐƠN ĐÃ PHÁT HÀNH & SNAPSHOT BẤT BIẾN (Receipts)
CREATE TABLE IF NOT EXISTS public.receipts (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    store_id TEXT NOT NULL DEFAULT 'default_store',
    receipt_number TEXT NOT NULL,
    store_snapshot JSONB NOT NULL,
    order_snapshot JSONB NOT NULL,
    paper_width TEXT NOT NULL DEFAULT '58mm' CHECK (paper_width IN ('58mm', '80mm')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reprint_count INTEGER NOT NULL DEFAULT 0,
    last_reprinted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_settings_updated ON public.store_settings(updated_at);
CREATE INDEX IF NOT EXISTS idx_receipts_order_id ON public.receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_receipts_store_id ON public.receipts(store_id);
CREATE INDEX IF NOT EXISTS idx_receipts_issued_at ON public.receipts(issued_at);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON public.receipts(receipt_number);

-- 8. HỒ SƠ NHÂN VIÊN & PHÂN QUYỀN RBAC (Staff Profiles)
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'manager')),
    branch_id TEXT DEFAULT 'main',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. NHẬT KÝ DỌN DẸP DỮ LIỆU (Data Cleanup Jobs - Append-Only Audit Log)
CREATE TABLE IF NOT EXISTS public.data_cleanup_jobs (
    id TEXT PRIMARY KEY,
    -- Canonical fields
    job_mode TEXT NOT NULL DEFAULT 'range',
    criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    orders_count INT NOT NULL DEFAULT 0,
    total_revenue NUMERIC NOT NULL DEFAULT 0,
    backup_filename TEXT,
    backup_downloaded BOOLEAN DEFAULT FALSE,
    executed_by TEXT DEFAULT 'Quản lý (Admin)',
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Backward-compatibility fields (matching ORIGINAL_REQUEST.md & test oracle)
    cleanup_mode TEXT,
    date_range JSONB DEFAULT '{}'::jsonb,
    total_amount NUMERIC DEFAULT 0,
    performed_by TEXT DEFAULT 'Quản lý (Admin)',
    backup_file_name TEXT
);

-- SECONDARY INDEXES FOR FAST REPORTING & FILTERING
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_finished_at ON public.orders(finished_at);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_status ON public.staff_profiles(status);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_branch_id ON public.staff_profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_role ON public.staff_profiles(role);

CREATE INDEX IF NOT EXISTS idx_data_cleanup_jobs_job_mode ON public.data_cleanup_jobs(job_mode);
CREATE INDEX IF NOT EXISTS idx_data_cleanup_jobs_created_at ON public.data_cleanup_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_data_cleanup_jobs_status ON public.data_cleanup_jobs(status);

-- TRIGGERS: Auto-refresh updated_at on staff_profiles
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_staff_profiles_updated_at ON public.staff_profiles;
CREATE TRIGGER trigger_staff_profiles_updated_at
BEFORE UPDATE ON public.staff_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- TRIGGERS: Dual-sync fields on data_cleanup_jobs
CREATE OR REPLACE FUNCTION public.sync_data_cleanup_jobs_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Synchronize canonical from legacy if provided
    IF (NEW.job_mode IS NULL OR NEW.job_mode = 'range') AND NEW.cleanup_mode IS NOT NULL THEN
        NEW.job_mode := NEW.cleanup_mode;
    END IF;
    IF (NEW.criteria IS NULL OR NEW.criteria = '{}'::jsonb) AND NEW.date_range IS NOT NULL THEN
        NEW.criteria := NEW.date_range;
    END IF;
    IF NEW.total_revenue = 0 AND NEW.total_amount IS NOT NULL AND NEW.total_amount <> 0 THEN
        NEW.total_revenue := NEW.total_amount;
    END IF;
    IF (NEW.executed_by IS NULL OR NEW.executed_by = 'Quản lý (Admin)') AND NEW.performed_by IS NOT NULL THEN
        NEW.executed_by := NEW.performed_by;
    END IF;
    IF NEW.backup_filename IS NULL AND NEW.backup_file_name IS NOT NULL THEN
        NEW.backup_filename := NEW.backup_file_name;
    END IF;

    -- Synchronize legacy from canonical for reading
    NEW.cleanup_mode := COALESCE(NEW.cleanup_mode, NEW.job_mode);
    NEW.date_range := COALESCE(NEW.date_range, NEW.criteria);
    NEW.total_amount := COALESCE(NEW.total_amount, NEW.total_revenue);
    NEW.performed_by := COALESCE(NEW.performed_by, NEW.executed_by);
    NEW.backup_file_name := COALESCE(NEW.backup_file_name, NEW.backup_filename);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_data_cleanup_jobs_fields ON public.data_cleanup_jobs;
CREATE TRIGGER trigger_sync_data_cleanup_jobs_fields
BEFORE INSERT OR UPDATE ON public.data_cleanup_jobs
FOR EACH ROW
EXECUTE FUNCTION public.sync_data_cleanup_jobs_fields();

-- BẬT ROW LEVEL SECURITY (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_cleanup_jobs ENABLE ROW LEVEL SECURITY;

-- CẤP QUYỀN TRUY CẬP CHO CLIENT (ANON & AUTHENTICATED) TRÊN CÁC BẢNG POS THÔNG THƯỜNG
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'data_cleanup_jobs' LOOP
        EXECUTE format('DROP POLICY IF EXISTS "POS Public Access" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "POS Public Access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;

-- CHÍNH SÁCH BẢO MẬT RIÊNG CHO NHẬT KÝ DỌN DẸP DỮ LIỆU (APPEND-ONLY, NO UPDATE, NO DELETE)
DROP POLICY IF EXISTS "POS Public Access" ON public.data_cleanup_jobs;
DROP POLICY IF EXISTS "Data Cleanup Jobs Read" ON public.data_cleanup_jobs;
CREATE POLICY "Data Cleanup Jobs Read" ON public.data_cleanup_jobs
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Data Cleanup Jobs Insert" ON public.data_cleanup_jobs;
CREATE POLICY "Data Cleanup Jobs Insert" ON public.data_cleanup_jobs
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- KÍCH HOẠT REALTIME REPLICATION (Hỗ trợ đồng bộ nhiều thiết bị cùng lúc)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_profiles;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- INITIAL SEEDING: Staff Roster
INSERT INTO public.staff_profiles (id, name, status, role, branch_id, created_at, updated_at)
VALUES
    ('staff-01', 'Trần Mai', 'active', 'admin', 'main', NOW(), NOW()),
    ('staff-02', 'Nguyễn Văn Hùng', 'active', 'staff', 'main', NOW(), NOW()),
    ('staff-03', 'Lê Hoàng Nam', 'active', 'staff', 'main', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    role = EXCLUDED.role,
    branch_id = EXCLUDED.branch_id,
    updated_at = NOW();


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

-- ==============================================================================
-- 10. SECURE RPC: ADMIN HARD DELETE SALES DATA (CASCADE SAFEGUARD TRANSACTION)
-- ==============================================================================
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
    -- 1. SECURITY & PERMISSION VERIFICATION
    IF auth.uid() IS NOT NULL THEN
        v_caller_role := public.get_current_user_role();
        IF v_caller_role != 'admin'::public.app_role THEN
            RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền xóa dữ liệu bán hàng.';
        END IF;

        SELECT COALESCE(p.branch_id, 'main') INTO v_branch_id
        FROM public.profiles p WHERE p.id = auth.uid();

        IF v_branch_id IS NULL THEN
            SELECT COALESCE(sp.branch_id, 'main') INTO v_branch_id
            FROM public.staff_profiles sp WHERE sp.id = auth.uid()::TEXT;
        END IF;
    END IF;

    IF v_branch_id IS NULL THEN
        v_branch_id := 'main';
    END IF;

    -- 2. VALIDATE INPUT ARRAY
    IF p_order_ids IS NULL OR array_length(p_order_ids, 1) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'count', 0,
            'message', 'Danh sách mã đơn hàng cần xóa rỗng.'
        );
    END IF;

    SELECT ARRAY_AGG(id) INTO v_valid_order_ids
    FROM public.orders
    WHERE id = ANY(p_order_ids)
      AND (branch_id = v_branch_id OR branch_id IS NULL);

    IF v_valid_order_ids IS NULL OR array_length(v_valid_order_ids, 1) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'count', 0,
            'message', 'Không tìm thấy đơn hàng nào thuộc cửa hàng hiện tại để xóa.'
        );
    END IF;

    -- 3. SAFEGUARD: STRICT ACTIVE DINING PROTECTION
    SELECT COUNT(*) INTO v_active_serving_count
    FROM public.orders
    WHERE id = ANY(v_valid_order_ids)
      AND status = 'serving'
      AND table_id IS NOT NULL;

    IF v_active_serving_count > 0 THEN
        RAISE EXCEPTION 'Hành động bị chặn: Có % đơn hàng đang phục vụ tại bàn. Không được xóa đơn đang mở!', v_active_serving_count;
    END IF;

    -- 4. RACE CONDITION & PREVIEW DRIFT CHECK
    v_found_count := array_length(v_valid_order_ids, 1);
    IF p_expected_count IS NOT NULL AND p_expected_count > 0 AND v_found_count != p_expected_count THEN
        RAISE EXCEPTION 'Dữ liệu bán hàng đã thay đổi so với bản xem trước (% đơn thực tế so với % dự kiến). Vui lòng tải lại bản xem trước trước khi xóa!', v_found_count, p_expected_count;
    END IF;

    -- 5. CALCULATE TOTAL REVENUE (FOR AUDIT LEDGER)
    SELECT COALESCE(SUM(total), 0) INTO v_total_revenue
    FROM public.orders
    WHERE id = ANY(v_valid_order_ids);

    -- 6. EXECUTE HARD DELETION IN STRICT FOREIGN KEY ORDER
    DELETE FROM public.payments
    WHERE order_id = ANY(v_valid_order_ids);
    GET DIAGNOSTICS v_deleted_payments = ROW_COUNT;

    UPDATE public.tables
    SET active_order_id = NULL, status = 'empty', customer_count = 0, seated_at = NULL
    WHERE active_order_id = ANY(v_valid_order_ids);
    GET DIAGNOSTICS v_unlinked_tables = ROW_COUNT;

    DELETE FROM public.orders
    WHERE id = ANY(v_valid_order_ids);
    GET DIAGNOSTICS v_deleted_orders = ROW_COUNT;

    -- 7. WRITE AUDIT RECORDS
    INSERT INTO public.data_cleanup_jobs (
        id, job_mode, criteria, orders_count, total_revenue,
        backup_filename, backup_downloaded, executed_by, status, created_at
    ) VALUES (
        'clean_' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '_' || floor(random() * 1000)::TEXT,
        COALESCE(p_mode, 'range'),
        COALESCE(p_criteria, '{}'::jsonb),
        v_deleted_orders,
        v_total_revenue,
        p_backup_filename,
        (p_backup_filename IS NOT NULL AND p_backup_filename != ''),
        'Quản lý (Admin)',
        'completed',
        NOW()
    );

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        INSERT INTO public.audit_logs (
            user_id, role, action, resource, resource_id, details
        ) VALUES (
            auth.uid(),
            'admin'::public.app_role,
            'sales_data_cleanup',
            'orders',
            v_branch_id,
            jsonb_build_object(
                'mode', p_mode,
                'criteria', p_criteria,
                'deleted_orders_count', v_deleted_orders,
                'deleted_payments_count', v_deleted_payments,
                'total_revenue', v_total_revenue,
                'backup_filename', p_backup_filename,
                'reason', p_reason,
                'executed_at', NOW()
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'count', v_deleted_orders,
        'deleted_orders_count', v_deleted_orders,
        'deleted_payments_count', v_deleted_payments,
        'unlinked_tables_count', v_unlinked_tables,
        'total_revenue', v_total_revenue,
        'branch_id', v_branch_id,
        'message', 'Đã xóa vĩnh viễn ' || v_deleted_orders || ' đơn hàng và ' || v_deleted_payments || ' giao dịch thanh toán.'
    );
END;
$$;
