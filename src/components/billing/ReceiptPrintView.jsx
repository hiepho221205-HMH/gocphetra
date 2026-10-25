import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePos } from '../../store/PosContext';
import { formatVND } from '../../utils/currency';
import {
  Printer,
  X,
  Bluetooth,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileDown,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  isBluetoothSupported,
  connectBluetoothPrinter,
  getBluetoothPrinterStatus,
  printReceiptThermal
} from '../../utils/bluetoothPrinter';
import { buildReceiptModel } from '../../utils/receiptEngine';
import { processThermalLogo } from '../../utils/thermalLogoProcessor';
import { triggerHaptic } from '../../utils/haptics';

export default function ReceiptPrintView({
  isOpen,
  onClose,
  order,
  receiptRecord = null,
  isPrePrint = false,
  overridePaperWidth = null
}) {
  const { settings, showToast, recordReceiptReprintAction } = usePos();

  // Active paper width state (defaults to prop or store settings, switchable in modal)
  const [selectedWidth, setSelectedWidth] = useState(
    overridePaperWidth || receiptRecord?.paper_width || settings?.receiptPaperWidth || '58mm'
  );

  const [btStatus, setBtStatus] = useState({ isSupported: false, isConnected: false, deviceName: null });
  const [isPrintingBt, setIsPrintingBt] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBtStatus(getBluetoothPrinterStatus());
      if (overridePaperWidth) setSelectedWidth(overridePaperWidth);
    }
  }, [isOpen, overridePaperWidth]);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  // Build normalized canonical receipt model
  const model = buildReceiptModel({
    order,
    storeSettings: settings,
    receiptRecord,
    isPrePrint,
    overridePaperWidth: selectedWidth
  });

  const handleBrowserPrint = async () => {
    triggerHaptic('light');

    // If printing an already completed receipt with a record, track reprint
    if (!isPrePrint && receiptRecord?.id && recordReceiptReprintAction) {
      recordReceiptReprintAction(receiptRecord.id).catch(() => {});
    }

    window.print();
  };

  const handleBluetoothPrint = async () => {
    triggerHaptic('medium');
    setIsPrintingBt(true);

    try {
      if (!isBluetoothSupported()) {
        window.print();
        return;
      }

      // If not connected, initiate connection dialog first
      if (!btStatus.isConnected) {
        const res = await connectBluetoothPrinter();
        setBtStatus(getBluetoothPrinterStatus());
      }

      // Track reprint if applicable
      if (!isPrePrint && receiptRecord?.id && recordReceiptReprintAction) {
        recordReceiptReprintAction(receiptRecord.id).catch(() => {});
      }

      // Prepare 80% balanced monochrome raster logo if enabled
      let logoRaster = null;
      if (model.settings?.showLogo) {
        try {
          const logoSource = model.store?.logoThermalUrl || model.store?.logoOriginalUrl || '/default-logo.png';
          const processed = await processThermalLogo(logoSource, {
            width58: 304, // 80% of 384 dots for balanced margins (~38mm)
            width80: 408  // 80% of 512 dots (~51mm)
          });
          logoRaster = selectedWidth === '80mm' ? processed.raster80mm : processed.raster58mm;
        } catch (e) {
          console.warn('Could not rasterize logo for BT print:', e);
        }
      }

      // Print order via universal thermal ESC/POS
      await printReceiptThermal(model, {
        settings,
        thermalPrintMode: settings?.thermalPrintMode,
        logoRasterBytes: logoRaster
      });

    } catch (err) {
      console.warn('Bluetooth print failed:', err);
      showToast?.(err.message || 'Không thể in qua Bluetooth. Thử in qua trình duyệt!', 'error');
    } finally {
      setIsPrintingBt(false);
      setBtStatus(getBluetoothPrinterStatus());
    }
  };

  const is80 = selectedWidth === '80mm';

  return createPortal(
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn select-none overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={isPrePrint ? 'Phiếu Tạm Tính' : 'Hóa Đơn'}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      {/* Modal Frame with Dynamic Max Width based on 58mm / 80mm */}
      <div
        className={`w-full ${
          is80 ? 'max-w-[420px]' : 'max-w-[360px]'
        } clay-card overflow-hidden flex flex-col max-h-[96vh] border border-gray-100 shadow-2xl transition-all duration-200`}
      >
        {/* Controls Header (Hidden during window.print) */}
        <div className="px-3.5 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100/90 flex items-center justify-between border-b border-gray-200/80 print:hidden shrink-0">
          <div className="flex items-center space-x-1.5 text-xs font-black text-gray-800">
            <Printer className="w-4 h-4 text-forest-800" />
            <span>{isPrePrint ? 'Phiếu Tạm Tính' : 'Hóa Đơn'}</span>
          </div>

          {/* Width Switcher (58mm <-> 80mm) */}
          <div className="flex items-center bg-gray-200/80 p-0.5 rounded-xl text-[10px] font-bold">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSelectedWidth('58mm');
              }}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                selectedWidth === '58mm'
                  ? 'bg-white text-forest-900 shadow-2xs font-black'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              58mm
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSelectedWidth('80mm');
              }}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                selectedWidth === '80mm'
                  ? 'bg-white text-forest-900 shadow-2xs font-black'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              80mm
            </button>
          </div>

          {/* Action Icons */}
          <div className="flex items-center space-x-1">
            {/* Browser Print / PDF */}
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="p-1.5 rounded-xl clay-inset text-gray-700 hover:text-gray-900 cursor-pointer"
              title="In trình duyệt hoặc lưu PDF (window.print)"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full clay-inset flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Sub-Banner: Status & Specs */}
        <div className="px-3 py-1 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-[10px] font-bold text-gray-500 print:hidden shrink-0">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                btStatus.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            <span className="truncate max-w-[170px]">
              {btStatus.isConnected ? btStatus.deviceName : 'Chưa ghép Bluetooth'}
            </span>
          </span>
          <span className="text-gray-400 font-mono">
            Khổ {selectedWidth} ({model.totalCols} cột)
          </span>
        </div>

        {/* Scrollable Printable Thermal Receipt Container */}
        <div className="overflow-y-auto p-3 flex justify-center bg-gray-100/60 flex-1">
          {/* Simulated Monospaced Thermal Paper Roll */}
          <div
            id="printable-receipt"
            className={`${
              is80 ? 'w-[305px] text-[11.5px]' : 'w-[230px] text-[10.5px]'
            } p-3.5 bg-white text-gray-950 font-mono leading-tight shadow-md border-x border-gray-200/80 rounded-xs select-none transition-all duration-150`}
            style={{
              backgroundImage: 'radial-gradient(#f1f1f1 10%, transparent 10%)',
              backgroundSize: '12px 12px'
            }}
          >
            {/* Header Section */}
            <div className="text-center pb-1.5 border-b border-dashed border-gray-400">
              {/* Thermal Logo (Square, balanced 80% size) */}
              {model.settings.showLogo && (model.store.logoThermalUrl || '/default-logo.png') && (
                <div className="flex justify-center pt-0.5 pb-0">
                  <img
                    src={model.store.logoThermalUrl || model.store.logoOriginalUrl || '/default-logo.png'}
                    alt="Logo GÓC - PHÊ & TRÀ"
                    className={`receipt-thermal-logo-img ${
                      is80 ? 'w-[168px]' : 'w-[140px]'
                    } h-auto max-h-[160px] object-contain mx-auto block filter contrast-125`}
                  />
                </div>
              )}

              {/* Store Name: Only shown if logo is disabled/missing to eliminate duplicate text and save paper */}
              {(!model.settings.showLogo || !(model.store.logoThermalUrl || '/default-logo.png')) &&
                model.settings.showStoreName && (
                  <h2 className="font-black text-sm tracking-tight uppercase text-black font-sans leading-none pb-1">
                    {model.store.storeName || 'GÓC • PHÊ & TRÀ'}
                  </h2>
              )}

              {/* Unified Brand Metadata Block (Address, Hotline - Wifi moved exclusively to footer) */}
              {(Boolean(model.settings.showAddress && model.store.storeAddress) ||
                Boolean(model.settings.showPhone && model.store.contactPhone)) && (
                <div className="receipt-brand-meta space-y-0.5 text-[9.5px] text-gray-700 font-sans leading-tight mt-1">
                  {/* Address */}
                  {model.settings.showAddress && model.store.storeAddress && (
                    <p className="m-0 p-0 leading-tight">
                      {model.store.storeAddress}
                    </p>
                  )}

                  {/* Hotline */}
                  {model.settings.showPhone && model.store.contactPhone && (
                    <p className="m-0 p-0">
                      Hotline: {model.store.contactPhone}
                    </p>
                  )}
                </div>
              )}

              {/* Receipt Title */}
              <div className="receipt-title-box mt-1.5 pt-1.5 border-t border-dashed border-gray-300 font-extrabold text-[11px] uppercase tracking-wide text-black">
                {isPrePrint ? '--- PHIẾU TẠM TÍNH ---' : '--- HÓA ĐƠN THANH TOÁN ---'}
              </div>

              {/* Reprint Warning Badge */}
              {model.isReprint && (
                <div className="text-[9.5px] font-bold text-gray-500 tracking-wider pt-0.5">
                  [IN LẠI LẦN {model.reprintCount}]
                </div>
              )}
            </div>

            {/* Metadata (Order info & exact timestamps) */}
            <div className="py-1.5 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
              {model.settings.showOrderId && (
                <div className="flex justify-between">
                  <span>Số HĐ:</span>
                  <span className="font-bold">{model.receiptNumber}</span>
                </div>
              )}

              {model.settings.showTable && (
                <div className="flex justify-between">
                  <span>Bàn:</span>
                  <span className="font-bold">{model.tableName}</span>
                </div>
              )}

              {model.settings.showOrderTime && (
                <div className="flex justify-between">
                  <span>Giờ gọi món:</span>
                  <span>{model.orderCreatedAtFormatted}</span>
                </div>
              )}

              {model.settings.showReceiptTime && (
                <div className="flex justify-between">
                  <span>Giờ xuất HĐ:</span>
                  <span>{model.receiptIssuedAtFormatted}</span>
                </div>
              )}
            </div>

            {/* Items List (2-Line Layout without redundant column headers) */}
            <div className="py-1.5 border-b border-dashed border-gray-400">
              <div className="space-y-1.5">
                {model.items.map((it, idx) => (
                  <div key={idx} className="text-[10px] space-y-0.5">
                    {/* Line 1: Item name & Size */}
                    <div className="font-bold text-gray-950 leading-snug break-words">
                      {it.name}{it.size ? ` (${it.size})` : ''}
                    </div>

                    {/* Toppings indent */}
                    {it.toppings && it.toppings.length > 0 && (
                      <div className="text-[9px] text-gray-600 pl-2 leading-tight">
                        + {it.toppings.map((tp) => tp.name).join(', ')}
                      </div>
                    )}

                    {/* Notes indent */}
                    {it.notes && (
                      <div className="text-[9px] text-amber-800 pl-2 italic leading-tight">
                        * {it.notes}
                      </div>
                    )}

                    {/* Line 2: Qty x Unit price and Line total */}
                    <div className="flex justify-between items-baseline text-gray-700">
                      <span className="font-medium text-[9.5px]">
                        {it.quantity} x {it.unitPriceFormatted || formatVND(it.effectiveUnitPrice || it.price)}
                      </span>
                      <span className="font-extrabold text-black font-mono">
                        {it.lineTotalFormatted || formatVND(it.lineTotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="py-1.5 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Tiền hàng:</span>
                <span className="font-mono">{model.subtotalFormatted}</span>
              </div>

              {model.discountAmount > 0 && (
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>Giảm giá ({model.discountPercent}%):</span>
                  <span className="font-mono">-{model.discountAmountFormatted}</span>
                </div>
              )}

              {model.surcharge > 0 && (
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>Phụ phí:</span>
                  <span className="font-mono">+{model.surchargeFormatted}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-400 font-black text-xs text-black">
                <span>TỔNG CỘNG:</span>
                <span className="text-sm font-mono">{model.totalFormatted}</span>
              </div>

              <div className="flex justify-between text-[9.5px] text-gray-500 pt-0.5">
                <span>Hình thức:</span>
                <span className="font-bold">{model.paymentMethodLabel}</span>
              </div>
            </div>

            {/* Footer Section (Single WiFi displayed right above thank you message) */}
            {(Boolean(model.settings.showWifi && model.store.wifiPassword && model.store.wifiOnReceipt) || Boolean(model.settings.showFooter)) && (
              <div className="text-center pt-2 text-[9.5px] text-gray-500 font-sans space-y-0.5">
                {model.settings.showWifi && model.store.wifiPassword && model.store.wifiOnReceipt && (
                  <p className="font-bold text-gray-900 text-[10px] pb-0.5">
                    Wifi: <span>{model.store.wifiPassword}</span>
                  </p>
                )}
                {model.settings.showFooter && (
                  <>
                    <p className="font-bold text-gray-800">{model.footerText}</p>
                    <p className="text-[8.5px] text-gray-400">
                      GÓC POS Enterprise • Khổ {selectedWidth}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Quick Action Bar */}
        <div className="p-3 pb-[max(12px,env(safe-area-inset-bottom,12px))] bg-white border-t border-gray-100 flex items-center justify-between gap-2 print:hidden shrink-0">
          {/* Bluetooth Print Button */}
          <button
            type="button"
            onClick={handleBluetoothPrint}
            disabled={isPrintingBt}
            className="flex-1 py-2.5 px-3 rounded-xl clay-btn-primary text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
          >
            {isPrintingBt ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bluetooth className="w-4 h-4" />
            )}
            <span>
              {btStatus.isConnected
                ? `In Bluetooth ${selectedWidth}`
                : `Ghép & In Bluetooth ${selectedWidth}`}
            </span>
          </button>

          {/* Browser / PDF Print Button */}
          <button
            type="button"
            onClick={handleBrowserPrint}
            className="py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Mở hộp thoại in hệ thống (iOS / Android / PDF)"
          >
            <Printer className="w-4 h-4 text-forest-800" />
            <span className="hidden sm:inline">In hệ thống</span>
          </button>
        </div>
      </div>

      {/* Dynamic CSS Print Stylesheet supporting 58mm and 80mm */}
      <style>{`
        @media print {
          @page {
            size: ${is80 ? '80mm auto' : '58mm auto'};
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible !important;
          }
          #printable-receipt {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: ${is80 ? '78mm' : '56mm'} !important;
            max-width: ${is80 ? '78mm' : '56mm'} !important;
            margin: 0 !important;
            padding: 1mm 2mm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-receipt .receipt-thermal-logo-img {
            width: ${is80 ? '48mm' : '40mm'} !important;
            height: auto !important;
            max-height: ${is80 ? '48mm' : '40mm'} !important;
            min-width: unset !important;
            min-height: unset !important;
            object-fit: contain !important;
            margin: 0 auto 1.5mm auto !important;
            display: block !important;
          }
          #printable-receipt .receipt-brand-meta {
            margin-top: 1mm !important;
            padding-top: 0 !important;
          }
          #printable-receipt .receipt-brand-meta p {
            margin: 0.6mm 0 !important;
            line-height: 1.25 !important;
          }
          #printable-receipt .receipt-title-box {
            margin-top: 1.2mm !important;
            padding-top: 1mm !important;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
