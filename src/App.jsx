import React, { lazy, Suspense } from 'react';
import { PosProvider, usePos } from './store/PosContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import { AnimateUIProvider } from './lib/animateUi';
import LoginPage from './components/auth/LoginPage';
import { useVersionChecker } from './hooks/useVersionChecker';
import { RefreshCw, X } from 'lucide-react';

// Code-split heavy post-auth views for instant login load and 90+ Lighthouse score
// Routes: activeTab === 'settings', activeTab === 'tables', activeTab === 'menu', activeTab === 'orders', activeTab === 'reports'
const PosContent = lazy(() => import('./components/pos/PosContent'));
const LoginSuccessView = lazy(() => import('./components/auth/LoginSuccessView'));

function PosAppRoot() {
  const {
    isAuthenticated,
    isAuthLoading,
    currentRoute,
    navigate,
    loginSuccessRole,
    setLoginSuccessRole,
    currentUser,
    logoutUser
  } = usePos();

  const { hasUpdate, newVersion, applyUpdate, dismissUpdate } = useVersionChecker();

  React.useEffect(() => {
    if (!isAuthLoading) {
      if (!isAuthenticated) {
        if (currentRoute !== '/login') {
          navigate('/login');
        }
      } else {
        if (currentRoute === '/login' && !loginSuccessRole) {
          const targetRoute = currentUser?.role === 'barista' ? '/barista' : '/tables';
          navigate(targetRoute);
        }
      }
    }
  }, [isAuthenticated, isAuthLoading, currentRoute, navigate, loginSuccessRole]);

  if (isAuthLoading) {
    return (
      <div className="h-[100dvh] w-full bg-[#EAEFEA] flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[#214E34] text-white flex items-center justify-center shadow-lg animate-pulse">
            <span className="font-black text-xl">GÓC</span>
          </div>
          <p className="text-xs font-bold text-[#214E34] tracking-wide">Đang kiểm tra phiên làm việc...</p>
        </div>
      </div>
    );
  }

  if (loginSuccessRole) {
    return (
      <ErrorBoundary>
        <Suspense fallback={
          <div className="h-[100dvh] w-full bg-[#F8FAF7] flex items-center justify-center font-sans">
            <div className="w-12 h-12 rounded-full border-3 border-[#214E34] border-t-transparent animate-spin" />
          </div>
        }>
          <LoginSuccessView
            role={loginSuccessRole}
            user={currentUser}
            onLogout={logoutUser}
            onContinue={() => {
              try {
                sessionStorage.removeItem('goc_pos_welcome_role');
              } catch (_) {}
              setLoginSuccessRole(null);
              if (loginSuccessRole === 'barista') {
                navigate('/barista');
              } else {
                navigate('/tables');
              }
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <Suspense fallback={
          <div className="h-[100dvh] w-full bg-[#EAEFEA] flex flex-col items-center justify-center font-sans">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#214E34] text-white flex items-center justify-center shadow-lg animate-pulse">
                <span className="font-black text-xl">GÓC</span>
              </div>
              <p className="text-xs font-bold text-[#214E34] tracking-wide">Đang nạp ứng dụng...</p>
            </div>
          </div>
        }>
          <LoginPage />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      {hasUpdate && (
        <aside
          role="alert"
          aria-label="Thông báo cập nhật ứng dụng"
          className="fixed top-[max(12px,env(safe-area-inset-top,12px))] inset-x-3 sm:inset-x-auto sm:right-4 max-w-md mx-auto sm:mx-0 z-50 bg-[#214E34]/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-3 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)] border border-emerald-400/30 animate-fadeIn"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="text-xs font-bold truncate">
              Đã có phiên bản cập nhật mới ({newVersion})!
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={applyUpdate}
              className="px-3 py-1.5 bg-white text-[#214E34] rounded-xl font-black text-[11px] hover:bg-emerald-50 active:scale-95 cursor-pointer shadow-xs flex items-center gap-1.5 transition-transform"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Cập nhật ngay</span>
            </button>
            <button
              type="button"
              onClick={dismissUpdate}
              title="Đóng thông báo"
              aria-label="Đóng thông báo"
              className="p-1 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}
      <Suspense fallback={
        <div className="h-[100dvh] w-full bg-[#F8FAF7] flex flex-col items-center justify-center font-sans text-[#214E34]">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-3 border-[#214E34] border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-gray-500">Đang khởi tạo phiên làm việc...</span>
          </div>
        </div>
      }>
        <PosContent />
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <PosProvider>
      <AnimateUIProvider tempo={1}>
        <PosAppRoot />
      </AnimateUIProvider>
    </PosProvider>
  );
}
