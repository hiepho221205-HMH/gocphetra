import Dexie from 'dexie';

/**
 * GÓC POS — IndexedDB Database (Dexie.js)
 * Enterprise Offline-First Storage & Outbox Queue
 */
export const db = new Dexie('GocCoffeePosDB');

db.version(1).stores({
  tables: 'id, status, activeOrderId, updatedAt',
  orders: 'id, tableId, status, businessDate, version, createdAt',
  orderHistory: 'id, tableId, status, businessDate, finishedAt, paymentMethod',
  payments: 'id, orderId, businessDate, paymentMethod, paidAt',
  outboxQueue: '++id, actionType, orderId, payload, status, createdAt, idempotencyKey',
  settings: 'id'
});

db.version(2).stores({
  dailyClosures: 'date, closedAt, totalRevenue, totalOrders, cashTotal, qrTotal'
});

/**
 * Di chuyển an toàn từ LocalStorage sang IndexedDB trong lần đầu khởi động
 * Áp dụng cơ chế Dual-Write để bảo toàn dữ liệu 100%.
 */
export async function migrateFromLocalStorage(STORAGE_KEYS) {
  if (typeof window === 'undefined' || !localStorage) return;
  try {
    const tablesStore = db.table('tables');
    const tableCount = await tablesStore.count();
    if (tableCount === 0) {
      // 1. Tables
      const savedTables = localStorage.getItem(STORAGE_KEYS.TABLES);
      if (savedTables) {
        const parsed = JSON.parse(savedTables);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await tablesStore.bulkPut(parsed);
        }
      }

      // 2. Orders
      const savedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (savedOrders) {
        const parsed = JSON.parse(savedOrders);
        const orderArr = Object.values(parsed || {});
        if (orderArr.length > 0) {
          await db.orders.bulkPut(orderArr);
        }
      }

      // 3. Order History
      const savedHistory = localStorage.getItem(STORAGE_KEYS.ORDER_HISTORY);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await db.orderHistory.bulkPut(parsed);
        }
      }

      // 4. Payments
      const savedPayments = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
      if (savedPayments) {
        const parsed = JSON.parse(savedPayments);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await db.payments.bulkPut(parsed);
        }
      }
      console.log('[IndexedDB] Di chuyển dữ liệu ban đầu từ LocalStorage sang Dexie thành công!');
    }
  } catch (err) {
    console.warn('[IndexedDB] Lỗi di chuyển dữ liệu ban đầu:', err);
  }
}

/**
 * Ghi kép bất đồng bộ vào IndexedDB (Dual-write)
 */
export async function dualWriteToIndexedDB(tableName, records) {
  try {
    const store = db.table(tableName);
    if (!store) return;
    if (Array.isArray(records)) {
      if (records.length > 0) {
        await store.bulkPut(records);
      }
    } else if (records && typeof records === 'object') {
      const recordsArr = Object.values(records);
      if (recordsArr.length > 0) {
        await store.bulkPut(recordsArr);
      }
    }
  } catch (err) {
    // Fail-safe: Non-blocking warning so UI never stalls
    console.warn(`[IndexedDB] Lỗi Dual-Write bảng ${tableName}:`, err);
  }
}

/**
 * Đẩy một giao dịch vào Hàng đợi Ngoại tuyến (Outbox Queue)
 */
export async function enqueueOutbox({ actionType, orderId, payload, idempotencyKey }) {
  try {
    const id = await db.outboxQueue.add({
      actionType,
      orderId,
      payload,
      status: 'pending', // 'pending' | 'syncing' | 'completed' | 'conflict'
      createdAt: new Date().toISOString(),
      idempotencyKey: idempotencyKey || `OUTBOX_${orderId}_${Date.now()}`
    });
    return id;
  } catch (err) {
    console.warn('[IndexedDB] Lỗi enqueueOutbox:', err);
    return null;
  }
}

/**
 * Lấy danh sách các bản tin đang chờ đồng bộ (pending) theo thứ tự FIFO
 */
export async function getPendingOutbox() {
  try {
    return await db.outboxQueue.where('status').equals('pending').sortBy('id');
  } catch (err) {
    console.warn('[IndexedDB] Lỗi getPendingOutbox:', err);
    return [];
  }
}

/**
 * Lấy toàn bộ hàng đợi outbox (phục vụ hiển thị trên UI)
 */
export async function getAllOutbox() {
  try {
    return await db.outboxQueue.reverse().sortBy('id');
  } catch (err) {
    console.warn('[IndexedDB] Lỗi getAllOutbox:', err);
    return [];
  }
}

/**
 * Cập nhật trạng thái bản ghi trong Outbox
 */
export async function updateOutboxStatus(id, status, errorDetails = null) {
  try {
    await db.outboxQueue.update(id, {
      status,
      errorDetails,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[IndexedDB] Lỗi updateOutboxStatus:', err);
  }
}

/**
 * Xóa một bản ghi khỏi Outbox sau khi hoàn tất hoặc hủy
 */
export async function removeOutboxItem(id) {
  try {
    await db.outboxQueue.delete(id);
  } catch (err) {
    console.warn('[IndexedDB] Lỗi removeOutboxItem:', err);
  }
}

/**
 * ============================================================================
 * GIAI ĐOẠN 3: LƯU TRỮ CHỐT DOANH THU THEO NGÀY (DAILY CLOSURES)
 * ============================================================================
 */

/**
 * Lưu hoặc cập nhật snapshot chốt doanh thu ngày
 */
export async function saveDailyClosure(closureData) {
  try {
    if (!closureData || !closureData.date) return;
    await db.dailyClosures.put(closureData);
  } catch (err) {
    console.warn('[IndexedDB] Lỗi saveDailyClosure:', err);
  }
}

/**
 * Lấy snapshot chốt doanh thu của một ngày cụ thể (YYYY-MM-DD)
 */
export async function getDailyClosure(dateStr) {
  try {
    if (!dateStr) return null;
    return await db.dailyClosures.get(dateStr);
  } catch (err) {
    console.warn('[IndexedDB] Lỗi getDailyClosure:', err);
    return null;
  }
}

/**
 * Lấy danh sách toàn bộ các ngày đã chốt doanh thu (sắp xếp giảm dần theo ngày)
 */
export async function getAllDailyClosures() {
  try {
    return await db.dailyClosures.reverse().sortBy('date');
  } catch (err) {
    console.warn('[IndexedDB] Lỗi getAllDailyClosures:', err);
    return [];
  }
}
