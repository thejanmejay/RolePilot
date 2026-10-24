import React from 'react';

export const Skeleton: React.FC<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}> = ({ width = '100%', height = '16px', borderRadius, style }) => {
  return (
    <div
      className="skeleton"
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: borderRadius ? (typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius) : undefined,
        ...style,
      }}
    />
  );
};

export const ProfileHeaderSkeleton: React.FC = () => {
  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
        <div className="skeleton" style={{ width: '96px', height: '96px', borderRadius: '50%' }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: '220px', height: '28px', marginBottom: '12px' }} />
          <div className="skeleton" style={{ width: '380px', height: '18px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ width: '160px', height: '14px', marginBottom: '16px' }} />
          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="skeleton" style={{ width: '120px', height: '36px', borderRadius: '9999px' }} />
            <div className="skeleton" style={{ width: '100px', height: '36px', borderRadius: '9999px' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const SectionSkeleton: React.FC = () => {
  return (
    <div className="card">
      <div className="card-header">
        <div className="skeleton" style={{ width: '180px', height: '24px' }} />
        <div className="skeleton" style={{ width: '80px', height: '32px', borderRadius: '9999px' }} />
      </div>
      <div className="card-body">
        <div className="skeleton" style={{ width: '100%', height: '18px', marginBottom: '12px' }} />
        <div className="skeleton" style={{ width: '85%', height: '18px', marginBottom: '12px' }} />
        <div className="skeleton" style={{ width: '60%', height: '18px' }} />
      </div>
    </div>
  );
};
