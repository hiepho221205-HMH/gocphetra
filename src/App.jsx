import React, { useState } from 'react';
import { PosProvider, usePos } from './store/PosContext';
import Header from './components/common/Header';
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

function PosContent() {
  const {
    activeTab,
    setActiveTab,
    tables,
    deviceMode,
    toggleDeviceMode
  } = usePos();

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
        className={`w-full bg-[#F4F6F4] flex flex-col relative transition-all duration-300 shadow-2xl overflow-hidden ${
          deviceMode === 'mobile'
            ? 'max-w-[400px] min-h-screen sm:min-h-[844px] sm:max-h-[92vh] sm:rounded-[40px] sm:border-[8px] sm:border-[#1E2E22]'
            : 'max-w-6xl min-h-screen rounded-none'
        }`}
      >
        {/* Mobile Mockup Speaker Notch (on Desktop Mobile mode) */}
        {deviceMode === 'mobile' && (
          <div className="hidden sm:flex items-center justify-center pt-2 pb-1 bg-white">
            <div className="w-20 h-4 bg-[#1E2E22] rounded-full flex items-center justify-end px-2">
              <span className="w-2 h-2 rounded-full bg-forest-900 border border-white/20"></span>
            </div>
          </div>
        )}

        {/* Global Toast Notifications */}
        <Toast />

        {/* Main Header */}
        <Header />

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
