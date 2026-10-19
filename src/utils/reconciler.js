/**
 * GÓC Coffee POS - Table & Order State Reconciler
 * Enforces the Single Source of Truth & Table-First Rule:
 *
 * 1. If a table is empty or missing, any active order claiming this table is an orphan/stale order.
 *    It is transitioned to status: 'cancelled' and archived into orderHistory.
 * 2. If a table is occupied, its activeOrderId is verified. If the active order is missing or has 0 items,
 *    the table is reset to status: 'empty', activeOrderId: null.
 * 3. Guarantees 100% synchronization between tables and active orders, eliminating ghost tables
 *    and orphan orders.
 */

export function reconcileTablesAndOrders(tablesArr, ordersObj, orderHistoryArr = []) {
  if (!Array.isArray(tablesArr) || !ordersObj || typeof ordersObj !== 'object') {
    return {
      reconciledTables: tablesArr || [],
      reconciledOrders: ordersObj || {},
      reconciledHistory: Array.isArray(orderHistoryArr) ? orderHistoryArr : [],
      changed: false
    };
  }

  let changed = false;
  const newTables = tablesArr.map((t) => ({ ...t }));
  const newOrders = { ...ordersObj };
  const newHistory = Array.isArray(orderHistoryArr) ? [...orderHistoryArr] : [];

  // Table-First Rule: Clean up orphan orders where table is empty or missing
  Object.values(newOrders).forEach((ord) => {
    if (!ord || !ord.id) return;
    if (ord.status === 'completed' || ord.status === 'cancelled') {
      newHistory.unshift(ord);
      delete newOrders[ord.id];
      changed = true;
      return;
    }

    if (ord.status === 'unpaid_carried_over') {
      // Historical carried over order: preserve exactly as unpaid_carried_over
      newHistory.unshift(ord);
      delete newOrders[ord.id];
      changed = true;
      return;
    }

    const table = newTables.find((t) => t.id === ord.tableId);
    if (!table || table.status === 'empty' || table.activeOrderId !== ord.id) {
      const cancelledOrder = {
        ...ord,
        status: 'cancelled',
        finishedAt: ord.finishedAt || new Date().toISOString()
      };
      newHistory.unshift(cancelledOrder);
      delete newOrders[ord.id];
      changed = true;
    }
  });

  // Verify occupied tables: if activeOrderId missing in newOrders or has 0 items, reset to empty
  newTables.forEach((t, idx) => {
    if (t.status === 'occupied') {
      const activeOrder = t.activeOrderId ? newOrders[t.activeOrderId] : null;
      if (!activeOrder || !activeOrder.items || activeOrder.items.length === 0) {
        newTables[idx] = {
          ...t,
          status: 'empty',
          activeOrderId: null,
          seatedAt: null,
          customerCount: 0
        };
        changed = true;
      }
    }
  });

  return {
    reconciledTables: newTables,
    reconciledOrders: newOrders,
    reconciledHistory: newHistory,
    changed
  };
}

/**
 * Daily Order Rollover for Past Unpaid Orders:
 * - Scans all active orders.
 * - Any order with businessDate < currentBusinessDate (or created prior to current business date)
 *   is safely rolled over to status: 'unpaid_carried_over', paymentStatus: 'unpaid'.
 * - Preserves 100% of items, notes, basePrice, and totals without auto-deleting or auto-cancelling.
 * - Moves the order from active orders to orderHistory.
 * - Releases the associated table to 'empty' IF the table's activeOrderId is that exact order.
 * - Total Isolation: Does NOT affect tables if a new customer is already seated today.
 */
export function rolloverPastUnpaidOrders(tablesArr, ordersObj, orderHistoryArr = [], currentBusinessDate) {
  if (!Array.isArray(tablesArr) || !ordersObj || typeof ordersObj !== 'object') {
    return {
      tables: tablesArr || [],
      orders: ordersObj || {},
      orderHistory: Array.isArray(orderHistoryArr) ? orderHistoryArr : [],
      rolledOrdersCount: 0,
      releasedTablesCount: 0
    };
  }

  const targetDate = currentBusinessDate;
  const newTables = tablesArr.map((t) => ({ ...t }));
  const newOrders = { ...ordersObj };
  const newHistory = Array.isArray(orderHistoryArr) ? [...orderHistoryArr] : [];

  let rolledOrdersCount = 0;
  let releasedTablesCount = 0;

  Object.values(newOrders).forEach((ord) => {
    if (!ord || !ord.id) return;
    if (ord.status === 'completed' || ord.status === 'cancelled') return;

    const ordDate = ord.businessDate || (ord.createdAt ? ord.createdAt.substring(0, 10) : '');
    // If order is from a previous business date
    if (targetDate && ordDate && ordDate < targetDate) {
      const carriedOverOrder = {
        ...ord,
        status: 'unpaid_carried_over',
        paymentStatus: 'unpaid',
        carriedOverAt: ord.carriedOverAt || new Date().toISOString()
      };

      // Add to history or update existing if already present
      const existingHistIndex = newHistory.findIndex((h) => h.id === ord.id);
      if (existingHistIndex >= 0) {
        newHistory[existingHistIndex] = carriedOverOrder;
      } else {
        newHistory.unshift(carriedOverOrder);
      }

      delete newOrders[ord.id];
      rolledOrdersCount++;

      // Free table ONLY if activeOrderId matches this order
      if (ord.tableId) {
        const tblIndex = newTables.findIndex((t) => t.id === ord.tableId);
        if (tblIndex >= 0 && newTables[tblIndex].activeOrderId === ord.id) {
          newTables[tblIndex] = {
            ...newTables[tblIndex],
            status: 'empty',
            activeOrderId: null,
            seatedAt: null,
            customerCount: 0
          };
          releasedTablesCount++;
        }
      }
    }
  });

  return {
    tables: newTables,
    orders: newOrders,
    orderHistory: newHistory,
    rolledOrdersCount,
    releasedTablesCount
  };
}
