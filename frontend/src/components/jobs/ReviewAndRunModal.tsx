import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  FileText,
  Play,
  Lock,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { Modal } from '../Modal';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { useToast } from '../../context/ToastContext';
import { automationApi } from '../../api/automation';
import { linkedinApi } from '../../api/linkedin';
import { formatErrorMessage, getStructuredApiError } from '../../api/client';
import type { Job } from '../../types/job';
import type { Profile, Resume } from '../../types/profile';
import type { AutomationRun } from '../../types/automation';
import { isJobEasyApply } from '../../utils/jobHelpers';

interface ReviewAndRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  queuedJobs: Job[];
  mode: 'dry_run' | 'live';
  profile: Profile | null;
  resumes: Resume[];
  onRunStarted: (run: AutomationRun) => void;
}

export const ReviewAndRunModal: React.FC<ReviewAndRunModalProps> = ({
  isOpen,
  onClose,
  queuedJobs,
  mode,
  profile,
  resumes,
  onRunStarted,
}) => {
  const { showSuccess, showError } = useToast();

  const isLive = mode === 'live';
  const isMultiJobLiveViolation = isLive && queuedJobs.length > 1;
  // Live mode supports exactly 1 job per run; explicit single-job selection is enforced
  const targetJobs = isLive ? queuedJobs.slice(0, 1) : queuedJobs;
  const activeResume = resumes.find((r) => r.is_active) || resumes[0] || null;

  // Triple-Key State (for Live mode only)
  const [key1Toggle, setKey1Toggle] = useState<boolean>(false);
  const [key2Consent, setKey2Consent] = useState<boolean>(false);
  const [key3Confirmation, setKey3Confirmation] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset keys when modal opens
  useEffect(() => {
    if (isOpen) {
      setKey1Toggle(false);
      setKey2Consent(false);
      setKey3Confirmation('');
      setError(null);
    }
  }, [isOpen]);

  const SENTINEL = 'CONFIRM_REAL_SUBMISSION';
  const isTripleKeySatisfied =
    !isLive ||
    (key1Toggle && key2Consent && key3Confirmation.trim() === SENTINEL);

  // Job eligibility evaluation
  const evaluatedJobs = targetJobs.map((job) => {
    const easyApply = isJobEasyApply(job);
    const isEligible = easyApply;
    const exclusionReason = !easyApply
      ? 'External job board listing (manual application only; automated Easy Apply not supported)'
      : null;
    return {
      job,
      easyApply,
      isEligible,
      exclusionReason,
    };
  });

  const eligibleCount = evaluatedJobs.filter((j) => j.isEligible).length;

  const handleSubmit = async () => {
    if (isLive && targetJobs.length !== 1) {
      setError('Live mode strictly requires exactly 1 selected job per run. Multiple-job live submissions are rejected.');
      return;
    }

    if (isLive && !isTripleKeySatisfied) {
      setError('You must complete all three Triple-Key safety steps to authorize a live submission.');
      return;
    }

    if (evaluatedJobs.length === 0) {
      setError('No jobs selected in queue.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Check LinkedIn session status before starting
      const statusData = await linkedinApi.getStatus().catch(() => null);
      if (!statusData?.is_connected || statusData?.status === 'expired') {
        throw new Error('LinkedIn session is expired or disconnected. Reconnect in Settings before launching automation.');
      }

      const jobIds = evaluatedJobs.map((j) => j.job.id);

      const run = await automationApi.createRun({
        selected_synced_job_ids: jobIds,
        resume_id: activeResume?.id,
        dry_run: !isLive,
        max_jobs: isLive ? 1 : jobIds.length,
        allow_live_submission: isLive && key2Consent,
        live_submission_confirmation: isLive ? key3Confirmation.trim() : undefined,
      });

      showSuccess(
        isLive
          ? 'Live application automation run created (1 job targeted).'
          : `Dry-run automation started safely for ${jobIds.length} job${jobIds.length === 1 ? '' : 's'} (no real submission).`
      );

      onRunStarted(run);
      onClose();
    } catch (err) {
      const struct = getStructuredApiError(err);
      const msg = struct?.message || formatErrorMessage(err);
      setError(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isLive ? 'Review & Authorize Live Run' : 'Review & Run Dry-Run Automation'}
      maxWidth="680px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Run Mode Banner */}
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: isLive ? 'var(--warning-bg)' : 'var(--primary-light)',
            border: `1px solid ${isLive ? 'var(--warning-border)' : 'var(--primary-border)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isLive ? (
              <ShieldAlert size={22} color="var(--warning)" />
            ) : (
              <ShieldCheck size={22} color="var(--primary)" />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: isLive ? '#92400E' : 'var(--primary)' }}>
                {isLive ? 'LIVE APPLICATION MODE (Real Submissions)' : 'DRY-RUN SIMULATION MODE (Safe)'}
              </div>
              <div style={{ fontSize: '0.8rem', color: isLive ? '#78350F' : 'var(--text-muted)' }}>
                {isLive
                  ? 'Real applications will be submitted to LinkedIn. Strictly limited to 1 job per run.'
                  : 'Playwright navigates, validates forms, and captures diagnostics. Zero real submissions.'}
              </div>
            </div>
          </div>
          <Badge variant={isLive ? 'warning' : 'primary'} size="sm">
            {isLive ? '1 Job Maximum' : `${queuedJobs.length} Jobs Queued`}
          </Badge>
        </div>

        {isMultiJobLiveViolation && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertCircle size={20} color="#dc2626" />
            <div>
              <strong>Multiple Jobs Queued in Live Mode:</strong> Live mode strictly allows 1 job per run. Close this modal and use the queue drawer to select which specific job to target for live submission.
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Resume Summary */}
        <div className="card" style={{ padding: '16px', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.88rem' }}>
              <FileText size={16} color="var(--primary)" />
              <span>Resume & Candidate Profile</span>
            </div>
            {activeResume ? (
              <Badge variant="success" size="sm">Active Resume</Badge>
            ) : (
              <Badge variant="warning" size="sm">No Resume Uploaded</Badge>
            )}
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            <div>
              <strong>Candidate:</strong> {profile?.first_name} {profile?.last_name || ''} ({profile?.email || 'Authenticated candidate'})
            </div>
            <div>
              <strong>Target Role:</strong> {profile?.target_role || 'Not specified'} {profile?.city ? `· ${profile.city}` : ''}
            </div>
            {activeResume && (
              <div>
                <strong>Associated File:</strong> {activeResume.file_name} (v{activeResume.version})
              </div>
            )}
          </div>
        </div>

        {/* 2. Target Jobs List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Target Jobs in This Run ({evaluatedJobs.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {eligibleCount} of {evaluatedJobs.length} eligible for Easy Apply
            </span>
          </div>

          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#ffffff',
            }}
          >
            {evaluatedJobs.map(({ job, easyApply, exclusionReason }) => (
              <div
                key={job.id}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                    <span>{job.company}</span>
                    <span>•</span>
                    <span>{job.location || 'Remote'}</span>
                    <span>•</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>ID: {job.id.slice(0, 8)}…</span>
                  </div>
                  {exclusionReason && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--warning)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} />
                      <span>{exclusionReason}</span>
                    </div>
                  )}
                </div>

                <div style={{ flexShrink: 0 }}>
                  {easyApply ? (
                    <Badge variant="success" size="sm" icon={<Zap size={10} fill="#15803d" />}>
                      Easy Apply
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm" icon={<ExternalLink size={10} />}>
                      External
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Triple-Key Safety Stepper (ONLY when in Live mode) */}
        {isLive && (
          <div
            className="card"
            style={{
              padding: '18px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              marginBottom: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Lock size={18} color="#b45309" />
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: '#92400E' }}>
                Triple-Key Live-Submission Safety Guard
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#78350F', marginBottom: '14px', lineHeight: 1.4 }}>
              To protect you from unintentional submissions, RolePilot requires explicit confirmation of all three hardware/software interlocks:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Key 1: Dry run disabled */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  color: '#92400E',
                }}
              >
                <input
                  type="checkbox"
                  checked={key1Toggle}
                  onChange={(e) => setKey1Toggle(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong>Key 1:</strong> Disable simulated mode (set <code>dry_run = false</code>).
                </div>
              </label>

              {/* Key 2: Live submission permission */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  color: '#92400E',
                }}
              >
                <input
                  type="checkbox"
                  checked={key2Consent}
                  onChange={(e) => setKey2Consent(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong>Key 2:</strong> Explicitly grant permission to submit a live application for this 1 selected job (<code>allow_live_submission = true</code>).
                </div>
              </label>

              {/* Key 3: Sentinel phrase confirmation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                <label htmlFor="sentinel-input" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#92400E' }}>
                  <strong>Key 3:</strong> Type exact sentinel string <code>{SENTINEL}</code> to confirm:
                </label>
                <input
                  id="sentinel-input"
                  type="text"
                  value={key3Confirmation}
                  onChange={(e) => setKey3Confirmation(e.target.value)}
                  placeholder={SENTINEL}
                  className="input"
                  style={{
                    backgroundColor: '#ffffff',
                    borderColor: key3Confirmation.trim() === SENTINEL ? 'var(--success)' : '#d1d5db',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>

          <Button
            variant={isLive ? 'danger' : 'primary'}
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting || (isLive && (!isTripleKeySatisfied || isMultiJobLiveViolation)) || evaluatedJobs.length === 0}
            leftIcon={isLive ? <Play size={16} fill="#ffffff" /> : <ShieldCheck size={16} />}
          >
            {isLive
              ? 'Authorize & Submit 1 Live Application'
              : `Start Dry-Run Automation (${evaluatedJobs.length} Jobs)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
