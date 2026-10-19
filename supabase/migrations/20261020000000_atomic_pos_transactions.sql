-- ==============================================================================
-- GÓC Coffee POS - Atomic Stored Procedures & Transaction Safeguards
-- Migration: 20261020000000_atomic_pos_transactions.sql
-- Eliminates race conditions, ghost tables, and orphan orders atomically
-- ==============================================================================

-- 1. ATOMIC ORDER SAVE & TABLE OCCUPANCY ASSIGNMENT
CREATE OR REPLACE FUNCTION public.save_pos_order_atomic(
    p_order JSONB,
    p_table JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id TEXT;
    v_table_id TEXT;
BEGIN
    v_order_id := p_order->>'id';
    v_table_id := p_table->>'id';

    IF v_order_id IS NULL OR v_table_id IS NULL THEN
        RAISE EXCEPTION 'Both order id and table id are required';
    END IF;

    -- Upsert order record
    INSERT INTO public.orders (
        id, table_id, table_name, status, cashier, customer_count,
        items, discount_percent, surcharge, subtotal, total,
        paid_amount, remaining_amount, split_payments, payment_method,
        created_at, finished_at
    ) VALUES (
        v_order_id,
        v_table_id,
        COALESCE(p_order->>'table_name', p_table->>'name'),
        COALESCE(p_order->>'status', 'serving'),
        COALESCE(p_order->>'cashier', 'Thu ngân'),
        COALESCE((p_order->>'customer_count')::int, 1),
        COALESCE(p_order->'items', '[]'::jsonb),
        COALESCE((p_order->>'discount_percent')::numeric, 0),
        COALESCE((p_order->>'surcharge')::numeric, 0),
        COALESCE((p_order->>'subtotal')::numeric, 0),
        COALESCE((p_order->>'total')::numeric, 0),
        COALESCE((p_order->>'paid_amount')::numeric, 0),
        COALESCE((p_order->>'remaining_amount')::numeric, 0),
        COALESCE(p_order->'split_payments', '[]'::jsonb),
        p_order->>'payment_method',
        COALESCE((p_order->>'created_at')::timestamptz, NOW()),
        (p_order->>'finished_at')::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
        table_id = EXCLUDED.table_id,
        table_name = EXCLUDED.table_name,
        status = EXCLUDED.status,
        cashier = EXCLUDED.cashier,
        customer_count = EXCLUDED.customer_count,
        items = EXCLUDED.items,
        discount_percent = EXCLUDED.discount_percent,
        surcharge = EXCLUDED.surcharge,
        subtotal = EXCLUDED.subtotal,
        total = EXCLUDED.total,
        paid_amount = EXCLUDED.paid_amount,
        remaining_amount = EXCLUDED.remaining_amount,
        split_payments = EXCLUDED.split_payments,
        payment_method = EXCLUDED.payment_method,
        finished_at = EXCLUDED.finished_at;

    -- Upsert table record to occupied atomically
    UPDATE public.tables SET
        status = 'occupied',
        active_order_id = v_order_id,
        customer_count = COALESCE((p_table->>'customer_count')::int, (p_order->>'customer_count')::int, 2),
        seated_at = COALESCE((p_table->>'seated_at')::timestamptz, NOW())
    WHERE id = v_table_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'table_id', v_table_id,
        'status', 'occupied'
    );
END;
$$;

-- 2. ATOMIC ORDER CHECKOUT & TABLE RELEASE
CREATE OR REPLACE FUNCTION public.finalize_pos_order_atomic(
    p_order_id TEXT,
    p_table_id TEXT,
    p_final_order JSONB,
    p_reset_table JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update completed order
    UPDATE public.orders SET
        status = 'completed',
        paid_amount = COALESCE((p_final_order->>'paid_amount')::numeric, total),
        remaining_amount = 0,
        payment_method = COALESCE(p_final_order->>'payment_method', 'cash'),
        split_payments = COALESCE(p_final_order->'split_payments', split_payments),
        finished_at = COALESCE((p_final_order->>'finished_at')::timestamptz, NOW())
    WHERE id = p_order_id;

    -- Atomically release table to empty
    UPDATE public.tables SET
        status = 'empty',
        active_order_id = NULL,
        customer_count = 0,
        seated_at = NULL
    WHERE id = p_table_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'table_id', p_table_id,
        'status', 'completed'
    );
END;
$$;

-- 3. ATOMIC TABLE TRANSFER
CREATE OR REPLACE FUNCTION public.transfer_pos_table_atomic(
    p_from_table_id TEXT,
    p_to_table_id TEXT,
    p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_to_table_name TEXT;
BEGIN
    SELECT name INTO v_to_table_name FROM public.tables WHERE id = p_to_table_id;
    IF v_to_table_name IS NULL THEN
        RAISE EXCEPTION 'Target table % does not exist', p_to_table_id;
    END IF;

    -- Update order to target table
    UPDATE public.orders SET
        table_id = p_to_table_id,
        table_name = v_to_table_name
    WHERE id = p_order_id;

    -- Release source table
    UPDATE public.tables SET
        status = 'empty',
        active_order_id = NULL,
        customer_count = 0,
        seated_at = NULL
    WHERE id = p_from_table_id;

    -- Assign to target table
    UPDATE public.tables SET
        status = 'occupied',
        active_order_id = p_order_id,
        seated_at = NOW()
    WHERE id = p_to_table_id;

    RETURN jsonb_build_object(
        'success', true,
        'from_table_id', p_from_table_id,
        'to_table_id', p_to_table_id,
        'order_id', p_order_id
    );
END;
$$;

-- 4. ATOMIC TABLE MERGE
CREATE OR REPLACE FUNCTION public.merge_pos_tables_atomic(
    p_source_table_id TEXT,
    p_target_table_id TEXT,
    p_source_order_id TEXT,
    p_target_order JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete or archive source order
    DELETE FROM public.orders WHERE id = p_source_order_id;

    -- Update target order with combined items & total
    UPDATE public.orders SET
        items = p_target_order->'items',
        subtotal = (p_target_order->>'subtotal')::numeric,
        total = (p_target_order->>'total')::numeric,
        remaining_amount = (p_target_order->>'remaining_amount')::numeric,
        customer_count = COALESCE((p_target_order->>'customer_count')::int, customer_count),
        surcharge = COALESCE((p_target_order->>'surcharge')::numeric, surcharge)
    WHERE id = p_target_order->>'id';

    -- Release source table to empty
    UPDATE public.tables SET
        status = 'empty',
        active_order_id = NULL,
        customer_count = 0,
        seated_at = NULL
    WHERE id = p_source_table_id;

    -- Ensure target table remains occupied with target order
    UPDATE public.tables SET
        status = 'occupied',
        active_order_id = p_target_order->>'id',
        customer_count = COALESCE((p_target_order->>'customer_count')::int, 2)
    WHERE id = p_target_table_id;

    RETURN jsonb_build_object(
        'success', true,
        'source_table_id', p_source_table_id,
        'target_table_id', p_target_table_id,
        'active_order_id', p_target_order->>'id'
    );
END;
$$;
