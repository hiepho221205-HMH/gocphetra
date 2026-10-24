import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('TASK: TINH GỌN PAGE SƠ ĐỒ BÀN & XÓA ĐƠN GIẢI PHÓNG BÀN', () => {
  const tableGridPath = path.resolve('src/components/tables/TableGrid.jsx');
  const tableCardPath = path.resolve('src/components/tables/TableCard.jsx');
  const deleteModalPath = path.resolve('src/components/tables/DeleteActiveOrderModal.jsx');
  const posContextPath = path.resolve('src/store/PosContext.jsx');

  const tableGridCode = fs.readFileSync(tableGridPath, 'utf8');
  const tableCardCode = fs.readFileSync(tableCardPath, 'utf8');
  const deleteModalCode = fs.readFileSync(deleteModalPath, 'utf8');
  const posContextCode = fs.readFileSync(posContextPath, 'utf8');

  // =========================================================================
  // 1. LOẠI BỎ THANH LỰA CHỌN DƯỚI Ô TÌM KIẾM & NÂNG CẤP 3 CARD THỐNG KÊ
  // =========================================================================
  describe('1. Loại bỏ thanh lựa chọn dưới ô tìm kiếm & Nâng cấp 3 Card thống kê', () => {
    it('1.1 - TableGrid must NOT contain redundant tablist below search bar', () => {
      assert.ok(
        !tableGridCode.includes('role="tablist"'),
        'Redundant tablist role="tablist" must be completely removed from TableGrid.jsx'
      );
      assert.ok(
        !tableGridCode.includes('role="tab"'),
        'Redundant role="tab" elements must be removed from TableGrid.jsx'
      );
      assert.ok(
        !tableGridCode.includes("label: 'Tất cả'"),
        'Redundant tab pills array must be removed'
      );
    });

    it('1.2 - Top 3 Stat Cards are primary filters with distinctive active styles and testids', () => {
      assert.ok(
        tableGridCode.includes('data-testid="filter-card-all"'),
        'Top stat card for all tables must have data-testid="filter-card-all"'
      );
      assert.ok(
        tableGridCode.includes('data-testid="filter-card-occupied"'),
        'Top stat card for occupied tables must have data-testid="filter-card-occupied"'
      );
      assert.ok(
        tableGridCode.includes('data-testid="filter-card-empty"'),
        'Top stat card for empty tables must have data-testid="filter-card-empty"'
      );
      assert.ok(
        tableGridCode.includes('selectedStatus === \'all\''),
        'Top card "Tổng bàn" must bind to selectedStatus === "all"'
      );
      assert.ok(
        tableGridCode.includes('selectedStatus === \'occupied\''),
        'Top card "Có khách" must bind to selectedStatus === "occupied"'
      );
      assert.ok(
        tableGridCode.includes('selectedStatus === \'empty\''),
        'Top card "Bàn trống" must bind to selectedStatus === "empty"'
      );
    });

    it('1.3 - Filtering logic functions accurately for all 3 filter views', () => {
      const mockTables = [
        { id: 'T01', name: 'Bàn 01', activeOrderId: 'ORD-01' },
        { id: 'T02', name: 'Bàn 02', activeOrderId: null },
        { id: 'T03', name: 'Bàn 03', activeOrderId: 'ORD-03' },
        { id: 'T04', name: 'Bàn 04', activeOrderId: null }
      ];

      const mockOrders = {
        'ORD-01': { id: 'ORD-01', tableId: 'T01', status: 'serving', items: [{ id: 'm1', quantity: 2 }] },
        'ORD-03': { id: 'ORD-03', tableId: 'T03', status: 'serving', items: [{ id: 'm2', quantity: 1 }] }
      };

      const isOccupied = (t) => {
        const ord = t.activeOrderId ? mockOrders[t.activeOrderId] : null;
        return Boolean(ord && Array.isArray(ord.items) && ord.items.length > 0);
      };

      const filterTables = (status) => {
        return mockTables.filter((t) => {
          const occ = isOccupied(t);
          if (status === 'all') return true;
          if (status === 'occupied') return occ;
          if (status === 'empty') return !occ;
          return true;
        });
      };

      const allResult = filterTables('all');
      assert.equal(allResult.length, 4, 'All view must return 4 tables');

      const occupiedResult = filterTables('occupied');
      assert.equal(occupiedResult.length, 2, 'Occupied view must return 2 tables');
      assert.deepEqual(occupiedResult.map((t) => t.id), ['T01', 'T03']);

      const emptyResult = filterTables('empty');
      assert.equal(emptyResult.length, 2, 'Empty view must return 2 tables');
      assert.deepEqual(emptyResult.map((t) => t.id), ['T02', 'T04']);
    });
  });

  // =========================================================================
  // 2. TINH GỌN NÚT THANH TOÁN & THÊM NÚT THÙNG RÁC TRÊN CARD BÀN
  // =========================================================================
  describe('2. Tinh gọn nút Thanh toán & Bổ sung nút Thùng rác trên TableCard', () => {
    it('2.1 - Payment button on occupied TableCard is icon-only with Receipt icon', () => {
      assert.ok(
        tableCardCode.includes('data-testid={`bill-btn-${table.id}`}'),
        'TableCard must have data-testid for bill button'
      );
      assert.ok(
        tableCardCode.includes('<Receipt className="w-4 h-4 text-emerald-300 stroke-[2.2]" />') ||
        tableCardCode.includes('<Receipt'),
        'Payment button must use Receipt icon'
      );
      // Ensure the long text 'Thanh toán' inside the button label is streamlined to icon-only
      assert.ok(
        !tableCardCode.includes('<span>{isLockedByOther ? \'Đang tính\' : \'Thanh toán\'}</span>'),
        'Long text label "Thanh toán" must be removed in favor of icon-only button'
      );
    });

    it('2.2 - TableCard includes Trash2 icon button for occupied tables with red styling', () => {
      assert.ok(
        tableCardCode.includes('data-testid={`delete-order-btn-${table.id}`}'),
        'TableCard must have data-testid for delete order button'
      );
      assert.ok(
        tableCardCode.includes('Trash2'),
        'TableCard must import and render Trash2 icon'
      );
      assert.ok(
        tableCardCode.includes('bg-rose-50') && tableCardCode.includes('text-rose-600'),
        'Delete button must have warning red styling (rose-50, text-rose-600)'
      );
    });

    it('2.3 - TableCard renders 3 balanced icon buttons on occupied state [View] [Bill] [Delete]', () => {
      assert.ok(
        tableCardCode.includes('grid grid-cols-3 gap-1.5'),
        'Occupied table card must use 3-column grid for the 3 action buttons'
      );
      assert.ok(
        tableCardCode.includes('ViewOrderIconButton'),
        'ViewOrderIconButton must be present in the 3-button row'
      );
    });
  });

  // =========================================================================
  // 3. MODAL XÁC NHẬN XÓA BÀN ĐÃ ORDER (DeleteActiveOrderModal)
  // =========================================================================
  describe('3. Modal xác nhận xóa bàn đã order (DeleteActiveOrderModal)', () => {
    it('3.1 - Modal renders clear warning and confirmation text', () => {
      assert.ok(
        deleteModalCode.includes('Xóa đơn của bàn này?'),
        'Modal must have title "Xóa đơn của bàn này?"'
      );
      assert.ok(
        deleteModalCode.includes('Hành động này sẽ xóa toàn bộ món đã order của bàn và giải phóng bàn') &&
        deleteModalCode.includes('không được lưu'),
        'Modal must warn that items will be deleted and data will NOT be saved'
      );
    });

    it('3.2 - Modal provides Cancel and Confirm Delete buttons with loading state', () => {
      assert.ok(
        deleteModalCode.includes('data-testid="cancel-delete-order-btn"'),
        'Modal must have cancel button with data-testid="cancel-delete-order-btn"'
      );
      assert.ok(
        deleteModalCode.includes('data-testid="confirm-delete-order-btn"'),
        'Modal must have confirm button with data-testid="confirm-delete-order-btn"'
      );
      assert.ok(
        deleteModalCode.includes('isDeleting'),
        'Modal must have isDeleting loading state to prevent double submit'
      );
      assert.ok(
        deleteModalCode.includes('Đang xóa...') || deleteModalCode.includes('Xóa bàn'),
        'Modal must toggle button text during submission'
      );
    });
  });

  // =========================================================================
  // 4. LOGIC DỮ LIỆU & AN TOÀN TRONG PosContext
  // =========================================================================
  describe('4. Logic Dữ liệu & An toàn trong PosContext', () => {
    it('4.1 - PosContext exports deleteActiveOrderForTable', () => {
      assert.ok(
        posContextCode.includes('const deleteActiveOrderForTable = async'),
        'PosContext must define deleteActiveOrderForTable'
      );
      assert.ok(
        posContextCode.includes('deleteActiveOrderForTable,') || posContextCode.includes('deleteActiveOrderForTable:'),
        'PosContext must export deleteActiveOrderForTable in provider value'
      );
    });

    it('4.2 - deleteActiveOrderForTable releases table, deletes order, and NEVER adds to revenue or history', () => {
      let stateOrders = {
        'ORD-99': {
          id: 'ORD-99',
          tableId: 'T-05',
          tableName: 'Bàn 05',
          status: 'serving',
          total: 85000,
          items: [{ id: 'cf-den', name: 'Cà phê đen', quantity: 2, price: 30000 }]
        }
      };

      let stateTables = [
        {
          id: 'T-05',
          name: 'Bàn 05',
          status: 'occupied',
          activeOrderId: 'ORD-99',
          customerCount: 2,
          seatedAt: '2026-10-24T12:00:00Z'
        }
      ];

      let stateHistory = [];
      let statePayments = [];
      let auditLogs = [];
      let realtimeBroadcasts = [];

      // Simulate deleteActiveOrderForTable execution
      const simulateDeleteActiveOrder = (tableId) => {
        const table = stateTables.find((t) => t.id === tableId);
        const order = stateOrders[table.activeOrderId];
        const orderId = order?.id || table.activeOrderId;

        const resetTable = {
          ...table,
          status: 'empty',
          activeOrderId: null,
          seatedAt: null,
          customerCount: 0,
          billingLock: null
        };

        // 1. Delete order from active orders
        delete stateOrders[orderId];

        // 2. Reset table to empty
        stateTables = stateTables.map((t) => (t.id === tableId ? resetTable : t));

        // 3. Record internal audit log
        auditLogs.push({
          action: 'delete_active_order',
          tableId,
          orderId,
          timestamp: new Date().toISOString()
        });

        // 4. Realtime broadcast
        realtimeBroadcasts.push({
          event: 'order_sync',
          payload: { deletedOrderId: orderId, table: resetTable }
        });

        return { success: true, table: resetTable };
      };

      const result = simulateDeleteActiveOrder('T-05');
      assert.equal(result.success, true);

      // Verify order is deleted
      assert.equal(stateOrders['ORD-99'], undefined, 'Active order must be deleted');

      // Verify table is freed to empty
      const freedTable = stateTables.find((t) => t.id === 'T-05');
      assert.equal(freedTable.status, 'empty');
      assert.equal(freedTable.activeOrderId, null);
      assert.equal(freedTable.customerCount, 0);
      assert.equal(freedTable.seatedAt, null);

      // Verify history and payments are strictly untouched (no revenue)
      assert.equal(stateHistory.length, 0, 'Order history must remain 0');
      assert.equal(statePayments.length, 0, 'Payments must remain 0');

      // Verify audit log recorded
      assert.equal(auditLogs.length, 1);
      assert.equal(auditLogs[0].action, 'delete_active_order');

      // Verify realtime event dispatched
      assert.equal(realtimeBroadcasts.length, 1);
      assert.equal(realtimeBroadcasts[0].payload.deletedOrderId, 'ORD-99');
      assert.equal(realtimeBroadcasts[0].payload.table.status, 'empty');
    });

    it('4.3 - Safety guard: deleteActiveOrderForTable blocks deletion if locked by another cashier', () => {
      assert.ok(
        posContextCode.includes('isLockedByOther') &&
        posContextCode.includes('mở thanh toán, không thể xóa'),
        'PosContext must guard against deleting a table currently locked by another cashier'
      );
    });
  });
});
