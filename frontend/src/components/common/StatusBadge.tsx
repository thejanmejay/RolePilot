import React from 'react';
import {
  getApplicationStatusMeta,
  getRunStatusMeta,
} from '../../utils/status';

interface StatusBadgeProps {
  status?: string | null;
  type?: 'application' | 'run';
  showIcon?: boolean;
  style?: React.CSSProperties;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'application',
  showIcon = true,
  style,
  size = 'md',
}) => {
  const meta = type === 'run' ? getRunStatusMeta(status) : getApplicationStatusMeta(status);
  const Icon = meta.icon;

  const padding = size === 'sm' ? '2px 6px' : '3px 8px';
  const fontSize = size === 'sm' ? '0.7rem' : '0.74rem';
  const iconSize = size === 'sm' ? 10 : 12;

  return (
    <span
      title={meta.description}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding,
        borderRadius: '12px',
        fontSize,
        fontWeight: 600,
        backgroundColor: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.borderColor}`,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        ...style,
      }}
    >
      {showIcon && <Icon size={iconSize} color={meta.color} />}
      <span>{meta.label}</span>
    </span>
  );
};
