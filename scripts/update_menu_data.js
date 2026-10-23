import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Read .env and .env.local
function loadEnv() {
  const env = {};
  for (const p of [path.resolve('.env'), path.resolve('.env.local')]) {
    if (fs.existsSync(p)) {
      for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
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
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const CATEGORIES_DATA = [
  { id: 'cat-coffee', name: 'Cà phê', icon: 'Coffee', sort_order: 1 },
  { id: 'cat-milk-tea', name: 'Trà sữa', icon: 'CupSoda', sort_order: 2 },
  { id: 'cat-latte', name: 'Latte', icon: 'Layers', sort_order: 3 },
  { id: 'cat-other', name: 'Khác', icon: 'UtensilsCrossed', sort_order: 4 },
  { id: 'cat-tea', name: 'Trà', icon: 'Citrus', sort_order: 5 },
  { id: 'cat-juice', name: 'Nước ép', icon: 'GlassWater', sort_order: 6 },
  { id: 'cat-yogurt', name: 'Sữa chua', icon: 'Snowflake', sort_order: 7 },
  { id: 'cat-hot-drinks', name: 'Đồ nóng', icon: 'Sparkles', sort_order: 8 }
];

const RAW_MENU_ITEMS = [
  // CÀ PHÊ
  { code: 'CF01', name: 'Cà phê đen', basePrice: 14000, categoryId: 'cat-coffee' },
  { code: 'CF02', name: 'Cà phê sữa', basePrice: 16000, categoryId: 'cat-coffee' },
  { code: 'CF03', name: 'Espresso nóng / đá', basePrice: 15000, categoryId: 'cat-coffee' },
  { code: 'CF04', name: 'Espresso sữa nóng / đá', basePrice: 17000, categoryId: 'cat-coffee' },
  { code: 'CF05', name: 'Cà phê kem muối', basePrice: 20000, categoryId: 'cat-coffee' },
  { code: 'CF06', name: 'Cà phê kem trứng', basePrice: 20000, categoryId: 'cat-coffee' },
  { code: 'CF07', name: 'Phindi hạnh nhân', basePrice: 22000, categoryId: 'cat-coffee' },
  { code: 'CF08', name: 'Bạc xỉu', basePrice: 20000, categoryId: 'cat-coffee' },
  { code: 'CF09', name: 'Bạc xỉu kem muối', basePrice: 22000, categoryId: 'cat-coffee' },
  { code: 'CF10', name: 'Bạc xỉu kem trứng', basePrice: 22000, categoryId: 'cat-coffee' },
  { code: 'CF11', name: 'Cacao đá', basePrice: 20000, categoryId: 'cat-coffee' },
  { code: 'CF12', name: 'Cacao kem muối', basePrice: 23000, categoryId: 'cat-coffee' },
  { code: 'CF13', name: 'Cacao kem trứng', basePrice: 23000, categoryId: 'cat-coffee' },

  // TRÀ SỮA
  { code: 'TS01', name: 'Sữa tươi TCĐĐ', basePrice: 20000, categoryId: 'cat-milk-tea' },
  { code: 'TS02', name: 'Trà sữa truyền thống', basePrice: 20000, categoryId: 'cat-milk-tea' },
  { code: 'TS03', name: 'Trà sữa Thái xanh', basePrice: 20000, categoryId: 'cat-milk-tea' },
  { code: 'TS04', name: 'Trà sữa khoai môn', basePrice: 25000, categoryId: 'cat-milk-tea' },
  { code: 'TS05', name: 'Trà sữa gạo rang', basePrice: 25000, categoryId: 'cat-milk-tea' },
  { code: 'TS06', name: 'Trà sữa ô long', basePrice: 25000, categoryId: 'cat-milk-tea' },
  { code: 'TS07', name: 'Trà sữa matcha', basePrice: 25000, categoryId: 'cat-milk-tea' },
  { code: 'TS08', name: 'Trà sữa socola', basePrice: 25000, categoryId: 'cat-milk-tea' },
  { code: 'TS09', name: 'Trà sữa kem macchiato', basePrice: 25000, categoryId: 'cat-milk-tea' },
  { code: 'TS10', name: 'Trà sữa kem trứng cháy', basePrice: 25000, categoryId: 'cat-milk-tea' },

  // LATTE
  { code: 'LT01', name: 'Matcha latte', basePrice: 22000, categoryId: 'cat-latte' },
  { code: 'LT02', name: 'Matcha latte kem muối', basePrice: 25000, categoryId: 'cat-latte' },
  { code: 'LT03', name: 'Khoai môn latte', basePrice: 25000, categoryId: 'cat-latte' },

  // KHÁC
  { code: 'KH01', name: 'Nước ngọt (15.000)', basePrice: 15000, categoryId: 'cat-other' },
  { code: 'KH02', name: 'Nước ngọt (20.000)', basePrice: 20000, categoryId: 'cat-other' },

  // TRÀ
  { code: 'TR01', name: 'Trà chanh trân châu trắng', basePrice: 18000, categoryId: 'cat-tea' },
  { code: 'TR02', name: 'Trà trái cây nhiệt đới', basePrice: 23000, categoryId: 'cat-tea' },
  { code: 'TR03', name: 'Trà ổi hồng', basePrice: 23000, categoryId: 'cat-tea' },
  { code: 'TR04', name: 'Trà xoài chanh dây', basePrice: 23000, categoryId: 'cat-tea' },
  { code: 'TR05', name: 'Trà măng cầu', basePrice: 23000, categoryId: 'cat-tea' },
  { code: 'TR06', name: 'Trà dưa lưới', basePrice: 23000, categoryId: 'cat-tea' },

  // NƯỚC ÉP
  { code: 'EP01', name: 'Cam ép', basePrice: 20000, categoryId: 'cat-juice' },
  { code: 'EP02', name: 'Ép cà rốt', basePrice: 15000, categoryId: 'cat-juice' },
  { code: 'EP03', name: 'Ép ổi', basePrice: 15000, categoryId: 'cat-juice' },
  { code: 'EP04', name: 'Ép thơm', basePrice: 20000, categoryId: 'cat-juice' },
  { code: 'EP05', name: 'Ép táo', basePrice: 20000, categoryId: 'cat-juice' },

  // SỮA CHUA
  { code: 'SC01', name: 'Sữa chua đá', basePrice: 18000, categoryId: 'cat-yogurt' },
  { code: 'SC02', name: 'Sữa chua việt quất', basePrice: 22000, categoryId: 'cat-yogurt' },
  { code: 'SC03', name: 'Sữa chua dâu', basePrice: 22000, categoryId: 'cat-yogurt' },
  { code: 'SC04', name: 'Sữa chua xoài', basePrice: 22000, categoryId: 'cat-yogurt' },
  { code: 'SC05', name: 'Sữa chua dưa lưới', basePrice: 22000, categoryId: 'cat-yogurt' },
  { code: 'SC06', name: 'Sữa chua đào', basePrice: 22000, categoryId: 'cat-yogurt' },
  { code: 'SC07', name: 'Sữa chua ổi hồng', basePrice: 22000, categoryId: 'cat-yogurt' },

  // ĐỒ NÓNG
  { code: 'DN01', name: 'Trà gừng mật ong', basePrice: 18000, categoryId: 'cat-hot-drinks' },
  { code: 'DN02', name: 'Trà Lipton', basePrice: 22000, categoryId: 'cat-hot-drinks' }
];

async function run() {
  console.log('====================================================');
  console.log('BẮT ĐẦU CẬP NHẬT MENU VÀO CƠ SỞ DỮ LIỆU SUPABASE');
  console.log('====================================================');

  // 1. Categories
  console.log('\n[1/3] Cập nhật các danh mục món (Categories)...');
  for (const cat of CATEGORIES_DATA) {
    const { error } = await supabase.from('categories').upsert(cat, { onConflict: 'id' });
    if (error) {
      console.error(`- Lỗi danh mục ${cat.name}:`, error.message);
    } else {
      console.log(`- Đã cập nhật danh mục: [${cat.id}] ${cat.name}`);
    }
  }

  // 2. Menu Items
  console.log('\n[2/3] Kiểm tra và nạp danh sách món vào menu_items...');
  const { data: existingItems, error: fetchErr } = await supabase.from('menu_items').select('*');
  if (fetchErr) {
    console.error('Lỗi khi truy vấn menu_items hiện có:', fetchErr.message);
    process.exit(1);
  }

  const existingMap = new Map();
  (existingItems || []).forEach(item => {
    existingMap.set(item.name.toLowerCase().trim(), item);
  });
  console.log(`- Số món hiện có trong DB trước khi nạp: ${existingItems?.length || 0}`);

  const itemsToInsert = [];
  let addedCount = 0;
  let skippedCount = 0;
  const skippedList = [];

  for (const item of RAW_MENU_ITEMS) {
    const normalizedName = item.name.toLowerCase().trim();
    if (existingMap.has(normalizedName)) {
      skippedCount++;
      skippedList.push(item.name);
      console.log(`  [TRÙNG LẶP - BỎ QUA] ${item.name} (${item.basePrice.toLocaleString('vi-VN')} đ)`);
    } else {
      itemsToInsert.push({
        id: 'prod-' + item.code.toLowerCase(),
        code: item.code,
        name: item.name,
        category_id: item.categoryId,
        base_price: item.basePrice,
        description: '',
        toppings: [],
        in_stock: true
      });
      addedCount++;
    }
  }

  if (itemsToInsert.length > 0) {
    const { error: insertErr } = await supabase.from('menu_items').insert(itemsToInsert);
    if (insertErr) {
      console.error('Lỗi khi insert vào menu_items:', insertErr.message);
      process.exit(1);
    }
    console.log(`- Đã thêm ${itemsToInsert.length} món mới vào cơ sở dữ liệu.`);
  }

  // 3. Topping
  console.log('\n[3/3] Kiểm tra bảng Toppings cho "Topping thêm"...');
  const { data: existingToppings, error: topFetchErr } = await supabase.from('toppings').select('*');
  if (topFetchErr) {
    console.warn('Lỗi khi đọc bảng toppings:', topFetchErr.message);
  } else {
    const hasToppingThem = (existingToppings || []).some(
      t => t.name.toLowerCase().trim() === 'topping thêm'
    );
    if (!hasToppingThem) {
      const { error: insertTopErr } = await supabase.from('toppings').insert({
        id: 'top-extra-5k',
        name: 'Topping thêm',
        price: 5000,
        in_stock: true,
        is_global: true
      });
      if (insertTopErr) {
        console.error('Lỗi khi thêm Topping thêm:', insertTopErr.message);
      } else {
        console.log('- Đã thêm "Topping thêm" — 5.000 VNĐ vào bảng toppings.');
      }
    } else {
      console.log('- "Topping thêm" đã tồn tại trong bảng toppings, bỏ qua.');
    }
  }

  // 4. Verification & Audit
  console.log('\n[4/4] Kiểm tra toàn bộ dữ liệu sau khi nạp...');
  const { data: finalItems, error: verifyErr } = await supabase
    .from('menu_items')
    .select('code, name, base_price, category_id')
    .order('code', { ascending: true });

  if (verifyErr) {
    console.error('Lỗi khi kiểm tra kết quả:', verifyErr.message);
    process.exit(1);
  }

  console.log(`\n================ KẾT QUẢ KIỂM TRA ================`);
  console.log(`Tổng số món hiện tại trong menu_items: ${finalItems.length}`);
  console.log(`Số món mới thêm thành công: ${addedCount}`);
  console.log(`Số món bị bỏ qua do trùng lặp: ${skippedCount}`);
  if (skippedList.length > 0) {
    console.log(`Danh sách món bị bỏ qua:`, skippedList);
  }
  console.log('Chi tiết các món vừa nạp trong DB:');
  finalItems.forEach(i => {
    console.log(`  [${i.code}] ${i.name.padEnd(30, ' ')} ${Number(i.base_price).toLocaleString('vi-VN')} VNĐ (Nhóm: ${i.category_id})`);
  });
}

run();
