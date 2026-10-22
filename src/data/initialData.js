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
];

// Bảng liên kết topping với món (priceOverride: null = thừa hưởng giá chung, number = giá ghi đè riêng)
export const INITIAL_PRODUCT_TOPPINGS = [
  { productId: 'prod-1', toppingId: 'top-6', priceOverride: null },
  { productId: 'prod-2', toppingId: 'top-1', priceOverride: null },
  { productId: 'prod-2', toppingId: 'top-6', priceOverride: null },
  { productId: 'prod-3', toppingId: 'top-2', priceOverride: 18000 },
  { productId: 'prod-3', toppingId: 'top-6', priceOverride: null },
  { productId: 'prod-4', toppingId: 'top-1', priceOverride: null },
  { productId: 'prod-5', toppingId: 'top-2', priceOverride: null },
  { productId: 'prod-5', toppingId: 'top-5', priceOverride: null },
  { productId: 'prod-7', toppingId: 'top-7', priceOverride: null },
  { productId: 'prod-8', toppingId: 'top-8', priceOverride: null },
];

// Danh mục thực tế (Danh mục 'Tất cả' là danh mục ảo do hệ thống tự sinh trên giao diện)
export const INITIAL_CATEGORIES = [
  { id: 'cat-coffee', name: 'Cà phê', icon: 'Coffee' },
  { id: 'cat-fruit-tea', name: 'Trà quả', icon: 'Citrus' },
  { id: 'cat-milk-tea', name: 'Trà sữa', icon: 'CupSoda' },
  { id: 'cat-freeze', name: 'Đá xay', icon: 'Snowflake' },
  { id: 'cat-juice', name: 'Nước ép', icon: 'GlassWater' },
  { id: 'cat-bakery', name: 'Bánh ngọt', icon: 'Cake' },
];

export const INITIAL_MENU = [
  // Cà phê
  {
    id: 'prod-1',
    code: 'CF01',
    name: 'Cà phê đen đá',
    categoryId: 'cat-coffee',
    basePrice: 25000,
    description: 'Robusta Buôn Ma Thuột đậm đà, thơm nồng đắng dịu',
    toppings: ['top-6'],
    inStock: true
  },
  {
    id: 'prod-2',
    code: 'CF02',
    name: 'Cà phê Sữa đá Sài Gòn',
    categoryId: 'cat-coffee',
    basePrice: 35000,
    description: 'Cà phê rang mộc pha phin hòa cùng sữa đặc béo ngọt',
    toppings: ['top-1', 'top-6'],
    inStock: true
  },

  // Trà quả
  {
    id: 'prod-5',
    code: 'TQ01',
    name: 'Trà Đào Cam Sả',
    categoryId: 'cat-fruit-tea',
    basePrice: 45000,
    description: 'Đào giòn mọng nước, cam vàng thanh mát và hương sả ấm',
    toppings: ['top-3', 'top-8'],
    inStock: true
  },
  // Bánh ngọt
  {
    id: 'prod-14',
    code: 'BN01',
    name: 'Croissant Bơ Pháp Nướng',
    categoryId: 'cat-bakery',
    basePrice: 32000,
    description: 'Bánh sừng bò ngàn lớp thơm nức bơ cao cấp',
    toppings: [],
    inStock: true
  }
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


