import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

// 1. Sidebar Cleanliness: Public Pages Removal & Core Nav Preservation
test('Sidebar: Public Pages section removed while preserving core navigation and settings', () => {
  const layoutPath = path.join(projectRoot, 'frontend', 'src', 'components', 'layout', 'AppLayout.tsx');
  const content = fs.readFileSync(layoutPath, 'utf8');

  // Must NOT include the removed Public Pages container or header
  assert.ok(
    !content.includes('sidebar-marketing-links'),
    'AppLayout must not contain sidebar-marketing-links container'
  );
  assert.ok(
    !content.includes('Public Pages'),
    'AppLayout must not contain Public Pages heading'
  );

  // Must preserve core navigation items
  assert.ok(content.includes("'Dashboard'"), 'Sidebar must include Dashboard nav item');
  assert.ok(content.includes("'Profile'"), 'Sidebar must include Profile nav item');
  assert.ok(content.includes("'Jobs'"), 'Sidebar must include Jobs nav item');
  assert.ok(content.includes("'Applications'"), 'Sidebar must include Applications nav item');
  assert.ok(content.includes("'Automation'"), 'Sidebar must include Automation nav item');

  // Must preserve Settings and Sign Out in footer
  assert.ok(content.includes('setIsSettingsOpen(true)'), 'Sidebar must preserve Settings dialog trigger');
  assert.ok(content.includes('logout()'), 'Sidebar must preserve Sign Out action');
});

// 2. Global Notification System: Toast Positioning, Placement & Variants
test('Global Notification System: Standardized top-center-right positioning, variants & duplicate prevention', () => {
  const toastContextPath = path.join(projectRoot, 'frontend', 'src', 'context', 'ToastContext.tsx');
  const toastContent = fs.readFileSync(toastContextPath, 'utf8');
  const cssPath = path.join(projectRoot, 'frontend', 'src', 'index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Context features: Types, warnings, duplicate prevention, accessible roles
  assert.match(toastContent, /type ToastType\s*=\s*'success'\s*\|\s*'error'\s*\|\s*'warning'\s*\|\s*'info'/, 'ToastType must include warning variant');
  assert.match(toastContent, /showWarning/, 'ToastContext must export showWarning');
  assert.match(toastContent, /prev\.some\(\(t\)\s*=>\s*t\.message === message/, 'Must implement duplicate prevention for stacked notifications');
  assert.match(toastContent, /type === 'error'\s*\?\s*6000\s*:\s*type === 'warning'\s*\?\s*5000\s*:\s*3500/, 'Must use longer auto-dismiss duration for errors and warnings');
  assert.match(toastContent, /role=\{isUrgent\s*\?\s*'alert'\s*:\s*'status'\}/, 'Must provide accessible ARIA alert/status roles');

  // CSS positioning: Top-center-right viewport placement
  assert.match(cssContent, /top:\s*76px/, 'Toast container must offset below header');
  assert.match(cssContent, /right:\s*clamp\(24px,\s*12vw,\s*140px\)/, 'Toast container must be positioned top-center-right');
  assert.match(cssContent, /z-index:\s*10000/, 'Toast container must float above modals and backdrops');
  assert.match(cssContent, /\.toast-warning/, 'Must define .toast-warning styles in index.css');
  assert.match(cssContent, /\.toast-success/, 'Must define .toast-success styles in index.css');
  assert.match(cssContent, /\.toast-error/, 'Must define .toast-error styles in index.css');
  assert.match(cssContent, /\.toast-info/, 'Must define .toast-info styles in index.css');
});

// 3. Telemetry Logs Redesign: Structured Filters, Truncation & Safe Monospace Expansion
test('Telemetry Logs Redesign: Search, severity pills, compact previews & safe details expansion', () => {
  const logsPath = path.join(projectRoot, 'frontend', 'src', 'components', 'automation', 'AutomationLogsViewer.tsx');
  const content = fs.readFileSync(logsPath, 'utf8');

  // Quick severity pills with counts
  assert.match(content, /All \(\{counts\.all\}\)/, 'Must provide All severity pill with total count');
  assert.match(content, /Errors \(\{counts\.error\}\)/, 'Must provide Errors severity pill with error count');
  assert.match(content, /Warnings \(\{counts\.warning\}\)/, 'Must provide Warnings severity pill with warning count');
  assert.match(content, /Info \(\{counts\.info\}\)/, 'Must provide Info severity pill with info count');

  // Search filter
  assert.match(content, /Search logs by event name/, 'Must provide real-time search input');
  assert.match(content, /setSearchQuery\(''\)/, 'Must provide quick clear search action');

  // Truncated preview & expandability
  assert.match(content, /firstLine\.length > 90 \? `\$\{firstLine\.substring\(0, 90\)\}…`/, 'Must compute concise single-line preview');
  assert.match(content, /overflowWrap:\s*'anywhere'/, 'Must prevent layout blowout with overflowWrap anywhere');
  assert.match(content, /wordBreak:\s*'break-word'/, 'Must safely wrap long error strings and paths');
  assert.match(content, /whiteSpace:\s*'pre-wrap'/, 'Must preserve stack trace formatting with pre-wrap');

  // Copy helpers
  assert.match(content, /handleCopyLogJson/, 'Must provide complete JSON copy functionality');
  assert.match(content, /handleCopyRawMessage/, 'Must provide raw text copy functionality');
});

// 4. Automation Details Panel: Organized Overview, Timeline, Form Inspector & Logs
test('Automation Details Panel: Full-width tabs and unconstrained log layout', () => {
  const panelPath = path.join(projectRoot, 'frontend', 'src', 'components', 'automation', 'AutomationRunDetailsPanel.tsx');
  const content = fs.readFileSync(panelPath, 'utf8');

  // Section tabs
  assert.match(content, /activeTab === 'overview'/, 'Must support Overview tab');
  assert.match(content, /activeTab === 'timeline'/, 'Must support Timeline tab');
  assert.match(content, /activeTab === 'form'/, 'Must support Form Inspector tab');
  assert.match(content, /activeTab === 'logs'/, 'Must support Logs tab');

  // Overview organizes Safety Guard and Job Applications
  assert.match(content, /SafetyGuardPanel/, 'Overview must render SafetyGuardPanel');
  assert.match(content, /JobApplicationSelector/, 'Overview must render JobApplicationSelector');

  // Error count badge on Logs tab
  assert.match(content, /errorLogCount > 0/, 'Logs tab must indicate error count when errors exist');
});

// 5. Dashboard Redesign: Truthful Metrics & Refined Cards
test('Dashboard: Truthful metric labels without hardcoded fake trend percentages', () => {
  const dashPath = path.join(projectRoot, 'frontend', 'src', 'pages', 'DashboardPage.tsx');
  const content = fs.readFileSync(dashPath, 'utf8');

  // Truthful metric sub-labels
  assert.match(content, /All Records/, 'Card 1 must show All Records label');
  assert.match(content, /Simulated/, 'Card 2 must show Simulated label');
  assert.match(content, /Triple-Key/, 'Card 3 must show Triple-Key label');
  assert.match(content, /Completion/, 'Card 4 must show Completion label');

  // Hardcoded fake trends must not be present
  assert.ok(!content.includes('+ 50%'), 'Dashboard must not have fake +50% badge');
  assert.ok(!content.includes('+ 100%'), 'Dashboard must not have fake +100% badge');
  assert.ok(!content.includes('+ 5%'), 'Dashboard must not have fake +5% badge');
});
