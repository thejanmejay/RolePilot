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

export const ListCardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: '16px', height: '90px' }}>
          <div className="skeleton" style={{ height: '18px', width: '50%', marginBottom: '10px' }} />
          <div className="skeleton" style={{ height: '14px', width: '35%', marginBottom: '8px' }} />
          <div className="skeleton" style={{ height: '12px', width: '80%' }} />
        </div>
      ))}
    </div>
  );
};

export const DetailPaneSkeleton: React.FC = () => {
  return (
    <div className="card" style={{ padding: '24px' }}>
      <div className="skeleton" style={{ height: '24px', width: '60%', marginBottom: '12px' }} />
      <div className="skeleton" style={{ height: '16px', width: '40%', marginBottom: '20px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        <div className="skeleton" style={{ height: '40px' }} />
        <div className="skeleton" style={{ height: '40px' }} />
      </div>
      <div className="skeleton" style={{ height: '120px', marginBottom: '16px' }} />
      <div className="skeleton" style={{ height: '80px' }} />
    </div>
  );
};
