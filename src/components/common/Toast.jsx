import React from 'react';
import { usePos } from '../../store/PosContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast() {
  const { toasts, removeToast } = usePos();

  if (!toasts.length) return null;

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[90%] max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between p-3 rounded-xl shadow-float backdrop-blur-md transition-all animate-bounceIn border text-xs sm:text-sm font-medium ${
              isSuccess
                ? 'bg-forest-900/90 text-white border-forest-600/30'
                : isError
                ? 'bg-rose-900/90 text-white border-rose-500/30'
                : 'bg-gray-900/90 text-white border-gray-700/30'
            }`}
          >
            <div className="flex items-center gap-2">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
              {isError && <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
              {!isSuccess && !isError && <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />}
              <span className="leading-snug">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-white/70 hover:text-white p-1 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
