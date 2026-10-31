import React from 'react';

export interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showPercentage = false,
  variant = 'primary',
  height = 8,
  className = '',
  style,
}) => {
  const percentage = Math.max(0, Math.min(100, Math.round((value / max) * 100)));

  const variantColors: Record<string, string> = {
    primary: 'var(--primary, #1769C2)',
    success: 'var(--success, #16A34A)',
    warning: '#D97706',
    danger: 'var(--danger, #DC2626)',
  };

  const barColor = variantColors[variant] || variantColors.primary;

  return (
    <div className={`progress-container ${className}`.trim()} style={{ width: '100%', ...style }}>
      {(label || showPercentage) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '6px',
            fontSize: '0.8rem',
          }}
        >
          {label && (
            <span style={{ fontWeight: 600, color: 'var(--text-main, #111827)' }}>
              {label}
            </span>
          )}
          {showPercentage && (
            <span style={{ fontWeight: 700, color: barColor, marginLeft: 'auto' }}>
              {percentage}%
            </span>
          )}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress bar'}
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: '#E2E8F0',
          borderRadius: '9999px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: barColor,
            borderRadius: '9999px',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
};
