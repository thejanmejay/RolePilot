import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/authService';

interface AuthCallbackPageProps {
  onNavigateDashboard: () => void;
  onNavigateLogin: () => void;
}

export const AuthCallbackPage: React.FC<AuthCallbackPageProps> = ({
  onNavigateDashboard,
  onNavigateLogin,
}) => {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const handleCallback = async () => {
      // 1. Check URL error parameters (e.g. from OAuth failure or cancellation)
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      const errorMsg =
        urlParams.get('error_description') ||
        hashParams.get('error_description') ||
        urlParams.get('error') ||
        hashParams.get('error');

      if (errorMsg) {
        if (isMounted) setError(decodeURIComponent(errorMsg));
        return;
      }

      if (!supabase) {
        if (isMounted) setError('Supabase authentication client is not initialized.');
        return;
      }

      try {
        // 2. Fetch active session established by Supabase redirect
        const { data, error: sessionErr } = await supabase.auth.getSession();

        if (sessionErr) {
          if (isMounted) setError(sessionErr.message);
          return;
        }

        if (data.session) {
          login(data.session.access_token, data.session, data.session.user);
          // Clean URL history
          window.history.replaceState(null, '', '/dashboard');
          if (isMounted) {
            onNavigateDashboard();
          }
          return;
        }

        // If no session yet, wait briefly for authStateChange
        const { data: listener } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            if (session?.access_token) {
              login(session.access_token, session, session.user);
              window.history.replaceState(null, '', '/dashboard');
              if (isMounted) {
                onNavigateDashboard();
              }
            }
          }
        );

        // Timeout fallback after 4 seconds
        setTimeout(() => {
          if (isMounted && !error) {
            setError('Authentication session could not be established. Please try logging in again.');
          }
          listener.subscription.unsubscribe();
        }, 4000);
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'An error occurred during authentication callback.');
        }
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, [login, onNavigateDashboard]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: '#F8FAFC',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.08)',
          padding: '36px 32px',
          boxSizing: 'border-box',
        }}
      >
        {error ? (
          <div>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <AlertCircle size={26} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px', color: '#0F172A' }}>
              Authentication Failed
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748B', lineHeight: '1.5', margin: '0 0 24px' }}>
              {error}
            </p>
            <button
              type="button"
              onClick={onNavigateLogin}
              className="auth-btn-primary"
              style={{ height: '42px', fontSize: '0.9rem' }}
            >
              <ArrowLeft size={16} />
              <span>Return to Login</span>
            </button>
          </div>
        ) : (
          <div>
            <Loader2 size={36} className="spin-animation" style={{ color: '#0A66C2', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 6px', color: '#0F172A' }}>
              Completing Authentication
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
              Verifying credentials and restoring your session...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
