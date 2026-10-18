import React from 'react';
import { Plus, ImageOff } from 'lucide-react';
import { formatVND } from '../../utils/currency';

export default function MenuItemCard({ item, onSelect }) {
  return (
    <div
      onClick={() => item.inStock && onSelect(item)}
      className={`relative rounded-2xl bg-white border border-gray-100 shadow-xs overflow-hidden flex flex-col justify-between transition-all duration-smooth select-none ${
        item.inStock
          ? 'cursor-pointer hover:shadow-md hover:border-forest-800/30 active:scale-[0.98]'
          : 'opacity-60 cursor-not-allowed bg-gray-50'
      }`}
    >
      {/* Product Image */}
      <div className="relative w-full h-28 bg-gray-100 overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <ImageOff className="w-6 h-6" />
          </div>
        )}

        {/* Out of Stock Overlay */}
        {!item.inStock && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center">
            <span className="px-2.5 py-1 text-[10px] font-bold text-white bg-rose-600 rounded-full uppercase tracking-wider">
              Hết hàng
            </span>
          </div>
        )}

        {/* Price Tag Floating */}
        <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-black/65 backdrop-blur-md text-white font-bold text-xs tracking-tight">
          {formatVND(item.basePrice)}
        </div>
      </div>

      {/* Product Info */}
      <div className="p-2.5 flex-1 flex flex-col justify-between">
        <div>
          <h4 className="font-bold text-xs sm:text-sm text-gray-900 leading-snug line-clamp-1 mb-0.5">
            {item.name}
          </h4>
          <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        </div>

        {/* Sizes preview & Add button */}
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-50">
          <div className="flex gap-1">
            {item.sizes.map((s) => (
              <span
                key={s.id}
                className="text-[9.5px] font-semibold px-1 py-0.2 rounded bg-forest-50 text-forest-800 border border-forest-100"
              >
                {s.name.split(' ')[0]}
              </span>
            ))}
          </div>

          <button
            disabled={!item.inStock}
            className="touch-target w-7 h-7 rounded-lg bg-forest-800 text-white flex items-center justify-center hover:bg-forest-900 active:scale-95 transition-all shadow-xs disabled:opacity-30"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
