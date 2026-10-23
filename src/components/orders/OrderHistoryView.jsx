import React, { useState, useMemo, useEffect } from 'react';
import { usePos } from '../../store/PosContext';
import ReceiptPrintView from '../billing/ReceiptPrintView';
import HistoricalPaymentModal from '../billing/HistoricalPaymentModal';
import OrderDetailsModal from './OrderDetailsModal';
import DatePickerModal from './DatePickerModal';
import ViewOrderIconButton from '../common/ViewOrderIconButton';
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
import { triggerHaptic } from '../../utils/haptics';

export default function OrderHistoryView({ onGoToOrder, onGoToBill }) {
  const { orderHistory, orders, tables, fetchReceiptSnapshot } = usePos();

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
  const [activeDetailOrder, setActiveDetailOrder] = useState(null); // For serving & unpaid order details
  const [printOrder, setPrintOrder] = useState(null); // For completed read-only receipt
  const [printReceiptRecord, setPrintReceiptRecord] = useState(null); // For historical immutable snapshot
  const [payingOrder, setPayingOrder] = useState(null); // For historical order payment

  const handleOpenReceipt = (ord) => {
    triggerHaptic('light');
    setPrintOrder(ord);
    setPrintReceiptRecord(null);
    if (fetchReceiptSnapshot && ord?.id) {
      fetchReceiptSnapshot(ord.id)
        .then((rec) => {
          if (rec) setPrintReceiptRecord(rec);
        })
        .catch(() => {});
    }
  };

  // Date classification
  const isToday = selectedDate === todayStr;
  const isPast = compareVietnamDateStrings(selectedDate, todayStr) < 0;
  const isFuture = compareVietnamDateStrings(selectedDate, todayStr) > 0;

  // Brief loading feedback on date change
  const handleSelectDate = (newDateStr) => {
    if (newDateStr === selectedDate) return;
    triggerHaptic('light');
    setIsLoading(true);
    setSelectedDate(newDateStr);
    window.dispatchEvent(new CustomEvent('goc_pos_show_nav'));
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
    if (!isToday) return [];

    const list = Object.values(orders).filter((ord) => {
      if (ord.status === 'completed' || ord.status === 'cancelled' || ord.status === 'unpaid_carried_over') return false;
      const createdDate = ord.businessDate || getVietnamDateString(ord.createdAt || ord.created_at);
      return !createdDate || createdDate === selectedDate;
    });

    return [...list].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
      const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
      return timeA - timeB;
    });
  }, [orders, isToday, selectedDate]);

  // 2. Unpaid Carried-over Orders for Past Date
  const unpaidOrdersForDate = useMemo(() => {
    if (!isPast) return [];

    const list = (orderHistory || []).filter((ord) => {
      if (ord.status !== 'unpaid_carried_over') return false;
      const bDate = ord.businessDate || getVietnamDateString(ord.createdAt || ord.created_at);
      return bDate === selectedDate;
    });

    return [...list].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
      const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
      return timeA - timeB;
    });
  }, [orderHistory, isPast, selectedDate]);

  // 3. Completed Orders for Selected Date
  const completedOrdersForDate = useMemo(() => {
    if (isFuture) return [];

    const list = (orderHistory || []).filter((ord) => {
      if (ord.status !== 'completed') return false;
      const bDate = ord.businessDate || getVietnamDateString(ord.createdAt || ord.created_at);
      const paidDate = ord.paymentBusinessDate || getVietnamDateString(ord.paid_at || ord.paidAt || ord.finishedAt);
      return bDate === selectedDate || (isToday && paidDate === selectedDate);
    });

    return [...list].sort((a, b) => {
      const timeA = new Date(a.paid_at || a.paidAt || a.completed_at || a.completedAt || a.finishedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.paid_at || b.paidAt || b.completed_at || b.completedAt || b.finishedAt || b.createdAt || 0).getTime();
      return timeA - timeB;
    });
  }, [orderHistory, isFuture, isToday, selectedDate]);

  // Auto-select tab when switching between today and past date
  useEffect(() => {
    if (isPast && activeHistoryTab === 'serving' && unpaidOrdersForDate.length === 0) {
      setActiveHistoryTab('completed');
    }
  }, [isPast, selectedDate, unpaidOrdersForDate.length]);

  // Dynamic Metrics for Selected Date
  const totalOrdersCount = (isPast ? unpaidOrdersForDate.length : servingOrdersForDate.length) + completedOrdersForDate.length;
  const totalRevenue = useMemo(() => {
    return completedOrdersForDate
      .filter((ord) => !ord.paymentBusinessDate || ord.paymentBusinessDate === selectedDate)
      .reduce((sum, ord) => sum + (Number(ord.paidAmount) || Number(ord.total) || 0), 0);
  }, [completedOrdersForDate, selectedDate]);

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

  const filteredUnpaidOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return unpaidOrdersForDate;
    return unpaidOrdersForDate.filter(
      (ord) =>
        ord.id.toLowerCase().includes(q) ||
        (ord.tableName && ord.tableName.toLowerCase().includes(q))
    );
  }, [unpaidOrdersForDate, search]);

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
    triggerHaptic('light');
    const tbl = tables.find((t) => t.id === ord.tableId) || {
      id: ord.tableId,
      name: ord.tableName || `Bàn ${ord.tableId}`,
      activeOrderId: ord.id,
      status: 'occupied'
    };
    setActiveDetailOrder({ table: tbl, order: ord });
  };

  return (
    <div className="px-3.5 pt-3 pb-28 text-gray-800">
      {/* ================= 1. DATE FILTER BAR ================= */}
      <div className="mb-3.5 clay-card p-3 space-y-2.5">
        {/* Row 1: Simplified Date Filter Bar - Only Date Card + Single Back Button */}
        <div className="flex items-center gap-2">
          {/* Main Date Picker Trigger Button (Displays Date, Day of Week, Status) */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setIsDatePickerOpen(true);
            }}
            aria-label="Chọn ngày xem đơn"
            className="flex-1 min-h-[46px] px-3.5 py-2 rounded-[16px] clay-inset transition-all flex items-center justify-between text-left cursor-pointer active:scale-98"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full clay-disc-base clay-disc-green text-white flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-emerald-200" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-black text-[#214E34] tracking-wider leading-tight">
                  {isToday ? 'Hôm nay' : isPast ? 'Quá khứ' : 'Tương lai'}
                </div>
                <div className="text-xs font-black truncate text-gray-900 leading-tight mt-0.5">
                  {formatVietnamDisplayDate(selectedDate)}
                </div>
              </div>
            </div>
          </button>

          {/* Single Back Day Navigation Button (<) */}
          <button
            type="button"
            onClick={handlePrevDay}
            aria-label="Lùi 1 ngày"
            title="Lùi 1 ngày"
            data-testid="order-date-prev-btn"
            className="w-11 h-[46px] rounded-[16px] clay-pill-btn flex items-center justify-center shrink-0 text-forest-800 hover:text-forest-900 active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Row 2: Daily Stat Summary Bar */}
        <div className="flex items-center justify-between px-1 text-[11px] font-bold text-gray-500 pt-1.5 border-t border-gray-100">
          <span>
            Tổng: <b className="text-gray-900">{totalOrdersCount}</b> đơn
          </span>
          <span>
            Doanh thu ngày:{' '}
            <b className="text-[#214E34] font-black">{formatVND(totalRevenue)}</b>
          </span>
        </div>
      </div>

      {/* Guidance Banner for Past & Future Dates */}
      {isPast && (
        <div className="mb-3.5 px-3.5 py-2.5 rounded-[16px] bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="leading-tight text-[11px] font-semibold">
            Đang xem ngày quá khứ (<b>{formatShortDate(selectedDate)}</b>).
            {unpaidOrdersForDate.length > 0 ? (
              <span> Có <b>{unpaidOrdersForDate.length} đơn chưa thanh toán</b> được kết chuyển sang tab Chưa thanh toán.</span>
            ) : (
              <span> Toàn bộ đơn hàng đã được hoàn tất hoặc thu tiền.</span>
            )}
          </span>
        </div>
      )}

      {/* ================= 3. SEGMENTED TAB BAR ================= */}
      <div className="clay-inset p-1 grid grid-cols-2 gap-1.5 mb-3.5">
        {/* Tab 1: Đang phục vụ HOẶC Chưa thanh toán */}
        <button
          type="button"
          disabled={isFuture}
          onClick={() => {
            triggerHaptic('light');
            setActiveHistoryTab('serving');
            window.dispatchEvent(new CustomEvent('goc_pos_show_nav'));
          }}
          className={`py-2 px-3 rounded-[14px] text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeHistoryTab === 'serving'
              ? isPast
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-sm'
                : 'clay-btn-primary shadow-sm text-white'
              : isFuture
              ? 'text-gray-400 cursor-not-allowed opacity-50'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span>{isPast ? 'Chưa thanh toán' : 'Đang phục vụ'}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeHistoryTab === 'serving'
                ? 'bg-white/20 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {isPast ? unpaidOrdersForDate.length : servingOrdersForDate.length}
          </span>
        </button>

        {/* Tab 2: Đã hoàn thành */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveHistoryTab('completed');
            window.dispatchEvent(new CustomEvent('goc_pos_show_nav'));
          }}
          className={`py-2 px-3 rounded-[14px] text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeHistoryTab === 'completed'
              ? 'clay-btn-primary shadow-sm text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span>Đã hoàn thành</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeHistoryTab === 'completed'
                ? 'bg-white/20 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {completedOrdersForDate.length}
          </span>
        </button>
      </div>

      {/* ================= 4. SEARCH INPUT ================= */}
      {!isFuture && (
        <div className="relative mb-3.5">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={
              activeHistoryTab === 'serving'
                ? isPast
                  ? 'Tìm theo mã đơn hoặc số bàn chưa thanh toán...'
                  : 'Tìm theo mã đơn hoặc số bàn đang phục vụ...'
                : 'Tìm theo mã đơn hoặc số bàn đã hoàn thành...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 clay-input text-xs font-bold text-gray-800"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* ================= 5. LOADING SPINNER ================= */}
      {isLoading ? (
        <div className="py-16 text-center text-gray-400 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#214E34]" />
          <p className="text-xs font-bold">Đang tải dữ liệu ngày {formatShortDate(selectedDate)}...</p>
        </div>
      ) : isFuture ? (
        /* ================= 6. FUTURE DATE EMPTY STATE ================= */
        <div className="text-center py-14 clay-card p-6 space-y-3 animate-fadeIn">
          <div className="w-12 h-12 rounded-full clay-disc-base clay-disc-white flex items-center justify-center mx-auto text-gray-400">
            <CalendarX className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-black text-gray-800 text-sm">Chưa có dữ liệu</h4>
            <p className="text-[11px] text-gray-400 mt-0.5 font-semibold">
              Không có đơn hàng nào cho ngày {formatShortDate(selectedDate)} (ngày tương lai).
            </p>
          </div>
          <button
            type="button"
            onClick={handleGoToday}
            className="px-4 py-2 clay-btn-primary font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-300 stroke-[2.5]" />
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
                <div className="space-y-3">
                  {filteredServingOrders.map((ord) => {
                    const itemCount = (ord.items || []).reduce((s, it) => s + (it.quantity || 1), 0);
                    const timeStr = new Date(ord.createdAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div
                        key={ord.id}
                        onClick={() => handleOpenServingDetails(ord)}
                        className="clay-card clay-card-interactive p-3.5 select-none space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-sm text-[#214E34]">
                              {ord.tableName}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono font-bold bg-gray-100 px-2 py-0.5 rounded-full">
                              #{ord.id}
                            </span>
                          </div>

                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full clay-disc-base clay-disc-blue text-white shadow-xs">
                            Đang phục vụ
                          </span>
                        </div>

                        <div className="text-[11.5px] text-gray-600 line-clamp-1 font-medium">
                          {(ord.items || []).map((it) => `${it.name} (x${it.quantity})`).join(', ')}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-2 text-gray-400 text-[10.5px] font-semibold">
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

                            <ViewOrderIconButton
                              onClick={(e) => {
                                e?.stopPropagation?.();
                                handleOpenServingDetails(ord);
                              }}
                              size="sm"
                              title="Xem chi tiết đơn"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-14 clay-card p-6 space-y-2">
                  <Coffee className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="font-black text-gray-600">Không có đơn hàng nào đang phục vụ</p>
                  <p className="text-[11px] text-gray-400 font-medium">
                    Khi khách vào bàn và gọi món, đơn sẽ tự động hiển thị tại đây.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: CHƯA THANH TOÁN (NGÀY QUÁ KHỨ) */}
          {activeHistoryTab === 'serving' && isPast && (
            <div>
              {filteredUnpaidOrders.length > 0 ? (
                <div className="space-y-3">
                  {filteredUnpaidOrders.map((ord) => {
                    const itemCount = (ord.items || []).reduce((s, it) => s + (it.quantity || 1), 0);
                    const timeStr = ord.createdAt
                      ? new Date(ord.createdAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Đơn chuyển ngày';

                    return (
                      <div
                        key={ord.id}
                        className="clay-card p-3.5 border-amber-200 select-none space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-sm text-[#214E34]">
                              {ord.tableName}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono font-bold bg-gray-100 px-2 py-0.5 rounded-full">
                              #{ord.id}
                            </span>
                          </div>

                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full clay-disc-base clay-disc-amber text-white shadow-xs">
                            Chưa thanh toán
                          </span>
                        </div>

                        <div className="text-[11.5px] text-gray-600 line-clamp-1 font-medium">
                          {(ord.items || []).map((it) => `${it.name} (x${it.quantity})`).join(', ')}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-2 text-gray-400 text-[10.5px] font-semibold">
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

                            {/* Nút Xem đơn (Icon con mắt đơn giản) */}
                            <ViewOrderIconButton
                              onClick={() => handleOpenServingDetails(ord)}
                              size="sm"
                              title="Xem chi tiết đơn"
                            />

                            {/* Nút Thu tiền */}
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('medium');
                                setPayingOrder(ord);
                              }}
                              className="touch-target px-3.5 py-1.5 clay-btn-primary text-white font-black text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>Thu tiền</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-14 clay-card p-6 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="font-black text-gray-600">Không có đơn chưa thanh toán nào trong ngày này</p>
                  <p className="text-[11px] text-gray-400 font-medium">
                    Tất cả các đơn phát sinh trong ngày {formatShortDate(selectedDate)} đều đã được xử lý hoàn tất.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ĐÃ HOÀN THÀNH */}
          {activeHistoryTab === 'completed' && (
            <div>
              {filteredCompletedOrders.length > 0 ? (
                <div className="space-y-3">
                  {filteredCompletedOrders.map((ord) => {
                    const itemCount = (ord.items || []).reduce((s, it) => s + (it.quantity || 1), 0);
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
                        onClick={() => handleOpenReceipt(ord)}
                        className="clay-card clay-card-interactive p-3.5 select-none space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-sm text-gray-900">
                              {ord.tableName}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono font-bold bg-gray-100 px-2 py-0.5 rounded-full">
                              #{ord.id}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {ord.paymentBusinessDate && ord.paymentBusinessDate !== (ord.businessDate || getVietnamDateString(ord.createdAt)) && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                Đã thu ngày {formatShortDate(ord.paymentBusinessDate)}
                              </span>
                            )}
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full clay-disc-base clay-disc-green text-white shadow-xs">
                              Đã hoàn tất
                            </span>
                          </div>
                        </div>

                        <div className="text-[11.5px] text-gray-600 line-clamp-1 font-medium">
                          {(ord.items || []).map((it) => `${it.name} (x${it.quantity})`).join(', ')}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-2 text-gray-400 text-[10.5px] font-semibold">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {paymentTimeStr}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-bold text-gray-600">
                              {isVietQR ? (
                                <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Banknote className="w-3.5 h-3.5 text-amber-600" />
                              )}
                              {isVietQR ? 'VietQR' : 'Tiền mặt'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-gray-900">
                              {formatVND(ord.total)}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReceipt(ord);
                              }}
                              className="touch-target px-3 py-1.5 clay-pill-btn text-[#214E34] font-black text-xs flex items-center gap-1 cursor-pointer"
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
                <div className="text-center py-14 clay-card p-6 space-y-2">
                  <Receipt className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="font-black text-gray-600">
                    Chưa có hóa đơn nào đã hoàn thành trong ngày {formatShortDate(selectedDate)}
                  </p>
                  <p className="text-[11px] text-gray-400 font-medium">
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

      {/* ================= MODAL 2: CHI TIẾT ĐƠN HÀNG ================= */}
      {activeDetailOrder && (
        <OrderDetailsModal
          isOpen={Boolean(activeDetailOrder)}
          onClose={() => setActiveDetailOrder(null)}
          table={activeDetailOrder.table}
          order={activeDetailOrder.order}
          onHistoricalPay={(ord) => {
            setActiveDetailOrder(null);
            setPayingOrder(ord);
          }}
          onAddMoreItems={(tbl) => {
            setActiveDetailOrder(null);
            if (onGoToOrder) {
              onGoToOrder(tbl);
            }
          }}
          onCheckout={(tbl, ord) => {
            setActiveDetailOrder(null);
            if (onGoToBill) {
              const freshTable = tables.find((t) => t.id === tbl.id) || tbl;
              onGoToBill(freshTable, ord);
            }
          }}
        />
      )}

      {/* ================= MODAL 3: IN HÓA ĐƠN ================= */}
      {printOrder && (
        <ReceiptPrintView
          isOpen={Boolean(printOrder)}
          onClose={() => {
            setPrintOrder(null);
            setPrintReceiptRecord(null);
          }}
          order={printOrder}
          receiptRecord={printReceiptRecord}
          isPrePrint={false}
        />
      )}

      {/* ================= MODAL 4: THU TIỀN ĐƠN NGÀY CŨ ================= */}
      {payingOrder && (
        <HistoricalPaymentModal
          isOpen={Boolean(payingOrder)}
          onClose={() => setPayingOrder(null)}
          order={payingOrder}
        />
      )}
    </div>
  );
}
