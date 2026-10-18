import React, { useState, useMemo, useEffect } from 'react';
import { usePos } from '../../store/PosContext';
import ReceiptPrintView from '../billing/ReceiptPrintView';
import OrderDetailsModal from './OrderDetailsModal';
import DatePickerModal from './DatePickerModal';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  Printer,
  CheckCircle2,
  Search,
  Receipt,
  User,
  Coffee,
  CalendarX,
  Banknote,
  QrCode,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { formatVND } from '../../utils/currency';
import {
  getVietnamTodayString,
  getVietnamDateString,
  formatVietnamDisplayDate,
  formatShortDate,
  addDaysToDateString,
  compareVietnamDateStrings
} from '../../utils/dateTime';

export default function OrderHistoryView({ onGoToOrder, onGoToBill }) {
  const { orderHistory, orders, tables } = usePos();

  // Current Vietnam Date
  const todayStr = useMemo(() => getVietnamTodayString(), []);

  // Selected Date Filter: defaults to today in Asia/Ho_Chi_Minh
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Tab State: 'serving' | 'completed'
  const [activeHistoryTab, setActiveHistoryTab] = useState('serving');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [activeDetailOrder, setActiveDetailOrder] = useState(null); // For serving order details
  const [printOrder, setPrintOrder] = useState(null); // For completed read-only receipt

  // Date classification
  const isToday = selectedDate === todayStr;
  const isPast = compareVietnamDateStrings(selectedDate, todayStr) < 0;
  const isFuture = compareVietnamDateStrings(selectedDate, todayStr) > 0;

  // Auto-switch tab to 'completed' when a past date is selected
  useEffect(() => {
    if (isPast) {
      setActiveHistoryTab('completed');
    }
  }, [isPast, selectedDate]);

  // Brief loading feedback on date change
  const handleSelectDate = (newDateStr) => {
    if (newDateStr === selectedDate) return;
    setIsLoading(true);
    setSelectedDate(newDateStr);
    setTimeout(() => {
      setIsLoading(false);
    }, 180);
  };

  const handlePrevDay = () => {
    const prev = addDaysToDateString(selectedDate, -1);
    handleSelectDate(prev);
  };

  const handleNextDay = () => {
    const next = addDaysToDateString(selectedDate, 1);
    handleSelectDate(next);
  };

  const handleGoToday = () => {
    handleSelectDate(todayStr);
  };

  // 1. Serving Orders for Selected Date (Only applicable on Today)
  const servingOrdersForDate = useMemo(() => {
    if (!isToday) return []; // Past and Future dates do not have active serving orders!

    const list = Object.values(orders).filter((ord) => {
      if (ord.status === 'completed') return false;
      const createdDate = getVietnamDateString(ord.createdAt || ord.created_at);
      return !createdDate || createdDate === selectedDate;
    });

    // Sort ascending by creation time in the day (oldest first: 08:30 -> 09:15 -> 10:00)
    return [...list].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.created_at).getTime();
      const timeB = new Date(b.createdAt || b.created_at).getTime();
      return timeA - timeB;
    });
  }, [orders, isToday, selectedDate]);

  // 2. Completed Orders for Selected Date (Filtered strictly by paid_at / completed_at / finishedAt)
  const completedOrdersForDate = useMemo(() => {
    if (isFuture) return []; // Future dates have no completed orders

    const list = (orderHistory || []).filter((ord) => {
      if (ord.status !== 'completed') return false;
      const paidIso = ord.paid_at || ord.paidAt || ord.completed_at || ord.completedAt || ord.finishedAt;
      if (!paidIso) return false;
      const paidDate = getVietnamDateString(paidIso);
      return paidDate === selectedDate;
    });

    // Sort ascending by payment/completion time in the day (oldest first: 09:00 -> 10:15)
    return [...list].sort((a, b) => {
      const timeA = new Date(a.paid_at || a.paidAt || a.completed_at || a.completedAt || a.finishedAt).getTime();
      const timeB = new Date(b.paid_at || b.paidAt || b.completed_at || b.completedAt || b.finishedAt).getTime();
      return timeA - timeB;
    });
  }, [orderHistory, isFuture, selectedDate]);

  // Dynamic Metrics for Selected Date
  const totalOrdersCount = servingOrdersForDate.length + completedOrdersForDate.length;
  const totalRevenue = completedOrdersForDate.reduce((sum, ord) => sum + (ord.total || 0), 0);

  // Filtered by Search Query
  const filteredServingOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return servingOrdersForDate;
    return servingOrdersForDate.filter(
      (ord) =>
        ord.id.toLowerCase().includes(q) ||
        (ord.tableName && ord.tableName.toLowerCase().includes(q))
    );
  }, [servingOrdersForDate, search]);

  const filteredCompletedOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return completedOrdersForDate;
    return completedOrdersForDate.filter(
      (ord) =>
        ord.id.toLowerCase().includes(q) ||
        (ord.tableName && ord.tableName.toLowerCase().includes(q))
    );
  }, [completedOrdersForDate, search]);

  // Open active order details
  const handleOpenServingDetails = (ord) => {
    const tbl = tables.find((t) => t.id === ord.tableId) || {
      id: ord.tableId,
      name: ord.tableName || `Bàn ${ord.tableId}`,
      activeOrderId: ord.id,
      status: 'occupied'
    };
    setActiveDetailOrder({ table: tbl, order: ord });
  };

  return (
    <div className="px-3.5 py-3 pb-24 text-stone-800">
      {/* ================= 1. HEADER ================= */}
      <div className="mb-2.5">
        <h2 className="text-base font-black text-forest-900 leading-tight">
          Quản lý Đơn hàng
        </h2>
        <p className="text-[11px] text-gray-500">
          Theo dõi đơn đang phục vụ và hóa đơn đã hoàn tất theo ngày
        </p>
      </div>

      {/* ================= 2. DATE FILTER BAR ================= */}
      <div className="mb-3 bg-white p-2.5 rounded-2xl border border-stone-200/90 shadow-2xs space-y-2">
        {/* Row 1: Calendar selector + Quick nav arrows + Today button */}
        <div className="flex items-center justify-between gap-1.5">
          {/* Main Date Picker Trigger Button */}
          <button
            type="button"
            onClick={() => setIsDatePickerOpen(true)}
            aria-label="Chọn ngày xem đơn"
            className="flex-1 min-h-[42px] px-3 py-1.5 rounded-xl bg-forest-50/80 hover:bg-forest-100/90 active:scale-98 border border-forest-200/70 text-forest-900 transition-all flex items-center justify-between gap-2 shadow-2xs text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#214E34] text-white flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-forest-700 tracking-wider">
                  {isToday ? 'Hôm nay' : isPast ? 'Quá khứ' : 'Tương lai'}
                </div>
                <div className="text-xs font-black truncate text-stone-900">
                  {formatVietnamDisplayDate(selectedDate)}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-forest-700 px-1.5 py-0.5 rounded-md bg-white/80 shrink-0 border border-forest-200">
              Đổi
            </span>
          </button>

          {/* Previous Day (<) */}
          <button
            type="button"
            onClick={handlePrevDay}
            aria-label="Lùi 1 ngày"
            title="Lùi 1 ngày"
            className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 flex items-center justify-center shrink-0 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Quick "Hôm nay" CTA button (visible when not on today) */}
          {!isToday ? (
            <button
              type="button"
              onClick={handleGoToday}
              aria-label="Về ngày hôm nay"
              title="Về ngày hôm nay"
              className="px-2.5 h-10 rounded-xl bg-[#214E34] hover:bg-[#1a3e29] active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1 shrink-0 transition-all shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden xs:inline">Hôm nay</span>
            </button>
          ) : (
            /* Next Day (>) when on today */
            <button
              type="button"
              onClick={handleNextDay}
              aria-label="Tiến 1 ngày"
              title="Tiến 1 ngày"
              className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 flex items-center justify-center shrink-0 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Next Day (>) when not on today */}
          {!isToday && (
            <button
              type="button"
              onClick={handleNextDay}
              aria-label="Tiến 1 ngày"
              title="Tiến 1 ngày"
              className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 flex items-center justify-center shrink-0 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Row 2: Daily Stat Summary Bar */}
        <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-stone-500 pt-1 border-t border-stone-100">
          <span>
            Tổng: <b className="text-stone-900">{totalOrdersCount}</b> đơn
          </span>
          <span>
            Doanh thu ngày:{' '}
            <b className="text-[#214E34] font-black">{formatVND(totalRevenue)}</b>
          </span>
        </div>
      </div>

      {/* Guidance Banner for Past & Future Dates */}
      {isPast && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="leading-tight text-[11px]">
            Đang xem ngày quá khứ (<b>{formatShortDate(selectedDate)}</b>). Chỉ hiển thị hóa đơn đã hoàn tất.
          </span>
        </div>
      )}

      {/* ================= 3. SEGMENTED TAB BAR ================= */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-200/70 rounded-2xl mb-3">
        {/* Tab 1: Đang phục vụ */}
        <button
          type="button"
          disabled={isPast || isFuture}
          onClick={() => setActiveHistoryTab('serving')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs ${
            activeHistoryTab === 'serving'
              ? 'bg-[#214E34] text-white shadow-sm'
              : isPast || isFuture
              ? 'text-stone-400 bg-transparent cursor-not-allowed opacity-50'
              : 'text-stone-600 hover:text-stone-900 bg-transparent'
          }`}
        >
          <span>Đang phục vụ</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              activeHistoryTab === 'serving'
                ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                : 'bg-stone-300 text-stone-700'
            }`}
          >
            {servingOrdersForDate.length}
          </span>
        </button>

        {/* Tab 2: Đã hoàn thành */}
        <button
          type="button"
          onClick={() => setActiveHistoryTab('completed')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs ${
            activeHistoryTab === 'completed'
              ? 'bg-[#214E34] text-white shadow-sm'
              : 'text-stone-600 hover:text-stone-900 bg-transparent'
          }`}
        >
          <span>Đã hoàn thành</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              activeHistoryTab === 'completed'
                ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                : 'bg-stone-300 text-stone-700'
            }`}
          >
            {completedOrdersForDate.length}
          </span>
        </button>
      </div>

      {/* ================= 4. SEARCH INPUT ================= */}
      {!isFuture && (
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              activeHistoryTab === 'serving'
                ? 'Tìm theo mã đơn hoặc số bàn đang phục vụ...'
                : 'Tìm theo mã đơn hoặc số bàn đã hoàn thành...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-[#214E34] focus:ring-1 focus:ring-[#214E34]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* ================= 5. LOADING SPINNER ================= */}
      {isLoading ? (
        <div className="py-16 text-center text-stone-400 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#214E34]" />
          <p className="text-xs">Đang tải dữ liệu ngày {formatShortDate(selectedDate)}...</p>
        </div>
      ) : isFuture ? (
        /* ================= 6. FUTURE DATE EMPTY STATE ================= */
        <div className="text-center py-14 text-stone-400 text-xs bg-white rounded-2xl border border-stone-200/80 p-6 space-y-3 animate-fadeIn">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
            <CalendarX className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-stone-800 text-sm">Chưa có dữ liệu</h4>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Không có đơn hàng nào cho ngày {formatShortDate(selectedDate)} (ngày tương lai).
            </p>
          </div>
          <button
            type="button"
            onClick={handleGoToday}
            className="px-4 py-2 rounded-xl bg-[#214E34] hover:bg-[#1a3e29] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm active:scale-97 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-300" />
            <span>Về ngày hôm nay</span>
          </button>
        </div>
      ) : (
        /* ================= 7. ORDERS LIST ================= */
        <div>
          {/* TAB 1: ĐANG PHỤC VỤ (HÔM NAY) */}
          {activeHistoryTab === 'serving' && isToday && (
            <div>
              {filteredServingOrders.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredServingOrders.map((ord) => {
                    const itemCount = ord.items.reduce((s, it) => s + (it.quantity || 1), 0);
                    const timeStr = new Date(ord.createdAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div
                        key={ord.id}
                        onClick={() => handleOpenServingDetails(ord)}
                        className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs hover:border-[#214E34]/40 transition-all cursor-pointer select-none space-y-2 group active:scale-[0.99]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-sm text-[#214E34]">
                              {ord.tableName}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono font-bold bg-stone-100 px-1.5 py-0.2 rounded">
                              #{ord.id}
                            </span>
                          </div>

                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                            Đang phục vụ
                          </span>
                        </div>

                        <div className="text-[11px] text-stone-500 line-clamp-1">
                          {ord.items.map((it) => `${it.name} (x${it.quantity})`).join(', ')}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                          <div className="flex items-center gap-2 text-stone-400 text-[10.5px]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {timeStr}
                            </span>
                            <span>•</span>
                            <span>{itemCount} món</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-[#214E34]">
                              {formatVND(ord.total)}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenServingDetails(ord);
                              }}
                              className="touch-target px-2.5 py-1.5 rounded-xl bg-forest-50 hover:bg-[#214E34] text-[#214E34] hover:text-white font-extrabold text-xs flex items-center gap-1 border border-forest-200 transition-colors shadow-2xs"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Xem đơn</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-14 text-stone-400 text-xs bg-white rounded-2xl border border-stone-200/80 p-6 space-y-2">
                  <Coffee className="w-8 h-8 text-stone-300 mx-auto" />
                  <p className="font-semibold text-stone-600">Không có đơn hàng nào đang phục vụ</p>
                  <p className="text-[11px] text-stone-400">
                    Khi khách vào bàn và gọi món, đơn sẽ tự động hiển thị tại đây.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ĐÃ HOÀN THÀNH (HÔM NAY HOẶC QUÁ KHỨ) */}
          {activeHistoryTab === 'completed' && (
            <div>
              {filteredCompletedOrders.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredCompletedOrders.map((ord) => {
                    const itemCount = ord.items.reduce((s, it) => s + (it.quantity || 1), 0);
                    const paidIso = ord.paid_at || ord.paidAt || ord.completed_at || ord.completedAt || ord.finishedAt;
                    const paymentTimeStr = paidIso
                      ? new Date(paidIso).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Hoàn tất';

                    const isVietQR = ord.paymentMethod === 'vietqr';

                    return (
                      <div
                        key={ord.id}
                        onClick={() => setPrintOrder(ord)}
                        className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-emerald-600/40 transition-all cursor-pointer select-none space-y-2 group active:scale-[0.99]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-sm text-stone-900">
                              {ord.tableName}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono font-bold bg-stone-100 px-1.5 py-0.2 rounded">
                              #{ord.id}
                            </span>
                          </div>

                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Đã hoàn tất
                          </span>
                        </div>

                        <div className="text-[11px] text-stone-500 line-clamp-1">
                          {ord.items.map((it) => `${it.name} (x${it.quantity})`).join(', ')}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                          <div className="flex items-center gap-2 text-stone-400 text-[10.5px]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {paymentTimeStr}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              {isVietQR ? (
                                <QrCode className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Banknote className="w-3 h-3 text-amber-600" />
                              )}
                              {isVietQR ? 'VietQR' : 'Tiền mặt'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-stone-900">
                              {formatVND(ord.total)}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrintOrder(ord);
                              }}
                              className="touch-target px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-forest-100 text-stone-700 hover:text-[#214E34] font-bold text-xs flex items-center gap-1 transition-colors"
                              title="In lại hóa đơn"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>In bill</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-14 text-stone-400 text-xs bg-white rounded-2xl border border-stone-200/80 p-6 space-y-2">
                  <Receipt className="w-8 h-8 text-stone-300 mx-auto" />
                  <p className="font-semibold text-stone-600">
                    Chưa có hóa đơn nào đã hoàn thành trong ngày {formatShortDate(selectedDate)}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Các hóa đơn thanh toán thành công trong ngày sẽ được lưu trữ tại đây.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL 1: DATE PICKER MODAL ================= */}
      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
      />

      {/* ================= MODAL 2: CHI TIẾT ĐƠN ĐANG PHỤC VỤ (HÔM NAY) ================= */}
      {activeDetailOrder && isToday && (
        <OrderDetailsModal
          isOpen={Boolean(activeDetailOrder)}
          onClose={() => setActiveDetailOrder(null)}
          table={activeDetailOrder.table}
          order={activeDetailOrder.order}
          onAddMoreItems={(tbl) => {
            setActiveDetailOrder(null);
            if (onGoToOrder) {
              onGoToOrder(tbl);
            }
          }}
          onCheckout={(tbl) => {
            setActiveDetailOrder(null);
            if (onGoToBill) {
              onGoToBill(tbl);
            }
          }}
        />
      )}

      {/* ================= MODAL 3: IN HÓA ĐƠN ĐÃ HOÀN THÀNH (CHỈ ĐỌC) ================= */}
      {printOrder && (
        <ReceiptPrintView
          isOpen={Boolean(printOrder)}
          onClose={() => setPrintOrder(null)}
          order={printOrder}
          isPrePrint={false}
        />
      )}
    </div>
  );
}
