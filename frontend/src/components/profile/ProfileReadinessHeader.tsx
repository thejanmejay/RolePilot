import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { ApplicationReadiness } from '../../utils/readiness';

interface ProfileReadinessHeaderProps {
  readiness: ApplicationReadiness;
  onNavigateToSection?: (sectionId: string) => void;
  onNavigateTab?: (tab: 'jobs' | 'automation') => void;
}

export const ProfileReadinessHeader: React.FC<ProfileReadinessHeaderProps> = ({
  readiness,
  onNavigateToSection,
  onNavigateTab,
}) => {
  const { score, level, ready, blockers, warnings, items } = readiness;

  const scrollToFirstBlocker = () => {
    const firstIncomplete = items.find((i) => !i.isComplete && i.isBlocker);
    if (firstIncomplete) {
      if (firstIncomplete.category === 'search' && onNavigateTab) {
        onNavigateTab('jobs');
        return;
      }
      if (onNavigateToSection) {
        onNavigateToSection(firstIncomplete.targetSectionId);
      } else {
        const el = document.getElementById(firstIncomplete.targetSectionId);
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const levelColor =
    level === 'Ready'
      ? 'var(--success)'
      : level === 'Almost Ready'
      ? '#d97706'
      : 'var(--danger)';

  const levelBg =
    level === 'Ready'
      ? 'var(--success-bg)'
      : level === 'Almost Ready'
      ? '#fef3c7'
      : 'var(--danger-bg)';

  const levelBorder =
    level === 'Ready'
      ? '#bbf7d0'
      : level === 'Almost Ready'
      ? '#fde68a'
      : 'rgba(220, 38, 38, 0.25)';

  return (
    <div
      className="card"
      style={{
        padding: '24px',
        marginBottom: '24px',
        border: `1px solid ${levelBorder}`,
        background: `linear-gradient(180deg, ${levelBg} 0%, var(--bg-card) 60%)`,
      }}
    >
      {/* Top Header: Title + Readiness Score Gauge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: levelColor,
                backgroundColor: levelBg,
                border: `1px solid ${levelBorder}`,
                padding: '2px 8px',
                borderRadius: '12px',
              }}
            >
              {level}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Source-of-truth configuration layer for RolePilot
            </span>
          </div>

          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
              margin: '4px 0 6px 0',
            }}
          >
            Application Readiness
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '580px', lineHeight: 1.45 }}>
            {readiness.summaryText}
          </p>
        </div>

        {/* Big Score Callout */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '12px 20px',
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            border: `1px solid ${levelBorder}`,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div>
            <div style={{ fontSize: '2.1rem', fontWeight: 900, color: levelColor, lineHeight: 1 }}>
              {score}%
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Readiness Score
            </div>
          </div>

          <div style={{ width: '1px', height: '40px', backgroundColor: 'var(--border-light)' }} />

          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {readiness.completed}/{readiness.total}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>Checks Satisfied</div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: 'var(--border-light)',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${score}%`,
            backgroundColor: levelColor,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Categorical Checklist Pills */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: '8px',
          marginBottom: '20px',
        }}
      >
        {items.map((item) => {
          const isComplete = item.isComplete;
          const isBlocker = item.isBlocker;

          return (
            <div
              key={item.id}
              onClick={() => {
                if (item.category === 'search' && onNavigateTab) {
                  onNavigateTab('jobs');
                  return;
                }
                if (onNavigateToSection) {
                  onNavigateToSection(item.targetSectionId);
                } else {
                  const el = document.getElementById(item.targetSectionId);
                  el?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isComplete ? 'rgba(5, 118, 66, 0.06)' : isBlocker ? 'rgba(204, 16, 22, 0.06)' : '#fffbeb',
                border: `1px solid ${isComplete ? '#bbf7d0' : isBlocker ? '#fecaca' : '#fde68a'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={`Click to jump to ${item.label}`}
            >
              {isComplete ? (
                <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0 }} />
              ) : isBlocker ? (
                <XCircle size={16} color="var(--danger)" style={{ flexShrink: 0 }} />
              ) : (
                <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
              )}

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: isComplete ? 'var(--text-main)' : isBlocker ? 'var(--danger)' : '#92400e',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Blockers & Fix Action Bar */}
      {blockers.length > 0 && (
        <div
          style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <XCircle size={20} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--danger)', marginBottom: '2px' }}>
                {blockers.length} Critical Automation {blockers.length === 1 ? 'Blocker' : 'Blockers'}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#7f1d1d', lineHeight: 1.35 }}>
                {blockers.join(' · ')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={scrollToFirstBlocker}
            className="btn btn-primary"
            style={{
              backgroundColor: 'var(--danger)',
              borderColor: 'var(--danger)',
              fontSize: '0.82rem',
              padding: '6px 14px',
              minHeight: '38px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Fix {blockers.length === 1 ? '1 Blocker' : `${blockers.length} Blockers`}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Warnings Bar (if no blockers, but warnings exist) */}
      {blockers.length === 0 && warnings.length > 0 && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', color: '#92400e' }}>
              <strong>Recommended enhancements:</strong> {warnings.join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Success Ready Bar */}
      {ready && (
        <div
          style={{
            backgroundColor: '#dcfce7',
            border: '1px solid #bbf7d0',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="var(--success)" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.84rem', color: '#14532d', fontWeight: 600 }}>
              All core criteria satisfied. Automation engine is fully unlocked for safe Dry-Runs and Live Submissions.
            </div>
          </div>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('automation')}
              className="btn btn-primary"
              style={{
                fontSize: '0.82rem',
                padding: '6px 14px',
                minHeight: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Zap size={14} />
              <span>Go to Automation</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
