import React from 'react';
import {
  Building2,
  MapPin,
  ExternalLink,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import type { Application } from '../../types/application';
import { StatusBadge } from '../common/StatusBadge';

interface JobApplicationSelectorProps {
  applications: Application[];
  selectedAppId: string | null;
  onSelectApplication: (app: Application) => void;
  onNavigateToApplication?: (applicationId: string) => void;
}

export const JobApplicationSelector: React.FC<JobApplicationSelectorProps> = ({
  applications,
  selectedAppId,
  onSelectApplication,
  onNavigateToApplication,
}) => {
  if (applications.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border-light)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
        }}
      >
        No job applications recorded for this run yet.
      </div>
    );
  }

  const getReasonExplanation = (app: Application) => {
    const status = (app.status || '').toLowerCase();
    const errorMsg = (app.error_message || '').toLowerCase();

    if (status === 'applied' || status === 'submitted') {
      return {
        type: 'success',
        icon: CheckCircle2,
        title: 'Submission Confirmed',
        text: 'Application was submitted and post-submission modal closure was conclusively verified on LinkedIn.',
      };
    }

    if (status === 'dry_run_completed') {
      return {
        type: 'info',
        icon: ShieldCheck,
        title: 'Dry-Run Validated',
        text: 'All multi-step modal fields were detected and filled. Submission was safely blocked and modal discarded.',
      };
    }

    if (status === 'skipped') {
      if (errorMsg.includes('already applied') || errorMsg.includes('duplicate')) {
        return {
          type: 'warning',
          icon: HelpCircle,
          title: 'Skipped: Already Applied',
          text: 'This candidate has already submitted an application to this job posting previously.',
        };
      }
      if (errorMsg.includes('easy apply') || errorMsg.includes('not found')) {
        return {
          type: 'warning',
          icon: HelpCircle,
          title: 'Skipped: External ATS Redirect',
          text: 'This job redirected to an external third-party company portal (non-Easy Apply).',
        };
      }
      if (errorMsg.includes('blacklist') || errorMsg.includes('filtered')) {
        return {
          type: 'warning',
          icon: HelpCircle,
          title: 'Skipped: Blacklisted Criteria',
          text: 'The job title or company matched blacklisted keywords in your search preferences.',
        };
      }
      return {
        type: 'warning',
        icon: HelpCircle,
        title: 'Skipped: Criteria Mismatch',
        text: app.error_message || 'Application was skipped based on search qualification filters.',
      };
    }

    if (status === 'submission_failed' || status === 'failed') {
      if (errorMsg.includes('checkpoint') || errorMsg.includes('challenge') || errorMsg.includes('security')) {
        return {
          type: 'danger',
          icon: AlertCircle,
          title: 'Failed: LinkedIn Security Checkpoint',
          text: 'LinkedIn presented a verification challenge or requested interactive confirmation.',
        };
      }
      if (errorMsg.includes('unconfirmed') || errorMsg.includes('timeout')) {
        return {
          type: 'danger',
          icon: XCircle,
          title: 'Failed: Post-Submit Verification Unconfirmed',
          text: 'Submit button was clicked, but LinkedIn confirmation toast was not detected within timeout. Marked unconfirmed for safety.',
        };
      }
      return {
        type: 'danger',
        icon: AlertCircle,
        title: 'Failed: Unrecoverable Form Error',
        text: app.error_message || 'An unexpected error occurred while filling modal fields.',
      };
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        Processed Jobs in Run ({applications.length})
      </div>

      <div className="processed-jobs-grid">
        {applications.map((app, idx) => {
          const isSelected = app.id === selectedAppId || (!selectedAppId && idx === 0);
          const reason = getReasonExplanation(app);
          const ReasonIcon = reason?.icon || HelpCircle;

          return (
            <div
              key={app.id || idx}
              onClick={() => onSelectApplication(app)}
              className="card"
              style={{
                padding: '14px',
                cursor: 'pointer',
                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
                boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                marginBottom: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      backgroundColor: 'var(--bg-subtle)',
                      color: 'var(--text-muted)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      flexShrink: 0,
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {app.job?.title || 'Job Opportunity'}
                  </span>
                </div>

                <StatusBadge status={app.status} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Building2 size={13} />
                  <span>{app.job?.company || 'Company'}</span>
                </div>
                {app.job?.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={13} />
                    <span>{app.job.location}</span>
                  </div>
                )}
                {app.application_url && (
                  <a
                    href={app.application_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: 'var(--primary)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <span>View</span>
                    <ExternalLink size={12} />
                  </a>
                )}

                {onNavigateToApplication && app.id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToApplication(app.id);
                    }}
                    className="btn btn-outline"
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      minHeight: '26px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      marginLeft: app.application_url ? '6px' : 'auto',
                    }}
                    title="Inspect application in Tracker"
                  >
                    <span>Track</span>
                    <ChevronRight size={12} />
                  </button>
                )}
              </div>

              {/* "Why?" Explanation Box */}
              {reason && (
                <div
                  style={{
                    backgroundColor:
                      reason.type === 'success'
                        ? '#f0fdf4'
                        : reason.type === 'danger'
                        ? '#fef2f2'
                        : reason.type === 'warning'
                        ? '#fffbeb'
                        : '#eff6ff',
                    border: `1px solid ${
                      reason.type === 'success'
                        ? '#bbf7d0'
                        : reason.type === 'danger'
                        ? '#fecaca'
                        : reason.type === 'warning'
                        ? '#fde68a'
                        : '#bfdbfe'
                    }`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '2px', color: 'var(--text-main)' }}>
                    <ReasonIcon size={14} color={reason.type === 'success' ? '#16a34a' : reason.type === 'danger' ? '#dc2626' : '#d97706'} />
                    <span>{reason.title}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', lineHeight: 1.35 }}>
                    {reason.text}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
