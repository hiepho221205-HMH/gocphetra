import React, { useState } from 'react';
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
  Code,
  AlertTriangle,
  ExternalLink,
  X
} from 'lucide-react';

export default function StoreConfigSubpage({ onBack }) {
  const {
    settings,
    updateSettings,
    showToast,
    cloudStatus,
    isSyncing,
    syncFromCloud,
    seedToCloud,
    refreshCloudHealth
  } = usePos();

  const [branchName, setBranchName] = useState(settings?.branchName || 'Chi nhánh 01 - Trụ sở chính');
  const [branchAddress, setBranchAddress] = useState(settings?.branchAddress || '124 Nguyễn Du, P. Bến Nghé, Q.1, TP.HCM');
  const [shiftName, setShiftName] = useState(settings?.shiftName || 'Ca Sáng (06:30 - 14:30)');
  const [cashier, setCashier] = useState(settings?.currentCashier || 'Trần Mai (Mã NV: NV-08)');
  const [wifiPassword, setWifiPassword] = useState(settings?.wifiPassword || 'goccaphe2026');
  const [accountNo, setAccountNo] = useState(settings?.bankAccount?.accountNo || '0988776655');
  const [accountHolder, setAccountHolder] = useState(settings?.bankAccount?.accountHolder || 'QUAN CA PHE GOC');

  const [copiedWifi, setCopiedWifi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);

  const handleCopyWifi = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(wifiPassword);
      setCopiedWifi(true);
      showToast('Đã sao chép mật khẩu WiFi!', 'success');
      setTimeout(() => setCopiedWifi(false), 2000);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      updateSettings({
        branchName,
        branchAddress,
        shiftName,
        currentCashier: cashier,
        wifiPassword,
        bankAccount: {
          ...settings?.bankAccount,
          accountNo,
          accountHolder
        }
      });
      setIsSubmitting(false);
      showToast('Đã lưu cấu hình quán & VietQR thành công', 'success');
    }, 300);
  };

  return (
    <div
      data-testid="store-config-subpage"
      className="space-y-4 animate-slideInRight text-xs pb-10"
    >
      {/* Top Header Navigation */}
      <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
        <button
          type="button"
          onClick={onBack}
          className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
            Cấu hình Quán & VietQR
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Thông tin chi nhánh, ca làm, mật khẩu WiFi và tài khoản ngân hàng
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-3.5">
        {/* 1. THÔNG TIN CHI NHÁNH & CA LÀM */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs space-y-3">
          <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider flex items-center gap-1.5">
            <Store className="w-4 h-4 text-forest-800" />
            <span>Thông tin Chi nhánh & Ca làm</span>
          </h3>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Tên Chi nhánh</label>
            <input
              type="text"
              required
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-medium"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Địa chỉ quán</label>
            <input
              type="text"
              value={branchAddress}
              onChange={(e) => setBranchAddress(e.target.value)}
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 text-[11px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-gray-700 font-bold mb-1">Ca làm việc</label>
              <input
                type="text"
                required
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-medium"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-bold mb-1">Thu ngân mặc định</label>
              <input
                type="text"
                required
                value={cashier}
                onChange={(e) => setCashier(e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-medium"
              />
            </div>
          </div>
        </div>

        {/* 2. MẬT KHẨU WIFI IN HÓA ĐƠN */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs space-y-3">
          <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider flex items-center gap-1.5">
            <Wifi className="w-4 h-4 text-forest-800" />
            <span>Mật khẩu WiFi Khách hàng</span>
          </h3>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Mật khẩu WiFi in bill</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                className="flex-1 h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-mono font-bold text-forest-900"
              />
              <button
                type="button"
                onClick={handleCopyWifi}
                className="h-10 px-3 bg-forest-50 hover:bg-forest-100 text-forest-800 border border-forest-200/70 rounded-xl font-bold flex items-center gap-1 transition-colors"
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
              Mật khẩu này sẽ tự động in ở chân mỗi phiếu thanh toán gửi khách hàng.
            </p>
          </div>
        </div>

        {/* 3. TÀI KHOẢN NHẬN TIỀN VIETQR (MBBANK) */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-forest-800" />
              <span>Tài khoản nhận VietQR</span>
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
          </div>
        </div>

        {/* 4. SUPABASE CLOUD BACKEND CARD */}
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
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-forest-50 text-forest-900 border border-gray-200 rounded-xl font-bold text-[11px] transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-forest-600' : ''}`} />
              <span>Đồng bộ từ Cloud</span>
            </button>

            <button
              type="button"
              onClick={() => seedToCloud?.()}
              disabled={isSyncing}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-[11px] transition-all shadow-xs"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Đẩy lên Cloud</span>
            </button>
          </div>
        </div>

        {/* Sticky Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="touch-target btn-press w-full py-3 bg-forest-800 hover:bg-forest-900 text-white rounded-2xl font-bold flex items-center justify-center space-x-1.5 shadow-md disabled:opacity-50 text-sm"
          >
            {isSubmitting ? (
              <span>Đang lưu...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Lưu toàn bộ cấu hình</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
