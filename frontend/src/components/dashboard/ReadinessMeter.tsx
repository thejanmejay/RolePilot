import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
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
import { Badge } from '../common/Badge';

interface ReadinessMeterProps {
  profile: Profile | null;
  resumes: Resume[];
  searchConfigs: SearchConfig[];
  onNavigateTab: (tab: 'profile' | 'jobs' | 'applications' | 'automation') => void;
  onNavigateToSection?: (sectionId: string) => void;
}

export const ReadinessMeter: React.FC<ReadinessMeterProps> = ({
  profile,
  resumes,
  searchConfigs,
  onNavigateTab,
  onNavigateToSection,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'needs_fix'>('all');

  // Single canonical calculation derived from validated data
  const readiness = useMemo(() => {
    return calculateApplicationReadiness(profile, resumes, searchConfigs);
  }, [profile, resumes, searchConfigs]);

  const { score, level, blockers, items, summaryText, completed, total } = readiness;

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

  const handleFixItem = (item: ReadinessItem) => {
    if (item.category === 'search') {
      onNavigateTab('jobs');
      return;
    }

    onNavigateTab('profile');
    if (onNavigateToSection) {
      onNavigateToSection(item.targetSectionId);
    } else {
      setTimeout(() => {
        const el = document.getElementById(item.targetSectionId);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const displayedItems = useMemo(() => {
    if (filterMode === 'needs_fix') {
      return items.filter((i) => !i.isComplete);
    }
    return items;
  }, [items, filterMode]);

  const incompleteCount = items.filter((i) => !i.isComplete).length;

  return (
    <div
      className="card profile-readiness-panel"
      style={{
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px solid var(--border, #E5E7EB)',
        backgroundColor: 'var(--bg-card, #ffffff)',
        overflow: 'hidden',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-light, #f1f5f9)',
          backgroundColor: '#fafbfc',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2
              className="card-title"
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text-main, #111827)',
                margin: 0,
              }}
            >
              Application Readiness
            </h2>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: levelBg,
                color: levelColor,
                border: `1px solid ${levelBorder}`,
              }}
            >
              {level}
            </span>
          </div>
          <p
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted, #64748b)',
              margin: '3px 0 0 0',
            }}
          >
            {summaryText}
          </p>
        </div>

        {/* Score and Metric Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: levelColor,
                lineHeight: 1,
              }}
            >
              {score}%
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
              {completed}/{total} Checks Satisfied
            </div>
          </div>

          {/* Filter Toggle */}
          <div
            style={{
              display: 'inline-flex',
              padding: '2px',
              backgroundColor: '#e2e8f0',
              borderRadius: '8px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              style={{
                padding: '4px 10px',
                fontSize: '0.74rem',
                fontWeight: filterMode === 'all' ? 700 : 500,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: filterMode === 'all' ? '#ffffff' : 'transparent',
                color: filterMode === 'all' ? 'var(--text-main, #111827)' : 'var(--text-muted, #64748b)',
                boxShadow: filterMode === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              All ({total})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('needs_fix')}
              style={{
                padding: '4px 10px',
                fontSize: '0.74rem',
                fontWeight: filterMode === 'needs_fix' ? 700 : 500,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: filterMode === 'needs_fix' ? '#ffffff' : 'transparent',
                color:
                  filterMode === 'needs_fix'
                    ? blockers.length > 0
                      ? 'var(--danger, #dc2626)'
                      : 'var(--text-main, #111827)'
                    : 'var(--text-muted, #64748b)',
                boxShadow: filterMode === 'needs_fix' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Needs Fix ({incompleteCount})
            </button>
          </div>
        </div>
      </div>

      {/* Thin Progress Gauge */}
      <div
        style={{
          height: '4px',
          width: '100%',
          backgroundColor: '#e2e8f0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${score}%`,
            backgroundColor: levelColor,
            transition: 'width 0.4s ease-in-out',
          }}
        />
      </div>

      {/* Critical Blocker Alert (compact inline banner if blockers present) */}
      {blockers.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.06)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
            <XCircle size={15} color="var(--danger, #dc2626)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--danger, #dc2626)' }}>
              {blockers.length} Critical Screening Blocker{blockers.length === 1 ? '' : 's'} Active
            </span>
            <span style={{ fontSize: '0.75rem', color: '#991b1b' }}>
              — Live applications blocked until resolved
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('profile')}
            style={{
              padding: '4px 10px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#ffffff',
              backgroundColor: 'var(--danger, #dc2626)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              minHeight: '28px',
            }}
          >
            <span>Resolve Blockers</span>
            <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Compact Rows Grid */}
      <div
        className="readiness-compact-list"
        style={{
          padding: '12px 16px',
          maxHeight: '320px',
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '8px',
        }}
      >
        {displayedItems.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted, #64748b)',
              fontSize: '0.82rem',
            }}
          >
            <CheckCircle2 size={24} color="var(--success, #16a34a)" style={{ margin: '0 auto 8px auto', display: 'block' }} />
            All screening checks satisfied! Your candidate profile is ready for automated submission.
          </div>
        ) : (
          displayedItems.map((item) => {
            const Icon = getCategoryIcon(item.category);
            const isComplete = item.isComplete;
            const isBlocker = item.isBlocker;

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  backgroundColor: isComplete
                    ? '#f8fafc'
                    : isBlocker
                    ? '#fef2f2'
                    : '#fffbeb',
                  border: isComplete
                    ? '1px solid #e2e8f0'
                    : isBlocker
                    ? '1px solid #fecaca'
                    : '1px solid #fde68a',
                  gap: '8px',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      backgroundColor: isComplete
                        ? 'var(--success-bg, #dcfce7)'
                        : isBlocker
                        ? 'var(--danger-bg, #fee2e2)'
                        : '#fef3c7',
                      color: isComplete
                        ? 'var(--success, #16a34a)'
                        : isBlocker
                        ? 'var(--danger, #dc2626)'
                        : '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={13} />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-main, #111827)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={item.label}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted, #64748b)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={item.description}
                    >
                      {item.description}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {isComplete ? (
                    <Badge variant="success" size="sm">
                      Ready
                    </Badge>
                  ) : isBlocker ? (
                    <Badge variant="danger" size="sm">
                      Blocker
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      Optional
                    </Badge>
                  )}

                  {!isComplete && (
                    <button
                      type="button"
                      onClick={() => handleFixItem(item)}
                      aria-label={`Fix ${item.label}`}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: isBlocker
                          ? '1px solid var(--danger, #dc2626)'
                          : '1px solid #d97706',
                        backgroundColor: '#ffffff',
                        color: isBlocker ? 'var(--danger, #dc2626)' : '#d97706',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        minHeight: '28px',
                      }}
                    >
                      <span>Fix</span>
                      <ArrowRight size={10} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer link to Profile Center */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border-light, #f1f5f9)',
          backgroundColor: '#fafbfc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
          Profile attributes determine candidate eligibility and screening answers.
        </span>
        <button
          type="button"
          onClick={() => onNavigateTab('profile')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary, #1769c2)',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 0',
          }}
        >
          <span>Open Full Profile Setup</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};
