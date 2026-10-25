import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePos } from '../../store/PosContext';
import { formatVND } from '../../utils/currency';
import { formatReceiptDateTime, buildReceiptModel } from '../../utils/receiptEngine';
import {
  downloadOnlineBillImage,
  exportOnlineBillFile,
  preloadLogoImage
} from '../../utils/onlineBillCanvasRenderer';
import { triggerHaptic } from '../../utils/haptics';
import {
  Share2,
  Download,
  X,
  CheckCircle2,
  Clock,
  Loader2
} from 'lucide-react';

export default function OnlineBillModal({
  isOpen,
  onClose,
  order,
  receiptRecord = null,
  isPaidOverride = null
}) {
  const { settings, showToast } = usePos();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Preload logo image and lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      preloadLogoImage();
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Support ESC key to safely close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  // Build canonical receipt model
  const model = buildReceiptModel({
    order,
    storeSettings: settings,
    receiptRecord
  });

  const isOrderPaid = isPaidOverride !== null
    ? isPaidOverride
    : (order.status === 'completed' || Boolean(order.paidAt) || Boolean(order.paid_at));

  // Ensure model reflects payment status
  model.isPaid = isOrderPaid;

  const storeName = (model.store?.storeName || 'GÓC PHÊ – TRÀ').toUpperCase();
  const storeAddress = model.store?.storeAddress || '76A Võ Văn Dũng, P. An Nhơn, Gia Lai';
  const contactPhone = model.store?.contactPhone || '0369623489';
  const formattedDateTime = formatReceiptDateTime(model.receiptIssuedAt || model.orderCreatedAt);
  const customerName = order.customerName || order.customer || 'Khách lẻ';
  const tableLabel = model.table ? `Bàn: ${model.table}` : 'Mang đi';
  const orderCode = model.orderId ? `#${model.orderId}` : '#ORD-GOC';

  const subtotal = model.subtotal || 0;
  const discountAmount = model.discountAmount || 0;
  const discountPercent = model.discountPercent || 0;
  const surcharge = model.surcharge || 0;
  const grandTotal = model.total || (subtotal - discountAmount + surcharge);
  const totalItemCount = (model.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);

  // Action 1: Lưu ảnh PNG về thiết bị
  const handleDownloadImage = async () => {
    if (isDownloading) return;
    triggerHaptic('medium');
    setIsDownloading(true);

    try {
      const fileName = await downloadOnlineBillImage(model);
      triggerHaptic('success');
      showToast?.(`Đã lưu ảnh hóa đơn: ${fileName}`, 'success');
    } catch (err) {
      console.error('Lỗi khi tải ảnh hóa đơn:', err);
      triggerHaptic('error');
      showToast?.('Không thể tạo file ảnh hóa đơn. Vui lòng thử lại!', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  // Action 2: Chia sẻ hóa đơn qua Web Share API (CHỈ TRUYỀN FILE ẢNH, KHÔNG GỬI TEXT/TITLE/URL)
  const handleShareBill = async () => {
    if (isSharing) return;
    triggerHaptic('medium');
    setIsSharing(true);

    try {
      const file = await exportOnlineBillFile(model);

      // STRICTLY FILE ONLY: No title, No text, No URL to prevent unwanted default captions
      const shareData = {
        files: [file]
      };

      // Check if Web Share API with files is supported
      if (
        typeof navigator !== 'undefined' &&
        navigator.share &&
        navigator.canShare &&
        navigator.canShare(shareData)
      ) {
        await navigator.share(shareData);
        triggerHaptic('success');
      } else {
        // Fallback: Auto download PNG and notify user how to send manually
        await downloadOnlineBillImage(model);
        triggerHaptic('light');
        showToast?.('Đã lưu ảnh hóa đơn vào máy! Bạn có thể gửi ảnh qua Zalo hoặc Messenger.', 'info');
      }
    } catch (err) {
      // AbortError indicates the user dismissed the share dialog — ignore quietly
      if (err.name === 'AbortError') {
        return;
      }
      console.warn('Lỗi Web Share API, kích hoạt fallback:', err);
      try {
        await downloadOnlineBillImage(model);
        triggerHaptic('light');
        showToast?.('Đã lưu ảnh hóa đơn vào máy! Bạn có thể gửi ảnh qua Zalo hoặc Messenger.', 'info');
      } catch (fallbackErr) {
        triggerHaptic('error');
        showToast?.('Không thể xuất file ảnh. Vui lòng thử lại!', 'error');
      }
    } finally {
      setIsSharing(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="online-bill-title"
      className="fixed inset-0 z-[9500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-fadeIn select-none"
    >
      {/* Modal Keyframes for Ambient Pastel Glow */}
      <style>{`
        @keyframes modal-aurora-spin {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes modal-aurora-rev {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(-360deg); }
        }
      `}</style>

      <div className="clay-card rounded-[28px] w-full max-w-[430px] h-full max-h-[min(94dvh,820px)] flex flex-col p-0 overflow-hidden shadow-2xl bg-white animate-slideUp border border-gray-100">
        {/* ================= MODAL HEADER ================= */}
        <div className="shrink-0 px-5 py-3.5 bg-gradient-to-r from-[#214E34] to-[#2E6744] text-white flex items-center justify-between shadow-xs z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-emerald-300 stroke-[2.2]" />
            </div>
            <div>
              <h3 id="online-bill-title" className="font-black text-sm">
                Xuất hóa đơn online
              </h3>
              <p className="text-[10px] text-emerald-200 font-semibold">
                Lưu ảnh PNG hoặc chia sẻ qua Zalo/Messenger
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white cursor-pointer transition-colors"
            title="Đóng xem trước"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* ================= SCROLLABLE BILL PREVIEW (PASTEL GLOW) ================= */}
        <div className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-touch-contain p-4 sm:p-5 bg-gradient-to-br from-[#ffe8f3] via-[#edf6fc] to-[#d9f3ff] overflow-x-hidden no-scrollbar">
          {/* Animated Ambient Aurora Glow Background Layers */}
          <div
            className="absolute top-1/2 left-1/2 w-[180%] h-[180%] rounded-full bg-[conic-gradient(from_0deg,#ff9aa2,#ffb7b2,#ffdac1,#e2f0cb,#a2e4ff,#c9afff,#ffb7b2,#ff9aa2)] blur-[50px] opacity-70 pointer-events-none"
            style={{ animation: 'modal-aurora-spin 16s linear infinite' }}
          />
          <div
            className="absolute top-1/2 left-1/2 w-[150%] h-[150%] rounded-full bg-[conic-gradient(from_180deg,#c9afff,#a2e4ff,#e2f0cb,#ffdac1,#ffb7b2,#c9afff)] blur-[55px] opacity-55 pointer-events-none"
            style={{ animation: 'modal-aurora-rev 22s linear infinite' }}
          />
          <div className="absolute inset-0 bg-radial from-white/30 via-transparent to-black/5 pointer-events-none" />

          {/* Centered White Card with 30px Border Radius & Subtle Shadow */}
          <div
            id="digital-receipt-card"
            className="relative z-10 bg-white/95 backdrop-blur-md rounded-[30px] p-5 sm:p-6 shadow-xl border border-white/80 space-y-3.5 text-xs text-gray-800 overflow-hidden"
          >
            {/* Subtle GÓC Watermark Logo at Center (Opacity ~0.07) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.07] z-0">
              <img
                src="/images/goc-logo.png"
                alt=""
                className="w-56 h-56 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            {/* Inner Content Layer */}
            <div className="relative z-10 space-y-3.5">
              {/* Minimalist Centered Store Branding */}
              <div className="text-center space-y-1">
                <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight uppercase">
                  {storeName}
                </h2>
                <p className="text-[11.5px] text-gray-600 font-semibold leading-relaxed">
                  <span className="font-bold text-gray-800">ĐC:</span> {storeAddress}
                </p>
                <p className="text-[11.5px] text-gray-600 font-semibold">
                  <span className="font-bold text-gray-800">Hotline:</span> {contactPhone}
                </p>
              </div>

              {/* Dashed Separator */}
              <div className="border-b border-dashed border-gray-200" />

              {/* Order Metadata */}
              <div className="space-y-1 text-[11.5px] font-semibold text-gray-700">
                <div className="flex items-center justify-between">
                  <span><strong className="text-gray-900">Ngày:</strong> {formattedDateTime}</span>
                  <span><strong className="text-gray-900">Mã đơn:</strong> {orderCode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#214E34] font-bold">Khu vực: {tableLabel}</span>
                  <span className="text-gray-600"><strong className="text-gray-800">KH:</strong> {customerName}</span>
                </div>
              </div>

              {/* Dashed Separator */}
              <div className="border-b border-dashed border-gray-200" />

              {/* Line Items List */}
              <div className="space-y-2.5">
                {model.items && model.items.length > 0 ? (
                  model.items.map((it, idx) => {
                    const qty = it.quantity || 1;
                    const unitPrice = it.effectiveUnitPrice || it.price || 0;
                    const lineTotal = it.lineTotal || (qty * unitPrice);

                    return (
                      <div key={idx} className="space-y-0.5">
                        {/* Item Name & Line Total */}
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-black text-gray-900 text-xs sm:text-[13px] uppercase tracking-wide">
                            {it.name}
                          </span>
                          <span className="font-black text-gray-900 text-xs sm:text-[13px] shrink-0">
                            {formatVND(lineTotal)}
                          </span>
                        </div>

                        {/* Qty x Price */}
                        <div className="text-[11.5px] text-gray-600 font-semibold">
                          {qty} × {formatVND(unitPrice)}
                        </div>

                        {/* Toppings (if any) */}
                        {it.toppings && it.toppings.length > 0 && (
                          <div className="text-[10.5px] text-gray-500 pl-2 font-medium">
                            {it.toppings.map((tp, tpIdx) => (
                              <div key={tpIdx}>
                                + {tp.name}{tp.price ? ` (${formatVND(tp.price)})` : ''}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Notes (if any) */}
                        {it.notes && (
                          <div className="text-[10px] text-gray-400 italic pl-2">
                            Ghi chú: {it.notes}
                          </div>
                        )}

                        {/* Item divider */}
                        {idx < model.items.length - 1 && (
                          <div className="pt-1.5 border-b border-dashed border-gray-100" />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 text-center text-gray-400 font-semibold text-xs">
                    Chưa có món nào trong đơn
                  </div>
                )}
              </div>

              {/* Dashed Separator */}
              <div className="border-b border-dashed border-gray-300" />

              {/* Financial Summary */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-gray-600 font-semibold">
                  <span>Tổng tiền hàng ({totalItemCount} món)</span>
                  <span className="font-bold text-gray-900">{formatVND(subtotal)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-emerald-800 font-bold">
                    <span>Chiết khấu ({discountPercent}%)</span>
                    <span>-{formatVND(discountAmount)}</span>
                  </div>
                )}

                {surcharge > 0 && (
                  <div className="flex items-center justify-between text-gray-600 font-bold">
                    <span>Phụ thu / Phí dịch vụ</span>
                    <span>+{formatVND(surcharge)}</span>
                  </div>
                )}

                {/* Grand Total Highlighted in Brand Color #214E34 */}
                <div className="pt-2 border-t border-dashed border-gray-300 flex items-baseline justify-between font-black">
                  <span className="text-xs sm:text-sm text-gray-900 uppercase">
                    TỔNG CỘNG
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-[#214E34]">
                    {formatVND(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Full-Width Payment Status Badge */}
              <div
                className={`py-2.5 px-3 rounded-xl text-center text-xs font-black border transition-all ${
                  isOrderPaid
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {isOrderPaid ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      ✔ ĐÃ THANH TOÁN {model.paymentMethodLabel ? `• ${model.paymentMethodLabel.toUpperCase()}` : ''}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>⏳ CHƯA THANH TOÁN</span>
                  </div>
                )}
              </div>

              {/* Footer Closing */}
              <div className="text-center pt-2 text-[11.5px] text-gray-500 font-medium space-y-0.5">
                <p>{model.store?.receiptFooter || 'Cảm ơn quý khách và hẹn gặp lại!'}</p>
                <p className="text-[10px] text-gray-400 font-semibold">Một sản phẩm của GÓC POS</p>
              </div>
            </div>
          </div>
        </div>

        {/* ================= PINNED ACTION FOOTER ================= */}
        <div className="shrink-0 p-3 sm:px-5 sm:py-3.5 bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center gap-2.5 pb-[max(14px,env(safe-area-inset-bottom,14px))] z-20">
          {/* Button 1: Lưu ảnh PNG */}
          <button
            type="button"
            disabled={isDownloading || isSharing}
            onClick={handleDownloadImage}
            className="flex-1 min-h-[44px] py-2.5 px-3 rounded-[16px] text-xs font-bold text-gray-700 clay-pill-btn active:scale-97 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#214E34]" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-[#214E34]" />
                <span>Lưu ảnh</span>
              </>
            )}
          </button>

          {/* Button 2: Chia sẻ qua Web Share API (Zalo, Messenger) - STRICTLY FILE ONLY */}
          <button
            type="button"
            disabled={isDownloading || isSharing}
            onClick={handleShareBill}
            className="flex-1 min-h-[44px] py-2.5 px-3 rounded-[16px] text-xs font-black text-white clay-btn-primary active:scale-97 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isSharing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 stroke-[2.2]" />
                <span>Chia sẻ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
