import React, { useState } from 'react';
import { LogIn, AlertCircle, CheckCircle, Loader2, Key, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { FormField } from '../components/auth/FormField';
import { PasswordField } from '../components/auth/PasswordField';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';

interface LoginPageProps {
  onNavigateSignup: () => void;
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigateSignup,
  onNavigateHome,
  onNavigateDashboard,
}) => {
  const { login } = useAuth();

  // Form fields state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Status & submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password Reset Modal states
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<{ message?: string; error?: string } | null>(null);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  // Developer token access state
  const [isDevTokenOpen, setIsDevTokenOpen] = useState(false);
  const [devTokenInput, setDevTokenInput] = useState('');
  const [devTokenError, setDevTokenError] = useState<string | null>(null);

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'email':
        if (!value.trim()) return 'Email address is required.';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) return 'Please enter a valid email address.';
        return '';

      case 'password':
        if (!value) return 'Password is required.';
        return '';

      default:
        return '';
    }
  };

  const handleBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errorMsg = validateField(field, value);
    setErrors((prev) => ({
      ...prev,
      [field]: errorMsg,
    }));
  };

  const handleChange = (field: string, value: string) => {
    if (field === 'email') setEmail(value);
    if (field === 'password') setPassword(value);

    if (touched[field]) {
      const errorMsg = validateField(field, value);
      setErrors((prev) => ({
        ...prev,
        [field]: errorMsg,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const emailErr = validateField('email', email);
    const passErr = validateField('password', password);

    setErrors({ email: emailErr, password: passErr });
    setTouched({ email: true, password: true });

    if (emailErr || passErr) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await authService.signIn({
        email: email.trim(),
        password,
        rememberMe,
      });

      if (!res.success) {
        setGeneralError(res.error || 'Invalid email or password.');
        setIsSubmitting(false);
        return;
      }

      if (res.token) {
        login(res.token);
        setSuccessMessage('Signed in successfully! Redirecting to dashboard...');
        setTimeout(() => {
          onNavigateDashboard();
        }, 600);
      }
    } catch (err: any) {
      setGeneralError(err.message || 'An unexpected error occurred during sign in.');
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToReset = resetEmail.trim() || email.trim();
    if (!emailToReset) {
      setResetStatus({ error: 'Please enter your account email address.' });
      return;
    }

    setIsResetSubmitting(true);
    setResetStatus(null);

    try {
      const res = await authService.resetPassword(emailToReset);
      if (res.success) {
        setResetStatus({ message: res.message });
      } else {
        setResetStatus({ error: res.error });
      }
    } catch (err: any) {
      setResetStatus({ error: err.message || 'Failed to submit password recovery.' });
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleDevTokenLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = devTokenInput.trim();
    if (!trimmed) {
      setDevTokenError('Please paste your JWT token.');
      return;
    }
    if (!trimmed.startsWith('eyJ')) {
      setDevTokenError('Invalid JWT format. Token must begin with "eyJ".');
      return;
    }

    try {
      login(trimmed);
      setSuccessMessage('Developer session authenticated! Redirecting...');
      setTimeout(() => {
        onNavigateDashboard();
      }, 500);
    } catch (err: any) {
      setDevTokenError(err.message || 'Failed to parse developer token.');
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to access your saved jobs, applications, and workflows"
      footerText="Don't have an account?"
      footerActionText="Sign up"
      onFooterAction={onNavigateSignup}
      onNavigateHome={onNavigateHome}
    >
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {generalError && (
          <div role="alert" className="auth-alert auth-alert-error">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{generalError}</div>
          </div>
        )}

        {successMessage && (
          <div role="status" className="auth-alert auth-alert-success">
            <CheckCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{successMessage}</div>
          </div>
        )}

        <FormField
          id="login-email"
          label="Email address"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          error={touched.email ? errors.email : undefined}
          onChange={(e) => handleChange('email', e.target.value)}
          onBlur={(e) => handleBlur('email', e.target.value)}
          disabled={isSubmitting}
        />

        <div>
          <PasswordField
            id="login-password"
            label="Password"
            required
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            error={touched.password ? errors.password : undefined}
            onChange={(e) => handleChange('password', e.target.value)}
            onBlur={(e) => handleBlur('password', e.target.value)}
            disabled={isSubmitting}
          />

          <div className="auth-meta-row" style={{ marginTop: '8px' }}>
            <label className="auth-checkbox-row" htmlFor="login-remember">
              <input
                id="login-remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="auth-checkbox"
                disabled={isSubmitting}
              />
              <span className="auth-checkbox-label">Remember me</span>
            </label>

            <button
              type="button"
              onClick={() => {
                setResetEmail(email);
                setResetStatus(null);
                setIsResetModalOpen(true);
              }}
              className="auth-text-link"
              id="forgot-password-link"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="auth-btn-primary"
          disabled={isSubmitting}
          id="login-submit-btn"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="spin-animation" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <LogIn size={18} />
              <span>Log in</span>
            </>
          )}
        </button>
      </form>

      {/* Developer / Local Test Token Accordion */}
      <div className="auth-dev-accordion">
        <button
          type="button"
          onClick={() => setIsDevTokenOpen((prev) => !prev)}
          className="auth-dev-toggle"
          aria-expanded={isDevTokenOpen}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Key size={14} color="var(--auth-blue)" />
            <span>Developer / Local Test Token Access</span>
          </span>
          {isDevTokenOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {isDevTokenOpen && (
          <div className="auth-dev-content">
            <p style={{ fontSize: '0.775rem', color: 'var(--auth-text-muted)', margin: '0 0 8px', lineHeight: '1.4' }}>
              Run the test token script in your terminal to generate a token:
            </p>
            <div
              style={{
                backgroundColor: '#1E293B',
                color: '#F8FAFC',
                padding: '6px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '10px',
                userSelect: 'all',
              }}
            >
              <Terminal size={12} color="#38BDF8" />
              <span>./linkedin-hunter/.venv/bin/python scripts/get_test_token.py</span>
            </div>

            {devTokenError && (
              <div role="alert" className="auth-field-error" style={{ marginBottom: '8px' }}>
                <AlertCircle size={13} />
                <span>{devTokenError}</span>
              </div>
            )}

            <form onSubmit={handleDevTokenLogin}>
              <textarea
                rows={2}
                value={devTokenInput}
                onChange={(e) => setDevTokenInput(e.target.value)}
                placeholder="Paste eyJhbGci... token here"
                style={{
                  width: '100%',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--auth-border)',
                  boxSizing: 'border-box',
                  resize: 'none',
                }}
              />
              <button
                type="submit"
                className="auth-btn-secondary"
                style={{ width: '100%', height: '32px', fontSize: '0.8rem', marginTop: '6px' }}
              >
                Sign In with Token
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Forgot Password Recovery Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Reset your password"
        maxWidth="440px"
      >
        <form onSubmit={handlePasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--auth-text-muted)', margin: 0, lineHeight: '1.5' }}>
            Enter your account email address. We will verify your account and send a password recovery link.
          </p>

          {resetStatus?.error && (
            <div role="alert" className="auth-alert auth-alert-error" style={{ padding: '10px 12px' }}>
              <AlertCircle size={16} />
              <span>{resetStatus.error}</span>
            </div>
          )}

          {resetStatus?.message && (
            <div role="status" className="auth-alert auth-alert-success" style={{ padding: '10px 12px' }}>
              <CheckCircle size={16} />
              <span>{resetStatus.message}</span>
            </div>
          )}

          <FormField
            id="reset-email"
            label="Account Email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            disabled={isResetSubmitting}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => setIsResetModalOpen(false)}
              className="auth-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="landing-btn-hero-primary"
              style={{ height: '40px', padding: '0 16px', fontSize: '0.875rem' }}
              disabled={isResetSubmitting}
            >
              {isResetSubmitting ? 'Sending link...' : 'Send reset link'}
            </button>
          </div>
        </form>
      </Modal>
    </AuthLayout>
  );
};
