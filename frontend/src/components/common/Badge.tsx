import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
  className = '',
  style,
  ...rest
}) => {
  const paddingBySize: Record<string, string> = {
    sm: '2px 6px',
    md: '3px 8px',
    lg: '4px 10px',
  };

  const fontSizeBySize: Record<string, string> = {
    sm: '0.7rem',
    md: '0.75rem',
    lg: '0.8rem',
  };
  const stylesByVariant: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--primary-light)',
      color: 'var(--primary)',
      border: '1px solid var(--primary-border)',
    },
    success: {
      backgroundColor: 'var(--success-bg)',
      color: 'var(--success)',
      border: '1px solid var(--success-border)',
    },
    warning: {
      backgroundColor: 'var(--warning-bg)',
      color: 'var(--warning)',
      border: '1px solid var(--warning-border)',
    },
    danger: {
      backgroundColor: 'var(--danger-bg)',
      color: 'var(--danger)',
      border: '1px solid var(--danger-border)',
    },
    info: {
      backgroundColor: 'var(--info-bg)',
      color: 'var(--info)',
      border: '1px solid var(--primary-border)',
    },
    neutral: {
      backgroundColor: 'var(--bg-subtle)',
      color: 'var(--text-muted)',
      border: '1px solid var(--border-light)',
    },
    purple: {
      backgroundColor: '#F3E8FF',
      color: '#7E22CE',
      border: '1px solid #E9D5FF',
    },
  };

  return (
    <span
      className={`badge badge-${variant} badge-${size} ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: paddingBySize[size],
        borderRadius: 'var(--radius-full)',
        fontSize: fontSizeBySize[size],
        fontWeight: 700,
        lineHeight: 1.2,
        ...stylesByVariant[variant],
        ...style,
      }}
      {...rest}
    >
      {icon && <span aria-hidden="true" style={{ display: 'inline-flex' }}>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
