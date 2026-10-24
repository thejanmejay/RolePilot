import React from 'react';
import {
  Clock,
  Calendar,
  Ban,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import type { AutomationRun } from '../../types/automation';
import { StatusBadge } from '../common/StatusBadge';

interface RunSummaryHeaderProps {
  run: AutomationRun;
  isCancelling?: boolean;
  onCancelRun?: () => void;
}

export const RunSummaryHeader: React.FC<RunSummaryHeaderProps> = ({
  run,
  isCancelling = false,
  onCancelRun,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [now] = React.useState(() => Date.now());

  const isRunning = run.status === 'running' || run.status === 'queued';
  const isDryRun = Boolean(run.dry_run);

  // Compute duration
  let durationStr = 'In progress...';
  if (run.started_at && run.completed_at) {
    const diffMs = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
    if (diffMs > 0) {
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    } else {
      durationStr = '< 1s';
    }
  } else if (run.started_at && isRunning) {
    const diffMs = now - new Date(run.started_at).getTime();
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    durationStr = mins > 0 ? `${mins}m ${secs}s (running)` : `${secs}s (running)`;
  }

  // Copy UUID
  const handleCopyId = () => {
    navigator.clipboard.writeText(run.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Truthful narrative summary calculation
  const hasFailures = (run.applications_failed || 0) > 0 || Boolean(run.error_message);
  const jobsFound = run.jobs_found || 0;
  const jobsProcessed = run.jobs_processed || 0;
  const submitted = run.applications_submitted || 0;
  const failed = run.applications_failed || 0;
  const skipped = run.applications_skipped || 0;

  let narrativeStatus = {
    title: 'Completed Successfully',
    text: `${jobsProcessed} ${jobsProcessed === 1 ? 'job' : 'jobs'} processed · ${
      isDryRun ? `${jobsProcessed} verified in dry run` : `${submitted} submitted`
    } · ${skipped} skipped · ${failed} failed`,
    type: 'success',
  };

  if (run.status === 'failed') {
    narrativeStatus = {
      title: 'Automation Execution Stopped',
      text: run.error_message ? `Reason: ${run.error_message}` : 'Encountered unrecoverable exception during browser execution.',
      type: 'danger',
    };
  } else if (run.status === 'cancelled') {
    narrativeStatus = {
      title: 'Run Cancelled by User',
      text: 'Execution aborted before completion.',
      type: 'warning',
    };
  } else if (isRunning) {
    narrativeStatus = {
      title: 'Automation Running in Background',
      text: `${jobsFound} jobs found so far · Processing through Playwright browser worker...`,
      type: 'info',
    };
  } else if (hasFailures) {
    narrativeStatus = {
      title: 'Completed with Issues',
      text: `${jobsProcessed} jobs processed · ${submitted} submitted · ${failed} failed · ${skipped} skipped`,
      type: 'warning',
    };
  }

  return (
    <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
      {/* Top Meta Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <StatusBadge status={run.status} type="run" />

            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isDryRun ? 'var(--primary-light)' : '#fef3c7',
                color: isDryRun ? 'var(--primary)' : '#b45309',
              }}
            >
              {isDryRun ? 'Dry Run • Safe' : 'Live Submission'}
            </span>

            {isRunning && (
              <span style={{ fontSize: '0.75rem', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                <Loader2 size={13} className="spin-animation" />
                <span>Active Worker</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Run #{run.id.slice(0, 8)}
            </h2>
            <button
              onClick={handleCopyId}
              className="btn-icon"
              title="Copy Full UUID"
              style={{ width: '28px', height: '28px', padding: 0 }}
            >
              {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {isRunning && onCancelRun && (
          <button
            onClick={onCancelRun}
            disabled={isCancelling}
            className="btn btn-secondary"
            style={{
              color: 'var(--danger)',
              fontSize: '0.82rem',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '40px',
            }}
          >
            <Ban size={15} />
            <span>{isCancelling ? 'Cancelling...' : 'Cancel Execution'}</span>
          </button>
        )}
      </div>

      {/* Truthful Narrative Status Banner */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor:
            narrativeStatus.type === 'success'
              ? '#f0fdf4'
              : narrativeStatus.type === 'danger'
              ? '#fef2f2'
              : narrativeStatus.type === 'warning'
              ? '#fffbeb'
              : '#eff6ff',
          border: `1px solid ${
            narrativeStatus.type === 'success'
              ? '#bbf7d0'
              : narrativeStatus.type === 'danger'
              ? '#fecaca'
              : narrativeStatus.type === 'warning'
              ? '#fde68a'
              : '#bfdbfe'
          }`,
          marginBottom: '16px',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '2px' }}>
          {narrativeStatus.title}
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {narrativeStatus.text}
        </div>
      </div>

      {/* Metrics Row (Reflowing on small screens) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: '8px',
          padding: '14px',
          backgroundColor: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          marginBottom: '14px',
        }}
      >
        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {jobsFound}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>DISCOVERED</div>
        </div>

        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {jobsProcessed}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>PROCESSED</div>
        </div>

        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>
            {isDryRun ? jobsProcessed : submitted}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
            {isDryRun ? 'VERIFIED' : 'SUBMITTED'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>
            {skipped}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600 }}>SKIPPED</div>
        </div>

        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: failed > 0 ? '#dc2626' : 'var(--text-muted)' }}>
            {failed}
          </div>
          <div style={{ fontSize: '0.72rem', color: failed > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: 600 }}>
            FAILED
          </div>
        </div>
      </div>

      {/* Timing Details Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Calendar size={13} />
          <span>
            Started: {run.created_at ? new Date(run.created_at).toLocaleString() : 'N/A'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={13} />
          <span>Duration: {durationStr}</span>
        </div>
      </div>
    </div>
  );
};
