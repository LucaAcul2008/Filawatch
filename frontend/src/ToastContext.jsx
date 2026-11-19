import React, { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const push = useCallback((variant, message, opts = {}) => {
    const id = nextId++;
    const duration = opts.duration ?? 3500;
    setToasts(t => [...t, { id, variant, message }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const toast = {
    success: (m, o) => push('success', m, o),
    error:   (m, o) => push('error', m, o),
    info:    (m, o) => push('info', m, o),
    warning: (m, o) => push('warning', m, o),
    dismiss,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)] sm:max-w-sm">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const styles = {
    success: { border: '#00ff88', icon: '✓', color: '#00ff88' },
    error:   { border: '#ff3860', icon: '✕', color: '#ff3860' },
    info:    { border: '#00d9ff', icon: 'ℹ', color: '#00d9ff' },
    warning: { border: '#ffb800', icon: '⚠', color: '#ffb800' },
  };
  const s = styles[toast.variant] || styles.info;

  return (
    <div
      onClick={onDismiss}
      className="toast-item pointer-events-auto cursor-pointer bg-blueprint border px-4 py-3 flex items-start gap-3 shadow-2xl backdrop-blur-sm"
      style={{ borderColor: s.border, background: 'var(--toast-bg, rgba(13, 27, 42, 0.95))' }}
    >
      <div className="font-display text-base shrink-0" style={{ color: s.color }}>{s.icon}</div>
      <div className="flex-1 text-xs font-body break-words" style={{ color: 'var(--text)' }}>{toast.message}</div>
      <div className="text-gray-500 text-xs leading-none">×</div>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback so things never crash if provider missing
    return {
      success: (m) => console.log('[toast.success]', m),
      error:   (m) => console.error('[toast.error]', m),
      info:    (m) => console.log('[toast.info]', m),
      warning: (m) => console.warn('[toast.warning]', m),
      dismiss: () => {},
    };
  }
  return ctx;
}
