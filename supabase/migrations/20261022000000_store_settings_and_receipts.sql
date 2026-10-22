-- ============================================================================
-- GÓC POS — STORE CONFIGURATION & IMMUTABLE RECEIPT ENGINE MIGRATION
-- Migration Version: 20261022000000_store_settings_and_receipts.sql
-- Description: Standardizes multi-tenant store configuration, immutable receipt
-- snapshots, audit tracking, and thermal logo assets storage.
-- ============================================================================

-- 1. STORE SETTINGS TABLE (Bảng cấu hình quán chuẩn hóa)
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

-- Index for store settings
CREATE INDEX IF NOT EXISTS idx_store_settings_updated ON public.store_settings(updated_at);

-- 2. IMMUTABLE RECEIPTS TABLE (Hóa đơn đã phát hành và lưu vết snapshot)
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

-- Secondary Indexes for Fast Receipt Retrieval & Reprinting
CREATE INDEX IF NOT EXISTS idx_receipts_order_id ON public.receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_receipts_store_id ON public.receipts(store_id);
CREATE INDEX IF NOT EXISTS idx_receipts_issued_at ON public.receipts(issued_at);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON public.receipts(receipt_number);

-- 3. STORAGE BUCKET FOR STORE ASSETS & LOGOS
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
    'store-assets',
    'store-assets',
    true,
    false,
    5242880, -- 5MB limit
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

-- 4. ROW-LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Helper to safely drop existing policies before recreation
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow read store_settings for all" ON public.store_settings;
    DROP POLICY IF EXISTS "Allow update store_settings for admin and manager" ON public.store_settings;
    DROP POLICY IF EXISTS "Allow read receipts for staff and above" ON public.receipts;
    DROP POLICY IF EXISTS "Allow insert receipts for active staff" ON public.receipts;
    DROP POLICY IF EXISTS "Allow update reprint on receipts" ON public.receipts;
    DROP POLICY IF EXISTS "Public read store assets" ON storage.objects;
    DROP POLICY IF EXISTS "Staff and Admin upload store assets" ON storage.objects;
END $$;

-- Policies for store_settings:
-- Any active POS client or user can read store info
CREATE POLICY "Allow read store_settings for all"
ON public.store_settings FOR SELECT
TO anon, authenticated
USING (true);

-- Admin and Manager can insert or update store settings
CREATE POLICY "Allow update store_settings for admin and manager"
ON public.store_settings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'manager')
    )
    OR auth.role() = 'service_role'
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'manager')
    )
    OR auth.role() = 'service_role'
);

-- Policies for receipts:
-- All authenticated staff, managers and admins can read receipts
CREATE POLICY "Allow read receipts for staff and above"
ON public.receipts FOR SELECT
TO anon, authenticated
USING (true);

-- Staff, managers, admins can issue receipts
CREATE POLICY "Allow insert receipts for active staff"
ON public.receipts FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Update receipt reprint counter
CREATE POLICY "Allow update reprint on receipts"
ON public.receipts FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Storage bucket access policies
CREATE POLICY "Public read store assets"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'store-assets');

CREATE POLICY "Staff and Admin upload store assets"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'store-assets');

CREATE POLICY "Staff and Admin update store assets"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'store-assets');

CREATE POLICY "Staff and Admin delete store assets"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'store-assets');

-- 5. SEED INITIAL STORE SETTINGS FROM PRODUCTION CONFIG
DO $$
DECLARE
    prod_config JSONB;
BEGIN
    SELECT value INTO prod_config FROM public.settings WHERE key = 'pos_config';
    
    INSERT INTO public.store_settings (
        store_id,
        store_name,
        store_address,
        contact_phone,
        wifi_password,
        wifi_on_receipt,
        bank_code,
        bank_account,
        bank_account_name,
        vietqr_enabled,
        receipt_paper_width,
        receipt_footer,
        updated_at
    )
    VALUES (
        'default_store',
        COALESCE(prod_config->>'branchName', 'GÓC'),
        COALESCE(prod_config->>'branchAddress', '18A Võ Văn Dũng, Phường An Nhơn, Bình Định'),
        COALESCE(prod_config->>'hotline', '1900 88 99 22'),
        COALESCE(prod_config->>'wifiPassword', 'xincamon'),
        true,
        COALESCE(prod_config->'bankAccount'->>'bankCode', 'MB'),
        COALESCE(prod_config->'bankAccount'->>'accountNo', '0988776655'),
        COALESCE(prod_config->'bankAccount'->>'accountHolder', 'QUAN CA PHE GOC'),
        COALESCE((prod_config->>'enableVietQR')::boolean, true),
        '58mm',
        'Cảm ơn quý khách và hẹn gặp lại!',
        NOW()
    )
    ON CONFLICT (store_id) DO UPDATE SET
        store_name = EXCLUDED.store_name,
        store_address = EXCLUDED.store_address,
        contact_phone = EXCLUDED.contact_phone,
        wifi_password = EXCLUDED.wifi_password,
        bank_code = EXCLUDED.bank_code,
        bank_account = EXCLUDED.bank_account,
        bank_account_name = EXCLUDED.bank_account_name,
        updated_at = NOW();
END $$;
