import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Send,
  Eye,
  FileCheck,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import type { AutomationLog } from '../../types/automation';
import type { Application } from '../../api/applications';

interface TelemetryTimelineProps {
  logs: AutomationLog[];
  selectedApplication?: Application | null;
  dryRun?: boolean;
}

interface MilestoneStep {
  id: string;
  stepNumber: string;
  title: string;
  subtitle: string;
  status: 'completed' | 'blocked' | 'failed' | 'in_progress';
  timestamp?: string;
  metadata?: Record<string, any>;
  icon: React.ElementType;
}

export const TelemetryTimeline: React.FC<TelemetryTimelineProps> = ({
  logs,
  selectedApplication,
  dryRun = true,
}) => {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  // Derive milestone steps from logs or application state
  const milestones: MilestoneStep[] = [];

  // Check logs for specific event markers
  const sessionLog = logs.find((l) => l.event.includes('SESSION') || l.event.includes('HEALTH'));
  const jobLog = logs.find((l) => l.event.includes('JOB_DISCOVERED') || l.event.includes('DISCOVERY'));
  const modalLog = logs.find((l) => l.event.includes('MODAL_OPENED') || l.event.includes('EASY_APPLY'));
  const stepLogs = logs.filter((l) => l.event.includes('STEP') || l.event.includes('FIELDS'));
  const reviewLog = logs.find((l) => l.event.includes('REVIEW'));
  const blockedLog = logs.find((l) => l.event.includes('DRY_RUN_SUBMIT_BLOCKED') || l.event.includes('BLOCKED'));
  const submitLog = logs.find((l) => l.event.includes('SUBMISSION_CONFIRMED') || l.event.includes('SUBMITTED'));
  const failedLog = logs.find((l) => l.event.includes('FAILED') || l.level === 'error');

  // Step 1: Session Verification
  milestones.push({
    id: 'session',
    stepNumber: '01',
    title: 'LinkedIn Session Health Verified',
    subtitle: sessionLog?.message || 'Authenticated session restored via cookies with stealth plugins active',
    status: 'completed',
    timestamp: sessionLog?.created_at,
    metadata: sessionLog?.metadata_json || undefined,
    icon: CheckCircle2,
  });

  // Step 2: Job Discovery & Qualification
  milestones.push({
    id: 'discovery',
    stepNumber: '02',
    title: 'Job Discovered & Qualified',
    subtitle: selectedApplication?.job?.title
      ? `${selectedApplication.job.title} at ${selectedApplication.job.company || 'Target Employer'}`
      : jobLog?.message || 'Matching posting identified via virtualized DOM collector',
    status: 'completed',
    timestamp: jobLog?.created_at,
    metadata: jobLog?.metadata_json || undefined,
    icon: Eye,
  });

  // Step 3: Easy Apply Detection
  milestones.push({
    id: 'easy_apply',
    stepNumber: '03',
    title: 'Easy Apply Modal Detected',
    subtitle: modalLog?.message || 'Multi-step application modal verified and launched',
    status: 'completed',
    timestamp: modalLog?.created_at,
    metadata: modalLog?.metadata_json || undefined,
    icon: FileCheck,
  });

  // Step 4+: Form Steps if available in logs
  if (stepLogs.length > 0) {
    stepLogs.slice(0, 3).forEach((sLog, i) => {
      const stepMeta = sLog.metadata_json || {};
      const fieldsFilled = stepMeta.fields_filled || stepMeta.fields_detected || 'all';
      milestones.push({
        id: `form_step_${i + 1}`,
        stepNumber: `0${4 + i}`,
        title: `Wizard Step ${i + 1} Evaluated`,
        subtitle: `${fieldsFilled} fields detected & populated via profile heuristics`,
        status: 'completed',
        timestamp: sLog.created_at,
        metadata: stepMeta,
        icon: Sparkles,
      });
    });
  } else {
    milestones.push({
      id: 'form_steps_agg',
      stepNumber: '04',
      title: 'Form Fields & Heuristics Populated',
      subtitle: 'Contact info, experience tenure, notice period, and resume PDF uploaded',
      status: 'completed',
      icon: Sparkles,
    });
  }

  // Next: Review Screen Reached
  const reviewStepNum = `0${milestones.length + 1}`;
  milestones.push({
    id: 'review',
    stepNumber: reviewStepNum,
    title: 'Review Screen Inspection Completed',
    subtitle: reviewLog?.message || 'Final summary reviewed for validation warnings and required disclaimers',
    status: 'completed',
    timestamp: reviewLog?.created_at,
    metadata: reviewLog?.metadata_json || undefined,
    icon: CheckCircle2,
  });

  // Next: Final Submission Guard / Execution
  const finalStepNum = `0${milestones.length + 1}`;
  if (dryRun || blockedLog) {
    milestones.push({
      id: 'safety_block',
      stepNumber: finalStepNum,
      title: 'Dry-Run Guard Triggered: Final Submit Blocked',
      subtitle: 'Modal cleanly dismissed without live submission; telemetry captured successfully',
      status: 'blocked',
      timestamp: blockedLog?.created_at,
      metadata: blockedLog?.metadata_json || { dry_run: true, submission_blocked: true, submission_confirmed: false },
      icon: ShieldCheck,
    });
  } else if (submitLog) {
    milestones.push({
      id: 'live_submit',
      stepNumber: finalStepNum,
      title: 'Live Submission Confirmed',
      subtitle: submitLog.message || 'Application submitted with LinkedIn confirmation modal verified',
      status: 'completed',
      timestamp: submitLog.created_at,
      metadata: submitLog.metadata_json || { submission_confirmed: true },
      icon: Send,
    });
  } else if (failedLog) {
    milestones.push({
      id: 'failure',
      stepNumber: finalStepNum,
      title: 'Execution Error Encountered',
      subtitle: failedLog.message || 'Run halted due to unexpected modal structure or network error',
      status: 'failed',
      timestamp: failedLog.created_at,
      metadata: failedLog.metadata_json || undefined,
      icon: XCircle,
    });
  }

  const toggleExpand = (id: string) => {
    setExpandedStepId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Vertical Telemetry Timeline
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Chronological step progression and modal state transitions
          </p>
        </div>

        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: dryRun ? 'var(--primary-light)' : '#dcfce7',
            color: dryRun ? 'var(--primary)' : '#15803d',
          }}
        >
          {milestones.length} Milestones Recorded
        </span>
      </div>

      {/* Vertical Step Rail */}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {milestones.map((step, idx) => {
          const isLast = idx === milestones.length - 1;
          const isExpanded = expandedStepId === step.id;
          const Icon = step.icon;

          const getStatusColor = () => {
            if (step.status === 'blocked') return 'var(--primary)';
            if (step.status === 'failed') return 'var(--danger)';
            return '#16a34a';
          };

          const getStatusBg = () => {
            if (step.status === 'blocked') return 'var(--primary-light)';
            if (step.status === 'failed') return 'var(--danger-bg)';
            return '#dcfce7';
          };

          return (
            <div
              key={step.id}
              style={{
                display: 'flex',
                gap: '14px',
                position: 'relative',
                paddingBottom: isLast ? '0px' : '20px',
              }}
            >
              {/* Vertical connector line */}
              {!isLast && (
                <div
                  style={{
                    position: 'absolute',
                    top: '32px',
                    left: '17px',
                    bottom: '0',
                    width: '2px',
                    backgroundColor: 'var(--border-light)',
                    zIndex: 0,
                  }}
                  aria-hidden="true"
                />
              )}

              {/* Step indicator node */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: getStatusBg(),
                  color: getStatusColor(),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  flexShrink: 0,
                  zIndex: 1,
                  boxShadow: '0 0 0 4px #ffffff',
                }}
              >
                <Icon size={18} />
              </div>

              {/* Step Content */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '8px',
                    cursor: step.metadata ? 'pointer' : 'default',
                  }}
                  onClick={() => step.metadata && toggleExpand(step.id)}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          backgroundColor: 'var(--bg-subtle)',
                          color: 'var(--text-muted)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                        }}
                      >
                        {step.stepNumber}
                      </span>
                      <h4
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {step.title}
                      </h4>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                      {step.subtitle}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {step.timestamp && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={11} />
                        <span>{new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </span>
                    )}

                    {step.metadata && (
                      <button
                        className="btn-icon"
                        style={{ width: '24px', height: '24px', padding: 0 }}
                        title="Toggle Telemetry JSON"
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expandable Metadata JSON Tree */}
                {isExpanded && step.metadata && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      backgroundColor: '#0f172a',
                      borderRadius: 'var(--radius-sm)',
                      color: '#38bdf8',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      overflowX: 'auto',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 700 }}>
                      TELEMETRY PAYLOAD
                    </div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(step.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
