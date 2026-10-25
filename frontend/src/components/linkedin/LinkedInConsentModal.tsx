import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { linkedinApi } from '../../api/linkedin';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';
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
  const { showSuccess, showError } = useToast();
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusData, setStatusData] = useState<LinkedInStatus | null>(initialStatus || null);
  const [sessionTokenInput, setSessionTokenInput] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch / refresh status whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setHasAgreed(false);
      setIsSubmitting(false);
      setErrorMessage(null);
      setSessionTokenInput('');

      linkedinApi
        .getStatus()
        .then((data) => {
          setStatusData(data);
          // If disconnected or expired, show token input automatically
          if (!data.is_connected || data.status === 'expired' || data.status === 'disconnected') {
            setShowTokenInput(true);
          } else {
            setShowTokenInput(false);
          }
        })
        .catch(() => {
          setShowTokenInput(true);
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
    onClose();
    if (onCancel) {
      onCancel();
    } else {
      // Safe navigation to dashboard
      window.location.hash = '';
      if (!window.location.pathname.includes('/dashboard')) {
        window.location.href = '/dashboard';
      }
    }
  };

  const handleConnectAndContinue = async () => {
    if (isSubmitting) return; // Prevent duplicate clicks
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Step 1: If session token input is needed, submit it first
      if (showTokenInput || !statusData?.is_connected) {
        if (!sessionTokenInput.trim()) {
          setErrorMessage('Please provide your LinkedIn session token to connect.');
          setIsSubmitting(false);
          return;
        }

        const connectedStatus = await linkedinApi.connect(sessionTokenInput.trim());
        setStatusData(connectedStatus);
        setShowTokenInput(false);
      }

      // Step 2: Submit explicit permission consent
      if (!hasAgreed) {
        setErrorMessage('Please check the box to agree to RolePilot’s LinkedIn access purpose.');
        setIsSubmitting(false);
        return;
      }

      await linkedinApi.submitConsent(true, 'v1.0');
      showSuccess('LinkedIn connection and automation purpose verified!');
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
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 10, 24, 0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: '#0A0F1D',
          color: '#F8FAFC',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          maxWidth: '520px',
          width: '100%',
          padding: '28px 24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          animation: 'fadeInModal 0.2s ease-out',
        }}
      >
        {/* Header matching design mockup */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* LinkedIn Icon Badge */}
            <div
              style={{
                width: '42px',
                height: '42px',
                backgroundColor: '#0A66C2',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '1.45rem',
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
                  color: '#FFFFFF',
                  letterSpacing: '-0.01em',
                }}
              >
                Connect LinkedIn to RolePilot
              </h2>
              <p
                style={{
                  margin: '3px 0 0 0',
                  fontSize: '0.85rem',
                  color: '#94A3B8',
                }}
              >
                Review how your account will be used
              </p>
            </div>
          </div>

          {/* Green Shield Check Icon */}
          <div style={{ color: '#22C55E', flexShrink: 0, marginTop: '2px' }}>
            <ShieldCheck size={24} />
          </div>
        </div>

        {/* Informational intro text */}
        <p
          style={{
            margin: 0,
            fontSize: '0.88rem',
            lineHeight: 1.5,
            color: '#CBD5E1',
          }}
        >
          RolePilot uses your connected LinkedIn session to support job discovery and application workflows,
          subject to the permissions and capabilities actually available.
        </p>

        {/* Error message banner */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.84rem',
              color: '#FCA5A5',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section: Purpose of access */}
        <div>
          <h3
            style={{
              margin: '0 0 12px 0',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#FFFFFF',
            }}
          >
            Purpose of access
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Bullet 1 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <CheckCircle2 size={18} color="#22C55E" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '0.88rem', color: '#E2E8F0', lineHeight: 1.45 }}>
                Find and evaluate jobs against your preferences.
              </span>
            </div>

            {/* Bullet 2 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <CheckCircle2 size={18} color="#22C55E" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '0.88rem', color: '#E2E8F0', lineHeight: 1.45 }}>
                Help populate application details using your saved profile and resume.
              </span>
            </div>

            {/* Bullet 3 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <CheckCircle2 size={18} color="#22C55E" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '0.88rem', color: '#E2E8F0', lineHeight: 1.45 }}>
                Track automation progress and application outcomes.
              </span>
            </div>
          </div>
        </div>

        {/* Safeguards Notice */}
        <p
          style={{
            margin: 0,
            fontSize: '0.82rem',
            lineHeight: 1.5,
            color: '#94A3B8',
          }}
        >
          RolePilot will not submit applications unless the applicable automation settings and submission
          safeguards permit it. Access may need to be renewed if your session expires.
        </p>

        {/* Session Token Connection Panel (Shown if session is missing or expired) */}
        {needsSession && (
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#38BDF8' }}>
              <KeyRound size={16} />
              <span>
                {statusData?.status === 'expired'
                  ? 'LinkedIn Session Expired — Please Reconnect'
                  : 'Connect Your LinkedIn Session'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.4 }}>
              Paste your LinkedIn session token (<code>li_at</code> cookie). It is immediately encrypted using
              server-side AES encryption and never stored in plain text or local storage.
            </p>
            <input
              type="password"
              placeholder="Paste li_at cookie value (starts with AQED...)"
              value={sessionTokenInput}
              onChange={(e) => setSessionTokenInput(e.target.value)}
              disabled={isSubmitting}
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '9px 12px',
                color: '#FFFFFF',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                width: '100%',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Unchecked-by-default Checkbox */}
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: '0.88rem',
            color: '#F1F5F9',
            lineHeight: 1.4,
          }}
        >
          <input
            type="checkbox"
            checked={hasAgreed}
            onChange={(e) => setHasAgreed(e.target.checked)}
            disabled={isSubmitting}
            style={{
              marginTop: '3px',
              width: '18px',
              height: '18px',
              accentColor: '#FFFFFF',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
          <span>I understand and agree to RolePilot&apos;s LinkedIn access and automation purpose.</span>
        </label>

        {/* Action Buttons matching visual design */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          {/* Primary Continue Button */}
          <button
            ref={continueButtonRef}
            type="button"
            onClick={handleConnectAndContinue}
            disabled={isSubmitting || !hasAgreed || (needsSession && !sessionTokenInput.trim())}
            style={{
              width: '100%',
              backgroundColor: '#FFFFFF',
              color: '#000000',
              border: 'none',
              borderRadius: '9999px',
              padding: '13px 20px',
              fontSize: '0.96rem',
              fontWeight: 700,
              cursor: isSubmitting || !hasAgreed || (needsSession && !sessionTokenInput.trim()) ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || !hasAgreed || (needsSession && !sessionTokenInput.trim()) ? 0.45 : 1,
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spin-animation" />
                <span>Verifying & Connecting...</span>
              </>
            ) : (
              <span>Continue</span>
            )}
          </button>

          {/* Secondary Cancel Button */}
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              color: '#F8FAFC',
              border: '1px solid #334155',
              borderRadius: '9999px',
              padding: '12px 20px',
              fontSize: '0.94rem',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            Cancel and return to dashboard
          </button>
        </div>

        {/* Microcopy footnote */}
        <div
          style={{
            fontSize: '0.72rem',
            color: '#64748B',
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
