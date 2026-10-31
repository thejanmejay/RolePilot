import type { LucideIcon } from 'lucide-react';
import { TrendingUp } from 'lucide-react';
import { Skeleton } from '../common';

interface DashboardMetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  trendText?: string;
  trendLabel?: string;
  isLoading?: boolean;
  onClick?: () => void;
}

export const DashboardMetricCard: React.FC<DashboardMetricCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  trendText,
  trendLabel = 'This week',
  isLoading = false,
  onClick,
}) => {
  return (
    <div
      className="dashboard-kpi-card"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
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
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '20px 22px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.18s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div
        style={{
          width: '46px',
          height: '46px',
          borderRadius: '10px',
          backgroundColor: iconBg,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={22} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
          {title}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>
            {isLoading ? <Skeleton height={28} width={50} /> : value}
          </div>

          {trendText ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#16A34A',
                  backgroundColor: '#DCFCE7',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <TrendingUp size={11} />
                {trendText}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {trendLabel}
              </span>
            </div>
          ) : trendLabel ? (
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {trendLabel}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
