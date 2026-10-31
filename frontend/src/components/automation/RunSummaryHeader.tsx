import React from 'react';
import {
  Clock,
  Ban,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  RotateCw,
  Search,
  FileText,
  FastForward,
  AlertTriangle,
  Send,
  CheckCircle2,
  MoreHorizontal,
} from 'lucide-react';
import type { AutomationRun } from '../../types/automation';
import { StatusBadge } from '../common/StatusBadge';
import { formatRunDuration, normalizeRunStatus } from '../../utils/status';
import { formatDate, formatTime } from '../../utils/dates';
import { getRunTitle } from './AutomationRunCard';

interface RunSummaryHeaderProps {
  run: AutomationRun;
  isCancelling?: boolean;
  onCancelRun?: () => void;
  onReRun?: (run: AutomationRun) => void;
}

export const RunSummaryHeader: React.FC<RunSummaryHeaderProps> = ({
  run,
  isCancelling = false,
  onCancelRun,
  onReRun,
}) => {
  const [copied, setCopied] = React.useState(false);

  const normStatus = normalizeRunStatus(run.status);
  const isRunning = normStatus === 'running';
  const isQueued = normStatus === 'queued';
  const isDryRun = Boolean(run.dry_run);

  // Authoritative duration from start and completion timestamps
  const durationStr = formatRunDuration(run.started_at, run.completed_at, run.status, run.created_at);

  const formattedDate = run.created_at
    ? `${formatDate(run.created_at)}, ${formatTime(run.created_at)}`
    : 'Recently';

  const runTitle = getRunTitle(run);

  // Copy UUID
  const handleCopyId = () => {
    navigator.clipboard.writeText(run.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const jobsFound = run.jobs_found || 0;
  const jobsEvaluated = run.jobs_processed || 0;
  // Dry runs strictly report 0 applications submitted
  const submitted = isDryRun ? 0 : (run.applications_submitted || 0);
  const failed = run.applications_failed || 0;
  const skipped = run.applications_skipped || 0;

  // Outcome banner state matching authoritative run status
  let outcomeBanner = {
    title: isDryRun ? 'Run completed successfully (Dry Run)' : 'Run completed successfully (Live Run)',
    subtext: `${jobsFound} jobs found • ${jobsEvaluated} evaluated • ${skipped} skipped • ${failed} failed • ${submitted} submitted`,
    bg: '#ECFDF5',
    border: '#A7F3D0',
    color: '#065F46',
    icon: CheckCircle2,
    iconColor: '#16A34A',
  };

  if (normStatus === 'failed') {
    outcomeBanner = {
      title: 'Automation Execution Stopped',
      subtext: run.error_message || 'Automation stopped because an error occurred.',
      bg: '#FEF2F2',
      border: '#FECACA',
      color: '#991B1B',
      icon: AlertCircle,
      iconColor: '#DC2626',
    };
  } else if (normStatus === 'cancelled') {
    outcomeBanner = {
      title: 'Run Cancelled by User',
      subtext: 'Execution aborted before completion.',
      bg: '#FFFBEB',
      border: '#FDE68A',
      color: '#92400E',
      icon: Ban,
      iconColor: '#D97706',
    };
  } else if (isRunning) {
    outcomeBanner = {
      title: 'Automation Running in Background',
      subtext: 'Automation is running. Results will update as processing continues.',
      bg: '#EFF6FF',
      border: '#BFDBFE',
      color: '#1E40AF',
      icon: Loader2,
      iconColor: '#1769C2',
    };
  } else if (isQueued) {
    outcomeBanner = {
      title: 'Run Queued',
      subtext: 'Your run is queued and waiting to start.',
      bg: '#FFFBEB',
      border: '#FDE68A',
      color: '#92400E',
      icon: Clock,
      iconColor: '#D97706',
    };
  }

  const OutcomeIcon = outcomeBanner.icon;

  const resultMetricCards = [
    {
      label: 'Jobs Found',
      value: jobsFound,
      icon: Search,
      iconColor: '#1769C2',
      subtext: 'Matches from your search criteria and location preferences.',
    },
    {
      label: 'Evaluated',
      value: jobsEvaluated,
      icon: FileText,
      iconColor: '#1769C2',
      subtext: 'Matched your profile and role criteria.',
    },
    {
      label: 'Skipped',
      value: skipped,
      icon: FastForward,
      iconColor: '#D97706',
      subtext: 'Did not meet criteria',
    },
    {
      label: 'Failed',
      value: failed,
      icon: AlertTriangle,
      iconColor: '#DC2626',
      subtext: 'Errors during processing',
    },
    {
      label: 'Submitted',
      value: submitted,
      icon: Send,
      iconColor: '#16A34A',
      subtext: isDryRun ? 'No applications submitted (Dry Run).' : 'Applications submitted live.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '8px' }}>
      {/* Top Header Bar: Title, StatusBadge, Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '1.28rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
              Run Details
            </h2>
            <StatusBadge status={run.status} type="run" />
          </div>

          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', margin: '4px 0 2px 0', letterSpacing: '-0.01em' }}>
            {runTitle}
          </h3>

          <div style={{ fontSize: '0.8rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span>Run #{run.id.slice(0, 8)}</span>
            <span>•</span>
            <span>{formattedDate}</span>
            <span style={{ color: '#CBD5E1' }}>|</span>
            <span style={{ fontWeight: 600, color: isDryRun ? '#1769C2' : '#B45309' }}>
              {isDryRun ? 'Dry Run' : 'Live Run'}
            </span>
            <span style={{ color: '#CBD5E1' }}>|</span>
            <span>Duration: <strong>{durationStr}</strong></span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {onReRun && (
            <button
              onClick={() => onReRun(run)}
              className="btn btn-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                cursor: 'pointer',
              }}
            >
              <RotateCw size={14} />
              <span>Re-run</span>
            </button>
          )}

          <button
            onClick={handleCopyId}
            className="btn btn-outline"
            title="Copy Run ID"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy Run ID'}</span>
          </button>

          {isRunning && onCancelRun && (
            <button
              onClick={onCancelRun}
              disabled={isCancelling}
              className="btn btn-secondary"
              style={{
                color: '#DC2626',
                fontSize: '0.82rem',
                fontWeight: 600,
                padding: '6px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
                border: '1px solid #FECACA',
                backgroundColor: '#FEF2F2',
                cursor: 'pointer',
              }}
            >
              <Ban size={14} />
              <span>{isCancelling ? 'Cancelling...' : 'Cancel'}</span>
            </button>
          )}

          <button
            type="button"
            className="btn-icon"
            title="More Options"
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Outcome Status Banner */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '10px',
          backgroundColor: outcomeBanner.bg,
          border: `1px solid ${outcomeBanner.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <OutcomeIcon
            size={20}
            color={outcomeBanner.iconColor}
            className={isRunning ? 'spin-animation' : undefined}
          />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: outcomeBanner.color, lineHeight: 1.3 }}>
            {outcomeBanner.title}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
            {outcomeBanner.subtext}
          </div>
        </div>
      </div>

      {/* Restrained Error Panel for Exceptions */}
      {run.error_message && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '10px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontWeight: 700, fontSize: '0.8rem', marginBottom: '4px' }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>Error Summary</span>
          </div>
          <div
            className="custom-scrollbar"
            style={{
              color: '#991B1B',
              fontSize: '0.78rem',
              lineHeight: 1.45,
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              whiteSpace: 'pre-wrap',
              maxHeight: '120px',
              overflowY: 'auto',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
          >
            {run.error_message}
          </div>
        </div>
      )}

      {/* 5 Result Metric Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '12px',
        }}
      >
        {resultMetricCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '14px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '110px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Icon size={16} color={card.iconColor} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                  {card.value}
                </span>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>
                  {card.label}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', lineHeight: 1.3 }}>
                  {card.subtext}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
