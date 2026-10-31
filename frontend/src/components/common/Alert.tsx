import React from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message?: React.ReactNode;
  children?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  message,
  children,
  onClose,
  className = '',
}) => {
  const Icon =
    variant === 'success'
      ? CheckCircle2
      : variant === 'warning'
      ? AlertTriangle
      : variant === 'error'
      ? AlertCircle
      : Info;

  const variantClass = `alert-${variant}`;

  return (
    <div role="alert" className={`alert ${variantClass} ${className}`.trim()}>
      <Icon size={18} style={{ flexShrink: 0, marginTop: title ? '2px' : '0' }} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontWeight: 700, marginBottom: '2px' }}>{title}</div>}
        <div style={{ fontSize: '0.85rem' }}>{message || children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="btn-icon"
          style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px', padding: 0 }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
};
