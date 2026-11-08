import React, { lazy, Suspense } from 'react';
import { PosProvider, usePos } from './store/PosContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import { AnimateUIProvider } from './lib/animateUi';
import LoginPage from './components/auth/LoginPage';

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

  React.useEffect(() => {
    if (!isAuthLoading) {
      if (!isAuthenticated) {
        if (currentRoute !== '/login') {
          navigate('/login');
        }
      } else {
        if (currentRoute === '/login' && !loginSuccessRole) {
          navigate('/tables');
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
              navigate('/tables');
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
