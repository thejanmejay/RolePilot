import React, { useState } from 'react';
import { KeyRound, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { FormField } from '../components/auth/FormField';
import { authService } from '../services/authService';

interface ForgotPasswordPageProps {
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onNavigateLogin,
  onNavigateHome,
  onNavigateTerms,
  onNavigatePrivacy,
}) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError('Please enter your account email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const resetUrl = `${window.location.origin}/reset-password`;
      const res = await authService.resetPassword(cleanEmail, resetUrl);

      if (res.success) {
        setSuccessMessage(res.message || `Password recovery email sent to ${cleanEmail}.`);
      } else {
        setError(res.error || 'Failed to send password recovery link. Please try again.');
      }
    } catch {
      setError('We could not send a password reset email. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you instructions to reset your password"
      footerText="Remember your password?"
      footerActionText="Log in"
      onFooterAction={onNavigateLogin}
      onNavigateHome={onNavigateHome}
      onNavigateTerms={onNavigateTerms}
      onNavigatePrivacy={onNavigatePrivacy}
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

        <FormField
          id="forgot-email"
          label="Account Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          disabled={isSubmitting}
        />

        <button
          type="submit"
          className="auth-btn-primary"
          disabled={isSubmitting}
          id="send-reset-link-btn"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="spin-animation" />
              <span>Sending reset link...</span>
            </>
          ) : (
            <>
              <KeyRound size={16} />
              <span>Send recovery link</span>
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  );
};
