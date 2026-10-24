import React from 'react';
import { Search, Eye, Send, ShieldCheck } from 'lucide-react';

interface FunnelStats {
  jobsFound: number;
  jobsProcessed: number;
  dryRunVerified: number;
  submittedConfirmed: number;
}

interface ApplicationFunnelProps {
  stats: FunnelStats;
}

export const ApplicationFunnel: React.FC<ApplicationFunnelProps> = ({ stats }) => {
  const { jobsFound, jobsProcessed, dryRunVerified, submittedConfirmed } = stats;

  const steps = [
    {
      id: 'found',
      label: 'Jobs Discovered',
      sublabel: 'Matching search criteria',
      count: jobsFound,
      icon: Search,
      color: '#3b82f6',
      bg: '#eff6ff',
      percent: '100%',
    },
    {
      id: 'processed',
      label: 'Forms Evaluated',
      sublabel: 'Easy Apply modal opened',
      count: jobsProcessed,
      icon: Eye,
      color: '#8b5cf6',
      bg: '#f5f3ff',
      percent: jobsFound > 0 ? `${Math.round((jobsProcessed / jobsFound) * 100)}%` : '0%',
    },
    {
      id: 'dry_run',
      label: 'Dry-Run Verified',
      sublabel: 'All fields filled & reviewed',
      count: dryRunVerified,
      icon: ShieldCheck,
      color: '#0a66c2',
      bg: '#e8f3fc',
      percent: jobsProcessed > 0 ? `${Math.round((dryRunVerified / jobsProcessed) * 100)}%` : '0%',
    },
    {
      id: 'submitted',
      label: 'Live Submissions',
      sublabel: 'Triple-Key confirmed on LinkedIn',
      count: submittedConfirmed,
      icon: Send,
      color: '#16a34a',
      bg: '#dcfce7',
      percent: jobsProcessed > 0 ? `${Math.round((submittedConfirmed / jobsProcessed) * 100)}%` : '0%',
    },
  ];

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <div className="card-header">
        <div>
          <h2 className="card-title" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            Automation Pipeline Funnel
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Lifecycle conversion from discovered LinkedIn jobs to verified applications
          </p>
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Responsive Funnel Grid: Horizontal on Desktop, Vertical Rail on Mobile */}
        <div className="funnel-container">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <React.Fragment key={step.id}>
                <div className="funnel-step-card">
                  <div className="funnel-icon-badge" style={{ backgroundColor: step.bg, color: step.color }}>
                    <Icon size={20} />
                  </div>

                  <div className="funnel-step-content">
                    <div className="funnel-step-header">
                      <span className="funnel-step-label">{step.label}</span>
                      <span className="funnel-step-percent" style={{ color: step.color }}>
                        {step.percent}
                      </span>
                    </div>

                    <div className="funnel-step-count">{step.count}</div>
                    <div className="funnel-step-sublabel">{step.sublabel}</div>
                  </div>
                </div>

                {idx < steps.length - 1 && (
                  <div className="funnel-connector" aria-hidden="true">
                    <div className="funnel-arrow-line"></div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
