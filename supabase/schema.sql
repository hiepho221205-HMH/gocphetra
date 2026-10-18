-- ==============================================================================
-- GÓC Coffee POS - Supabase Database Schema
-- Run this script in the Supabase Dashboard -> SQL Editor (project_ref: nbuulvdfxnmfdicbisxq)
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

-- BẬT ROW LEVEL SECURITY (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- CẤP QUYỀN TRUY CẬP CHO CLIENT (ANON & AUTHENTICATED)
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS "POS Public Access" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "POS Public Access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;

-- KÍCH HOẠT REALTIME REPLICATION (Hỗ trợ đồng bộ nhiều thiết bị cùng lúc)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
EXCEPTION WHEN OTHERS THEN
    -- Table might already be in publication
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
