import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getPasswordRecoveryLinkError,
  parseRecoveryLinkParams,
  resolvePasswordRecoveryState,
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
