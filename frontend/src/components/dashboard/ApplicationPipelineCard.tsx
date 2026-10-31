import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ApplicationPipelineCardProps {
  jobsDiscovered: number;
  formsEvaluated: number;
  dryRunsVerified: number;
  liveSubmissions: number;
}

export const ApplicationPipelineCard: React.FC<ApplicationPipelineCardProps> = ({
  jobsDiscovered,
  formsEvaluated,
  dryRunsVerified,
  liveSubmissions,
}) => {
  const [range, setRange] = useState<'30' | '7' | 'all'>('30');

  // Compute percentages safely
  const p1 = 100;
  const p2 = jobsDiscovered > 0 ? Math.round((formsEvaluated / jobsDiscovered) * 100) : 0;
  const p3 = jobsDiscovered > 0 ? Math.round((dryRunsVerified / jobsDiscovered) * 100) : 0;
  const p4 = jobsDiscovered > 0 ? Math.round((liveSubmissions / jobsDiscovered) * 100) : 0;

  const funnelRows = [
    {
      label: 'Jobs Discovered',
      count: jobsDiscovered,
      percent: `${p1}%`,
      width: '100%',
      color: '#3B82F6',
      bg: '#3B82F6',
    },
    {
      label: 'Forms Evaluated',
      count: formsEvaluated,
      percent: `${p2}%`,
      width: `${Math.max(15, p2)}%`,
      color: '#A855F7',
      bg: '#C084FC',
    },
    {
      label: 'Dry Runs Verified',
      count: dryRunsVerified,
      percent: `${p3}%`,
      width: `${Math.max(15, p3)}%`,
      color: '#38BDF8',
      bg: '#7DD3FC',
    },
    {
      label: 'Live Submissions',
      count: liveSubmissions,
      percent: `${p4}%`,
      width: `${Math.max(15, p4)}%`,
      color: '#22C55E',
      bg: '#86EFAC',
    },
  ];

  return (
    <div
      className="card application-pipeline-card"
      style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '20px 22px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Application Pipeline
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            From discovered jobs to live submissions
          </p>
        </div>

        {/* Filter dropdown pill */}
        <div style={{ position: 'relative' }}>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as any)}
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              background: '#F8FAFC',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '4px 22px 4px 8px',
              appearance: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="30">Last 30 days</option>
            <option value="7">Last 7 days</option>
            <option value="all">All time</option>
          </select>
          <ChevronDown
            size={12}
            style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}
          />
        </div>
      </div>

      {/* Funnel Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'center' }}>
        {funnelRows.map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Label */}
            <span style={{ width: '115px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', flexShrink: 0 }}>
              {row.label}
            </span>

            {/* Funnel Bar Container */}
            <div style={{ flex: 1, height: '26px', background: '#F1F5F9', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  width: row.width,
                  height: '100%',
                  background: row.bg,
                  borderRadius: '6px',
                  transition: 'width 0.4s ease',
                  opacity: 0.85,
                }}
              />
            </div>

            {/* Count & Percentage */}
            <div style={{ width: '65px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, fontSize: '0.82rem' }}>
              <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{row.count}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.74rem' }}>{row.percent}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
