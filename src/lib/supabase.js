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
      auth: { persistSession: false },
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
    createdAt: o.created_at,
    finishedAt: o.finished_at
  };
}

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
    const [tablesRes, catsRes, menuRes, toppingsRes, prodToppingsRes, ordersRes, settingsRes] = await Promise.all([
      supabase.from('tables').select('*'),
      supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('menu_items').select('*'),
      supabase.from('toppings').select('*'),
      supabase.from('product_toppings').select('*'),
      supabase.from('orders').select('*'),
      supabase.from('settings').select('*')
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
      if (ord.status === 'completed' || ord.status === 'cancelled') {
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

    return {
      tables,
      categories,
      menu,
      toppings,
      productToppings,
      orders: activeOrdersObj,
      orderHistory: orderHistoryArr,
      settings
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
      const { error } = await supabase.from('orders').upsert(ordersToSeed);
      if (error) throw error;
    }

    // 7. Settings
    if (data.settings) {
      const { error } = await supabase
        .from('settings')
        .upsert([{ key: 'pos_config', value: data.settings, updated_at: new Date().toISOString() }]);
      if (error) throw error;
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
    await supabase.from('orders').upsert(mapOrderToDb(order));
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
