import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getPasswordRecoveryLinkError,
  parseRecoveryLinkParams,
  resolvePasswordRecoveryState,
  mapPasswordUpdateError,
} from '../frontend/src/services/passwordRecoveryFlow.ts';

import { resolvePostAuthRoute } from '../frontend/src/utils/postAuthRoute.ts';

test('recovery callback errors are shown without reflecting URL credentials or provider details', () => {
  const error = getPasswordRecoveryLinkError(
    'https://rolepilot.example/reset-password#error=access_denied&error_description=link+expired&access_token=secret',
  );
  assert.match(error, /invalid or expired/i);
  assert.doesNotMatch(error, /secret|access_denied|link expired/i);
  assert.equal(
    getPasswordRecoveryLinkError('https://rolepilot.example/reset-password#access_token=secret&type=recovery'),
    null,
  );
  assert.equal(
    getPasswordRecoveryLinkError('https://rolepilot.example/reset-password?code=valid_pkce_code'),
    null,
  );
  assert.equal(
    getPasswordRecoveryLinkError('https://rolepilot.example/reset-password'),
    null,
  );
});

test('parseRecoveryLinkParams identifies recovery tokens, pkce code, and errors correctly', () => {
  const validHash = parseRecoveryLinkParams(
    'https://rolepilot.example/reset-password#access_token=token123&type=recovery&refresh_token=refresh123',
  );
  assert.equal(validHash.error, null);
  assert.equal(validHash.hasRecoveryIndicator, true);
  assert.equal(validHash.type, 'recovery');
  assert.equal(validHash.hasToken, true);

  const validCode = parseRecoveryLinkParams(
    'https://rolepilot.example/reset-password?code=code123&type=recovery',
  );
  assert.equal(validCode.error, null);
  assert.equal(validCode.hasRecoveryIndicator, true);
  assert.equal(validCode.code, 'code123');

  const directNav = parseRecoveryLinkParams('https://rolepilot.example/reset-password');
  assert.equal(directNav.error, null);
  assert.equal(directNav.hasRecoveryIndicator, false);
  assert.equal(directNav.hasToken, false);

  const errorLink = parseRecoveryLinkParams(
    'https://rolepilot.example/reset-password#error=access_denied&error_code=otp_expired',
  );
  assert.match(errorLink.error, /invalid or expired/i);
});

test('password form requires Supabase recovery event and active session, not a stale login session', () => {
  // 1. Loading state while session is being verified
  assert.equal(
    resolvePasswordRecoveryState({
      isAuthLoading: true,
      hasRecoveryEvent: false,
      hasSession: false,
      linkError: null,
    }),
    'checking',
  );

  // 2. Valid recovery session established
  assert.equal(
    resolvePasswordRecoveryState({
      isAuthLoading: false,
      hasRecoveryEvent: true,
      hasSession: true,
      linkError: null,
    }),
    'ready',
  );

  // 3. Stale normal session without recovery event is invalid
  assert.equal(
    resolvePasswordRecoveryState({
      isAuthLoading: false,
      hasRecoveryEvent: false,
      hasSession: true,
      linkError: null,
    }),
    'invalid',
  );

  // 4. Invalid or expired link error takes precedence
  assert.equal(
    resolvePasswordRecoveryState({
      isAuthLoading: false,
      hasRecoveryEvent: true,
      hasSession: true,
      linkError: 'expired',
    }),
    'invalid',
  );

  // 5. Direct navigation with no tokens and no recovery event
  assert.equal(
    resolvePasswordRecoveryState({
      isAuthLoading: false,
      hasRecoveryEvent: false,
      hasSession: false,
      linkError: null,
    }),
    'invalid',
  );
});

test('Post-auth routing: Case A — Setup and consent already complete -> dashboard', () => {
  const route = resolvePostAuthRoute({
    isAuthLoading: false,
    isAuthenticated: true,
    isPolicyLoading: false,
    hasAcceptedPolicy: true,
    isProfileLoading: false,
    onboardingCompleted: true,
  });
  assert.equal(route, 'dashboard');
});

test('Post-auth routing: Case B — Setup incomplete (consent complete) -> onboarding', () => {
  const route = resolvePostAuthRoute({
    isAuthLoading: false,
    isAuthenticated: true,
    isPolicyLoading: false,
    hasAcceptedPolicy: true,
    isProfileLoading: false,
    onboardingCompleted: false,
  });
  assert.equal(route, 'onboarding');
});

test('Post-auth routing: Case C — Required consent missing or outdated -> policy', () => {
  const route = resolvePostAuthRoute({
    isAuthLoading: false,
    isAuthenticated: true,
    isPolicyLoading: false,
    hasAcceptedPolicy: false,
    isProfileLoading: false,
    onboardingCompleted: false,
  });
  assert.equal(route, 'policy');
});

test('Post-auth routing: Case D — State loading fallbacks before determination', () => {
  // Auth loading
  assert.equal(
    resolvePostAuthRoute({
      isAuthLoading: true,
      isAuthenticated: false,
      isPolicyLoading: false,
      hasAcceptedPolicy: null,
      isProfileLoading: false,
      onboardingCompleted: false,
    }),
    'auth-loading',
  );

  // Policy loading
  assert.equal(
    resolvePostAuthRoute({
      isAuthLoading: false,
      isAuthenticated: true,
      isPolicyLoading: true,
      hasAcceptedPolicy: null,
      isProfileLoading: false,
      onboardingCompleted: false,
    }),
    'policy-loading',
  );

  // Profile loading
  assert.equal(
    resolvePostAuthRoute({
      isAuthLoading: false,
      isAuthenticated: true,
      isPolicyLoading: false,
      hasAcceptedPolicy: true,
      isProfileLoading: true,
      onboardingCompleted: false,
    }),
    'profile-loading',
  );

  // Unauthenticated
  assert.equal(
    resolvePostAuthRoute({
      isAuthLoading: false,
      isAuthenticated: false,
      isPolicyLoading: false,
      hasAcceptedPolicy: null,
      isProfileLoading: false,
      onboardingCompleted: false,
    }),
    'unauthenticated',
  );
});

test('Password validation rules: populate check, length policy, and matching', () => {
  function validatePasswords(p, cp) {
    if (!p && !cp) return 'Please enter and confirm your new password.';
    if (!p) return 'Please enter a new password.';
    if (!cp) return 'Please confirm your new password.';
    if (p.length < 8) return 'Password must be at least 8 characters long.';
    if (p !== cp) return 'Passwords do not match.';
    return null;
  }

  assert.equal(validatePasswords('', ''), 'Please enter and confirm your new password.');
  assert.equal(validatePasswords('', 'password123'), 'Please enter a new password.');
  assert.equal(validatePasswords('password123', ''), 'Please confirm your new password.');
  assert.equal(validatePasswords('short', 'short'), 'Password must be at least 8 characters long.');
  assert.equal(validatePasswords('password123', 'different456'), 'Passwords do not match.');
  assert.equal(validatePasswords('validPassword123!', 'validPassword123!'), null);
});

test('Vercel routes API and health requests before the SPA fallback', () => {
  const configs = [
    JSON.parse(readFileSync(new URL('../frontend/vercel.json', import.meta.url), 'utf8')),
    JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')),
  ];

  for (const config of configs) {
    assert.deepEqual(config.rewrites.slice(0, 2).map(({ source }) => source), ['/api/:path*', '/health']);
    assert.deepEqual(config.rewrites.at(-1), { source: '/(.*)', destination: '/index.html' });
  }
});

test('mapPasswordUpdateError: same_password error displays explicit instruction to choose another password', () => {
  // Case 1: code is same_password
  const errWithCode = mapPasswordUpdateError({
    code: 'same_password',
    message: 'New password should be different from the old password.',
  });
  assert.equal(
    errWithCode,
    'Your new password must be different from your current password. Please choose another password.',
  );

  // Case 2: message contains text without explicit code
  const errWithMessageOnly = mapPasswordUpdateError({
    message: 'New password should be different from the old password.',
  });
  assert.equal(
    errWithMessageOnly,
    'Your new password must be different from your current password. Please choose another password.',
  );

  // Case 3: string error
  const errString = mapPasswordUpdateError('same_password: New password should be different from the old password.');
  assert.equal(
    errString,
    'Your new password must be different from your current password. Please choose another password.',
  );
});

test('mapPasswordUpdateError: expired or invalid recovery session displays expired-link message only when truly expired', () => {
  const expiredCode = mapPasswordUpdateError({
    code: 'session_expired',
    message: 'Auth session missing or expired.',
  });
  assert.equal(
    expiredCode,
    'This password reset link is missing, invalid, or expired. Request a new reset email and open its latest link.',
  );

  const otpExpired = mapPasswordUpdateError({
    code: 'otp_expired',
    message: 'Token has expired.',
  });
  assert.equal(
    otpExpired,
    'This password reset link is missing, invalid, or expired. Request a new reset email and open its latest link.',
  );

  // Crucial requirement: other errors (like same_password) MUST NOT display the expired link message!
  const samePw = mapPasswordUpdateError({
    code: 'same_password',
    message: 'New password should be different from the old password.',
  });
  assert.doesNotMatch(samePw, /link is missing, invalid, or expired/i);
});

test('mapPasswordUpdateError: handles other Supabase update failures safely without leaking secrets', () => {
  // Weak password
  const weakErr = mapPasswordUpdateError({
    code: 'weak_password',
    message: 'Password must be at least 8 characters.',
  });
  assert.equal(weakErr, 'Password must be at least 8 characters long.');

  // Rate limit
  const rateLimitErr = mapPasswordUpdateError({
    code: 'over_request_rate_limit',
    message: 'For security purposes, you can only request this once every 60 seconds.',
  });
  assert.equal(rateLimitErr, 'Too many password update attempts. Please wait a moment and try again.');

  // Generic internal server error
  const serverErr = mapPasswordUpdateError({
    code: 'unexpected_failure',
    message: 'Internal DB transaction failed with connection id 12345 secret_key_abc',
  });
  assert.equal(serverErr, 'Unable to update your password right now. Please try again.');
  assert.doesNotMatch(serverErr, /secret_key_abc|transaction/i);

  // Null or undefined
  assert.equal(mapPasswordUpdateError(null), 'Unable to update your password right now. Please try again.');
});

test('Mock Supabase updateUser flow: success, same_password, and mismatch states', async () => {
  // Mock client simulation
  function mockUpdatePassword(newPassword, currentPassword, hasSession) {
    if (!hasSession) {
      return {
        success: false,
        error: mapPasswordUpdateError({ code: 'session_expired', message: 'No session' }),
      };
    }
    if (newPassword === currentPassword) {
      return {
        success: false,
        error: mapPasswordUpdateError({
          code: 'same_password',
          message: 'New password should be different from the old password.',
        }),
      };
    }
    return {
      success: true,
      message: 'Password updated successfully! Redirecting to your account...',
    };
  }

  // 1. Success case
  const successRes = mockUpdatePassword('brandNewPassword123!', 'oldPassword123!', true);
  assert.equal(successRes.success, true);
  assert.match(successRes.message, /Password updated successfully/i);

  // 2. same_password case
  const samePwRes = mockUpdatePassword('currentPassword123!', 'currentPassword123!', true);
  assert.equal(samePwRes.success, false);
  assert.equal(
    samePwRes.error,
    'Your new password must be different from your current password. Please choose another password.',
  );

  // 3. Expired session case
  const expiredRes = mockUpdatePassword('brandNewPassword123!', 'oldPassword123!', false);
  assert.equal(expiredRes.success, false);
  assert.equal(
    expiredRes.error,
    'This password reset link is missing, invalid, or expired. Request a new reset email and open its latest link.',
  );
});

test('Google sign-in button and separators are temporarily removed from LoginPage and SignupPage', () => {
  const loginSrc = readFileSync(new URL('../frontend/src/pages/LoginPage.tsx', import.meta.url), 'utf8');
  const signupSrc = readFileSync(new URL('../frontend/src/pages/SignupPage.tsx', import.meta.url), 'utf8');

  // Verify GoogleAuthButton is not actively rendered in JSX
  assert.doesNotMatch(loginSrc, /<GoogleAuthButton/);
  assert.doesNotMatch(signupSrc, /<GoogleAuthButton/);

  // Verify "or sign in with email" / "or sign up with email" dividers are removed
  assert.doesNotMatch(loginSrc, /or sign in with email/i);
  assert.doesNotMatch(signupSrc, /or sign up with email/i);

  // Verify clear comments indicating Google sign-in is intentionally hidden
  assert.match(loginSrc, /Google sign-in is intentionally hidden until Google OAuth credentials are configured in Supabase/i);
  assert.match(signupSrc, /Google sign-in is intentionally hidden until Google OAuth credentials are configured in Supabase/i);

  // Verify email & password form fields and actions are preserved
  assert.match(loginSrc, /id="login-email"/);
  assert.match(loginSrc, /id="login-password"/);
  assert.match(loginSrc, /onNavigateForgotPassword/);
  assert.match(signupSrc, /id="signup-email"/);
  assert.match(signupSrc, /id="signup-password"/);
});

test('Policy page does not display visible Version: draft-1 badge but preserves version tracking', () => {
  const policyPageSrc = readFileSync(new URL('../frontend/src/pages/PolicyAcceptancePage.tsx', import.meta.url), 'utf8');
  const policyCssSrc = readFileSync(new URL('../frontend/src/components/policy/policy.css', import.meta.url), 'utf8');

  // Verify version badge element is removed from UI
  assert.doesNotMatch(policyPageSrc, /policy-badge/);
  assert.doesNotMatch(policyPageSrc, /Version:\s*\{/i);

  // Verify unused policy-badge class removed from css
  assert.doesNotMatch(policyCssSrc, /\.policy-badge\s*\{/);

  // Verify policy title and actions are preserved
  assert.match(policyPageSrc, /ACTIVE_POLICY\.title/);
  assert.match(policyPageSrc, /Accept and Continue/i);
  assert.match(policyPageSrc, /Decline and Exit/i);
});


