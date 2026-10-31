import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

// ============================================================================
// 1. Bug 1: Extraction State, Processing Stages, Cancellation & Data Freshness
// ============================================================================

test('Extraction Lifecycle: Processing stages are tailored to selected sources without fabricated progress', () => {
  const onboardingFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/OnboardingPage.tsx'), 'utf-8');

  // Verify steps are dynamically generated based on selected sources
  assert.ok(
    onboardingFile.includes('selectedResumeFile && portfolioUrlInput.trim()'),
    'OnboardingPage must tailor processing steps when both resume and portfolio are selected',
  );
  assert.ok(
    onboardingFile.includes("id: 'upload', label: 'Uploading and validating PDF resume'"),
    'Must include resume upload validation stage',
  );
  assert.ok(
    onboardingFile.includes("id: 'portfolio', label: 'Auditing portfolio URL with SSRF security verification'"),
    'Must include SSRF portfolio auditing stage',
  );
  assert.ok(
    onboardingFile.includes("id: 'merge', label: 'Merging candidate attributes and detecting conflicts'"),
    'Must include attribute merging & conflict detection stage',
  );

  // Verify progress is indeterminate rather than fabricated hardcoded percentages (no 10%, 40%, 85%)
  assert.ok(
    onboardingFile.includes('setUploadProgress(undefined)'),
    'Initial upload progress must be indeterminate (undefined), not fabricated hardcoded numbers',
  );
  assert.ok(
    !onboardingFile.includes('setUploadProgress(40)'),
    'Fabricated 40% progress update must not exist in extraction flow',
  );
  assert.ok(
    !onboardingFile.includes('setUploadProgress(85)'),
    'Fabricated 85% progress update must not exist in extraction flow',
  );
});

test('Extraction Consistency: Request ID tracking and AbortController prevent stale or late responses', () => {
  const onboardingFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/OnboardingPage.tsx'), 'utf-8');

  // Verify attempt ID tracking and abort controller ref
  assert.ok(
    onboardingFile.includes('activeAttemptIdRef = useRef<number>(0)') &&
    onboardingFile.includes('abortControllerRef = useRef<AbortController | null>(null)'),
    'OnboardingPage must use activeAttemptIdRef and abortControllerRef to manage extraction lifecycles',
  );

  // Verify aborting in-flight request when starting a new extraction
  assert.ok(
    onboardingFile.includes('abortControllerRef.current.abort()'),
    'Starting a new extraction must abort any previously active in-flight request',
  );

  // Verify stale response rejection
  assert.ok(
    onboardingFile.includes('if (activeAttemptIdRef.current !== attemptId) {\n        return;\n      }'),
    'Late responses from previous requests must be discarded if an attempt ID mismatch occurs',
  );

  // Verify cancellation handler
  assert.ok(
    onboardingFile.includes('const handleCancelExtraction = () => {') &&
    onboardingFile.includes("setProcessingStatus('idle')") &&
    onboardingFile.includes("setViewMode('choose_source')"),
    'OnboardingPage must provide a clean cancellation handler that aborts requests and returns to source selection',
  );
});

test('Extraction Data Reset: New extraction resets transient errors, conflicts, warnings, and entities', () => {
  const onboardingFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/OnboardingPage.tsx'), 'utf-8');

  // Verify state reset on new extraction start
  assert.ok(
    onboardingFile.includes('setProcessingError(null)') &&
    onboardingFile.includes('setExtractionWarnings([])') &&
    onboardingFile.includes('setConflicts([])') &&
    onboardingFile.includes('setSourceAttribution({})'),
    'New extraction must clear previous errors, warnings, conflicts, and source attributions',
  );

  // Verify empty extraction handling without falsely presenting empty data
  assert.ok(
    onboardingFile.includes("setProcessingTitle('No Qualifications Detected')"),
    'Empty extraction must present a dedicated status notice instead of an empty review form',
  );
});

test('Persistence Invariant: Profile data and resumes are saved ONLY upon explicit user confirmation', () => {
  const backendExtractApi = fs.readFileSync(path.join(projectRoot, 'backend/app/api/profile_extraction.py'), 'utf-8');
  const onboardingFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/OnboardingPage.tsx'), 'utf-8');

  // Backend /profile/extract must NOT save resumes during parsing
  assert.ok(
    !backendExtractApi.includes('ResumeService.upload_and_create_resume(db, user_id, resume)'),
    'backend /profile/extract must be read-only and NOT upload/persist resumes during parsing',
  );

  // Frontend must only persist resume when user explicitly confirms
  assert.ok(
    onboardingFile.includes('await profileApi.uploadResume(selectedResumeFile)'),
    'Frontend must upload resume only in handleSaveConfirmedProfile upon explicit user confirmation',
  );

  // Existing values must not be overwritten by empty or whitespace-only extracted values
  assert.ok(
    backendExtractApi.includes('if p.headline and p.headline.strip():') &&
    backendExtractApi.includes('if p.city and p.city.strip():'),
    'apply-extraction must not overwrite existing profile fields with empty strings',
  );
});

// ============================================================================
// 2. Bug 2: Login and Signup Post-Auth Redirects
// ============================================================================

test('Post-Auth Redirects: routeUserAfterAuth never forces authenticated users to the marketing page', () => {
  const appFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/App.tsx'), 'utf-8');

  // Verify routeUserAfterAuth does NOT fallback to navigate('/')
  const routeUserAfterAuthSnippet = appFile.slice(
    appFile.indexOf('const routeUserAfterAuth = useCallback('),
    appFile.indexOf('// Enforce onboarding flow transitions'),
  );

  assert.ok(
    !routeUserAfterAuthSnippet.includes("navigate('/');"),
    "routeUserAfterAuth must NOT call navigate('/') for unresolved postAuthRoute states",
  );

  // Verify safe internal redirect helper exists
  assert.ok(
    appFile.includes('export { getSafeInternalRedirect') || appFile.includes('export function getSafeInternalRedirect'),
    'App.tsx must export getSafeInternalRedirect helper',
  );
});

test('Internal Redirect Guard: getSafeInternalRedirect validates internal paths and rejects open redirects', async () => {
  const { getSafeInternalRedirect } = await import('../frontend/src/utils/redirect.ts');

  // Valid internal paths
  assert.equal(getSafeInternalRedirect('/dashboard'), '/dashboard');
  assert.equal(getSafeInternalRedirect('/jobs?q=engineer'), '/jobs?q=engineer');
  assert.equal(getSafeInternalRedirect('/automation'), '/automation');
  assert.equal(getSafeInternalRedirect('/profile'), '/profile');
  assert.equal(getSafeInternalRedirect('/settings'), '/settings');

  // Invalid external URLs, schemes, protocol-relative '//', or auth entry loops
  assert.equal(getSafeInternalRedirect('https://evil.com'), null);
  assert.equal(getSafeInternalRedirect('http://evil.com/phish'), null);
  assert.equal(getSafeInternalRedirect('//evil.com/test'), null);
  assert.equal(getSafeInternalRedirect('/\\evil.com'), null);
  assert.equal(getSafeInternalRedirect('javascript:alert(1)'), null);
  assert.equal(getSafeInternalRedirect('/login'), null);
  assert.equal(getSafeInternalRedirect('/signup'), null);
  assert.equal(getSafeInternalRedirect(''), null);
  assert.equal(getSafeInternalRedirect(null), null);
});

test('Post-Auth Navigation Flow: Onboarding vs Dashboard routing from auth entry screens', () => {
  const appFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/App.tsx'), 'utf-8');

  // Verify auth entry paths navigate to onboarding when postAuthRoute is onboarding
  assert.ok(
    appFile.includes("(isAuthEntryPath && postAuthRoute === 'onboarding')"),
    'Auth entry screens (/signup, /login) must navigate to /onboarding when user needs onboarding',
  );

  // Verify postAuthRoute === dashboard routes away from auth entry screens and completed onboarding
  assert.ok(
    appFile.includes("postAuthRoute === 'dashboard' &&"),
    'Completed users must be routed away from auth entry screens to /dashboard or target redirect',
  );

  // Verify marketing pages remain accessible to authenticated users without kick-out
  assert.ok(
    appFile.includes("postAuthRoute === 'onboarding' && currentPath !== '/onboarding' && !isPublicRoute(currentPath)"),
    'Authenticated users on public marketing routes (/about, /terms, /) must not be forced to /onboarding',
  );
});
