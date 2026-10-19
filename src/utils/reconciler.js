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
