import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Read .env and .env.local
function loadEnv() {
  const env = {};
  const paths = [path.resolve('.env'), path.resolve('.env.local')];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim();
          env[k] = v;
        }
      }
    }
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://nbuulvdfxnmfdicbisxq.supabase.co';
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ THIẾU SUPABASE_SERVICE_ROLE_KEY trong file .env.local!');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const TEST_ACCOUNTS = [
  {
    code: 'admin01',
    email: 'admin01@gocpos.vn',
    name: 'Trần Mai',
    role: 'admin',
    phone: '0901234561',
    shiftName: 'Ca Sáng (06:30 - 14:30)',
    notes: 'Quản trị viên hệ thống 01'
  },
  {
    code: 'admin02',
    email: 'admin02@gocpos.vn',
    name: 'Lê Quốc Hưng',
    role: 'admin',
    phone: '0901234562',
    shiftName: 'Ca Chiều (14:30 - 22:30)',
    notes: 'Quản trị viên hệ thống 02'
  },
  {
    code: 'manager01',
    email: 'manager01@gocpos.vn',
    name: 'Nguyễn Văn Hùng',
    role: 'manager',
    phone: '0912345671',
    shiftName: 'Ca Sáng (06:30 - 14:30)',
    notes: 'Cửa hàng trưởng ca sáng'
  },
  {
    code: 'manager02',
    email: 'manager02@gocpos.vn',
    name: 'Phạm Thu Thảo',
    role: 'manager',
    phone: '0912345672',
    shiftName: 'Ca Chiều (14:30 - 22:30)',
    notes: 'Cửa hàng trưởng ca chiều'
  },
  {
    code: 'staff01',
    email: 'staff01@gocpos.vn',
    name: 'Lê Hoàng Nam',
    role: 'staff',
    phone: '0987654321',
    shiftName: 'Ca Sáng (06:30 - 14:30)',
    notes: 'Thu ngân / Pha chế ca sáng'
  },
  {
    code: 'staff02',
    email: 'staff02@gocpos.vn',
    name: 'Đặng Minh Tuấn',
    role: 'staff',
    phone: '0987654322',
    shiftName: 'Ca Chiều (14:30 - 22:30)',
    notes: 'Thu ngân / Pha chế ca chiều'
  },
  {
    code: 'staff03',
    email: 'staff03@gocpos.vn',
    name: 'Võ Thị Quỳnh',
    role: 'staff',
    phone: '0987654323',
    shiftName: 'Ca Tối (17:00 - 23:00)',
    notes: 'Thu ngân / Phục vụ ca tối'
  }
];

// Fixed test password specified by user
const FIXED_PASSWORD = '123456';

async function seedAccounts() {
  console.log('============================================================');
  console.log('🚀 GÓC POS - TẠO VÀ ĐỒNG BỘ 7 TÀI KHOẢN SUPABASE AUTH');
  console.log('============================================================');
  console.log(`- Supabase URL: ${supabaseUrl}`);
  console.log(`- Mật khẩu kiểm thử: [HIDDEN] (Độ dài: ${FIXED_PASSWORD.length} ký tự)\n`);

  // Fetch existing users
  const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    console.error('❌ Lỗi truy vấn danh sách Auth users:', listErr.message);
    process.exit(1);
  }

  const existingUsers = usersData?.users || [];
  const createdReport = [];

  for (const acc of TEST_ACCOUNTS) {
    let authUser = existingUsers.find((u) => u.email.toLowerCase() === acc.email.toLowerCase());
    let actionType = 'created';

    if (authUser) {
      actionType = 'updated';
      console.log(`🔄 Cập nhật tài khoản hiện có: ${acc.email} (ID: ${authUser.id})...`);
      const { data: updateData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        {
          password: FIXED_PASSWORD,
          email_confirm: true,
          user_metadata: {
            name: acc.name,
            role: acc.role,
            phone: acc.phone
          }
        }
      );
      if (updateErr) {
        console.error(`  ❌ Lỗi cập nhật ${acc.email}:`, updateErr.message);
        continue;
      }
      authUser = updateData.user;
    } else {
      console.log(`➕ Tạo tài khoản Auth mới: ${acc.email}...`);
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: acc.email,
        password: FIXED_PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: acc.name,
          role: acc.role,
          phone: acc.phone
        }
      });
      if (createErr) {
        console.error(`  ❌ Lỗi tạo ${acc.email}:`, createErr.message);
        continue;
      }
      authUser = createData.user;
    }

    const userId = authUser.id;

    // 1. Sync public.profiles
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: acc.email,
        name: acc.name,
        role: acc.role,
        phone: acc.phone,
        status: 'active',
        branch_id: 'main',
        is_demo: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (profileErr) {
      console.log(`  ⚠️ Ghi profiles: ${profileErr.message} (Có thể bảng chưa được tạo qua SQL Editor)`);
    } else {
      console.log(`  ✅ Đồng bộ public.profiles thành công.`);
    }

    // 2. Sync public.user_roles
    const { error: roleErr } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: acc.role,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (roleErr) {
      console.log(`  ⚠️ Ghi user_roles: ${roleErr.message}`);
    } else {
      console.log(`  ✅ Đồng bộ public.user_roles: [${acc.role}] thành công.`);
    }

    // 3. Sync public.staff_profiles for compatibility
    const { error: staffErr } = await supabaseAdmin
      .from('staff_profiles')
      .upsert({
        id: userId,
        name: acc.name,
        email: acc.email,
        phone: acc.phone,
        role: acc.role,
        status: 'active',
        branch_id: 'main',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (!staffErr) {
      console.log(`  ✅ Đồng bộ public.staff_profiles thành công.`);
    }

    createdReport.push({
      code: acc.code,
      email: acc.email,
      name: acc.name,
      role: acc.role,
      userId: userId,
      status: 'active',
      action: actionType
    });
  }

  // Write .env.test.credentials securely (ignored by git)
  const credPath = path.resolve('.env.test.credentials');
  const credContent = `# GÓC POS - THÔNG TIN 7 TÀI KHOẢN ĐĂNG NHẬP THỬ NGHIỆM
# Tự động tạo lúc: ${new Date().toISOString()}
# Mật khẩu chung: ${FIXED_PASSWORD}

${createdReport
  .map(
    (r) =>
      `[${r.role.toUpperCase()}] ${r.code}\nEmail: ${r.email}\nMật khẩu: ${FIXED_PASSWORD}\nHọ tên: ${r.name}\nVai trò: ${r.role}\nUser ID: ${r.userId}\n`
  )
  .join('\n')}
`;

  fs.writeFileSync(credPath, credContent, 'utf8');
  console.log(`\n🔒 Đã ghi thông tin tài khoản an toàn vào: .env.test.credentials (nằm trong .gitignore)`);

  console.log('\n============================================================');
  console.log('🎉 TỔNG KẾT KHỞI TẠO 7 TÀI KHOẢN TEST:');
  console.log('============================================================');
  console.table(
    createdReport.map((r) => ({
      Mã: r.code,
      Email: r.email,
      'Họ Tên': r.name,
      'Vai Trò': r.role,
      'Auth User ID': r.userId,
      'Trạng Thái': r.status,
      'Thao tác': r.action
    }))
  );
}

seedAccounts().catch((err) => {
  console.error('❌ Exception khi chạy seedAccounts:', err);
  process.exit(1);
});
