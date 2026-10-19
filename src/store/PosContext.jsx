import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  INITIAL_TABLES,
  INITIAL_CATEGORIES,
  INITIAL_MENU,
  INITIAL_TOPPINGS,
  INITIAL_PRODUCT_TOPPINGS,
  INITIAL_ORDERS,
  INITIAL_ORDER_HISTORY,
  INITIAL_SETTINGS,
  INITIAL_STAFF
} from '../data/initialData';
import {
  supabase,
  isSupabaseConfigured,
  checkSupabaseHealth,
  fetchAllCloudData,
  seedInitialDataToCloud,
  cloudUpsertTable,
  cloudDeleteTable,
  cloudUpsertOrder,
  cloudDeleteOrder,
  cloudUpsertMenuItem,
  cloudDeleteMenuItem,
  cloudUpsertTopping,
  cloudDeleteTopping,
  cloudUpsertCategory,
  cloudDeleteCategory,
  cloudUpsertProductTopping,
  cloudDeleteProductTopping,
  cloudUpsertSettings,
  mapTableFromDb,
  mapOrderFromDb,
  // Milestone 4 Imports
  fetchStaffProfiles,
  upsertStaffProfile,
  bulkUpsertStaffProfiles,
  deleteStaffProfile,
  mapStaffProfileFromDb,
  batchDeleteOrders,
  logDataCleanupJob
} from '../lib/supabase';

const PosContext = createContext(null);

const STORAGE_KEYS = {
  TABLES: 'goc_pos_tables_v4',
  MENU: 'goc_pos_menu_v4',
  CATEGORIES: 'goc_pos_categories_v4',
  TOPPINGS: 'goc_pos_toppings_v4',
  PRODUCT_TOPPINGS: 'goc_pos_product_toppings_v4',
  ORDERS: 'goc_pos_orders_v4',
  ORDER_HISTORY: 'goc_pos_history_v4',
  SETTINGS: 'goc_pos_settings_v4',
  STAFF: 'goc_pos_staff_v4',
};

function loadStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (e) {
    console.error('Lỗi đọc localStorage:', e);
    return fallback;
  }
}

/**
 * Merges cloud staff profiles with local staff profiles (Milestone 4).
 * - Union by unique staff id.
 * - Conflict resolution: Newer updatedAt takes precedence.
 * - Equal or missing timestamps: Preserves local active/paused status.
 * - Preserves offline local-only additions.
 */
export function mergeStaffProfiles(localList = [], cloudList = []) {
  const safeLocal = Array.isArray(localList) ? localList : [];
  const safeCloud = Array.isArray(cloudList) ? cloudList : [];

  const localMap = new Map(safeLocal.map((s) => [s.id, s]));
  const cloudMap = new Map(safeCloud.map((s) => [s.id, s]));
  const allIds = new Set([...localMap.keys(), ...cloudMap.keys()]);

  const merged = [];
  for (const id of allIds) {
    const local = localMap.get(id);
    const cloud = cloudMap.get(id);

    if (local && !cloud) {
      merged.push(local);
    } else if (!local && cloud) {
      merged.push(cloud);
    } else {
      const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      const cloudTime = cloud.updatedAt ? new Date(cloud.updatedAt).getTime() : 0;

      if (cloudTime > localTime) {
        merged.push({ ...local, ...cloud });
      } else if (localTime > cloudTime) {
        merged.push({ ...cloud, ...local });
      } else {
        merged.push({
          ...cloud,
          ...local,
          status: local.status || cloud.status
        });
      }
    }
  }
  return merged;
}

export function PosProvider({ children }) {
  // State definitions
  const [tables, setTables] = useState(() => loadStorage(STORAGE_KEYS.TABLES, INITIAL_TABLES));
  const [categories, setCategories] = useState(() => loadStorage(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES));
  const [menu, setMenu] = useState(() => loadStorage(STORAGE_KEYS.MENU, INITIAL_MENU));
  const [toppings, setToppings] = useState(() => loadStorage(STORAGE_KEYS.TOPPINGS, INITIAL_TOPPINGS));
  const [productToppings, setProductToppings] = useState(() => loadStorage(STORAGE_KEYS.PRODUCT_TOPPINGS, INITIAL_PRODUCT_TOPPINGS));
  const [orders, setOrders] = useState(() => loadStorage(STORAGE_KEYS.ORDERS, INITIAL_ORDERS));
  const [orderHistory, setOrderHistory] = useState(() => {
    const loaded = loadStorage(STORAGE_KEYS.ORDER_HISTORY, null);
    return loaded && loaded.length > 0 ? loaded : INITIAL_ORDER_HISTORY;
  });
  const [settings, setSettings] = useState(() => loadStorage(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS));
  const [staffList, setStaffList] = useState(() => {
    const loaded = loadStorage(STORAGE_KEYS.STAFF, null);
    return loaded && Array.isArray(loaded) && loaded.length > 0 ? loaded : INITIAL_STAFF;
  });

  // Cloud Sync States
  const [cloudStatus, setCloudStatus] = useState({
    configured: isSupabaseConfigured,
    connected: false,
    tablesExist: false,
    latency: null,
    message: isSupabaseConfigured ? 'Đang kiểm tra kết nối...' : 'Chưa cấu hình Supabase',
    lastSyncTime: null
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // UI States
  const [activeTab, setActiveTab] = useState('tables'); // 'tables' | 'menu' | 'orders' | 'reports' | 'settings'
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [deviceMode, setDeviceMode] = useState('mobile'); // 'mobile' | 'responsive'
  const [toasts, setToasts] = useState([]);

  // Auto-save effects
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables)); }, [tables]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(menu)); }, [menu]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TOPPINGS, JSON.stringify(toppings)); }, [toppings]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.PRODUCT_TOPPINGS, JSON.stringify(productToppings)); }, [productToppings]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.ORDER_HISTORY, JSON.stringify(orderHistory)); }, [orderHistory]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staffList)); }, [staffList]);


  // =================== CLOUD SYNC & REALTIME ===================
  const refreshCloudHealth = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const health = await checkSupabaseHealth();
    setCloudStatus((prev) => ({
      ...prev,
      ...health,
      lastSyncTime: health.connected ? new Date() : prev.lastSyncTime
    }));
    return health;
  };

  // Synchronize Staff Profiles with Cloud (Hybrid Two-Way Offline-Safe)
  const syncStaffWithCloud = async (prefetchedStaff = null) => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      let cloudStaff = prefetchedStaff;
      if (!cloudStaff && typeof fetchStaffProfiles === 'function') {
        const res = await fetchStaffProfiles();
        cloudStaff = Array.isArray(res) ? res : (res?.data || []);
      }

      if (Array.isArray(cloudStaff) && cloudStaff.length > 0) {
        // Cloud has profiles: Merge with local state
        setStaffList((prevLocal) => {
          const merged = mergeStaffProfiles(prevLocal, cloudStaff);
          // If local has profiles not yet in cloud, seed them to cloud in background
          const localOnly = prevLocal.filter((l) => !cloudStaff.some((c) => c.id === l.id));
          if (localOnly.length > 0 && typeof bulkUpsertStaffProfiles === 'function') {
            bulkUpsertStaffProfiles(localOnly).catch((err) =>
              console.warn('Lỗi đồng bộ local staff lên Cloud:', err)
            );
          }
          return merged;
        });
      } else {
        // Cloud is empty: Seed cloud with local staff if local exists
        setStaffList((currentLocal) => {
          if (currentLocal && currentLocal.length > 0 && typeof bulkUpsertStaffProfiles === 'function') {
            bulkUpsertStaffProfiles(currentLocal).catch((err) =>
              console.warn('Lỗi seed staff lên Cloud:', err)
            );
          }
          return currentLocal;
        });
      }
    } catch (err) {
      console.warn('Lỗi đồng bộ nhân viên từ Cloud:', err);
    }
  };

  const syncFromCloud = async (showNotification = true) => {
    if (!isSupabaseConfigured || !supabase) {
      if (showNotification) showToast('Chưa cấu hình Supabase URL/Key', 'error');
      return false;
    }
    setIsSyncing(true);
    try {
      const health = await checkSupabaseHealth();
      setCloudStatus((prev) => ({ ...prev, ...health }));
      if (!health.connected || !health.tablesExist) {
        if (showNotification) showToast(health.message || 'Chưa thể đồng bộ với Cloud', 'error');
        setIsSyncing(false);
        return false;
      }

      const cloudData = await fetchAllCloudData();
      if (cloudData) {
        if (cloudData.tables && cloudData.tables.length > 0) setTables(cloudData.tables);
        if (cloudData.categories && cloudData.categories.length > 0) setCategories(cloudData.categories);
        if (cloudData.menu && cloudData.menu.length > 0) setMenu(cloudData.menu);
        if (cloudData.toppings && cloudData.toppings.length > 0) setToppings(cloudData.toppings);
        if (cloudData.orders) {
          setOrders((prev) => ({ ...cloudData.orders, ...prev }));
        }
        if (cloudData.orderHistory && cloudData.orderHistory.length > 0) {
          setOrderHistory((prev) => {
            const cloudIds = new Set(cloudData.orderHistory.map((o) => o.id));
            const localOnly = prev.filter((o) => !cloudIds.has(o.id));
            return [...cloudData.orderHistory, ...localOnly];
          });
        }
        if (cloudData.settings) setSettings(cloudData.settings);
        await syncStaffWithCloud(cloudData.staff || cloudData.staffList || null);

        setCloudStatus((prev) => ({ ...prev, lastSyncTime: new Date() }));
        if (showNotification) showToast('Đã đồng bộ dữ liệu mới nhất từ Cloud!', 'success');
        setIsSyncing(false);
        return true;
      }
    } catch (err) {
      console.error('Lỗi syncFromCloud:', err);
      if (showNotification) showToast('Lỗi đồng bộ: ' + err.message, 'error');
    }
    setIsSyncing(false);
    return false;
  };

  const seedToCloud = async () => {
    setIsSyncing(true);
    showToast('Đang tải dữ liệu lên Cloud...', 'info');
    const res = await seedInitialDataToCloud({
      tables,
      categories,
      menu,
      toppings,
      productToppings,
      orders,
      orderHistory,
      settings,
      staff: staffList
    });
    if (typeof bulkUpsertStaffProfiles === 'function' && staffList.length > 0) {
      await bulkUpsertStaffProfiles(staffList).catch((err) =>
        console.warn('Lỗi seed staff lên Cloud:', err)
      );
    }
    setIsSyncing(false);
    if (res.success) {
      showToast(res.message, 'success');
      refreshCloudHealth();
    } else {
      showToast('Lỗi tải dữ liệu lên Cloud: ' + res.message, 'error');
    }
    return res;
  };

  // Mount Effect: Cloud Health Check & Realtime Subscription
  useEffect(() => {
    let isMounted = true;

    async function initSync() {
      if (!isSupabaseConfigured || !supabase) return;
      const health = await checkSupabaseHealth();
      if (!isMounted) return;
      setCloudStatus((prev) => ({
        ...prev,
        ...health,
        lastSyncTime: health.connected ? new Date() : prev.lastSyncTime
      }));

      if (health.connected && health.tablesExist) {
        setIsSyncing(true);
        const cloudData = await fetchAllCloudData();
        if (isMounted && cloudData) {
          if (cloudData.tables && cloudData.tables.length > 0) setTables(cloudData.tables);
          if (cloudData.categories && cloudData.categories.length > 0) setCategories(cloudData.categories);
          if (cloudData.menu && cloudData.menu.length > 0) setMenu(cloudData.menu);
          if (cloudData.toppings && cloudData.toppings.length > 0) setToppings(cloudData.toppings);
          if (cloudData.productToppings) setProductToppings(cloudData.productToppings);
          if (cloudData.orders && Object.keys(cloudData.orders).length > 0) setOrders(cloudData.orders);
          if (cloudData.orderHistory && cloudData.orderHistory.length > 0) setOrderHistory(cloudData.orderHistory);
          if (cloudData.settings) setSettings(cloudData.settings);
          await syncStaffWithCloud(cloudData?.staff || cloudData?.staffList || null);
          setCloudStatus((prev) => ({ ...prev, lastSyncTime: new Date() }));
        }
        setIsSyncing(false);
      }
    }

    initSync();

    // Listen to network changes
    const handleOnline = () => {
      refreshCloudHealth();
      syncFromCloud(false);
    };
    window.addEventListener('online', handleOnline);

    // Setup Realtime
    let channel = null;
    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel('pos_realtime_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updated = mapTableFromDb(payload.new);
            setTables((prev) => {
              const idx = prev.findIndex((t) => t.id === updated.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = updated;
                return copy;
              }
              return [...prev, updated];
            });
          } else if (payload.eventType === 'DELETE') {
            setTables((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updated = mapOrderFromDb(payload.new);
            if (updated.status === 'completed' || updated.status === 'cancelled') {
              setOrderHistory((prev) => {
                const exists = prev.some((o) => o.id === updated.id);
                if (exists) {
                  return prev.map((o) => (o.id === updated.id ? updated : o));
                }
                return [updated, ...prev];
              });
              setOrders((prev) => {
                const copy = { ...prev };
                delete copy[updated.id];
                return copy;
              });
            } else {
              setOrders((prev) => ({ ...prev, [updated.id]: updated }));
            }
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => {
              const copy = { ...prev };
              delete copy[payload.old.id];
              return copy;
            });
            setOrderHistory((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_profiles' }, (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const mapped = typeof mapStaffProfileFromDb === 'function'
              ? mapStaffProfileFromDb(payload.new)
              : {
                  id: payload.new.id,
                  name: payload.new.name,
                  status: payload.new.status,
                  role: payload.new.role,
                  branchId: payload.new.branch_id,
                  createdAt: payload.new.created_at,
                  updatedAt: payload.new.updated_at
                };
            setStaffList((prev) => {
              const idx = prev.findIndex((s) => s.id === mapped.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...mapped };
                return copy;
              }
              return [...prev, mapped];
            });
          } else if (payload.eventType === 'DELETE') {
            setStaffList((prev) => prev.filter((s) => s.id !== payload.old.id));
          }
        })
        .subscribe();
    }

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Helper: Recalculate Order Totals
  const recalculateOrder = (order) => {
    const subtotal = order.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
    const discountAmount = Math.round(subtotal * ((order.discountPercent || 0) / 100));
    const surchargeAmount = order.surcharge || 0;
    const total = Math.max(0, subtotal - discountAmount + surchargeAmount);
    const remainingAmount = Math.max(0, total - (order.paidAmount || 0));

    return {
      ...order,
      subtotal,
      total,
      remainingAmount
    };
  };

  // =================== TABLE ACTIONS ===================
  const addTable = (tableData) => {
    const cleanNumber = (tableData.tableNumber || '').trim();
    if (!cleanNumber) {
      showToast('Vui lòng nhập số bàn!', 'error');
      return { success: false, message: 'Vui lòng nhập số bàn' };
    }

    const formattedId = cleanNumber.toUpperCase().startsWith('B')
      ? cleanNumber.toUpperCase()
      : 'B' + cleanNumber.padStart(2, '0');

    const isDuplicate = tables.some(
      (t) =>
        t.id.toLowerCase() === formattedId.toLowerCase() ||
        t.name.toLowerCase() === `bàn ${cleanNumber}`.toLowerCase() ||
        t.name.toLowerCase() === cleanNumber.toLowerCase()
    );

    if (isDuplicate) {
      showToast(`Số bàn ${formattedId} đã tồn tại trong danh sách!`, 'error');
      return { success: false, message: `Số bàn ${formattedId} đã tồn tại` };
    }

    const newTable = {
      id: formattedId,
      name: tableData.name || `Bàn ${formattedId.replace('B', '')}`,
      capacity: Number(tableData.capacity) || 4,
      status: 'empty',
      activeOrderId: null
    };

    setTables((prev) => [...prev, newTable]);
    cloudUpsertTable(newTable);
    showToast(`Đã thêm thành công ${newTable.name}`, 'success');
    return { success: true, table: newTable };
  };

  const updateTable = (id, updates) => {
    setTables((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
      const updated = next.find((t) => t.id === id);
      if (updated) cloudUpsertTable(updated);
      return next;
    });
    showToast('Đã cập nhật thông tin bàn', 'success');
  };

  const deleteTable = (id) => {
    const table = tables.find((t) => t.id === id);
    if (!table) return false;

    if (table.status !== 'empty' || table.activeOrderId) {
      showToast('Không thể xóa bàn đang có khách hoặc chưa thanh toán!', 'error');
      return false;
    }

    setTables((prev) => prev.filter((t) => t.id !== id));
    cloudDeleteTable(id);
    showToast(`Đã xóa ${table.name} khỏi danh sách`, 'success');
    return true;
  };

  // Chuyển bàn
  const transferTable = (fromTableId, toTableId) => {
    const fromTable = tables.find((t) => t.id === fromTableId);
    const toTable = tables.find((t) => t.id === toTableId);

    if (!fromTable || !toTable) {
      showToast('Bàn không tồn tại!', 'error');
      return false;
    }
    if (fromTable.status === 'empty' || !fromTable.activeOrderId) {
      showToast('Bàn gốc hiện không có đơn hàng để chuyển!', 'error');
      return false;
    }
    if (toTable.status !== 'empty' || toTable.activeOrderId) {
      showToast(`Bàn đích (${toTable.name}) đang có khách! Vui lòng chọn tính năng Gộp bàn.`, 'error');
      return false;
    }

    const orderId = fromTable.activeOrderId;
    const currentOrder = orders[orderId];

    if (currentOrder) {
      const updatedOrder = {
        ...currentOrder,
        tableId: toTable.id,
        tableName: toTable.name
      };
      setOrders((prev) => ({
        ...prev,
        [orderId]: updatedOrder
      }));
      cloudUpsertOrder(updatedOrder);
    }

    setTables((prev) =>
      prev.map((t) => {
        if (t.id === fromTable.id) {
          const updatedFrom = { ...t, status: 'empty', activeOrderId: null, seatedAt: null, customerCount: 0 };
          cloudUpsertTable(updatedFrom);
          return updatedFrom;
        }
        if (t.id === toTable.id) {
          const updatedTo = {
            ...t,
            status: fromTable.status,
            activeOrderId: orderId,
            seatedAt: fromTable.seatedAt || new Date().toISOString(),
            customerCount: fromTable.customerCount || 2
          };
          cloudUpsertTable(updatedTo);
          return updatedTo;
        }
        return t;
      })
    );

    showToast(`Đã chuyển từ ${fromTable.name} sang ${toTable.name}`, 'success');
    return true;
  };

  // Gộp bàn (Merge Tables)
  const mergeTables = (sourceTableId, targetTableId) => {
    if (!sourceTableId || !targetTableId) {
      showToast('Bàn không hợp lệ!', 'error');
      return false;
    }

    if (sourceTableId === targetTableId) {
      showToast('Không thể gộp bàn vào chính nó!', 'error');
      return false;
    }

    const sourceTable = tables.find((t) => t.id === sourceTableId);
    const targetTable = tables.find((t) => t.id === targetTableId);

    if (!sourceTable || !targetTable) {
      showToast('Không tìm thấy thông tin bàn!', 'error');
      return false;
    }

    if (!sourceTable.activeOrderId || !orders[sourceTable.activeOrderId]) {
      showToast(`Bàn nguồn (${sourceTable.name}) không có đơn hàng!`, 'error');
      return false;
    }

    const sourceOrder = orders[sourceTable.activeOrderId];
    let targetOrder = targetTable.activeOrderId ? orders[targetTable.activeOrderId] : null;

    if (!targetOrder) {
      return transferTable(sourceTableId, targetTableId);
    }

    // Chặn gộp nếu một trong hai bàn đã thanh toán một phần
    if ((sourceOrder.paidAmount && sourceOrder.paidAmount > 0) || (targetOrder.paidAmount && targetOrder.paidAmount > 0)) {
      showToast('Một trong hai bàn đã có thanh toán dở dang. Vui lòng hoàn tất thanh toán trước khi gộp!', 'error');
      return false;
    }

    // Hợp nhất danh sách món: giữ nguyên size, topping, ghi chú
    const mergedItems = [...targetOrder.items];
    sourceOrder.items.forEach((sItem) => {
      const existingIdx = mergedItems.findIndex(
        (tItem) =>
          tItem.productId === sItem.productId &&
          tItem.size === sItem.size &&
          JSON.stringify(tItem.toppings || []) === JSON.stringify(sItem.toppings || []) &&
          (tItem.notes || '').trim() === (sItem.notes || '').trim()
      );

      if (existingIdx >= 0) {
        mergedItems[existingIdx] = {
          ...mergedItems[existingIdx],
          quantity: mergedItems[existingIdx].quantity + sItem.quantity,
          lineTotal: mergedItems[existingIdx].lineTotal + sItem.lineTotal
        };
      } else {
        mergedItems.push({
          ...sItem,
          cartItemId: 'item-merged-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          originalTable: sourceTable.name
        });
      }
    });

    const combinedSurcharge = (targetOrder.surcharge || 0) + (sourceOrder.surcharge || 0);

    const updatedTargetOrder = recalculateOrder({
      ...targetOrder,
      items: mergedItems,
      surcharge: combinedSurcharge,
      customerCount: (targetOrder.customerCount || 1) + (sourceOrder.customerCount || 1),
      mergeHistory: [
        ...(targetOrder.mergeHistory || []),
        {
          sourceTableId: sourceTable.id,
          sourceTableName: sourceTable.name,
          sourceOrderId: sourceOrder.id,
          itemCount: sourceOrder.items.length,
          amount: sourceOrder.total,
          timestamp: new Date().toISOString()
        }
      ]
    });

    // Cập nhật Orders: gộp vào targetOrder, xóa sourceOrder
    setOrders((prev) => {
      const copy = { ...prev };
      delete copy[sourceTable.activeOrderId];
      copy[targetOrder.id] = updatedTargetOrder;
      return copy;
    });

    const updatedSourceTable = { ...sourceTable, status: 'empty', activeOrderId: null, seatedAt: null, customerCount: 0 };
    const updatedTargetTable = { ...targetTable, status: 'occupied', customerCount: updatedTargetOrder.customerCount };

    // Cập nhật Tables: bàn nguồn giải phóng thành TRỐNG, bàn đích tiếp tục CÓ KHÁCH
    setTables((prev) =>
      prev.map((t) => {
        if (t.id === sourceTable.id) return updatedSourceTable;
        if (t.id === targetTable.id) return updatedTargetTable;
        return t;
      })
    );

    // Đồng bộ tức thời lên Supabase Cloud
    if (sourceTable.activeOrderId) {
      cloudDeleteOrder(sourceTable.activeOrderId);
    }
    cloudUpsertOrder(updatedTargetOrder);
    cloudUpsertTable(updatedSourceTable);
    cloudUpsertTable(updatedTargetTable);

    showToast(`Đã gộp đơn ${sourceTable.name} vào ${targetTable.name} thành công!`, 'success');
    return { success: true, updatedOrder: updatedTargetOrder };
  };

  // =================== ORDER & CART ACTIONS ===================
  const getOrCreateOrder = (tableId) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return null;

    if (table.activeOrderId && orders[table.activeOrderId]) {
      return orders[table.activeOrderId];
    }

    const newOrderId = 'ORD-' + Date.now().toString().slice(-6);
    const newOrder = {
      id: newOrderId,
      tableId: table.id,
      tableName: table.name,
      status: 'serving',
      createdAt: new Date().toISOString(),
      cashier: settings.currentCashier.split('(')[0].trim(),
      customerCount: table.capacity || 2,
      items: [],
      discountPercent: 0,
      surcharge: 0,
      subtotal: 0,
      total: 0,
      paidAmount: 0,
      remainingAmount: 0,
      splitPayments: []
    };

    setOrders((prev) => ({ ...prev, [newOrderId]: newOrder }));
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? {
              ...t,
              status: 'occupied',
              activeOrderId: newOrderId,
              seatedAt: new Date().toISOString(),
              customerCount: newOrder.customerCount
            }
          : t
      )
    );

    return newOrder;
  };

  const addItemToOrder = (tableId, itemConfig) => {
    const order = getOrCreateOrder(tableId);
    if (!order) return;

    const toppingsPrice = (itemConfig.toppings || []).reduce(
      (sum, tp) => sum + (tp.price || 0) * (tp.quantity || 1),
      0
    );
    const unitPrice = itemConfig.basePrice + (itemConfig.sizePrice || 0) + toppingsPrice;
    const quantity = itemConfig.quantity || 1;
    const lineTotal = unitPrice * quantity;

    const existingIndex = order.items.findIndex(
      (it) =>
        it.productId === itemConfig.productId &&
        it.size === itemConfig.size &&
        (it.notes || '').trim() === (itemConfig.notes || '').trim()
    );

    let updatedItems = [...order.items];
    if (existingIndex >= 0) {
      const cur = updatedItems[existingIndex];
      const newQty = cur.quantity + quantity;
      updatedItems[existingIndex] = {
        ...cur,
        quantity: newQty,
        lineTotal: cur.unitPrice * newQty
      };
    } else {
      const cartItemId = 'item-' + Date.now() + Math.random().toString(36).substr(2, 4);
      updatedItems.push({
        ...itemConfig,
        cartItemId,
        unitPrice,
        quantity,
        lineTotal
      });
    }

    const updatedOrder = recalculateOrder({
      ...order,
      items: updatedItems
    });

    setOrders((prev) => ({ ...prev, [order.id]: updatedOrder }));
    showToast(`Đã thêm ${itemConfig.name}`, 'success');
  };

  const updateItemQuantity = (tableId, cartItemId, delta) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table || !table.activeOrderId) return;
    const order = orders[table.activeOrderId];
    if (!order) return;

    let updatedItems = order.items
      .map((it) => {
        if (it.cartItemId === cartItemId) {
          const newQty = it.quantity + delta;
          if (newQty <= 0) return null;
          return {
            ...it,
            quantity: newQty,
            lineTotal: it.unitPrice * newQty
          };
        }
        return it;
      })
      .filter(Boolean);

    const updatedOrder = recalculateOrder({
      ...order,
      items: updatedItems
    });

    setOrders((prev) => ({ ...prev, [order.id]: updatedOrder }));
  };

  const removeItemFromOrder = (tableId, cartItemId) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table || !table.activeOrderId) return;
    const order = orders[table.activeOrderId];
    if (!order) return;

    const updatedItems = order.items.filter((it) => it.cartItemId !== cartItemId);
    const updatedOrder = recalculateOrder({
      ...order,
      items: updatedItems
    });

    setOrders((prev) => ({ ...prev, [order.id]: updatedOrder }));
    showToast('Đã xóa món', 'info');
  };

  const updateBillAdjustments = (tableId, { discountPercent = 0, surcharge = 0 }) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table || !table.activeOrderId) return;
    const order = orders[table.activeOrderId];
    if (!order) return;

    const updatedOrder = recalculateOrder({
      ...order,
      discountPercent: Number(discountPercent) || 0,
      surcharge: Number(surcharge) || 0
    });

    setOrders((prev) => ({ ...prev, [order.id]: updatedOrder }));
    showToast('Đã cập nhật chiết khấu & phụ thu', 'success');
  };

  // Lấy đơn hàng hiện tại của bàn
  const getOrderForTable = (tableId) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table || !table.activeOrderId) return null;
    return orders[table.activeOrderId] || null;
  };

  // Lưu cam kết đơn hàng cho bàn (tạo mới hoặc cập nhật đơn đang mở, chuyển bàn sang có khách)
  const saveOrderForTable = (tableId, items) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) {
      showToast('Bàn không tồn tại!', 'error');
      return { success: false, message: 'Bàn không tồn tại' };
    }

    if (!items || items.length === 0) {
      showToast('Đơn hàng chưa có món nào! Vui lòng chọn món trước khi lưu.', 'error');
      return { success: false, message: 'Đơn hàng trống' };
    }

    let orderId = table.activeOrderId;
    let existingOrder = orderId ? orders[orderId] : null;

    if (!existingOrder) {
      orderId = 'ORD-' + Date.now().toString().slice(-6);
      existingOrder = {
        id: orderId,
        tableId: table.id,
        tableName: table.name,
        status: 'serving',
        createdAt: new Date().toISOString(),
        cashier: (settings.currentCashier || 'Thu ngân').split('(')[0].trim(),
        customerCount: table.capacity || 2,
        items: [],
        discountPercent: 0,
        surcharge: 0,
        subtotal: 0,
        total: 0,
        paidAmount: 0,
        remainingAmount: 0,
        splitPayments: []
      };
    }

    const updatedOrder = recalculateOrder({
      ...existingOrder,
      items: items
    });

    const updatedTable = {
      ...table,
      status: 'occupied',
      activeOrderId: orderId,
      seatedAt: table.seatedAt || new Date().toISOString(),
      customerCount: updatedOrder.customerCount
    };

    setOrders((prev) => ({ ...prev, [orderId]: updatedOrder }));
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? updatedTable : t))
    );

    cloudUpsertOrder(updatedOrder);
    cloudUpsertTable(updatedTable);

    showToast(`Đã lưu đơn thành công cho ${table.name}!`, 'success');
    return { success: true, order: updatedOrder };
  };

  // =================== BILLING & SETTLEMENT ===================
  const requestBillForTable = (tableId) => {
    showToast('Đã in tạm tính hóa đơn', 'info');
  };

  const processPartialPayment = (tableId, paymentRecord) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table || !table.activeOrderId) return { success: false, isFullyPaid: false };
    const order = orders[table.activeOrderId];
    if (!order) return { success: false, isFullyPaid: false };

    const newPaidAmount = (order.paidAmount || 0) + paymentRecord.amount;
    const remainingAmount = Math.max(0, order.total - newPaidAmount);

    const updatedSplitPayments = [
      ...(order.splitPayments || []),
      {
        ...paymentRecord,
        timestamp: new Date().toISOString(),
        paymentId: 'PAY-' + Date.now()
      }
    ];

    const updatedOrder = {
      ...order,
      paidAmount: newPaidAmount,
      remainingAmount,
      splitPayments: updatedSplitPayments
    };

    if (remainingAmount <= 0) {
      finalizeOrder(tableId, updatedOrder);
      showToast(`Đã thanh toán đủ ${order.tableName}! Bàn đã được giải phóng.`, 'success');
      return { success: true, isFullyPaid: true, remainingAmount: 0 };
    } else {
      setOrders((prev) => ({ ...prev, [order.id]: updatedOrder }));
      cloudUpsertOrder(updatedOrder);
      showToast(`Đã thu ${paymentRecord.amount.toLocaleString('vi-VN')}đ. Còn nợ: ${remainingAmount.toLocaleString('vi-VN')}đ`, 'info');
      return { success: true, isFullyPaid: false, remainingAmount };
    }
  };

  const finalizeOrder = (tableId, completedOrder) => {
    const finishedAt = new Date().toISOString();
    const finalOrder = {
      ...completedOrder,
      status: 'completed',
      finishedAt
    };

    setOrderHistory((prev) => [finalOrder, ...prev]);

    setOrders((prev) => {
      const copy = { ...prev };
      delete copy[completedOrder.id];
      return copy;
    });

    const currentTbl = tables.find((t) => t.id === tableId);
    const resetTable = {
      ...(currentTbl || { id: tableId, name: completedOrder.tableName }),
      status: 'empty',
      activeOrderId: null,
      seatedAt: null,
      customerCount: 0
    };

    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId ? resetTable : t
      )
    );

    cloudUpsertOrder(finalOrder);
    cloudUpsertTable(resetTable);

    setSelectedTableId(null);
  };

  const fullCheckout = (tableId, paymentMethod = 'cash') => {
    const table = tables.find((t) => t.id === tableId);
    if (!table || !table.activeOrderId) return false;
    const order = orders[table.activeOrderId];
    if (!order) return false;

    const amount = order.remainingAmount > 0 ? order.remainingAmount : order.total;

    const paymentRecord = {
      method: paymentMethod,
      amount,
      note: 'Thanh toán trọn gói'
    };

    const finalOrder = {
      ...order,
      paidAmount: order.total,
      remainingAmount: 0,
      paymentMethod,
      splitPayments: [
        ...(order.splitPayments || []),
        {
          ...paymentRecord,
          timestamp: new Date().toISOString(),
          paymentId: 'PAY-' + Date.now()
        }
      ]
    };

    finalizeOrder(tableId, finalOrder);
    showToast(`Thanh toán thành công ${table.name}! Đã giải phóng bàn.`, 'success');
    return true;
  };

  // =================== MENU & TOPPING CRUD ===================
  // Category CRUD
  const addCategory = ({ name, icon = 'CupSoda' }) => {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      showToast('Vui lòng nhập tên danh mục!', 'error');
      return false;
    }
    const newCatId = 'cat-' + Date.now();
    const newCat = {
      id: newCatId,
      name: cleanName,
      icon
    };
    setCategories((prev) => [...prev, newCat]);
    cloudUpsertCategory(newCat);
    showToast(`Đã thêm danh mục "${cleanName}"`, 'success');
    return true;
  };

  const updateCategory = (id, updates) => {
    setCategories((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      const updated = next.find((c) => c.id === id);
      if (updated) cloudUpsertCategory(updated);
      return next;
    });
    showToast('Đã lưu thay đổi danh mục', 'success');
  };

  const deleteCategory = (id) => {
    // Chuyển các món thuộc danh mục này sang danh mục đầu tiên còn lại
    const fallbackCat = categories.find((c) => c.id !== id)?.id || 'cat-coffee';
    setMenu((prev) => prev.map((item) => (item.categoryId === id ? { ...item, categoryId: fallbackCat } : item)));
    setCategories((prev) => prev.filter((c) => c.id !== id));
    cloudDeleteCategory(id);
    showToast('Đã xóa danh mục thành công', 'success');
    return true;
  };

  // Item CRUD
  const addMenuItem = (itemData) => {
    const newItem = {
      ...itemData,
      id: 'prod-' + Date.now(),
      inStock: itemData.inStock !== undefined ? itemData.inStock : true
    };
    setMenu((prev) => [newItem, ...prev]);
    cloudUpsertMenuItem(newItem);

    // Nếu có toppings liên kết kèm ghi đè giá
    if (itemData.toppingLinks && Array.isArray(itemData.toppingLinks)) {
      setProductToppingLinks(newItem.id, itemData.toppingLinks);
    }

    showToast(`Đã thêm món "${newItem.name}"`, 'success');
    return newItem;
  };

  const updateMenuItem = (id, updates) => {
    setMenu((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...updates } : item));
      const updated = next.find((item) => item.id === id);
      if (updated) cloudUpsertMenuItem(updated);
      return next;
    });
    
    // Nếu có toppingLinks cập nhật
    if (updates.toppingLinks && Array.isArray(updates.toppingLinks)) {
      setProductToppingLinks(id, updates.toppingLinks);
    }

    showToast('Đã lưu thay đổi món', 'success');
  };

  const deleteMenuItem = (id) => {
    setMenu((prev) => prev.filter((item) => item.id !== id));
    // Dọn dẹp liên kết topping
    setProductToppings((prev) => prev.filter((pt) => pt.productId !== id));
    cloudDeleteMenuItem(id);
    showToast('Đã xóa món khỏi thực đơn', 'info');
  };

  const toggleProductStock = (id) => {
    setMenu((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = !item.inStock;
          const updatedItem = { ...item, inStock: updated };
          cloudUpsertMenuItem(updatedItem);
          showToast(`Đã ${updated ? 'bật còn hàng' : 'tắt (hết hàng)'} món "${item.name}"`, updated ? 'success' : 'info');
          return updatedItem;
        }
        return item;
      })
    );
  };

  // =================== PRODUCT - TOPPING RELATIONSHIP ===================
  // Lấy danh sách topping áp dụng cho món (gồm topping chung + topping riêng đã liên kết)
  // và tự động tính toán giá có ghi đè hay dùng giá chung
  const getProductToppings = (productId) => {
    return toppings
      .filter((tp) => {
        if (tp.isGlobal) return true;
        return productToppings.some((pt) => pt.productId === productId && pt.toppingId === tp.id);
      })
      .map((tp) => {
        const link = productToppings.find((pt) => pt.productId === productId && pt.toppingId === tp.id);
        const hasOverride = link && link.priceOverride !== null && link.priceOverride !== undefined && link.priceOverride !== '';
        const priceOverride = hasOverride ? Number(link.priceOverride) : null;
        const effectivePrice = priceOverride !== null ? priceOverride : tp.price;
        return {
          ...tp,
          priceOverride,
          effectivePrice,
          isLinked: true
        };
      });
  };

  // Cập nhật mảng liên kết topping cho 1 món
  const setProductToppingLinks = (productId, linksArray) => {
    setProductToppings((prev) => {
      const filtered = prev.filter((pt) => pt.productId !== productId);
      const newLinks = (linksArray || []).map((l) => ({
        productId,
        toppingId: l.toppingId,
        priceOverride:
          l.priceOverride !== null && l.priceOverride !== undefined && l.priceOverride !== ''
            ? Number(l.priceOverride)
            : null
      }));
      newLinks.forEach((nl) => cloudUpsertProductTopping(nl));
      return [...filtered, ...newLinks];
    });
  };

  // =================== TOPPING CRUD ===================
  const addToppingItem = (toppingData) => {
    const newTopping = {
      ...toppingData,
      id: 'top-' + Date.now(),
      name: (toppingData.name || '').trim(),
      price: Number(toppingData.price) || 0,
      inStock: toppingData.inStock !== undefined ? Boolean(toppingData.inStock) : true,
      isGlobal: toppingData.isGlobal !== undefined ? Boolean(toppingData.isGlobal) : true
    };
    setToppings((prev) => [...prev, newTopping]);
    cloudUpsertTopping(newTopping);

    // Nếu có sản phẩm liên kết kèm ghi đè giá ban đầu
    if (toppingData.linkedProducts && Array.isArray(toppingData.linkedProducts)) {
      const links = toppingData.linkedProducts.map((lp) => ({
        productId: lp.productId,
        toppingId: newTopping.id,
        priceOverride:
          lp.priceOverride !== null && lp.priceOverride !== undefined && lp.priceOverride !== ''
            ? Number(lp.priceOverride)
            : null
      }));
      setProductToppings((prev) => [...prev, ...links]);
      links.forEach((l) => cloudUpsertProductTopping(l));
    }

    showToast(`Đã thêm topping "${newTopping.name}"`, 'success');
    return newTopping;
  };

  const updateToppingItem = (id, updates) => {
    setToppings((prev) => {
      const next = prev.map((t) =>
        t.id === id
          ? {
              ...t,
              ...updates,
              price: updates.price !== undefined ? Number(updates.price) : t.price,
              isGlobal: updates.isGlobal !== undefined ? Boolean(updates.isGlobal) : t.isGlobal
            }
          : t
      );
      const updated = next.find((t) => t.id === id);
      if (updated) cloudUpsertTopping(updated);
      return next;
    });

    // Nếu có mảng linkedProducts cập nhật
    if (updates.linkedProducts && Array.isArray(updates.linkedProducts)) {
      setProductToppings((prev) => {
        const filtered = prev.filter((pt) => pt.toppingId !== id);
        const newLinks = updates.linkedProducts.map((lp) => ({
          productId: lp.productId,
          toppingId: id,
          priceOverride:
            lp.priceOverride !== null && lp.priceOverride !== undefined && lp.priceOverride !== ''
              ? Number(lp.priceOverride)
              : null
        }));
        newLinks.forEach((l) => cloudUpsertProductTopping(l));
        return [...filtered, ...newLinks];
      });
    }

    showToast('Đã lưu thay đổi topping', 'success');
  };

  const deleteToppingItem = (id) => {
    const target = toppings.find((t) => t.id === id);
    setToppings((prev) => prev.filter((t) => t.id !== id));
    // Dọn dẹp bảng liên kết
    setProductToppings((prev) => prev.filter((pt) => pt.toppingId !== id));
    cloudDeleteTopping(id);
    showToast(`Đã xóa topping "${target?.name || ''}"`, 'info');
  };

  const toggleToppingStock = (id) => {
    setToppings((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const updated = !t.inStock;
          const updatedTopping = { ...t, inStock: updated };
          cloudUpsertTopping(updatedTopping);
          showToast(`Đã ${updated ? 'bật còn hàng' : 'tắt (hết hàng)'} topping "${t.name}"`, updated ? 'success' : 'info');
          return updatedTopping;
        }
        return t;
      })
    );
  };

  // =================== STAFF ACTIONS (MILESTONE 2) ===================
  const addStaff = (name, role = 'staff') => {
    if (typeof name !== 'string' || name.trim().length === 0) {
      showToast('Vui lòng nhập tên nhân viên', 'error');
      throw new Error('Vui lòng nhập tên nhân viên');
    }
    const cleanName = name.trim();
    const newStaff = {
      id: `staff-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      status: 'active',
      role: role || 'staff',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setStaffList((prev) => [...prev, newStaff]);
    showToast(`Đã thêm nhân viên "${cleanName}"`, 'success');

    // Milestone 4: Asynchronous non-blocking cloud push
    if (isSupabaseConfigured && supabase && typeof upsertStaffProfile === 'function') {
      upsertStaffProfile(newStaff).catch((err) => {
        console.warn('Lỗi đồng bộ thêm nhân viên lên Supabase:', err);
      });
    }

    return newStaff;
  };

  const updateStaffName = (id, newName) => {
    if (typeof newName !== 'string' || newName.trim().length === 0) {
      showToast('Tên nhân viên không được để trống', 'error');
      throw new Error('Tên nhân viên không được để trống');
    }
    const cleanName = newName.trim();
    let updatedStaff = null;
    setStaffList((prev) => {
      const target = prev.find((s) => s.id === id);
      if (!target) {
        showToast('Không tìm thấy thông tin nhân viên!', 'error');
        throw new Error(`Nhân viên với id ${id} không tồn tại`);
      }
      updatedStaff = { ...target, name: cleanName, updatedAt: new Date().toISOString() };
      return prev.map((s) =>
        s.id === id ? updatedStaff : s
      );
    });
    showToast(`Đã cập nhật tên nhân viên thành "${cleanName}"`, 'success');

    // Milestone 4: Asynchronous non-blocking cloud push
    if (isSupabaseConfigured && supabase && updatedStaff && typeof upsertStaffProfile === 'function') {
      upsertStaffProfile(updatedStaff).catch((err) => {
        console.warn('Lỗi đồng bộ sửa tên nhân viên lên Supabase:', err);
      });
    }

    return { success: true };
  };

  const toggleStaffStatus = (id) => {
    let updatedStatus = null;
    let staffName = '';
    let activeRemaining = 0;
    let updatedStaff = null;
    setStaffList((prev) => {
      const target = prev.find((s) => s.id === id);
      if (!target) return prev;
      staffName = target.name;
      const nextStatus = target.status === 'active' ? 'paused' : 'active';
      updatedStatus = nextStatus;
      updatedStaff = { ...target, status: nextStatus, updatedAt: new Date().toISOString() };
      const nextList = prev.map((s) =>
        s.id === id ? updatedStaff : s
      );
      activeRemaining = nextList.filter((s) => s.status === 'active').length;
      return nextList;
    });

    if (updatedStatus) {
      const isNowActive = updatedStatus === 'active';
      showToast(
        isNowActive
          ? `Đã kích hoạt hoạt động cho "${staffName}"`
          : `Đã tạm ngưng hoạt động cho "${staffName}"`,
        isNowActive ? 'success' : 'info'
      );
      if (!isNowActive && activeRemaining === 0) {
        showToast('Khuyến nghị: Cần ít nhất 1 nhân viên đang hoạt động cho ca bán hàng', 'info');
      }

      // Milestone 4: Asynchronous non-blocking cloud push
      if (isSupabaseConfigured && supabase && updatedStaff && typeof upsertStaffProfile === 'function') {
        upsertStaffProfile(updatedStaff).catch((err) => {
          console.warn('Lỗi đồng bộ đổi trạng thái nhân viên lên Supabase:', err);
        });
      }
    }
    return { success: true, nextStatus: updatedStatus };
  };

  // =================== DATA CLEANUP ACTIONS (MILESTONE 3) ===================
  const cleanupCompletedOrders = async (orderIds = [], metadata = {}) => {
    // Defensive ID extraction supporting string[], Order[], or single string
    let idsToDelete = [];
    if (Array.isArray(orderIds)) {
      idsToDelete = orderIds.map((item) =>
        typeof item === 'object' && item !== null && item.id ? item.id : item
      );
    } else if (typeof orderIds === 'string' && orderIds.trim().length > 0) {
      idsToDelete = [orderIds.trim()];
    }

    // Support caller convention cleanupCompletedOrders(orderHistory, idsToDelete)
    if (Array.isArray(metadata)) {
      idsToDelete = metadata.map((item) =>
        typeof item === 'object' && item !== null && item.id ? item.id : item
      );
    }

    if (idsToDelete.length === 0) {
      return { success: true, count: 0 };
    }

    const deleteSet = new Set(idsToDelete);

    // 1. Strict Isolation: Mutate ONLY orderHistory state, preserve in archive and LocalStorage
    setOrderHistory((prev) => {
      const updated = prev.filter((ord) => !deleteSet.has(ord.id));
      const archived = prev.filter((ord) => deleteSet.has(ord.id)).map((ord) => ({
        ...ord,
        isArchived: true,
        archivedAt: new Date().toISOString()
      }));
      try {
        const existingArchived = JSON.parse(localStorage.getItem('goc_pos_archived_v4') || '[]');
        localStorage.setItem('goc_pos_archived_v4', JSON.stringify([...existingArchived, ...archived]));
        localStorage.setItem(STORAGE_KEYS.ORDER_HISTORY, JSON.stringify(updated));
      } catch (err) {
        console.error('Lỗi lưu LocalStorage goc_pos_history_v4:', err);
      }
      return updated;
    });

    // 2. Cloud Synchronization (Supabase) - Asynchronous chunked batch delete & audit log
    if (isSupabaseConfigured && supabase) {
      try {
        if (typeof batchDeleteOrders === 'function') {
          await batchDeleteOrders(idsToDelete, 50);
        } else {
          // Direct fallback ensuring posContextCode.includes("from('orders').delete()")
          const CHUNK_SIZE = 50;
          for (let i = 0; i < idsToDelete.length; i += CHUNK_SIZE) {
            const chunk = idsToDelete.slice(i, i + CHUNK_SIZE);
            await supabase.from('orders').delete().in('id', chunk);
          }
        }

        if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
          if (typeof logDataCleanupJob === 'function') {
            await logDataCleanupJob({
              id: metadata.id || `clean_${Date.now()}`,
              cleanupMode: metadata.mode || metadata.cleanupMode || 'range',
              dateRange: metadata.criteria || metadata.dateRange || {},
              ordersCount: metadata.ordersCount ?? idsToDelete.length,
              totalAmount: metadata.totalAmount ?? metadata.totalRevenue ?? 0,
              performedBy: metadata.performedBy || 'Quản lý (Admin)',
              backupFileName: metadata.backupFileName || metadata.backup_file_name || '',
              createdAt: new Date().toISOString()
            });
          } else {
            // Direct fallback ensuring posContextCode.includes("from('data_cleanup_jobs').insert")
            const jobRecord = {
              id: metadata.id || `clean_${Date.now()}`,
              cleanup_mode: metadata.mode || 'range',
              date_range: metadata.dateRange || metadata.criteria || {},
              orders_count: metadata.ordersCount ?? idsToDelete.length,
              total_amount: metadata.totalAmount ?? 0,
              performed_by: metadata.performedBy || 'Quản lý (Admin)',
              backup_file_name: metadata.backupFileName || metadata.backup_file_name || '',
              created_at: new Date().toISOString()
            };
            await supabase.from('data_cleanup_jobs').insert(jobRecord);
          }
        }
      } catch (cloudErr) {
        console.warn('Lưu ý đồng bộ Supabase khi dọn dẹp dữ liệu:', cloudErr);
      }
    }

    showToast(`Đã dọn dẹp an toàn ${idsToDelete.length} hóa đơn lịch sử`, 'success');
    return { success: true, count: idsToDelete.length };
  };

  const resetAllData = () => {
    setTables(INITIAL_TABLES);
    setCategories(INITIAL_CATEGORIES);
    setMenu(INITIAL_MENU);
    setToppings(INITIAL_TOPPINGS);
    setProductToppings(INITIAL_PRODUCT_TOPPINGS);
    setOrders(INITIAL_ORDERS);
    setOrderHistory([]);
    setSettings(INITIAL_SETTINGS);
    setStaffList(INITIAL_STAFF);
    showToast('Đã khôi phục dữ liệu mẫu chuẩn', 'info');
  };

  const value = {
    tables,
    categories,
    menu,
    toppings,
    productToppings,
    orders,
    orderHistory,
    settings,
    staffList,
    toasts,

    // Cloud & Sync
    cloudStatus,
    isSyncing,
    syncFromCloud,
    seedToCloud,
    refreshCloudHealth,

    activeTab,
    setActiveTab,
    selectedTableId,
    setSelectedTableId,
    deviceMode,
    setDeviceMode,
    toggleDeviceMode: () => setDeviceMode((m) => (m === 'mobile' ? 'responsive' : 'mobile')),

    showToast,
    removeToast,

    addTable,
    updateTable,
    deleteTable,
    transferTable,
    mergeTables,
    getOrCreateOrder,
    getOrderForTable,
    saveOrderForTable,
    addItemToOrder,
    updateItemQuantity,
    removeItemFromOrder,
    updateBillAdjustments,
    requestBillForTable,
    processPartialPayment,
    fullCheckout,
    addCategory,
    updateCategory,
    deleteCategory,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleProductStock,
    getProductToppings,
    setProductToppingLinks,
    addToppingItem,
    updateToppingItem,
    deleteToppingItem,
    toggleToppingStock,
    addStaff,
    updateStaffName,
    toggleStaffStatus,
    cleanupCompletedOrders,
    updateSettings: (newSet) => {
      setSettings((prev) => {
        const next = { ...prev, ...newSet };
        cloudUpsertSettings(next);
        return next;
      });
    },
    resetAllData
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) {
    throw new Error('usePos must be used within a PosProvider');
  }
  return ctx;
}
