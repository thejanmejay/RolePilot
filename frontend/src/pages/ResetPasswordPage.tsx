import React, { useEffect, useMemo, useState } from 'react';
import { Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { PasswordField } from '../components/auth/PasswordField';
import { authService, supabase } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import {
  getPasswordRecoveryLinkError,
  parseRecoveryLinkParams,
  mapPasswordUpdateError,
  type PasswordRecoveryState,
} from '../services/passwordRecoveryFlow';

interface ResetPasswordPageProps {
  onSuccess: () => void;
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
  onNavigateForgotPassword: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  onSuccess,
  onNavigateLogin,
  onNavigateHome,
  onNavigateForgotPassword,
  onNavigateTerms,
  onNavigatePrivacy,
}) => {
  const { isLoading: isAuthLoading, isPasswordRecovery, session, clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [isVerifiedReady, setIsVerifiedReady] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);

  const recoveryLinkError = useMemo(() => getPasswordRecoveryLinkError(window.location.href), []);
  const linkParams = useMemo(() => parseRecoveryLinkParams(window.location.href), []);

  useEffect(() => {
    // If already updated or already verified, nothing to wait for
    if (passwordUpdated || isVerifiedReady) return;

    // Direct check: AuthContext already established the recovery session
    if (isPasswordRecovery && session) {
      setIsVerifiedReady(true);
      if (window.location.search || window.location.hash) {
        window.history.replaceState(null, '', '/reset-password');
      }
      return;
    }

    // If link has an explicit error, stop immediately
    if (recoveryLinkError) {
      return;
    }

    // If there is NO recovery indicator in URL and auth loading is done without recovery event
    if (!isAuthLoading && !linkParams.hasRecoveryIndicator && !isPasswordRecovery) {
      setIsTimeout(true);
      return;
    }

    // Otherwise, listen for Supabase auth state callback processing
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsub: (() => void) | null = null;

    if (supabase) {
      const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && isPasswordRecovery)) {
          if (s) {
            setIsVerifiedReady(true);
            if (window.location.search || window.location.hash) {
              window.history.replaceState(null, '', '/reset-password');
            }
          }
        }
      });
      unsub = () => listener.subscription.unsubscribe();
    }

    // Allow sufficient time for hash parsing / PKCE code exchange
    timer = setTimeout(() => {
      setIsTimeout(true);
    }, 4000);

    return () => {
      if (timer) clearTimeout(timer);
      if (unsub) unsub();
    };
  }, [
    passwordUpdated,
    isVerifiedReady,
    isPasswordRecovery,
    session,
    recoveryLinkError,
    isAuthLoading,
    linkParams.hasRecoveryIndicator,
  ]);

  const recoveryState: PasswordRecoveryState = useMemo(() => {
    if (passwordUpdated) return 'updated';
    if (recoveryLinkError) return 'invalid';
    if (isVerifiedReady || (isPasswordRecovery && Boolean(session))) return 'ready';
    if (isTimeout) return 'invalid';
    return 'checking';
  }, [passwordUpdated, recoveryLinkError, isVerifiedReady, isPasswordRecovery, session, isTimeout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password && !confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }

    if (!password) {
      setError('Please enter a new password.');
      return;
    }

    if (!confirmPassword) {
      setError('Please confirm your new password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await authService.updatePassword(password);
      if (res.success) {
        setSuccessMessage(res.message || 'Password updated successfully! Redirecting to your account...');
        setPasswordUpdated(true);
        clearPasswordRecovery();
        // Allow user to see the success confirmation, then route based on authoritative state
        window.setTimeout(() => {
          onSuccess();
        }, 1200);
      } else {
        setError(res.error || mapPasswordUpdateError(null));
      }
    } catch (err: unknown) {
      setError(mapPasswordUpdateError(err as import('../services/passwordRecoveryFlow').SupabaseAuthErrorLike));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Choose a strong, secure password for your RolePilot account"
      footerText="Remembered your password?"
      footerActionText="Log in"
      onFooterAction={onNavigateLogin}
      onNavigateHome={onNavigateHome}
      onNavigateTerms={onNavigateTerms}
      onNavigatePrivacy={onNavigatePrivacy}
    >
      {recoveryState === 'checking' ? (
        <div role="status" className="auth-alert">
          <Loader2 size={18} className="spin-animation" />
          <span>Verifying your password reset link...</span>
        </div>
      ) : recoveryState === 'invalid' ? (
        <div className="auth-form">
          <div role="alert" className="auth-alert auth-alert-error">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              {recoveryLinkError ||
                'This password reset link is missing, invalid, or expired. Request a new reset email and open its latest link.'}
            </div>
          </div>
          <button type="button" className="auth-btn-primary" onClick={onNavigateForgotPassword}>
            Request another reset email
          </button>
          <button type="button" className="auth-btn-secondary" onClick={onNavigateLogin}>
            Return to login
          </button>
        </div>
      ) : recoveryState === 'updated' ? (
        <div role="status" className="auth-alert auth-alert-success">
          <CheckCircle size={18} style={{ flexShrink: 0 }} />
          <div>{successMessage}</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {error && (
            <div role="alert" className="auth-alert auth-alert-error">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{error}</div>
            </div>
          )}

          {successMessage && (
            <div role="status" className="auth-alert auth-alert-success">
              <CheckCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{successMessage}</div>
            </div>
          )}

          <PasswordField
            id="reset-password-input"
            label="New password"
            required
            autoComplete="new-password"
            placeholder="At least 8 characters"
            helperText="Minimum 8 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            disabled={isSubmitting}
          />

          <PasswordField
            id="reset-confirm-password-input"
            label="Confirm new password"
            required
            autoComplete="new-password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (error) setError(null);
            }}
            disabled={isSubmitting}
          />

          <button
            type="submit"
            className="auth-btn-primary"
            disabled={isSubmitting}
            id="update-password-submit-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spin-animation" />
                <span>Saving new password...</span>
              </>
            ) : (
              <>
                <Lock size={16} />
                <span>Save new password</span>
              </>
            )}
          </button>
        </form>
      )}
    </AuthLayout>
  );
};
