import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import {
  X,
  Coffee,
  Receipt,
  ArrowRightLeft,
  GitMerge,
  Trash2,
  Edit,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatVND } from '../../utils/currency';

export default function TableActionModal({
  table,
  isOpen,
  onClose,
  onGoToOrder,
  onGoToBill,
  onEditTable
}) {
  const { tables, orders, transferTable, mergeTables, deleteTable, requestBillForTable } = usePos();

  // Mode: 'menu' | 'transfer' | 'merge'
  const [modalMode, setModalMode] = useState('menu');
  const [targetTableId, setTargetTableId] = useState('');

  if (!isOpen || !table) return null;

  const activeOrder = table.activeOrderId ? orders[table.activeOrderId] : null;

  // Danh sách bàn trống cho chuyển bàn
  const emptyTables = tables.filter((t) => t.id !== table.id && t.status === 'empty');

  // Danh sách bàn có đơn để gộp bàn
  const otherOccupiedTables = tables.filter(
    (t) => t.id !== table.id && (t.status === 'occupied' || t.status === 'awaiting_payment')
  );

  const handleTransfer = () => {
    if (!targetTableId) return;
    const success = transferTable(table.id, targetTableId);
    if (success) {
      setModalMode('menu');
      onClose();
    }
  };

  const handleMerge = () => {
    if (!targetTableId) return;
    const success = mergeTables(table.id, targetTableId);
    if (success) {
      setModalMode('menu');
      onClose();
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${table.name}?`)) {
      const ok = deleteTable(table.id);
      if (ok) onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-fadeIn">
      <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-float overflow-hidden border border-gray-100 animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-forest-50/50">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-base text-forest-900">{table.name}</h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-forest-100 text-forest-800">
                {table.area}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">Sức chứa: {table.capacity} khách</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content based on modalMode */}
        <div className="p-4">
          {modalMode === 'menu' && (
            <div className="space-y-2.5">
              {/* Order quick overview if active */}
              {activeOrder && (
                <div className="p-3 rounded-xl bg-forest-50/70 border border-forest-200/50 flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[11px] text-gray-500">Đơn hiện tại: {activeOrder.id}</div>
                    <div className="font-bold text-sm text-forest-900">
                      {activeOrder.items.reduce((s, i) => s + i.quantity, 0)} món •{' '}
                      {formatVND(activeOrder.total)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onGoToBill(table);
                    }}
                    className="touch-target px-3 h-8 bg-forest-800 text-white rounded-lg text-xs font-semibold hover:bg-forest-900 transition-colors"
                  >
                    Lên bill
                  </button>
                </div>
              )}

              {/* Action 1: Gọi món / Thêm món */}
              <button
                onClick={() => {
                  onClose();
                  onGoToOrder(table);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-forest-800 text-white font-semibold text-xs sm:text-sm hover:bg-forest-900 transition-colors shadow-sm"
              >
                <div className="flex items-center space-x-2.5">
                  <Coffee className="w-4 h-4 text-emerald-300" />
                  <span>{activeOrder ? 'Gọi thêm món' : 'Bắt đầu gọi món'}</span>
                </div>
                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded">Mở Menu</span>
              </button>

              {/* Action 2: Xem bill / Thanh toán (nếu có khách) */}
              {activeOrder && (
                <button
                  onClick={() => {
                    onClose();
                    onGoToBill(table);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 font-semibold text-xs sm:text-sm text-gray-800 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-2.5">
                    <Receipt className="w-4 h-4 text-forest-700" />
                    <span>Xem hóa đơn & Thanh toán</span>
                  </div>
                  <span className="text-xs text-forest-800 font-bold">
                    {formatVND(activeOrder.total)}
                  </span>
                </button>
              )}

              {/* Action 3: Chuyển bàn (chỉ khi có đơn) */}
              {activeOrder && (
                <button
                  onClick={() => setModalMode('transfer')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                    <span>Chuyển sang bàn khác</span>
                  </div>
                  <span className="text-[11px] text-gray-400">Tránh trùng đơn</span>
                </button>
              )}

              {/* Action 4: Gộp bàn (chỉ khi có đơn) */}
              {activeOrder && (
                <button
                  onClick={() => setModalMode('merge')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <GitMerge className="w-4 h-4 text-purple-600" />
                    <span>Gộp vào bàn đang phục vụ</span>
                  </div>
                  <span className="text-[11px] text-gray-400">Gộp hóa đơn</span>
                </button>
              )}

              {/* Action 5: Chỉnh sửa thông tin bàn */}
              <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    onClose();
                    onEditTable(table);
                  }}
                  className="flex-1 flex items-center justify-center space-x-1 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Sửa thông tin</span>
                </button>

                {table.status === 'empty' && (
                  <button
                    onClick={handleDelete}
                    className="flex-1 flex items-center justify-center space-x-1 py-2 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa bàn</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Transfer Table Mode */}
          {modalMode === 'transfer' && (
            <div className="space-y-3">
              <div className="text-xs text-gray-600 leading-relaxed">
                Chuyển toàn bộ đơn hàng của <b>{table.name}</b> sang một bàn trống mới:
              </div>

              {emptyTables.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {emptyTables.map((t) => (
                    <label
                      key={t.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer text-xs transition-colors ${
                        targetTableId === t.id
                          ? 'bg-forest-50 border-forest-800 text-forest-900 font-bold'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="targetTable"
                          value={t.id}
                          checked={targetTableId === t.id}
                          onChange={() => setTargetTableId(t.id)}
                          className="accent-forest-800"
                        />
                        <span>{t.name} ({t.area})</span>
                      </div>
                      <span className="text-gray-400">{t.capacity} chỗ</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-amber-700 bg-amber-50 rounded-xl border border-amber-200">
                  Hiện không còn bàn trống nào trong quán!
                </div>
              )}

              <div className="flex items-center space-x-2 pt-2">
                <button
                  onClick={() => setModalMode('menu')}
                  className="flex-1 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Quay lại
                </button>
                <button
                  disabled={!targetTableId}
                  onClick={handleTransfer}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-forest-800 rounded-xl hover:bg-forest-900 disabled:opacity-40"
                >
                  Xác nhận chuyển
                </button>
              </div>
            </div>
          )}

          {/* Merge Table Mode */}
          {modalMode === 'merge' && (
            <div className="space-y-3">
              <div className="text-xs text-gray-600 leading-relaxed">
                Gộp đơn từ <b>{table.name}</b> vào hóa đơn của bàn đang phục vụ khác:
              </div>

              {otherOccupiedTables.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {otherOccupiedTables.map((t) => (
                    <label
                      key={t.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer text-xs transition-colors ${
                        targetTableId === t.id
                          ? 'bg-purple-50 border-purple-800 text-purple-900 font-bold'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="mergeTargetTable"
                          value={t.id}
                          checked={targetTableId === t.id}
                          onChange={() => setTargetTableId(t.id)}
                          className="accent-purple-800"
                        />
                        <span>{t.name} ({t.area})</span>
                      </div>
                      <span className="text-purple-700 font-semibold">
                        {orders[t.activeOrderId] ? formatVND(orders[t.activeOrderId].total) : ''}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 rounded-xl">
                  Không có bàn nào khác đang có khách để gộp.
                </div>
              )}

              <div className="flex items-center space-x-2 pt-2">
                <button
                  onClick={() => setModalMode('menu')}
                  className="flex-1 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Quay lại
                </button>
                <button
                  disabled={!targetTableId}
                  onClick={handleMerge}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-purple-700 rounded-xl hover:bg-purple-800 disabled:opacity-40"
                >
                  Xác nhận gộp
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
