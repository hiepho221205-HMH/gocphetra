import React, { useState, useEffect, useMemo } from 'react';
import { usePos } from '../../store/PosContext';
import { Coffee, CheckCircle2, RotateCcw, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { isAudioMuted, toggleAudioMuted, playOrderChime } from '../../utils/audioChime';
import { triggerHaptic } from '../../utils/haptics';

export default function BaristaKdsView({ viewMode = 'queue' }) {
  const {
    baristaPendingOrders = [],
    baristaHistory = [],
    baristaItemDone = {},
    completeBaristaOrder,
    undoBaristaOrder,
    toggleBaristaItemDone,
    setActiveTab
  } = usePos();

  const [muted, setMuted] = useState(() => isAudioMuted());
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  // Update minute counter every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleMute = () => {
    triggerHaptic('light');
    const next = toggleAudioMuted();
    setMuted(next);
    if (!next) {
      playOrderChime();
    }
  };

  const isHistoryView = viewMode === 'history';

  // Calculate wait minutes helper
  const getWaitMinutes = (createdAt) => {
    if (!createdAt) return 1;
    const diffMs = nowTimestamp - new Date(createdAt).getTime();
    return Math.max(1, Math.floor(diffMs / 60000));
  };

  return (
    <div className="space-y-4 animate-fadeIn p-1 sm:p-2" data-testid="barista-kds-view">
      {/* Top Floating Mini Bar for Sound Mute Toggle */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-gray-500">
          {isHistoryView
            ? `Tổng cộng ${baristaHistory.length} đơn đã pha trong ca`
            : `${baristaPendingOrders.length} đơn đang chờ pha chế (FIFO)`}
        </span>
        <button
          type="button"
          onClick={handleToggleMute}
          title={muted ? 'Bật chuông thông báo đơn mới' : 'Tắt chuông thông báo'}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 border ${
            muted
              ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          {muted ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-red-600" />
              <span>Chuông: Tắt</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Chuông: Bật</span>
            </>
          )}
        </button>
      </div>

      {/* ===================== VIEW 1: QUEUE (HÀNG ĐỢI PHA CHẾ) ===================== */}
      {!isHistoryView && (
        <>
          {baristaPendingOrders.length === 0 ? (
            <div className="clay-surface p-10 text-center max-w-sm mx-auto my-6 border border-white">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-black text-gray-900 text-base">Quầy bar đã xong hết món!</h3>
              <p className="text-xs text-gray-500 mt-1">
                Không còn ly nước nào đang chờ. Khi phục vụ bấm gửi đơn, đơn sẽ tự động xuất hiện tại đây kèm chuông báo Ting-Ting.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {baristaPendingOrders.map((order) => {
                const waitMins = getWaitMinutes(order.createdAt);
                let badgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                let cardBorder = 'border-white';

                if (waitMins >= 10) {
                  badgeStyle = 'bg-rose-100 text-rose-800 border-rose-300 font-black animate-pulse';
                  cardBorder = 'border-rose-300 ring-2 ring-rose-200';
                } else if (waitMins >= 5) {
                  badgeStyle = 'bg-amber-100 text-amber-800 border-amber-300 font-black';
                  cardBorder = 'border-amber-200';
                }

                const doneItemKeys = baristaItemDone[order.id] || [];
                const allItemsDone =
                  Array.isArray(order.items) &&
                  order.items.length > 0 &&
                  order.items.every((_, idx) => doneItemKeys.includes(String(idx)));

                return (
                  <div
                    key={order.id}
                    className={`clay-surface p-4 flex flex-col justify-between ${cardBorder} shadow-sm transition-all`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-black text-gray-900 tracking-tight">
                            {order.tableName || 'Mang Về'}
                          </h4>
                          <span className="text-[11px] font-mono font-bold text-gray-400">
                            #{String(order.id).slice(-4)}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${badgeStyle}`}>
                          ⏳ {waitMins}p trước
                        </span>
                      </div>

                      {/* Items List (Full row touchable) */}
                      <div className="divide-y divide-gray-100 my-2.5 space-y-1">
                        {order.items.map((item, idx) => {
                          const itemKey = String(idx);
                          const isDone = doneItemKeys.includes(itemKey);

                          return (
                            <div
                              key={idx}
                              onClick={() => toggleBaristaItemDone?.(order.id, itemKey)}
                              className={`py-2 flex items-start gap-2.5 cursor-pointer select-none active:bg-gray-50 rounded-lg p-1 transition-colors ${
                                isDone ? 'line-through opacity-50' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => {}} // Handled by row click
                                className="w-5 h-5 rounded-md mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#214E34]"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs sm:text-sm font-black text-gray-800 truncate">
                                    {item.quantity || item.qty || 1}x {item.name || item.productName}
                                  </span>
                                  {item.size && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-gray-100 text-gray-600 ml-1">
                                      {item.size}
                                    </span>
                                  )}
                                </div>

                                {/* Toppings */}
                                {Array.isArray(item.toppings) && item.toppings.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {item.toppings.map((t, tIdx) => {
                                      const tName = typeof t === 'string' ? t : t.name;
                                      return (
                                        <span
                                          key={tIdx}
                                          className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        >
                                          + {tName}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Notes */}
                                {(item.notes || item.note) && (
                                  <p className="text-[11px] text-amber-900 font-bold mt-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded inline-block">
                                    Ghi chú: {item.notes || item.note}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card Footer Action Button */}
                    <div className="pt-2.5 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => completeBaristaOrder?.(order.id)}
                        className={`w-full min-h-[46px] rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-xs ${
                          allItemsDone
                            ? 'clay-btn-primary'
                            : 'bg-gray-100 hover:bg-emerald-50 text-[#1A462C] border border-gray-200'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{allItemsDone ? 'Đã Xong — Giao Khách' : 'Hoàn Tất Cả Đơn'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===================== VIEW 2: HISTORY (LỊCH SỬ ĐÃ HOÀN TẤT) ===================== */}
      {isHistoryView && (
        <>
          {baristaHistory.length === 0 ? (
            <div className="clay-surface p-10 text-center max-w-sm mx-auto my-6 border border-white">
              <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 mx-auto flex items-center justify-center mb-3">
                <Coffee className="w-7 h-7" />
              </div>
              <h3 className="font-black text-gray-800 text-sm">Chưa có lịch sử pha chế trong ca</h3>
              <p className="text-xs text-gray-500 mt-1">
                Khi bạn bấm "Hoàn tất đơn" ở hàng đợi, các đơn đã làm xong sẽ được lưu trữ tại đây để dễ dàng đối soát hoặc hoàn tác.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {baristaHistory.map((order) => {
                const finishedTimeStr = order.finishedAt
                  ? new Date(order.finishedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : 'Vừa xong';

                return (
                  <div
                    key={order.id}
                    className="clay-surface p-3.5 flex flex-col justify-between opacity-95 border border-gray-100 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-gray-900">
                            {order.tableName || 'Mang Về'}
                          </h4>
                          <span className="text-[10px] font-mono font-bold text-gray-400">
                            #{String(order.id).slice(-4)}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Xong lúc {finishedTimeStr}
                        </span>
                      </div>

                      <div className="text-[11px] text-gray-600 my-2 space-y-0.5">
                        {Array.isArray(order.items) &&
                          order.items.map((it, idx) => (
                            <div key={idx} className="truncate">
                              • {it.quantity || it.qty || 1}x {it.name || it.productName}
                              {it.size ? ` (${it.size})` : ''}
                            </div>
                          ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => undoBaristaOrder?.(order.id)}
                      className="w-full py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center gap-1 active:scale-98 cursor-pointer mt-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Hoàn tác lại hàng đợi</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
