import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { usePos } from '../../store/PosContext';
import { useIosKeyboardFix } from '../../hooks/useIosKeyboardFix';
import BottomNav from '../common/BottomNav';
import Toast from '../common/Toast';
import PageHeader from '../common/PageHeader';
import AccessDeniedView from '../common/AccessDeniedView';
import AccountSuspendedBannerModal from '../auth/AccountSuspendedBannerModal';

// Code-split heavy views and modals for optimal bundle size and Lighthouse scores
const TableGrid = lazy(() => import('../tables/TableGrid'));
const TableActionModal = lazy(() => import('../tables/TableActionModal'));
const AddEditTableModal = lazy(() => import('../tables/AddEditTableModal'));
const OrderView = lazy(() => import('../ordering/OrderView'));
const OrderDetailsModal = lazy(() => import('../orders/OrderDetailsModal'));
const BillCheckoutModal = lazy(() => import('../billing/BillCheckoutModal'));
const MenuManagementView = lazy(() => import('../menu/MenuManagementView'));
const OrderHistoryView = lazy(() => import('../orders/OrderHistoryView'));
const ReportsView = lazy(() => import('../reports/ReportsView'));
const SettingsView = lazy(() => import('../settings/SettingsView'));
const BaristaKdsView = lazy(() => import('../kds/BaristaKdsView'));

const ViewLoadingFallback = () => (
  <div className="flex-1 min-h-[240px] flex items-center justify-center p-6 text-[#214E34]">
    <div className="flex flex-col items-center gap-2">
      <div className="w-7 h-7 rounded-full border-2 border-[#214E34] border-t-transparent animate-spin"></div>
      <span className="text-[11px] font-bold text-gray-500">Đang tải giao diện...</span>
    </div>
  </div>
);

export default function PosContent() {
  const {
    activeTab,
    setActiveTab,
    tables,
    orders,
    deviceMode,
    toggleDeviceMode,
    canManageMenu,
    canViewReports,
    canAccessSettings,
    currentRole,
    showToast,
    isAccountSuspended,
    logoutUser
  } = usePos();

  // RBAC Guard for Barista: If Barista opens restricted tabs, redirect to 'barista'
  useEffect(() => {
    if (currentRole === 'barista' && ['menu', 'orders', 'reports', 'settings'].includes(activeTab)) {
      setActiveTab('barista');
    }
  }, [currentRole, activeTab, setActiveTab]);

  const [previousTab, setPreviousTab] = useState('tables');
  const { isKeyboardOpen } = useIosKeyboardFix();

  // Active table being viewed in ordering or action modal
  const [activeOrderingTable, setActiveOrderingTable] = useState(null);
  const [actionTable, setActionTable] = useState(null);
  const [editingTable, setEditingTable] = useState(null);
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [billingTable, setBillingTable] = useState(null);
  const [viewingOrderTable, setViewingOrderTable] = useState(null);

  // Active order corresponding to table being viewed directly from floorplan
  const viewingActiveOrder = useMemo(() => {
    if (!viewingOrderTable) return null;
    const tableId = viewingOrderTable.id;
    const orderId = viewingOrderTable.activeOrderId;
    if (orderId && orders[orderId] && orders[orderId].status !== 'completed' && orders[orderId].status !== 'cancelled') {
      return orders[orderId];
    }
    return Object.values(orders).find(
      (o) => o.tableId === tableId && o.status === 'serving' && Array.isArray(o.items) && o.items.length > 0
    ) || null;
  }, [viewingOrderTable, orders]);

  // Realtime Guard: If order being viewed in OrderDetailsModal gets paid or closed from another device
  useEffect(() => {
    if (viewingOrderTable) {
      const currentTable = tables.find((t) => t.id === viewingOrderTable.id);
      const isStillOccupied = currentTable && (
        (currentTable.activeOrderId && orders[currentTable.activeOrderId]?.status === 'serving') ||
        Object.values(orders).some((o) => o.tableId === viewingOrderTable.id && o.status === 'serving')
      );
      if (!isStillOccupied && viewingActiveOrder) {
        showToast?.(`Bàn ${viewingOrderTable.name} đã được thanh toán hoặc đóng từ thiết bị khác!`, 'info');
        setViewingOrderTable(null);
      }
    }
  }, [tables, orders, viewingOrderTable, viewingActiveOrder, showToast]);

  const handlePaymentSuccess = () => {
    setBillingTable(null);
    setActiveOrderingTable(null);
    setActiveTab('tables');
  };

  const resolveTableForBill = (tbl) => {
    if (!tbl) return null;
    const fromList = tables.find((t) => t.id === tbl.id);
    return {
      ...(fromList || {}),
      ...tbl,
      activeOrderId: tbl.activeOrderId || fromList?.activeOrderId || null,
      status: tbl.status || fromList?.status || 'empty'
    };
  };

  const handleOpenSettings = () => {
    if (!canAccessSettings) {
      showToast?.('Từ chối quyền: Nhân viên không được phép truy cập Cài đặt hệ thống!', 'error');
      return;
    }
    setPreviousTab(activeTab);
    setActiveTab('settings');
  };

  const isSettingsTab = activeTab === 'settings';

  return (
    <div className={`fixed inset-0 w-full h-full ambient-clay-bg flex flex-col items-center justify-center overflow-hidden transition-all ${deviceMode === 'mobile' ? 'p-0 sm:py-3 sm:px-4' : 'p-0'}`}>
      {/* Mobile Device Frame Container */}
      <div
        style={!isSettingsTab ? { background: 'linear-gradient(159deg, rgba(255, 255, 255, 0.8) 0%, rgba(249, 221, 219, 0.8) 100%)' } : undefined}
        className={`w-full ${isSettingsTab ? 'bg-[#F4F7FB]' : ''} flex flex-col relative transition-all duration-300 shadow-2xl overflow-hidden h-full max-h-full ${
          deviceMode === 'mobile'
            ? 'max-w-[400px] sm:h-[844px] sm:max-h-[92vh] sm:rounded-[40px] sm:border-[8px] sm:border-[#1E2E22]'
            : 'max-w-6xl rounded-none'
        }`}
      >
        {/* Mobile Mockup Speaker Notch (on Desktop Mobile mode) */}
        {deviceMode === 'mobile' && (
          <div className="hidden sm:flex absolute top-0 left-1/2 -translate-x-1/2 h-5 w-32 bg-[#1E2E22] rounded-b-xl z-50 items-center justify-center pointer-events-none">
            <div className="w-10 h-1 bg-[#2C3E32] rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-[#2C3E32] rounded-full ml-2"></div>
          </div>
        )}

        {/* Global Toast Notifications */}
        <Toast />

        {/* M5: Account Suspended Realtime Modal Guard */}
        <AccountSuspendedBannerModal
          isOpen={isAccountSuspended}
          onLogout={logoutUser}
        />

        {/* Main Application Content Area */}
        <main
          id="main-content"
          tabIndex="-1"
          style={!isSettingsTab ? { background: 'transparent' } : undefined}
          className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col focus:outline-none"
        >
          {/* Sticky Mobile POS Header (Hiển thị cho các tab chính, ẩn khi mở Cài đặt & Quản lý hoặc Đang gọi món) */}
          {!activeOrderingTable && ['tables', 'menu', 'orders', 'reports', 'barista', 'barista_history'].includes(activeTab) && (
            <PageHeader
              onToggleDeviceMode={toggleDeviceMode}
              deviceMode={deviceMode}
              onOpenSettings={handleOpenSettings}
            />
          )}

          <Suspense fallback={<ViewLoadingFallback />}>
            {/* TAB 1: SƠ ĐỒ BÀN (FLOORPLAN & ACTIVE ORDERS) */}
            {activeTab === 'tables' && (
              <>
                {activeOrderingTable ? (
                  <div className="h-full flex flex-col min-h-0">
                    <OrderView
                      table={tables.find((t) => t.id === activeOrderingTable.id) || activeOrderingTable}
                      onBack={() => setActiveOrderingTable(null)}
                      onGoToBill={(table) => {
                        const freshTable = tables.find((t) => t.id === table.id) || table;
                        setActiveOrderingTable(null);
                        setBillingTable(resolveTableForBill(freshTable));
                      }}
                      onViewOrderDetails={(table, order) => {
                        const freshTable = tables.find((t) => t.id === table.id) || table;
                        setViewingOrderTable(freshTable);
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-full flex flex-col min-h-0">
                    <TableGrid
                      onOpenActions={(table) => {
                        const freshTable = tables.find((t) => t.id === table.id) || table;
                        setActionTable(freshTable);
                      }}
                      onAddNewTable={() => {
                        setEditingTable(null);
                        setIsAddTableOpen(true);
                      }}
                      onViewOrderDetails={(table, order) => {
                        const freshTable = tables.find((t) => t.id === table.id) || table;
                        setViewingOrderTable(freshTable);
                      }}
                      onOpenOrder={(table) => {
                        const freshTable = tables.find((t) => t.id === table.id) || table;
                        setActiveOrderingTable(freshTable);
                      }}
                      onOpenBill={(table) => {
                        setBillingTable(resolveTableForBill(table));
                      }}
                    />
                  </div>
                )}
              </>
            )}

            {/* TAB 2: THỰC ĐƠN (MENU MANAGEMENT) - RBAC GUARD */}
            {activeTab === 'menu' && (
              <div className="animate-fadeIn h-full flex flex-col min-h-0">
                {canManageMenu ? (
                  <MenuManagementView />
                ) : (
                  <AccessDeniedView
                    requiredRole="Cửa hàng trưởng hoặc Quản lý (Manager/Admin)"
                    onBack={() => setActiveTab('tables')}
                  />
                )}
              </div>
            )}

            {/* TAB 3: ĐƠN HÀNG (ORDER HISTORY) */}
            {activeTab === 'orders' && (
              <div className="animate-fadeIn">
                <OrderHistoryView
                  onGoToOrder={(tbl) => {
                    const freshTable = tables.find((t) => t.id === tbl.id) || tbl;
                    setActiveOrderingTable(freshTable);
                    setActiveTab('tables');
                  }}
                  onGoToBill={(tbl) => {
                    const freshTable = tables.find((t) => t.id === tbl.id) || tbl;
                    setBillingTable(freshTable);
                  }}
                />
              </div>
            )}

            {/* TAB 4: BÁO CÁO (REPORTS) - RBAC GUARD */}
            {activeTab === 'reports' && (
              <div className="animate-fadeIn">
                {canViewReports ? (
                  <ReportsView />
                ) : (
                  <AccessDeniedView
                    requiredRole="Cửa hàng trưởng hoặc Quản lý (Manager/Admin)"
                    onBack={() => setActiveTab('tables')}
                  />
                )}
              </div>
            )}

            {/* TAB 5: CÀI ĐẶT & QUẢN LÝ (SETTINGS) - RBAC GUARD */}
            {activeTab === 'settings' && (
              <div className="animate-fadeIn">
                {canAccessSettings ? (
                  <SettingsView onBack={() => setActiveTab(previousTab || 'tables')} />
                ) : (
                  <AccessDeniedView
                    requiredRole="Cửa hàng trưởng hoặc Quản lý (Manager/Admin)"
                    onBack={() => setActiveTab('tables')}
                  />
                )}
              </div>
            )}

            {/* TAB 6: QUẦY PHA CHẾ (BARISTA KDS QUEUE) */}
            {activeTab === 'barista' && (
              <div className="animate-fadeIn h-full flex flex-col min-h-0">
                <BaristaKdsView viewMode="queue" />
              </div>
            )}

            {/* TAB 7: LỊCH SỬ PHA CHẾ (BARISTA KDS HISTORY) */}
            {activeTab === 'barista_history' && (
              <div className="animate-fadeIn h-full flex flex-col min-h-0">
                <BaristaKdsView viewMode="history" />
              </div>
            )}
          </Suspense>
        </main>

        {/* Bottom Navigation (Chỉ hiện trên các tab chính, ẩn khi đang gọi món hoặc vào Cài đặt) */}
        {!activeOrderingTable && ['tables', 'menu', 'orders', 'reports', 'barista', 'barista_history'].includes(activeTab) && (
          <BottomNav isKeyboardOpen={isKeyboardOpen} />
        )}

        {/* Modals with Suspense */}
        <Suspense fallback={null}>
          <TableActionModal
            isOpen={Boolean(actionTable)}
            table={actionTable ? (tables.find((t) => t.id === actionTable.id) || actionTable) : null}
            onClose={() => setActionTable(null)}
            onGoToOrder={(table) => {
              const freshTable = tables.find((t) => t.id === table.id) || table;
              setActiveOrderingTable(freshTable);
              setActiveTab('tables');
            }}
            onGoToBill={(table) => {
              const freshTable = tables.find((t) => t.id === table.id) || table;
              setBillingTable(resolveTableForBill(freshTable));
            }}
            onEditTable={(table) => {
              const freshTable = tables.find((t) => t.id === table.id) || table;
              setEditingTable(freshTable);
              setIsAddTableOpen(true);
            }}
          />

          <AddEditTableModal
            isOpen={isAddTableOpen}
            onClose={() => {
              setIsAddTableOpen(false);
              setEditingTable(null);
            }}
            table={editingTable}
          />

          <OrderDetailsModal
            isOpen={Boolean(viewingOrderTable)}
            table={viewingOrderTable}
            order={viewingActiveOrder}
            onClose={() => setViewingOrderTable(null)}
            onGoToOrder={(table) => {
              const freshTable = tables.find((t) => t.id === table.id) || table;
              setViewingOrderTable(null);
              setActiveOrderingTable(freshTable);
              setActiveTab('tables');
            }}
            onGoToBill={(table) => {
              const freshTable = tables.find((t) => t.id === table.id) || table;
              setViewingOrderTable(null);
              setBillingTable(resolveTableForBill(freshTable));
            }}
          />

          <BillCheckoutModal
            isOpen={Boolean(billingTable)}
            table={billingTable}
            onClose={() => setBillingTable(null)}
            onPaymentSuccess={handlePaymentSuccess}
          />
        </Suspense>
      </div>
    </div>
  );
}
