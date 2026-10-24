import React from 'react';
import { Play, CheckCircle2, AlertTriangle, FastForward, Activity, Percent } from 'lucide-react';
import type { AutomationRun } from '../../types/automation';

interface AutomationStatsProps {
  runs: AutomationRun[];
}

export const AutomationStats: React.FC<AutomationStatsProps> = ({ runs }) => {
  const totalRuns = runs.length;
  const runningRuns = runs.filter((r) => r.status === 'running' || r.status === 'queued').length;
  
  // Only count genuine live applications submitted (dry runs must never increment this metric)
  const totalSubmitted = runs
    .filter((r) => !r.dry_run)
    .reduce((acc, r) => acc + (r.applications_submitted || 0), 0);
    
  const totalSkipped = runs.reduce((acc, r) => acc + (r.applications_skipped || 0), 0);
  const totalFailed = runs.reduce((acc, r) => acc + (r.applications_failed || 0), 0);
  
  // Success rate is calculated exclusively on genuine submission attempts (submitted / (submitted + failed))
  const liveAttempts = totalSubmitted + totalFailed;
  const successRate = liveAttempts > 0 ? Math.round((totalSubmitted / liveAttempts) * 100) : null;
  const successRateText = successRate !== null ? `${successRate}%` : 'N/A';

  const cards = [
    {
      label: 'Total Runs',
      value: totalRuns,
      icon: Play,
      color: 'var(--primary)',
      bg: 'var(--primary-light)',
    },
    {
      label: 'In Progress / Queued',
      value: runningRuns,
      icon: Activity,
      color: runningRuns > 0 ? '#0284c7' : 'var(--text-subtle)',
      bg: runningRuns > 0 ? '#e0f2fe' : 'var(--bg-subtle)',
      badge: runningRuns > 0 ? 'Active' : undefined,
    },
    {
      label: 'Applications Submitted',
      value: totalSubmitted,
      icon: CheckCircle2,
      color: '#16a34a',
      bg: '#dcfce7',
    },
    {
      label: 'Skipped (Eligible/Applied)',
      value: totalSkipped,
      icon: FastForward,
      color: '#d97706',
      bg: '#fef3c7',
    },
    {
      label: 'Failed Applications',
      value: totalFailed,
      icon: AlertTriangle,
      color: '#dc2626',
      bg: '#fee2e2',
    },
    {
      label: 'Application Success Rate',
      value: successRateText,
      icon: Percent,
      color: successRate !== null && successRate >= 50 ? '#16a34a' : 'var(--text-muted)',
      bg: successRate !== null && successRate >= 50 ? '#dcfce7' : 'var(--bg-subtle)',
    },
  ];


  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
        marginBottom: '24px',
      }}
    >
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="card"
            style={{
              padding: '14px 16px',
              border: '1px solid var(--border-color)',
              backgroundColor: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {card.label}
              </span>
              <div
                style={{
                  backgroundColor: card.bg,
                  color: card.color,
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={14} />
              </div>
            </div>

            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {card.value}
            </div>
          </div>
        );
      })}
    </div>
  );
};
