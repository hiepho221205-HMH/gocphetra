import React from 'react';
import { usePos } from '../../store/PosContext';
import { PlusCircle, TrendingUp, Users, Coffee, CheckCircle2 } from 'lucide-react';
import { formatVND, formatCompactVND } from '../../utils/currency';

export default function HeroDashboard({ onQuickCreateOrder }) {
  const { tables, orders, orderHistory } = usePos();

  // Tính toán số liệu thống kê
  const totalTables = tables.length;
  const occupiedTables = tables.filter((t) => t.status === 'occupied').length;
  const awaitingTables = tables.filter((t) => t.status === 'awaiting_payment').length;
  const emptyTables = totalTables - occupiedTables - awaitingTables;

  // Doanh thu ca: Các đơn đã hoàn thành + Các đơn đang phục vụ (tạm tính)
  const completedRevenue = orderHistory.reduce((sum, ord) => sum + (ord.total || 0), 0);
  const activeRevenue = Object.values(orders).reduce((sum, ord) => sum + (ord.total || 0), 0);
  const totalShiftRevenue = completedRevenue + activeRevenue;

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forest-800 via-forest-900 to-[#143321] text-white p-4 shadow-glass">
        {/* Background decorative glow */}
        <div className="absolute -right-8 -top-8 w-36 h-36 bg-forest-600/30 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -left-8 -bottom-8 w-28 h-28 bg-[#5E9D76]/20 rounded-full blur-xl pointer-events-none"></div>

        {/* Hero Slogan & Subtitle */}
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div className="max-w-[240px]">
              <span className="inline-block text-[11px] font-semibold tracking-wider text-[#A3D9B5] uppercase mb-1">
                POS VẬN HÀNH THÔNG MINH
              </span>
              <h2 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight leading-tight text-white">
                Quản lý GÓC, <br />
                <span className="text-[#8CBA9C]">đơn giản từng chạm</span>
              </h2>
            </div>

            {/* CTA Tạo đơn */}
            <button
              onClick={onQuickCreateOrder}
              className="touch-target btn-press px-3.5 py-2.5 bg-white text-forest-900 font-bold text-xs sm:text-sm rounded-xl shadow-md hover:bg-forest-50 transition-all flex items-center gap-1.5 flex-shrink-0 mt-1"
            >
              <PlusCircle className="w-4 h-4 text-forest-800" />
              <span>Tạo đơn</span>
            </button>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10">
            {/* Metric 1: Doanh thu ca */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/10">
              <div className="flex items-center gap-1 text-[11px] text-[#A3D9B5] mb-0.5">
                <TrendingUp className="w-3 h-3" />
                <span>Doanh thu ca</span>
              </div>
              <div className="font-bold text-sm sm:text-base tracking-tight text-white">
                {formatCompactVND(totalShiftRevenue)}
              </div>
            </div>

            {/* Metric 2: Bàn có khách */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/10">
              <div className="flex items-center gap-1 text-[11px] text-[#A3D9B5] mb-0.5">
                <Users className="w-3 h-3" />
                <span>Có khách</span>
              </div>
              <div className="font-bold text-sm sm:text-base tracking-tight text-white flex items-baseline gap-1">
                <span>{occupiedTables + awaitingTables}</span>
                <span className="text-[10px] text-white/70 font-normal">/{totalTables}</span>
              </div>
            </div>

            {/* Metric 3: Bàn trống */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/10">
              <div className="flex items-center gap-1 text-[11px] text-[#A3D9B5] mb-0.5">
                <Coffee className="w-3 h-3" />
                <span>Bàn trống</span>
              </div>
              <div className="font-bold text-sm sm:text-base tracking-tight text-emerald-300">
                {emptyTables} bàn
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
