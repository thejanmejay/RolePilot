import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const frontendSrc = path.join(projectRoot, 'frontend', 'src');

test('Unified Onboarding: Standalone shell with RolePilot logo, help link, and NO sidebar or dashboard nav', () => {
  const onboardingPath = path.join(frontendSrc, 'pages', 'OnboardingPage.tsx');
  const appPath = path.join(frontendSrc, 'App.tsx');

  const onboardingContent = fs.readFileSync(onboardingPath, 'utf8');
  const appContent = fs.readFileSync(appPath, 'utf8');

  // Verify RolePilot logo and help link
  assert.match(onboardingContent, /RolePilotLogo/, 'Must render RolePilotLogo in topbar');
  assert.match(onboardingContent, /Need help\?/, 'Must render Need help? link in topbar');

  // Verify rendered completely outside AppLayout (no sidebar or profile section menu)
  assert.match(
    appContent,
    /postAuthRoute === 'onboarding' \|\| currentPath === '\/onboarding'/,
    'Must route to OnboardingPage directly without AppLayout wrapper'
  );
  assert.doesNotMatch(onboardingContent, /AppLayout/, 'OnboardingPage must not import or render AppLayout');
  assert.doesNotMatch(onboardingContent, /Sidebar/, 'OnboardingPage must not render sidebar');
});

test('Unified Onboarding: Step 1 Add Source requires at least one valid source and removes bypass skip', () => {
  const addSourcePath = path.join(frontendSrc, 'components', 'onboarding', 'AddSourceStep.tsx');
  const addSourceContent = fs.readFileSync(addSourcePath, 'utf8');

  // Must offer 2 selectable cards
  assert.match(addSourceContent, /Upload Resume/, 'Must offer Upload Resume card');
  assert.match(addSourceContent, /Recommended/, 'Must feature Recommended badge');
  assert.match(addSourceContent, /Use Portfolio URL/, 'Must offer Portfolio URL card');

  // Validation rules
  assert.match(addSourceContent, /accept="\.pdf,application\/pdf"/, 'Must restrict resume to PDF format');
  assert.match(addSourceContent, /10 MB/, 'Must enforce 10 MB limit');
  assert.match(addSourceContent, /At least one source is required to continue/, 'Must inform user that at least one source is required');

  // Prevents moving forward without source
  assert.match(
    addSourceContent,
    /!hasResume && !hasPortfolio/,
    'Must validate that at least one valid source exists before proceeding'
  );
  assert.doesNotMatch(
    addSourceContent,
    /Skip to Dashboard/,
    'Must remove Skip option that bypasses source requirement'
  );
});

test('Unified Onboarding: Extraction state renders real processing stages, illustration, and retry controls', () => {
  const extractionPath = path.join(frontendSrc, 'components', 'onboarding', 'ExtractionProgressStep.tsx');
  const extractionContent = fs.readFileSync(extractionPath, 'utf8');

  // Visual document illustration with 6 floating colorful badges
  assert.match(extractionContent, /Personal Details/, 'Must render Personal Details floating badge');
  assert.match(extractionContent, /Work Experience/, 'Must render Work Experience floating badge');
  assert.match(extractionContent, /Education/, 'Must render Education floating badge');
  assert.match(extractionContent, /Technical Skills/, 'Must render Technical Skills floating badge');
  assert.match(extractionContent, /Certifications/, 'Must render Certifications floating badge');
  assert.match(extractionContent, /Online Profiles/, 'Must render Online Profiles floating badge');

  // Real progress stages and accessibility
  assert.match(extractionContent, /role="status"/, 'Must include role="status" for accessibility');
  assert.match(extractionContent, /aria-live="polite"/, 'Must announce status changes politely');
  assert.match(extractionContent, /Extracting and mapping information\.\.\./, 'Must display descriptive status text');
  assert.match(extractionContent, /onRetry/, 'Must provide retry callback');
  assert.match(extractionContent, /onCancel/, 'Must provide cancel callback');
});

test('Unified Onboarding: Step 2 Review Profile renders 6 expandable sections, badges, and conflict cards', () => {
  const reviewPath = path.join(frontendSrc, 'components', 'onboarding', 'ReviewProfileStep.tsx');
  const reviewContent = fs.readFileSync(reviewPath, 'utf8');

  // 6 Section headers
  assert.match(reviewContent, /Personal Information/, 'Must include Personal Information section');
  assert.match(reviewContent, /Professional Summary/, 'Must include Professional Summary section');
  assert.match(reviewContent, /Work Experience/, 'Must include Work Experience section');
  assert.match(reviewContent, /Technical Skills/, 'Must include Technical Skills section');
  assert.match(reviewContent, /Education/, 'Must include Education section');
  assert.match(reviewContent, /Certifications/, 'Must include Certifications section');

  // Extracted badge & Edit action
  assert.match(reviewContent, /Badge variant="success"/, 'Must render Extracted badge');
  assert.match(reviewContent, /<span>Edit<\/span>/, 'Must render Edit action button');

  // Source conflicts
  assert.match(reviewContent, /Source Conflict Detected/, 'Must render conflict notice when sources disagree');
  assert.match(reviewContent, /handleResolveConflict/, 'Must provide interactive conflict resolution');

  // Navigation & Save & Continue reliability
  assert.match(reviewContent, /onBack/, 'Must support Back navigation');
  assert.match(reviewContent, /Save & Continue/, 'Must support Save & Continue navigation');
  assert.match(reviewContent, /onboarding-save-and-continue-btn/, 'Must provide explicit identifier on Save & Continue button');
  assert.match(reviewContent, /effectiveHeadline|currentHeadline/, 'Must auto-derive headline if empty to prevent silent block');
  assert.match(reviewContent, /AlertCircle/, 'Must include visible alert for validation feedback');
});

test('Unified Onboarding: Step 3 Set Preferences provides required role, location, mode, exp, salary, and notice period', () => {
  const prefsPath = path.join(frontendSrc, 'components', 'onboarding', 'SetPreferencesStep.tsx');
  const prefsContent = fs.readFileSync(prefsPath, 'utf8');

  // 6 Grouped sections
  assert.match(prefsContent, /Target Job Roles/, 'Must include Target Job Roles');
  assert.match(prefsContent, /Preferred Locations/, 'Must include Preferred Locations');
  assert.match(prefsContent, /Work Mode/, 'Must include Work Mode');
  assert.match(prefsContent, /Experience Level/, 'Must include Experience Level');
  assert.match(prefsContent, /Expected Salary \(Annual\)/, 'Must include Expected Salary (Annual)');
  assert.match(prefsContent, /Notice Period/, 'Must include Notice Period');

  // Removable chips and multi-select
  assert.match(prefsContent, /preferences\.targetRoles\.map/, 'Must render selected target role chips');
  assert.match(prefsContent, /handleRemoveRole/, 'Must allow removing target role chips');
  assert.match(prefsContent, /preferences\.preferredLocations\.map/, 'Must render selected location chips');
  assert.match(prefsContent, /handleRemoveLocation/, 'Must allow removing location chips');

  // Segmented pill options
  assert.match(prefsContent, /Remote/, 'Must include Remote option');
  assert.match(prefsContent, /Hybrid/, 'Must include Hybrid option');
  assert.match(prefsContent, /On-site/, 'Must include On-site option');

  assert.match(prefsContent, /Entry \(0-2 years\)/, 'Must include Entry experience level');
  assert.match(prefsContent, /Mid \(2-5 years\)/, 'Must include Mid experience level');
  assert.match(prefsContent, /Senior \(5\+ years\)/, 'Must include Senior experience level');

  assert.match(prefsContent, /Immediate/, 'Must include Immediate notice period');
  assert.match(prefsContent, /15 Days/, 'Must include 15 Days notice period');
  assert.match(prefsContent, /30 Days/, 'Must include 30 Days notice period');

  // Validation
  assert.match(
    prefsContent,
    /preferences\.targetRoles\.length === 0/,
    'Must validate that at least one target role is selected'
  );
  assert.match(
    prefsContent,
    /preferences\.preferredLocations\.length === 0/,
    'Must validate that at least one location is selected'
  );
});

test('Unified Onboarding: Step 4 Complete renders celebration avatar, confetti, and dashboard redirect', () => {
  const completePath = path.join(frontendSrc, 'components', 'onboarding', 'CompleteStep.tsx');
  const completeContent = fs.readFileSync(completePath, 'utf8');

  assert.match(completeContent, /Your profile is ready!/, 'Must display celebration heading');
  assert.match(completeContent, /Go to Dashboard/, 'Must offer Go to Dashboard button');
  assert.match(completeContent, /View My Resume/, 'Must offer View My Resume button');
  assert.match(completeContent, /onGoToDashboard/, 'Must bind onGoToDashboard callback');
});

test('Unified Onboarding: Draft resilience, persistence, and tenant isolation', () => {
  const onboardingPath = path.join(frontendSrc, 'pages', 'OnboardingPage.tsx');
  const onboardingContent = fs.readFileSync(onboardingPath, 'utf8');

  // Local storage draft auto-save & recovery
  assert.match(onboardingContent, /rolepilot_onboarding_draft_/, 'Must scope draft key to user ID');
  assert.match(onboardingContent, /localStorage\.setItem/, 'Must persist draft changes to localStorage');
  assert.match(onboardingContent, /localStorage\.getItem/, 'Must restore draft on page reload/refresh');
  assert.match(onboardingContent, /localStorage\.removeItem/, 'Must clear draft upon successful completion');

  // Backend persistence integration
  assert.match(onboardingContent, /extractionApi\.applyExtraction/, 'Must persist qualifications via applyExtraction');
  assert.match(onboardingContent, /jobsApi\.createSearchConfig/, 'Must persist preferences via createSearchConfig');
  assert.match(onboardingContent, /profileApi\.uploadResume/, 'Must upload resume file to candidate storage');
});
