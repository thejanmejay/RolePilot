import React from 'react';
import {
  MapPin,
  Calendar,
  DollarSign,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { Job } from '../../types/job';
import type { Application } from '../../api/applications';
import {
  analyzeJobQualification,
  formatSalary,
  formatJobDate,
  isJobEasyApply,
  getJobWorkMode,
} from '../../utils/jobHelpers';
import { CompanyAvatar } from '../common';
import type { Profile } from '../../types/profile';

interface JobCardProps {
  job: Job;
  isSelected: boolean;
  onSelect: () => void;
  profile: Profile | null;
  application?: Application | null;
  onToggleSave?: (e: React.MouseEvent) => void;
  isChecked?: boolean;
  onToggleCheck?: (e: React.MouseEvent | React.ChangeEvent) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  isSelected,
  onSelect,
  profile,
  application,
  onToggleSave,
  isChecked = false,
  onToggleCheck,
}) => {
  const qualification = analyzeJobQualification(job, profile);
  const salaryStr = formatSalary(job.salary_min, job.salary_max);
  const postedDate = formatJobDate(job.posted_at || job.created_at);
  const easyApply = isJobEasyApply(job);
  const workMode = getJobWorkMode(job);

  // Application status
  const isApplied = application?.status === 'applied' || application?.status === 'submitted';
  const isSaved = application?.status === 'saved' || (!isApplied && Boolean(application));

  return (
    <div
      onClick={onSelect}
      className="card"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        padding: '16px',
        marginBottom: '12px',
        cursor: 'pointer',
        border: isChecked
          ? '2px solid var(--primary)'
          : isSelected
          ? '2px solid var(--primary-border)'
          : '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        boxShadow: isChecked
          ? '0 4px 12px rgba(23, 105, 194, 0.15)'
          : isSelected
          ? '0 4px 12px rgba(37, 99, 235, 0.08)'
          : '0 1px 3px rgba(0,0,0,0.03)',
        transition: 'all 0.15s ease',
        backgroundColor: isChecked ? '#f0f7ff' : isSelected ? '#f8fafc' : '#ffffff',
        position: 'relative',
        outline: 'none',
      }}
    >
      {/* Top Header: Checkbox + Company Avatar + Title + Bookmark */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
        {onToggleCheck && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', paddingTop: '4px' }}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => onToggleCheck(e)}
              aria-label={`Select ${job.title} for queue`}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: 'var(--primary)',
              }}
            />
          </div>
        )}

        <CompanyAvatar name={job.company} size="md" />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '8px',
            }}
          >
            <h3
              style={{
                fontSize: '0.98rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                margin: '0 0 4px 0',
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                wordBreak: 'break-word',
              }}
            >
              {job.title}
            </h3>

            {onToggleSave && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave(e);
                }}
                className="btn-icon"
                style={{
                  color: isSaved ? 'var(--primary)' : 'var(--text-subtle)',
                  padding: '4px',
                  minHeight: '32px',
                  minWidth: '32px',
                }}
                title={isSaved ? 'Remove from Saved' : 'Save Job'}
              >
                <Bookmark size={16} fill={isSaved ? 'var(--primary)' : 'none'} />
              </button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{job.company}</span>
            {job.location && (
              <>
                <span style={{ color: 'var(--border-subtle)' }}>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.8rem' }}>
                  <MapPin size={12} />
                  <span>{job.location}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Badges Bar: Match Tier + Easy Apply + Work Mode + Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'wrap',
          margin: '10px 0',
        }}
      >
        {/* Match Tier Badge */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.74rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: qualification.matchTier.bg,
            color: qualification.matchTier.color,
            border: `1px solid ${qualification.matchTier.borderColor}`,
          }}
        >
          <Sparkles size={11} />
          <span>{qualification.matchTier.label}</span>
          {qualification.matchedSkills.length > 0 && (
            <span style={{ opacity: 0.85, fontWeight: 600 }}>({qualification.matchedSkills.length} skills)</span>
          )}
        </span>

        {/* Easy Apply Badge */}
        {easyApply ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              border: '1px solid #bbf7d0',
            }}
          >
            <Zap size={11} fill="#15803d" />
            Easy Apply
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-subtle)',
              border: '1px solid var(--border-light)',
            }}
          >
            External
          </span>
        )}

        {/* Work mode badge */}
        {workMode !== 'Not specified' && (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: workMode === 'Remote' ? '#eff6ff' : 'var(--bg-subtle)',
              color: workMode === 'Remote' ? '#1d4ed8' : 'var(--text-muted)',
              border: '1px solid var(--border-light)',
            }}
          >
            {workMode}
          </span>
        )}

        {/* Application Status Badge */}
        {isApplied ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: '#dcfce7',
              color: '#15803d',
            }}
          >
            <CheckCircle2 size={11} />
            Applied
          </span>
        ) : isSaved ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
            }}
          >
            Saved Shortlist
          </span>
        ) : null}
      </div>

      {/* Salary & Relative Date Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-light)',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {salaryStr ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#15803d', fontWeight: 700 }}>
              <DollarSign size={13} />
              <span>{salaryStr}</span>
            </div>
          ) : (
            <span style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>Salary undisclosed</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Calendar size={12} />
            <span>{postedDate}</span>
          </div>

          {job.job_url && (
            <a
              href={job.job_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="btn-icon"
              style={{
                padding: '4px',
                color: 'var(--text-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              title="Open LinkedIn Job"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
