import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Đã bắt lỗi runtime:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else if (typeof window !== 'undefined') {
      window.location.hash = '#/tables';
      window.location.reload();
    }
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.hash = '#/tables';
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[100dvh] w-full ambient-clay-bg flex flex-col items-center justify-center p-4 select-none font-sans">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-6 text-center space-y-4 shadow-2xl border border-gray-100">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle className="w-7 h-7 text-rose-600 stroke-[2.2]" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-black text-gray-900 text-base">Đã xảy ra sự cố hiển thị</h3>
              <p className="text-gray-500 text-xs leading-relaxed">
                Ứng dụng gặp lỗi ngoài dự kiến tại màn hình này. Dữ liệu bán hàng và hóa đơn của quán vẫn được bảo toàn an toàn trên hệ thống.
              </p>
              {this.state.error?.message && (
                <div className="mt-2 p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-left font-mono text-[10px] text-gray-600 break-all max-h-20 overflow-y-auto">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleGoHome}
                className="py-2.5 px-3 rounded-xl clay-inset text-gray-700 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Home className="w-4 h-4 text-gray-600" />
                <span>Về Sơ đồ bàn</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="py-2.5 px-3 rounded-xl clay-btn-primary text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-md"
              >
                <RotateCcw className="w-4 h-4 text-emerald-300" />
                <span>Thử lại ngay</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
