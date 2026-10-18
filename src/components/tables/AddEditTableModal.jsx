import React, { useState, useEffect } from 'react';
import { usePos } from '../../store/PosContext';
import { X, AlertCircle } from 'lucide-react';

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
      showToast('Không thể xóa bàn đang có khách hoặc chưa thanh toán!', 'error');
      return;
    }

    if (window.confirm(`Xác nhận xóa ${tableToEdit.name} khỏi sơ đồ bàn?`)) {
      const ok = deleteTable(tableToEdit.id);
      if (ok) onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-float overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-forest-50/50">
          <h3 className="font-extrabold text-sm text-forest-900">
            {tableToEdit ? 'Chỉnh sửa bàn' : '+ Thêm bàn mới'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form: Chỉ nhập số bàn */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
              Số bàn / Tên bàn
            </label>
            <input
              type="text"
              required
              placeholder="VD: Bàn 13 hoặc 13"
              value={tableNumber}
              onChange={(e) => handleNumberChange(e.target.value)}
              className={`w-full px-3 py-2 text-xs bg-gray-50 border rounded-xl focus:bg-white focus:outline-none font-bold ${
                errorMessage
                  ? 'border-rose-400 focus:border-rose-500 text-rose-900 bg-rose-50/30'
                  : 'border-gray-200 focus:border-forest-800 text-forest-950'
              }`}
            />
            {errorMessage && (
              <p className="flex items-center gap-1 text-[11px] text-rose-600 font-semibold mt-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
            {tableToEdit && tableToEdit.status === 'empty' && (
              <button
                type="button"
                onClick={handleDelete}
                className="py-2.5 px-3 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
              >
                Xóa bàn
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={Boolean(errorMessage) || !tableNumber.trim()}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-forest-800 rounded-xl hover:bg-forest-900 disabled:opacity-40 shadow-sm"
            >
              {tableToEdit ? 'Lưu thay đổi' : 'Lưu bàn mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
