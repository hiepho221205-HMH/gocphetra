import React, { useState, useMemo } from 'react';
import { usePos } from '../../store/PosContext';
import TableCard from './TableCard';
import { Plus, Search, Layers, CheckCircle2, Users, Coffee } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export default function TableGrid({
  onAddNewTable,
  onOpenOrder,
  onOpenBill,
  onViewOrderDetails
}) {
  const { tables, orders } = usePos();
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'empty' | 'occupied'
  const [searchQuery, setSearchQuery] = useState('');

  // Quy ước logic an toàn theo Task 5:
  // Bàn nào có order đang phục vụ với số món > 0 thì là "Có khách", còn lại là "Bàn trống"
  const isTableOccupied = (t) => {
    const ord =
      (t.activeOrderId && orders[t.activeOrderId] && orders[t.activeOrderId].status !== 'completed' && orders[t.activeOrderId].status !== 'cancelled')
        ? orders[t.activeOrderId]
        : Object.values(orders).find(
            (o) => o.tableId === t.id && o.status === 'serving' && Array.isArray(o.items) && o.items.length > 0
          );
    return Boolean(ord && Array.isArray(ord.items) && ord.items.length > 0);
  };

  // Trích xuất số tự nhiên từ tên bàn (Bàn 01 -> 1, Bàn 12 -> 12)
  const getTableNaturalNumber = (t) => {
    const match = (t.name || t.id || '').match(/\d+/);
    return match ? parseInt(match[0], 10) : 9999;
  };

  // 3 Chỉ số thống kê đúng theo yêu cầu (Bỏ "Chờ thanh toán")
  const { totalCount, occupiedCount, emptyCount } = useMemo(() => {
    const total = tables.length;
    let occ = 0;
    for (let i = 0; i < total; i++) {
      if (isTableOccupied(tables[i])) occ++;
    }
    return { totalCount: total, occupiedCount: occ, emptyCount: total - occ };
  }, [tables, orders]);

  // Lọc và sắp xếp danh sách bàn:
  // Tab "Tất cả": Ưu tiên nhóm "CÓ KHÁCH" lên đầu, nhóm "TRỐNG" xếp sau.
  // Trong từng nhóm (và ở các tab riêng): sắp xếp theo thứ tự số tự nhiên tăng dần (01, 02, 03...)
  const filteredTables = useMemo(() => {
    const list = tables.filter((t) => {
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

    return [...list].sort((a, b) => {
      const numA = getTableNaturalNumber(a);
      const numB = getTableNaturalNumber(b);

      if (selectedStatus === 'all') {
        const occA = isTableOccupied(a) ? 0 : 1;
        const occB = isTableOccupied(b) ? 0 : 1;
        if (occA !== occB) {
          return occA - occB; // Bàn có khách (0) trước, bàn trống (1) sau
        }
      }

      // Trong cùng nhóm: sắp xếp tăng dần theo số tự nhiên (Bàn 01, Bàn 02, Bàn 03...)
      if (numA !== numB) {
        return numA - numB;
      }
      return (a.name || a.id).localeCompare(b.name || b.id, 'vi', { numeric: true });
    });
  }, [tables, orders, selectedStatus, searchQuery]);

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
      {/* 1. Dashboard 3 Thẻ Thống Kê kiêm Bộ Lọc Chính (Claymorphism 3D Token) */}
      <div className="grid grid-cols-3 gap-2.5 mb-3.5" role="region" aria-label="Bộ lọc thống kê bàn">
        {/* Tổng bàn - Blue 3D Disc Badge */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Lọc tất cả bàn"
          aria-pressed={selectedStatus === 'all'}
          data-testid="filter-card-all"
          onClick={() => handleStatusChange('all')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleStatusChange('all')}
          className={`clay-card p-2.5 sm:p-3 text-center flex flex-col items-center justify-between cursor-pointer transition-all duration-200 select-none ${
            selectedStatus === 'all'
              ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#F5F7F4] shadow-lg scale-[1.03] bg-blue-50/40 border-blue-200'
              : 'opacity-85 hover:opacity-100 hover:shadow-md'
          }`}
        >
          <span className={`text-[11px] font-extrabold uppercase tracking-wider block mb-1.5 ${
            selectedStatus === 'all' ? 'text-blue-700 font-black' : 'text-gray-500'
          }`}>
            Tổng bàn
          </span>
          <div className="w-12 h-12 clay-disc-base clay-disc-blue text-lg shadow-clay-disc">
            {totalCount}
          </div>
        </div>

        {/* Có khách - Green 3D Disc Badge with Sub-Badge Pill */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Lọc bàn có khách"
          aria-pressed={selectedStatus === 'occupied'}
          data-testid="filter-card-occupied"
          onClick={() => handleStatusChange('occupied')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleStatusChange('occupied')}
          className={`clay-card p-2.5 sm:p-3 text-center flex flex-col items-center justify-between cursor-pointer transition-all duration-200 select-none ${
            selectedStatus === 'occupied'
              ? 'ring-2 ring-emerald-600 ring-offset-2 ring-offset-[#F5F7F4] shadow-lg scale-[1.03] bg-emerald-50/40 border-emerald-300'
              : 'opacity-85 hover:opacity-100 hover:shadow-md'
          }`}
        >
          <span className={`text-[11px] font-extrabold uppercase tracking-wider block mb-1.5 ${
            selectedStatus === 'occupied' ? 'text-[#174D36] font-black' : 'text-[#214E34]'
          }`}>
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
          role="button"
          tabIndex={0}
          aria-label="Lọc bàn trống"
          aria-pressed={selectedStatus === 'empty'}
          data-testid="filter-card-empty"
          onClick={() => handleStatusChange('empty')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleStatusChange('empty')}
          className={`clay-card p-2.5 sm:p-3 text-center flex flex-col items-center justify-between cursor-pointer transition-all duration-200 select-none ${
            selectedStatus === 'empty'
              ? 'ring-2 ring-gray-700 ring-offset-2 ring-offset-[#F5F7F4] shadow-lg scale-[1.03] bg-white border-gray-400'
              : 'opacity-85 hover:opacity-100 hover:shadow-md'
          }`}
        >
          <span className={`text-[11px] font-extrabold uppercase tracking-wider block mb-1.5 ${
            selectedStatus === 'empty' ? 'text-gray-900 font-black' : 'text-gray-500'
          }`}>
            Bàn trống
          </span>
          <div className="w-12 h-12 clay-disc-base clay-disc-white text-lg border border-gray-100 shadow-clay-disc">
            {emptyCount}
          </div>
        </div>
      </div>

      {/* 2. Thanh công cụ tìm kiếm & nút Thêm bàn */}
      <div className="flex items-center gap-2 mb-3.5">
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

      {/* 3. Grid hiển thị danh sách bàn: đúng 2 cột trên mobile 390px */}
      {filteredTables.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {filteredTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onOpenOrder={onOpenOrder}
              onOpenBill={onOpenBill}
              onViewOrderDetails={onViewOrderDetails}
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
