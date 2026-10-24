import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  title?: string;
  style?: React.CSSProperties;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  onRetry,
  title = 'Something went wrong',
  style,
}) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--danger-bg)',
        border: '1px solid rgba(220, 38, 38, 0.25)',
        color: 'var(--danger)',
        padding: '16px',
        borderRadius: 'var(--radius-md)',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>{title}</div>
          <div style={{ fontSize: '0.84rem', lineHeight: '1.4', opacity: 0.9 }}>{message}</div>
        </div>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            padding: '6px 12px',
            minHeight: '36px',
            backgroundColor: '#ffffff',
            borderColor: 'rgba(220, 38, 38, 0.3)',
            color: 'var(--danger)',
          }}
        >
          <RefreshCw size={13} />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};
