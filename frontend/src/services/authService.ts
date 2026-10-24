/**
 * Authentication service for LinkedIn Hunter V2.
 * Integrates directly with Supabase Auth when credentials are provided in the environment.
 * If credentials are missing, provides structured status without mocking credentials.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read Vite environment variables
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

let supabaseInstance: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  email?: string;
  fullName?: string;
  requiresEmailConfirmation?: boolean;
  message?: string;
  error?: string;
}

export const authService = {
  /**
   * Check if Supabase client is configured in current environment.
   */
  isConfigured(): boolean {
    return !!supabaseInstance;
  },

  /**
   * Register a new user with email, password, and full name.
   */
  async signUp(params: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<AuthResponse> {
    if (!supabaseInstance) {
      return {
        success: false,
        error:
          'Supabase Auth is not configured in this environment (missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY). Please add credentials to frontend/.env or sign in using a test token from scripts/get_test_token.py.',
      };
    }

    try {
      const { data, error } = await supabaseInstance.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: {
            full_name: params.fullName,
          },
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      if (data.session?.access_token) {
        return {
          success: true,
          token: data.session.access_token,
          email: data.user?.email,
          fullName: params.fullName,
          message: 'Account created and signed in successfully.',
        };
      }

      // If Supabase has email confirmation enabled
      return {
        success: true,
        requiresEmailConfirmation: true,
        email: params.email,
        message:
          'Account created! A confirmation email has been sent. Please check your inbox to activate your account.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'An unexpected error occurred during signup.',
      };
    }
  },

  /**
   * Sign in an existing user with email and password.
   */
  async signIn(params: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<AuthResponse> {
    if (!supabaseInstance) {
      return {
        success: false,
        error:
          'Supabase Auth is not configured in this environment (missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY). Please add credentials to frontend/.env or sign in using a test token from scripts/get_test_token.py.',
      };
    }

    try {
      const { data, error } = await supabaseInstance.auth.signInWithPassword({
        email: params.email,
        password: params.password,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
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
   * Request password recovery email.
   */
  async resetPassword(email: string): Promise<AuthResponse> {
    if (!supabaseInstance) {
      return {
        success: false,
        error:
          'Supabase Auth is not configured in this environment (missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY). Password recovery requires a live Supabase instance.',
      };
    }

    try {
      const redirectTo = `${window.location.origin}/login?reset=true`;
      const { error } = await supabaseInstance.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        message: `A password reset link has been sent to ${email} if an account exists.`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to send password reset request.',
      };
    }
  },

  /**
   * Sign out current Supabase session if initialized.
   */
  async signOut(): Promise<void> {
    if (supabaseInstance) {
      try {
        await supabaseInstance.auth.signOut();
      } catch (err) {
        console.warn('Error during Supabase signout:', err);
      }
    }
  },
};
