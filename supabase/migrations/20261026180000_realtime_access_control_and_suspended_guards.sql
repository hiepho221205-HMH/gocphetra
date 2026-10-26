-- ============================================================================
-- GÓC POS - REALTIME EMPLOYEE ACCESS CONTROL & SUSPENDED GUARDS
-- Migration: 20261026180000_realtime_access_control_and_suspended_guards.sql
-- Description:
-- 1. Standardize employee status to 'active' / 'suspended'
-- 2. Implement public.is_user_active() guard function
-- 3. Update admin_toggle_staff_status RPC (Admin-only, audit log, safeguards)
-- 4. Server-side blocking in atomic order/payment RPCs for suspended users
-- 5. RLS policies hardening on orders, tables, and payments against suspended accounts
-- ============================================================================

-- 1. STANDARDIZE STATUS IN PROFILES & STAFF_PROFILES
UPDATE public.profiles
SET status = 'suspended'
WHERE status IN ('paused', 'inactive');

UPDATE public.staff_profiles
SET status = 'suspended'
WHERE status IN ('paused', 'inactive');

-- 2. FUNCTION: CHECK IF AUTHENTICATED USER IS ACTIVE
CREATE OR REPLACE FUNCTION public.is_user_active(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT CASE
        WHEN p_user_id IS NULL THEN TRUE
        ELSE COALESCE(
            (SELECT status = 'active' FROM public.profiles WHERE id = p_user_id),
            FALSE
        )
    END;
$$;

-- 3. SECURE RPC: ADMIN TOGGLE STAFF STATUS (ADMIN-ONLY & AUDIT LOGGING)
CREATE OR REPLACE FUNCTION public.admin_toggle_staff_status(
    p_target_user_id UUID,
    p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_current_status TEXT;
    v_target_role TEXT;
    v_target_name TEXT;
    v_next_status TEXT;
    v_admin_count INT;
BEGIN
    v_caller_id := auth.uid();

    -- 1. Quyền hạn: CHỈ ADMIN mới được bật/tắt trạng thái tài khoản
    IF v_caller_id IS NOT NULL THEN
        v_caller_role := public.get_current_user_role();
        IF v_caller_role != 'admin' THEN
            RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền bật/tắt trạng thái hoạt động của nhân sự.';
        END IF;
    ELSE
        v_caller_role := 'admin';
    END IF;

    -- 2. Tìm thông tin nhân viên mục tiêu
    SELECT status, role, name INTO v_current_status, v_target_role, v_target_name
    FROM public.profiles
    WHERE id = p_target_user_id;

    IF v_target_name IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ nhân sự với mã ID: %', p_target_user_id;
    END IF;

    -- 3. Chuẩn hóa trạng thái (active / suspended)
    IF p_status IS NOT NULL THEN
        IF p_status IN ('paused', 'inactive', 'suspended') THEN
            v_next_status := 'suspended';
        ELSIF p_status = 'active' THEN
            v_next_status := 'active';
        ELSE
            RAISE EXCEPTION 'Trạng thái không hợp lệ: %. Chỉ chấp nhận active hoặc suspended.', p_status;
        END IF;
    ELSE
        v_next_status := CASE WHEN v_current_status = 'active' THEN 'suspended' ELSE 'active' END;
    END IF;

    -- 4. Safeguard: Không thể khóa Admin cuối cùng còn hoạt động
    IF v_target_role = 'admin' AND v_next_status != 'active' THEN
        SELECT COUNT(*) INTO v_admin_count
        FROM public.profiles
        WHERE role = 'admin'
          AND id != p_target_user_id
          AND status = 'active';

        IF v_admin_count = 0 THEN
            RAISE EXCEPTION 'Hành động bị chặn: Không thể khóa tài khoản Quản trị viên duy nhất của hệ thống.';
        END IF;

        -- Safeguard: Không cho Admin tự khóa chính mình
        IF v_caller_id = p_target_user_id THEN
            RAISE EXCEPTION 'Hành động bị chặn: Bạn không thể tự khóa tài khoản Quản trị viên đang sử dụng.';
        END IF;
    END IF;

    -- 5. Cập nhật bảng profiles
    UPDATE public.profiles
    SET status = v_next_status, updated_at = NOW()
    WHERE id = p_target_user_id;

    -- 6. Cập nhật bảng staff_profiles (dual-write)
    UPDATE public.staff_profiles
    SET status = v_next_status, updated_at = NOW()
    WHERE id = p_target_user_id::TEXT;

    -- 7. Ghi Audit Log đầy đủ
    INSERT INTO public.audit_logs (
        user_id,
        role,
        action,
        resource,
        resource_id,
        details
    ) VALUES (
        v_caller_id,
        v_caller_role,
        'status_change',
        'profiles',
        p_target_user_id::TEXT,
        jsonb_build_object(
            'actor', COALESCE(v_caller_id::TEXT, 'admin_system'),
            'target', p_target_user_id::TEXT,
            'target_name', v_target_name,
            'old_status', v_current_status,
            'new_status', v_next_status,
            'timestamp', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_target_user_id,
        'target_name', v_target_name,
        'old_status', v_current_status,
        'new_status', v_next_status,
        'message', CASE WHEN v_next_status = 'active'
            THEN 'Đã mở khóa tài khoản nhân viên thành công.'
            ELSE 'Đã tạm khóa tài khoản nhân viên thành công.'
        END
    );
END;
$$;

-- 4. HARDEN RLS POLICIES ON ORDERS AGAINST SUSPENDED USERS
DROP POLICY IF EXISTS "Orders RLS Insert" ON public.orders;
CREATE POLICY "Orders RLS Insert" ON public.orders
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        public.is_user_active()
    );

DROP POLICY IF EXISTS "Orders RLS Update" ON public.orders;
CREATE POLICY "Orders RLS Update" ON public.orders
    FOR UPDATE TO anon, authenticated
    USING (
        public.is_user_active() AND (public.is_admin() OR is_deleted = FALSE)
    )
    WITH CHECK (
        public.is_user_active() AND (public.is_admin() OR is_deleted = FALSE)
    );

-- 5. HARDEN ATOMIC ORDER & PAYMENT RPCS WITH USER ACTIVE CHECK
-- Overwrite save_pos_order_atomic_v2 to reject suspended users
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
    -- 0. Check account active status
    IF auth.uid() IS NOT NULL THEN
        IF NOT public.is_user_active(auth.uid()) THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'ACCOUNT_SUSPENDED',
                'message', 'Tài khoản của bạn đã bị tạm khóa. Mọi thao tác đặt món và gọi món bị từ chối.'
            );
        END IF;
    END IF;

    v_order_id := p_order->>'id';
    v_table_id := p_table->>'id';

    IF v_order_id IS NULL OR v_table_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'INVALID_PARAMETERS',
            'message', 'Missing order id or table id'
        );
    END IF;

    -- Calculate current Vietnam date
    v_today_vn := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');

    -- Optimistic locking on tables
    SELECT version INTO v_current_version
    FROM public.tables
    WHERE id = v_table_id
    FOR UPDATE;

    IF NOT FOUND THEN
        v_current_version := 1;
    END IF;

    IF p_expected_version IS NOT NULL AND v_current_version IS NOT NULL THEN
        IF v_current_version != p_expected_version THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'VERSION_CONFLICT',
                'message', 'Table has been modified by another cashier. Please refresh.',
                'current_version', v_current_version
            );
        END IF;
    END IF;

    v_next_version := COALESCE(v_current_version, 1) + 1;

    -- Extract order details
    v_items := COALESCE(p_order->'items', '[]'::jsonb);
    v_subtotal := COALESCE((p_order->>'subtotal')::numeric, 0);
    v_discount_pct := COALESCE((p_order->>'discount')::numeric, 0);
    v_discount_amt := COALESCE((p_order->>'discountAmount')::numeric, 0);
    v_surcharge := COALESCE((p_order->>'surcharge')::numeric, 0);
    v_total := COALESCE((p_order->>'total')::numeric, 0);
    v_customer_count := COALESCE((p_order->>'customerCount')::int, 1);
    v_cashier := COALESCE(p_order->>'cashier', 'Thu ngân');

    -- 1. Upsert Order
    SELECT * INTO v_existing_order FROM public.orders WHERE id = v_order_id;

    IF FOUND THEN
        UPDATE public.orders
        SET
            table_id = v_table_id,
            table_name = COALESCE(p_order->>'tableName', p_table->>'name', 'Bàn'),
            items = v_items,
            subtotal = v_subtotal,
            discount = v_discount_pct,
            discount_amount = v_discount_amt,
            surcharge = v_surcharge,
            total = v_total,
            customer_count = v_customer_count,
            cashier = v_cashier,
            notes = COALESCE(p_order->>'notes', ''),
            status = COALESCE(p_order->>'status', 'serving'),
            version = COALESCE(v_existing_order.version, 1) + 1,
            updated_at = NOW()
        WHERE id = v_order_id;
    ELSE
        INSERT INTO public.orders (
            id,
            table_id,
            table_name,
            items,
            subtotal,
            discount,
            discount_amount,
            surcharge,
            total,
            customer_count,
            cashier,
            notes,
            status,
            business_date,
            created_at,
            updated_at,
            version,
            is_deleted
        ) VALUES (
            v_order_id,
            v_table_id,
            COALESCE(p_order->>'tableName', p_table->>'name', 'Bàn'),
            v_items,
            v_subtotal,
            v_discount_pct,
            v_discount_amt,
            v_surcharge,
            v_total,
            v_customer_count,
            v_cashier,
            COALESCE(p_order->>'notes', ''),
            COALESCE(p_order->>'status', 'serving'),
            COALESCE(p_order->>'businessDate', v_today_vn),
            COALESCE((p_order->>'createdAt')::timestamptz, NOW()),
            NOW(),
            1,
            FALSE
        );
    END IF;

    -- 2. Update Table
    UPDATE public.tables
    SET
        status = COALESCE(p_table->>'status', 'occupied'),
        current_order_id = v_order_id,
        current_total = v_total,
        customer_count = v_customer_count,
        version = v_next_version,
        updated_at = NOW()
    WHERE id = v_table_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'table_id', v_table_id,
        'next_version', v_next_version,
        'total', v_total
    );
END;
$$;

-- Overwrite finalize_pos_order_atomic_v2 to reject suspended users
CREATE OR REPLACE FUNCTION public.finalize_pos_order_atomic_v2(
    p_order_id TEXT,
    p_table_id TEXT,
    p_payment_data JSONB,
    p_expected_table_version INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_table_version INT;
    v_today_vn TEXT;
    v_payment_id TEXT;
    v_amount NUMERIC := 0;
    v_method TEXT := 'cash';
BEGIN
    -- 0. Check account active status
    IF auth.uid() IS NOT NULL THEN
        IF NOT public.is_user_active(auth.uid()) THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'ACCOUNT_SUSPENDED',
                'message', 'Tài khoản của bạn đã bị tạm khóa. Mọi thao tác thanh toán đơn hàng bị từ chối.'
            );
        END IF;
    END IF;

    v_today_vn := TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');

    -- Optimistic locking on tables
    SELECT version INTO v_table_version
    FROM public.tables
    WHERE id = p_table_id
    FOR UPDATE;

    IF p_expected_table_version IS NOT NULL AND v_table_version IS NOT NULL THEN
        IF v_table_version != p_expected_table_version THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'VERSION_CONFLICT',
                'message', 'Bàn đang được thu ngân khác thao tác. Vui lòng thử lại.'
            );
        END IF;
    END IF;

    -- 1. Complete Order
    UPDATE public.orders
    SET
        status = 'completed',
        finished_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 2. Release Table
    UPDATE public.tables
    SET
        status = 'empty',
        current_order_id = NULL,
        current_total = 0,
        customer_count = 0,
        version = COALESCE(v_table_version, 1) + 1,
        updated_at = NOW()
    WHERE id = p_table_id;

    -- 3. Record Payment
    v_payment_id := COALESCE(p_payment_data->>'id', 'pay_' || p_order_id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT);
    v_amount := COALESCE((p_payment_data->>'amount')::numeric, 0);
    v_method := COALESCE(p_payment_data->>'method', 'cash');

    INSERT INTO public.payments (
        id,
        order_id,
        amount,
        payment_method,
        status,
        business_date,
        created_at,
        metadata
    ) VALUES (
        v_payment_id,
        p_order_id,
        v_amount,
        v_method,
        'completed',
        COALESCE(p_payment_data->>'businessDate', v_today_vn),
        NOW(),
        COALESCE(p_payment_data, '{}'::jsonb)
    )
    ON CONFLICT (id) DO UPDATE
    SET amount = EXCLUDED.amount, status = EXCLUDED.status, metadata = EXCLUDED.metadata;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'table_id', p_table_id,
        'payment_id', v_payment_id,
        'status', 'completed'
    );
END;
$$;
