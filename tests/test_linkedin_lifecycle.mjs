import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const modalPath = path.resolve('frontend/src/components/linkedin/LinkedInConsentModal.tsx');
const statusCardPath = path.resolve('frontend/src/components/linkedin/LinkedInStatusCard.tsx');
const apiPath = path.resolve('frontend/src/api/linkedin.ts');
const quickRunnerPath = path.resolve('frontend/src/components/dashboard/QuickActionRunner.tsx');
const triggerModalPath = path.resolve('frontend/src/components/automation/TriggerAutomationModal.tsx');
const dashboardPath = path.resolve('frontend/src/pages/DashboardPage.tsx');
const backendWorkerPath = path.resolve('backend/app/workers/linkedin_worker.py');

test('LinkedInConsentModal renders exact header, purpose points, and safeguard copy', () => {
  const code = fs.readFileSync(modalPath, 'utf8');

  // Title and subtitle matching redesigned spec
  assert.ok(code.includes('Connect LinkedIn'), 'Modal must have Connect LinkedIn title');
  assert.ok(
    code.includes('Connect your LinkedIn session to let RolePilot find relevant jobs and assist with application preparation.'),
    'Modal must have concise description'
  );

  // Purpose of access bullet points
  assert.ok(code.includes('Find and evaluate jobs against your preferences.'), 'Must list job discovery purpose');
  assert.ok(code.includes('Help prepare application details using your profile and resume.'), 'Must list profile populating purpose');
  assert.ok(code.includes('Track automation progress and application outcomes.'), 'Must list telemetry outcome purpose');

  // Submission safeguard copy
  assert.ok(
    code.includes('RolePilot will not submit applications unless the applicable automation settings') &&
    code.includes('safeguards permit it'),
    'Must explicitly state that access does not bypass submission safeguards'
  );

  // Buttons matching redesigned spec
  assert.ok(code.includes('Connect LinkedIn'), 'Must have Connect LinkedIn primary button');
  assert.ok(code.includes('Cancel'), 'Must have Cancel secondary button');
});

test('LinkedInConsentModal enforces unchecked-by-default checkbox and prevents duplicate clicks', () => {
  const code = fs.readFileSync(modalPath, 'utf8');

  // Initial state unchecked
  assert.ok(code.includes('const [hasAgreed, setHasAgreed] = useState<boolean>(false)'), 'Checkbox must be unchecked by default');
  assert.ok(code.includes('disabled={isSubmitting || !hasAgreed'), 'Continue button must be disabled until agreed');

  // Duplicate click guard
  assert.ok(code.includes('if (isSubmitting) return;'), 'Must reject concurrent submit clicks');
});

test('LinkedInConsentModal implements accessible keyboard handling and dashboard redirection', () => {
  const code = fs.readFileSync(modalPath, 'utf8');

  // Escape key listener
  assert.ok(code.includes("if (e.key === 'Escape')"), 'Must close on Escape key');
  assert.ok(code.includes('role="dialog"'), 'Must have role=dialog');
  assert.ok(code.includes('aria-modal="true"'), 'Must specify aria-modal=true');
  assert.ok(code.includes('/dashboard'), 'Cancel path must redirect or return to dashboard');
});

test('LinkedInStatusCard provides connection status badges and disconnect controls', () => {
  const code = fs.readFileSync(statusCardPath, 'utf8');

  assert.ok(code.includes('Connected'), 'Must render Connected state');
  assert.ok(code.includes('Session Expired'), 'Must render Session Expired state');
  assert.ok(code.includes('Not Connected'), 'Must render Not Connected state');
  assert.ok(code.includes('handleDisconnect'), 'Must provide disconnect action');
  assert.ok(code.includes('onOpenConnectModal'), 'Must allow triggering connect modal');
});

test('QuickActionRunner and TriggerAutomationModal verify LinkedIn connection & consent lifecycle', () => {
  const quickCode = fs.readFileSync(quickRunnerPath, 'utf8');
  const triggerCode = fs.readFileSync(triggerModalPath, 'utf8');

  // Both runners gate automation on LinkedIn status
  assert.ok(quickCode.includes('linkedinApi.getStatus()'), 'QuickActionRunner must check status');
  assert.ok(quickCode.includes('onRequireLinkedInConsent'), 'QuickActionRunner must trigger consent flow when missing');

  assert.ok(triggerCode.includes('linkedinApi.getStatus()'), 'TriggerAutomationModal must check status');
  assert.ok(triggerCode.includes('LinkedInConsentModal'), 'TriggerAutomationModal must embed LinkedInConsentModal');
});

test('DashboardPage incorporates LinkedInStatusCard and consent modal in two-column layout', () => {
  const dashCode = fs.readFileSync(dashboardPath, 'utf8');

  assert.ok(dashCode.includes('<LinkedInStatusCard'), 'Dashboard must render LinkedInStatusCard');
  assert.ok(dashCode.includes('<LinkedInConsentModal'), 'Dashboard must manage LinkedInConsentModal');
  assert.ok(dashCode.includes('onRequireLinkedInConsent'), 'Dashboard must pass consent trigger to QuickActionRunner');
});

test('Backend worker enforces hard consent and session gates with user isolation', () => {
  const workerCode = fs.readFileSync(backendWorkerPath, 'utf8');

  // Consent gate
  assert.ok(workerCode.includes('POLICY_TYPE_LINKEDIN'), 'Worker must verify LinkedIn automation consent');
  assert.ok(workerCode.includes('LinkedIn permission consent required'), 'Must fail with descriptive error if consent missing');

  // Session gate and database decryption
  assert.ok(workerCode.includes('LinkedInSessionService.decrypt_session'), 'Worker must decrypt session for the specific user');
  assert.ok(workerCode.includes('run.user_id'), 'Worker must filter account by run user_id for multi-tenant isolation');
  assert.ok(workerCode.includes('user_account.status = "expired"'), 'Must flag session expired on health failure');
});
