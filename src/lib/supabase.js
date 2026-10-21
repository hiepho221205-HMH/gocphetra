import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  '';
const supabaseKey =
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) ||
  '';

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

// ============================================================================
// DATA MAPPERS (camelCase <-> snake_case)
// ============================================================================

export function mapTableToDb(t) {
  return {
    id: t.id,
    name: t.name,
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
    seatedAt: t.seated_at
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
    business_date: o.businessDate || (o.createdAt ? o.createdAt.substring(0, 10) : null),
    carried_over_at: o.carriedOverAt || null,
    payment_status: o.paymentStatus || (o.status === 'completed' ? 'paid' : (Number(o.paidAmount) > 0 ? 'partial' : 'unpaid')),
    paid_at: o.paidAt || (o.status === 'completed' ? (o.finishedAt || o.createdAt) : null),
    payment_business_date: o.paymentBusinessDate || null,
    is_deleted: Boolean(o.isDeleted),
    deleted_at: o.deletedAt || null,
    deleted_by: o.deletedBy || null,
    is_demo: Boolean(o.isDemo),
    branch_id: o.branchId || 'main',
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
    businessDate: o.business_date || (o.created_at ? o.created_at.substring(0, 10) : null),
    carriedOverAt: o.carried_over_at || null,
    paymentStatus: o.payment_status || (o.status === 'completed' ? 'paid' : 'unpaid'),
    paidAt: o.paid_at || (o.status === 'completed' ? (o.finished_at || o.created_at) : null),
    paymentBusinessDate: o.payment_business_date || null,
    isDeleted: Boolean(o.is_deleted),
    deletedAt: o.deleted_at || null,
    deletedBy: o.deleted_by || null,
    isDemo: Boolean(o.is_demo),
    branchId: o.branch_id || 'main',
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
    business_date: p.businessDate || (p.paidAt ? p.paidAt.substring(0, 10) : new Date().toISOString().substring(0, 10)),
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
    const [tablesRes, catsRes, menuRes, toppingsRes, prodToppingsRes, ordersRes, settingsRes, staffRes] = await Promise.all([
      supabase.from('tables').select('*'),
      supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('menu_items').select('*'),
      supabase.from('toppings').select('*'),
      supabase.from('product_toppings').select('*'),
      supabase.from('orders').select('*'),
      supabase.from('settings').select('*'),
      supabase.from('staff_profiles').select('*').order('created_at', { ascending: true })
    ]);

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
    if (settingsRes.data && settingsRes.data.length > 0) {
      const configItem = settingsRes.data.find((s) => s.key === 'pos_config');
      if (configItem && configItem.value) {
        settings = configItem.value;
      }
    }

    const staff = (staffRes && !staffRes.error && Array.isArray(staffRes.data))
      ? staffRes.data.map(mapStaffProfileFromDb)
      : [];

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
      staffList: staff
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
  if (!supabase) return;
  try {
    await supabase.from('tables').upsert(mapTableToDb(table));
  } catch (e) {
    console.warn('Lỗi cloudUpsertTable:', e);
  }
}

export async function cloudDeleteTable(tableId) {
  if (!supabase) return;
  try {
    await supabase.from('tables').delete().eq('id', tableId);
  } catch (e) {
    console.warn('Lỗi cloudDeleteTable:', e);
  }
}

export async function cloudUpsertOrder(order) {
  if (!supabase) return;
  try {
    const basePayload = mapOrderToBaseDb(order);
    const { error } = await supabase.from('orders').upsert(basePayload);
    if (error) {
      console.warn('Lỗi cloudUpsertOrder:', error);
    }
  } catch (e) {
    console.warn('Lỗi cloudUpsertOrder:', e);
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
      .upsert([{ key: 'pos_config', value: settings, updated_at: new Date().toISOString() }]);
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

  if (!supabase) return fallback;

  try {
    const { data, error } = await supabase
      .from('staff_profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Lỗi fetchStaffProfiles:', error.message);
      fallback.error = error;
      return fallback;
    }

    const mapped = (data || []).map(mapStaffProfileFromDb);
    mapped.data = mapped;
    mapped.error = null;
    return mapped;
  } catch (err) {
    console.warn('Lỗi fetchStaffProfiles (exception):', err?.message || err);
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

  try {
    const dbRecord = mapStaffProfileToDb(staff);
    const { data, error } = await supabase
      .from('staff_profiles')
      .upsert(dbRecord)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Lỗi upsertStaffProfile:', error.message);
      return { success: false, data: null, error };
    }

    const mapped = data ? mapStaffProfileFromDb(data) : staff;
    return { success: true, data: mapped, error: null };
  } catch (err) {
    console.warn('Lỗi upsertStaffProfile (exception):', err?.message || err);
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
      console.warn('Lỗi bulkUpsertStaffProfiles:', error.message);
      return { success: false, count: 0, error };
    }

    const mapped = (data || []).map(mapStaffProfileFromDb);
    return { success: true, count: records.length, data: mapped, error: null };
  } catch (err) {
    console.warn('Lỗi bulkUpsertStaffProfiles (exception):', err?.message || err);
    return { success: false, count: 0, error: err };
  }
}

/**
 * Delete a staff profile from Supabase by id.
 */
export async function deleteStaffProfile(staffId) {
  if (!supabase) return { success: false, error: new Error('Supabase not configured or offline') };
  try {
    const { error } = await supabase.from('staff_profiles').delete().eq('id', staffId);
    if (error) throw error;
    return { success: true, error: null };
  } catch (err) {
    console.warn('Lỗi deleteStaffProfile:', err?.message || err);
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
  if (!supabase) return { success: false, rolledOrdersCount: 0, releasedTablesCount: 0 };
  try {
    const { data, error } = await supabase.rpc('rollover_daily_orders', {
      p_target_business_date: targetBusinessDate
    });
    if (error) {
      console.warn('Lỗi rolloverDailyOrdersRpc:', error.message);
      return { success: false, error };
    }
    return data || { success: true };
  } catch (err) {
    console.warn('Lỗi rolloverDailyOrdersRpc (exception):', err?.message || err);
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
  if (!supabase || !payment) return;
  try {
    await supabase.from('payments').upsert(mapPaymentToDb(payment));
  } catch (e) {
    console.warn('Lỗi cloudUpsertPayment:', e);
  }
}

/**
 * Fetch payments for a given business date
 */
export async function fetchPaymentsByBusinessDate(businessDate) {
  if (!supabase || !businessDate) return [];
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
