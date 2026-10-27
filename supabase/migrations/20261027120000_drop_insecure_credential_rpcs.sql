-- ============================================================================
-- GÓC POS - PHASE 3: SAFE CREDENTIAL MANAGEMENT RECOVERY (v3.2 - FINAL SECURITY REVIEW)
-- Migration: 20261027120000_drop_insecure_credential_rpcs.sql
-- Description:
-- 1. DROP an toàn 2 phiên bản RPC cũ bằng RESTRICT (không dùng CASCADE).
-- 2. Tạo bảng quản lý Idempotency Key đa pha (processing, completed, failed, reconciliation_required, timeout_uncertain).
-- 3. Tạo bảng Rate Limiting nguyên tử (Row-Level Locking: check_security_rate_limit, record_security_failure).
-- 4. Bảng Nonce ủy quyền một lần (security_admin_credential_nonces) ràng buộc DB.
-- 5. Hardened Trigger guard_auth_user_credentials_update trên auth.users:
--    Bắt buộc xác thực và tiêu thụ nguyên tử một lần duy nhất Nonce từ database,
--    chặn đứng triệt để thao tác tự đổi thông tin đăng nhập của Manager/Staff.
-- 6. Thu hồi toàn bộ quyền EXECUTE/SELECT mặc định khỏi PUBLIC, anon, authenticated.
--
-- QUY TẮC BẢO MẬT: CHỈ THỰC THI TRÊN PRODUCTION SAU KHI ĐƯỢC CHỦ DỰ ÁN PHÊ DUYỆT.
-- ============================================================================

-- 1. DROP CÁC HÀM RPC CŨ BẰNG RESTRICT (PHÂN TÍCH DEPENDENCY: ZERO PHỤ THUỘC TỒN TẠI)
DROP FUNCTION IF EXISTS public.admin_update_user_credentials(UUID, TEXT, TEXT, TEXT) RESTRICT;
DROP FUNCTION IF EXISTS public.admin_update_user_credentials(JSONB) RESTRICT;

-- 2. BẢNG QUẢN LÝ IDEMPOTENCY KEYS (ĐA PHA CHỐNG REQUEST TREO & TIMEOUT)
CREATE TABLE IF NOT EXISTS public.security_idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    caller_id UUID NOT NULL,
    target_user_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing' 
        CHECK (status IN ('processing', 'completed', 'failed', 'reconciliation_required', 'timeout_uncertain')),
    phase TEXT NOT NULL DEFAULT 'lock_acquired'
        CHECK (phase IN ('lock_acquired', 'auth_in_flight', 'auth_success', 'profile_sync_in_flight')),
    response JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes')
);

CREATE INDEX IF NOT EXISTS idx_security_idempotency_key ON public.security_idempotency_keys(key);
CREATE INDEX IF NOT EXISTS idx_security_idempotency_lookup ON public.security_idempotency_keys(caller_id, status, created_at);

ALTER TABLE public.security_idempotency_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access security_idempotency_keys" ON public.security_idempotency_keys;
CREATE POLICY "Service role access security_idempotency_keys" ON public.security_idempotency_keys
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. BẢNG QUẢN LÝ RATE LIMITING NGUYÊN TỬ (ROW-LEVEL LOCKING)
CREATE TABLE IF NOT EXISTS public.security_rate_limits (
    identifier TEXT PRIMARY KEY,
    failed_count INT NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_window ON public.security_rate_limits(window_start);

ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access security_rate_limits" ON public.security_rate_limits;
CREATE POLICY "Service role access security_rate_limits" ON public.security_rate_limits
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. BẢNG QUẢN LÝ NONCE ỦY QUYỀN MỘT LẦN (ONE-TIME DATABASE-BACKED NONCES)
CREATE TABLE IF NOT EXISTS public.security_admin_credential_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nonce TEXT UNIQUE NOT NULL,
    actor_uid UUID NOT NULL,
    target_uid UUID NOT NULL,
    action_scope TEXT NOT NULL DEFAULT 'update_credentials',
    request_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'consumed', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
    consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_security_nonces_lookup 
    ON public.security_admin_credential_nonces(nonce, target_uid, status, expires_at);

ALTER TABLE public.security_admin_credential_nonces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role access nonces" ON public.security_admin_credential_nonces;
CREATE POLICY "Service role access nonces" ON public.security_admin_credential_nonces
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. HÀM RATE LIMIT NGUYÊN TỬ (SELECT ... FOR UPDATE - CHỐNG ĐUA REQUEST ĐỒNG THỜI)
CREATE OR REPLACE FUNCTION public.check_security_rate_limit(
    p_identifier TEXT,
    p_max_attempts INT DEFAULT 5,
    p_window_minutes INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_window INTERVAL := (p_window_minutes || ' minutes')::INTERVAL;
    v_retry_after INT := 0;
BEGIN
    INSERT INTO public.security_rate_limits (identifier, failed_count, window_start, updated_at)
    VALUES (p_identifier, 0, v_now, v_now)
    ON CONFLICT (identifier) DO NOTHING;

    SELECT * INTO v_record
    FROM public.security_rate_limits
    WHERE identifier = p_identifier
    FOR UPDATE;

    IF v_record.window_start + v_window < v_now THEN
        UPDATE public.security_rate_limits
        SET failed_count = 0,
            window_start = v_now,
            locked_until = NULL,
            updated_at = v_now
        WHERE identifier = p_identifier;

        RETURN jsonb_build_object(
            'allowed', true,
            'failed_count', 0,
            'remaining_attempts', p_max_attempts,
            'retry_after_seconds', 0
        );
    END IF;

    IF v_record.failed_count >= p_max_attempts THEN
        v_retry_after := GREATEST(1, EXTRACT(EPOCH FROM ((v_record.window_start + v_window) - v_now))::INT);
        RETURN jsonb_build_object(
            'allowed', false,
            'failed_count', v_record.failed_count,
            'max_attempts', p_max_attempts,
            'retry_after_seconds', v_retry_after
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'failed_count', v_record.failed_count,
        'remaining_attempts', p_max_attempts - v_record.failed_count,
        'retry_after_seconds', 0
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_security_failure(
    p_identifier TEXT,
    p_window_minutes INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_window INTERVAL := (p_window_minutes || ' minutes')::INTERVAL;
BEGIN
    INSERT INTO public.security_rate_limits (identifier, failed_count, window_start, updated_at)
    VALUES (p_identifier, 1, v_now, v_now)
    ON CONFLICT (identifier) DO UPDATE
    SET failed_count = CASE
            WHEN public.security_rate_limits.window_start + v_window < v_now THEN 1
            ELSE public.security_rate_limits.failed_count + 1
        END,
        window_start = CASE
            WHEN public.security_rate_limits.window_start + v_window < v_now THEN v_now
            ELSE public.security_rate_limits.window_start
        END,
        updated_at = v_now
    RETURNING failed_count, window_start INTO v_record;

    RETURN jsonb_build_object('failed_count', v_record.failed_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_security_rate_limit(p_identifier TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM public.security_rate_limits WHERE identifier = p_identifier;
END;
$$;

-- 6. THU HỒI TOÀN BỘ QUYỀN EXECUTE/ACCESS KHỎI PUBLIC, anon, authenticated
REVOKE ALL ON FUNCTION public.check_security_rate_limit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_security_failure(TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_security_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.security_admin_credential_nonces FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.security_rate_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.security_idempotency_keys FROM PUBLIC, anon, authenticated;

-- CHỈ CẤP QUYỀN CHO service_role (Edge Function backend đặc quyền)
GRANT EXECUTE ON FUNCTION public.check_security_rate_limit(TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_security_failure(TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_security_rate_limit(TEXT) TO service_role;
GRANT ALL ON TABLE public.security_admin_credential_nonces TO service_role;
GRANT ALL ON TABLE public.security_rate_limits TO service_role;
GRANT ALL ON TABLE public.security_idempotency_keys TO service_role;

-- 7. HARDENED TRIGGER TRÊN AUTH.USERS VỚI XÁC THỰC VÀ TIÊU THỤ NONCE NGUYÊN TỬ
-- Cơ chế: Khi có thay đổi email hoặc password trên auth.users:
-- 1. Đọc marker admin_nonce từ app_metadata.
-- 2. Tìm kiếm trong bảng security_admin_credential_nonces đúng target_uid, status='pending', chưa hết hạn.
-- 3. Khóa hàng FOR UPDATE và cập nhật status='consumed' nguyên tử ngay trong transaction của trigger.
-- 4. Nếu thiếu nonce, nonce sai, nonce đã dùng, hoặc hết hạn -> RAISE EXCEPTION từ chối ngay lập tức.
-- 5. Non-admin calling GoTrue /user không thể ghi app_metadata -> Bị chặn 100%.
CREATE OR REPLACE FUNCTION public.guard_auth_user_credentials_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_nonce TEXT;
    v_nonce_record RECORD;
BEGIN
    -- Chỉ can thiệp khi có thay đổi nhạy cảm (mật khẩu hoặc email)
    IF (NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password) OR (NEW.email IS DISTINCT FROM OLD.email) THEN
        -- Đọc marker admin_nonce từ raw_app_meta_data
        v_nonce := NEW.raw_app_meta_data->>'admin_nonce';

        -- 1. Nếu có marker admin_nonce, tìm bản ghi nonce hợp lệ tương ứng
        IF v_nonce IS NOT NULL AND btrim(v_nonce) != '' THEN
            SELECT * INTO v_nonce_record
            FROM public.security_admin_credential_nonces
            WHERE nonce = v_nonce
              AND target_uid = NEW.id
              AND status = 'pending'
              AND expires_at > NOW()
            FOR UPDATE;
        END IF;

        -- 2. Dự phòng: Nếu GoTrue phân tách statement đổi password trước khi ghi nhận raw_app_meta_data mới,
        -- tìm nonce 'pending' hợp lệ do service_role tạo riêng cho target_uid này trong vòng 60 giây qua
        IF v_nonce_record.id IS NULL THEN
            SELECT * INTO v_nonce_record
            FROM public.security_admin_credential_nonces
            WHERE target_uid = NEW.id
              AND status = 'pending'
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE;
        END IF;

        -- Nếu không tìm thấy nonce hợp lệ (sai mục tiêu, đã dùng, hết hạn, hoặc non-admin bypass) -> TỪ CHỐI
        IF v_nonce_record.id IS NULL THEN
            RAISE EXCEPTION 'Chính sách bảo mật GÓC POS: Thao tác cập nhật credentials bị từ chối do thiếu Nonce ủy quyền hợp lệ của Quản trị viên hoặc Nonce đã hết hạn.';
        END IF;

        -- Tiêu thụ nonce nguyên tử đúng 1 lần duy nhất
        UPDATE public.security_admin_credential_nonces
        SET status = 'consumed',
            consumed_at = NOW()
        WHERE id = v_nonce_record.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_auth_user_credentials_update ON auth.users;
CREATE TRIGGER trg_guard_auth_user_credentials_update
BEFORE UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.guard_auth_user_credentials_update();

-- 8. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
