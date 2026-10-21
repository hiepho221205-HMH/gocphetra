-- ==============================================================================
-- GÓC Coffee POS - Admin Hard Delete Sales Data RPC Migration
-- Migration: 20261021160000_hard_delete_sales_data_rpc.sql
-- Implements atomic transaction, foreign-key safe hard deletion (payments, tables, orders),
-- strict store-scoped Admin verification, and append-only audit tracking.
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
    -- Check that caller is Admin if authenticated
    IF auth.uid() IS NOT NULL THEN
        v_caller_role := public.get_current_user_role();
        IF v_caller_role != 'admin'::public.app_role THEN
            RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền xóa dữ liệu bán hàng.';
        END IF;

        -- Resolve store / branch_id belonging to the authenticated Admin
        SELECT COALESCE(p.branch_id, 'main') INTO v_branch_id
        FROM public.profiles p
        WHERE p.id = auth.uid();

        IF v_branch_id IS NULL THEN
            SELECT COALESCE(sp.branch_id, 'main') INTO v_branch_id
            FROM public.staff_profiles sp
            WHERE sp.id = auth.uid()::TEXT;
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

    -- Filter to orders that belong to this store / branch_id
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
    -- Disallow deleting orders that are actively being served at occupied tables
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

    -- 5. CALCULATE TOTAL REVENUE OF DELETED ORDERS (FOR AUDIT LEDGER)
    SELECT COALESCE(SUM(total), 0) INTO v_total_revenue
    FROM public.orders
    WHERE id = ANY(v_valid_order_ids);

    -- 6. EXECUTE HARD DELETION IN STRICT FOREIGN KEY ORDER
    -- A. Delete child payments records first (bypassing ON DELETE RESTRICT cleanly)
    DELETE FROM public.payments
    WHERE order_id = ANY(v_valid_order_ids);
    GET DIAGNOSTICS v_deleted_payments = ROW_COUNT;

    -- B. Unlink active_order_id on tables referencing deleted orders (release table cleanly)
    UPDATE public.tables
    SET
        active_order_id = NULL,
        status = 'empty',
        customer_count = 0,
        seated_at = NULL
    WHERE active_order_id = ANY(v_valid_order_ids);
    GET DIAGNOSTICS v_unlinked_tables = ROW_COUNT;

    -- C. Delete parent orders records permanently
    DELETE FROM public.orders
    WHERE id = ANY(v_valid_order_ids);
    GET DIAGNOSTICS v_deleted_orders = ROW_COUNT;

    -- 7. WRITE AUDIT RECORDS (APPEND-ONLY IMMUTABLE AUDIT)
    -- Insert into data_cleanup_jobs
    INSERT INTO public.data_cleanup_jobs (
        id,
        job_mode,
        criteria,
        orders_count,
        total_revenue,
        backup_filename,
        backup_downloaded,
        executed_by,
        status,
        created_at
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

    -- Insert into audit_logs if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        INSERT INTO public.audit_logs (
            user_id,
            role,
            action,
            resource,
            resource_id,
            details
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

    -- 8. RETURN SUCCESS RESPONSE
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
