import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
  showSuccess: (message: string, durationMs?: number) => void;
  showError: (message: string, durationMs?: number) => void;
  showWarning: (message: string, durationMs?: number) => void;
  showInfo: (message: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', durationMs?: number) => {
      if (!message || !message.trim()) return;

      // Duplicate prevention: avoid stacking identical notifications
      setToasts((prev) => {
        const isDuplicate = prev.some((t) => t.message === message && t.type === type);
        if (isDuplicate) return prev;

        const id = Math.random().toString(36).substring(2, 9);
        const next = [...prev, { id, message, type }];

        // Configurable duration with longer auto-dismiss for errors
        const timeout =
          durationMs ??
          (type === 'error' ? 6000 : type === 'warning' ? 5000 : 3500);

        setTimeout(() => {
          removeToast(id);
        }, timeout);

        return next;
      });
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (message: string, durationMs?: number) => showToast(message, 'success', durationMs),
    [showToast]
  );
  const showError = useCallback(
    (message: string, durationMs?: number) => showToast(message, 'error', durationMs),
    [showToast]
  );
  const showWarning = useCallback(
    (message: string, durationMs?: number) => showToast(message, 'warning', durationMs),
    [showToast]
  );
  const showInfo = useCallback(
    (message: string, durationMs?: number) => showToast(message, 'info', durationMs),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
      {children}
      <div
        className="toast-container"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const isUrgent = toast.type === 'error' || toast.type === 'warning';
          return (
            <div
              key={toast.id}
              className={`toast toast-${toast.type}`}
              role={isUrgent ? 'alert' : 'status'}
              aria-atomic="true"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                {toast.type === 'success' && <CheckCircle2 size={18} style={{ flexShrink: 0 }} />}
                {toast.type === 'error' && <AlertCircle size={18} style={{ flexShrink: 0 }} />}
                {toast.type === 'warning' && <AlertTriangle size={18} style={{ flexShrink: 0 }} />}
                {toast.type === 'info' && <Info size={18} style={{ flexShrink: 0 }} />}
                <span style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  {toast.message}
                </span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  opacity: 0.85,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  borderRadius: '4px',
                  flexShrink: 0,
                  marginLeft: '8px',
                }}
                aria-label="Dismiss notification"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

