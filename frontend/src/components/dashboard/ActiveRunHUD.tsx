import React from 'react';
import { ArrowRight, Loader2, Clock } from 'lucide-react';
import type { AutomationRun } from '../../types/automation';

interface ActiveRunHUDProps {
  activeRun: AutomationRun | null;
  onNavigateToRun: (runId: string) => void;
}

export const ActiveRunHUD: React.FC<ActiveRunHUDProps> = ({ activeRun, onNavigateToRun }) => {
  if (!activeRun) return null;

  const isRunning = activeRun.status === 'running';

  return (
    <div
      className="card"
      style={{
        border: '1px solid var(--primary-border)',
        background: 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%)',
        marginBottom: '24px',
        padding: '16px 20px',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isRunning ? 'var(--primary)' : '#f59e0b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isRunning ? (
              <Loader2 size={22} className="spin-animation" />
            ) : (
              <Clock size={22} />
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                {isRunning ? 'Automation Run in Progress' : 'Automation Run Queued'}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: activeRun.dry_run ? 'var(--primary-light)' : '#fef3c7',
                  color: activeRun.dry_run ? 'var(--primary)' : '#b45309',
                }}
              >
                {activeRun.dry_run ? 'Dry Run • Safe' : 'Live Mode'}
              </span>
            </div>

            <div
              style={{
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                marginTop: '4px',
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <span>Found: <strong>{activeRun.jobs_found}</strong></span>
              <span>Processed: <strong>{activeRun.jobs_processed}</strong></span>
              <span>
                {activeRun.dry_run ? 'Verified Review:' : 'Submitted:'}{' '}
                <strong>
                  {activeRun.dry_run ? activeRun.jobs_processed : activeRun.applications_submitted}
                </strong>
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigateToRun(activeRun.id)}
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontSize: '0.88rem',
            whiteSpace: 'nowrap',
            minHeight: '44px',
          }}
        >
          <span>View Telemetry & Logs</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
