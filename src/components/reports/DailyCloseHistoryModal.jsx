import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import {
  X,
  Calendar,
  TrendingUp,
  Banknote,
  QrCode,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Printer,
  Award,
  ChevronRight,
  Bluetooth,
  Loader2
} from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { formatVietnamDisplayDate, getVietnamTodayString } from '../../utils/dateTime';
import { triggerHaptic } from '../../utils/haptics';
import {
  isBluetoothSupported,
  connectBluetoothPrinter,
  getBluetoothPrinterStatus,
  printDailyClose57mm
} from '../../utils/bluetoothPrinter';

export default function DailyCloseHistoryModal({ isOpen, onClose }) {
  const { dailyClosures, getDailyCloseReport, settings, showToast } = usePos();
  const [selectedDate, setSelectedDate] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const todayStr = getVietnamTodayString();
  const report = selectedDate ? getDailyCloseReport(selectedDate) : null;
  const closedDatesList = Object.keys(dailyClosures || {}).sort((a, b) => b.localeCompare(a));

  const handlePrintDailyClose = async () => {
    triggerHaptic('medium');
    if (!report) return;

    const bt = getBluetoothPrinterStatus();
    if (bt.isConnected) {
      setIsPrinting(true);
      try {
        await printDailyClose57mm(report, settings, {
          useNoAccents: settings.printNoAccents === true
        });
        showToast?.('Đã in phiếu chốt ngày qua Bluetooth (57mm)!', 'success');
      } catch (err) {
        showToast?.('Lỗi in Bluetooth. Đang chuyển sang in trình duyệt!', 'error');
        window.print();
      } finally {
        setIsPrinting(false);
      }
    } else {
      // Fallback browser print
      window.print();
    }
  };

  const handleBluetoothConnectAndPrint = async () => {
    triggerHaptic('medium');
    if (!isBluetoothSupported()) {
      showToast?.('Trình duyệt không hỗ trợ Web Bluetooth. Đang mở in trình duyệt!', 'info');
      window.print();
      return;
    }

    setIsPrinting(true);
    try {
      showToast?.('Vui lòng chọn máy in Bluetooth...', 'info');
      await connectBluetoothPrinter();
      await printDailyClose57mm(report, settings, {
        useNoAccents: settings.printNoAccents === true
      });
      showToast?.('Đã in phiếu chốt ngày qua Bluetooth (57mm)!', 'success');
    } catch (err) {
      console.warn('Lỗi kết nối in Bluetooth:', err);
      showToast?.(err.message || 'Không thể in Bluetooth', 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg clay-card p-4 sm:p-5 space-y-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            {selectedDate ? (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedDate(null);
                }}
                className="w-8 h-8 rounded-xl clay-inset flex items-center justify-center text-gray-600 hover:text-gray-900 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-[#214E34] text-white flex items-center justify-center shadow-md">
                <Calendar className="w-4 h-4" />
              </div>
            )}
            <div>
              <h3 className="text-base font-black text-gray-900">
                {selectedDate ? 'Biên Bản Chốt Doanh Thu' : 'Lịch Sử Chốt Doanh Thu Ngày'}
              </h3>
              <p className="text-[11px] text-gray-500 font-semibold">
                {selectedDate
                  ? `${formatVietnamDisplayDate(selectedDate)} ${selectedDate === todayStr ? '(Hôm nay - Đang mở)' : '(Đã chốt sổ)'}`
                  : 'Danh sách các ngày kinh doanh đã đóng sổ'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {selectedDate && (
              <>
                <button
                  type="button"
                  onClick={handleBluetoothConnectAndPrint}
                  disabled={isPrinting}
                  className="px-2.5 py-1.5 rounded-xl bg-[#214E34] hover:bg-[#183926] text-white text-[11px] font-black flex items-center gap-1 shadow-md cursor-pointer print:hidden"
                  title="In phiếu chốt ngày qua Bluetooth 57mm"
                >
                  {isPrinting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Bluetooth className="w-3.5 h-3.5" />
                  )}
                  <span>In 57mm</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintDailyClose}
                  className="w-8 h-8 rounded-xl clay-inset text-gray-600 hover:text-gray-900 flex items-center justify-center cursor-pointer print:hidden"
                  title="In qua trình duyệt"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full clay-inset flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto space-y-3 pr-1 flex-1">
          {/* VIEW 1: MASTER LIST OF CLOSED DATES */}
          {!selectedDate ? (
            <div className="space-y-2.5">
              {/* Card Today (Active Day Live Summary) */}
              <div
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedDate(todayStr);
                }}
                className="clay-card p-3.5 hover:scale-[1.01] transition-transform cursor-pointer border-2 border-emerald-500/40 relative overflow-hidden group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-extrabold text-xs text-gray-900">
                      Hôm nay: {formatVietnamDisplayDate(todayStr)}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                    Đang mở bán
                  </span>
                </div>

                <div className="mt-2.5 flex items-baseline justify-between">
                  <div className="text-lg font-black text-[#214E34] font-mono">
                    {formatVND(getDailyCloseReport(todayStr)?.totalRevenue || 0)}
                  </div>
                  <div className="text-xs text-gray-500 font-bold flex items-center gap-1">
                    <span>{getDailyCloseReport(todayStr)?.totalOrders || 0} đơn</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>

              {/* History List */}
              {closedDatesList.length === 0 ? (
                <div className="text-center py-10 text-gray-400 space-y-2">
                  <Clock className="w-8 h-8 mx-auto text-gray-300 stroke-[1.5]" />
                  <p className="text-xs font-bold text-gray-500">Chưa có ngày nào trong quá khứ được chốt</p>
                  <p className="text-[11px] text-gray-400">
                    Khi bước qua ngày mới, hệ thống sẽ tự động tổng kết và lưu trữ tại đây.
                  </p>
                </div>
              ) : (
                closedDatesList.map((dateStr) => {
                  const snap = dailyClosures[dateStr];
                  return (
                    <div
                      key={dateStr}
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedDate(dateStr);
                      }}
                      className="clay-card p-3.5 hover:scale-[1.01] transition-transform cursor-pointer space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#214E34]" />
                          <span>{formatVietnamDisplayDate(dateStr)}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
                          Đã chốt sổ
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between pt-1">
                        <div className="text-base font-black text-gray-900 font-mono">
                          {formatVND(snap?.totalRevenue || 0)}
                        </div>
                        <div className="text-xs text-gray-500 font-bold flex items-center gap-1">
                          <span>{snap?.totalOrders || 0} đơn</span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>

                      {/* Mini Payment Breakdown Bar */}
                      <div className="flex items-center justify-between text-[10px] text-gray-500 font-bold pt-1 border-t border-gray-100">
                        <span>TM: <b className="text-amber-800">{formatVND(snap?.cashTotal || 0)}</b></span>
                        <span>QR: <b className="text-[#214E34]">{formatVND(snap?.qrTotal || 0)}</b></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* VIEW 2: DETAILED DAILY CLOSE REPORT FOR SELECTED DAY */
            <div className="space-y-3.5" id="printable-daily-close">
              {/* Hero Total Card */}
              <div className="clay-card bg-gradient-to-br from-[#214E34] via-[#265A3C] to-[#1E452E] text-white p-4 relative overflow-hidden space-y-2 shadow-lg">
                <div className="flex items-center justify-between text-xs text-emerald-200">
                  <span className="flex items-center gap-1.5 font-black uppercase tracking-wider text-[11px]">
                    <TrendingUp className="w-4 h-4 text-emerald-300 stroke-[2.5]" />
                    Tổng Doanh Thu Ngày
                  </span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black text-white">
                    {formatVietnamDisplayDate(selectedDate)}
                  </span>
                </div>

                <div className="text-3xl font-black tracking-tight text-white font-mono">
                  {formatVND(report?.totalRevenue || 0)}
                </div>

                <div className="flex items-center justify-between text-[11px] text-emerald-200/90 pt-2 border-t border-white/20 font-bold">
                  <span>{report?.totalOrders || 0} đơn hoàn tất</span>
                  <span>AOV: <b className="text-white font-black">{formatVND(report?.averageOrderValue || 0)}</b></span>
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="grid grid-cols-2 gap-2">
                <div className="clay-card p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-amber-900 font-extrabold">
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Tiền mặt</span>
                  </div>
                  <div className="font-black text-sm text-gray-900 font-mono">
                    {formatVND(report?.cashTotal || 0)}
                  </div>
                  <div className="text-[10px] text-gray-500 font-bold">
                    {report?.totalRevenue > 0
                      ? Math.round((report.cashTotal / report.totalRevenue) * 100)
                      : 0}% doanh thu
                  </div>
                </div>

                <div className="clay-card p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-[#214E34] font-extrabold">
                    <QrCode className="w-3.5 h-3.5" />
                    <span>VietQR</span>
                  </div>
                  <div className="font-black text-sm text-gray-900 font-mono">
                    {formatVND(report?.qrTotal || 0)}
                  </div>
                  <div className="text-[10px] text-gray-500 font-bold">
                    {report?.totalRevenue > 0
                      ? Math.round((report.qrTotal / report.totalRevenue) * 100)
                      : 0}% doanh thu
                  </div>
                </div>
              </div>

              {/* Discounts & Surcharges Audit */}
              <div className="clay-inset p-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10.5px] text-gray-500 font-bold">Tổng chiết khấu (Giảm giá):</span>
                  <p className="font-black text-rose-700 font-mono mt-0.5">
                    {formatVND(report?.totalDiscount || 0)}
                  </p>
                </div>
                <div>
                  <span className="text-[10.5px] text-gray-500 font-bold">Tổng phụ phí thu thêm:</span>
                  <p className="font-black text-emerald-800 font-mono mt-0.5">
                    {formatVND(report?.totalSurcharge || 0)}
                  </p>
                </div>
              </div>

              {/* Top 5 Best Selling Products */}
              <div className="clay-card p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>Top Món Bán Chạy Trong Ngày</span>
                  </h4>
                  <span className="text-[10px] text-gray-400 font-bold">Top 5</span>
                </div>

                {(!report?.topProducts || report.topProducts.length === 0) ? (
                  <p className="text-xs text-gray-400 text-center py-3">Không có dữ liệu món bán ra</p>
                ) : (
                  <div className="space-y-1.5">
                    {report.topProducts.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-none">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                            idx === 0
                              ? 'bg-amber-100 text-amber-800'
                              : idx === 1
                              ? 'bg-gray-200 text-gray-700'
                              : idx === 2
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-bold text-gray-800 truncate max-w-[170px] sm:max-w-[220px]">
                            {p.name}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-[#214E34] font-mono mr-2">
                            {p.quantity} ly
                          </span>
                          <span className="text-[11px] text-gray-400 font-mono">
                            {formatVND(p.revenue)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hourly Distribution */}
              {report?.hourlyDistribution && (
                <div className="clay-card p-3.5 space-y-2">
                  <h4 className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#214E34]" />
                    <span>Phân Bổ Doanh Thu Theo Khung Giờ</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(report.hourlyDistribution).map(([key, slot]) => (
                      <div key={key} className="clay-inset p-2 space-y-1">
                        <div className="text-[10px] font-bold text-gray-500 truncate">
                          {slot.label}
                        </div>
                        <div className="font-black text-xs text-gray-900 font-mono">
                          {formatVND(slot.revenue)}
                        </div>
                        <div className="text-[9.5px] text-emerald-700 font-bold">
                          {slot.count} đơn
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-semibold shrink-0">
          <span>GÓC • Phê & Trà POS</span>
          <span>Khổ in 57mm ESC/POS</span>
        </div>
      </div>
    </div>
  );
}
