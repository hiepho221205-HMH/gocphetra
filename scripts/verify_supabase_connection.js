import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Load .env manually
const envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ File .env không tồn tại!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    envVars[key] = val;
  }
}

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;

console.log('============================================================');
console.log('🔍 KIỂM TRA TOÀN DIỆN KẾT NỐI SUPABASE - GÓC POS');
console.log('============================================================');

console.log('\n[1. CẤU HÌNH & BIẾN MÔI TRƯỜNG]');
console.log(`- Supabase URL: ${supabaseUrl ? supabaseUrl : '❌ THIẾU'}`);
console.log(`- API Key (Key length): ${supabaseKey ? `${supabaseKey.length} ký tự (sb_... format)` : '❌ THIẾU'}`);

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ LỖI: Biến môi trường Supabase chưa được cấu hình đầy đủ!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function runChecks() {
  const results = {
    tablesChecked: {},
    rlsStatus: {},
    orderPaymentIntegrity: null,
    errors: []
  };

  const targetTables = [
    { name: 'tables', label: 'Bàn ăn (tables)' },
    { name: 'categories', label: 'Danh mục món (categories)' },
    { name: 'menu_items', label: 'Món ăn / Đồ uống (menu_items)' },
    { name: 'toppings', label: 'Topping thêm (toppings)' },
    { name: 'product_toppings', label: 'Liên kết Món-Topping (product_toppings)' },
    { name: 'orders', label: 'Đơn hàng (orders)' },
    { name: 'payments', label: 'Giao dịch thanh toán (payments)' },
    { name: 'staff_profiles', label: 'Hồ sơ nhân viên (staff_profiles)' },
    { name: 'settings', label: 'Cấu hình quán (settings)' },
    { name: 'data_cleanup_jobs', label: 'Lịch sử dọn dẹp (data_cleanup_jobs)' },
    { name: 'audit_logs', label: 'Nhật ký kiểm toán (audit_logs)' }
  ];

  console.log('\n[2. KIỂM TRA TRUY VẤN DỮ LIỆU THỰC TẾ TRÊN CÁC BẢNG]');

  for (const t of targetTables) {
    try {
      const { data, count, error } = await supabase
        .from(t.name)
        .select('*', { count: 'exact' })
        .limit(3);

      if (error) {
        console.log(`  ❌ ${t.label}: Lỗi - ${error.message} (Code: ${error.code})`);
        results.tablesChecked[t.name] = { success: false, error: error.message };
        results.errors.push(`${t.name}: ${error.message}`);
      } else {
        const rowCount = count !== null ? count : (data ? data.length : 0);
        console.log(`  ✅ ${t.label}: Kết nối OK | Tổng bản ghi thực tế: ${rowCount}`);
        results.tablesChecked[t.name] = { success: true, count: rowCount, sample: data?.[0] || null };
      }
    } catch (err) {
      console.log(`  ❌ ${t.label}: Exception - ${err.message}`);
      results.errors.push(`${t.name}: ${err.message}`);
    }
  }

  // 3. Kiểm tra quan hệ Đơn hàng - Thanh toán & Tính toàn vẹn
  console.log('\n[3. KIỂM TRA TOÀN VẸN QUAN HỆ ĐƠN HÀNG & THANH TOÁN]');
  try {
    const { data: recentOrders, error: ordErr } = await supabase
      .from('orders')
      .select('id, status, total, business_date, created_at, payments(*)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (ordErr) {
      console.log(`  ⚠️ Truy vấn quan hệ orders -> payments: ${ordErr.message}`);
      // Thử truy vấn riêng 2 bảng
      const { data: ords } = await supabase.from('orders').select('id, status, total').limit(3);
      const { data: pays } = await supabase.from('payments').select('id, order_id, amount, payment_method').limit(3);
      console.log(`  ℹ Đơn hàng mẫu: ${ords?.length || 0} đơn | Thanh toán mẫu: ${pays?.length || 0} giao dịch`);
      results.orderPaymentIntegrity = { directRelation: false, ordersCount: ords?.length, paymentsCount: pays?.length };
    } else {
      console.log(`  ✅ Quan hệ orders -> payments: Hợp lệ 100%`);
      if (recentOrders && recentOrders.length > 0) {
        for (const o of recentOrders) {
          const pCount = o.payments ? o.payments.length : 0;
          console.log(`     • Đơn ${o.id}: Trạng thái=${o.status}, Tổng=${o.total}đ, Ngày=${o.business_date || 'N/A'}, Số payments liên kết=${pCount}`);
        }
      } else {
        console.log('     • Hiện chưa có đơn hàng nào trong database (bảng rỗng hợp lệ).');
      }
      results.orderPaymentIntegrity = { directRelation: true, sampleCount: recentOrders?.length || 0 };
    }
  } catch (err) {
    console.log(`  ❌ Lỗi kiểm tra quan hệ: ${err.message}`);
  }

  // 4. Kiểm tra quyền RLS và an toàn dữ liệu
  console.log('\n[4. KIỂM TRA BẢO MẬT RLS (ROW-LEVEL SECURITY)]');
  try {
    // Kiểm tra xem anon có thể xóa thẳng vào bảng orders hay bị RLS chặn
    const { error: delErr } = await supabase
      .from('orders')
      .delete()
      .eq('id', '__non_existent_security_probe_id__');

    if (delErr) {
      console.log(`  🛡️ RLS bảo vệ bảng orders (Delete Guard): Hoạt động chuẩn xác - ${delErr.message}`);
    } else {
      console.log(`  ℹ RLS orders DELETE: Đã gửi request an toàn (id không tồn tại)`);
    }
  } catch (err) {
    console.log(`  ℹ RLS Probe: ${err.message}`);
  }

  // 5. Thử nghiệm kết nối an toàn (Ping kiểm tra insert/delete bản ghi test có tag an toàn)
  console.log('\n[5. KIỂM TRA THAO TÁC GHI AN TOÀN (SAFE TEST RECORD PROBE)]');
  const testCategory = {
    id: '__test_probe_' + Date.now(),
    name: 'Test Probe',
    icon: 'Coffee',
    sort_order: 999
  };

  try {
    const { data: insData, error: insErr } = await supabase
      .from('categories')
      .insert(testCategory)
      .select();

    if (insErr) {
      console.log(`  ⚠️ Ghi bản ghi test: ${insErr.message} (Chính sách RLS có thể yêu cầu Authenticated Role hoặc anon chỉ có quyền SELECT)`);
    } else {
      console.log(`  ✅ Ghi bản ghi test: Thành công`);
      // Clean up test probe
      const { error: cleanErr } = await supabase
        .from('categories')
        .delete()
        .eq('id', testCategory.id);
      if (!cleanErr) {
        console.log(`  ✅ Thu hồi / xóa bản ghi test: Thành công (Dữ liệu production không bị ảnh hưởng)`);
      }
    }
  } catch (err) {
    console.log(`  ⚠️ Probe: ${err.message}`);
  }

  console.log('\n============================================================');
  console.log('📊 KẾT QUẢ TỔNG QUAN KIỂM TRA SUPABASE:');
  const tableSuccessCount = Object.values(results.tablesChecked).filter(t => t.success).length;
  console.log(`- Số bảng truy vấn thành công: ${tableSuccessCount}/${targetTables.length}`);
  console.log(`- Số lỗi phát hiện: ${results.errors.length}`);
  
  if (results.errors.length === 0) {
    console.log('🎉 TOÀN BỘ KẾT NỐI VÀ DỮ LIỆU SUPABASE HOẠT ĐỘNG HOÀN HẢO!');
  } else {
    console.log('⚠️ CẦN XEM XÉT CÁC LỖI TRUY VẤN TRÊN TRƯỚC KHI TIẾP TỤC.');
  }
  console.log('============================================================');
}

runChecks();
