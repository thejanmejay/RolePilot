/**
 * Authentication service for RolePilot.
 * Complete Supabase Auth integration supporting:
 * - Email & Password signup with numeric OTP verification
 * - Resend OTP with cooldown support
 * - Google OAuth sign-in and callback session resolution
 * - Email & Password login
 * - Password recovery (reset email & update password)
 * - Session restoration & listener
 */

import { createClient, SupabaseClient, type Session, type User } from '@supabase/supabase-js';
import { apiClient } from '../api/client';
import { mapPasswordUpdateError } from './passwordRecoveryFlow';

// Read Vite environment variables with public defaults for production preview resilience
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || 'https://jgswscubkoevjmyorrha.supabase.co').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnc3dzY3Via29ldmpteW9ycmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MjIyMjYsImV4cCI6MjEwNjA5ODIyNn0.r7DNagli-Nfd5bgvSTqbKGM1QVSeYvELNpcd0DToJKE').trim();

export const REMEMBER_ME_STORAGE_KEY = 'rolepilot_remember_me';

export function getRememberMePreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if (window.sessionStorage?.getItem(REMEMBER_ME_STORAGE_KEY) === 'false') return false;
    if (window.localStorage?.getItem(REMEMBER_ME_STORAGE_KEY) === 'false') return false;
  } catch {
    // Safe fallback
  }
  return true;
}

export function setRememberMePreference(rememberMe: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (rememberMe) {
      window.localStorage?.setItem(REMEMBER_ME_STORAGE_KEY, 'true');
      window.sessionStorage?.removeItem(REMEMBER_ME_STORAGE_KEY);
    } else {
      window.sessionStorage?.setItem(REMEMBER_ME_STORAGE_KEY, 'false');
      window.localStorage?.setItem(REMEMBER_ME_STORAGE_KEY, 'false');
    }
  } catch {
    // Safe fallback
  }
}

/**
 * Dynamic storage adapter for Supabase client.
 * Respects Remember Me preference:
 * - Persistent (localStorage) when rememberMe is true (survives browser restarts).
 * - Session-only (sessionStorage) when rememberMe is false (cleared on browser/tab close).
 * - Falls back seamlessly between the two on page reloads so refreshing doesn't log the candidate out.
 */
export const dynamicAuthStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const sessionVal = window.sessionStorage?.getItem(key);
      if (sessionVal !== null) return sessionVal;
      return window.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      const remember = getRememberMePreference();
      if (remember) {
        window.localStorage?.setItem(key, value);
        window.sessionStorage?.removeItem(key);
      } else {
        window.sessionStorage?.setItem(key, value);
        window.localStorage?.removeItem(key);
      }
    } catch {
      // Safe fallback
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.removeItem(key);
      window.sessionStorage?.removeItem(key);
    } catch {
      // Safe fallback
    }
  },
};

export let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: dynamicAuthStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    console.error('Failed to initialize Supabase client. Check the public Supabase URL and anon key configuration.');
  }
}

export interface AuthResult {
  success: boolean;
  token?: string;
  email?: string;
  user?: User | null;
  session?: Session | null;
  requiresEmailVerification?: boolean;
  isDeletedAccount?: boolean;
  message?: string;
  error?: string;
}

export const authService = {
  isConfigured(): boolean {
    return !!supabase;
  },

  getClient(): SupabaseClient | null {
    return supabase;
  },

  getRememberMe(): boolean {
    return getRememberMePreference();
  },

  setRememberMe(rememberMe: boolean): void {
    setRememberMePreference(rememberMe);
  },

  /**
   * Validate whether an email is available and not reserved by a previously deleted account.
   */
  async checkRegistrationEmail(email: string): Promise<{ allowed: boolean; isDeletedAccount?: boolean; error?: string }> {
    try {
      await apiClient.post<{ allowed: boolean; message: string }>('/api/v1/auth/check-registration', {
        email: email.trim(),
      });
      return { allowed: true };
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.message || '';
      if (status === 409 || typeof detail === 'string' && detail.toLowerCase().includes('previously deleted')) {
        return {
          allowed: false,
          isDeletedAccount: true,
          error:
            'An account associated with this email address was previously deleted, and a new account cannot be created with it. If you believe this is a mistake or need assistance, please contact RolePilot Support.',
        };
      }
      return { allowed: true };
    }
  },

  /**
   * Register a new user with email, password, and full name.
   * Checks authoritative email reservations against deleted accounts before invoking Supabase Auth.
   * Supabase sends a one-time verification code (OTP) to the email.
   */
  async signUp(params: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<AuthResult> {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase Auth is not configured. Missing SUPABASE_URL or SUPABASE_ANON_KEY.',
      };
    }

    try {
      // 1. Authoritative check against deleted account email reservation
      const emailCheck = await this.checkRegistrationEmail(params.email);
      if (!emailCheck.allowed) {
        return {
          success: false,
          isDeletedAccount: true,
          error: emailCheck.error || 'Registration is unavailable for this email address.',
        };
      }

      const nameParts = params.fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { data, error } = await supabase.auth.signUp({
        email: params.email.trim(),
        password: params.password,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: params.fullName.trim(),
          },
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      // If user already exists, Supabase returns empty identities array under email enumeration protection
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return {
          success: false,
          error: 'An account with this email address already exists. Please log in with your password, or use Forgot Password to reset it.',
        };
      }


      // If email confirmation is enabled (link-based confirmation flow)
      const isConfirmed = !!data.user?.email_confirmed_at;
      if (!isConfirmed) {
        return {
          success: true,
          requiresEmailVerification: true,
          email: params.email.trim(),
          user: data.user,
          message: "Account created! We've sent a verification link to your email address.",
        };
      }

      if (data.session?.access_token) {
        return {
          success: true,
          token: data.session.access_token,
          email: data.user?.email,
          user: data.user,
          session: data.session,
          message: 'Account created and authenticated successfully.',
        };
      }

      return {
        success: true,
        requiresEmailVerification: true,
        email: params.email.trim(),
        user: data.user,
        message: "Account created! We've sent a verification link to your email address.",
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'An unexpected error occurred during signup.',
      };
    }
  },

  /**
   * Verify email OTP code for user registration or email confirmation.
   */
  async verifyOtp(params: {
    email: string;
    token: string;
    type?: 'signup' | 'email';
  }): Promise<AuthResult> {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase Auth is not configured.',
      };
    }

    try {
      const email = params.email.trim();
      const code = params.token.trim();

      // Try with type 'signup' first, fallback to 'email' if needed
      let res = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: params.type || 'signup',
      });

      if (res.error && params.type !== 'email') {
        res = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: 'email',
        });
      }

      if (res.error) {
        return {
          success: false,
          error: res.error.message || 'Invalid or expired verification code.',
        };
      }

      if (res.data.session?.access_token) {
        return {
          success: true,
          token: res.data.session.access_token,
          email: res.data.user?.email,
          user: res.data.user,
          session: res.data.session,
          message: 'Email verified successfully!',
        };
      }

      return {
        success: true,
        email,
        user: res.data.user,
        message: 'Verification successful. You can now log in.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Verification failed. Please check your code and try again.',
      };
    }
  },

  /**
   * Resend confirmation email link to candidate's email address.
   */
  async resendVerificationEmail(params: {
    email: string;
    type?: 'signup' | 'email_change';
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase Auth is not configured.',
      };
    }

    try {
      const { error } = await supabase.auth.resend({
        type: params.type || 'signup',
        email: params.email.trim(),
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        message: `A new verification link has been sent to ${params.email}.`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to resend verification email.',
      };
    }
  },

  /**
   * Backward-compatible alias for resendVerificationEmail.
   */
  async resendOtp(params: {
    email: string;
    type?: 'signup' | 'email_change';
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    return this.resendVerificationEmail(params);
  },

  /**
   * Sign in with Google OAuth.
   * Redirects user to Google OAuth consent screen.
   */
  async signInWithGoogle(): Promise<{ error?: string }> {
    if (!supabase) {
      return {
        error: 'Supabase Auth is not configured.',
      };
    }

    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (err: any) {
      return { error: err.message || 'Failed to initiate Google authentication.' };
    }
  },

  /**
   * Sign in with email and password.
   */
  async signIn(params: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<AuthResult> {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase Auth is not configured.',
      };
    }

    if (params.rememberMe !== undefined) {
      this.setRememberMe(params.rememberMe);
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: params.email.trim(),
        password: params.password,
      });

      if (error) {
        // Check if unconfirmed email error
        if (error.message.toLowerCase().includes('email not confirmed')) {
          // Trigger a fresh verification email dispatch
          try {
            await supabase.auth.resend({
              type: 'signup',
              email: params.email.trim(),
              options: {
                emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
              },
            });
          } catch {
            console.warn('Automatic verification email resend failed.');
          }

          return {
            success: false,
            requiresEmailVerification: true,
            email: params.email.trim(),
            error: "Your email address is not verified yet. We've sent a verification link to your email address.",
          };
        }

        const normalizedMessage = error.message.toLowerCase();
        const userMessage = normalizedMessage.includes('invalid login credentials')
          ? 'Email or password is incorrect. If you have not created an account, sign up first. If you forgot your password, use the password reset link.'
          : error.message;
        return {
          success: false,
          error: userMessage,
        };
      }

      // Check authoritative email confirmation status
      if (data.user && !data.user.email_confirmed_at) {
        try {
          await supabase.auth.resend({
            type: 'signup',
            email: params.email.trim(),
            options: {
              emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
            },
          });
        } catch {
          // Ignore rate limit or background error
        }

        return {
          success: false,
          requiresEmailVerification: true,
          email: params.email.trim(),
          user: data.user,
          error: "Your email is not verified yet. We've sent a verification link to your email address.",
        };
      }

      if (!data.session?.access_token) {
        return {
          success: false,
          error: 'Authentication completed but no access token was returned.',
        };
      }

      return {
        success: true,
        token: data.session.access_token,
        email: data.user?.email,
        user: data.user,
        session: data.session,
        message: 'Signed in successfully.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'An unexpected error occurred during sign in.',
      };
    }
  },

  /**
   * Send password reset email.
   */
  async resetPassword(email: string, redirectUrl?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase Auth is not configured.',
      };
    }

    try {
      const redirectTo = redirectUrl || `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) {
        return {
          success: false,
          error: 'We could not send a password reset email. Please try again later.',
        };
      }

      return {
        success: true,
        message: `If an account exists for ${email.trim()}, a password recovery link will be sent. Please check your inbox.`,
      };
    } catch {
      return {
        success: false,
        error: 'We could not send a password reset email. Please try again later.',
      };
    }
  },

  /**
   * Update password for an active session (e.g. from password reset link).
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase Auth is not configured.',
      };
    }

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        return {
          success: false,
          error: mapPasswordUpdateError({ code: 'session_expired', message: 'Auth session missing or expired.' }),
        };
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return {
          success: false,
          error: mapPasswordUpdateError(error),
        };
      }

      return {
        success: true,
        message: 'Password updated successfully! Redirecting to your account...',
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: mapPasswordUpdateError(err as import('./passwordRecoveryFlow').SupabaseAuthErrorLike),
      };
    }
  },

  /**
   * Get current Supabase session.
   */
  async getSession(): Promise<{ session: Session | null; user: User | null }> {
    if (!supabase) {
      return { session: null, user: null };
    }
    try {
      const { data } = await supabase.auth.getSession();
      return { session: data.session, user: data.session?.user || null };
    } catch {
      return { session: null, user: null };
    }
  },

  /** Permanently delete the authenticated account through the trusted backend. */
  async deleteAccount(): Promise<void> {
    await apiClient.delete<void>('/api/v1/account');
  },

  /**
   * Clear all RolePilot-owned client-side storage, tokens, and session traces safely.
   */
  clearLocalClientData(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('supabase_access_token');
        window.localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);

        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (
            key &&
            (key === 'supabase_access_token' ||
              key.startsWith('sb-') ||
              key.startsWith('rolepilot_'))
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => {
          try {
            window.localStorage.removeItem(key);
          } catch {
            // Safe fallback
          }
        });
      }

      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem('supabase_access_token');
        window.sessionStorage.removeItem(REMEMBER_ME_STORAGE_KEY);

        const sessionKeysToRemove: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (
            key &&
            (key.startsWith('rolepilot_') ||
              key.startsWith('sb-') ||
              key.includes('token') ||
              key.includes('auth'))
          ) {
            sessionKeysToRemove.push(key);
          }
        }
        sessionKeysToRemove.forEach((key) => {
          try {
            window.sessionStorage.removeItem(key);
          } catch {
            // Safe fallback
          }
        });
      }
    } catch {
      // Gracefully handle sandboxed or restricted storage environments
    }

    // Clear RolePilot CacheStorage if supported
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        window.caches.keys().then((keys) => {
          keys
            .filter((k) => k.toLowerCase().includes('rolepilot'))
            .forEach((k) => window.caches.delete(k));
        }).catch(() => null);
      } catch {
        // Safe fallback
      }
    }
  },

  /**
   * Sign out of current Supabase session and thoroughly clear all local client data.
   */
  async signOut(): Promise<void> {
    if (supabase) {
      try {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => null);
      } catch {
        console.warn('Supabase signout failed; local session data was cleared.');
      }
    }
    this.clearLocalClientData();
  },
};
