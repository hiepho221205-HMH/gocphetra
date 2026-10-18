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
  // Rule: Doanh thu thực thu = tổng giao dịch tiền mặt + VietQR đã xác nhận (status === 'completed')
  // Không cộng đơn chưa thanh toán. Không tính trùng khi gộp bàn.
  const completedOrdersInRange = useMemo(() => {
    const datesSet = new Set(daysRange);
    return (orderHistory || []).filter((ord) => {
      if (ord.status !== 'completed') return false;
      const paidIso =
        ord.paid_at ||
        ord.paidAt ||
        ord.completed_at ||
        ord.completedAt ||
        ord.finishedAt;
      if (!paidIso) return false;
      const paidDate = getVietnamDateString(paidIso);
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
        const paidIso =
          ord.paid_at ||
          ord.paidAt ||
          ord.completed_at ||
          ord.completedAt ||
          ord.finishedAt;
        return getVietnamDateString(paidIso) === dateStr;
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

  // Max daily revenue for chart scaling (minimum 100,000 to avoid div by 0)
  const maxDayRevenue = useMemo(() => {
    if (dailySeries.length === 0) return 100000;
    const max = Math.max(...dailySeries.map((d) => d.revenue), 0);
    return max > 0 ? max : 100000;
  }, [dailySeries]);

  // Active inspected day details (defaults to the last day / today if none hovered)
  const activeInspection = useMemo(() => {
    if (dailySeries.length === 0) return null;
    if (inspectedDayIndex !== null && dailySeries[inspectedDayIndex]) {
      return dailySeries[inspectedDayIndex];
    }
    // Default to the last day (today)
    return dailySeries[dailySeries.length - 1];
  }, [dailySeries, inspectedDayIndex]);

  return (
    <div className="px-3.5 py-3 pb-24 space-y-3.5 text-stone-800">
      {/* ================= 1. HEADER ================= */}
      <div>
        <h2 className="text-base font-black text-forest-900 leading-tight">
          Báo cáo & Doanh thu
        </h2>
        <p className="text-[11px] text-gray-500">
          Theo dõi doanh thu bán hàng
        </p>
      </div>

      {/* ================= 2. SEGMENTED TIME FILTER (4 LỰA CHỌN) ================= */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-stone-200/70 rounded-2xl">
        {TIME_FILTERS.map((f) => {
          const isSelected = activeFilterId === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setActiveFilterId(f.id);
                setInspectedDayIndex(null);
              }}
              aria-label={`Bộ lọc ${f.label}`}
              className={`touch-target min-h-[44px] py-2 px-1 rounded-xl text-xs font-extrabold transition-all flex flex-col items-center justify-center ${
                isSelected
                  ? 'bg-[#214E34] text-white shadow-sm scale-[1.02]'
                  : 'text-stone-600 hover:text-stone-900 bg-transparent'
              }`}
            >
              <span>{f.label}</span>
              <span className={`text-[9.5px] font-normal ${isSelected ? 'text-emerald-200' : 'text-stone-400'}`}>
                {f.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* ================= 3. HERO REVENUE CARD (CARD XANH ĐẬM #214E34) ================= */}
      <div className="bg-gradient-to-br from-[#214E34] via-[#1A412B] to-[#122B1D] text-white rounded-2xl p-4 shadow-glass border border-white/10 relative overflow-hidden space-y-2.5">
        {/* Subtle background glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between text-xs text-emerald-200/90">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10.5px]">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
            Tổng doanh thu thực thu
          </span>
          <span className="bg-white/15 px-2 py-0.5 rounded-full text-[10px] font-semibold text-emerald-100 border border-white/10">
            {activeFilter.desc}
          </span>
        </div>

        {/* Large Currency Display */}
        <div className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          {formatVND(totalRevenue)}
        </div>

        {/* Breakdown sub-summary */}
        <div className="flex items-center justify-between text-[11px] text-emerald-200/80 pt-2 border-t border-white/10">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            {totalOrdersCount} đơn đã thanh toán
          </span>
          <span>
            AOV: <b className="text-white font-bold">{formatVND(averageOrderValue)}</b>/đơn
          </span>
        </div>
      </div>

      {/* ================= 4. PAYMENT METHOD BREAKDOWN (TIỀN MẶT vs VIETQR) ================= */}
      <div>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Card Tiền mặt */}
          <div className="bg-white p-3 rounded-2xl border border-stone-200/90 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Banknote className="w-3.5 h-3.5" />
                </div>
                <span>Tiền mặt</span>
              </div>
              <span className="text-[11px] font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                {cashPercent}%
              </span>
            </div>

            <div className="font-black text-sm sm:text-base text-stone-900">
              {formatVND(cashTotal)}
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${cashPercent}%` }}
              />
            </div>
          </div>

          {/* Card VietQR */}
          <div className="bg-white p-3 rounded-2xl border border-stone-200/90 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-forest-900 font-bold">
                <div className="w-6 h-6 rounded-lg bg-forest-50 text-[#214E34] flex items-center justify-center">
                  <QrCode className="w-3.5 h-3.5" />
                </div>
                <span>VietQR</span>
              </div>
              <span className="text-[11px] font-black text-[#214E34] bg-forest-50 px-1.5 py-0.5 rounded-md border border-forest-100">
                {qrPercent}%
              </span>
            </div>

            <div className="font-black text-sm sm:text-base text-stone-900">
              {formatVND(qrTotal)}
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#214E34] rounded-full transition-all duration-500"
                style={{ width: `${qrPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ================= 5. INTERACTIVE BAR CHART (FOR 3, 7, 30 DAYS) ================= */}
      {activeFilter.days > 1 && (
        <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-xs text-stone-900">
                Biểu đồ doanh thu {activeFilter.label}
              </h3>
              <p className="text-[10px] text-stone-400">
                Chạm vào cột để xem chi tiết từng ngày
              </p>
            </div>
            <span className="text-[10px] font-bold text-[#214E34] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              TB: ~{formatVND(Math.round(totalRevenue / activeFilter.days))}/ngày
            </span>
          </div>

          {/* Active Inspection Banner (Tooltip indicator) */}
          {activeInspection && (
            <div className="p-2.5 rounded-xl bg-forest-50/70 border border-forest-200/80 flex items-center justify-between text-xs animate-fadeIn">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-forest-700" />
                <span className="font-bold text-forest-900">
                  {formatVietnamDisplayDate(activeInspection.dateStr)}
                  {activeInspection.isToday ? ' (Hôm nay)' : ''}
                </span>
              </div>
              <div className="text-right">
                <div className="font-black text-[#214E34] text-xs sm:text-sm">
                  {formatVND(activeInspection.revenue)}
                </div>
                <div className="text-[10px] text-stone-500">
                  {activeInspection.orderCount} đơn hoàn thành
                </div>
              </div>
            </div>
          )}

          {/* Bar Chart Area */}
          <div className="space-y-1 pt-1">
            {/* Reference Max tick line */}
            <div className="flex items-center justify-between text-[9.5px] font-mono text-stone-400 border-b border-stone-100 pb-0.5">
              <span>Đỉnh: {formatVND(maxDayRevenue)}</span>
              <span>VND</span>
            </div>

            {/* Bars Container */}
            <div className="h-36 pt-4 pb-1 flex items-end justify-between gap-1 relative border-b border-stone-200">
              {dailySeries.map((d, idx) => {
                const heightPercent = maxDayRevenue > 0 ? (d.revenue / maxDayRevenue) * 100 : 0;
                const isInspected =
                  (inspectedDayIndex !== null && inspectedDayIndex === idx) ||
                  (inspectedDayIndex === null && idx === dailySeries.length - 1);

                return (
                  <div
                    key={d.dateStr}
                    onClick={() => setInspectedDayIndex(idx)}
                    onMouseEnter={() => setInspectedDayIndex(idx)}
                    className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer relative"
                  >
                    {/* The bar */}
                    <div
                      style={{
                        height: d.revenue > 0 ? `${Math.max(8, heightPercent)}%` : '3px'
                      }}
                      className={`w-full max-w-[32px] rounded-t-md transition-all duration-300 relative ${
                        isInspected
                          ? 'bg-[#214E34] shadow-md ring-2 ring-emerald-300/60 scale-y-105'
                          : d.revenue > 0
                          ? 'bg-emerald-600/80 hover:bg-emerald-700'
                          : 'bg-stone-200'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-Axis Day Labels */}
            <div className="flex items-center justify-between text-[9.5px] font-bold text-stone-500 pt-1">
              {activeFilter.days <= 7 ? (
                dailySeries.map((d, idx) => {
                  const isInspected =
                    (inspectedDayIndex !== null && inspectedDayIndex === idx) ||
                    (inspectedDayIndex === null && idx === dailySeries.length - 1);

                  return (
                    <div
                      key={d.dateStr}
                      onClick={() => setInspectedDayIndex(idx)}
                      className={`flex-1 text-center cursor-pointer truncate px-0.5 ${
                        isInspected ? 'text-[#214E34] font-black' : 'text-stone-500'
                      }`}
                    >
                      {d.label}
                    </div>
                  );
                })
              ) : (
                /* For 30 days: display sparse labels to avoid overlapping on 390px */
                <div className="flex items-center justify-between w-full text-[9.5px] text-stone-400">
                  <span>{formatShortDate(dailySeries[0]?.dateStr)}</span>
                  <span>{formatShortDate(dailySeries[Math.floor(dailySeries.length / 2)]?.dateStr)}</span>
                  <span className="text-[#214E34] font-bold">{formatShortDate(todayStr)} (Nay)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= 6. OPERATIONAL SUMMARY (THAY THẾ MÓN BÁN CHẠY) ================= */}
      <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-xs text-stone-900 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-forest-700" />
            <span>Chỉ số vận hành quầy</span>
          </h3>
          <span className="text-[10px] text-stone-400">GÓC POS</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100">
            <p className="text-[10.5px] text-stone-500">Giá trị TB / đơn (AOV)</p>
            <p className="font-black text-sm text-[#214E34] mt-0.5">
              {formatVND(averageOrderValue)}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100">
            <p className="text-[10.5px] text-stone-500">Giao dịch thành công</p>
            <p className="font-black text-sm text-stone-900 mt-0.5">
              {totalOrdersCount} đơn
            </p>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100 text-[10.5px] text-emerald-900 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Info className="w-3 h-3 text-emerald-700" />
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
