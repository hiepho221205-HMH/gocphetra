import React from 'react';
import { usePos } from '../../store/PosContext';
import { Utensils, Receipt, Eye } from 'lucide-react';
import { formatVND } from '../../utils/currency';

export default function TableCard({
  table,
  onOpenOrder,
  onOpenBill
}) {
  const { orders } = usePos();
  const activeOrder =
    (table.activeOrderId && orders[table.activeOrderId]) ||
    (table.status === 'occupied' &&
      Object.values(orders).find(
        (o) => o.tableId === table.id && o.status !== 'completed' && o.status !== 'cancelled'
      )) ||
    null;

  // Logic đơn giản: Có order là "Có khách", chưa có là "Trống"
  const isOccupied = table.status === 'occupied' || Boolean(activeOrder && activeOrder.items && activeOrder.items.length > 0);
  const itemCount = activeOrder?.items?.reduce((sum, it) => sum + it.quantity, 0) || 0;
  const totalAmount = activeOrder?.total || 0;

  return (
    <div
      onClick={() => onOpenOrder(table)}
      className={`rounded-2xl p-3 border flex flex-col justify-between transition-all duration-smooth select-none cursor-pointer h-[138px] ${
        isOccupied
          ? 'bg-gradient-to-b from-[#F2F8F4] to-white border-emerald-600/30 shadow-xs hover:border-emerald-700/60'
          : 'bg-white border-gray-200/80 hover:border-forest-800/40 shadow-xs'
      }`}
    >
      {/* 1. Header thẻ: Tên bàn (Bàn 01, Bàn 02...) & Badge trạng thái */}
      <div className="flex items-center justify-between">
        <span className="font-black text-base text-forest-900 tracking-tight leading-none">
          {table.name}
        </span>

        {/* Badge trạng thái chuẩn: TRỐNG hoặc CÓ KHÁCH */}
        <span
          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
            isOccupied
              ? 'bg-[#E6F4EA] text-forest-800 border border-emerald-300'
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}
        >
          {isOccupied ? 'CÓ KHÁCH' : 'TRỐNG'}
        </span>
      </div>

      {/* 2. Dòng thông tin giữa: X món • Y đ (nếu có khách) hoặc Sẵn sàng phục vụ (nếu trống) */}
      <div className="text-xs my-auto py-1">
        {isOccupied ? (
          <div className="flex items-baseline space-x-1.5 font-bold text-forest-900">
            <span className="text-gray-600 text-[11.5px] font-semibold">{itemCount} món</span>
            <span className="text-gray-400 font-normal">•</span>
            <span className="text-sm font-extrabold text-forest-900">{formatVND(totalAmount)}</span>
          </div>
        ) : (
          <div className="text-gray-400 text-xs italic">
            Sẵn sàng phục vụ
          </div>
        )}
      </div>

      {/* 3. Hàng nút CTA cố định ở đáy thẻ */}
      <div className="pt-1.5 border-t border-gray-100/80">
        {!isOccupied ? (
          /* Bàn trống: 1 button lớn toàn chiều rộng "Gọi món" */
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenOrder(table);
            }}
            className="touch-target btn-press w-full py-2 px-3 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
          >
            <Utensils className="w-3.5 h-3.5 text-emerald-300" />
            <span>Gọi món</span>
          </button>
        ) : (
          /* Bàn có khách: 2 button ngang chia đều 50/50 */
          <div className="grid grid-cols-2 gap-1.5">
            {/* Nút "Xem đơn" (nền vàng nhạt) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenOrder(table);
              }}
              className="touch-target btn-press py-2 px-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-amber-700" />
              <span>Xem đơn</span>
            </button>

            {/* Nút "Thanh toán" (nền xanh #214E34) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenBill(table);
              }}
              className="touch-target btn-press py-2 px-2 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-2xs transition-colors"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-300" />
              <span>Thanh toán</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
