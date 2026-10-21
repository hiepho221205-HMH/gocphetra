export const INITIAL_TABLES = [
  { id: 'B01', name: 'Bàn 01', capacity: 2, status: 'empty', activeOrderId: null },
  { 
    id: 'B02', 
    name: 'Bàn 02', 
    capacity: 4, 
    status: 'occupied', 
    activeOrderId: 'ORD-101',
    customerCount: 3,
    seatedAt: new Date(Date.now() - 35 * 60000).toISOString()
  },
  { 
    id: 'B03', 
    name: 'Bàn 03', 
    capacity: 4, 
    status: 'occupied', 
    activeOrderId: 'ORD-102',
    customerCount: 2,
    seatedAt: new Date(Date.now() - 55 * 60000).toISOString()
  },
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
  {
    id: 'prod-3',
    code: 'CF03',
    name: 'Cà phê Muối Cố Đô',
    categoryId: 'cat-coffee',
    basePrice: 42000,
    description: 'Vị đắng đầm hòa cùng lớp kem sữa mặn béo ngậy đặc trưng',
    toppings: ['top-2', 'top-6'],
    inStock: true
  },
  {
    id: 'prod-4',
    code: 'CF04',
    name: 'Bạc Xỉu 3 Tầng',
    categoryId: 'cat-coffee',
    basePrice: 38000,
    description: 'Sữa tươi thanh trùng, sữa đặc dịu ngọt và chút espresso',
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
  {
    id: 'prod-6',
    code: 'TQ02',
    name: 'Trà Vải Hoa Hồng',
    categoryId: 'cat-fruit-tea',
    basePrice: 45000,
    description: 'Hương hoa hồng dịu mát quyện vải thiều ngọt lịm',
    toppings: ['top-7', 'top-3'],
    inStock: true
  },
  {
    id: 'prod-7',
    code: 'TQ03',
    name: 'Trà Mãng Cầu Tươi',
    categoryId: 'cat-fruit-tea',
    basePrice: 48000,
    description: 'Mãng cầu xiêm dầm chua ngọt thanh mát',
    toppings: ['top-1'],
    inStock: false
  },

  // Trà sữa
  {
    id: 'prod-8',
    code: 'TS01',
    name: 'Matcha Latte Cheese',
    categoryId: 'cat-milk-tea',
    basePrice: 45000,
    description: 'Trà xanh Uji thơm ngát phủ lớp kem phô mai béo mịn',
    toppings: ['top-1', 'top-2'],
    inStock: true
  },
  {
    id: 'prod-9',
    code: 'TS02',
    name: 'Trà Sữa Ô Long Nướng',
    categoryId: 'cat-milk-tea',
    basePrice: 42000,
    description: 'Vị trà ô long nướng đậm đà cùng sữa tươi béo thơm',
    toppings: ['top-1', 'top-4'],
    inStock: true
  },

  // Đá xay
  {
    id: 'prod-10',
    code: 'DX01',
    name: 'Matcha Đá Xay Kem Tuyết',
    categoryId: 'cat-freeze',
    basePrice: 55000,
    description: 'Bột trà xanh Nhật Bản xay tuyết mịn cùng bông kem',
    toppings: ['top-1'],
    inStock: true
  },
  {
    id: 'prod-11',
    code: 'DX02',
    name: 'Cà phê Cốt Dừa Đá Xay',
    categoryId: 'cat-freeze',
    basePrice: 52000,
    description: 'Cốt dừa Bến Tre xay mát lạnh cùng shot espresso',
    toppings: ['top-6'],
    inStock: true
  },

  // Nước ép
  {
    id: 'prod-12',
    code: 'NE01',
    name: 'Nước Ép Dưa Hấu Bạc Hà',
    categoryId: 'cat-juice',
    basePrice: 40000,
    description: 'Dưa hấu tươi ép nguyên chất cùng lá bạc hà the mát',
    toppings: ['top-3'],
    inStock: true
  },
  {
    id: 'prod-13',
    code: 'NE02',
    name: 'Nước Ép Cam Tươi Nguyên Chất',
    categoryId: 'cat-juice',
    basePrice: 42000,
    description: 'Cam sành tươi mọng nước, giàu vitamin C tự nhiên',
    toppings: [],
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
  },
  {
    id: 'prod-15',
    code: 'BN02',
    name: 'Tiramisu Cacao Đậm Vị',
    categoryId: 'cat-bakery',
    basePrice: 45000,
    description: 'Bánh Ý phô mai Mascarpone và cà phê nồng nàn',
    toppings: [],
    inStock: true
  }
];

export const INITIAL_ORDERS = {
  'ORD-101': {
    id: 'ORD-101',
    tableId: 'B02',
    tableName: 'Bàn 02',
    status: 'serving',
    createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
    cashier: 'Trần Mai',
    customerCount: 3,
    items: [
      {
        cartItemId: 'item-1',
        productId: 'prod-2',
        name: 'Cà phê Sữa đá Sài Gòn',
        size: 'L',
        sizeName: 'Lớn (L)',
        basePrice: 35000,
        sizePrice: 0,
        unitPrice: 47000,
        quantity: 2,
        toppings: [{ id: 'top-1', name: 'Trân châu trắng', price: 10000, quantity: 1 }],
        notes: 'Ít đường, nhiều đá',
        lineTotal: 94000
      },
      {
        cartItemId: 'item-2',
        productId: 'prod-8',
        name: 'Matcha Latte Cheese',
        size: 'M',
        sizeName: 'Vừa (M)',
        basePrice: 45000,
        sizePrice: 0,
        unitPrice: 60000,
        quantity: 1,
        toppings: [{ id: 'top-2', name: 'Kem Cheese béo mặn', price: 15000, quantity: 1 }],
        notes: '70% đường',
        lineTotal: 60000
      }
    ],
    discountPercent: 0,
    surcharge: 0,
    subtotal: 154000,
    total: 154000,
    paidAmount: 0,
    remainingAmount: 154000,
    splitPayments: []
  },
  'ORD-102': {
    id: 'ORD-102',
    tableId: 'B03',
    tableName: 'Bàn 03',
    status: 'serving',
    createdAt: new Date(Date.now() - 55 * 60000).toISOString(),
    cashier: 'Nguyễn Văn Hùng',
    customerCount: 2,
    items: [
      {
        cartItemId: 'item-3',
        productId: 'prod-3',
        name: 'Cà phê Muối Cố Đô',
        size: 'M',
        sizeName: 'Vừa (M)',
        basePrice: 42000,
        sizePrice: 0,
        unitPrice: 42000,
        quantity: 1,
        toppings: [],
        notes: '',
        lineTotal: 42000
      }
    ],
    discountPercent: 0,
    surcharge: 0,
    subtotal: 42000,
    total: 42000,
    paidAmount: 0,
    remainingAmount: 42000,
    splitPayments: []
  }
};

export const INITIAL_ORDER_HISTORY = [
  {
    id: 'ORD-099',
    tableId: 'B01',
    tableName: 'Bàn 01',
    status: 'completed',
    createdAt: new Date(Date.now() - 150 * 60000).toISOString(),
    finishedAt: new Date(Date.now() - 110 * 60000).toISOString(),
    cashier: 'Trần Mai',
    customerCount: 2,
    paymentMethod: 'cash',
    items: [
      {
        cartItemId: 'hist-1',
        productId: 'prod-1',
        name: 'Cà phê Phin Đen Đậm Vị',
        size: 'M',
        sizeName: 'Vừa (M)',
        basePrice: 28000,
        unitPrice: 28000,
        quantity: 2,
        toppings: [],
        notes: 'Ít đường',
        lineTotal: 56000
      },
      {
        cartItemId: 'hist-2',
        productId: 'prod-14',
        name: 'Croissant Bơ Pháp Nướng',
        size: 'Standard',
        sizeName: 'Tiêu chuẩn',
        basePrice: 32000,
        unitPrice: 32000,
        quantity: 1,
        toppings: [],
        notes: 'Hâm nóng giòn',
        lineTotal: 32000
      }
    ],
    discountPercent: 0,
    surcharge: 0,
    subtotal: 88000,
    total: 88000,
    paidAmount: 88000,
    remainingAmount: 0,
    splitPayments: [
      {
        method: 'cash',
        amount: 88000,
        note: 'Thanh toán tiền mặt',
        timestamp: new Date(Date.now() - 110 * 60000).toISOString(),
        paymentId: 'PAY-HIST-1'
      }
    ]
  },
  {
    id: 'ORD-100',
    tableId: 'B04',
    tableName: 'Bàn 04',
    status: 'completed',
    createdAt: new Date(Date.now() - 95 * 60000).toISOString(),
    finishedAt: new Date(Date.now() - 50 * 60000).toISOString(),
    cashier: 'Nguyễn Văn Hùng',
    customerCount: 3,
    paymentMethod: 'vietqr',
    items: [
      {
        cartItemId: 'hist-3',
        productId: 'prod-6',
        name: 'Trà Đào Cam Sả Tươi Mát',
        size: 'L',
        sizeName: 'Lớn (L)',
        basePrice: 42000,
        unitPrice: 48000,
        quantity: 2,
        toppings: [
          { id: 'top-1', name: 'Trân châu trắng giòn', price: 6000, quantity: 1 }
        ],
        notes: '70% ngọt, bình thường',
        lineTotal: 96000
      },
      {
        cartItemId: 'hist-4',
        productId: 'prod-10',
        name: 'Matcha Đá Xay Kem Tuyết',
        size: 'M',
        sizeName: 'Vừa (M)',
        basePrice: 50000,
        unitPrice: 50000,
        quantity: 1,
        toppings: [],
        notes: 'Ít kem béo',
        lineTotal: 50000
      }
    ],
    discountPercent: 0,
    surcharge: 0,
    subtotal: 146000,
    total: 146000,
    paidAmount: 146000,
    remainingAmount: 0,
    splitPayments: [
      {
        method: 'vietqr',
        amount: 146000,
        note: 'Thanh toán VietQR MB Bank',
        timestamp: new Date(Date.now() - 50 * 60000).toISOString(),
        paymentId: 'PAY-HIST-2'
      }
    ]
  },
  {
    id: 'ORD-098',
    tableId: 'B03',
    tableName: 'Bàn 03',
    status: 'completed',
    createdAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    finishedAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    cashier: 'Nguyễn Văn Hùng',
    customerCount: 2,
    paymentMethod: 'cash',
    items: [
      {
        cartItemId: 'hist-5',
        productId: 'prod-3',
        name: 'Cà phê Muối Cố Đô',
        size: 'M',
        sizeName: 'Vừa (M)',
        basePrice: 42000,
        unitPrice: 42000,
        quantity: 2,
        toppings: [],
        notes: 'Kem muối béo riêng',
        lineTotal: 84000
      }
    ],
    discountPercent: 0,
    surcharge: 0,
    subtotal: 84000,
    total: 84000,
    paidAmount: 84000,
    remainingAmount: 0,
    splitPayments: [
      {
        method: 'cash',
        amount: 84000,
        note: 'Thanh toán tiền mặt',
        timestamp: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
        paymentId: 'PAY-HIST-0'
      }
    ]
  }
];

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


