export const INITIAL_TABLES = [
  { id: 'B01', name: 'Bàn 01', capacity: 2, status: 'empty', activeOrderId: null },
  { id: 'B02', name: 'Bàn 02', capacity: 4, status: 'empty', activeOrderId: null },
  { id: 'B03', name: 'Bàn 03', capacity: 4, status: 'empty', activeOrderId: null },
  { id: 'B04', name: 'Bàn 04', capacity: 6, status: 'empty', activeOrderId: null },
  { id: 'B05', name: 'Bàn 05', capacity: 2, status: 'empty', activeOrderId: null },
  { id: 'B06', name: 'Bàn 06', capacity: 4, status: 'empty', activeOrderId: null },
  { id: 'B07', name: 'Bàn 07', capacity: 4, status: 'empty', activeOrderId: null },
  { id: 'B08', name: 'Bàn 08', capacity: 6, status: 'empty', activeOrderId: null },
  { id: 'B09', name: 'Bàn 09', capacity: 4, status: 'empty', activeOrderId: null },
  { id: 'B10', name: 'Bàn 10', capacity: 4, status: 'empty', activeOrderId: null },
  { id: 'B11', name: 'Bàn 11', capacity: 8, status: 'empty', activeOrderId: null },
  { id: 'B12', name: 'Bàn 12', capacity: 2, status: 'empty', activeOrderId: null },
];

// Danh mục Topping thông tin chung (isGlobal: true = topping chung cho mọi món, false = topping riêng)
export const INITIAL_TOPPINGS = [
  { id: 'top-1', name: 'Trân châu trắng', price: 10000, inStock: true, isGlobal: true },
  { id: 'top-2', name: 'Kem Cheese béo mặn', price: 15000, inStock: true, isGlobal: true },
  { id: 'top-3', name: 'Thạch nha đam lá dứa', price: 8000, inStock: true, isGlobal: true },
  { id: 'top-4', name: 'Sương sáo thảo mộc', price: 10000, inStock: true, isGlobal: true },
  { id: 'top-5', name: 'Hạt sen Huế ninh đường', price: 12000, inStock: true, isGlobal: false },
  { id: 'top-6', name: 'Thêm 1 Shot Espresso', price: 12000, inStock: true, isGlobal: false },
  { id: 'top-7', name: 'Trái vải thiều ngâm', price: 12000, inStock: true, isGlobal: false },
  { id: 'top-8', name: 'Đào miếng giòn', price: 10000, inStock: true, isGlobal: false },
  { id: 'top-extra-5k', name: 'Topping thêm', price: 5000, inStock: true, isGlobal: true },
];

// Bảng liên kết topping với món (priceOverride: null = thừa hưởng giá chung, number = giá ghi đè riêng)
export const INITIAL_PRODUCT_TOPPINGS = [];

// Danh mục thực tế (Danh mục 'Tất cả' là danh mục ảo do hệ thống tự sinh trên giao diện)
export const INITIAL_CATEGORIES = [
  { id: 'cat-coffee', name: 'Cà phê', icon: 'Coffee' },
  { id: 'cat-milk-tea', name: 'Trà sữa', icon: 'CupSoda' },
  { id: 'cat-latte', name: 'Latte', icon: 'Layers' },
  { id: 'cat-other', name: 'Khác', icon: 'UtensilsCrossed' },
  { id: 'cat-tea', name: 'Trà', icon: 'Citrus' },
  { id: 'cat-juice', name: 'Nước ép', icon: 'GlassWater' },
  { id: 'cat-yogurt', name: 'Sữa chua', icon: 'Snowflake' },
  { id: 'cat-hot-drinks', name: 'Đồ nóng', icon: 'Sparkles' },
];

export const INITIAL_MENU = [
  // CÀ PHÊ
  { id: 'prod-cf01', code: 'CF01', name: 'Cà phê đen', categoryId: 'cat-coffee', basePrice: 14000, description: '', toppings: [], inStock: true },
  { id: 'prod-cf02', code: 'CF02', name: 'Cà phê sữa', categoryId: 'cat-coffee', basePrice: 16000, description: '', toppings: [], inStock: true },
  { id: 'prod-cf03', code: 'CF03', name: 'Espresso nóng / đá', categoryId: 'cat-coffee', basePrice: 15000, description: '', toppings: [], inStock: true },
  { id: 'prod-cf04', code: 'CF04', name: 'Espresso sữa nóng / đá', categoryId: 'cat-coffee', basePrice: 17000, description: '', toppings: [], inStock: true },
  { id: 'prod-cf05', code: 'CF05', name: 'Cà phê kem muối', categoryId: 'cat-coffee', basePrice: 20000, description: '', toppings: [], inStock: true },
  { id: 'prod-cf06', code: 'CF06', name: 'Cà phê kem trứng', categoryId: 'cat-coffee', basePrice: 20000, description: '', toppings: [], inStock: true },
  { id: 'prod-cf07', code: 'CF07', name: 'Phindi hạnh nhân', categoryId: 'cat-coffee', basePrice: 22000, description: '', toppings: [], inStock: true },
  { id: 'prod-cf08', code: 'CF08', name: 'Bạc xỉu', categoryId: 'cat-coffee', basePrice: 20000, description: '', toppings: [], inStock: true },
  { id: 'prod-cf09', code: 'CF09', name: 'Bạc xỉu kem muối', categoryId: 'cat-coffee', basePrice: 22000, description: '', toppings: [], inStock: true },
  { id: 'prod-cf10', code: 'CF10', name: 'Bạc xỉu kem trứng', categoryId: 'cat-coffee', basePrice: 22000, description: '', toppings: [], inStock: true },
  { id: 'prod-cf11', code: 'CF11', name: 'Cacao đá', categoryId: 'cat-coffee', basePrice: 20000, description: '', toppings: [], inStock: true },
  { id: 'prod-cf12', code: 'CF12', name: 'Cacao kem muối', categoryId: 'cat-coffee', basePrice: 23000, description: '', toppings: [], inStock: true },
  { id: 'prod-cf13', code: 'CF13', name: 'Cacao kem trứng', categoryId: 'cat-coffee', basePrice: 23000, description: '', toppings: [], inStock: true },

  // TRÀ SỮA
  { id: 'prod-ts01', code: 'TS01', name: 'Sữa tươi TCĐĐ', categoryId: 'cat-milk-tea', basePrice: 20000, description: '', toppings: [], inStock: true },
  { id: 'prod-ts02', code: 'TS02', name: 'Trà sữa truyền thống', categoryId: 'cat-milk-tea', basePrice: 20000, description: '', toppings: [], inStock: true },
  { id: 'prod-ts03', code: 'TS03', name: 'Trà sữa Thái xanh', categoryId: 'cat-milk-tea', basePrice: 20000, description: '', toppings: [], inStock: true },
  { id: 'prod-ts04', code: 'TS04', name: 'Trà sữa khoai môn', categoryId: 'cat-milk-tea', basePrice: 25000, description: '', toppings: [], inStock: true },
  { id: 'prod-ts05', code: 'TS05', name: 'Trà sữa gạo rang', categoryId: 'cat-milk-tea', basePrice: 25000, description: '', toppings: [], inStock: true },
  { id: 'prod-ts06', code: 'TS06', name: 'Trà sữa ô long', categoryId: 'cat-milk-tea', basePrice: 25000, description: '', toppings: [], inStock: true },
  { id: 'prod-ts07', code: 'TS07', name: 'Trà sữa matcha', categoryId: 'cat-milk-tea', basePrice: 25000, description: '', toppings: [], inStock: true },
  { id: 'prod-ts08', code: 'TS08', name: 'Trà sữa socola', categoryId: 'cat-milk-tea', basePrice: 25000, description: '', toppings: [], inStock: true },
  { id: 'prod-ts09', code: 'TS09', name: 'Trà sữa kem macchiato', categoryId: 'cat-milk-tea', basePrice: 25000, description: '', toppings: [], inStock: true },
  { id: 'prod-ts10', code: 'TS10', name: 'Trà sữa kem trứng cháy', categoryId: 'cat-milk-tea', basePrice: 25000, description: '', toppings: [], inStock: true },

  // LATTE
  { id: 'prod-lt01', code: 'LT01', name: 'Matcha latte', categoryId: 'cat-latte', basePrice: 22000, description: '', toppings: [], inStock: true },
  { id: 'prod-lt02', code: 'LT02', name: 'Matcha latte kem muối', categoryId: 'cat-latte', basePrice: 25000, description: '', toppings: [], inStock: true },
  { id: 'prod-lt03', code: 'LT03', name: 'Khoai môn latte', categoryId: 'cat-latte', basePrice: 25000, description: '', toppings: [], inStock: true },

  // KHÁC
  { id: 'prod-kh01', code: 'KH01', name: 'Nước ngọt (15.000)', categoryId: 'cat-other', basePrice: 15000, description: '', toppings: [], inStock: true },
  { id: 'prod-kh02', code: 'KH02', name: 'Nước ngọt (20.000)', categoryId: 'cat-other', basePrice: 20000, description: '', toppings: [], inStock: true },

  // TRÀ
  { id: 'prod-tr01', code: 'TR01', name: 'Trà chanh trân châu trắng', categoryId: 'cat-tea', basePrice: 18000, description: '', toppings: [], inStock: true },
  { id: 'prod-tr02', code: 'TR02', name: 'Trà trái cây nhiệt đới', categoryId: 'cat-tea', basePrice: 23000, description: '', toppings: [], inStock: true },
  { id: 'prod-tr03', code: 'TR03', name: 'Trà ổi hồng', categoryId: 'cat-tea', basePrice: 23000, description: '', toppings: [], inStock: true },
  { id: 'prod-tr04', code: 'TR04', name: 'Trà xoài chanh dây', categoryId: 'cat-tea', basePrice: 23000, description: '', toppings: [], inStock: true },
  { id: 'prod-tr05', code: 'TR05', name: 'Trà măng cầu', categoryId: 'cat-tea', basePrice: 23000, description: '', toppings: [], inStock: true },
  { id: 'prod-tr06', code: 'TR06', name: 'Trà dưa lưới', categoryId: 'cat-tea', basePrice: 23000, description: '', toppings: [], inStock: true },

  // NƯỚC ÉP
  { id: 'prod-ep01', code: 'EP01', name: 'Cam ép', categoryId: 'cat-juice', basePrice: 20000, description: '', toppings: [], inStock: true },
  { id: 'prod-ep02', code: 'EP02', name: 'Ép cà rốt', categoryId: 'cat-juice', basePrice: 15000, description: '', toppings: [], inStock: true },
  { id: 'prod-ep03', code: 'EP03', name: 'Ép ổi', categoryId: 'cat-juice', basePrice: 15000, description: '', toppings: [], inStock: true },
  { id: 'prod-ep04', code: 'EP04', name: 'Ép thơm', categoryId: 'cat-juice', basePrice: 20000, description: '', toppings: [], inStock: true },
  { id: 'prod-ep05', code: 'EP05', name: 'Ép táo', categoryId: 'cat-juice', basePrice: 20000, description: '', toppings: [], inStock: true },

  // SỮA CHUA
  { id: 'prod-sc01', code: 'SC01', name: 'Sữa chua đá', categoryId: 'cat-yogurt', basePrice: 18000, description: '', toppings: [], inStock: true },
  { id: 'prod-sc02', code: 'SC02', name: 'Sữa chua việt quất', categoryId: 'cat-yogurt', basePrice: 22000, description: '', toppings: [], inStock: true },
  { id: 'prod-sc03', code: 'SC03', name: 'Sữa chua dâu', categoryId: 'cat-yogurt', basePrice: 22000, description: '', toppings: [], inStock: true },
  { id: 'prod-sc04', code: 'SC04', name: 'Sữa chua xoài', categoryId: 'cat-yogurt', basePrice: 22000, description: '', toppings: [], inStock: true },
  { id: 'prod-sc05', code: 'SC05', name: 'Sữa chua dưa lưới', categoryId: 'cat-yogurt', basePrice: 22000, description: '', toppings: [], inStock: true },
  { id: 'prod-sc06', code: 'SC06', name: 'Sữa chua đào', categoryId: 'cat-yogurt', basePrice: 22000, description: '', toppings: [], inStock: true },
  { id: 'prod-sc07', code: 'SC07', name: 'Sữa chua ổi hồng', categoryId: 'cat-yogurt', basePrice: 22000, description: '', toppings: [], inStock: true },

  // ĐỒ NÓNG
  { id: 'prod-dn01', code: 'DN01', name: 'Trà gừng mật ong', categoryId: 'cat-hot-drinks', basePrice: 18000, description: '', toppings: [], inStock: true },
  { id: 'prod-dn02', code: 'DN02', name: 'Trà Lipton', categoryId: 'cat-hot-drinks', basePrice: 22000, description: '', toppings: [], inStock: true }
];

export const INITIAL_ORDERS = {};

export const INITIAL_ORDER_HISTORY = [];

export const INITIAL_SETTINGS = {
  branchName: 'Chi nhánh 01 - Trụ sở chính',
  branchAddress: '124 Nguyễn Du, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
  hotline: '1900 88 99 22',
  wifiPassword: 'goccaphe2026',
  shiftName: 'Ca Sáng (06:30 - 14:30)',
  currentCashier: 'Trần Mai (Mã NV: NV-08)',
  vatPercent: 0,
  surchargePercent: 0,
  autoPrintReceipt: true,
  printNoAccents: false,
  enableVietQR: true,
  receiptPaperWidth: '58mm',
  receiptSettings: {
    showLogo: true,
    showStoreName: true,
    showAddress: true,
    showPhone: true,
    showOrderId: true,
    showTable: true,
    showOrderTime: true,
    showReceiptTime: true,
    showWifi: true,
    showFooter: true
  },
  receiptFooter: 'Cảm ơn quý khách và hẹn gặp lại!',
  wifiOnReceipt: true,
  logoOriginalUrl: '/default-logo.png',
  logoThermalUrl: '/default-logo.png',
  bankAccount: {
    bankCode: 'MB',
    bankName: 'MB Bank (Quân Đội)',
    accountNo: '0988776655',
    accountHolder: 'QUAN CA PHE GOC'
  }
};

// Danh sách nhân viên khởi tạo tối giản (Minimal Staff Roster)
// Tuân thủ nghiêm ngặt nguyên tắc bảo mật tối giản: Chỉ lưu id, name, status, role, createdAt, updatedAt.
// Tuyệt đối không lưu trữ dữ liệu cá nhân (SĐT, email, CCCD, địa chỉ, lương).
export const INITIAL_STAFF = [
  {
    id: 'staff-01',
    name: 'Trần Mai',
    status: 'active',
    role: 'admin',
    email: 'admin@gocpos.vn',
    phone: '0901234567',
    branchId: 'main',
    shiftName: 'Ca Sáng (06:30 - 14:30)',
    notes: 'Quản trị viên hệ thống GÓC POS',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z'
  },
  {
    id: 'staff-02',
    name: 'Nguyễn Văn Hùng',
    status: 'active',
    role: 'manager',
    email: 'manager@gocpos.vn',
    phone: '0912345678',
    branchId: 'main',
    shiftName: 'Ca Chiều (14:30 - 22:30)',
    notes: 'Cửa hàng trưởng ca chiều',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z'
  },
  {
    id: 'staff-03',
    name: 'Lê Hoàng Nam',
    status: 'active',
    role: 'staff',
    email: 'staff@gocpos.vn',
    phone: '0987654321',
    branchId: 'main',
    shiftName: 'Ca Sáng (06:30 - 14:30)',
    notes: 'Thu ngân ca sáng',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z'
  }
];

export const DEMO_ACCOUNTS = {
  admin: {
    id: 'staff-01',
    uid: '00000000-0000-0000-0000-000000000001',
    name: 'Trần Mai',
    email: 'admin@gocpos.vn',
    role: 'admin',
    branchId: 'main',
    avatarUrl: null,
    phone: '0901234567',
    notes: 'Quản trị viên hệ thống GÓC POS',
    isDemo: true
  },
  manager: {
    id: 'staff-02',
    uid: '00000000-0000-0000-0000-000000000002',
    name: 'Nguyễn Văn Hùng',
    email: 'manager@gocpos.vn',
    role: 'manager',
    branchId: 'main',
    avatarUrl: null,
    phone: '0912345678',
    notes: 'Cửa hàng trưởng ca chiều',
    isDemo: true
  },
  staff: {
    id: 'staff-03',
    uid: '00000000-0000-0000-0000-000000000003',
    name: 'Lê Hoàng Nam',
    email: 'staff@gocpos.vn',
    role: 'staff',
    branchId: 'main',
    avatarUrl: null,
    phone: '0987654321',
    notes: 'Thu ngân ca sáng',
    isDemo: true
  }
};

export const INITIAL_USER_PROFILES = {
  'staff-01': {
    id: 'staff-01',
    name: 'Trần Mai',
    role: 'admin',
    avatarUrl: null,
    phone: '0901234567',
    notes: 'Quản trị viên hệ thống GÓC POS'
  },
  'staff-02': {
    id: 'staff-02',
    name: 'Nguyễn Văn Hùng',
    role: 'manager',
    avatarUrl: null,
    phone: '0912345678',
    notes: 'Cửa hàng trưởng ca chiều'
  },
  'staff-03': {
    id: 'staff-03',
    name: 'Lê Hoàng Nam',
    role: 'staff',
    avatarUrl: null,
    phone: '0987654321',
    notes: 'Thu ngân ca sáng'
  }
};


export const INITIAL_AUDIT_LOGS = [
  {
    id: 'audit-001',
    userId: '00000000-0000-0000-0000-000000000001',
    role: 'admin',
    action: 'role_change',
    resource: 'user_roles',
    resourceId: 'staff-02',
    details: {
      targetName: 'Nguyễn Văn Hùng',
      oldRole: 'staff',
      newRole: 'manager',
      note: 'Bổ nhiệm Quản lý ca trực chiều'
    },
    createdAt: '2026-10-19T08:30:00.000Z'
  },
  {
    id: 'audit-002',
    userId: '00000000-0000-0000-0000-000000000001',
    role: 'admin',
    action: 'price_change',
    resource: 'menu_items',
    resourceId: 'prod-1',
    details: {
      productName: 'Cà phê Đen Đá',
      oldPrice: 22000,
      newPrice: 25000
    },
    createdAt: '2026-10-19T14:15:00.000Z'
  }
];


