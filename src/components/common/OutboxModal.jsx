import React, { useState, useEffect } from 'react';
import { usePos } from '../../store/PosContext';
import { getAllOutbox, removeOutboxItem } from '../../lib/db';
import { X, WifiOff, RefreshCw, AlertTriangle, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { triggerHaptic } from '../../utils/haptics';

export default function OutboxModal({ isOpen, onClose }) {
  const { isOnline, replayOutboxQueue, isSyncingOutbox, tables, resolveOutboxConflict, showToast } = usePos();
  const [queueItems, setQueueItems] = useState([]);
  const [selectedResolvingItem, setSelectedResolvingItem] = useState(null);
  const [targetTableId, setTargetTableId] = useState('');

  const loadQueue = async () => {
    const items = await getAllOutbox();
    setQueueItems(items);
  };

  useEffect(() => {
    if (isOpen) {
      loadQueue();
    }
  }, [isOpen, isSyncingOutbox]);

  if (!isOpen) return null;

  const pendingCount = queueItems.filter((i) => i.status === 'pending').length;
  const conflictCount = queueItems.filter((i) => i.status === 'conflict').length;

  const handleManualSync = async () => {
    triggerHaptic('medium');
    if (!isOnline) {
      showToast?.('Thiết bị đang mất mạng Internet, không thể đồng bộ!', 'error');
      return;
    }
    const res = await replayOutboxQueue();
    loadQueue();
  };

  const handleResolveConflict = async (item, action) => {
    triggerHaptic('medium');
    if (!targetTableId && action === 'reassign') {
      showToast?.('Vui lòng chọn bàn mới để gán đơn!', 'error');
      return;
    }
    await resolveOutboxConflict(item.id, action, targetTableId);
    setSelectedResolvingItem(null);
    setTargetTableId('');
    loadQueue();
  };

  const emptyTables = tables.filter((t) => t.status === 'empty');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md clay-card p-5 space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white ${
              isOnline ? 'bg-emerald-700' : 'bg-amber-500'
            }`}>
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-800">Hàng Đợi Ngoại Tuyến</h3>
              <p className="text-[11px] text-gray-500 font-semibold">
                {isOnline ? 'Đã có mạng trở lại' : 'Đang bán hàng ngoại tuyến (Offline)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full clay-inset flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">Chờ đồng bộ</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs font-black">
              {pendingCount}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200/80 flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900">Cần xử lý xung đột</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 text-xs font-black">
              {conflictCount}
            </span>
          </div>
        </div>

        {/* List of Outbox Items */}
        <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
          {queueItems.length === 0 ? (
            <div className="text-center py-8 text-gray-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/70" />
              <p className="text-xs font-bold">Hàng đợi trống! Tất cả dữ liệu đã được đồng bộ.</p>
            </div>
          ) : (
            queueItems.map((item) => {
              const isConflict = item.status === 'conflict';
              const isPending = item.status === 'pending';
              const isCompleted = item.status === 'completed';

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    isConflict
                      ? 'bg-rose-50/90 border-rose-300 shadow-sm'
                      : isPending
                      ? 'bg-white border-amber-200 shadow-xs'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-800">
                      {item.actionType === 'SAVE_ORDER'
                        ? `Lưu đơn bàn ${item.payload?.tableName || item.payload?.tableId}`
                        : item.actionType === 'CHECKOUT'
                        ? `Thanh toán bàn ${item.payload?.tableName || item.payload?.tableId}`
                        : `Giao dịch #${item.orderId}`}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                        isConflict
                          ? 'bg-rose-600 text-white animate-pulse'
                          : isPending
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isConflict ? 'Xung đột bàn' : isPending ? 'Chờ đẩy' : 'Đã đồng bộ'}
                    </span>
                  </div>

                  <div className="text-[11px] text-gray-500 mt-1 flex items-center justify-between">
                    <span>Tổng tiền: <b className="text-gray-800">{formatVND(item.payload?.total || 0)}</b></span>
                    <span className="flex items-center gap-1 text-[10px]">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Conflict Notice & Resolution Prompt */}
                  {isConflict && (
                    <div className="mt-2.5 pt-2 border-t border-rose-200 space-y-2">
                      <p className="text-[11px] font-bold text-rose-800 flex items-start gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Bàn <b>{item.payload?.tableName}</b> đã có khách khác ngồi trên Cloud!</span>
                      </p>

                      {selectedResolvingItem?.id === item.id ? (
                        <div className="space-y-2 bg-white/80 p-2.5 rounded-xl border border-rose-200">
                          <label className="text-[10.5px] font-bold text-gray-700 block">
                            Chọn bàn trống mới để chuyển đơn này sang:
                          </label>
                          <select
                            value={targetTableId}
                            onChange={(e) => setTargetTableId(e.target.value)}
                            className="w-full text-xs font-bold py-1.5 px-2 rounded-lg border border-gray-300 bg-white"
                          >
                            <option value="">-- Chọn bàn trống --</option>
                            {emptyTables.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} (Trống)
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleResolveConflict(item, 'reassign')}
                              className="flex-1 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-black cursor-pointer hover:bg-rose-700"
                            >
                              Chuyển sang bàn mới
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveConflict(item, 'merge')}
                              className="px-2.5 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-black cursor-pointer hover:bg-amber-700"
                            >
                              Gộp vào
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedResolvingItem(null)}
                              className="px-2 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setSelectedResolvingItem(item);
                          }}
                          className="w-full py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl cursor-pointer shadow-xs flex items-center justify-center gap-1"
                        >
                          <span>Xử lý xung đột ngay</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-gray-100 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 clay-inset text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={!isOnline || isSyncingOutbox || pendingCount === 0}
            className={`flex-1 py-2.5 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer ${
              isOnline && pendingCount > 0
                ? 'clay-btn-primary text-white shadow-md'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOutbox ? 'animate-spin' : ''}`} />
            <span>{isSyncingOutbox ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
