import React, { useEffect, useState, useRef } from 'react';
import { usePos } from '../../store/PosContext';
import { LayoutGrid, UtensilsCrossed, ClipboardList, BarChart3 } from 'lucide-react';

export default function BottomNav() {
  const { activeTab, setActiveTab, orders, currentRole } = usePos();

  // Đếm bàn đang phục vụ
  const activeOrderCount = Object.keys(orders).length;

  const isStaff = currentRole === 'staff';

  const allNavItems = [
    { id: 'tables', label: 'Bàn', icon: LayoutGrid, badge: activeOrderCount > 0 ? activeOrderCount : null },
    { id: 'menu', label: 'Thực đơn', icon: UtensilsCrossed },
    { id: 'orders', label: 'Đơn hàng', icon: ClipboardList },
    { id: 'reports', label: 'Báo cáo', icon: BarChart3 },
  ];

  // RBAC Filter: Staff chỉ truy cập Sơ đồ bàn ('tables') và Đơn hàng ('orders')
  const navItems = isStaff
    ? [allNavItems[0], allNavItems[2]]
    : allNavItems;

  // Tính toán index của tab đang chọn để di chuyển highlight (-1 nếu không thuộc danh sách)
  const activeIndex = navItems.findIndex((item) => item.id === activeTab);

  // Danh sách các tab áp dụng hiệu ứng tự động trượt ẩn/hiện khi cuộn
  const AUTO_HIDE_TABS = ['tables', 'orders'];
  const shouldAutoHide = AUTO_HIDE_TABS.includes(activeTab);

  // Trạng thái hiển thị khi cuộn danh sách (áp dụng cho Sơ đồ bàn: 'tables' và Đơn hàng: 'orders')
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  // Theo dõi sự kiện cuộn trên scroll container
  useEffect(() => {
    if (!shouldAutoHide) {
      setIsVisible(true);
      return;
    }

    const scrollContainer = document.querySelector('main');

    const getScrollTop = () => {
      if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight && scrollContainer.scrollTop > 0) {
        return scrollContainer.scrollTop;
      }
      return window.pageYOffset || document.documentElement.scrollTop || 0;
    };

    lastScrollY.current = getScrollTop();

    const SCROLL_THRESHOLD = 10;
    const TOP_THRESHOLD = 15;

    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = getScrollTop();
          const delta = currentScrollY - lastScrollY.current;

          if (currentScrollY <= TOP_THRESHOLD) {
            setIsVisible(true);
          } else if (Math.abs(delta) >= SCROLL_THRESHOLD) {
            if (delta > 0) {
              setIsVisible(false);
            } else {
              setIsVisible(true);
            }
          }

          lastScrollY.current = Math.max(0, currentScrollY);
          ticking.current = false;
        });

        ticking.current = true;
      }
    };

    const handleShowNav = () => {
      setIsVisible(true);
      lastScrollY.current = getScrollTop();
    };

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('goc_pos_show_nav', handleShowNav);

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('goc_pos_show_nav', handleShowNav);
    };
  }, [activeTab, shouldAutoHide]);

  // Tự động đồng bộ với URL hash khi tải trang, reload trang, nút Back hoặc popstate
  useEffect(() => {
    const syncTabFromUrl = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['tables', 'menu', 'orders', 'reports', 'settings'];
      if (validTabs.includes(hash) && hash !== activeTab) {
        setActiveTab(hash);
      }
    };

    syncTabFromUrl();

    window.addEventListener('popstate', syncTabFromUrl);
    window.addEventListener('hashchange', syncTabFromUrl);
    return () => {
      window.removeEventListener('popstate', syncTabFromUrl);
      window.removeEventListener('hashchange', syncTabFromUrl);
    };
  }, [activeTab, setActiveTab, isStaff]);

  return (
    <nav
      aria-label="Thanh điều hướng chính"
      data-testid="bottom-nav"
      className={`fixed bottom-4 left-4 right-4 max-w-[380px] mx-auto z-40 select-none pointer-events-none transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-[calc(100%+32px+env(safe-area-inset-bottom,0px))] opacity-0'
      }`}
      style={{
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Vỏ ngoài Floating Tab Bar với Glassmorphism và bo cong cao cấp */}
      <div
        className={`relative w-full h-[64px] px-1.5 bg-white/80 backdrop-blur-xl border border-white/70 shadow-[0_12px_36px_-6px_rgba(33,78,52,0.18),0_4px_16px_rgba(0,0,0,0.04)] rounded-[28px] ${
          isVisible ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {/* Track Grid phân bổ theo số tab (2 cột cho Staff, 4 cột cho Manager/Admin) */}
        <div className={`relative w-full h-full grid ${isStaff ? 'grid-cols-2' : 'grid-cols-4'} items-center`}>
          {/* Khối Highlight Circle 44x44px nền xanh trượt ngang mượt mà */}
          <div
            className={`absolute top-0 bottom-0 left-0 ${isStaff ? 'w-1/2' : 'w-1/4'} flex items-center justify-center pointer-events-none transition-all duration-220 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              activeIndex >= 0 ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              transform: `translateX(${Math.max(0, activeIndex) * 100}%)`,
            }}
          >
            <div className="w-11 h-11 rounded-full bg-forest-800 animate-fadeIn shadow-md shadow-forest-800/30 flex items-center justify-center" />
          </div>

          {/* Danh sách icon chức năng */}
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
                data-testid={`bottom-nav-${item.id}`}
                onClick={() => {
                  if (window.history?.pushState) {
                    window.history.pushState({ tab: item.id }, '', `#${item.id}`);
                  }
                  setActiveTab(item.id);
                }}
                className="touch-target col-span-1 h-full min-h-[44px] flex items-center justify-center relative z-10 active:scale-95 transition-transform duration-150 outline-none focus-visible:ring-2 focus-visible:ring-forest-800/40 rounded-full cursor-pointer"
              >
                <span className="sr-only">{item.label}</span>

                <div className="relative flex items-center justify-center w-11 h-11">
                  <Icon
                    className={`w-[23px] h-[23px] transition-all duration-200 ${
                      isActive
                        ? 'text-white stroke-[2.2] scale-105'
                        : 'text-gray-400 hover:text-gray-600 stroke-[1.8] scale-100'
                    }`}
                  />

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
