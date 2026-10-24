import React, { useState } from 'react';
import { Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { PasswordField } from '../components/auth/PasswordField';
import { authService } from '../services/authService';

interface ResetPasswordPageProps {
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  onNavigateLogin,
  onNavigateHome,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter a new password.');
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
        setSuccessMessage(res.message || 'Password updated successfully! Redirecting to login...');
        setTimeout(() => {
          onNavigateLogin();
        }, 1200);
      } else {
        setError(res.error || 'Failed to update password. Your reset link may have expired.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating your password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create new password"
      subtitle="Choose a strong, secure password for your RolePilot account"
      footerText="Remembered your password?"
      footerActionText="Log in"
      onFooterAction={onNavigateLogin}
      onNavigateHome={onNavigateHome}
    >
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
          label="New Password"
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
          label="Confirm New Password"
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
              <span>Updating password...</span>
            </>
          ) : (
            <>
              <Lock size={16} />
              <span>Update Password</span>
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  );
};
