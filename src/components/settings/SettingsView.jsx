import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import { useVersionChecker } from '../../hooks/useVersionChecker';
import { APP_VERSION, BUILD_DATE, RELEASE_NAME } from '../../config/version';
import { exportPosBackup } from '../../utils/storageMigrator';
import {
  Store,
  CreditCard,
  RefreshCw,
  Database,
  ExternalLink,
  Check,
  Copy,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  X,
  Code,
  Download,
  ShieldCheck,
  Smartphone,
  Monitor,
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';

const SQL_SCHEMA_CODE = `-- ==============================================================================
-- GÓC Coffee POS - Supabase Database Schema
-- Run this script in the Supabase Dashboard -> SQL Editor (project_ref: nbuulvdfxnmfdicbisxq)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_items (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    base_price NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    toppings TEXT[] DEFAULT '{}',
    in_stock BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.toppings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    in_stock BOOLEAN DEFAULT TRUE,
    is_global BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_toppings (
    product_id TEXT REFERENCES public.menu_items(id) ON DELETE CASCADE,
    topping_id TEXT REFERENCES public.toppings(id) ON DELETE CASCADE,
    price_override NUMERIC,
    PRIMARY KEY (product_id, topping_id)
);

CREATE TABLE IF NOT EXISTS public.tables (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity INT DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'empty',
    active_order_id TEXT,
    customer_count INT DEFAULT 0,
    seated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    table_id TEXT,
    table_name TEXT,
    status TEXT NOT NULL,
    cashier TEXT,
    customer_count INT DEFAULT 1,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    discount_percent NUMERIC DEFAULT 0,
    surcharge NUMERIC DEFAULT 0,
    subtotal NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    remaining_amount NUMERIC DEFAULT 0,
    split_payments JSONB DEFAULT '[]'::jsonb,
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE tbl text;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS "POS Public Access" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "POS Public Access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;`;

export default function SettingsView() {
  const {
    settings,
    updateSettings,
    showToast,
    cloudStatus,
    isSyncing,
    syncFromCloud,
    seedToCloud,
    refreshCloudHealth,
    deviceMode,
    toggleDeviceMode,
    resetAllData
  } = usePos();

  const { hasUpdate, newVersion, applyUpdate } = useVersionChecker();
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);

  const [branchName, setBranchName] = useState(settings.branchName);
  const [shiftName, setShiftName] = useState(settings.shiftName);
  const [cashier, setCashier] = useState(settings.currentCashier);
  const [wifiPassword, setWifiPassword] = useState(settings.wifiPassword);
  const [accountNo, setAccountNo] = useState(settings.bankAccount?.accountNo || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      updateSettings({
        branchName,
        shiftName,
        currentCashier: cashier,
        wifiPassword,
        bankAccount: {
          ...settings.bankAccount,
          accountNo
        }
      });
      setIsSubmitting(false);
      showToast('Đã lưu cấu hình POS thành công', 'success');
    }, 400);
  };

  const handleCopySchema = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(SQL_SCHEMA_CODE);
      setCopiedSchema(true);
      showToast('Đã sao chép mã SQL Schema vào clipboard!', 'success');
      setTimeout(() => setCopiedSchema(false), 2500);
    }
  };

  return (
    <div className="px-4 pt-3.5 pb-28 space-y-4 text-xs">
      <div>
        <h2 className="text-lg font-black text-forest-900 tracking-tight leading-none">
          Cài đặt
        </h2>
        <p className="text-[11px] text-gray-500 mt-1">
          Cấu hình hiển thị, ca làm, dữ liệu & đồng bộ Supabase Cloud
        </p>
      </div>

      {/* Chế độ hiển thị POS */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-forest-50 text-forest-800 flex items-center justify-center">
              {deviceMode === 'mobile' ? (
                <Smartphone className="w-4 h-4 text-forest-700" />
              ) : (
                <Monitor className="w-4 h-4 text-forest-700" />
              )}
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-xs">Chế độ hiển thị POS</h4>
              <p className="text-[10px] text-gray-400">
                {deviceMode === 'mobile' ? 'Khung chuẩn Mobile 390px' : 'Toàn màn hình (Desktop/Tablet)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleDeviceMode}
            className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-forest-800/20 bg-forest-50/70 text-forest-900 hover:bg-forest-100 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            {deviceMode === 'mobile' ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-forest-700" />
                <span>Mở rộng Desktop</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-forest-700" />
                <span>Khung Mobile (390px)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Backend Integration & Supabase Status Card */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              cloudStatus.connected && cloudStatus.tablesExist
                ? 'bg-emerald-50 text-emerald-600'
                : cloudStatus.connected
                ? 'bg-amber-50 text-amber-600'
                : 'bg-rose-50 text-rose-600'
            }`}>
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-xs">Supabase Cloud Backend</h4>
              <p className="text-[10px] text-gray-400">
                Project: <span className="font-mono text-gray-600">nbuulvdfxnmfdicbisxq</span>
              </p>
            </div>
          </div>

          <div>
            {cloudStatus.connected && cloudStatus.tablesExist ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Online {cloudStatus.latency ? `(${cloudStatus.latency}ms)` : ''}</span>
              </span>
            ) : cloudStatus.connected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>Chưa có Schema</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                <span>Ngoại tuyến (Offline)</span>
              </span>
            )}
          </div>
        </div>

        <p className="text-gray-500 text-[11px] leading-relaxed">
          {cloudStatus.connected && cloudStatus.tablesExist ? (
            <>Hệ thống đang đồng bộ 2 chiều thời gian thực (Realtime) với các bảng <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">tables</code>, <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">orders</code>, <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">menu_items</code> trên Supabase.</>
          ) : cloudStatus.connected ? (
            <>Kết nối tới Supabase thành công! Tuy nhiên cơ sở dữ liệu chưa có các bảng bảng cần thiết. Vui lòng chạy mã <strong>SQL Schema</strong> trong Supabase SQL Editor.</>
          ) : (
            <>{cloudStatus.message || 'Đang lưu trữ an toàn trên bộ nhớ trình duyệt (LocalStorage).'}</>
          )}
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-50">
          <button
            type="button"
            onClick={() => syncFromCloud(true)}
            disabled={isSyncing}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-forest-50 text-forest-900 border border-gray-200 hover:border-forest-200 rounded-xl font-bold text-[11px] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-forest-600' : ''}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ từ Cloud'}</span>
          </button>

          {cloudStatus.connected && cloudStatus.tablesExist ? (
            <button
              type="button"
              onClick={() => seedToCloud()}
              disabled={isSyncing}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-[11px] transition-all disabled:opacity-50 shadow-xs"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Đẩy dữ liệu lên Cloud</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowSchemaModal(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-[11px] transition-all shadow-xs"
            >
              <Code className="w-3.5 h-3.5" />
              <span>Xem mã SQL Schema</span>
            </button>
          )}
        </div>

        {/* Extra helper link for Supabase console */}
        <div className="flex items-center justify-between text-[10.5px] text-gray-400 pt-1">
          <span>{cloudStatus.lastSyncTime ? `Lần đồng bộ gần nhất: ${new Date(cloudStatus.lastSyncTime).toLocaleTimeString('vi-VN')}` : 'Mô hình Hybrid: Offline Safe + Cloud Sync'}</span>
          <button
            type="button"
            onClick={() => refreshCloudHealth()}
            className="text-forest-700 hover:underline flex items-center gap-1"
          >
            <span>Kiểm tra lại</span>
          </button>
        </div>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
        <h3 className="font-extrabold text-xs text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Store className="w-3.5 h-3.5 text-forest-800" />
          <span>Thông tin Ca & Chi nhánh</span>
        </h3>

        <div>
          <label className="block text-gray-600 font-bold mb-1">Tên Chi nhánh</label>
          <input
            type="text"
            required
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-gray-600 font-bold mb-1">Ca làm việc</label>
            <input
              type="text"
              required
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800"
            />
          </div>

          <div>
            <label className="block text-gray-600 font-bold mb-1">Thu ngân phụ trách</label>
            <input
              type="text"
              required
              value={cashier}
              onChange={(e) => setCashier(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-gray-600 font-bold mb-1">Mật khẩu Wifi in trên hóa đơn</label>
          <input
            type="text"
            value={wifiPassword}
            onChange={(e) => setWifiPassword(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800"
          />
        </div>

        <div className="pt-2 border-t border-gray-100">
          <h3 className="font-extrabold text-xs text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-forest-800" />
            <span>Tài khoản nhận VietQR</span>
          </h3>

          <div className="space-y-2">
            <div>
              <label className="block text-gray-600 font-bold mb-1">Số tài khoản ngân hàng (MBBank)</label>
              <input
                type="text"
                required
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-forest-800 font-mono font-bold"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="touch-target btn-press w-full py-2.5 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold flex items-center justify-center space-x-1.5 disabled:opacity-50 shadow-sm"
        >
          {isSubmitting ? (
            <span>Đang lưu...</span>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Lưu thông tin</span>
            </>
          )}
        </button>
      </form>

      {/* Safe Backup & Version Card */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-forest-50 text-forest-800 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-xs">Phiên bản & Quản trị Dữ liệu</h4>
              <p className="text-[10px] text-gray-400">
                Phiên bản: <span className="font-mono font-bold text-forest-800">v{APP_VERSION}</span> • {BUILD_DATE}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-forest-50 text-forest-800 border border-forest-200">
            {RELEASE_NAME}
          </span>
        </div>

        {/* Update Checker Status */}
        {hasUpdate ? (
          <div className="bg-gradient-to-r from-emerald-700 to-forest-800 text-white p-3 rounded-xl flex items-center justify-between text-xs shadow-sm animate-fadeIn">
            <div className="flex items-center gap-1.5 font-bold text-[11.5px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Có bản cập nhật mới (v{newVersion})</span>
            </div>
            <button
              type="button"
              onClick={() => setShowUpdateConfirm(true)}
              className="px-2.5 py-1 bg-white text-forest-900 rounded-lg font-extrabold text-[11px] hover:bg-emerald-50 transition-colors flex items-center gap-1 shadow-2xs"
            >
              <span>Cập nhật ngay</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10.5px] text-emerald-700 bg-emerald-50/70 px-2.5 py-1.5 rounded-xl border border-emerald-200/50 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Đang sử dụng phiên bản POS mới nhất</span>
          </div>
        )}

        <p className="text-gray-500 text-[11px] leading-relaxed">
          Quản lý dữ liệu lưu trữ POS, xuất file dự phòng an toàn hoặc khôi phục dữ liệu mẫu ban đầu.
        </p>

        {/* Action Buttons: Backup & Reset */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-50">
          <button
            type="button"
            onClick={() => {
              const res = exportPosBackup();
              if (res.success) {
                showToast(res.message, 'success');
              } else {
                showToast(res.message, 'error');
              }
            }}
            className="py-2 px-2.5 bg-gray-50 hover:bg-forest-50 text-forest-900 border border-gray-200 hover:border-forest-200 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-forest-700" />
            <span>Tải backup (.json)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Khôi phục dữ liệu mẫu ban đầu của GÓC POS? Thao tác này sẽ đặt lại các bàn và thực đơn mặc định.')) {
                resetAllData();
                showToast('Đã khôi phục dữ liệu mẫu ban đầu!', 'success');
              }
            }}
            className="py-2 px-2.5 bg-rose-50/70 hover:bg-rose-100 text-rose-800 border border-rose-200/70 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-700" />
            <span>Khôi phục mẫu</span>
          </button>
        </div>
      </div>

      {/* Contact & Copyright Information */}
      <div className="bg-forest-50/70 p-4 rounded-2xl border border-forest-200/60 text-center space-y-1.5">
        <h4 className="font-extrabold text-forest-900 text-sm">GÓC – Phê & Trà POS</h4>
        <p className="text-gray-500 text-[11px]">Phiên bản v{APP_VERSION} ({RELEASE_NAME})</p>
        <p className="text-[11px] text-gray-600">
          Thiết kế chuẩn hóa Glassmorphism tối giản theo bộ nhận diện #214E34 & #FFFFFF
        </p>
        <div className="pt-2 text-[10.5px] text-gray-400 border-t border-forest-200/40">
          Bản quyền © 2026 Quán Cà Phê GÓC. Bảo lưu mọi quyền.
        </div>
      </div>

      {/* Safe Update Confirmation Modal */}
      {showUpdateConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3.5 shadow-2xl text-center border border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-forest-100 text-forest-800 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-forest-700" />
            </div>
            <div>
              <h3 className="font-extrabold text-forest-900 text-sm">Cập nhật ứng dụng lên v{newVersion}</h3>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                Ứng dụng sẽ tải lại để nạp các tính năng và bản vá mới nhất. Vui lòng đảm bảo các hóa đơn đang mở đã được lưu trước khi cập nhật.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowUpdateConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
              >
                Để sau
              </button>
              <button
                type="button"
                onClick={applyUpdate}
                className="flex-1 py-2.5 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-xs transition-colors shadow-xs"
              >
                Tải lại ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQL Schema Modal */}
      {showSchemaModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white w-full max-w-xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-forest-900 text-white">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">Supabase Database Schema SQL</h3>
                  <p className="text-[10px] text-white/70">7 bảng chuẩn hóa: tables, orders, menu_items, toppings...</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSchemaModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Instruction Notice */}
            <div className="p-3 bg-amber-50 border-b border-amber-100 text-amber-900 text-[11px] leading-relaxed">
              👉 <strong>Hướng dẫn thực hiện:</strong> Bấm nút <strong>"Sao chép toàn bộ SQL"</strong> bên dưới, sau đó truy cập vào{' '}
              <a
                href="https://supabase.com/dashboard/project/nbuulvdfxnmfdicbisxq/sql/new"
                target="_blank"
                rel="noreferrer"
                className="underline font-bold text-forest-900 inline-flex items-center gap-0.5"
              >
                Supabase SQL Editor <ExternalLink className="w-3 h-3" />
              </a>
              , dán vào và nhấn <strong>Run</strong>.
            </div>

            {/* Code Box */}
            <div className="p-4 flex-1 overflow-y-auto bg-gray-900 text-gray-100 font-mono text-[11px] leading-relaxed">
              <pre className="whitespace-pre-wrap">{SQL_SCHEMA_CODE}</pre>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
              <span className="text-[10px] text-gray-500">File lưu trữ: <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-700">supabase/schema.sql</code></span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSchemaModal(false)}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-xs"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleCopySchema}
                  className="px-4 py-1.5 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  {copiedSchema ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Đã sao chép!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Sao chép toàn bộ SQL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
