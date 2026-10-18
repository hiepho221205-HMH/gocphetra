import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  Check
} from 'lucide-react';
import {
  getVietnamTodayString,
  addDaysToDateString,
  formatVietnamDisplayDate
} from '../../utils/dateTime';

export default function DatePickerModal({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate
}) {
  const todayStr = useMemo(() => getVietnamTodayString(), []);

  // Parsed initial year and month
  const [viewYear, setViewYear] = useState(() => {
    if (selectedDate) return Number(selectedDate.split('-')[0]);
    return Number(todayStr.split('-')[0]);
  });

  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) return Number(selectedDate.split('-')[1]) - 1;
    return Number(todayStr.split('-')[1]) - 1;
  });

  const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate || todayStr);

  // Sync state when opening
  useEffect(() => {
    if (isOpen) {
      const active = selectedDate || todayStr;
      setTempSelectedDate(active);
      const [y, m] = active.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [isOpen, selectedDate, todayStr]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Build calendar matrix (Monday as first day of week)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // 0 = Mon, 6 = Sun

  const daysArray = [];
  // Empty slots before 1st of month
  for (let i = 0; i < firstDayOfWeek; i++) {
    daysArray.push(null);
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(d);
  }

  const handlePickDate = (day) => {
    if (!day) return;
    const yStr = String(viewYear);
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const newDateStr = `${yStr}-${mStr}-${dStr}`;
    setTempSelectedDate(newDateStr);
  };

  const handleApply = (dateToApply = tempSelectedDate) => {
    onSelectDate(dateToApply);
    onClose();
  };

  // Quick preset handlers
  const handlePresetToday = () => {
    setTempSelectedDate(todayStr);
    const [y, m] = todayStr.split('-').map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    handleApply(todayStr);
  };

  const handlePresetYesterday = () => {
    const yestStr = addDaysToDateString(todayStr, -1);
    setTempSelectedDate(yestStr);
    const [y, m] = yestStr.split('-').map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    handleApply(yestStr);
  };

  const handlePreset7DaysAgo = () => {
    const pastStr = addDaysToDateString(todayStr, -7);
    setTempSelectedDate(pastStr);
    const [y, m] = pastStr.split('-').map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    handleApply(pastStr);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="date-picker-title"
      className="fixed inset-0 z-[9200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
    >
      <div className="bg-white rounded-3xl w-full max-w-[360px] flex flex-col shadow-2xl overflow-hidden border border-stone-200 animate-slideUp">
        {/* Header */}
        <div className="px-4 py-3 bg-[#214E34] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-300" />
            <h3 id="date-picker-title" className="font-extrabold text-sm leading-tight">
              Chọn ngày xem đơn
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chọn ngày"
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3.5 space-y-3 text-stone-800">
          {/* Quick presets */}
          <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={handlePresetToday}
              className={`py-1.5 px-2 rounded-xl border text-center transition-all ${
                tempSelectedDate === todayStr
                  ? 'bg-emerald-50 border-[#214E34] text-[#214E34]'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={handlePresetYesterday}
              className={`py-1.5 px-2 rounded-xl border text-center transition-all ${
                tempSelectedDate === addDaysToDateString(todayStr, -1)
                  ? 'bg-emerald-50 border-[#214E34] text-[#214E34]'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              Hôm qua
            </button>
            <button
              type="button"
              onClick={handlePreset7DaysAgo}
              className={`py-1.5 px-2 rounded-xl border text-center transition-all ${
                tempSelectedDate === addDaysToDateString(todayStr, -7)
                  ? 'bg-emerald-50 border-[#214E34] text-[#214E34]'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              7 ngày qua
            </button>
          </div>

          {/* Month selector bar */}
          <div className="flex items-center justify-between px-1 py-1 bg-stone-100 rounded-xl">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Tháng trước"
              className="w-7 h-7 rounded-lg hover:bg-white active:scale-95 flex items-center justify-center text-stone-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black text-stone-900 tracking-tight">
              Tháng {viewMonth + 1}, {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Tháng sau"
              className="w-7 h-7 rounded-lg hover:bg-white active:scale-95 flex items-center justify-center text-stone-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekdays row */}
          <div className="grid grid-cols-7 text-center text-[10.5px] font-bold text-stone-400">
            <span>T2</span>
            <span>T3</span>
            <span>T4</span>
            <span>T5</span>
            <span>T6</span>
            <span>T7</span>
            <span className="text-rose-500">CN</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {daysArray.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="h-8 w-8" />;
              }

              const yStr = String(viewYear);
              const mStr = String(viewMonth + 1).padStart(2, '0');
              const dStr = String(day).padStart(2, '0');
              const dateStr = `${yStr}-${mStr}-${dStr}`;

              const isSelected = tempSelectedDate === dateStr;
              const isToday = todayStr === dateStr;

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => handlePickDate(day)}
                  className={`h-8 w-8 mx-auto rounded-xl flex flex-col items-center justify-center font-bold transition-all relative ${
                    isSelected
                      ? 'bg-[#214E34] text-white shadow-xs scale-105'
                      : isToday
                      ? 'bg-emerald-50 text-[#214E34] border border-emerald-300 hover:bg-emerald-100'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <span>{day}</span>
                  {isToday && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-[#214E34] -mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Date Summary Tag */}
          <div className="p-2 rounded-xl bg-stone-50 border border-stone-200 text-center">
            <p className="text-[10px] text-stone-500 font-medium">Ngày đang chọn:</p>
            <p className="text-xs font-black text-[#214E34]">
              {formatVietnamDisplayDate(tempSelectedDate)}
            </p>
          </div>

          {/* Informational Guidance */}
          <div className="text-[10px] text-stone-500 bg-amber-50/70 p-2 rounded-xl border border-amber-200/80 leading-relaxed">
            💡 <b>Quy tắc xem đơn:</b> Ngày quá khứ chỉ xem hóa đơn đã hoàn tất. Ngày tương lai hiển thị <i>Chưa có dữ liệu</i>.
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-100 transition-colors min-h-[44px]"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => handleApply(tempSelectedDate)}
            className="flex-1 py-2 px-3 rounded-xl bg-[#214E34] text-white font-black text-xs hover:bg-[#1a3e29] shadow-md flex items-center justify-center gap-1.5 transition-all min-h-[44px]"
          >
            <Check className="w-4 h-4 text-emerald-300" />
            <span>Áp dụng</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
