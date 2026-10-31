import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from './Skeleton';

export interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: LucideIcon | React.ReactNode;
  iconColor?: string;
  iconBg?: string;
  badge?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  isLoading?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconColor = 'var(--primary)',
  iconBg = 'var(--primary-light)',
  badge,
  trend,
  isLoading = false,
  onClick,
  className = '',
  style,
  ariaLabel,
}) => {
  const isClickable = Boolean(onClick);

  // Check if icon is a component (LucideIcon) or an instantiated element
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComponent = icon as LucideIcon;
    return <IconComponent size={22} />;
  };

  return (
    <div
      className={`card stat-card ${isClickable ? 'card-interactive' : ''} ${className}`.trim()}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel || `${title}: ${value}`}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        padding: '20px 22px',
        marginBottom: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        ...style,
      }}
    >
      {icon && (
        <div
          aria-hidden="true"
          style={{
            width: '46px',
            height: '46px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: iconBg,
            color: iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {renderIcon()}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--text-xs, 0.75rem)',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '4px',
          }}
        >
          {title}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              lineHeight: 1.15,
            }}
          >
            {isLoading ? <Skeleton height={28} width={50} /> : value}
          </div>

          {badge && <div>{badge}</div>}

          {trend && (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: trend.isPositive !== false ? 'var(--success)' : 'var(--danger)',
                backgroundColor: trend.isPositive !== false ? 'var(--success-bg)' : 'var(--danger-bg)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {trend.value}
              {trend.label && (
                <span style={{ fontWeight: 500, opacity: 0.85 }}>{trend.label}</span>
              )}
            </span>
          )}
        </div>

        {subtitle && (
          <div
            style={{
              fontSize: 'var(--text-xs, 0.75rem)',
              color: 'var(--text-muted)',
              marginTop: '4px',
              lineHeight: 1.3,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};
