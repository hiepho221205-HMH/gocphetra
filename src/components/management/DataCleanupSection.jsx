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
  RotateCcw,
  Banknote,
  QrCode,
  FileJson,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Layers,
  HelpCircle,
  Lock,
  Archive,
  Store,
  Check
} from 'lucide-react';

/**
 * DataCleanupSection Component - Milestone 3
 *
 * Implements the 4-step safety sales data cleanup flow:
 * 1. Scope Selection & Live Preview (KPI Cards: Orders, Revenue, Cash, VietQR in Asia/Ho_Chi_Minh).
 * 2. Impact Warning Notice (Explaining report revenue reduction & active table protection).
 * 3. 2-Step Confirmation Modal - Step A: Auto-backup guarantee & scope confirmation.
 * 4. 2-Step Confirmation Modal - Step B: Irreversible hard-delete confirmation.
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

  // Scope Mode State: 'range' | 'before_date' | 'all_completed' | null (Defaults to null per Zero-Trust Admin safety)
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
        showToast?.(`Đã tải xuống file sao lưu: ${fileName}`, 'success');
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
      } else {
        // Fallback safety log
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
      className="glass-panel-elevated p-4 rounded-3xl border border-white/80 shadow-glass space-y-4"
    >
      {/* 1. SECTION HEADER */}
      <div className="flex items-center justify-between border-b border-forest-800/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100 shadow-2xs">
            <Trash2 className="w-4 h-4 text-rose-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider">
                Dọn dẹp Dữ liệu Bán hàng
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-forest-50 text-forest-800 border border-forest-200">
                An toàn 4 bước
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">
              Xóa vĩnh viễn hóa đơn lịch sử cũ kèm cơ chế tự động sao lưu JSON
            </p>
          </div>
        </div>
      </div>

      {/* Non-Admin Locked Alert */}
      {!isAdmin && (
        <div
          data-testid="cleanup-non-admin-alert"
          className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-950 animate-fadeIn"
        >
          <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed text-[11px]">
            <strong>Tính năng giới hạn:</strong> Thao tác xóa và lưu trữ dữ liệu bán hàng yêu cầu quyền <strong>Quản trị viên (Admin)</strong>. Vai trò hiện tại (<strong>{currentRole?.toUpperCase()}</strong>) không được phép thực hiện.
          </div>
        </div>
      )}

      {/* 2. SCOPE MODE SELECTOR TABS (3 Modes) */}
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-gray-700">
          Chế độ lựa chọn phạm vi:
        </label>
        <div
          data-testid="cleanup-scope-tabs"
          className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-forest-50/60 border border-forest-800/10"
        >
          {/* Tab 1: Range */}
          <button
            type="button"
            data-testid="cleanup-tab-range"
            onClick={() => setCleanupMode('range')}
            className={`touch-target btn-press py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              cleanupMode === 'range'
                ? 'bg-forest-800 text-white shadow-xs'
                : 'text-forest-900/80 hover:text-forest-900 hover:bg-forest-100/60'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Theo khoảng ngày</span>
          </button>

          {/* Tab 2: Before Date */}
          <button
            type="button"
            data-testid="cleanup-tab-before-date"
            onClick={() => setCleanupMode('before_date')}
            className={`touch-target btn-press py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              cleanupMode === 'before_date'
                ? 'bg-forest-800 text-white shadow-xs'
                : 'text-forest-900/80 hover:text-forest-900 hover:bg-forest-100/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Trước mốc ngày</span>
          </button>

          {/* Tab 3: All History */}
          <button
            type="button"
            data-testid="cleanup-tab-all"
            onClick={() => setCleanupMode('all_completed')}
            className={`touch-target btn-press py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              cleanupMode === 'all_completed'
                ? 'bg-forest-800 text-white shadow-xs'
                : 'text-forest-900/80 hover:text-forest-900 hover:bg-forest-100/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Toàn bộ lịch sử</span>
          </button>
        </div>
      </div>

      {/* 3. DYNAMIC DATE PICKERS */}
      <div className="space-y-2">
        {cleanupMode === null && (
          <div
            data-testid="cleanup-no-mode-selected"
            className="p-3.5 rounded-2xl bg-forest-50/50 border border-forest-200/50 text-forest-900 text-xs flex items-center gap-2.5 animate-fadeIn"
          >
            <HelpCircle className="w-4 h-4 text-forest-700 shrink-0" />
            <span className="font-medium text-[11.5px]">
              Vui lòng chọn 1 trong 3 chế độ ở trên để tải bản xem trước dữ liệu cần dọn dẹp.
            </span>
          </div>
        )}

        {cleanupMode === 'range' && (
          <div data-testid="cleanup-range-inputs" className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="cleanup-from-date-input"
                  className="block text-[11px] font-bold text-gray-700 mb-1"
                >
                  Từ ngày:
                </label>
                <div className="relative">
                  <input
                    id="cleanup-from-date-input"
                    type="date"
                    data-testid="cleanup-from-date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className={`glass-input w-full px-2.5 py-2 rounded-xl text-xs text-gray-900 font-medium ${
                      isInvertedRange ? 'border-rose-400 bg-rose-50/30' : ''
                    }`}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="cleanup-to-date-input"
                  className="block text-[11px] font-bold text-gray-700 mb-1"
                >
                  Đến ngày:
                </label>
                <div className="relative">
                  <input
                    id="cleanup-to-date-input"
                    type="date"
                    data-testid="cleanup-to-date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className={`glass-input w-full px-2.5 py-2 rounded-xl text-xs text-gray-900 font-medium ${
                      isInvertedRange ? 'border-rose-400 bg-rose-50/30' : ''
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Inverted Date Range Warning */}
            {isInvertedRange && (
              <div
                data-testid="cleanup-inverted-warning"
                className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-2 animate-fadeIn"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">
                  Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.
                </span>
              </div>
            )}
          </div>
        )}

        {cleanupMode === 'before_date' && (
          <div data-testid="cleanup-before-date-inputs" className="space-y-1.5">
            <label
              htmlFor="cleanup-before-date-input"
              className="block text-[11px] font-bold text-gray-700"
            >
              Xóa các hóa đơn hoàn tất trước ngày:
            </label>
            <input
              id="cleanup-before-date-input"
              type="date"
              data-testid="cleanup-before-date"
              value={beforeDate}
              onChange={(e) => setBeforeDate(e.target.value)}
              className="glass-input w-full px-2.5 py-2 rounded-xl text-xs text-gray-900 font-medium"
            />
            <p className="text-[10.5px] text-gray-500">
              Chỉ xóa các hóa đơn được thanh toán trước 00:00 của ngày {formatShortDate(beforeDate) || beforeDate} (theo giờ Việt Nam).
            </p>
          </div>
        )}

        {cleanupMode === 'all_completed' && (
          <div
            data-testid="cleanup-all-notice"
            className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/70 text-amber-900 text-xs flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Phạm vi toàn diện:</strong> Hệ thống sẽ chọn tất cả hóa đơn đã thanh toán hoàn tất trong toàn bộ lịch sử từ trước đến nay. Bàn đang phục vụ sẽ được bảo vệ tuyệt đối.
            </div>
          </div>
        )}
      </div>

      {/* 4. STEP 1: LIVE PREVIEW KPI CARD */}
      <div
        data-testid="cleanup-preview-card"
        className="glass-panel p-3.5 rounded-2xl border border-white/80 shadow-xs space-y-2.5"
      >
        <div className="flex items-center justify-between border-b border-forest-800/10 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h4 className="font-bold text-gray-900 text-xs">
              Xem trước dữ liệu dọn dẹp (Live Preview)
            </h4>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">
            Asia/Ho_Chi_Minh
          </span>
        </div>

        {/* KPI Grid: Count, Total Revenue, Cash, VietQR */}
        <div className="grid grid-cols-2 gap-2">
          {/* KPI 1: Orders Count */}
          <div className="bg-white/80 p-2.5 rounded-xl border border-forest-800/10 space-y-1">
            <span className="text-[10.5px] text-gray-500 font-medium">Số lượng hóa đơn</span>
            <div
              data-testid="cleanup-preview-count"
              className="text-base font-black text-forest-900 tracking-tight"
            >
              {preview.count} <span className="text-xs font-semibold text-gray-500">đơn</span>
            </div>
          </div>

          {/* KPI 2: Total Revenue */}
          <div className="bg-white/80 p-2.5 rounded-xl border border-forest-800/10 space-y-1">
            <span className="text-[10.5px] text-gray-500 font-medium">Tổng tiền doanh thu</span>
            <div
              data-testid="cleanup-preview-revenue"
              className="text-base font-black text-forest-900 tracking-tight truncate"
            >
              {formatVND(preview.totalRevenue)}
            </div>
          </div>

          {/* KPI 3: Cash Breakdown */}
          <div className="bg-forest-50/50 p-2 rounded-xl border border-forest-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-forest-700" />
              <span className="text-[11px] text-gray-600 font-medium">Tiền mặt</span>
            </div>
            <span
              data-testid="cleanup-preview-cash"
              className="font-bold text-forest-900 text-[11px]"
            >
              {formatVND(preview.cashTotal)}
            </span>
          </div>

          {/* KPI 4: VietQR Breakdown */}
          <div className="bg-emerald-50/50 p-2 rounded-xl border border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-[11px] text-gray-600 font-medium">VietQR</span>
            </div>
            <span
              data-testid="cleanup-preview-vietqr"
              className="font-bold text-emerald-900 text-[11px]"
            >
              {formatVND(preview.qrTotal)}
            </span>
          </div>
        </div>

        {/* Empty State / Zero Count Notice */}
        {preview.count === 0 && !isInvertedRange && (
          <div
            data-testid="cleanup-zero-orders-notice"
            className="text-center py-2 text-[11px] text-gray-500 bg-gray-50/80 rounded-xl border border-gray-200/60"
          >
            Không có hóa đơn hoàn tất nào thỏa mãn điều kiện lọc để dọn dẹp.
          </div>
        )}
      </div>

      {/* 5. STEP 2: IMPACT WARNING NOTICE & ISOLATION GUARANTEE */}
      <div
        data-testid="cleanup-impact-warning"
        className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3 space-y-2 shadow-2xs"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="font-bold text-xs text-amber-950">
              Cảnh báo ảnh hưởng dữ liệu doanh thu
            </h5>
            <p className="text-[11px] text-amber-900/90 leading-relaxed">
              Thao tác dọn dẹp sẽ xóa vĩnh viễn các hóa đơn đã thanh toán nằm trong phạm vi đã chọn khỏi bộ nhớ thiết bị và Supabase Cloud. Toàn bộ số liệu doanh thu trong màn hình <strong>Báo cáo</strong> tương ứng với các ngày này sẽ bị điều chỉnh giảm và KHÔNG thể hoàn tác.
            </p>
          </div>
        </div>

        {/* Active Dining Isolation Guarantee Box */}
        <div
          data-testid="cleanup-protection-guarantee"
          className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60 flex items-start gap-2 text-[10.5px] text-gray-700"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Cam kết bảo vệ dữ liệu:</strong> Bàn đang phục vụ (<code>serving</code>), bàn chờ thanh toán (<code>awaiting_payment</code>), danh mục, thực đơn, nhân viên và cấu hình quán được bảo vệ an toàn 100%, không bị ảnh hưởng.
          </div>
        </div>
      </div>

      {/* 6. MAIN TRIGGER BUTTONS: ARCHIVE (PRIMARY) & HARD-DELETE (DISABLED) */}
      <div className="space-y-2">
        <button
          type="button"
          data-testid="cleanup-initiate-btn"
          disabled={!canInitiate}
          onClick={handleOpenModal}
          className="touch-target btn-press w-full py-3 px-4 bg-forest-800 hover:bg-forest-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
        >
          <Archive className="w-4 h-4 text-emerald-300" />
          <span>Lưu trữ an toàn & Xuất backup ({preview.count} hóa đơn)</span>
        </button>

        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-gray-50 border border-gray-200/80 text-[10.5px]">
          <div className="flex items-center gap-1.5 text-gray-500">
            <Lock className="w-3.5 h-3.5 text-gray-400" />
            <span>Xóa vĩnh viễn (Chờ xác thực Backend)</span>
          </div>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-gray-200/70 text-gray-500">
            Tạm khóa
          </span>
        </div>

        {preview.count === 0 && !isInvertedRange && (
          <p className="text-[10px] text-gray-400 text-center mt-1">
            Không có hóa đơn hoàn tất nào phù hợp trong phạm vi đã chọn
          </p>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 7. STEP 3 & 4: 2-STEP CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div
          data-testid="cleanup-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
          aria-describedby={modalDescId}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) handleCloseModal();
          }}
        >
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-4 shadow-2xl border border-gray-100 text-left">
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-rose-700" />
                </div>
                <div>
                  <h3
                    id={modalTitleId}
                    className="font-extrabold text-forest-900 text-sm"
                  >
                    {modalStep === 1
                      ? 'Bước 1/2: Tải sao lưu & Kiểm tra'
                      : 'Bước 2/2: Xác nhận Xóa vĩnh viễn dữ liệu bán hàng'}
                  </h3>
                  <p id={modalDescId} className="text-[10px] text-gray-400">
                    Quy trình kiểm soát an toàn nhiều bước GÓC POS & Supabase Cloud
                  </p>
                </div>
              </div>
              {!isDeleting && (
                <button
                  type="button"
                  data-testid="cleanup-modal-close-btn"
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
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
                  className="bg-forest-50/70 p-3 rounded-2xl border border-forest-200/70 space-y-2 text-xs"
                >
                  <div className="font-bold text-forest-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-forest-700" />
                    <span>Phạm vi dọn dẹp đã chọn:</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-gray-700 pl-5">
                    <div>
                      • Cửa hàng: <strong className="text-forest-950">{storeName}</strong>
                    </div>
                    <div>
                      • Chế độ: <strong>
                        {cleanupMode === 'range' && `Theo khoảng ngày (${formatShortDate(fromDate)} – ${formatShortDate(toDate)})`}
                        {cleanupMode === 'before_date' && `Trước ngày ${formatShortDate(beforeDate)}`}
                        {(cleanupMode === 'all_completed' || cleanupMode === 'all') && 'Toàn bộ lịch sử bán hàng'}
                      </strong>
                    </div>
                    <div>
                      • Số lượng: <strong className="text-forest-900">{preview.count} hóa đơn</strong>
                    </div>
                    <div>
                      • Doanh thu: <strong className="text-forest-900">{formatVND(preview.totalRevenue)}</strong>
                    </div>
                    {preview.hasCrossDatePayments && (
                      <div className="text-amber-800 font-semibold">
                        • Cảnh báo: Có {preview.crossDatePaymentCount} đơn thanh toán lệch ngày
                      </div>
                    )}
                  </div>
                </div>

                {/* Auto-Backup Action Box */}
                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <FileJson className="w-5 h-5 text-forest-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs text-gray-900">
                        Bước bắt buộc: Tải file sao lưu an toàn
                      </h4>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Hệ thống yêu cầu tạo và tải file sao lưu JSON chứa toàn bộ dữ liệu chi tiết của {preview.count} hóa đơn này trước khi cho phép xác nhận xóa.
                      </p>
                    </div>
                  </div>

                  {backupDownloaded ? (
                    <div
                      data-testid="cleanup-backup-downloaded-alert"
                      className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <strong>Đã tải sao lưu:</strong> {downloadedFileName}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-testid="cleanup-download-backup-btn"
                      onClick={handleDownloadBackup}
                      className="touch-target btn-press w-full py-2.5 px-3 bg-white hover:bg-forest-50 text-forest-900 border border-forest-800/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs"
                    >
                      <Download className="w-4 h-4 text-forest-700" />
                      <span>Tải file sao lưu (.json)</span>
                    </button>
                  )}
                </div>

                {/* Step 1 Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="cleanup-cancel-modal-btn"
                    onClick={handleCloseModal}
                    className="touch-target btn-press flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    data-testid="cleanup-proceed-to-step2-btn"
                    disabled={!backupDownloaded}
                    onClick={() => setModalStep(2)}
                    className="touch-target btn-press flex-1 py-2.5 bg-forest-800 hover:bg-forest-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
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
                  className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-2 text-rose-950"
                >
                  <div className="flex items-center gap-2 text-rose-800 font-extrabold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>CẢNH BÁO: XÓA VĨNH VIỄN DỮ LIỆU BÁN HÀNG</span>
                  </div>
                  <p className="text-[11px] text-gray-800 leading-relaxed">
                    Thao tác này sẽ xóa vĩnh viễn dữ liệu bán hàng trên Supabase Cloud và máy cục bộ. <strong>Hành động không thể hoàn tác!</strong>
                  </p>

                  {/* Scope Details Summary */}
                  <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100 space-y-1 text-[11px] text-gray-800">
                    <div className="font-semibold text-forest-950 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-forest-800" />
                      <span>Cửa hàng: <strong>{storeName}</strong></span>
                    </div>
                    <div>
                      • Phạm vi: <strong>
                        {cleanupMode === 'range' && `Theo khoảng ngày (${formatShortDate(fromDate)} – ${formatShortDate(toDate)})`}
                        {cleanupMode === 'before_date' && `Trước ngày ${formatShortDate(beforeDate)}`}
                        {(cleanupMode === 'all_completed' || cleanupMode === 'all') && 'Toàn bộ lịch sử bán hàng'}
                      </strong>
                    </div>
                    <div>
                      • Số lượng đơn sẽ xóa: <strong className="text-rose-700">{preview.count} đơn hàng</strong>
                    </div>
                    <div>
                      • Doanh thu ước tính bị giảm: <strong className="text-rose-700">{formatVND(preview.totalRevenue)}</strong>
                    </div>
                  </div>

                  {/* Cross-date payment notice if applicable */}
                  {preview.hasCrossDatePayments && (
                    <div
                      data-testid="cleanup-cross-date-warning"
                      className="p-2 rounded-xl bg-amber-100/80 border border-amber-300 text-amber-900 text-[10.5px] leading-relaxed"
                    >
                      <strong>Lưu ý giao dịch lệch ngày:</strong> Có {preview.crossDatePaymentCount} đơn có giao dịch thanh toán khác ngày hoàn thành. Toàn bộ các giao dịch này sẽ bị xóa khỏi lịch sử đối soát thanh toán.
                    </div>
                  )}

                  {/* Scope of tables affected vs preserved */}
                  <div className="text-[10px] space-y-1 text-gray-600 border-t border-rose-200/50 pt-2">
                    <div>• <strong>Bảng bị xóa vĩnh viễn:</strong> Đơn hàng (<code>orders</code>), chi tiết món, giao dịch thanh toán liên quan (<code>payments</code>).</div>
                    <div>• <strong>Bảo toàn nguyên vẹn 100%:</strong> Tài khoản, nhân viên (<code>staff_profiles</code>), phân quyền, thực đơn, danh mục, bàn ăn (<code>tables</code>), cấu hình quán, máy in.</div>
                  </div>
                </div>

                {/* Type Confirmation Input: "XÓA DỮ LIỆU" */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-gray-50 border border-gray-200">
                  <label
                    htmlFor="cleanup-confirm-text-input"
                    className="block text-[11px] font-bold text-gray-800"
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
                      className={`glass-input w-full px-3 py-2 rounded-xl text-xs font-bold ${
                        confirmDeleteText.trim() === 'XÓA DỮ LIỆU'
                          ? 'border-emerald-500 bg-emerald-50/30 text-emerald-900'
                          : 'text-gray-900 border-gray-300'
                      }`}
                      autoComplete="off"
                    />
                    {confirmDeleteText.trim() === 'XÓA DỮ LIỆU' && (
                      <Check className="w-4 h-4 text-emerald-600 absolute right-2.5 top-2.5" />
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
                    className="mt-0.5 w-4 h-4 text-forest-700 rounded border-gray-300 focus:ring-forest-500"
                  />
                  <span className="text-[11px] text-gray-800 leading-snug font-medium">
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
                    className="touch-target btn-press flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Quay lại</span>
                  </button>
                  <button
                    type="button"
                    data-testid="cleanup-execute-delete-btn"
                    disabled={!isConfirmedChecked || confirmDeleteText.trim() !== 'XÓA DỮ LIỆU' || isDeleting || preview.count === 0}
                    onClick={handleExecuteDelete}
                    className="touch-target btn-press flex-1 py-2.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
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
