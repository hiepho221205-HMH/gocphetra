import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePos } from '../../store/PosContext';
import {
  Sparkles,
  Search,
  Plus,
  X,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckSquare,
  Square
} from 'lucide-react';
import { formatVND } from '../../utils/currency';

export default function ToppingManagerModal({ isOpen, onClose }) {
  const {
    toppings,
    productToppings,
    menu,
    addToppingItem,
    updateToppingItem,
    deleteToppingItem,
    toggleToppingStock,
    showToast
  } = usePos();

  // Sub-modal stack: null | 'form' | 'delete'
  const [subModal, setSubModal] = useState(null);
  const [editingTopping, setEditingTopping] = useState(null);
  const [deletingTopping, setDeletingTopping] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter & Search states (preserved across CRUD operations)
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'global' | 'specific'
  const [searchQuery, setSearchQuery] = useState('');

  // Form input states
  const [topName, setTopName] = useState('');
  const [topPrice, setTopPrice] = useState(10000);
  const [topInStock, setTopInStock] = useState(true);
  const [topIsGlobal, setTopIsGlobal] = useState(true);
  // Specific product links with optional price overrides: { [productId]: { selected: boolean, override: string | number } }
  const [topProductLinks, setTopProductLinks] = useState({});

  // Lock body scroll when modal or any sub-modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle ESC key for modal stack
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (subModal) {
          setSubModal(null);
          setEditingTopping(null);
          setDeletingTopping(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, subModal, onClose]);

  // Filtered toppings
  const filteredToppings = useMemo(() => {
    return toppings.filter((tp) => {
      const matchTab =
        filterTab === 'all' ||
        (filterTab === 'global' && tp.isGlobal) ||
        (filterTab === 'specific' && !tp.isGlobal);
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q || tp.name.toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [toppings, filterTab, searchQuery]);

  // ================= ACTION HANDLERS =================
  const handleOpenAdd = () => {
    setEditingTopping(null);
    setTopName('');
    setTopPrice(10000);
    setTopInStock(true);
    setTopIsGlobal(true);
    setTopProductLinks({});
    setSubModal('form');
  };

  const handleOpenEdit = (tp) => {
    setEditingTopping(tp);
    setTopName(tp.name);
    setTopPrice(tp.price);
    setTopInStock(tp.inStock !== false);
    setTopIsGlobal(tp.isGlobal !== false);

    // Load existing links for this topping
    const existingLinks = productToppings.filter((pt) => pt.toppingId === tp.id);
    const linkMap = {};
    menu.forEach((prod) => {
      const link = existingLinks.find((l) => l.productId === prod.id);
      linkMap[prod.id] = {
        selected: !!link || tp.isGlobal,
        override: link?.priceOverride !== null && link?.priceOverride !== undefined ? link.priceOverride : ''
      };
    });
    setTopProductLinks(linkMap);
    setSubModal('form');
  };

  const handleOpenDelete = (tp) => {
    setDeletingTopping(tp);
    setSubModal('delete');
  };

  const handleSaveTopping = (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanName = topName.trim();
    if (!cleanName) {
      showToast('Vui lòng nhập tên topping!', 'error');
      return;
    }

    const cleanPrice = Number(topPrice);
    if (isNaN(cleanPrice) || cleanPrice < 0) {
      showToast('Giá bán phải là số hợp lệ không âm!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Convert link map to array of { productId, priceOverride }
      const linkedProducts = Object.entries(topProductLinks)
        .filter(([_, conf]) => conf.selected)
        .map(([prodId, conf]) => ({
          productId: prodId,
          priceOverride: conf.override !== '' && !isNaN(Number(conf.override)) ? Number(conf.override) : null
        }));

      const payload = {
        name: cleanName,
        price: cleanPrice,
        inStock: topInStock,
        isGlobal: topIsGlobal,
        linkedProducts
      };

      if (editingTopping) {
        updateToppingItem(editingTopping.id, payload);
      } else {
        addToppingItem(payload);
      }

      // Close ONLY the sub-modal form; KEEP Topping Manager open!
      setSubModal(null);
      setEditingTopping(null);
    } catch (err) {
      console.error('Lỗi khi lưu topping:', err);
      showToast('Có lỗi xảy ra khi lưu topping!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingTopping || isSubmitting) return;

    setIsSubmitting(true);
    try {
      deleteToppingItem(deletingTopping.id);
      // Close ONLY the delete sub-modal; KEEP Topping Manager open!
      setSubModal(null);
      setDeletingTopping(null);
    } catch (err) {
      console.error('Lỗi khi xóa topping:', err);
      showToast('Có lỗi xảy ra khi xóa topping!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* ================= 1. MÀN QUẢN LÝ TOPPING (MAIN MANAGER LAYER - z-[9000]) ================= */}
      {createPortal(
        <div className="fixed inset-0 z-[9000] bg-black/55 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-[390px] h-[92vh] max-h-[720px] flex flex-col shadow-2xl overflow-hidden border border-stone-200 animate-slideUp">
            {/* Header */}
            <div className="px-4 py-3 bg-[#214E34] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <div>
                  <h3 className="font-extrabold text-sm leading-tight">Quản lý Topping</h3>
                  <p className="text-[10px] text-emerald-200/90">
                    Topping chung & giá riêng cho từng món
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="px-2.5 py-1 bg-white text-[#214E34] rounded-lg text-xs font-bold hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>Thêm</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-colors"
                  title="Đóng về Thực đơn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-Tabs: Tất cả / Topping chung / Topping riêng */}
            <div className="p-2.5 pb-1.5 border-b border-stone-100 bg-stone-50/70 space-y-2 shrink-0">
              <div className="grid grid-cols-3 gap-1 bg-stone-200/70 p-0.5 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`py-1.5 rounded-lg transition-all ${
                    filterTab === 'all'
                      ? 'bg-white text-[#214E34] shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Tất cả ({toppings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('global')}
                  className={`py-1.5 rounded-lg transition-all ${
                    filterTab === 'global'
                      ? 'bg-white text-[#214E34] shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Chung ({toppings.filter((t) => t.isGlobal).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('specific')}
                  className={`py-1.5 rounded-lg transition-all ${
                    filterTab === 'specific'
                      ? 'bg-white text-[#214E34] shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Riêng ({toppings.filter((t) => !t.isGlobal).length})
                </button>
              </div>

              {/* Search Topping */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm tên topping..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-[#214E34]"
                />
              </div>
            </div>

            {/* Topping List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
              {filteredToppings.length === 0 ? (
                <div className="text-center py-12 text-stone-400">
                  <Sparkles className="w-8 h-8 mx-auto mb-1.5 text-stone-300" />
                  <p className="text-xs font-semibold text-stone-600">Không tìm thấy topping</p>
                  <p className="text-[11px] text-stone-400">Nhấn "+ Thêm" để tạo loại topping mới.</p>
                </div>
              ) : (
                filteredToppings.map((tp) => {
                  const linkedCount = productToppings.filter((pt) => pt.toppingId === tp.id).length;
                  const overrideCount = productToppings.filter(
                    (pt) => pt.toppingId === tp.id && pt.priceOverride !== null
                  ).length;

                  return (
                    <div
                      key={tp.id}
                      className="p-3 bg-stone-50 border border-stone-200/80 rounded-2xl flex items-center justify-between gap-2.5 hover:bg-white transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h4 className="font-bold text-xs sm:text-[13px] text-stone-900 truncate">
                            {tp.name}
                          </h4>
                          {/* Badge Chung vs Riêng */}
                          {tp.isGlobal ? (
                            <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800">
                              Chung
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800">
                              Riêng ({linkedCount} món)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-extrabold text-[#214E34]">
                            {formatVND(tp.price)}
                          </span>
                          {overrideCount > 0 && (
                            <span className="text-[10px] text-stone-400">
                              • {overrideCount} món có giá riêng
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Toggle Stock */}
                        <button
                          type="button"
                          onClick={() => toggleToppingStock(tp.id)}
                          className={`min-h-[34px] px-2 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1 ${
                            tp.inStock
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                          }`}
                          title="Bật/Tắt còn hàng topping"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              tp.inStock ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          ></span>
                          <span>{tp.inStock ? 'Còn' : 'Hết'}</span>
                        </button>

                        {/* Edit Topping */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tp)}
                          className="min-h-[34px] w-8 rounded-xl bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-100 active:scale-95 flex items-center justify-center transition-colors"
                          title="Chỉnh sửa topping"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Topping */}
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(tp)}
                          className="min-h-[34px] w-8 rounded-xl bg-white border border-stone-200 text-stone-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 flex items-center justify-center transition-colors"
                          title="Xóa topping"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ================= 2. POPUP THÊM / SỬA TOPPING (SUB-MODAL - z-[9500]) ================= */}
      {subModal === 'form' &&
        createPortal(
          <div className="fixed inset-0 z-[9500] bg-black/40 backdrop-blur-2xs flex items-center justify-center p-3 animate-fadeIn">
            <div className="bg-white rounded-3xl w-full max-w-[360px] max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden border border-stone-200 animate-slideUp">
              {/* Header (Cố định) */}
              <div className="px-4 py-3 bg-[#214E34] text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-extrabold text-sm">
                    {editingTopping ? 'Chỉnh sửa Topping' : 'Thêm Topping mới'}
                  </h3>
                  <p className="text-[10px] text-emerald-200/90">
                    Cấu hình giá mặc định và áp dụng cho món
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSubModal(null);
                    setEditingTopping(null);
                  }}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body (Cuộn độc lập) */}
              <form onSubmit={handleSaveTopping} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-4 space-y-3.5 overflow-y-auto no-scrollbar flex-1">
                  {/* Tên topping */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Tên topping <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Trân châu đường đen, Thạch phô mai..."
                      value={topName}
                      onChange={(e) => setTopName(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#214E34] focus:bg-white transition-colors"
                    />
                  </div>

                  {/* Giá mặc định */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Giá bán mặc định (VNĐ) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="1000"
                        min="0"
                        required
                        value={topPrice}
                        onChange={(e) => setTopPrice(e.target.value)}
                        className="w-full pl-3 pr-10 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-extrabold text-[#214E34] focus:outline-none focus:border-[#214E34] focus:bg-white transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                        đ
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-400 mt-1">
                      Giá này áp dụng cho các món không cài đặt giá riêng.
                    </p>
                  </div>

                  {/* Phân loại: Topping chung hay Topping riêng */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      Phạm vi áp dụng
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTopIsGlobal(true)}
                        className={`p-2 rounded-xl border text-left text-xs transition-all ${
                          topIsGlobal
                            ? 'bg-emerald-50 border-[#214E34] text-[#214E34] font-bold shadow-2xs'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        <span className="block font-bold">Topping chung</span>
                        <span className="text-[10px] text-stone-500 font-normal">
                          Dùng chung cho tất cả món
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTopIsGlobal(false)}
                        className={`p-2 rounded-xl border text-left text-xs transition-all ${
                          !topIsGlobal
                            ? 'bg-emerald-50 border-[#214E34] text-[#214E34] font-bold shadow-2xs'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        <span className="block font-bold">Topping riêng</span>
                        <span className="text-[10px] text-stone-500 font-normal">
                          Chỉ cho món được chỉ định
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Cấu hình danh sách món & Ghi đè giá riêng nếu có */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-700">
                      {topIsGlobal ? 'Tùy chọn ghi đè giá theo món' : 'Chỉ định món áp dụng & giá riêng'}
                    </label>
                    <div className="max-h-40 overflow-y-auto no-scrollbar p-2 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                      {menu.map((prod) => {
                        const isSelected = topIsGlobal ? true : Boolean(topProductLinks[prod.id]?.selected);
                        const overrideVal = topProductLinks[prod.id]?.override ?? '';

                        return (
                          <div
                            key={prod.id}
                            className={`p-2 rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 ${
                              isSelected ? 'bg-white border-stone-300' : 'bg-stone-100/60 border-stone-200/60 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {!topIsGlobal && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTopProductLinks((prev) => ({
                                      ...prev,
                                      [prod.id]: {
                                        ...prev[prod.id],
                                        selected: !prev[prod.id]?.selected
                                      }
                                    }));
                                  }}
                                  className="text-stone-700"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-[#214E34]" />
                                  ) : (
                                    <Square className="w-4 h-4 text-stone-400" />
                                  )}
                                </button>
                              )}
                              <span className="font-semibold text-stone-800 truncate">
                                {prod.name}
                              </span>
                            </div>

                            {isSelected && (
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  step="1000"
                                  placeholder={`Mặc định (${formatVND(topPrice)})`}
                                  value={overrideVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTopProductLinks((prev) => ({
                                      ...prev,
                                      [prod.id]: {
                                        selected: true,
                                        override: val
                                      }
                                    }));
                                  }}
                                  className="w-24 px-2 py-1 bg-stone-50 border border-stone-200 rounded text-[11px] font-bold text-[#214E34] focus:bg-white focus:outline-none"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons (Cố định, luôn nhìn thấy) */}
                <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setSubModal(null);
                      setEditingTopping(null);
                    }}
                    className="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 active:scale-97 transition-colors disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-extrabold text-white bg-[#214E34] hover:bg-[#1a3e29] active:scale-97 shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <span>Đang lưu...</span>
                    ) : (
                      <span>{editingTopping ? 'Lưu thay đổi' : 'Thêm Topping'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ================= 3. POPUP XÁC NHẬN XÓA TOPPING (ALERT MODAL - z-[9900]) ================= */}
      {subModal === 'delete' && deletingTopping &&
        createPortal(
          <div className="fixed inset-0 z-[9900] bg-black/40 backdrop-blur-2xs flex items-center justify-center p-3 animate-fadeIn">
            <div className="bg-white rounded-3xl w-full max-w-[320px] p-4 flex flex-col items-center text-center shadow-2xl border border-stone-200 animate-slideUp">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3 shadow-inner">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>

              <h4 className="font-extrabold text-sm text-stone-900 mb-1">
                Xác nhận xóa topping?
              </h4>
              <p className="text-xs text-stone-500 mb-4 px-2 leading-relaxed">
                Bạn có chắc chắn muốn xóa topping{' '}
                <span className="font-bold text-stone-800">
                  "{deletingTopping.name}"
                </span>
                ? Thao tác này không thể hoàn tác.
              </p>

              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setSubModal(null);
                    setDeletingTopping(null);
                  }}
                  className="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 active:scale-97 transition-colors disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmDelete}
                  className="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 active:scale-97 shadow-sm transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  {isSubmitting ? 'Đang xóa...' : 'Xóa ngay'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
