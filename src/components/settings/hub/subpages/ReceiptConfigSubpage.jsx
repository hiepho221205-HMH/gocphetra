import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  Printer,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  Trash2,
  Sparkles
} from 'lucide-react';
import { processThermalLogo, validateLogoFile } from '../../../../utils/thermalLogoProcessor';
import ReceiptPrintView from '../../../billing/ReceiptPrintView';
import { triggerHaptic } from '../../../../utils/haptics';
import UnsavedChangesModal from '../UnsavedChangesModal';

/**
 * ReceiptConfigSubpage - Subpage 2: Hóa đơn & In ấn
 * Cấu hình khổ in K58/K80, chế độ font tiếng Việt, logo in nhiệt và các dòng hiển thị bill.
 * Lưu độc lập, có nút In thử mẫu thực tế.
 */
export default function ReceiptConfigSubpage({
  settings,
  updateSettings,
  uploadStoreLogo,
  showToast,
  onBack
}) {
  // Paper Width & Modes
  const [paperWidth, setPaperWidth] = useState(settings?.receiptPaperWidth || '58mm');
  const [thermalPrintMode, setThermalPrintMode] = useState(
    settings?.thermalPrintMode || (settings?.printNoAccents === false ? 'graphic_accents' : 'text_no_accents')
  );
  const [receiptFooter, setReceiptFooter] = useState(settings?.receiptFooter || 'Cảm ơn quý khách và hẹn gặp lại!');
  const [receiptSettings, setReceiptSettings] = useState(settings?.receiptSettings || {
    showLogo: true,
    showStoreName: true,
    showAddress: true,
    showPhone: true,
    showOrderId: true,
    showTable: true,
    showOrderTime: true,
    showReceiptTime: true,
    showWifi: true,
    showFooter: true
  });

  // Logo State
  const [logoOriginalUrl, setLogoOriginalUrl] = useState(settings?.logoOriginalUrl || '/default-logo.png');
  const [logoThermalUrl, setLogoThermalUrl] = useState(settings?.logoThermalUrl || '/default-logo.png');
  const [logoPreviewTab, setLogoPreviewTab] = useState('thermal'); // 'original' | 'thermal'
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const fileInputRef = useRef(null);

  // Modal / UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTestPrintModal, setShowTestPrintModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Dirty Detection
  const initialRef = useRef({
    paperWidth: settings?.receiptPaperWidth || '58mm',
    thermalPrintMode: settings?.thermalPrintMode || (settings?.printNoAccents === false ? 'graphic_accents' : 'text_no_accents'),
    receiptFooter: settings?.receiptFooter || 'Cảm ơn quý khách và hẹn gặp lại!',
    receiptSettings: JSON.stringify(settings?.receiptSettings || {}),
    logoOriginalUrl: settings?.logoOriginalUrl || '/default-logo.png',
    logoThermalUrl: settings?.logoThermalUrl || '/default-logo.png'
  });

  const isDirty =
    paperWidth !== initialRef.current.paperWidth ||
    thermalPrintMode !== initialRef.current.thermalPrintMode ||
    receiptFooter !== initialRef.current.receiptFooter ||
    JSON.stringify(receiptSettings) !== initialRef.current.receiptSettings ||
    logoOriginalUrl !== initialRef.current.logoOriginalUrl ||
    logoThermalUrl !== initialRef.current.logoThermalUrl;

  useEffect(() => {
    const handlePopState = () => {
      if (isDirty) {
        window.history.pushState(null, '', window.location.href);
        setShowDiscardModal(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDirty]);

  const handleBackClick = () => {
    triggerHaptic('light');
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      onBack?.();
    }
  };

  const handleToggleReceiptSetting = (key) => {
    triggerHaptic('light');
    setReceiptSettings((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Logo File Upload & Client-side Dithering
  const handleLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateLogoFile(file);
    if (!validation.valid) {
      showToast?.(validation.error, 'error');
      return;
    }

    setIsProcessingLogo(true);
    triggerHaptic('medium');

    try {
      showToast?.('Đang phân tích & tối ưu logo cho máy in nhiệt...', 'info');
      const processed = await processThermalLogo(file);

      setLogoOriginalUrl(processed.originalUrl);
      setLogoThermalUrl(processed.dataUrl58mm);

      if (uploadStoreLogo) {
        try {
          const origUpload = await uploadStoreLogo(file, 'original');
          if (origUpload?.publicUrl) {
            setLogoOriginalUrl(origUpload.publicUrl);
          }
        } catch (_) {
          // Keep dataUrl fallback
        }
      }

      showToast?.('Đã xử lý logo in nhiệt thành công!', 'success');
    } catch (err) {
      console.warn('Lỗi xử lý logo:', err);
      showToast?.('Không thể xử lý logo: ' + (err.message || 'Lỗi định dạng'), 'error');
    } finally {
      setIsProcessingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    triggerHaptic('light');
    setLogoOriginalUrl(null);
    setLogoThermalUrl(null);
  };

  const handleResetToDefaultLogo = () => {
    triggerHaptic('light');
    setLogoOriginalUrl('/default-logo.png');
    setLogoThermalUrl('/default-logo.png');
  };

  // Save handler for receipt slice only
  const handleSave = async (e) => {
    e.preventDefault();
    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      await updateSettings?.({
        receiptPaperWidth: paperWidth,
        thermalPrintMode,
        printNoAccents: thermalPrintMode === 'text_no_accents',
        receiptSettings,
        receiptFooter: receiptFooter.trim(),
        logoOriginalUrl,
        logoThermalUrl
      });

      // Update baseline initialRef so isDirty becomes false
      initialRef.current = {
        paperWidth,
        thermalPrintMode,
        receiptFooter: receiptFooter.trim(),
        receiptSettings: JSON.stringify(receiptSettings),
        logoOriginalUrl,
        logoThermalUrl
      };

      showToast?.('Đã lưu cấu hình hóa đơn thành công!', 'success');
    } catch (err) {
      showToast?.('Lỗi khi lưu cấu hình hóa đơn: ' + (err.message || 'Thử lại sau'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mock order for test print preview
  const testOrder = {
    id: 'DEMO-88',
    tableName: 'Bàn 01 (Mẫu in thử)',
    cashier: settings?.currentCashier?.split('(')[0]?.trim() || 'Thu ngân GÓC',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    finishedAt: new Date().toISOString(),
    items: [
      { name: 'Cà phê Muối GÓC Đặc Biệt', quantity: 1, price: 35000, lineTotal: 35000, size: 'Lớn', toppings: [{ name: 'Kem Cheese béo mặn' }] },
      { name: 'Trà Sen Vàng Hạt Sen Huế', quantity: 2, price: 42000, lineTotal: 84000, size: 'Vừa', toppings: [] },
      { name: 'Bánh Croissant Bơ Pháp', quantity: 1, price: 32000, lineTotal: 32000, toppings: [] }
    ],
    subtotal: 151000,
    discountPercent: 10,
    surcharge: 0,
    total: 135900,
    paidAmount: 135900,
    paymentMethod: 'cash'
  };

  return (
    <div
      data-testid="receipt-config-subpage"
      className="space-y-4 animate-slideInRight text-xs pb-24 max-w-2xl mx-auto"
    >
      {/* Top Header */}
      <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
        <button
          type="button"
          onClick={handleBackClick}
          className="touch-target p-2 rounded-2xl bg-white border border-gray-200/80 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
          title="Quay lại Settings Hub"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-base font-black text-forest-950 tracking-tight leading-none">
              Hóa đơn & In ấn
            </h2>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">
            Khổ in 58mm/80mm, logo nhiệt, chế độ font và nội dung hiển thị
          </p>
        </div>

        {/* Live Test Print Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setShowTestPrintModal(true);
          }}
          className="px-3 py-1.5 bg-forest-50 hover:bg-forest-100 text-forest-800 border border-forest-200/80 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] shrink-0"
          title="In thử mẫu hóa đơn thực tế"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>In thử mẫu</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-3.5">
        {/* Card 1: Khổ giấy in */}
        <div className="clay-card p-4 sm:p-5 rounded-[24px] bg-white border border-white/95 shadow-xs space-y-3">
          <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider flex items-center gap-1.5">
            <Printer className="w-4 h-4 text-forest-800" />
            <span>Khổ giấy in nhiệt mặc định</span>
          </h3>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setPaperWidth('58mm');
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                paperWidth === '58mm'
                  ? 'bg-forest-50/80 border-[#214E34] text-forest-950 ring-1 ring-[#214E34] shadow-xs'
                  : 'bg-gray-50 border-gray-200/80 text-gray-600 hover:bg-gray-100/70'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-extrabold text-xs">Khổ K58 (58mm)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-gray-200 font-bold">
                  32 cột
                </span>
              </div>
              <p className="text-[10px] text-gray-500 leading-tight">
                Phổ biến cho máy in mini Bluetooth & máy POS cầm tay.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setPaperWidth('80mm');
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                paperWidth === '80mm'
                  ? 'bg-forest-50/80 border-[#214E34] text-forest-950 ring-1 ring-[#214E34] shadow-xs'
                  : 'bg-gray-50 border-gray-200/80 text-gray-600 hover:bg-gray-100/70'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-extrabold text-xs">Khổ K80 (80mm)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-gray-200 font-bold">
                  48 cột
                </span>
              </div>
              <p className="text-[10px] text-gray-500 leading-tight">
                Chuẩn hóa đơn quầy thu ngân cố định, bản in to rõ nét.
              </p>
            </button>
          </div>
        </div>

        {/* Card 2: Chế độ font chữ máy in */}
        <div className="clay-card p-4 sm:p-5 rounded-[24px] bg-white border border-white/95 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider">
              Chế độ mã hóa & font chữ đầu ra
            </h3>
            <span className="text-[10px] text-gray-400">Khắc phục lỗi font</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setThermalPrintMode('text_no_accents');
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                thermalPrintMode === 'text_no_accents'
                  ? 'bg-forest-50/80 border-[#214E34] text-forest-950 ring-1 ring-[#214E34] shadow-xs'
                  : 'bg-gray-50 border-gray-200/80 text-gray-600 hover:bg-gray-100/70'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-extrabold text-xs">In Chữ Không Dấu (Khuyến nghị)</span>
                <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  Nhanh & Nét
                </span>
              </div>
              <p className="text-[10px] text-gray-500 leading-tight">
                Chuyển tiếng Việt không dấu chuẩn ASCII. In tức thì, không bao giờ bị lỗi font rác (ß, |, æ).
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setThermalPrintMode('graphic_accents');
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                thermalPrintMode === 'graphic_accents'
                  ? 'bg-forest-50/80 border-[#214E34] text-forest-950 ring-1 ring-[#214E34] shadow-xs'
                  : 'bg-gray-50 border-gray-200/80 text-gray-600 hover:bg-gray-100/70'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-extrabold text-xs">In Đồ Họa Có Dấu</span>
                <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                  Có dấu
                </span>
              </div>
              <p className="text-[10px] text-gray-500 leading-tight">
                Render toàn bộ hóa đơn dạng đồ họa 1-bit ESC/POS. Có dấu tiếng Việt sắc nét, in mất ~2-3 giây.
              </p>
            </button>
          </div>
        </div>

        {/* Card 3: Logo quán in nhiệt */}
        <div className="clay-card p-4 sm:p-5 rounded-[24px] bg-white border border-white/95 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-forest-800" />
              <span>Logo Quán In Nhiệt</span>
            </h3>

            {logoThermalUrl && (
              <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl text-[10px]">
                <button
                  type="button"
                  onClick={() => setLogoPreviewTab('thermal')}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                    logoPreviewTab === 'thermal' ? 'bg-white text-forest-900 shadow-2xs' : 'text-gray-500'
                  }`}
                >
                  Bản nhiệt 1-bit
                </button>
                <button
                  type="button"
                  onClick={() => setLogoPreviewTab('original')}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                    logoPreviewTab === 'original' ? 'bg-white text-forest-900 shadow-2xs' : 'text-gray-500'
                  }`}
                >
                  Ảnh gốc
                </button>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleLogoFileChange}
          />

          {logoThermalUrl || logoOriginalUrl ? (
            <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-200/80 flex flex-col sm:flex-row items-center gap-3">
              <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white rounded-xl border border-gray-200 flex items-center justify-center p-1.5 shrink-0 shadow-inner overflow-hidden relative">
                <img
                  src={logoPreviewTab === 'thermal' ? (logoThermalUrl || logoOriginalUrl) : (logoOriginalUrl || logoThermalUrl)}
                  alt="Logo Quán"
                  className="max-h-full max-w-full object-contain"
                />
                <span className="absolute bottom-1 right-1 text-[8px] font-mono bg-black/80 text-white px-1 py-0.5 rounded">
                  Chuẩn 80%
                </span>
              </div>

              <div className="flex-1 space-y-1.5 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-emerald-700 font-bold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Logo chuẩn in nhiệt: Tỷ lệ 80% cân đối (40mm)</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight">
                  Cân đối trên cuộn giấy nhiệt 57mm/58mm, chừa lề 2 bên hài hòa, giữ trọn biểu tượng sắc nét.
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 pt-0.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingLogo}
                    className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-forest-900 font-bold text-[10.5px] transition-colors cursor-pointer"
                  >
                    {isProcessingLogo ? 'Đang xử lý...' : 'Tải ảnh khác'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToDefaultLogo}
                    className="px-2.5 py-1 bg-forest-50 hover:bg-forest-100 text-forest-800 border border-forest-200 rounded-lg font-bold text-[10.5px] transition-colors cursor-pointer"
                  >
                    Dùng mẫu chuẩn
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[10.5px] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Gỡ logo</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 hover:border-[#214E34] bg-gray-50/70 hover:bg-forest-50/30 p-4 rounded-2xl text-center cursor-pointer transition-all space-y-1.5 group"
            >
              <div className="w-8 h-8 rounded-full bg-white shadow-2xs border border-gray-200 mx-auto flex items-center justify-center text-gray-500 group-hover:text-forest-800 transition-colors">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-forest-900 text-xs">Bấm để tải Logo cửa hàng</span>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Hỗ trợ PNG, JPG, SVG (Khuyến nghị 512×512px, chữ xanh nền đen tự chuyển 1-bit)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Card 4: Các dòng hiển thị trên Hóa đơn */}
        <div className="clay-card p-4 sm:p-5 rounded-[24px] bg-white border border-white/95 shadow-xs space-y-3">
          <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider">
            Các dòng thông tin xuất hiện trên Hóa đơn
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {[
              { key: 'showLogo', label: 'Logo cửa hàng' },
              { key: 'showStoreName', label: 'Tên quán' },
              { key: 'showAddress', label: 'Địa chỉ quán' },
              { key: 'showPhone', label: 'Hotline liên hệ' },
              { key: 'showOrderId', label: 'Mã số hóa đơn (#ORD)' },
              { key: 'showTable', label: 'Số bàn phục vụ' },
              { key: 'showOrderTime', label: 'Thời gian gọi món' },
              { key: 'showReceiptTime', label: 'Thời gian xuất hóa đơn' },
              { key: 'showWifi', label: 'Mật khẩu Wi-Fi khách hàng' },
              { key: 'showFooter', label: 'Lời cảm ơn cuối hóa đơn' }
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200/80 rounded-xl cursor-pointer hover:bg-forest-50/40 transition-colors"
              >
                <span className="font-semibold text-gray-800 pr-2">{label}</span>
                <input
                  type="checkbox"
                  checked={receiptSettings[key] !== false}
                  onChange={() => handleToggleReceiptSetting(key)}
                  className="w-4 h-4 rounded text-forest-800 accent-[#214E34] cursor-pointer shrink-0"
                />
              </label>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="block text-gray-700 font-bold mb-1">Lời cảm ơn ở chân hóa đơn</label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              placeholder="VD: Cảm ơn quý khách và hẹn gặp lại!"
              className="clay-input w-full h-11 px-3.5 bg-gray-50/80 border border-gray-200/80 rounded-2xl focus:bg-white focus:outline-none focus:border-[#214E34] font-medium text-xs"
            />
          </div>
        </div>

        {/* Sticky Save Button */}
        <div className="sticky bottom-4 z-20 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="touch-target btn-press w-full py-3.5 bg-[#214E34] hover:bg-[#183926] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 text-sm cursor-pointer transition-all active:scale-[0.98]"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Đang lưu cấu hình hóa đơn...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Lưu cấu hình Hóa đơn</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Test Print Preview Modal */}
      {showTestPrintModal && (
        <ReceiptPrintView
          isOpen={showTestPrintModal}
          onClose={() => setShowTestPrintModal(false)}
          order={testOrder}
          isPrePrint={false}
          overridePaperWidth={paperWidth}
        />
      )}

      {/* Dirty Warning Modal */}
      <UnsavedChangesModal
        isOpen={showDiscardModal}
        onStay={() => setShowDiscardModal(false)}
        onDiscard={() => {
          setShowDiscardModal(false);
          onBack?.();
        }}
      />
    </div>
  );
}
