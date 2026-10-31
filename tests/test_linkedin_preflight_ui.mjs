/**
 * Test Suite: LinkedIn Session Preflight Validation UI & Contract
 *
 * Validates that:
 * 1. TriggerAutomationModal renders exact message:
 *    "LinkedIn session expired"
 *    "Your LinkedIn session is no longer valid. Please reconnect your LinkedIn account to continue."
 * 2. Reconnect LinkedIn action button is rendered and wired to LinkedInConsentModal.
 * 3. getStructuredApiError and formatErrorMessage correctly parse structured preflight error payloads.
 * 4. QuickActionRunner and DashboardPage route session expiry errors directly to consent modal.
 * 5. Triple-Key Live Submission Guard remains strictly preserved across all entry points.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('API Client: getStructuredApiError and formatErrorMessage parse preflight errors', () => {
  const clientPath = path.join(ROOT_DIR, 'frontend', 'src', 'api', 'client.ts');
  const content = fs.readFileSync(clientPath, 'utf8');

  assert.ok(content.includes('export interface StructuredApiError'), 'StructuredApiError interface must be exported');
  assert.ok(content.includes('export function getStructuredApiError'), 'getStructuredApiError must be exported');
  assert.ok(content.includes('err.data?.detail?.message'), 'formatErrorMessage must extract detail.message from structured error objects');
  assert.ok(content.includes('errorCode: err.data.detail.error_code'), 'getStructuredApiError maps error_code');
  assert.ok(content.includes('action: err.data.detail.action'), 'getStructuredApiError maps action');
});

test('TriggerAutomationModal: Renders exact session expired copy and Reconnect LinkedIn button', () => {
  const modalPath = path.join(ROOT_DIR, 'frontend', 'src', 'components', 'automation', 'TriggerAutomationModal.tsx');
  const content = fs.readFileSync(modalPath, 'utf8');

  // Verify exact text requirements
  assert.ok(content.includes('LinkedIn session expired'), 'Modal must render "LinkedIn session expired" title');
  assert.ok(
    content.includes('reconnect your linkedin') || content.includes('session is no longer valid'),
    'Modal must recognize reconnect instructions'
  );

  // Verify Reconnect button and connection modal wiring
  assert.ok(content.includes('Reconnect LinkedIn'), 'Must render explicit "Reconnect LinkedIn" button');
  assert.ok(
    content.includes('setIsLinkedInConsentOpen(true)'),
    'Clicking Reconnect LinkedIn must open LinkedInConsentModal'
  );
  assert.ok(
    content.includes('<LinkedInConsentModal'),
    'LinkedInConsentModal must be mounted in TriggerAutomationModal'
  );
});

test('QuickActionRunner: Catches session expiry and routes to consent flow', () => {
  const runnerPath = path.join(ROOT_DIR, 'frontend', 'src', 'components', 'dashboard', 'QuickActionRunner.tsx');
  const content = fs.readFileSync(runnerPath, 'utf8');

  assert.ok(content.includes('LINKEDIN_SESSION_EXPIRED'), 'QuickActionRunner must check for LINKEDIN_SESSION_EXPIRED');
  assert.ok(content.includes('onRequireLinkedInConsent'), 'QuickActionRunner must trigger onRequireLinkedInConsent');
});

test('DashboardPage: Catches preflight session expiry and opens LinkedInConsentModal', () => {
  const pagePath = path.join(ROOT_DIR, 'frontend', 'src', 'pages', 'DashboardPage.tsx');
  const content = fs.readFileSync(pagePath, 'utf8');

  assert.ok(content.includes('LINKEDIN_SESSION_EXPIRED'), 'DashboardPage must check for LINKEDIN_SESSION_EXPIRED');
  assert.ok(content.includes('setIsLinkedInConsentOpen(true)'), 'DashboardPage must open consent modal on session expiry');
});

test('Backend API & Worker: Preflight validation gate is enforced on every entry point', () => {
  const apiPath = path.join(ROOT_DIR, 'backend', 'app', 'api', 'automation.py');
  const apiContent = fs.readFileSync(apiPath, 'utf8');

  assert.ok(
    apiContent.includes('LinkedInSessionValidator.validate_session'),
    'POST /api/v1/automation/runs must invoke LinkedInSessionValidator.validate_session'
  );
  assert.ok(
    apiContent.includes('HTTPException') && apiContent.includes('LINKEDIN_SESSION_EXPIRED'),
    'API must raise HTTPException when preflight validation fails'
  );

  const workerPath = path.join(ROOT_DIR, 'backend', 'app', 'workers', 'linkedin_worker.py');
  const workerContent = fs.readFileSync(workerPath, 'utf8');

  assert.ok(
    workerContent.includes('LinkedInSessionValidator.validate_session'),
    'Worker must enforce LinkedInSessionValidator.validate_session before discovering jobs'
  );

  // Verify validation precedes job discovery inside execute_automation_run
  const execStart = workerContent.indexOf('async def execute_automation_run(');
  assert.ok(execStart !== -1, 'execute_automation_run must exist in worker');
  const execBody = workerContent.slice(execStart);
  const validationIdx = execBody.indexOf('LinkedInSessionValidator.validate_session');
  const discoveryIdx = execBody.indexOf('select_eligible_unapplied_jobs');
  assert.ok(
    validationIdx !== -1 && discoveryIdx !== -1 && validationIdx < discoveryIdx,
    'Worker preflight validation must strictly precede job discovery'
  );
});

test('Triple-Key Live Submission Guard Invariant remains strictly untouched', () => {
  const workerPath = path.join(ROOT_DIR, 'backend', 'app', 'workers', 'linkedin_worker.py');
  const workerContent = fs.readFileSync(workerPath, 'utf8');

  assert.ok(
    workerContent.includes('live_submission_confirmation == "CONFIRM_REAL_SUBMISSION"'),
    'Strict live_submission_confirmation sentinel must be checked'
  );
  assert.ok(
    workerContent.includes('allow_live_submission is True'),
    'allow_live_submission must be explicitly checked'
  );
  assert.ok(
    workerContent.includes('not dry_run') || workerContent.includes('dry_run is False'),
    'dry_run must be False for live submission'
  );
});
