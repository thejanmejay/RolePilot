import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, AlertCircle, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { authService } from '../services/authService';

interface VerifyEmailPageProps {
  initialEmail?: string;
  onNavigateLogin: () => void;
  onNavigateSignup: () => void;
  onNavigateHome: () => void;
  onNavigateDashboard?: () => void;
  onSuccess?: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
}

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({
  initialEmail = '',
  onNavigateLogin,
  onNavigateHome,
  onNavigateTerms,
  onNavigatePrivacy,
}) => {
  // Extract email from prop or query param
  const [email, setEmail] = useState(() => {
    if (initialEmail) return initialEmail;
    const params = new URLSearchParams(window.location.search);
    return params.get('email') || '';
  });

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(email);

  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Resend cooldown timer (60 seconds)
  const [cooldown, setCooldown] = useState<number>(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    if (!email) {
      setError('Please provide your email address to receive a verification link.');
      setIsEditingEmail(true);
      return;
    }

    setIsResending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await authService.resendVerificationEmail({ email });
      if (res.success) {
        setSuccessMessage(`A new verification link has been sent to ${email}.`);
        setCooldown(60);
      } else {
        setError(res.error || 'Unable to resend verification email right now. Please wait a moment.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setEmail(cleanEmail);
    setIsEditingEmail(false);
    setError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('email', cleanEmail);
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    } catch {
      // Ignore if history is restricted
    }
  };

  return (
    <AuthLayout
      title="Check your email"
      subtitle="We've sent a verification link to your email address."
      footerText="Need to log in with an existing account?"
      footerActionText="Back to login"
      onFooterAction={onNavigateLogin}
      onNavigateHome={onNavigateHome}
      onNavigateTerms={onNavigateTerms}
      onNavigatePrivacy={onNavigatePrivacy}
    >
      <div className="otp-container" style={{ padding: '8px 0', textAlign: 'center' }}>
        <div
          className="otp-icon-bubble"
          style={{
            backgroundColor: 'var(--auth-blue-light, #EFF6FF)',
            color: 'var(--auth-blue, #1769E8)',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
          }}
        >
          <Mail size={32} />
        </div>

        {/* Email Address Display & Edit */}
        {isEditingEmail ? (
          <form onSubmit={handleSaveEmail} style={{ width: '100%', maxWidth: '340px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@company.com"
                className="auth-input"
                style={{ height: '38px', fontSize: '0.875rem' }}
                autoFocus
              />
              <button
                type="submit"
                className="auth-btn-secondary"
                style={{ height: '38px', padding: '0 14px', fontSize: '0.85rem' }}
              >
                Save
              </button>
            </div>
          </form>
        ) : (
          <div style={{ fontSize: '0.9rem', color: 'var(--auth-text-muted)' }}>
            Verification link sent to{' '}
            <strong style={{ color: 'var(--auth-text-main)', wordBreak: 'break-all' }}>
              {email || 'your email'}
            </strong>{' '}
            <button
              type="button"
              onClick={() => {
                setEmailInput(email);
                setIsEditingEmail(true);
              }}
              className="auth-text-link"
              style={{ fontSize: '0.8rem', marginLeft: '6px' }}
              aria-label="Change email"
            >
              Change email
            </button>
          </div>
        )}

        {/* Core Message & Supporting Guidance */}
        <div style={{ margin: '14px 0 18px', textAlign: 'center', maxWidth: '420px' }}>
          <p style={{ fontSize: '0.95rem', color: '#101A3A', lineHeight: 1.6, margin: '0 0 10px', fontWeight: 600 }}>
            Please check your email and confirm your identity. If your account does not exist, you will receive the verification email. If your account already exists, please click on Log in.
          </p>
          <p style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5, margin: 0 }}>
            Open the email and click the verification link to confirm your account. If you don't see it, check your spam or junk folder.
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div role="alert" className="auth-alert auth-alert-error" style={{ width: '100%', boxSizing: 'border-box' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{error}</div>
          </div>
        )}

        {/* Success Notification */}
        {successMessage && (
          <div role="status" className="auth-alert auth-alert-success" style={{ width: '100%', boxSizing: 'border-box' }}>
            <CheckCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{successMessage}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            className="auth-btn-primary"
            id="resend-verification-email-btn"
            style={{ width: '100%', height: '44px', fontSize: '0.925rem' }}
          >
            {isResending ? (
              <>
                <Loader2 size={18} className="spin-animation" />
                <span>Sending verification link...</span>
              </>
            ) : cooldown > 0 ? (
              <span>Resend email in {cooldown}s</span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <RefreshCw size={15} />
                <span>Resend verification email</span>
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onNavigateLogin}
            className="auth-btn-secondary"
            id="back-to-login-btn"
            style={{ width: '100%', height: '42px', fontSize: '0.9rem' }}
          >
            <ArrowLeft size={15} />
            <span>Back to login</span>
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};
