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
  AlertCircle,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { triggerHaptic } from '../../utils/haptics';

export default function TableActionModal({
  table,
  isOpen,
  onClose,
  onGoToOrder,
  onGoToBill,
  onEditTable
}) {
  const { tables, orders, transferTable, mergeTables, deleteTable, requestBillForTable, adminForceDeleteOrder, adminForceResetTable, currentRole } = usePos();

  // Mode: 'menu' | 'transfer' | 'merge'
  const [modalMode, setModalMode] = useState('menu');
  const [targetTableId, setTargetTableId] = useState('');

  if (!isOpen || !table) return null;

  const activeOrder =
    (table.activeOrderId && orders[table.activeOrderId]) ||
    Object.values(orders).find(
      (o) => o.tableId === table.id && o.status === 'serving' && Array.isArray(o.items) && o.items.length > 0
    ) ||
    null;

  // Danh sách bàn trống cho chuyển bàn
  const emptyTables = tables.filter((t) => t.id !== table.id && t.status === 'empty');

  // Danh sách bàn có đơn để gộp bàn
  const otherOccupiedTables = tables.filter(
    (t) => t.id !== table.id && (t.status === 'occupied' || t.status === 'awaiting_payment')
  );

  const handleTransfer = () => {
    if (!targetTableId) return;
    triggerHaptic('medium');
    const success = transferTable(table.id, targetTableId);
    if (success) {
      setModalMode('menu');
      onClose();
    }
  };

  const handleMerge = () => {
    if (!targetTableId) return;
    triggerHaptic('medium');
    const success = mergeTables(table.id, targetTableId);
    if (success) {
      setModalMode('menu');
      onClose();
    }
  };

  const handleDelete = () => {
    triggerHaptic('warning');
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${table.name}?`)) {
      const ok = deleteTable(table.id);
      if (ok) onClose();
    }
  };

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md transition-opacity animate-fadeIn">
      <div className="w-full max-w-sm clay-card p-0 rounded-b-none sm:rounded-b-[26px] overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[#F5F7F4]/80">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-black text-base text-[#214E34] tracking-tight">{table.name}</h3>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {table.area || 'Khu vực chính'}
              </span>
            </div>
            <p className="text-[11.5px] text-gray-500 font-semibold mt-0.5">Sức chứa: {table.capacity || 4} khách</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Content based on modalMode */}
        <div className="p-4 sm:p-5">
          {modalMode === 'menu' && (
            <div className="space-y-3">
              {/* Order quick overview if active */}
              {activeOrder && (
                <div className="p-3.5 clay-inset flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[11px] text-gray-500 font-bold">Đơn hiện tại: {activeOrder.id}</div>
                    <div className="font-black text-sm text-[#214E34] mt-0.5">
                      {activeOrder.items?.reduce((s, i) => s + i.quantity, 0) || 0} món •{' '}
                      {formatVND(activeOrder.total || 0)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      onClose();
                      onGoToBill(table);
                    }}
                    className="touch-target px-3.5 h-8.5 clay-btn-primary rounded-xl text-xs font-black cursor-pointer"
                  >
                    Lên bill
                  </button>
                </div>
              )}

              {/* Action 1: Gọi món / Thêm món */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onClose();
                  onGoToOrder(table);
                }}
                className="w-full flex items-center justify-between p-3.5 clay-btn-primary text-xs sm:text-sm font-black cursor-pointer"
              >
                <div className="flex items-center space-x-2.5">
                  <Coffee className="w-4 h-4 text-emerald-300 stroke-[2.2]" />
                  <span>{activeOrder ? 'Gọi thêm món' : 'Bắt đầu gọi món'}</span>
                </div>
                <span className="text-[11px] bg-white/20 px-2.5 py-0.5 rounded-full font-bold">Mở Menu</span>
              </button>

              {/* Action 2: Xem bill / Thanh toán (nếu có khách) */}
              {activeOrder && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium');
                    onClose();
                    onGoToBill(table);
                  }}
                  className="w-full flex items-center justify-between p-3.5 clay-pill-btn text-xs sm:text-sm text-gray-800 font-extrabold cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <Receipt className="w-4 h-4 text-[#214E34] stroke-[2.2]" />
                    <span>Xem hóa đơn & Thanh toán</span>
                  </div>
                  <span className="text-xs text-[#214E34] font-black">
                    {formatVND(activeOrder.total || 0)}
                  </span>
                </button>
              )}

              {/* Action 3: Chuyển bàn (chỉ khi có đơn) */}
              {activeOrder && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setModalMode('transfer');
                  }}
                  className="w-full flex items-center justify-between p-3 clay-pill-btn text-xs font-bold text-gray-700 cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <ArrowRightLeft className="w-4 h-4 text-blue-600 stroke-[2.2]" />
                    <span>Chuyển sang bàn khác</span>
                  </div>
                  <span className="text-[11px] text-gray-400 font-semibold">Tránh trùng đơn</span>
                </button>
              )}

              {/* Action 4: Gộp bàn (chỉ khi có đơn) */}
              {activeOrder && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setModalMode('merge');
                  }}
                  className="w-full flex items-center justify-between p-3 clay-pill-btn text-xs font-bold text-gray-700 cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <GitMerge className="w-4 h-4 text-purple-600 stroke-[2.2]" />
                    <span>Gộp vào bàn đang phục vụ</span>
                  </div>
                  <span className="text-[11px] text-gray-400 font-semibold">Gộp hóa đơn</span>
                </button>
              )}

              {/* Action 5: Chỉnh sửa thông tin bàn */}
              <div className="flex items-center space-x-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onClose();
                    onEditTable(table);
                  }}
                  className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 text-xs font-bold text-gray-700 clay-pill-btn cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5 text-gray-500" />
                  <span>Sửa thông tin</span>
                </button>

                {table.status === 'empty' && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-[16px] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Xóa bàn</span>
                  </button>
                )}

              {/* Action 6: Xử lý Khẩn cấp & Cứu bàn (Toàn quyền Admin / Quản lý) */}
              {['admin', 'manager'].includes(currentRole) && (
                <div className="pt-2 border-t border-dashed border-red-200">
                  <div className="text-[11px] font-bold text-red-600 mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Xử lý khẩn cấp & Cứu bàn (Toàn quyền)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {activeOrder && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(`XÁC NHẬN: Xóa vĩnh viễn đơn #${activeOrder.id} của ${table.name} khỏi hệ thống?`)) {
                            onClose();
                            await adminForceDeleteOrder(activeOrder.id);
                          }
                        }}
                        className="py-2 px-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                        <span>Xóa vĩnh viễn đơn</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`XÁC NHẬN: Giải phóng cưỡng chế ${table.name} về trạng thái trống?`)) {
                          onClose();
                          await adminForceResetTable(table.id);
                        }
                      }}
                      className={`py-2 px-2.5 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${!activeOrder ? "col-span-2" : ""}`}
                    >
                      <RefreshCw className="w-3 h-3 text-orange-700" />
                      <span>Cưỡng chế mở bàn</span>
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}

          {/* Transfer Table Mode */}
          {modalMode === 'transfer' && (
            <div className="space-y-3.5">
              <div className="text-xs text-gray-600 font-semibold leading-relaxed">
                Chuyển toàn bộ đơn hàng của <b className="text-[#214E34]">{table.name}</b> sang bàn trống mới:
              </div>

              {emptyTables.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {emptyTables.map((t) => (
                    <label
                      key={t.id}
                      onClick={() => triggerHaptic('light')}
                      className={`flex items-center justify-between p-3 rounded-[16px] border cursor-pointer text-xs transition-all ${
                        targetTableId === t.id
                          ? 'bg-emerald-50 border-emerald-500 text-[#214E34] font-extrabold shadow-sm'
                          : 'bg-white border-gray-200/80 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="targetTable"
                          value={t.id}
                          checked={targetTableId === t.id}
                          onChange={() => setTargetTableId(t.id)}
                          className="accent-[#214E34]"
                        />
                        <span>{t.name} ({t.area || 'Khu vực chính'})</span>
                      </div>
                      <span className="text-gray-400 font-medium">{t.capacity || 4} chỗ</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-amber-700 bg-amber-50 rounded-[16px] border border-amber-200 font-semibold">
                  Hiện không còn bàn trống nào trong quán!
                </div>
              )}

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setModalMode('menu');
                  }}
                  className="flex-1 py-2.5 text-xs font-bold text-gray-600 clay-pill-btn cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  disabled={!targetTableId}
                  onClick={handleTransfer}
                  className="flex-1 py-2.5 text-xs font-black text-white clay-btn-primary disabled:opacity-40 cursor-pointer"
                >
                  Xác nhận chuyển
                </button>
              </div>
            </div>
          )}

          {/* Merge Table Mode */}
          {modalMode === 'merge' && (
            <div className="space-y-3.5">
              <div className="text-xs text-gray-600 font-semibold leading-relaxed">
                Gộp đơn từ <b className="text-[#214E34]">{table.name}</b> vào hóa đơn của bàn đang phục vụ khác:
              </div>

              {otherOccupiedTables.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {otherOccupiedTables.map((t) => (
                    <label
                      key={t.id}
                      onClick={() => triggerHaptic('light')}
                      className={`flex items-center justify-between p-3 rounded-[16px] border cursor-pointer text-xs transition-all ${
                        targetTableId === t.id
                          ? 'bg-purple-50 border-purple-600 text-purple-900 font-extrabold shadow-sm'
                          : 'bg-white border-gray-200/80 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="mergeTargetTable"
                          value={t.id}
                          checked={targetTableId === t.id}
                          onChange={() => setTargetTableId(t.id)}
                          className="accent-purple-700"
                        />
                        <span>{t.name} ({t.area || 'Khu vực chính'})</span>
                      </div>
                      <span className="text-purple-700 font-extrabold">
                        {orders[t.activeOrderId] ? formatVND(orders[t.activeOrderId].total) : ''}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 rounded-[16px] font-semibold">
                  Không có bàn nào khác đang có khách để gộp.
                </div>
              )}

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setModalMode('menu');
                  }}
                  className="flex-1 py-2.5 text-xs font-bold text-gray-600 clay-pill-btn cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  disabled={!targetTableId}
                  onClick={handleMerge}
                  className="flex-1 py-2.5 text-xs font-black text-white bg-gradient-to-r from-purple-700 to-indigo-800 rounded-[16px] shadow-md disabled:opacity-40 cursor-pointer"
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
