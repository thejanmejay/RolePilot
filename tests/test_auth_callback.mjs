import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseAuthCallbackParams,
  processAuthCallbackOnce,
} from '../frontend/src/services/authCallbackFlow.ts';
import { resolvePostAuthRoute } from '../frontend/src/utils/postAuthRoute.ts';

const confirmedUser = { id: 'user-1', email: 'candidate@example.com', email_confirmed_at: '2026-10-25T00:00:00Z' };
const session = { access_token: 'access-test', refresh_token: 'refresh-test', user: confirmedUser };

function authMock(overrides = {}) {
  const calls = { getSession: 0, exchangeCodeForSession: [], verifyOtp: [], setSession: 0, getUser: 0 };
  const auth = {
    async getSession() {
      calls.getSession += 1;
      return { data: { session } };
    },
    async exchangeCodeForSession(code) {
      calls.exchangeCodeForSession.push(code);
      return { data: { session } };
    },
    async verifyOtp(params) {
      calls.verifyOtp.push(params);
      return { data: { session, user: confirmedUser } };
    },
    async setSession() {
      calls.setSession += 1;
      return { data: { session, user: confirmedUser } };
    },
    async getUser() {
      calls.getUser += 1;
      return { data: { user: confirmedUser } };
    },
    ...overrides,
  };
  return { auth, calls };
}

test('parses implicit fragment, PKCE code, token hash, and error callback formats', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(parseAuthCallbackParams('https://rolepilot.example/auth/callback#access_token=a&refresh_token=r&type=signup')).filter(([, value]) => value !== undefined)),
    { accessToken: 'a', refreshToken: 'r', type: 'signup' },
  );
  assert.equal(parseAuthCallbackParams('https://rolepilot.example/auth/callback?code=pkce').code, 'pkce');
  assert.equal(parseAuthCallbackParams('https://rolepilot.example/auth/callback?token_hash=h&type=email').tokenHash, 'h');
  assert.equal(parseAuthCallbackParams('https://rolepilot.example/auth/callback?error=access_denied').error, 'access_denied');
});

test('restores the session auto-detected by Supabase without exchanging the callback code twice', async () => {
  const { auth, calls } = authMock();

  const result = await processAuthCallbackOnce(
    'https://rolepilot.example/auth/callback?code=already-exchanged',
    auth,
  );

  assert.equal(result.session.access_token, session.access_token);
  assert.equal(result.user.email_confirmed_at, confirmedUser.email_confirmed_at);
  assert.deepEqual(calls.exchangeCodeForSession, []);
});

test('exchanges a PKCE code when automatic URL restoration has no session', async () => {
  const { auth, calls } = authMock({
    async getSession() {
      calls.getSession += 1;
      return { data: { session: null } };
    },
  });

  const result = await processAuthCallbackOnce('https://rolepilot.example/auth/callback?code=fresh-code', auth);

  assert.equal(result.session.access_token, session.access_token);
  assert.deepEqual(calls.exchangeCodeForSession, ['fresh-code']);
});

test('verifies a token_hash callback and uses its session', async () => {
  const { auth, calls } = authMock();

  const result = await processAuthCallbackOnce(
    'https://rolepilot.example/auth/callback?token_hash=hash-value&type=email',
    auth,
  );

  assert.equal(result.session.access_token, session.access_token);
  assert.deepEqual(calls.verifyOtp, [{ token_hash: 'hash-value', type: 'email' }]);
});

test('restores implicit fragment tokens if automatic restoration has no session', async () => {
  const { auth, calls } = authMock({
    async getSession() {
      calls.getSession += 1;
      return { data: { session: null } };
    },
  });

  const result = await processAuthCallbackOnce(
    'https://rolepilot.example/auth/callback#access_token=access-test&refresh_token=refresh-test',
    auth,
  );

  assert.equal(result.session.access_token, session.access_token);
  assert.equal(calls.setSession, 1);
});

test('returns visible errors for missing credentials and rejected verification', async () => {
  const { auth, calls } = authMock({
    async getSession() {
      calls.getSession += 1;
      return { data: { session: null } };
    },
  });
  const missing = await processAuthCallbackOnce('https://rolepilot.example/auth/callback', auth);
  assert.match(missing.error, /missing its verification credentials/i);
  assert.equal(calls.getUser, 0);

  const invalidAuth = authMock({
    async verifyOtp() {
      return { error: { message: 'Token has expired or is invalid' } };
    },
  });
  const invalid = await processAuthCallbackOnce(
    'https://rolepilot.example/auth/callback?token_hash=bad&type=email',
    invalidAuth.auth,
  );
  assert.match(invalid.error, /expired or is invalid/i);
});

test('times out a stalled session lookup and rejects unconfirmed users', async () => {
  const stalled = authMock({ getSession: () => new Promise(() => {}) });
  const timeout = await processAuthCallbackOnce(
    'https://rolepilot.example/auth/callback#access_token=slow&refresh_token=slow',
    stalled.auth,
    5,
  );
  assert.match(timeout.error, /timed out/i);

  const unconfirmedAuth = authMock({
    async getUser() {
      return { data: { user: { email: 'waiting@example.com', email_confirmed_at: null } } };
    },
  });
  const unconfirmed = await processAuthCallbackOnce(
    'https://rolepilot.example/auth/callback#access_token=pending&refresh_token=pending',
    unconfirmedAuth.auth,
  );
  assert.equal(unconfirmed.unverifiedEmail, 'waiting@example.com');
  assert.match(unconfirmed.error, /not been confirmed/i);
});

test('shares in-flight callback processing to avoid duplicate StrictMode exchanges', async () => {
  let releaseSession;
  const { auth, calls } = authMock({
    getSession() {
      calls.getSession += 1;
      return new Promise((resolve) => { releaseSession = () => resolve({ data: { session } }); });
    },
  });
  const href = 'https://rolepilot.example/auth/callback#access_token=once&refresh_token=once';
  const first = processAuthCallbackOnce(href, auth);
  const second = processAuthCallbackOnce(href, auth);
  assert.equal(first, second);
  releaseSession();
  await Promise.all([first, second]);
  assert.equal(calls.getSession, 1);
});

test('routes only after auth, then checks policy before onboarding and dashboard', () => {
  const base = {
    isAuthLoading: false,
    isAuthenticated: true,
    isPolicyLoading: false,
    hasAcceptedPolicy: null,
    isProfileLoading: true,
    onboardingCompleted: false,
  };

  assert.equal(resolvePostAuthRoute({ ...base, isAuthLoading: true }), 'auth-loading');
  assert.equal(resolvePostAuthRoute(base), 'policy-loading');
  assert.equal(resolvePostAuthRoute({ ...base, hasAcceptedPolicy: false }), 'policy');
  assert.equal(resolvePostAuthRoute({ ...base, hasAcceptedPolicy: true }), 'profile-loading');
  assert.equal(resolvePostAuthRoute({ ...base, hasAcceptedPolicy: true, isProfileLoading: false }), 'onboarding');
  assert.equal(resolvePostAuthRoute({
    ...base,
    hasAcceptedPolicy: true,
    isProfileLoading: false,
    onboardingCompleted: true,
  }), 'dashboard');
});
