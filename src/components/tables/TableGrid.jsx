import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import TableCard from './TableCard';
import { Plus, Search, Layers } from 'lucide-react';

export default function TableGrid({
  onAddNewTable,
  onOpenOrder,
  onOpenBill
}) {
  const { tables, orders } = usePos();
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'empty' | 'occupied'
  const [searchQuery, setSearchQuery] = useState('');

  // Quy ước logic đơn giản:
  // Bàn nào có order với số món > 0 thì là "Có khách", còn lại là "Bàn trống"
  const isTableOccupied = (t) => {
    const ord = t.activeOrderId ? orders[t.activeOrderId] : null;
    return Boolean(ord && ord.items && ord.items.length > 0);
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

  return (
    <div className="px-4 pt-3.5 pb-24">
      {/* 1. Header gọn: Tiêu đề trang Sơ đồ bàn */}
      <div className="mb-2.5">
        <h2 className="text-lg font-black text-forest-900 tracking-tight leading-none">
          Sơ đồ bàn
        </h2>
        <p className="text-[11px] text-gray-500 mt-0.5">
          Quản lý trạng thái bàn và gọi món nhanh
        </p>
      </div>

      {/* 2. Đúng 3 thẻ thống kê: Tổng bàn | Có khách | Bàn trống */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* Tổng bàn */}
        <div className="bg-white p-2.5 rounded-xl border border-gray-200/80 text-center shadow-xs">
          <span className="text-[10.5px] text-gray-500 font-medium block mb-0.5">Tổng bàn</span>
          <span className="text-base font-black text-forest-900 leading-tight">{totalCount}</span>
        </div>

        {/* Có khách */}
        <div className="bg-[#EBF7EE] p-2.5 rounded-xl border border-emerald-200 text-center shadow-xs">
          <span className="text-[10.5px] text-emerald-800 font-bold block mb-0.5">Có khách</span>
          <span className="text-base font-black text-emerald-900 leading-tight">{occupiedCount}</span>
        </div>

        {/* Bàn trống */}
        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 text-center shadow-xs">
          <span className="text-[10.5px] text-gray-600 font-medium block mb-0.5">Bàn trống</span>
          <span className="text-base font-black text-gray-800 leading-tight">{emptyCount}</span>
        </div>
      </div>

      {/* 3. Thanh công cụ: Tìm kiếm + Lọc trạng thái + Nút "+ Thêm bàn" */}
      <div className="flex items-center gap-2 mb-3">
        {/* Ô tìm kiếm số bàn */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm số bàn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-2 bg-white border border-gray-200 rounded-xl text-xs placeholder:text-gray-400 focus:outline-none focus:border-forest-800 font-medium shadow-2xs"
          />
        </div>

        {/* Dropdown lọc trạng thái (3 tùy chọn) */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          aria-label="Lọc theo trạng thái bàn"
          className="bg-white border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-forest-800 shadow-2xs"
        >
          <option value="all">Tất cả</option>
          <option value="empty">Bàn trống</option>
          <option value="occupied">Có khách</option>
        </select>

        {/* Nút "+ Thêm bàn" nổi bật */}
        <button
          onClick={onAddNewTable}
          className="touch-target btn-press px-3 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md flex-shrink-0"
        >
          <Plus className="w-4 h-4 text-emerald-300" />
          <span>Thêm bàn</span>
        </button>
      </div>

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
        <div className="text-center py-12 bg-white/70 rounded-2xl border border-dashed border-gray-200 p-6">
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
