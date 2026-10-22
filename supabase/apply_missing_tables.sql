-- ============================================================================
-- GÓC POS - BỔ SUNG CÁC BẢNG & HÀM CÒN THIẾU TRÊN SUPABASE CLOUD
-- Chạy đoạn script này trong Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. BẢNG PROFILES (HỒ SƠ TÀI KHOẢN NGƯỜI DÙNG)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT NOT NULL DEFAULT 'Nhân viên',
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
    avatar_url TEXT,
    phone TEXT,
    branch_id TEXT NOT NULL DEFAULT 'main',
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. BẢNG USER_ROLES (PHÂN QUYỀN RBAC)
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. BẢNG STAFF_PROFILES (HỒ SƠ NHÂN VIÊN CA LÀM VIỆC)
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
    shift_name TEXT,
    notes TEXT,
    email TEXT,
    branch_id TEXT NOT NULL DEFAULT 'main',
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. BẢNG PAYMENTS (LỊCH SỬ THANH TOÁN CHI TIẾT)
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    payment_status TEXT NOT NULL DEFAULT 'completed',
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    business_date DATE NOT NULL DEFAULT CURRENT_DATE,
    cashier_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. BẬT RLS CHO CÁC BẢNG MỚI
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 6. POLICIES CHO PHÉP ĐỌC/GHI AN TOÀN
DROP POLICY IF EXISTS "Allow Read Profiles" ON public.profiles;
CREATE POLICY "Allow Read Profiles" ON public.profiles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow Update Profiles" ON public.profiles;
CREATE POLICY "Allow Update Profiles" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Read User Roles" ON public.user_roles;
CREATE POLICY "Allow Read User Roles" ON public.user_roles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow Update User Roles" ON public.user_roles;
CREATE POLICY "Allow Update User Roles" ON public.user_roles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Read Staff Profiles" ON public.staff_profiles;
CREATE POLICY "Allow Read Staff Profiles" ON public.staff_profiles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow Update Staff Profiles" ON public.staff_profiles;
CREATE POLICY "Allow Update Staff Profiles" ON public.staff_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Read Payments" ON public.payments;
CREATE POLICY "Allow Read Payments" ON public.payments FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow Update Payments" ON public.payments;
CREATE POLICY "Allow Update Payments" ON public.payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 7. BỔ SUNG REALTIME PUBLICATION
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables, public.orders;

-- 8. HÀM RPC ROLLOVER DAILY ORDERS
CREATE OR REPLACE FUNCTION public.rollover_daily_orders(p_target_business_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count INT := 0;
BEGIN
    UPDATE public.orders
    SET status = 'unpaid_carried_over'
    WHERE status IN ('serving', 'awaiting_payment')
      AND (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date < p_target_business_date;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'rolled_over_orders_count', v_updated_count,
        'target_business_date', p_target_business_date
    );
END;
$$;
