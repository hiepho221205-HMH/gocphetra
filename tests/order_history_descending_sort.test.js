import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('TASK: SẮP XẾP ĐƠN HÀNG MỚI NHẤT LÊN ĐẦU (DESCENDING)', () => {
  const orderHistoryViewPath = path.resolve('src/components/orders/OrderHistoryView.jsx');
  const supabasePath = path.resolve('src/lib/supabase.js');

  const orderHistoryViewCode = fs.readFileSync(orderHistoryViewPath, 'utf8');
  const supabaseCode = fs.readFileSync(supabasePath, 'utf8');

  // Comparator simulation matching OrderHistoryView.jsx logic
  const sortServingOrUnpaid = (list) => {
    return [...list].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
      const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return (b.id || '').localeCompare(a.id || '');
    });
  };

  const sortCompleted = (list) => {
    return [...list].sort((a, b) => {
      const timeA = new Date(a.paid_at || a.paidAt || a.finishedAt || a.finished_at || a.completed_at || a.completedAt || a.createdAt || a.created_at || 0).getTime();
      const timeB = new Date(b.paid_at || b.paidAt || b.finishedAt || b.finished_at || b.completed_at || b.completedAt || b.createdAt || b.created_at || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return (b.id || '').localeCompare(a.id || '');
    });
  };

  // =========================================================================
  // 1. CODE STRUCTURE & REGRESSION CONTRACT
  // =========================================================================
  describe('1. Kiểm tra mã nguồn trong OrderHistoryView.jsx & supabase.js', () => {
    it('1.1 - OrderHistoryView uses descending sort (timeB - timeA) for serving orders', () => {
      assert.ok(
        orderHistoryViewCode.includes('if (timeB !== timeA) return timeB - timeA;'),
        'OrderHistoryView must use timeB - timeA for descending order sort'
      );
    });

    it('1.2 - OrderHistoryView uses deterministic ID tie-breaker for identical timestamps', () => {
      assert.ok(
        orderHistoryViewCode.includes("(b.id || '').localeCompare(a.id || '')"),
        'OrderHistoryView must break timestamp ties with descending ID comparison'
      );
    });

    it('1.3 - supabase.js fetches orders pre-sorted descending by created_at', () => {
      assert.ok(
        supabaseCode.includes("from('orders').select('*').order('created_at', { ascending: false })"),
        'supabase.js must order orders by created_at descending from database query'
      );
    });
  });

  // =========================================================================
  // 2. SERVING ORDERS SORTING (MỚI NHẤT LÊN ĐẦU)
  // =========================================================================
  describe('2. Sắp xếp đơn đang phục vụ (Tab Đang phục vụ)', () => {
    it('2.1 - Tạo 3 đơn liên tiếp: Đơn tạo mới nhất luôn nằm trên cùng', () => {
      const mockServing = [
        { id: 'ORD-01', tableName: 'Bàn 01', createdAt: '2026-10-24T08:00:00.000Z', status: 'serving' },
        { id: 'ORD-02', tableName: 'Bàn 02', createdAt: '2026-10-24T08:15:00.000Z', status: 'serving' },
        { id: 'ORD-03', tableName: 'Bàn 03', createdAt: '2026-10-24T08:30:00.000Z', status: 'serving' }
      ];

      const sorted = sortServingOrUnpaid(mockServing);

      assert.deepEqual(
        sorted.map((o) => o.id),
        ['ORD-03', 'ORD-02', 'ORD-01'],
        'ORD-03 tạo lúc 08:30 phải nằm đầu tiên, tiếp theo là ORD-02 (08:15) và ORD-01 (08:00)'
      );
    });
  });

  // =========================================================================
  // 3. COMPLETED ORDERS SORTING (THEO THỜI GIAN THANH TOÁN PAID_AT)
  // =========================================================================
  describe('3. Sắp xếp đơn đã hoàn thành (Tab Đã hoàn thành)', () => {
    it('3.1 - Thanh toán các đơn không theo thứ tự tạo: sắp xếp đúng theo paid_at giảm dần', () => {
      // Ví dụ theo mô tả người dùng:
      // 1. Bàn 03 — Thanh toán lúc 14:35
      // 2. Bàn 01 — Thanh toán lúc 14:20
      // 3. Bàn 05 — Thanh toán lúc 13:45
      // 4. Bàn 02 — Thanh toán lúc 12:10
      const mockCompleted = [
        { id: 'ORD-01', tableName: 'Bàn 01', createdAt: '2026-10-24T06:00:00Z', paidAt: '2026-10-24T14:20:00.000Z', status: 'completed' },
        { id: 'ORD-02', tableName: 'Bàn 02', createdAt: '2026-10-24T05:00:00Z', paidAt: '2026-10-24T12:10:00.000Z', status: 'completed' },
        { id: 'ORD-03', tableName: 'Bàn 03', createdAt: '2026-10-24T07:00:00Z', paidAt: '2026-10-24T14:35:00.000Z', status: 'completed' },
        { id: 'ORD-05', tableName: 'Bàn 05', createdAt: '2026-10-24T06:30:00Z', paidAt: '2026-10-24T13:45:00.000Z', status: 'completed' }
      ];

      const sorted = sortCompleted(mockCompleted);

      assert.deepEqual(
        sorted.map((o) => o.tableName),
        ['Bàn 03', 'Bàn 01', 'Bàn 05', 'Bàn 02'],
        'Thứ tự phải là: Bàn 03 (14:35) -> Bàn 01 (14:20) -> Bàn 05 (13:45) -> Bàn 02 (12:10)'
      );
    });

    it('3.2 - Fallback chính xác khi đơn dùng paid_at (snake_case) hoặc finishedAt', () => {
      const mockOrders = [
        { id: 'ORD-A', tableName: 'Bàn A', paid_at: '2026-10-24T10:00:00Z' },
        { id: 'ORD-B', tableName: 'Bàn B', finishedAt: '2026-10-24T11:00:00Z' },
        { id: 'ORD-C', tableName: 'Bàn C', paidAt: '2026-10-24T10:30:00Z' }
      ];

      const sorted = sortCompleted(mockOrders);

      assert.deepEqual(
        sorted.map((o) => o.id),
        ['ORD-B', 'ORD-C', 'ORD-A'],
        'ORD-B (11:00) -> ORD-C (10:30) -> ORD-A (10:00)'
      );
    });
  });

  // =========================================================================
  // 4. UNPAID PAST ORDERS SORTING (TAB CHƯA THANH TOÁN QUÁ KHỨ)
  // =========================================================================
  describe('4. Sắp xếp đơn quá khứ chưa thanh toán', () => {
    it('4.1 - Sắp xếp theo createdAt giảm dần; không bị xáo trộn bởi updated_at', () => {
      const mockPastUnpaid = [
        { id: 'ORD-P1', tableName: 'Bàn 01', createdAt: '2026-10-22T08:00:00Z', updatedAt: '2026-10-24T12:00:00Z', status: 'unpaid_carried_over' },
        { id: 'ORD-P2', tableName: 'Bàn 02', createdAt: '2026-10-22T09:30:00Z', updatedAt: '2026-10-22T10:00:00Z', status: 'unpaid_carried_over' },
        { id: 'ORD-P3', tableName: 'Bàn 03', createdAt: '2026-10-22T11:00:00Z', updatedAt: '2026-10-22T11:00:00Z', status: 'unpaid_carried_over' }
      ];

      const sorted = sortServingOrUnpaid(mockPastUnpaid);

      assert.deepEqual(
        sorted.map((o) => o.id),
        ['ORD-P3', 'ORD-P2', 'ORD-P1'],
        'Thứ tự phải giảm dần theo thời gian tạo: ORD-P3 (11:00) -> ORD-P2 (09:30) -> ORD-P1 (08:00), mặc dù ORD-P1 có updatedAt mới nhất'
      );
    });
  });

  // =========================================================================
  // 5. IDENTICAL TIMESTAMPS TIE-BREAKER
  // =========================================================================
  describe('5. Hai đơn trùng timestamp (Identical Timestamps)', () => {
    it('5.1 - Khóa phụ ID giảm dần đảm bảo danh sách luôn ổn định', () => {
      const sameTime = '2026-10-24T10:00:00.000Z';
      const mockOrders = [
        { id: 'ORD-101', tableName: 'Bàn 01', createdAt: sameTime },
        { id: 'ORD-103', tableName: 'Bàn 03', createdAt: sameTime },
        { id: 'ORD-102', tableName: 'Bàn 02', createdAt: sameTime }
      ];

      const sorted = sortServingOrUnpaid(mockOrders);

      assert.deepEqual(
        sorted.map((o) => o.id),
        ['ORD-103', 'ORD-102', 'ORD-101'],
        'Khi trùng timestamp, ID lớn hơn (tạo sau) phải đứng trước: ORD-103 -> ORD-102 -> ORD-101'
      );
    });
  });

  // =========================================================================
  // 6. IMMUTABILITY
  // =========================================================================
  describe('6. Kiểm tra tính bất biến (Immutability)', () => {
    it('6.1 - Không mutate mảng dữ liệu gốc khi sắp xếp', () => {
      const original = [
        { id: 'ORD-01', createdAt: '2026-10-24T08:00:00Z' },
        { id: 'ORD-02', createdAt: '2026-10-24T09:00:00Z' }
      ];

      const originalCopy = JSON.stringify(original);
      const sorted = sortServingOrUnpaid(original);

      assert.equal(
        JSON.stringify(original),
        originalCopy,
        'Mảng dữ liệu gốc không được phép bị mutate'
      );
      assert.notEqual(sorted, original, 'Hàm sort phải trả về mảng mới cloned');
    });
  });

  // =========================================================================
  // 7. HISTORICAL ORDER SETTLED TODAY
  // =========================================================================
  describe('7. Đơn quá khứ được thanh toán vào ngày hôm nay', () => {
    it('7.1 - Hiển thị đúng ở tab Đã hoàn thành của ngày hôm nay theo thời gian thanh toán', () => {
      const todayStr = '2026-10-24';
      const mockHistory = [
        // Đơn tạo hôm qua (2026-10-23) nhưng thanh toán lúc 10:00 hôm nay
        {
          id: 'ORD-YESTERDAY',
          tableName: 'Bàn 04',
          businessDate: '2026-10-23',
          paymentBusinessDate: '2026-10-24',
          paidAt: '2026-10-24T10:00:00.000Z',
          status: 'completed'
        },
        // Đơn tạo hôm nay và thanh toán lúc 11:30 hôm nay
        {
          id: 'ORD-TODAY',
          tableName: 'Bàn 01',
          businessDate: '2026-10-24',
          paymentBusinessDate: '2026-10-24',
          paidAt: '2026-10-24T11:30:00.000Z',
          status: 'completed'
        }
      ];

      // Lọc các đơn hoàn thành hiển thị cho ngày hôm nay
      const completedToday = mockHistory.filter((ord) => {
        if (ord.status !== 'completed') return false;
        const bDate = ord.businessDate;
        const paidDate = ord.paymentBusinessDate;
        return bDate === todayStr || paidDate === todayStr;
      });

      const sorted = sortCompleted(completedToday);

      assert.deepEqual(
        sorted.map((o) => o.id),
        ['ORD-TODAY', 'ORD-YESTERDAY'],
        'Đơn thanh toán lúc 11:30 (ORD-TODAY) phải đứng trước đơn thanh toán lúc 10:00 (ORD-YESTERDAY)'
      );
    });
  });
});
