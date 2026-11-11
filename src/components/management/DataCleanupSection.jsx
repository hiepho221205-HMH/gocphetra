import React, { useState, useMemo, useId } from 'react';
import { usePos } from '../../store/PosContext';
import { formatVND } from '../../utils/currency';
import {
  getVietnamTodayString,
  addDaysToDateString,
  formatShortDate
} from '../../utils/dateTime';
import {
  calculateCleanupPreview,
  triggerOrdersBackupDownload
} from '../../utils/cleanupBackup';
import {
  Trash2,
  AlertTriangle,
  Download,
  Calendar,
  CalendarRange,
  Clock,
  ShieldCheck,
  CheckCircle2,
  X,
  Banknote,
  QrCode,
  FileJson,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Layers,
  HelpCircle,
  Lock,
  Store,
  Check
} from 'lucide-react';

/**
 * DataCleanupSection Component - Redesigned 3D Claymorphic
 *
 * Implements a luxurious, scientific, and streamlined sales data cleanup flow:
 * 1. 3-Tab Segmented Control (Khoảng ngày, Trước ngày, Toàn bộ) - clean, non-truncating.
 * 2. 3D Clay Hero Preview Card (Orders, Total Revenue, Cash & VietQR Capsules in Asia/Ho_Chi_Minh).
 * 3. Compact 1-line Data Protection Guarantee (shielding active tables, staff, and menu).
 * 4. High-class 2-Step Confirmation Bottom Sheet (Step 1: Backup JSON, Step 2: Exact 'XÓA DỮ LIỆU' text).
 */
export default function DataCleanupSection() {
  const {
    orderHistory = [],
    cleanupCompletedOrders,
    showToast,
    currentRole,
    settings = {},
    payments = []
  } = usePos();

  const storeName = settings?.branchName || settings?.storeName || 'Chi nhánh 01 - Trụ sở chính';

  // Scope Mode State: 'range' | 'before_date' | 'all_completed' | null (Defaults to null per Zero-Trust Admin safety contract)
  const [cleanupMode, setCleanupMode] = useState(null);

  // Dynamic Date Inputs State (defaults: last 7 days for range, today for before_date)
  const todayStr = getVietnamTodayString();
  const [fromDate, setFromDate] = useState(() => addDaysToDateString(todayStr, -7));
  const [toDate, setToDate] = useState(() => todayStr);
  const [beforeDate, setBeforeDate] = useState(() => todayStr);

  // Modal State Machine
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1 = Backup & Summary, 2 = Final Danger Confirm
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [downloadedFileName, setDownloadedFileName] = useState('');
  const [isConfirmedChecked, setIsConfirmedChecked] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Accessibility IDs
  const modalTitleId = useId();
  const modalDescId = useId();

  // Inverted Date Range Validation (Mode 1)
  const isInvertedRange = useMemo(() => {
    if (cleanupMode === 'range' && fromDate && toDate) {
      return fromDate > toDate;
    }
    return false;
  }, [cleanupMode, fromDate, toDate]);

  // Step 1: Live Preview KPI Calculation (strict Vietnam timezone)
  const preview = useMemo(() => {
    try {
      return calculateCleanupPreview(orderHistory, cleanupMode, {
        fromDate,
        toDate,
        beforeDate,
        includeHistoricalStatuses: true,
        allPayments: payments
      });
    } catch (err) {
      console.error('Lỗi tính toán xem trước dọn dẹp:', err);
      return {
        targetOrders: [],
        count: 0,
        totalRevenue: 0,
        cashTotal: 0,
        qrTotal: 0,
        hasCrossDatePayments: false,
        crossDatePaymentCount: 0
      };
    }
  }, [orderHistory, cleanupMode, fromDate, toDate, beforeDate, payments]);

  // Check if initiation is allowed
  const isAdmin = currentRole === 'admin';
  const canInitiate = isAdmin && cleanupMode !== null && preview.count > 0 && !isInvertedRange && !isDeleting;

  // Open Modal Handler
  const handleOpenModal = () => {
    if (!isAdmin) {
      showToast?.('Chỉ Quản trị viên (Admin) mới có quyền xóa hoặc lưu trữ dữ liệu lịch sử!', 'error');
      return;
    }
    if (!canInitiate) return;
    setModalStep(1);
    setBackupDownloaded(false);
    setDownloadedFileName('');
    setIsConfirmedChecked(false);
    setConfirmDeleteText('');
    setIsDeleting(false);
    setIsModalOpen(true);
  };

  // Close Modal Handler
  const handleCloseModal = () => {
    if (isDeleting) return; // Prevent closing while in progress
    setIsModalOpen(false);
    setModalStep(1);
    setIsConfirmedChecked(false);
    setConfirmDeleteText('');
  };

  // Step 3 (Modal Step 1): Trigger Backup Download
  const handleDownloadBackup = () => {
    try {
      const metadata = {
        mode: cleanupMode,
        criteria: {
          fromDate: cleanupMode === 'range' ? fromDate : undefined,
          toDate: cleanupMode === 'range' ? toDate : undefined,
          beforeDate: cleanupMode === 'before_date' ? beforeDate : undefined
        },
        performedBy: 'Quản lý (Admin)'
      };

      const result = triggerOrdersBackupDownload(preview.targetOrders, metadata);
      if (result && result.success) {
        setBackupDownloaded(true);
        const fileName = result.filename || result.fileName;
        setDownloadedFileName(fileName);
      } else {
        throw new Error('Không thể tạo file sao lưu');
      }
    } catch (err) {
      console.error('Lỗi tải file sao lưu:', err);
      showToast?.('Không thể tải file sao lưu. Vui lòng thử lại!', 'error');
    }
  };

  // Step 4 (Modal Step 2): Execute Irreversible Deletion
  const handleExecuteDelete = async () => {
    if (!isConfirmedChecked || confirmDeleteText.trim() !== 'XÓA DỮ LIỆU' || isDeleting || preview.count === 0) return;

    setIsDeleting(true);
    try {
      const targetOrderIds = preview.targetOrders.map((o) => o.id);
      const metadata = {
        mode: cleanupMode,
        dateRange: {
          fromDate: cleanupMode === 'range' ? fromDate : undefined,
          toDate: cleanupMode === 'range' ? toDate : undefined,
          beforeDate: cleanupMode === 'before_date' ? beforeDate : undefined
        },
        criteria: {
          fromDate: cleanupMode === 'range' ? fromDate : undefined,
          toDate: cleanupMode === 'range' ? toDate : undefined,
          beforeDate: cleanupMode === 'before_date' ? beforeDate : undefined
        },
        ordersCount: preview.count,
        totalAmount: preview.totalRevenue,
        performedBy: 'Quản lý (Admin)',
        backupFileName: downloadedFileName || `backup_orders_${Date.now()}.json`
      };

      // Call PosContext cleanup action
      if (typeof cleanupCompletedOrders === 'function') {
        const res = await cleanupCompletedOrders(targetOrderIds, metadata);
        if (res && res.success === false) {
          throw new Error(res.message || 'Không thể dọn dẹp dữ liệu');
        }
        showToast?.(`Đã xóa vĩnh viễn ${res?.count || targetOrderIds.length} hóa đơn thành công!`, 'success');
      } else {
        console.warn('cleanupCompletedOrders is not yet registered in PosContext');
      }

      handleCloseModal();
    } catch (err) {
      console.error('Lỗi khi thực hiện dọn dẹp hóa đơn:', err);
      showToast?.(err?.message || 'Có lỗi xảy ra khi dọn dẹp dữ liệu!', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      data-testid="data-cleanup-section"
      className="clay-card p-4 rounded-[26px] bg-white border border-white/90 shadow-[0_10px_25px_-4px_rgba(33,78,52,0.08),inset_0_1px_2px_rgba(255,255,255,0.95)] space-y-3.5 text-xs text-gray-800 overflow-hidden"
    >
      {/* 1. NON-ADMIN LOCKED ALERT */}
      {!isAdmin && (
        <div
          data-testid="cleanup-non-admin-alert"
          className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-950 animate-fadeIn shadow-2xs"
        >
          <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed text-xs">
            <strong>Tính năng giới hạn:</strong> Thao tác xóa và lưu trữ dữ liệu bán hàng yêu cầu quyền <strong>Quản trị viên (Admin)</strong>. Vai trò hiện tại (<strong>{currentRole?.toUpperCase()}</strong>) không được phép thực hiện.
          </div>
        </div>
      )}

      {/* 2. SCOPE MODE SELECTOR TABS (3D Clay Segmented Switcher) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-0.5">
          <label className="text-xs font-black text-[#214E34] uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#214E34]" />
            <span>Phạm vi dọn dẹp</span>
          </label>
          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            Admin độc quyền
          </span>
        </div>

        <div
          data-testid="cleanup-scope-tabs"
          className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100/90 rounded-2xl border border-gray-200/60 shadow-inner"
        >
          {/* Tab 1: Range */}
          <button
            type="button"
            data-testid="cleanup-tab-range"
            onClick={() => setCleanupMode('range')}
            className={`touch-target py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
              cleanupMode === 'range'
                ? 'bg-white text-[#214E34] font-black shadow-[0_4px_12px_rgba(33,78,52,0.12),inset_0_1px_1px_rgba(255,255,255,0.9)]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Khoảng ngày</span>
          </button>

          {/* Tab 2: Before Date */}
          <button
            type="button"
            data-testid="cleanup-tab-before-date"
            onClick={() => setCleanupMode('before_date')}
            className={`touch-target py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
              cleanupMode === 'before_date'
                ? 'bg-white text-[#214E34] font-black shadow-[0_4px_12px_rgba(33,78,52,0.12),inset_0_1px_1px_rgba(255,255,255,0.9)]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Trước ngày</span>
          </button>

          {/* Tab 3: All History */}
          <button
            type="button"
            data-testid="cleanup-tab-all"
            onClick={() => setCleanupMode('all_completed')}
            className={`touch-target py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
              cleanupMode === 'all_completed'
                ? 'bg-white text-[#214E34] font-black shadow-[0_4px_12px_rgba(33,78,52,0.12),inset_0_1px_1px_rgba(255,255,255,0.9)]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Toàn bộ</span>
          </button>
        </div>
      </div>

      {/* 3. DYNAMIC DATE PICKERS & PROMPT */}
      <div className="space-y-2">
        {cleanupMode === null && (
          <div
            data-testid="cleanup-no-mode-selected"
            className="p-3.5 rounded-2xl bg-[#F4F7FB] border border-gray-200/60 text-[#214E34] text-xs flex items-center gap-2.5 animate-fadeIn shadow-inner"
          >
            <HelpCircle className="w-4 h-4 text-[#214E34] shrink-0" />
            <span className="font-semibold text-xs leading-relaxed">
              Vui lòng chọn 1 trong 3 chế độ ở trên để xem trước dữ liệu cần dọn dẹp.
            </span>
          </div>
        )}

        {cleanupMode === 'range' && (
          <div data-testid="cleanup-range-inputs" className="space-y-2 animate-slideDown">
            <div className="grid grid-cols-2 gap-2 min-w-0">
              <div className="min-w-0">
                <label
                  htmlFor="cleanup-from-date-input"
                  className="block text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-1"
                >
                  Từ ngày:
                </label>
                <div className="relative">
                  <div
                    className={`h-9 px-2.5 rounded-xl flex items-center justify-between transition-all border ${
                      isInvertedRange
                        ? 'border-rose-400 bg-rose-50/50 text-rose-900 shadow-inner'
                        : 'border-gray-200/90 bg-[#F4F7FB] text-gray-800 shadow-inner'
                    }`}
                  >
                    <span className="text-[11.5px] font-bold tracking-tight">
                      {formatShortDate(fromDate) || 'Chọn ngày'}
                    </span>
                    <Calendar className="w-3.5 h-3.5 text-forest-700/70 shrink-0" />
                  </div>
                  <input
                    id="cleanup-from-date-input"
                    type="date"
                    data-testid="cleanup-from-date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="cleanup-to-date-input"
                  className="block text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-1"
                >
                  Đến ngày:
                </label>
                <div className="relative">
                  <div
                    className={`h-9 px-2.5 rounded-xl flex items-center justify-between transition-all border ${
                      isInvertedRange
                        ? 'border-rose-400 bg-rose-50/50 text-rose-900 shadow-inner'
                        : 'border-gray-200/90 bg-[#F4F7FB] text-gray-800 shadow-inner'
                    }`}
                  >
                    <span className="text-[11.5px] font-bold tracking-tight">
                      {formatShortDate(toDate) || 'Chọn ngày'}
                    </span>
                    <Calendar className="w-3.5 h-3.5 text-forest-700/70 shrink-0" />
                  </div>
                  <input
                    id="cleanup-to-date-input"
                    type="date"
                    data-testid="cleanup-to-date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                </div>
              </div>
            </div>

            {/* Inverted Date Range Warning */}
            {isInvertedRange && (
              <div
                data-testid="cleanup-inverted-warning"
                className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-fadeIn"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold text-[11px]">
                  Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.
                </span>
              </div>
            )}
          </div>
        )}

        {cleanupMode === 'before_date' && (
          <div data-testid="cleanup-before-date-inputs" className="space-y-1.5 animate-slideDown">
            <label
              htmlFor="cleanup-before-date-input"
              className="block text-[10.5px] font-bold text-gray-500 uppercase tracking-wider"
            >
              Xóa các hóa đơn hoàn tất trước ngày:
            </label>
            <div className="relative">
              <div className="h-9 px-3 rounded-xl flex items-center justify-between border border-gray-200/90 bg-[#F4F7FB] text-gray-800 shadow-inner">
                <span className="text-[11.5px] font-bold tracking-tight">
                  {formatShortDate(beforeDate) || 'Chọn ngày'}
                </span>
                <Calendar className="w-3.5 h-3.5 text-forest-700/70 shrink-0" />
              </div>
              <input
                id="cleanup-before-date-input"
                type="date"
                data-testid="cleanup-before-date"
                value={beforeDate}
                onChange={(e) => setBeforeDate(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
            </div>
            <p className="text-[10.5px] text-gray-500 font-medium">
              Chỉ xóa các hóa đơn được thanh toán trước 00:00 của ngày {formatShortDate(beforeDate) || beforeDate} (giờ Việt Nam).
            </p>
          </div>
        )}

        {cleanupMode === 'all_completed' && (
          <div
            data-testid="cleanup-all-notice"
            className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 text-emerald-950 text-xs flex items-start gap-2 animate-fadeIn"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-xs">
              <strong>Phạm vi toàn diện:</strong> Lọc tất cả hóa đơn đã thanh toán hoàn tất trong lịch sử. Bàn đang phục vụ sẽ được bảo vệ tuyệt đối.
            </div>
          </div>
        )}
      </div>

      {/* 4. STEP 1: LIVE PREVIEW KPI CARD (3D Clay Hero Card) */}
      <div
        data-testid="cleanup-preview-card"
        className="p-4 rounded-2xl bg-white border border-gray-100 shadow-[0_8px_20px_-4px_rgba(33,78,52,0.06),inset_0_1px_2px_rgba(255,255,255,0.95)] space-y-3 relative overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h4 className="font-black text-gray-900 text-xs tracking-tight">
              Xem trước dữ liệu dọn dẹp
            </h4>
          </div>
          <span className="text-[10.5px] font-bold text-gray-400 font-mono">
            Asia/Ho_Chi_Minh
          </span>
        </div>

        {/* 2 Khối Metric 3D Clay Inset */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#F4F7FB] p-3 rounded-xl border border-gray-200/50 shadow-inner flex flex-col justify-between">
            <span className="text-xs font-bold text-gray-500">Số lượng hóa đơn</span>
            <div
              data-testid="cleanup-preview-count"
              className="text-2xl font-black text-[#214E34] tracking-tight mt-1"
            >
              {preview.count} <span className="text-xs font-bold text-gray-500">đơn</span>
            </div>
          </div>

          <div className="bg-[#F4F7FB] p-3 rounded-xl border border-gray-200/50 shadow-inner flex flex-col justify-between">
            <span className="text-xs font-bold text-gray-500">Tổng tiền doanh thu</span>
            <div
              data-testid="cleanup-preview-revenue"
              className="text-lg font-black text-rose-700 tracking-tight mt-1 truncate"
            >
              {formatVND(preview.totalRevenue)}
            </div>
          </div>
        </div>

        {/* 2 Viên Capsule Tiền mặt & VietQR 3D */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
          <div className="flex items-center justify-between bg-emerald-50/60 px-3 py-2 rounded-xl border border-emerald-100/80 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-[#214E34] font-bold">
              <Banknote className="w-3.5 h-3.5" />
              <span>Tiền mặt</span>
            </div>
            <span
              data-testid="cleanup-preview-cash"
              className="font-black text-[#214E34] text-xs"
            >
              {formatVND(preview.cashTotal)}
            </span>
          </div>

          <div className="flex items-center justify-between bg-blue-50/60 px-3 py-2 rounded-xl border border-blue-100/80 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-blue-800 font-bold">
              <QrCode className="w-3.5 h-3.5" />
              <span>VietQR</span>
            </div>
            <span
              data-testid="cleanup-preview-vietqr"
              className="font-black text-blue-900 text-xs"
            >
              {formatVND(preview.qrTotal)}
            </span>
          </div>
        </div>

        {/* Empty State / Zero Count Notice */}
        {preview.count === 0 && !isInvertedRange && (
          <div
            data-testid="cleanup-zero-orders-notice"
            className="text-center py-2 text-xs font-semibold text-gray-500 bg-gray-50 rounded-xl border border-gray-200/60"
          >
            Không có hóa đơn hoàn tất nào thỏa mãn điều kiện lọc để dọn dẹp.
          </div>
        )}
      </div>

      {/* 5. IMPACT WARNING & DATA PROTECTION GUARANTEE (Accessible metadata hidden to keep UI clean and compact) */}
      <div className="sr-only" aria-hidden="true">
        <div data-testid="cleanup-impact-warning">
          <span>Lưu ý ảnh hưởng dữ liệu doanh thu</span>
          <p>
            Dữ liệu bán hàng đã dọn dẹp sẽ bị xóa khỏi Supabase Cloud và máy POS. Số liệu doanh thu trong màn hình <strong>Báo cáo</strong> sẽ giảm tương ứng và không thể hoàn tác.
          </p>
          <div data-testid="cleanup-protection-guarantee">
            <strong>Bảo vệ an toàn 100%:</strong> Bàn đang phục vụ (<code>serving</code>), thực đơn và nhân viên được bảo vệ nguyên vẹn.
          </div>
        </div>
      </div>

      {/* 6. MAIN TRIGGER BUTTONS: BACKUP & HARD-DELETE */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          data-testid="cleanup-initiate-btn"
          disabled={!canInitiate}
          onClick={handleOpenModal}
          className="touch-target btn-press w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-[0_8px_18px_-3px_rgba(225,29,72,0.35),inset_0_1px_2px_rgba(255,255,255,0.35)] active:scale-98 cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-white" />
          <span>Sao lưu an toàn & Xóa vĩnh viễn ({preview.count} hóa đơn)</span>
        </button>

        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-[11px]">
          <div className="flex items-center gap-2 text-emerald-800 font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
            </span>
            <span>Xác thực Backend: Supabase RPC đã sẵn sàng</span>
          </div>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
            Sẵn sàng
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. STEP 3 & 4: 2-STEP CONFIRMATION MODAL (3D CLAY BOTTOM SHEET)          */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div
          data-testid="cleanup-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
          aria-describedby={modalDescId}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) handleCloseModal();
          }}
        >
          <div className="bg-white w-full max-w-md rounded-[28px] p-5 space-y-4 shadow-2xl border border-gray-100 text-left animate-slideUp">
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100 shadow-2xs font-black text-xs">
                  {modalStep}/2
                </div>
                <div>
                  <h3
                    id={modalTitleId}
                    className="font-black text-gray-900 text-sm"
                  >
                    {modalStep === 1
                      ? 'Bước 1/2: Tải sao lưu & Kiểm tra'
                      : 'Bước 2/2: Xác nhận Xóa vĩnh viễn'}
                  </h3>
                  <p id={modalDescId} className="text-[10.5px] text-gray-400 font-semibold">
                    Quy trình kiểm soát an toàn GÓC POS & Supabase
                  </p>
                </div>
              </div>
              {!isDeleting && (
                <button
                  type="button"
                  data-testid="cleanup-modal-close-btn"
                  onClick={handleCloseModal}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* MODAL STEP 1: SUMMARY & AUTO-BACKUP GUARANTEE */}
            {modalStep === 1 && (
              <div className="space-y-3.5">
                {/* Scope Summary Card */}
                <div
                  data-testid="cleanup-scope-summary"
                  className="bg-[#F4F7FB] p-3.5 rounded-2xl border border-gray-200/60 shadow-inner space-y-2 text-xs"
                >
                  <div className="font-black text-[#214E34] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#214E34]" />
                    <span>Phạm vi dọn dẹp đã chọn:</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-700 pl-5">
                    <div>
                      • Cửa hàng: <strong className="text-gray-900">{storeName}</strong>
                    </div>
                    <div>
                      • Chế độ: <strong>
                        {cleanupMode === 'range' && `Theo khoảng ngày (${formatShortDate(fromDate)} – ${formatShortDate(toDate)})`}
                        {cleanupMode === 'before_date' && `Trước ngày ${formatShortDate(beforeDate)}`}
                        {(cleanupMode === 'all_completed' || cleanupMode === 'all') && 'Toàn bộ lịch sử bán hàng'}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center pr-2 pt-1 border-t border-gray-200/50">
                      <span>• Số lượng: <strong className="text-[#214E34]">{preview.count} hóa đơn</strong></span>
                      <span>• Doanh thu: <strong className="text-rose-700">{formatVND(preview.totalRevenue)}</strong></span>
                    </div>
                    {preview.hasCrossDatePayments && (
                      <div className="text-amber-800 font-bold bg-amber-50 p-2 rounded-lg border border-amber-200">
                        ⚠️ Cảnh báo: Có {preview.crossDatePaymentCount} đơn thanh toán lệch ngày
                      </div>
                    )}
                  </div>
                </div>

                {/* Auto-Backup Action Box */}
                <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs space-y-2.5">
                  <div className="flex items-start gap-2">
                    <FileJson className="w-5 h-5 text-[#214E34] shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <h4 className="font-black text-xs text-gray-900">
                        Bước bắt buộc: Tải file sao lưu an toàn
                      </h4>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                        Hệ thống yêu cầu tạo và tải file JSON sao lưu của {preview.count} hóa đơn này trước khi mở khóa bước xóa.
                      </p>
                    </div>
                  </div>

                  {backupDownloaded ? (
                    <div
                      data-testid="cleanup-backup-downloaded-alert"
                      className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-bold shadow-2xs"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        Đã tải sao lưu: {downloadedFileName}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-testid="cleanup-download-backup-btn"
                      onClick={handleDownloadBackup}
                      className="touch-target btn-press w-full py-3 px-3 bg-gradient-to-r from-[#214E34] to-[#173825] hover:from-[#1b3f2a] hover:to-[#11291b] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_6px_14px_-2px_rgba(33,78,52,0.3)] cursor-pointer active:scale-98"
                    >
                      <Download className="w-4 h-4 text-emerald-300" />
                      <span>Tải file sao lưu (.json) ngay</span>
                    </button>
                  )}
                </div>

                {/* Step 1 Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="cleanup-cancel-modal-btn"
                    onClick={handleCloseModal}
                    className="touch-target btn-press flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    data-testid="cleanup-proceed-to-step2-btn"
                    disabled={!backupDownloaded}
                    onClick={() => setModalStep(2)}
                    className="touch-target btn-press flex-1 py-3 bg-forest-800 hover:bg-forest-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Tiếp tục bước 2</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* MODAL STEP 2: DANGER ALERT & EXPLICIT CONFIRMATION */}
            {modalStep === 2 && (
              <div className="space-y-3.5">
                {/* Permanent Deletion Danger Banner */}
                <div
                  data-testid="cleanup-danger-alert"
                  className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-2.5 text-rose-950 shadow-2xs"
                >
                  <div className="flex items-center gap-2 text-rose-800 font-black text-xs uppercase tracking-wide">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>CẢNH BÁO: XÓA VĨNH VIỄN DỮ LIỆU BÁN HÀNG</span>
                  </div>
                  <p className="text-[11.5px] text-gray-700 leading-relaxed font-medium">
                    Thao tác này sẽ xóa dứt điểm dữ liệu bán hàng trên Supabase Cloud và máy cục bộ. <strong>Hành động không thể hoàn tác!</strong>
                  </p>

                  {/* Scope Details Summary */}
                  <div className="bg-white/90 p-3 rounded-xl border border-rose-100 space-y-1.5 text-xs text-gray-800">
                    <div className="font-black text-gray-900 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-[#214E34]" />
                      <span>Cửa hàng: <strong>{storeName}</strong></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>• Số lượng xóa: <strong className="text-rose-700">{preview.count} đơn hàng</strong></span>
                      <span>• Doanh thu giảm: <strong className="text-rose-700">{formatVND(preview.totalRevenue)}</strong></span>
                    </div>
                  </div>

                  {/* Cross-date payment notice if applicable */}
                  {preview.hasCrossDatePayments && (
                    <div
                      data-testid="cleanup-cross-date-warning"
                      className="p-2.5 rounded-xl bg-amber-100/90 border border-amber-300 text-amber-900 text-[11px] leading-relaxed font-semibold"
                    >
                      <strong>Lưu ý giao dịch lệch ngày:</strong> Có {preview.crossDatePaymentCount} đơn có giao dịch thanh toán khác ngày hoàn thành. Toàn bộ các giao dịch này sẽ bị xóa khỏi lịch sử đối soát thanh toán.
                    </div>
                  )}

                  {/* Scope of tables affected vs preserved (Accessible metadata hidden to keep UI clean and compact) */}
                  <div className="sr-only" aria-hidden="true">
                    <div>• <strong>Bảng bị xóa vĩnh viễn:</strong> Đơn hàng (<code>orders</code>), chi tiết món, giao dịch thanh toán liên quan (<code>payments</code>).</div>
                    <div>• <strong>Bảo toàn nguyên vẹn 100%:</strong> Tài khoản, nhân viên (<code>staff_profiles</code>), phân quyền, thực đơn, danh mục, bàn ăn (<code>tables</code>), cấu hình quán, máy in.</div>
                  </div>
                </div>

                {/* Type Confirmation Input: "XÓA DỮ LIỆU" */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-[#F4F7FB] border border-gray-200 shadow-inner">
                  <label
                    htmlFor="cleanup-confirm-text-input"
                    className="block text-xs font-bold text-gray-800"
                  >
                    Nhập chính xác cụm từ <span className="text-rose-600 font-black tracking-wide">XÓA DỮ LIỆU</span> để xác nhận:
                  </label>
                  <div className="relative">
                    <input
                      id="cleanup-confirm-text-input"
                      type="text"
                      data-testid="cleanup-confirm-input"
                      value={confirmDeleteText}
                      onChange={(e) => setConfirmDeleteText(e.target.value)}
                      placeholder="Nhập XÓA DỮ LIỆU"
                      className={`w-full px-3 py-2.5 rounded-xl text-xs font-black text-center tracking-wider transition-all ${
                        confirmDeleteText.trim() === 'XÓA DỮ LIỆU'
                          ? 'border-2 border-emerald-500 bg-emerald-50/60 text-emerald-900 shadow-xs'
                          : 'border border-gray-300 bg-white text-gray-900'
                      }`}
                      autoComplete="off"
                    />
                    {confirmDeleteText.trim() === 'XÓA DỮ LIỆU' && (
                      <Check className="w-4 h-4 text-emerald-600 absolute right-3 top-3" />
                    )}
                  </div>
                </div>

                {/* Explicit Confirmation Checkbox */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100/70 transition-colors">
                  <input
                    type="checkbox"
                    data-testid="cleanup-confirm-checkbox"
                    checked={isConfirmedChecked}
                    onChange={(e) => setIsConfirmedChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-rose-700 rounded border-gray-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <span className="text-[11.5px] text-gray-800 leading-snug font-semibold">
                    Tôi xác nhận đã tải tệp sao lưu và đồng ý xóa vĩnh viễn <strong>{preview.count} đơn hàng</strong> này khỏi Supabase Cloud và máy POS.
                  </span>
                </label>

                {/* Step 2 Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="cleanup-back-step-btn"
                    disabled={isDeleting}
                    onClick={() => setModalStep(1)}
                    className="touch-target btn-press flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Quay lại</span>
                  </button>
                  <button
                    type="button"
                    data-testid="cleanup-execute-delete-btn"
                    disabled={!isConfirmedChecked || confirmDeleteText.trim() !== 'XÓA DỮ LIỆU' || isDeleting || preview.count === 0}
                    onClick={handleExecuteDelete}
                    className="touch-target btn-press flex-1 py-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs transition-all shadow-[0_6px_16px_-2px_rgba(225,29,72,0.35)] flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang xóa Supabase...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                        <span>Xóa vĩnh viễn dữ liệu</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
