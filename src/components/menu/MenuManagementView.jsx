import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePos } from '../../store/PosContext';
import { useIosKeyboardFix } from '../../hooks/useIosKeyboardFix';
import ToppingManagerModal from './ToppingManagerModal';
import {
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
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  X,
  AlertTriangle,
  FolderPlus,
  Tag,
  Check,
  CheckSquare,
  Square,
  SlidersHorizontal,
  ChevronRight,
  ArrowLeft
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

const AVAILABLE_ICONS = [
  { name: 'Coffee', label: 'Cà phê', icon: Coffee },
  { name: 'Citrus', label: 'Trà quả', icon: Citrus },
  { name: 'CupSoda', label: 'Trà sữa', icon: CupSoda },
  { name: 'Snowflake', label: 'Đá xay', icon: Snowflake },
  { name: 'GlassWater', label: 'Nước ép', icon: GlassWater },
  { name: 'Cake', label: 'Bánh ngọt', icon: Cake },
  { name: 'UtensilsCrossed', label: 'Món ăn', icon: UtensilsCrossed },
  { name: 'Sparkles', label: 'Đặc biệt', icon: Sparkles },
  { name: 'Layers', label: 'Khác', icon: Layers }
];

export default function MenuManagementView() {
  const {
    menu,
    categories,
    toppings,
    productToppings,
    addCategory,
    updateCategory,
    deleteCategory,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleProductStock
  } = usePos();
  useIosKeyboardFix();

  // Active Category: 'all' is the virtual system category (default)
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals for Item
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Modals for Category
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // Modal / Drawer for Topping Management
  const [isToppingManagerOpen, setIsToppingManagerOpen] = useState(false);

  // Safety Confirmation Modal
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // { type: 'item' | 'category', id, name }

  // Form states for Item
  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemCat, setItemCat] = useState(categories[0]?.id || 'cat-coffee');
  const [itemPrice, setItemPrice] = useState(35000);
  const [itemInStock, setItemInStock] = useState(true);
  const [itemDesc, setItemDesc] = useState('');
  const [itemToppingConfigs, setItemToppingConfigs] = useState([]);

  // Form states for Category
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('Coffee');

  // Loading & double-submit protection
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen = isItemModalOpen || isCategoryModalOpen || isToppingManagerOpen || Boolean(deleteConfirmation);
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isItemModalOpen, isCategoryModalOpen, isToppingManagerOpen, deleteConfirmation]);

  // Support ESC key to safely dismiss top-most modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (deleteConfirmation) {
          setDeleteConfirmation(null);
        } else if (isItemModalOpen) {
          setIsItemModalOpen(false);
        } else if (isCategoryModalOpen) {
          setIsCategoryModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteConfirmation, isItemModalOpen, isCategoryModalOpen]);

  // Count items per category
  const categoryCounts = useMemo(() => {
    const counts = {};
    categories.forEach((c) => {
      counts[c.id] = menu.filter((item) => item.categoryId === c.id).length;
    });
    return counts;
  }, [menu, categories]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
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

  // Current active category name
  const activeCategoryTitle = useMemo(() => {
    if (selectedCat === 'all') return 'Tất cả';
    return categories.find((c) => c.id === selectedCat)?.name || 'Danh mục';
  }, [categories, selectedCat]);

  // ================= ITEM MODAL HANDLERS =================
  const handleOpenAddItem = () => {
    triggerHaptic('medium');
    setEditingItem(null);
    setItemName('');
    const nextNum = menu.length + 1;
    setItemCode(`M${nextNum < 10 ? '0' + nextNum : nextNum}`);
    const defaultCat = selectedCat !== 'all' ? selectedCat : (categories[0]?.id || 'cat-coffee');
    setItemCat(defaultCat);
    setItemPrice(35000);
    setItemInStock(true);
    setItemDesc('');

    const initialConfigs = toppings.map((tp) => ({
      toppingId: tp.id,
      enabled: Boolean(tp.isGlobal),
      priceOverride: ''
    }));
    setItemToppingConfigs(initialConfigs);

    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item) => {
    triggerHaptic('light');
    setEditingItem(item);
    setItemName(item.name || '');
    setItemCode(item.code || '');
    setItemCat(item.categoryId || (categories[0]?.id || 'cat-coffee'));
    setItemPrice(item.basePrice || 0);
    setItemInStock(item.inStock !== false);
    setItemDesc(item.description || '');

    const existingLinks = productToppings.filter((pt) => pt.productId === item.id);
    const configs = toppings.map((tp) => {
      const link = existingLinks.find((l) => l.toppingId === tp.id);
      const isLinked = !!link || Boolean(tp.isGlobal);
      return {
        toppingId: tp.id,
        enabled: isLinked,
        priceOverride: link?.priceOverride !== null && link?.priceOverride !== undefined ? link.priceOverride : ''
      };
    });
    setItemToppingConfigs(configs);

    setIsItemModalOpen(true);
  };

  const handleSaveItem = (e) => {
    e.preventDefault();
    if (!itemName.trim() || isSavingItem) return;
    setIsSavingItem(true);

    try {
      triggerHaptic('success');

      const activeToppingLinks = itemToppingConfigs
        .filter((cfg) => cfg.enabled)
        .map((cfg) => ({
          toppingId: cfg.toppingId,
          priceOverride: cfg.priceOverride !== '' && !isNaN(Number(cfg.priceOverride)) ? Number(cfg.priceOverride) : null
        }));

      const payload = {
        name: itemName.trim(),
        code: itemCode.trim().toUpperCase() || `M${Date.now().toString().slice(-4)}`,
        categoryId: itemCat,
        basePrice: Math.max(0, Number(itemPrice) || 0),
        inStock: itemInStock,
        description: itemDesc.trim(),
        toppingLinks: activeToppingLinks,
        sizes: [
          { id: 'S', name: 'Nhỏ (S)', priceAdjustment: 0 },
          { id: 'M', name: 'Vừa (M)', priceAdjustment: 6000 },
          { id: 'L', name: 'Lớn (L)', priceAdjustment: 12000 }
        ]
      };

      if (editingItem) {
        updateMenuItem(editingItem.id, payload);
      } else {
        addMenuItem(payload);
      }
      setIsItemModalOpen(false);
    } finally {
      setIsSavingItem(false);
    }
  };

  // ================= CATEGORY MODAL HANDLERS =================
  const handleOpenAddCategory = () => {
    triggerHaptic('medium');
    setEditingCategory(null);
    setCatName('');
    setCatIcon('Coffee');
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat, e) => {
    e.stopPropagation();
    triggerHaptic('light');
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatIcon(cat.icon || 'Coffee');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e) => {
    e.preventDefault();
    if (!catName.trim() || isSavingCategory) return;
    setIsSavingCategory(true);

    try {
      triggerHaptic('success');

      if (editingCategory) {
        updateCategory(editingCategory.id, {
          name: catName.trim(),
          icon: catIcon
        });
      } else {
        addCategory({
          name: catName.trim(),
          icon: catIcon
        });
      }
      setIsCategoryModalOpen(false);
    } finally {
      setIsSavingCategory(false);
    }
  };

  // ================= DELETE CONFIRMATION HANDLER =================
  const confirmDelete = () => {
    if (!deleteConfirmation) return;
    triggerHaptic('warning');
    if (deleteConfirmation.type === 'item') {
      deleteMenuItem(deleteConfirmation.id);
    } else if (deleteConfirmation.type === 'category') {
      deleteCategory(deleteConfirmation.id);
      if (selectedCat === deleteConfirmation.id) {
        setSelectedCat('all');
      }
    }
    setDeleteConfirmation(null);
  };

  return (
    <div className="flex flex-col h-full flex-1 min-h-0 ambient-clay-bg overflow-hidden select-none">
      {/* 2-COLUMN SPLIT-VIEW POS MENU MANAGEMENT */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ================= LEFT SIDEBAR: CATEGORIES & ACTIONS (~116px) ================= */}
        <aside className="w-[114px] sm:w-[124px] shrink-0 border-r border-gray-100 bg-white/95 backdrop-blur-md flex flex-col justify-between overflow-hidden shadow-xs">
          {/* Top Quick Actions (Thêm món, Thêm mục, Topping) & Pinned "Tất cả" Category */}
          <div className="shrink-0 p-2 space-y-1.5 border-b border-gray-100 bg-[#F5F7F4]/60">
            {/* Action 1: + Thêm món */}
            <button
              type="button"
              onClick={handleOpenAddItem}
              className="touch-target w-full min-h-[40px] px-2 py-1.5 clay-btn-primary text-white text-[11px] font-black flex items-center justify-center gap-1 leading-tight text-center cursor-pointer"
              title="Thêm món mới vào thực đơn"
            >
              <Plus className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
              <span>Thêm món</span>
            </button>

            {/* Action 2: + Thêm mục */}
            <button
              type="button"
              onClick={handleOpenAddCategory}
              className="touch-target w-full min-h-[36px] px-2 py-1 clay-pill-btn text-[#214E34] text-[11px] font-black flex items-center justify-center gap-1 leading-tight text-center cursor-pointer"
              title="Thêm danh mục mới"
            >
              <FolderPlus className="w-3.5 h-3.5 shrink-0 text-[#214E34]" />
              <span>Thêm mục</span>
            </button>

            {/* Action 3: Topping */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsToppingManagerOpen(true);
              }}
              className="touch-target w-full min-h-[36px] px-2 py-1 bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 text-amber-900 rounded-[14px] text-[11px] font-black flex items-center justify-center gap-1 leading-tight text-center cursor-pointer shadow-xs active:scale-95"
              title="Mở màn hình Quản lý Topping"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Topping</span>
            </button>

            {/* Action 4 / Pinned Filter: "Tất cả" */}
            <div
              onClick={() => {
                triggerHaptic('light');
                setSelectedCat('all');
              }}
              className={`w-full min-h-[46px] px-2.5 py-1.5 rounded-[14px] text-left cursor-pointer transition-all duration-200 flex flex-col justify-center ${
                selectedCat === 'all'
                  ? 'clay-btn-primary shadow-sm font-black text-white'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-0.5">
                <Grid
                  className={`w-3.5 h-3.5 shrink-0 ${
                    selectedCat === 'all' ? 'text-white' : 'text-[#214E34]'
                  }`}
                />
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                    selectedCat === 'all'
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {menu.length}
                </span>
              </div>
              <span className="text-[11px] leading-tight font-extrabold">Tất cả</span>
            </div>
          </div>

          {/* Vertical Categories List (Scrollable) */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-touch-contain no-scrollbar p-1.5 space-y-1.5 pb-20">
            {/* REAL USER CATEGORIES */}
            {categories.map((cat) => {
              const isActive = selectedCat === cat.id;
              const IconComp = CATEGORY_ICON_MAP[cat.icon] || Coffee;
              const count = categoryCounts[cat.id] ?? 0;

              return (
                <div
                  key={cat.id}
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedCat(cat.id);
                  }}
                  className={`group relative w-full min-h-[50px] px-2.5 py-2 rounded-[16px] text-left cursor-pointer transition-all duration-200 flex flex-col justify-center ${
                    isActive
                      ? 'clay-btn-primary shadow-sm font-black text-white'
                      : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-0.5">
                    <IconComp
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-[#214E34]'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {count}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] leading-tight font-extrabold truncate pr-1">
                      {cat.name}
                    </span>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditCategory(cat, e)}
                      className={`opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 transition-opacity ${
                        isActive ? 'text-white' : 'text-gray-500'
                      }`}
                      title="Chỉnh sửa danh mục"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom stats summary */}
          <div className="shrink-0 p-2 border-t border-gray-100 text-center bg-[#F5F7F4]/60">
            <span className="text-[10px] text-gray-400 font-bold block">
              {menu.length} món • {toppings.length} topping
            </span>
          </div>
        </aside>

        {/* ================= RIGHT COLUMN: ITEM LIST (~276px) ================= */}
        <section className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Header Bar */}
          <div className="shrink-0 p-2.5 pb-2 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-[#214E34] flex items-center gap-1.5">
                  <span>{activeCategoryTitle}</span>
                  <span className="text-[11px] font-extrabold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {filteredItems.length} món
                  </span>
                </h2>
              </div>

              {selectedCat !== 'all' && (
                <button
                  type="button"
                  onClick={(e) => {
                    const catObj = categories.find((c) => c.id === selectedCat);
                    if (catObj) handleOpenEditCategory(catObj, e);
                  }}
                  className="text-[10.5px] text-[#214E34] flex items-center gap-1 font-bold px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Sửa mục</span>
                </button>
              )}
            </div>

            {/* Quick Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên hoặc mã món..."
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

          {/* Scrollable Item Cards List */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-touch-contain no-scrollbar p-2.5 space-y-2.5 pb-28">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                <Coffee className="w-10 h-10 mb-2 stroke-[1.5] text-gray-300" />
                <p className="text-xs font-bold text-gray-600">
                  {searchQuery ? 'Không tìm thấy món phù hợp' : 'Chưa có món nào trong mục này'}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                  Nhấn "+ Thêm món" ở cột trái để tạo món mới.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`clay-card p-3 space-y-2 transition-all duration-200 ${
                    item.inStock
                      ? 'hover:border-emerald-300'
                      : 'border-rose-200 bg-rose-50/20 opacity-75'
                  }`}
                >
                  {/* Card Header: Tên món + Chấm tròn trạng thái */}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-extrabold text-gray-900 text-xs sm:text-[13px] leading-snug truncate">
                      {item.name}
                    </h3>

                    <div className="shrink-0 flex items-center pr-1">
                      {item.inStock ? (
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-xs"
                          title="Còn hàng"
                        ></span>
                      ) : (
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 shadow-xs"
                          title="Hết hàng"
                        ></span>
                      )}
                    </div>
                  </div>

                  {/* Mô tả ngắn */}
                  {item.description && (
                    <p className="text-[10.5px] text-gray-500 line-clamp-1 leading-relaxed font-medium">
                      {item.description}
                    </p>
                  )}

                  {/* Đơn giá bán */}
                  <div className="flex items-baseline justify-between pt-0.5">
                    <span className="text-sm font-black text-[#214E34]">
                      {formatVND(item.basePrice)}
                    </span>
                    {item.code && (
                      <span className="font-mono text-[9px] font-bold text-gray-400">
                        {item.code}
                      </span>
                    )}
                  </div>

                  {/* HÀNG NÚT 1-CHẠM: Bật/Tắt, Sửa, Xóa */}
                  <div className="grid grid-cols-6 gap-1.5 pt-1.5 border-t border-gray-100">
                    {/* Nút 1: Bật / Tắt trạng thái 1-chạm (Col span 3) */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        toggleProductStock(item.id);
                      }}
                      className={`col-span-3 min-h-[36px] px-2 py-1 rounded-[12px] text-[11px] font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 border cursor-pointer ${
                        item.inStock
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                      }`}
                      title={item.inStock ? 'Nhấn để chuyển thành Hết hàng' : 'Nhấn để chuyển thành Còn hàng'}
                    >
                      {item.inStock ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Còn hàng</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Hết hàng</span>
                        </>
                      )}
                    </button>

                    {/* Nút 2: Sửa món (Col span 2) */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditItem(item)}
                      className="col-span-2 min-h-[36px] px-2 py-1 rounded-[12px] text-[11px] font-extrabold clay-pill-btn text-gray-700 flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                      title="Chỉnh sửa thông tin món"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                      <span>Sửa</span>
                    </button>

                    {/* Nút 3: Xóa món (Col span 1) */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('warning');
                        setDeleteConfirmation({
                          type: 'item',
                          id: item.id,
                          name: item.name
                        });
                      }}
                      className="col-span-1 min-h-[36px] px-2 py-1 rounded-[12px] text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center active:scale-95 cursor-pointer"
                      title="Xóa món"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ================= MODAL: QUẢN LÝ TOPPING ================= */}
      <ToppingManagerModal
        isOpen={isToppingManagerOpen}
        onClose={() => setIsToppingManagerOpen(false)}
      />

      {/* ================= MODAL: THÊM / SỬA MÓN ================= */}
      {isItemModalOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-modal-title"
            className="fixed inset-0 z-[9000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-fadeIn select-none"
          >
            <form
              onSubmit={handleSaveItem}
              className="clay-card rounded-[28px] w-full max-w-[390px] h-full max-h-[min(90dvh,720px)] flex flex-col p-0 overflow-hidden shadow-2xl bg-white animate-slideUp"
            >
              {/* Modal Header */}
              <div className="shrink-0 px-5 py-3.5 bg-gradient-to-r from-[#214E34] to-[#2E6744] text-white flex items-center justify-between shadow-xs">
                <div>
                  <h3 id="item-modal-title" className="font-black text-sm">
                    {editingItem ? 'Chỉnh sửa món' : 'Thêm món mới'}
                  </h3>
                  <p className="text-[10px] text-emerald-200 font-semibold">
                    {editingItem ? `Mã món: ${editingItem.code || 'Chưa có'}` : 'Nhập thông tin sản phẩm'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setIsItemModalOpen(false);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white cursor-pointer transition-colors"
                  title="Đóng"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Modal Form Body - Independent Scroll Container */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-touch-contain p-4 sm:p-5 space-y-4 no-scrollbar">
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Tên món <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Cà phê sữa đá, Trà sen vàng..."
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full px-3.5 py-2.5 clay-input text-xs font-bold text-gray-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 mb-1">
                      Mã món
                    </label>
                    <input
                      type="text"
                      placeholder="CF01, TS02..."
                      value={itemCode}
                      onChange={(e) => setItemCode(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 clay-input text-xs font-mono font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 mb-1">
                      Danh mục <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={itemCat}
                      onChange={(e) => setItemCat(e.target.value)}
                      className="w-full px-3 py-2.5 clay-input text-xs font-bold text-gray-800 cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Giá bán cơ bản (VNĐ) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      required
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 clay-input text-xs font-black text-[#214E34]"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">
                      đ
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 clay-inset">
                  <div>
                    <span className="text-xs font-black text-gray-800 block">
                      Trạng thái món
                    </span>
                    <span className="text-[10px] text-gray-500 font-semibold">
                      {itemInStock ? 'Món đang sẵn sàng phục vụ' : 'Tạm hết nguyên liệu'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setItemInStock(!itemInStock);
                    }}
                    className={`min-h-[34px] px-3 py-1 rounded-[12px] text-xs font-black transition-all flex items-center gap-1.5 border cursor-pointer ${
                      itemInStock
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}
                  >
                    {itemInStock ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Còn hàng</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Hết hàng</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Topping Config */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-gray-700">
                      Topping áp dụng ({itemToppingConfigs.filter((c) => c.enabled).length}/{toppings.length})
                    </label>
                    <div className="flex items-center gap-1.5 text-[10.5px]">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setItemToppingConfigs((prev) =>
                            prev.map((c) => ({ ...c, enabled: true }))
                          );
                        }}
                        className="text-[#214E34] font-black hover:underline cursor-pointer"
                      >
                        Chọn tất
                      </button>
                      <span className="text-gray-300">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setItemToppingConfigs((prev) =>
                            prev.map((c) => ({ ...c, enabled: false }))
                          );
                        }}
                        className="text-gray-400 font-bold hover:underline cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  <div className="max-h-44 overflow-y-auto no-scrollbar p-2.5 clay-inset space-y-2">
                    {toppings.map((top) => {
                      const cfg = itemToppingConfigs.find((c) => c.toppingId === top.id) || {
                        toppingId: top.id,
                        enabled: false,
                        priceOverride: ''
                      };

                      return (
                        <div
                          key={top.id}
                          className={`p-2.5 rounded-[12px] border text-xs transition-colors flex items-center justify-between gap-2 ${
                            cfg.enabled
                              ? 'bg-white border-gray-200 shadow-xs'
                              : 'bg-gray-100/60 border-transparent opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setItemToppingConfigs((prev) =>
                                  prev.map((c) =>
                                    c.toppingId === top.id ? { ...c, enabled: !c.enabled } : c
                                  )
                                );
                              }}
                              className="text-gray-700 shrink-0 cursor-pointer"
                            >
                              {cfg.enabled ? (
                                <CheckSquare className="w-4 h-4 text-[#214E34]" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                            <div className="truncate">
                              <span className="font-extrabold text-gray-800 block truncate">
                                {top.name}
                              </span>
                              <span className="text-[10px] text-gray-400 block font-semibold">
                                {top.isGlobal ? 'Chung' : 'Riêng'} • Gốc: {formatVND(top.price)}
                              </span>
                            </div>
                          </div>

                          {cfg.enabled && (
                            <div className="shrink-0 flex items-center gap-1">
                              <input
                                type="number"
                                step="1000"
                                placeholder="Giá riêng"
                                value={cfg.priceOverride}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setItemToppingConfigs((prev) =>
                                    prev.map((c) =>
                                      c.toppingId === top.id ? { ...c, priceOverride: val } : c
                                    )
                                  );
                                }}
                                className="w-20 px-2 py-1 bg-[#F5F7F4] border border-gray-200 rounded-[10px] text-[10.5px] font-black text-[#214E34] focus:bg-white focus:outline-none"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mô tả ngắn */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Mô tả ngắn gọn
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Ghi chú hương vị, nguyên liệu đặc trưng..."
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                    className="w-full px-3.5 py-2 clay-input text-xs font-medium resize-none text-gray-800"
                  />
                </div>
              </div>

              {/* Pinned Action Footer with Safe-Area Padding */}
              <div className="shrink-0 p-3 sm:px-5 sm:py-3.5 bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center gap-2 pb-[max(14px,env(safe-area-inset-bottom,14px))]">
                <button
                  type="button"
                  disabled={isSavingItem}
                  onClick={() => {
                    triggerHaptic('light');
                    setIsItemModalOpen(false);
                  }}
                  className="flex-1 min-h-[44px] py-2 rounded-[16px] text-xs font-bold text-gray-600 clay-pill-btn active:scale-97 cursor-pointer transition-all disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingItem}
                  className="flex-1 min-h-[44px] py-2 rounded-[16px] text-xs font-black text-white clay-btn-primary active:scale-97 cursor-pointer transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {isSavingItem ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>{editingItem ? 'Lưu thay đổi' : 'Thêm món'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* ================= MODAL: THÊM / SỬA DANH MỤC ================= */}
      {isCategoryModalOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-modal-title"
            className="fixed inset-0 z-[9000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-fadeIn select-none"
          >
            <form
              onSubmit={handleSaveCategory}
              className="clay-card rounded-[28px] w-full max-w-[360px] h-full max-h-[min(90dvh,640px)] flex flex-col p-0 overflow-hidden shadow-2xl bg-white animate-slideUp"
            >
              <div className="shrink-0 px-5 py-3.5 bg-gradient-to-r from-[#214E34] to-[#2E6744] text-white flex items-center justify-between shadow-xs">
                <div>
                  <h3 id="category-modal-title" className="font-black text-sm">
                    {editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
                  </h3>
                  <p className="text-[10px] text-emerald-200 font-semibold">
                    Phân loại cho menu nước và đồ ăn
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setIsCategoryModalOpen(false);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white cursor-pointer transition-colors"
                  title="Đóng"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-touch-contain p-4 sm:p-5 space-y-4 no-scrollbar">
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Tên danh mục <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Sữa chua, Đồ ăn vặt, Freeze..."
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full px-3.5 py-2.5 clay-input text-xs font-bold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1.5">
                    Chọn biểu tượng
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {AVAILABLE_ICONS.map((ic) => {
                      const IconComponent = ic.icon;
                      const isSelected = catIcon === ic.name;
                      return (
                        <button
                          key={ic.name}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setCatIcon(ic.name);
                          }}
                          className={`p-2.5 rounded-[14px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                            isSelected
                              ? 'clay-btn-primary shadow-sm text-white'
                              : 'clay-pill-btn text-gray-600'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                          <span className="text-[10px] font-bold">{ic.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {editingCategory && (
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('warning');
                        setIsCategoryModalOpen(false);
                        setDeleteConfirmation({
                          type: 'category',
                          id: editingCategory.id,
                          name: editingCategory.name
                        });
                      }}
                      className="w-full py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-[14px] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa danh mục này</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="shrink-0 p-3 sm:px-5 sm:py-3.5 bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center gap-2 pb-[max(14px,env(safe-area-inset-bottom,14px))]">
                <button
                  type="button"
                  disabled={isSavingCategory}
                  onClick={() => {
                    triggerHaptic('light');
                    setIsCategoryModalOpen(false);
                  }}
                  className="flex-1 min-h-[44px] py-2 rounded-[16px] text-xs font-bold text-gray-600 clay-pill-btn active:scale-97 cursor-pointer transition-all disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="flex-1 min-h-[44px] py-2 rounded-[16px] text-xs font-black text-white clay-btn-primary active:scale-97 cursor-pointer transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {isSavingCategory ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>{editingCategory ? 'Lưu danh mục' : 'Thêm danh mục'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* ================= MODAL: CONFIRM DELETE SAFETY ================= */}
      {deleteConfirmation &&
        createPortal(
          <div className="fixed inset-0 z-[9900] bg-black/40 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
            <div className="clay-card rounded-[28px] w-full max-w-[320px] p-5 flex flex-col items-center text-center animate-slideUp">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3 shadow-inner">
                <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
              </div>

              <h4 className="font-black text-sm text-gray-900 mb-1">
                Xác nhận xóa {deleteConfirmation.type === 'item' ? 'món' : 'danh mục'}?
              </h4>
              <p className="text-xs text-gray-500 mb-4 px-2 leading-relaxed font-semibold">
                Bạn có chắc chắn muốn xóa{' '}
                <span className="font-bold text-gray-900">
                  "{deleteConfirmation.name}"
                </span>
                ? Thao tác này không thể hoàn tác.
              </p>

              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation(null)}
                  className="flex-1 min-h-[44px] py-2 rounded-[16px] text-xs font-bold text-gray-600 clay-pill-btn cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 min-h-[44px] py-2 rounded-[16px] text-xs font-black text-white bg-rose-600 hover:bg-rose-700 active:scale-97 shadow-sm cursor-pointer"
                >
                  Xóa ngay
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
