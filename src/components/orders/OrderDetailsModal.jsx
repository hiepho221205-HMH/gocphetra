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
  ArrowRightLeft,
  Check
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

  // Kitchen Print Selection Modal state
  const [isKitchenPrintModalOpen, setIsKitchenPrintModalOpen] = useState(false);
  const [printSelectionMap, setPrintSelectionMap] = useState({});

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
      setIsKitchenPrintModalOpen(false);
      setPrintSelectionMap({});
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

  // Handle ESC key to close or exit active modes
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (isKitchenPrintModalOpen) {
          setIsKitchenPrintModalOpen(false);
        } else if (isTransferMode) {
          setIsTransferMode(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isKitchenPrintModalOpen, isTransferMode, onClose]);

  // Calculations
  const totalItemCount = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity || 1), 0);
  }, [items]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.lineTotal || 0), 0);
  }, [items]);

  // Thống kê số lượng món và phần đang được chọn để in (Đảm bảo gọi Hook vô điều kiện tại top-level)
  const printSelectionStats = useMemo(() => {
    let selectedItemCount = 0;
    let totalQtyToPrint = 0;
    let unsentItemCount = 0;

    (items || []).forEach((item) => {
      const qty = Number(item.quantity) || 1;
      const printedQty = Number(item.printed_quantity) || 0;
      if (qty > printedQty) {
        unsentItemCount++;
      }

      const sel = printSelectionMap?.[item.cartItemId];
      if (sel?.selected) {
        selectedItemCount++;
        totalQtyToPrint += (Number(sel.qtyToPrint) || 0);
      }
    });

    return {
      selectedItemCount,
      totalQtyToPrint,
      unsentItemCount,
      totalItemCount: (items || []).length
    };
  }, [items, printSelectionMap]);

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

  // =========================================================================
  // 3. ACTION: IN PHIẾU BẾP (CHỌN MÓN HOẶC IN TOÀN BỘ)
  // =========================================================================

  // Mở Popup chọn món để in
  const handleOpenKitchenPrintModal = () => {
    if (items.length === 0) {
      triggerHaptic('warning');
      showToast('Chưa có món nào để in cho bếp!', 'warning');
      return;
    }
    triggerHaptic('light');

    // Khởi tạo lựa chọn: Mặc định chọn các món mới chưa gửi bếp
    const initialMap = {};
    let hasUnsent = false;

    items.forEach((item) => {
      const qty = Number(item.quantity) || 1;
      const printedQty = Number(item.printed_quantity) || 0;
      const unprintedQty = Math.max(0, qty - printedQty);

      if (unprintedQty > 0) {
        hasUnsent = true;
        initialMap[item.cartItemId] = {
          selected: true,
          qtyToPrint: unprintedQty
        };
      } else {
        initialMap[item.cartItemId] = {
          selected: false,
          qtyToPrint: qty
        };
      }
    });

    // Nếu tất cả các món đều đã được gửi in trước đó -> Mặc định chọn tất cả để in lại
    if (!hasUnsent) {
      items.forEach((item) => {
        initialMap[item.cartItemId] = {
          selected: true,
          qtyToPrint: Number(item.quantity) || 1
        };
      });
    }

    setPrintSelectionMap(initialMap);
    setIsKitchenPrintModalOpen(true);
  };

  // Entrypoint tương thích với các button / trigger in phiếu bếp
  const handlePrintKitchenTicket = () => {
    handleOpenKitchenPrintModal();
  };

  // Bộ lọc nhanh: Chỉ chọn món mới chưa gửi
  const handleSelectOnlyUnsent = () => {
    triggerHaptic('light');
    const newMap = {};
    items.forEach((item) => {
      const qty = Number(item.quantity) || 1;
      const printedQty = Number(item.printed_quantity) || 0;
      const unprintedQty = Math.max(0, qty - printedQty);
      if (unprintedQty > 0) {
        newMap[item.cartItemId] = { selected: true, qtyToPrint: unprintedQty };
      } else {
        newMap[item.cartItemId] = { selected: false, qtyToPrint: qty };
      }
    });
    setPrintSelectionMap(newMap);
  };

  // Bộ lọc nhanh: Chọn tất cả các món trong bàn
  const handleSelectAllForPrint = () => {
    triggerHaptic('light');
    const newMap = {};
    items.forEach((item) => {
      newMap[item.cartItemId] = {
        selected: true,
        qtyToPrint: Number(item.quantity) || 1
      };
    });
    setPrintSelectionMap(newMap);
  };

  // Bộ lọc nhanh: Bỏ chọn tất cả
  const handleDeselectAllForPrint = () => {
    triggerHaptic('light');
    const newMap = {};
    items.forEach((item) => {
      newMap[item.cartItemId] = {
        selected: false,
        qtyToPrint: printSelectionMap[item.cartItemId]?.qtyToPrint || Number(item.quantity) || 1
      };
    });
    setPrintSelectionMap(newMap);
  };

  // Bật/tắt chọn 1 món để in
  const handleToggleItemSelection = (cartItemId) => {
    triggerHaptic('light');
    setPrintSelectionMap((prev) => {
      const current = prev[cartItemId];
      const item = items.find((i) => i.cartItemId === cartItemId);
      const defaultQty = item ? Number(item.quantity) || 1 : 1;
      return {
        ...prev,
        [cartItemId]: {
          selected: !current?.selected,
          qtyToPrint: current?.qtyToPrint || defaultQty
        }
      };
    });
  };

  // Điều chỉnh số lượng in của từng món (+ / -)
  const handleStepPrintQty = (cartItemId, delta) => {
    triggerHaptic('light');
    setPrintSelectionMap((prev) => {
      const current = prev[cartItemId];
      const item = items.find((i) => i.cartItemId === cartItemId);
      const maxQty = item ? Number(item.quantity) || 1 : 1;
      const currentQty = current?.qtyToPrint || 1;
      const nextQty = Math.min(maxQty, Math.max(1, currentQty + delta));
      return {
        ...prev,
        [cartItemId]: {
          selected: true,
          qtyToPrint: nextQty
        }
      };
    });
  };

  // Gửi lệnh in phiếu chế biến bếp (Hỗ trợ in toàn bộ hoặc in các món đã chọn)
  const handleExecuteKitchenPrint = async ({ isAll = false }) => {
    if (items.length === 0) {
      triggerHaptic('warning');
      showToast('Chưa có món nào để in cho bếp!', 'warning');
      return;
    }

    if (isSubmitting) return;

    let itemsToPrint = [];
    let isRePrintAll = false;

    if (isAll) {
      // In toàn bộ: Lấy tất cả các món trong bàn với đúng số lượng của từng món
      itemsToPrint = items.map((it) => ({
        ...it,
        qtyToPrint: Number(it.quantity) || 1
      }));
      const allPreviouslySent = items.every((it) => (Number(it.printed_quantity) || 0) >= (Number(it.quantity) || 1));
      if (allPreviouslySent) {
        isRePrintAll = true;
      }
    } else {
      // In các món đã chọn
      itemsToPrint = items
        .filter((it) => printSelectionMap[it.cartItemId]?.selected)
        .map((it) => ({
          ...it,
          qtyToPrint: Number(printSelectionMap[it.cartItemId]?.qtyToPrint) || 1
        }));

      if (itemsToPrint.length === 0) {
        triggerHaptic('warning');
        showToast('Vui lòng chọn ít nhất 1 món để in!', 'warning');
        return;
      }
    }

    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      // 1. Tự động lưu đơn trước khi in để đảm bảo an toàn dữ liệu
      const res = await saveOrderForTable(table.id, items);
      if (!res || !res.success) {
        triggerHaptic('error');
        showToast('Không thể lưu đơn trước khi gửi bếp!', 'error');
        setIsSubmitting(false);
        return;
      }

      const kitchenConfig = settings?.storeConfig?.kitchenConfig || DEFAULT_KITCHEN_TICKET_SETTINGS;
      const originalItems = (order && Array.isArray(order.items)) ? order.items : [];
      const hasPriorPrints = originalItems.some((it) => (Number(it.printed_quantity) || 0) > 0);
      const isAdditional = !isRePrintAll && hasPriorPrints;

      let ticketTag = null;
      if (isRePrintAll) {
        ticketTag = 'IN LẠI CHO BẾP';
      } else if (isAll && hasPriorPrints) {
        ticketTag = 'TOÀN BỘ CÁC MÓN';
      } else if (isAdditional) {
        ticketTag = 'MÓN GỌI THÊM';
      } else if (!isAll) {
        ticketTag = 'TÙY CHỌN MÓN';
      }

      const model = buildKitchenTicketModel({
        order: { ...res.order, tableName },
        table,
        diffItems: itemsToPrint,
        itemsToPrint,
        kitchenConfig,
        storeSettings: settings,
        currentUser,
        isAdditionalOrder: isAdditional,
        ticketTag
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
        // Cập nhật printed_quantity chính xác cho từng món
        const updatedItems = items.map((it) => {
          const sent = itemsToPrint.find(
            (p) => (p.cartItemId && it.cartItemId && p.cartItemId === it.cartItemId) || isSameOrderItem(p, it)
          );
          if (sent) {
            const currentPrinted = Number(it.printed_quantity) || 0;
            const addQty = Number(sent.qtyToPrint) || 0;
            return {
              ...it,
              printed_quantity: Math.min(Number(it.quantity) || 1, currentPrinted + addQty)
            };
          }
          return it;
        });

        // Ghi nhận lịch sử in vào storage & sync PosContext
        await recordKitchenTicketPrint(table.id, updatedItems, model);
        if (res.order?.id && res.order.id !== table.id) {
          await recordKitchenTicketPrint(res.order.id, model, updatedItems);
        }

        setItems(updatedItems);
        if (onItemsChange) onItemsChange(updatedItems);

        triggerHaptic('success');
        showToast(
          isRePrintAll
            ? 'Đã gửi in lại toàn bộ đơn cho bếp!'
            : (isAll ? 'Đã in toàn bộ đơn cho bếp!' : `Đã in ${itemsToPrint.length} món gửi bếp!`),
          'success'
        );

        // Đóng popup chọn in, giữ nguyên OrderDetailsModal để thu ngân kiểm tra
        setIsKitchenPrintModalOpen(false);
      }
    } catch (err) {
      console.error('Lỗi khi gửi phiếu bếp:', err);
      triggerHaptic('error');
      showToast('Có lỗi xảy ra khi in phiếu bếp!', 'error');
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
  if (!isOpen && !table && !printPromptState?.isOpen) return null;

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
                                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 shrink-0">
                                  Đã gửi {printedQty}/{qty}
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

      {/* ========================================================================= */}
      {/* KITCHEN PRINT SELECTION MODAL (POPUP CHỌN MÓN HOẶC IN TOÀN BỘ CHO BẾP)   */}
      {/* ========================================================================= */}
      {isKitchenPrintModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="kitchen-print-modal-title"
          className="fixed inset-0 z-[9600] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 select-none"
          onClick={() => {
            if (!isSubmitting) setIsKitchenPrintModalOpen(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="clay-card rounded-[28px] bg-white w-full max-w-[400px] max-h-[86vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                  <Printer className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 id="kitchen-print-modal-title" className="text-xs sm:text-sm font-black leading-tight">
                    In phiếu bếp • {tableName}
                  </h3>
                  <p className="text-[10.5px] text-amber-100 font-medium">
                    Chọn món cần in hoặc in toàn bộ
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsKitchenPrintModalOpen(false)}
                aria-label="Đóng bảng chọn in"
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer active:scale-95 transition-colors"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Quick Filter Bar */}
            <div className="px-3 py-2 bg-amber-50/70 border-b border-amber-100/80 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectOnlyUnsent}
                  className="px-2.5 py-1 text-[11px] font-black rounded-lg bg-white text-amber-800 border border-amber-200/90 shadow-2xs hover:bg-amber-100/50 cursor-pointer active:scale-95 transition-all"
                >
                  ⚡ Chỉ món mới ({printSelectionStats.unsentItemCount})
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllForPrint}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-amber-900/80 hover:bg-white/60 cursor-pointer active:scale-95 transition-all"
                >
                  Tất cả ({printSelectionStats.totalItemCount})
                </button>
              </div>

              <button
                type="button"
                onClick={handleDeselectAllForPrint}
                className="text-[11px] text-gray-500 hover:text-gray-800 font-semibold underline cursor-pointer"
              >
                Bỏ chọn
              </button>
            </div>

            {/* Item List to select */}
            <div className="p-3 space-y-2 overflow-y-auto no-scrollbar flex-1 max-h-[46vh]">
              {items.map((item) => {
                const isSelected = Boolean(printSelectionMap[item.cartItemId]?.selected);
                const printQty = printSelectionMap[item.cartItemId]?.qtyToPrint || Number(item.quantity) || 1;
                const qty = Number(item.quantity) || 1;
                const printedQty = Number(item.printed_quantity) || 0;
                const isUnsent = qty > printedQty;

                return (
                  <div
                    key={item.cartItemId}
                    onClick={() => handleToggleItemSelection(item.cartItemId)}
                    className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/50 border-amber-300 shadow-2xs'
                        : 'bg-white border-gray-200/70 opacity-70 hover:opacity-90'
                    }`}
                  >
                    {/* Checkbox and item info */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs text-gray-900 truncate">
                            {item.name}
                          </span>
                          {isUnsent ? (
                            <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 shrink-0">
                              Món mới
                            </span>
                          ) : (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                              Đã gửi {printedQty}/{qty}
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-gray-500 font-medium truncate mt-0.5">
                          {item.sizeName || item.size ? `${item.sizeName || item.size} • ` : ''}
                          Tổng: {qty} ly/phần
                          {item.note ? ` • "${item.note}"` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Stepper (+ / -) */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`flex items-center gap-1 bg-white border border-gray-200/90 rounded-xl p-0.5 shrink-0 shadow-2xs transition-opacity ${
                        isSelected ? 'opacity-100' : 'opacity-40 pointer-events-none'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleStepPrintQty(item.cartItemId, -1)}
                        disabled={printQty <= 1}
                        aria-label="Giảm số lượng in"
                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs flex items-center justify-center active:scale-90 transition-all disabled:opacity-40 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-xs font-black text-gray-800 w-5 text-center select-none">
                        {printQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStepPrintQty(item.cartItemId, 1)}
                        disabled={printQty >= qty}
                        aria-label="Tăng số lượng in"
                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs flex items-center justify-center active:scale-90 transition-all disabled:opacity-40 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50/90 border-t border-gray-100 shrink-0 space-y-2">
              <div className="flex items-center justify-between text-xs px-1 font-semibold">
                <span className="text-gray-500">Đã chọn để in:</span>
                <span className="font-black text-amber-700">
                  {printSelectionStats.selectedItemCount} món (Tổng {printSelectionStats.totalQtyToPrint} phần)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                {/* Nút 1: In toàn bộ */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleExecuteKitchenPrint({ isAll: true })}
                  className="py-2.5 px-2 rounded-xl text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center gap-1 active:scale-95 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0 text-gray-600" />
                  <span className="truncate">In toàn bộ</span>
                </button>

                {/* Nút 2: In món đã chọn */}
                <button
                  type="button"
                  disabled={isSubmitting || printSelectionStats.selectedItemCount === 0}
                  onClick={() => handleExecuteKitchenPrint({ isAll: false })}
                  className="py-2.5 px-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                      <span className="truncate">Đang gửi...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-3.5 h-3.5 shrink-0 text-white" />
                      <span className="truncate">In đã chọn ({printSelectionStats.selectedItemCount})</span>
                    </>
                  )}
                </button>
              </div>
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
