import React from 'react';
import { usePos } from '../../store/PosContext';
import { Coffee, Smartphone, Monitor, Bell, Clock, MapPin, RefreshCw } from 'lucide-react';

export default function Header() {
  const { settings, deviceMode, toggleDeviceMode, tables, resetAllData } = usePos();

  // Đếm bàn đang phục vụ
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;
  const awaitingCount = tables.filter((t) => t.status === 'awaiting_payment').length;

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-forest-800/10 px-4 py-2.5 transition-all">
      <div className="flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-forest-800 flex items-center justify-center text-white shadow-sm shadow-forest-800/30">
            <Coffee className="w-5 h-5 text-[#E6F4EA]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="font-extrabold text-[17px] tracking-tight text-forest-900 leading-tight">
                GÓC <span className="font-light text-forest-600 text-sm">• Phê & Trà</span>
              </h1>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-forest-100 text-forest-800 rounded-md">
                POS
              </span>
            </div>
            <div className="flex items-center text-[11px] text-gray-500 space-x-2 mt-0.5">
              <span className="flex items-center gap-0.5 truncate max-w-[130px]">
                <MapPin className="w-3 h-3 text-forest-700 inline flex-shrink-0" />
                Quận 1
              </span>
              <span>•</span>
              <span className="flex items-center gap-0.5 text-forest-700 font-medium">
                <Clock className="w-3 h-3 inline flex-shrink-0" />
                Ca Sáng
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Badges & Mode Switcher */}
        <div className="flex items-center space-x-1.5">
          {/* Status Counter */}
          <div className="hidden sm:flex items-center gap-1.5 bg-forest-50 px-2.5 py-1 rounded-full text-xs text-forest-800 font-medium border border-forest-200/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{occupiedCount + awaitingCount} Bàn hoạt động</span>
          </div>

          {/* Device Frame Toggle */}
          <button
            onClick={toggleDeviceMode}
            title={deviceMode === 'mobile' ? 'Mở rộng toàn màn hình (Responsive)' : 'Thu về khung chuẩn Mobile 390px'}
            className="touch-target px-2.5 h-8 text-xs font-medium rounded-lg border border-forest-800/15 bg-white text-forest-800 hover:bg-forest-50 transition-colors flex items-center gap-1"
          >
            {deviceMode === 'mobile' ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-forest-700" />
                <span className="hidden xs:inline">Desktop</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-forest-700" />
                <span className="hidden xs:inline">Mobile (390px)</span>
              </>
            )}
          </button>

          {/* Quick Reset Sample Data */}
          <button
            onClick={() => {
              if (window.confirm('Khôi phục dữ liệu mẫu ban đầu của GÓC POS?')) {
                resetAllData();
              }
            }}
            title="Khôi phục dữ liệu mẫu"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-forest-800 hover:bg-forest-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
