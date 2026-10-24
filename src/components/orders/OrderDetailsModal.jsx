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
import { triggerHaptic } from '../../utils/haptics';
import SaveOrderPrintPromptModal from '../ordering/SaveOrderPrintPromptModal';
import PreparationTicketTemplate from '../printing/PreparationTicketTemplate';
import {
  computeKitchenItemsDiff,
  buildKitchenTicketModel,
  mergeSentItems,
  DEFAULT_KITCHEN_TICKET_SETTINGS
} from '../../utils/kitchenTicketEngine';
import {
  executeKitchenTicketPrint
} from '../../utils/bluetoothPrinter';

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
  const { saveOrderForTable, recordKitchenTicketPrint, settings, currentUser, showToast } = usePos();

  // Local state of items to allow real-time editing (qty + / - or remove)
  const [items, setItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printPromptState, setPrintPromptState] = useState(null);
  const [activeKitchenTicketModel, setActiveKitchenTicketModel] = useState(null);

  // Sync items when modal opens or order/draftItems change
  useEffect(() => {
    if (isOpen) {
      const sourceItems = (draftItems && Array.isArray(draftItems))
        ? draftItems
        : (order && Array.isArray(order.items))
          ? order.items
          : [];
      const normalized = sourceItems.map((it, idx) => ({
        ...it,
        cartItemId: it.cartItemId || it.id || `item-${idx}-${it.name || 'dish'}`
      }));
      setItems(JSON.parse(JSON.stringify(normalized)));
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
    triggerHaptic('light');
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
    triggerHaptic('warning');
    setItems((prev) => {
      const updated = prev.filter((it) => it.cartItemId !== cartItemId);
      if (onItemsChange) {
        onItemsChange(updated);
      }
      return updated;
    });
  };

  // 1. ACTION: THÊM MÓN
  const handleAddMoreItems = () => {
    triggerHaptic('light');
    if (onAddMoreItems) {
      onAddMoreItems(table, items);
    }
    onClose();
  };

  // 2. ACTION: LƯU ĐƠN
  const handleSaveOrder = async () => {
    if (items.length === 0) {
      triggerHaptic('error');
      showToast('Đơn hàng chưa có món nào! Vui lòng chọn món trước khi lưu.', 'error');
      return;
    }

    if (isSubmitting) return;
    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      if (onSave) {
        await onSave(table, items);
      } else {
        const res = await saveOrderForTable(table.id, items);
        if (!res || !res.success) {
          triggerHaptic('error');
          showToast('Lưu đơn thất bại! Vui lòng thử lại.', 'error');
          setIsSubmitting(false);
          return;
        }

        const kitchenSettings = settings?.kitchenTicketSettings || DEFAULT_KITCHEN_TICKET_SETTINGS;
        if (kitchenSettings.enabled !== false) {
          const diffResult = computeKitchenItemsDiff(
            items,
            res.order?.kitchenSentItems || [],
            kitchenSettings.printMode || 'diff'
          );

          if (diffResult.hasChanges && kitchenSettings.promptOnSave !== false) {
            setPrintPromptState({
              isOpen: true,
              order: res.order,
              table: res.table || table,
              diffResult
            });
            setIsSubmitting(false);
            return;
          }
        }
      }
      triggerHaptic('success');
      onClose();
    } catch (err) {
      console.error('Lỗi khi lưu đơn:', err);
      triggerHaptic('error');
      showToast('Có lỗi xảy ra khi lưu đơn!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmKitchenPrint = async (options = {}) => {
    if (!printPromptState?.order) return;
    const { order: savedOrder, table: savedTable, diffResult } = printPromptState;
    const kitchenSettings = settings?.kitchenTicketSettings || DEFAULT_KITCHEN_TICKET_SETTINGS;

    const ticketModel = buildKitchenTicketModel({
      order: savedOrder,
      table: savedTable || table,
      diffItems: diffResult.diffItems,
      settings,
      currentUser,
      printMode: kitchenSettings.printMode || 'diff'
    });

    const newSentItems = mergeSentItems(savedOrder.kitchenSentItems, diffResult.diffItems);
    if (recordKitchenTicketPrint) {
      await recordKitchenTicketPrint(savedOrder.id, ticketModel, newSentItems);
    }

    const printResult = await executeKitchenTicketPrint({
      ticketModel,
      settings,
      method: options.method || 'bluetooth',
      showToast,
      onBrowserFallback: (model) => {
        setActiveKitchenTicketModel(model);
        setTimeout(() => {
          window.print();
        }, 150);
      }
    });

    if (printResult?.success) {
      setPrintPromptState(null);
      onClose();
    }
  };

  const handleDismissKitchenPrint = () => {
    setPrintPromptState(null);
    onClose();
  };

  // 3. ACTION: THANH TOÁN
  const handleCheckout = async () => {
    if (items.length === 0) {
      triggerHaptic('error');
      showToast('Đơn hàng chưa có món nào để thanh toán!', 'error');
      return;
    }

    if (isSubmitting) return;
    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      // Lưu an toàn thay đổi hiện tại trước
      const res = await saveOrderForTable(table.id, items);
      if (!res || !res.success) {
        triggerHaptic('error');
        showToast('Không thể lưu thay đổi trước khi thanh toán!', 'error');
        setIsSubmitting(false);
        return;
      }

      onClose();
      if (onCheckout) {
        onCheckout(res.table || table, res.order || order);
      }
    } catch (err) {
      console.error('Lỗi khi chuẩn bị thanh toán:', err);
      triggerHaptic('error');
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
      className="fixed inset-0 z-[9200] bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
    >
      <div className="clay-card rounded-b-none sm:rounded-b-[28px] w-full max-w-[420px] max-h-[88vh] flex flex-col p-0 overflow-hidden animate-slideUp">
        {/* ================= HEADER ================= */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#214E34] to-[#2E6744] text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              aria-label="Quay lại"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 id="order-details-title" className="font-black text-sm sm:text-base leading-tight">
                  Chi tiết đơn • {table.name}
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                  #{currentOrderId}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10.5px] text-emerald-200 mt-0.5 font-semibold">
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
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            aria-label="Đóng chi tiết đơn"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* ================= ITEMS LIST ================= */}
        <div className="p-4 space-y-3 overflow-y-auto no-scrollbar flex-1 divide-y divide-gray-100">
          {isHistorical && (
            <div className="mb-2 p-3 rounded-[16px] bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-[11px] leading-tight">
                Đơn chưa thanh toán của ngày cũ ({formatShortDate(order?.businessDate || order?.createdAt?.substring(0, 10))}). Không thể thêm/bớt món.
              </span>
            </div>
          )}

          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs flex flex-col items-center justify-center space-y-2">
              <Receipt className="w-10 h-10 text-gray-300 stroke-[1.5]" />
              <p className="font-bold">Chưa có món nào trong đơn hàng</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.cartItemId}
                className="pt-3 first:pt-0 flex items-start justify-between gap-2.5"
              >
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-baseline gap-1.5">
                    <h4 className="font-extrabold text-xs sm:text-sm text-gray-900 truncate">
                      {item.name}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#214E34] shrink-0">
                      {item.sizeName || item.size}
                    </span>
                  </div>

                  {/* Toppings list */}
                  {item.toppings && item.toppings.length > 0 && (
                    <div className="text-[10.5px] text-gray-500 mt-1 flex flex-wrap gap-1 font-semibold">
                      {item.toppings.map((tp, idx) => (
                        <span key={idx} className="bg-gray-100 px-2 py-0.5 rounded-full text-[9.5px]">
                          +{tp.name} {tp.quantity > 1 ? `(x${tp.quantity})` : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Kitchen Notes */}
                  {item.notes && (
                    <div className="text-[10px] text-emerald-800 italic mt-1 font-bold">
                      📝 {item.notes}
                    </div>
                  )}

                  {/* Unit price */}
                  <div className="text-[11px] font-bold text-gray-400 mt-1">
                    {formatVND(item.unitPrice)}
                  </div>
                </div>

                {/* Stepper & Line total */}
                <div className="flex flex-col items-end space-y-1.5 shrink-0">
                  <span className="font-black text-xs sm:text-sm text-[#214E34]">
                    {formatVND(item.lineTotal)}
                  </span>

                  {isHistorical ? (
                    <span className="font-extrabold text-xs text-gray-700 px-2.5 py-1 bg-gray-100 rounded-full border border-gray-200">
                      x{item.quantity}
                    </span>
                  ) : (
                    <div className="flex items-center space-x-1.5 clay-inset p-1">
                      {item.quantity === 1 ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.cartItemId)}
                          aria-label={`Xóa món ${item.name}`}
                          className="w-6 h-6 rounded-full bg-white text-rose-600 flex items-center justify-center shadow-xs active:scale-95 cursor-pointer"
                          title="Xóa món"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.cartItemId, -1)}
                          aria-label={`Giảm số lượng ${item.name}`}
                          className="w-6 h-6 rounded-full bg-white text-gray-700 flex items-center justify-center shadow-xs active:scale-95 cursor-pointer"
                          title="Giảm số lượng"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      )}

                      <span className="w-5 text-center font-black text-xs text-gray-900">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.cartItemId, 1)}
                        aria-label={`Tăng số lượng ${item.name}`}
                        className="w-6 h-6 rounded-full bg-white text-gray-700 flex items-center justify-center shadow-xs active:scale-95 cursor-pointer"
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
        <div className="p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 space-y-3 shrink-0">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-gray-500">
              Tổng thanh toán ({totalItemCount} món):
            </span>
            <span className="text-lg font-black text-[#214E34]">
              {formatVND(subtotal)}
            </span>
          </div>

          {isHistorical ? (
            /* FOOTER CHO ĐƠN LỊCH SỬ CHƯA THANH TOÁN: 2 NÚT (ĐÓNG & THU TIỀN) */
            <div className="flex items-center gap-2 w-full pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  triggerHaptic('light');
                  onClose();
                }}
                className="touch-target min-h-[44px] px-3 py-2 rounded-[16px] text-xs font-bold text-gray-700 clay-pill-btn flex-1 cursor-pointer"
              >
                Đóng
              </button>

              <button
                type="button"
                disabled={isSubmitting || items.length === 0}
                onClick={() => {
                  triggerHaptic('medium');
                  onClose();
                  if (onHistoricalPay) onHistoricalPay(order);
                }}
                aria-label="Thu tiền đơn cũ"
                className="touch-target min-h-[44px] px-4 py-2 rounded-[16px] text-xs font-black text-white clay-btn-primary flex items-center justify-center gap-1.5 flex-2 cursor-pointer"
              >
                <Banknote className="w-4 h-4 shrink-0" />
                <span className="truncate">Thu tiền ({formatVND(subtotal)})</span>
              </button>
            </div>
          ) : (
            /* FOOTER ĐÚNG 3 NÚT DÀN ĐỀU HÀNG NGANG 3 CỘT (GRID 3 COLS) */
            <div className="grid grid-cols-3 gap-2 w-full pt-1">
              {/* Nút 1: Thanh toán */}
              <button
                type="button"
                disabled={isSubmitting || items.length === 0}
                onClick={handleCheckout}
                aria-label="Thanh toán hóa đơn bàn này"
                className="touch-target min-h-[44px] px-2 py-2 rounded-[16px] text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
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
                className="touch-target min-h-[44px] px-2 py-2 rounded-[16px] text-xs font-bold text-gray-700 clay-pill-btn flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-[#214E34] shrink-0" />
                <span className="truncate">Thêm món</span>
              </button>

              {/* Nút 3: Lưu đơn */}
              <button
                type="button"
                disabled={isSubmitting || items.length === 0}
                onClick={handleSaveOrder}
                aria-label="Lưu đơn hàng và giữ trạng thái đang phục vụ"
                className="touch-target min-h-[44px] px-2 py-2 rounded-[16px] text-xs font-black text-white clay-btn-primary flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                <span className="truncate">Lưu đơn</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Save Order Kitchen Ticket Print Prompt */}
      {printPromptState?.isOpen && (
        <SaveOrderPrintPromptModal
          isOpen={printPromptState.isOpen}
          tableName={table?.name || printPromptState.order?.tableName}
          itemCount={printPromptState.diffResult?.totalDeltaCount || 0}
          onConfirmPrint={handleConfirmKitchenPrint}
          onDismiss={handleDismissKitchenPrint}
        />
      )}

      {/* Hidden Printable Preparation Ticket for Browser / Mobile System Print */}
      {activeKitchenTicketModel && (
        <div className="hidden print:block">
          <PreparationTicketTemplate ticketModel={activeKitchenTicketModel} />
        </div>
      )}
    </div>,
    document.body
  );
}
