import React from 'react';
import { Play, Clock, ShieldCheck, FileText, Loader2 } from 'lucide-react';
import type { SearchConfig } from '../../types/job';

interface TodayAutomationRunCardProps {
  activeSearchConfig: SearchConfig | null;
  onLaunchDryRun: () => void;
  isTriggering?: boolean;
}

export const TodayAutomationRunCard: React.FC<TodayAutomationRunCardProps> = ({
  activeSearchConfig,
  onLaunchDryRun,
  isTriggering = false,
}) => {
  const maxJobs = 5;

  return (
    <div
      className="card today-automation-card"
      style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '20px 22px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Today's Automation Run
          </h2>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#15803D',
              backgroundColor: '#DCFCE7',
              padding: '2px 8px',
              borderRadius: '9999px',
            }}
          >
            Ready to Run
          </span>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
          {activeSearchConfig?.keywords
            ? `Targeting ${activeSearchConfig.keywords} in ${activeSearchConfig.location || 'preferred locations'}.`
            : 'Automated Easy Apply submission and role qualification scoring.'}
        </p>

        {/* Criteria Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F8FAFC',
            borderRadius: '8px',
            border: '1px solid var(--border-light)',
            padding: '10px 14px',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: 'var(--text-main)' }}>
            <FileText size={14} color="var(--primary)" /> {maxJobs} jobs
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={14} /> Expected time: ~3 minutes
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#16A34A', fontWeight: 600 }}>
            <ShieldCheck size={14} color="#16A34A" /> No submission
          </span>
        </div>
      </div>

      {/* 1-Click Launch Button */}
      <button
        type="button"
        onClick={onLaunchDryRun}
        disabled={isTriggering}
        style={{
          width: '100%',
          background: 'var(--primary)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          minHeight: '42px',
          padding: '11px 16px',
          fontSize: '0.88rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: isTriggering ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.15s ease',
        }}
      >
        {isTriggering ? (
          <>
            <Loader2 size={16} className="spin-animation" />
            <span>Initiating Dry Run...</span>
          </>
        ) : (
          <>
            <Play size={16} fill="#ffffff" />
            <span>Launch 1-Click Dry Run ({maxJobs} Jobs)</span>
          </>
        )}
      </button>
    </div>
  );
};
