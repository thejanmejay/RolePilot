import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, AlertCircle, Loader2, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePolicy } from '../context/PolicyContext';
import { ACTIVE_POLICY } from '../components/policy/policyContent';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import '../components/policy/policy.css';

interface PolicyAcceptancePageProps {
  onContinue: () => void;
}

export const PolicyAcceptancePage: React.FC<PolicyAcceptancePageProps> = ({ onContinue }) => {
  const { logout } = useAuth();
  const { acceptPolicy, hasDeclined, setHasDeclined } = usePolicy();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsSubmitting(true);
    setError(null);

    const res = await acceptPolicy();
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMessage('Policy accepted successfully! Proceeding...');
      setTimeout(() => {
        onContinue();
      }, 700);
    } else {
      setError(res.error || 'Failed to record acceptance. Please try again.');
    }
  };

  const handleDecline = () => {
    setHasDeclined(true);
    setError(null);
  };

  const handleReconsider = () => {
    setHasDeclined(false);
    setError(null);
  };

  return (
    <div className="policy-page-wrapper">
      <div className="policy-card">
        {hasDeclined ? (
          <div className="policy-declined-box">
            <div className="policy-declined-icon">
              <ShieldAlert size={26} />
            </div>
            <h2 className="policy-declined-title">Policy Acceptance Required</h2>
            <p className="policy-declined-text">
              You have declined the Platform Policy and Terms of Use. Continued access to RolePilot
              automation workflows, candidate profiles, and application tracking requires explicit policy acceptance.
            </p>
            <p className="policy-declined-text" style={{ fontSize: '0.85rem', color: '#64748B' }}>
              Your account has not been deleted and your data remains safe. You can reconsider whenever you are ready.
            </p>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                className="policy-btn-accept"
                onClick={handleReconsider}
              >
                <ShieldCheck size={18} />
                Review & Accept Policy
              </button>
              <button
                type="button"
                className="policy-btn-decline"
                onClick={() => logout()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <LogOut size={16} />
                Log Out
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="policy-header">
              <div style={{ marginBottom: '12px' }}>
                <RolePilotLogo variant="compact" height={32} />
              </div>
              <h1 className="policy-title">{ACTIVE_POLICY.title}</h1>
              <p className="policy-subtitle">{ACTIVE_POLICY.subtitle}</p>
            </div>

            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#991B1B',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                }}
              >
                <AlertCircle size={18} />
                <span style={{ flex: 1 }}>{error}</span>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: '#DC2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? 'Retrying...' : 'Retry'}
                </button>
              </div>
            )}

            {successMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  color: '#166534',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                }}
              >
                <CheckCircle2 size={18} />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="policy-scroll-area">
              {ACTIVE_POLICY.sections.map((sec, idx) => (
                <div key={idx}>
                  <div className="policy-section-title">{sec.title}</div>
                  <p className="policy-section-text">{sec.content}</p>
                </div>
              ))}
              <div className="policy-disclaimer">
                By clicking Accept and Continue, you acknowledge and agree to RolePilot&apos;s{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#0A66C2', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Terms of Use
                </a>{' '}
                and{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#0A66C2', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Privacy Policy
                </a>
                . Acceptance records your verified consent timestamp and policy audit version in accordance with platform governance.
              </div>
            </div>

            <div className="policy-actions">
              <button
                type="button"
                className="policy-btn-decline"
                onClick={handleDecline}
                disabled={isSubmitting}
              >
                Decline and Exit
              </button>
              <button
                type="button"
                className="policy-btn-accept"
                onClick={handleAccept}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="spin-animation" />
                    Recording Consent...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    Accept and Continue
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
