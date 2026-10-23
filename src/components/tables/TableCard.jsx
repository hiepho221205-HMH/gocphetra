import React from 'react';
import { usePos } from '../../store/PosContext';
import { Utensils, Receipt } from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { triggerHaptic } from '../../utils/haptics';
import ViewOrderIconButton from '../common/ViewOrderIconButton';

export default function TableCard({
  table,
  onOpenOrder,
  onOpenBill,
  onViewOrderDetails
}) {
  const { orders, isTableBillingLocked, releaseBillingLock, currentUser, currentRole, showToast } = usePos();
  const activeLock = isTableBillingLocked ? isTableBillingLocked(table) : null;
  const isLocked = Boolean(activeLock);
  const isLockedByOther = isLocked && activeLock.lockedById !== (currentUser?.id || currentUser?.uid);
  const activeOrder =
    (table.activeOrderId && orders[table.activeOrderId] && orders[table.activeOrderId].status !== 'completed' && orders[table.activeOrderId].status !== 'cancelled')
      ? orders[table.activeOrderId]
      : Object.values(orders).find(
          (o) => o.tableId === table.id && o.status === 'serving' && Array.isArray(o.items) && o.items.length > 0
        ) || null;

  // Logic đơn giản: Có order đang phục vụ và có món là "Có khách", còn lại là "Trống"
  const isOccupied = Boolean(activeOrder && Array.isArray(activeOrder.items) && activeOrder.items.length > 0);
  const itemCount = activeOrder?.items?.reduce((sum, it) => sum + it.quantity, 0) || 0;
  const totalAmount = activeOrder?.total || 0;

  const resolvedTable = activeOrder
    ? { ...table, status: 'occupied', activeOrderId: activeOrder.id }
    : { ...table, status: 'empty', activeOrderId: null };

  const handleCardClick = () => {
    triggerHaptic('light');
    if (isOccupied && onViewOrderDetails) {
      onViewOrderDetails(resolvedTable, activeOrder);
    } else {
      onOpenOrder(resolvedTable);
    }
  };

  const handleOrderClick = (e) => {
    e.stopPropagation();
    triggerHaptic('light');
    onOpenOrder(resolvedTable);
  };

  const handleEyeClick = (e) => {
    e?.stopPropagation?.();
    triggerHaptic('light');
    if (onViewOrderDetails) {
      onViewOrderDetails(resolvedTable, activeOrder);
    } else {
      onOpenOrder(resolvedTable);
    }
  };

  const handleBillClick = (e) => {
    e.stopPropagation();
    triggerHaptic('medium');
    onOpenBill(resolvedTable);
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

        {/* Badge trạng thái chuẩn 3D Clay: TRỐNG, CÓ KHÁCH hoặc ĐANG TÍNH TIỀN */}
        {isLocked ? (
          <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-500 text-white ring-2 ring-white shadow-sm flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            ĐANG TÍNH TIỀN
          </span>
        ) : (
          <span
            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider transition-all ${
              isOccupied
                ? 'clay-disc-green ring-2 ring-white shadow-sm'
                : 'clay-inset text-gray-500 border border-gray-200/60'
            }`}
          >
            {isOccupied ? 'CÓ KHÁCH' : 'TRỐNG'}
          </span>
        )}
      </div>

      {/* 2. Dòng thông tin giữa: X món • Y đ (nếu có khách) hoặc Sẵn sàng phục vụ (nếu trống) hoặc Thông tin Khóa */}
      <div className="text-xs my-auto py-1">
        {isLocked ? (
          <div className="flex items-center justify-between text-xs font-bold text-amber-800 bg-amber-50/80 px-2 py-1 rounded-lg border border-amber-200/60">
            <span className="truncate max-w-[110px] text-[11px]">🔒 {activeLock.staffName}</span>
            {['admin', 'manager'].includes(currentRole) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  releaseBillingLock?.(table.id, true);
                }}
                className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 shadow-2xs cursor-pointer shrink-0"
              >
                Mở khóa
              </button>
            )}
          </div>
        ) : isOccupied ? (
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
          /* Bàn có khách: Icon Xem đơn gọn gàng + Nút Thanh toán flex-1 */
          <div className="flex items-center gap-1.5">
            {/* Nút icon "Xem đơn" (nền vàng kem #FFF3D6, icon xanh đậm #174D36) */}
            <ViewOrderIconButton
              onClick={handleEyeClick}
              size="md"
              variant="amber"
              title="Xem chi tiết đơn"
            />

            {/* Nút "Thanh toán" (nền xanh #214E34 3D hoặc amber nếu đang khóa) */}
            <button
              type="button"
              onClick={handleBillClick}
              className={`touch-target flex-1 py-2 px-2.5 text-white rounded-[14px] font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] ${
                isLockedByOther ? 'bg-amber-600 hover:bg-amber-700 shadow-md' : 'clay-btn-primary'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-300 stroke-[2.2]" />
              <span>{isLockedByOther ? 'Đang tính' : 'Thanh toán'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
