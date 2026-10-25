export type PasswordRecoveryState = 'checking' | 'ready' | 'invalid' | 'updated';

export interface RecoveryLinkParams {
  error: string | null;
  hasRecoveryIndicator: boolean;
  type: string | null;
  code: string | null;
  hasToken: boolean;
}

export function parseRecoveryLinkParams(href: string): RecoveryLinkParams {
  try {
    const url = new URL(href);
    const query = url.searchParams;
    const rawFragment = url.hash.replace(/^#/, '');
    const fragmentQuery = rawFragment.includes('?')
      ? rawFragment.slice(rawFragment.indexOf('?') + 1)
      : rawFragment;
    const fragment = new URLSearchParams(fragmentQuery);

    const errorParam =
      query.get('error_description') ||
      fragment.get('error_description') ||
      query.get('error') ||
      fragment.get('error') ||
      query.get('error_code') ||
      fragment.get('error_code');

    const error = errorParam
      ? 'This password reset link is invalid or expired. Request a new reset email and open its latest link.'
      : null;

    const type = query.get('type') || fragment.get('type') || null;
    const code = query.get('code') || null;
    const hasToken = Boolean(
      query.get('access_token') ||
      fragment.get('access_token') ||
      query.get('token') ||
      fragment.get('token')
    );

    const hasRecoveryIndicator = type === 'recovery' || Boolean(code) || hasToken;

    return {
      error,
      hasRecoveryIndicator,
      type,
      code,
      hasToken,
    };
  } catch {
    return {
      error: 'This password reset link is invalid or expired. Request a new reset email and open its latest link.',
      hasRecoveryIndicator: false,
      type: null,
      code: null,
      hasToken: false,
    };
  }
}

export function getPasswordRecoveryLinkError(href: string): string | null {
  return parseRecoveryLinkParams(href).error;
}

/**
 * Validate recovery state.
 * Requires Supabase's PASSWORD_RECOVERY event and its active session.
 * A stale, normal login session is insufficient.
 */
export function resolvePasswordRecoveryState(input: {
  isAuthLoading: boolean;
  hasRecoveryEvent: boolean;
  hasSession: boolean;
  linkError: string | null;
  isCheckingTimeout?: boolean;
}): PasswordRecoveryState {
  if (input.linkError) return 'invalid';
  if (input.hasRecoveryEvent && input.hasSession) return 'ready';
  if (input.isAuthLoading && !input.isCheckingTimeout) return 'checking';
  return 'invalid';
}

export interface SupabaseAuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
  name?: string;
}

/**
 * Map password update errors to explicit, safe, and actionable messages.
 * Catches Supabase's same_password error specifically and avoids misleading
 * expired-link error messages unless the session/token is truly expired.
 */
export function mapPasswordUpdateError(
  error: SupabaseAuthErrorLike | string | null | undefined
): string {
  if (!error) {
    return 'Unable to update your password right now. Please try again.';
  }

  const code =
    typeof error === 'object' && error.code
      ? String(error.code).toLowerCase().trim()
      : '';

  const rawMessage =
    typeof error === 'object' && error.message
      ? String(error.message)
      : typeof error === 'string'
      ? error
      : '';

  const message = rawMessage.toLowerCase();

  // 1. Explicit same_password check
  if (
    code === 'same_password' ||
    message.includes('same_password') ||
    message.includes('new password should be different from the old password') ||
    message.includes('different from your current password') ||
    message.includes('different from the old password') ||
    message.includes('different from the old')
  ) {
    return 'Your new password must be different from your current password. Please choose another password.';
  }

  // 2. Explicit session / token expired checks
  if (
    code === 'session_expired' ||
    code === 'otp_expired' ||
    code === 'invalid_token' ||
    code === 'token_expired' ||
    message.includes('session missing') ||
    message.includes('session expired') ||
    message.includes('jwt expired') ||
    message.includes('token expired') ||
    message.includes('invalid token')
  ) {
    return 'This password reset link is missing, invalid, or expired. Request a new reset email and open its latest link.';
  }

  // 3. Password policy enforcement
  if (
    code === 'weak_password' ||
    code === 'password_too_short' ||
    message.includes('weak password') ||
    message.includes('at least 8 characters')
  ) {
    return 'Password must be at least 8 characters long.';
  }

  // 4. Rate limit check
  if (
    code === 'over_request_rate_limit' ||
    code === 'rate_limit' ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  ) {
    return 'Too many password update attempts. Please wait a moment and try again.';
  }

  // 5. Generic safe fallback (never expose tokens, URLs, or internal stack details)
  return 'Unable to update your password right now. Please try again.';
}
