import React, { useState, useRef, useEffect } from 'react';
import { Bluetooth, Printer, RefreshCw, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useBluetoothPrint } from '../../hooks/useBluetoothPrint.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { usePos } from '../../store/PosContext.jsx';

/**
 * BluetoothStatusBadge
 * Visual status indicator for Web Bluetooth thermal printer:
 * - Green (Connected)
 * - Amber/Yellow (Printing / Reconnecting)
 * - Red/Gray (Disconnected / Error)
 * Interactive quick-action popover with connection controls and queue counter.
 */
export default function BluetoothStatusBadge({ compact = false }) {
  const {
    isSupported,
    isConnected,
    isStandbyReady,
    isAutoRelease,
    setAutoReleaseEnabled,
    isPrinting,
    isReconnecting,
    statusText,
    deviceName,
    queueLength,
    activeJob,
    connect,
    disconnect,
    retry,
    hasFailedJob
  } = useBluetoothPrint();

  const { showToast } = usePos();
  const [isOpen, setIsOpen] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const containerRef = useRef(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  if (!isSupported) {
    return null; // Gracefully hide when Web Bluetooth is not supported in environment
  }

  // Determine visual color state
  // Green: Connected & idle
  // Amber: Printing, Reconnecting, Connecting, or Queue > 0
  // Red: Disconnected or Error
  let colorTheme = {
    badgeBg: 'bg-white hover:bg-rose-50/60 border-rose-200/80 text-rose-600',
    dotBg: 'bg-rose-500',
    iconColor: 'text-rose-500',
    pingAnimation: false,
    label: 'Chưa kết nối',
    ariaLabel: 'Máy in Bluetooth: Chưa kết nối. Bấm để kết nối'
  };

  if (isPrinting || isReconnecting || queueLength > 0) {
    colorTheme = {
      badgeBg: 'bg-amber-50/70 hover:bg-amber-100/70 border-amber-300 text-amber-700',
      dotBg: 'bg-amber-500',
      iconColor: 'text-amber-600',
      pingAnimation: true,
      label: isReconnecting ? 'Đang kết nối lại...' : isPrinting ? `Đang in (${queueLength + 1})` : 'Đang xử lý...',
      ariaLabel: `Máy in Bluetooth: ${isReconnecting ? 'Đang kết nối lại' : 'Đang in'}`
    };
  } else if (isConnected) {
    colorTheme = {
      badgeBg: 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-300 text-[#214E34]',
      dotBg: 'bg-emerald-500',
      iconColor: 'text-[#214E34]',
      pingAnimation: false,
      label: deviceName ? `${deviceName.slice(0, 12)}` : 'Đã kết nối',
      ariaLabel: `Máy in Bluetooth: Đã kết nối với ${deviceName || 'máy in'}`
    };
  } else if (isStandbyReady) {
    colorTheme = {
      badgeBg: 'bg-emerald-50/40 hover:bg-emerald-100/40 border-emerald-200 text-[#214E34]',
      dotBg: 'bg-emerald-400',
      iconColor: 'text-[#214E34]',
      pingAnimation: false,
      label: deviceName ? `${deviceName.slice(0, 10)} (Sẵn sàng)` : 'Sẵn sàng',
      ariaLabel: `Máy in Bluetooth: Sẵn sàng chia sẻ in với ${deviceName || 'máy in'}`
    };
  }

  const handleToggle = () => {
    triggerHaptic('light');
    setIsOpen((prev) => !prev);
  };

  const handleConnect = async () => {
    triggerHaptic('medium');
    setIsActionPending(true);
    try {
      await connect();
      showToast('Đã kết nối máy in Bluetooth thành công!', 'success');
      setIsOpen(false);
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        showToast(err.message || 'Không thể kết nối máy in Bluetooth', 'error');
      }
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDisconnect = () => {
    triggerHaptic('warning');
    disconnect();
    showToast('Đã ngắt kết nối máy in', 'info');
    setIsOpen(false);
  };

  const handleRetry = async () => {
    triggerHaptic('medium');
    setIsActionPending(true);
    try {
      await retry();
      showToast('Đang thử lại lệnh in...', 'info');
      setIsOpen(false);
    } catch (err) {
      showToast(err.message || 'Thao tác thử lại thất bại', 'error');
    } finally {
      setIsActionPending(false);
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Badge Button - Compact 3D Clay Circle */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={colorTheme.ariaLabel}
        aria-expanded={isOpen}
        title={colorTheme.ariaLabel}
        role="status"
        data-testid="header-bluetooth-button"
        className={`relative w-[38px] h-[38px] rounded-full border flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer shadow-[0_4px_10px_-2px_rgba(33,78,52,0.12),inset_0_1px_2px_rgba(255,255,255,0.8)] ${colorTheme.badgeBg}`}
      >
        <Bluetooth className={`w-[18px] h-[18px] shrink-0 ${colorTheme.iconColor}`} />
        <span className="absolute top-1 right-1 flex h-2.5 w-2.5 items-center justify-center pointer-events-none">
          {colorTheme.pingAnimation && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorTheme.dotBg}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 border border-white shadow-2xs ${colorTheme.dotBg}`} />
        </span>
      </button>

      {/* Popover Controls */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-3.5 z-50 animate-fadeIn text-xs text-gray-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-[#214E34]" />
              <span className="font-black text-gray-900">Máy in Bluetooth</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Status Details */}
          <div className="space-y-1.5 bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-[11.5px]">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-semibold">Trạng thái:</span>
              <span className="font-extrabold flex items-center gap-1">
                {isConnected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Đã kết nối</span>
                  </>
                ) : isReconnecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                    <span className="text-amber-700">Đang tự kết nối lại...</span>
                  </>
                ) : isStandbyReady ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Sẵn sàng (Đã nhả máy in)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-rose-600">Chưa kết nối</span>
                  </>
                )}
              </span>
            </div>

            {deviceName && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-semibold">Thiết bị:</span>
                <span className="font-bold text-gray-800 truncate max-w-[140px]">{deviceName}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-semibold">Hàng đợi in:</span>
              <span className="font-black text-gray-900">{queueLength} lệnh</span>
            </div>

            {activeJob && (
              <div className="flex justify-between items-center text-[10.5px] text-amber-800 bg-amber-50/80 p-1 rounded-md">
                <span className="truncate">Đang in: {activeJob.title}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-1 border-t border-gray-100">
              <span className="text-gray-500 font-semibold">Chia sẻ nhiều máy:</span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setAutoReleaseEnabled(!isAutoRelease);
                  showToast(
                    !isAutoRelease
                      ? 'Đã bật chế độ chia sẻ máy in (tự nhả sau khi in 1s)'
                      : 'Đã tắt chế độ chia sẻ (giữ kết nối liên tục)',
                    'info'
                  );
                }}
                className={`px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer transition-colors ${
                  isAutoRelease
                    ? 'bg-emerald-100 text-[#214E34]'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {isAutoRelease ? 'Đang BẬT' : 'Đang TẮT'}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            {hasFailedJob && (
              <button
                type="button"
                disabled={isActionPending}
                onClick={handleRetry}
                className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition-transform disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại lệnh in gần nhất</span>
              </button>
            )}

            {!isConnected ? (
              <button
                type="button"
                disabled={isActionPending}
                onClick={handleConnect}
                className="w-full py-2 px-3 rounded-xl bg-[#214E34] hover:bg-[#1b3f2a] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition-transform disabled:opacity-50"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span>{isActionPending ? 'Đang kết nối...' : 'Kết nối máy in'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDisconnect}
                className="w-full py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 transition-transform"
              >
                <span>Ngắt kết nối</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
