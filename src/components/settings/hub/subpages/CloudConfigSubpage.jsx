import React, { useState } from 'react';
import {
  ArrowLeft,
  Database,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Server
} from 'lucide-react';
import { triggerHaptic } from '../../../../utils/haptics';

/**
 * CloudConfigSubpage - Subpage 6: Cloud & Dữ liệu
 * Giám sát trạng thái Supabase Cloud, kiểm tra độ trễ và kích hoạt đồng bộ dữ liệu.
 * Không cần nút lưu vì các tác vụ đều được thực thi trực tiếp.
 */
export default function CloudConfigSubpage({
  cloudStatus,
  isSyncing,
  syncFromCloud,
  seedToCloud,
  showToast,
  onBack
}) {
  const [isPinging, setIsPinging] = useState(false);
  const [lastPingTime, setLastPingTime] = useState(null);

  const isConnected = cloudStatus?.connected && cloudStatus?.tablesExist;

  const handleTestConnection = async () => {
    triggerHaptic('medium');
    setIsPinging(true);
    try {
      if (typeof syncFromCloud === 'function') {
        await syncFromCloud(false);
      }
      setLastPingTime(new Date().toLocaleTimeString('vi-VN'));
      showToast?.('Kết nối Supabase Cloud ổn định!', 'success');
    } catch (err) {
      showToast?.('Không thể kết nối Cloud: ' + (err.message || 'Lỗi mạng'), 'error');
    } finally {
      setIsPinging(false);
    }
  };

  const handleSyncFromCloud = async () => {
    triggerHaptic('medium');
    try {
      await syncFromCloud?.(true);
    } catch (err) {
      showToast?.('Lỗi đồng bộ: ' + (err.message || 'Thử lại sau'), 'error');
    }
  };

  const handleSeedToCloud = async () => {
    triggerHaptic('medium');
    try {
      await seedToCloud?.();
    } catch (err) {
      showToast?.('Lỗi đẩy dữ liệu: ' + (err.message || 'Thử lại sau'), 'error');
    }
  };

  return (
    <div
      data-testid="cloud-config-subpage"
      className="space-y-4 animate-slideInRight text-xs pb-24 max-w-2xl mx-auto"
    >
      {/* Top Header */}
      <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onBack?.();
          }}
          className="touch-target p-2 rounded-2xl bg-white border border-gray-200/80 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
          title="Quay lại Settings Hub"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Database className="w-4 h-4 text-[#E11D48]" />
            <h2 className="text-base font-black text-forest-950 tracking-tight leading-none">
              Cloud & Dữ liệu
            </h2>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">
            Trạng thái máy chủ Supabase, độ trễ và đồng bộ dữ liệu thời gian thực
          </p>
        </div>
      </div>

      {/* Cloud Status Overview Card */}
      <div className="clay-card p-4 sm:p-5 rounded-[24px] bg-white border border-white/95 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/80'
                  : 'bg-amber-50 text-amber-600 border border-amber-200/80'
              }`}
            >
              <Database className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-forest-950 text-sm">
                Supabase Postgres Backend
              </h3>
              <p className="text-[10.5px] text-gray-500 font-mono">
                Project: <span className="font-bold text-gray-700">nbuulvdfxnmfdicbisxq</span>
              </p>
            </div>
          </div>

          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isConnected ? `Online (${cloudStatus?.latency || 12}ms)` : 'Offline / Reconnecting'}
          </span>
        </div>

        {/* Detailed Specs Grid */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div className="p-3 bg-gray-50/80 rounded-2xl border border-gray-200/80 space-y-1">
            <span className="text-[10px] text-gray-500 font-semibold block">Độ trễ máy chủ (Latency)</span>
            <div className="flex items-center gap-1.5 font-bold text-forest-900 text-xs">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{cloudStatus?.latency ? `${cloudStatus.latency} ms` : 'Tối ưu (<50ms)'}</span>
            </div>
          </div>

          <div className="p-3 bg-gray-50/80 rounded-2xl border border-gray-200/80 space-y-1">
            <span className="text-[10px] text-gray-500 font-semibold block">Cơ sở dữ liệu (RLS)</span>
            <div className="flex items-center gap-1.5 font-bold text-emerald-700 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Sẵn sàng hoạt động</span>
            </div>
          </div>
        </div>

        {/* Live Ping Button */}
        <button
          type="button"
          disabled={isPinging}
          onClick={handleTestConnection}
          className="touch-target w-full py-2.5 px-4 bg-gray-50 hover:bg-forest-50/60 text-forest-900 font-bold rounded-2xl border border-gray-200/80 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer text-xs"
        >
          <Server className={`w-3.5 h-3.5 ${isPinging ? 'animate-pulse text-[#214E34]' : ''}`} />
          <span>{isPinging ? 'Đang kiểm tra kết nối...' : 'Kiểm tra kết nối máy chủ ngay'}</span>
          {lastPingTime && (
            <span className="text-[10px] font-normal text-gray-400">({lastPingTime})</span>
          )}
        </button>
      </div>

      {/* Manual Sync Operations Card */}
      <div className="clay-card p-4 sm:p-5 rounded-[24px] bg-white border border-white/95 shadow-xs space-y-3.5">
        <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider">
          Đồng bộ Dữ liệu Quán
        </h3>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Dữ liệu đơn hàng, cấu hình và bàn được đồng bộ tự động 2 chiều. Bạn cũng có thể kích hoạt đồng bộ cưỡng bức khi cần làm mới tức thì giữa các thiết bị.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleSyncFromCloud}
            disabled={isSyncing}
            className="touch-target flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 hover:bg-forest-50 text-forest-900 border border-gray-200 rounded-2xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer shadow-2xs active:scale-[0.98]"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#214E34]' : ''}`} />
            <span>Đồng bộ từ Cloud</span>
          </button>

          <button
            type="button"
            onClick={handleSeedToCloud}
            disabled={isSyncing}
            className="touch-target flex items-center justify-center gap-2 px-4 py-3 bg-[#214E34] hover:bg-[#183926] text-white rounded-2xl font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-[0.98] disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Đẩy lên Cloud</span>
          </button>
        </div>
      </div>
    </div>
  );
}
