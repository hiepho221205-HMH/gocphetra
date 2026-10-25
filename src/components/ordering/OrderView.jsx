import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePos } from '../../store/PosContext';
import { useIosKeyboardFix } from '../../hooks/useIosKeyboardFix';
import ItemCustomizerModal from './ItemCustomizerModal';
import OrderDetailsModal from '../orders/OrderDetailsModal';
import ViewOrderIconButton from '../common/ViewOrderIconButton';
import SaveOrderPrintPromptModal from './SaveOrderPrintPromptModal';
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
import { motion, useReducedMotion, useMotionTokens } from '../../lib/animateUi';
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Coffee,
  Citrus,
  CupSoda,
  Snowflake,
  GlassWater,
  Cake,
  Grid,
  UtensilsCrossed,
  Sparkles,
  Layers,
  X,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { triggerHaptic } from '../../utils/haptics';

// Mapping of available Lucide icons for categories
const CATEGORY_ICON_MAP = {
  Grid,
  Coffee,
  Citrus,
  CupSoda,
  Snowflake,
  GlassWater,
  Cake,
  UtensilsCrossed,
  Sparkles,
  Layers
};


function fastCloneCartItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((it) => ({
    ...it,
    toppings: Array.isArray(it.toppings) ? it.toppings.map((tp) => ({ ...tp })) : []
  }));
}

export default function OrderView({ table, onBack, onGoToBill }) {
  const {
    menu,
    categories,
    orders,
    saveOrderForTable,
    recordKitchenTicketPrint,
    settings,
    showToast,
    isTableBillingLocked,
    currentUser
  } = usePos();
  const { isKeyboardOpen } = useIosKeyboardFix();
  const { spring } = useMotionTokens();
  const shouldReduceMotion = useReducedMotion();

  // Active Category: 'all' is the virtual category (default)
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Draft Cart Items for this table
  const [cartItems, setCartItems] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modals & Panels
  const [customizingItem, setCustomizingItem] = useState(null);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [isConfirmDiscardOpen, setIsConfirmDiscardOpen] = useState(false);
  const [printPromptState, setPrintPromptState] = useState(null);
  const [activeKitchenTicketModel, setActiveKitchenTicketModel] = useState(null);

  // Track previous table ID to differentiate table switching vs state re-render
  const prevTableIdRef = useRef(table?.id);
  const loadedOrderVersionRef = useRef(table?.activeOrderId && orders?.[table.activeOrderId] ? (orders[table.activeOrderId].version || 1) : 1);

  const activeBillingLock = typeof isTableBillingLocked === 'function' ? isTableBillingLocked(table) : null;
  const isLockedByOther = Boolean(activeBillingLock && activeBillingLock.lockedById !== (currentUser?.id || currentUser?.uid));

  // Initialize draft cart from active order if table is already occupied
  useEffect(() => {
    const isNewTable = prevTableIdRef.current !== table?.id;
    prevTableIdRef.current = table?.id;

    const activeOrder =
      (table?.activeOrderId && orders[table.activeOrderId]) ||
      Object.values(orders).find((o) => o.tableId === table?.id && o.status === 'serving') ||
      (table?.status === 'occupied' && Object.values(orders).find((o) => o.tableId === table?.id && o.status !== 'completed' && o.status !== 'cancelled'));

    if (activeOrder) {
      const existingItems = activeOrder.items || [];
      // If table switched or not dirty, load from order
      if (isNewTable || !isDirty) {
        setCartItems(fastCloneCartItems(existingItems));
        loadedOrderVersionRef.current = activeOrder.version || 1;
        setIsDirty(false);
      }
    } else {
      // If table switched or not dirty, clear cart
      if (isNewTable || !isDirty) {
        setCartItems([]);
        loadedOrderVersionRef.current = 1;
        setIsDirty(false);
      }
    }
  }, [table?.id, table?.activeOrderId, orders]);

  // Lock body scroll when confirm discard modal is open
  useEffect(() => {
    if (isConfirmDiscardOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isConfirmDiscardOpen]);

  // Calculations
  const totalItemCount = useMemo(() => {
    return cartItems.reduce((sum, it) => sum + (it.quantity || 1), 0);
  }, [cartItems]);

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, it) => sum + (it.lineTotal || 0), 0);
  }, [cartItems]);

  // Count active items per category in single pass O(N)
  const categoryCounts = useMemo(() => {
    const counts = {};
    for (let i = 0; i < menu.length; i++) {
      const cid = menu[i].categoryId;
      counts[cid] = (counts[cid] || 0) + 1;
    }
    return counts;
  }, [menu]);

  // Filtered menu items (read-only for ordering)
  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      const matchCat = selectedCat === 'all' || item.categoryId === selectedCat;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.code && item.code.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [menu, selectedCat, searchQuery]);

  // Current active category title
  const activeCategoryTitle = useMemo(() => {
    if (selectedCat === 'all') return 'Tất cả';
    return categories.find((c) => c.id === selectedCat)?.name || 'Danh mục';
  }, [categories, selectedCat]);

  // ================= CART ACTIONS =================
  const handleAddToCart = (itemConfig) => {
    const existingIndex = cartItems.findIndex(
      (it) =>
        it.productId === itemConfig.productId &&
        it.size === itemConfig.size &&
        JSON.stringify(it.toppings || []) === JSON.stringify(itemConfig.toppings || []) &&
        (it.notes || '').trim() === (itemConfig.notes || '').trim()
    );

    if (existingIndex >= 0) {
      // Tăng số lượng
      setCartItems((prev) => {
        const copy = [...prev];
        const cur = copy[existingIndex];
        const newQty = cur.quantity + itemConfig.quantity;
        copy[existingIndex] = {
          ...cur,
          quantity: newQty,
          lineTotal: cur.unitPrice * newQty
        };
        return copy;
      });
    } else {
      // Thêm dòng mới
      const cartItemId = 'draft-' + Date.now() + Math.random().toString(36).substr(2, 4);
      setCartItems((prev) => [
        ...prev,
        {
          ...itemConfig,
          cartItemId
        }
      ]);
    }

    setIsDirty(true);
  };

  // ================= COMMIT ORDER HANDLER (LƯU NHANH) =================
  const handleSaveOrder = async (overrideItems = null) => {
    if (isSaving) return;

    const itemsToSave = Array.isArray(overrideItems) ? overrideItems : cartItems;

    if (itemsToSave.length === 0) {
      triggerHaptic('error');
      showToast('Đơn hàng chưa có món nào! Vui lòng chọn món trước khi lưu.', 'error');
      return;
    }

    if (isLockedByOther) {
      triggerHaptic('error');
      showToast(`Bàn đang được tính tiền bởi ${activeBillingLock.staffName}. Không thể lưu đơn!`, 'error');
      return;
    }

    triggerHaptic('medium');
    setIsSaving(true);
    try {
      const result = await saveOrderForTable(table.id, itemsToSave, loadedOrderVersionRef.current);
      if (result && result.success) {
        triggerHaptic('success');
        setIsDirty(false);
        setIsOrderDetailsOpen(false);

        const kitchenSettings = settings?.kitchenTicketSettings || DEFAULT_KITCHEN_TICKET_SETTINGS;
        if (kitchenSettings.enabled !== false) {
          const diffResult = computeKitchenItemsDiff(
            itemsToSave,
            result.order?.kitchenSentItems || [],
            kitchenSettings.printMode || 'diff'
          );

          if (diffResult.hasChanges && kitchenSettings.promptOnSave !== false) {
            setPrintPromptState({
              isOpen: true,
              order: result.order,
              table: result.table || table,
              diffResult
            });
            setIsSaving(false);
            return;
          }
        }

        setIsSaving(false);
        onBack();
      } else if (result && result.conflict) {
        triggerHaptic('error');
        if (result.currentOrder && result.currentOrder.items) {
          setCartItems(fastCloneCartItems(result.currentOrder.items));
          loadedOrderVersionRef.current = result.currentOrder.version || 1;
          setIsDirty(false);
        }
        setIsSaving(false);
      } else {
        setIsSaving(false);
      }
    } catch (err) {
      console.error('Lỗi khi lưu đơn:', err);
      triggerHaptic('error');
      showToast('Có lỗi xảy ra khi lưu đơn!', 'error');
      setIsSaving(false);
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

    const { executeKitchenTicketPrint } = await import('../../utils/bluetoothPrinter');
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
      onBack();
    }
  };

  const handleDismissKitchenPrint = () => {
    setPrintPromptState(null);
    onBack();
  };

  // Handle back button with discard confirmation
  const handleBackClick = () => {
    triggerHaptic('light');
    if (isDirty) {
      setIsConfirmDiscardOpen(true);
    } else {
      onBack();
    }
  };

  return (
    <div data-testid="order-view" className="flex flex-col h-full ambient-clay-bg overflow-hidden select-none relative">
      {/* ================= 1. HEADER TRANG GỌI MÓN ================= */}
      <header className="px-3.5 py-3 bg-white/95 backdrop-blur-md border-b border-gray-100 flex items-center justify-between shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleBackClick}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
            title="Quay lại Sơ đồ bàn"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-black text-sm sm:text-base text-[#214E34] leading-tight">
                Gọi món • {table.name}
              </h2>
              {/* Badge trạng thái bàn */}
              <span
                className={`text-[9.5px] font-black px-2 py-0.5 rounded-full uppercase ${
                  table.status === 'occupied'
                    ? 'clay-disc-green shadow-xs'
                    : 'clay-inset text-gray-500'
                }`}
              >
                {table.status === 'occupied' ? 'Có khách' : 'Trống'}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-medium">
              Chọn món nước & đồ ăn cho khách
            </p>
          </div>
        </div>
      </header>

      {/* ================= 2. BỐ CỤC 2 CỘT POS (SIDEBAR TRÁI + DANH SÁCH PHẢI) ================= */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ================= CỘT TRÁI: SIDEBAR DANH MỤC (~114px) ================= */}
        <aside className="w-[114px] sm:w-[124px] shrink-0 border-r border-gray-100 bg-white/90 backdrop-blur-md flex flex-col justify-between overflow-hidden">
          {/* Danh sách danh mục cuộn dọc */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-touch-contain no-scrollbar p-1.5 space-y-1.5 pb-20">
            {/* TAB HỆ THỐNG CỐ ĐỊNH: "Tất cả" */}
            <motion.div
              whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
              transition={spring.press}
              onClick={() => {
                triggerHaptic('light');
                setSelectedCat('all');
              }}
              className={`w-full min-h-[50px] px-2.5 py-2 rounded-[18px] text-left cursor-pointer transition-colors duration-150 flex flex-col justify-center relative select-none ${
                selectedCat === 'all'
                  ? 'font-black shadow-sm'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
              }`}
            >
              {selectedCat === 'all' && (
                <motion.div
                  layoutId="category-active-bg"
                  transition={shouldReduceMotion ? { duration: 0 } : spring.selection}
                  className="absolute inset-0 rounded-[18px] clay-btn-primary z-0 pointer-events-none"
                />
              )}
              <div className="relative z-10 flex items-center justify-between w-full mb-0.5">
                <Grid
                  className={`w-4 h-4 shrink-0 ${
                    selectedCat === 'all' ? 'text-white' : 'text-[#214E34]'
                  }`}
                />
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    selectedCat === 'all'
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {menu.length}
                </span>
              </div>
              <span className={`relative z-10 text-[11px] leading-tight font-extrabold ${selectedCat === 'all' ? 'text-white' : ''}`}>
                Tất cả
              </span>
            </motion.div>

            {/* CÁC DANH MỤC TỪ MENU */}
            {categories.map((cat) => {
              const isActive = selectedCat === cat.id;
              const IconComp = CATEGORY_ICON_MAP[cat.icon] || Coffee;
              const count = categoryCounts[cat.id] ?? 0;

              return (
                <motion.div
                  key={cat.id}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                  transition={spring.press}
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedCat(cat.id);
                  }}
                  className={`w-full min-h-[50px] px-2.5 py-2 rounded-[18px] text-left cursor-pointer transition-colors duration-150 flex flex-col justify-center relative select-none ${
                    isActive
                      ? 'font-black shadow-sm'
                      : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="category-active-bg"
                      transition={shouldReduceMotion ? { duration: 0 } : spring.selection}
                      className="absolute inset-0 rounded-[18px] clay-btn-primary z-0 pointer-events-none"
                    />
                  )}
                  <div className="relative z-10 flex items-center justify-between w-full mb-0.5">
                    <IconComp
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-[#214E34]'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                  <span className={`relative z-10 text-[11px] leading-tight font-extrabold truncate pr-1 ${isActive ? 'text-white' : ''}`}>
                    {cat.name}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </aside>

        {/* ================= CỘT PHẢI: DANH SÁCH MÓN (~276px) ================= */}
        <section className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Header Bar: Tiêu đề + Ô tìm kiếm */}
          <div className="p-2.5 pb-2 border-b border-gray-100 bg-white/80 backdrop-blur-md shrink-0 z-10 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[#214E34] flex items-center gap-1.5">
                <span>{activeCategoryTitle}</span>
                <span className="text-[11px] font-extrabold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                  {filteredMenu.length} món
                </span>
              </h2>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên hoặc mã món..."
                className="w-full pl-8 pr-7 py-2 clay-input text-[16px] sm:text-xs text-gray-800 placeholder:text-gray-400 font-bold"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Products List */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-touch-contain no-scrollbar p-2.5 space-y-2.5 pb-24">
            {filteredMenu.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                <Coffee className="w-10 h-10 mb-2 stroke-[1.5] text-gray-300" />
                <p className="text-xs font-bold text-gray-600">
                  {searchQuery ? 'Không tìm thấy món phù hợp' : 'Chưa có món nào'}
                </p>
              </div>
            ) : (
              filteredMenu.map((item) => {
                const inStock = item.inStock !== false;

                return (
                  <div
                    key={item.id}
                    className={`clay-card p-3 transition-all duration-200 flex items-center justify-between gap-3 ${
                      inStock
                        ? 'hover:border-emerald-300'
                        : 'border-rose-200 bg-rose-50/20 opacity-60'
                    }`}
                  >
                    {/* Left: Tên món, mô tả, giá & chấm trạng thái */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {/* Chấm trạng thái: Xanh (còn) / Đỏ (hết) */}
                        {inStock ? (
                          <span
                            className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-xs"
                            title="Còn hàng"
                          ></span>
                        ) : (
                          <span
                            className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"
                            title="Hết hàng"
                          ></span>
                        )}
                        <h3 className="font-extrabold text-gray-900 text-xs sm:text-[13px] leading-snug truncate">
                          {item.name}
                        </h3>
                      </div>

                      {/* Mô tả ngắn */}
                      {item.description && (
                        <p className="text-[10px] text-gray-500 line-clamp-1 leading-relaxed mb-1 font-medium">
                          {item.description}
                        </p>
                      )}

                      {/* Đơn giá */}
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs sm:text-sm font-black text-[#214E34]">
                          {formatVND(item.basePrice)}
                        </span>
                        {!inStock && (
                          <span className="text-[10px] text-rose-600 font-bold ml-1">
                            (Hết hàng)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Nút Thêm vào đơn (+) */}
                    <div className="shrink-0">
                      {inStock ? (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setCustomizingItem(item);
                          }}
                          data-testid={`add-menu-item-${item.id}`}
                          data-menu-item-button="true"
                          className="w-9 h-9 rounded-[14px] clay-btn-primary flex items-center justify-center cursor-pointer"
                          title={`Thêm ${item.name}`}
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      ) : (
                        <div
                          className="w-9 h-9 rounded-[14px] bg-gray-100 text-gray-400 flex items-center justify-center cursor-not-allowed opacity-50"
                          title="Món tạm hết hàng"
                        >
                          <Plus className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* ================= 3. STICKY BOTTOM SUMMARY BAR ================= */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-xl border-t border-gray-100 px-3.5 py-3 flex items-center justify-between gap-2 shadow-[0_-8px_20px_rgba(160,175,200,0.15)] transition-all duration-200 ${
          isKeyboardOpen
            ? 'opacity-0 translate-y-6 pointer-events-none'
            : 'opacity-100 translate-y-0 pointer-events-auto'
        }`}
      >
        {/* Left: Cart items count & subtotal */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-[14px] clay-disc-base clay-disc-blue text-white flex items-center justify-center shrink-0 relative shadow-sm">
            <ShoppingBag className="w-4 h-4" />
            {totalItemCount > 0 && (
              <span className="clay-sub-badge bg-rose-500 text-white">
                {totalItemCount}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="text-xs font-bold text-gray-800 truncate">
              {totalItemCount > 0 ? (
                <>
                  <span className="font-extrabold">{totalItemCount} món</span>
                  <span className="text-gray-300 mx-1.5">•</span>
                  <span className="text-xs sm:text-sm font-black text-[#214E34]">{formatVND(subtotal)}</span>
                </>
              ) : (
                <span className="text-gray-400 text-xs font-semibold">Chưa có món</span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 font-bold truncate">
              {table.name} • {isDirty ? 'Chưa lưu' : 'Đơn hiện tại'}
            </p>
          </div>
        </div>

        {/* Right: Action Buttons Group (Icon con mắt Xem đơn + Lưu nhanh) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Nút Xem đơn (Icon con mắt đơn giản) */}
          <ViewOrderIconButton
            onClick={() => setIsOrderDetailsOpen(true)}
            disabled={cartItems.length === 0 || isSaving}
            size="lg"
            title="Xem đơn chi tiết"
          />

          {/* Nút Lưu nhanh */}
          <button
            type="button"
            onClick={handleSaveOrder}
            disabled={cartItems.length === 0 || isSaving}
            aria-label="Lưu nhanh đơn hàng"
            className={`min-h-[44px] px-4 py-2 rounded-[16px] text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              cartItems.length > 0 && !isSaving
                ? 'clay-btn-primary'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 stroke-[2.5]" />
                <span>Lưu</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ================= 4. MODAL CHI TIẾT ĐƠN HÀNG (3 NÚT CÂN ĐỐI) ================= */}
      {isOrderDetailsOpen && (
        <OrderDetailsModal
          isOpen={isOrderDetailsOpen}
          onClose={() => setIsOrderDetailsOpen(false)}
          table={table}
          order={table.activeOrderId ? orders[table.activeOrderId] : null}
          draftItems={cartItems}
          onItemsChange={(updatedItems) => {
            setCartItems(updatedItems);
            setIsDirty(true);
          }}
          onAddMoreItems={() => {
            // Tiếp tục chọn món trên OrderView
            setIsOrderDetailsOpen(false);
          }}
          onSave={async (tbl, itemsToSave) => {
            await handleSaveOrder(itemsToSave);
          }}
          onCheckout={async () => {
            triggerHaptic('medium');
            const res = await saveOrderForTable(table.id, cartItems);
            if (res && res.success) {
              setIsDirty(false);
              setIsOrderDetailsOpen(false);
              const freshTable = res.table || {
                ...table,
                activeOrderId: res.order?.id,
                status: 'occupied'
              };
              if (onGoToBill) {
                onGoToBill(freshTable, res.order);
              }
            }
          }}
        />
      )}

      {/* ================= 5. MODAL TÙY CHỌN MÓN (SIZE, TOPPING, ĐƯỜNG ĐÁ) ================= */}
      {customizingItem && (
        <ItemCustomizerModal
          item={customizingItem}
          isOpen={Boolean(customizingItem)}
          onClose={() => setCustomizingItem(null)}
          onAddToCart={(config) => {
            handleAddToCart(config);
            setCustomizingItem(null);
          }}
        />
      )}

      {/* ================= 6. MODAL XÁC NHẬN HỦY THAY ĐỔI (PORTAL) ================= */}
      {isConfirmDiscardOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="clay-card w-full max-w-[340px] p-6 flex flex-col items-center text-center animate-slideUp">
              <div className="w-12 h-12 rounded-full clay-disc-base clay-disc-amber text-white flex items-center justify-center mb-3">
                <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
              </div>

              {/* Sub-badge Context */}
              <span className="text-[11px] font-black uppercase tracking-wider text-[#214E34] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 mb-2">
                GÓC • Gọi món – {table.name}
              </span>

              <h4 className="font-black text-base text-gray-900 mb-1.5">
                Bạn có thay đổi chưa lưu!
              </h4>

              <p className="text-xs text-gray-600 mb-5 px-1 leading-relaxed font-semibold">
                Đơn hàng đang có món chưa lưu. Bạn muốn lưu vào đơn của bàn trước khi thoát hay hủy bỏ?
              </p>

              <div className="flex flex-col gap-2.5 w-full">
                {/* NÚT CHÍNH (PRIMARY CTA): Lưu đơn & Thoát */}
                <button
                  type="button"
                  onClick={async () => {
                    triggerHaptic('success');
                    setIsConfirmDiscardOpen(false);
                    await handleSaveOrder();
                  }}
                  className="w-full min-h-[48px] py-3 px-4 rounded-[18px] text-xs font-black text-white clay-btn-primary flex items-center justify-center gap-2 cursor-pointer shadow-float"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-200 stroke-[2.5]" />
                  <span>Lưu đơn & Thoát về sơ đồ bàn</span>
                </button>

                {/* NÚT PHỤ: Hủy các món vừa chọn */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('warning');
                    setIsConfirmDiscardOpen(false);
                    setIsDirty(false);
                    setCartItems([]);
                    onBack();
                  }}
                  className="w-full min-h-[42px] py-2 px-3 rounded-[16px] text-[11.5px] font-bold text-red-600 bg-red-50/80 hover:bg-red-100/80 border border-red-200/80 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span>Hủy các món vừa chọn (Không lưu)</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ================= 7. MODAL XÁC NHẬN IN PHIẾU CHẾ BIẾN SAU KHI LƯU ĐƠN ================= */}
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
    </div>
  );
}
