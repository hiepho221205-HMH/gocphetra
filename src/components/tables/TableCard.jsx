import React from 'react';
import { usePos } from '../../store/PosContext';
import { Utensils, Receipt, Eye } from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { triggerHaptic } from '../../utils/haptics';

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

  const handleCardClick = () => {
    triggerHaptic('light');
    onOpenOrder(table);
  };

  const handleOrderClick = (e) => {
    e.stopPropagation();
    triggerHaptic('light');
    onOpenOrder(table);
  };

  const handleBillClick = (e) => {
    e.stopPropagation();
    triggerHaptic('medium');
    onOpenBill(table);
  };

  return (
    <div
      onClick={handleCardClick}
      data-table-id={table.id}
      data-testid={`table-card-${table.id}`}
      className={`clay-card clay-card-interactive p-3.5 flex flex-col justify-between select-none cursor-pointer h-[152px] ${
        isOccupied
          ? 'border-emerald-500/30 hover:border-emerald-600/60 shadow-[0_14px_30px_-4px_rgba(16,185,129,0.18),inset_0_2px_2px_rgba(255,255,255,1)]'
          : 'hover:border-[#214E34]/30'
      }`}
    >
      {/* 1. Header thẻ: Tên bàn (Bàn 01, Bàn 02...) & Badge trạng thái 3D Clay */}
      <div className="flex items-center justify-between">
        <span className="font-black text-base text-[#214E34] tracking-tight leading-none">
          {table.name}
        </span>

        {/* Badge trạng thái chuẩn 3D Clay: TRỐNG hoặc CÓ KHÁCH */}
        <span
          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider transition-all ${
            isOccupied
              ? 'clay-disc-green ring-2 ring-white shadow-sm'
              : 'clay-inset text-gray-500 border border-gray-200/60'
          }`}
        >
          {isOccupied ? 'CÓ KHÁCH' : 'TRỐNG'}
        </span>
      </div>

      {/* 2. Dòng thông tin giữa: X món • Y đ (nếu có khách) hoặc Sẵn sàng phục vụ (nếu trống) */}
      <div className="text-xs my-auto py-1">
        {isOccupied ? (
          <div className="flex items-baseline space-x-1.5 font-bold text-gray-900">
            <span className="text-gray-600 text-[11.5px] font-semibold">{itemCount} món</span>
            <span className="text-gray-400 font-normal">•</span>
            <span className="text-sm font-black text-[#214E34] tracking-tight">{formatVND(totalAmount)}</span>
          </div>
        ) : (
          <div className="text-gray-400 text-xs italic font-medium">
            Sẵn sàng phục vụ
          </div>
        )}
      </div>

      {/* 3. Hàng nút CTA cố định ở đáy thẻ */}
      <div className="pt-2 border-t border-gray-100">
        {!isOccupied ? (
          /* Bàn trống: 1 button lớn toàn chiều rộng "Gọi món" */
          <button
            type="button"
            onClick={handleOrderClick}
            className="touch-target clay-btn-primary w-full py-2.5 px-3 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Utensils className="w-3.5 h-3.5 text-emerald-300 stroke-[2.2]" />
            <span>Gọi món</span>
          </button>
        ) : (
          /* Bàn có khách: 2 button ngang chia đều 50/50 */
          <div className="grid grid-cols-2 gap-1.5">
            {/* Nút "Xem đơn" (nền vàng nhạt) */}
            <button
              type="button"
              onClick={handleOrderClick}
              className="touch-target py-2 px-2 bg-gradient-to-b from-amber-50 to-amber-100/80 hover:bg-amber-100 text-amber-900 border border-amber-200/90 rounded-[14px] font-black text-xs flex items-center justify-center gap-1 shadow-[0_4px_10px_rgba(245,158,11,0.15),inset_0_1px_1px_rgba(255,255,255,0.9)] active:scale-95 cursor-pointer transition-all"
            >
              <Eye className="w-3.5 h-3.5 text-amber-700 stroke-[2.2]" />
              <span>Xem đơn</span>
            </button>

            {/* Nút "Thanh toán" (nền xanh #214E34 3D) */}
            <button
              type="button"
              onClick={handleBillClick}
              className="touch-target clay-btn-primary py-2 px-2 text-white rounded-[14px] font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-300 stroke-[2.2]" />
              <span>Thanh toán</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
