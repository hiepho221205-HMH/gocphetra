import React, { useState, useEffect } from 'react';
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
        showToast?.('Trình duyệt không hỗ trợ Web Bluetooth. Đang chuyển sang in trình duyệt!', 'info');
        window.print();
        return;
      }

      // If not connected, initiate connection dialog first
      if (!btStatus.isConnected) {
        showToast?.('Vui lòng chọn máy in Bluetooth từ danh sách thiết bị...', 'info');
        const res = await connectBluetoothPrinter();
        setBtStatus(getBluetoothPrinterStatus());
        showToast?.(`Đã kết nối máy in: ${res.deviceName}`, 'success');
      }

      // Track reprint if applicable
      if (!isPrePrint && receiptRecord?.id && recordReceiptReprintAction) {
        recordReceiptReprintAction(receiptRecord.id).catch(() => {});
      }

      // Prepare 50x50mm monochrome raster logo if enabled
      let logoRaster = null;
      if (model.settings?.showLogo) {
        try {
          const logoSource = model.store?.logoThermalUrl || model.store?.logoOriginalUrl || '/default-logo.png';
          const processed = await processThermalLogo(logoSource, {
            width58: 384,
            width80: 512
          });
          logoRaster = selectedWidth === '80mm' ? processed.raster80mm : processed.raster58mm;
        } catch (e) {
          console.warn('Could not rasterize logo for BT print:', e);
        }
      }

      // Print order via universal thermal ESC/POS
      await printReceiptThermal(model, {
        useNoAccents: settings?.printNoAccents !== false,
        logoRasterBytes: logoRaster
      });

      showToast?.(`Đã in hóa đơn ${selectedWidth} qua Bluetooth thành công!`, 'success');
    } catch (err) {
      console.warn('Bluetooth print failed:', err);
      showToast?.(err.message || 'Không thể in qua Bluetooth. Thử in qua trình duyệt!', 'error');
    } finally {
      setIsPrintingBt(false);
      setBtStatus(getBluetoothPrinterStatus());
    }
  };

  const is80 = selectedWidth === '80mm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-md animate-fadeIn">
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
              {/* Thermal Logo (Square, minimum 50mm x 50mm) */}
              {model.settings.showLogo && (model.store.logoThermalUrl || '/default-logo.png') && (
                <div className="flex justify-center pt-0.5 pb-0">
                  <img
                    src={model.store.logoThermalUrl || model.store.logoOriginalUrl || '/default-logo.png'}
                    alt="Logo GÓC - PHÊ & TRÀ"
                    className={`receipt-thermal-logo-img ${
                      is80 ? 'w-[210px]' : 'w-[175px]'
                    } h-auto max-h-[190px] object-contain mx-auto block filter contrast-125`}
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

              {/* Unified Brand Metadata Block (Address, Hotline, Wifi) */}
              {(Boolean(model.settings.showAddress && model.store.storeAddress) ||
                Boolean(model.settings.showPhone && model.store.contactPhone) ||
                Boolean(model.settings.showWifi && model.store.wifiPassword && model.store.wifiOnReceipt)) && (
                <div className="receipt-brand-meta space-y-1 text-[9.5px] text-gray-700 font-sans leading-tight mt-1.5">
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

                  {/* Wifi */}
                  {model.settings.showWifi && model.store.wifiPassword && model.store.wifiOnReceipt && (
                    <p className="m-0 p-0">
                      Wifi: <span className="font-bold text-black">{model.store.wifiPassword}</span>
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
            <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
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
                  <span>Giờ xuất HD:</span>
                  <span>{model.receiptIssuedAtFormatted}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-2 border-b border-dashed border-gray-400">
              <div className="flex justify-between font-black text-[10px] pb-1 border-b border-gray-300 mb-1">
                <span className={is80 ? 'w-[155px] text-left' : 'w-[110px] text-left'}>Tên món</span>
                <span className={is80 ? 'w-[36px] text-center' : 'w-[28px] text-center'}>SL</span>
                <span className="flex-1 text-right">T.Tiền</span>
              </div>

              <div className="space-y-1">
                {model.items.map((it, idx) => (
                  <div key={idx} className="text-[10px]">
                    <div className="flex justify-between items-baseline">
                      <span className={`${is80 ? 'w-[155px]' : 'w-[110px]'} font-bold text-gray-900 break-words`}>
                        {it.name}{it.size ? ` (${it.size})` : ''}
                      </span>
                      <span className={`${is80 ? 'w-[36px]' : 'w-[28px]'} text-center font-bold`}>
                        {it.quantity}
                      </span>
                      <span className="flex-1 text-right font-black font-mono">
                        {formatVND(it.lineTotal)}
                      </span>
                    </div>

                    {it.toppings && it.toppings.length > 0 && (
                      <div className="text-[9px] text-gray-500 pl-1.5 leading-tight">
                        + {it.toppings.map((tp) => tp.name).join(', ')}
                      </div>
                    )}
                    {it.notes && (
                      <div className="text-[9px] text-amber-700 pl-1.5 italic">
                        * {it.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
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

            {/* Footer Section */}
            {model.settings.showFooter && (
              <div className="text-center pt-2.5 text-[9.5px] text-gray-500 font-sans space-y-0.5">
                <p className="font-bold text-gray-800">{model.footerText}</p>
                <p className="text-[8.5px] text-gray-400">
                  GÓC POS Enterprise • Khổ {selectedWidth}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Quick Action Bar */}
        <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between gap-2 print:hidden shrink-0">
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
            padding: 1.5mm 2.5mm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          #printable-receipt .receipt-thermal-logo-img {
            width: ${is80 ? '60mm' : '50mm'} !important;
            height: auto !important;
            max-height: ${is80 ? '60mm' : '50mm'} !important;
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
    </div>
  );
}
