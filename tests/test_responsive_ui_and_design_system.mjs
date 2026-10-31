import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const FRONTEND_SRC = path.join(ROOT_DIR, 'frontend', 'src');

test('Design System: Canonical RolePilot brand palette and tokens in index.css', () => {
  const cssPath = path.join(FRONTEND_SRC, 'index.css');
  assert.ok(fs.existsSync(cssPath), 'index.css must exist');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify Palette Hex values
  assert.match(css, /--primary:\s*#1769C2/i, 'Primary blue must be #1769C2');
  assert.match(css, /--primary-hover:\s*#1257A5/i, 'Primary hover must be #1257A5');
  assert.match(css, /--primary-light:\s*#DBEAFE/i, 'Primary light must be #DBEAFE');
  assert.match(css, /--sidebar-bg:\s*#111827/i, 'Sidebar background must be #111827');
  assert.match(css, /--bg-main:\s*#F3F6FA/i, 'Main background must be #F3F6FA');
  assert.match(css, /--bg-card:\s*#FFFFFF/i, 'Card background must be #FFFFFF');
  assert.match(css, /--border-light:\s*#E5E7EB/i, 'Border light must be #E5E7EB');
  assert.match(css, /--border-color:\s*#E5E7EB/i, '--border-color token must be defined and match #E5E7EB');
  assert.match(css, /--text-main:\s*#172554/i, 'Text main must be #172554');
  assert.match(css, /--text-muted:\s*#64748B/i, 'Text muted must be #64748B');
  assert.match(css, /--success:\s*#16A34A/i, 'Success color must be #16A34A');
  assert.match(css, /--error:\s*#DC2626/i, 'Error color must be #DC2626');
  assert.match(css, /--danger:\s*#DC2626/i, 'Danger color must be #DC2626');
  assert.match(css, /--warning:\s*#D97706/i, 'Warning color must be #D97706');

  // Verify Spacing Scale
  assert.match(css, /--space-1:\s*4px/, 'Spacing scale --space-1 must be 4px');
  assert.match(css, /--space-2:\s*8px/, 'Spacing scale --space-2 must be 8px');
  assert.match(css, /--space-4:\s*16px/, 'Spacing scale --space-4 must be 16px');
  assert.match(css, /--space-6:\s*24px/, 'Spacing scale --space-6 must be 24px');

  // Verify Component Dimensions & Touch Targets
  assert.match(css, /--input-height:\s*42px/, 'Input height token must be 42px');
  assert.match(css, /--btn-height:\s*40px/, 'Button height token must be 40px');
  assert.match(css, /--touch-target-min:\s*44px/, 'Touch target minimum token must be 44px');

  // Verify Focus Rings & Accessibility
  assert.match(css, /--focus-ring:\s*0 0 0 3px rgba\(23, 105, 194, 0\.25\)/, 'Focus ring token must be defined');
  assert.match(css, /--focus-ring-danger:/, 'Danger focus ring token must be defined');
  assert.match(css, /:focus-visible\s*\{/, 'Global :focus-visible rule must exist');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Reduced motion media query must be defined');
});

test('Design System: auth.css and blog.css are harmonized with canonical tokens', () => {
  const authCssPath = path.join(FRONTEND_SRC, 'components', 'auth', 'auth.css');
  assert.ok(fs.existsSync(authCssPath), 'auth.css must exist');
  const authCss = fs.readFileSync(authCssPath, 'utf8');

  assert.match(authCss, /--auth-blue:\s*var\(--primary,\s*#1769C2\)/, 'auth.css must reference var(--primary, #1769C2)');
  assert.match(authCss, /--auth-bg:\s*var\(--bg-main,\s*#F3F6FA\)/, 'auth.css must reference var(--bg-main)');
  assert.match(authCss, /--auth-text-main:\s*var\(--text-main,\s*#172554\)/, 'auth.css must reference var(--text-main)');

  const blogCssPath = path.join(FRONTEND_SRC, 'components', 'blog', 'blog.css');
  assert.ok(fs.existsSync(blogCssPath), 'blog.css must exist');
  const blogCss = fs.readFileSync(blogCssPath, 'utf8');
  assert.ok(!blogCss.includes('#1769E8'), 'blog.css must not use divergent blue #1769E8');
});

test('Reusable Components: Standardized Button, Alert, Input, Card, Badge, and Modal exist', () => {
  const commonIndex = path.join(FRONTEND_SRC, 'components', 'common', 'index.ts');
  assert.ok(fs.existsSync(commonIndex), 'common/index.ts must exist');
  const indexContent = fs.readFileSync(commonIndex, 'utf8');

  assert.match(indexContent, /export\s+\{\s*Button\s*\}\s+from '\.\/Button'/, 'Button must be exported from common');
  assert.match(indexContent, /export\s+\{\s*Alert\s*\}\s+from '\.\/Alert'/, 'Alert must be exported from common');
  assert.match(indexContent, /export\s+\{\s*Input\s*\}\s+from '\.\/Input'/, 'Input must be exported from common');
  assert.match(indexContent, /export\s+\{\s*Card/i, 'Card must be exported from common');
  assert.match(indexContent, /export\s+\{\s*Badge\s*\}\s+from '\.\/Badge'/, 'Badge must be exported from common');
  assert.match(indexContent, /export\s+\{\s*Modal\s*\}\s+from '\.\.\/Modal'/, 'Modal must be exported from common');

  // Verify Button.tsx provides variant, size, loading spinner, and ref
  const buttonPath = path.join(FRONTEND_SRC, 'components', 'common', 'Button.tsx');
  assert.ok(fs.existsSync(buttonPath), 'Button.tsx must exist');
  const buttonContent = fs.readFileSync(buttonPath, 'utf8');
  assert.match(buttonContent, /isLoading/, 'Button must support isLoading');
  assert.match(buttonContent, /variant/, 'Button must support variants');
  assert.match(buttonContent, /disabled/, 'Button must support disabled');

  // Verify Alert.tsx provides semantic variants and accessible role
  const alertPath = path.join(FRONTEND_SRC, 'components', 'common', 'Alert.tsx');
  assert.ok(fs.existsSync(alertPath), 'Alert.tsx must exist');
  const alertContent = fs.readFileSync(alertPath, 'utf8');
  assert.match(alertContent, /role="alert"/, 'Alert must have role="alert"');

  // Verify Input.tsx provides label, helper, error, aria-invalid, aria-describedby
  const inputPath = path.join(FRONTEND_SRC, 'components', 'common', 'Input.tsx');
  assert.ok(fs.existsSync(inputPath), 'Input.tsx must exist');
  const inputContent = fs.readFileSync(inputPath, 'utf8');
  assert.match(inputContent, /aria-invalid/, 'Input must support aria-invalid');
  assert.match(inputContent, /aria-describedby/, 'Input must support aria-describedby');
});

test('Modal Component: Overflow restoration, escape key, and responsive height', () => {
  const modalPath = path.join(FRONTEND_SRC, 'components', 'Modal.tsx');
  assert.ok(fs.existsSync(modalPath), 'Modal.tsx must exist');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  // Background scroll lock and proper restoration
  assert.match(modalContent, /document\.body\.style\.overflow = 'hidden'/, 'Modal must lock background scroll');
  assert.match(modalContent, /document\.body\.style\.overflow = originalOverflow/, 'Modal must restore previous overflow on close');

  // Escape key support
  assert.match(modalContent, /e\.key === 'Escape'/, 'Modal must listen for Escape key');

  // Accessible attributes
  assert.match(modalContent, /role="dialog"/, 'Modal must have role="dialog"');
  assert.match(modalContent, /aria-modal="true"/, 'Modal must have aria-modal="true"');
  assert.match(modalContent, /aria-labelledby="modal-title"/, 'Modal must label dialog title');

  // Viewport height dynamic fallback
  assert.match(modalContent, /maxHeight:\s*'min\(90vh,\s*90dvh\)'/, 'Modal must support 90dvh dynamic mobile height');

  // Touch target on close button
  assert.match(modalContent, /minHeight:\s*'40px'/, 'Modal close button must satisfy touch target sizing');
});

test('Layout & Responsiveness: 100dvh viewport, mobile bottom navigation, and toast spacing', () => {
  const indexCss = fs.readFileSync(path.join(FRONTEND_SRC, 'index.css'), 'utf8');

  // Dynamic Viewport Height on app layout and main wrapper
  assert.match(indexCss, /\.saas-app-layout\s*\{[^}]*height:\s*100dvh;/s, 'saas-app-layout must support 100dvh');
  assert.match(indexCss, /\.saas-main-wrapper\s*\{[^}]*height:\s*100dvh;/s, 'saas-main-wrapper must support 100dvh');
  assert.match(indexCss, /-webkit-overflow-scrolling:\s*touch;/, 'saas-main-wrapper must support smooth touch scrolling');

  // Mobile Toast container floats safely below top header without overlapping
  assert.match(indexCss, /@media\s*\(max-width:\s*768px\)\s*\{[^}]*\.toast-container\s*\{[^}]*top:\s*68px;/s, 'Toast container must be positioned at top: 68px on mobile below header');

  // Zero horizontal overflow guarantee
  assert.match(indexCss, /html,\s*body\s*\{[^}]*overflow-x:\s*hidden;/s, 'html/body must guarantee overflow-x: hidden');
  assert.match(indexCss, /max-width:\s*100vw;/, 'Must constrain max-width to 100vw');

  // Mobile Bottom Navigation Touch Target & Safe Area
  assert.match(indexCss, /\.mobile-bottom-nav\s*\{[^}]*padding-bottom:\s*env\(safe-area-inset-bottom/s, 'Mobile bottom bar must account for safe-area-inset-bottom');
  assert.match(indexCss, /\.mobile-nav-item\s*\{[^}]*min-height:\s*48px;/s, 'Mobile nav items must have minimum 48px height');
});

test('Responsive Routing & Detail Panes: Natural mobile flow without nested scroll traps', () => {
  const indexCss = fs.readFileSync(path.join(FRONTEND_SRC, 'index.css'), 'utf8');
  assert.match(indexCss, /\.detail-pane-scroll\s*\{[^}]*max-height:\s*none;[^}]*overflow-y:\s*visible;/s, 'detail-pane-scroll must disable nested scrolling on mobile');
  assert.match(indexCss, /@media\s*\(min-width:\s*1024px\)\s*\{[^}]*\.detail-pane-scroll\s*\{[^}]*overflow-y:\s*auto;/s, 'detail-pane-scroll must be sticky with auto scroll on desktop');

  // Check JobsPage does not automatically hide list view on mobile
  const jobsPage = fs.readFileSync(path.join(FRONTEND_SRC, 'pages', 'JobsPage.tsx'), 'utf8');
  assert.match(jobsPage, /window\.innerWidth <= 768/, 'JobsPage must detect mobile screen width to avoid auto-hiding jobs list');

  // Check ApplicationsPage does not automatically hide list view on mobile
  const appsPage = fs.readFileSync(path.join(FRONTEND_SRC, 'pages', 'ApplicationsPage.tsx'), 'utf8');
  assert.match(appsPage, /window\.innerWidth <= 768/, 'ApplicationsPage must detect mobile screen width to avoid auto-hiding applications list');
});

test('Safety Guard Integrity: Triple-Key Live Submission Guard remains strictly preserved', () => {
  const triggerModal = fs.readFileSync(path.join(FRONTEND_SRC, 'components', 'automation', 'TriggerAutomationModal.tsx'), 'utf8');
  assert.match(triggerModal, /!dryRun/, 'Key 1: dryRun must be false to allow live submit');
  assert.match(triggerModal, /!allowLiveSubmission/, 'Key 2: allowLiveSubmission must be checked');
  assert.match(triggerModal, /CONFIRM_REAL_SUBMISSION/, 'Key 3: exact token CONFIRM_REAL_SUBMISSION required');

  const safetyGuardPanel = fs.readFileSync(path.join(FRONTEND_SRC, 'components', 'automation', 'SafetyGuardPanel.tsx'), 'utf8');
  assert.match(safetyGuardPanel, /TRIPLE-KEY SUBMISSION SAFETY/, 'SafetyGuardPanel must present Triple-Key banner');
  assert.match(safetyGuardPanel, /Key 1:\s*Dry Run/, 'Key 1 must be displayed');
  assert.match(safetyGuardPanel, /Key 2:\s*Live Submission/, 'Key 2 must be displayed');
  assert.match(safetyGuardPanel, /Key 3:\s*Token Confirmation/, 'Key 3 must be displayed');
});
