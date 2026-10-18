import React from 'react';
import { usePos } from '../../store/PosContext';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { formatVND } from '../../utils/currency';

export default function CartItemList({ tableId, items }) {
  const { updateItemQuantity, removeItemFromOrder } = usePos();

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-xs">
        Chưa có món nào trong đơn
      </div>
    );
  }

  return (
    <div className="space-y-2.5 divide-y divide-gray-100">
      {items.map((item) => (
        <div key={item.cartItemId} className="pt-2.5 first:pt-0 flex items-start justify-between gap-2">
          {/* Item details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline space-x-1.5">
              <h5 className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                {item.name}
              </h5>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-forest-100 text-forest-800">
                {item.sizeName || item.size}
              </span>
            </div>

            {/* Toppings list */}
            {item.toppings && item.toppings.length > 0 && (
              <div className="text-[11px] text-gray-500 mt-0.5">
                + {item.toppings.map((tp) => `${tp.name} (x${tp.quantity || 1})`).join(', ')}
              </div>
            )}

            {/* Notes */}
            {item.notes && (
              <div className="text-[10.5px] text-forest-700 italic mt-0.5">
                📝 {item.notes}
              </div>
            )}

            {/* Unit Price */}
            <div className="text-[11px] font-semibold text-gray-600 mt-0.5">
              {formatVND(item.unitPrice)}
            </div>
          </div>

          {/* Stepper & Total */}
          <div className="flex flex-col items-end space-y-1 flex-shrink-0">
            <span className="font-extrabold text-xs sm:text-sm text-forest-900">
              {formatVND(item.lineTotal)}
            </span>

            <div className="flex items-center space-x-1 bg-gray-100 p-0.5 rounded-lg">
              {item.quantity === 1 ? (
                <button
                  type="button"
                  onClick={() => removeItemFromOrder(tableId, item.cartItemId)}
                  className="w-6 h-6 rounded-md bg-white text-rose-600 flex items-center justify-center hover:bg-rose-50 shadow-xs"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => updateItemQuantity(tableId, item.cartItemId, -1)}
                  className="w-6 h-6 rounded-md bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50 shadow-xs"
                >
                  <Minus className="w-3 h-3" />
                </button>
              )}

              <span className="w-5 text-center font-bold text-xs text-forest-900">
                {item.quantity}
              </span>

              <button
                type="button"
                onClick={() => updateItemQuantity(tableId, item.cartItemId, 1)}
                className="w-6 h-6 rounded-md bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50 shadow-xs"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
