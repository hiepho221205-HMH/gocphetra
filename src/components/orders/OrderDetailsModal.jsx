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
  AlertTriangle,
  Printer,
  Loader2,
  ArrowRightLeft
} from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { formatShortDate } from '../../utils/dateTime';
import { triggerHaptic } from '../../utils/haptics';
import SaveOrderPrintPromptModal from '../ordering/SaveOrderPrintPromptModal';
import PreparationTicketTemplate from '../printing/PreparationTicketTemplate';
import {
  isSameOrderItem,
  computeKitchenItemsToPrint,
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
  onGoToOrder,
  onGoToBill,
  onSave,
  onHistoricalPay
}) {
  const {
    tables,
    orders,
    transferTable,
    saveOrderForTable,
    recordKitchenTicketPrint,
    settings,
    currentUser,
    showToast
  } = usePos();

  // Local state of items to allow real-time editing (qty + / - or remove)
  const [items, setItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printPromptState, setPrintPromptState] = useState(null);
  const [activeKitchenTicketModel, setActiveKitchenTicketModel] = useState(null);

  // Chuyển bàn state
  const [isTransferMode, setIsTransferMode] = useState(false);
  const [selectedTargetTableId, setSelectedTargetTableId] = useState('');

  // Danh sách bàn trống khả dụng để chuyển sang
  const emptyTables = useMemo(() => {
    return (tables || []).filter((t) => t.id !== table?.id && t.status === 'empty');
  }, [tables, table?.id]);

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
        productId: it.productId || it.id,
        cartItemId: it.cartItemId || it.id || `item-${idx}-${it.name || 'dish'}`,
        printed_quantity: Math.max(0, Number(it.printed_quantity) || 0)
      }));
      setItems(JSON.parse(JSON.stringify(normalized)));
      setIsSubmitting(false);
      setIsTransferMode(false);
      setSelectedTargetTableId('');
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

  // Handle ESC key to close or exit transfer mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (isTransferMode) {
          setIsTransferMode(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isTransferMode, onClose]);

  // Calculations
  const totalItemCount = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity || 1), 0);
  }, [items]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.lineTotal || 0), 0);
  }, [items]);

  if (!isOpen && !table) return null;

  const isHistorical = order?.status === 'unpaid_carried_over';
  const tableName = table?.name || 'Bàn';
  const currentOrderId = order?.id || table?.activeOrderId || 'Đơn mới';
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
              printed_quantity: Math.min(Math.max(0, Number(it.printed_quantity) || 0), newQty),
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
    onClose();
    if (onAddMoreItems) {
      onAddMoreItems(table);
    } else if (onGoToOrder && table) {
      onGoToOrder(table);
    }
  };

  // 2. ACTION: LƯU ĐƠN
  const handleSaveOrder = async () => {
    if (items.length === 0) {
      triggerHaptic('error');
      showToast('Đơn hàng chưa có món nào để lưu!', 'error');
      return;
    }

    if (isSubmitting) return;
    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      const res = await saveOrderForTable(table.id, items);
      if (!res || !res.success) {
        triggerHaptic('error');
        showToast('Không thể lưu đơn hàng. Vui lòng thử lại!', 'error');
        setIsSubmitting(false);
        return;
      }

      if (onSave) {
        onSave(res.table || table, res.order || order);
      }

      // Check if kitchen ticket prompt needed
      const itemsToPrint = computeKitchenItemsToPrint(items, order?.items || []);
      const unprintedCount = itemsToPrint.reduce((acc, it) => acc + (it.qtyToPrint || 0), 0);

      const kitchenConfig = settings?.storeConfig?.kitchenConfig || DEFAULT_KITCHEN_TICKET_SETTINGS;
      const shouldPrompt = kitchenConfig.autoPrintTicket !== false && unprintedCount > 0;

      if (shouldPrompt) {
        const isAdditional = (order?.items || []).some((it) => (Number(it.printed_quantity) || 0) > 0);
        setPrintPromptState({
          isOpen: true,
          tableId: table.id,
          orderId: res.order?.id || currentOrderId,
          order: res.order || order,
          itemsToPrint,
          totalQtyToPrint: unprintedCount,
          totalItemCount,
          isAdditionalOrder: isAdditional
        });
      } else {
        triggerHaptic('success');
        onClose();
      }
    } catch (err) {
      console.error('Lỗi khi lưu đơn:', err);
      triggerHaptic('error');
      showToast('Lỗi khi lưu đơn hàng!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Kitchen print prompt handlers
  const handleConfirmKitchenPrint = async () => {
    if (!printPromptState) return;
    const { order, itemsToPrint, isAdditionalOrder } = printPromptState;

    setPrintPromptState(null);
    setIsSubmitting(true);

    try {
      const kitchenConfig = settings?.storeConfig?.kitchenConfig || DEFAULT_KITCHEN_TICKET_SETTINGS;
      const model = buildKitchenTicketModel({
        order: { ...order, tableName },
        itemsToPrint,
        kitchenConfig,
        storeSettings: settings,
        currentUser,
        isAdditionalOrder
      });

      setActiveKitchenTicketModel(model);

      const printResult = await executeKitchenTicketPrint({
        ticketModel: model,
        kitchenConfig,
        onBrowserFallback: () => {
          setTimeout(() => {
            window.print();
          }, 150);
        }
      });

      if (printResult && printResult.success) {
        const updatedItems = mergeSentItems(items, itemsToPrint);
        await recordKitchenTicketPrint(table.id, updatedItems, model);

        setItems((prev) => {
          const updated = prev.map((it) => {
            const sent = itemsToPrint.find((p) => isSameOrderItem(p, it));
            if (sent) {
              const currentPrinted = Number(it.printed_quantity) || 0;
              return {
                ...it,
                printed_quantity: currentPrinted + (Number(sent.qtyToPrint) || 0)
              };
            }
            return it;
          });
          if (onItemsChange) onItemsChange(updated);
          return updated;
        });

        triggerHaptic('success');
        showToast('Đã gửi phiếu cho bếp thành công!', 'success');
      }
    } catch (err) {
      console.error('Lỗi khi gửi phiếu bếp:', err);
      triggerHaptic('error');
      showToast('Có lỗi xảy ra khi in phiếu bếp!', 'error');
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  const handleDismissKitchenPrint = () => {
    setPrintPromptState(null);
    onClose();
  };

  // 3. ACTION: IN PHIẾU BẾP (THỦ CÔNG TỪ POPUP)
  const handlePrintKitchenTicket = async () => {
    if (items.length === 0) {
      triggerHaptic('warning');
      showToast('Chưa có món nào để in cho bếp!', 'warning');
      return;
    }

    if (isSubmitting) return;
    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      const originalItems = (order && Array.isArray(order.items)) ? order.items : [];
      let itemsToPrint = computeKitchenItemsToPrint(items, originalItems);
      let isRePrintAll = false;

      // Fallback: Nếu không có món mới, cho phép in lại toàn bộ đơn
      if (itemsToPrint.length === 0) {
        isRePrintAll = true;
        itemsToPrint = items.map((it) => ({
          ...it,
          qtyToPrint: Number(it.quantity) || 1,
          isReprint: true
        }));
      }

      // Tự động lưu trước khi in
      const res = await saveOrderForTable(table.id, items);
      if (!res || !res.success) {
        triggerHaptic('error');
        showToast('Không thể lưu đơn trước khi gửi bếp!', 'error');
        setIsSubmitting(false);
        return;
      }

      const kitchenConfig = settings?.storeConfig?.kitchenConfig || DEFAULT_KITCHEN_TICKET_SETTINGS;
      const isAdditional = !isRePrintAll && (originalItems || []).some((it) => (Number(it.printed_quantity) || 0) > 0);

      const model = buildKitchenTicketModel({
        order: { ...res.order, tableName },
        itemsToPrint,
        kitchenConfig,
        storeSettings: settings,
        currentUser,
        isAdditionalOrder: isAdditional
      });

      if (isRePrintAll) {
        model.reprintNote = 'IN LẠI CHO BẾP';
      }

      setActiveKitchenTicketModel(model);

      const printResult = await executeKitchenTicketPrint({
        ticketModel: model,
        kitchenConfig,
        onBrowserFallback: () => {
          setTimeout(() => {
            window.print();
          }, 150);
        }
      });

      if (printResult && printResult.success) {
        if (!isRePrintAll) {
          const updatedItems = mergeSentItems(items, itemsToPrint);
          await recordKitchenTicketPrint(table.id, updatedItems, model);

          setItems((prev) => {
            const updated = prev.map((it) => {
              const sent = itemsToPrint.find((p) => isSameOrderItem(p, it));
              if (sent) {
                const currentPrinted = Number(it.printed_quantity) || 0;
                return {
                  ...it,
                  printed_quantity: currentPrinted + (Number(sent.qtyToPrint) || 0)
                };
              }
              return it;
            });
            if (onItemsChange) onItemsChange(updated);
            return updated;
          });
        } else {
          setItems((prev) => {
            const updated = prev.map((it) => ({
              ...it,
              printed_quantity: Number(it.quantity) || 0
            }));
            if (onItemsChange) onItemsChange(updated);
            return updated;
          });
        }

        triggerHaptic('success');
        showToast(
          isRePrintAll
            ? 'Đã gửi lệnh in lại toàn bộ đơn cho bếp!'
            : 'Đã gửi phiếu cho bếp thành công!',
          'success'
        );
      }
    } catch (err) {
      console.error('Lỗi khi gửi phiếu bếp:', err);
      triggerHaptic('error');
      showToast('Có lỗi xảy ra khi gửi phiếu cho bếp!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. ACTION: CHUYỂN BÀN (MỞ CHẾ ĐỘ CHUYỂN BÀN INLINE)
  const handleOpenTransferMode = async () => {
    triggerHaptic('light');

    // Tự động lưu các thay đổi của món/số lượng nếu có chỉnh sửa trước khi chuyển bàn
    const originalItems = (order && Array.isArray(order.items)) ? order.items : [];
    const isDirty = JSON.stringify(items.map((i) => ({ id: i.productId || i.id, qty: i.quantity }))) !==
                    JSON.stringify(originalItems.map((i) => ({ id: i.productId || i.id, qty: i.quantity })));

    if (isDirty && table?.id) {
      setIsSubmitting(true);
      try {
        await saveOrderForTable(table.id, items, {
          total: subtotal,
          itemCount: totalItemCount
        });
      } catch (err) {
        console.error('Lỗi tự động lưu đơn trước khi chuyển bàn:', err);
      } finally {
        setIsSubmitting(false);
      }
    }

    if (emptyTables.length > 0 && !selectedTargetTableId) {
      setSelectedTargetTableId(emptyTables[0].id);
    }
    setIsTransferMode(true);
  };

  // 5. ACTION: XÁC NHẬN CHUYỂN BÀN
  const handleConfirmTransfer = async () => {
    if (!selectedTargetTableId) {
      triggerHaptic('warning');
      showToast?.('Vui lòng chọn một bàn trống để chuyển đến!', 'warning');
      return;
    }
    const targetTable = (tables || []).find((t) => t.id === selectedTargetTableId);
    if (!targetTable) {
      triggerHaptic('error');
      showToast?.('Bàn đích không tồn tại!', 'error');
      return;
    }

    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      const success = transferTable(table.id, selectedTargetTableId);
      if (success) {
        triggerHaptic('success');
        showToast?.(`Đã chuyển đơn từ ${tableName} sang ${targetTable.name}!`, 'success');
        setIsTransferMode(false);
        onClose();
      }
    } catch (err) {
      console.error('Lỗi khi chuyển bàn:', err);
      triggerHaptic('error');
      showToast?.('Không thể chuyển bàn. Vui lòng thử lại!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fallback handler nếu có caller dùng onCheckout
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
      } else if (onGoToBill && table) {
        onGoToBill(table);
      }
    } catch (err) {
      console.error('Lỗi khi chuẩn bị thanh toán:', err);
      triggerHaptic('error');
      showToast('Có lỗi xảy ra trước khi mở thanh toán!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {isOpen && table && !printPromptState?.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-details-title"
          className="fixed inset-0 z-[9200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none"
        >
          <div
            className="clay-card rounded-[28px] w-full max-w-[420px] max-h-[88vh] flex flex-col p-0 overflow-hidden shadow-2xl bg-white"
          >
            {/* ================= HEADER ================= */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#214E34] to-[#2E6744] text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    if (isTransferMode) {
                      setIsTransferMode(false);
                    } else {
                      onClose();
                    }
                  }}
                  aria-label="Quay lại"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                </button>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 id="order-details-title" className="font-black text-sm sm:text-base leading-tight">
                      {isTransferMode ? `Chuyển bàn • ${tableName}` : `Chi tiết đơn • ${tableName}`}
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                      #{currentOrderId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10.5px] text-emerald-200 mt-0.5 font-semibold">
                    {isTransferMode ? (
                      <span className="text-white/90">Chọn bàn trống đích bên dưới</span>
                    ) : (
                      <>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {createdAtTime}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {cashierName}
                        </span>
                      </>
                    )}
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
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* ================= MODAL BODY ================= */}
            {isTransferMode ? (
              /* --- CHẾ ĐỘ CHUYỂN BÀN (INLINE VIEW) --- */
              <div className="p-4 space-y-3.5 flex-1 overflow-y-auto no-scrollbar">
                <div className="p-3 bg-blue-50/90 border border-blue-200/80 rounded-[18px] text-xs text-blue-900 leading-relaxed font-medium">
                  <div className="font-extrabold text-blue-950 flex items-center gap-1.5 mb-1">
                    <ArrowRightLeft className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>Chuyển đơn từ {tableName}</span>
                  </div>
                  Toàn bộ đơn hàng hiện tại <b>#{currentOrderId}</b> ({totalItemCount} món - {formatVND(subtotal)}) sẽ được chuyển sang bàn trống mới.
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 px-1 block">
                    Chọn bàn trống đích ({emptyTables.length} bàn khả dụng):
                  </label>

                  {emptyTables.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                      {emptyTables.map((t) => {
                        const isSelected = selectedTargetTableId === t.id;
                        return (
                          <div
                            key={t.id}
                            onClick={() => {
                              triggerHaptic('light');
                              setSelectedTargetTableId(t.id);
                            }}
                            className={`flex items-center justify-between p-3.5 rounded-[18px] border-2 cursor-pointer transition-all active:scale-[0.99] ${
                              isSelected
                                ? 'bg-emerald-50/90 border-emerald-600 text-[#214E34] font-black shadow-sm'
                                : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700 font-semibold'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white'
                              }`}>
                                {isSelected && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                              </div>
                              <div>
                                <span className="text-xs sm:text-sm font-bold block">{t.name}</span>
                                <span className="text-[10px] text-gray-500 font-medium">
                                  {t.area || 'Khu vực chính'}
                                </span>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {t.capacity || 4} chỗ
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-amber-800 bg-amber-50 rounded-[18px] border border-amber-200 font-semibold space-y-1">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto" />
                      <p className="font-bold">Hiện không còn bàn trống nào trong quán!</p>
                      <p className="text-[11px] text-amber-700">Tất cả các bàn khác đều đang có khách hoặc chờ dọn.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* --- CHẾ ĐỘ DANH SÁCH MÓN ĂN --- */
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
                          {(() => {
                            const qty = Number(item.quantity) || 0;
                            const printedQty = Number(item.printed_quantity) || 0;
                            if (printedQty >= qty && qty > 0) {
                              return (
                                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                                  Đã gửi bếp
                                </span>
                              );
                            }
                            if (printedQty > 0 && qty > printedQty) {
                              return (
                                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 shrink-0">
                                  +{qty - printedQty} món mới
                                </span>
                              );
                            }
                            return (
                              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 shrink-0">
                                Món mới
                              </span>
                            );
                          })()}
                        </div>

                        {/* Toppings string or list */}
                        {item.toppings && item.toppings.length > 0 && (
                          <p className="text-[11px] text-gray-500 mt-0.5 truncate font-medium">
                            + {item.toppings.map((t) => (typeof t === 'string' ? t : t.name)).join(', ')}
                          </p>
                        )}

                        {/* Customer note */}
                        {item.note && (
                          <p className="text-[10.5px] text-amber-700 italic mt-0.5 truncate font-medium">
                            &quot;{item.note}&quot;
                          </p>
                        )}

                        <div className="text-[11.5px] font-bold text-gray-600 mt-1">
                          {formatVND(item.lineTotal || (item.unitPrice * item.quantity))}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      {!isHistorical && (
                        <div className="flex items-center gap-1.5 bg-[#F4F6F4] p-1 rounded-full shrink-0 border border-gray-200/60">
                          {item.quantity === 1 ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.cartItemId)}
                              className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors shadow-xs active:scale-95 cursor-pointer"
                              title="Xóa món"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.cartItemId, -1)}
                              className="w-6 h-6 rounded-full bg-white text-gray-700 flex items-center justify-center shadow-xs active:scale-95 cursor-pointer"
                              title="Giảm số lượng"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          )}

                          <span className="text-xs font-black w-4 text-center text-gray-800">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.cartItemId, 1)}
                            className="w-6 h-6 rounded-full bg-white text-gray-700 flex items-center justify-center shadow-xs active:scale-95 cursor-pointer"
                            title="Tăng số lượng"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ================= SUMMARY & FOOTER ================= */}
            <div className="p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 space-y-3 shrink-0">
              {!isTransferMode && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-gray-500">
                    Tổng thanh toán ({totalItemCount} món):
                  </span>
                  <span className="text-lg font-black text-[#214E34]">
                    {formatVND(subtotal)}
                  </span>
                </div>
              )}

              {isTransferMode ? (
                /* FOOTER CHẾ ĐỘ CHUYỂN BÀN: [QUAY LẠI] & [XÁC NHẬN CHUYỂN] */
                <div className="grid grid-cols-2 gap-2 w-full pt-1">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      triggerHaptic('light');
                      setIsTransferMode(false);
                    }}
                    className="touch-target min-h-[44px] px-3 py-2 rounded-[16px] text-xs font-bold text-gray-700 clay-pill-btn flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Quay lại</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting || !selectedTargetTableId || emptyTables.length === 0}
                    onClick={handleConfirmTransfer}
                    aria-label="Xác nhận chuyển bàn"
                    className="touch-target min-h-[44px] px-3 py-2 rounded-[16px] text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang chuyển...</span>
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="w-4 h-4" />
                        <span>Xác nhận chuyển</span>
                      </>
                    )}
                  </button>
                </div>
              ) : isHistorical ? (
                /* FOOTER CHO ĐƠN LỊCH SỬ CHƯA THANH TOÁN: 2 NÚT (ĐÓNG & THU TIỀN) */
                <div className="flex items-center gap-2 w-full pt-1">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      triggerHaptic('light');
                      onClose();
                    }}
                    className="touch-target min-h-[44px] px-3 py-2 rounded-[16px] text-xs font-bold text-gray-700 clay-pill-btn flex-1 cursor-pointer active:scale-[0.98]"
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
                    className="touch-target min-h-[44px] px-4 py-2 rounded-[16px] text-xs font-black text-white clay-btn-primary flex items-center justify-center gap-1.5 flex-2 cursor-pointer active:scale-[0.98]"
                  >
                    <Banknote className="w-4 h-4 shrink-0" />
                    <span className="truncate">Thu tiền ({formatVND(subtotal)})</span>
                  </button>
                </div>
              ) : (
                /* FOOTER 2 HÀNG: HÀNG 1 [IN PHIẾU BẾP] [THÊM MÓN] - HÀNG 2 [CHUYỂN BÀN] [LƯU ĐƠN] */
                <div className="space-y-2 w-full pt-1">
                  {/* Hàng 1: In phiếu bếp & Thêm món */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Nút 1: In phiếu bếp */}
                    <button
                      type="button"
                      disabled={isSubmitting || items.length === 0}
                      onClick={handlePrintKitchenTicket}
                      aria-label="In phiếu chế biến cho bếp"
                      className="touch-target min-h-[44px] px-3 py-2 rounded-[16px] text-xs font-black text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                          <span className="truncate">Đang in...</span>
                        </>
                      ) : (
                        <>
                          <Printer className="w-4 h-4 shrink-0" />
                          <span className="truncate">In phiếu bếp</span>
                        </>
                      )}
                    </button>

                    {/* Nút 2: Thêm món */}
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleAddMoreItems}
                      aria-label="Thêm món vào đơn của bàn"
                      className="touch-target min-h-[44px] px-3 py-2 rounded-[16px] text-xs font-bold text-gray-700 clay-pill-btn flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                    >
                      <PlusCircle className="w-4 h-4 text-[#214E34] shrink-0" />
                      <span className="truncate">Thêm món</span>
                    </button>
                  </div>

                  {/* Hàng 2: Chuyển bàn & Lưu đơn */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Nút 3: Chuyển bàn (Thay thế nút Thanh toán theo yêu cầu) */}
                    <button
                      type="button"
                      disabled={isSubmitting || items.length === 0}
                      onClick={handleOpenTransferMode}
                      aria-label="Chuyển đơn sang bàn trống khác"
                      className="touch-target min-h-[44px] px-3 py-2 rounded-[16px] text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
                    >
                      <ArrowRightLeft className="w-4 h-4 shrink-0" />
                      <span className="truncate">Chuyển bàn</span>
                    </button>

                    {/* Nút 4: Lưu đơn */}
                    <button
                      type="button"
                      disabled={isSubmitting || items.length === 0}
                      onClick={handleSaveOrder}
                      aria-label="Lưu đơn hàng và giữ trạng thái đang phục vụ"
                      className="touch-target min-h-[44px] px-3 py-2 rounded-[16px] text-xs font-black text-white clay-btn-primary flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                      <span className="truncate">Lưu đơn</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Order Kitchen Ticket Print Prompt */}
      {printPromptState?.isOpen && (
        <SaveOrderPrintPromptModal
          isOpen={printPromptState.isOpen}
          tableName={table?.name || printPromptState.order?.tableName}
          itemCount={printPromptState.totalQtyToPrint || 0}
          totalItemCount={printPromptState.totalItemCount || 0}
          isAdditional={Boolean(printPromptState.isAdditionalOrder)}
          onConfirmPrint={handleConfirmKitchenPrint}
          onDismiss={handleDismissKitchenPrint}
        />
      )}

      {/* Hidden Thermal Ticket Engine Canvas (For ESC/POS generation) */}
      {activeKitchenTicketModel && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none' }}>
          <PreparationTicketTemplate
            model={activeKitchenTicketModel}
            onRenderComplete={() => {}}
          />
        </div>
      )}
    </>,
    document.body
  );
}
