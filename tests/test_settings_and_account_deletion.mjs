import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 1. Settings Page: 7 Dedicated Sections & Clean Architecture
test('Settings Page: All 7 dedicated sections exist with proper identifiers and ARIA tab roles', () => {
  const settingsPath = path.join(projectRoot, 'frontend', 'src', 'pages', 'SettingsPage.tsx');
  assert.ok(fs.existsSync(settingsPath), 'SettingsPage.tsx must exist');

  const content = fs.readFileSync(settingsPath, 'utf8');

  // Verify all 7 required section types
  assert.match(content, /'account'\s*\|\s*'security'\s*\|\s*'connections'\s*\|\s*'preferences'\s*\|\s*'system'\s*\|\s*'legal'\s*\|\s*'danger'/, 'SettingsSection union must declare all 7 sections');

  // Verify tablist and tab accessibility attributes
  assert.match(content, /role="tablist"/, 'Navigation pane must use role="tablist"');
  assert.match(content, /role="tab"/, 'Nav items must use role="tab"');
  assert.match(content, /aria-selected/, 'Nav items must announce aria-selected');
  assert.match(content, /role="tabpanel"/, 'Content pane must declare role="tabpanel"');

  // Verify Section 1: Account & Profile
  assert.ok(content.includes('Account & Profile'), 'Must render Account & Profile section');
  assert.ok(content.includes('Verified Identity'), 'Must render Verified Identity badge');
  assert.ok(content.includes('Go to Profile Page'), 'Must provide navigation to full Candidate Profile');

  // Verify Section 2: Security & Sessions
  assert.ok(content.includes('Security & Sessions'), 'Must render Security & Sessions section');
  assert.ok(content.includes('Change Account Password'), 'Must provide password update form');
  assert.ok(content.includes('authService.updatePassword'), 'Must invoke authService.updatePassword');
  assert.ok(content.includes('Sign Out'), 'Must provide Sign Out action in security section');

  // Verify Section 3: Connected Accounts
  assert.ok(content.includes('Connected Accounts'), 'Must render Connected Accounts section');
  assert.ok(content.includes('LinkedIn'), 'Must render LinkedIn integration');
  assert.ok(content.includes('Disconnect Account'), 'Must render disconnect action');
  assert.ok(content.includes('showDisconnectConfirm'), 'Must enforce confirmation before disconnecting LinkedIn');
  assert.ok(content.includes('Upcoming Platform Integrations'), 'Must preview roadmap platforms without fake functional controls');

  // Verify Section 4: Preferences & Notifications
  assert.ok(content.includes('Preferences & Notifications'), 'Must render Preferences & Notifications section');
  assert.ok(content.includes('rolepilot_pref_toasts'), 'Must persist in-app toast preferences');
  assert.ok(content.includes('rolepilot_pref_app_alerts'), 'Must persist application alert preferences');
  assert.ok(content.includes('rolepilot_pref_telemetry'), 'Must persist detailed telemetry preferences');

  // Verify Section 5: System Status
  assert.ok(content.includes('System Status'), 'Must render System Status section');
  assert.ok(content.includes('/health/diagnostics'), 'Must query dynamic /health/diagnostics endpoint');
  assert.ok(content.includes('Refresh Health'), 'Must provide manual refresh health capability');
  assert.ok(!content.includes('Ready (Triple-Key Guard Active)</span>'), 'Must not hardcode static healthy badges');

  // Verify Section 6: Legal & Support
  assert.ok(content.includes('Legal & Support') || content.includes('Legal &amp; Support'), 'Must render Legal & Support section');
  assert.ok(content.includes('Terms of Use') && content.includes('/terms'), 'Must link to /terms');
  assert.ok(content.includes('Privacy Policy') && content.includes('/privacy'), 'Must link to /privacy');

  assert.ok(content.includes('Safety Guidelines') && content.includes('/guidelines'), 'Must link to /guidelines');
  assert.ok(content.includes('RolePilot Support') && content.includes('/support'), 'Must link to /support');

  // Verify Section 7: Danger Zone & Permanent Deletion Safeguards
  assert.ok(content.includes('Danger Zone'), 'Must render Danger Zone section');
  assert.ok(content.includes('Permanently Delete Account'), 'Must render Permanent Account Deletion trigger');
  assert.ok(content.includes('deleteConfirmationInput !== \'DELETE\''), 'Must strictly require typing DELETE to confirm deletion');
  assert.ok(content.includes('authService.deleteAccount()'), 'Must invoke authService.deleteAccount');
  assert.ok(content.includes('onNavigateSupport') || content.includes('/support'), 'Must redirect to Support page after deletion');
});

// 2. Email Reservation & Deleted Account Identity Verification
test('Account Deletion & Email Reservation: Backend registration check & service integration', () => {
  const accountServicePath = path.join(projectRoot, 'backend', 'app', 'services', 'account_service.py');
  const serviceContent = fs.readFileSync(accountServicePath, 'utf8');

  // Model & Service insertion
  assert.ok(serviceContent.includes('EmailReservation'), 'AccountService must import EmailReservation');
  assert.ok(serviceContent.includes('normalized_email'), 'AccountService must persist normalized_email');
  assert.ok(serviceContent.includes('is_email_reserved'), 'AccountService must expose is_email_reserved method');
  assert.ok(serviceContent.includes('validate_registration_email'), 'AccountService must expose validate_registration_email method');

  // Exact required user error message
  const expectedErrorMessage =
    'An account associated with this email address was previously deleted, and a new account cannot be created with it. If you believe this is a mistake or need assistance, please contact RolePilot Support.';
  assert.ok(
    serviceContent.includes('DELETED_ACCOUNT_REGISTRATION_MESSAGE'),
    'AccountService must declare DELETED_ACCOUNT_REGISTRATION_MESSAGE constant'
  );
  assert.ok(
    serviceContent.includes('An account associated with this email address was previously deleted'),
    'AccountService must contain exact required error message'
  );


  // Auth API router registration
  const authApiPath = path.join(projectRoot, 'backend', 'app', 'api', 'auth.py');
  assert.ok(fs.existsSync(authApiPath), 'backend/app/api/auth.py must exist');
  const authContent = fs.readFileSync(authApiPath, 'utf8');
  assert.ok(authContent.includes('/check-registration'), 'auth.py must expose /check-registration');
  assert.ok(authContent.includes('AccountService.validate_registration_email'), 'auth.py must validate registration against email reservations');
});

// 3. Frontend AuthService: Pre-Registration Validation & Deleted Account Flagging
test('AuthService: Pre-registration email check and deleted account handling', () => {
  const authServicePath = path.join(projectRoot, 'frontend', 'src', 'services', 'authService.ts');
  const content = fs.readFileSync(authServicePath, 'utf8');

  assert.ok(content.includes('checkRegistrationEmail'), 'authService must export checkRegistrationEmail method');
  assert.ok(content.includes('/api/v1/auth/check-registration'), 'authService must call /api/v1/auth/check-registration');
  assert.ok(content.includes('isDeletedAccount?: boolean'), 'AuthResult must include isDeletedAccount flag');
  assert.ok(content.includes('this.checkRegistrationEmail(params.email)'), 'signUp must perform checkRegistrationEmail before Supabase signUp');
});

// 4. SignupPage: Deleted Account Rejection and Support Action
test('SignupPage: Displays exact message and Contact Support action for deleted accounts', () => {
  const signupPagePath = path.join(projectRoot, 'frontend', 'src', 'pages', 'SignupPage.tsx');
  const content = fs.readFileSync(signupPagePath, 'utf8');

  assert.ok(content.includes('onNavigateSupport?: () => void'), 'SignupPageProps must accept onNavigateSupport');
  assert.ok(content.includes('isDeletedAccount'), 'SignupPage must track isDeletedAccount state');
  assert.ok(content.includes('Contact Support'), 'SignupPage must render Contact Support button when account was deleted');
  assert.ok(content.includes('/support'), 'SignupPage Contact Support action must target /support');
});

// 5. AppLayout & App.tsx: Tab Routing & Lightweight Entry Point
test('AppLayout & App.tsx: Integrated settings tab routing and lightweight entry modal', () => {
  const layoutPath = path.join(projectRoot, 'frontend', 'src', 'components/layout', 'AppLayout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(layoutContent.includes("'settings'"), 'AppLayout TabType must include settings');
  assert.ok(layoutContent.includes("onTabChange('settings')"), 'Settings button must trigger onTabChange with settings');
  assert.ok(layoutContent.includes("doNavigate('/settings')"), 'Settings button must navigate to /settings');
  assert.ok(layoutContent.includes('Open Dedicated Settings Page'), 'Lightweight modal must provide action to open dedicated Settings page');

  const appPath = path.join(projectRoot, 'frontend', 'src', 'App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  assert.ok(appContent.includes("import { SettingsPage }"), 'App.tsx must import SettingsPage');
  assert.ok(appContent.includes("p === '/settings'"), 'App.tsx must identify /settings path');
  assert.ok(appContent.includes("visitedTabs.has('settings')"), 'App.tsx must render SettingsPage inside persistent layout');
});

// 6. Privacy Policy: Comprehensive Account Deletion & Email Reservation Disclosure
test('PrivacyPage: Documents purged data, minimal retained email reservation, policy status, and Support assistance', () => {
  const privacyPath = path.join(projectRoot, 'frontend', 'src', 'pages', 'PrivacyPage.tsx');
  const content = fs.readFileSync(privacyPath, 'utf8');

  // Personal data purged
  assert.ok(content.includes('Personal Data Purged Upon Deletion'), 'Must detail purged personal data');
  assert.ok(content.includes('Cloud Object Storage') || content.includes('resumes/'), 'Must specify storage file purging');
  assert.ok(content.includes('Candidate Profile &amp; History') || content.includes('Candidate Profile & History'), 'Must specify profile data purging');
  assert.ok(content.includes('Connected Integrations'), 'Must specify third-party credential purging');
  assert.ok(content.includes('Supabase Auth'), 'Must specify Supabase Auth identity deletion');

  // Minimal retained data & rationale
  assert.ok(content.includes('Minimal Data Retained Post-Deletion'), 'Must document minimal retained data');
  assert.ok(content.includes('Normalized Email Reservation'), 'Must document normalized email reservation');
  assert.ok(content.includes('Why Normalized Email Reservations Are Retained'), 'Must explain technical purpose of email reservation');
  assert.ok(content.includes('prevent unauthorized account re-registration'), 'Must state re-registration prevention');

  // Retention schedule & product decision note
  assert.ok(content.includes('Retention Schedule &amp; Approved Policy Status') || content.includes('Retention Schedule & Approved Policy Status'), 'Must document approved retention policy status');
  assert.ok(content.includes('pending product decision requiring formal business and legal approval'), 'Must flag time-bounded retention window as pending product decision without inventing arbitrary expiration');

  // Support contact instructions
  assert.ok(content.includes('Mistaken Deletion &amp; Account Assistance') || content.includes('Mistaken Deletion & Account Assistance'), 'Must explain assistance for mistaken deletions');
  assert.ok(content.includes('Help &amp; Support page') || content.includes('Help & Support page') || content.includes('/support'), 'Must link to Support page');
  assert.ok(content.includes('without requiring an active login'), 'Must clarify that Support is accessible without logging in');
});

// 7. SupportPage: Publicly Accessible Account Deletion Assistance
test('SupportPage: Provides publicly accessible Account Deletion and mistaken deletion contact route', () => {
  const supportPath = path.join(projectRoot, 'frontend', 'src', 'pages', 'SupportPage.tsx');
  const content = fs.readFileSync(supportPath, 'utf8');

  assert.ok(content.includes('Account Deletion &amp; Support') || content.includes('Account Deletion & Support'), 'SupportPage must provide Account Deletion assistance card');
  assert.ok(content.includes('accidental deletion') || content.includes('account recreation') || content.includes('email reservation release'), 'Must explain assistance options');
  assert.ok(content.includes('href="/contact"'), 'Must link directly to public Contact form');
  assert.ok(content.includes('no login required') || content.includes('No login is required') || content.includes('no active account login required'), 'Must clarify no login requirement');
  assert.ok(!content.includes('support@rolepilot.com'), 'Must not invent fake support email');
  assert.ok(!content.includes('1-800'), 'Must not invent fake phone number');
});

// 8. SettingsPage Deletion Lifecycle & Error Handling
test('SettingsPage: Wait for backend deletion before sign-out, display actionable error on failure, and prevent duplicate submit', () => {
  const settingsPath = path.join(projectRoot, 'frontend', 'src', 'pages', 'SettingsPage.tsx');
  const content = fs.readFileSync(settingsPath, 'utf8');

  // Button disabled while in flight or without typing DELETE
  assert.ok(content.includes("disabled={deleteConfirmationInput !== 'DELETE' || isDeletingAccount}"), 'Delete button must be disabled until DELETE is typed and when isDeletingAccount is true');
  assert.ok(content.includes("setIsDeletingAccount(true)"), 'Handler must set isDeletingAccount to true before making deletion request');

  // Proper order of operations: backend delete -> logout -> redirect
  const deleteHandlerSlice = content.slice(content.indexOf('handleDeleteAccount = async () => {'), content.indexOf('const userInitials ='));
  assert.ok(deleteHandlerSlice.indexOf('await authService.deleteAccount()') < deleteHandlerSlice.indexOf('await logout()'), 'Must await backend deleteAccount before calling logout');
  assert.ok(deleteHandlerSlice.indexOf('await logout()') < deleteHandlerSlice.indexOf('onNavigateSupport'), 'Must complete logout before redirecting to Support');

  // Error recovery: keep modal open, clear loading, set actionable error
  assert.ok(deleteHandlerSlice.includes('setDeleteAccountError(formatErrorMessage(err))'), 'Must capture and format deletion error message');
  assert.ok(deleteHandlerSlice.includes('setIsDeletingAccount(false)'), 'Must reset loading state on error to allow retry');
  assert.ok(deleteHandlerSlice.includes('setIsDeleteModalOpen(false)'), 'Must only close modal on successful deletion');
});

