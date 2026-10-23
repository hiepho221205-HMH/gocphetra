import { reconcileTablesAndOrders } from '../src/utils/reconciler.js';
import { mapOrderToBaseDb, mapTableToDb, mapOrderFromDb, mapTableFromDb } from '../src/lib/supabase.js';

console.log('============================================================');
console.log('🧪 TEST AUTOMATION: KIỂM TRA QUY TRÌNH THANH TOÁN & HÒA GIẢI');
console.log('============================================================');

// 1. Initial State: Bàn 02 đang trống
const initialTables = [
  { id: 'B01', name: 'Bàn 01', status: 'empty', activeOrderId: null, customerCount: 0 },
  { id: 'B02', name: 'Bàn 02', status: 'empty', activeOrderId: null, customerCount: 0 }
];
const initialOrders = {};
const initialHistory = [];

console.log('\n[BƯỚC 1: TẠO ĐƠN & GỌI MÓN BÀN 02]');
const newOrderId = 'ORD-TEST-999999';
const activeOrder = {
  id: newOrderId,
  tableId: 'B02',
  tableName: 'Bàn 02',
  status: 'serving',
  customerCount: 2,
  items: [
    { id: 'prod-cf01', name: 'Cà phê đen', quantity: 2, basePrice: 14000, lineTotal: 28000 },
    { id: 'prod-ts01', name: 'Sữa tươi TCĐĐ', quantity: 1, basePrice: 20000, lineTotal: 20000 }
  ],
  total: 48000,
  paidAmount: 0,
  remainingAmount: 48000,
  createdAt: new Date().toISOString()
};

const occupiedTables = initialTables.map(t => 
  t.id === 'B02' ? { ...t, status: 'occupied', activeOrderId: newOrderId, customerCount: 2 } : t
);
const currentOrders = { [newOrderId]: activeOrder };

// Test mapping to DB
const dbOrder = mapOrderToBaseDb(activeOrder);
const dbTable = mapTableToDb(occupiedTables.find(t => t.id === 'B02'));
console.log('  ✅ Payload ghi nhận đơn đang phục vụ:', { id: dbOrder.id, status: dbOrder.status, total: dbOrder.total });
console.log('  ✅ Payload trạng thái bàn có khách:', { id: dbTable.id, status: dbTable.status, active_order_id: dbTable.active_order_id });

console.log('\n[BƯỚC 2: THANH TOÁN & GIẢI PHÓNG BÀN (FINALIZE ORDER)]');
const finishedAt = new Date().toISOString();
const completedOrder = {
  ...activeOrder,
  status: 'completed',
  paidAmount: 48000,
  remainingAmount: 0,
  paymentMethod: 'cash',
  finishedAt
};

// 1. Tables reset
const freedTables = occupiedTables.map(t => 
  t.id === 'B02' ? { ...t, status: 'empty', activeOrderId: null, customerCount: 0 } : t
);

// 2. Orders deleted from active
const nextOrders = { ...currentOrders };
delete nextOrders[newOrderId];

// 3. Order History prepended
const nextHistory = [completedOrder, ...initialHistory];

console.log('  ✅ Sau thanh toán:');
console.log('     - Bàn 02 status:', freedTables.find(t => t.id === 'B02').status);
console.log('     - Active orders count:', Object.keys(nextOrders).length);
console.log('     - History orders count:', nextHistory.length);

console.log('\n[BƯỚC 3: GIẢ LẬP F5 / RELOAD VÀ KIỂM TRA HÒA GIẢI (RECONCILER)]');
// Giả lập đọc từ storage sau reload
const reconciliationResult = reconcileTablesAndOrders(freedTables, nextOrders, nextHistory);
const reloadedB02 = reconciliationResult.reconciledTables.find(t => t.id === 'B02');
const reloadedActiveOrder = reconciliationResult.reconciledOrders[newOrderId];
const reloadedHistoryOrder = reconciliationResult.reconciledHistory.find(o => o.id === newOrderId);

console.log('  - Trạng thái Bàn 02 sau F5:', reloadedB02.status);
console.log('  - Active order có bị hồi sinh không?:', Boolean(reloadedActiveOrder));
console.log('  - Đơn có nằm trong lịch sử doanh thu?:', Boolean(reloadedHistoryOrder && reloadedHistoryOrder.status === 'completed'));

if (reloadedB02.status === 'empty' && !reloadedActiveOrder && reloadedHistoryOrder) {
  console.log('\n🎉 TEST PASSED: Bàn được giải phóng hoàn toàn, không bị hồi sinh, doanh thu được lưu trữ chuẩn xác!');
} else {
  console.error('\n❌ TEST FAILED: Kiểm tra lại logic hòa giải hoặc thanh toán!');
  process.exit(1);
}
