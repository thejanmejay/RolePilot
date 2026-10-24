import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import type { Session, User } from '@supabase/supabase-js';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/authService';
import { processAuthCallbackOnce, type CallbackAuthClient } from '../services/authCallbackFlow';

interface AuthCallbackPageProps {
  onSuccess: () => void;
  onNavigateLogin: () => void;
  onNavigateVerifyEmail: (email: string) => void;
}

export const AuthCallbackPage: React.FC<AuthCallbackPageProps> = ({
  onSuccess,
  onNavigateLogin,
  onNavigateVerifyEmail,
}) => {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const handleCallback = async () => {
      if (!supabase) {
        setError('Supabase authentication client is not initialized.');
        return;
      }

      const result = await processAuthCallbackOnce(
        window.location.href,
        supabase.auth as unknown as CallbackAuthClient,
      );
      if (!isActive) return;

      if (result.error || !result.session || !result.user) {
        setUnverifiedEmail(result.unverifiedEmail || null);
        setError(result.error || 'Authentication did not return a valid session. Please try again.');
        return;
      }

      login(
        result.session.access_token,
        result.session as unknown as Session,
        result.user as unknown as User,
      );
      window.history.replaceState(null, '', '/');
      onSuccess();
    };

    void handleCallback();

    return () => {
      isActive = false;
    };
  }, [login, onSuccess]);

  const isLinkExpired = error && (
    error.toLowerCase().includes('expired') ||
    error.toLowerCase().includes('invalid') ||
    error.toLowerCase().includes('otp_expired') ||
    error.toLowerCase().includes('timed out') ||
    error.toLowerCase().includes('missing its verification credentials') ||
    error.toLowerCase().includes('no session was returned')
  );

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
              {isLinkExpired ? 'Verification Link Expired or Invalid' : 'Authentication Failed'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748B', lineHeight: '1.5', margin: '0 0 24px' }}>
              {isLinkExpired
                ? 'This verification link is invalid or has already expired. Please request a fresh verification email to activate your account.'
                : error}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {unverifiedEmail ? (
                <button
                  type="button"
                  onClick={() => onNavigateVerifyEmail(unverifiedEmail)}
                  className="auth-btn-primary"
                  style={{ height: '42px', fontSize: '0.9rem' }}
                >
                  <span>Resend Verification Email</span>
                </button>
              ) : isLinkExpired ? (
                <button
                  type="button"
                  onClick={() => onNavigateVerifyEmail('')}
                  className="auth-btn-primary"
                  style={{ height: '42px', fontSize: '0.9rem' }}
                >
                  <span>Request Fresh Verification Email</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={onNavigateLogin}
                className={unverifiedEmail || isLinkExpired ? 'auth-btn-secondary' : 'auth-btn-primary'}
                style={{ height: '42px', fontSize: '0.9rem' }}
              >
                <ArrowLeft size={16} />
                <span>Return to Login</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <Loader2 size={36} className="spin-animation" style={{ color: '#1769E8', margin: '0 auto 16px' }} />
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
