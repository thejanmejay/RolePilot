import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  ExternalLink,
  DollarSign,
  Briefcase,
  Sparkles,
  CheckCircle2,
  Bookmark,
  Bot,
  Layers,
  ArrowLeft,
  Zap,
  Check,
  HelpCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import type { Job } from '../../types/job';
import type { Profile } from '../../types/profile';
import type { Application } from '../../api/applications';
import {
  analyzeJobQualification,
  formatSalary,
  formatJobDate,
  isJobEasyApply,
  getJobWorkMode,
} from '../../utils/jobHelpers';
import { jobsApi } from '../../api/jobs';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';

interface JobDetailsPanelProps {
  job: Job | null;
  profile: Profile | null;
  application?: Application | null;
  onToggleSave?: () => void;
  onCloseMobile?: () => void;
  onNavigateToApplications?: (applicationId?: string) => void;
  onNavigateToRun?: (runId: string) => void;
}

export const JobDetailsPanel: React.FC<JobDetailsPanelProps> = ({
  job,
  profile,
  application,
  onToggleSave,
  onCloseMobile,
  onNavigateToApplications,
  onNavigateToRun,
}) => {
  const { showSuccess, showError } = useToast();
  const [isRunningDryTest, setIsRunningDryTest] = useState(false);

  if (!job) {
    return (
      <div
        className="card"
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          color: 'var(--text-subtle)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Layers size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Select a job to view qualification & details
        </h3>
        <p style={{ fontSize: '0.85rem', maxWidth: '320px', marginTop: '6px' }}>
          Evaluate skills alignment, Easy Apply compatibility, and automation readiness.
        </p>
      </div>
    );
  }

  const qualification = analyzeJobQualification(job, profile);
  const salaryStr = formatSalary(job.salary_min, job.salary_max);
  const postedDate = formatJobDate(job.posted_at || job.created_at);
  const easyApply = isJobEasyApply(job);
  const workMode = getJobWorkMode(job);

  const isApplied = application?.status === 'applied' || application?.status === 'submitted';
  const isSaved = application?.status === 'saved' || (!isApplied && Boolean(application));

  const handleRunDryTest = async () => {
    setIsRunningDryTest(true);
    try {
      const res = await jobsApi.triggerAutomationRun({
        max_jobs: 1,
        dry_run: true,
        auto_apply: false,
      });
      showSuccess('Dry Run initiated in background! Check Automation Run details.');
      if (res && (res as any).id && onNavigateToRun) {
        onNavigateToRun((res as any).id);
      }
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsRunningDryTest(false);
    }
  };

  return (
    <div
      className="card detail-pane-scroll"
      style={{
        padding: '24px',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Mobile Back Button Bar (visible <= 768px) */}
      {onCloseMobile && (
        <div
          className="mobile-only"
          style={{
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          <button
            onClick={onCloseMobile}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              padding: '8px 14px',
              minHeight: '44px',
              width: '100%',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Jobs Feed</span>
          </button>
        </div>
      )}

      {/* Badges row: Easy Apply + Work Mode + Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        {easyApply ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '12px',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              border: '1px solid #bbf7d0',
            }}
          >
            <Zap size={12} fill="#15803d" />
            Easy Apply Supported
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              padding: '3px 10px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-subtle)',
              border: '1px solid var(--border-light)',
            }}
          >
            External Application
          </span>
        )}

        {workMode !== 'Not specified' && (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '12px',
              backgroundColor: workMode === 'Remote' ? '#eff6ff' : 'var(--bg-subtle)',
              color: workMode === 'Remote' ? '#1d4ed8' : 'var(--text-muted)',
              border: '1px solid var(--border-light)',
            }}
          >
            {workMode}
          </span>
        )}

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '12px',
            backgroundColor: qualification.matchTier.bg,
            color: qualification.matchTier.color,
            border: `1px solid ${qualification.matchTier.borderColor}`,
          }}
        >
          <Sparkles size={12} />
          {qualification.matchTier.label}
        </span>
      </div>

      {/* Header Info */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              margin: '0 0 6px 0',
              lineHeight: 1.3,
            }}
          >
            {job.title}
          </h2>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.95rem',
              color: 'var(--text-muted)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-main)', fontWeight: 600 }}>
              <Building2 size={16} color="var(--primary)" />
              <span>{job.company}</span>
            </div>
            {job.location && (
              <>
                <span style={{ color: 'var(--border-subtle)' }}>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={14} />
                  <span>{job.location}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {onToggleSave && (
          <button
            onClick={onToggleSave}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '40px',
              padding: '0 14px',
            }}
            title={isSaved ? 'Remove Bookmark' : 'Save Job'}
          >
            <Bookmark
              size={16}
              fill={isSaved ? 'var(--primary)' : 'none'}
              color={isSaved ? 'var(--primary)' : 'currentColor'}
            />
            <span style={{ fontSize: '0.85rem' }}>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        )}
      </div>

      {/* Application Status Banner */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '18px',
          backgroundColor: isApplied
            ? 'rgba(22, 163, 74, 0.08)'
            : isSaved
            ? 'rgba(37, 99, 235, 0.06)'
            : 'var(--bg-subtle)',
          border: isApplied
            ? '1px solid rgba(22, 163, 74, 0.25)'
            : isSaved
            ? '1px solid rgba(37, 99, 235, 0.2)'
            : '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isApplied ? (
              <CheckCircle2 size={18} color="#16a34a" />
            ) : isSaved ? (
              <Bookmark size={18} color="var(--primary)" fill="var(--primary)" />
            ) : (
              <Clock size={18} color="var(--text-subtle)" />
            )}

            <div style={{ fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                {isApplied
                  ? 'Applied via Easy Apply'
                  : isSaved
                  ? 'Saved in Shortlist'
                  : 'Not Applied Yet'}
              </span>
              <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                {isApplied
                  ? 'Telemetry and answers tracked in your Applications pipeline.'
                  : isSaved
                  ? 'Ready for automated qualification and dry testing.'
                  : 'Explore qualification before queuing automated submission.'}
              </span>
            </div>
          </div>

          {isApplied && onNavigateToApplications && (
            <button
              onClick={() => onNavigateToApplications(application?.id)}
              className="btn btn-outline"
              style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>View Application</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Snapshot Attributes Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
          padding: '12px',
          backgroundColor: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          fontSize: '0.85rem',
        }}
      >
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
            Salary
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#15803d', fontWeight: 700, marginTop: '2px' }}>
            <DollarSign size={14} />
            <span>{salaryStr || 'Undisclosed'}</span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
            Job Type
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, marginTop: '2px' }}>
            <Briefcase size={14} color="var(--primary)" />
            <span>{job.employment_type || 'Full-time'}</span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
            Experience
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, marginTop: '2px' }}>
            <Layers size={14} color="var(--primary)" />
            <span>{job.experience_level || 'Mid-Senior level'}</span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
            Posted Date
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, marginTop: '2px' }}>
            <Clock size={14} color="var(--text-subtle)" />
            <span>{postedDate}</span>
          </div>
        </div>
      </div>

      {/* "Why this job?" Qualification Intelligence Card */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Sparkles size={18} color="var(--primary)" />
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Why this job? (Qualification Analysis)
          </h3>
        </div>

        {/* Evidence reasons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {qualification.whyThisJobReasons.map((reason, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.84rem' }}>
              <Check size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ color: 'var(--text-main)', lineHeight: '1.4' }}>{reason}</span>
            </div>
          ))}
        </div>

        {/* Potential gaps */}
        {qualification.potentialGaps.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
              Potential Gaps & Considerations:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
              {qualification.potentialGaps.map((gap, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.82rem' }}>
                  <span style={{ color: '#b45309', fontWeight: 700 }}>•</span>
                  <span style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>{gap}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Skills Breakdown */}
      <div style={{ marginBottom: '22px' }}>
        <h3
          style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <HelpCircle size={16} color="var(--primary)" />
          <span>Candidate Profile Skills ({profile?.skills?.length || 0})</span>
        </h3>

        {qualification.matchedSkills.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Skills Mentioned in Vacancy ({qualification.matchedSkills.length}):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              {qualification.matchedSkills.map((sk) => (
                <span
                  key={sk}
                  style={{
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <CheckCircle2 size={12} />
                  <span>{sk}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {qualification.missingSkills.length > 0 && (
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
              Other Candidate Skills ({qualification.missingSkills.length}):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              {qualification.missingSkills.map((sk) => (
                <span
                  key={sk}
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-muted)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  {sk}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons: Open LinkedIn + Run Dry Test (NO direct live-submit!) */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '22px',
        }}
      >
        <a
          href={job.job_url}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary"
          style={{
            flex: '1 1 180px',
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '0.88rem',
          }}
        >
          <span>Open on LinkedIn</span>
          <ExternalLink size={15} />
        </a>

        <button
          onClick={handleRunDryTest}
          disabled={isRunningDryTest}
          className="btn btn-outline"
          style={{
            minHeight: '44px',
            padding: '0 16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
          }}
          title="Simulate Easy Apply modal navigation and form-fill without submitting"
        >
          <Bot size={16} />
          <span>{isRunningDryTest ? 'Simulating...' : 'Run Dry Test'}</span>
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.75rem',
          color: 'var(--text-subtle)',
          marginBottom: '20px',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <ShieldCheck size={14} color="#16a34a" />
        <span>Triple-Key Guard: Live submissions can only be authorized via Automation Controls.</span>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '16px 0' }} />

      {/* Formatted Job Description */}
      <div>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>
          Job Description
        </h3>

        <div
          style={{
            fontSize: '0.88rem',
            lineHeight: '1.65',
            color: 'var(--text-main)',
            whiteSpace: 'pre-line',
            backgroundColor: 'var(--bg-subtle)',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            maxHeight: '380px',
            overflowY: 'auto',
          }}
        >
          {job.description || 'No detailed description available for this vacancy.'}
        </div>
      </div>
    </div>
  );
};
