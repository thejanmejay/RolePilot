/**
 * Google OAuth Button component.
 * NOTE: Google sign-in is intentionally hidden in the user interface (LoginPage and SignupPage)
 * until Google OAuth credentials (Client ID and Secret) are configured in Supabase.
 * Do not delete this component; it is kept intact for immediate re-activation once credentials are ready.
 */
import React, { useState } from 'react';
import { authService } from '../../services/authService';
import { Loader2 } from 'lucide-react';

interface GoogleAuthButtonProps {
  label?: string;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  label = 'Continue with Google',
  onError,
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleClick = async () => {
    setIsLoading(true);
    try {
      const res = await authService.signInWithGoogle();
      if (res.error) {
        setIsLoading(false);
        if (onError) onError(res.error);
      }
      // If no error, browser is redirected to Google OAuth
    } catch (err: any) {
      setIsLoading(false);
      if (onError) onError(err.message || 'Failed to start Google sign in.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleClick}
      disabled={disabled || isLoading}
      className="auth-btn-google"
      id="google-oauth-btn"
      aria-label={label}
    >
      {isLoading ? (
        <Loader2 size={18} className="spin-animation" />
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
          />
        </svg>
      )}
      <span>{isLoading ? 'Connecting to Google...' : label}</span>
    </button>
  );
};
