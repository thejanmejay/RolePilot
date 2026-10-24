import React from 'react';

interface CompanyAvatarProps {
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
  isSelected?: boolean;
  style?: React.CSSProperties;
}

export const CompanyAvatar: React.FC<CompanyAvatarProps> = ({
  name,
  size = 'md',
  isSelected = false,
  style,
}) => {
  const initial = (name || 'C').trim().charAt(0).toUpperCase();

  const dimMap = {
    sm: { size: '32px', fontSize: '0.85rem', radius: '6px' },
    md: { size: '40px', fontSize: '1.05rem', radius: '8px' },
    lg: { size: '48px', fontSize: '1.25rem', radius: '10px' },
  };

  const dim = dimMap[size];

  return (
    <div
      style={{
        width: dim.size,
        height: dim.size,
        borderRadius: dim.radius,
        backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-subtle)',
        color: isSelected ? '#ffffff' : 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: dim.fontSize,
        flexShrink: 0,
        border: '1px solid var(--border-light)',
        userSelect: 'none',
        ...style,
      }}
    >
      {initial}
    </div>
  );
};
