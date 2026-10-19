import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
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
  QrCode,
  Wifi,
  Phone,
  MapPin,
  Clock,
  UserCheck
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

export default function OperationalSettingsSection() {
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

  // Local form states (including previously omitted branchAddress & hotline)
  const [branchName, setBranchName] = useState(settings?.branchName || 'Chi nhánh 01 - Trụ sở chính');
  const [branchAddress, setBranchAddress] = useState(settings?.branchAddress || '124 Nguyễn Du, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh');
  const [hotline, setHotline] = useState(settings?.hotline || '1900 88 99 22');
  const [shiftName, setShiftName] = useState(settings?.shiftName || 'Ca Sáng (06:30 - 14:30)');
  const [cashier, setCashier] = useState(settings?.currentCashier || 'Trần Mai (Mã NV: NV-08)');
  const [wifiPassword, setWifiPassword] = useState(settings?.wifiPassword || 'goccaphe2026');
  const [accountNo, setAccountNo] = useState(settings?.bankAccount?.accountNo || '0988776655');
  const [accountHolder, setAccountHolder] = useState(settings?.bankAccount?.accountHolder || 'QUAN CA PHE GOC');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      updateSettings({
        branchName: branchName.trim(),
        branchAddress: branchAddress.trim(),
        hotline: hotline.trim(),
        shiftName: shiftName.trim(),
        currentCashier: cashier.trim(),
        wifiPassword: wifiPassword.trim(),
        bankAccount: {
          ...settings?.bankAccount,
          bankCode: 'MB',
          bankName: 'MB Bank (Quân Đội)',
          accountNo: accountNo.trim(),
          accountHolder: accountHolder.trim().toUpperCase()
        }
      });
      setIsSubmitting(false);
      showToast('Đã lưu cấu hình vận hành POS thành công!', 'success');
    }, 300);
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
    <div data-testid="operational-settings-section" className="space-y-4">
      {/* 1. Supabase Cloud Backend Status Card */}
      <div
        data-testid="supabase-cloud-status-card"
        className="glass-panel-elevated p-4 rounded-3xl border border-white/80 shadow-glass space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              cloudStatus.connected && cloudStatus.tablesExist
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                : cloudStatus.connected
                ? 'bg-amber-50 text-amber-600 border border-amber-200/60'
                : 'bg-rose-50 text-rose-600 border border-rose-200/60'
            }`}>
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-forest-950 text-xs">Supabase Cloud Backend</h4>
              <p className="text-[10px] text-gray-400 font-mono">
                Project: <span className="text-gray-600 font-bold">nbuulvdfxnmfdicbisxq</span>
              </p>
            </div>
          </div>

          <div>
            {cloudStatus.connected && cloudStatus.tablesExist ? (
              <span
                data-testid="cloud-status-online"
                className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Online {cloudStatus.latency ? `(${cloudStatus.latency}ms)` : ''}</span>
              </span>
            ) : cloudStatus.connected ? (
              <span
                data-testid="cloud-status-missing-schema"
                className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
              >
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>Chưa có Schema</span>
              </span>
            ) : (
              <span
                data-testid="cloud-status-offline"
                className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200"
              >
                <span>Ngoại tuyến (Offline Safe)</span>
              </span>
            )}
          </div>
        </div>

        <p className="text-gray-600 text-[11px] leading-relaxed">
          {cloudStatus.connected && cloudStatus.tablesExist ? (
            <>Hệ thống đang đồng bộ 2 chiều thời gian thực (Realtime) với các bảng <code className="text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded font-mono font-bold">tables</code>, <code className="text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded font-mono font-bold">orders</code>, <code className="text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded font-mono font-bold">settings</code> trên Supabase.</>
          ) : cloudStatus.connected ? (
            <>Kết nối tới Supabase thành công! Cơ sở dữ liệu chưa có đủ các bảng. Vui lòng bấm <strong>Xem mã SQL Schema</strong> để tạo bảng.</>
          ) : (
            <>{cloudStatus.message || 'Hệ thống đang hoạt động ở chế độ Offline-Safe với LocalStorage.'}</>
          )}
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-forest-800/10">
          <button
            type="button"
            data-testid="cloud-sync-btn"
            onClick={() => syncFromCloud(true)}
            disabled={isSyncing}
            className="touch-target btn-press flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-forest-50 text-forest-900 border border-forest-800/20 rounded-xl font-bold text-[11px] transition-all disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-forest-700' : 'text-forest-700'}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ từ Cloud'}</span>
          </button>

          {cloudStatus.connected && cloudStatus.tablesExist ? (
            <button
              type="button"
              data-testid="cloud-push-btn"
              onClick={() => seedToCloud()}
              disabled={isSyncing}
              className="touch-target btn-press flex items-center justify-center gap-1.5 px-3 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold text-[11px] transition-all disabled:opacity-50 shadow-xs"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Đẩy dữ liệu lên Cloud</span>
            </button>
          ) : (
            <button
              type="button"
              data-testid="cloud-schema-btn"
              onClick={() => setShowSchemaModal(true)}
              className="touch-target btn-press flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-[11px] transition-all shadow-xs"
            >
              <Code className="w-3.5 h-3.5" />
              <span>Xem mã SQL Schema</span>
            </button>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[10.5px] text-gray-400 pt-0.5">
          <span>{cloudStatus.lastSyncTime ? `Lần đồng bộ gần nhất: ${new Date(cloudStatus.lastSyncTime).toLocaleTimeString('vi-VN')}` : 'Mô hình Hybrid: Offline Safe + Cloud Sync'}</span>
          <button
            type="button"
            onClick={() => refreshCloudHealth()}
            className="text-forest-800 hover:underline font-bold flex items-center gap-1"
          >
            <span>Kiểm tra lại</span>
          </button>
        </div>
      </div>

      {/* 2. Operational Configurations Form */}
      <form
        onSubmit={handleSubmit}
        data-testid="operational-settings-form"
        className="glass-panel-elevated p-4 rounded-3xl border border-white/80 shadow-glass space-y-4"
      >
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-forest-800/10 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-forest-50 text-forest-800 flex items-center justify-center border border-forest-100">
              <Store className="w-4 h-4 text-forest-800" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider">
                Cấu hình Vận hành Quán
              </h3>
              <p className="text-[10px] text-gray-500">Thông tin chi nhánh, ca trực & thông số in hóa đơn</p>
            </div>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
              <Store className="w-3 h-3 text-forest-700" />
              <span>Tên Chi nhánh</span>
            </label>
            <input
              type="text"
              required
              data-testid="input-branch-name"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="glass-input w-full px-3 py-2 rounded-xl text-xs text-gray-800 font-medium"
              placeholder="VD: Chi nhánh 01 - Trụ sở chính"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-forest-700" />
              <span>Địa chỉ Chi nhánh (In trên hóa đơn)</span>
            </label>
            <input
              type="text"
              required
              data-testid="input-branch-address"
              value={branchAddress}
              onChange={(e) => setBranchAddress(e.target.value)}
              className="glass-input w-full px-3 py-2 rounded-xl text-xs text-gray-800 font-medium"
              placeholder="VD: 124 Nguyễn Du, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-forest-700" />
                <span>Ca làm việc</span>
              </label>
              <input
                type="text"
                required
                data-testid="input-shift-name"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-xl text-xs text-gray-800 font-medium"
                placeholder="VD: Ca Sáng (06:30 - 14:30)"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-forest-700" />
                <span>Thu ngân phụ trách</span>
              </label>
              <input
                type="text"
                required
                data-testid="input-cashier"
                value={cashier}
                onChange={(e) => setCashier(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-xl text-xs text-gray-800 font-medium"
                placeholder="VD: Trần Mai (Mã NV: NV-08)"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-forest-700" />
                <span>Hotline hỗ trợ</span>
              </label>
              <input
                type="text"
                data-testid="input-hotline"
                value={hotline}
                onChange={(e) => setHotline(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-xl text-xs text-gray-800 font-medium"
                placeholder="VD: 1900 88 99 22"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Wifi className="w-3 h-3 text-forest-700" />
                <span>WiFi in hóa đơn</span>
              </label>
              <input
                type="text"
                data-testid="input-wifi-password"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-xl text-xs text-gray-800 font-medium"
                placeholder="VD: goccaphe2026"
              />
            </div>
          </div>
        </div>

        {/* 3. VietQR MBBank Settlement Sub-section */}
        <div className="pt-3 border-t border-forest-800/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-forest-50 text-forest-800 flex items-center justify-center border border-forest-100">
                <CreditCard className="w-4 h-4 text-forest-800" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider">
                  Tài khoản Nhận VietQR (MBBank)
                </h4>
                <p className="text-[10px] text-gray-500">Mã QR động chuẩn NAPAS247 tạo tự động khi thanh toán</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-forest-50 text-forest-800 border border-forest-200 text-[10px] font-extrabold">
              MBBank
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Số tài khoản MBBank
              </label>
              <input
                type="text"
                required
                data-testid="input-account-no"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-xl text-xs font-mono font-bold text-forest-950 tracking-wider"
                placeholder="0988776655"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Tên chủ tài khoản
              </label>
              <input
                type="text"
                required
                data-testid="input-account-holder"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                className="glass-input w-full px-3 py-2 rounded-xl text-xs font-bold text-gray-800 uppercase"
                placeholder="QUAN CA PHE GOC"
              />
            </div>
          </div>

          {/* Live VietQR Preview Pill */}
          <div
            data-testid="vietqr-preview-pill"
            className="bg-forest-50/70 p-2.5 rounded-2xl border border-forest-200/60 flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-forest-800" />
              <div className="text-[11px]">
                <span className="font-bold text-forest-950">{accountNo || '0988776655'}</span>
                <span className="text-gray-400 mx-1.5">•</span>
                <span className="font-semibold text-forest-800">{accountHolder || 'QUAN CA PHE GOC'}</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Sẵn sàng
            </span>
          </div>
        </div>

        {/* Primary Save Action */}
        <button
          type="submit"
          data-testid="save-operational-settings-btn"
          disabled={isSubmitting}
          className="touch-target btn-press w-full py-2.5 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold flex items-center justify-center space-x-1.5 disabled:opacity-50 shadow-sm"
        >
          {isSubmitting ? (
            <span>Đang lưu cấu hình...</span>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Lưu toàn bộ cấu hình</span>
            </>
          )}
        </button>
      </form>

      {/* 4. SQL Schema Modal */}
      {showSchemaModal && (
        <div
          data-testid="sql-schema-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn"
        >
          <div className="bg-white w-full max-w-xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-forest-900 text-white">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">Supabase Database Schema SQL</h3>
                  <p className="text-[10px] text-white/70">7 bảng chuẩn hóa: tables, orders, menu_items, toppings, settings...</p>
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
                  data-testid="copy-sql-schema-btn"
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
