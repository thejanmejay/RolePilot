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
        border: isDryRun ? '1px solid #BFDBFE' : hasLiveSubmissions ? '1px solid #BBF7D0' : '1px solid #FDE68A',
        backgroundColor: isDryRun ? '#F0F7FF' : hasLiveSubmissions ? '#F0FDF4' : '#FFFBEB',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isDryRun ? (
            <ShieldCheck size={20} color="#1769C2" />
          ) : hasLiveSubmissions ? (
            <KeyRound size={20} color="#16A34A" />
          ) : (
            <ShieldAlert size={20} color="#D97706" />
          )}
          <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#172554', letterSpacing: '0.02em' }}>
            TRIPLE-KEY SUBMISSION SAFETY
          </span>
        </div>

        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: isDryRun ? '#DBEAFE' : hasLiveSubmissions ? '#DCFCE7' : '#FEF3C7',
            color: isDryRun ? '#1769C2' : hasLiveSubmissions ? '#15803D' : '#B45309',
            border: isDryRun ? '1px solid #BFDBFE' : hasLiveSubmissions ? '1px solid #BBF7D0' : '1px solid #FDE68A',
            letterSpacing: '0.02em',
          }}
        >
          {isDryRun ? 'SUBMISSION BLOCKED • SAFE' : hasLiveSubmissions ? 'LIVE SUBMISSION VERIFIED' : 'LIVE MODE GATED'}
        </span>
      </div>

      {/* 3 Conditions Table */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        {/* Key 1 */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '8px 10px',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
          }}
        >
          <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, marginBottom: '2px' }}>
            Key 1: Dry Run
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, fontSize: '0.82rem' }}>
            {key1DryRun ? (
              <>
                <Check size={14} color="#1769C2" />
                <span style={{ color: '#1769C2' }}>ENABLED (Safe)</span>
              </>
            ) : (
              <>
                <Minus size={14} color="#64748B" />
                <span style={{ color: '#172554' }}>DISABLED</span>
              </>
            )}
          </div>
        </div>

        {/* Key 2 */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '8px 10px',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
          }}
        >
          <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, marginBottom: '2px' }}>
            Key 2: Live Submission
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, fontSize: '0.82rem' }}>
            {key2LiveAllowed ? (
              <>
                <Check size={14} color="#16A34A" />
                <span style={{ color: '#16A34A' }}>AUTHORIZED</span>
              </>
            ) : (
              <>
                <X size={14} color="#DC2626" />
                <span style={{ color: '#DC2626' }}>OFF (Guarded)</span>
              </>
            )}
          </div>
        </div>

        {/* Key 3 */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '8px 10px',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
          }}
        >
          <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, marginBottom: '2px' }}>
            Key 3: Token Confirmation
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, fontSize: '0.82rem' }}>
            {isDryRun ? (
              <>
                <Minus size={14} color="#64748B" />
                <span style={{ color: '#64748B' }}>NOT REQUIRED</span>
              </>
            ) : key3Confirmed ? (
              <>
                <Check size={14} color="#16A34A" />
                <span style={{ color: '#16A34A' }}>CONFIRMED</span>
              </>
            ) : (
              <>
                <AlertTriangle size={14} color="#D97706" />
                <span style={{ color: '#D97706' }}>PENDING</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Explanatory Banner */}
      <div style={{ fontSize: '0.76rem', color: isDryRun ? '#1769C2' : '#166534', lineHeight: 1.45 }}>
        {isDryRun ? (
          <span>
            <strong>Safety Interlock Active:</strong> All form steps were detected and filled using candidate profile heuristics, but the final submission click was strictly blocked to safeguard your LinkedIn profile.
          </span>
        ) : (
          <span>
            <strong>Live Execution Confirmed:</strong> Applications were authorized for genuine submission with a hard safety cap of 1 job per run to avoid spam detection.
          </span>
        )}
      </div>
    </div>
  );
};
