import React from 'react';
import { Sparkles } from 'lucide-react';

export type MatchTier = 'Strong Match' | 'Good Match' | 'Partial Match' | 'General Fit';

interface MatchBadgeProps {
  tier?: MatchTier;
  score?: number;
  matchedCount?: number;
  totalSkills?: number;
  style?: React.CSSProperties;
  size?: 'sm' | 'md';
}

export const MatchBadge: React.FC<MatchBadgeProps> = ({
  tier,
  score,
  matchedCount,
  totalSkills,
  style,
  size = 'md',
}) => {
  // Derive tier if not explicitly provided
  let resolvedTier: MatchTier = tier || 'General Fit';
  if (!tier && score !== undefined) {
    if (score >= 70) resolvedTier = 'Strong Match';
    else if (score >= 45) resolvedTier = 'Good Match';
    else if (score >= 20) resolvedTier = 'Partial Match';
    else resolvedTier = 'General Fit';
  }

  const metaMap: Record<MatchTier, { color: string; bg: string; borderColor: string }> = {
    'Strong Match': { color: '#15803d', bg: '#dcfce7', borderColor: '#bbf7d0' },
    'Good Match': { color: '#0369a1', bg: '#e0f2fe', borderColor: '#bae6fd' },
    'Partial Match': { color: '#b45309', bg: '#fef3c7', borderColor: '#fde68a' },
    'General Fit': { color: '#64748b', bg: '#f1f5f9', borderColor: '#e2e8f0' },
  };

  const meta = metaMap[resolvedTier];
  const padding = size === 'sm' ? '2px 6px' : '3px 8px';
  const fontSize = size === 'sm' ? '0.7rem' : '0.74rem';
  const iconSize = size === 'sm' ? 10 : 11;

  let countSuffix = '';
  if (matchedCount !== undefined) {
    countSuffix = totalSkills ? `(${matchedCount}/${totalSkills})` : `(${matchedCount} skill${matchedCount === 1 ? '' : 's'})`;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding,
        borderRadius: '12px',
        fontSize,
        fontWeight: 700,
        backgroundColor: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.borderColor}`,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        ...style,
      }}
    >
      <Sparkles size={iconSize} />
      <span>{resolvedTier}</span>
      {countSuffix && <span style={{ opacity: 0.85, fontWeight: 600 }}>{countSuffix}</span>}
    </span>
  );
};
