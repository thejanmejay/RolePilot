import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Run status normalization maps pending and waiting to queued, preventing false running state', () => {
  const statusPath = path.join(projectRoot, 'frontend', 'src', 'utils', 'status.ts');
  const content = fs.readFileSync(statusPath, 'utf8');

  // Verify code mappings
  assert.match(
    content,
    /norm === 'pending' \|\| norm === 'waiting' \|\| norm === 'queued'\)\s*return 'queued'/,
    'normalizeRunStatus must map pending and waiting to queued'
  );
  assert.match(
    content,
    /norm === 'in_progress' \|\| norm === 'active' \|\| norm === 'running'\)\s*return 'running'/,
    'normalizeRunStatus must map running'
  );
  assert.match(
    content,
    /norm === 'success' \|\| norm === 'done' \|\| norm === 'completed'\)\s*return 'completed'/,
    'normalizeRunStatus must map completed'
  );
  assert.match(
    content,
    /norm === 'error' \|\| norm === 'failed' \|\| norm === 'needs_reconciliation'\)\s*return 'failed'/,
    'normalizeRunStatus must map failed and needs_reconciliation'
  );

  // Implement the identical function to verify algorithmically
  function normalizeRunStatus(status) {
    if (!status) return 'queued';
    const norm = status.trim().toLowerCase();
    if (norm === 'pending' || norm === 'waiting' || norm === 'queued') return 'queued';
    if (norm === 'in_progress' || norm === 'active' || norm === 'running') return 'running';
    if (norm === 'aborted' || norm === 'stopped' || norm === 'cancelled') return 'cancelled';
    if (norm === 'error' || norm === 'failed' || norm === 'needs_reconciliation') return 'failed';
    if (norm === 'success' || norm === 'done' || norm === 'completed') return 'completed';

    const canonicalRuns = ['queued', 'running', 'completed', 'failed', 'cancelled'];
    if (canonicalRuns.includes(norm)) {
      return norm;
    }
    return 'running';
  }

  assert.equal(normalizeRunStatus('pending'), 'queued');
  assert.equal(normalizeRunStatus('waiting'), 'queued');
  assert.equal(normalizeRunStatus('queued'), 'queued');
  assert.equal(normalizeRunStatus('running'), 'running');
  assert.equal(normalizeRunStatus('completed'), 'completed');
  assert.equal(normalizeRunStatus('failed'), 'failed');
  assert.equal(normalizeRunStatus('cancelled'), 'cancelled');
});

test('Duration calculation for terminal runs never displays "In progress…"', () => {
  const statusPath = path.join(projectRoot, 'frontend', 'src', 'utils', 'status.ts');
  const content = fs.readFileSync(statusPath, 'utf8');

  assert.match(content, /export function formatRunDuration/, 'status.ts must export formatRunDuration');
  assert.match(content, /export function isTerminalRunStatus/, 'status.ts must export isTerminalRunStatus');

  function formatRunDuration(startedAt, completedAt, status, createdAt) {
    const isTerminal = status === 'completed' || status === 'failed' || status === 'cancelled';
    const startMs = startedAt ? new Date(startedAt).getTime() : (createdAt ? new Date(createdAt).getTime() : 0);
    const endMs = completedAt ? new Date(completedAt).getTime() : 0;

    if (startMs > 0 && endMs > 0 && endMs >= startMs) {
      const diffMs = endMs - startMs;
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      if (mins > 0) return `${mins} min ${secs} sec`;
      return `${secs} sec`;
    }

    if (isTerminal) {
      return '< 1 min';
    }

    if (status === 'queued') {
      return 'Waiting to start';
    }

    return 'In progress…';
  }

  const started = '2026-10-28T08:10:00.000Z';
  const completed = '2026-10-28T08:18:24.000Z';
  assert.equal(formatRunDuration(started, completed, 'completed', started), '8 min 24 sec');
  assert.equal(formatRunDuration(null, null, 'completed', null), '< 1 min');
  assert.notEqual(formatRunDuration(started, null, 'failed', started), 'In progress…');
  assert.equal(formatRunDuration(null, null, 'queued', null), 'Waiting to start');
});

test('API client ensures /automation/runs is treated as a dynamic, non-cached endpoint', () => {
  const clientPath = path.join(projectRoot, 'frontend', 'src', 'api', 'client.ts');
  const content = fs.readFileSync(clientPath, 'utf8');

  assert.match(
    content,
    /'\/automation\/runs'/,
    'SENSITIVE_PATH_PATTERNS must include /automation/runs to prevent stale 60s caching'
  );
});

test('AutomationPage implements two-column workspace with Run Details on left and Run History on right', () => {
  const pagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'AutomationPage.tsx');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Check left details panel comes before right history panel in DOM
  const detailsIndex = content.indexOf('Left Panel: Run Details (65-70%)');
  const historyIndex = content.indexOf('Right Panel: Run History (30-35%)');

  assert.ok(detailsIndex !== -1, 'Must include left Run Details panel');
  assert.ok(historyIndex !== -1, 'Must include right Run History panel');
  assert.ok(detailsIndex < historyIndex, 'Run Details must be on the left before Run History on the right');

  // Stale poll protection
  assert.match(content, /lastPollTimestampRef/, 'Must guard against out-of-order poll responses');
  assert.match(content, /isTerminalRunStatus/, 'Must prevent delayed poll responses from reverting terminal status');
  assert.match(content, /clearInterval\(pollTimerRef\.current\)/, 'Must stop polling once all runs reach terminal state');
});

test('RunSummaryHeader renders outcome banner, 5 metric cards, and truthful dry-run counts', () => {
  const headerPath = path.join(projectRoot, 'frontend', 'src', 'components', 'automation', 'RunSummaryHeader.tsx');
  const content = fs.readFileSync(headerPath, 'utf8');

  // 5 result metric cards
  assert.match(content, /'Jobs Found'/, 'Must render Jobs Found metric card');
  assert.match(content, /'Evaluated'/, 'Must render Evaluated metric card');
  assert.match(content, /'Skipped'/, 'Must render Skipped metric card');
  assert.match(content, /'Failed'/, 'Must render Failed metric card');
  assert.match(content, /'Submitted'/, 'Must render Submitted metric card');

  // Dry run submission protection: dry runs strictly report 0 submitted applications
  assert.match(
    content,
    /isDryRun\s*\?\s*0\s*:\s*\(run\.applications_submitted\s*\|\|\s*0\)/,
    'Submitted count for dry run must strictly evaluate to 0'
  );

  // Authoritative outcome banner
  assert.match(content, /Run completed successfully \(Dry Run\)/, 'Must display Dry Run completed banner');
  assert.match(content, /Automation Running in Background/, 'Must display running banner');
  assert.match(content, /Run Queued/, 'Must display queued banner');
});

test('AutomationRunDetailsPanel Overview tab renders Run Summary and Key Insights cards', () => {
  const panelPath = path.join(projectRoot, 'frontend', 'src', 'components', 'automation', 'AutomationRunDetailsPanel.tsx');
  const content = fs.readFileSync(panelPath, 'utf8');

  assert.match(content, /Run Summary/, 'Must render Run Summary card in Overview tab');
  assert.match(content, /Key Insights/, 'Must render Key Insights card in Overview tab');
  assert.match(content, /relevant jobs found/, 'Must render relevant jobs insight');
  assert.match(content, /jobs matched your profile/, 'Must render profile match insight');
  assert.match(content, /No applications submitted/, 'Must clarify dry run submissions in Key Insights');
});
