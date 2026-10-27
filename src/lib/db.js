/**
 * GÓC POS — IndexedDB Database (Dexie.js)
 * Enterprise Offline-First Storage & Outbox Queue
 * Dynamically loaded to keep initial application bundle ultralight (0ms overhead on login/startup).
 */

let _db = null;
let _initPromise = null;

export async function getDb() {
  if (_db) return _db;
  if (!_initPromise) {
    _initPromise = (async () => {
      try {
        const { default: Dexie } = await import('dexie');
        const dbInstance = new Dexie('GocCoffeePosDB');
        dbInstance.version(1).stores({
          tables: 'id, status, activeOrderId, updatedAt',
          orders: 'id, tableId, status, businessDate, version, createdAt',
          orderHistory: 'id, tableId, status, businessDate, finishedAt, paymentMethod',
          payments: 'id, orderId, businessDate, paymentMethod, paidAt',
          outboxQueue: '++id, actionType, orderId, payload, status, createdAt, idempotencyKey',
          settings: 'id'
        });
        dbInstance.version(2).stores({
          dailyClosures: 'date, closedAt, totalRevenue, totalOrders, cashTotal, qrTotal'
        });
        _db = dbInstance;
        return _db;
      } catch (err) {
        console.warn('[IndexedDB] Không thể khởi tạo Dexie:', err);
        return null;
      }
    })();
  }
  return _initPromise;
}

/**
 * Backward-compatible db Proxy for external calls
 */
export const db = new Proxy({}, {
  get(target, prop) {
    if (prop === 'table') {
      return (name) => ({
        count: async () => {
          const instance = await getDb();
          return instance ? instance.table(name).count() : 0;
        },
        bulkPut: async (records) => {
          const instance = await getDb();
          return instance ? instance.table(name).bulkPut(records) : null;
        }
      });
    }
    return new Proxy({}, {
      get(subTarget, method) {
        return async (...args) => {
          const instance = await getDb();
          if (!instance || !instance[prop]) return null;
          return instance[prop][method](...args);
        };
      }
    });
  }
});

/**
 * Di chuyển an toàn từ LocalStorage sang IndexedDB trong lần đầu khởi động
 * Áp dụng cơ chế Dual-Write để bảo toàn dữ liệu 100%.
 */
export async function migrateFromLocalStorage(STORAGE_KEYS) {
  if (typeof window === 'undefined' || !localStorage) return;
  try {
    const d = await getDb();
    if (!d) return;

    const tablesStore = d.table('tables');
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
          await d.orders.bulkPut(orderArr);
        }
      }

      // 3. Order History
      const savedHistory = localStorage.getItem(STORAGE_KEYS.ORDER_HISTORY);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await d.orderHistory.bulkPut(parsed);
        }
      }

      // 4. Payments
      const savedPayments = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
      if (savedPayments) {
        const parsed = JSON.parse(savedPayments);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await d.payments.bulkPut(parsed);
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
    const d = await getDb();
    if (!d) return;
    const store = d.table(tableName);
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
    const d = await getDb();
    if (!d) return null;
    const id = await d.outboxQueue.add({
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
    const d = await getDb();
    if (!d) return [];
    return await d.outboxQueue.where('status').equals('pending').sortBy('id');
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
    const d = await getDb();
    if (!d) return [];
    return await d.outboxQueue.reverse().sortBy('id');
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
    const d = await getDb();
    if (!d) return;
    await d.outboxQueue.update(id, {
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
    const d = await getDb();
    if (!d) return;
    await d.outboxQueue.delete(id);
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
    const d = await getDb();
    if (!d) return;
    await d.dailyClosures.put(closureData);
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
    const d = await getDb();
    if (!d) return null;
    return await d.dailyClosures.get(dateStr);
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
    const d = await getDb();
    if (!d) return [];
    return await d.dailyClosures.reverse().sortBy('date');
  } catch (err) {
    console.warn('[IndexedDB] Lỗi getAllDailyClosures:', err);
    return [];
  }
}
