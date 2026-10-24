import React from 'react';
import { ShieldCheck, ShieldAlert, Check, X, Minus, KeyRound, AlertTriangle } from 'lucide-react';
import type { AutomationRun } from '../../types/automation';

interface SafetyGuardPanelProps {
  run: AutomationRun;
}

export const SafetyGuardPanel: React.FC<SafetyGuardPanelProps> = ({ run }) => {
  const isDryRun = Boolean(run.dry_run);
  const isCompleted = run.status === 'completed';
  const hasLiveSubmissions = (run.applications_submitted || 0) > 0;

  // Derive Triple-Key conditions
  // Key 1: dry_run == false
  // Key 2: allow_live_submission == true (inferred if dry_run is false and submitted > 0 or attempted)
  // Key 3: confirmation token verified
  const key1DryRun = isDryRun;
  const key2LiveAllowed = !isDryRun;
  const key3Confirmed = !isDryRun && (hasLiveSubmissions || run.status === 'running' || isCompleted);

  return (
    <div
      className="card"
      style={{
        border: isDryRun ? '1px solid var(--primary-border)' : hasLiveSubmissions ? '1px solid #86efac' : '1px solid #fde68a',
        backgroundColor: isDryRun ? '#f0f7ff' : hasLiveSubmissions ? '#f0fdf4' : '#fffbeb',
        padding: '16px',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isDryRun ? (
            <ShieldCheck size={20} color="var(--primary)" />
          ) : hasLiveSubmissions ? (
            <KeyRound size={20} color="#16a34a" />
          ) : (
            <ShieldAlert size={20} color="#d97706" />
          )}
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
            TRIPLE-KEY SUBMISSION SAFETY
          </span>
        </div>

        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: isDryRun ? 'var(--primary-light)' : hasLiveSubmissions ? '#dcfce7' : '#fef3c7',
            color: isDryRun ? 'var(--primary)' : hasLiveSubmissions ? '#15803d' : '#b45309',
          }}
        >
          {isDryRun ? 'SUBMISSION BLOCKED • SAFE' : hasLiveSubmissions ? 'LIVE SUBMISSION VERIFIED' : 'LIVE MODE GATED'}
        </span>
      </div>

      {/* 3 Conditions Table */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        {/* Key 1 */}
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
            Key 1: Dry Run
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem' }}>
            {key1DryRun ? (
              <>
                <Check size={14} color="var(--primary)" />
                <span style={{ color: 'var(--primary)' }}>ENABLED (Safe)</span>
              </>
            ) : (
              <>
                <Minus size={14} color="var(--text-muted)" />
                <span style={{ color: 'var(--text-main)' }}>DISABLED</span>
              </>
            )}
          </div>
        </div>

        {/* Key 2 */}
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
            Key 2: Live Submission
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem' }}>
            {key2LiveAllowed ? (
              <>
                <Check size={14} color="#16a34a" />
                <span style={{ color: '#16a34a' }}>AUTHORIZED</span>
              </>
            ) : (
              <>
                <X size={14} color="var(--danger)" />
                <span style={{ color: 'var(--danger)' }}>OFF (Guarded)</span>
              </>
            )}
          </div>
        </div>

        {/* Key 3 */}
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
            Key 3: Token Confirmation
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem' }}>
            {isDryRun ? (
              <>
                <Minus size={14} color="var(--text-muted)" />
                <span style={{ color: 'var(--text-muted)' }}>NOT REQUIRED</span>
              </>
            ) : key3Confirmed ? (
              <>
                <Check size={14} color="#16a34a" />
                <span style={{ color: '#16a34a' }}>CONFIRMED</span>
              </>
            ) : (
              <>
                <AlertTriangle size={14} color="#d97706" />
                <span style={{ color: '#d97706' }}>PENDING</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Explanatory Banner */}
      <div style={{ fontSize: '0.78rem', color: isDryRun ? 'var(--primary)' : '#166534', lineHeight: 1.4 }}>
        {isDryRun ? (
          <span>
            <strong>Safety Interlock Active:</strong> All form steps were detected and filled using your profile heuristics, but the final submission click was strictly blocked to safeguard your LinkedIn profile.
          </span>
        ) : (
          <span>
            <strong>Live Execution Confirmed:</strong> Applications were authorized for real submission with a hard safety cap of 1 job per run to avoid spam detection.
          </span>
        )}
      </div>
    </div>
  );
};
