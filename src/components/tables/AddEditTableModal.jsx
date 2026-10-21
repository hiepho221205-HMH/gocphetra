import React, { useState, useEffect } from 'react';
import { usePos } from '../../store/PosContext';
import { X, AlertCircle } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export default function AddEditTableModal({ isOpen, onClose, tableToEdit }) {
  const { tables, addTable, updateTable, deleteTable, showToast } = usePos();
  const [tableNumber, setTableNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (tableToEdit) {
      setTableNumber(tableToEdit.name || tableToEdit.id);
      setErrorMessage('');
    } else {
      // Gợi ý số bàn kế tiếp
      const nextNum = tables.length + 1;
      setTableNumber(`Bàn ${String(nextNum).padStart(2, '0')}`);
      setErrorMessage('');
    }
  }, [tableToEdit, isOpen, tables.length]);

  if (!isOpen) return null;

  const handleNumberChange = (val) => {
    setTableNumber(val);
    const clean = val.trim();
    if (!clean) {
      setErrorMessage('Vui lòng nhập tên hoặc số bàn');
      return;
    }

    const formattedClean = clean.toLowerCase();

    // Nếu đang sửa mà không đổi tên bàn thì hợp lệ
    if (tableToEdit && (tableToEdit.name.toLowerCase() === formattedClean || tableToEdit.id.toLowerCase() === formattedClean)) {
      setErrorMessage('');
      return;
    }

    const isDuplicate = tables.some(
      (t) =>
        t.name.toLowerCase() === formattedClean ||
        t.id.toLowerCase() === formattedClean ||
        t.name.toLowerCase() === `bàn ${formattedClean}` ||
        `bàn ${t.id.toLowerCase()}` === formattedClean
    );

    if (isDuplicate) {
      setErrorMessage(`Bàn "${clean}" đã tồn tại trong danh sách!`);
    } else {
      setErrorMessage('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (errorMessage || !tableNumber.trim()) return;

    triggerHaptic('medium');
    const clean = tableNumber.trim();
    const formattedName = clean.toLowerCase().startsWith('bàn') ? clean : `Bàn ${clean.replace(/^B/i, '')}`;

    if (tableToEdit) {
      updateTable(tableToEdit.id, {
        name: formattedName
      });
      onClose();
    } else {
      const result = addTable({
        tableNumber: clean,
        name: formattedName
      });
      if (result.success) {
        onClose();
      }
    }
  };

  const handleDelete = () => {
    if (!tableToEdit) return;
    if (tableToEdit.status !== 'empty' || tableToEdit.activeOrderId) {
      triggerHaptic('error');
      showToast('Không thể xóa bàn đang có khách hoặc chưa thanh toán!', 'error');
      return;
    }

    if (window.confirm(`Xác nhận xóa ${tableToEdit.name} khỏi sơ đồ bàn?`)) {
      triggerHaptic('warning');
      const ok = deleteTable(tableToEdit.id);
      if (ok) onClose();
    }
  };

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-sm clay-card p-0 overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[#F5F7F4]/80">
          <h3 className="font-black text-sm text-[#214E34] tracking-tight">
            {tableToEdit ? 'Chỉnh sửa bàn' : '+ Thêm bàn mới'}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Form: Chỉ nhập số bàn */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
              Số bàn / Tên bàn
            </label>
            <input
              type="text"
              required
              placeholder="VD: Bàn 13 hoặc 13"
              value={tableNumber}
              onChange={(e) => handleNumberChange(e.target.value)}
              className={`w-full px-3.5 py-2.5 text-xs font-bold clay-input ${
                errorMessage
                  ? 'border-rose-400 text-rose-900 bg-rose-50/30'
                  : 'text-gray-800'
              }`}
            />
            {errorMessage && (
              <p className="flex items-center gap-1.5 text-[11px] text-rose-600 font-bold mt-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2 pt-3 border-t border-gray-100">
            {tableToEdit && tableToEdit.status === 'empty' && (
              <button
                type="button"
                onClick={handleDelete}
                className="py-2.5 px-3 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-[14px] transition-colors cursor-pointer"
              >
                Xóa bàn
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 text-xs font-bold text-gray-600 clay-pill-btn cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={Boolean(errorMessage) || !tableNumber.trim()}
              className="flex-1 py-2.5 text-xs font-black text-white clay-btn-primary disabled:opacity-40 cursor-pointer"
            >
              {tableToEdit ? 'Lưu thay đổi' : 'Lưu bàn mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
