import React from 'react';
import { Play, Search, FileText, Settings, ChevronRight, Loader2 } from 'lucide-react';

interface QuickActionsCardProps {
  onRunDryRun: () => void;
  onNavigateJobs: () => void;
  onNavigateApplications: () => void;
  onNavigateAutomation: () => void;
  onRequireLinkedInConsent?: () => void;
  isTriggering?: boolean;
}

export const QuickActionsCard: React.FC<QuickActionsCardProps> = ({
  onRunDryRun,
  onNavigateJobs,
  onNavigateApplications,
  onNavigateAutomation,
  isTriggering = false,
}) => {
  return (
    <div
      className="card quick-actions-card"
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
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px' }}>
        Quick Actions
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'space-between' }}>
        {/* Primary Action: Run Safe Dry Run */}
        <button
          type="button"
          onClick={onRunDryRun}
          disabled={isTriggering}
          style={{
            background: 'var(--primary)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: isTriggering ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            transition: 'background-color 0.15s ease',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isTriggering ? <Loader2 size={16} className="spin-animation" /> : <Play size={16} fill="#ffffff" />}
          </div>
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, lineHeight: 1.2 }}>Run a Safe Dry Run</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '2px' }}>
              Test 5 matching jobs (no submission)
            </div>
          </div>
        </button>

        {/* Action 2: Find New Jobs */}
        <button
          type="button"
          onClick={onNavigateJobs}
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease',
          }}
          className="quick-action-sub-btn"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ color: 'var(--primary)' }}>
              <Search size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Find New Jobs</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Discover jobs based on your preferences
              </div>
            </div>
          </div>
          <ChevronRight size={14} color="var(--text-muted)" />
        </button>

        {/* Action 3: View Applications */}
        <button
          type="button"
          onClick={onNavigateApplications}
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease',
          }}
          className="quick-action-sub-btn"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ color: 'var(--primary)' }}>
              <FileText size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>View Applications</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Track status and manage your applications
              </div>
            </div>
          </div>
          <ChevronRight size={14} color="var(--text-muted)" />
        </button>

        {/* Action 4: Manage Automation */}
        <button
          type="button"
          onClick={onNavigateAutomation}
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease',
          }}
          className="quick-action-sub-btn"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ color: 'var(--primary)' }}>
              <Settings size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Manage Automation</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Configure settings and rules</div>
            </div>
          </div>
          <ChevronRight size={14} color="var(--text-muted)" />
        </button>
      </div>
    </div>
  );
};
