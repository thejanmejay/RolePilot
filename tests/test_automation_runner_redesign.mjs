import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Automation Runner UI: Page header redesign adheres to RolePilot SaaS specifications', () => {
  const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'AutomationPage.tsx');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Title: Automation Runner
  assert.match(content, /<span>Automation Runner<\/span>/, 'Page title must be "Automation Runner"');

  // Subtitle: monitors LinkedIn job search, qualification, and application execution
  assert.match(
    content,
    /Monitors LinkedIn job search, qualification, and application execution\./i,
    'Page subtitle must describe LinkedIn job search, qualification, and application execution'
  );

  // Primary Launch Automation button
  assert.match(content, /Launch Automation/, 'Must have prominent primary "Launch Automation" button');
  assert.match(content, /Play\s+size=/, 'Launch button must have Play icon');

  // Secondary Refresh button
  assert.match(content, /Refresh/, 'Must have secondary "Refresh" button');
  assert.match(content, /RefreshCw\s+size=/, 'Refresh button must have RefreshCw icon');
});

test('Automation Runner UI: KPI cards display 6 metrics with responsive grid and SaaS tokens', () => {
  const statsPath = path.join(projectRoot, 'frontend', 'src', 'components', 'automation', 'AutomationStats.tsx');
  const content = fs.readFileSync(statsPath, 'utf8');

  // Six metrics
  assert.match(content, /label:\s*'Total Runs'/, 'Must include Total Runs metric');
  assert.match(content, /label:\s*'In Progress \/ Queued'/, 'Must include In Progress / Queued metric');
  assert.match(content, /label:\s*'Applications Submitted'/, 'Must include Applications Submitted metric');
  assert.match(content, /label:\s*'Skipped \(Eligible\/Applied\)'/, 'Must include Skipped metric');
  assert.match(content, /label:\s*'Failed Applications'/, 'Must include Failed Applications metric');
  assert.match(content, /label:\s*'Application Success Rate'/, 'Must include Application Success Rate metric');

  // RolePilot Blue token and card styling
  assert.match(content, /#1769C2/, 'Must use RolePilot brand blue token #1769C2');
  assert.match(content, /fontSize:\s*'1\.65rem'/, 'Must use large scannable metric values');
  assert.match(content, /gridTemplateColumns:\s*'repeat\(auto-fit,\s*minmax\(170px,\s*1fr\)\)'/, 'Must use responsive auto-fit grid without horizontal overflow');
});

test('Automation Runner UI: 3-panel layout architecture on desktop with responsive fallback', () => {
  const cssPath = path.join(projectRoot, 'frontend', 'src', 'index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // 3-panel balanced layout classes
  assert.match(cssContent, /\.automation-dashboard-layout/, 'Must define .automation-dashboard-layout');
  assert.match(cssContent, /\.automation-history-panel/, 'Must define .automation-history-panel (Panel 1)');
  assert.match(cssContent, /\.run-details-middle-panel/, 'Must define .run-details-middle-panel (Panel 2)');
  assert.match(cssContent, /\.run-details-right-panel/, 'Must define .run-details-right-panel (Panel 3)');

  // Responsive breakpoints
  assert.match(cssContent, /@media\s*\(min-width:\s*1200px\)/, 'Must support desktop 3-panel horizontal layout');
  assert.match(cssContent, /@media\s*\(min-width:\s*768px\)\s*and\s*\(max-width:\s*1199px\)/, 'Must support tablet stacked details layout');
  assert.match(cssContent, /@media\s*\(max-width:\s*767px\)/, 'Must support mobile single-panel layout with back button');
});

test('Automation Runner UI: Triple-Key Submission Safety guard integrity and styling', () => {
  const safetyPath = path.join(projectRoot, 'frontend', 'src', 'components', 'automation', 'SafetyGuardPanel.tsx');
  const content = fs.readFileSync(safetyPath, 'utf8');

  // Verification of Triple-Key condition derivations (uncompromised security policy)
  assert.match(content, /const key1DryRun\s*=\s*isDryRun;/, 'Key 1 must derive from dry_run');
  assert.match(content, /const key2LiveAllowed\s*=\s*!isDryRun;/, 'Key 2 must derive from live authorization state');
  assert.match(content, /const key3Confirmed\s*=\s*!isDryRun/, 'Key 3 must derive from confirmation state');

  // Distinct visual presentation and RolePilot brand colors
  assert.match(content, /TRIPLE-KEY SUBMISSION SAFETY/, 'Must display clear security panel header');
  assert.match(content, /#1769C2/, 'Must use brand blue for dry-run safe indicators');
});

test('Automation Runner UI: Selected Run error presentation with safe word-wrapping', () => {
  const headerPath = path.join(projectRoot, 'frontend', 'src', 'components', 'automation', 'RunSummaryHeader.tsx');
  const content = fs.readFileSync(headerPath, 'utf8');

  // Restrained error summary panel
  assert.match(content, /run\.error_message/, 'Must conditionally render restrained error panel');
  assert.match(content, /overflowWrap:\s*'anywhere'/, 'Must safely wrap long error strings');
  assert.match(content, /wordBreak:\s*'break-word'/, 'Must prevent word overflow for long browser errors');
});

test('Automation Runner UI: LinkedInConsentModal system responsiveness', () => {
  const modalPath = path.join(projectRoot, 'frontend', 'src', 'components', 'linkedin', 'LinkedInConsentModal.tsx');
  const content = fs.readFileSync(modalPath, 'utf8');

  // Viewport constraint and touch scrolling
  assert.match(content, /maxHeight:\s*'min\(92vh,\s*760px\)'/, 'Modal dialog must have viewport height constraints');
  assert.match(content, /overflowY:\s*'auto'/, 'Modal dialog must scroll internally when overflowing');
  assert.match(content, /padding:\s*'clamp\(20px,\s*4vw,\s*28px\)\s*clamp\(16px,\s*4vw,\s*24px\)'/, 'Modal must use responsive clamp padding');
});
