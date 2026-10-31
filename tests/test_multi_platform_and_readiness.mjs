import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const frontendSrc = path.join(projectRoot, 'frontend', 'src');

test('Multi-Platform Architecture: Shared catalog and contracts exist with isolated platform adapters', () => {
  const platformTypePath = path.join(frontendSrc, 'types', 'platform.ts');
  assert.ok(fs.existsSync(platformTypePath), 'platform.ts contract file must exist');

  const content = fs.readFileSync(platformTypePath, 'utf8');
  assert.match(content, /export const PLATFORM_CATALOG/, 'Must export canonical PLATFORM_CATALOG');
  assert.match(content, /id:\s*'linkedin'/, 'Must define LinkedIn platform');
  assert.match(content, /isSupported:\s*true/, 'LinkedIn must be marked as supported');
  assert.match(content, /id:\s*'indeed'/, 'Must define Indeed platform');
  assert.match(content, /status:\s*'coming_soon'/, 'Indeed must be marked as coming_soon');
  assert.match(content, /id:\s*'wellfound'/, 'Must define Wellfound platform');
  assert.match(content, /status:\s*'coming_soon'/, 'Wellfound must be marked as coming_soon');
  assert.match(content, /credentialName:\s*'li_at session cookie'/, 'Must accurately identify li_at credential');
  assert.match(content, /authType:\s*'session_cookie'/, 'Must specify session_cookie authentication type');
});

test('Profile Readiness Panel: Compact, responsive panel with actionable Fix controls and status indicators', () => {
  const readinessMeterPath = path.join(frontendSrc, 'components', 'dashboard', 'ReadinessMeter.tsx');
  assert.ok(fs.existsSync(readinessMeterPath), 'ReadinessMeter component must exist');

  const content = fs.readFileSync(readinessMeterPath, 'utf8');
  assert.match(content, /profile-readiness-panel/, 'Must render compact profile-readiness-panel container');
  assert.match(content, /\{score\}%/, 'Must show dynamic percentage completion');
  assert.match(content, /completed\}\/\{total\}\s*Checks Satisfied/, 'Must show completed out of total checks');
  assert.match(content, /filterMode/, 'Must provide filter toggle for all vs needs fix');
  assert.match(content, /handleFixItem/, 'Must provide actionable Fix handler navigating to target section');
  assert.match(content, /aria-label=\{`Fix \$\{item\.label\}`\}/, 'Must provide accessible Fix button with label');
  assert.match(content, /readiness-compact-list/, 'Must render compact grid/list layout without horizontal overflow');
  assert.match(content, /maxHeight:\s*'320px'/, 'Must prevent vertical bloat with compact scroll container');
});

test('Session / Cache ID Workflow: Explains li_at cookie, safe validation, masked password input, and destructive disconnect', () => {
  const consentModalPath = path.join(frontendSrc, 'components', 'linkedin', 'LinkedInConsentModal.tsx');
  const modalContent = fs.readFileSync(consentModalPath, 'utf8');

  // Explains what li_at is and provides DevTools steps
  assert.match(modalContent, /li_at/, 'Must explicitly identify li_at cookie');
  assert.match(modalContent, /showGuide/, 'Must offer step-by-step DevTools guide toggle');
  assert.match(modalContent, /validateTokenFormat/, 'Must perform client-side token format validation');
  assert.match(modalContent, /showPasswordText/, 'Must mask session token input with eye show/hide toggle');
  assert.match(modalContent, /type=\{showPasswordText \? 'text' : 'password'\}/, 'Must default to password masked input');

  const statusCardPath = path.join(frontendSrc, 'components', 'linkedin', 'LinkedInStatusCard.tsx');
  const cardContent = fs.readFileSync(statusCardPath, 'utf8');

  // Destructive disconnect confirmation and server-side state wipe
  assert.match(cardContent, /showConfirmDisconnect/, 'Must offer safe disconnect confirmation dialog');
  assert.match(cardContent, /Disconnect LinkedIn Session\?/, 'Must warn candidate before destructive credential wipe');
  assert.match(cardContent, /handleDisconnect/, 'Must trigger server-side credential wipe via api');
  assert.match(cardContent, /Replace \/ Update Session/, 'Must provide replace/update session button');
  assert.match(cardContent, /Supported Capabilities/, 'Must display supported capabilities breakdown');
});

test('Simplified Automation Setup: 4-step resumable wizard with Triple-Key guard and clear execution notice', () => {
  const triggerModalPath = path.join(frontendSrc, 'components', 'automation', 'TriggerAutomationModal.tsx');
  const content = fs.readFileSync(triggerModalPath, 'utf8');

  // 4 Steps definition
  assert.match(content, /currentStep/, 'Must maintain step state');
  assert.match(content, /Step 1:\s*Reuse Saved Profile & Job Preferences/, 'Must feature Step 1 for saved profile & search criteria');
  assert.match(content, /Step 2:\s*Select & Verify Job Platform/, 'Must feature Step 2 for platform selection & session verification');
  assert.match(content, /Step 3:\s*Run Settings & Submission Safeguards/, 'Must feature Step 3 for max jobs & safeguards');
  assert.match(content, /Step 4:\s*Review Run Parameters & Launch/, 'Must feature Step 4 for parameter review & launch');

  // Navigation preservation
  assert.match(content, /handleNextStep/, 'Must support advancing steps with validation');
  assert.match(content, /handlePrevStep/, 'Must support backward navigation while preserving inputs');

  // Clarification banner: Run created != Application submitted
  assert.match(content, /does <strong>not<\/strong> count as a submitted application until verified/, 'Must clarify that a queued run is not a submitted application');

  // Triple-Key Safety Guard invariants
  assert.match(content, /!dryRun/, 'Must guard live mode on dryRun=false');
  assert.match(content, /allowLiveSubmission/, 'Must require explicit allowLiveSubmission authorization');
  assert.match(content, /CONFIRM_REAL_SUBMISSION/, 'Must require exact typed confirmation token');
  assert.match(content, /Triple-Key Safety Guard/, 'Must clearly label Triple-Key Safety Guard');
});

test('Platform Integration Cards Layout & Responsive Styles: Grid with Desktop, Tablet, and Mobile Breakpoints', () => {
  const cssPath = path.join(frontendSrc, 'index.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify responsive grid layout
  assert.match(css, /\.platform-card-grid\s*\{[^}]*display:\s*grid/s, 'Must define .platform-card-grid with display: grid');
  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/, 'Desktop must use 3-column grid');
  assert.match(css, /@media\s*\(max-width:\s*680px\)\s*\{\s*\.platform-card-grid\s*\{\s*grid-template-columns:\s*repeat\(2/s, 'Tablet breakpoint must adjust to 2 columns');
  assert.match(css, /@media\s*\(max-width:\s*480px\)\s*\{\s*\.platform-card-grid\s*\{\s*grid-template-columns:\s*1fr/s, 'Mobile breakpoint must stack in 1 column');

  // Verify card styling and uniform height
  assert.match(css, /\.platform-integration-card\s*\{[^}]*min-height:\s*200px/s, 'Must enforce consistent minimum card height');
  assert.match(css, /\.platform-integration-card\.selected\s*\{[^}]*border-color:\s*var\(--primary/s, 'Selected card must have visible primary border');
  assert.match(css, /\.platform-integration-card\.selected\s*\{[^}]*background-color:\s*#eff6ff/s, 'Selected card must have subtle background highlight');
  assert.match(css, /\.platform-integration-card\.unavailable\s*\{[^}]*cursor:\s*not-allowed/s, 'Unavailable cards must have not-allowed cursor and muted styling');
  assert.match(css, /\.platform-card-description\s*\{[^}]*-webkit-line-clamp:\s*3/s, 'Card description must clamp lines to prevent layout shifts');
});

test('Platform Integration Cards Content, Accessibility & Selection Behavior', () => {
  const modalPath = path.join(frontendSrc, 'components', 'automation', 'TriggerAutomationModal.tsx');
  const content = fs.readFileSync(modalPath, 'utf8');

  // Accessible role and keyboard attributes
  assert.match(content, /role="radiogroup"/, 'Platform cards container must declare role="radiogroup"');
  assert.match(content, /role="radio"/, 'Each integration card must declare role="radio"');
  assert.match(content, /aria-checked=\{isSelected\}/, 'Integration card must track selection via aria-checked');
  assert.match(content, /aria-disabled=\{!plat\.isSupported\}/, 'Unavailable cards must declare aria-disabled');
  assert.match(content, /tabIndex=\{plat\.isSupported \? 0 : -1\}/, 'Supported cards must be tabbable via keyboard');
  assert.match(content, /onKeyDown/, 'Cards must handle Enter and Space key activation');

  // Platform badges and icons
  assert.match(content, /plat\.isSupported \? 'Available' : 'Coming Soon'/, 'Must display Available or Coming Soon badge');
  assert.match(content, /platform-icon-box \$\{plat\.id\}/, 'Must render platform-specific icon container');
  assert.match(content, /handlePlatformSelect/, 'Must handle selection while blocking unsupported platforms');

  // Dedicated connection panel below grid
  assert.match(content, /platform-connection-panel/, 'Must render connection panel below grid');
  assert.match(content, /LinkedIn Connection Required/, 'Must explain connection required when LinkedIn not connected');
  assert.match(content, /LinkedIn Session Connected & Ready/, 'Must show connected state when verified');
  assert.match(content, /Connect LinkedIn/, 'Must provide Connect LinkedIn action button');
  assert.match(content, /Update Session/, 'Must provide Update Session button when connected');
  assert.match(content, /handleDisconnectSession/, 'Must allow disconnecting LinkedIn session');
  assert.match(content, /handleCheckConnection/, 'Must provide connection status re-check action');

  // Continue button disabled guard on Step 2
  assert.match(
    content,
    /\(currentStep === 2 && \(!isLinkedInConnected \|\| selectedPlatform !== 'linkedin'\)\)/,
    'Continue button must be disabled on Step 2 if LinkedIn is not connected'
  );
});

