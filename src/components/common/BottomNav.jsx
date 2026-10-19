import React, { useEffect } from 'react';
import { usePos } from '../../store/PosContext';
import { LayoutGrid, UtensilsCrossed, ClipboardList, BarChart3, ShieldCheck } from 'lucide-react';

export default function BottomNav() {
  const { activeTab, setActiveTab, tables, orders } = usePos();

  // Đếm bàn đang phục vụ
  const activeOrderCount = Object.keys(orders).length;

  const navItems = [
    { id: 'tables', label: 'Bàn', icon: LayoutGrid, badge: activeOrderCount > 0 ? activeOrderCount : null },
    { id: 'menu', label: 'Thực đơn', icon: UtensilsCrossed },
    { id: 'orders', label: 'Đơn hàng', icon: ClipboardList },
    { id: 'reports', label: 'Báo cáo', icon: BarChart3 },
    { id: 'settings', label: 'Quản lý', icon: ShieldCheck },
  ];

  // Tính toán index của tab đang chọn để di chuyển highlight
  const activeIndex = Math.max(0, navItems.findIndex((item) => item.id === activeTab));

  // Tự động đồng bộ với URL hash khi tải trang, reload trang, nút Back hoặc popstate
  useEffect(() => {
    const syncTabFromUrl = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['tables', 'menu', 'orders', 'reports', 'settings'];
      if (validTabs.includes(hash) && hash !== activeTab) {
        setActiveTab(hash);
      }
    };

    // Đồng bộ ngay khi mount hoặc reload trang
    syncTabFromUrl();

    window.addEventListener('popstate', syncTabFromUrl);
    window.addEventListener('hashchange', syncTabFromUrl);
    return () => {
      window.removeEventListener('popstate', syncTabFromUrl);
      window.removeEventListener('hashchange', syncTabFromUrl);
    };
  }, [activeTab, setActiveTab]);

  return (
    <nav
      aria-label="Thanh điều hướng chính"
      className="fixed bottom-4 left-4 right-4 max-w-[380px] mx-auto z-40 select-none pointer-events-none"
      style={{
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Vỏ ngoài Floating Tab Bar với Glassmorphism và bo cong cao cấp */}
      <div className="pointer-events-auto relative w-full h-[64px] px-1.5 bg-white/80 backdrop-blur-xl border border-white/70 shadow-[0_12px_36px_-6px_rgba(33,78,52,0.18),0_4px_16px_rgba(0,0,0,0.04)] rounded-[28px]">
        {/* Track Grid 5 cột đồng bộ tọa độ tuyệt đối giữa highlight và các nút bấm */}
        <div className="relative w-full h-full grid grid-cols-5 items-center">
          {/* Khối Highlight Circle 44x44px nền xanh trượt ngang mượt mà (220ms) */}
          <div
            className="absolute top-0 bottom-0 left-0 w-1/5 flex items-center justify-center pointer-events-none transition-transform duration-220 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          >
            <div className="w-11 h-11 rounded-full bg-forest-800 animate-fadeIn shadow-md shadow-forest-800/30 flex items-center justify-center" />
          </div>

          {/* Danh sách 5 icon chức năng chia đều 5 cột Grid */}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={item.label}
                title={item.label}
                onClick={() => {
                  if (window.history?.pushState) {
                    window.history.pushState({ tab: item.id }, '', `#${item.id}`);
                  }
                  setActiveTab(item.id);
                }}
                className="touch-target col-span-1 h-full min-h-[44px] flex items-center justify-center relative z-10 active:scale-95 transition-transform duration-150 outline-none focus-visible:ring-2 focus-visible:ring-forest-800/40 rounded-full"
              >
                {/* Nhãn ẩn dành riêng cho hỗ trợ tiếp cận (Screen reader / a11y) */}
                <span className="sr-only">{item.label}</span>

                {/* Vùng hiển thị Icon và Badge: 44x44px đồng bộ tâm tuyệt đối với highlight */}
                <div className="relative flex items-center justify-center w-11 h-11">
                  <Icon
                    className={`w-[23px] h-[23px] transition-all duration-200 ${
                      isActive
                        ? 'text-white stroke-[2.2] scale-105'
                        : 'text-gray-400 hover:text-gray-600 stroke-[1.8] scale-100'
                    }`}
                  />

                  {/* Badge số lượng bàn đang phục vụ trên Tab Bàn */}
                  {item.badge && (
                    <span className="absolute -top-0.5 -right-1 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm ring-2 ring-white/90 leading-none animate-fadeIn">
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
