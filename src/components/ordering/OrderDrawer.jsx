import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import MenuItemCard from './MenuItemCard';
import ItemCustomizerModal from './ItemCustomizerModal';
import CartItemList from './CartItemList';
import {
  ArrowLeft,
  Search,
  ShoppingBag,
  ChevronUp,
  ChevronDown,
  Receipt,
  CheckCircle,
  Coffee,
  X
} from 'lucide-react';
import { formatVND } from '../../utils/currency';

export default function OrderDrawer({ table, onBack, onGoToBill }) {
  const { categories, menu, orders, addItemToOrder } = usePos();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customizingItem, setCustomizingItem] = useState(null);
  const [isCartExpanded, setIsCartExpanded] = useState(false);

  const activeOrder = table.activeOrderId ? orders[table.activeOrderId] : null;
  const cartItems = activeOrder?.items || [];
  const totalItemCount = cartItems.reduce((sum, it) => sum + it.quantity, 0);
  const subtotal = activeOrder?.subtotal || 0;

  // Lọc sản phẩm
  const filteredMenu = menu.filter((item) => {
    const matchesCat = selectedCategory === 'all' || item.categoryId === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleAddToCart = (itemConfig) => {
    addItemToOrder(table.id, itemConfig);
  };

  return (
    <div className="flex flex-col h-full bg-[#F6F8F6] relative">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200/80 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onBack}
            className="touch-target w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-1.5">
              <h2 className="font-extrabold text-base text-forest-900 leading-tight">
                {table.name}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-forest-100 text-forest-800">
                {table.area}
              </span>
            </div>
            <p className="text-[10.5px] text-gray-500">
              {cartItems.length > 0 ? `${totalItemCount} món đang chọn` : 'Chưa có món nào'}
            </p>
          </div>
        </div>

        {/* View Bill Trigger if items present */}
        {cartItems.length > 0 && (
          <button
            onClick={() => onGoToBill(table)}
            className="touch-target px-3 py-1.5 bg-forest-800 text-white rounded-xl text-xs font-bold hover:bg-forest-900 transition-colors flex items-center gap-1 shadow-sm"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Thanh toán</span>
          </button>
        )}
      </div>

      {/* Search & Categories Bar */}
      <div className="bg-white px-4 py-2 border-b border-gray-100 space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm cà phê, trà macchiato, bánh..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-forest-800"
          />
        </div>

        {/* Category horizontal scroll */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`touch-target px-3 h-7.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-forest-800 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tất cả
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`touch-target px-3 h-7.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-forest-800 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product Catalog Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-28">
        {filteredMenu.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {filteredMenu.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                onSelect={(it) => setCustomizingItem(it)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400 text-xs">
            Không tìm thấy món nước nào phù hợp
          </div>
        )}
      </div>

      {/* Floating Bottom Cart Drawer / Summary Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-14 left-0 right-0 z-30 p-2 sm:p-3 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            {/* Expanded Cart Panel */}
            {isCartExpanded && (
              <div className="bg-white rounded-t-2xl shadow-float border border-gray-200 p-4 mb-2 max-h-80 overflow-y-auto animate-slideUp">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                  <div className="flex items-center space-x-1.5">
                    <ShoppingBag className="w-4 h-4 text-forest-800" />
                    <h4 className="font-extrabold text-sm text-forest-900">Chi tiết giỏ hàng</h4>
                  </div>
                  <button
                    onClick={() => setIsCartExpanded(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <CartItemList tableId={table.id} items={cartItems} />
              </div>
            )}

            {/* Bottom Sticky Pill Trigger */}
            <div className="bg-forest-900/95 backdrop-blur-md text-white rounded-2xl p-2.5 shadow-float flex items-center justify-between border border-forest-700/50">
              <button
                onClick={() => setIsCartExpanded(!isCartExpanded)}
                className="flex items-center space-x-2 text-left pl-1"
              >
                <div className="w-8 h-8 rounded-xl bg-forest-800 flex items-center justify-center relative text-white">
                  <ShoppingBag className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {totalItemCount}
                  </span>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-300 font-medium flex items-center gap-0.5">
                    <span>Xem giỏ hàng</span>
                    {isCartExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                  </div>
                  <div className="font-extrabold text-sm tracking-tight text-white">
                    {formatVND(subtotal)}
                  </div>
                </div>
              </button>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={onBack}
                  className="touch-target px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  Lưu đơn
                </button>
                <button
                  onClick={() => onGoToBill(table)}
                  className="touch-target btn-press px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-forest-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Lên bill</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Customizer Modal */}
      <ItemCustomizerModal
        item={customizingItem}
        isOpen={Boolean(customizingItem)}
        onClose={() => setCustomizingItem(null)}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
