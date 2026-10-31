import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const FRONTEND_SRC = path.join(ROOT_DIR, 'frontend', 'src');

test('Phase 1: Inter typography scale and global font inheritance in index.css', () => {
  const cssPath = path.join(FRONTEND_SRC, 'index.css');
  assert.ok(fs.existsSync(cssPath), 'index.css must exist');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify Inter typography scale tokens
  assert.match(css, /--text-xs:\s*0\.75rem/i, 'Typography scale --text-xs must be 0.75rem');
  assert.match(css, /--text-sm:\s*0\.875rem/i, 'Typography scale --text-sm must be 0.875rem');
  assert.match(css, /--text-base:\s*1rem/i, 'Typography scale --text-base must be 1rem');
  assert.match(css, /--text-lg:\s*1\.125rem/i, 'Typography scale --text-lg must be 1.125rem');
  assert.match(css, /--text-xl:\s*1\.25rem/i, 'Typography scale --text-xl must be 1.25rem');
  assert.match(css, /--text-2xl:\s*1\.5rem/i, 'Typography scale --text-2xl must be 1.5rem');
  assert.match(css, /--text-3xl:\s*2rem/i, 'Typography scale --text-3xl must be 2rem');

  // Verify Global Font Inheritance
  assert.match(
    css,
    /button,\s*input,\s*select,\s*textarea\s*\{[^}]*font-family:\s*inherit/i,
    'button, input, select, textarea must inherit font-family'
  );

  // Verify Active route highlighting in sidebar footer
  assert.match(
    css,
    /\.sidebar-footer-btn\.active\s*\{[^}]*background-color:\s*var\(--sidebar-active-bg\)/i,
    'sidebar-footer-btn.active must have active background color'
  );

  // Verify Card interactive styling
  assert.match(css, /\.card-interactive\s*\{/i, 'card-interactive class must exist in index.css');
});

test('Phase 1: Component library exports StatCard, Button, Card, Badge, and Input', () => {
  const commonIndex = path.join(FRONTEND_SRC, 'components', 'common', 'index.ts');
  const indexContent = fs.readFileSync(commonIndex, 'utf8');

  assert.match(indexContent, /export\s+\{\s*StatCard/i, 'StatCard must be exported from common/index.ts');
  assert.match(indexContent, /export\s+\{\s*Button\s*\}\s+from '\.\/Button'/i, 'Button must be exported from common/index.ts');
  assert.match(indexContent, /export\s+\{\s*Badge\s*\}\s+from '\.\/Badge'/i, 'Badge must be exported from common/index.ts');
  assert.match(indexContent, /export\s+\{\s*Card/i, 'Card must be exported from common/index.ts');

  // Verify StatCard component exists and handles accessible role and keyboard navigation
  const statCardPath = path.join(FRONTEND_SRC, 'components', 'common', 'StatCard.tsx');
  assert.ok(fs.existsSync(statCardPath), 'StatCard.tsx must exist');
  const statCardContent = fs.readFileSync(statCardPath, 'utf8');
  assert.match(statCardContent, /export const StatCard/i, 'StatCard component must be defined');
  assert.match(statCardContent, /role=\{onClick \? 'button' : undefined\}/i, 'StatCard must handle accessible role');
  assert.match(statCardContent, /onKeyDown/i, 'StatCard must support keyboard navigation');

  // Verify Button.tsx supports fullWidth
  const buttonPath = path.join(FRONTEND_SRC, 'components', 'common', 'Button.tsx');
  const buttonContent = fs.readFileSync(buttonPath, 'utf8');
  assert.match(buttonContent, /fullWidth/i, 'Button must support fullWidth prop');

  // Verify Badge.tsx supports purple variant
  const badgePath = path.join(FRONTEND_SRC, 'components', 'common', 'Badge.tsx');
  const badgeContent = fs.readFileSync(badgePath, 'utf8');
  assert.match(badgeContent, /'purple'/i, 'Badge must support purple variant');
});

test('Phase 2: Dashboard includes LinkedIn session-expired blocker banner with Reconnect action', () => {
  const dashboardPath = path.join(FRONTEND_SRC, 'pages', 'DashboardPage.tsx');
  assert.ok(fs.existsSync(dashboardPath), 'DashboardPage.tsx must exist');
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

  assert.match(dashboardContent, /isLinkedInExpiredOrDisconnected/i, 'Dashboard must evaluate LinkedIn session status');
  assert.match(dashboardContent, /LinkedIn Session Expired or Disconnected/i, 'Dashboard must render session expired blocker banner');
  assert.match(dashboardContent, /Reconnect LinkedIn/i, 'Dashboard must provide Reconnect LinkedIn button');
  assert.match(dashboardContent, /role="alert"/i, 'Session expired banner must have role="alert"');
});

test('Phase 2: Jobs page implements 2-line clamped titles, bulk selection, Run Queue, and Review & Run', () => {
  const jobsPagePath = path.join(FRONTEND_SRC, 'pages', 'JobsPage.tsx');
  assert.ok(fs.existsSync(jobsPagePath), 'JobsPage.tsx must exist');
  const jobsPageContent = fs.readFileSync(jobsPagePath, 'utf8');

  // Verify Run Queue and Review Modal integration
  assert.match(jobsPageContent, /<RunQueueDrawer/i, 'JobsPage must render RunQueueDrawer');
  assert.match(jobsPageContent, /<ReviewAndRunModal/i, 'JobsPage must render ReviewAndRunModal');
  assert.match(jobsPageContent, /selectedJobIds/i, 'JobsPage must manage selectedJobIds state');
  assert.match(jobsPageContent, /Select All Visible/i, 'JobsPage must provide bulk selection controls');

  // Verify JobCard.tsx has readable 2-line title and selection checkbox
  const jobCardPath = path.join(FRONTEND_SRC, 'components', 'jobs', 'JobCard.tsx');
  assert.ok(fs.existsSync(jobCardPath), 'JobCard.tsx must exist');
  const jobCardContent = fs.readFileSync(jobCardPath, 'utf8');

  assert.match(jobCardContent, /WebkitLineClamp:\s*2/i, 'JobCard title must clamp to 2 lines');
  assert.match(jobCardContent, /isChecked/i, 'JobCard must support isChecked prop');
  assert.match(jobCardContent, /onToggleCheck/i, 'JobCard must support onToggleCheck prop');
  assert.match(jobCardContent, /type="checkbox"/i, 'JobCard must render selection checkbox');
});

test('Phase 2: ReviewAndRunModal enforces Triple-Key Live-Submission guard and 1-job live restriction', () => {
  const reviewModalPath = path.join(FRONTEND_SRC, 'components', 'jobs', 'ReviewAndRunModal.tsx');
  assert.ok(fs.existsSync(reviewModalPath), 'ReviewAndRunModal.tsx must exist');
  const reviewModalContent = fs.readFileSync(reviewModalPath, 'utf8');

  // Verify Sentinel string
  assert.match(reviewModalContent, /CONFIRM_REAL_SUBMISSION/i, 'ReviewAndRunModal must require CONFIRM_REAL_SUBMISSION sentinel');

  // Verify 1-job restriction in live mode and multiple-job rejection
  assert.match(reviewModalContent, /isLive/i, 'Live execution must be restricted to 1 job per run');
  assert.match(reviewModalContent, /Live mode strictly requires exactly 1 selected job per run/i, 'Multiple job live submissions must be rejected');

  // Verify Triple-Key steps
  assert.match(reviewModalContent, /Key 1:/i, 'ReviewAndRunModal must enforce Key 1');
  assert.match(reviewModalContent, /Key 2:/i, 'ReviewAndRunModal must enforce Key 2');
  assert.match(reviewModalContent, /Key 3:/i, 'ReviewAndRunModal must enforce Key 3');
});

