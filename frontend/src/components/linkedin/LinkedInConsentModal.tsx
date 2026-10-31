import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { linkedinApi } from '../../api/linkedin';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';
import { useNavigate } from '../../context/NavigationContext';
import type { LinkedInStatus } from '../../types/linkedin';

export interface LinkedInConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConsentSuccess: () => void;
  onCancel?: () => void;
  initialStatus?: LinkedInStatus | null;
}

export const LinkedInConsentModal: React.FC<LinkedInConsentModalProps> = ({
  isOpen,
  onClose,
  onConsentSuccess,
  onCancel,
  initialStatus,
}) => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusData, setStatusData] = useState<LinkedInStatus | null>(initialStatus || null);
  const [sessionTokenInput, setSessionTokenInput] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState<boolean>(false);
  const [showPasswordText, setShowPasswordText] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch / refresh status whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setHasAgreed(false);
      setIsSubmitting(false);
      setErrorMessage(null);
      setValidationError(null);
      setSessionTokenInput('');
      setShowPasswordText(false);

      linkedinApi
        .getStatus()
        .then((data) => {
          setStatusData(data);
          // If disconnected or expired, show token input automatically
          if (!data.is_connected || data.status === 'expired' || data.status === 'disconnected') {
            setShowTokenInput(true);
            setShowGuide(true);
          } else {
            setShowTokenInput(false);
            setShowGuide(false);
          }
        })
        .catch(() => {
          setShowTokenInput(true);
          setShowGuide(true);
        });
    }
  }, [isOpen]);

  // Trap focus and handle Escape key for accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCancel = () => {
    setErrorMessage(null);
    setValidationError(null);
    setSessionTokenInput('');
    onClose();
    if (onCancel) {
      onCancel();
    } else {
      window.location.hash = '';
      if (!window.location.pathname.includes('/dashboard')) {
        navigate('/dashboard');
      }
    }
  };

  const validateTokenFormat = (rawToken: string): boolean => {
    const trimmed = rawToken.trim();
    if (!trimmed) {
      setValidationError('Please paste your LinkedIn li_at cookie value.');
      return false;
    }

    // Check if user accidentally pasted entire cookie string or text with spaces
    if (trimmed.includes(' ') && !trimmed.startsWith('[')) {
      setValidationError('Cookie token contains invalid spaces. Please copy only the Value column of li_at.');
      return false;
    }

    if (trimmed.length < 20 && !trimmed.startsWith('[')) {
      setValidationError('Token appears too short to be a valid LinkedIn session token (minimum 20 characters expected).');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleConnectAndContinue = async () => {
    if (isSubmitting) return; // Duplicate click guard
    setErrorMessage(null);
    setValidationError(null);

    const needsSession = !statusData?.is_connected || statusData?.status === 'expired' || showTokenInput;

    // Step 1: Client-side validation if token input is required
    if (needsSession) {
      if (!validateTokenFormat(sessionTokenInput)) {
        return;
      }
    }

    // Step 2: Consent agreement check
    if (!hasAgreed) {
      setErrorMessage('Please check the box to confirm RolePilot’s LinkedIn access and automation purpose.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 3: If token provided, submit to backend for authenticated Fernet encryption
      if (needsSession) {
        const connectedStatus = await linkedinApi.connect(sessionTokenInput.trim());
        setStatusData(connectedStatus);
        setShowTokenInput(false);
      }

      // Step 4: Record consent policy
      await linkedinApi.submitConsent(true, 'v1.0');
      showSuccess('LinkedIn session verified and automation consent recorded!');
      setSessionTokenInput('');
      onConsentSuccess();
      onClose();
    } catch (err) {
      const msg = formatErrorMessage(err);
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const needsSession = !statusData?.is_connected || statusData?.status === 'expired' || showTokenInput;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="linkedin-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 'clamp(12px, 3vh, 24px) 16px',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: 'var(--card-bg, #ffffff)',
          color: 'var(--text-main, #0f172a)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border-light, #e2e8f0)',
          maxWidth: '540px',
          width: '100%',
          maxHeight: 'min(92vh, 760px)',
          overflowY: 'auto',
          margin: 'auto',
          padding: 'clamp(20px, 4vw, 28px) clamp(16px, 4vw, 24px)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxSizing: 'border-box',
          animation: 'fadeInModal 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                backgroundColor: '#0A66C2',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '1.25rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: 1,
              }}
            >
              in
            </div>
            <div>
              <h2
                id="linkedin-modal-title"
                style={{
                  margin: 0,
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: 'var(--text-main, #0f172a)',
                  letterSpacing: '-0.01em',
                }}
              >
                Connect LinkedIn
              </h2>
              <p
                style={{
                  margin: '3px 0 0 0',
                  fontSize: '0.82rem',
                  color: 'var(--text-muted, #64748b)',
                  lineHeight: 1.4,
                }}
              >
                Connect your LinkedIn session to let RolePilot find relevant jobs and assist with application preparation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            aria-label="Close dialog"
            title="Close"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.84rem',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Session Token Input Panel */}
        {needsSession && (
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                How to connect
              </span>
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary, #1769c2)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <span>{showGuide ? 'Hide Instructions' : 'Show Instructions'}</span>
                {showGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {/* Step-by-Step Instructions Toggle */}
            {showGuide && (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  fontSize: '0.8rem',
                  color: '#334155',
                  lineHeight: 1.5,
                }}
              >
                <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <li>Open LinkedIn in your desktop browser and sign in.</li>
                  <li>Open Developer Tools (<code>F12</code>; on macOS, use Option + Cmd + I).</li>
                  <li>Open the Application tab, or Storage in Firefox.</li>
                  <li>Under Cookies, select <code>https://www.linkedin.com</code>.</li>
                  <li>Find <code>li_at</code> and copy its value.</li>
                </ol>
                <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                  Your session cookie is sensitive. Only connect an account you own. RolePilot must protect this credential and never expose it in logs or the interface.
                </div>
              </div>
            )}

            {/* Input with Show/Hide toggle */}
            <div>
              <label
                htmlFor="linkedin-session-cookie-input"
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  marginBottom: '6px',
                }}
              >
                LinkedIn session cookie (<code>li_at</code>)
              </label>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="linkedin-session-cookie-input"
                  type={showPasswordText ? 'text' : 'password'}
                  placeholder="Paste your li_at value"
                  value={sessionTokenInput}
                  onChange={(e) => {
                    setSessionTokenInput(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: '#ffffff',
                    border: validationError ? '1px solid var(--danger, #dc2626)' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '9px 40px 9px 12px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace, monospace',
                    width: '100%',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordText(!showPasswordText)}
                  aria-label={showPasswordText ? 'Hide session cookie' : 'Show session cookie'}
                  title={showPasswordText ? 'Hide session cookie' : 'Show session cookie'}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                  }}
                >
                  {showPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {validationError && (
                <div style={{ fontSize: '0.76rem', color: '#dc2626', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <AlertCircle size={13} />
                  <span>{validationError}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section: How RolePilot uses your connection */}
        <div>
          <h3
            style={{
              margin: '0 0 10px 0',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: '#0f172a',
            }}
          >
            How RolePilot uses your connection
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <CheckCircle2 size={16} color="var(--success, #16a34a)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.4 }}>
                Find and evaluate jobs against your preferences.
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <CheckCircle2 size={16} color="var(--success, #16a34a)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.4 }}>
                Help prepare application details using your profile and resume.
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <CheckCircle2 size={16} color="var(--success, #16a34a)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.4 }}>
                Track automation progress and application outcomes.
              </span>
            </div>
          </div>
        </div>

        {/* Safeguards Notice */}
        <p
          style={{
            margin: 0,
            fontSize: '0.78rem',
            lineHeight: 1.45,
            color: '#64748b',
          }}
        >
          RolePilot will not submit applications unless the applicable automation settings and Triple-Key submission
          safeguards permit it. Access may need to be renewed if your browser session expires.
        </p>

        {/* Unchecked-by-default Consent Checkbox */}
        <label
          htmlFor="linkedin-consent-checkbox"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: '0.84rem',
            color: '#0f172a',
            lineHeight: 1.4,
          }}
        >
          <input
            id="linkedin-consent-checkbox"
            type="checkbox"
            checked={hasAgreed}
            onChange={(e) => setHasAgreed(e.target.checked)}
            disabled={isSubmitting}
            style={{
              marginTop: '3px',
              width: '18px',
              height: '18px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
          <span>I understand and consent to the described LinkedIn access and automation.</span>
        </label>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <button
            ref={connectButtonRef}
            type="button"
            onClick={handleConnectAndContinue}
            disabled={isSubmitting || !hasAgreed || (needsSession && !sessionTokenInput.trim())}
            className="btn btn-primary"
            style={{
              width: '100%',
              minHeight: '42px',
              fontSize: '0.92rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="spinner" />
                <span>Connecting...</span>
              </>
            ) : (
              <span>Connect LinkedIn</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="btn btn-secondary"
            style={{
              width: '100%',
              minHeight: '40px',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
        </div>

        {/* Footnote */}
        <div
          style={{
            fontSize: '0.72rem',
            color: '#64748b',
            textAlign: 'center',
            lineHeight: 1.4,
            marginTop: '-4px',
          }}
        >
          RolePilot operates strictly with candidate-directed permission. You may disconnect your session or revoke
          automation consent at any time from your dashboard.
        </div>
      </div>
    </div>
  );
};

