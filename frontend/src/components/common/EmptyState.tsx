import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  style,
}) => {
  return (
    <div
      className="card"
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        color: 'var(--text-subtle)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <Icon size={44} style={{ opacity: 0.35, marginBottom: '14px', color: 'var(--primary)' }} />
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 6px 0' }}>
        {title}
      </h3>
      <p style={{ fontSize: '0.88rem', maxWidth: '400px', margin: '0 auto 20px auto', lineHeight: '1.5' }}>
        {description}
      </p>

      {(onAction || onSecondaryAction) && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          {onAction && actionText && (
            <button
              type="button"
              onClick={onAction}
              className="btn btn-primary"
              style={{ minHeight: '40px', padding: '0 16px', fontSize: '0.85rem' }}
            >
              {actionText}
            </button>
          )}

          {onSecondaryAction && secondaryActionText && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="btn btn-outline"
              style={{ minHeight: '40px', padding: '0 16px', fontSize: '0.85rem' }}
            >
              {secondaryActionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
