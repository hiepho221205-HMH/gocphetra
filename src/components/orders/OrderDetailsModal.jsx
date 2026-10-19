import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePos } from '../../store/PosContext';
import {
  X,
  ArrowLeft,
  Receipt,
  Plus,
  Minus,
  Trash2,
  Banknote,
  PlusCircle,
  CheckCircle2,
  Clock,
  User,
  AlertTriangle
} from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { formatShortDate } from '../../utils/dateTime';

export default function OrderDetailsModal({
  isOpen,
  onClose,
  table,
  order,
  draftItems,
  onItemsChange,
  onAddMoreItems,
  onCheckout,
  onSave,
  onHistoricalPay
}) {
  const { saveOrderForTable, showToast } = usePos();

  // Local state of items to allow real-time editing (qty + / - or remove)
  const [items, setItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync items when modal opens or order/draftItems change
  useEffect(() => {
    if (isOpen) {
      if (draftItems && Array.isArray(draftItems)) {
        setItems(JSON.parse(JSON.stringify(draftItems)));
      } else if (order && order.items) {
        setItems(JSON.parse(JSON.stringify(order.items)));
      } else {
        setItems([]);
      }
      setIsSubmitting(false);
    }
  }, [isOpen, order, draftItems]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Calculations
  const totalItemCount = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity || 1), 0);
  }, [items]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.lineTotal || 0), 0);
  }, [items]);

  if (!isOpen || !table) return null;

  const isHistorical = order?.status === 'unpaid_carried_over';
  const currentOrderId = order?.id || table.activeOrderId || 'Đơn mới';
  const createdAtTime = order?.createdAt
    ? new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : 'Vừa xong';
  const cashierName = order?.cashier || 'Thu ngân';

  // Handle Update Quantity
  const handleUpdateQuantity = (cartItemId, delta) => {
    setItems((prev) => {
      const updated = prev
        .map((it) => {
          if (it.cartItemId === cartItemId) {
            const newQty = it.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...it,
              quantity: newQty,
              lineTotal: it.unitPrice * newQty
            };
          }
          return it;
        })
        .filter(Boolean);

      if (onItemsChange) {
        onItemsChange(updated);
      }
      return updated;
    });
  };

  // Handle Remove Item
  const handleRemoveItem = (cartItemId) => {
    setItems((prev) => {
      const updated = prev.filter((it) => it.cartItemId !== cartItemId);
      if (onItemsChange) {
        onItemsChange(updated);
      }
      return updated;
    });
    showToast('Đã xóa món khỏi đơn', 'info');
  };

  // 1. ACTION: THÊM MÓN
  const handleAddMoreItems = () => {
    if (onAddMoreItems) {
      onAddMoreItems(table, items);
    }
    onClose();
  };

  // 2. ACTION: LƯU ĐƠN
  const handleSaveOrder = () => {
    if (items.length === 0) {
      showToast('Đơn hàng chưa có món nào! Vui lòng chọn món trước khi lưu.', 'error');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (onSave) {
        onSave(table, items);
      } else {
        const res = saveOrderForTable(table.id, items);
        if (!res || !res.success) {
          showToast('Lưu đơn thất bại! Vui lòng thử lại.', 'error');
          setIsSubmitting(false);
          return;
        }
      }
      onClose();
    } catch (err) {
      console.error('Lỗi khi lưu đơn:', err);
      showToast('Có lỗi xảy ra khi lưu đơn!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. ACTION: THANH TOÁN (Lưu an toàn thay đổi chưa lưu trước khi mở modal thanh toán)
  const handleCheckout = () => {
    if (items.length === 0) {
      showToast('Đơn hàng chưa có món nào để thanh toán!', 'error');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Lưu an toàn thay đổi hiện tại trước
      const res = saveOrderForTable(table.id, items);
      if (!res || !res.success) {
        showToast('Không thể lưu thay đổi trước khi thanh toán!', 'error');
        setIsSubmitting(false);
        return;
      }

      // Đóng modal chi tiết đơn và mở modal thanh toán
      onClose();
      if (onCheckout) {
        onCheckout(res.table || table, res.order || order);
      }
    } catch (err) {
      console.error('Lỗi khi chuẩn bị thanh toán:', err);
      showToast('Có lỗi xảy ra trước khi mở thanh toán!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-details-title"
      className="fixed inset-0 z-[9200] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
    >
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-[420px] max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-stone-200 animate-slideUp">
        {/* ================= HEADER ================= */}
        <div className="px-4 py-3 bg-[#214E34] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="Quay lại"
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 id="order-details-title" className="font-extrabold text-sm leading-tight">
                  Chi tiết đơn • {table.name}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-white/20 text-white">
                  #{currentOrderId}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10.5px] text-emerald-200/90 mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {createdAtTime}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {cashierName}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chi tiết đơn"
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================= ITEMS LIST ================= */}
        <div className="p-3.5 space-y-2.5 overflow-y-auto no-scrollbar flex-1 divide-y divide-stone-100">
          {isHistorical && (
            <div className="mb-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-[11px] leading-tight">
                Đơn chưa thanh toán của ngày cũ ({formatShortDate(order?.businessDate || order?.createdAt?.substring(0, 10))}). Không thể thêm/bớt món.
              </span>
            </div>
          )}

          {items.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-xs flex flex-col items-center justify-center space-y-2">
              <Receipt className="w-8 h-8 text-stone-300" />
              <p>Chưa có món nào trong đơn hàng</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.cartItemId}
                className="pt-2.5 first:pt-0 flex items-start justify-between gap-2"
              >
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-baseline gap-1.5">
                    <h4 className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                      {item.name}
                    </h4>
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-100 text-[#214E34] shrink-0">
                      {item.sizeName || item.size}
                    </span>
                  </div>

                  {/* Toppings list */}
                  {item.toppings && item.toppings.length > 0 && (
                    <div className="text-[10.5px] text-stone-500 mt-0.5 flex flex-wrap gap-1">
                      {item.toppings.map((tp, idx) => (
                        <span key={idx} className="bg-stone-100 px-1.5 py-0.2 rounded text-[9.5px]">
                          +{tp.name} {tp.quantity > 1 ? `(x${tp.quantity})` : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Kitchen Notes */}
                  {item.notes && (
                    <div className="text-[10px] text-forest-700 italic mt-0.5">
                      📝 {item.notes}
                    </div>
                  )}

                  {/* Unit price */}
                  <div className="text-[11px] font-semibold text-stone-500 mt-0.5">
                    {formatVND(item.unitPrice)}
                  </div>
                </div>

                {/* Stepper & Line total */}
                <div className="flex flex-col items-end space-y-1.5 shrink-0">
                  <span className="font-black text-xs text-[#214E34]">
                    {formatVND(item.lineTotal)}
                  </span>

                  {isHistorical ? (
                    <span className="font-extrabold text-xs text-stone-700 px-2 py-0.5 bg-stone-100 rounded-md border border-stone-200">
                      x{item.quantity}
                    </span>
                  ) : (
                    <div className="flex items-center space-x-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                      {item.quantity === 1 ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.cartItemId)}
                          aria-label={`Xóa món ${item.name}`}
                          className="w-6 h-6 rounded-md bg-white text-rose-600 flex items-center justify-center hover:bg-rose-50 shadow-2xs transition-colors"
                          title="Xóa món"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.cartItemId, -1)}
                          aria-label={`Giảm số lượng ${item.name}`}
                          className="w-6 h-6 rounded-md bg-white text-stone-700 flex items-center justify-center hover:bg-stone-50 shadow-2xs transition-colors"
                          title="Giảm số lượng"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      )}

                      <span className="w-5 text-center font-extrabold text-xs text-stone-900">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.cartItemId, 1)}
                        aria-label={`Tăng số lượng ${item.name}`}
                        className="w-6 h-6 rounded-md bg-white text-stone-700 flex items-center justify-center hover:bg-stone-50 shadow-2xs transition-colors"
                        title="Tăng số lượng"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ================= SUMMARY & FOOTER ================= */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-stone-600">
              Tổng thanh toán ({totalItemCount} món):
            </span>
            <span className="text-base font-black text-[#214E34]">
              {formatVND(subtotal)}
            </span>
          </div>

          {isHistorical ? (
            /* FOOTER CHO ĐƠN LỊCH SỬ CHƯA THANH TOÁN: 2 NÚT (ĐÓNG & THU TIỀN) */
            <div className="flex items-center gap-2 w-full pt-0.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="touch-target min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 active:scale-97 transition-colors flex-1"
              >
                Đóng
              </button>

              <button
                type="button"
                disabled={isSubmitting || items.length === 0}
                onClick={() => {
                  onClose();
                  if (onHistoricalPay) onHistoricalPay(order);
                }}
                aria-label="Thu tiền đơn cũ"
                className="touch-target min-h-[44px] px-4 py-2 rounded-xl text-xs font-black text-white bg-[#009E78] hover:bg-[#008666] active:scale-97 shadow-md flex items-center justify-center gap-1.5 transition-all flex-2"
              >
                <Banknote className="w-4 h-4 shrink-0" />
                <span className="truncate">Thu tiền ({formatVND(subtotal)})</span>
              </button>
            </div>
          ) : (
            /* FOOTER ĐÚNG 3 NÚT DÀN ĐỀU HÀNG NGANG 3 CỘT (GRID 3 COLS) */
            <div className="grid grid-cols-3 gap-2 w-full pt-0.5">
              {/* Nút 1: Thanh toán */}
              <button
                type="button"
                disabled={isSubmitting || items.length === 0}
                onClick={handleCheckout}
                aria-label="Thanh toán hóa đơn bàn này"
                className="touch-target min-h-[44px] px-2 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-97 shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Banknote className="w-4 h-4 shrink-0" />
                <span className="truncate">Thanh toán</span>
              </button>

              {/* Nút 2: Thêm món */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleAddMoreItems}
                aria-label="Thêm món vào đơn của bàn"
                className="touch-target min-h-[44px] px-2 py-2 rounded-xl text-xs font-bold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 active:scale-97 shadow-2xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4 text-forest-800 shrink-0" />
                <span className="truncate">Thêm món</span>
              </button>

              {/* Nút 3: Lưu đơn */}
              <button
                type="button"
                disabled={isSubmitting || items.length === 0}
                onClick={handleSaveOrder}
                aria-label="Lưu đơn hàng và giữ trạng thái đang phục vụ"
                className="touch-target min-h-[44px] px-2 py-2 rounded-xl text-xs font-black text-white bg-[#214E34] hover:bg-[#1a3e29] active:scale-97 shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                <span className="truncate">Lưu đơn</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
