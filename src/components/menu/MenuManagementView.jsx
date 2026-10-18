import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePos } from '../../store/PosContext';
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
    toggleProductStock,
    getProductToppings,
    setProductToppingLinks,
    addToppingItem,
    updateToppingItem,
    deleteToppingItem,
    toggleToppingStock
  } = usePos();

  // Active Category: 'all' is the virtual system category (default)
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals for Item
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Modals for Category
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // Modal / Drawer for Topping Management (delegated to ToppingManagerModal)
  const [isToppingManagerOpen, setIsToppingManagerOpen] = useState(false);

  // Safety Confirmation Modal (for items and categories)
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // { type: 'item' | 'category', id, name }

  // Form states for Item
  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemCat, setItemCat] = useState(categories[0]?.id || 'cat-coffee');
  const [itemPrice, setItemPrice] = useState(35000);
  const [itemInStock, setItemInStock] = useState(true);
  const [itemDesc, setItemDesc] = useState('');
  // Item's topping links config: array of { toppingId, enabled, priceOverride: number | '' }
  const [itemToppingConfigs, setItemToppingConfigs] = useState([]);

  // Form states for Category
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('Coffee');

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
    setEditingItem(null);
    setItemName('');
    const nextNum = menu.length + 1;
    setItemCode(`M${nextNum < 10 ? '0' + nextNum : nextNum}`);
    const defaultCat = selectedCat !== 'all' ? selectedCat : (categories[0]?.id || 'cat-coffee');
    setItemCat(defaultCat);
    setItemPrice(35000);
    setItemInStock(true);
    setItemDesc('');

    // Pre-populate topping configs
    // Global toppings are enabled by default with null priceOverride
    const initialConfigs = toppings.map((tp) => ({
      toppingId: tp.id,
      enabled: Boolean(tp.isGlobal),
      priceOverride: ''
    }));
    setItemToppingConfigs(initialConfigs);

    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item) => {
    setEditingItem(item);
    setItemName(item.name || '');
    setItemCode(item.code || '');
    setItemCat(item.categoryId || (categories[0]?.id || 'cat-coffee'));
    setItemPrice(item.basePrice || 0);
    setItemInStock(item.inStock !== false);
    setItemDesc(item.description || '');

    // Load existing topping links for this item
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
    if (!itemName.trim()) return;

    // Filter active topping links
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
      basePrice: Number(itemPrice) || 0,
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
  };

  // ================= CATEGORY MODAL HANDLERS =================
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatIcon('Coffee');
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat, e) => {
    e.stopPropagation();
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatIcon(cat.icon || 'Coffee');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e) => {
    e.preventDefault();
    if (!catName.trim()) return;

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
  };

  // ================= DELETE CONFIRMATION HANDLER (FOR ITEM / CATEGORY) =================
  const confirmDelete = () => {
    if (!deleteConfirmation) return;
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
    <div className="flex flex-col h-[calc(100dvh-64px)] sm:h-[780px] bg-[#F8FAF8] overflow-hidden select-none">
      {/* Tiêu đề trang: Thực đơn */}
      <div className="px-4 pt-3.5 pb-2 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shrink-0">
        <h2 className="text-lg font-black text-forest-900 tracking-tight leading-none">
          Thực đơn
        </h2>
        <p className="text-[11px] text-gray-500 mt-0.5">
          Quản lý danh mục, món bán & công thức topping
        </p>
      </div>

      {/* 2-COLUMN SPLIT-VIEW POS MENU MANAGEMENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* ================= LEFT SIDEBAR: CATEGORIES & ACTIONS (~116px) ================= */}
        <aside className="w-[114px] sm:w-[124px] shrink-0 border-r border-stone-200/90 bg-white/95 backdrop-blur-md flex flex-col justify-between overflow-hidden shadow-xs">
          {/* Top Quick Actions (3 buttons: Thêm món, Thêm mục, Topping) */}
          <div className="p-2 space-y-1.5 border-b border-stone-100 bg-stone-50/50">
            {/* Action 1: + Thêm món (Xanh #214E34 nổi bật) */}
            <button
              onClick={handleOpenAddItem}
              className="w-full min-h-[40px] px-2 py-1.5 bg-[#214E34] text-white rounded-xl text-[11px] font-extrabold shadow-sm hover:bg-[#1a3e29] active:scale-[0.97] transition-all flex items-center justify-center gap-1 leading-tight text-center"
              title="Thêm món mới vào thực đơn"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Thêm món</span>
            </button>

            {/* Action 2: + Thêm mục (Viền outline #214E34) */}
            <button
              onClick={handleOpenAddCategory}
              className="w-full min-h-[36px] px-2 py-1 bg-white border border-[#214E34]/40 text-[#214E34] hover:bg-forest-50/70 rounded-xl text-[11px] font-bold active:scale-[0.97] transition-all flex items-center justify-center gap-1 leading-tight text-center shadow-2xs"
              title="Thêm danh mục mới"
            >
              <FolderPlus className="w-3.5 h-3.5 shrink-0" />
              <span>Thêm mục</span>
            </button>

            {/* Action 3: Topping (Nút quản lý topping) */}
            <button
              onClick={() => setIsToppingManagerOpen(true)}
              className="w-full min-h-[36px] px-2 py-1 bg-amber-50/80 hover:bg-amber-100/80 border border-amber-300/80 text-amber-900 rounded-xl text-[11px] font-bold active:scale-[0.97] transition-all flex items-center justify-center gap-1 leading-tight text-center shadow-2xs"
              title="Mở màn hình Quản lý Topping"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Topping</span>
            </button>
          </div>

          {/* Vertical Categories List */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-1.5 space-y-1">
            {/* VIRTUAL SYSTEM CATEGORY: "Tất cả" (Cố định ở đầu, không cho sửa/xóa/đổi vị trí) */}
            <div
              onClick={() => setSelectedCat('all')}
              className={`w-full min-h-[50px] px-2 py-1.5 rounded-xl text-left cursor-pointer transition-all duration-200 flex flex-col justify-center ${
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

            {/* REAL USER CATEGORIES (Editable & Deletable) */}
            {categories.map((cat) => {
              const isActive = selectedCat === cat.id;
              const IconComp = CATEGORY_ICON_MAP[cat.icon] || Coffee;
              const count = categoryCounts[cat.id] ?? 0;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  className={`group relative w-full min-h-[50px] px-2 py-1.5 rounded-xl text-left cursor-pointer transition-all duration-200 flex flex-col justify-center ${
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

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] leading-tight font-semibold truncate pr-1">
                      {cat.name}
                    </span>

                    {/* Edit button for real category */}
                    <button
                      onClick={(e) => handleOpenEditCategory(cat, e)}
                      className={`opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 transition-opacity ${
                        isActive ? 'text-white' : 'text-stone-500'
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
          <div className="p-2 border-t border-stone-100 text-center bg-stone-50/40">
            <span className="text-[10px] text-stone-400 font-medium block">
              {menu.length} món • {toppings.length} topping
            </span>
          </div>
        </aside>

        {/* ================= RIGHT COLUMN: ITEM LIST & QUICK ACTIONS (~276px) ================= */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#F4F6F4]/50 overflow-hidden">
          {/* Header Bar */}
          <div className="p-2.5 pb-2 border-b border-stone-200/70 bg-white/80 backdrop-blur-md sticky top-0 z-10 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-[#214E34] flex items-center gap-1.5">
                  <span>{activeCategoryTitle}</span>
                  <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                    {filteredItems.length} món
                  </span>
                </h2>
              </div>

              {/* Edit category link if real category */}
              {selectedCat !== 'all' && (
                <button
                  onClick={(e) => {
                    const catObj = categories.find((c) => c.id === selectedCat);
                    if (catObj) handleOpenEditCategory(catObj, e);
                  }}
                  className="text-[10px] text-stone-500 hover:text-[#214E34] flex items-center gap-1 font-medium px-2 py-1 rounded-lg hover:bg-stone-100 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Sửa mục</span>
                </button>
              )}
            </div>

            {/* Quick Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên hoặc mã món..."
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

          {/* Scrollable Item Cards List */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-2.5 space-y-2 pb-20">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-stone-400">
                <Coffee className="w-10 h-10 mb-2 stroke-[1.5] text-stone-300" />
                <p className="text-xs font-semibold text-stone-600">
                  {searchQuery ? 'Không tìm thấy món phù hợp' : 'Chưa có món nào trong mục này'}
                </p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Nhấn "+ Thêm món" ở cột trái để tạo món mới.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white/95 backdrop-blur-sm border rounded-2xl p-2.5 shadow-2xs hover:shadow-xs transition-all duration-200 space-y-1.5 ${
                    item.inStock
                      ? 'border-stone-200/80 hover:border-emerald-300/60'
                      : 'border-rose-200/70 bg-rose-50/20'
                  }`}
                >
                  {/* Card Header: Tên món + Chấm tròn trạng thái duy nhất (Xanh hoặc Đỏ) */}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-stone-900 text-xs sm:text-[13px] leading-snug truncate">
                      {item.name}
                    </h3>

                    {/* Trạng thái món: CHỈ hiển thị chấm xanh hoặc chấm đỏ */}
                    <div className="shrink-0 flex items-center pr-1">
                      {item.inStock ? (
                        <span
                          className="relative flex h-2.5 w-2.5"
                          title="Còn hàng"
                        >
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-2xs"></span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-2xs"
                          title="Hết hàng"
                        ></span>
                      )}
                    </div>
                  </div>

                  {/* Mô tả ngắn (nếu có) */}
                  {item.description && (
                    <p className="text-[10.5px] text-stone-500 line-clamp-1 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  {/* Đơn giá bán (To, rõ nét - Đã loại bỏ hoàn toàn các dòng đếm topping) */}
                  <div className="flex items-baseline justify-between pt-0.5">
                    <span className="text-sm font-black text-[#214E34]">
                      {formatVND(item.basePrice)}
                    </span>
                    {item.code && (
                      <span className="font-mono text-[9px] text-stone-400">
                        {item.code}
                      </span>
                    )}
                  </div>

                  {/* HÀNG NÚT 1-CHẠM: Bật/Tắt, Sửa, Xóa */}
                  <div className="grid grid-cols-6 gap-1 pt-1 border-t border-stone-100/90">
                    {/* Nút 1: Bật / Tắt trạng thái 1-chạm (Col span 3) */}
                    <button
                      onClick={() => toggleProductStock(item.id)}
                      className={`col-span-3 min-h-[36px] px-2 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.97] border ${
                        item.inStock
                          ? 'bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border-emerald-200/80'
                          : 'bg-rose-50 hover:bg-rose-100/80 text-rose-800 border-rose-200/80'
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

                    {/* Nút 2: Sửa món / Chỉnh giá (Col span 2) */}
                    <button
                      onClick={() => handleOpenEditItem(item)}
                      className="col-span-2 min-h-[36px] px-2 py-1 rounded-xl text-[11px] font-bold bg-stone-100 hover:bg-stone-200/80 text-stone-700 transition-all flex items-center justify-center gap-1 active:scale-[0.97]"
                      title="Chỉnh sửa thông tin món và cấu hình topping"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-stone-600" />
                      <span>Sửa</span>
                    </button>

                    {/* Nút 3: Xóa món (Col span 1) */}
                    <button
                      onClick={() =>
                        setDeleteConfirmation({
                          type: 'item',
                          id: item.id,
                          name: item.name
                        })
                      }
                      className="col-span-1 min-h-[36px] px-2 py-1 rounded-xl text-[11px] font-bold bg-stone-100 hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-all flex items-center justify-center active:scale-[0.97]"
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

      {/* ================= MODAL: QUẢN LÝ TOPPING (PORTAL MODAL STACK) ================= */}
      <ToppingManagerModal
        isOpen={isToppingManagerOpen}
        onClose={() => setIsToppingManagerOpen(false)}
      />

      {/* ================= MODAL: THÊM / SỬA MÓN ================= */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-[380px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-stone-200">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-[#214E34] text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm">
                  {editingItem ? 'Chỉnh sửa món' : 'Thêm món mới'}
                </h3>
                <p className="text-[10px] text-emerald-200/90">
                  {editingItem ? `Mã món: ${editingItem.code || 'Chưa có'}` : 'Nhập thông tin sản phẩm'}
                </p>
              </div>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveItem} className="p-4 space-y-3.5 overflow-y-auto no-scrollbar flex-1">
              {/* Tên món */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Tên món <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Cà phê sữa đá, Trà sen vàng..."
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#214E34] focus:bg-white"
                />
              </div>

              {/* Mã món & Danh mục (Chỉ gồm các danh mục thực tế, KHÔNG CÓ "Tất cả") */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Mã món
                  </label>
                  <input
                    type="text"
                    placeholder="CF01, TS02..."
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-[#214E34] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Danh mục <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={itemCat}
                    onChange={(e) => setItemCat(e.target.value)}
                    className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#214E34] focus:bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Đơn giá bán */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
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
                    className="w-full pl-3 pr-10 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-extrabold text-[#214E34] focus:outline-none focus:border-[#214E34] focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                    đ
                  </span>
                </div>
              </div>

              {/* Trạng thái còn hàng / hết hàng */}
              <div className="flex items-center justify-between p-2.5 bg-stone-50 border border-stone-200 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-stone-800 block">
                    Trạng thái món
                  </span>
                  <span className="text-[10px] text-stone-500">
                    {itemInStock ? 'Món đang sẵn sàng phục vụ' : 'Tạm hết nguyên liệu'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setItemInStock(!itemInStock)}
                  className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
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

              {/* Cấu hình Topping áp dụng cho món & Ghi đè giá riêng nếu có */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700">
                    Topping áp dụng ({itemToppingConfigs.filter((c) => c.enabled).length}/{toppings.length})
                  </label>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        setItemToppingConfigs((prev) =>
                          prev.map((c) => ({ ...c, enabled: true }))
                        );
                      }}
                      className="text-[#214E34] font-bold hover:underline"
                    >
                      Chọn tất
                    </button>
                    <span className="text-stone-300">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        setItemToppingConfigs((prev) =>
                          prev.map((c) => ({ ...c, enabled: false }))
                        );
                      }}
                      className="text-stone-400 font-medium hover:underline"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                <div className="max-h-44 overflow-y-auto no-scrollbar p-2 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                  {toppings.map((top) => {
                    const cfg = itemToppingConfigs.find((c) => c.toppingId === top.id) || {
                      toppingId: top.id,
                      enabled: false,
                      priceOverride: ''
                    };

                    return (
                      <div
                        key={top.id}
                        className={`p-2 rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 ${
                          cfg.enabled
                            ? 'bg-white border-stone-300'
                            : 'bg-stone-100/60 border-stone-200/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => {
                              setItemToppingConfigs((prev) =>
                                prev.map((c) =>
                                  c.toppingId === top.id ? { ...c, enabled: !c.enabled } : c
                                )
                              );
                            }}
                            className="text-stone-700 shrink-0"
                          >
                            {cfg.enabled ? (
                              <CheckSquare className="w-4 h-4 text-[#214E34]" />
                            ) : (
                              <Square className="w-4 h-4 text-stone-400" />
                            )}
                          </button>
                          <div className="truncate">
                            <span className="font-semibold text-stone-800 block truncate">
                              {top.name}
                            </span>
                            <span className="text-[10px] text-stone-400 block">
                              {top.isGlobal ? 'Topping chung' : 'Topping riêng'} • Gốc: {formatVND(top.price)}
                            </span>
                          </div>
                        </div>

                        {cfg.enabled && (
                          <div className="shrink-0 flex items-center gap-1">
                            <input
                              type="number"
                              step="1000"
                              placeholder={`Giá riêng`}
                              value={cfg.priceOverride}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemToppingConfigs((prev) =>
                                  prev.map((c) =>
                                    c.toppingId === top.id ? { ...c, priceOverride: val } : c
                                  )
                                );
                              }}
                              className="w-20 px-1.5 py-1 bg-stone-50 border border-stone-200 rounded text-[10.5px] font-bold text-[#214E34] focus:bg-white focus:outline-none"
                              title="Để trống nếu muốn thừa hưởng giá chung"
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
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Mô tả ngắn gọn
                </label>
                <textarea
                  rows="2"
                  placeholder="Ghi chú hương vị, nguyên liệu đặc trưng..."
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#214E34] focus:bg-white resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-extrabold text-white bg-[#214E34] hover:bg-[#1a3e29] shadow-sm transition-all"
                >
                  {editingItem ? 'Lưu thay đổi' : 'Thêm món'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: THÊM / SỬA DANH MỤC ================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-[350px] flex flex-col shadow-2xl overflow-hidden border border-stone-200">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-[#214E34] text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm">
                  {editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
                </h3>
                <p className="text-[10px] text-emerald-200/90">
                  Phân loại cho menu nước và đồ ăn
                </p>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveCategory} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Tên danh mục <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Sữa chua, Đồ ăn vặt, Freeze..."
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#214E34] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
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
                        onClick={() => setCatIcon(ic.name)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                          isSelected
                            ? 'bg-emerald-50 border-[#214E34] text-[#214E34] font-bold shadow-2xs'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                        <span className="text-[10px]">{ic.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* If editing, allow delete */}
              {editingCategory && (
                <div className="pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryModalOpen(false);
                      setDeleteConfirmation({
                        type: 'category',
                        id: editingCategory.id,
                        name: editingCategory.name
                      });
                    }}
                    className="w-full py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa danh mục này</span>
                  </button>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-2 flex items-center gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-extrabold text-white bg-[#214E34] hover:bg-[#1a3e29] shadow-sm transition-all"
                >
                  {editingCategory ? 'Lưu danh mục' : 'Thêm danh mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONFIRM DELETE SAFETY (ITEMS & CATEGORIES) ================= */}
      {deleteConfirmation &&
        createPortal(
          <div className="fixed inset-0 z-[9900] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
            <div className="bg-white rounded-3xl w-full max-w-[320px] p-4 flex flex-col items-center text-center shadow-2xl border border-stone-200 animate-slideUp">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3 shadow-inner">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h4 className="font-extrabold text-sm text-stone-900 mb-1">
                Xác nhận xóa {deleteConfirmation.type === 'item' ? 'món' : 'danh mục'}?
              </h4>
              <p className="text-xs text-stone-500 mb-4 px-2 leading-relaxed">
                Bạn có chắc chắn muốn xóa{' '}
                <span className="font-bold text-stone-800">
                  "{deleteConfirmation.name}"
                </span>
                ? Thao tác này không thể hoàn tác.
              </p>

              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation(null)}
                  className="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 active:scale-97 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 active:scale-97 shadow-sm transition-all"
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
