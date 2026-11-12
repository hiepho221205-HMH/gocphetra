import React, { useState, useEffect, useMemo } from 'react';
import { usePos } from '../../store/PosContext';
import { Coffee, CheckCircle2, RotateCcw, Sparkles, Clock, Check } from 'lucide-react';
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
    <div className="space-y-4 animate-fadeIn p-2 sm:p-3 min-h-full pb-28 bg-transparent" data-testid="barista-kds-view">
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
                    className={`bg-white rounded-[22px] p-4 flex flex-col justify-between ${cardBorder} shadow-[0_10px_25px_-5px_rgba(23,77,54,0.07),0_8px_10px_-6px_rgba(23,77,54,0.03)] border-2 transition-all`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
                        <div>
                          <h4 className="text-base font-black text-[#174D36] tracking-tight leading-none">
                            {order.tableName || 'Mang Về'}
                          </h4>
                          <span className="text-[10px] font-mono font-bold text-gray-400">
                            #{String(order.id).slice(-4)}
                          </span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-2xs ${badgeStyle}`}>
                          <Clock className="w-3.5 h-3.5" />
                          <span>{waitMins}p trước</span>
                        </span>
                      </div>

                      {/* Items List (Full row touchable) */}
                      <div className="divide-y divide-gray-100 my-3 space-y-1">
                        {order.items.map((item, idx) => {
                          const itemKey = String(idx);
                          const isDone = doneItemKeys.includes(itemKey);

                          return (
                            <div
                              key={idx}
                              onClick={() => toggleBaristaItemDone?.(order.id, itemKey)}
                              className={`py-2.5 px-2.5 rounded-xl flex items-start gap-3 cursor-pointer select-none transition-all active:scale-[0.99] border ${
                                isDone
                                  ? 'bg-emerald-50/50 border-emerald-200/60 opacity-60'
                                  : 'bg-gray-50/70 border-gray-100 hover:bg-emerald-50/30'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-lg border mt-0.5 flex items-center justify-center transition-colors shadow-2xs ${
                                isDone
                                  ? 'bg-[#174D36] border-[#174D36] text-white'
                                  : 'bg-white border-gray-300'
                              }`}>
                                {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className={`text-xs sm:text-sm font-black text-gray-900 ${isDone ? 'line-through text-gray-500' : ''}`}>
                                    {item.quantity || item.qty || 1}x {item.name || item.productName}
                                  </span>
                                  {item.size && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-[#174D36] border border-gray-200 shrink-0">
                                      {item.size}
                                    </span>
                                  )}
                                </div>

                                {/* Toppings */}
                                {Array.isArray(item.toppings) && item.toppings.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.toppings.map((t, tIdx) => {
                                      const tName = typeof t === 'string' ? t : t.name;
                                      return (
                                        <span
                                          key={tIdx}
                                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                                        >
                                          + {tName}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Notes */}
                                {(item.notes || item.note) && (
                                  <p className="text-[11px] text-amber-900 font-bold mt-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg inline-block">
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
                    <div className="pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => completeBaristaOrder?.(order.id)}
                        className={`w-full min-h-[46px] rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-md ${
                          allItemsDone
                            ? 'clay-btn-primary text-white'
                            : 'bg-[#214E34] text-white hover:bg-[#1A3F2A]'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full">
              {baristaHistory.map((order) => {
                const finishedTimeStr = order.finishedAt
                  ? new Date(order.finishedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : 'Vừa xong';

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-[22px] p-4 flex flex-col justify-between border border-gray-200/80 shadow-[0_8px_20px_-4px_rgba(23,77,54,0.06)] w-full transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
                        <div>
                          <h4 className="text-sm font-black text-gray-900 leading-tight">
                            {order.tableName || 'Mang Về'}
                          </h4>
                          <span className="text-[10px] font-mono font-bold text-gray-400">
                            #{String(order.id).slice(-4)}
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Xong lúc {finishedTimeStr}</span>
                        </span>
                      </div>

                      <div className="my-2.5 space-y-1">
                        {Array.isArray(order.items) &&
                          order.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1 px-2 rounded-lg bg-gray-50 text-xs font-bold text-gray-700">
                              <span>{it.quantity || it.qty || 1}x {it.name || it.productName}</span>
                              {it.size && (
                                <span className="text-[10px] text-gray-500 font-semibold">({it.size})</span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => undoBaristaOrder?.(order.id)}
                      className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer mt-2 border border-gray-200/70 shadow-2xs transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-gray-600" />
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
