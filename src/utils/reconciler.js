import { getVietnamDateString } from './dateTime.js';
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

  // Group and sort serving orders by tableId to enforce Strict 1-to-1 Table-to-Active-Order Invariant
  const servingOrdersByTable = {};
  const ordersList = Object.values(newOrders).filter((o) => o && o.id);

  // First pass: archive completed/cancelled/unpaid_carried_over
  ordersList.forEach((ord) => {
    if (ord.status === 'completed' || ord.status === 'cancelled') {
      if (!newHistory.some((h) => h.id === ord.id)) {
        newHistory.unshift(ord);
      }
      delete newOrders[ord.id];
      changed = true;
      return;
    }

    if (ord.status === 'unpaid_carried_over') {
      if (!newHistory.some((h) => h.id === ord.id)) {
        newHistory.unshift(ord);
      }
      delete newOrders[ord.id];
      changed = true;
      return;
    }

    // Clean up empty orders with 0 items
    if (!Array.isArray(ord.items) || ord.items.length === 0) {
      delete newOrders[ord.id];
      changed = true;
      return;
    }

    if (ord.status === 'serving' && ord.tableId) {
      if (!servingOrdersByTable[ord.tableId]) {
        servingOrdersByTable[ord.tableId] = [];
      }
      servingOrdersByTable[ord.tableId].push(ord);
    }
  });

  // Second pass: For each table with serving orders, pick ONLY the newest order
  Object.keys(servingOrdersByTable).forEach((tId) => {
    const list = servingOrdersByTable[tId];
    // Sort descending by createdAt (or id timestamp)
    list.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    const primaryOrder = list[0];
    const olderDuplicates = list.slice(1);

    // Primary order binds to the table
    const table = newTables.find((t) => t.id === tId);
    if (!table) {
      // Table doesn't exist: cancel order
      const cancelledOrder = {
        ...primaryOrder,
        status: 'cancelled',
        finishedAt: primaryOrder.finishedAt || new Date().toISOString()
      };
      newHistory.unshift(cancelledOrder);
      delete newOrders[primaryOrder.id];
      changed = true;
    } else {
      // Self-Healing Guarantee: primary order occupies table
      if (table.status !== 'occupied' || table.activeOrderId !== primaryOrder.id) {
        table.status = 'occupied';
        table.activeOrderId = primaryOrder.id;
        table.customerCount = primaryOrder.customerCount || table.customerCount || 1;
        table.seatedAt = table.seatedAt || primaryOrder.createdAt || new Date().toISOString();
        changed = true;
      }
    }

    // Archive older duplicate serving orders so they NEVER resurrect
    olderDuplicates.forEach((dupOrd) => {
      const archivedDuplicate = {
        ...dupOrd,
        status: 'cancelled',
        finishedAt: dupOrd.finishedAt || new Date().toISOString(),
        notes: (dupOrd.notes ? dupOrd.notes + ' | ' : '') + 'Tự động đóng do trùng bàn với đơn #' + primaryOrder.id
      };
      newHistory.unshift(archivedDuplicate);
      delete newOrders[dupOrd.id];
      changed = true;
    });
  });

  // Third pass: Verify occupied tables: if activeOrderId missing or has 0 items, check fallback or reset to empty
  newTables.forEach((t, idx) => {
    if (t.status === 'occupied') {
      let activeOrder = t.activeOrderId ? newOrders[t.activeOrderId] : null;
      if (!activeOrder || !activeOrder.items || activeOrder.items.length === 0) {
        // Try fallback: find any valid serving order for this table
        const fallback = Object.values(newOrders).find(
          (o) => o.tableId === t.id && o.status === 'serving' && Array.isArray(o.items) && o.items.length > 0
        );
        if (fallback) {
          newTables[idx] = {
            ...t,
            status: 'occupied',
            activeOrderId: fallback.id,
            customerCount: fallback.customerCount || t.customerCount || 1
          };
          changed = true;
        } else {
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
    } else {
      // Table is marked empty: ensure activeOrderId is null
      if (t.activeOrderId) {
        newTables[idx] = { ...t, activeOrderId: null };
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

    const ordDate = ord.businessDate || (ord.createdAt ? getVietnamDateString(ord.createdAt) : '');
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
