import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

// 1. Dashboard Redesign Verification
test('Dashboard Redesign: Renders exact approved components and grid structure', () => {
  const dashPath = path.join(projectRoot, 'frontend', 'src', 'pages', 'DashboardPage.tsx');
  const dashCode = fs.readFileSync(dashPath, 'utf8');

  // KPI Metric Cards
  assert.ok(dashCode.includes('Jobs Discovered'), 'Dashboard must render Jobs Discovered KPI card');
  assert.ok(dashCode.includes('Forms Evaluated'), 'Dashboard must render Forms Evaluated KPI card');
  assert.ok(dashCode.includes('Dry Runs Verified'), 'Dashboard must render Dry Runs Verified KPI card');
  assert.ok(dashCode.includes('Live Submissions'), 'Dashboard must render Live Submissions KPI card');

  // Middle Row: 3-column layout
  assert.ok(dashCode.includes('<ProfileReadinessCard'), 'Dashboard must render ProfileReadinessCard');
  assert.ok(dashCode.includes('<ApplicationPipelineCard'), 'Dashboard must render ApplicationPipelineCard');
  assert.ok(dashCode.includes('<QuickActionsCard'), 'Dashboard must render QuickActionsCard');
  assert.ok(dashCode.includes('dashboard-middle-grid'), 'Dashboard must use 3-column middle grid');

  // Bottom Row: Table + Integration + Runner
  assert.ok(dashCode.includes('<RecentActivityTable'), 'Dashboard must render RecentActivityTable');
  assert.ok(dashCode.includes('<LinkedInStatusCard'), 'Dashboard must render LinkedInStatusCard');
  assert.ok(dashCode.includes('<TodayAutomationRunCard'), 'Dashboard must render TodayAutomationRunCard');
  assert.ok(dashCode.includes('dashboard-bottom-grid'), 'Dashboard must use responsive bottom grid');
});

// 2. Profile Avatar Chip Redirect to Settings
test('User Profile Icon: Right avatar chip redirects to /settings page', () => {
  const layoutPath = path.join(projectRoot, 'frontend', 'src', 'components', 'layout', 'AppLayout.tsx');
  const layoutCode = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(layoutCode.includes('user-avatar-chip'), 'AppLayout must contain user-avatar-chip');
  assert.ok(
    layoutCode.includes("doNavigate('/settings')") || layoutCode.includes("navigate('/settings')"),
    'Avatar chip must redirect user to /settings page'
  );
  assert.ok(
    layoutCode.includes("onTabChange('settings')"),
    'Avatar chip must update active tab to settings'
  );
});

// 3. Persistent Notification Bell & Panel
test('Notification System: Working bell with unread badge and dropdown panel', () => {
  const layoutPath = path.join(projectRoot, 'frontend', 'src', 'components', 'layout', 'AppLayout.tsx');
  const layoutCode = fs.readFileSync(layoutPath, 'utf8');
  const panelPath = path.join(projectRoot, 'frontend', 'src', 'components', 'notifications', 'NotificationPanel.tsx');

  assert.ok(fs.existsSync(panelPath), 'NotificationPanel component must exist');
  assert.ok(layoutCode.includes('<NotificationPanel'), 'AppLayout must render NotificationPanel');
  assert.ok(layoutCode.includes('notification-btn'), 'AppLayout must render notification bell button');
  assert.ok(layoutCode.includes("'99+'"), 'AppLayout must cap unread badge at 99+');

  const panelCode = fs.readFileSync(panelPath, 'utf8');
  assert.ok(panelCode.includes('markNotificationRead'), 'NotificationPanel must allow marking notifications as read');
  assert.ok(panelCode.includes('markAllNotificationsRead'), 'NotificationPanel must allow marking all as read');
});

// 4. Free ATS Resume Checker on Public Marketing Pages
test('ATS Resume Checker: Public routing, marketing link, and no-signup analysis', () => {
  const appPath = path.join(projectRoot, 'frontend', 'src', 'App.tsx');
  const appCode = fs.readFileSync(appPath, 'utf8');
  assert.ok(appCode.includes("'/resume-checker'"), 'App.tsx must register /resume-checker in PUBLIC_ROUTES');
  assert.ok(appCode.includes('<ResumeCheckerPage'), 'App.tsx must route to ResumeCheckerPage');

  const landingPath = path.join(projectRoot, 'frontend', 'src', 'pages', 'LandingPage.tsx');
  const landingCode = fs.readFileSync(landingPath, 'utf8');
  assert.ok(landingCode.includes('ATS Checker'), 'Landing page must contain ATS Checker navigation link');
  assert.ok(landingCode.includes('id="resume-checker"'), 'Landing page must contain #resume-checker anchor section');

  const checkerPagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'ResumeCheckerPage.tsx');
  assert.ok(fs.existsSync(checkerPagePath), 'ResumeCheckerPage component file must exist');
  const checkerCode = fs.readFileSync(checkerPagePath, 'utf8');
  assert.match(checkerCode, /heuristics|heuristic/i, 'ResumeCheckerPage must explain heuristic scoring');
  assert.match(checkerCode, /guarantee/i, 'ResumeCheckerPage must clarify no universal guarantee');

  const atsApiPath = path.join(projectRoot, 'backend', 'app', 'api', 'ats.py');
  assert.ok(fs.existsSync(atsApiPath), 'Backend public ATS endpoint must exist');
});

// 5. Triple-Key Safety Guard Integrity
test('Triple-Key Safety Guard: Remains strictly enforced', () => {
  const enginePath = path.join(projectRoot, 'src', 'linkedin_hunter', 'jobs', 'apply.py');
  const engineCode = fs.readFileSync(enginePath, 'utf8');

  assert.ok(engineCode.includes('CONFIRM_REAL_SUBMISSION'), 'Sentinel confirmation key must be checked in engine');
  assert.ok(engineCode.includes('allow_live_submission'), 'allow_live_submission key must be checked in engine');
  assert.ok(engineCode.includes('dry_run'), 'dry_run key must be checked in engine');

  const modalPath = path.join(projectRoot, 'frontend', 'src', 'components', 'automation', 'TriggerAutomationModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');
  assert.ok(modalCode.includes('CONFIRM_REAL_SUBMISSION'), 'Sentinel confirmation token must be required in UI');
});
