import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import {
  X,
  AlertTriangle,
  Trash2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Coffee
} from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { triggerHaptic } from '../../utils/haptics';

export default function EmergencyOrderManagerModal({ isOpen, onClose }) {
  const {
    tables,
    orders,
    orderHistory,
    adminForceDeleteOrder,
    adminForceResetTable,
    adminPurgeStaleOrders
  } = usePos();

  const [isProcessing, setIsProcessing] = useState(false);
  const [filterType, setFilterType] = useState('active'); // 'active' | 'all' | 'tables'

  if (!isOpen) return null;

  const activeOrdersList = Object.values(orders || {}).filter(Boolean);
  const allOrdersList = [
    ...activeOrdersList,
    ...(orderHistory || []).filter((h) => !activeOrdersList.some((o) => o.id === h.id))
  ];

  const occupiedTables = tables.filter((t) => t.status === 'occupied' || t.activeOrderId);

  const handlePurge = async () => {
    triggerHaptic('medium');
    if (window.confirm('Hệ thống sẽ quét toàn bộ và xóa bỏ các đơn ma, đơn 0 món, và đồng bộ lại tất cả bàn. Bạn có chắc chắn muốn thực hiện?')) {
      setIsProcessing(true);
      try {
        await adminPurgeStaleOrders();
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleDeleteOrder = async (orderId, tableName) => {
    triggerHaptic('warning');
    if (window.confirm(`XÁC NHẬN: Xóa vĩnh viễn đơn #${orderId} (${tableName || 'Đơn hàng'}) khỏi hệ thống và Cloud?`)) {
      setIsProcessing(true);
      try {
        await adminForceDeleteOrder(orderId);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleResetTable = async (tableId, tableName) => {
    triggerHaptic('warning');
    if (window.confirm(`XÁC NHẬN: Ép bàn ${tableName} về trạng thái TRỐNG và giải phóng đơn hàng liên quan?`)) {
      setIsProcessing(true);
      try {
        await adminForceResetTable(tableId);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-red-100">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-white stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight">Quản lý Đơn Khẩn cấp & Cứu bàn</h2>
              <p className="text-[11px] text-white/80 font-medium">Toàn quyền thêm, xóa đơn lỗi và giải phóng bàn treo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="p-4 bg-red-50/60 border-b border-red-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-gray-200 text-xs font-bold shadow-xs">
            <button
              type="button"
              onClick={() => setFilterType('active')}
              className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                filterType === 'active'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Đang phục vụ ({activeOrdersList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('tables')}
              className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                filterType === 'tables'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Bàn có khách ({occupiedTables.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                filterType === 'all'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tất cả đơn ({allOrdersList.length})
            </button>
          </div>

          <button
            type="button"
            onClick={handlePurge}
            disabled={isProcessing}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tự động Quét & Dọn Đơn Ma</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {filterType === 'tables' ? (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Danh sách Bàn có khách / Treo khóa ({occupiedTables.length})
              </h3>
              {occupiedTables.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  Tất cả các bàn hiện đang ở trạng thái Trống.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {occupiedTables.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 bg-white rounded-2xl border border-gray-200 flex items-center justify-between shadow-xs hover:border-red-200 transition-all"
                    >
                      <div>
                        <div className="text-sm font-black text-gray-900">{t.name}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Đơn: <span className="font-mono font-bold text-red-600">#{t.activeOrderId || 'Không có'}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleResetTable(t.id, t.name)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Mở bàn</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {filterType === 'active' ? 'Đơn hàng đang phục vụ' : 'Toàn bộ đơn hàng trong hệ thống'}
              </h3>
              {(filterType === 'active' ? activeOrdersList : allOrdersList).length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  Không tìm thấy đơn hàng nào.
                </div>
              ) : (
                (filterType === 'active' ? activeOrdersList : allOrdersList).map((ord) => {
                  const itemCount = ord.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;
                  return (
                    <div
                      key={ord.id}
                      className="p-3.5 bg-white rounded-2xl border border-gray-200 flex items-center justify-between shadow-xs hover:border-red-200 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-gray-900">#{ord.id}</span>
                          <span className="font-bold text-xs text-[#214E34] bg-emerald-50 px-2 py-0.5 rounded-md">
                            {ord.tableName || 'Mang về'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ord.status === 'serving'
                                ? 'bg-amber-100 text-amber-800'
                                : ord.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {ord.status === 'serving' ? 'Đang phục vụ' : ord.status === 'completed' ? 'Hoàn thành' : ord.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {itemCount} món • <span className="font-bold text-gray-800">{formatVND(ord.total || 0)}</span> • Thu ngân: {ord.cashier || 'Chưa rõ'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteOrder(ord.id, ord.tableName)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa đơn</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            Thao tác xóa sẽ được đồng bộ ngay lập tức lên Supabase Cloud và toàn bộ thiết bị.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-black cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
