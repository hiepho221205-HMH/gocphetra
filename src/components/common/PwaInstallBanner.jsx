import React from 'react';
import { Download, Share, PlusSquare, X, CheckCircle, Smartphone } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { triggerHaptic } from '../../utils/haptics';

export default function PwaInstallBanner({ isOpen, onClose }) {
  const { isInstallable, isInstalled, isIOS, showIosPrompt, setShowIosPrompt, triggerInstall } = usePwaInstall();

  if (isInstalled) return null;
  if (!isOpen && !showIosPrompt) return null;

  const handleInstallClick = async () => {
    triggerHaptic('medium');
    await triggerInstall();
  };

  const handleClose = () => {
    setShowIosPrompt(false);
    onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cài đặt ứng dụng GÓC POS"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-gray-100 space-y-4 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#214E34] text-white flex items-center justify-center font-black text-sm shadow-md">
              GÓC
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 leading-tight">Cài đặt GÓC POS</h3>
              <p className="text-[11px] font-semibold text-gray-500">Trải nghiệm mượt mà như App gốc</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Benefits list */}
        <div className="space-y-2 py-1 text-xs text-gray-700">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Mở toàn màn hình không bị che bởi thanh địa chỉ trình duyệt</span>
          </div>
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Bán hàng ngoại tuyến liên tục ngay cả khi mất mạng</span>
          </div>
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Tối ưu độ nhạy cảm ứng &amp; không có độ trễ thao tác</span>
          </div>
        </div>

        {/* Platform-specific Actions */}
        {isIOS ? (
          <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80 space-y-2.5 text-xs">
            <p className="font-extrabold text-[#214E34] flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              <span>Hướng dẫn cài trên iPhone / iPad (Safari):</span>
            </p>
            <ol className="list-decimal pl-4 space-y-1.5 text-gray-700 font-medium leading-relaxed">
              <li>
                Bấm vào nút <strong className="text-gray-900">Chia sẻ</strong> (<Share className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" />) ở thanh công cụ dưới Safari.
              </li>
              <li>
                Cuộn xuống chọn <strong className="text-gray-900">"Thêm vào MH chính"</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-gray-800" /> / Add to Home Screen).
              </li>
              <li>
                Nhấn <strong className="text-gray-900">"Thêm"</strong> (Add) ở góc trên bên phải để hoàn tất.
              </li>
            </ol>
            <button
              type="button"
              onClick={handleClose}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-[#214E34] text-white font-bold text-xs cursor-pointer shadow-xs active:scale-98"
            >
              Tôi đã hiểu
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full py-3 px-4 rounded-2xl bg-[#214E34] hover:bg-[#1a3d29] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-98 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Cài đặt ngay (1-Click Install)</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2 text-center text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Để sau
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
