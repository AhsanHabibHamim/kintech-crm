import { createContext, useContext, useState, useCallback } from 'react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed z-[100] bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-2xl px-4 py-3.5 text-sm font-medium text-white animate-toast shadow-glow-lg backdrop-blur-xl border border-white/10 ${
              t.type === 'error' ? 'bg-rose-600/95' : t.type === 'success' ? 'bg-emerald-600/95' : 'bg-ink-800/95'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span>{t.type === 'error' ? '⚠️' : t.type === 'success' ? '✅' : 'ℹ️'}</span>
              <span className="flex-1">{t.message}</span>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}