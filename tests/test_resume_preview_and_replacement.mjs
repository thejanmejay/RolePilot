import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Resume Preview: ResumePreviewModal component implements PDF viewer, zoom, and metadata', () => {
  const modalPath = path.join(projectRoot, 'frontend/src/components/profile/ResumePreviewModal.tsx');
  assert.ok(fs.existsSync(modalPath), 'ResumePreviewModal.tsx must exist');

  const content = fs.readFileSync(modalPath, 'utf-8');

  // 1. Embedded PDF iframe / object
  assert.ok(
    content.includes('<iframe') && content.includes('#zoom='),
    'ResumePreviewModal must embed the PDF inside an iframe with zoom parameters'
  );

  // 2. Zoom controls
  assert.ok(content.includes('handleZoomIn'), 'ResumePreviewModal must support zooming in');
  assert.ok(content.includes('handleZoomOut'), 'ResumePreviewModal must support zooming out');
  assert.ok(content.includes('handleResetZoom'), 'ResumePreviewModal must support resetting zoom');

  // 3. Metadata presentation
  assert.ok(content.includes('displayVersion'), 'ResumePreviewModal must display resume version');
  assert.ok(content.includes('Active Document'), 'ResumePreviewModal must display active document badge');
  assert.ok(content.includes('formatDate'), 'ResumePreviewModal must format upload timestamp');

  // 4. Two primary actions: Replace Resume and Back
  assert.ok(content.includes('Replace Resume'), 'ResumePreviewModal must provide Replace Resume action');
  assert.ok(content.includes('Back to Resumes'), 'ResumePreviewModal must provide Back action');

  // 5. Extracted text available in separate inspection section without replacing preview
  assert.ok(
    content.includes('showExtractedText') && content.includes('Extracted Text'),
    'Extracted text must be toggleable in a separate inspector without replacing document preview'
  );
});

test('Resume Replacement Workflow: Safe conflict confirmation, diff handling, and activation', () => {
  const modalPath = path.join(projectRoot, 'frontend/src/components/profile/ResumePreviewModal.tsx');
  const content = fs.readFileSync(modalPath, 'utf-8');

  // 1. Conflict confirmation dialog (Scenario A: conflicts exist)
  assert.ok(
    content.includes('Profile Changes Awaiting Confirmation'),
    'Modal must display conflict confirmation step when replacement detects differing fields'
  );
  assert.ok(
    content.includes('Keep Current') && content.includes('Apply New Resume'),
    'Candidate must be given radio/selection choices between existing and replacement data'
  );

  // 2. Preserved manual fields notice
  assert.ok(
    content.includes('preserved_fields'),
    'Modal must present preserved manual fields notice'
  );

  // 3. Duplicate submit protection
  assert.ok(
    content.includes('isDuplicateSubmitting'),
    'Must prevent duplicate concurrent replacement uploads'
  );

  // 4. Scenario B: Zero conflicts MUST NEVER automatically activate without candidate confirmation
  assert.ok(
    !content.includes('// No destructive conflicts — activate directly'),
    'Modal must not bypass candidate confirmation when conflicts are empty'
  );
  assert.ok(
    content.includes('No Conflicting Field Values'),
    'Modal must present an explicit empty-conflict review state when no conflicting fields exist'
  );
  assert.ok(
    content.includes('Confirm Resume Replacement'),
    'Modal must show replacement confirmation header when conflicts are zero'
  );

  // 5. Explicit user confirmation & cancellation safety
  assert.ok(
    content.includes('Confirm &amp; Activate'),
    'Candidate must explicitly click Confirm & Activate before activation request is sent'
  );
  assert.ok(
    content.includes('Cancel Replacement'),
    'Candidate can cancel replacement review, keeping active document intact'
  );
  assert.ok(
    content.includes("setReplaceStep('idle')") && content.includes("setReplacementData(null)"),
    'Cancelling replacement returns step to idle and clears replacement draft data'
  );
});

test('Onboarding and Dashboard Consistency: Shared ResumePreviewModal in both entry points', () => {
  // 1. Dashboard ResumeSection
  const resumeSectionPath = path.join(projectRoot, 'frontend/src/components/profile/ResumeSection.tsx');
  const resumeSection = fs.readFileSync(resumeSectionPath, 'utf-8');
  assert.ok(
    resumeSection.includes('<ResumePreviewModal'),
    'Dashboard ResumeSection must use ResumePreviewModal'
  );
  assert.ok(
    !resumeSection.includes('title={`Resume Inspection: ${viewingResume?.file_name}`}'),
    'Old text-only inspection modal must be replaced by ResumePreviewModal'
  );

  // 2. Onboarding CompleteStep
  const completeStepPath = path.join(projectRoot, 'frontend/src/components/onboarding/CompleteStep.tsx');
  const completeStep = fs.readFileSync(completeStepPath, 'utf-8');
  assert.ok(
    completeStep.includes('<ResumePreviewModal'),
    'Onboarding CompleteStep must use ResumePreviewModal for View My Resume'
  );

  // 3. Onboarding AddSourceStep
  const addSourcePath = path.join(projectRoot, 'frontend/src/components/onboarding/AddSourceStep.tsx');
  const addSource = fs.readFileSync(addSourcePath, 'utf-8');
  assert.ok(
    addSource.includes('<ResumePreviewModal') && addSource.includes('Preview Document'),
    'Onboarding AddSourceStep must support Preview Document via ResumePreviewModal'
  );

  // 4. Onboarding ReviewProfileStep
  const reviewProfilePath = path.join(projectRoot, 'frontend/src/components/onboarding/ReviewProfileStep.tsx');
  const reviewProfile = fs.readFileSync(reviewProfilePath, 'utf-8');
  assert.ok(
    reviewProfile.includes('<ResumePreviewModal') && reviewProfile.includes('Preview Source Document'),
    'Onboarding ReviewProfileStep must support Preview Source Document via ResumePreviewModal'
  );
});

test('API Client: Profile API defines blob streaming, replacement, and activation contracts', () => {
  const profileApiPath = path.join(projectRoot, 'frontend/src/api/profile.ts');
  const profileApi = fs.readFileSync(profileApiPath, 'utf-8');

  assert.ok(
    profileApi.includes('getResumeFileBlob:'),
    'profileApi must provide getResumeFileBlob'
  );
  assert.ok(
    profileApi.includes('replaceResume:'),
    'profileApi must provide replaceResume'
  );
  assert.ok(
    profileApi.includes('activateResume:'),
    'profileApi must provide activateResume'
  );
});

test('Backend Security & Scoping: Resumes API endpoints enforce session scoping', () => {
  const backendApiPath = path.join(projectRoot, 'backend/app/api/resumes.py');
  const backendApi = fs.readFileSync(backendApiPath, 'utf-8');

  assert.ok(
    backendApi.includes('user_id: uuid.UUID = Depends(get_current_user_id)'),
    'All resume endpoints must derive user identity from authenticated session'
  );
  assert.ok(
    backendApi.includes('@router.get("/{resume_id}/file")'),
    'Resumes router must provide /{resume_id}/file streaming endpoint'
  );
  assert.ok(
    backendApi.includes('@router.post("/replace"'),
    'Resumes router must provide /replace endpoint'
  );
  assert.ok(
    backendApi.includes('@router.post("/{resume_id}/activate"'),
    'Resumes router must provide /{resume_id}/activate endpoint'
  );
});

