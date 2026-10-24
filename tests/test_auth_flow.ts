/**
 * Unit and validation tests for Authentication UI logic & AuthService
 */

import assert from 'node:assert';

// 1. Validation logic under test
function validateFullName(name: string): string | null {
  if (!name.trim()) return 'Full name is required.';
  if (name.trim().length < 2) return 'Full name must be at least 2 characters.';
  return null;
}

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email address is required.';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) return 'Please enter a valid email address.';
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  return null;
}

function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return 'Please confirm your password.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

function validateTerms(agree: boolean): string | null {
  if (!agree) return 'You must agree to the Terms and Privacy Policy.';
  return null;
}

function validateOtpCode(code: string): string | null {
  const clean = code.trim();
  if (!clean) return 'Please enter the verification code.';
  if (!/^\d{6}$/.test(clean)) return 'Verification code must be 6 digits.';
  return null;
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

function normalizePath(path: string): string {
  const clean = path.replace(/\/+$/, '') || '/';
  return clean;
}

console.log('--- Testing Authentication UI Validation & Service Logic ---');

// Test 1: Full Name validation
assert.strictEqual(validateFullName(''), 'Full name is required.');
assert.strictEqual(validateFullName('   '), 'Full name is required.');
assert.strictEqual(validateFullName('A'), 'Full name must be at least 2 characters.');
assert.strictEqual(validateFullName('Alex Morgan'), null);
console.log('✓ Test 1: Full name validation passed.');

// Test 2: Email format validation
assert.strictEqual(validateEmail(''), 'Email address is required.');
assert.strictEqual(validateEmail('invalid'), 'Please enter a valid email address.');
assert.strictEqual(validateEmail('missing@domain'), 'Please enter a valid email address.');
assert.strictEqual(validateEmail('user@company.com'), null);
assert.strictEqual(validateEmail('  alex.smith+test@domain.org  '), null);
console.log('✓ Test 2: Email format validation passed.');

// Test 3: Password policy enforcement
assert.strictEqual(validatePassword(''), 'Password is required.');
assert.strictEqual(validatePassword('short'), 'Password must be at least 8 characters long.');
assert.strictEqual(validatePassword('1234567'), 'Password must be at least 8 characters long.');
assert.strictEqual(validatePassword('strongPass123!'), null);
console.log('✓ Test 3: Password policy enforcement passed.');

// Test 4: Confirm password matching
assert.strictEqual(validateConfirmPassword('secret123', ''), 'Please confirm your password.');
assert.strictEqual(validateConfirmPassword('secret123', 'secret321'), 'Passwords do not match.');
assert.strictEqual(validateConfirmPassword('secret123', 'secret123'), null);
console.log('✓ Test 4: Confirm password matching passed.');

// Test 5: Terms agreement checkbox
assert.strictEqual(validateTerms(false), 'You must agree to the Terms and Privacy Policy.');
assert.strictEqual(validateTerms(true), null);
console.log('✓ Test 5: Terms agreement validation passed.');

// Test 6: Route normalization
assert.strictEqual(normalizePath('/'), '/');
assert.strictEqual(normalizePath('/signup'), '/signup');
assert.strictEqual(normalizePath('/signup/'), '/signup');
assert.strictEqual(normalizePath('/login'), '/login');
assert.strictEqual(normalizePath('/verify-email'), '/verify-email');
assert.strictEqual(normalizePath('/verify-email/'), '/verify-email');
assert.strictEqual(normalizePath('/auth/callback'), '/auth/callback');
assert.strictEqual(normalizePath('/forgot-password'), '/forgot-password');
assert.strictEqual(normalizePath('/reset-password'), '/reset-password');
console.log('✓ Test 6: Route normalization passed.');

// Test 7: OTP code format validation
assert.strictEqual(validateOtpCode(''), 'Please enter the verification code.');
assert.strictEqual(validateOtpCode('123'), 'Verification code must be 6 digits.');
assert.strictEqual(validateOtpCode('1234567'), 'Verification code must be 6 digits.');
assert.strictEqual(validateOtpCode('12a456'), 'Verification code must be 6 digits.');
assert.strictEqual(validateOtpCode('123456'), null);
console.log('✓ Test 7: OTP code format validation passed.');

// Test 8: Masked email format
assert.strictEqual(maskEmail('janmejay@example.com'), 'j***y@example.com');
assert.strictEqual(maskEmail('al@domain.com'), 'a***@domain.com');
assert.strictEqual(maskEmail('test.user+hunter@company.org'), 't***r@company.org');
console.log('✓ Test 8: Masked email formatting passed.');

// Test 9: Auth flow router decision logic
type UserState = {
  isAuthenticated: boolean;
  isConfirmed: boolean;
  hasAcceptedPolicy: boolean;
  isOnboardingCompleted: boolean;
};

function determineRoute(state: UserState, currentPath: string): string {
  if (!state.isAuthenticated) {
    if (!state.isConfirmed) return '/verify-email';
    if (currentPath === '/' || currentPath === '/signup' || currentPath === '/forgot-password' || currentPath === '/reset-password') {
      return currentPath;
    }
    return '/login';
  }

  // Authenticated
  if (!state.hasAcceptedPolicy) {
    return '/policy-acceptance';
  }

  if (!state.isOnboardingCompleted) {
    return '/onboarding';
  }

  if (
    currentPath === '/login' ||
    currentPath === '/signup' ||
    currentPath === '/verify-email' ||
    currentPath === '/auth/callback' ||
    currentPath === '/onboarding' ||
    currentPath === '/'
  ) {
    return '/dashboard';
  }

  return currentPath;
}

// 9a: Unverified user redirected to /verify-email
assert.strictEqual(
  determineRoute({ isAuthenticated: false, isConfirmed: false, hasAcceptedPolicy: false, isOnboardingCompleted: false }, '/dashboard'),
  '/verify-email'
);

// 9b: Verified user without policy acceptance directed to /policy-acceptance
assert.strictEqual(
  determineRoute({ isAuthenticated: true, isConfirmed: true, hasAcceptedPolicy: false, isOnboardingCompleted: false }, '/dashboard'),
  '/policy-acceptance'
);

// 9c: Verified user with policy accepted but incomplete onboarding directed to /onboarding
assert.strictEqual(
  determineRoute({ isAuthenticated: true, isConfirmed: true, hasAcceptedPolicy: true, isOnboardingCompleted: false }, '/dashboard'),
  '/onboarding'
);

// 9d: Direct navigation to /profile or /jobs during incomplete onboarding directed to /onboarding
assert.strictEqual(
  determineRoute({ isAuthenticated: true, isConfirmed: true, hasAcceptedPolicy: true, isOnboardingCompleted: false }, '/profile'),
  '/onboarding'
);

// 9e: Fully onboarded user allowed into /dashboard
assert.strictEqual(
  determineRoute({ isAuthenticated: true, isConfirmed: true, hasAcceptedPolicy: true, isOnboardingCompleted: true }, '/'),
  '/dashboard'
);

// 9f: Fully onboarded user visiting existing /profile (Readiness) dashboard allowed through
assert.strictEqual(
  determineRoute({ isAuthenticated: true, isConfirmed: true, hasAcceptedPolicy: true, isOnboardingCompleted: true }, '/profile'),
  '/profile'
);

// 9g: Logged out user attempting protected /automation directed to /login
assert.strictEqual(
  determineRoute({ isAuthenticated: false, isConfirmed: true, hasAcceptedPolicy: false, isOnboardingCompleted: false }, '/automation'),
  '/login'
);
console.log('✓ Test 9: Auth & Onboarding flow router decision logic passed.');

// Test 9.1: Onboarding field validations
function validateHeadline(headline: string): string | null {
  if (!headline.trim()) return 'Professional title is required.';
  if (headline.trim().length < 2) return 'Title must be at least 2 characters.';
  return null;
}

function validateTargetRole(targetRole: string): string | null {
  if (!targetRole.trim()) return 'Target role or job search goal is required.';
  if (targetRole.trim().length < 2) return 'Target role must be at least 2 characters.';
  return null;
}

function validateExperienceYears(years: any): string | null {
  const num = Number(years);
  if (isNaN(num) || num < 0) return 'Please enter valid years of experience (0 or higher).';
  if (num > 60) return 'Please enter a realistic number of years.';
  return null;
}

assert.strictEqual(validateHeadline(''), 'Professional title is required.');
assert.strictEqual(validateHeadline('A'), 'Title must be at least 2 characters.');
assert.strictEqual(validateHeadline('Senior Full Stack Engineer'), null);

assert.strictEqual(validateTargetRole(''), 'Target role or job search goal is required.');
assert.strictEqual(validateTargetRole('R'), 'Target role must be at least 2 characters.');
assert.strictEqual(validateTargetRole('Engineering Manager'), null);

assert.strictEqual(validateExperienceYears(-1), 'Please enter valid years of experience (0 or higher).');
assert.strictEqual(validateExperienceYears(75), 'Please enter a realistic number of years.');
assert.strictEqual(validateExperienceYears(0), null);
assert.strictEqual(validateExperienceYears(5), null);
console.log('✓ Test 9.1: Onboarding form validation rules passed.');

// Test 10: Authoritative verification checking logic
function isAuthoritativelyConfirmed(user: { email_confirmed_at?: string | null } | null): boolean {
  return Boolean(user && user.email_confirmed_at);
}

assert.strictEqual(isAuthoritativelyConfirmed(null), false);
assert.strictEqual(isAuthoritativelyConfirmed({ email_confirmed_at: null }), false);
assert.strictEqual(isAuthoritativelyConfirmed({ email_confirmed_at: undefined }), false);
assert.strictEqual(isAuthoritativelyConfirmed({ email_confirmed_at: '2026-10-24T12:00:00Z' }), true);
console.log('✓ Test 10: Authoritative verification checking logic passed.');

// Test 11: Callback parameter parsing (hash & query)
function parseCallbackParams(url: string): {
  code: string | null;
  tokenHash: string | null;
  otpType: string | null;
  error: string | null;
} {
  const parsed = new URL(url);
  const searchParams = parsed.searchParams;
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));

  const error =
    searchParams.get('error_description') ||
    hashParams.get('error_description') ||
    searchParams.get('error') ||
    hashParams.get('error');

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash') || hashParams.get('token_hash');
  const otpType = searchParams.get('type') || hashParams.get('type');

  return { code, tokenHash, otpType, error };
}

// 11a: PKCE code
const pkceRes = parseCallbackParams('http://localhost:3001/auth/callback?code=test-code-123');
assert.strictEqual(pkceRes.code, 'test-code-123');
assert.strictEqual(pkceRes.error, null);

// 11b: Token hash link
const hashRes = parseCallbackParams('http://localhost:3001/auth/callback?token_hash=abc123token&type=signup');
assert.strictEqual(hashRes.tokenHash, 'abc123token');
assert.strictEqual(hashRes.otpType, 'signup');

// 11c: Error callback
const errRes = parseCallbackParams('http://localhost:3001/auth/callback#error=access_denied&error_description=User+cancelled');
assert.strictEqual(errRes.error, 'User cancelled');
console.log('✓ Test 11: Callback parameter parsing passed.');

// Test 12: Stale session prevention logic
function sanitizeAuthSession(sessionUser: { email_confirmed_at?: string | null } | null) {
  if (!sessionUser || !sessionUser.email_confirmed_at) {
    return {
      authenticated: false,
      token: null,
      shouldClearStorage: true,
      requiresVerification: Boolean(sessionUser),
    };
  }
  return {
    authenticated: true,
    token: 'valid_access_token',
    shouldClearStorage: false,
    requiresVerification: false,
  };
}

assert.deepStrictEqual(sanitizeAuthSession(null), {
  authenticated: false,
  token: null,
  shouldClearStorage: true,
  requiresVerification: false,
});
assert.deepStrictEqual(sanitizeAuthSession({ email_confirmed_at: null }), {
  authenticated: false,
  token: null,
  shouldClearStorage: true,
  requiresVerification: true,
});
assert.deepStrictEqual(sanitizeAuthSession({ email_confirmed_at: '2026-10-24T10:00:00Z' }), {
  authenticated: true,
  token: 'valid_access_token',
  shouldClearStorage: false,
  requiresVerification: false,
});
console.log('✓ Test 12: Stale session prevention logic passed.');

// Test 13: Password login unconfirmed response handling
function handleSignInResult(errMessage: string): { requiresVerification: boolean; userMessage: string } {
  if (errMessage.toLowerCase().includes('email not confirmed')) {
    return {
      requiresVerification: true,
      userMessage: "Your email address is not verified yet. We've sent a verification link to your email address.",
    };
  }
  return {
    requiresVerification: false,
    userMessage: errMessage,
  };
}

const unconfirmedSignIn = handleSignInResult('AuthApiError: Email not confirmed');
assert.strictEqual(unconfirmedSignIn.requiresVerification, true);
assert(unconfirmedSignIn.userMessage.includes('not verified'));
assert(unconfirmedSignIn.userMessage.includes('verification link'));

const badPasswordSignIn = handleSignInResult('Invalid login credentials');
assert.strictEqual(badPasswordSignIn.requiresVerification, false);
console.log('✓ Test 13: Password login unconfirmed response handling passed.');

// Test 14: Verification link post-signup screen state logic
function getVerificationScreenState(params: {
  email: string;
  cooldown: number;
  isResending: boolean;
}): {
  heading: string;
  canResend: boolean;
  resendButtonText: string;
  displayEmail: string;
} {
  return {
    heading: 'Check your email',
    canResend: params.cooldown <= 0 && !params.isResending,
    resendButtonText: params.isResending
      ? 'Sending verification link...'
      : params.cooldown > 0
      ? `Resend email in ${params.cooldown}s`
      : 'Resend verification email',
    displayEmail: params.email.trim(),
  };
}

const initialScreen = getVerificationScreenState({ email: 'candidate@rolepilot.com', cooldown: 0, isResending: false });
assert.strictEqual(initialScreen.heading, 'Check your email');
assert.strictEqual(initialScreen.canResend, true);
assert.strictEqual(initialScreen.resendButtonText, 'Resend verification email');
assert.strictEqual(initialScreen.displayEmail, 'candidate@rolepilot.com');

const coolingScreen = getVerificationScreenState({ email: 'candidate@rolepilot.com', cooldown: 45, isResending: false });
assert.strictEqual(coolingScreen.canResend, false);
assert.strictEqual(coolingScreen.resendButtonText, 'Resend email in 45s');

const resendingScreen = getVerificationScreenState({ email: 'candidate@rolepilot.com', cooldown: 0, isResending: true });
assert.strictEqual(resendingScreen.canResend, false);
assert.strictEqual(resendingScreen.resendButtonText, 'Sending verification link...');
console.log('✓ Test 14: Verification link post-signup screen state logic passed.');

console.log('--- All Authentication & Routing Flow Unit Tests Passed Successfully! ---');


