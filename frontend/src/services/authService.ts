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

export let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
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

  /**
   * Register a new user with email, password, and full name.
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
  }): Promise<AuthResult> {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase Auth is not configured.',
      };
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
   * Sign out of current Supabase session and clear client state.
   */
  async signOut(): Promise<void> {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        console.warn('Supabase signout failed; local session data was cleared.');
      }
    }
    localStorage.removeItem('supabase_access_token');
  },
};
