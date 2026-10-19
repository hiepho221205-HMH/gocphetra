-- ==============================================================================
-- GÓC Coffee POS - Daily Order Rollover & Historical Payments Migration
-- Migration: 20261020100000_daily_rollover_and_payments.sql
-- Description: Unpaid orders rollover, table release, historical payments, and cash-basis reporting
-- ==============================================================================

-- 1. ADD NEW COLUMNS TO ORDERS TABLE
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS business_date TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS carried_over_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_business_date TEXT;

-- Backfill business_date and payment fields for existing orders
UPDATE public.orders 
SET business_date = to_char(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') 
WHERE business_date IS NULL AND created_at IS NOT NULL;

UPDATE public.orders 
SET payment_status = CASE 
    WHEN status = 'completed' THEN 'paid' 
    WHEN paid_amount > 0 THEN 'partial' 
    ELSE 'unpaid' 
END 
WHERE payment_status IS NULL;

UPDATE public.orders 
SET paid_at = finished_at 
WHERE status = 'completed' AND paid_at IS NULL AND finished_at IS NOT NULL;

UPDATE public.orders 
SET payment_business_date = to_char(finished_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') 
WHERE status = 'completed' AND finished_at IS NOT NULL AND payment_business_date IS NULL;

-- Indexes for lightning-fast rollover and historical reporting
CREATE INDEX IF NOT EXISTS idx_orders_business_date ON public.orders(business_date);
CREATE INDEX IF NOT EXISTS idx_orders_payment_business_date ON public.orders(payment_business_date);
CREATE INDEX IF NOT EXISTS idx_orders_status_business_date ON public.orders(status, business_date);

-- 2. PAYMENTS TABLE (Immutable Ledger for Cash & VietQR collections)
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL, -- 'cash' | 'vietqr' | ...
    payment_status TEXT NOT NULL DEFAULT 'completed',
    paid_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    business_date TEXT NOT NULL, -- YYYY-MM-DD according to Asia/Ho_Chi_Minh when paid
    cashier_id TEXT,
    idempotency_key TEXT UNIQUE,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_business_date ON public.payments(business_date);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Public read-write for payments'
    ) THEN
        CREATE POLICY "Public read-write for payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. STORED PROCEDURE: rollover_daily_orders
-- Atomically carries over unpaid orders to 'unpaid_carried_over' and frees occupied tables
CREATE OR REPLACE FUNCTION public.rollover_daily_orders(
    p_target_business_date TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rolled_orders_count INT := 0;
    v_released_tables_count INT := 0;
    v_order RECORD;
BEGIN
    IF p_target_business_date IS NULL OR p_target_business_date = '' THEN
        RAISE EXCEPTION 'Target business date is required (YYYY-MM-DD)';
    END IF;

    -- Iterate through past-day uncompleted orders
    FOR v_order IN
        SELECT id, table_id, business_date
        FROM public.orders
        WHERE (business_date IS NULL OR business_date < p_target_business_date)
          AND status IN ('serving', 'awaiting_payment')
        FOR UPDATE
    LOOP
        -- Transition order to unpaid_carried_over
        UPDATE public.orders
        SET status = 'unpaid_carried_over',
            carried_over_at = NOW(),
            payment_status = 'unpaid'
        WHERE id = v_order.id;

        v_rolled_orders_count := v_rolled_orders_count + 1;

        -- Release table ONLY IF this exact order is still the table's active_order_id
        IF v_order.table_id IS NOT NULL THEN
            UPDATE public.tables
            SET status = 'empty',
                active_order_id = NULL,
                customer_count = 0,
                seated_at = NULL
            WHERE id = v_order.table_id
              AND active_order_id = v_order.id;

            IF FOUND THEN
                v_released_tables_count := v_released_tables_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'target_business_date', p_target_business_date,
        'rolled_orders_count', v_rolled_orders_count,
        'released_tables_count', v_released_tables_count
    );
END;
$$;

-- 4. STORED PROCEDURE: process_historical_payment
-- Collects payment for past unpaid order, records payment ledger, completes order WITHOUT touching active tables
CREATE OR REPLACE FUNCTION public.process_historical_payment(
    p_order_id TEXT,
    p_payment_method TEXT,
    p_amount NUMERIC,
    p_payment_business_date TEXT,
    p_cashier TEXT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_payment_id TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_total NUMERIC;
BEGIN
    IF p_order_id IS NULL OR p_order_id = '' THEN
        RAISE EXCEPTION 'Order ID is required';
    END IF;

    -- 1. Idempotency Check
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        SELECT id INTO v_payment_id FROM public.payments WHERE idempotency_key = p_idempotency_key;
        IF v_payment_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'already_processed', true,
                'payment_id', v_payment_id,
                'order_id', p_order_id
            );
        END IF;
    END IF;

    -- 2. Lock and check order
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    IF v_order.status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_completed', true,
            'order_id', p_order_id
        );
    END IF;

    v_total := COALESCE(p_amount, v_order.total);

    -- 3. Insert payment ledger entry
    v_payment_id := 'PAY_' || to_char(v_now, 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 6);
    INSERT INTO public.payments (
        id, order_id, amount, payment_method, payment_status,
        paid_at, business_date, cashier_id, idempotency_key
    ) VALUES (
        v_payment_id,
        p_order_id,
        v_total,
        COALESCE(p_payment_method, 'cash'),
        'completed',
        v_now,
        p_payment_business_date,
        p_cashier,
        p_idempotency_key
    );

    -- 4. Mark order as completed and record historical payment attribution
    -- CRITICAL SAFETY: Tables table is NEVER modified here! Active dining tables remain completely untouched.
    UPDATE public.orders SET
        status = 'completed',
        payment_status = 'paid',
        paid_amount = v_total,
        remaining_amount = 0,
        payment_method = COALESCE(p_payment_method, 'cash'),
        paid_at = v_now,
        payment_business_date = p_payment_business_date,
        finished_at = COALESCE(finished_at, v_now)
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'payment_id', v_payment_id,
        'amount', v_total,
        'payment_business_date', p_payment_business_date,
        'status', 'completed'
    );
END;
$$;
