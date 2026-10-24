import React, { useState } from 'react';
import {
  UserPlus,
  CheckCircle,
  AlertCircle,
  Loader2,
  Compass,
  LayoutGrid,
  Zap,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { FormField } from '../components/auth/FormField';
import { PasswordField } from '../components/auth/PasswordField';
import { GoogleAuthButton } from '../components/auth/GoogleAuthButton';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';

interface SignupPageProps {
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
  onNavigateDashboard?: () => void;
  onSuccess?: () => void;
  onNavigateVerifyEmail: (email: string) => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({
  onNavigateLogin,
  onNavigateHome,
  onNavigateDashboard,
  onSuccess,
  onNavigateVerifyEmail,
}) => {
  const { login } = useAuth();

  // Form fields state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Validation errors state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Submission & status states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'fullName':
        if (!value.trim()) return 'Full name is required.';
        if (value.trim().length < 2) return 'Full name must be at least 2 characters.';
        return '';

      case 'email':
        if (!value.trim()) return 'Email address is required.';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) return 'Please enter a valid email address.';
        return '';

      case 'password':
        if (!value) return 'Password is required.';
        if (value.length < 8) return 'Password must be at least 8 characters long.';
        return '';

      case 'confirmPassword':
        if (!value) return 'Please confirm your password.';
        if (value !== password) return 'Passwords do not match.';
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
    if (field === 'fullName') setFullName(value);
    if (field === 'email') setEmail(value);
    if (field === 'password') {
      setPassword(value);
      if (touched.confirmPassword && confirmPassword) {
        setErrors((prev) => ({
          ...prev,
          confirmPassword: value !== confirmPassword ? 'Passwords do not match.' : '',
        }));
      }
    }
    if (field === 'confirmPassword') setConfirmPassword(value);

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

    // Validate all fields
    const nameErr = validateField('fullName', fullName);
    const emailErr = validateField('email', email);
    const passErr = validateField('password', password);
    const confirmErr = validateField('confirmPassword', confirmPassword);
    const termsErr = !agreeTerms ? 'You must agree to the Terms and Privacy Policy.' : '';

    const newErrors = {
      fullName: nameErr,
      email: emailErr,
      password: passErr,
      confirmPassword: confirmErr,
      terms: termsErr,
    };

    setErrors(newErrors);
    setTouched({
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true,
      terms: true,
    });

    if (nameErr || emailErr || passErr || confirmErr || termsErr) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await authService.signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });

      if (!res.success) {
        setGeneralError(res.error || 'Registration failed. Please try again.');
        setIsSubmitting(false);
        return;
      }

      if (res.requiresEmailVerification) {
        setSuccessMessage("Account created! We've sent a verification link to your email address.");
        setTimeout(() => {
          onNavigateVerifyEmail(email.trim());
        }, 500);
        return;
      }

      if (res.token) {
        login(res.token, res.session, res.user);
        setSuccessMessage('Account created successfully! Redirecting...');
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else if (onNavigateDashboard) {
            onNavigateDashboard();
          }
        }, 600);
      }
    } catch (err: any) {
      setGeneralError(err.message || 'An unexpected error occurred during signup.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="signup-split-layout">
      {/* Left Panel: Brand & Benefits */}
      <aside className="signup-split-left" aria-label="RolePilot Overview">
        <div className="signup-brand-header">
          <RolePilotLogo variant="compact" height={36} transparent />
          <span className="signup-tagline-badge">
            <Sparkles size={13} color="#FFAD18" />
            <span>Your Career. Your Next Move.</span>
          </span>
        </div>

        <div className="signup-brand-body">
          <h1 className="signup-brand-headline">Make your next career move count.</h1>
          <p className="signup-brand-desc">
            Discover opportunities, streamline applications, and keep your job search organized in
            one place.
          </p>

          <div className="signup-benefits-list">
            <div className="signup-benefit-item">
              <div className="signup-benefit-icon-wrapper">
                <Compass size={20} />
              </div>
              <div>
                <h3 className="signup-benefit-title">Discover relevant job opportunities</h3>
                <p className="signup-benefit-text">
                  Surface qualified roles matching your verified skills, experience, and targeted
                  career preferences.
                </p>
              </div>
            </div>

            <div className="signup-benefit-item">
              <div className="signup-benefit-icon-wrapper">
                <LayoutGrid size={20} />
              </div>
              <div>
                <h3 className="signup-benefit-title">Keep applications and progress organized</h3>
                <p className="signup-benefit-text">
                  Track application histories, interview stages, and follow-ups in a centralized,
                  clean workspace.
                </p>
              </div>
            </div>

            <div className="signup-benefit-item">
              <div className="signup-benefit-icon-wrapper">
                <Zap size={20} />
              </div>
              <div>
                <h3 className="signup-benefit-title">Spend less time on repetitive tasks</h3>
                <p className="signup-benefit-text">
                  Eliminate duplicate form entries and streamline multi-step application preparation
                  efficiently.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="signup-brand-footer">
          <ShieldCheck size={16} color="#38BDF8" style={{ flexShrink: 0 }} />
          <span>User-controlled application workflows &mdash; your career, your rules.</span>
        </div>
      </aside>

      {/* Right Panel: Signup Form */}
      <main className="signup-split-right">
        <div className="signup-form-top-bar">
          <button
            type="button"
            onClick={onNavigateHome}
            className="auth-back-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to home</span>
          </button>
        </div>

        <div className="signup-form-card">
          <div className="signup-form-header">
            <h2 className="signup-form-title">Create your account</h2>
            <p className="signup-form-subtitle">Get started with RolePilot.</p>
          </div>

          <GoogleAuthButton
            label="Sign up with Google"
            onError={(err) => setGeneralError(err)}
            disabled={isSubmitting}
          />

          <div className="auth-divider">
            <span>or sign up with email</span>
          </div>

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
              id="signup-fullname"
              label="Full name"
              type="text"
              required
              autoComplete="name"
              placeholder="e.g. Alex Morgan"
              value={fullName}
              error={touched.fullName ? errors.fullName : undefined}
              onChange={(e) => handleChange('fullName', e.target.value)}
              onBlur={(e) => handleBlur('fullName', e.target.value)}
              disabled={isSubmitting}
            />

            <FormField
              id="signup-email"
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

            <PasswordField
              id="signup-password"
              label="Password"
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
              helperText="Minimum 8 characters"
              value={password}
              error={touched.password ? errors.password : undefined}
              onChange={(e) => handleChange('password', e.target.value)}
              onBlur={(e) => handleBlur('password', e.target.value)}
              disabled={isSubmitting}
            />

            <PasswordField
              id="signup-confirm-password"
              label="Confirm password"
              required
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={confirmPassword}
              error={touched.confirmPassword ? errors.confirmPassword : undefined}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              onBlur={(e) => handleBlur('confirmPassword', e.target.value)}
              disabled={isSubmitting}
            />

            {/* Terms & Privacy acceptance checkbox */}
            <div>
              <label className="auth-checkbox-row" htmlFor="signup-terms">
                <input
                  id="signup-terms"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => {
                    setAgreeTerms(e.target.checked);
                    if (touched.terms) {
                      setErrors((prev) => ({
                        ...prev,
                        terms: !e.target.checked
                          ? 'You must agree to the Terms and Privacy Policy.'
                          : '',
                      }));
                    }
                  }}
                  className="auth-checkbox"
                  disabled={isSubmitting}
                />
                <span className="auth-checkbox-label">
                  I agree to the{' '}
                  <a
                    href="#terms"
                    onClick={(e) => {
                      e.preventDefault();
                    }}
                  >
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a
                    href="#privacy"
                    onClick={(e) => {
                      e.preventDefault();
                    }}
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
              {touched.terms && errors.terms && (
                <div role="alert" className="auth-field-error" style={{ marginTop: '4px' }}>
                  <AlertCircle size={14} />
                  <span>{errors.terms}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={isSubmitting}
              id="create-account-submit-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="spin-animation" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Create account</span>
                </>
              )}
            </button>
          </form>

          <div className="signup-login-prompt">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onNavigateLogin}
              className="auth-text-link"
              id="signup-to-login-link"
            >
              Log in
            </button>
          </div>

          <div className="signup-legal-note">
            By creating an account, you agree that RolePilot enables user-directed workflows.
          </div>
        </div>
      </main>
    </div>
  );
};
