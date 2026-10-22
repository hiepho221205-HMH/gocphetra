import React, { useState, useRef } from 'react';
import { usePos } from '../../store/PosContext';
import {
  ArrowLeft,
  Store,
  CreditCard,
  Wifi,
  Database,
  Check,
  Copy,
  CheckCircle2,
  RefreshCw,
  UploadCloud,
  Printer,
  Image as ImageIcon,
  Trash2,
  FileText,
  Sliders,
  Eye,
  AlertCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { processThermalLogo, validateLogoFile } from '../../utils/thermalLogoProcessor';
import ReceiptPrintView from '../billing/ReceiptPrintView';
import { triggerHaptic } from '../../utils/haptics';

export default function StoreConfigSubpage({ onBack }) {
  const {
    settings,
    updateSettings,
    showToast,
    cloudStatus,
    isSyncing,
    syncFromCloud,
    seedToCloud,
    uploadStoreLogo
  } = usePos();

  // 1. Store Info State
  const [branchName, setBranchName] = useState(settings?.branchName || settings?.storeName || 'GÓC');
  const [branchAddress, setBranchAddress] = useState(settings?.branchAddress || settings?.storeAddress || '18A Võ Văn Dũng, Phường An Nhơn, Bình Định');
  const [hotline, setHotline] = useState(settings?.hotline || settings?.contactPhone || '1900 88 99 22');
  const [cashier, setCashier] = useState(settings?.currentCashier || 'Thu ngân');

  // Logo State (Default to /default-logo.png)
  const [logoOriginalUrl, setLogoOriginalUrl] = useState(settings?.logoOriginalUrl || '/default-logo.png');
  const [logoThermalUrl, setLogoThermalUrl] = useState(settings?.logoThermalUrl || '/default-logo.png');
  const [logoPreviewTab, setLogoPreviewTab] = useState('thermal'); // 'original' | 'thermal'
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const fileInputRef = useRef(null);

  // 2. Receipt Configuration State
  const [paperWidth, setPaperWidth] = useState(settings?.receiptPaperWidth || '58mm');
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

  // 3. Wi-Fi State
  const [wifiPassword, setWifiPassword] = useState(settings?.wifiPassword || 'xincamon');
  const [wifiOnReceipt, setWifiOnReceipt] = useState(settings?.wifiOnReceipt !== false);
  const [copiedWifi, setCopiedWifi] = useState(false);

  // 4. Payment & VietQR State
  const [accountNo, setAccountNo] = useState(settings?.bankAccount?.accountNo || '0988776655');
  const [accountHolder, setAccountHolder] = useState(settings?.bankAccount?.accountHolder || 'QUAN CA PHE GOC');
  const [enableVietQR, setEnableVietQR] = useState(settings?.enableVietQR !== false);

  // Modal / UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTestPrintModal, setShowTestPrintModal] = useState(false);

  // Mock order for test print preview
  const testOrder = {
    id: 'DEMO-88',
    tableName: 'Bàn 01 (Mẫu in thử)',
    cashier: cashier.split('(')[0].trim(),
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    finishedAt: new Date().toISOString(),
    items: [
      { name: 'Cà phê Muối GÓC Đặc Biệt', quantity: 1, price: 35000, lineTotal: 35000, size: 'Lớn', toppings: [{ name: 'Kem Cheese béo mặn' }] },
      { name: 'Trà Sen Vàng Hạt Sen Huế Ninh Đường Thơm Ngọt Tự Nhiên', quantity: 2, price: 42000, lineTotal: 84000, size: 'Vừa', toppings: [] },
      { name: 'Bánh Croissant Bơ Pháp', quantity: 1, price: 32000, lineTotal: 32000, toppings: [] }
    ],
    subtotal: 151000,
    discountPercent: 10,
    surcharge: 0,
    total: 135900,
    paidAmount: 135900,
    paymentMethod: 'cash'
  };

  const handleToggleReceiptSetting = (key) => {
    triggerHaptic('light');
    setReceiptSettings((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleCopyWifi = () => {
    triggerHaptic('light');
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(wifiPassword);
      setCopiedWifi(true);
      showToast?.('Đã sao chép mật khẩu WiFi!', 'success');
      setTimeout(() => setCopiedWifi(false), 2000);
    }
  };

  // Handle Logo Upload and Automatic Thermal Processing
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

      // 1. Client-side Canvas Image Dithering & Inversion
      const processed = await processThermalLogo(file);

      // Default to dataURL for instant display & offline support
      setLogoOriginalUrl(processed.originalUrl);
      setLogoThermalUrl(processed.dataUrl58mm);

      // 2. Try upload to Supabase Storage if online
      if (uploadStoreLogo) {
        try {
          const origUpload = await uploadStoreLogo(file, 'original');
          if (origUpload?.publicUrl) {
            setLogoOriginalUrl(origUpload.publicUrl);
          }
        } catch (_) {
          // Keep dataURL fallback
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
    showToast?.('Đã gỡ logo cửa hàng. Hóa đơn sẽ in chữ tên quán.', 'info');
  };

  const handleResetToDefaultLogo = () => {
    triggerHaptic('light');
    setLogoOriginalUrl('/default-logo.png');
    setLogoThermalUrl('/default-logo.png');
    showToast?.('Đã khôi phục Logo GÓC mặc định (khổ 50×50mm)', 'info');
  };

  const handleSave = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    triggerHaptic('medium');

    setTimeout(() => {
      updateSettings({
        branchName,
        storeName: branchName,
        branchAddress,
        storeAddress: branchAddress,
        hotline,
        contactPhone: hotline,
        currentCashier: cashier,
        logoOriginalUrl,
        logoThermalUrl,
        receiptPaperWidth: paperWidth,
        receiptSettings,
        receiptFooter,
        wifiPassword,
        wifiOnReceipt,
        enableVietQR,
        bankAccount: {
          ...settings?.bankAccount,
          accountNo,
          accountHolder
        }
      });
      setIsSubmitting(false);
      showToast?.('Đã lưu cấu hình quán & hóa đơn thành công!', 'success');
    }, 250);
  };

  return (
    <div
      data-testid="store-config-subpage"
      className="space-y-4 animate-slideInRight text-xs pb-16 max-w-2xl mx-auto"
    >
      {/* Top Header Navigation */}
      <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
        <button
          type="button"
          onClick={onBack}
          className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
            Cấu hình Quán & Hóa đơn
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Thông tin thương hiệu, tối ưu logo nhiệt, mẫu in 58mm/80mm & VietQR
          </p>
        </div>

        {/* Live Test Print Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setShowTestPrintModal(true);
          }}
          className="px-3 py-1.5 bg-forest-50 hover:bg-forest-100 text-forest-800 border border-forest-200/80 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-[11px]"
          title="In thử mẫu hóa đơn thực tế"
        >
          <Printer className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">In thử mẫu</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-3.5">
        {/* ==================================================================== */}
        {/* NHÓM 1: THÔNG TIN CỬA HÀNG & LOGO IN NHIỆT */}
        {/* ==================================================================== */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-gray-50 pb-2">
            <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider flex items-center gap-1.5">
              <Store className="w-4 h-4 text-forest-800" />
              <span>Thông tin Cửa hàng & Thương hiệu</span>
            </h3>
            <span className="text-[10px] font-bold text-gray-400">Bước 1/4</span>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="block text-gray-700 font-bold mb-1">Tên Quán (In đậm trên bill)</label>
              <input
                type="text"
                required
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="VD: GÓC - PHÊ & TRÀ"
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-bold text-forest-950 text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Địa chỉ quán</label>
              <input
                type="text"
                required
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
                placeholder="Số nhà, đường, phường, quận/huyện, tỉnh/thành"
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 text-[11px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Số điện thoại Hotline</label>
                <input
                  type="text"
                  required
                  value={hotline}
                  onChange={(e) => setHotline(e.target.value)}
                  placeholder="VD: 1900 88 99 22"
                  className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-mono font-bold text-xs"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-bold mb-1">Thu ngân mặc định</label>
                <input
                  type="text"
                  value={cashier}
                  onChange={(e) => setCashier(e.target.value)}
                  placeholder="Tên thu ngân ca hiện tại"
                  className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-medium text-xs"
                />
              </div>
            </div>

            {/* LOGO SECTION WITH THERMAL MONOCHROME CONVERSION */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-gray-700 font-bold flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-forest-800" />
                  <span>Logo quán in nhiệt</span>
                </label>
                {logoThermalUrl && (
                  <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-[10px]">
                    <button
                      type="button"
                      onClick={() => setLogoPreviewTab('thermal')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        logoPreviewTab === 'thermal' ? 'bg-white text-forest-900 shadow-2xs' : 'text-gray-500'
                      }`}
                    >
                      Bản in nhiệt 1-bit
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoPreviewTab('original')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        logoPreviewTab === 'original' ? 'bg-white text-forest-900 shadow-2xs' : 'text-gray-500'
                      }`}
                    >
                      Ảnh gốc
                    </button>
                  </div>
                )}
              </div>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleLogoFileChange}
              />

              {logoThermalUrl || logoOriginalUrl ? (
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 flex flex-col sm:flex-row items-center gap-3">
                  {/* Square Preview Container (50x50mm representation) */}
                  <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white rounded-xl border border-gray-200 flex items-center justify-center p-1.5 shrink-0 shadow-inner overflow-hidden relative">
                    <img
                      src={logoPreviewTab === 'thermal' ? (logoThermalUrl || logoOriginalUrl) : (logoOriginalUrl || logoThermalUrl)}
                      alt="Logo Quán"
                      className="max-h-full max-w-full object-contain"
                    />
                    <span className="absolute bottom-1 right-1 text-[8px] font-mono bg-black/80 text-white px-1 py-0.5 rounded">
                      50×50mm
                    </span>
                  </div>

                  <div className="flex-1 space-y-1.5 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 text-emerald-700 font-bold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Logo chuẩn in nhiệt: Cao ≥ 50mm, Rộng ≥ 50mm</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-tight">
                      Phù hợp trọn vẹn cuộn giấy nhiệt 57mm/58mm, hiển thị biểu tượng ly nước và chữ GÓC PHÊ & TRÀ rõ nét.
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
                        Dùng mẫu 50×50mm
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
                  className="border-2 border-dashed border-gray-200 hover:border-forest-600 bg-gray-50/70 hover:bg-forest-50/30 p-4 rounded-2xl text-center cursor-pointer transition-all space-y-1.5 group"
                >
                  <div className="w-8 h-8 rounded-full bg-white shadow-2xs border border-gray-200 mx-auto flex items-center justify-center text-gray-500 group-hover:text-forest-800 transition-colors">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-forest-900 text-xs">Bấm để tải Logo cửa hàng</span>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Hỗ trợ PNG, JPG, SVG (Khuyến nghị 512×512px trở lên, chữ xanh nền đen sẽ tự chuyển sang in nhiệt đơn sắc sắc nét)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* NHÓM 2: CẤU HÌNH HÓA ĐƠN & KHỔ GIẤY IN */}
        {/* ==================================================================== */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-gray-50 pb-2">
            <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-forest-800" />
              <span>Cấu hình Hóa đơn & Khổ giấy in</span>
            </h3>
            <span className="text-[10px] font-bold text-gray-400">Bước 2/4</span>
          </div>

          {/* Paper Width Selection */}
          <div>
            <label className="block text-gray-700 font-bold mb-1.5">Khổ giấy in nhiệt mặc định</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setPaperWidth('58mm');
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  paperWidth === '58mm'
                    ? 'bg-forest-50/80 border-forest-800 text-forest-950 ring-1 ring-forest-800'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100/70'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-extrabold text-xs">Khổ K58 (58mm)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-gray-200 font-bold">
                    32 cột
                  </span>
                </div>
                <p className="text-[10px] text-gray-500">
                  Phổ biến cho máy in bill mini Bluetooth & POS cầm tay.
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
                    ? 'bg-forest-50/80 border-forest-800 text-forest-950 ring-1 ring-forest-800'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100/70'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-extrabold text-xs">Khổ K80 (80mm)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-gray-200 font-bold">
                    48 cột
                  </span>
                </div>
                <p className="text-[10px] text-gray-500">
                  Chuẩn hóa đơn nhà hàng / quán cà phê lớn, chữ to rõ ràng.
                </p>
              </button>
            </div>
          </div>

          {/* Line Display Toggles Grid */}
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-gray-700 font-bold mb-2 flex items-center justify-between">
              <span>Các dòng thông tin xuất hiện trên Hóa đơn</span>
              <span className="text-[10px] font-normal text-gray-400">Bật / Tắt theo nhu cầu</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {[
                { key: 'showLogo', label: 'Logo cửa hàng' },
                { key: 'showStoreName', label: 'Tên quán' },
                { key: 'showAddress', label: 'Địa chỉ quán' },
                { key: 'showPhone', label: 'Hotline liên hệ' },
                { key: 'showOrderId', label: 'Mã số hóa đơn (#ORD)' },
                { key: 'showTable', label: 'Số bàn phục vụ' },
                { key: 'showOrderTime', label: 'Thời gian gọi món (order.created_at)' },
                { key: 'showReceiptTime', label: 'Thời gian xuất hóa đơn (receipt.issued_at)' },
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
                    className="w-4 h-4 rounded text-forest-800 accent-forest-800 cursor-pointer shrink-0"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Footer Message */}
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-gray-700 font-bold mb-1">Lời cảm ơn ở chân hóa đơn</label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              placeholder="VD: Cảm ơn quý khách và hẹn gặp lại!"
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-medium"
            />
          </div>
        </div>

        {/* ==================================================================== */}
        {/* NHÓM 3: WI-FI KHÁCH HÀNG */}
        {/* ==================================================================== */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-gray-50 pb-2">
            <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-forest-800" />
              <span>Wi-Fi Khách hàng</span>
            </h3>
            <span className="text-[10px] font-bold text-gray-400">Bước 3/4</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-700 font-bold">Mật khẩu Wi-Fi quán</label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] font-bold text-forest-900">
                <input
                  type="checkbox"
                  checked={wifiOnReceipt}
                  onChange={(e) => setWifiOnReceipt(e.target.checked)}
                  className="w-3.5 h-3.5 accent-forest-800 rounded cursor-pointer"
                />
                <span>In trên hóa đơn</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder="Mật khẩu WiFi quán"
                className="flex-1 h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-mono font-bold text-forest-950 text-sm"
              />
              <button
                type="button"
                onClick={handleCopyWifi}
                className="h-10 px-3 bg-forest-50 hover:bg-forest-100 text-forest-800 border border-forest-200/70 rounded-xl font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                {copiedWifi ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Mật khẩu này sẽ tự động xuất hiện ở phần chân phiếu gửi khách hàng khi bật tùy chọn.
            </p>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* NHÓM 4: THANH TOÁN & VIETQR */}
        {/* ==================================================================== */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-gray-50 pb-2">
            <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-forest-800" />
              <span>Tài khoản nhận tiền VietQR</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              MBBank Đã liên kết
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="block text-gray-700 font-bold mb-1">Số tài khoản MBBank</label>
              <input
                type="text"
                required
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-mono font-extrabold text-forest-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Tên chủ tài khoản</label>
              <input
                type="text"
                required
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-bold uppercase"
              />
            </div>

            <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 text-xs">Nhận chuyển khoản VietQR trong POS</span>
                <input
                  type="checkbox"
                  checked={enableVietQR}
                  onChange={(e) => setEnableVietQR(e.target.checked)}
                  className="w-4 h-4 accent-forest-800 rounded cursor-pointer"
                />
              </div>
              <p className="text-[10.5px] text-emerald-700 leading-tight">
                Mã VietQR động tự sinh theo số tiền từng đơn hàng trên màn hình thanh toán. Hóa đơn bill in ra sẽ ghi rõ phương thức thanh toán và không in QR để tránh khách chuyển trùng.
              </p>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* SUPABASE CLOUD BACKEND CARD */}
        {/* ==================================================================== */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  cloudStatus?.connected && cloudStatus?.tablesExist
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'
                }`}
              >
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-xs">Supabase Cloud Backend</h4>
                <p className="text-[10px] text-gray-400">
                  Project: <span className="font-mono text-gray-600">nbuulvdfxnmfdicbisxq</span>
                </p>
              </div>
            </div>

            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Online {cloudStatus?.latency ? `(${cloudStatus.latency}ms)` : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-50">
            <button
              type="button"
              onClick={() => syncFromCloud?.(true)}
              disabled={isSyncing}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-forest-50 text-forest-900 border border-gray-200 rounded-xl font-bold text-[11px] transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-forest-600' : ''}`} />
              <span>Đồng bộ từ Cloud</span>
            </button>

            <button
              type="button"
              onClick={() => seedToCloud?.()}
              disabled={isSyncing}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-[11px] transition-all shadow-xs cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Đẩy lên Cloud</span>
            </button>
          </div>
        </div>

        {/* Sticky Submit Button */}
        <div className="pt-2 sticky bottom-4 z-20">
          <button
            type="submit"
            disabled={isSubmitting}
            className="touch-target btn-press w-full py-3.5 bg-forest-800 hover:bg-forest-900 text-white rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50 text-sm cursor-pointer"
          >
            {isSubmitting ? (
              <span>Đang lưu cấu hình...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Lưu toàn bộ Cấu hình Quán & Hóa đơn</span>
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
    </div>
  );
}
