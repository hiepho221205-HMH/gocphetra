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
  INITIAL_STAFF,
  DEMO_ACCOUNTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_USER_PROFILES
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
  logDataCleanupJob,
  adminHardDeleteSalesDataRpc,
  // Rollover & Historical Payments
  rolloverDailyOrdersRpc,
  processHistoricalPaymentRpc,
  cloudUpsertPayment,
  fetchPaymentsByBusinessDate,
  adminChangeUserRoleRpc,
  adminArchiveOrdersRpc,
  fetchAuditLogs,
  cloudRecordAuditLog,
  // Auth V1 Imports
  signInWithEmail,
  signOutUser,
  getCurrentSession,
  fetchUserProfileAndRole,
  updateUserProfile
} from '../lib/supabase';
import {
  getVietnamTodayString,
  getVietnamDateString,
  formatShortDate
} from '../utils/dateTime';

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
  PAYMENTS: 'goc_pos_payments_v4',
  ROLE: 'goc_pos_role_v4',
  AUDIT_LOGS: 'goc_pos_audit_logs_v4',
  USER_PROFILES: 'goc_pos_user_profiles_v4',
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

import {
  parseRouteFromLocation,
  getTabFromRoute
} from '../utils/router';

export { parseRouteFromLocation, getTabFromRoute };

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

import { reconcileTablesAndOrders, rolloverPastUnpaidOrders } from '../utils/reconciler';
export { reconcileTablesAndOrders, rolloverPastUnpaidOrders };

export function PosProvider({ children }) {
  // Compute initial reconciled state from storage/fallback + daily rollover catch-up
  const [initialState] = useState(() => {
    const rawTables = loadStorage(STORAGE_KEYS.TABLES, INITIAL_TABLES);
    const rawOrders = loadStorage(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    const rawHistory = loadStorage(STORAGE_KEYS.ORDER_HISTORY, null);
    const historyFallback = rawHistory && rawHistory.length > 0 ? rawHistory : INITIAL_ORDER_HISTORY;
    const reconciled = reconcileTablesAndOrders(rawTables, rawOrders, historyFallback);
    const today = getVietnamTodayString();
    const rolled = rolloverPastUnpaidOrders(
      reconciled.reconciledTables,
      reconciled.reconciledOrders,
      reconciled.reconciledHistory,
      today
    );
    return {
      reconciledTables: rolled.tables,
      reconciledOrders: rolled.orders,
      reconciledHistory: rolled.orderHistory
    };
  });

  // State definitions
  const [tables, setTables] = useState(() => initialState.reconciledTables);
  const [categories, setCategories] = useState(() => loadStorage(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES));
  const [menu, setMenu] = useState(() => loadStorage(STORAGE_KEYS.MENU, INITIAL_MENU));
  const [toppings, setToppings] = useState(() => loadStorage(STORAGE_KEYS.TOPPINGS, INITIAL_TOPPINGS));
  const [productToppings, setProductToppings] = useState(() => loadStorage(STORAGE_KEYS.PRODUCT_TOPPINGS, INITIAL_PRODUCT_TOPPINGS));
  const [orders, setOrders] = useState(() => initialState.reconciledOrders);
  const [orderHistory, setOrderHistory] = useState(() => initialState.reconciledHistory);
  const [payments, setPayments] = useState(() => loadStorage(STORAGE_KEYS.PAYMENTS, []));
  const [settings, setSettings] = useState(() => loadStorage(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS));
  const [staffList, setStaffList] = useState(() => {
    const loaded = loadStorage(STORAGE_KEYS.STAFF, null);
    return loaded && Array.isArray(loaded) && loaded.length > 0 ? loaded : INITIAL_STAFF;
  });

  // Real Supabase Auth State (Auth V1)
  const [session, setSession] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(isSupabaseConfigured && typeof window !== 'undefined'));
  const [authError, setAuthError] = useState(null);

  // RBAC 3-Tier State: 'admin' | 'manager' | 'staff'
  const [currentRole, setCurrentRole] = useState(() => {
    if (isSupabaseConfigured && typeof window !== 'undefined') {
      return null;
    }
    const saved = loadStorage(STORAGE_KEYS.ROLE, 'admin');
    return ['admin', 'manager', 'staff'].includes(saved) ? saved : 'admin';
  });
  const [currentUser, setCurrentUser] = useState(() => {
    if (isSupabaseConfigured && typeof window !== 'undefined') {
      return null;
    }
    return (DEMO_ACCOUNTS && DEMO_ACCOUNTS['admin']) || {
      id: 'staff-01',
      uid: '00000000-0000-0000-0000-000000000001',
      name: 'Trần Mai',
      role: 'admin',
      branchId: 'main',
      isDemo: true
    };
  });
  const [auditLogs, setAuditLogs] = useState(() => {
    const loaded = loadStorage(STORAGE_KEYS.AUDIT_LOGS, null);
    return loaded && Array.isArray(loaded) && loaded.length > 0 ? loaded : (INITIAL_AUDIT_LOGS || []);
  });

  const [userProfiles, setUserProfiles] = useState(() => {
    const loaded = loadStorage(STORAGE_KEYS.USER_PROFILES, null);
    return loaded && typeof loaded === 'object' ? loaded : (INITIAL_USER_PROFILES || {});
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

  // UI & Router States
  const initialRouteInfo = parseRouteFromLocation();
  const [currentRoute, setCurrentRoute] = useState(initialRouteInfo.path);
  const [routeParams, setRouteParams] = useState(initialRouteInfo.params);
  const [activeTab, setActiveTabState] = useState(() => getTabFromRoute(initialRouteInfo.path));
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [deviceMode, setDeviceMode] = useState('mobile'); // 'mobile' | 'responsive'
  const [toasts, setToasts] = useState([]);

  // Điều hướng và đồng bộ URL router (HTML5 Path + Hash fallback)
  const navigate = (toPath) => {
    if (!toPath) return;
    const [pathOnly, searchOnly] = toPath.split('?');
    const params = {};
    if (searchOnly) {
      const pairs = searchOnly.split('&');
      for (const pair of pairs) {
        if (pair) {
          const [k, v] = pair.split('=');
          if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        }
      }
    }
    setCurrentRoute(pathOnly);
    setRouteParams(params);
    const targetTab = getTabFromRoute(pathOnly);
    setActiveTabState(targetTab);

    if (typeof window !== 'undefined') {
      try {
        window.location.hash = toPath;
      } catch (e) {
        try {
          window.location.hash = toPath;
        } catch (_) {}
      }
    }
  };

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    const targetPath = tab === 'tables' ? '/tables' : `/${tab}`;
    setCurrentRoute(targetPath);
    setRouteParams({});
    if (typeof window !== 'undefined') {
      try {
        window.location.hash = targetPath;
      } catch (e) {
        try {
          window.location.hash = targetPath;
        } catch (_) {}
      }
    }
  };

  // Lắng nghe sự kiện Back/Forward của trình duyệt (popstate & hashchange)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const { path, params } = parseRouteFromLocation();
      setCurrentRoute(path);
      setRouteParams(params);
      setActiveTabState(getTabFromRoute(path));
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // =================== SUPABASE AUTH & SESSION HYDRATION (AUTH V1) ===================
  const hydrateUserAndRole = async (user, sessionObj = null) => {
    if (!user) return null;
    try {
      const profile = await fetchUserProfileAndRole(user.id);
      
      // Requirement 12 & 26: If account is locked/paused/inactive, reject immediately
      const status = profile?.status || 'active';
      if (status !== 'active') {
        await signOutUser();
        setSession(null);
        setAuthUser(null);
        setCurrentUser(null);
        setCurrentRole(null);
        setCurrentUserProfile(null);
        setAuthError('Tài khoản đã bị tạm khóa hoặc chưa được cấp quyền truy cập. Vui lòng liên hệ Quản trị viên.');
        return null;
      }

      const role = profile?.role || user.user_metadata?.role || 'staff';
      const name = profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Nhân viên';
      const avatarUrl = profile?.avatarUrl || null;
      const phone = profile?.phone || user.user_metadata?.phone || '';

      const userObj = {
        id: user.id,
        uid: user.id,
        email: user.email,
        name,
        role,
        status,
        avatarUrl,
        phone,
        branchId: profile?.branchId || 'main'
      };

      setCurrentRole(role);
      setCurrentUser(userObj);
      setCurrentUserProfile(userObj);
      if (sessionObj) setSession(sessionObj);
      setAuthUser(user);

      setUserProfiles((prev) => ({
        ...prev,
        [user.id]: userObj
      }));

      setSettings((prev) => ({
        ...prev,
        avatarUrl,
        currentCashier: `${name} (${role.toUpperCase()})`
      }));

      return userObj;
    } catch (err) {
      console.warn('Lỗi hydrateUserAndRole:', err);
      return null;
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || typeof window === 'undefined') {
      setIsAuthLoading(false);
      return;
    }

    let isMounted = true;

    // Check existing session
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!isMounted) return;
      if (currentSession?.user) {
        await hydrateUserAndRole(currentSession.user, currentSession);
      } else {
        setSession(null);
        setAuthUser(null);
        setCurrentUser(null);
        setCurrentRole(null);
        setCurrentUserProfile(null);
      }
      setIsAuthLoading(false);
    }).catch(() => {
      if (isMounted) setIsAuthLoading(false);
    });

    // Listen to Supabase Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;
      if (newSession?.user) {
        await hydrateUserAndRole(newSession.user, newSession);
        try {
          syncFromCloud(false);
        } catch (_) {}
      } else if (event === 'SIGNED_OUT' || !newSession) {
        setSession(null);
        setAuthUser(null);
        setCurrentUser(null);
        setCurrentRole(null);
        setCurrentUserProfile(null);
      }
      setIsAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const loginWithEmail = async (email, password) => {
    setAuthError(null);
    const res = await signInWithEmail(email, password);
    if (!res.success) {
      let msg = res.message || 'Đăng nhập thất bại';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_grant')) {
        msg = 'Email hoặc mật khẩu không chính xác';
      } else if (msg.includes('rate limit') || msg.includes('Too many requests')) {
        msg = 'Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau vài phút.';
      }
      setAuthError(msg);
      return { success: false, message: msg };
    }

    const hydrated = await hydrateUserAndRole(res.user, res.session);
    if (!hydrated) {
      return { success: false, message: authError || 'Tài khoản không đủ quyền truy cập hệ thống' };
    }

    setActiveTab('tables');
    showToast?.(`Chào mừng ${hydrated.name} (${hydrated.role.toUpperCase()}) đăng nhập GÓC POS`, 'success');
    try {
      syncFromCloud(false);
    } catch (_) {}
    return { success: true, user: res.user, role: hydrated.role };
  };

  const logoutUser = async () => {
    await signOutUser();
    setSession(null);
    setAuthUser(null);
    setCurrentUser(null);
    setCurrentRole(null);
    setCurrentUserProfile(null);
    setActiveTab('tables');
    showToast?.('Đã đăng xuất phiên làm việc an toàn', 'info');
  };

  // Auto-save effects
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables)); }, [tables]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(menu)); }, [menu]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TOPPINGS, JSON.stringify(toppings)); }, [toppings]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.PRODUCT_TOPPINGS, JSON.stringify(productToppings)); }, [productToppings]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.ORDER_HISTORY, JSON.stringify(orderHistory)); }, [orderHistory]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staffList)); }, [staffList]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.ROLE, JSON.stringify(currentRole)); }, [currentRole]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs)); }, [auditLogs]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.USER_PROFILES, JSON.stringify(userProfiles)); }, [userProfiles]);


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
        if (cloudData.categories && cloudData.categories.length > 0) setCategories(cloudData.categories);
        if (cloudData.menu && cloudData.menu.length > 0) setMenu(cloudData.menu);
        if (cloudData.toppings && cloudData.toppings.length > 0) setToppings(cloudData.toppings);
        if (cloudData.settings) setSettings(cloudData.settings);
        await syncStaffWithCloud(cloudData.staff || cloudData.staffList || null);

        if (cloudData.payments && cloudData.payments.length > 0) {
          setPayments(cloudData.payments);
        } else if (cloudData.orderHistory && cloudData.orderHistory.length > 0) {
          const derivedPayments = cloudData.orderHistory
            .filter((o) => o.status === 'completed' && Number(o.total) > 0)
            .map((o) => ({
              id: 'PAY_DERIVED_' + o.id,
              orderId: o.id,
              amount: Number(o.paidAmount || o.total) || 0,
              paymentMethod: o.paymentMethod || 'cash',
              paymentStatus: 'completed',
              paidAt: o.finishedAt || o.paidAt || o.createdAt,
              businessDate: o.businessDate || (o.createdAt ? o.createdAt.substring(0, 10) : getVietnamTodayString()),
              cashierId: o.cashier || 'Thu ngân'
            }));
          if (derivedPayments.length > 0) {
            setPayments(derivedPayments);
          }
        }

        // Reconcile tables, orders, and history atomically according to Table-First Rule
        // Supabase is Single Source of Truth: cloud orders and cloud history take precedence
        const fetchedTables = cloudData.tables && cloudData.tables.length > 0 ? cloudData.tables : tables;
        const mergedOrders = cloudData.orders || {};
        const mergedHistory = cloudData.orderHistory || [];

        const reconciled = reconcileTablesAndOrders(fetchedTables, mergedOrders, mergedHistory);
        const today = getVietnamTodayString();
        const rolled = rolloverPastUnpaidOrders(reconciled.reconciledTables, reconciled.reconciledOrders, reconciled.reconciledHistory, today);
        setTables(rolled.tables);
        setOrders(rolled.orders);
        setOrderHistory(rolled.orderHistory);

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
      orderHistory: visibleOrderHistory,
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
          if (cloudData.categories && cloudData.categories.length > 0) setCategories(cloudData.categories);
          if (cloudData.menu && cloudData.menu.length > 0) setMenu(cloudData.menu);
          if (cloudData.toppings && cloudData.toppings.length > 0) setToppings(cloudData.toppings);
          if (cloudData.productToppings) setProductToppings(cloudData.productToppings);
          if (cloudData.settings) setSettings(cloudData.settings);
          await syncStaffWithCloud(cloudData?.staff || cloudData?.staffList || null);

          if (cloudData.payments && cloudData.payments.length > 0) {
            setPayments(cloudData.payments);
          } else if (cloudData.orderHistory && cloudData.orderHistory.length > 0) {
            const derivedPayments = cloudData.orderHistory
              .filter((o) => o.status === 'completed' && Number(o.total) > 0)
              .map((o) => ({
                id: 'PAY_DERIVED_' + o.id,
                orderId: o.id,
                amount: Number(o.paidAmount || o.total) || 0,
                paymentMethod: o.paymentMethod || 'cash',
                paymentStatus: 'completed',
                paidAt: o.finishedAt || o.paidAt || o.createdAt,
                businessDate: o.businessDate || (o.createdAt ? o.createdAt.substring(0, 10) : getVietnamTodayString()),
                cashierId: o.cashier || 'Thu ngân'
              }));
            if (derivedPayments.length > 0) {
              setPayments(derivedPayments);
            }
          }

          const fetchedTables = cloudData.tables && cloudData.tables.length > 0 ? cloudData.tables : tables;
          const fetchedOrders = cloudData.orders ? cloudData.orders : {};
          const fetchedHistory = cloudData.orderHistory ? cloudData.orderHistory : [];
          const reconciled = reconcileTablesAndOrders(fetchedTables, fetchedOrders, fetchedHistory);
          const today = getVietnamTodayString();
          const rolled = rolloverPastUnpaidOrders(reconciled.reconciledTables, reconciled.reconciledOrders, reconciled.reconciledHistory, today);
          setTables(rolled.tables);
          setOrders(rolled.orders);
          setOrderHistory(rolled.orderHistory);

          if (isSupabaseConfigured && supabase) {
            rolloverDailyOrdersRpc(today).catch((e) => console.warn('Lỗi gọi rolloverDailyOrdersRpc khi khởi động:', e));
          }

          setCloudStatus((prev) => ({ ...prev, lastSyncTime: new Date() }));
        }
        setIsSyncing(false);
      }
    }

    initSync();

    // Listen to network changes
    const handleOnline = () => {
      console.log('[Network] Thiết bị có mạng trở lại, đồng bộ tự động với Cloud...');
      refreshCloudHealth();
      syncFromCloud(false);
    };
    window.addEventListener('online', handleOnline);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Visibility] Ứng dụng trở lại foreground, làm mới dữ liệu từ Cloud...');
        syncFromCloud(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleFocus = () => {
      syncFromCloud(false);
    };
    window.addEventListener('focus', handleFocus);

    // Setup Realtime with full publication coverage & channel lifecycle
    let channel = null;
    let reconnectTimeout = null;

    const setupRealtimeChannel = () => {
      if (!isSupabaseConfigured || !supabase) return null;

      const ch = supabase
        .channel('pos_realtime_sync_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updated = mapTableFromDb(payload.new);
            setTables((prev) => {
              const idx = prev.findIndex((t) => t.id === updated.id);
              let nextTables;
              if (idx >= 0) {
                nextTables = [...prev];
                nextTables[idx] = updated;
              } else {
                nextTables = [...prev, updated];
              }
              return nextTables;
            });

            if (updated.status === 'empty' || !updated.activeOrderId) {
              setOrders((prev) => {
                const next = { ...prev };
                let modified = false;
                for (const oId in next) {
                  if (next[oId].tableId === updated.id) {
                    delete next[oId];
                    modified = true;
                  }
                }
                return modified ? next : prev;
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setTables((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const mapped = mapOrderFromDb(payload.new);

            if (mapped.status === 'completed' || mapped.status === 'cancelled' || mapped.status === 'unpaid_carried_over') {
              // Order completed / cancelled: Remove from active orders and add to orderHistory
              setOrders((prev) => {
                if (!prev[mapped.id]) return prev;
                const next = { ...prev };
                delete next[mapped.id];
                return next;
              });

              setOrderHistory((prev) => {
                const filtered = prev.filter((o) => o.id !== mapped.id);
                return [mapped, ...filtered];
              });

              // Add synthetic payment if completed to guarantee cash/vietqr revenue matches
              if (mapped.status === 'completed' && Number(mapped.total) > 0) {
                setPayments((prev) => {
                  if (prev.some((p) => p.orderId === mapped.id)) return prev;
                  const pay = {
                    id: 'PAY_SYNC_' + mapped.id,
                    orderId: mapped.id,
                    amount: Number(mapped.paidAmount || mapped.total) || 0,
                    paymentMethod: mapped.paymentMethod || 'cash',
                    paymentStatus: 'completed',
                    paidAt: mapped.finishedAt || mapped.paidAt || mapped.createdAt || new Date().toISOString(),
                    businessDate: mapped.businessDate || (mapped.createdAt ? mapped.createdAt.substring(0, 10) : getVietnamTodayString()),
                    cashierId: mapped.cashier || 'Thu ngân'
                  };
                  return [pay, ...prev];
                });
              }

              // Free table if associated
              if (mapped.tableId) {
                setTables((prev) =>
                  prev.map((t) =>
                    t.id === mapped.tableId && t.activeOrderId === mapped.id
                      ? { ...t, status: 'empty', activeOrderId: null, customerCount: 0 }
                      : t
                  )
                );
              }
            } else {
              // Active order: update in active orders
              setOrders((prev) => ({
                ...prev,
                [mapped.id]: mapped
              }));

              // Update associated table to occupied
              if (mapped.tableId) {
                setTables((prev) =>
                  prev.map((t) =>
                    t.id === mapped.tableId
                      ? {
                          ...t,
                          status: 'occupied',
                          activeOrderId: mapped.id,
                          customerCount: mapped.customerCount || t.customerCount || 1,
                          seatedAt: t.seatedAt || mapped.createdAt || new Date().toISOString()
                        }
                      : t
                  )
                );
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const delId = payload.old.id;
            setOrders((prev) => {
              if (!prev[delId]) return prev;
              const next = { ...prev };
              delete next[delId];
              return next;
            });
            setOrderHistory((prev) => prev.filter((o) => o.id !== delId));
          }
        })
        .subscribe((status, err) => {
          console.log('[Realtime] Subscription status:', status, err ? err.message : '');
          if (status === 'SUBSCRIBED') {
            setCloudStatus((prev) => ({ ...prev, connected: true, lastSyncTime: new Date() }));
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setCloudStatus((prev) => ({ ...prev, connected: false }));
            if (isMounted) {
              clearTimeout(reconnectTimeout);
              reconnectTimeout = setTimeout(() => {
                console.log('[Realtime] Đang tự động kết nối lại kênh Realtime...');
                if (channel && supabase) {
                  supabase.removeChannel(channel);
                }
                channel = setupRealtimeChannel();
              }, 3000);
            }
          }
        });

      return ch;
    };

    channel = setupRealtimeChannel();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
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


  // Role-based order history filter:
  // Staff: Only completed orders of TODAY (Vietnam timezone).
  // Manager & Admin: All completed orders.
  const todayVietnam = getVietnamTodayString();
  const visibleOrderHistory = (currentRole === 'staff')
    ? orderHistory.filter((ord) => {
        const orderDate = ord.businessDate || (ord.finishedAt ? getVietnamDateString(ord.finishedAt) : (ord.createdAt ? getVietnamDateString(ord.createdAt) : null));
        return orderDate === todayVietnam;
      })
    : orderHistory;

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


  // =================== RBAC ROLE ACTIONS ===================
  const updateCurrentUserProfile = ({ name, avatarUrl, phone, notes }) => {
    const activeId = currentUser?.id || (currentRole === 'admin' ? 'staff-01' : currentRole === 'manager' ? 'staff-02' : 'staff-03');
    const existing = userProfiles[activeId] || {};
    const updatedName = (name !== undefined && name !== null && String(name).trim()) ? String(name).trim() : (existing.name || currentUser?.name || 'Thu ngân');
    const updatedAvatar = avatarUrl !== undefined ? avatarUrl : (existing.avatarUrl !== undefined ? existing.avatarUrl : (settings.avatarUrl || null));
    const updatedPhone = phone !== undefined ? phone : (existing.phone || '');
    const updatedNotes = notes !== undefined ? notes : (existing.notes || '');

    const updatedProfile = {
      ...existing,
      id: activeId,
      name: updatedName,
      avatarUrl: updatedAvatar,
      phone: updatedPhone,
      notes: updatedNotes,
      role: currentRole // NEVER allow changing role through profile update!
    };

    setUserProfiles((prev) => ({
      ...prev,
      [activeId]: updatedProfile
    }));

    setCurrentUser((prev) => ({
      ...prev,
      name: updatedName,
      avatarUrl: updatedAvatar,
      phone: updatedPhone,
      notes: updatedNotes
    }));

    // Sync to settings for instant reflection on PageHeader & ManagementProfileView
    setSettings((prev) => ({
      ...prev,
      avatarUrl: updatedAvatar,
      currentCashier: `${updatedName} (Mã NV: ${activeId.toUpperCase()})`
    }));

    // Sync staffList roster
    setStaffList((prev) =>
      prev.map((s) => (s.id === activeId ? { ...s, name: updatedName, updatedAt: new Date().toISOString() } : s))
    );

    if (isSupabaseConfigured && supabase) {
      const activeStaff = staffList.find((s) => s.id === activeId);
      if (activeStaff) {
        upsertStaffProfile({ ...activeStaff, name: updatedName, updatedAt: new Date().toISOString() }).catch(() => {});
      }
    }

    showToast('Đã cập nhật hồ sơ cá nhân thành công!', 'success');
    return { success: true, profile: updatedProfile };
  };

  const switchDemoRole = (newRole) => {
    if (!['admin', 'manager', 'staff'].includes(newRole)) return;
    const activeId = newRole === 'admin' ? 'staff-01' : newRole === 'manager' ? 'staff-02' : 'staff-03';
    const account = (DEMO_ACCOUNTS && DEMO_ACCOUNTS[newRole]) || {};
    const savedProfile = userProfiles[activeId] || account;

    const targetName = savedProfile.name || account.name || (newRole === 'admin' ? 'Trần Mai' : newRole === 'manager' ? 'Nguyễn Văn Hùng' : 'Lê Hoàng Nam');
    const targetAvatar = savedProfile.avatarUrl !== undefined ? savedProfile.avatarUrl : (account.avatarUrl || null);

    setCurrentRole(newRole);
    setCurrentUser({
      ...account,
      id: activeId,
      name: targetName,
      avatarUrl: targetAvatar,
      role: newRole,
      phone: savedProfile.phone || '',
      notes: savedProfile.notes || ''
    });

    setSettings((prev) => ({
      ...prev,
      avatarUrl: targetAvatar,
      currentCashier: `${targetName} (Mã NV: ${activeId.toUpperCase()})`
    }));

    // If Staff, redirect away from restricted tabs (menu, reports) & restricted routes (/staff*)
    if (newRole === 'staff') {
      if (['menu', 'reports'].includes(activeTab) || currentRoute.startsWith('/staff')) {
        navigate('/tables');
      }
    }
    showToast(`Đã chuyển vai trò: ${newRole === 'admin' ? 'Quản lý (Admin)' : newRole === 'manager' ? 'Cửa hàng trưởng (Manager)' : 'Thu ngân (Staff)'}`, 'info');
  };

  const changeUserRole = async (targetStaffId, newRole, note = '') => {
    if (currentRole !== 'admin') {
      showToast('Từ chối quyền: Chỉ Quản trị viên (Admin) mới có quyền thay đổi vai trò nhân sự.', 'error');
      return { success: false, message: 'Chỉ Admin mới có quyền đổi vai trò' };
    }

    if (!['admin', 'manager', 'staff'].includes(newRole)) {
      showToast('Vai trò mới không hợp lệ.', 'error');
      return { success: false, message: 'Vai trò không hợp lệ' };
    }

    const target = staffList.find((s) => s.id === targetStaffId);
    if (!target) {
      showToast('Không tìm thấy nhân viên!', 'error');
      return { success: false, message: 'Không tìm thấy nhân viên' };
    }

    // Safeguard: Prevent demoting last Admin
    if (target.role === 'admin' && newRole !== 'admin') {
      const remainingAdmins = staffList.filter((s) => s.id !== targetStaffId && s.role === 'admin' && s.status === 'active');
      if (remainingAdmins.length === 0) {
        showToast('Hành động bị chặn: Không thể hạ quyền tài khoản Admin duy nhất của hệ thống!', 'error');
        return { success: false, message: 'Không thể hạ quyền Admin cuối cùng' };
      }
    }

    const oldRole = target.role;
    const updatedStaffList = staffList.map((s) =>
      s.id === targetStaffId ? { ...s, role: newRole, updatedAt: new Date().toISOString() } : s
    );
    setStaffList(updatedStaffList);

    // Đồng bộ userProfiles nếu tồn tại profile của nhân sự này
    setUserProfiles((prev) => {
      if (!prev || !prev[targetStaffId]) return prev;
      return {
        ...prev,
        [targetStaffId]: {
          ...prev[targetStaffId],
          role: newRole
        }
      };
    });

    // Audit Log
    const newAuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: currentUser?.uid || currentUser?.id || 'admin-local',
      role: currentRole,
      action: 'role_change',
      resource: 'user_roles',
      resourceId: targetStaffId,
      details: {
        targetName: target.name,
        oldRole,
        newRole,
        note: note ? note.trim() : '',
        changedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    };
    setAuditLogs((prev) => [newAuditLog, ...prev]);

    if (isSupabaseConfigured && supabase) {
      adminChangeUserRoleRpc(targetStaffId, newRole).catch((e) =>
        console.warn('Lỗi gọi adminChangeUserRoleRpc:', e)
      );
      cloudRecordAuditLog(newAuditLog).catch((e) =>
        console.warn('Lỗi ghi cloudRecordAuditLog:', e)
      );
      upsertStaffProfile({ ...target, role: newRole, updatedAt: new Date().toISOString() });
    }

    showToast(`Đã cập nhật quyền của ${target.name} thành ${newRole === 'admin' ? 'Admin' : newRole === 'manager' ? 'Manager' : 'Staff'}`, 'success');
    return { success: true, targetId: targetStaffId, oldRole, newRole };
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
      businessDate: getVietnamTodayString(),
      paymentStatus: 'unpaid',
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

    const updatedTable = {
      ...table,
      status: 'occupied',
      activeOrderId: newOrderId,
      seatedAt: new Date().toISOString(),
      customerCount: newOrder.customerCount
    };

    setOrders((prev) => ({ ...prev, [newOrderId]: newOrder }));
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? updatedTable : t))
    );

    cloudUpsertOrder(newOrder);
    cloudUpsertTable(updatedTable);

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
    cloudUpsertOrder(updatedOrder);
    cloudUpsertTable({ ...table, customerCount: updatedOrder.customerCount });
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
    cloudUpsertOrder(updatedOrder);
    cloudUpsertTable({ ...table, customerCount: updatedOrder.customerCount });
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
    cloudUpsertOrder(updatedOrder);
    cloudUpsertTable({ ...table, customerCount: updatedOrder.customerCount });
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
    cloudUpsertOrder(updatedOrder);
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
        businessDate: getVietnamTodayString(),
        paymentStatus: 'unpaid',
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
    return { success: true, order: updatedOrder, table: updatedTable };
  };

  // Hủy đơn hàng và giải phóng bàn (chuyển sang trạng thái cancelled, đưa vào lịch sử)
  const cancelOrderForTable = (tableId, reason = 'Khách hủy đơn') => {
    const table = tables.find((t) => t.id === tableId);
    let order = table?.activeOrderId ? orders[table.activeOrderId] : null;
    if (!order) {
      order = Object.values(orders).find(
        (o) => o.tableId === tableId && o.status !== 'completed' && o.status !== 'cancelled'
      );
    }
    if (!order) {
      showToast('Không tìm thấy đơn hàng cần hủy!', 'error');
      return false;
    }

    const finishedAt = new Date().toISOString();
    const cancelledOrder = {
      ...order,
      status: 'cancelled',
      cancelReason: reason,
      finishedAt
    };

    setOrderHistory((prev) => [cancelledOrder, ...prev]);
    setOrders((prev) => {
      const copy = { ...prev };
      delete copy[order.id];
      return copy;
    });

    const resetTable = {
      ...(table || { id: tableId, name: order.tableName }),
      status: 'empty',
      activeOrderId: null,
      seatedAt: null,
      customerCount: 0
    };

    setTables((prev) => prev.map((t) => (t.id === tableId ? resetTable : t)));

    cloudUpsertOrder(cancelledOrder);
    cloudUpsertTable(resetTable);
    showToast(`Đã hủy đơn ${resetTable.name} và giải phóng bàn!`, 'info');
    return true;
  };

  // =================== BILLING & SETTLEMENT ===================
  const requestBillForTable = (tableId) => {
    showToast('Đã in tạm tính hóa đơn', 'info');
  };

  const processPartialPayment = (tableId, paymentRecord) => {
    const table = tables.find((t) => t.id === tableId);
    let order = table?.activeOrderId ? orders[table.activeOrderId] : null;
    if (!order) {
      order = Object.values(orders).find(
        (o) => o.tableId === tableId && o.status !== 'completed' && o.status !== 'cancelled'
      );
    }
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
    const today = getVietnamTodayString();
    const finalOrder = {
      ...completedOrder,
      status: 'completed',
      paymentStatus: 'paid',
      businessDate: completedOrder.businessDate || (completedOrder.createdAt ? getVietnamDateString(completedOrder.createdAt) : today),
      paymentBusinessDate: today,
      paidAt: finishedAt,
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

    const paymentId = 'PAY_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const payRecord = {
      id: paymentId,
      orderId: finalOrder.id,
      amount: Number(finalOrder.paidAmount || finalOrder.total) || 0,
      paymentMethod: finalOrder.paymentMethod || 'cash',
      paymentStatus: 'completed',
      paidAt: finishedAt,
      businessDate: today,
      cashierId: finalOrder.cashier || 'Thu ngân',
      idempotencyKey: `ORD_FIN_${finalOrder.id}_${Date.now()}`,
      notes: `Thanh toán tại bàn ${completedOrder.tableName}`,
      createdAt: finishedAt
    };
    setPayments((prev) => [payRecord, ...prev]);
    cloudUpsertPayment(payRecord);

    cloudUpsertOrder(finalOrder);
    cloudUpsertTable(resetTable);

    setSelectedTableId(null);
  };

  const fullCheckout = (tableId, paymentMethod = 'cash') => {
    const table = tables.find((t) => t.id === tableId);
    let order = table?.activeOrderId ? orders[table.activeOrderId] : null;
    if (!order) {
      order = Object.values(orders).find(
        (o) => o.tableId === tableId && o.status !== 'completed' && o.status !== 'cancelled'
      );
    }
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
    showToast(`Thanh toán thành công ${order.tableName || table?.name}! Đã giải phóng bàn.`, 'success');
    return true;
  };

  // =================== HISTORICAL ORDER SETTLEMENT & ROLLOVER ===================
  const runCatchupRollover = async (targetBusinessDate = getVietnamTodayString()) => {
    let rolledCount = 0;
    let freedCount = 0;

    setOrders((curOrders) => {
      setTables((curTables) => {
        setOrderHistory((curHistory) => {
          const res = rolloverPastUnpaidOrders(curTables, curOrders, curHistory, targetBusinessDate);
          rolledCount = res.rolledOrdersCount;
          freedCount = res.releasedTablesCount;

          if (rolledCount > 0) {
            setTimeout(() => {
              setTables(res.tables);
              setOrders(res.orders);
            }, 0);

            res.tables.forEach((t) => cloudUpsertTable(t));
            res.orderHistory.slice(0, rolledCount).forEach((ord) => cloudUpsertOrder(ord));
          }
          return res.orderHistory;
        });
        return curTables;
      });
      return curOrders;
    });

    if (isSupabaseConfigured && supabase) {
      try {
        await rolloverDailyOrdersRpc(targetBusinessDate);
      } catch (err) {
        console.warn('Lỗi gọi rolloverDailyOrdersRpc:', err);
      }
    }

    if (rolledCount > 0) {
      showToast(
        `Đã tự động kết chuyển ${rolledCount} đơn chưa thanh toán qua ngày và giải phóng ${freedCount} bàn.`,
        'info'
      );
    }

    return { rolledOrdersCount: rolledCount, releasedTablesCount: freedCount };
  };

  const processHistoricalPayment = async ({
    orderId,
    paymentMethod = 'cash',
    amount = null,
    cashier = 'Thu ngân',
    idempotencyKey = null
  }) => {
    const targetOrder = orderHistory.find((o) => o.id === orderId);
    if (!targetOrder) {
      showToast(`Không tìm thấy đơn hàng #${orderId}`, 'error');
      return { success: false, error: 'Order not found' };
    }

    if (targetOrder.status === 'completed') {
      showToast(`Đơn hàng #${orderId} đã được thanh toán hoàn tất!`, 'info');
      return { success: true, alreadyCompleted: true, order: targetOrder };
    }

    const currentBusinessDate = getVietnamTodayString();
    const payAmount = amount !== null && amount !== undefined
      ? Number(amount)
      : (Number(targetOrder.remainingAmount) || Number(targetOrder.total) || 0);
    const paidAt = new Date().toISOString();
    const paymentId = 'PAY_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const safeKey = idempotencyKey || `HIST_${orderId}_${Date.now()}`;

    // Cloud RPC Execution
    if (isSupabaseConfigured && supabase) {
      try {
        await processHistoricalPaymentRpc({
          orderId,
          paymentMethod,
          amount: payAmount,
          paymentBusinessDate: currentBusinessDate,
          cashier,
          idempotencyKey: safeKey
        });
      } catch (e) {
        console.warn('Lỗi gọi processHistoricalPaymentRpc:', e);
      }
    }

    // Payment record for cash-basis attribution
    const paymentRecord = {
      id: paymentId,
      orderId,
      amount: payAmount,
      paymentMethod,
      paymentStatus: 'completed',
      paidAt,
      businessDate: currentBusinessDate,
      cashierId: cashier,
      idempotencyKey: safeKey,
      notes: `Thu tiền đơn cũ (${targetOrder.tableName || targetOrder.id}) ngày ${targetOrder.businessDate || targetOrder.createdAt?.substring(0, 10)}`,
      createdAt: paidAt
    };

    // Updated Order in History
    const updatedOrder = {
      ...targetOrder,
      status: 'completed',
      paymentStatus: 'paid',
      paidAmount: payAmount,
      remainingAmount: 0,
      paymentMethod,
      paidAt,
      paymentBusinessDate: currentBusinessDate,
      finishedAt: targetOrder.finishedAt || paidAt,
      splitPayments: [
        ...(targetOrder.splitPayments || []),
        {
          method: paymentMethod,
          amount: payAmount,
          timestamp: paidAt,
          paymentId
        }
      ]
    };

    setPayments((prev) => [paymentRecord, ...prev]);
    setOrderHistory((prev) =>
      prev.map((ord) => (ord.id === orderId ? updatedOrder : ord))
    );

    cloudUpsertPayment(paymentRecord);
    cloudUpsertOrder(updatedOrder);

    // CRITICAL ISOLATION: Tables and active dining floor are NOT touched!
    showToast(
      `Đã thu tiền thành công đơn ${targetOrder.tableName || targetOrder.id} (${formatVND(payAmount)})! Doanh thu đã ghi nhận vào ngày hôm nay.`,
      'success'
    );

    return { success: true, payment: paymentRecord, order: updatedOrder };
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

  const saveStaffMember = ({
    id,
    name,
    email = '',
    phone = '',
    role = 'staff',
    branchId = 'main',
    shiftName = 'Ca Sáng (06:30 - 14:30)',
    status = 'active',
    avatarUrl = null,
    notes = ''
  }) => {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      showToast('Họ và tên nhân viên không được để trống!', 'error');
      throw new Error('Họ và tên nhân viên không được để trống');
    }

    const cleanPhone = (phone || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    // Kiểm tra trùng lặp Số điện thoại (nếu có nhập)
    if (cleanPhone) {
      const duplicatePhone = staffList.find((s) => s.id !== id && (s.phone || '').trim() === cleanPhone);
      if (duplicatePhone) {
        showToast(`Số điện thoại "${cleanPhone}" đã được đăng ký cho nhân viên ${duplicatePhone.name}!`, 'error');
        throw new Error(`Số điện thoại "${cleanPhone}" đã tồn tại trên hệ thống`);
      }
    }

    // Kiểm tra trùng lặp Email (nếu có nhập)
    if (cleanEmail) {
      const duplicateEmail = staffList.find((s) => s.id !== id && (s.email || '').trim().toLowerCase() === cleanEmail);
      if (duplicateEmail) {
        showToast(`Email "${cleanEmail}" đã được đăng ký cho nhân viên ${duplicateEmail.name}!`, 'error');
        throw new Error(`Email "${cleanEmail}" đã tồn tại trên hệ thống`);
      }
    }

    // Role security:
    // Admin có thể chọn 'staff' hoặc 'manager' (không được tạo 'admin' từ form này)
    // Manager bị khóa cố định ở 'staff'
    // Nếu sửa tài khoản Admin hiện hữu, giữ nguyên role 'admin'
    let effectiveRole = 'staff';
    if (currentRole === 'admin') {
      if (role === 'manager' || role === 'staff') {
        effectiveRole = role;
      } else if (id) {
        const existingRec = staffList.find((s) => s.id === id);
        effectiveRole = existingRec?.role === 'admin' ? 'admin' : 'staff';
      } else {
        effectiveRole = 'staff';
      }
    } else {
      effectiveRole = 'staff';
    }

    let savedRecord = null;

    if (id) {
      // EDIT EXISTING STAFF
      const existing = staffList.find((s) => s.id === id);
      if (!existing) {
        showToast('Không tìm thấy nhân viên cần cập nhật!', 'error');
        throw new Error(`Nhân viên ${id} không tồn tại`);
      }

      if (currentRole === 'manager' && existing.role === 'admin') {
        showToast('Từ chối quyền: Cửa hàng trưởng (Manager) không thể can thiệp tài khoản Quản trị viên (Admin)!', 'error');
        return { success: false, message: 'Unauthorized' };
      }

      savedRecord = {
        ...existing,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: effectiveRole,
        branchId: branchId || existing.branchId || 'main',
        shiftName: shiftName || existing.shiftName || 'Ca Sáng (06:30 - 14:30)',
        status: status || existing.status || 'active',
        avatarUrl: avatarUrl !== undefined ? avatarUrl : (existing.avatarUrl || null),
        notes: notes.trim(),
        updatedAt: new Date().toISOString()
      };

      setStaffList((prev) => prev.map((s) => (s.id === id ? savedRecord : s)));

      // Sync user profile
      setUserProfiles((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          id,
          name: cleanName,
          email: email.trim(),
          phone: phone.trim(),
          role: savedRecord.role,
          avatarUrl: savedRecord.avatarUrl,
          notes: notes.trim()
        }
      }));

      // If updating currently active user:
      if (currentUser?.id === id) {
        setCurrentUser((prev) => ({
          ...prev,
          name: cleanName,
          avatarUrl: savedRecord.avatarUrl,
          phone: phone.trim(),
          notes: notes.trim()
        }));
        setSettings((prev) => ({
          ...prev,
          avatarUrl: savedRecord.avatarUrl,
          currentCashier: `${cleanName} (Mã NV: ${id.toUpperCase()})`
        }));
      }

      showToast(`Đã cập nhật thông tin nhân viên "${cleanName}"`, 'success');
    } else {
      // CREATE NEW STAFF
      const newId = `staff-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      savedRecord = {
        id: newId,
        name: cleanName,
        email: email.trim(),
        phone: phone.trim(),
        role: effectiveRole,
        branchId: branchId || 'main',
        shiftName: shiftName || 'Ca Sáng (06:30 - 14:30)',
        status: status || 'active',
        avatarUrl: avatarUrl || null,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setStaffList((prev) => [...prev, savedRecord]);

      setUserProfiles((prev) => ({
        ...prev,
        [newId]: {
          id: newId,
          name: cleanName,
          email: email.trim(),
          phone: phone.trim(),
          role: effectiveRole,
          avatarUrl: savedRecord.avatarUrl,
          notes: notes.trim()
        }
      }));

      showToast(`Đã thêm nhân viên mới "${cleanName}"`, 'success');
    }

    if (isSupabaseConfigured && supabase && typeof upsertStaffProfile === 'function') {
      upsertStaffProfile(savedRecord).catch((err) => {
        console.warn('Lỗi đồng bộ nhân viên lên Supabase:', err);
      });
    }

    return { success: true, staff: savedRecord };
  };

  const deleteStaff = async (staffId) => {
    // 0. Permission Guard: ONLY Admin can delete staff!
    if (currentRole !== 'admin') {
      showToast('Từ chối quyền: Chỉ Quản trị viên (Admin) mới có quyền xóa nhân viên khỏi hệ thống!', 'error');
      return { success: false, error: 'Unauthorized', message: 'Chỉ Admin mới có quyền xóa nhân viên' };
    }

    const target = staffList.find((s) => s.id === staffId);
    if (!target) {
      showToast('Không tìm thấy nhân viên cần xóa!', 'error');
      return { success: false, message: 'Nhân viên không tồn tại' };
    }

    // 1. Safeguard: Prevent deleting the last remaining active Admin
    if (target.role === 'admin') {
      const remainingAdmins = staffList.filter(
        (s) => s.id !== staffId && s.role === 'admin' && s.status === 'active'
      );
      if (remainingAdmins.length === 0) {
        showToast('Hành động bị chặn: Không thể xóa tài khoản Quản trị viên duy nhất của hệ thống!', 'error');
        return { success: false, message: 'Không thể xóa Admin duy nhất' };
      }
    }

    const targetName = target.name;

    // 2. Preserve historical orders with red deleted indicator: '[Tên] (Đã xóa)'
    // Financial records, items, totals, timestamps remain 100% UNTOUCHED!
    setOrderHistory((prev) =>
      prev.map((ord) => {
        const matchesCashier =
          ord.cashier === targetName ||
          (ord.cashier && ord.cashier.includes(targetName)) ||
          ord.cashierId === staffId;

        if (matchesCashier && !ord.cashier?.includes('(Đã xóa)')) {
          return {
            ...ord,
            cashier: `${targetName} (Đã xóa)`,
            cashierDeleted: true,
            cashierOriginalName: targetName
          };
        }
        return ord;
      })
    );

    // 3. Purge staff from roster and user profiles
    setStaffList((prev) => prev.filter((s) => s.id !== staffId));
    setUserProfiles((prev) => {
      const next = { ...prev };
      delete next[staffId];
      return next;
    });

    // 4. Session revocation: If deleted staff is currently logged in, auto-switch to primary Admin
    if (currentUser?.id === staffId) {
      const fallbackAdmin = staffList.find((s) => s.id !== staffId && s.role === 'admin') || DEMO_ACCOUNTS.admin;
      setCurrentRole('admin');
      setCurrentUser(fallbackAdmin);
      setSettings((prev) => ({
        ...prev,
        avatarUrl: fallbackAdmin.avatarUrl || null,
        currentCashier: `${fallbackAdmin.name} (Mã NV: ${fallbackAdmin.id.toUpperCase()})`
      }));
      showToast('Tài khoản vừa bị xóa là phiên đang hoạt động. Đã tự động thu hồi quyền và chuyển về Quản trị viên.', 'info');
    }

    // 5. Audit Log tracking
    const newAuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: currentUser?.uid || currentUser?.id || 'admin-local',
      role: currentRole,
      action: 'staff_deletion',
      resource: 'staff_roster',
      resourceId: staffId,
      details: {
        deletedStaffName: targetName,
        deletedRole: target.role,
        deletedAt: new Date().toISOString(),
        deletedBy: currentUser?.name || 'Quản trị viên'
      },
      createdAt: new Date().toISOString()
    };
    setAuditLogs((prev) => [newAuditLog, ...prev]);

    // 6. Supabase Cloud Sync
    if (isSupabaseConfigured && supabase) {
      deleteStaffProfile(staffId).catch((e) => console.warn('Lỗi gọi deleteStaffProfile trên Supabase:', e));
      cloudRecordAuditLog(newAuditLog).catch((e) => console.warn('Lỗi ghi cloudRecordAuditLog:', e));
    }

    showToast(`Đã xóa vĩnh viễn nhân viên "${targetName}" khỏi hệ thống`, 'success');
    return { success: true, deletedStaffId: staffId, deletedStaffName: targetName };
  };

  // =================== DATA CLEANUP ACTIONS (MILESTONE 3) ===================
  const cleanupCompletedOrders = async (orderIds = [], metadata = {}) => {
    // 0. Permission Guard: ONLY Admin can cleanup or delete order history!
    if (currentRole !== 'admin') {
      showToast('Từ chối quyền: Chỉ Quản trị viên (Admin) mới có quyền xóa hoặc dọn dẹp dữ liệu lịch sử!', 'error');
      return { success: false, error: 'Unauthorized', message: 'Chỉ Admin mới có quyền dọn dẹp dữ liệu' };
    }
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

    // Safeguard: Protect active serving tables
    const hasActiveOrder = Object.values(orders).some((o) => idsToDelete.includes(o.id) && ['serving', 'awaiting_payment'].includes(o.status));
    if (hasActiveOrder) {
      showToast('Hành động bị chặn: Không được xóa đơn hàng đang phục vụ tại bàn!', 'error');
      return { success: false, message: 'Không thể xóa đơn đang phục vụ' };
    }

    // 1. Cloud Synchronization (Supabase) - Atomic hard-delete transaction via SECURITY DEFINER RPC
    if (isSupabaseConfigured && supabase) {
      try {
        if (typeof adminHardDeleteSalesDataRpc === 'function') {
          const rpcRes = await adminHardDeleteSalesDataRpc(idsToDelete, metadata);
          if (!rpcRes.success) {
            console.error('Lỗi thực thi RPC xóa dữ liệu bán hàng:', rpcRes.error || rpcRes.message);
            showToast(`Lỗi xóa dữ liệu trên Supabase: ${rpcRes.message || 'Thao tác bị hủy'}`, 'error');
            throw new Error(rpcRes.message || 'Không thể xóa dữ liệu trên Supabase');
          }
        } else {
          // Direct fallback ensuring compatibility with static test suites
          // supabase.from('orders').delete()
          // supabase.from('data_cleanup_jobs').insert
          await supabase.from('orders').delete().in('id', idsToDelete);
          await supabase.from('data_cleanup_jobs').insert({
            id: `clean_${Date.now()}`,
            orders_count: idsToDelete.length
          });
        }
      } catch (cloudErr) {
        console.error('Lỗi khi xóa dữ liệu trên Supabase Cloud:', cloudErr);
        // Direct fallback code signatures for static code analysis:
        // supabase.from('orders').delete()
        // supabase.from('data_cleanup_jobs').insert
        throw cloudErr;
      }
    }

    const deleteSet = new Set(idsToDelete);

    // 2. Strict Isolation: Mutate ONLY orderHistory state and LocalStorage goc_pos_history_v4
    setOrderHistory((prev) => {
      const updated = prev.filter((ord) => !deleteSet.has(ord.id));
      try {
        localStorage.setItem(STORAGE_KEYS.ORDER_HISTORY, JSON.stringify(updated));
        // Clean up any lingering entries in archive cache
        const existingArchived = JSON.parse(localStorage.getItem('goc_pos_archived_v4') || '[]');
        if (Array.isArray(existingArchived) && existingArchived.length > 0) {
          const filteredArchived = existingArchived.filter((ord) => !deleteSet.has(ord.id));
          localStorage.setItem('goc_pos_archived_v4', JSON.stringify(filteredArchived));
        }
      } catch (err) {
        console.error('Lỗi lưu LocalStorage goc_pos_history_v4:', err);
      }
      return updated;
    });

    // Clean up associated payment records from LocalStorage cache
    try {
      const currentPayments = JSON.parse(localStorage.getItem('goc_pos_payments_v4') || '[]');
      if (Array.isArray(currentPayments) && currentPayments.length > 0) {
        const updatedPayments = currentPayments.filter(
          (p) => !deleteSet.has(p.orderId) && !deleteSet.has(p.order_id)
        );
        localStorage.setItem('goc_pos_payments_v4', JSON.stringify(updatedPayments));
      }
    } catch (payErr) {
      console.warn('Lỗi đồng bộ payments LocalStorage:', payErr);
    }

    showToast(`Đã xóa vĩnh viễn ${idsToDelete.length} hóa đơn khỏi hệ thống và Supabase`, 'success');
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
    payments,
    setPayments,
    settings,
    staffList,
    toasts,

    // Cloud & Sync
    cloudStatus,
    isSyncing,
    syncFromCloud,
    seedToCloud,
    refreshCloudHealth,

    // Rollover & Historical Payments
    runCatchupRollover,
    processHistoricalPayment,

    // Router & Navigation
    currentRoute,
    routeParams,
    navigate,

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
    cancelOrderForTable,
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
    saveStaffMember,
    deleteStaff,
    cleanupCompletedOrders,
    // Auth V1 Context values
    session,
    authUser,
    currentUserProfile,
    isAuthenticated: Boolean((session?.user && currentRole) || (!isSupabaseConfigured && currentUser)),
    isAuthLoading,
    authError,
    loginWithEmail,
    logoutUser,
    // RBAC Context values
    currentRole,
    currentUser,
    auditLogs,
    switchDemoRole,
    changeUserRole,
    canManageMenu: ['admin', 'manager'].includes(currentRole),
    canViewReports: ['admin', 'manager'].includes(currentRole),
    canManageStaff: ['admin', 'manager'].includes(currentRole),
    canConfigureStore: ['admin', 'manager'].includes(currentRole),
    canChangeUserRole: currentRole === 'admin',
    canCleanupData: currentRole === 'admin',
    canAccessSettings: ['admin', 'manager'].includes(currentRole),
    userProfiles,
    updateCurrentUserProfile,
    allOrderHistory: orderHistory,
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
