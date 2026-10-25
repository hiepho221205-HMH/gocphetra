import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import { Utensils, Receipt, Trash2 } from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { triggerHaptic } from '../../utils/haptics';
import ViewOrderIconButton from '../common/ViewOrderIconButton';
import DeleteActiveOrderModal from './DeleteActiveOrderModal';
import { motion, useReducedMotion, useMotionTokens } from '../../lib/animateUi';

const TableCard = React.memo(function TableCard({
  table,
  onOpenOrder,
  onOpenBill,
  onViewOrderDetails
}) {
  const {
    orders,
    isTableBillingLocked,
    releaseBillingLock,
    currentUser,
    currentRole,
    showToast,
    deleteActiveOrderForTable
  } = usePos();

  const { spring } = useMotionTokens();
  const shouldReduceMotion = useReducedMotion();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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
  const itemCount = activeOrder?.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;
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

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    triggerHaptic('light');
    if (isLockedByOther) {
      showToast(
        `Bàn đang được ${activeLock.staffName || 'thu ngân khác'} mở thanh toán, không thể xóa!`,
        'warning'
      );
      return;
    }
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteActiveOrderForTable) {
      await deleteActiveOrderForTable(table.id);
    }
  };

  return (
    <>
      <motion.div
        onClick={handleCardClick}
        data-table-id={table.id}
        data-testid={`table-card-${table.id}`}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
        transition={spring.press}
        className={`clay-card clay-card-interactive card-contain p-3.5 flex flex-col justify-between select-none cursor-pointer h-[152px] ${
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
                  : 'clay-inset text-gray-700 font-black border border-gray-200/80'
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
            <div className="text-gray-600 text-xs italic font-medium">
              Sẵn sàng phục vụ
            </div>
          )}
        </div>

        {/* 3. Hàng nút CTA cố định ở đáy thẻ */}
        <div className="pt-2 border-t border-gray-100">
          {!isOccupied ? (
            /* Bàn trống: 1 button lớn toàn chiều rộng "Gọi món" */
            <motion.button
              type="button"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
              transition={spring.press}
              onClick={handleOrderClick}
              className="touch-target clay-btn-primary w-full py-2.5 px-3 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Utensils className="w-3.5 h-3.5 text-emerald-300 stroke-[2.2]" />
              <span>Gọi món</span>
            </motion.button>
          ) : (
            /* Bàn có khách: Bộ 3 nút icon phân bổ cân đối [Xem đơn] [Thanh toán] [Xóa đơn] */
            <div className="grid grid-cols-3 gap-1.5">
              {/* Nút icon "Xem đơn" (nền vàng kem #FFF3D6, icon xanh đậm #174D36) */}
              <ViewOrderIconButton
                onClick={handleEyeClick}
                size="md"
                variant="amber"
                className="!w-full min-w-0"
                title="Xem chi tiết đơn"
                ariaLabel="Xem chi tiết đơn"
              />

              {/* Nút icon "Thanh toán" (nền xanh #214E34 3D hoặc amber nếu đang khóa) */}
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                transition={spring.press}
                onClick={handleBillClick}
                data-testid={`bill-btn-${table.id}`}
                title={isLockedByOther ? 'Bàn đang tính tiền' : 'Thanh toán & Lên hóa đơn'}
                aria-label="Thanh toán"
                className={`touch-target w-full h-10 min-h-[40px] rounded-[14px] text-white font-black text-xs flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-sm ${
                  isLockedByOther ? 'bg-amber-600 hover:bg-amber-700 shadow-md' : 'clay-btn-primary'
                }`}
              >
                <Receipt className="w-4 h-4 text-emerald-300 stroke-[2.2]" />
              </motion.button>

              {/* Nút icon "Xóa bàn / Xóa đơn" (nền đỏ nhạt, viền đỏ, icon thùng rác cảnh báo) */}
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                transition={spring.press}
                onClick={handleDeleteClick}
                data-testid={`delete-order-btn-${table.id}`}
                title="Xóa đơn & Giải phóng bàn"
                aria-label="Xóa đơn & Giải phóng bàn"
                className="touch-target w-full h-10 min-h-[40px] rounded-[14px] bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/90 shadow-2xs flex items-center justify-center cursor-pointer transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4 text-rose-600 stroke-[2]" />
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Modal xác nhận xóa đơn bàn đã order */}
      <DeleteActiveOrderModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        table={table}
        order={activeOrder}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
});

export default TableCard;
