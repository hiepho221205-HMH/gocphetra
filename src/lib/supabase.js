import { getVietnamDateString, getVietnamTodayString } from '../utils/dateTime.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  'https://nbuulvdfxnmfdicbisxq.supabase.co';
const supabaseKey =
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) ||
  'sb_publishable_vJl_5FekfssxNrqMn54gEQ_MlX4ZRKu';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  : null;

/**
 * Intelligent Schema Capability Detection:
 * Prevents redundant failing HTTP requests / 404 console errors when optional
 * enterprise tables have not yet been migrated to remote Supabase instance.
 */
const savedCaps = typeof window !== 'undefined' ? (() => {
  try {
    return JSON.parse(localStorage.getItem('goc_schema_capabilities') || '{}');
  } catch {
    return {};
  }
})() : {};

export const schemaCapabilities = {
  staff_profiles: savedCaps.staff_profiles === true,
  daily_closures: savedCaps.daily_closures === true,
  payments: savedCaps.payments === true,
  profiles: savedCaps.profiles === true,
  user_roles: savedCaps.user_roles === true,
  rollover_daily_orders: savedCaps.rollover_daily_orders === true,
  store_settings: savedCaps.store_settings === true,
  receipts: savedCaps.receipts === true,
  store_assets: savedCaps.store_assets === true,
  atomic_save_order: savedCaps.atomic_save_order === true,
  atomic_finalize_order: savedCaps.atomic_finalize_order === true,
  preparation_tickets: savedCaps.preparation_tickets === true
};

export function persistCapability(key, val) {
  schemaCapabilities[key] = val;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('goc_schema_capabilities', JSON.stringify(schemaCapabilities));
    } catch {}
  }
}

// ============================================================================
// DATA MAPPERS (camelCase <-> snake_case)
// ============================================================================

export function mapTableToDb(t) {
  const defaultName = t.id ? (String(t.id).startsWith('Bàn') ? String(t.id) : `Bàn ${t.id}`) : 'Bàn';
  return {
    id: t.id,
    name: t.name || defaultName,
    capacity: Number(t.capacity) || 4,
    status: t.status || 'empty',
    active_order_id: t.activeOrderId || null,
    customer_count: Number(t.customerCount) || 0,
    seated_at: t.seatedAt || null
  };
}

export function mapTableFromDb(t) {
  return {
    id: t.id,
    name: t.name,
    capacity: t.capacity,
    status: t.status,
    activeOrderId: t.active_order_id,
    customerCount: t.customer_count,
    seatedAt: t.seated_at,
    billingLock: t.billing_lock || null
  };
}

export function mapCategoryToDb(c, index = 0) {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon || 'Coffee',
    sort_order: index
  };
}

export function mapCategoryFromDb(c) {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon
  };
}

export function mapMenuItemToDb(m) {
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    category_id: m.categoryId,
    base_price: Number(m.basePrice) || 0,
    description: m.description || '',
    toppings: m.toppings || [],
    in_stock: m.inStock !== false
  };
}

export function mapMenuItemFromDb(m) {
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    categoryId: m.category_id,
    basePrice: Number(m.base_price) || 0,
    description: m.description || '',
    toppings: m.toppings || [],
    inStock: m.in_stock !== false
  };
}

export function mapToppingToDb(t) {
  return {
    id: t.id,
    name: t.name,
    price: Number(t.price) || 0,
    in_stock: t.inStock !== false,
    is_global: t.isGlobal !== false
  };
}

export function mapToppingFromDb(t) {
  return {
    id: t.id,
    name: t.name,
    price: Number(t.price) || 0,
    inStock: t.in_stock !== false,
    isGlobal: t.is_global !== false
  };
}

export function mapProductToppingToDb(pt) {
  return {
    product_id: pt.productId,
    topping_id: pt.toppingId,
    price_override: pt.priceOverride !== null && pt.priceOverride !== undefined ? Number(pt.priceOverride) : null
  };
}

export function mapProductToppingFromDb(pt) {
  return {
    productId: pt.product_id,
    toppingId: pt.topping_id,
    priceOverride: pt.price_override
  };
}

export function mapOrderToBaseDb(o) {
  return {
    id: o.id,
    table_id: o.tableId || null,
    table_name: o.tableName || '',
    status: o.status || 'serving',
    cashier: o.cashier || '',
    customer_count: Number(o.customerCount) || 1,
    items: o.items || [],
    discount_percent: Number(o.discountPercent) || 0,
    surcharge: Number(o.surcharge) || 0,
    subtotal: Number(o.subtotal) || 0,
    total: Number(o.total) || 0,
    paid_amount: Number(o.paidAmount) || 0,
    remaining_amount: Number(o.remainingAmount) || 0,
    split_payments: o.splitPayments || [],
    payment_method: o.paymentMethod || null,
    created_at: o.createdAt || new Date().toISOString(),
    finished_at: o.finishedAt || null
  };
}

export function mapOrderToDb(o) {
  return {
    id: o.id,
    table_id: o.tableId || null,
    table_name: o.tableName || '',
    status: o.status || 'serving',
    cashier: o.cashier || '',
    customer_count: Number(o.customerCount) || 1,
    items: o.items || [],
    discount_percent: Number(o.discountPercent) || 0,
    surcharge: Number(o.surcharge) || 0,
    subtotal: Number(o.subtotal) || 0,
    total: Number(o.total) || 0,
    paid_amount: Number(o.paidAmount) || 0,
    remaining_amount: Number(o.remainingAmount) || 0,
    split_payments: o.splitPayments || [],
    payment_method: o.paymentMethod || null,
    business_date: o.businessDate || (o.createdAt ? getVietnamDateString(o.createdAt) : getVietnamTodayString()),
    carried_over_at: o.carriedOverAt || null,
    payment_status: o.paymentStatus || (o.status === 'completed' ? 'paid' : (Number(o.paidAmount) > 0 ? 'partial' : 'unpaid')),
    paid_at: o.paidAt || (o.status === 'completed' ? (o.finishedAt || o.createdAt) : null),
    payment_business_date: o.paymentBusinessDate || null,
    is_deleted: Boolean(o.isDeleted),
    deleted_at: o.deletedAt || null,
    deleted_by: o.deletedBy || null,
    is_demo: Boolean(o.isDemo),
    branch_id: o.branchId || 'main',
    version: Number(o.version) || 1,
    kitchen_sent_items: o.kitchenSentItems || o.kitchen_sent_items || [],
    created_at: o.createdAt || new Date().toISOString(),
    finished_at: o.finishedAt || null
  };
}

export function mapOrderFromDb(o) {
  return {
    id: o.id,
    tableId: o.table_id,
    tableName: o.table_name,
    status: o.status,
    cashier: o.cashier,
    customerCount: o.customer_count,
    items: o.items || [],
    discountPercent: Number(o.discount_percent) || 0,
    surcharge: Number(o.surcharge) || 0,
    subtotal: Number(o.subtotal) || 0,
    total: Number(o.total) || 0,
    paidAmount: Number(o.paid_amount) || 0,
    remainingAmount: Number(o.remaining_amount) || 0,
    splitPayments: o.split_payments || [],
    paymentMethod: o.payment_method,
    businessDate: o.business_date || (o.created_at ? getVietnamDateString(o.created_at) : getVietnamTodayString()),
    carriedOverAt: o.carried_over_at || null,
    paymentStatus: o.payment_status || (o.status === 'completed' ? 'paid' : 'unpaid'),
    paidAt: o.paid_at || (o.status === 'completed' ? (o.finished_at || o.created_at) : null),
    paymentBusinessDate: o.payment_business_date || null,
    isDeleted: Boolean(o.is_deleted),
    deletedAt: o.deleted_at || null,
    deletedBy: o.deleted_by || null,
    isDemo: Boolean(o.is_demo),
    branchId: o.branch_id || 'main',
    version: Number(o.version) || 1,
    kitchenSentItems: o.kitchen_sent_items || o.kitchenSentItems || [],
    createdAt: o.created_at,
    finishedAt: o.finished_at
  };
}

// ============================================================================
// PAYMENTS MAPPERS (HISTORICAL PAYMENTS)
// ============================================================================

export function mapPaymentToDb(p) {
  return {
    id: p.id,
    order_id: p.orderId,
    amount: Number(p.amount) || 0,
    payment_method: p.paymentMethod || 'cash',
    payment_status: p.paymentStatus || 'completed',
    paid_at: p.paidAt || new Date().toISOString(),
    business_date: p.businessDate || (p.paidAt ? getVietnamDateString(p.paidAt) : getVietnamTodayString()),
    cashier_id: p.cashierId || p.cashier || null,
    idempotency_key: p.idempotencyKey || null,
    notes: p.notes || null,
    metadata: p.metadata || {},
    created_at: p.createdAt || new Date().toISOString()
  };
}

export function mapPaymentFromDb(p) {
  return {
    id: p.id,
    orderId: p.order_id,
    amount: Number(p.amount) || 0,
    paymentMethod: p.payment_method,
    paymentStatus: p.payment_status,
    paidAt: p.paid_at,
    businessDate: p.business_date,
    cashierId: p.cashier_id,
    idempotencyKey: p.idempotency_key,
    notes: p.notes,
    metadata: p.metadata || {},
    createdAt: p.created_at
  };
}

// ============================================================================
// STAFF PROFILES & DATA CLEANUP MAPPERS (MILESTONE 4)
// ============================================================================

export function mapStaffProfileToDb(s) {
  if (!s || typeof s !== 'object') return null;
  const status = ['active', 'paused', 'inactive'].includes(s.status) ? s.status : 'active';
  const role = ['admin', 'staff', 'manager'].includes(s.role) ? s.role : 'staff';
  return {
    id: s.id,
    name: s.name ? String(s.name).trim() : '',
    status,
    role,
    branch_id: s.branchId || s.branch_id || 'main',
    created_at: s.createdAt || s.created_at || new Date().toISOString(),
    updated_at: s.updatedAt || s.updated_at || new Date().toISOString()
  };
}

export function mapStaffProfileFromDb(r) {
  if (!r || typeof r !== 'object') return null;
  return {
    id: r.id,
    name: r.name || '',
    status: r.status || 'active',
    role: r.role || 'staff',
    branchId: r.branch_id || r.branchId || 'main',
    createdAt: r.created_at || r.createdAt || new Date().toISOString(),
    updatedAt: r.updated_at || r.updatedAt || new Date().toISOString()
  };
}

export function mapDataCleanupJobToDb(job) {
  if (!job || typeof job !== 'object') return null;
  const mode = job.cleanupMode || job.cleanup_mode || job.jobMode || job.job_mode || job.mode || 'range';
  const criteria = job.dateRange || job.date_range || job.criteria || {};
  const ordersCount = Number(job.ordersCount ?? job.orders_count ?? job.count ?? 0) || 0;
  const totalAmount = Number(job.totalAmount ?? job.total_amount ?? job.totalRevenue ?? job.total_revenue ?? 0) || 0;
  const performedBy = job.performedBy || job.performed_by || job.executedBy || job.executed_by || 'Quản lý (Admin)';
  const backupFileName = job.backupFileName || job.backup_file_name || job.backupFilename || job.backup_filename || '';

  return {
    id: job.id || `clean_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    job_mode: mode,
    criteria,
    orders_count: ordersCount,
    total_revenue: totalAmount,
    backup_filename: backupFileName,
    backup_downloaded: Boolean(job.backupDownloaded ?? job.backup_downloaded ?? true),
    executed_by: performedBy,
    status: job.status || 'completed',
    created_at: job.createdAt || job.created_at || new Date().toISOString(),
    // Backward-compatibility fields
    cleanup_mode: mode,
    date_range: criteria,
    total_amount: totalAmount,
    performed_by: performedBy,
    backup_file_name: backupFileName
  };
}

export function mapDataCleanupJobFromDb(r) {
  if (!r || typeof r !== 'object') return null;
  return {
    id: r.id,
    cleanupMode: r.cleanup_mode || r.job_mode || 'range',
    jobMode: r.job_mode || r.cleanup_mode || 'range',
    dateRange: r.date_range || r.criteria || {},
    criteria: r.criteria || r.date_range || {},
    ordersCount: Number(r.orders_count ?? r.ordersCount ?? 0) || 0,
    totalAmount: Number(r.total_amount ?? r.total_revenue ?? r.totalAmount ?? 0) || 0,
    totalRevenue: Number(r.total_revenue ?? r.total_amount ?? r.totalRevenue ?? 0) || 0,
    performedBy: r.performed_by || r.executed_by || 'Quản lý (Admin)',
    executedBy: r.executed_by || r.performed_by || 'Quản lý (Admin)',
    backupFileName: r.backup_file_name || r.backup_filename || '',
    backupFilename: r.backup_filename || r.backup_file_name || '',
    backupDownloaded: Boolean(r.backup_downloaded),
    status: r.status || 'completed',
    createdAt: r.created_at || r.createdAt || new Date().toISOString()
  };
}

export const mapStaffToDb = mapStaffProfileToDb;
export const mapStaffFromDb = mapStaffProfileFromDb;
export const mapCleanupJobToDb = mapDataCleanupJobToDb;
export const mapCleanupJobFromDb = mapDataCleanupJobFromDb;


// ============================================================================
// HEALTH CHECK & SCHEMA DETECTION
// ============================================================================

export async function checkSupabaseHealth() {
  if (!isSupabaseConfigured || !supabase) {
    return { configured: false, connected: false, tablesExist: false, message: 'Chưa cấu hình Supabase URL/Key' };
  }

  const startTime = Date.now();
  try {
    const { error } = await supabase.from('tables').select('id').limit(1);
    const latency = Date.now() - startTime;

    if (error) {
      // PGRST205 / 404 nghĩa là connect ok nhưng table chưa tạo
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return {
          configured: true,
          connected: true,
          tablesExist: false,
          latency,
          message: 'Kết nối Supabase thành công nhưng chưa tạo Schema bảng.'
        };
      }
      return {
        configured: true,
        connected: false,
        tablesExist: false,
        latency,
        error: error.message,
        message: `Lỗi truy vấn: ${error.message}`
      };
    }

    return {
      configured: true,
      connected: true,
      tablesExist: true,
      latency,
      message: 'Kết nối Supabase hoạt động hoàn hảo'
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      tablesExist: false,
      error: err.message,
      message: 'Không thể kết nối mạng tới Supabase'
    };
  }
}

// ============================================================================
// FETCH ALL DATA
// ============================================================================

export async function fetchAllCloudData() {
  if (!supabase) return null;

  try {
    const queries = [
      supabase.from('tables').select('*'),
      supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('menu_items').select('*'),
      supabase.from('toppings').select('*'),
      supabase.from('product_toppings').select('*'),
      supabase.from('orders').select('*'),
      supabase.from('settings').select('*')
    ];

    if (schemaCapabilities.staff_profiles === true) {
      queries.push(supabase.from('staff_profiles').select('*').order('created_at', { ascending: true }));
    }

    const results = await Promise.all(queries);
    const tablesRes = results[0];
    const catsRes = results[1];
    const menuRes = results[2];
    const toppingsRes = results[3];
    const prodToppingsRes = results[4];
    const ordersRes = results[5];
    const settingsRes = results[6];
    const staffRes = results[7] || null;

    if (staffRes?.error) {
      if (staffRes.error.code === 'PGRST205' || staffRes.error.message?.includes('schema cache')) {
        schemaCapabilities.staff_profiles = false; persistCapability('staff_profiles', false);
      }
    } else if (staffRes && !staffRes.error) {
      schemaCapabilities.staff_profiles = true; persistCapability('staff_profiles', true);
    }

    // Nếu bất kỳ bảng chính nào lỗi (chưa tạo schema) thì return null để fallback
    if (tablesRes.error || catsRes.error || menuRes.error) {
      return null;
    }

    const tables = (tablesRes.data || []).map(mapTableFromDb);
    const categories = (catsRes.data || []).map(mapCategoryFromDb);
    const menu = (menuRes.data || []).map(mapMenuItemFromDb);
    const toppings = (toppingsRes.data || []).map(mapToppingFromDb);
    const productToppings = (prodToppingsRes.data || []).map(mapProductToppingFromDb);

    // Tách orders: active orders (status !== completed) và orderHistory (status === completed)
    const allOrders = (ordersRes.data || []).map(mapOrderFromDb);
    const activeOrdersObj = {};
    const orderHistoryArr = [];

    allOrders.forEach((ord) => {
      if (ord.status === 'completed' || ord.status === 'cancelled' || ord.status === 'unpaid_carried_over') {
        orderHistoryArr.push(ord);
      } else {
        activeOrdersObj[ord.id] = ord;
      }
    });

    let settings = null;
    let fallbackStaff = [];
    if (settingsRes.data && settingsRes.data.length > 0) {
      const configItem = settingsRes.data.find((s) => s.key === 'pos_config');
      if (configItem && configItem.value) {
        settings = configItem.value;
      }
      const staffItem = settingsRes.data.find((s) => s.key === 'pos_staff_profiles');
      if (staffItem && Array.isArray(staffItem.value)) {
        fallbackStaff = staffItem.value;
      }
    }

    if (schemaCapabilities.store_settings === true) {
      try {
        const { data: storeRow, error: storeErr } = await supabase
          .from('store_settings')
          .select('*')
          .eq('store_id', 'default_store')
          .maybeSingle();

        if (storeErr && (storeErr.code === 'PGRST205' || storeErr.message?.includes('schema cache'))) {
          schemaCapabilities.store_settings = false; persistCapability('store_settings', false);
        } else if (storeRow) {
          schemaCapabilities.store_settings = true; persistCapability('store_settings', true);
          const mapped = mapStoreSettingsFromDb(storeRow);
          settings = { ...(settings || {}), ...mapped };
        }
      } catch {
        schemaCapabilities.store_settings = false; persistCapability('store_settings', false);
      }
    }

    const staff = (staffRes && !staffRes.error && Array.isArray(staffRes.data) && staffRes.data.length > 0)
      ? staffRes.data.map(mapStaffProfileFromDb)
      : fallbackStaff;

    let payments = [];
    if (schemaCapabilities.payments === true) {
      try {
        const paymentsRes = await supabase.from('payments').select('*').order('paid_at', { ascending: false }).limit(500);
        if (paymentsRes?.error && (paymentsRes.error.code === 'PGRST205' || paymentsRes.error.message?.includes('schema cache'))) {
          schemaCapabilities.payments = false; persistCapability('payments', false);
        } else if (paymentsRes && !paymentsRes.error && Array.isArray(paymentsRes.data)) {
          schemaCapabilities.payments = true; persistCapability('payments', true);
          payments = paymentsRes.data.map(mapPaymentFromDb);
        }
      } catch {
        schemaCapabilities.payments = false; persistCapability('payments', false);
      }
    }

    return {
      tables,
      categories,
      menu,
      toppings,
      productToppings,
      orders: activeOrdersObj,
      orderHistory: orderHistoryArr,
      settings,
      staff,
      staffList: staff,
      payments
    };
  } catch (err) {
    console.warn('Lỗi tải dữ liệu Cloud Supabase:', err);
    return null;
  }
}

// ============================================================================
// SEED INITIAL DATA TO CLOUD
// ============================================================================

export async function seedInitialDataToCloud(data) {
  if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase' };

  try {
    // 1. Categories
    if (data.categories?.length) {
      const { error } = await supabase
        .from('categories')
        .upsert(data.categories.map((c, i) => mapCategoryToDb(c, i)));
      if (error) throw error;
    }

    // 2. Toppings
    if (data.toppings?.length) {
      const { error } = await supabase
        .from('toppings')
        .upsert(data.toppings.map(mapToppingToDb));
      if (error) throw error;
    }

    // 3. Menu items
    if (data.menu?.length) {
      const { error } = await supabase
        .from('menu_items')
        .upsert(data.menu.map(mapMenuItemToDb));
      if (error) throw error;
    }

    // 4. Product Toppings
    if (data.productToppings?.length) {
      const { error } = await supabase
        .from('product_toppings')
        .upsert(data.productToppings.map(mapProductToppingToDb));
      if (error) throw error;
    }

    // 5. Tables
    if (data.tables?.length) {
      const { error } = await supabase
        .from('tables')
        .upsert(data.tables.map(mapTableToDb));
      if (error) throw error;
    }

    // 6. Orders
    const ordersToSeed = [];
    if (data.orders) {
      Object.values(data.orders).forEach((ord) => ordersToSeed.push(mapOrderToDb(ord)));
    }
    if (data.orderHistory?.length) {
      data.orderHistory.forEach((ord) => ordersToSeed.push(mapOrderToDb(ord)));
    }
    if (ordersToSeed.length) {
      let { error } = await supabase.from('orders').upsert(ordersToSeed);
      if (error && (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes('business_date'))) {
        const fallbackOrders = ordersToSeed.map(mapOrderToBaseDb);
        const fbRes = await supabase.from('orders').upsert(fallbackOrders);
        error = fbRes.error;
      }
      if (error) throw error;
    }

    // 7. Settings
    if (data.settings) {
      const { error } = await supabase
        .from('settings')
        .upsert([{ key: 'pos_config', value: data.settings, updated_at: new Date().toISOString() }]);
      if (error) throw error;
    }

    // 8. Staff Profiles
    const staffToSeed = data.staff || data.staffList || [];
    if (staffToSeed.length) {
      const { error } = await supabase
        .from('staff_profiles')
        .upsert(staffToSeed.map(mapStaffProfileToDb));
      if (error) console.warn('Lỗi seed staff_profiles:', error.message);
    }

    return { success: true, message: 'Khởi tạo dữ liệu lên Supabase thành công!' };
  } catch (err) {
    console.error('Lỗi seed data lên Cloud:', err);
    return { success: false, message: err.message };
  }
}

// ============================================================================
// MUTATION HELPERS
// ============================================================================

export async function cloudUpsertTable(table) {
  if (!supabase || !table) return { success: false };
  try {
    const { error } = await supabase.from('tables').upsert(mapTableToDb(table), { onConflict: 'id' });
    if (error) {
      console.warn('Lỗi cloudUpsertTable:', error);
      return { success: false, error };
    }
    return { success: true };
  } catch (e) {
    console.warn('Lỗi cloudUpsertTable:', e);
    return { success: false, error: e };
  }
}

export async function cloudDeleteTable(tableId) {
  if (!supabase) return { success: false };
  try {
    const { error } = await supabase.from('tables').delete().eq('id', tableId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.warn('Lỗi cloudDeleteTable:', e);
    return { success: false, error: e };
  }
}

export async function cloudUpsertOrder(order) {
  if (!supabase || !order) return { success: false };
  try {
    const basePayload = mapOrderToBaseDb(order);
    const { error } = await supabase.from('orders').upsert(basePayload, { onConflict: 'id' });
    if (error) {
      console.warn('Lỗi cloudUpsertOrder:', error);
      return { success: false, error };
    }
    return { success: true };
  } catch (e) {
    console.warn('Lỗi cloudUpsertOrder:', e);
    return { success: false, error: e };
  }
}

export async function cloudDeleteOrder(orderId) {
  if (!supabase) return;
  try {
    await supabase.from('orders').delete().eq('id', orderId);
  } catch (e) {
    console.warn('Lỗi cloudDeleteOrder:', e);
  }
}

export async function cloudUpsertMenuItem(item) {
  if (!supabase) return;
  try {
    await supabase.from('menu_items').upsert(mapMenuItemToDb(item));
  } catch (e) {
    console.warn('Lỗi cloudUpsertMenuItem:', e);
  }
}

export async function cloudDeleteMenuItem(itemId) {
  if (!supabase) return;
  try {
    await supabase.from('menu_items').delete().eq('id', itemId);
  } catch (e) {
    console.warn('Lỗi cloudDeleteMenuItem:', e);
  }
}

export async function cloudUpsertTopping(topping) {
  if (!supabase) return;
  try {
    await supabase.from('toppings').upsert(mapToppingToDb(topping));
  } catch (e) {
    console.warn('Lỗi cloudUpsertTopping:', e);
  }
}

export async function cloudDeleteTopping(toppingId) {
  if (!supabase) return;
  try {
    await supabase.from('toppings').delete().eq('id', toppingId);
  } catch (e) {
    console.warn('Lỗi cloudDeleteTopping:', e);
  }
}

export async function cloudUpsertCategory(category) {
  if (!supabase) return;
  try {
    await supabase.from('categories').upsert(mapCategoryToDb(category));
  } catch (e) {
    console.warn('Lỗi cloudUpsertCategory:', e);
  }
}

export async function cloudDeleteCategory(categoryId) {
  if (!supabase) return;
  try {
    await supabase.from('categories').delete().eq('id', categoryId);
  } catch (e) {
    console.warn('Lỗi cloudDeleteCategory:', e);
  }
}

export async function cloudUpsertProductTopping(pt) {
  if (!supabase) return;
  try {
    await supabase.from('product_toppings').upsert(mapProductToppingToDb(pt));
  } catch (e) {
    console.warn('Lỗi cloudUpsertProductTopping:', e);
  }
}

export async function cloudDeleteProductTopping(productId, toppingId) {
  if (!supabase) return;
  try {
    await supabase
      .from('product_toppings')
      .delete()
      .eq('product_id', productId)
      .eq('topping_id', toppingId);
  } catch (e) {
    console.warn('Lỗi cloudDeleteProductTopping:', e);
  }
}

export async function cloudUpsertSettings(settings) {
  if (!supabase) return;
  try {
    await supabase
      .from('settings')
      .upsert([{ key: 'pos_config', value: settings, updated_at: new Date().toISOString() }], { onConflict: 'key' });

    if (schemaCapabilities.store_settings !== false) {
      const dbRow = mapStoreSettingsToDb(settings);
      const { error } = await supabase
        .from('store_settings')
        .upsert(dbRow, { onConflict: 'store_id' });
      if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache'))) {
        schemaCapabilities.store_settings = false; persistCapability('store_settings', false);
      } else if (!error) {
        schemaCapabilities.store_settings = true; persistCapability('store_settings', true);
      }
    }
  } catch (e) {
    console.warn('Lỗi cloudUpsertSettings:', e);
  }
}

// ============================================================================
// STAFF PROFILES & DATA CLEANUP OPERATIONS (MILESTONE 4)
// ============================================================================

/**
 * Fetch all staff profiles from Supabase, ordered by created_at asc.
 * Gracefully degrades to [] if Supabase is offline or not configured.
 */
export async function fetchStaffProfiles() {
  const fallback = [];
  fallback.data = [];
  fallback.error = null;

  if (!supabase || schemaCapabilities.staff_profiles === false) return fallback;

  try {
    const { data, error } = await supabase
      .from('staff_profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        schemaCapabilities.staff_profiles = false; persistCapability('staff_profiles', false);
      }
      fallback.error = error;
      return fallback;
    }

    schemaCapabilities.staff_profiles = true; persistCapability('staff_profiles', true);
    const mapped = (data || []).map(mapStaffProfileFromDb);
    mapped.data = mapped;
    mapped.error = null;
    return mapped;
  } catch (err) {
    fallback.error = err;
    return fallback;
  }
}

/**
 * Upsert a single staff profile to Supabase.
 */
export async function upsertStaffProfile(staff) {
  if (!supabase) {
    return { success: false, data: null, error: new Error('Supabase client is not configured or offline') };
  }
  if (!staff || typeof staff !== 'object') {
    return { success: false, data: null, error: new Error('Invalid staff payload') };
  }

  if (schemaCapabilities.staff_profiles === false) {
    try {
      const { data: currentSettings } = await supabase.from('settings').select('*').eq('key', 'pos_staff_profiles').maybeSingle();
      const existing = currentSettings?.value && Array.isArray(currentSettings.value) ? currentSettings.value : [];
      const updated = [...existing.filter(s => s.id !== staff.id), staff];
      await supabase.from('settings').upsert([{ key: 'pos_staff_profiles', value: updated, updated_at: new Date().toISOString() }], { onConflict: 'key' });
      return { success: true, data: staff, error: null };
    } catch {
      return { success: true, data: staff, error: null };
    }
  }

  try {
    const dbRecord = mapStaffProfileToDb(staff);
    const { data, error } = await supabase
      .from('staff_profiles')
      .upsert(dbRecord)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        schemaCapabilities.staff_profiles = false; persistCapability('staff_profiles', false);
        return upsertStaffProfile(staff);
      }
      return { success: false, data: null, error };
    }

    schemaCapabilities.staff_profiles = true; persistCapability('staff_profiles', true);
    const mapped = data ? mapStaffProfileFromDb(data) : staff;
    return { success: true, data: mapped, error: null };
  } catch (err) {
    return { success: false, data: null, error: err };
  }
}
export const cloudUpsertStaff = upsertStaffProfile;
export const cloudUpsertStaffProfile = upsertStaffProfile;

/**
 * Bulk upsert staff profiles to Supabase.
 */
export async function bulkUpsertStaffProfiles(staffList = []) {
  if (!supabase) {
    return { success: false, count: 0, error: new Error('Supabase client is not configured or offline') };
  }
  if (!Array.isArray(staffList) || staffList.length === 0) {
    return { success: true, count: 0, error: null };
  }

  if (schemaCapabilities.staff_profiles === false) {
    try {
      await supabase.from('settings').upsert([{ key: 'pos_staff_profiles', value: staffList, updated_at: new Date().toISOString() }], { onConflict: 'key' });
      return { success: true, count: staffList.length, error: null };
    } catch {
      return { success: true, count: staffList.length, error: null };
    }
  }

  try {
    const records = staffList
      .map(mapStaffProfileToDb)
      .filter(Boolean);

    if (records.length === 0) {
      return { success: true, count: 0, error: null };
    }

    const { data, error } = await supabase
      .from('staff_profiles')
      .upsert(records)
      .select();

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        schemaCapabilities.staff_profiles = false; persistCapability('staff_profiles', false);
        return bulkUpsertStaffProfiles(staffList);
      }
      return { success: false, count: 0, error };
    }

    schemaCapabilities.staff_profiles = true; persistCapability('staff_profiles', true);
    const mapped = (data || []).map(mapStaffProfileFromDb);
    return { success: true, count: records.length, data: mapped, error: null };
  } catch (err) {
    return { success: false, count: 0, error: err };
  }
}

/**
 * Delete a staff profile from Supabase by id.
 */
export async function deleteStaffProfile(staffId) {
  if (!supabase) return { success: false, error: new Error('Supabase not configured or offline') };
  if (schemaCapabilities.staff_profiles === false) {
    try {
      const { data: currentSettings } = await supabase.from('settings').select('*').eq('key', 'pos_staff_profiles').maybeSingle();
      const existing = currentSettings?.value && Array.isArray(currentSettings.value) ? currentSettings.value : [];
      const updated = existing.filter(s => s.id !== staffId);
      await supabase.from('settings').upsert([{ key: 'pos_staff_profiles', value: updated, updated_at: new Date().toISOString() }], { onConflict: 'key' });
      return { success: true, error: null };
    } catch {
      return { success: true, error: null };
    }
  }
  try {
    const { error } = await supabase.from('staff_profiles').delete().eq('id', staffId);
    if (error) throw error;
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err };
  }
}
export const cloudDeleteStaff = deleteStaffProfile;
export const cloudDeleteStaffProfile = deleteStaffProfile;

/**
 * Log an audit record to data_cleanup_jobs in Supabase.
 */
export async function logDataCleanupJob(jobData) {
  if (!supabase) {
    return { success: false, data: null, error: new Error('Supabase client is not configured or offline') };
  }
  if (!jobData || typeof jobData !== 'object') {
    return { success: false, data: null, error: new Error('Invalid jobData payload') };
  }

  try {
    const record = mapDataCleanupJobToDb(jobData);
    const { data, error } = await supabase
      .from('data_cleanup_jobs')
      .insert(record)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Lỗi logDataCleanupJob:', error.message);
      return { success: false, data: null, error };
    }

    const mapped = data ? mapDataCleanupJobFromDb(data) : record;
    return { success: true, data: mapped, error: null };
  } catch (err) {
    console.warn('Lỗi logDataCleanupJob (exception):', err?.message || err);
    return { success: false, data: null, error: err };
  }
}
export const cloudRecordCleanupJob = logDataCleanupJob;

/**
 * Batch delete orders from Supabase in chunks of 50.
 * Strictly operates on the 'orders' table without affecting tables or menu items.
 */
export async function batchDeleteOrders(orderIds = [], batchSize = 50) {
  if (!supabase) {
    return { success: false, deletedCount: 0, error: new Error('Supabase client is not configured or offline') };
  }

  let ids = [];
  if (Array.isArray(orderIds)) {
    ids = orderIds
      .map((item) => (typeof item === 'object' && item !== null ? item.id : item))
      .filter((id) => typeof id === 'string' && id.trim().length > 0);
  } else if (typeof orderIds === 'string' && orderIds.trim().length > 0) {
    ids = [orderIds.trim()];
  }

  if (ids.length === 0) {
    return { success: true, deletedCount: 0, error: null };
  }

  try {
    const safeChunkSize = Math.max(1, Number(batchSize) || 50);
    let totalDeleted = 0;

    for (let i = 0; i < ids.length; i += safeChunkSize) {
      const chunk = ids.slice(i, i + safeChunkSize);
      const { error } = await supabase
        .from('orders')
        .delete()
        .in('id', chunk);

      if (error) {
        console.warn(`Lỗi batchDeleteOrders tại chunk ${Math.floor(i / safeChunkSize) + 1}:`, error.message);
        return {
          success: false,
          deletedCount: totalDeleted,
          failedChunk: chunk,
          error
        };
      }
      totalDeleted += chunk.length;
    }

    return { success: true, deletedCount: totalDeleted, error: null };
  } catch (err) {
    console.warn('Lỗi batchDeleteOrders (exception):', err?.message || err);
    return { success: false, deletedCount: 0, error: err };
  }
}
export const cloudBatchDeleteOrders = batchDeleteOrders;

// ============================================================================
// DAILY ORDER ROLLOVER & HISTORICAL PAYMENTS (SUPER TASK)
// ============================================================================

/**
 * Executes atomic daily rollover of uncompleted orders from previous business dates on Cloud.
 */
export async function rolloverDailyOrdersRpc(targetBusinessDate) {
  if (!supabase || schemaCapabilities.rollover_daily_orders === false) {
    return { success: false, rolledOrdersCount: 0, releasedTablesCount: 0 };
  }
  try {
    const { data, error } = await supabase.rpc('rollover_daily_orders', {
      p_target_business_date: targetBusinessDate
    });
    if (error) {
      if (error.code === 'PGRST202' || error.message?.includes('Could not find') || error.message?.includes('schema cache')) {
        schemaCapabilities.rollover_daily_orders = false; persistCapability('rollover_daily_orders', false);
      }
      return { success: false, error };
    }
    schemaCapabilities.rollover_daily_orders = true; persistCapability('rollover_daily_orders', true);
    return data || { success: true };
  } catch (err) {
    schemaCapabilities.rollover_daily_orders = false; persistCapability('rollover_daily_orders', false);
    return { success: false, error: err };
  }
}

/**
 * Executes atomic checkout of historical carried-over order on Cloud.
 */
export async function processHistoricalPaymentRpc({
  orderId,
  paymentMethod = 'cash',
  amount,
  paymentBusinessDate,
  cashier = 'Thu ngân',
  idempotencyKey = null
}) {
  if (!supabase) return { success: false, error: new Error('Supabase not configured') };
  try {
    const { data, error } = await supabase.rpc('process_historical_payment', {
      p_order_id: orderId,
      p_payment_method: paymentMethod,
      p_amount: amount,
      p_payment_business_date: paymentBusinessDate,
      p_cashier: cashier,
      p_idempotency_key: idempotencyKey
    });
    if (error) {
      console.warn('Lỗi processHistoricalPaymentRpc:', error.message);
      return { success: false, error };
    }
    return data || { success: true };
  } catch (err) {
    console.warn('Lỗi processHistoricalPaymentRpc (exception):', err?.message || err);
    return { success: false, error: err };
  }
}

/**
 * Upsert a payment record to Supabase
 */
export async function cloudUpsertPayment(payment) {
  if (!supabase || !payment) return { success: false };
  if (schemaCapabilities.payments === false) {
    return { success: false, skipped: true };
  }
  try {
    const { error } = await supabase.from('payments').upsert(mapPaymentToDb(payment));
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        schemaCapabilities.payments = false; persistCapability('payments', false);
      }
      return { success: false, error };
    }
    schemaCapabilities.payments = true; persistCapability('payments', true);
    return { success: true };
  } catch (e) {
    console.warn('Lỗi cloudUpsertPayment:', e);
    return { success: false, error: e };
  }
}

/**
 * Fetch payments for a given business date
 */
export async function fetchPaymentsByBusinessDate(businessDate) {
  if (!supabase || !businessDate || schemaCapabilities.payments !== true) return [];
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('business_date', businessDate)
      .order('paid_at', { ascending: true });
    if (error) {
      console.warn('Lỗi fetchPaymentsByBusinessDate:', error.message);
      return [];
    }
    return (data || []).map(mapPaymentFromDb);
  } catch (e) {
    console.warn('Lỗi fetchPaymentsByBusinessDate (exception):', e);
    return [];
  }
}

// ============================================================================
// ATOMIC POS ORDER SAVE & FINALIZATION (OPTIMIZATION RPCs)
// ============================================================================

/**
 * Atomic Order Save with Optimistic Concurrency Control (OCC)
 */
export async function savePosOrderAtomicRpc({ order, table, expectedVersion = null }) {
  if (!supabase || !order || !table) {
    return { success: false, fallback: true };
  }
  if (schemaCapabilities.atomic_save_order === false) {
    const resOrder = await cloudUpsertOrder(order);
    const resTable = await cloudUpsertTable(table);
    return { success: resOrder.success && resTable.success, fallback: true };
  }

  try {
    const { data, error } = await supabase.rpc('save_pos_order_atomic_v2', {
      p_order: mapOrderToBaseDb(order),
      p_table: mapTableToDb(table),
      p_expected_version: expectedVersion
    });

    if (error) {
      if (error.code === 'PGRST202' || error.message?.includes('Could not find') || error.message?.includes('schema cache')) {
        schemaCapabilities.atomic_save_order = false;
        persistCapability('atomic_save_order', false);
        const resOrder = await cloudUpsertOrder(order);
        const resTable = await cloudUpsertTable(table);
        return { success: resOrder.success && resTable.success, fallback: true };
      }
      return { success: false, error };
    }

    schemaCapabilities.atomic_save_order = true;
    persistCapability('atomic_save_order', true);
    return data || { success: true, atomic: true };
  } catch (err) {
    const resOrder = await cloudUpsertOrder(order);
    const resTable = await cloudUpsertTable(table);
    return { success: resOrder.success && resTable.success, fallback: true, error: err };
  }
}

/**
 * Atomic Order Finalization & Payment Processing with Idempotency
 */
export async function finalizePosOrderAtomicRpc({
  orderId,
  tableId,
  amount,
  paymentMethod = 'cash',
  cashier = 'Thu ngân',
  idempotencyKey = null,
  finalOrder = null,
  resetTable = null
}) {
  if (!supabase || !orderId) {
    return { success: false, fallback: true };
  }
  if (schemaCapabilities.atomic_finalize_order === false) {
    if (finalOrder) await cloudUpsertOrder(finalOrder);
    if (resetTable) await cloudUpsertTable(resetTable);
    if (amount && finalOrder) {
      cloudUpsertPayment({
        id: `PAY_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        orderId,
        amount,
        paymentMethod,
        paymentStatus: 'completed',
        businessDate: finalOrder.businessDate || getVietnamTodayString(),
        paidAt: new Date().toISOString(),
        idempotencyKey
      }).catch(() => {});
    }
    return { success: true, fallback: true };
  }

  try {
    const { data, error } = await supabase.rpc('finalize_pos_order_atomic_v2', {
      p_order_id: orderId,
      p_table_id: tableId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_cashier: cashier,
      p_idempotency_key: idempotencyKey,
      p_final_order: finalOrder ? mapOrderToBaseDb(finalOrder) : null,
      p_reset_table: resetTable ? mapTableToDb(resetTable) : null
    });

    if (error) {
      if (error.code === 'PGRST202' || error.message?.includes('Could not find') || error.message?.includes('schema cache')) {
        schemaCapabilities.atomic_finalize_order = false;
        persistCapability('atomic_finalize_order', false);
        if (finalOrder) await cloudUpsertOrder(finalOrder);
        if (resetTable) await cloudUpsertTable(resetTable);
        return { success: true, fallback: true };
      }
      return { success: false, error };
    }

    schemaCapabilities.atomic_finalize_order = true;
    persistCapability('atomic_finalize_order', true);
    return data || { success: true, atomic: true };
  } catch (err) {
    if (finalOrder) await cloudUpsertOrder(finalOrder);
    if (resetTable) await cloudUpsertTable(resetTable);
    return { success: true, fallback: true, error: err };
  }
}

// ============================================================================
// AUDIT LOGS & RBAC RPC HELPERS
// ============================================================================

export function mapAuditLogToDb(log) {
  return {
    id: log.id || undefined,
    user_id: log.userId || null,
    role: log.role || 'staff',
    action: log.action || 'system',
    resource: log.resource || 'unknown',
    resource_id: log.resourceId || null,
    details: log.details || {},
    ip_address: log.ipAddress || null,
    created_at: log.createdAt || new Date().toISOString()
  };
}

export function mapAuditLogFromDb(r) {
  return {
    id: r.id,
    userId: r.user_id,
    role: r.role,
    action: r.action,
    resource: r.resource,
    resourceId: r.resource_id,
    details: r.details || {},
    ipAddress: r.ip_address,
    createdAt: r.created_at
  };
}

export async function adminChangeUserRoleRpc(targetUserId, newRole) {
  if (!supabase) return { success: false, error: new Error('Supabase client not initialized') };
  try {
    const { data, error } = await supabase.rpc('admin_change_user_role', {
      p_target_user_id: targetUserId,
      p_new_role: newRole
    });
    if (error) {
      console.warn('Lỗi adminChangeUserRoleRpc:', error.message);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.warn('Lỗi adminChangeUserRoleRpc (exception):', err?.message || err);
    return { success: false, error: err };
  }
}

export async function adminArchiveOrdersRpc(orderIds, reason = 'Dọn dẹp lưu trữ an toàn') {
  if (!supabase) return { success: false, error: new Error('Supabase client not initialized') };
  try {
    const { data, error } = await supabase.rpc('admin_archive_orders', {
      p_order_ids: orderIds,
      p_reason: reason
    });
    if (error) {
      console.warn('Lỗi adminArchiveOrdersRpc:', error.message);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.warn('Lỗi adminArchiveOrdersRpc (exception):', err?.message || err);
    return { success: false, error: err };
  }
}

/**
 * Hard delete sales data via Supabase RPC 'admin_hard_delete_sales_data'.
 * Atomic execution:
 * 1. Verifies caller is Admin and matches branch_id.
 * 2. Shields active dining tables.
 * 3. Deletes child payments rows.
 * 4. Unlinks tables active_order_id.
 * 5. Deletes parent orders rows.
 * 6. Records immutable audit entry in data_cleanup_jobs and audit_logs.
 *
 * @param {Array<string>} orderIds List of order IDs to hard delete
 * @param {Object} metadata { mode, criteria, expectedCount, reason, backupFileName }
 * @returns {Promise<{ success: boolean, count: number, error?: any, message?: string, data?: any }>}
 */
export async function adminHardDeleteSalesDataRpc(orderIds = [], metadata = {}) {
  let ids = [];
  if (Array.isArray(orderIds)) {
    ids = orderIds
      .map((item) => (typeof item === 'object' && item !== null ? item.id : item))
      .filter((id) => typeof id === 'string' && id.trim().length > 0);
  } else if (typeof orderIds === 'string' && orderIds.trim().length > 0) {
    ids = [orderIds.trim()];
  }

  if (ids.length === 0) {
    return { success: true, count: 0, error: null, message: 'Không có đơn hàng nào cần xóa.' };
  }

  if (!supabase) {
    return {
      success: false,
      count: 0,
      error: new Error('Supabase client is not configured or offline'),
      message: 'Supabase chưa được cấu hình hoặc đang ngoại tuyến'
    };
  }

  try {
    const { data, error } = await supabase.rpc('admin_hard_delete_sales_data', {
      p_order_ids: ids,
      p_mode: metadata.mode || metadata.cleanupMode || 'range',
      p_criteria: metadata.criteria || metadata.dateRange || {},
      p_expected_count: metadata.ordersCount ?? metadata.expectedCount ?? ids.length,
      p_reason: metadata.reason || 'Xóa vĩnh viễn dữ liệu bán hàng',
      p_backup_filename: metadata.backupFileName || metadata.backup_file_name || null
    });

    if (error) {
      console.error('Lỗi khi gọi admin_hard_delete_sales_data RPC:', error.message || error);
      return {
        success: false,
        count: 0,
        error,
        message: error.message || 'Lỗi từ máy chủ cơ sở dữ liệu'
      };
    }

    const res = typeof data === 'object' && data !== null ? data : {};
    return {
      success: res.success !== false,
      count: res.count ?? res.deleted_orders_count ?? 0,
      deletedOrdersCount: res.deleted_orders_count ?? 0,
      deletedPaymentsCount: res.deleted_payments_count ?? 0,
      unlinkedTablesCount: res.unlinked_tables_count ?? 0,
      totalRevenue: res.total_revenue ?? 0,
      message: res.message || 'Xóa dữ liệu thành công',
      data: res
    };
  } catch (err) {
    console.error('Ngoại lệ khi gọi adminHardDeleteSalesDataRpc:', err?.message || err);
    return {
      success: false,
      count: 0,
      error: err,
      message: err?.message || 'Lỗi ngoại lệ khi thực hiện xóa dữ liệu'
    };
  }
}

export async function fetchAuditLogs(limit = 100) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.warn('Lỗi fetchAuditLogs:', error.message);
      return [];
    }
    return (data || []).map(mapAuditLogFromDb);
  } catch (err) {
    console.warn('Lỗi fetchAuditLogs (exception):', err?.message || err);
    return [];
  }
}

export async function cloudRecordAuditLog(log) {
  if (!supabase || !log) return;
  try {
    await supabase.from('audit_logs').insert(mapAuditLogToDb(log));
  } catch (e) {
    console.warn('Lỗi cloudRecordAuditLog:', e);
  }
}

// ============================================================================
// AUTHENTICATION & USER PROFILE OPERATIONS (AUTH V1)
// ============================================================================

export async function signInWithEmail(email, password) {
  if (!supabase) {
    return { success: false, error: new Error('Supabase client chưa được cấu hình') };
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) {
      return { success: false, error, message: error.message };
    }
    return { success: true, user: data.user, session: data.session };
  } catch (err) {
    return { success: false, error: err, message: err?.message || 'Lỗi kết nối xác thực' };
  }
}

export async function signOutUser() {
  if (!supabase) return { success: true };
  try {
    const { error } = await supabase.auth.signOut();
    if (error) console.warn('Lỗi signOut:', error.message);
    return { success: !error };
  } catch (err) {
    console.warn('Lỗi ngoại lệ khi signOut:', err);
    return { success: false, error: err };
  }
}

export async function getCurrentSession() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch (err) {
    console.warn('Lỗi getCurrentSession:', err);
    return null;
  }
}

export async function fetchUserProfileAndRole(userId) {
  if (!supabase || !userId) return null;
  if (!schemaCapabilities.profiles && !schemaCapabilities.staff_profiles) return null;

  try {
    let profileData = null;
    let roleData = null;

    if (schemaCapabilities.profiles === true) {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('*').eq('user_id', userId).maybeSingle()
      ]);

      if (profileRes?.error && (profileRes.error.code === 'PGRST205' || profileRes.error.message?.includes('schema cache'))) {
        schemaCapabilities.profiles = false; persistCapability('profiles', false);
        schemaCapabilities.user_roles = false; persistCapability('user_roles', false);
      } else {
        profileData = profileRes?.data || null;
        roleData = roleRes?.data || null;
      }
    }

    if (profileData) {
      schemaCapabilities.profiles = true; persistCapability('profiles', true);
      return {
        id: userId,
        email: profileData.email,
        name: profileData.name || 'Nhân viên',
        role: roleData?.role || profileData.role || 'staff',
        status: profileData.status || 'active',
        avatarUrl: profileData.avatar_url || null,
        phone: profileData.phone || '',
        branchId: profileData.branch_id || 'main'
      };
    }

    if (schemaCapabilities.staff_profiles === true) {
      const { data: staffData, error: staffErr } = await supabase
        .from('staff_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (staffErr && (staffErr.code === 'PGRST205' || staffErr.message?.includes('schema cache'))) {
        schemaCapabilities.staff_profiles = false; persistCapability('staff_profiles', false);
      } else if (staffData) {
        schemaCapabilities.staff_profiles = true; persistCapability('staff_profiles', true);
        return {
          id: userId,
          email: staffData.email,
          name: staffData.name || 'Nhân viên',
          role: staffData.role || 'staff',
          status: staffData.status || 'active',
          avatarUrl: null,
          phone: staffData.phone || '',
          branchId: staffData.branch_id || 'main'
        };
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

export async function updateUserProfile(userId, updates = {}) {
  if (!supabase || !userId) return { success: false };
  try {
    const payload = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Lỗi updateUserProfile:', error.message);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.warn('Lỗi updateUserProfile exception:', err);
    return { success: false, error: err };
  }
}


// ============================================================================
// DAILY CLOSURES MAPPERS & SYNC (PHASE 3)
// ============================================================================

export function mapDailyClosureToDb(c) {
  return {
    date: c.date,
    closed_at: c.closedAt || new Date().toISOString(),
    total_revenue: Number(c.totalRevenue) || 0,
    total_orders: Number(c.totalOrders) || 0,
    cash_total: Number(c.cashTotal) || 0,
    qr_total: Number(c.qrTotal) || 0,
    average_order_value: Number(c.averageOrderValue) || 0,
    total_discount: Number(c.totalDiscount) || 0,
    total_surcharge: Number(c.totalSurcharge) || 0,
    top_products: c.topProducts || [],
    hourly_distribution: c.hourlyDistribution || {},
    notes: c.notes || null,
    branch_id: c.branchId || 'main'
  };
}

export function mapDailyClosureFromDb(c) {
  return {
    date: c.date,
    closedAt: c.closed_at,
    totalRevenue: Number(c.total_revenue) || 0,
    totalOrders: Number(c.total_orders) || 0,
    cashTotal: Number(c.cash_total) || 0,
    qrTotal: Number(c.qr_total) || 0,
    averageOrderValue: Number(c.average_order_value) || 0,
    totalDiscount: Number(c.total_discount) || 0,
    totalSurcharge: Number(c.total_surcharge) || 0,
    topProducts: c.top_products || [],
    hourlyDistribution: c.hourly_distribution || {},
    notes: c.notes || '',
    branchId: c.branch_id || 'main'
  };
}

export async function upsertDailyClosureToCloud(closureData) {
  if (!supabase || !closureData?.date) return { success: false };
  if (schemaCapabilities.daily_closures === false) {
    try {
      const { data: currentSettings } = await supabase.from('settings').select('*').eq('key', 'pos_daily_closures').maybeSingle();
      const existingList = currentSettings?.value && Array.isArray(currentSettings.value) ? currentSettings.value : [];
      const updatedList = [closureData, ...existingList.filter(c => c.date !== closureData.date)];
      await supabase.from('settings').upsert([{ key: 'pos_daily_closures', value: updatedList, updated_at: new Date().toISOString() }], { onConflict: 'key' });
      return { success: true, data: closureData };
    } catch {
      return { success: true, data: closureData };
    }
  }

  try {
    const payload = mapDailyClosureToDb(closureData);
    const { data, error } = await supabase
      .from('daily_closures')
      .upsert(payload, { onConflict: 'date' })
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        schemaCapabilities.daily_closures = false; persistCapability('daily_closures', false);
        return upsertDailyClosureToCloud(closureData);
      }
      return { success: false, error };
    }

    schemaCapabilities.daily_closures = true; persistCapability('daily_closures', true);
    return { success: true, data: data ? mapDailyClosureFromDb(data) : closureData };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchDailyClosuresFromCloud() {
  if (!supabase || schemaCapabilities.daily_closures === false) return [];
  try {
    const { data, error } = await supabase
      .from('daily_closures')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        schemaCapabilities.daily_closures = false; persistCapability('daily_closures', false);
      }
      return [];
    }

    schemaCapabilities.daily_closures = true; persistCapability('daily_closures', true);
    return (data || []).map(mapDailyClosureFromDb);
  } catch (err) {
    return [];
  }
}

// ============================================================================
// STORE SETTINGS & IMMUTABLE RECEIPT SNAPSHOT OPERATIONS
// ============================================================================

export function mapStoreSettingsFromDb(row) {
  if (!row) return null;
  return {
    store_id: row.store_id || 'default_store',
    branchName: row.store_name || 'GÓC',
    storeName: row.store_name || 'GÓC',
    branchAddress: row.store_address || '',
    storeAddress: row.store_address || '',
    hotline: row.contact_phone || '',
    contactPhone: row.contact_phone || '',
    logoOriginalUrl: row.logo_original_url || null,
    logoThermalUrl: row.logo_thermal_url || null,
    receiptPaperWidth: row.receipt_paper_width || '58mm',
    receiptSettings: row.receipt_settings || {
      showLogo: true,
      showStoreName: true,
      showAddress: true,
      showPhone: true,
      showOrderId: true,
      showTable: true,
      showOrderTime: true,
      showReceiptTime: true,
      showWifi: true,
      showFooter: true
    },
    receiptFooter: row.receipt_footer || 'Cảm ơn quý khách và hẹn gặp lại!',
    wifiPassword: row.wifi_password || '',
    wifiOnReceipt: row.wifi_on_receipt !== false,
    enableVietQR: row.vietqr_enabled !== false,
    vietqrEnabled: row.vietqr_enabled !== false,
    bankAccount: {
      bankCode: row.bank_code || 'MB',
      accountNo: row.bank_account || '',
      accountHolder: row.bank_account_name || ''
    },
    kitchenTicketSettings: row.kitchen_ticket_settings || {
      enabled: true,
      paperWidth: '58mm',
      promptOnSave: true,
      printMode: 'diff',
      showTable: true,
      showOrderId: true,
      showTime: true,
      showToppings: true,
      showNotes: true,
      showItemCount: true
    },
    updatedAt: row.updated_at
  };
}

export function mapStoreSettingsToDb(settings) {
  return {
    store_id: settings.store_id || 'default_store',
    store_name: settings.storeName || settings.branchName || 'GÓC',
    store_address: settings.storeAddress || settings.branchAddress || '',
    contact_phone: settings.contactPhone || settings.hotline || '',
    logo_original_url: settings.logoOriginalUrl || null,
    logo_thermal_url: settings.logoThermalUrl || null,
    receipt_paper_width: settings.receiptPaperWidth || '58mm',
    receipt_settings: settings.receiptSettings || {
      showLogo: true,
      showStoreName: true,
      showAddress: true,
      showPhone: true,
      showOrderId: true,
      showTable: true,
      showOrderTime: true,
      showReceiptTime: true,
      showWifi: true,
      showFooter: true
    },
    receipt_footer: settings.receiptFooter || 'Cảm ơn quý khách và hẹn gặp lại!',
    wifi_password: settings.wifiPassword || '',
    wifi_on_receipt: settings.wifiOnReceipt !== false,
    bank_code: settings.bankAccount?.bankCode || settings.bank_code || 'MB',
    bank_account: settings.bankAccount?.accountNo || settings.bank_account || '',
    bank_account_name: settings.bankAccount?.accountHolder || settings.bank_account_name || '',
    vietqr_enabled: settings.enableVietQR !== false && settings.vietqr_enabled !== false,
    kitchen_ticket_settings: settings.kitchenTicketSettings || settings.kitchen_ticket_settings || {
      enabled: true,
      paper_width: '58mm',
      prompt_on_save: true,
      print_mode: 'diff',
      show_table: true,
      show_order_id: true,
      show_time: true,
      show_toppings: true,
      show_notes: true,
      show_item_count: true
    },
    updated_at: new Date().toISOString()
  };
}

export async function fetchStoreSettingsFromCloud() {
  if (!supabase) return null;
  try {
    if (schemaCapabilities.store_settings !== false) {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('store_id', 'default_store')
        .maybeSingle();

      if (!error && data) {
        schemaCapabilities.store_settings = true; persistCapability('store_settings', true);
        return mapStoreSettingsFromDb(data);
      }
      if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache'))) {
        schemaCapabilities.store_settings = false; persistCapability('store_settings', false);
      }
    }

    // Fallback to settings.pos_config
    const { data: configItem } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'pos_config')
      .maybeSingle();

    return configItem?.value || null;
  } catch (e) {
    console.warn('Lỗi fetchStoreSettingsFromCloud:', e);
    return null;
  }
}

export async function upsertStoreSettingsToCloud(settings) {
  if (!supabase) return { success: false };
  try {
    // 1. Dual-write to settings.pos_config for legacy compatibility
    await supabase
      .from('settings')
      .upsert([{ key: 'pos_config', value: settings, updated_at: new Date().toISOString() }], { onConflict: 'key' });

    // 2. Write to store_settings table if available
    if (schemaCapabilities.store_settings !== false) {
      const dbRow = mapStoreSettingsToDb(settings);
      const { error } = await supabase
        .from('store_settings')
        .upsert(dbRow, { onConflict: 'store_id' });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
          schemaCapabilities.store_settings = false; persistCapability('store_settings', false);
        }
      } else {
        schemaCapabilities.store_settings = true; persistCapability('store_settings', true);
      }
    }

    return { success: true };
  } catch (err) {
    console.warn('Lỗi upsertStoreSettingsToCloud:', err);
    return { success: false, error: err };
  }
}

export async function uploadStoreLogoToStorage(file, type = 'original') {
  if (!supabase) return { success: false, error: new Error('Supabase client chưa sẵn sàng') };
  try {
    const ext = file?.name ? file.name.split('.').pop() : 'png';
    const filePath = `logos/${type}_${Date.now()}.${ext}`;
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('store-assets')
      .upload(filePath, file, { upsert: true });

    if (uploadErr) {
      return { success: false, error: uploadErr };
    }

    const { data: urlData } = supabase.storage
      .from('store-assets')
      .getPublicUrl(filePath);

    return {
      success: true,
      path: filePath,
      publicUrl: urlData?.publicUrl || null
    };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function saveReceiptSnapshotToCloud(receiptRecord) {
  if (!supabase || !receiptRecord?.order_id) return { success: false };
  try {
    if (schemaCapabilities.receipts === true) {
      const { data, error } = await supabase
        .from('receipts')
        .upsert(receiptRecord, { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (!error) {
        return { success: true, data };
      }
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        schemaCapabilities.receipts = false; persistCapability('receipts', false);
      }
    }

    // Fallback sync to settings pos_receipt_snapshots
    try {
      const { data: currentSnapshots } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'pos_receipt_snapshots')
        .maybeSingle();
      const existing = currentSnapshots?.value && Array.isArray(currentSnapshots.value) ? currentSnapshots.value : [];
      const updated = [receiptRecord, ...existing.filter(r => r.id !== receiptRecord.id)].slice(0, 100);
      await supabase.from('settings').upsert([
        { key: 'pos_receipt_snapshots', value: updated, updated_at: new Date().toISOString() }
      ], { onConflict: 'key' });
      return { success: true, data: receiptRecord };
    } catch {
      return { success: true, data: receiptRecord };
    }
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchReceiptByOrderId(orderId) {
  if (!supabase || !orderId) return null;
  try {
    if (schemaCapabilities.receipts === true) {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('order_id', orderId)
        .order('issued_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return data;
      }
      if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache'))) {
        schemaCapabilities.receipts = false; persistCapability('receipts', false);
      }
    }

    // Fallback to settings pos_receipt_snapshots
    const { data: currentSnapshots } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'pos_receipt_snapshots')
      .maybeSingle();
    const list = currentSnapshots?.value && Array.isArray(currentSnapshots.value) ? currentSnapshots.value : [];
    return list.find(r => r.order_id === orderId) || null;
  } catch {
    return null;
  }
}

export async function incrementReceiptReprint(receiptId) {
  if (!supabase || !receiptId) return { success: false };
  try {
    const now = new Date().toISOString();
    if (schemaCapabilities.receipts !== false) {
      const { data, error } = await supabase
        .from('receipts')
        .select('reprint_count')
        .eq('id', receiptId)
        .maybeSingle();

      if (!error && data) {
        const nextCount = (data.reprint_count || 0) + 1;
        await supabase
          .from('receipts')
          .update({ reprint_count: nextCount, last_reprinted_at: now })
          .eq('id', receiptId);
        return { success: true, reprintCount: nextCount };
      }
    }

    // Fallback
    const { data: currentSnapshots } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'pos_receipt_snapshots')
      .maybeSingle();
    const list = currentSnapshots?.value && Array.isArray(currentSnapshots.value) ? currentSnapshots.value : [];
    let nextCount = 1;
    const updated = list.map(r => {
      if (r.id === receiptId) {
        nextCount = (r.reprint_count || 0) + 1;
        return { ...r, reprint_count: nextCount, last_reprinted_at: now };
      }
      return r;
    });
    await supabase.from('settings').upsert([
      { key: 'pos_receipt_snapshots', value: updated, updated_at: now }
    ], { onConflict: 'key' });
    return { success: true, reprintCount: nextCount };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function savePreparationTicketToCloud(ticketRecord) {
  if (!supabase || !ticketRecord?.order_id) return { success: false };
  try {
    if (schemaCapabilities.preparation_tickets === true) {
      const { data, error } = await supabase
        .from('preparation_tickets')
        .insert(ticketRecord)
        .select()
        .maybeSingle();

      if (!error) {
        return { success: true, data };
      }
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        schemaCapabilities.preparation_tickets = false; persistCapability('preparation_tickets', false);
      }
    }

    // Fallback sync to settings pos_preparation_tickets
    try {
      const { data: currentTickets } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'pos_preparation_tickets')
        .maybeSingle();
      const existing = currentTickets?.value && Array.isArray(currentTickets.value) ? currentTickets.value : [];
      const updated = [ticketRecord, ...existing.filter(t => t.id !== ticketRecord.id)].slice(0, 100);
      await supabase.from('settings').upsert([
        { key: 'pos_preparation_tickets', value: updated, updated_at: new Date().toISOString() }
      ], { onConflict: 'key' });
      return { success: true, data: ticketRecord };
    } catch {
      return { success: true, data: ticketRecord };
    }
  } catch (err) {
    return { success: false, error: err };
  }
}
