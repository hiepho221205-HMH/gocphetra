import React, { useState } from 'react';
import { PosProvider, usePos } from './store/PosContext';
import { useVersionChecker } from './hooks/useVersionChecker';
import BottomNav from './components/common/BottomNav';
import Toast from './components/common/Toast';
import TableGrid from './components/tables/TableGrid';
import TableActionModal from './components/tables/TableActionModal';
import AddEditTableModal from './components/tables/AddEditTableModal';
import OrderView from './components/ordering/OrderView';
import BillCheckoutModal from './components/billing/BillCheckoutModal';
import MenuManagementView from './components/menu/MenuManagementView';
import OrderHistoryView from './components/orders/OrderHistoryView';
import ReportsView from './components/reports/ReportsView';
import SettingsView from './components/settings/SettingsView';
import { Sparkles, ArrowRight } from 'lucide-react';

function PosContent() {
  const {
    activeTab,
    setActiveTab,
    tables,
    deviceMode,
    toggleDeviceMode
  } = usePos();

  const { hasUpdate, newVersion, applyUpdate } = useVersionChecker();
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);

  // Active table being viewed in ordering or action modal
  const [activeOrderingTable, setActiveOrderingTable] = useState(null);
  const [actionTable, setActionTable] = useState(null);
  const [editingTable, setEditingTable] = useState(null);
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [billingTable, setBillingTable] = useState(null);

  const handlePaymentSuccess = () => {
    setBillingTable(null);
    setActiveOrderingTable(null);
    setActiveTab('tables');
  };

  return (
    <div className={`min-h-screen bg-[#EAEFEA] flex items-center justify-center transition-all ${deviceMode === 'mobile' ? 'p-0 sm:py-6 sm:px-4' : 'p-0'}`}>
      {/* Mobile Device Frame Container */}
      <div
        className={`w-full bg-[#F4F6F4] flex flex-col relative transition-all duration-300 shadow-2xl overflow-hidden pt-safe ${
          deviceMode === 'mobile'
            ? 'max-w-[400px] min-h-screen sm:min-h-[844px] sm:max-h-[92vh] sm:rounded-[40px] sm:border-[8px] sm:border-[#1E2E22]'
            : 'max-w-6xl min-h-screen rounded-none'
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
              className="px-2 py-0.5 bg-white text-forest-900 rounded-md font-extrabold text-[10.5px] hover:bg-emerald-50 transition-colors flex items-center gap-1"
            >
              <span>Cập nhật</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto relative no-scrollbar">
          {/* TAB 1: BÀN (TABLES) */}
          {activeTab === 'tables' && (
            <>
              {activeOrderingTable ? (
                <OrderView
                  table={activeOrderingTable}
                  onBack={() => setActiveOrderingTable(null)}
                  onGoToBill={(tbl) => {
                    setBillingTable(tbl);
                  }}
                />
              ) : (
                <div className="animate-fadeIn">
                  <TableGrid
                    onSelectTable={(table) => {
                      if (table.status === 'empty') {
                        setActiveOrderingTable(table);
                      } else if (table.status === 'awaiting_payment') {
                        setBillingTable(table);
                      } else {
                        setActiveOrderingTable(table);
                      }
                    }}
                    onOpenActions={(table) => setActionTable(table)}
                    onAddNewTable={() => {
                      setEditingTable(null);
                      setIsAddTableOpen(true);
                    }}
                    onOpenOrder={(table) => {
                      setActiveOrderingTable(table);
                    }}
                    onOpenBill={(table) => {
                      setBillingTable(table);
                    }}
                  />
                </div>
              )}
            </>
          )}

          {/* TAB 2: THỰC ĐƠN (MENU MANAGEMENT) */}
          {activeTab === 'menu' && (
            <div className="animate-fadeIn">
              <MenuManagementView />
            </div>
          )}

          {/* TAB 3: ĐƠN HÀNG (ORDER HISTORY) */}
          {activeTab === 'orders' && (
            <div className="animate-fadeIn">
              <OrderHistoryView
                onGoToOrder={(tbl) => {
                  setActiveOrderingTable(tbl);
                  setActiveTab('tables');
                }}
                onGoToBill={(tbl) => {
                  setBillingTable(tbl);
                }}
              />
            </div>
          )}

          {/* TAB 4: BÁO CÁO (REPORTS) */}
          {activeTab === 'reports' && (
            <div className="animate-fadeIn">
              <ReportsView />
            </div>
          )}

          {/* TAB 5: CÀI ĐẶT (SETTINGS) */}
          {activeTab === 'settings' && (
            <div className="animate-fadeIn">
              <SettingsView />
            </div>
          )}
        </main>

        {/* Bottom Navigation */}
        <BottomNav />

        {/* Modals */}
        <TableActionModal
          isOpen={Boolean(actionTable)}
          table={actionTable}
          onClose={() => setActionTable(null)}
          onGoToOrder={(table) => {
            setActiveOrderingTable(table);
            setActiveTab('tables');
          }}
          onGoToBill={(table) => {
            setBillingTable(table);
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
          table={billingTable}
          onClose={() => setBillingTable(null)}
          onPaymentSuccess={handlePaymentSuccess}
          onGoBackToOrder={(tbl) => {
            setBillingTable(null);
            setActiveOrderingTable(tbl);
          }}
        />

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

export default function App() {
  return (
    <PosProvider>
      <PosContent />
    </PosProvider>
  );
}
