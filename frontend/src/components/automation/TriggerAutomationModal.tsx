import React, { useState, useEffect } from 'react';
import { Bot, Play, ShieldCheck, AlertCircle, AlertTriangle, CheckCircle2, ArrowRight, XCircle } from 'lucide-react';
import { Modal } from '../Modal';
import { jobsApi } from '../../api/jobs';
import { automationApi } from '../../api/automation';
import { profileApi } from '../../api/profile';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';
import type { SearchConfig } from '../../types/job';
import type { AutomationRun } from '../../types/automation';
import type { Profile, Resume } from '../../types/profile';
import { calculateApplicationReadiness, type ApplicationReadiness } from '../../utils/readiness';

interface TriggerAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunTriggered: (run: AutomationRun) => void;
  onNavigateTab?: (tab: 'profile' | 'jobs' | 'applications' | 'automation') => void;
}

export const TriggerAutomationModal: React.FC<TriggerAutomationModalProps> = ({
  isOpen,
  onClose,
  onRunTriggered,
  onNavigateTab,
}) => {
  const { showSuccess, showError } = useToast();
  const [configs, setConfigs] = useState<SearchConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [maxJobs, setMaxJobs] = useState<number>(20);
  const [dryRun, setDryRun] = useState<boolean>(true);
  const [allowLiveSubmission, setAllowLiveSubmission] = useState<boolean>(false);
  const [liveConfirmationToken, setLiveConfirmationToken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Application Readiness State
  const [readiness, setReadiness] = useState<ApplicationReadiness | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingConfigs(true);
      setError(null);
      setAllowLiveSubmission(false);
      setLiveConfirmationToken('');

      Promise.all([
        jobsApi.getSearchConfigs().catch(() => [] as SearchConfig[]),
        profileApi.getProfile().catch(() => null as Profile | null),
        profileApi.getResumes().catch(() => [] as Resume[]),
      ])
        .then(([configsData, profileData, resumesData]) => {
          setConfigs(configsData);
          if (configsData.length > 0) {
            setSelectedConfigId(configsData[0].id);
          }
          const computedReadiness = calculateApplicationReadiness(profileData, resumesData, configsData);
          setReadiness(computedReadiness);
        })
        .catch((err) => setError(formatErrorMessage(err)))
        .finally(() => setIsLoadingConfigs(false));
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // If attempting live run with blockers, enforce safety guard
    if (!dryRun) {
      if (readiness && readiness.blockers.length > 0) {
        setError(`Cannot start LIVE run with active blockers: ${readiness.blockers.join(', ')}. Please fix your profile or run in Dry Run mode.`);
        setIsSubmitting(false);
        return;
      }

      if (!allowLiveSubmission || liveConfirmationToken.trim() !== 'CONFIRM_REAL_SUBMISSION') {
        setError('Triple-Key Safety Guard: You must check allow live submission and type CONFIRM_REAL_SUBMISSION.');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const run = await automationApi.createRun({
        search_config_id: selectedConfigId || undefined,
        max_jobs: maxJobs,
        dry_run: dryRun,
        allow_live_submission: !dryRun && allowLiveSubmission,
        live_submission_confirmation: !dryRun ? liveConfirmationToken.trim() : undefined,
      });

      showSuccess(dryRun ? 'Hunter dry-run automation started in background!' : 'Hunter LIVE automation started!');
      onRunTriggered(run);
      onClose();
    } catch (err) {
      const msg = formatErrorMessage(err);
      setError(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFixBlockersClick = () => {
    onClose();
    if (onNavigateTab) {
      onNavigateTab('profile');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Launch Hunter Automation Run">
      <form onSubmit={handleSubmit}>
        {/* Playwright Worker Intro */}
        <div
          style={{
            backgroundColor: 'var(--primary-light)',
            border: '1px solid var(--primary-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            fontSize: '0.85rem',
            color: 'var(--primary-hover)',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <Bot size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Playwright Automation Worker</strong>
            <p style={{ margin: '4px 0 0 0', lineHeight: '1.4' }}>
              The Hunter worker searches for jobs matching your criteria, checks candidate qualification, and applies on your behalf.
            </p>
          </div>
        </div>

        {/* Readiness Safeguard Banner */}
        {readiness && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              border: readiness.ready
                ? '1px solid #bbf7d0'
                : readiness.blockers.length > 0
                ? '1px solid var(--danger-border)'
                : '1px solid #fde68a',
              backgroundColor: readiness.ready
                ? 'var(--success-bg)'
                : readiness.blockers.length > 0
                ? 'var(--danger-bg)'
                : '#fef3c7',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700 }}>
                {readiness.ready ? (
                  <>
                    <CheckCircle2 size={16} color="var(--success)" />
                    <span style={{ color: 'var(--success)' }}>Candidate Profile {readiness.score}% Ready</span>
                  </>
                ) : readiness.blockers.length > 0 ? (
                  <>
                    <XCircle size={16} color="var(--danger)" />
                    <span style={{ color: 'var(--danger)' }}>
                      Candidate Profile {readiness.score}% ({readiness.blockers.length} Blocker{readiness.blockers.length === 1 ? '' : 's'})
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} color="#d97706" />
                    <span style={{ color: '#d97706' }}>Candidate Profile {readiness.score}% (Almost Ready)</span>
                  </>
                )}
              </div>

              {readiness.blockers.length > 0 && onNavigateTab && (
                <button
                  type="button"
                  onClick={handleFixBlockersClick}
                  className="btn btn-outline"
                  style={{ fontSize: '0.75rem', padding: '3px 8px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                >
                  <span>Fix in Profile</span>
                  <ArrowRight size={12} style={{ marginLeft: '4px' }} />
                </button>
              )}
            </div>

            {readiness.blockers.length > 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--danger)', marginTop: '4px' }}>
                <span style={{ fontWeight: 600 }}>Screening Blockers: </span>
                {readiness.blockers.join(' • ')}.
                <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Dry Run is still available to test job discovery and qualification heuristics.
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Search Config Selection */}
        <div className="form-group" style={{ marginBottom: '14px' }}>
          <label className="form-label">Search Configuration</label>
          {isLoadingConfigs ? (
            <div className="skeleton" style={{ height: '38px', width: '100%' }} />
          ) : configs.length > 0 ? (
            <select
              value={selectedConfigId}
              onChange={(e) => setSelectedConfigId(e.target.value)}
              className="form-select"
              disabled={isSubmitting}
            >
              {configs.map((cfg) => (
                <option key={cfg.id} value={cfg.id}>
                  {cfg.name || 'Search Config'} ({Array.isArray(cfg.keywords) ? cfg.keywords.join(', ') : cfg.keywords} • {cfg.location || 'Any'})
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-subtle)' }}>
              No custom search configurations found. Using default keywords.
            </div>
          )}
        </div>

        {/* Max Jobs */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">Max Jobs to Process (1 - 100)</label>
          <input
            type="number"
            min={1}
            max={100}
            value={maxJobs}
            onChange={(e) => setMaxJobs(Math.max(1, Math.min(100, Number(e.target.value))))}
            className="input"
            disabled={isSubmitting}
            required
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '4px', display: 'block' }}>
            LinkedIn daily safe recommended limit: 15-30 applications.
          </span>
        </div>

        {/* Dry Run Toggle & Triple-Key Safety Guard */}
        <div
          style={{
            margin: '16px 0',
            padding: '14px',
            backgroundColor: dryRun ? 'var(--bg-subtle, #f8fafc)' : '#fff3f3',
            borderRadius: 'var(--radius-md)',
            border: dryRun ? '1px solid var(--border-light)' : '1px solid #ffc9c9',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => {
                setDryRun(e.target.checked);
                if (e.target.checked) {
                  setAllowLiveSubmission(false);
                  setLiveConfirmationToken('');
                }
              }}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              disabled={isSubmitting}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} color="var(--primary)" />
                <span>Dry Run Mode (Recommended for testing)</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Collects matching jobs, fills forms, and safely stops at Review without submitting.
              </div>
            </div>
          </label>

          {!dryRun && (
            <div
              style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px dashed #ffc9c9',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: '#c92a2a', fontWeight: 600 }}>
                ⚠️ Triple-Key Safety Guard: Real LinkedIn Submissions
              </div>

              {readiness && readiness.blockers.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--danger)', backgroundColor: '#fff', padding: '6px 10px', borderRadius: '4px', border: '1px solid #ffc9c9' }}>
                  Cannot proceed with Live Submission while <strong>{readiness.blockers.length} blocker{readiness.blockers.length === 1 ? '' : 's'}</strong> exist.
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                <input
                  type="checkbox"
                  checked={allowLiveSubmission}
                  onChange={(e) => setAllowLiveSubmission(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                  disabled={isSubmitting || (readiness != null && readiness.blockers.length > 0)}
                />
                <span>I authorize real live application submissions on LinkedIn (allow_live_submission=true)</span>
              </label>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', color: '#c92a2a' }}>
                  Type <code>CONFIRM_REAL_SUBMISSION</code> to unlock:
                </label>
                <input
                  type="text"
                  value={liveConfirmationToken}
                  onChange={(e) => setLiveConfirmationToken(e.target.value)}
                  placeholder="CONFIRM_REAL_SUBMISSION"
                  className="input"
                  style={{ fontSize: '0.8rem', borderColor: '#ffc9c9' }}
                  disabled={isSubmitting || (readiness != null && readiness.blockers.length > 0)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || (!dryRun && readiness != null && readiness.blockers.length > 0)}
          >
            <Play size={16} />
            <span>{isSubmitting ? 'Starting Runner...' : 'Start Automation'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
