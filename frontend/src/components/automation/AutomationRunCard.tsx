import React from 'react';
import type { AutomationRun } from '../../types/automation';
import { StatusBadge } from '../common/StatusBadge';
import { formatDate, formatTime } from '../../utils/dates';

interface AutomationRunCardProps {
  run: AutomationRun;
  isSelected: boolean;
  onSelect: () => void;
}

export const AutomationRunCard: React.FC<AutomationRunCardProps> = ({
  run,
  isSelected,
  onSelect,
}) => {
  const createdDateStr = run.created_at
    ? `${formatDate(run.created_at)} at ${formatTime(run.created_at)}`
    : 'Recently';

  return (
    <div
      onClick={onSelect}
      className="card"
      style={{
        padding: '16px',
        marginBottom: '12px',
        cursor: 'pointer',
        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
        boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
        backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
        transition: 'all 0.15s ease-in-out',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
              Run #{run.id.slice(0, 8)}
            </span>
            {run.dry_run && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  fontWeight: 600,
                  border: '1px solid #fde68a',
                }}
              >
                Dry Run
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
            Started: {createdDateStr}
          </span>
        </div>

        <StatusBadge status={run.status} type="run" />
      </div>

      {/* Progress & statistics counts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-subtle)',
          padding: '8px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{run.jobs_found || 0}</div>
          <div style={{ color: 'var(--text-subtle)', fontSize: '0.7rem' }}>Found</div>
        </div>

        <div>
          <div style={{ fontWeight: 700, color: '#16a34a' }}>{run.applications_submitted || 0}</div>
          <div style={{ color: 'var(--text-subtle)', fontSize: '0.7rem' }}>Submitted</div>
        </div>

        <div>
          <div style={{ fontWeight: 700, color: '#d97706' }}>{run.applications_skipped || 0}</div>
          <div style={{ color: 'var(--text-subtle)', fontSize: '0.7rem' }}>Skipped</div>
        </div>

        <div>
          <div style={{ fontWeight: 700, color: '#dc2626' }}>{run.applications_failed || 0}</div>
          <div style={{ color: 'var(--text-subtle)', fontSize: '0.7rem' }}>Failed</div>
        </div>
      </div>
    </div>
  );
};
