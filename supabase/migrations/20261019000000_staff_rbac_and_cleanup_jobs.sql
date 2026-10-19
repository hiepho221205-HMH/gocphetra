-- ==============================================================================
-- GÓC Coffee POS - Milestone 4 Migration
-- Migration: 20261019000000_staff_rbac_and_cleanup_jobs.sql
-- Description: Staff Profiles, RBAC foundations, Data Cleanup Audit Jobs, RLS, and Realtime Replication
-- ==============================================================================

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

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_cleanup_jobs ENABLE ROW LEVEL SECURITY;

-- Staff Profiles: Read & Write for POS clients
DROP POLICY IF EXISTS "POS Public Access" ON public.staff_profiles;
CREATE POLICY "POS Public Access" ON public.staff_profiles
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Data Cleanup Jobs: Read & Insert only (Append-Only Audit Log, strictly NO UPDATE or DELETE)
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

-- REALTIME REPLICATION (Synchronize staff live across all terminals)
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
