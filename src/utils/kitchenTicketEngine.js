/**
 * GÓC POS — Kitchen & Bar Preparation Ticket Engine
 * Core logic for computing item differences (diff engine), preparation ticket models,
 * and snapshot consolidation.
 */

import { formatVietnamDateTime } from './dateTime.js';

export const DEFAULT_KITCHEN_TICKET_SETTINGS = {
  enabled: true,
  paperWidth: '58mm',
  promptOnSave: true,
  printMode: 'diff', // 'diff' | 'all'
  showTable: true,
  showOrderId: true,
  showTime: true,
  showToppings: true,
  showNotes: true,
  showItemCount: true
};

/**
 * Normalizes toppings to a sorted array of clean names/IDs for deterministic comparison
 */
export function normalizeToppingsList(toppings) {
  if (!Array.isArray(toppings)) return [];
  return toppings
    .map((t) => {
      if (typeof t === 'string') return t.trim();
      if (t && typeof t === 'object') return (t.name || t.id || '').trim();
      return '';
    })
    .filter(Boolean)
    .sort();
}

/**
 * Creates a unique signature for an item based on its ID/name, size, toppings and special notes.
 */
export function generateItemSignature(item) {
  if (!item) return '';
  const idOrName = (item.productId || item.id || item.name || '').trim();
  const size = (item.size || '').trim().toUpperCase();
  const toppingsStr = normalizeToppingsList(item.toppings).join('|');
  const notes = (item.notes || item.note || '').trim().toLowerCase();
  return `${idOrName}::${size}::${toppingsStr}::${notes}`;
}

/**
 * Computes difference between currently saved items and items already sent to the bar/kitchen.
 * 
 * Rules:
 * 1. Mode 'all': Returns all items in current cart with their current quantities.
 * 2. Mode 'diff':
 *    - Brand new items (not in sentItems): printed with full quantity.
 *    - Existing items with increased quantity: only the delta (current - sent) is printed, marked `isAdditional: true`.
 *    - Unchanged or reduced quantity: omitted from print ticket.
 *    - Changed notes/toppings: treated as distinct preparation items.
 *
 * @param {Array} currentItems - Current list of items in the order
 * @param {Array} sentItems - Snapshot of items previously printed/sent to kitchen
 * @param {'diff' | 'all'} printMode - Printing mode
 * @returns {{ diffItems: Array, totalDeltaCount: number, hasChanges: boolean }}
 */
export function computeKitchenItemsDiff(currentItems = [], sentItems = [], printMode = 'diff') {
  if (!Array.isArray(currentItems) || currentItems.length === 0) {
    return { diffItems: [], totalDeltaCount: 0, hasChanges: false };
  }

  // If mode is 'all' or no items were previously sent, everything currently in order needs preparation
  if (printMode === 'all' || !Array.isArray(sentItems) || sentItems.length === 0) {
    const diffItems = currentItems
      .filter((it) => (Number(it.quantity) || 0) > 0)
      .map((it) => ({
        ...it,
        quantity: Number(it.quantity) || 1,
        isAdditional: false,
        signature: generateItemSignature(it)
      }));

    const totalDeltaCount = diffItems.reduce((sum, it) => sum + it.quantity, 0);
    return {
      diffItems,
      totalDeltaCount,
      hasChanges: diffItems.length > 0
    };
  }

  // Build a bucket of previously sent quantities keyed by signature
  const sentQtyMap = {};
  sentItems.forEach((it) => {
    const sig = generateItemSignature(it);
    const qty = Number(it.quantity) || 0;
    sentQtyMap[sig] = (sentQtyMap[sig] || 0) + qty;
  });

  const diffItems = [];
  let totalDeltaCount = 0;

  currentItems.forEach((item) => {
    const currentQty = Number(item.quantity) || 0;
    if (currentQty <= 0) return;

    const sig = generateItemSignature(item);
    const previouslySent = sentQtyMap[sig] || 0;

    if (previouslySent === 0) {
      // Brand new item added to order
      diffItems.push({
        ...item,
        quantity: currentQty,
        isAdditional: false,
        signature: sig
      });
      totalDeltaCount += currentQty;
    } else if (currentQty > previouslySent) {
      // Quantity increased for existing item
      const delta = currentQty - previouslySent;
      diffItems.push({
        ...item,
        quantity: delta,
        isAdditional: true,
        signature: sig
      });
      totalDeltaCount += delta;
      sentQtyMap[sig] = currentQty; // update sent tracker
    }
  });

  return {
    diffItems,
    totalDeltaCount,
    hasChanges: diffItems.length > 0
  };
}

/**
 * Consolidates sent items so that `kitchen_sent_items` maintains an accurate cumulative snapshot
 */
export function mergeSentItems(previouslySent = [], newlyPrinted = []) {
  const map = {};

  (previouslySent || []).forEach((it) => {
    const sig = generateItemSignature(it);
    map[sig] = {
      ...it,
      quantity: Number(it.quantity) || 0,
      signature: sig
    };
  });

  (newlyPrinted || []).forEach((it) => {
    const sig = generateItemSignature(it);
    const qty = Number(it.quantity) || 0;
    if (map[sig]) {
      map[sig].quantity += qty;
    } else {
      map[sig] = {
        ...it,
        quantity: qty,
        signature: sig
      };
    }
  });

  return Object.values(map);
}

/**
 * Builds the immutable model for printing a Kitchen/Bar Preparation Ticket.
 * STRICT ISOLATION: Omits all pricing, subtotals, discounts, tax, totals, VietQR, and wifi.
 */
export function buildKitchenTicketModel({
  order = {},
  table = null,
  diffItems = [],
  settings = {},
  currentUser = null,
  ticketNumber = null,
  printMode = 'diff'
}) {
  const kitchenSettings = {
    ...DEFAULT_KITCHEN_TICKET_SETTINGS,
    ...(settings?.kitchenTicketSettings || settings?.kitchen_ticket_settings || {})
  };

  const now = new Date();
  const ticketId = ticketNumber || `BAR-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getTime().toString().slice(-4)}`;
  const paperWidth = kitchenSettings.paperWidth || settings?.receiptPaperWidth || '58mm';

  const tableName = table?.name || order.tableName || (order.tableId ? `Bàn ${order.tableId}` : 'Mang về');

  // Format clean item rows
  const formattedItems = (diffItems || []).map((it, idx) => {
    const cleanToppings = normalizeToppingsList(it.toppings);
    return {
      index: idx + 1,
      id: it.id || it.productId || `item-${idx}`,
      name: it.name || it.productName || 'Món không tên',
      size: (it.size || '').trim(),
      quantity: Number(it.quantity) || 1,
      isAdditional: Boolean(it.isAdditional),
      toppings: cleanToppings,
      notes: (it.notes || it.note || '').trim()
    };
  });

  const totalQuantity = formattedItems.reduce((acc, it) => acc + it.quantity, 0);

  return {
    ticketId,
    ticketNumber: ticketId,
    orderId: order.id || '',
    tableId: table?.id || order.tableId || null,
    tableName,
    customerCount: table?.customerCount || order.customerCount || 1,
    printedAt: now.toISOString(),
    printedAtDisplay: formatVietnamDateTime(now),
    printedBy: currentUser?.name || currentUser?.displayName || 'Thu ngân',
    printMode,
    paperWidth,
    items: formattedItems,
    totalQuantity,
    itemCount: formattedItems.length,
    settings: kitchenSettings
  };
}
