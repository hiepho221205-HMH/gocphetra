import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePos } from '../../store/PosContext';
import ItemCustomizerModal from './ItemCustomizerModal';
import OrderDetailsModal from '../orders/OrderDetailsModal';
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
  AlertTriangle
} from 'lucide-react';
import { formatVND } from '../../utils/currency';

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

export default function OrderView({ table, onBack, onGoToBill }) {
  const {
    menu,
    categories,
    orders,
    saveOrderForTable,
    showToast
  } = usePos();

  // Active Category: 'all' is the virtual category (default)
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Draft Cart Items for this table
  const [cartItems, setCartItems] = useState([]);
  const [isDirty, setIsDirty] = useState(false);

  // Modals & Panels
  const [customizingItem, setCustomizingItem] = useState(null);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [isConfirmDiscardOpen, setIsConfirmDiscardOpen] = useState(false);

  // Initialize draft cart from active order if table is already occupied
  useEffect(() => {
    if (table && table.activeOrderId && orders[table.activeOrderId]) {
      const existingItems = orders[table.activeOrderId].items || [];
      // Clone items into draft
      setCartItems(JSON.parse(JSON.stringify(existingItems)));
    } else {
      setCartItems([]);
    }
    setIsDirty(false);
  }, [table, orders]);

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

  // Count active items per category
  const categoryCounts = useMemo(() => {
    const counts = {};
    categories.forEach((c) => {
      counts[c.id] = menu.filter((item) => item.categoryId === c.id).length;
    });
    return counts;
  }, [menu, categories]);

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
    showToast(`Đã thêm ${itemConfig.name} vào đơn`, 'success');
  };

  const handleUpdateQuantity = (cartItemId, delta) => {
    setCartItems((prev) =>
      prev
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
        .filter(Boolean)
    );
    setIsDirty(true);
  };

  const handleRemoveItem = (cartItemId) => {
    setCartItems((prev) => prev.filter((it) => it.cartItemId !== cartItemId));
    setIsDirty(true);
    showToast('Đã xóa món khỏi đơn', 'info');
  };

  // ================= COMMIT ORDER HANDLER =================
  const handleSaveOrder = () => {
    if (cartItems.length === 0) {
      showToast('Đơn hàng chưa có món nào! Vui lòng chọn món trước khi lưu.', 'error');
      return;
    }

    const result = saveOrderForTable(table.id, cartItems);
    if (result && result.success) {
      setIsDirty(false);
      setIsOrderDetailsOpen(false);
      onBack();
    }
  };

  // Handle back button with discard confirmation
  const handleBackClick = () => {
    if (isDirty) {
      setIsConfirmDiscardOpen(true);
    } else {
      onBack();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-135px)] sm:h-[720px] bg-[#F8FAF8] overflow-hidden select-none relative">
      {/* ================= 1. HEADER TRANG GỌI MÓN ================= */}
      <header className="px-3.5 py-2.5 bg-white/95 backdrop-blur-md border-b border-stone-200/80 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleBackClick}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 active:scale-95 flex items-center justify-center text-stone-700 transition-all"
            title="Quay lại Sơ đồ bàn"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-black text-sm sm:text-base text-[#214E34] leading-tight">
                Gọi món • {table.name}
              </h2>
              {/* Badge trạng thái bàn */}
              <span
                className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                  table.status === 'occupied'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-stone-100 text-stone-600 border border-stone-200'
                }`}
              >
                {table.status === 'occupied' ? 'Có khách' : 'Bàn trống'}
              </span>
            </div>
            <p className="text-[10px] text-stone-500">
              Chọn món nước & đồ ăn cho khách
            </p>
          </div>
        </div>

        {/* Thanh toán nhanh nếu bàn đã có đơn */}
        {table.status === 'occupied' && onGoToBill && (
          <button
            onClick={() => onGoToBill(table)}
            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
          >
            <Receipt className="w-3.5 h-3.5 text-amber-700" />
            <span>Thanh toán</span>
          </button>
        )}
      </header>

      {/* ================= 2. BỐ CỤC 2 CỘT POS (SIDEBAR TRÁI + DANH SÁCH PHẢI) ================= */}
      <div className="flex flex-1 overflow-hidden pb-14">
        {/* ================= CỘT TRÁI: SIDEBAR DANH MỤC (~114px) ================= */}
        <aside className="w-[114px] sm:w-[124px] shrink-0 border-r border-stone-200/90 bg-white/95 backdrop-blur-md flex flex-col justify-between overflow-hidden shadow-xs">
          {/* Danh sách danh mục cuộn dọc */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-1.5 space-y-1">
            {/* TAB HỆ THỐNG CỐ ĐỊNH: "Tất cả" */}
            <div
              onClick={() => setSelectedCat('all')}
              className={`w-full min-h-[48px] px-2 py-1.5 rounded-xl text-left cursor-pointer transition-all duration-200 flex flex-col justify-center ${
                selectedCat === 'all'
                  ? 'bg-[#214E34] text-white shadow-sm font-bold'
                  : 'bg-stone-50/80 hover:bg-stone-100/90 text-stone-700 hover:text-stone-900 border border-stone-200/50'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-0.5">
                <Grid
                  className={`w-4 h-4 shrink-0 ${
                    selectedCat === 'all' ? 'text-white' : 'text-[#214E34]'
                  }`}
                />
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    selectedCat === 'all'
                      ? 'bg-white/20 text-white font-bold'
                      : 'bg-stone-200/70 text-stone-600'
                  }`}
                >
                  {menu.length}
                </span>
              </div>
              <span className="text-[11px] leading-tight font-semibold">Tất cả</span>
            </div>

            {/* CÁC DANH MỤC TỪ MENU */}
            {categories.map((cat) => {
              const isActive = selectedCat === cat.id;
              const IconComp = CATEGORY_ICON_MAP[cat.icon] || Coffee;
              const count = categoryCounts[cat.id] ?? 0;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  className={`w-full min-h-[48px] px-2 py-1.5 rounded-xl text-left cursor-pointer transition-all duration-200 flex flex-col justify-center ${
                    isActive
                      ? 'bg-[#214E34] text-white shadow-sm font-bold'
                      : 'bg-stone-50/80 hover:bg-stone-100/90 text-stone-700 hover:text-stone-900 border border-stone-200/50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-0.5">
                    <IconComp
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-[#214E34]'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white font-bold'
                          : 'bg-stone-200/70 text-stone-600'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                  <span className="text-[11px] leading-tight font-semibold truncate pr-1">
                    {cat.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer sidebar */}
          <div className="p-2 border-t border-stone-100 text-center bg-stone-50/40">
            <span className="text-[10px] text-stone-400 font-medium block">
              {menu.length} món
            </span>
          </div>
        </aside>

        {/* ================= CỘT PHẢI: DANH SÁCH MÓN TEXT-BASED (~276px) ================= */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#F4F6F4]/50 overflow-hidden">
          {/* Header Bar: Tiêu đề + Ô tìm kiếm */}
          <div className="p-2.5 pb-2 border-b border-stone-200/70 bg-white/80 backdrop-blur-md sticky top-0 z-10 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#214E34] flex items-center gap-1.5">
                <span>{activeCategoryTitle}</span>
                <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                  {filteredMenu.length} món
                </span>
              </h2>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên hoặc mã món..."
                className="w-full pl-8 pr-7 py-1.5 bg-stone-50 border border-stone-200/90 rounded-xl text-xs text-stone-800 focus:outline-none focus:border-[#214E34] focus:bg-white transition-all placeholder:text-stone-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Products List */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-2.5 space-y-2 pb-6">
            {filteredMenu.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-stone-400">
                <Coffee className="w-10 h-10 mb-2 stroke-[1.5] text-stone-300" />
                <p className="text-xs font-semibold text-stone-600">
                  {searchQuery ? 'Không tìm thấy món phù hợp' : 'Chưa có món nào'}
                </p>
              </div>
            ) : (
              filteredMenu.map((item) => {
                const inStock = item.inStock !== false;

                return (
                  <div
                    key={item.id}
                    className={`bg-white/95 backdrop-blur-sm border rounded-2xl p-2.5 shadow-2xs transition-all duration-200 flex items-center justify-between gap-2.5 ${
                      inStock
                        ? 'border-stone-200/80 hover:border-emerald-300/80 hover:shadow-xs'
                        : 'border-rose-200/60 bg-rose-50/15 opacity-65'
                    }`}
                  >
                    {/* Left: Tên món, mô tả, giá & chấm trạng thái */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {/* Chấm trạng thái: Xanh (còn) / Đỏ (hết) */}
                        {inStock ? (
                          <span
                            className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"
                            title="Còn hàng"
                          ></span>
                        ) : (
                          <span
                            className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"
                            title="Hết hàng"
                          ></span>
                        )}
                        <h3 className="font-bold text-stone-900 text-xs sm:text-[13px] leading-snug truncate">
                          {item.name}
                        </h3>
                      </div>

                      {/* Mô tả ngắn */}
                      {item.description && (
                        <p className="text-[10px] text-stone-500 line-clamp-1 leading-relaxed mb-1">
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
                          onClick={() => setCustomizingItem(item)}
                          className="w-8 h-8 rounded-xl bg-[#214E34] text-white flex items-center justify-center hover:bg-[#1a3e29] active:scale-90 shadow-2xs transition-all"
                          title={`Thêm ${item.name}`}
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      ) : (
                        <div
                          className="w-8 h-8 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center cursor-not-allowed opacity-50"
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
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-200 px-3.5 py-2.5 flex items-center justify-between shadow-float">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#214E34]/10 text-[#214E34] flex items-center justify-center relative">
            <ShoppingBag className="w-4 h-4" />
            {totalItemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#214E34] text-white text-[9.5px] font-bold flex items-center justify-center shadow-xs">
                {totalItemCount}
              </span>
            )}
          </div>

          <div>
            <div className="text-xs font-bold text-stone-800">
              {totalItemCount > 0 ? (
                <>
                  <span>{totalItemCount} món</span>
                  <span className="text-stone-300 mx-1">•</span>
                  <span className="text-sm font-black text-[#214E34]">{formatVND(subtotal)}</span>
                </>
              ) : (
                <span className="text-stone-400 text-xs">Chưa có món trong đơn</span>
              )}
            </div>
            <p className="text-[10px] text-stone-400">
              {table.name} • {isDirty ? 'Có thay đổi chưa lưu' : 'Đơn hiện tại'}
            </p>
          </div>
        </div>

        {/* Nút Xem đơn */}
        <button
          onClick={() => setIsOrderDetailsOpen(true)}
          disabled={cartItems.length === 0}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-sm ${
            cartItems.length > 0
              ? 'bg-[#214E34] text-white hover:bg-[#1a3e29] active:scale-95'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Xem đơn</span>
        </button>
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
          onSave={() => {
            const res = saveOrderForTable(table.id, cartItems);
            if (res && res.success) {
              setIsDirty(false);
              setIsOrderDetailsOpen(false);
              onBack();
            }
          }}
          onCheckout={() => {
            const res = saveOrderForTable(table.id, cartItems);
            if (res && res.success) {
              setIsDirty(false);
              setIsOrderDetailsOpen(false);
              if (onGoToBill) {
                onGoToBill(table);
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
          <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl w-full max-w-[340px] p-5 flex flex-col items-center text-center shadow-2xl border border-stone-200 animate-slideUp">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-3 shadow-inner">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>

              {/* Sub-badge Context */}
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 mb-2">
                GÓC • Gọi món – {table.name}
              </span>

              <h4 className="font-black text-base text-stone-900 mb-2">
                Hủy thay đổi chưa lưu?
              </h4>

              <p className="text-xs text-stone-600 mb-5 px-1 leading-relaxed">
                Các món vừa chọn chưa được lưu vào đơn của bàn. Bạn muốn tiếp tục gọi món hay bỏ thay đổi?
              </p>

              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setIsConfirmDiscardOpen(false)}
                  className="w-full min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 active:scale-97 transition-all"
                >
                  Ở lại gọi món
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmDiscardOpen(false);
                    setIsDirty(false);
                    onBack();
                  }}
                  className="w-full min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 active:scale-97 shadow-md transition-all"
                >
                  Bỏ thay đổi
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
