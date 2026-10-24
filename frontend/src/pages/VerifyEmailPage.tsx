import React, { useState, useEffect } from 'react';
import { MailCheck, CheckCircle, AlertCircle, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';

interface VerifyEmailPageProps {
  initialEmail?: string;
  onNavigateLogin: () => void;
  onNavigateSignup: () => void;
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({
  initialEmail = '',
  onNavigateLogin,
  onNavigateSignup,
  onNavigateHome,
  onNavigateDashboard,
}) => {
  const { login } = useAuth();

  // Extract email from query param if not passed
  const [email, setEmail] = useState(() => {
    if (initialEmail) return initialEmail;
    const params = new URLSearchParams(window.location.search);
    return params.get('email') || '';
  });

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(email);

  const [otpCode, setOtpCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCode.trim();

    if (!cleanCode) {
      setError('Please enter the verification code sent to your email.');
      return;
    }

    if (cleanCode.length < 6) {
      setError('Verification code must be 6 digits.');
      return;
    }

    if (!email) {
      setError('Email address is missing. Please enter your email address.');
      setIsEditingEmail(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await authService.verifyOtp({
        email,
        token: cleanCode,
        type: 'signup',
      });

      if (!res.success) {
        setError(res.error || 'Invalid or expired verification code. Please check and try again.');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('Email verified successfully! Preparing your workspace...');
      if (res.token) {
        login(res.token, res.session, res.user);
      }
      setTimeout(() => {
        onNavigateDashboard();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    if (!email) {
      setError('Please provide your email address first.');
      setIsEditingEmail(true);
      return;
    }

    setIsResending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await authService.resendOtp({ email });
      if (res.success) {
        setSuccessMessage(`A new verification code was sent to ${email}.`);
        setCooldown(60);
      } else {
        setError(res.error || 'Unable to resend code right now. Please wait a moment.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setEmail(emailInput.trim());
    setIsEditingEmail(false);
    setError(null);
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter the 6-digit one-time verification code sent to your inbox"
      footerText="Already verified?"
      footerActionText="Log in"
      onFooterAction={onNavigateLogin}
      onNavigateHome={onNavigateHome}
    >
      <div className="otp-container">
        <div className="otp-icon-bubble">
          <MailCheck size={28} />
        </div>

        {/* Email Display & Editing */}
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
                style={{ height: '38px', fontSize: '0.85rem' }}
                autoFocus
              />
              <button
                type="submit"
                className="auth-btn-secondary"
                style={{ height: '38px', padding: '0 12px', fontSize: '0.825rem' }}
              >
                Save
              </button>
            </div>
          </form>
        ) : (
          <div style={{ fontSize: '0.875rem', color: 'var(--auth-text-muted)' }}>
            Code sent to{' '}
            <strong style={{ color: 'var(--auth-text-main)' }}>{maskEmail(email) || 'your email'}</strong>{' '}
            <button
              type="button"
              onClick={() => {
                setEmailInput(email);
                setIsEditingEmail(true);
              }}
              className="auth-text-link"
              style={{ fontSize: '0.8rem', marginLeft: '6px' }}
            >
              (Change)
            </button>
          </div>
        )}

        {/* Error and Success Notifications */}
        {error && (
          <div role="alert" className="auth-alert auth-alert-error" style={{ width: '100%', boxSizing: 'border-box' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{error}</div>
          </div>
        )}

        {successMessage && (
          <div role="status" className="auth-alert auth-alert-success" style={{ width: '100%', boxSizing: 'border-box' }}>
            <CheckCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{successMessage}</div>
          </div>
        )}

        {/* Verification Form */}
        <form onSubmit={handleVerify} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="otp-input" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--auth-text-main)', marginBottom: '8px' }}>
              6-Digit Numeric Code
            </label>
            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="••••••"
              value={otpCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setOtpCode(val);
                if (error) setError(null);
              }}
              className={`otp-input-field ${error ? 'has-error' : ''}`}
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            className="auth-btn-primary"
            disabled={isSubmitting || otpCode.length < 6}
            id="verify-email-submit-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spin-animation" />
                <span>Verifying code...</span>
              </>
            ) : (
              <span>Verify & Continue</span>
            )}
          </button>
        </form>

        {/* Resend OTP Section with Cooldown */}
        <div className="otp-resend-row">
          <span>Didn't receive the code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            className="otp-resend-btn"
            id="resend-otp-btn"
          >
            {isResending ? (
              'Sending code...'
            ) : cooldown > 0 ? (
              `Resend code in ${cooldown}s`
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <RefreshCw size={13} /> Resend OTP
              </span>
            )}
          </button>
        </div>

        {/* Return to Signup */}
        <div style={{ marginTop: '8px' }}>
          <button
            type="button"
            onClick={onNavigateSignup}
            className="auth-text-link"
            style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <ArrowLeft size={13} />
            <span>Return to registration</span>
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};
