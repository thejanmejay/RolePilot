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
