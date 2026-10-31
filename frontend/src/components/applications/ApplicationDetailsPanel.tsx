import React, { useEffect, useState } from 'react';
import {
  Building2,
  MapPin,
  ExternalLink,
  Calendar,
  Sparkles,
  Bot,
  Clock,
  Edit3,
  Trash2,
  X,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Info,
  Briefcase,
} from 'lucide-react';
import { applicationsApi, type Application, type ApplicationAnswer } from '../../api/applications';
import { StatusBadge } from './StatusBadge';
import { ApplicationAnswersViewer } from './ApplicationAnswersViewer';
import { calculateJobMatch } from '../../utils/matching';
import type { Skill } from '../../types/profile';

interface ApplicationDetailsPanelProps {
  application: Application | null;
  candidateSkills: Skill[];
  onClose: () => void;
  onChangeStatus: (app: Application) => void;
  onDelete: (app: Application) => void;
  onNavigateToRun?: (runId: string) => void;
  onNavigateToJobs?: () => void;
}

export const ApplicationDetailsPanel: React.FC<ApplicationDetailsPanelProps> = ({
  application,
  candidateSkills,
  onClose,
  onChangeStatus,
  onDelete,
  onNavigateToRun,
  onNavigateToJobs,
}) => {
  const [extraAnswers, setExtraAnswers] = useState<ApplicationAnswer[]>([]);
  const [isLoadingAnswers, setIsLoadingAnswers] = useState(false);

  // Fetch full details with answers when application changes and answers are not loaded
  useEffect(() => {
    let isCancelled = false;
    if (application?.id && (!application.answers || application.answers.length === 0)) {
      setIsLoadingAnswers(true);
      applicationsApi
        .getApplicationById(application.id)
        .then((detailed) => {
          if (!isCancelled && detailed?.answers) {
            setExtraAnswers(detailed.answers);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!isCancelled) setIsLoadingAnswers(false);
        });
    } else {
      setExtraAnswers([]);
    }

    return () => {
      isCancelled = true;
    };
  }, [application?.id, application?.answers]);

  if (!application) return null;

  const job = application.job;
  const matchAnalysis = job ? calculateJobMatch(job, candidateSkills) : { matchScore: 0, matchedSkills: [], missingSkills: [] };
  const displayAnswers = application.answers && application.answers.length > 0 ? application.answers : extraAnswers;

  const appliedDate = application.submitted_at
    ? new Date(application.submitted_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : application.created_at
    ? new Date(application.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Not available';

  const savedDate = application.created_at
    ? new Date(application.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Not available';

  const statusNorm = (application.status || '').toLowerCase();
  const isApplied = statusNorm === 'applied' || statusNorm === 'submitted';
  const isFailed = statusNorm === 'failed';
  const isSkipped = statusNorm === 'skipped';
  const isRejected = statusNorm === 'rejected';

  // Lifecycle steps determination
  const steps = [
    { label: 'Discovered', completed: true },
    { label: 'Match Evaluated', completed: matchAnalysis.matchScore >= 0 },
    { label: 'Easy Apply Modal', completed: isApplied || application.run_id !== null },
    { label: 'Form Filled', completed: displayAnswers.length > 0 || isApplied },
    { label: 'Review Passed', completed: isApplied },
    { label: 'Submission Confirmed', completed: isApplied },
  ];

  return (
    <div
      className="card detail-pane-scroll"
      style={{
        padding: '20px',
        position: 'relative',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Mobile Back Button Bar (visible <= 768px) */}
      <div
        className="mobile-only"
        style={{
          marginBottom: '14px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        <button
          onClick={onClose}
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
          <span>Back to Applications</span>
        </button>
      </div>

      {/* Header controls & Close icon */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <StatusBadge status={application.status} />
            {application.run_id && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#f3e8ff',
                  color: '#7e22ce',
                }}
              >
                <Bot size={11} />
                Autonomous Engine
              </span>
            )}
          </div>

          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              margin: '0 0 6px 0',
              lineHeight: 1.3,
            }}
          >
            {job?.title || 'Application Details'}
          </h2>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.9rem',
              color: 'var(--text-muted)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-main)', fontWeight: 600 }}>
              <Building2 size={15} color="var(--primary)" />
              <span>{job?.company || 'Company Not Available'}</span>
            </div>
            {job?.location && (
              <>
                <span style={{ color: 'var(--border-subtle)' }}>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={13} />
                  <span>{job.location}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Desktop Close button */}
        <button
          onClick={onClose}
          className="btn-icon desktop-only"
          style={{ padding: '6px', color: 'var(--text-muted)' }}
          title="Close details panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Action Buttons Row */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '18px',
        }}
      >
        <button
          onClick={() => onChangeStatus(application)}
          className="btn btn-primary"
          style={{
            flex: '1 1 140px',
            minHeight: '40px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '0.85rem',
          }}
        >
          <Edit3 size={14} />
          <span>Update Status</span>
        </button>

        {job?.job_url && (
          <a
            href={job.job_url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
            style={{
              minHeight: '40px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              padding: '0 12px',
            }}
          >
            <span>LinkedIn Job</span>
            <ExternalLink size={13} />
          </a>
        )}

        {onNavigateToJobs && (
          <button
            type="button"
            onClick={onNavigateToJobs}
            className="btn btn-outline"
            style={{
              minHeight: '40px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              padding: '0 12px',
            }}
          >
            <Briefcase size={14} />
            <span>Jobs Explorer</span>
          </button>
        )}

        <button
          onClick={() => onDelete(application)}
          className="btn btn-secondary"
          style={{
            minHeight: '40px',
            color: 'var(--danger)',
            padding: '0 12px',
          }}
          title="Delete application"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Truthful "Why?" & Lifecycle State Banner */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '18px',
          backgroundColor: isApplied
            ? 'rgba(22, 163, 74, 0.08)'
            : isFailed || isRejected
            ? 'rgba(220, 38, 38, 0.08)'
            : isSkipped
            ? 'rgba(217, 119, 6, 0.08)'
            : 'var(--bg-subtle)',
          border: isApplied
            ? '1px solid rgba(22, 163, 74, 0.25)'
            : isFailed || isRejected
            ? '1px solid rgba(220, 38, 38, 0.25)'
            : isSkipped
            ? '1px solid rgba(217, 119, 6, 0.25)'
            : '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          {isApplied ? (
            <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
          ) : isFailed || isRejected ? (
            <XCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
          ) : isSkipped ? (
            <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
          ) : (
            <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          )}

          <div style={{ flex: 1, fontSize: '0.84rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '2px' }}>
              {isApplied
                ? 'Application Verified & Submitted'
                : isFailed
                ? 'Submission Failed'
                : isSkipped
                ? 'Application Skipped'
                : isRejected
                ? 'Application Not Selected'
                : 'Shortlisted Application'}
            </div>
            <div style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>
              {application.error_message ? (
                <span>{application.error_message}</span>
              ) : isApplied ? (
                <span>Submitted autonomously via LinkedIn Easy Apply with full telemetry verification.</span>
              ) : isSkipped ? (
                <span>Skipped based on qualification evaluation or Easy Apply configuration.</span>
              ) : (
                <span>Saved in shortlist. Ready to be targeted in automation runs.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Application Lifecycle Step Rail */}
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-subtle)',
            marginBottom: '10px',
          }}
        >
          Application Progression Rail
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: 'var(--bg-subtle)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          {steps.map((st, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.82rem',
                color: st.completed ? 'var(--text-main)' : 'var(--text-subtle)',
                fontWeight: st.completed ? 600 : 400,
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  backgroundColor: st.completed ? '#16a34a' : 'var(--border-light)',
                  color: st.completed ? '#ffffff' : 'var(--text-subtle)',
                  flexShrink: 0,
                }}
              >
                {st.completed ? '✓' : i + 1}
              </div>
              <span style={{ flex: 1 }}>{st.label}</span>
              {i < steps.length - 1 && (
                <ChevronRight size={13} style={{ color: 'var(--border-subtle)', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Snapshot Metadata Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          padding: '12px',
          backgroundColor: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
        }}
      >
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
            Applied Date
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.83rem', fontWeight: 600, marginTop: '2px' }}>
            <Calendar size={13} color="var(--primary)" />
            <span>{appliedDate}</span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
            Shortlisted
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.83rem', fontWeight: 600, marginTop: '2px' }}>
            <Clock size={13} color="var(--primary)" />
            <span>{savedDate}</span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
            Match Score
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.83rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
            <Sparkles size={13} />
            <span>{matchAnalysis.matchScore}% Match</span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
            Attempts
          </span>
          <div style={{ fontSize: '0.83rem', fontWeight: 600, marginTop: '2px' }}>
            {application.attempt_count || 1}
          </div>
        </div>
      </div>

      {/* Candidate Match & Skills Breakdown */}
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
          <Sparkles size={16} color="var(--primary)" />
          <span>Candidate Skills Analysis</span>
        </h3>

        {matchAnalysis.matchedSkills.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Matched Candidate Skills ({matchAnalysis.matchedSkills.length}):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              {matchAnalysis.matchedSkills.map((sk) => (
                <span
                  key={sk}
                  style={{
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  ✓ {sk}
                </span>
              ))}
            </div>
          </div>
        )}

        {matchAnalysis.missingSkills.length > 0 && (
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Target Skills to Develop ({matchAnalysis.missingSkills.length}):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              {matchAnalysis.missingSkills.slice(0, 6).map((sk) => (
                <span
                  key={sk}
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
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

      {/* Hunter Automation Observability Bridge */}
      {application.run_id && (
        <div
          style={{
            marginBottom: '22px',
            padding: '14px',
            backgroundColor: '#faf5ff',
            border: '1px solid #e9d5ff',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '10px',
              flexWrap: 'wrap',
              marginBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7e22ce', fontWeight: 700, fontSize: '0.9rem' }}>
              <Bot size={16} />
              <span>Linked Automation Run</span>
            </div>

            {onNavigateToRun && (
              <button
                onClick={() => onNavigateToRun(application.run_id!)}
                className="btn btn-primary"
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  backgroundColor: '#7e22ce',
                  borderColor: '#7e22ce',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>View Run Telemetry</span>
                <ChevronRight size={13} />
              </button>
            )}
          </div>

          <div style={{ fontSize: '0.82rem', color: '#581c87' }}>
            Run UUID:{' '}
            <code style={{ fontFamily: 'monospace', fontWeight: 600, backgroundColor: '#f3e8ff', padding: '1px 6px', borderRadius: '4px' }}>
              {application.run_id}
            </code>
          </div>
        </div>
      )}

      {/* Structured Form Questions & Answers Inspector */}
      <ApplicationAnswersViewer
        answers={displayAnswers}
        isLoading={isLoadingAnswers}
      />

      {/* Job Description */}
      {job?.description && (
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            Job Description
          </h3>
          <div
            style={{
              fontSize: '0.85rem',
              lineHeight: '1.6',
              color: 'var(--text-main)',
              whiteSpace: 'pre-line',
              backgroundColor: 'var(--bg-subtle)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              maxHeight: '260px',
              overflowY: 'auto',
            }}
          >
            {job.description}
          </div>
        </div>
      )}
    </div>
  );
};
