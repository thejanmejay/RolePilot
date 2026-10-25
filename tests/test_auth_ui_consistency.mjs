import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('Signup and Login pages use the shared AuthSplitLayout and AuthBrandPanel', () => {
  const loginSrc = readFileSync(new URL('../frontend/src/pages/LoginPage.tsx', import.meta.url), 'utf8');
  const signupSrc = readFileSync(new URL('../frontend/src/pages/SignupPage.tsx', import.meta.url), 'utf8');
  const splitLayoutSrc = readFileSync(new URL('../frontend/src/components/auth/AuthSplitLayout.tsx', import.meta.url), 'utf8');
  const brandPanelSrc = readFileSync(new URL('../frontend/src/components/auth/AuthBrandPanel.tsx', import.meta.url), 'utf8');

  // Verify both pages use AuthSplitLayout
  assert.match(loginSrc, /<AuthSplitLayout/);
  assert.match(signupSrc, /<AuthSplitLayout/);

  // Verify AuthBrandPanel is embedded in AuthSplitLayout as default
  assert.match(splitLayoutSrc, /<AuthBrandPanel/);

  // Verify RolePilot branding and tagline badge in AuthBrandPanel
  assert.match(brandPanelSrc, /<RolePilotLogo/);
  assert.match(brandPanelSrc, /Your Career\. Your Next Move\./);
  assert.match(brandPanelSrc, /Make your next career move count\./);

  // Verify 3 benefit highlights in AuthBrandPanel
  assert.match(brandPanelSrc, /Discover relevant job opportunities/);
  assert.match(brandPanelSrc, /Keep applications and progress organized/);
  assert.match(brandPanelSrc, /Spend less time on repetitive tasks/);

  // Verify trust statement in AuthBrandPanel
  assert.match(brandPanelSrc, /User-controlled application workflows/);
});

test('LoginPage and SignupPage preserve all critical form fields and navigation IDs', () => {
  const loginSrc = readFileSync(new URL('../frontend/src/pages/LoginPage.tsx', import.meta.url), 'utf8');
  const signupSrc = readFileSync(new URL('../frontend/src/pages/SignupPage.tsx', import.meta.url), 'utf8');

  // Login form elements
  assert.match(loginSrc, /id="login-email"/);
  assert.match(loginSrc, /id="login-password"/);
  assert.match(loginSrc, /id="login-remember"/);
  assert.match(loginSrc, /id="forgot-password-link"/);
  assert.match(loginSrc, /id="login-submit-btn"/);
  assert.match(loginSrc, /footerActionId="login-to-signup-link"/);

  // Signup form elements
  assert.match(signupSrc, /id="signup-fullname"/);
  assert.match(signupSrc, /id="signup-email"/);
  assert.match(signupSrc, /id="signup-password"/);
  assert.match(signupSrc, /id="signup-confirm-password"/);
  assert.match(signupSrc, /id="signup-terms"/);
  assert.match(signupSrc, /id="create-account-submit-btn"/);
  assert.match(signupSrc, /footerActionId="signup-to-login-link"/);

  // Both have Back to home action in split layout
  const splitLayoutSrc = readFileSync(new URL('../frontend/src/components/auth/AuthSplitLayout.tsx', import.meta.url), 'utf8');
  assert.match(splitLayoutSrc, /Back to home/);
  assert.match(splitLayoutSrc, /href="\/terms"/);
  assert.match(splitLayoutSrc, /href="\/privacy"/);
});

test('Developer token access is strictly gated with import.meta.env.DEV and excluded from production builds', () => {
  const loginSrc = readFileSync(new URL('../frontend/src/pages/LoginPage.tsx', import.meta.url), 'utf8');
  const modalSrc = readFileSync(new URL('../frontend/src/components/AuthModal.tsx', import.meta.url), 'utf8');

  // Verify DEV gating in source
  assert.match(loginSrc, /import\.meta\.env\.DEV\s*&&/);
  assert.match(modalSrc, /import\.meta\.env\.DEV\s*&&/);

  // Verify production build files (if dist exists) do NOT contain developer token text
  const distHtml = new URL('../frontend/dist/index.html', import.meta.url);
  if (existsSync(distHtml)) {
    const assetsDir = new URL('../frontend/dist/assets', import.meta.url).pathname;
    const files = readdirSync(assetsDir);
    for (const file of files) {
      if (file.endsWith('.js')) {
        const content = readFileSync(path.join(assetsDir, file), 'utf8');
        assert.doesNotMatch(content, /Developer \/ Local Test Token Access/i);
        assert.doesNotMatch(content, /scripts\/get_test_token\.py/i);
      }
    }
  }
});

test('Responsive CSS rules support desktop, tablet, and mobile viewports', () => {
  const css = readFileSync(new URL('../frontend/src/components/auth/auth.css', import.meta.url), 'utf8');

  // Split screen desktop base
  assert.match(css, /\.signup-split-layout\s*\{[^}]*display:\s*flex;/);
  assert.match(css, /\.signup-split-left\s*\{[^}]*background-color:/);
  assert.match(css, /\.signup-split-right\s*\{[^}]*display:\s*flex;/);

  // Tablet (max-width: 1024px)
  assert.match(css, /@media\s*\(\s*max-width:\s*1024px\s*\)/);

  // Mobile (max-width: 768px)
  assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)/);
  assert.match(css, /\.signup-split-layout\s*\{[^}]*flex-direction:\s*column;/);

  // Compact mobile (max-width: 480px)
  assert.match(css, /@media\s*\(\s*max-width:\s*480px\s*\)/);
});
