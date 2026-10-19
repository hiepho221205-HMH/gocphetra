/**
 * Test Fixtures for GÓC Coffee POS E2E Test Suite
 * Authoritative sample data conforming to PROJECT.md and ORIGINAL_REQUEST.md
 */

export const FIXTURE_STAFF = [
  {
    id: 'staff-01',
    name: 'Trần Mai',
    status: 'active',
    role: 'admin',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z'
  },
  {
    id: 'staff-02',
    name: 'Nguyễn Văn Hùng',
    status: 'active',
    role: 'staff',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z'
  },
  {
    id: 'staff-03',
    name: 'Lê Hoàng Nam',
    status: 'active',
    role: 'staff',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z'
  }
];

export const FIXTURE_SETTINGS = {
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

export const FIXTURE_TABLES = [
  { id: 'B01', name: 'Bàn 01', capacity: 2, status: 'empty', activeOrderId: null },
  { 
    id: 'B02', 
    name: 'Bàn 02', 
    capacity: 4, 
    status: 'occupied', 
    activeOrderId: 'ORD-101',
    customerCount: 3,
    seatedAt: '2026-10-19T02:00:00.000Z'
  },
  { 
    id: 'B03', 
    name: 'Bàn 03', 
    capacity: 4, 
    status: 'occupied', 
    activeOrderId: 'ORD-102',
    customerCount: 2,
    seatedAt: '2026-10-19T02:30:00.000Z'
  },
  { id: 'B04', name: 'Bàn 04', capacity: 6, status: 'empty', activeOrderId: null },
  { id: 'B05', name: 'Bàn 05', capacity: 2, status: 'empty', activeOrderId: null }
];

export const FIXTURE_ACTIVE_ORDERS = {
  'ORD-101': {
    id: 'ORD-101',
    tableId: 'B02',
    tableName: 'Bàn 02',
    status: 'serving',
    customerCount: 3,
    items: [
      { productId: 'prod-1', name: 'Cà phê Phin Đen Đậm Vị', quantity: 2, lineTotal: 56000 },
      { productId: 'prod-2', name: 'Cà phê Phin Sữa Béo Ngậy', quantity: 1, lineTotal: 32000 }
    ],
    total: 88000,
    subtotal: 88000,
    paidAmount: 0,
    remainingAmount: 88000,
    createdAt: '2026-10-19T02:05:00.000Z'
  },
  'ORD-102': {
    id: 'ORD-102',
    tableId: 'B03',
    tableName: 'Bàn 03',
    status: 'awaiting_payment',
    customerCount: 2,
    items: [
      { productId: 'prod-4', name: 'Trà Sữa Oolong Nướng', quantity: 2, lineTotal: 76000 }
    ],
    total: 76000,
    subtotal: 76000,
    paidAmount: 0,
    remainingAmount: 76000,
    createdAt: '2026-10-19T02:35:00.000Z'
  }
};

export const FIXTURE_COMPLETED_ORDERS = [
  {
    id: 'ORD-HIST-01',
    tableId: 'B01',
    tableName: 'Bàn 01',
    status: 'completed',
    cashier: 'Trần Mai',
    customerCount: 2,
    items: [
      { productId: 'prod-1', name: 'Cà phê Phin Đen Đậm Vị', quantity: 2, lineTotal: 56000 }
    ],
    total: 56000,
    subtotal: 56000,
    paidAmount: 56000,
    remainingAmount: 0,
    paymentMethod: 'cash',
    // 2026-10-18 10:00:00 UTC = 2026-10-18 17:00:00 in Vietnam (Date: 2026-10-18)
    createdAt: '2026-10-18T09:30:00.000Z',
    finishedAt: '2026-10-18T10:00:00.000Z'
  },
  {
    id: 'ORD-HIST-02',
    tableId: 'B04',
    tableName: 'Bàn 04',
    status: 'completed',
    cashier: 'Nguyễn Văn Hùng',
    customerCount: 4,
    items: [
      { productId: 'prod-2', name: 'Cà phê Phin Sữa Béo Ngậy', quantity: 3, lineTotal: 96000 },
      { productId: 'prod-3', name: 'Bạc Xỉu Sữa Tươi 3 Tầng', quantity: 1, lineTotal: 35000 }
    ],
    total: 131000,
    subtotal: 131000,
    paidAmount: 131000,
    remainingAmount: 0,
    paymentMethod: 'vietqr',
    // 2026-10-18 14:00:00 UTC = 2026-10-18 21:00:00 in Vietnam (Date: 2026-10-18)
    createdAt: '2026-10-18T13:30:00.000Z',
    finishedAt: '2026-10-18T14:00:00.000Z'
  },
  {
    id: 'ORD-HIST-03',
    tableId: 'B05',
    tableName: 'Bàn 05',
    status: 'completed',
    cashier: 'Lê Hoàng Nam',
    customerCount: 1,
    items: [
      { productId: 'prod-5', name: 'Trà Sen Vàng Kem Cheese', quantity: 1, lineTotal: 45000 }
    ],
    total: 45000,
    subtotal: 45000,
    paidAmount: 45000,
    remainingAmount: 0,
    paymentMethod: 'cash',
    // Boundary test: 2026-10-18 18:30:00 UTC = 2026-10-19 01:30:00 in Vietnam (Date: 2026-10-19!)
    createdAt: '2026-10-18T18:00:00.000Z',
    finishedAt: '2026-10-18T18:30:00.000Z'
  },
  {
    id: 'ORD-HIST-04',
    tableId: 'B01',
    tableName: 'Bàn 01',
    status: 'completed',
    cashier: 'Trần Mai',
    customerCount: 2,
    items: [
      { productId: 'prod-1', name: 'Cà phê Phin Đen Đậm Vị', quantity: 2, lineTotal: 56000 }
    ],
    total: 56000,
    subtotal: 56000,
    paidAmount: 56000,
    remainingAmount: 0,
    paymentMethod: 'cash',
    // Missing finishedAt: uses paid_at fallback (Date: 2026-10-19)
    createdAt: '2026-10-19T02:00:00.000Z',
    paid_at: '2026-10-19T02:30:00.000Z'
  }
];
