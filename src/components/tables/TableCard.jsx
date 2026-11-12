import React, { useState, useRef, useEffect } from 'react';
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
  onViewOrderDetails,
  onHighlightTable
}) {
  const {
    orders,
    baristaHistory,
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

  // 3s Long-press detection state for empty tables
  const holdTimerRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasTriggeredHoldRef = useRef(false);
  const [isHolding, setIsHolding] = useState(false);

  // Cleanup hold timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const activeLock = isTableBillingLocked ? isTableBillingLocked(table) : null;
  const isLocked = Boolean(activeLock);
  const isLockedByOther = isLocked && activeLock.lockedById !== (currentUser?.id || currentUser?.uid);
  const activeOrder =
    (table.activeOrderId && orders[table.activeOrderId] && orders[table.activeOrderId].status !== 'completed' && orders[table.activeOrderId].status !== 'cancelled')
      ? orders[table.activeOrderId]
      : Object.values(orders).find(
          (o) => o.tableId === table.id && o.status === 'serving' && Array.isArray(o.items) && o.items.length > 0
        ) || null;

  // Logic đơn giản: Có order đang phục vụ và có món là có đơn, còn lại là "Trống"
  const isOccupied = Boolean(activeOrder && Array.isArray(activeOrder.items) && activeOrder.items.length > 0);
  const isBaristaDone = Boolean(
    isOccupied && (
      activeOrder?.baristaStatus === 'completed' ||
      (Array.isArray(baristaHistory) && baristaHistory.some((h) => h.id === activeOrder?.id))
    )
  );
  const itemCount = activeOrder?.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;
  const totalAmount = activeOrder?.total || 0;

  const resolvedTable = activeOrder
    ? { ...table, status: 'occupied', activeOrderId: activeOrder.id }
    : { ...table, status: 'empty', activeOrderId: null };

  // =========================================================================
  // 1.5S LONG-PRESS HANDLERS (CHỈ ÁP DỤNG CHO BÀN TRỐNG THEO QUY TẮC CẨN TRỌNG)
  // =========================================================================
  const handlePointerDown = (e) => {
    // Tuyệt đối không cho phép nhấn giữ trên bàn đang có khách hoặc đang tính tiền hoặc với Barista
    if (isOccupied || isLocked || currentRole === 'barista') return;

    // Chỉ bắt chuột trái (button === 0) hoặc touch
    if (e.button !== undefined && e.button !== 0) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startPosRef.current = { x: clientX, y: clientY };
    hasTriggeredHoldRef.current = false;
    setIsHolding(true);

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }

    holdTimerRef.current = setTimeout(() => {
      hasTriggeredHoldRef.current = true;
      setIsHolding(false);
      triggerHaptic('medium');
      onHighlightTable?.(resolvedTable);
    }, 1500); // Đủ 1.5 giây
  };

  const handlePointerUpOrCancel = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsHolding(false);
  };

  const handlePointerMove = (e) => {
    if (!isHolding) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = Math.abs(clientX - startPosRef.current.x);
    const dy = Math.abs(clientY - startPosRef.current.y);
    // Nếu người dùng cuộn trang hoặc di chuyển ngón tay > 10px thì hủy nhấn giữ
    if (dx > 10 || dy > 10) {
      handlePointerUpOrCancel();
    }
  };

  const handleCardClick = () => {
    // Nếu vừa kích hoạt long-press 3s thì không chạy sự kiện click thông thường
    if (hasTriggeredHoldRef.current) {
      hasTriggeredHoldRef.current = false;
      return;
    }
    triggerHaptic('light');
    if (isOccupied && onViewOrderDetails) {
      onViewOrderDetails(resolvedTable, activeOrder);
    } else {
      onOpenOrder(resolvedTable);
    }
  };

  const handleOrderClick = (e) => {
    e.stopPropagation();
    if (hasTriggeredHoldRef.current) {
      hasTriggeredHoldRef.current = false;
      return;
    }
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
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUpOrCancel}
        onPointerLeave={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onPointerMove={handlePointerMove}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUpOrCancel}
        onTouchCancel={handlePointerUpOrCancel}
        onTouchMove={handlePointerMove}
        data-table-id={table.id}
        data-testid={`table-card-${table.id}`}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
        transition={spring.press}
        className={`clay-card clay-card-interactive card-contain p-3.5 flex flex-col justify-between select-none cursor-pointer h-[152px] relative transition-transform duration-200 ${
          isHolding ? 'scale-[0.97] ring-2 ring-emerald-500/80 shadow-lg' : ''
        } ${
          isOccupied
            ? isBaristaDone
              ? 'border-blue-500/30 hover:border-blue-600/60 shadow-[0_14px_30px_-4px_rgba(59,130,246,0.18),inset_0_2px_2px_rgba(255,255,255,1)]'
              : 'border-emerald-500/30 hover:border-emerald-600/60 shadow-[0_14px_30px_-4px_rgba(16,185,129,0.18),inset_0_2px_2px_rgba(255,255,255,1)]'
            : 'hover:border-[#214E34]/30'
        }`}
      >
        {/* Phản hồi trực quan trong 1.5 giây nhấn giữ */}
        {isHolding && (
          <div className="absolute inset-0 rounded-[24px] pointer-events-none overflow-hidden z-20">
            <div className="absolute inset-0 bg-emerald-500/10 animate-pulse" />
            <div className="absolute inset-0 rounded-[24px] border-2 border-emerald-500 shadow-[inset_0_0_12px_rgba(16,185,129,0.35)]" />
          </div>
        )}

        {/* 1. Header thẻ: Tên bàn (Bàn 01, Bàn 02...) & Badge trạng thái 3D Clay */}
        <div className="flex items-center justify-between">
          <span className="font-black text-base text-[#214E34] tracking-tight leading-none">
            {table.name}
          </span>

          {/* Badge trạng thái chuẩn 3D Clay: TRỐNG, CÓ KHÁCH, ĐANG PHỤC VỤ hoặc ĐANG TÍNH TIỀN */}
          {isLocked ? (
            <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-500 text-white ring-2 ring-white shadow-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              ĐANG TÍNH TIỀN
            </span>
          ) : isOccupied ? (
            isBaristaDone ? (
              <span
                data-testid={`table-status-serving-${table.id}`}
                className="text-[9.5px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider clay-disc-blue ring-2 ring-white shadow-sm"
              >
                ĐANG PHỤC VỤ
              </span>
            ) : (
              <span
                data-testid={`table-status-occupied-${table.id}`}
                className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider clay-disc-green ring-2 ring-white shadow-sm"
              >
                CÓ KHÁCH
              </span>
            )
          ) : (
            <span
              data-testid={`table-status-empty-${table.id}`}
              className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider clay-inset text-gray-700 font-black border border-gray-200/80"
            >
              TRỐNG
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
          ) : currentRole === 'barista' ? (
            /* Barista View: Chỉ hiển thị nút Xem chi tiết món */
            <button
              type="button"
              onClick={handleEyeClick}
              className="touch-target w-full py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition-all"
            >
              <span>Xem chi tiết món</span>
            </button>
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
