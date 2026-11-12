import React, { useState, useMemo, useEffect } from 'react';
import { usePos } from '../../store/PosContext';
import TableCard from './TableCard';
import { Plus, Search, Layers, CheckCircle2, Users, Coffee, Pencil, Trash2, X } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { motion, useReducedMotion, useMotionTokens } from '../../lib/animateUi';

export default function TableGrid({
  onAddNewTable,
  onOpenOrder,
  onOpenBill,
  onViewOrderDetails
}) {
  const { tables, orders, updateTable, deleteTable, showToast, currentRole } = usePos();
  const isBarista = currentRole === 'barista';
  const { spring } = useMotionTokens();
  const shouldReduceMotion = useReducedMotion();
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'empty' | 'occupied'
  const [searchQuery, setSearchQuery] = useState('');

  // 3s Long-press Spotlight & Action states
  const [highlightedTable, setHighlightedTable] = useState(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');

  // ESC key handler for dialogs and highlight overlay
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isRenameDialogOpen) {
          setIsRenameDialogOpen(false);
        } else if (isDeleteDialogOpen) {
          setIsDeleteDialogOpen(false);
        } else if (highlightedTable) {
          setHighlightedTable(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [highlightedTable, isRenameDialogOpen, isDeleteDialogOpen]);

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

      // Đối với Barista: chỉ hiển thị các bàn đang có khách / có order pha chế
      if (isBarista && !occupied) {
        return false;
      }

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
  }, [tables, orders, selectedStatus, searchQuery, isBarista]);

  const handleStatusChange = (status) => {
    triggerHaptic('light');
    setSelectedStatus(status);
  };

  const handleAddClick = () => {
    triggerHaptic('medium');
    onAddNewTable?.();
  };

  // Handlers for Long-press actions
  const handleOpenRename = () => {
    if (!highlightedTable) return;
    triggerHaptic('light');
    setNewTableName(highlightedTable.name || '');
    setIsRenameDialogOpen(true);
  };

  const handleConfirmRename = () => {
    const trimmed = newTableName.trim();
    if (!trimmed || !highlightedTable) return;
    triggerHaptic('medium');
    updateTable(highlightedTable.id, { name: trimmed });
    showToast?.(`Đã đổi tên bàn thành "${trimmed}"!`, 'success');
    setIsRenameDialogOpen(false);
    setHighlightedTable(null);
  };

  const handleOpenDelete = () => {
    if (!highlightedTable) return;
    triggerHaptic('warning');
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!highlightedTable) return;
    triggerHaptic('medium');
    const ok = deleteTable(highlightedTable.id);
    if (ok) {
      showToast?.(`Đã xóa ${highlightedTable.name} khỏi sơ đồ bàn!`, 'info');
    }
    setIsDeleteDialogOpen(false);
    setHighlightedTable(null);
  };

  return (
    <div className="px-3.5 pt-3 pb-28">
      {/* 1. Dashboard 3 Thẻ Thống Kê kiêm Bộ Lọc Chính (Claymorphism 3D Token) - Ẩn đối với Barista */}
      {!isBarista && (
        <div className="grid grid-cols-3 gap-2.5 mb-3.5" role="region" aria-label="Bộ lọc thống kê bàn">
          {/* Token 1: TỔNG BÀN (Clay Disc Blue) */}
          <motion.div
            data-testid="filter-card-all"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
            transition={spring.press}
            onClick={() => handleStatusChange('all')}
            className={`clay-card p-3 flex flex-col items-center justify-between text-center cursor-pointer transition-all ${
              selectedStatus === 'all'
                ? 'ring-2 ring-blue-500 shadow-md bg-blue-50/40'
                : 'hover:border-blue-200'
            }`}
          >
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-900 mb-2">
              Tổng bàn
            </span>
            <div className="w-12 h-12 clay-disc-base clay-disc-blue text-lg shadow-clay-disc">
              {totalCount}
            </div>
          </motion.div>

          {/* Token 2: CÓ KHÁCH (Clay Disc Green) */}
          <motion.div
            data-testid="filter-card-occupied"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
            transition={spring.press}
            onClick={() => handleStatusChange('occupied')}
            className={`clay-card p-3 flex flex-col items-center justify-between text-center cursor-pointer transition-all ${
              selectedStatus === 'occupied'
                ? 'ring-2 ring-emerald-500 shadow-md bg-emerald-50/40'
                : 'hover:border-emerald-200'
            }`}
          >
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900 mb-2">
              Có khách
            </span>
            <div className="w-12 h-12 clay-disc-base clay-disc-green text-lg shadow-clay-disc">
              {occupiedCount}
            </div>
          </motion.div>

          {/* Token 3: BÀN TRỐNG (Clay Disc White Inset) */}
          <motion.div
            data-testid="filter-card-empty"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
            transition={spring.press}
            onClick={() => handleStatusChange('empty')}
            className={`clay-card p-3 flex flex-col items-center justify-between text-center cursor-pointer transition-all ${
              selectedStatus === 'empty'
                ? 'ring-2 ring-gray-400 shadow-md bg-gray-50'
                : 'hover:border-gray-300'
            }`}
          >
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-700 mb-2">
              Bàn trống
            </span>
            <div className="w-12 h-12 clay-disc-base clay-disc-white text-lg border border-gray-100 shadow-clay-disc">
              {emptyCount}
            </div>
          </motion.div>
        </div>
      )}

      {/* 2. Thanh công cụ tìm kiếm & nút Thêm bàn */}
      <div className="flex items-center gap-2 mb-3.5">
        {/* Ô tìm kiếm mềm 3D Inset */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={isBarista ? "Tìm số bàn đang chờ..." : "Tìm số bàn..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 clay-input text-xs placeholder:text-gray-400 font-bold text-gray-800"
          />
        </div>

        {/* Nút "+ Thêm bàn" 3D Pill Forest Green (Chỉ hiện cho Thu ngân / Quản lý) */}
        {!isBarista && (
          <motion.button
            type="button"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
            transition={spring.press}
            onClick={handleAddClick}
            className="touch-target clay-btn-primary px-3.5 py-2.5 text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-300 stroke-[2.5]" />
            <span>Thêm bàn</span>
          </motion.button>
        )}
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
              onHighlightTable={setHighlightedTable}
            />
          ))}
        </div>
      ) : isBarista ? (
        <div className="text-center py-12 clay-card p-6 border-dashed border-gray-200">
          <Coffee className="w-9 h-9 text-emerald-600 mx-auto mb-2" />
          <p className="text-xs text-gray-700 font-bold">Hiện không có bàn nào đang chờ pha chế</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Các bàn có đơn mới sẽ tự động hiển thị tại đây để tiện điều phối
          </p>
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

      {/* ========================================================================= */}
      {/* 4. OVERLAY NỔI BẬT THẺ BÀN & 2 NÚT FLOATING ICON (KHI NHẤN GIỮ 3S)        */}
      {/* ========================================================================= */}
      {highlightedTable && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Tùy chọn ${highlightedTable.name}`}
          onClick={() => {
            triggerHaptic('light');
            setHighlightedTable(null);
          }}
          className="fixed inset-0 z-[9500] bg-black/65 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fadeIn select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col items-center"
          >
            {/* 2 FLOATING BUTTONS: CÂY BÚT CHÌ & THÙNG RÁC (NGAY PHÍA TRÊN THẺ BÀN) */}
            <div className="flex items-center justify-center gap-3.5 mb-4 animate-slideDown">
              {/* Nút 1: Icon Cây bút chì (Đổi tên bàn) */}
              <button
                type="button"
                onClick={handleOpenRename}
                aria-label="Đổi tên bàn"
                title="Đổi tên bàn"
                className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#214E34] to-[#2E6744] hover:from-[#173826] hover:to-[#214E34] text-white flex items-center justify-center shadow-[0_8px_20px_rgba(33,78,52,0.45)] border-2 border-white/90 active:scale-95 transition-all cursor-pointer"
              >
                <Pencil className="w-5 h-5 stroke-[2.2]" />
              </button>

              {/* Nút 2: Icon Thùng rác (Xóa bàn) */}
              <button
                type="button"
                onClick={handleOpenDelete}
                aria-label="Xóa bàn"
                title="Xóa bàn"
                className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white flex items-center justify-center shadow-[0_8px_20px_rgba(225,29,72,0.45)] border-2 border-white/90 active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 className="w-5 h-5 stroke-[2.2]" />
              </button>
            </div>

            {/* Thẻ bàn đang được spotlight nổi bật */}
            <div className="clay-card p-4 w-[240px] sm:w-[260px] h-[160px] rounded-[26px] bg-white ring-4 ring-emerald-400 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-black text-lg text-[#214E34] tracking-tight">
                  {highlightedTable.name}
                </span>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase clay-inset text-gray-700 border border-gray-200">
                  TRỐNG
                </span>
              </div>
              <div className="text-xs text-gray-500 font-semibold italic text-center">
                {highlightedTable.area || 'Khu vực chính'} • {highlightedTable.capacity || 4} chỗ
              </div>
              <div className="text-[11px] text-center text-gray-400 font-medium py-1 bg-gray-50 rounded-xl">
                Chạm ra ngoài để đóng
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. HỘP THOẠI ĐỔI TÊN BÀN NHANH (QUICK RENAME DIALOG)                       */}
      {/* ========================================================================= */}
      {isRenameDialogOpen && highlightedTable && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-dialog-title"
          className="fixed inset-0 z-[9600] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsRenameDialogOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="clay-card rounded-[26px] bg-white p-5 w-full max-w-xs shadow-2xl border border-gray-100 space-y-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-[#214E34] flex items-center justify-center shrink-0">
                <Pencil className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <h3 id="rename-dialog-title" className="text-sm font-black text-[#214E34]">
                  Đổi tên bàn
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  Nhập tên mới cho {highlightedTable.name}
                </p>
              </div>
            </div>

            <input
              type="text"
              autoFocus
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename();
                if (e.key === 'Escape') setIsRenameDialogOpen(false);
              }}
              placeholder="Nhập tên bàn (vd: Bàn 01)..."
              className="w-full px-3.5 py-2.5 clay-input text-xs font-bold text-gray-800 placeholder:text-gray-400"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsRenameDialogOpen(false)}
                className="flex-1 py-2.5 clay-pill-btn text-xs font-bold text-gray-600 rounded-xl cursor-pointer active:scale-95 transition-all"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                disabled={!newTableName.trim() || newTableName.trim() === highlightedTable.name}
                className="flex-1 py-2.5 clay-btn-primary text-xs font-black text-white rounded-xl shadow-xs disabled:opacity-40 cursor-pointer active:scale-95 transition-all"
              >
                Lưu tên
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. HỘP THOẠI XÁC NHẬN XÓA BÀN (CONFIRM DELETE DIALOG)                     */}
      {/* ========================================================================= */}
      {isDeleteDialogOpen && highlightedTable && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-[9600] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsDeleteDialogOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="clay-card rounded-[26px] bg-white p-5 w-full max-w-xs shadow-2xl border border-gray-100 space-y-4 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6 stroke-[2]" />
            </div>

            <div className="space-y-1">
              <h3 id="delete-dialog-title" className="text-sm font-black text-gray-900">
                Xóa {highlightedTable.name}?
              </h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                Bàn này sẽ bị xóa vĩnh viễn khỏi sơ đồ bàn của quán. Thao tác này không thể hoàn tác.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(false)}
                className="flex-1 py-2.5 clay-pill-btn text-xs font-bold text-gray-600 rounded-xl cursor-pointer active:scale-95 transition-all"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white text-xs font-black rounded-xl shadow-sm cursor-pointer active:scale-95 transition-all"
              >
                Xóa bàn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
