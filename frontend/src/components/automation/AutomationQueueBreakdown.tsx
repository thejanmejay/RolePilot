import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  ExternalLink,
  ShieldAlert,
  KeyRound,
  FileQuestion,
} from 'lucide-react';
import type { Application } from '../../api/applications';

interface AutomationQueueBreakdownProps {
  applications: Application[];
  isLoading: boolean;
}

export const AutomationQueueBreakdown: React.FC<AutomationQueueBreakdownProps> = ({
  applications,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'completed' | 'failed'>('completed');

  // Categorize applications by execution phase
  const queueApps = applications.filter((a) =>
    ['discovered', 'eligible', 'applying', 'questions_pending', 'pending'].includes(
      (a.status || '').toLowerCase()
    )
  );

  const completedApps = applications.filter((a) =>
    ['submitted', 'already_applied', 'skipped', 'applied'].includes(
      (a.status || '').toLowerCase()
    )
  );

  const failedApps = applications.filter((a) =>
    ['failed', 'abandoned', 'rejected'].includes((a.status || '').toLowerCase())
  );

  const getFailureBadge = (errorMessage?: string | null) => {
    const msg = (errorMessage || '').toLowerCase();
    if (msg.includes('captcha') || msg.includes('challenge') || msg.includes('checkpoint')) {
      return { label: 'CAPTCHA Challenge', icon: ShieldAlert, color: '#dc2626', bg: '#fee2e2' };
    }
    if (msg.includes('auth') || msg.includes('login') || msg.includes('session') || msg.includes('password')) {
      return { label: 'Login / Session Expired', icon: KeyRound, color: '#d97706', bg: '#fef3c7' };
    }
    if (msg.includes('question') || msg.includes('field') || msg.includes('required')) {
      return { label: 'Missing Info / Custom Question', icon: FileQuestion, color: '#7c3aed', bg: '#f3e8ff' };
    }
    return { label: 'Execution Failure', icon: AlertTriangle, color: '#dc2626', bg: '#fee2e2' };
  };

  const currentList =
    activeTab === 'queue' ? queueApps : activeTab === 'completed' ? completedApps : failedApps;

  return (
    <div>
      {/* Category Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '8px',
          marginBottom: '16px',
        }}
      >
        <button
          onClick={() => setActiveTab('completed')}
          className={`btn ${activeTab === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <CheckCircle2 size={14} />
          <span>Completed ({completedApps.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={`btn ${activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Clock size={14} />
          <span>In Progress / Queue ({queueApps.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('failed')}
          className={`btn ${activeTab === 'failed' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <AlertTriangle size={14} />
          <span>Failed ({failedApps.length})</span>
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: '60px', width: '100%' }} />
          ))}
        </div>
      ) : currentList.length === 0 ? (
        <div
          style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: 'var(--text-subtle)',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            {activeTab === 'completed'
              ? 'No completed applications recorded in this run yet.'
              : activeTab === 'queue'
              ? 'No active jobs remaining in execution queue.'
              : 'No failed applications in this run. Clean execution!'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {currentList.map((app) => {
            const job = app.job;
            const failure = activeTab === 'failed' ? getFailureBadge(app.error_message) : null;
            const FailureIcon = failure?.icon;

            return (
              <div
                key={app.id}
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 2px 0' }}>
                      {job?.title || 'Job Title Not Available'}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <Building2 size={13} color="var(--primary)" />
                      <span>{job?.company || 'Company Not Available'}</span>
                      {job?.location && (
                        <>
                          <span>•</span>
                          <span>{job.location}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        backgroundColor:
                          app.status === 'submitted' || app.status === 'applied'
                            ? '#dcfce7'
                            : app.status === 'skipped'
                            ? '#fef3c7'
                            : '#fee2e2',
                        color:
                          app.status === 'submitted' || app.status === 'applied'
                            ? '#15803d'
                            : app.status === 'skipped'
                            ? '#b45309'
                            : '#b91c1c',
                        textTransform: 'capitalize',
                      }}
                    >
                      {app.status}
                    </span>

                    {job?.job_url && (
                      <a
                        href={job.job_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-icon"
                        style={{ padding: '2px' }}
                        title="Open LinkedIn Job"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Failure reason diagnostics */}
                {failure && FailureIcon && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: failure.bg,
                      color: failure.color,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      marginTop: '8px',
                    }}
                  >
                    <FailureIcon size={13} />
                    <span>{failure.label}: {app.error_message || 'Application was not submitted'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
