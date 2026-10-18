import React from 'react';
import { usePos } from '../../store/PosContext';
import { LayoutGrid, UtensilsCrossed, ClipboardList, BarChart3, Settings } from 'lucide-react';

export default function BottomNav() {
  const { activeTab, setActiveTab, tables, orders } = usePos();

  // Đếm bàn đang phục vụ
  const activeOrderCount = Object.keys(orders).length;

  const navItems = [
    { id: 'tables', label: 'Bàn', icon: LayoutGrid, badge: activeOrderCount > 0 ? activeOrderCount : null },
    { id: 'menu', label: 'Thực đơn', icon: UtensilsCrossed },
    { id: 'orders', label: 'Đơn hàng', icon: ClipboardList },
    { id: 'reports', label: 'Báo cáo', icon: BarChart3 },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-forest-800/10 shadow-lg">
      <div className="max-w-md mx-auto grid grid-cols-5 px-1 py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`touch-target flex flex-col items-center justify-center py-1 transition-all rounded-xl relative ${
                isActive
                  ? 'text-forest-800 font-bold'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`}
            >
              {/* Active Indicator Pill */}
              {isActive && (
                <span className="absolute top-0.5 w-6 h-1 rounded-full bg-forest-800 animate-fadeIn" />
              )}

              <div className="relative mt-1">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-forest-800 stroke-[2.3]' : 'stroke-[1.8]'}`} />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>

              <span className={`text-[10.5px] mt-1 ${isActive ? 'text-forest-900 font-semibold' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
