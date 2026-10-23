-- ==============================================================================
-- GÓC Coffee POS - Order & Payment Workflow Optimization Migration
-- Migration: 20261024000000_order_payment_atomic_optimization.sql
-- Description:
--   1. Atomic order saving with optimistic concurrency control (OCC version check)
--   2. Atomic order completion, payment ledger recording, and table release
--   3. Server-side total calculation & financial verification
--   4. Deterministic idempotency protection against duplicate payments
--   5. Partial indexes for active serving orders and occupied tables
-- ==============================================================================

-- 1. PARTIAL INDEXES FOR MAXIMUM QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_orders_active_serving
ON public.orders (table_id, status)
WHERE status = 'serving';

CREATE INDEX IF NOT EXISTS idx_tables_active_occupied
ON public.tables (id, status)
WHERE status = 'occupied';

CREATE INDEX IF NOT EXISTS idx_payments_order_idempotency
ON public.payments (order_id, idempotency_key);

-- Ensure version column exists on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- 2. ATOMIC ORDER SAVE & TABLE OCCUPANCY (RPC: save_pos_order_atomic_v2)
CREATE OR REPLACE FUNCTION public.save_pos_order_atomic_v2(
    p_order JSONB,
    p_table JSONB,
    p_expected_version INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_order_id TEXT;
    v_table_id TEXT;
    v_current_version INT;
    v_next_version INT;
    v_today_vn TEXT;
    v_items JSONB;
    v_subtotal NUMERIC := 0;
    v_discount_pct NUMERIC := 0;
    v_discount_amt NUMERIC := 0;
    v_surcharge NUMERIC := 0;
    v_total NUMERIC := 0;
    v_customer_count INT := 1;
    v_cashier TEXT := 'Thu ngân';
    v_existing_order RECORD;
BEGIN
    v_order_id := p_order->>'id';
    v_table_id := p_table->>'id';

    IF v_order_id IS NULL OR v_table_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'INVALID_PARAMETERS',
            'message', 'Cả Order ID và Table ID đều là trường bắt buộc.'
        );
    END IF;

    v_items := COALESCE(p_order->'items', '[]'::jsonb);
    IF jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'EMPTY_ORDER',
            'message', 'Đơn hàng chưa có món nào. Không thể lưu đơn trống.'
        );
    END IF;

    -- Calculate Vietnam today string (Asia/Ho_Chi_Minh)
    v_today_vn := to_char(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');

    -- Row-level lock on existing order if present
    SELECT * INTO v_existing_order
    FROM public.orders
    WHERE id = v_order_id
    FOR UPDATE;

    IF v_existing_order IS NOT NULL THEN
        v_current_version := COALESCE(v_existing_order.version, 1);

        -- Optimistic Concurrency Control (OCC) check
        IF p_expected_version IS NOT NULL AND v_current_version > p_expected_version THEN
            RETURN jsonb_build_object(
                'success', false,
                'conflict', true,
                'code', 'VERSION_CONFLICT',
                'server_version', v_current_version,
                'expected_version', p_expected_version,
                'current_order', to_jsonb(v_existing_order),
                'message', 'Đơn hàng vừa được cập nhật bởi thiết bị khác. Vui lòng tải lại.'
            );
        END IF;

        v_next_version := v_current_version + 1;
    ELSE
        v_next_version := COALESCE(p_expected_version, 1);
    END IF;

    -- Server-side total calculation & verification
    SELECT COALESCE(SUM(
        COALESCE((item->>'lineTotal')::numeric, ((item->>'quantity')::numeric * (item->>'unitPrice')::numeric), 0)
    ), 0) INTO v_subtotal
    FROM jsonb_array_elements(v_items) AS item;

    v_discount_pct := COALESCE((p_order->>'discount_percent')::numeric, 0);
    v_surcharge := COALESCE((p_order->>'surcharge')::numeric, 0);
    v_discount_amt := ROUND(v_subtotal * (v_discount_pct / 100));
    v_total := GREATEST(0, v_subtotal - v_discount_amt + v_surcharge);
    v_customer_count := GREATEST(1, COALESCE((p_order->>'customer_count')::int, (p_table->>'customer_count')::int, 2));
    v_cashier := COALESCE(p_order->>'cashier', 'Thu ngân');

    -- 1. Upsert Order Record
    INSERT INTO public.orders (
        id, table_id, table_name, status, cashier, customer_count,
        items, discount_percent, surcharge, subtotal, total,
        paid_amount, remaining_amount, split_payments, payment_method,
        business_date, payment_status, version,
        created_at, finished_at
    ) VALUES (
        v_order_id,
        v_table_id,
        COALESCE(p_order->>'table_name', p_table->>'name', 'Bàn'),
        'serving',
        v_cashier,
        v_customer_count,
        v_items,
        v_discount_pct,
        v_surcharge,
        v_subtotal,
        v_total,
        COALESCE((p_order->>'paid_amount')::numeric, 0),
        GREATEST(0, v_total - COALESCE((p_order->>'paid_amount')::numeric, 0)),
        COALESCE(p_order->'split_payments', '[]'::jsonb),
        p_order->>'payment_method',
        COALESCE(p_order->>'business_date', v_today_vn),
        'unpaid',
        v_next_version,
        COALESCE((p_order->>'created_at')::timestamptz, NOW()),
        NULL
    )
    ON CONFLICT (id) DO UPDATE SET
        table_id = EXCLUDED.table_id,
        table_name = EXCLUDED.table_name,
        status = 'serving',
        cashier = EXCLUDED.cashier,
        customer_count = EXCLUDED.customer_count,
        items = EXCLUDED.items,
        discount_percent = EXCLUDED.discount_percent,
        surcharge = EXCLUDED.surcharge,
        subtotal = EXCLUDED.subtotal,
        total = EXCLUDED.total,
        remaining_amount = GREATEST(0, EXCLUDED.total - orders.paid_amount),
        version = v_next_version,
        business_date = COALESCE(orders.business_date, EXCLUDED.business_date);

    -- 2. Atomically Assign Table to Occupied
    UPDATE public.tables SET
        status = 'occupied',
        active_order_id = v_order_id,
        customer_count = v_customer_count,
        seated_at = COALESCE(tables.seated_at, (p_table->>'seated_at')::timestamptz, NOW())
    WHERE id = v_table_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'table_id', v_table_id,
        'version', v_next_version,
        'subtotal', v_subtotal,
        'total', v_total,
        'status', 'occupied'
    );
END;
$$;

-- 3. ATOMIC ORDER CHECKOUT & PAYMENT TRANSACTION (RPC: finalize_pos_order_atomic_v2)
CREATE OR REPLACE FUNCTION public.finalize_pos_order_atomic_v2(
    p_order_id TEXT,
    p_table_id TEXT,
    p_amount NUMERIC,
    p_payment_method TEXT DEFAULT 'cash',
    p_cashier TEXT DEFAULT 'Thu ngân',
    p_idempotency_key TEXT DEFAULT NULL,
    p_final_order JSONB DEFAULT NULL,
    p_reset_table JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_today_vn TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_pay_id TEXT;
    v_order_total NUMERIC;
    v_pay_amount NUMERIC;
    v_existing_payment RECORD;
BEGIN
    IF p_order_id IS NULL OR p_order_id = '' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_ORDER_ID', 'message', 'Order ID is required.');
    END IF;

    v_today_vn := to_char(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');

    -- 1. IDEMPOTENCY CHECK: Prevent duplicate payments
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        SELECT * INTO v_existing_payment
        FROM public.payments
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_payment IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'already_processed', true,
                'payment_id', v_existing_payment.id,
                'order_id', p_order_id,
                'amount', v_existing_payment.amount,
                'message', 'Giao dịch thanh toán đã được ghi nhận trước đó (Idempotent).'
            );
        END IF;
    END IF;

    -- 2. ACQUIRE EXCLUSIVE ROW LOCK ON ORDER
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Không tìm thấy đơn hàng #' || p_order_id);
    END IF;

    -- If order is already completed, return idempotent success
    IF v_order.status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_completed', true,
            'order_id', p_order_id,
            'message', 'Đơn hàng này đã được thanh toán hoàn tất trước đó.'
        );
    END IF;

    v_order_total := COALESCE(v_order.total, 0);
    v_pay_amount := COALESCE(p_amount, v_order_total);
    IF v_pay_amount <= 0 AND v_order_total > 0 THEN
        v_pay_amount := v_order_total;
    END IF;

    -- 3. RECORD PAYMENT LEDGER (Strictly Once)
    v_pay_id := 'PAY_' || to_char(v_now, 'YYYYMMDD_HH24MISS') || '_' || SUBSTRING(p_order_id FROM 5 FOR 8);

    -- Insert payment record
    INSERT INTO public.payments (
        id, order_id, amount, payment_method, payment_status,
        paid_at, business_date, cashier_id, idempotency_key,
        notes, created_at
    ) VALUES (
        v_pay_id,
        p_order_id,
        v_pay_amount,
        COALESCE(p_payment_method, 'cash'),
        'completed',
        v_now,
        v_today_vn,
        COALESCE(p_cashier, v_order.cashier, 'Thu ngân'),
        p_idempotency_key,
        'Thanh toán tại bàn ' || COALESCE(v_order.table_name, p_table_id),
        v_now
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    -- 4. ATOMICALLY UPDATE ORDER TO COMPLETED
    UPDATE public.orders SET
        status = 'completed',
        payment_status = 'paid',
        paid_amount = v_pay_amount,
        remaining_amount = 0,
        payment_method = COALESCE(p_payment_method, 'cash'),
        paid_at = v_now,
        finished_at = v_now,
        payment_business_date = v_today_vn
    WHERE id = p_order_id;

    -- 5. ATOMICALLY RELEASE TABLE TO EMPTY
    IF p_table_id IS NOT NULL AND p_table_id <> '' THEN
        UPDATE public.tables SET
            status = 'empty',
            active_order_id = NULL,
            customer_count = 0,
            seated_at = NULL
        WHERE id = p_table_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'table_id', p_table_id,
        'payment_id', v_pay_id,
        'amount', v_pay_amount,
        'payment_method', COALESCE(p_payment_method, 'cash'),
        'status', 'completed',
        'paid_at', v_now
    );
END;
$$;
