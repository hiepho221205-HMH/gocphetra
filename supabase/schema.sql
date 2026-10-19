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
