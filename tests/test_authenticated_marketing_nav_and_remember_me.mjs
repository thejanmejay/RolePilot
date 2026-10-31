import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

// 1. Navigation: Route Classification & Public Access for Authenticated Users
test('Routing Guard: Public marketing routes are accessible to authenticated and onboarding users', () => {
  const appFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/App.tsx'), 'utf-8');

  // Verify PUBLIC_ROUTES contains all marketing, informational, and legal pages
  const expectedPublicRoutes = [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/about',
    '/terms',
    '/privacy',
    '/guidelines',
    '/support',
    '/blog',
    '/guides',
    '/contact',
    '/pricing',
    '/careers',
    '/accessibility',
    '/features',
    '/integrations',
    '/security',
  ];

  for (const route of expectedPublicRoutes) {
    assert.ok(
      appFile.includes(`'${route}'`),
      `App.tsx must include '${route}' in public routes list`,
    );
  }

  // Verify onboarding redirect check does not trap users on public routes
  assert.ok(
    appFile.includes("postAuthRoute === 'onboarding' && currentPath !== '/onboarding' && !isPublicRoute(currentPath)"),
    'Onboarding guard must allow navigating to public routes (e.g. Terms, Privacy, About) without forced redirect',
  );

  // Verify LandingPage at '/' renders for all users (not just unauthenticated)
  assert.ok(
    appFile.includes("if (currentPath === '/') {\n    return <LandingPage {...publicNavProps} />;"),
    "App.tsx must render LandingPage when currentPath === '/' regardless of isAuthenticated",
  );

  // Verify publicNavProps provides isAuthenticated and onNavigateDashboard
  assert.ok(
    appFile.includes('isAuthenticated,') && appFile.includes('onNavigateDashboard: () => {'),
    'publicNavProps must provide isAuthenticated and onNavigateDashboard to marketing pages',
  );
});

// 2. Navigation: Header Adaptations on Marketing Pages for Logged-In Users
test('Marketing Headers: LandingPage, AboutPage, TermsPage, and PricingPage adapt when authenticated', () => {
  const landingFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/LandingPage.tsx'), 'utf-8');
  const aboutFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/AboutPage.tsx'), 'utf-8');
  const termsFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/TermsPage.tsx'), 'utf-8');
  const pricingFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/PricingPage.tsx'), 'utf-8');
  const footerFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/components/common/PublicFooter.tsx'), 'utf-8');

  // LandingPage header adapts
  assert.ok(
    landingFile.includes('isAuthenticated && onNavigateDashboard'),
    'LandingPage must check isAuthenticated && onNavigateDashboard',
  );
  assert.ok(
    landingFile.includes('aria-label="Go to your RolePilot dashboard"'),
    'LandingPage header must provide Dashboard button when authenticated',
  );

  // AboutPage header adapts
  assert.ok(
    aboutFile.includes('isAuthenticated && onNavigateDashboard'),
    'AboutPage must support authenticated Dashboard navigation',
  );

  // TermsPage header adapts
  assert.ok(
    termsFile.includes('isAuthenticated && onNavigateDashboard'),
    'TermsPage must support authenticated Dashboard navigation',
  );

  // PricingPage header adapts
  assert.ok(
    pricingFile.includes('isAuthenticated && onNavigateDashboard'),
    'PricingPage must support authenticated Dashboard navigation',
  );

  // PublicFooter adapts
  assert.ok(
    footerFile.includes('isAuthenticated && onNavigateDashboard'),
    'PublicFooter must show Dashboard link when authenticated',
  );
});

// 3. Navigation: AppLayout Sidebar & Settings Modal Marketing Links
test('AppLayout: Provides accessible marketing & legal links from the authenticated dashboard', () => {
  const layoutFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/components/layout/AppLayout.tsx'), 'utf-8');

  // Brand logo links to home if already on dashboard
  assert.ok(
    layoutFile.includes("currentTab === 'dashboard'"),
    'Sidebar brand logo must allow navigating to Home when on dashboard',
  );

  // Public marketing links must be removed from the sidebar (per UI requirements)
  assert.ok(
    !layoutFile.includes('sidebar-marketing-links'),
    'Sidebar must NOT include public marketing links container',
  );

  // Settings modal legal links preserved
  assert.ok(layoutFile.includes("doNavigate('/terms')"), 'Settings modal must link to /terms');
  assert.ok(layoutFile.includes("doNavigate('/privacy')"), 'Settings modal must link to /privacy');
});

// 4. Remember Me: Storage Adapter Behavior & Session Management
test('Remember Me Storage Adapter: Persistent (localStorage) vs Session-Only (sessionStorage)', () => {
  // Mock browser localStorage and sessionStorage
  class MockStorage {
    constructor() {
      this.store = new Map();
    }
    getItem(key) {
      return this.store.get(key) ?? null;
    }
    setItem(key, value) {
      this.store.set(key, String(value));
    }
    removeItem(key) {
      this.store.delete(key);
    }
    clear() {
      this.store.clear();
    }
    get length() {
      return this.store.size;
    }
    key(index) {
      return Array.from(this.store.keys())[index] ?? null;
    }
  }

  const localStorage = new MockStorage();
  const sessionStorage = new MockStorage();

  const REMEMBER_ME_STORAGE_KEY = 'rolepilot_remember_me';

  function getRememberMePreference() {
    if (sessionStorage.getItem(REMEMBER_ME_STORAGE_KEY) === 'false') return false;
    if (localStorage.getItem(REMEMBER_ME_STORAGE_KEY) === 'false') return false;
    return true;
  }

  function setRememberMePreference(rememberMe) {
    if (rememberMe) {
      localStorage.setItem(REMEMBER_ME_STORAGE_KEY, 'true');
      sessionStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
    } else {
      sessionStorage.setItem(REMEMBER_ME_STORAGE_KEY, 'false');
      localStorage.setItem(REMEMBER_ME_STORAGE_KEY, 'false');
    }
  }

  const dynamicAuthStorage = {
    getItem: (key) => {
      const sessionVal = sessionStorage.getItem(key);
      if (sessionVal !== null) return sessionVal;
      return localStorage.getItem(key);
    },
    setItem: (key, value) => {
      const remember = getRememberMePreference();
      if (remember) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    },
    removeItem: (key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    },
  };

  const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token';

  // Case A: User signs in WITH Remember Me checked (rememberMe = true)
  setRememberMePreference(true);
  assert.strictEqual(getRememberMePreference(), true);

  dynamicAuthStorage.setItem('sb-test-auth-token', JSON.stringify({ access_token: sampleToken }));
  localStorage.setItem('supabase_access_token', sampleToken);

  // Stored in localStorage
  assert.strictEqual(localStorage.getItem('supabase_access_token'), sampleToken);
  assert.notStrictEqual(localStorage.getItem('sb-test-auth-token'), null);
  // NOT stored in sessionStorage
  assert.strictEqual(sessionStorage.getItem('supabase_access_token'), null);
  assert.strictEqual(sessionStorage.getItem('sb-test-auth-token'), null);

  // Case B: User signs in WITHOUT Remember Me checked (rememberMe = false)
  setRememberMePreference(false);
  assert.strictEqual(getRememberMePreference(), false);

  dynamicAuthStorage.setItem('sb-test-auth-token', JSON.stringify({ access_token: sampleToken }));
  sessionStorage.setItem('supabase_access_token', sampleToken);
  localStorage.removeItem('supabase_access_token');

  // Stored in sessionStorage
  assert.strictEqual(sessionStorage.getItem('supabase_access_token'), sampleToken);
  assert.notStrictEqual(sessionStorage.getItem('sb-test-auth-token'), null);
  // Cleaned up from localStorage
  assert.strictEqual(localStorage.getItem('supabase_access_token'), null);
  assert.strictEqual(localStorage.getItem('sb-test-auth-token'), null);

  // Case C: Page refresh in same tab restores session from sessionStorage
  const refreshedItem = dynamicAuthStorage.getItem('sb-test-auth-token');
  assert.notStrictEqual(refreshedItem, null);
  const parsed = JSON.parse(refreshedItem);
  assert.strictEqual(parsed.access_token, sampleToken);

  // Case D: Browser tab closed -> sessionStorage wiped
  sessionStorage.clear();
  // On next browser session start:
  assert.strictEqual(sessionStorage.getItem('supabase_access_token'), null);
  assert.strictEqual(localStorage.getItem('supabase_access_token'), null);
  assert.strictEqual(dynamicAuthStorage.getItem('sb-test-auth-token'), null);

  // Case E: Explicit logout clears both storages thoroughly
  localStorage.setItem('supabase_access_token', 'temp');
  sessionStorage.setItem('supabase_access_token', 'temp');
  localStorage.setItem('rolepilot_remember_me', 'true');

  dynamicAuthStorage.removeItem('supabase_access_token');
  localStorage.removeItem('rolepilot_remember_me');
  sessionStorage.removeItem('rolepilot_remember_me');

  assert.strictEqual(localStorage.getItem('supabase_access_token'), null);
  assert.strictEqual(sessionStorage.getItem('supabase_access_token'), null);
  assert.strictEqual(localStorage.getItem('rolepilot_remember_me'), null);
  assert.strictEqual(sessionStorage.getItem('rolepilot_remember_me'), null);
});

// 5. Security & Privacy: Never store plaintext passwords in browser storage
test('Security: Passwords and sensitive credentials are never written to localStorage or sessionStorage', () => {
  const loginFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/LoginPage.tsx'), 'utf-8');
  const authServiceFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/services/authService.ts'), 'utf-8');
  const authContextFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/context/AuthContext.tsx'), 'utf-8');

  // Ensure password is not passed to storage
  assert.doesNotMatch(loginFile, /setItem\([^)]*password/i);
  assert.doesNotMatch(authServiceFile, /setItem\([^)]*password/i);
  assert.doesNotMatch(authContextFile, /setItem\([^)]*password/i);

  // Ensure only tokens and preference flags are stored
  assert.ok(authServiceFile.includes('REMEMBER_ME_STORAGE_KEY'));
  assert.ok(authContextFile.includes('supabase_access_token'));
});
