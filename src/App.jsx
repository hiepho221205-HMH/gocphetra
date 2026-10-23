import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { PosProvider, usePos } from './store/PosContext';
import { useVersionChecker } from './hooks/useVersionChecker';
import { useIosKeyboardFix } from './hooks/useIosKeyboardFix';
import BottomNav from './components/common/BottomNav';
import Toast from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import PageHeader from './components/common/PageHeader';
import AccessDeniedView from './components/common/AccessDeniedView';
import { Sparkles, ArrowRight } from 'lucide-react';

// Code-split heavy views and modals for optimal bundle size and Lighthouse scores
const TableGrid = lazy(() => import('./components/tables/TableGrid'));
const TableActionModal = lazy(() => import('./components/tables/TableActionModal'));
const AddEditTableModal = lazy(() => import('./components/tables/AddEditTableModal'));
const OrderView = lazy(() => import('./components/ordering/OrderView'));
const OrderDetailsModal = lazy(() => import('./components/orders/OrderDetailsModal'));
const BillCheckoutModal = lazy(() => import('./components/billing/BillCheckoutModal'));
const MenuManagementView = lazy(() => import('./components/menu/MenuManagementView'));
const OrderHistoryView = lazy(() => import('./components/orders/OrderHistoryView'));
const ReportsView = lazy(() => import('./components/reports/ReportsView'));
const SettingsView = lazy(() => import('./components/settings/SettingsView'));
const LoginPage = lazy(() => import('./components/auth/LoginPage'));

const ViewLoadingFallback = () => (
  <div className="flex-1 min-h-[240px] flex items-center justify-center p-6 text-[#214E34]">
    <div className="flex flex-col items-center gap-2">
      <div className="w-7 h-7 rounded-full border-2 border-[#214E34] border-t-transparent animate-spin"></div>
      <span className="text-[11px] font-bold text-gray-500">Đang tải giao diện...</span>
    </div>
  </div>
);

function PosContent() {
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
    showToast
  } = usePos();

  const [previousTab, setPreviousTab] = useState('tables');
  const { hasUpdate, newVersion, applyUpdate } = useVersionChecker();
  const { isKeyboardOpen } = useIosKeyboardFix();
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);

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

  return (
    <div className={`fixed inset-0 w-full h-full ambient-clay-bg flex flex-col items-center justify-center overflow-hidden transition-all ${deviceMode === 'mobile' ? 'p-0 sm:py-3 sm:px-4' : 'p-0'}`}>
      {/* Mobile Device Frame Container */}
      <div
        className={`w-full bg-[#F4F7FB] flex flex-col relative transition-all duration-300 shadow-2xl overflow-hidden h-full max-h-full ${
          deviceMode === 'mobile'
            ? 'max-w-[400px] sm:h-[844px] sm:max-h-[92vh] sm:rounded-[40px] sm:border-[8px] sm:border-[#1E2E22]'
            : 'max-w-6xl rounded-none'
        }`}
      >
        {/* Mobile Mockup Speaker Notch (on Desktop Mobile mode) */}
        {deviceMode === 'mobile' && (
          <div className="hidden sm:flex items-center justify-center pt-2 pb-1 bg-white shrink-0">
            <div className="w-20 h-4 bg-[#1E2E22] rounded-full flex items-center justify-end px-2">
              <span className="w-2 h-2 rounded-full bg-forest-900 border border-white/20"></span>
            </div>
          </div>
        )}

        {/* Global Toast Notifications */}
        <Toast />

        {/* Non-blocking Safe Update Banner (Only rendered when hasUpdate === true) */}
        {hasUpdate && (
          <div className="bg-gradient-to-r from-emerald-800 to-forest-900 text-white px-3 py-1.5 flex items-center justify-between text-xs shadow-sm z-30 shrink-0 animate-fadeIn">
            <div className="flex items-center gap-1.5 font-bold text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Có bản cập nhật mới v{newVersion}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowUpdateConfirm(true)}
              className="px-2 py-0.5 bg-white text-forest-900 rounded-md font-extrabold text-[10.5px] hover:bg-emerald-50 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Cập nhật</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* SHARED STICKY HEADER (Foodgo layout for 4 main POS tabs: tables, menu, orders, reports) */}
        {!activeOrderingTable && ['tables', 'menu', 'orders', 'reports'].includes(activeTab) && (
          <PageHeader onOpenSettings={handleOpenSettings} />
        )}

        {/* Scrollable Main Area (overflow-hidden on independent-scroll tabs to prevent root scroll drift) */}
        <main
          id="main-content"
          tabIndex="-1"
          className={`flex-1 relative no-scrollbar outline-none ${
            activeOrderingTable || activeTab === 'menu'
              ? 'overflow-hidden flex flex-col min-h-0 h-full'
              : 'overflow-y-auto'
          }`}
        >
          <Suspense fallback={<ViewLoadingFallback />}>
            {/* TAB 1: BÀN (TABLES) */}
            {activeTab === 'tables' && (
              <>
                {activeOrderingTable ? (
                  <OrderView
                    table={tables.find((t) => t.id === activeOrderingTable.id) || activeOrderingTable}
                    onBack={() => setActiveOrderingTable(null)}
                    onGoToBill={(tbl) => {
                      setBillingTable(resolveTableForBill(tbl));
                    }}
                  />
                ) : (
                  <div className="animate-fadeIn">
                    <TableGrid
                      onSelectTable={(table) => {
                        const freshTable = tables.find((t) => t.id === table.id) || table;
                        if (freshTable.status === 'empty') {
                          setActiveOrderingTable(freshTable);
                        } else if (freshTable.status === 'awaiting_payment') {
                          setBillingTable(resolveTableForBill(freshTable));
                        } else {
                          setActiveOrderingTable(freshTable);
                        }
                      }}
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
          </Suspense>
        </main>

        {/* Bottom Navigation (Chỉ hiện trên các tab chính, ẩn khi đang gọi món hoặc vào Cài đặt) */}
        {!activeOrderingTable && ['tables', 'menu', 'orders', 'reports'].includes(activeTab) && (
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
              setBillingTable(freshTable);
            }}
            onEditTable={(table) => {
              setEditingTable(table);
              setIsAddTableOpen(true);
            }}
          />

          <AddEditTableModal
            isOpen={isAddTableOpen}
            onClose={() => setIsAddTableOpen(false)}
            tableToEdit={editingTable}
          />

          <BillCheckoutModal
            isOpen={Boolean(billingTable)}
            table={resolveTableForBill(billingTable)}
            onClose={() => setBillingTable(null)}
            onPaymentSuccess={handlePaymentSuccess}
            onGoBackToOrder={(tbl) => {
              setBillingTable(null);
              const freshTable = tables.find((t) => t.id === tbl.id) || tbl;
              setActiveOrderingTable(freshTable);
            }}
          />

          {/* Fast Order Details Modal directly from Floorplan */}
          {viewingOrderTable && (
            <OrderDetailsModal
              isOpen={Boolean(viewingOrderTable)}
              table={viewingOrderTable}
              order={viewingActiveOrder}
              onClose={() => setViewingOrderTable(null)}
              onAddMoreItems={(table) => {
                setViewingOrderTable(null);
                const freshTable = tables.find((t) => t.id === table.id) || table;
                setActiveOrderingTable(freshTable);
              }}
              onCheckout={(table, order) => {
                setViewingOrderTable(null);
                setBillingTable(resolveTableForBill(table));
              }}
            />
          )}
        </Suspense>

        {/* Safe Update Confirmation Modal */}
        {showUpdateConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3.5 shadow-2xl text-center border border-gray-100">
              <div className="w-12 h-12 rounded-2xl bg-forest-100 text-forest-800 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6 text-forest-700" />
              </div>
              <div>
                <h3 className="font-extrabold text-forest-900 text-sm">Cập nhật ứng dụng lên v{newVersion}</h3>
                <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                  Ứng dụng sẽ tải lại để nạp các tính năng và bản vá mới nhất. Vui lòng đảm bảo các hóa đơn đang mở đã được lưu trước khi cập nhật.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowUpdateConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
                >
                  Để sau
                </button>
                <button
                  type="button"
                  onClick={applyUpdate}
                  className="flex-1 py-2.5 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-xs transition-colors shadow-xs"
                >
                  Tải lại ngay
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PosAppRoot() {
  const { isAuthenticated, isAuthLoading, currentRoute, navigate } = usePos();

  React.useEffect(() => {
    if (!isAuthLoading) {
      if (!isAuthenticated) {
        if (currentRoute !== '/login') {
          navigate('/login');
        }
      } else {
        if (currentRoute === '/login') {
          navigate('/tables');
        }
      }
    }
  }, [isAuthenticated, isAuthLoading, currentRoute, navigate]);

  if (isAuthLoading) {
    return (
      <div className="h-[100dvh] w-full bg-[#EAEFEA] flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[#214E34] text-white flex items-center justify-center shadow-lg animate-pulse">
            <span className="font-black text-xl">GÓC</span>
          </div>
          <p className="text-xs font-bold text-[#214E34] tracking-wide">Đang kiểm tra phiên làm việc...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <Suspense fallback={
          <div className="h-[100dvh] w-full bg-[#EAEFEA] flex flex-col items-center justify-center font-sans">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#214E34] text-white flex items-center justify-center shadow-lg animate-pulse">
                <span className="font-black text-xl">GÓC</span>
              </div>
              <p className="text-xs font-bold text-[#214E34] tracking-wide">Đang nạp ứng dụng...</p>
            </div>
          </div>
        }>
          <LoginPage />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <PosContent />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <PosProvider>
      <PosAppRoot />
    </PosProvider>
  );
}
