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
 * Normalizes size for display and printing.
 * Hides default/standard sizes such as 'Std', 'Standard', 'Mặc định', 'Mac dinh', 'Default'.
 * Preserves specific sizes like 'S', 'M', 'L', 'XL', etc.
 *
 * @param {string|null|undefined} size
 * @returns {string}
 */
export function formatItemSize(size) {
  if (!size) return '';
  const trimmed = String(size).trim();
  if (!trimmed) return '';
  // Unwrap surrounding parentheses if any: e.g. "(Std)" -> "Std", "(M)" -> "M"
  const unwrapped = trimmed.replace(/^\((.+)\)$/, '$1').trim();
  const lower = unwrapped.toLowerCase();

  if (
    lower === 'std' ||
    lower === 'standard' ||
    lower === 'mặc định' ||
    lower === 'mac dinh' ||
    lower === 'default'
  ) {
    return '';
  }
  return unwrapped;
}

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
 * Checks whether two order items refer to the exact same dish configuration
 * (matching product identity, size, notes, and toppings deterministically).
 */
export function isSameOrderItem(itemA, itemB) {
  if (!itemA || !itemB) return false;

  // 1. Match Product Identifier (productId or id or normalized name)
  const idA = (itemA.productId || itemA.id || '').trim();
  const idB = (itemB.productId || itemB.id || '').trim();
  const nameA = (itemA.name || itemA.productName || '').trim().toLowerCase();
  const nameB = (itemB.name || itemB.productName || '').trim().toLowerCase();

  const idMatches = Boolean(idA && idB && idA === idB);
  const nameMatches = Boolean(nameA && nameB && nameA === nameB);

  // Must match on product identity
  if (!idMatches && !nameMatches) {
    return false;
  }

  // 2. Match Size (case-insensitive, normalize standard sizes to '')
  const sizeA = formatItemSize(itemA.size || itemA.sizeName || '').toUpperCase();
  const sizeB = formatItemSize(itemB.size || itemB.sizeName || '').toUpperCase();
  if (sizeA !== sizeB) {
    return false;
  }

  // 3. Match Notes/Ghi chú (case-insensitive, trimmed)
  const notesA = (itemA.notes || itemA.note || '').trim().toLowerCase();
  const notesB = (itemB.notes || itemB.note || '').trim().toLowerCase();
  if (notesA !== notesB) {
    return false;
  }

  // 4. Match Toppings (deterministic sorted list comparison)
  const topsA = normalizeToppingsList(itemA.toppings).join('|');
  const topsB = normalizeToppingsList(itemB.toppings).join('|');
  return topsA === topsB;
}

/**
 * Consolidates an array of order items by merging duplicate configurations,
 * accumulating total quantity, preserving printed_quantity, and re-calculating line totals.
 */
export function consolidateOrderItems(items = []) {
  if (!Array.isArray(items)) return [];
  const consolidated = [];

  for (const it of items) {
    const existing = consolidated.find((c) => isSameOrderItem(c, it));
    if (existing) {
      existing.quantity = (Number(existing.quantity) || 0) + (Number(it.quantity) || 0);
      existing.printed_quantity = (Number(existing.printed_quantity) || 0) + Math.max(0, Number(it.printed_quantity) || 0);
      existing.lineTotal = (Number(existing.unitPrice) || 0) * existing.quantity;
    } else {
      consolidated.push({
        ...it,
        productId: it.productId || it.id,
        quantity: Number(it.quantity) || 1,
        printed_quantity: Math.max(0, Number(it.printed_quantity) || 0),
        toppings: Array.isArray(it.toppings) ? [...it.toppings] : []
      });
    }
  }

  return consolidated;
}

/**
 * Creates a unique signature for an item based on its ID/name, size, toppings and special notes.
 */
export function generateItemSignature(item) {
  if (!item) return '';
  const idOrName = (item.productId || item.id || item.name || '').trim();
  const size = formatItemSize(item.size || item.sizeName || '').toUpperCase();
  const toppingsStr = normalizeToppingsList(item.toppings).join('|');
  const notes = (item.notes || item.note || '').trim().toLowerCase();
  return `${idOrName}::${size}::${toppingsStr}::${notes}`;
}

/**
 * Calculates preparation ticket items based on delta quantity (quantity - printed_quantity).
 * Pure delta math: eliminates race conditions and handles accumulated items deterministically.
 * 
 * @param {Array} items - Order items with `quantity` and `printed_quantity`
 * @returns {{ itemsToPrint: Array, totalQtyToPrint: number, hasChanges: boolean }}
 */
export function computeKitchenItemsToPrint(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return { itemsToPrint: [], totalQtyToPrint: 0, hasChanges: false };
  }

  // First consolidate duplicate item lines if any exist
  const consolidated = consolidateOrderItems(items);

  const itemsToPrint = consolidated
    .map((item) => {
      const qty = Number(item.quantity) || 0;
      const printedQty = Math.max(0, Number(item.printed_quantity) || 0);
      const qtyToPrint = Math.max(0, qty - printedQty);

      return {
        ...item,
        quantity: qtyToPrint, // Count to prepare on this ticket
        totalOrderQuantity: qty,
        printed_quantity: printedQty,
        qtyToPrint,
        isAdditional: printedQty > 0
      };
    })
    .filter((item) => item.qtyToPrint > 0);

  const totalQtyToPrint = itemsToPrint.reduce((sum, it) => sum + it.qtyToPrint, 0);

  return {
    itemsToPrint,
    totalQtyToPrint,
    hasChanges: itemsToPrint.length > 0
  };
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
  printMode = 'diff',
  ticketTag = null
}) {
  const kitchenSettings = {
    ...DEFAULT_KITCHEN_TICKET_SETTINGS,
    ...(settings?.kitchenTicketSettings || settings?.kitchen_ticket_settings || {})
  };

  const now = new Date();
  const ticketId = ticketNumber || `BAR-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getTime().toString().slice(-4)}`;
  const paperWidth = kitchenSettings.paperWidth || settings?.receiptPaperWidth || '58mm';

  const tableName = table?.name || order.tableName || (order.tableId ? `Bàn ${order.tableId}` : 'Mang về');

  // Check if order already has prior printed items
  const hasPreviousPrints =
    Boolean(order?.items?.some((it) => (Number(it.printed_quantity) || 0) > 0 || it.is_printed)) ||
    (Array.isArray(order?.kitchenSentItems) && order.kitchenSentItems.length > 0) ||
    (diffItems || []).some((it) => it.isAdditional);

  const isAdditionalOrder = hasPreviousPrints;
  const computedTag = ticketTag || (printMode === 'all' && hasPreviousPrints ? 'TOÀN BỘ CÁC MÓN' : (isAdditionalOrder ? 'MÓN GỌI THÊM' : null));

  // Format clean item rows
  const formattedItems = (diffItems || []).map((it, idx) => {
    const cleanToppings = normalizeToppingsList(it.toppings);
    const itemQty = Number(it.qtyToPrint || it.quantity) || 1;
    const isItemAdditional = Boolean(
      it.isAdditional ||
      (Number(it.printed_quantity) || 0) > 0 ||
      isAdditionalOrder
    );

    const displaySize = formatItemSize(it.size || it.sizeName || '');

    return {
      index: idx + 1,
      id: it.id || it.productId || `item-${idx}`,
      cartItemId: it.cartItemId || it.id,
      name: it.name || it.productName || 'Món không tên',
      size: displaySize,
      rawSize: (it.size || '').trim(),
      quantity: itemQty,
      isAdditional: isItemAdditional,
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
    isAdditionalOrder,
    hasPreviousPrints,
    ticketTag: computedTag,
    paperWidth,
    items: formattedItems,
    totalQuantity,
    itemCount: formattedItems.length,
    settings: kitchenSettings
  };
}
