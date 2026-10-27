// ============================================================================
// GÓC POS - SUPABASE EDGE FUNCTION: ADMIN MANAGE CREDENTIALS (v3.2)
// Path: supabase/functions/admin-manage-credentials/index.ts
// Runtime: Deno / Supabase Edge Runtime
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Xử lý CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: "SERVER_CONFIG_ERROR", message: "Thiếu SUPABASE_SERVICE_ROLE_KEY trên Edge Function." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "UNAUTHORIZED", message: "Thiếu mã xác thực phiên đăng nhập (Bearer JWT)." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwtToken = authHeader.replace("Bearer ", "").trim();
    const body = await req.json();
    const { targetUserId, newEmail, newPassword, adminPassword, idempotencyKey } = body;

    if (!targetUserId || !adminPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "BAD_REQUEST", message: "Thiếu targetUserId hoặc adminPassword." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanNewEmail = newEmail ? String(newEmail).trim().toLowerCase() : null;
    const cleanNewPassword = newPassword ? String(newPassword).trim() : null;

    if (!cleanNewEmail && !cleanNewPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "NO_CHANGES", message: "Cần cung cấp email hoặc mật khẩu mới." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // 1. Xác thực caller UID từ JWT
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(jwtToken);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "INVALID_TOKEN", message: "Phiên đăng nhập Quản trị viên không hợp lệ hoặc đã hết hạn." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerUid = userData.user.id;
    const callerEmail = userData.user.email;

    // 2. Chống gửi lặp nguyên tử & xử lý Timeout (Idempotency Key Check)
    if (idempotencyKey) {
      const { data: existingKey } = await supabaseAdmin
        .from("security_idempotency_keys")
        .select("status, response, updated_at")
        .eq("key", idempotencyKey)
        .maybeSingle();

      if (existingKey) {
        if (existingKey.status === "completed" && existingKey.response) {
          return new Response(
            JSON.stringify(existingKey.response),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (existingKey.status === "processing") {
          return new Response(
            JSON.stringify({ success: false, error: "REQUEST_IN_PROGRESS", message: "Yêu cầu thay đổi thông tin đang được xử lý, vui lòng chờ trong giây lát." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      await supabaseAdmin.from("security_idempotency_keys").upsert({
        key: idempotencyKey,
        caller_id: callerUid,
        target_user_id: targetUserId,
        action_type: "ADMIN_UPDATE_CREDENTIALS",
        status: "processing",
        phase: "lock_acquired"
      });
    }

    // 3. Kiểm tra Rate Limiting nguyên tử (Row-Level Locking)
    const { data: rateData, error: rateErr } = await supabaseAdmin.rpc("check_security_rate_limit", {
      p_identifier: `admin_reauth:${callerUid}`,
      p_max_attempts: 5,
      p_window_minutes: 15
    });

    if (!rateErr && rateData && rateData.allowed === false) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "RATE_LIMIT_EXCEEDED",
          message: `Bạn đã nhập sai mật khẩu Quản trị viên quá 5 lần. Vui lòng thử lại sau ${rateData.retry_after_seconds} giây.`,
          retryAfterSeconds: rateData.retry_after_seconds
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rateData.retry_after_seconds) }
        }
      );
    }

    // 4. Kiểm tra quyền Admin & trạng thái Active trong bảng profiles
    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, name, role, status")
      .eq("id", callerUid)
      .maybeSingle();

    if (profileErr || !callerProfile || callerProfile.role !== "admin" || callerProfile.status === "suspended") {
      return new Response(
        JSON.stringify({ success: false, error: "FORBIDDEN", message: "Truy cập bị từ chối: Chỉ Quản trị viên đang hoạt động mới có quyền quản trị tài khoản." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Tái xác thực Quản trị viên (Admin Re-authentication)
    const { data: reauthData, error: reauthError } = await supabaseClient.auth.signInWithPassword({
      email: callerEmail,
      password: adminPassword.trim()
    });

    if (reauthError || !reauthData?.user) {
      await supabaseAdmin.rpc("record_security_failure", {
        p_identifier: `admin_reauth:${callerUid}`,
        p_window_minutes: 15
      });

      await supabaseAdmin.from("audit_logs").insert({
        action: "FAILED_ADMIN_REAUTH",
        actor_id: callerUid,
        target_user_id: targetUserId,
        old_role: "admin",
        new_role: "admin",
        note: "Xác thực mật khẩu Quản trị viên thất bại khi yêu cầu cập nhật thông tin đăng nhập",
        created_at: new Date().toISOString()
      });

      if (idempotencyKey) {
        await supabaseAdmin.from("security_idempotency_keys").update({ status: "failed" }).eq("key", idempotencyKey);
      }

      return new Response(
        JSON.stringify({ success: false, error: "INVALID_ADMIN_PASSWORD", message: "Mật khẩu Quản trị viên không chính xác. Vui lòng kiểm tra lại!" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (reauthData.user.id !== callerUid) {
      return new Response(
        JSON.stringify({ success: false, error: "REAUTH_UID_MISMATCH", message: "Danh tính người tái xác thực không khớp với người gọi." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset rate limit khi xác thực thành công
    await supabaseAdmin.rpc("reset_security_rate_limit", {
      p_identifier: `admin_reauth:${callerUid}`
    });

    // 6. Kiểm tra hồ sơ mục tiêu nhân sự
    const { data: targetProfile, error: targetErr } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, role")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetErr || !targetProfile) {
      if (idempotencyKey) {
        await supabaseAdmin.from("security_idempotency_keys").update({ status: "failed" }).eq("key", idempotencyKey);
      }
      return new Response(
        JSON.stringify({ success: false, error: "TARGET_NOT_FOUND", message: "Không tìm thấy hồ sơ nhân sự mục tiêu." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Sinh Database-Backed One-Time Nonce
    const nonce = `adm_nonce_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await supabaseAdmin.from("security_admin_credential_nonces").insert({
      nonce,
      actor_uid: callerUid,
      target_uid: targetUserId,
      action_scope: "update_credentials",
      request_id: idempotencyKey || null,
      status: "pending",
      expires_at: new Date(Date.now() + 60000).toISOString()
    });

    // Bảo toàn existing app_metadata
    let existingAppMetadata: Record<string, any> = {};
    try {
      const { data: targetAuthUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (targetAuthUser?.user?.app_metadata) {
        existingAppMetadata = targetAuthUser.user.app_metadata;
      }
    } catch {
      // best-effort
    }

    // 8. Pha 1: Thực hiện cập nhật tài khoản qua Supabase Auth Admin API (2 bước an toàn)
    // Bước 8.1: Nạp Nonce ủy quyền vào raw_app_meta_data của target user trước
    // (Bước này chỉ cập nhật app_metadata, không đổi email hay password nên bypass trigger an toàn)
    const nonceMetadataPayload = {
      app_metadata: {
        ...existingAppMetadata,
        admin_nonce: nonce
      }
    };

    const { error: nonceMetaErr } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      nonceMetadataPayload
    );

    if (nonceMetaErr) {
      if (idempotencyKey) {
        await supabaseAdmin.from("security_idempotency_keys").update({ status: "failed" }).eq("key", idempotencyKey);
      }
      return new Response(
        JSON.stringify({ success: false, error: "AUTH_NONCE_STAMP_FAILED", message: nonceMetaErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Bước 8.2: Áp dụng mật khẩu mới và/hoặc email mới
    // Trigger trg_guard_auth_user_credentials_update trên auth.users sẽ đọc admin_nonce vừa nạp ở Bước 8.1,
    // xác thực với security_admin_credential_nonces và tiêu thụ ('consumed') nguyên tử!
    const authUpdatePayload: Record<string, any> = {
      app_metadata: {
        ...existingAppMetadata,
        admin_nonce: nonce
      }
    };
    if (cleanNewEmail) {
      authUpdatePayload.email = cleanNewEmail;
      authUpdatePayload.email_confirm = true;
    }
    if (cleanNewPassword) {
      authUpdatePayload.password = cleanNewPassword;
    }

    if (idempotencyKey) {
      await supabaseAdmin.from("security_idempotency_keys").update({ phase: "auth_in_flight" }).eq("key", idempotencyKey);
    }

    const { data: updatedAuthUser, error: authAdminErr } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      authUpdatePayload
    );

    if (authAdminErr) {
      if (idempotencyKey) {
        await supabaseAdmin.from("security_idempotency_keys").update({ status: "failed" }).eq("key", idempotencyKey);
      }
      return new Response(
        JSON.stringify({ success: false, error: "AUTH_ADMIN_FAILED", message: authAdminErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Pha 2: Đồng bộ profiles.email & ghi Audit Log (2-PHASE RECONCILIATION)
    let syncError: any = null;
    const verifiedTargetEmail = cleanNewEmail || targetProfile.email;

    if (cleanNewEmail) {
      try {
        const { error: pErr } = await supabaseAdmin.from("profiles").update({
          email: verifiedTargetEmail,
          updated_at: new Date().toISOString()
        }).eq("id", targetUserId);
        if (pErr) syncError = pErr;

        await supabaseAdmin.from("staff_profiles").update({
          email: verifiedTargetEmail,
          updated_at: new Date().toISOString()
        }).eq("id", targetUserId);
      } catch (err) {
        syncError = err;
      }
    }

    try {
      await supabaseAdmin.from("audit_logs").insert({
        action: "ADMIN_UPDATE_CREDENTIALS",
        actor_id: callerUid,
        target_user_id: targetUserId,
        old_role: targetProfile.role,
        new_role: targetProfile.role,
        note: `Quản trị viên (${callerProfile.name}) cập nhật thông tin đăng nhập cho "${targetProfile.name}": email_changed=${Boolean(cleanNewEmail)}, password_changed=${Boolean(cleanNewPassword)}`,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      syncError = syncError || err;
    }

    if (syncError) {
      const reconciliationResponse = {
        success: true,
        authUpdated: true,
        profileSyncPending: true,
        status: "reconciliation_required",
        message: `Đã cập nhật thông tin đăng nhập trên Auth thành công. Hồ sơ hiển thị đang được tiếp tục đồng bộ.`,
        targetUserId,
        emailChanged: Boolean(cleanNewEmail),
        passwordChanged: Boolean(cleanNewPassword),
        email: verifiedTargetEmail
      };

      if (idempotencyKey) {
        await supabaseAdmin.from("security_idempotency_keys").update({
          status: "reconciliation_required",
          response: reconciliationResponse
        }).eq("key", idempotencyKey);
      }

      return new Response(
        JSON.stringify(reconciliationResponse),
        { status: 207, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeResponse = {
      success: true,
      authUpdated: true,
      profileSyncPending: false,
      status: "completed",
      message: `Đã cập nhật thông tin đăng nhập cho "${targetProfile.name}" thành công!`,
      targetUserId,
      emailChanged: Boolean(cleanNewEmail),
      passwordChanged: Boolean(cleanNewPassword),
      email: verifiedTargetEmail
    };

    if (idempotencyKey) {
      await supabaseAdmin.from("security_idempotency_keys").update({
        status: "completed",
        response: safeResponse
      }).eq("key", idempotencyKey);
    }

    return new Response(
      JSON.stringify(safeResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: "SERVER_EXCEPTION", message: error.message || "Lỗi ngoại lệ trên Edge Function." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
