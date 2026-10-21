import React, { useState, useMemo } from 'react';
import { usePos } from '../../store/PosContext';
import {
  TrendingUp,
  Banknote,
  QrCode,
  Calendar,
  Layers,
  Activity,
  ArrowUpRight,
  Receipt,
  Info,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatVND } from '../../utils/currency';
import {
  getVietnamTodayString,
  getVietnamDateString,
  getDaysRange,
  formatDayLabel,
  formatVietnamDisplayDate,
  formatShortDate
} from '../../utils/dateTime';
import { triggerHaptic } from '../../utils/haptics';

const TIME_FILTERS = [
  { id: '1d', label: '1 ngày', days: 1, desc: 'Hôm nay' },
  { id: '3d', label: '3 ngày', days: 3, desc: '3 ngày qua' },
  { id: '7d', label: '7 ngày', days: 7, desc: '7 ngày qua' },
  { id: '30d', label: '30 ngày', days: 30, desc: '30 ngày qua' }
];

export default function ReportsView() {
  const { orderHistory } = usePos();

  // Selected time filter (default: '1d' as required)
  const [activeFilterId, setActiveFilterId] = useState('1d');

  // Currently inspected day on chart (for touch/hover tooltip)
  const [inspectedDayIndex, setInspectedDayIndex] = useState(null);

  const activeFilter = useMemo(() => {
    return TIME_FILTERS.find((f) => f.id === activeFilterId) || TIME_FILTERS[0];
  }, [activeFilterId]);

  // Generate range of dates in Vietnam timezone
  const todayStr = useMemo(() => getVietnamTodayString(), []);

  const daysRange = useMemo(() => {
    return getDaysRange(activeFilter.days, todayStr);
  }, [activeFilter.days, todayStr]);

  // Filter completed orders that fall within daysRange
  const completedOrdersInRange = useMemo(() => {
    const datesSet = new Set(daysRange);
    return (orderHistory || []).filter((ord) => {
      if (ord.status !== 'completed') return false;
      const paidDate =
        ord.paymentBusinessDate ||
        getVietnamDateString(
          ord.paid_at ||
          ord.paidAt ||
          ord.completed_at ||
          ord.completedAt ||
          ord.finishedAt ||
          ord.created_at ||
          ord.createdAt
        );
      if (!paidDate) return false;
      return datesSet.has(paidDate);
    });
  }, [orderHistory, daysRange]);

  // Aggregate Total Revenue, Cash and VietQR
  const { totalRevenue, cashTotal, qrTotal, totalOrdersCount, averageOrderValue, cashPercent, qrPercent } =
    useMemo(() => {
      let cash = 0;
      let qr = 0;
      let total = 0;

      completedOrdersInRange.forEach((ord) => {
        const amt = Number(ord.total) || 0;
        total += amt;
        if (ord.paymentMethod === 'vietqr') {
          qr += amt;
        } else {
          cash += amt;
        }
      });

      const count = completedOrdersInRange.length;
      const aov = count > 0 ? Math.round(total / count) : 0;
      const cp = total > 0 ? Math.round((cash / total) * 100) : 0;
      const qp = total > 0 ? 100 - cp : 0;

      return {
        totalRevenue: total,
        cashTotal: cash,
        qrTotal: qr,
        totalOrdersCount: count,
        averageOrderValue: aov,
        cashPercent: cp,
        qrPercent: qp
      };
    }, [completedOrdersInRange]);

  // Build daily series for Bar Chart (when 3, 7, 30 days)
  const dailySeries = useMemo(() => {
    if (activeFilter.days === 1) return [];

    return daysRange.map((dateStr) => {
      const ordersOnDay = completedOrdersInRange.filter((ord) => {
        const paidDate =
          ord.paymentBusinessDate ||
          getVietnamDateString(
            ord.paid_at ||
            ord.paidAt ||
            ord.completed_at ||
            ord.completedAt ||
            ord.finishedAt
          );
        return paidDate === dateStr;
      });

      const dayRevenue = ordersOnDay.reduce((sum, ord) => sum + (Number(ord.total) || 0), 0);
      const dayCount = ordersOnDay.length;

      return {
        dateStr,
        revenue: dayRevenue,
        orderCount: dayCount,
        label: formatDayLabel(dateStr, activeFilter.days <= 7),
        isToday: dateStr === todayStr
      };
    });
  }, [daysRange, completedOrdersInRange, activeFilter.days, todayStr]);

  // Max daily revenue for chart scaling
  const maxDayRevenue = useMemo(() => {
    if (dailySeries.length === 0) return 100000;
    const max = Math.max(...dailySeries.map((d) => d.revenue), 0);
    return max > 0 ? max : 100000;
  }, [dailySeries]);

  // Active inspected day details
  const activeInspection = useMemo(() => {
    if (dailySeries.length === 0) return null;
    if (inspectedDayIndex !== null && dailySeries[inspectedDayIndex]) {
      return dailySeries[inspectedDayIndex];
    }
    return dailySeries[dailySeries.length - 1];
  }, [dailySeries, inspectedDayIndex]);

  const handleFilterClick = (filterId) => {
    triggerHaptic('light');
    setActiveFilterId(filterId);
    setInspectedDayIndex(null);
  };

  return (
    <div className="px-3.5 pt-3 pb-28 space-y-3.5 text-gray-800">
      {/* ================= 1. SEGMENTED TIME FILTER (4 LỰA CHỌN) ================= */}
      <div className="clay-inset p-1.5 grid grid-cols-4 gap-1.5">
        {TIME_FILTERS.map((f) => {
          const isSelected = activeFilterId === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => handleFilterClick(f.id)}
              aria-label={`Bộ lọc ${f.label}`}
              className={`touch-target min-h-[46px] py-1.5 px-1 rounded-[14px] text-xs font-black transition-all flex flex-col items-center justify-center cursor-pointer ${
                isSelected
                  ? 'clay-btn-primary shadow-sm scale-[1.02]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>{f.label}</span>
              <span className={`text-[9.5px] font-bold ${isSelected ? 'text-emerald-200' : 'text-gray-400'}`}>
                {f.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* ================= 3. HERO REVENUE CARD (3D SOFT CLAY) ================= */}
      <div className="clay-card bg-gradient-to-br from-[#214E34] via-[#265A3C] to-[#1E452E] text-white p-5 relative overflow-hidden space-y-3 shadow-lg">
        {/* Soft specular ambient glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-emerald-400/20 blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between text-xs text-emerald-200">
          <span className="flex items-center gap-1.5 font-black uppercase tracking-wider text-[11px]">
            <TrendingUp className="w-4 h-4 text-emerald-300 stroke-[2.5]" />
            Tổng doanh thu thực thu
          </span>
          <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-[10px] font-black text-white">
            {activeFilter.desc}
          </span>
        </div>

        {/* Large Currency Display */}
        <div className="text-3xl font-black tracking-tight text-white font-mono">
          {formatVND(totalRevenue)}
        </div>

        {/* Breakdown sub-summary */}
        <div className="flex items-center justify-between text-[11px] text-emerald-200/90 pt-2.5 border-t border-white/20 font-bold">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            {totalOrdersCount} đơn đã thanh toán
          </span>
          <span>
            AOV: <b className="text-white font-black">{formatVND(averageOrderValue)}</b>/đơn
          </span>
        </div>
      </div>

      {/* ================= 4. PAYMENT METHOD BREAKDOWN ================= */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Card Tiền mặt */}
        <div className="clay-card p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-amber-900 font-extrabold">
              <div className="w-7 h-7 rounded-full clay-disc-base clay-disc-amber text-white flex items-center justify-center">
                <Banknote className="w-3.5 h-3.5" />
              </div>
              <span>Tiền mặt</span>
            </div>
            <span className="text-[11px] font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {cashPercent}%
            </span>
          </div>

          <div className="font-black text-base text-gray-900 font-mono">
            {formatVND(cashTotal)}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${cashPercent}%` }}
            />
          </div>
        </div>

        {/* Card VietQR */}
        <div className="clay-card p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#214E34] font-extrabold">
              <div className="w-7 h-7 rounded-full clay-disc-base clay-disc-green text-white flex items-center justify-center">
                <QrCode className="w-3.5 h-3.5" />
              </div>
              <span>VietQR</span>
            </div>
            <span className="text-[11px] font-black text-[#214E34] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {qrPercent}%
            </span>
          </div>

          <div className="font-black text-base text-gray-900 font-mono">
            {formatVND(qrTotal)}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-[#214E34] rounded-full transition-all duration-500"
              style={{ width: `${qrPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ================= 5. INTERACTIVE BAR CHART (FOR 3, 7, 30 DAYS) ================= */}
      {activeFilter.days > 1 && (
        <div className="clay-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-xs text-gray-900">
                Biểu đồ doanh thu {activeFilter.label}
              </h3>
              <p className="text-[10px] text-gray-400 font-semibold">
                Chạm vào cột để xem chi tiết từng ngày
              </p>
            </div>
            <span className="text-[10px] font-black text-[#214E34] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              TB: ~{formatVND(Math.round(totalRevenue / activeFilter.days))}/ngày
            </span>
          </div>

          {/* Active Inspection Banner (Tooltip indicator) */}
          {activeInspection && (
            <div className="clay-inset p-3 flex items-center justify-between text-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#214E34]" />
                <span className="font-extrabold text-[#214E34]">
                  {formatVietnamDisplayDate(activeInspection.dateStr)}
                  {activeInspection.isToday ? ' (Hôm nay)' : ''}
                </span>
              </div>
              <div className="text-right">
                <div className="font-black text-[#214E34] text-xs sm:text-sm font-mono">
                  {formatVND(activeInspection.revenue)}
                </div>
                <div className="text-[10px] text-gray-500 font-bold">
                  {activeInspection.orderCount} đơn hoàn thành
                </div>
              </div>
            </div>
          )}

          {/* Bar Chart Area */}
          <div className="space-y-1.5 pt-1">
            {/* Reference Max tick line */}
            <div className="flex items-center justify-between text-[9.5px] font-mono font-bold text-gray-400 border-b border-gray-100 pb-1">
              <span>Đỉnh: {formatVND(maxDayRevenue)}</span>
              <span>VND</span>
            </div>

            {/* Bars Container */}
            <div className="h-36 pt-4 pb-1 flex items-end justify-between gap-1.5 relative border-b border-gray-200/80">
              {dailySeries.map((d, idx) => {
                const heightPercent = maxDayRevenue > 0 ? (d.revenue / maxDayRevenue) * 100 : 0;
                const isInspected =
                  (inspectedDayIndex !== null && inspectedDayIndex === idx) ||
                  (inspectedDayIndex === null && idx === dailySeries.length - 1);

                return (
                  <div
                    key={d.dateStr}
                    onClick={() => {
                      triggerHaptic('light');
                      setInspectedDayIndex(idx);
                    }}
                    onMouseEnter={() => setInspectedDayIndex(idx)}
                    className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer relative"
                  >
                    {/* The 3D bar */}
                    <div
                      style={{
                        height: d.revenue > 0 ? `${Math.max(10, heightPercent)}%` : '4px'
                      }}
                      className={`w-full max-w-[32px] rounded-t-[10px] transition-all duration-300 relative ${
                        isInspected
                          ? 'clay-btn-primary shadow-lg ring-2 ring-emerald-300/80 scale-y-105'
                          : d.revenue > 0
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-500 shadow-sm'
                          : 'bg-gray-200'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-Axis Day Labels */}
            <div className="flex items-center justify-between text-[9.5px] font-black text-gray-500 pt-1.5">
              {activeFilter.days <= 7 ? (
                dailySeries.map((d, idx) => {
                  const isInspected =
                    (inspectedDayIndex !== null && inspectedDayIndex === idx) ||
                    (inspectedDayIndex === null && idx === dailySeries.length - 1);

                  return (
                    <div
                      key={d.dateStr}
                      onClick={() => {
                        triggerHaptic('light');
                        setInspectedDayIndex(idx);
                      }}
                      className={`flex-1 text-center cursor-pointer truncate px-0.5 ${
                        isInspected ? 'text-[#214E34] font-black' : 'text-gray-500'
                      }`}
                    >
                      {d.label}
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-between w-full text-[9.5px] text-gray-400 font-bold">
                  <span>{formatShortDate(dailySeries[0]?.dateStr)}</span>
                  <span>{formatShortDate(dailySeries[Math.floor(dailySeries.length / 2)]?.dateStr)}</span>
                  <span className="text-[#214E34] font-black">{formatShortDate(todayStr)} (Nay)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= 6. OPERATIONAL SUMMARY ================= */}
      <div className="clay-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-xs text-gray-900 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#214E34]" />
            <span>Chỉ số vận hành quầy</span>
          </h3>
          <span className="text-[10px] font-black text-[#214E34] bg-emerald-50 px-2 py-0.5 rounded-full">GÓC POS</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="clay-inset p-3">
            <p className="text-[10.5px] text-gray-500 font-bold">Giá trị TB / đơn (AOV)</p>
            <p className="font-black text-sm text-[#214E34] mt-0.5 font-mono">
              {formatVND(averageOrderValue)}
            </p>
          </div>

          <div className="clay-inset p-3">
            <p className="text-[10.5px] text-gray-500 font-bold">Giao dịch thành công</p>
            <p className="font-black text-sm text-gray-900 mt-0.5">
              {totalOrdersCount} đơn
            </p>
          </div>
        </div>

        <div className="p-2.5 rounded-[14px] bg-emerald-50/80 border border-emerald-100 text-[10.5px] text-emerald-900 flex items-center justify-between font-bold">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#214E34]" />
            Phương thức thanh toán chủ đạo:
          </span>
          <span className="font-black text-[#214E34]">
            {cashTotal >= qrTotal ? 'Tiền mặt' : 'VietQR'}
          </span>
        </div>
      </div>
    </div>
  );
}
