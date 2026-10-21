import React, { useState, useEffect } from 'react';
import { usePos } from '../../store/PosContext';
import { X, Plus, Minus, Check, Coffee } from 'lucide-react';
import { formatVND } from '../../utils/currency';
import { triggerHaptic } from '../../utils/haptics';

export default function ItemCustomizerModal({ item, isOpen, onClose, onAddToCart }) {
  const { toppings, getProductToppings } = usePos();

  const [selectedSize, setSelectedSize] = useState(item?.sizes?.[0] || null);
  const [selectedSweetness, setSelectedSweetness] = useState('100%');
  const [selectedIce, setSelectedIce] = useState('100%');
  const [selectedToppings, setSelectedToppings] = useState({}); // { [toppingId]: quantity }
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (item) {
      setSelectedSize(item.sizes?.[0] || null);
      setSelectedSweetness('100%');
      setSelectedIce('100%');
      setSelectedToppings({});
      setNotes('');
      setQuantity(1);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  // Lấy danh sách topping áp dụng cho món (gồm Topping chung và Topping riêng, đã tính effectivePrice)
  const applicableToppings = (getProductToppings ? getProductToppings(item.id) : toppings).filter(
    (tp) => tp.inStock !== false
  );

  // Tăng/giảm số lượng topping
  const handleToppingQtyChange = (toppingId, delta, maxQty = 3) => {
    triggerHaptic('light');
    setSelectedToppings((prev) => {
      const current = prev[toppingId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[toppingId];
        return copy;
      }
      if (next > maxQty) return prev;
      return { ...prev, [toppingId]: next };
    });
  };

  // Tính tổng tiền realtime
  const basePrice = item.basePrice || 0;
  const sizePrice = selectedSize?.priceAdjustment || 0;
  const toppingsPrice = Object.entries(selectedToppings).reduce((sum, [tId, qty]) => {
    const tp = applicableToppings.find((t) => t.id === tId) || toppings.find((t) => t.id === tId);
    const price = tp?.effectivePrice !== undefined ? tp.effectivePrice : (tp?.price || 0);
    return sum + price * qty;
  }, 0);

  const unitPrice = basePrice + sizePrice + toppingsPrice;
  const lineTotal = unitPrice * quantity;

  const handleConfirm = () => {
    triggerHaptic('success');
    // Chuẩn bị mảng topping với giá snapshot tại thời điểm đặt đơn
    const finalToppings = Object.entries(selectedToppings).map(([tId, qty]) => {
      const tp = applicableToppings.find((t) => t.id === tId) || toppings.find((t) => t.id === tId);
      const price = tp?.effectivePrice !== undefined ? tp.effectivePrice : (tp?.price || 0);
      return {
        id: tp.id,
        name: tp.name,
        price: price,
        quantity: qty
      };
    });

    // Ghép ghi chú đường đá
    let fullNotes = notes.trim();
    const sweetIceNotes = [];
    if (item.categoryId !== 'cat-bakery') {
      if (selectedSweetness !== '100%') sweetIceNotes.push(`Đường: ${selectedSweetness}`);
      if (selectedIce !== '100%') sweetIceNotes.push(`Đá: ${selectedIce}`);
    }
    if (sweetIceNotes.length > 0) {
      fullNotes = (sweetIceNotes.join(', ') + (fullNotes ? ` • ${fullNotes}` : '')).trim();
    }

    onAddToCart({
      productId: item.id,
      name: item.name,
      basePrice,
      size: selectedSize?.id || 'Std',
      sizeName: selectedSize?.name || 'Mặc định',
      sizePrice,
      toppings: finalToppings,
      notes: fullNotes,
      quantity,
      unitPrice,
      lineTotal
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-sm clay-card p-0 rounded-b-none sm:rounded-b-[28px] overflow-hidden flex flex-col max-h-[90vh] animate-slideUp">
        {/* Header */}
        <div className="relative px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-[#F5F7F4]/80">
          <div>
            <h3 className="font-black text-sm sm:text-base text-[#214E34] leading-tight">
              {item.name}
            </h3>
            <span className="text-xs text-emerald-800 font-extrabold">
              Giá gốc: {formatVND(basePrice)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4.5 flex-1">
          {/* Section 1: Chọn Size */}
          {item.sizes && item.sizes.length > 0 && (
            <div>
              <label className="block text-[11px] font-extrabold text-gray-600 uppercase tracking-wider mb-2">
                1. Kích thước (Size)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {item.sizes.map((s) => {
                  const isSelected = selectedSize?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedSize(s);
                      }}
                      className={`touch-target flex flex-col items-center justify-center p-2.5 rounded-[16px] text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'clay-btn-primary shadow-md'
                          : 'clay-pill-btn text-gray-700'
                      }`}
                    >
                      <span className="text-xs font-extrabold">{s.name}</span>
                      <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-emerald-200' : 'text-gray-400'}`}>
                        {s.priceAdjustment > 0 ? `+${formatVND(s.priceAdjustment)}` : 'Mặc định'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Chọn Mức Đường & Đá (chỉ dành cho đồ uống) */}
          {item.categoryId !== 'cat-bakery' && (
            <div className="space-y-3.5 pt-2 border-t border-gray-100">
              {/* Đường */}
              <div>
                <label className="block text-[11px] font-extrabold text-gray-600 uppercase tracking-wider mb-2">
                  2. Mức ngọt (Đường)
                </label>
                <div className="clay-inset p-1 grid grid-cols-4 gap-1">
                  {['100%', '70%', '50%', '0%'].map((sw) => {
                    const isSelected = selectedSweetness === sw;
                    return (
                      <button
                        key={sw}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setSelectedSweetness(sw);
                        }}
                        className={`py-1.5 px-2 rounded-[12px] text-xs font-bold text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#214E34] text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {sw}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Đá */}
              <div>
                <label className="block text-[11px] font-extrabold text-gray-600 uppercase tracking-wider mb-2">
                  3. Lượng đá
                </label>
                <div className="clay-inset p-1 grid grid-cols-4 gap-1">
                  {['100%', '70%', 'Không đá', 'Đá riêng'].map((ic) => {
                    const isSelected = selectedIce === ic;
                    return (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setSelectedIce(ic);
                        }}
                        className={`py-1.5 px-1 rounded-[12px] text-[11px] font-bold text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#214E34] text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {ic}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Topping */}
          {applicableToppings.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-[11px] font-extrabold text-gray-600 uppercase tracking-wider mb-2">
                4. Topping thêm
              </label>
              <div className="space-y-2">
                {applicableToppings.map((tp) => {
                  const qty = selectedToppings[tp.id] || 0;
                  return (
                    <div
                      key={tp.id}
                      className={`flex items-center justify-between p-3 rounded-[16px] text-xs transition-all ${
                        qty > 0
                          ? 'bg-emerald-50/80 border border-emerald-400 shadow-sm'
                          : 'clay-card p-3 border-transparent'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-gray-800">{tp.name}</div>
                        <div className="text-[10.5px] text-[#214E34] font-black">
                          +{formatVND(tp.effectivePrice !== undefined ? tp.effectivePrice : tp.price)}
                        </div>
                      </div>

                      {/* Stepper Topping */}
                      <div className="flex items-center space-x-1.5">
                        {qty > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToppingQtyChange(tp.id, -1, tp.maxQty)}
                              className="w-7 h-7 rounded-[10px] bg-white text-gray-700 shadow-sm flex items-center justify-center font-bold active:scale-95 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-black text-xs text-[#214E34] w-5 text-center">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToppingQtyChange(tp.id, 1, tp.maxQty)}
                              className="w-7 h-7 rounded-[10px] clay-btn-primary flex items-center justify-center active:scale-95 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToppingQtyChange(tp.id, 1, tp.maxQty)}
                            className="px-3 py-1.5 rounded-[12px] clay-pill-btn text-xs font-bold text-gray-700 hover:text-[#214E34] cursor-pointer"
                          >
                            + Thêm
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Ghi chú */}
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-[11px] font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
              5. Ghi chú cho Barista
            </label>
            <input
              type="text"
              placeholder="VD: Mang đi, ít ngọt đậm vị trà..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-bold clay-input text-gray-800"
            />
          </div>
        </div>

        {/* Footer: Quantity Stepper & Add Button */}
        <div className="p-4 border-t border-gray-100 bg-white/95 backdrop-blur-md flex items-center gap-3">
          {/* Main Item Quantity Stepper 3D */}
          <div className="flex items-center space-x-1.5 clay-inset p-1.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setQuantity((q) => Math.max(1, q - 1));
              }}
              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 active:scale-95 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
            <span className="w-7 text-center font-black text-sm text-[#214E34]">{quantity}</span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setQuantity((q) => q + 1);
              }}
              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          {/* Add Button with Total */}
          <button
            type="button"
            onClick={handleConfirm}
            className="touch-target clay-btn-primary flex-1 py-3 px-4 font-black text-xs sm:text-sm flex items-center justify-between cursor-pointer"
          >
            <span>Thêm vào đơn</span>
            <span>{formatVND(lineTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
