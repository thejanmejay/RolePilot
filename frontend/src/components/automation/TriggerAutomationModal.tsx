import React, { useState, useEffect } from 'react';
import {
  Bot,
  Play,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  XCircle,
  Check,
  Lock,
  RotateCw,
  Unlink,
} from 'lucide-react';
import { Modal } from '../Modal';
import { jobsApi } from '../../api/jobs';
import { automationApi } from '../../api/automation';
import { profileApi } from '../../api/profile';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage, getStructuredApiError, type StructuredApiError } from '../../api/client';
import type { SearchConfig } from '../../types/job';
import type { AutomationRun } from '../../types/automation';
import type { Profile, Resume } from '../../types/profile';
import { linkedinApi } from '../../api/linkedin';
import { LinkedInConsentModal } from '../linkedin/LinkedInConsentModal';
import { calculateApplicationReadiness, type ApplicationReadiness } from '../../utils/readiness';
import { PLATFORM_CATALOG, type PlatformId, type PlatformConfig } from '../../types/platform';
import { Badge } from '../common/Badge';

interface TriggerAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunTriggered: (run: AutomationRun) => void;
  onNavigateTab?: (tab: 'profile' | 'jobs' | 'applications' | 'automation') => void;
}

type StepNumber = 1 | 2 | 3 | 4;

export const TriggerAutomationModal: React.FC<TriggerAutomationModalProps> = ({
  isOpen,
  onClose,
  onRunTriggered,
  onNavigateTab,
}) => {
  const { showSuccess, showError } = useToast();

  // Wizard Step State (1: Preferences -> 2: Platform -> 3: Safeguards & Config -> 4: Review & Launch)
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);

  // Form inputs preserved throughout navigation
  const [configs, setConfigs] = useState<SearchConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>('linkedin');
  const [maxJobs, setMaxJobs] = useState<number>(20);
  const [dryRun, setDryRun] = useState<boolean>(true);
  const [allowLiveSubmission, setAllowLiveSubmission] = useState<boolean>(false);
  const [liveConfirmationToken, setLiveConfirmationToken] = useState<string>('');
  
  // Data State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [structuredError, setStructuredError] = useState<StructuredApiError | null>(null);

  // Platform & Consent State
  const [isLinkedInConnected, setIsLinkedInConnected] = useState<boolean>(false);
  const [isLinkedInConsentOpen, setIsLinkedInConsentOpen] = useState<boolean>(false);
  const [linkedinProfileUrl, setLinkedinProfileUrl] = useState<string | null>(null);

  // Application Readiness State
  const [readiness, setReadiness] = useState<ApplicationReadiness | null>(null);

  // Connection management state
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);

  const checkPlatformConnection = async () => {
    try {
      const status = await linkedinApi.getStatus();
      setIsLinkedInConnected(Boolean(status?.is_connected && status?.status === 'connected' && status?.has_consent));
      setLinkedinProfileUrl(status?.linkedin_profile_url || null);
    } catch {
      setIsLinkedInConnected(false);
    }
  };

  const handleDisconnectSession = async () => {
    if (!window.confirm('Are you sure you want to disconnect your LinkedIn session? You will need to reconnect before running automation.')) {
      return;
    }
    setIsDisconnecting(true);
    try {
      await linkedinApi.disconnect();
      setIsLinkedInConnected(false);
      setLinkedinProfileUrl(null);
      showSuccess('LinkedIn session disconnected successfully.');
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleCheckConnection = async () => {
    setIsCheckingConnection(true);
    try {
      const status = await linkedinApi.getStatus();
      const connected = Boolean(status?.is_connected && status?.status === 'connected' && status?.has_consent);
      setIsLinkedInConnected(connected);
      setLinkedinProfileUrl(status?.linkedin_profile_url || null);
      if (connected) {
        showSuccess('LinkedIn connection verified!');
        setError(null);
      } else {
        setError('LinkedIn session not detected or expired. Please connect your li_at session cookie.');
      }
    } catch (err) {
      setError('Failed to verify LinkedIn connection: ' + formatErrorMessage(err));
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const handlePlatformSelect = (plat: PlatformConfig) => {
    if (!plat.isSupported) {
      setError(`${plat.name} is coming soon and cannot be selected for automation.`);
      return;
    }
    setSelectedPlatform(plat.id);
    setError(null);
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setIsLoadingConfigs(true);
      setError(null);
      setStructuredError(null);
      setAllowLiveSubmission(false);
      setLiveConfirmationToken('');
      setIsLinkedInConsentOpen(false);

      Promise.all([
        jobsApi.getSearchConfigs().catch(() => [] as SearchConfig[]),
        profileApi.getProfile().catch(() => null as Profile | null),
        profileApi.getResumes().catch(() => [] as Resume[]),
        checkPlatformConnection(),
      ])
        .then(([configsData, profileData, resumesData]) => {
          setConfigs(configsData);
          setProfile(profileData);
          setResumes(resumesData);
          if (configsData.length > 0) {
            const active = configsData.find((c) => c.is_active) || configsData[0];
            setSelectedConfigId(active.id);
          }
          const computedReadiness = calculateApplicationReadiness(profileData, resumesData, configsData);
          setReadiness(computedReadiness);
        })
        .catch((err) => setError(formatErrorMessage(err)))
        .finally(() => setIsLoadingConfigs(false));
    }
  }, [isOpen]);

  const selectedConfig = configs.find((c) => c.id === selectedConfigId) || configs[0] || null;

  const executeAutomationRun = async () => {
    setIsSubmitting(true);
    setError(null);
    setStructuredError(null);
    try {
      const run = await automationApi.createRun({
        search_config_id: selectedConfigId || undefined,
        max_jobs: maxJobs,
        dry_run: dryRun,
        allow_live_submission: !dryRun && allowLiveSubmission,
        live_submission_confirmation: !dryRun ? liveConfirmationToken.trim() : undefined,
      });

      showSuccess(dryRun ? 'RolePilot dry-run automation started in background!' : 'RolePilot LIVE automation started!');
      onRunTriggered(run);
      onClose();
    } catch (err) {
      const struct = getStructuredApiError(err);
      setStructuredError(struct);
      const msg = struct?.message || formatErrorMessage(err);
      setError(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextStep = async () => {
    setError(null);
    setStructuredError(null);

    if (currentStep === 1) {
      // Step 1: Validate preferences
      if (!selectedConfigId && configs.length > 0) {
        setSelectedConfigId(configs[0].id);
      }
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      // Step 2: Validate platform connection
      if (selectedPlatform !== 'linkedin') {
        setError(`${selectedPlatform} is coming soon. Please select LinkedIn.`);
        return;
      }

      // Check status again
      const status = await linkedinApi.getStatus().catch(() => null);
      if (!status?.is_connected || !status?.has_consent || status?.status === 'expired') {
        setIsLinkedInConsentOpen(true);
        return;
      }

      setIsLinkedInConnected(true);
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      // Step 3: Validate run configuration and safety rules
      if (!dryRun) {
        if (readiness && readiness.blockers.length > 0) {
          setError(`Cannot proceed in LIVE mode with active blockers: ${readiness.blockers.join(', ')}. Please resolve them or select Dry Run mode.`);
          return;
        }

        if (!allowLiveSubmission || liveConfirmationToken.trim() !== 'CONFIRM_REAL_SUBMISSION') {
          setError('Triple-Key Safety Guard: You must check "allow live submission" and type CONFIRM_REAL_SUBMISSION exactly.');
          return;
        }
      }

      setCurrentStep(4);
      return;
    }

    if (currentStep === 4) {
      // Step 4: Final submission gate
      handleSubmit();
    }
  };

  const handlePrevStep = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as StepNumber);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    // Enforce safety guard invariants
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
      // Verify LinkedIn connection & consent lifecycle
      const linkedinStatus = await linkedinApi.getStatus().catch(() => null);
      if (!linkedinStatus?.is_connected || !linkedinStatus?.has_consent || linkedinStatus?.status === 'expired') {
        setIsLinkedInConsentOpen(true);
        setIsSubmitting(false);
        return;
      }

      await executeAutomationRun();
    } catch (err) {
      const msg = formatErrorMessage(err);
      setError(msg);
      showError(msg);
      setIsSubmitting(false);
    }
  };

  const handleFixBlockersClick = () => {
    onClose();
    if (onNavigateTab) {
      onNavigateTab('profile');
    }
  };

  const stepsList = [
    { num: 1, label: 'Preferences' },
    { num: 2, label: 'Platform' },
    { num: 3, label: 'Config & Safeguards' },
    { num: 4, label: 'Review & Launch' },
  ];

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Launch RolePilot Automation Setup" maxWidth="660px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Multi-step progress bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              gap: '6px',
            }}
          >
            {stepsList.map((step) => {
              const isPast = step.num < currentStep;
              const isCurrent = step.num === currentStep;

              return (
                <div
                  key={step.num}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent
                      ? 'var(--primary, #1769c2)'
                      : isPast
                      ? 'var(--success, #16a34a)'
                      : '#94a3b8',
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: isCurrent
                        ? 'var(--primary, #1769c2)'
                        : isPast
                        ? 'var(--success, #16a34a)'
                        : '#e2e8f0',
                      color: isCurrent || isPast ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}
                  >
                    {isPast ? <Check size={12} /> : step.num}
                  </div>
                  <span className="step-label" style={{ display: 'none' }}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Error Banner */}
          {error && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg, #fee2e2)',
                border: '1px solid var(--danger-border, #fca5a5)',
                color: 'var(--danger, #dc2626)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md, 8px)',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>
                    {structuredError?.title || (
                      structuredError?.errorCode === 'LINKEDIN_SESSION_EXPIRED' ||
                      error.toLowerCase().includes('session')
                        ? 'LinkedIn session expired'
                        : 'Validation Error'
                    )}
                  </div>
                  <div style={{ lineHeight: 1.4 }}>
                    {structuredError?.message || error}
                  </div>
                </div>
              </div>

              {(structuredError?.errorCode === 'LINKEDIN_SESSION_EXPIRED' ||
                structuredError?.errorCode === 'LINKEDIN_SESSION_INVALID' ||
                structuredError?.errorCode === 'LINKEDIN_SESSION_MISSING' ||
                error.toLowerCase().includes('reconnect your linkedin') ||
                error.toLowerCase().includes('session is no longer valid')) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLinkedInConsentOpen(true);
                    }}
                    className="btn btn-danger btn-sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      backgroundColor: 'var(--danger, #dc2626)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 'var(--radius-sm, 4px)',
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCw size={14} />
                    <span>Reconnect LinkedIn</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 1: Reused Profile & Search Preferences */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  backgroundColor: 'var(--primary-light, #eff6ff)',
                  border: '1px solid var(--primary-border, #bfdbfe)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '12px 14px',
                  fontSize: '0.84rem',
                  color: 'var(--primary-hover, #1257a5)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <Bot size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Step 1: Reuse Saved Profile & Job Preferences</strong>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', lineHeight: '1.4' }}>
                    RolePilot reuses your saved candidate resume, experience history, and screening criteria to automatically populate job applications.
                  </p>
                </div>
              </div>

              {/* Profile Readiness Callout */}
              {readiness && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: readiness.ready
                      ? '1px solid #bbf7d0'
                      : readiness.blockers.length > 0
                      ? '1px solid var(--danger-border, #fecaca)'
                      : '1px solid #fde68a',
                    backgroundColor: readiness.ready
                      ? 'var(--success-bg, #dcfce7)'
                      : readiness.blockers.length > 0
                      ? 'var(--danger-bg, #fee2e2)'
                      : '#fef3c7',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 700 }}>
                      {readiness.ready ? (
                        <>
                          <CheckCircle2 size={16} color="var(--success, #16a34a)" />
                          <span style={{ color: 'var(--success, #16a34a)' }}>Profile Verified ({readiness.score}% Ready)</span>
                        </>
                      ) : readiness.blockers.length > 0 ? (
                        <>
                          <XCircle size={16} color="var(--danger, #dc2626)" />
                          <span style={{ color: 'var(--danger, #dc2626)' }}>
                            {readiness.blockers.length} Blocker{readiness.blockers.length === 1 ? '' : 's'} Detected ({readiness.score}%)
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={16} color="#d97706" />
                          <span style={{ color: '#d97706' }}>Profile Almost Ready ({readiness.score}%)</span>
                        </>
                      )}
                    </div>

                    {readiness.blockers.length > 0 && onNavigateTab && (
                      <button
                        type="button"
                        onClick={handleFixBlockersClick}
                        className="btn btn-outline"
                        style={{ fontSize: '0.72rem', padding: '3px 8px', borderColor: 'var(--danger, #dc2626)', color: 'var(--danger, #dc2626)' }}
                      >
                        <span>Fix in Profile</span>
                        <ArrowRight size={11} style={{ marginLeft: '4px' }} />
                      </button>
                    )}
                  </div>

                  {readiness.blockers.length > 0 && (
                    <div style={{ fontSize: '0.76rem', color: 'var(--danger, #dc2626)', marginTop: '4px' }}>
                      Screening Blockers: {readiness.blockers.join(' • ')}.
                      <div style={{ marginTop: '3px', fontSize: '0.72rem', color: '#64748b' }}>
                        Safe Dry Run mode remains available to test qualification matching without submitting.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Active Candidate Info Card */}
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Candidate:</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>
                    {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : 'Saved Profile'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Active Resume:</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>
                    {resumes.find((r) => r.is_active)?.file_name || resumes[0]?.file_name || 'No resume uploaded'}
                  </span>
                </div>
              </div>

              {/* Search Criteria Selector */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  Active Job Search Criteria
                </label>
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
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    No custom search configurations found. Default keywords will be used.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Platform Selection & Verification */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#111827' }}>
                  Step 2: Select & Verify Job Platform
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Choose a supported job platform integration for this automation run.
                </p>
              </div>

              {/* Platform Choice Cards Grid */}
              <div className="platform-card-grid" role="radiogroup" aria-label="Job platform selection">
                {PLATFORM_CATALOG.map((plat) => {
                  const isSelected = selectedPlatform === plat.id && plat.isSupported;

                  return (
                    <div
                      key={plat.id}
                      role="radio"
                      aria-checked={isSelected}
                      aria-disabled={!plat.isSupported}
                      tabIndex={plat.isSupported ? 0 : -1}
                      onClick={() => handlePlatformSelect(plat)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handlePlatformSelect(plat);
                        }
                      }}
                      className={`platform-integration-card ${plat.isSupported ? 'supported' : 'unavailable'} ${isSelected ? 'selected' : ''}`}
                    >
                      {/* Card Header: Icon + Availability Badge */}
                      <div className="platform-card-header">
                        <div className={`platform-icon-box ${plat.id}`}>
                          {plat.id === 'linkedin' ? 'in' : plat.id === 'indeed' ? 'I' : 'W'}
                        </div>
                        <Badge variant={plat.isSupported ? 'primary' : 'neutral'} size="sm">
                          {plat.isSupported ? 'Available' : 'Coming Soon'}
                        </Badge>
                      </div>

                      {/* Card Body: Name + Capabilities Tagline */}
                      <div className="platform-card-body">
                        <div className="platform-card-name">
                          <span>{plat.name}</span>
                        </div>
                        <p className="platform-card-description">
                          {plat.tagline}
                        </p>
                      </div>

                      {/* Card Footer: Connection Status & Selection Indicator */}
                      <div className="platform-card-footer">
                        <div>
                          {plat.isSupported ? (
                            isLinkedInConnected ? (
                              <Badge variant="success" size="sm">
                                <ShieldCheck size={12} style={{ marginRight: '3px' }} />
                                Connected
                              </Badge>
                            ) : (
                              <Badge variant="warning" size="sm">
                                Connection Required
                              </Badge>
                            )
                          ) : (
                            <Badge variant="neutral" size="sm">
                              Not Connected
                            </Badge>
                          )}
                        </div>

                        <div
                          className={`platform-select-radio ${isSelected ? 'selected' : ''}`}
                          aria-hidden="true"
                        >
                          {isSelected && <div className="platform-select-radio-dot" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dedicated Account Connection Experience Panel for Selected Platform */}
              {selectedPlatform === 'linkedin' && (
                <div className={`platform-connection-panel ${isLinkedInConnected ? 'success' : 'warning'}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        {isLinkedInConnected ? (
                          <ShieldCheck size={16} color="var(--success, #16a34a)" style={{ flexShrink: 0 }} />
                        ) : (
                          <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
                        )}
                        <strong style={{ fontSize: '0.84rem' }}>
                          {isLinkedInConnected ? 'LinkedIn Session Connected & Ready' : 'LinkedIn Connection Required'}
                        </strong>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: '1.4' }}>
                        {isLinkedInConnected ? (
                          <>
                            Authenticated session active for autonomous Easy Apply submissions and qualification audits.
                            {linkedinProfileUrl && (
                              <span style={{ display: 'block', marginTop: '3px', fontWeight: 600 }}>
                                Profile: {linkedinProfileUrl}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            A verified LinkedIn session (<code>li_at</code> cookie) is required before running automation. Session credentials are encrypted on the server and never logged or exposed.
                          </>
                        )}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                      {isLinkedInConnected ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsLinkedInConsentOpen(true)}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '5px 12px', minHeight: '32px' }}
                          >
                            Update Session
                          </button>
                          <button
                            type="button"
                            onClick={handleDisconnectSession}
                            disabled={isDisconnecting}
                            className="btn btn-outline"
                            style={{
                              fontSize: '0.75rem',
                              padding: '5px 10px',
                              minHeight: '32px',
                              borderColor: 'var(--danger, #dc2626)',
                              color: 'var(--danger, #dc2626)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Disconnect and wipe stored session"
                          >
                            <Unlink size={13} />
                            <span>{isDisconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleCheckConnection}
                            disabled={isCheckingConnection}
                            className="btn btn-secondary"
                            style={{
                              fontSize: '0.75rem',
                              padding: '5px 10px',
                              minHeight: '32px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Check existing session connection"
                          >
                            <RotateCw size={13} className={isCheckingConnection ? 'spin' : ''} />
                            <span>{isCheckingConnection ? 'Checking...' : 'Check Status'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsLinkedInConsentOpen(true)}
                            className="btn btn-primary"
                            style={{ fontSize: '0.75rem', padding: '5px 12px', minHeight: '32px' }}
                          >
                            Connect LinkedIn
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Run Configuration & Safeguards */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: '#111827' }}>
                  Step 3: Run Settings & Submission Safeguards
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Configure maximum application count and verify execution safety rules.
                </p>
              </div>

              {/* Max Jobs Input */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  Max Jobs to Process in This Run (1 - 100)
                </label>
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
                <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '3px', display: 'block' }}>
                  LinkedIn recommended daily limit: 15–30 applications to protect account reputation.
                </span>
              </div>

              {/* Dry Run / Live Mode Toggle & Triple-Key Guard */}
              <div
                style={{
                  padding: '14px',
                  backgroundColor: dryRun ? '#f8fafc' : '#fff3f3',
                  borderRadius: '8px',
                  border: dryRun ? '1px solid #e2e8f0' : '1px solid #ffc9c9',
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
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={16} color="var(--primary, #1769c2)" />
                      <span>Dry Run Mode (Recommended for testing)</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                      Collects matching jobs, evaluates forms, and stops at Review screen without submitting.
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
                    <div style={{ fontSize: '0.82rem', color: '#c92a2a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lock size={14} />
                      <span>Triple-Key Safety Guard: Real LinkedIn Submissions</span>
                    </div>

                    {readiness && readiness.blockers.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--danger, #dc2626)', backgroundColor: '#ffffff', padding: '6px 10px', borderRadius: '4px', border: '1px solid #ffc9c9' }}>
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
            </div>
          )}

          {/* STEP 4: Review & Launch */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: '#111827' }}>
                  Step 4: Review Run Parameters & Launch
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Confirm all automation parameters before queueing the background worker.
                </p>
              </div>

              {/* Review Card */}
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Target Platform:</span>
                  <span style={{ fontWeight: 700, color: '#0A66C2' }}>LinkedIn (Easy Apply)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Search Criteria:</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>
                    {selectedConfig ? `${selectedConfig.keywords} (${selectedConfig.location || 'Any'})` : 'Default'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Job Batch Limit:</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{maxJobs} jobs</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Execution Mode:</span>
                  <Badge variant={dryRun ? 'primary' : 'danger'} size="sm">
                    {dryRun ? 'Dry Run (Safe Validation)' : 'LIVE SUBMISSION'}
                  </Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Safety Status:</span>
                  <span style={{ fontWeight: 700, color: dryRun ? '#166534' : '#b91c1c' }}>
                    {dryRun ? 'Triple-Key Safeguarded' : 'Triple-Key Live Authorized'}
                  </span>
                </div>
              </div>

              {/* Clarification banner: Run created != Application submitted */}
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  color: '#1e40af',
                  lineHeight: 1.45,
                }}
              >
                ℹ️ <strong>Execution Notice:</strong> Starting an automation run queues a background Playwright worker. A started run evaluates qualifications and fills forms — it does <strong>not</strong> count as a submitted application until verified by the runner.
              </div>
            </div>
          )}

          {/* Stepper Navigation Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '10px',
              paddingTop: '12px',
              borderTop: '1px solid #e2e8f0',
              gap: '10px',
            }}
          >
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={isSubmitting}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '8px 14px', minHeight: '38px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '8px 14px', minHeight: '38px' }}
              >
                Cancel
              </button>
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                disabled={
                  isSubmitting ||
                  (currentStep === 2 && (!isLinkedInConnected || selectedPlatform !== 'linkedin'))
                }
                className="btn btn-primary"
                style={{ fontSize: '0.84rem', padding: '8px 16px', minHeight: '38px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title={
                  currentStep === 2 && (!isLinkedInConnected || selectedPlatform !== 'linkedin')
                    ? 'Connect LinkedIn session before continuing'
                    : undefined
                }
              >
                <span>Continue</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || (!dryRun && readiness != null && readiness.blockers.length > 0)}
                className="btn btn-primary"
                style={{
                  fontSize: '0.84rem',
                  padding: '8px 18px',
                  minHeight: '38px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: dryRun ? 'var(--primary, #1769c2)' : '#dc2626',
                  borderColor: dryRun ? 'var(--primary, #1769c2)' : '#dc2626',
                }}
              >
                <Play size={15} />
                <span>{isSubmitting ? 'Starting Runner...' : dryRun ? 'Launch Dry Run' : 'Launch LIVE Automation'}</span>
              </button>
            )}
          </div>
        </div>
      </Modal>

      <LinkedInConsentModal
        isOpen={isLinkedInConsentOpen}
        onClose={() => setIsLinkedInConsentOpen(false)}
        onConsentSuccess={() => {
          setIsLinkedInConsentOpen(false);
          setIsLinkedInConnected(true);
          checkPlatformConnection();
        }}
        onCancel={() => {
          setIsLinkedInConsentOpen(false);
        }}
      />
    </>
  );
};
