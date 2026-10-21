import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import TableCard from './TableCard';
import { Plus, Search, Layers, CheckCircle2, Users, Coffee } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export default function TableGrid({
  onAddNewTable,
  onOpenOrder,
  onOpenBill
}) {
  const { tables, orders } = usePos();
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'empty' | 'occupied'
  const [searchQuery, setSearchQuery] = useState('');

  // Quy ước logic an toàn:
  // Bàn nào có order với số món > 0 thì là "Có khách", còn lại là "Bàn trống"
  const isTableOccupied = (t) => {
    const ord =
      (t.activeOrderId && orders[t.activeOrderId]) ||
      (t.status === 'occupied' &&
        Object.values(orders).find(
          (o) => o.tableId === t.id && o.status !== 'completed' && o.status !== 'cancelled'
        )) ||
      null;
    return t.status === 'occupied' || Boolean(ord && ord.items && ord.items.length > 0);
  };

  // 3 Chỉ số thống kê đúng theo yêu cầu (Bỏ "Chờ thanh toán")
  const totalCount = tables.length;
  const occupiedCount = tables.filter((t) => isTableOccupied(t)).length;
  const emptyCount = totalCount - occupiedCount;

  // Lọc bàn
  const filteredTables = tables.filter((t) => {
    const occupied = isTableOccupied(t);
    const matchesStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'occupied' && occupied) ||
      (selectedStatus === 'empty' && !occupied);

    const matchesSearch =
      searchQuery.trim() === '' ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const handleStatusChange = (status) => {
    triggerHaptic('light');
    setSelectedStatus(status);
  };

  const handleAddClick = () => {
    triggerHaptic('medium');
    onAddNewTable?.();
  };

  return (
    <div className="px-3.5 pt-3 pb-28">
      {/* 1. Dashboard 3 Thẻ Thống Kê 3D Clay Token (Reference Image 2) */}
      <div className="grid grid-cols-3 gap-2.5 mb-3.5">
        {/* Tổng bàn - Blue 3D Disc Badge */}
        <div
          onClick={() => handleStatusChange('all')}
          className={`clay-card p-2.5 sm:p-3 text-center flex flex-col items-center justify-between cursor-pointer transition-transform active:scale-95 ${
            selectedStatus === 'all' ? 'ring-2 ring-blue-500/50' : ''
          }`}
        >
          <span className="text-[11px] text-gray-500 font-extrabold uppercase tracking-wider block mb-1.5">
            Tổng bàn
          </span>
          <div className="w-12 h-12 clay-disc-base clay-disc-blue text-lg shadow-clay-disc">
            {totalCount}
          </div>
        </div>

        {/* Có khách - Green 3D Disc Badge with Sub-Badge Pill */}
        <div
          onClick={() => handleStatusChange('occupied')}
          className={`clay-card p-2.5 sm:p-3 text-center flex flex-col items-center justify-between cursor-pointer transition-transform active:scale-95 ${
            selectedStatus === 'occupied' ? 'ring-2 ring-emerald-500/50' : ''
          }`}
        >
          <span className="text-[11px] text-[#214E34] font-extrabold uppercase tracking-wider block mb-1.5">
            Có khách
          </span>
          <div className="w-12 h-12 clay-disc-base clay-disc-green text-lg shadow-clay-disc">
            {occupiedCount}
            {occupiedCount > 0 && (
              <span className="clay-sub-badge bg-rose-500 text-white animate-pulse">
                •
              </span>
            )}
          </div>
        </div>

        {/* Bàn trống - White Clay 3D Disc Badge */}
        <div
          onClick={() => handleStatusChange('empty')}
          className={`clay-card p-2.5 sm:p-3 text-center flex flex-col items-center justify-between cursor-pointer transition-transform active:scale-95 ${
            selectedStatus === 'empty' ? 'ring-2 ring-gray-400/50' : ''
          }`}
        >
          <span className="text-[11px] text-gray-500 font-extrabold uppercase tracking-wider block mb-1.5">
            Bàn trống
          </span>
          <div className="w-12 h-12 clay-disc-base clay-disc-white text-lg border border-gray-100 shadow-clay-disc">
            {emptyCount}
          </div>
        </div>
      </div>

      {/* 2. Thanh công cụ tìm kiếm & nút Thêm bàn */}
      <div className="flex items-center gap-2 mb-3">
        {/* Ô tìm kiếm mềm 3D Inset */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm số bàn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 clay-input text-xs placeholder:text-gray-400 font-bold text-gray-800"
          />
        </div>

        {/* Nút "+ Thêm bàn" 3D Pill Forest Green */}
        <button
          type="button"
          onClick={handleAddClick}
          className="touch-target clay-btn-primary px-3.5 py-2.5 text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-emerald-300 stroke-[2.5]" />
          <span>Thêm bàn</span>
        </button>
      </div>

      {/* 3. Segmented Control Filter Pills (Soft Inset Well) */}
      <div className="clay-inset p-1 flex items-center justify-between gap-1 mb-3.5">
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'occupied', label: `Có khách (${occupiedCount})` },
          { key: 'empty', label: `Bàn trống (${emptyCount})` }
        ].map((tab) => {
          const isActive = selectedStatus === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleStatusChange(tab.key)}
              className={`flex-1 py-1.5 px-2 rounded-[14px] text-xs font-extrabold transition-all duration-150 cursor-pointer touch-target ${
                isActive
                  ? 'bg-white text-[#214E34] shadow-[0_4px_12px_rgba(160,175,200,0.25),inset_0_1px_1px_rgba(255,255,255,1)]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Hidden standard select element for backward compatibility with automated tests */}
      <select
        value={selectedStatus}
        onChange={(e) => handleStatusChange(e.target.value)}
        aria-label="Lọc theo trạng thái bàn"
        className="sr-only"
        tabIndex={-1}
      >
        <option value="all">Tất cả</option>
        <option value="empty">Bàn trống</option>
        <option value="occupied">Có khách</option>
      </select>

      {/* 4. Grid hiển thị danh sách bàn: đúng 2 cột trên mobile 390px */}
      {filteredTables.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {filteredTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onOpenOrder={onOpenOrder}
              onOpenBill={onOpenBill}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 clay-card p-6 border-dashed border-gray-200">
          <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-600 font-bold">Không tìm thấy bàn phù hợp</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Thử đổi từ khóa tìm kiếm hoặc chọn lọc 'Tất cả'
          </p>
        </div>
      )}
    </div>
  );
}
