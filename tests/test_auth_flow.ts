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

console.log('--- All Authentication UI Unit Tests Passed Successfully! ---');
