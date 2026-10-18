import React, { useState, useEffect } from 'react';
import { usePos } from '../../store/PosContext';
import { X, Plus, Minus, Check, Coffee } from 'lucide-react';
import { formatVND } from '../../utils/currency';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-float overflow-hidden flex flex-col max-h-[90vh] animate-slideUp">
        {/* Header */}
        <div className="relative px-4 py-3.5 border-b border-gray-100 flex items-center justify-between bg-forest-50/40">
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-forest-900 leading-tight">
              {item.name}
            </h3>
            <span className="text-xs text-forest-700 font-bold">
              Giá gốc: {formatVND(basePrice)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Section 1: Chọn Size */}
          {item.sizes && item.sizes.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                1. Chọn Kích thước (Size)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {item.sizes.map((s) => {
                  const isSelected = selectedSize?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`touch-target flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-forest-800 text-white border-forest-800 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span>{s.name}</span>
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
            <div className="space-y-3 pt-1 border-t border-gray-100">
              {/* Đường */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  2. Mức ngọt (Đường)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['100%', '70%', '50%', '0%'].map((sw) => (
                    <button
                      key={sw}
                      type="button"
                      onClick={() => setSelectedSweetness(sw)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                        selectedSweetness === sw
                          ? 'bg-forest-700 text-white border-forest-700 font-bold'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {sw}
                    </button>
                  ))}
                </div>
              </div>

              {/* Đá */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  3. Lượng đá
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['100%', '70%', 'Không đá', 'Đá riêng'].map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setSelectedIce(ic)}
                      className={`py-1.5 px-1 rounded-lg text-[11px] font-medium border text-center transition-all ${
                        selectedIce === ic
                          ? 'bg-forest-700 text-white border-forest-700 font-bold'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Topping */}
          {applicableToppings.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                4. Topping thêm
              </label>
              <div className="space-y-1.5">
                {applicableToppings.map((tp) => {
                  const qty = selectedToppings[tp.id] || 0;
                  return (
                    <div
                      key={tp.id}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-colors ${
                        qty > 0 ? 'bg-forest-50/70 border-forest-300' : 'bg-gray-50/60 border-gray-200'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-gray-800">{tp.name}</div>
                        <div className="text-[10.5px] text-forest-700 font-bold">
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
                              className="w-6 h-6 rounded-md bg-white border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-bold text-xs text-forest-900 w-4 text-center">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToppingQtyChange(tp.id, 1, tp.maxQty)}
                              className="w-6 h-6 rounded-md bg-forest-800 text-white flex items-center justify-center hover:bg-forest-900"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToppingQtyChange(tp.id, 1, tp.maxQty)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-gray-300 text-gray-700 font-medium hover:bg-forest-50 hover:text-forest-800 hover:border-forest-400 transition-colors"
                          >
                            Thêm
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
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
              5. Ghi chú cho Barista
            </label>
            <input
              type="text"
              placeholder="VD: Mang đi, ít ngọt đậm vị trà..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800"
            />
          </div>
        </div>

        {/* Footer: Quantity Stepper & Add Button */}
        <div className="p-3.5 border-t border-gray-100 bg-white flex items-center gap-3">
          {/* Main Item Quantity Stepper */}
          <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg bg-white shadow-xs flex items-center justify-center text-gray-700 hover:bg-gray-50"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-7 text-center font-bold text-sm text-forest-900">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-lg bg-white shadow-xs flex items-center justify-center text-gray-700 hover:bg-gray-50"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add Button with Total */}
          <button
            type="button"
            onClick={handleConfirm}
            className="touch-target btn-press flex-1 py-2.5 px-4 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-between shadow-md"
          >
            <span>Thêm vào đơn</span>
            <span>{formatVND(lineTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
