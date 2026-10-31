import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const frontendSrc = path.join(projectRoot, 'frontend', 'src');
const backendApp = path.join(projectRoot, 'backend', 'app');

test('Shared Loading System: ProgressBar, LoadingSpinner, and ProcessingState exist with accessibility tokens', () => {
  const loadingDir = path.join(frontendSrc, 'components', 'common', 'loading');
  assert.ok(fs.existsSync(loadingDir), 'loading components directory must exist');

  const progressBarPath = path.join(loadingDir, 'ProgressBar.tsx');
  const spinnerPath = path.join(loadingDir, 'LoadingSpinner.tsx');
  const processingPath = path.join(loadingDir, 'ProcessingState.tsx');
  const indexPath = path.join(loadingDir, 'index.ts');

  assert.ok(fs.existsSync(progressBarPath), 'ProgressBar.tsx must exist');
  assert.ok(fs.existsSync(spinnerPath), 'LoadingSpinner.tsx must exist');
  assert.ok(fs.existsSync(processingPath), 'ProcessingState.tsx must exist');
  assert.ok(fs.existsSync(indexPath), 'loading/index.ts barrel export must exist');

  // ProgressBar tests
  const progressContent = fs.readFileSync(progressBarPath, 'utf8');
  assert.match(progressContent, /role="progressbar"/, 'ProgressBar must include role="progressbar"');
  assert.match(progressContent, /aria-valuenow=\{percentage\}/, 'ProgressBar must bind aria-valuenow');
  assert.match(progressContent, /aria-valuemin=\{0\}/, 'ProgressBar must declare aria-valuemin 0');
  assert.match(progressContent, /aria-valuemax=\{100\}/, 'ProgressBar must declare aria-valuemax 100');
  assert.match(progressContent, /Math\.max\(0,\s*Math\.min\(100/, 'ProgressBar must clamp percentage between 0 and 100');

  // LoadingSpinner tests
  const spinnerContent = fs.readFileSync(spinnerPath, 'utf8');
  assert.match(spinnerContent, /role="status"/, 'LoadingSpinner must have role="status"');
  assert.match(spinnerContent, /sr-only/, 'LoadingSpinner must include screen-reader text');
  assert.match(spinnerContent, /spin-animation/, 'LoadingSpinner must include animation class');

  // ProcessingState tests
  const procContent = fs.readFileSync(processingPath, 'utf8');
  assert.match(procContent, /role="status"/, 'ProcessingState must announce status changes');
  assert.match(procContent, /aria-live="polite"/, 'ProcessingState must have polite aria-live announcement');
  assert.match(procContent, /retryable_error/, 'ProcessingState must support retryable error state');
  assert.match(procContent, /terminal_error/, 'ProcessingState must support terminal error state');
  assert.match(procContent, /onRetry/, 'ProcessingState must provide onRetry callback');
  assert.match(procContent, /onCancel/, 'ProcessingState must provide onCancel callback');
  assert.match(procContent, /steps\.map/, 'ProcessingState must render multi-stage step indicators');
});

test('Shared Loading System: Reusable in common barrel exports', () => {
  const commonIndexPath = path.join(frontendSrc, 'components', 'common', 'index.ts');
  const commonContent = fs.readFileSync(commonIndexPath, 'utf8');

  assert.match(commonContent, /export \* from '\.\/loading'/, 'Common index must export loading components');
  assert.match(commonContent, /ProgressBar/, 'Common index must export ProgressBar');
  assert.match(commonContent, /LoadingSpinner/, 'Common index must export LoadingSpinner');
  assert.match(commonContent, /ProcessingState/, 'Common index must export ProcessingState');
});

test('Unified Onboarding: 4-step standalone flow with Add Source, Review, Preferences, and Complete', () => {
  const onboardingPath = path.join(frontendSrc, 'pages', 'OnboardingPage.tsx');
  const addSourcePath = path.join(frontendSrc, 'components', 'onboarding', 'AddSourceStep.tsx');
  const reviewPath = path.join(frontendSrc, 'components', 'onboarding', 'ReviewProfileStep.tsx');
  const prefsPath = path.join(frontendSrc, 'components', 'onboarding', 'SetPreferencesStep.tsx');
  const completePath = path.join(frontendSrc, 'components', 'onboarding', 'CompleteStep.tsx');
  const trackerPath = path.join(frontendSrc, 'components', 'onboarding', 'OnboardingProgressTracker.tsx');

  assert.ok(fs.existsSync(onboardingPath), 'OnboardingPage.tsx must exist');
  assert.ok(fs.existsSync(addSourcePath), 'AddSourceStep.tsx must exist');
  assert.ok(fs.existsSync(reviewPath), 'ReviewProfileStep.tsx must exist');
  assert.ok(fs.existsSync(prefsPath), 'SetPreferencesStep.tsx must exist');
  assert.ok(fs.existsSync(completePath), 'CompleteStep.tsx must exist');
  assert.ok(fs.existsSync(trackerPath), 'OnboardingProgressTracker.tsx must exist');

  const onboardingContent = fs.readFileSync(onboardingPath, 'utf8');
  const addSourceContent = fs.readFileSync(addSourcePath, 'utf8');
  const prefsContent = fs.readFileSync(prefsPath, 'utf8');
  const trackerContent = fs.readFileSync(trackerPath, 'utf8');

  // Mode & Step state
  assert.match(onboardingContent, /'choose_source'/, 'Onboarding must support choose_source step');
  assert.match(onboardingContent, /'processing'/, 'Onboarding must support live processing step');
  assert.match(onboardingContent, /'review'/, 'Onboarding must support profile review step');
  assert.match(onboardingContent, /'preferences'/, 'Onboarding must support preferences step');
  assert.match(onboardingContent, /'complete'/, 'Onboarding must support complete step');

  // 4-step Progress Tracker labels
  assert.match(trackerContent, /Add Source/, 'Tracker must include Add Source step');
  assert.match(trackerContent, /Review Profile/, 'Tracker must include Review Profile step');
  assert.match(trackerContent, /Set Preferences/, 'Tracker must include Set Preferences step');
  assert.match(trackerContent, /Complete/, 'Tracker must include Complete step');

  // Source selection controls: candidate must provide at least one valid source
  assert.match(addSourceContent, /Upload Resume/, 'Must offer resume upload card');
  assert.match(addSourceContent, /Use Portfolio URL/, 'Must offer portfolio URL card');
  assert.match(addSourceContent, /accept="\.pdf,application\/pdf"/, 'Must restrict resume uploads to PDF format');
  assert.match(addSourceContent, /10 MB/, 'Must specify 10 MB file size limit');
  assert.match(addSourceContent, /portfolio-url-input/, 'Must render portfolio-url-input');
  assert.match(addSourceContent, /At least one source is required to continue/, 'Must require at least one valid source');

  // Preferences step controls
  assert.match(prefsContent, /Target Job Roles/, 'Preferences must include Target Job Roles');
  assert.match(prefsContent, /Preferred Locations/, 'Preferences must include Preferred Locations');
  assert.match(prefsContent, /Work Mode/, 'Preferences must include Work Mode');
  assert.match(prefsContent, /Experience Level/, 'Preferences must include Experience Level');
  assert.match(prefsContent, /Expected Salary \(Annual\)/, 'Preferences must include Expected Salary');
  assert.match(prefsContent, /Notice Period/, 'Preferences must include Notice Period');
});

test('Extraction Review & Preference Persistence: Editable fields, conflict cards, and explicit confirmation', () => {
  const onboardingPath = path.join(frontendSrc, 'pages', 'OnboardingPage.tsx');
  const reviewPath = path.join(frontendSrc, 'components', 'onboarding', 'ReviewProfileStep.tsx');
  const completePath = path.join(frontendSrc, 'components', 'onboarding', 'CompleteStep.tsx');

  const onboardingContent = fs.readFileSync(onboardingPath, 'utf8');
  const reviewContent = fs.readFileSync(reviewPath, 'utf8');
  const completeContent = fs.readFileSync(completePath, 'utf8');

  // Editable fields in review step
  assert.match(reviewContent, /draft\.fullName/, 'Must bind editable fullName');
  assert.match(reviewContent, /draft\.headline/, 'Must bind editable headline');
  assert.match(reviewContent, /draft\.phone/, 'Must bind editable phone');
  assert.match(reviewContent, /draft\.city/, 'Must bind editable city/location');

  // Skills management
  assert.match(reviewContent, /draft\.skills\.map/, 'Must render extracted skills');
  assert.match(reviewContent, /handleRemoveSkill/, 'Must allow removing individual skills');
  assert.match(reviewContent, /handleAddSkill/, 'Must allow adding skills');

  // Conflict resolution
  assert.match(reviewContent, /Source Conflict Detected/, 'Must display conflict notice when sources disagree');
  assert.match(reviewContent, /draft\.conflicts\.map/, 'Must render individual conflict options');
  assert.match(reviewContent, /handleResolveConflict/, 'Must provide interactive conflict resolution');

  // User confirmation guard: saves ONLY after explicit user confirmation
  assert.match(onboardingContent, /handleSavePreferencesAndComplete/, 'Must have dedicated handler for explicit confirmation');
  assert.match(onboardingContent, /handleSaveConfirmedProfile/, 'Must have compatible confirmation handler');
  assert.match(onboardingContent, /complete-onboarding-btn/, 'Must provide complete-onboarding-btn test identifier');

  // Completion step actions
  assert.match(completeContent, /Your profile is ready!/, 'Must display celebration heading');
  assert.match(completeContent, /Go to Dashboard/, 'Must provide primary Go to Dashboard action');
  assert.match(completeContent, /View My Resume/, 'Must provide View My Resume action');
});

test('Backend Extraction Engine: SSRF protections, unreadable document handling, and conflict detection', () => {
  const portfolioExtractorPath = path.join(backendApp, 'services', 'portfolio_extractor.py');
  const resumeParserPath = path.join(backendApp, 'services', 'resume_parser.py');
  const mergerPath = path.join(backendApp, 'services', 'extraction_merger.py');

  const portfolioCode = fs.readFileSync(portfolioExtractorPath, 'utf8');
  const resumeCode = fs.readFileSync(resumeParserPath, 'utf8');
  const mergerCode = fs.readFileSync(mergerPath, 'utf8');

  // SSRF protections
  assert.match(portfolioCode, /is_private_or_restricted_ip/, 'Portfolio extractor must check for private/restricted IP');
  assert.match(portfolioCode, /socket\.getaddrinfo/, 'Portfolio extractor must resolve DNS before connecting');
  assert.match(portfolioCode, /httpx\.AsyncClient/, 'Portfolio extractor must use controlled HTTP requests');
  assert.match(portfolioCode, /MAX_PAGE_SIZE = 2 \* 1024 \* 1024/, 'Portfolio extractor must cap response at 2MB');
  assert.match(portfolioCode, /REQUEST_TIMEOUT_SECONDS = 8\.0/, 'Portfolio extractor must enforce 8s timeout');

  // Resume parsing & unreadable documents
  assert.match(resumeCode, /pdfplumber/, 'Resume parser must process PDF via pdfplumber');
  assert.match(resumeCode, /TECH_SKILLS_DICTIONARY/, 'Resume parser must match skills against dictionary');
  assert.match(resumeCode, /"is_readable": False/, 'Resume parser must flag unreadable or scanned documents gracefully');

  // Extraction merging & conflict detection
  assert.match(mergerCode, /ExtractionConflict/, 'Merger must generate ExtractionConflict objects');
  assert.match(mergerCode, /def merge\(/, 'Merger must implement merge function');
  assert.match(mergerCode, /conflicts\.append/, 'Merger must detect conflicting field values');
  assert.match(mergerCode, /merged_skills/, 'Merger must deduplicate and attribute skills');
});

test('Backend API Layer: Authentication, ownership isolation, and safe persistence', () => {
  const apiPath = path.join(backendApp, 'api', 'profile_extraction.py');
  const apiCode = fs.readFileSync(apiPath, 'utf8');

  assert.match(apiCode, /@router\.post\("\/extract"/, 'Must expose /extract endpoint');
  assert.match(apiCode, /@router\.post\("\/apply-extraction"/, 'Must expose /apply-extraction endpoint');
  assert.match(apiCode, /user_id: uuid\.UUID = Depends\(get_current_user_id\)/, 'Endpoints must require authenticated user id');
  assert.match(apiCode, /onboarding_completed = True/, 'Must update onboarding_completed upon explicit profile confirmation');
  assert.match(apiCode, /db\.commit\(\)/, 'Must securely commit profile changes to database');
});
