import React, { lazy, Suspense } from 'react';
import { PosProvider, usePos } from './store/PosContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import { AnimateUIProvider } from './lib/animateUi';
import LoginPage from './components/auth/LoginPage';
import { useVersionChecker } from './hooks/useVersionChecker';
import { RefreshCw } from 'lucide-react';

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
    currentUser
  } = usePos();

  const { hasUpdate, newVersion, applyUpdate } = useVersionChecker();

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
        <div
          role="alert"
          className="fixed top-0 inset-x-0 z-50 bg-[#214E34] text-white px-4 py-2 flex items-center justify-between text-xs font-bold shadow-lg animate-fadeIn"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span>Đã có phiên bản cập nhật mới ({newVersion})!</span>
          </span>
          <button
            type="button"
            onClick={applyUpdate}
            className="px-3 py-1 bg-white text-[#214E34] rounded-lg font-black text-[11px] hover:bg-emerald-50 active:scale-95 cursor-pointer shadow-xs flex items-center gap-1.5 transition-transform"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Cập nhật ngay</span>
          </button>
        </div>
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
