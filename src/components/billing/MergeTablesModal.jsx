import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePos } from '../../store/PosContext';
import {
  ArrowLeft,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  GitMerge,
  Users,
  Clock,
  Coffee,
  Check,
  Receipt
} from 'lucide-react';
import { formatVND } from '../../utils/currency';

export default function MergeTablesModal({ isOpen, onClose, destinationTable }) {
  const { tables, orders, mergeTables, showToast } = usePos();

  const [selectedSourceTableId, setSelectedSourceTableId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Reset states on open
  useEffect(() => {
    if (isOpen) {
      setSelectedSourceTableId('');
      setSearchQuery('');
      setIsConfirmOpen(false);
      setIsSubmitting(false);
    }
  }, [isOpen, destinationTable?.id]);

  if (!isOpen || !destinationTable) return null;

  const destinationOrder = destinationTable.activeOrderId ? orders[destinationTable.activeOrderId] : null;

  // Filter occupied tables eligible to be merged (excluding destination table itself)
  const availableSourceTables = tables.filter((t) => {
    const isNotDest = t.id !== destinationTable.id;
    const isOccupied = t.status === 'occupied' && t.activeOrderId && orders[t.activeOrderId];
    const matchSearch =
      !searchQuery.trim() ||
      t.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.trim().toLowerCase());
    return isNotDest && isOccupied && matchSearch;
  });

  const selectedSourceTable = tables.find((t) => t.id === selectedSourceTableId);
  const selectedSourceOrder = selectedSourceTable?.activeOrderId
    ? orders[selectedSourceTable.activeOrderId]
    : null;

  // Combined preview calculations
  const destItems = destinationOrder?.items || [];
  const sourceItems = selectedSourceOrder?.items || [];
  const combinedItemsCount = destItems.reduce((s, it) => s + it.quantity, 0) + sourceItems.reduce((s, it) => s + it.quantity, 0);

  const destTotal = destinationOrder?.total || 0;
  const sourceTotal = selectedSourceOrder?.total || 0;
  const combinedTotal = destTotal + sourceTotal;

  const handleExecuteMerge = () => {
    if (!selectedSourceTableId) {
      showToast('Vui lòng chọn bàn nguồn cần gộp!', 'error');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = mergeTables(selectedSourceTableId, destinationTable.id);
      if (res && res.success !== false) {
        setIsConfirmOpen(false);
        // Close merge modal to return directly to destination table bill modal with fresh numbers!
        onClose();
      }
    } catch (err) {
      console.error('Lỗi khi thực hiện gộp bàn:', err);
      showToast('Có lỗi xảy ra khi gộp bàn!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-[400px] h-[92vh] max-h-[720px] flex flex-col shadow-2xl overflow-hidden border border-stone-200 animate-slideUp">
        {/* ================= 1. HEADER ================= */}
        <div className="px-4 py-3 bg-[#214E34] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-colors"
              title="Quay lại hóa đơn"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <GitMerge className="w-4 h-4 text-emerald-300" />
                <h3 className="font-extrabold text-sm leading-tight">Gộp bàn</h3>
              </div>
              <p className="text-[10px] text-emerald-200/90">
                Chuyển toàn bộ món từ bàn nguồn sang bàn đích
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================= 2. SCROLLABLE BODY ================= */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 no-scrollbar text-xs">
          {/* Card: Bàn đích (Giữ lại) */}
          <div className="p-3 bg-emerald-50/70 border-2 border-[#214E34] rounded-2xl relative shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#214E34] text-white flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                <span>Bàn đích (Giữ lại)</span>
              </span>
              <span className="text-[11px] font-bold text-emerald-900">
                {destinationTable.customerCount || 1} khách
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black text-sm text-stone-900">{destinationTable.name}</h4>
                <p className="text-[11px] text-stone-500">
                  {destItems.length} món • Đơn #{destinationOrder?.id?.slice(-4) || '---'}
                </p>
              </div>
              <div className="text-right">
                <div className="font-black text-sm text-[#214E34]">{formatVND(destTotal)}</div>
                <div className="text-[10px] text-stone-400 font-semibold">Tạm tính hiện tại</div>
              </div>
            </div>
          </div>

          {/* Section: Chọn bàn nguồn cần gộp */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-xs text-stone-800 uppercase tracking-wider">
                Chọn bàn cần gộp vào {destinationTable.name}
              </label>
              <span className="text-[10.5px] font-bold text-stone-500">
                {availableSourceTables.length} bàn có khách
              </span>
            </div>

            {/* Ô tìm kiếm số bàn */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm mã hoặc tên bàn (Bàn 02, Bàn 03...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#214E34] focus:bg-white transition-colors"
              />
            </div>

            {/* Danh sách bàn nguồn */}
            <div className="space-y-1.5 max-h-44 overflow-y-auto no-scrollbar pr-0.5">
              {availableSourceTables.length === 0 ? (
                <div className="text-center py-6 bg-stone-50 border border-stone-200 rounded-2xl text-stone-400 space-y-1">
                  <Coffee className="w-6 h-6 mx-auto text-stone-300" />
                  <p className="text-xs font-bold text-stone-600">Không có bàn nào phù hợp</p>
                  <p className="text-[10px] text-stone-400">
                    Chỉ các bàn đang Có khách khác mới có thể gộp.
                  </p>
                </div>
              ) : (
                availableSourceTables.map((sTable) => {
                  const sOrder = orders[sTable.activeOrderId];
                  const isSelected = selectedSourceTableId === sTable.id;
                  const sItemCount = (sOrder?.items || []).reduce((sum, it) => sum + it.quantity, 0);

                  return (
                    <button
                      key={sTable.id}
                      type="button"
                      onClick={() => setSelectedSourceTableId(sTable.id)}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-emerald-50/80 border-[#214E34] shadow-2xs ring-1 ring-[#214E34]'
                          : 'bg-white border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Radio circle indicator */}
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'bg-[#214E34] border-[#214E34] text-white'
                              : 'border-stone-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>

                        <div className="truncate">
                          <div className="font-extrabold text-xs text-stone-900">{sTable.name}</div>
                          <div className="text-[10px] text-stone-500 flex items-center gap-1">
                            <span>{sTable.customerCount || 1} khách</span>
                            <span>•</span>
                            <span>{sItemCount} món</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-xs text-stone-900">
                          {formatVND(sOrder?.total || 0)}
                        </div>
                        <div className="text-[9.5px] text-stone-400">Đơn #{sOrder?.id?.slice(-4)}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ================= 3. THẺ XEM TRƯỚC KẾT QUẢ GỘP ================= */}
          {selectedSourceTable && selectedSourceOrder && (
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-stone-200/80 pb-1.5">
                <span className="font-extrabold text-xs text-stone-800 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-[#214E34]" />
                  <span>Xem trước kết quả sau gộp</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {selectedSourceTable.name} ➔ {destinationTable.name}
                </span>
              </div>

              {/* So sánh 2 bàn */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2 rounded-xl border border-stone-200">
                <div>
                  <div className="text-stone-400 font-semibold">{destinationTable.name} (hiện tại)</div>
                  <div className="font-bold text-stone-800">
                    {destItems.length} món • {formatVND(destTotal)}
                  </div>
                </div>
                <div className="border-l border-stone-200 pl-2">
                  <div className="text-stone-400 font-semibold">{selectedSourceTable.name} (gộp vào)</div>
                  <div className="font-bold text-stone-800">
                    {sourceItems.length} món • {formatVND(sourceTotal)}
                  </div>
                </div>
              </div>

              {/* Danh sách món chi tiết sau gộp (cuộn ngắn) */}
              <div className="space-y-1 max-h-28 overflow-y-auto no-scrollbar pr-0.5">
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Món hợp nhất ({combinedItemsCount}):
                </div>
                {[...destItems, ...sourceItems].map((it, idx) => (
                  <div key={it.cartItemId || idx} className="flex justify-between items-start text-[11px]">
                    <div className="truncate pr-2">
                      <span className="font-semibold text-stone-800">{it.name}</span>{' '}
                      <span className="text-[10px] text-stone-400 font-bold">x{it.quantity}</span>
                      {it.toppings && it.toppings.length > 0 && (
                        <span className="text-[9.5px] text-stone-400 block truncate">
                          + {it.toppings.map((t) => t.name).join(', ')}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-stone-700 shrink-0">
                      {formatVND(it.lineTotal || 0)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Tóm tắt tài chính sau gộp */}
              <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                <div>
                  <div className="text-[10.5px] font-bold text-stone-500">TỔNG SAU KHI GỘP</div>
                  <div className="text-[10px] text-stone-400">
                    Gồm {combinedItemsCount} món từ 2 bàn
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-base text-[#214E34]">
                    {formatVND(combinedTotal)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hộp cảnh báo an toàn */}
          {selectedSourceTable && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10.5px] leading-relaxed">
                Sau khi gộp thành công, <span className="font-bold">{selectedSourceTable.name}</span> sẽ
                tự động giải phóng thành <span className="font-bold text-emerald-800">BÀN TRỐNG</span>.
                Toàn bộ đơn hàng chuyển sang quản lý tại{' '}
                <span className="font-bold">{destinationTable.name}</span>.
              </p>
            </div>
          )}
        </div>

        {/* ================= 4. STICKY FOOTER ACTIONS ================= */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[46px] py-2 px-3 rounded-xl text-xs font-bold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 active:scale-97 transition-all"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!selectedSourceTableId || isSubmitting}
            onClick={() => setIsConfirmOpen(true)}
            className="flex-2 min-h-[46px] py-2 px-3 rounded-xl text-xs font-black text-white bg-[#214E34] hover:bg-[#1a3e29] active:scale-97 shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
          >
            <GitMerge className="w-4 h-4 text-emerald-300" />
            <span>Xác nhận gộp bàn {selectedSourceTable ? `(${formatVND(combinedTotal)})` : ''}</span>
          </button>
        </div>
      </div>

      {/* ================= 5. MODAL POPUP XÁC NHẬN AN TOÀN TRƯỚC KHI GỘP ================= */}
      {isConfirmOpen && selectedSourceTable && (
        <div className="fixed inset-0 z-[9300] bg-black/60 backdrop-blur-2xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-[320px] p-4 flex flex-col items-center text-center shadow-2xl border border-stone-200 animate-slideUp">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#214E34] flex items-center justify-center mb-3 shadow-inner">
              <GitMerge className="w-6 h-6 text-[#214E34]" />
            </div>

            <h4 className="font-black text-sm text-stone-900 mb-1">
              Xác nhận gộp {selectedSourceTable.name} vào {destinationTable.name}?
            </h4>
            <p className="text-xs text-stone-500 mb-4 px-2 leading-relaxed">
              Toàn bộ đơn hàng ({sourceItems.length} món • {formatVND(sourceTotal)}) của{' '}
              <span className="font-bold text-stone-800">{selectedSourceTable.name}</span> sẽ chuyển sang{' '}
              <span className="font-bold text-[#214E34]">{destinationTable.name}</span>. Bàn nguồn sẽ trở thành bàn trống.
            </p>

            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 active:scale-97 transition-colors disabled:opacity-50"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleExecuteMerge}
                className="flex-1 min-h-[44px] py-2 rounded-xl text-xs font-extrabold text-white bg-[#214E34] hover:bg-[#1a3e29] active:scale-97 shadow-md transition-all disabled:opacity-50 flex items-center justify-center"
              >
                {isSubmitting ? 'Đang gộp...' : 'Đồng ý gộp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
