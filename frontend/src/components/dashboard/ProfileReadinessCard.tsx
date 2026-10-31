import React from 'react';
import { ArrowRight, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import type { Profile, Resume } from '../../types/profile';
import type { SearchConfig } from '../../types/job';
import { calculateApplicationReadiness, type ReadinessItem } from '../../utils/readiness';

interface ProfileReadinessCardProps {
  profile: Profile | null;
  resumes: Resume[];
  searchConfigs: SearchConfig[];
  onNavigateProfile: () => void;
  onNavigateSection?: (sectionId: string) => void;
}

export const ProfileReadinessCard: React.FC<ProfileReadinessCardProps> = ({
  profile,
  resumes,
  searchConfigs,
  onNavigateProfile,
  onNavigateSection,
}) => {
  const readiness = calculateApplicationReadiness(profile, resumes, searchConfigs);
  const { score, level, items } = readiness;

  const scoreColor = score >= 85 ? '#16A34A' : score >= 60 ? '#D97706' : '#DC2626';

  const handleItemClick = (item: ReadinessItem) => {
    onNavigateProfile();
    if (onNavigateSection && item.targetSectionId) {
      onNavigateSection(item.targetSectionId);
    } else if (item.targetSectionId) {
      setTimeout(() => {
        const el = document.getElementById(item.targetSectionId);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <div
      className="card profile-readiness-card"
      style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '20px 22px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
          Profile Readiness
        </h2>
        <button
          type="button"
          onClick={onNavigateProfile}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--primary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: 0,
          }}
        >
          <span>Open Full Profile</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Main Body: Gauge on Left, Checklist on Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, flexWrap: 'wrap' }}>
        {/* Circular Progress Gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, margin: '0 auto' }}>
          <div
            style={{
              position: 'relative',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: `conic-gradient(${scoreColor} ${score * 3.6}deg, #E2E8F0 0deg)`,
              padding: '8px',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
                {score}%
              </span>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: scoreColor, marginTop: '2px' }}>
                {level}
              </span>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>
            {score >= 85
              ? 'Profile is fully prepared for automation runs'
              : 'Complete a few items to enable live submissions'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                onClick={() => (!item.isComplete ? handleItemClick(item) : undefined)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  fontSize: '0.78rem',
                  color: item.isComplete ? 'var(--text-muted)' : '#B45309',
                  cursor: !item.isComplete ? 'pointer' : 'default',
                  padding: '2px 0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {item.isComplete ? (
                    <CheckCircle2 size={15} color="#16A34A" style={{ flexShrink: 0 }} />
                  ) : (
                    <AlertCircle size={15} color="#D97706" style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ fontWeight: item.isComplete ? 500 : 600 }}>
                    {item.label}
                  </span>
                </div>

                {!item.isComplete && (
                  <ChevronRight size={13} color="#D97706" style={{ flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
