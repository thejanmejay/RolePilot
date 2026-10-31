import React from 'react';
import {
  CheckCircle2,
  Play,
  Clock,
  XCircle,
  Ban,
  ChevronRight,
} from 'lucide-react';
import type { AutomationRun } from '../../types/automation';
import { StatusBadge } from '../common/StatusBadge';
import { formatDate, formatTime } from '../../utils/dates';
import { normalizeRunStatus } from '../../utils/status';

interface AutomationRunCardProps {
  run: AutomationRun;
  isSelected: boolean;
  onSelect: () => void;
}

export function getRunTitle(run: AutomationRun): string {
  if (run.search_config?.name && run.search_config.name !== 'Default Search') {
    return run.search_config.name;
  }
  if (run.search_config?.keywords) {
    const kw = Array.isArray(run.search_config.keywords)
      ? run.search_config.keywords.join(', ')
      : run.search_config.keywords;
    if (kw.trim()) {
      // Capitalize nicely
      const cleanKw = kw.trim();
      return cleanKw.toLowerCase().includes('role') || cleanKw.toLowerCase().includes('engineer') || cleanKw.toLowerCase().includes('manager')
        ? cleanKw
        : `${cleanKw} Roles`;
    }
  }
  return `Run #${run.id.slice(0, 8)}`;
}

export const AutomationRunCard: React.FC<AutomationRunCardProps> = ({
  run,
  isSelected,
  onSelect,
}) => {
  const normStatus = normalizeRunStatus(run.status);
  const title = getRunTitle(run);

  const dateStr = run.created_at
    ? `${formatDate(run.created_at)} • ${formatTime(run.created_at)}`
    : 'Recently';

  const modeStr = run.dry_run ? 'Dry Run' : 'Live Run';

  const jobsFound = run.jobs_found || 0;
  const jobsEvaluated = run.jobs_processed || 0;
  // Dry runs strictly report 0 submitted applications
  const jobsSubmitted = run.dry_run ? 0 : (run.applications_submitted || 0);

  // Left status icon
  const renderStatusIcon = () => {
    switch (normStatus) {
      case 'completed':
        return <CheckCircle2 size={18} color="#16A34A" style={{ flexShrink: 0 }} />;
      case 'running':
        return (
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#1769C2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Play size={10} color="#FFFFFF" fill="#FFFFFF" />
          </div>
        );
      case 'queued':
        return (
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Clock size={11} color="#FFFFFF" />
          </div>
        );
      case 'failed':
        return <XCircle size={18} color="#DC2626" style={{ flexShrink: 0 }} />;
      case 'cancelled':
        return <Ban size={18} color="#64748B" style={{ flexShrink: 0 }} />;
      default:
        return <Clock size={18} color="#64748B" style={{ flexShrink: 0 }} />;
    }
  };

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="card automation-run-card"
      style={{
        padding: '12px 14px',
        marginBottom: '8px',
        cursor: 'pointer',
        border: isSelected ? '1px solid #1769C2' : '1px solid #E5E7EB',
        borderLeft: isSelected ? '4px solid #1769C2' : '4px solid transparent',
        boxShadow: isSelected ? '0 4px 12px rgba(23, 105, 194, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.02)',
        backgroundColor: isSelected ? '#F0F7FF' : '#FFFFFF',
        borderRadius: '10px',
        transition: 'all 0.15s ease-in-out',
        outline: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      {/* Left circular status icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {renderStatusIcon()}
      </div>

      {/* Middle content info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: Title and Status Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.88rem',
              color: isSelected ? '#1769C2' : '#0F172A',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
          <StatusBadge status={run.status} type="run" size="sm" />
        </div>

        {/* Row 2: Date, Time, Mode */}
        <div
          style={{
            fontSize: '0.74rem',
            color: '#64748B',
            marginBottom: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {dateStr} • {modeStr}
        </div>

        {/* Row 3: Result Counts */}
        <div
          style={{
            fontSize: '0.73rem',
            color: '#64748B',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <span>
            <strong style={{ color: '#0F172A' }}>{jobsFound}</strong> found
          </span>
          <span>
            <strong style={{ color: '#0F172A' }}>{jobsEvaluated}</strong> evaluated
          </span>
          <span>
            <strong style={{ color: jobsSubmitted > 0 ? '#16A34A' : '#0F172A' }}>{jobsSubmitted}</strong> submitted
          </span>
        </div>
      </div>

      {/* Right chevron indicator */}
      <ChevronRight
        size={16}
        color={isSelected ? '#1769C2' : '#94A3B8'}
        style={{ flexShrink: 0, opacity: isSelected ? 1 : 0.6 }}
      />
    </div>
  );
};
