import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'white' | 'muted' | 'danger';
  className?: string;
  style?: React.CSSProperties;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  className = '',
  style,
}) => {
  const pixelSizes: Record<string, number> = {
    sm: 14,
    md: 18,
    lg: 24,
    xl: 32,
  };

  const colors: Record<string, string> = {
    primary: 'var(--primary, #1769C2)',
    white: '#FFFFFF',
    muted: '#64748B',
    danger: 'var(--danger, #DC2626)',
  };

  const dimension = pixelSizes[size] || pixelSizes.md;
  const strokeColor = colors[variant] || colors.primary;

  return (
    <span
      role="status"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg
        className={`spin-animation ${className}`.trim()}
        width={dimension}
        height={dimension}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={strokeColor}
          strokeWidth="3"
          strokeOpacity="0.25"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke={strokeColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </span>
  );
};
