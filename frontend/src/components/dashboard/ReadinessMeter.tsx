import React, { useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ShieldCheck,
  Sliders,
  User,
  FileText,
  Briefcase,
  Sparkles,
  Globe,
} from 'lucide-react';
import type { Profile, Resume } from '../../types/profile';
import type { SearchConfig } from '../../types/job';
import { calculateApplicationReadiness, type ReadinessItem } from '../../utils/readiness';

interface ReadinessMeterProps {
  profile: Profile | null;
  resumes: Resume[];
  searchConfigs: SearchConfig[];
  onNavigateTab: (tab: 'profile' | 'jobs' | 'applications' | 'automation') => void;
}

export const ReadinessMeter: React.FC<ReadinessMeterProps> = ({
  profile,
  resumes,
  searchConfigs,
  onNavigateTab,
}) => {
  // Canonical calculation
  const readiness = useMemo(() => {
    return calculateApplicationReadiness(profile, resumes, searchConfigs);
  }, [profile, resumes, searchConfigs]);

  const { score, level, blockers, items, summaryText } = readiness;

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

  const getCategoryIcon = (category: ReadinessItem['category']) => {
    switch (category) {
      case 'contact':
        return User;
      case 'resume':
        return FileText;
      case 'skills':
        return Sparkles;
      case 'experience':
        return Briefcase;
      case 'preferences':
        return Sliders;
      case 'search':
        return Globe;
      default:
        return ShieldCheck;
    }
  };

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            Application Readiness
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Canonical readiness engine for automated LinkedIn submissions
          </p>
        </div>

        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: levelBg,
            color: levelColor,
            border: `1px solid ${level === 'Ready' ? '#bbf7d0' : level === 'Almost Ready' ? '#fde68a' : 'rgba(220, 38, 38, 0.25)'}`,
          }}
        >
          {level}
        </span>
      </div>

      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Progress Bar & Summary */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Readiness Score
            </span>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: levelColor }}>
              {score}% Ready
            </span>
          </div>

          <div
            style={{
              height: '8px',
              backgroundColor: 'var(--bg-subtle, #f1f5f9)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${score}%`,
                backgroundColor: levelColor,
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.4' }}>
            {summaryText}
          </p>
        </div>

        {/* Blockers Alert if any */}
        {blockers.length > 0 && (
          <div
            style={{
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--danger)', marginBottom: '4px' }}>
              <XCircle size={14} />
              <span>{blockers.length} CRITICAL BLOCKER{blockers.length === 1 ? '' : 'S'}</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.75rem', color: 'var(--danger)' }}>
              {blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Item Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto', maxHeight: '340px' }}>
          {items.map((item) => {
            const Icon = getCategoryIcon(item.category);
            const targetTab = item.category === 'search' ? 'jobs' : 'profile';

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: item.isComplete
                    ? 'var(--bg-subtle, #f8fafc)'
                    : item.isBlocker
                    ? 'rgba(239, 68, 68, 0.05)'
                    : '#fffbeb',
                  border: item.isComplete
                    ? '1px solid var(--border-light)'
                    : item.isBlocker
                    ? '1px solid rgba(239, 68, 68, 0.2)'
                    : '1px solid #fde68a',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: item.isComplete
                        ? 'var(--success-bg)'
                        : item.isBlocker
                        ? 'var(--danger-bg)'
                        : '#fef3c7',
                      color: item.isComplete
                        ? 'var(--success)'
                        : item.isBlocker
                        ? 'var(--danger)'
                        : '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={14} />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.label}
                      </span>
                      {item.isComplete ? (
                        <CheckCircle2 size={13} color="var(--success)" />
                      ) : item.isBlocker ? (
                        <XCircle size={13} color="var(--danger)" />
                      ) : (
                        <AlertTriangle size={13} color="#d97706" />
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.description}
                    </div>
                  </div>
                </div>

                {!item.isComplete && (
                  <button
                    onClick={() => onNavigateTab(targetTab)}
                    className="btn btn-outline"
                    style={{
                      fontSize: '0.72rem',
                      padding: '3px 8px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      minHeight: '30px',
                    }}
                  >
                    <span>Fix</span>
                    <ArrowRight size={11} style={{ marginLeft: '4px' }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Action */}
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
          <button
            onClick={() => onNavigateTab('profile')}
            className="btn btn-secondary"
            style={{ width: '100%', fontSize: '0.82rem', padding: '8px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <span>Open Profile Readiness Center</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
