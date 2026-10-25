import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('PUBLIC_ROUTES contains all legal, informational, and support routes', () => {
  const appFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/App.tsx'), 'utf-8');
  
  const expectedRoutes = [
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
  ];

  for (const route of expectedRoutes) {
    assert.match(
      appFile,
      new RegExp(`'${route}'`),
      `App.tsx must include '${route}' in public routes`,
    );
  }
});

test('LandingPage renders features, integrations, workflow, safety, and 5 supported platforms', () => {
  const landingFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/LandingPage.tsx'), 'utf-8');

  // Verify top navigation links
  assert.ok(landingFile.includes('href="#features"'), 'Features nav link must exist');
  assert.ok(landingFile.includes('href="#integrations"'), 'Integrations nav link must exist');
  assert.ok(landingFile.includes('href="#workflow"'), 'Workflow nav link must exist');
  assert.ok(landingFile.includes('href="#safety"'), 'Safety & Control nav link must exist');

  // Verify 5 platform cards
  assert.ok(landingFile.includes('LinkedIn'), 'LinkedIn must be in platforms');
  assert.ok(landingFile.includes('Available Now'), 'LinkedIn must be labeled Available Now');
  assert.ok(landingFile.includes('Indeed'), 'Indeed must be in platforms');
  assert.ok(landingFile.includes('Glassdoor'), 'Glassdoor must be in platforms');
  assert.ok(landingFile.includes('Naukri'), 'Naukri must be in platforms');
  assert.ok(landingFile.includes('Wellfound'), 'Wellfound must be in platforms');
  assert.ok(landingFile.includes('Coming Soon'), 'Upcoming platforms must be labeled Coming Soon');

  // Verify shared container class
  assert.ok(landingFile.includes('landing-card-section'), 'Landing sections must use shared container class');
});

test('PublicFooter includes complete informational and legal links', () => {
  const footerFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/components/common/PublicFooter.tsx'), 'utf-8');

  assert.ok(footerFile.includes('href="/about"'), 'Footer must link to /about');
  assert.ok(footerFile.includes('href="/terms"'), 'Footer must link to /terms');
  assert.ok(footerFile.includes('href="/privacy"'), 'Footer must link to /privacy');
  assert.ok(footerFile.includes('href="/guidelines"'), 'Footer must link to /guidelines');
  assert.ok(footerFile.includes('href="/support"'), 'Footer must link to /support');
});

test('AboutPage details purpose, readiness audits, pre-staged answers, and disclaimers', () => {
  const aboutFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/AboutPage.tsx'), 'utf-8');

  assert.ok(aboutFile.includes('Readiness & Qualification Audits'), 'About must cover readiness audits');
  assert.ok(aboutFile.includes('Pre-Staged Application Responses'), 'About must cover pre-staged responses');
  assert.ok(aboutFile.includes('Unified Submission Pipeline'), 'About must cover unified pipeline');
  assert.ok(aboutFile.includes('Human-in-the-Loop Requirement'), 'About must cover human-in-the-loop requirement');
  assert.ok(aboutFile.includes('Accuracy of Information'), 'About must cover accuracy responsibility');
  assert.ok(aboutFile.includes('No Outcome Guarantees'), 'About must disclaim outcome guarantees');
});

test('TermsPage includes eligibility, acceptable use, human approval, and legal draft notice', () => {
  const termsFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/TermsPage.tsx'), 'utf-8');

  assert.ok(termsFile.includes('Account Eligibility and Security'), 'Terms must cover eligibility');
  assert.ok(termsFile.includes('Accurate User Information'), 'Terms must cover accuracy');
  assert.ok(termsFile.includes('Acceptable Use Policy'), 'Terms must cover acceptable use');
  assert.ok(termsFile.includes('Human Review and Application Approval Gate'), 'Terms must cover human gate');
  assert.ok(termsFile.includes('Third-Party Platforms and Portals'), 'Terms must cover third parties');
  assert.ok(termsFile.includes('Intellectual Property'), 'Terms must cover IP');
  assert.ok(termsFile.includes('Account Suspension and Termination'), 'Terms must cover termination');
  assert.ok(termsFile.includes('Express Disclaimer of Hiring Outcomes'), 'Terms must disclaim hiring outcomes');
  assert.ok(termsFile.includes('Limitation of Liability'), 'Terms must limit liability');
  assert.ok(termsFile.includes('Notice: Pre-Publication Legal Draft'), 'Terms must have legal draft notice');
});

test('PrivacyPage documents actual architecture, data collected, retention, and deletion rights', () => {
  const privacyFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/PrivacyPage.tsx'), 'utf-8');

  assert.ok(privacyFile.includes('Information We Collect'), 'Privacy must state data collected');
  assert.ok(privacyFile.includes('Supabase'), 'Privacy must cite Supabase for auth/database');
  assert.ok(privacyFile.includes('Render'), 'Privacy must cite Render for API services');
  assert.ok(privacyFile.includes('Vercel'), 'Privacy must cite Vercel for frontend');
  assert.ok(privacyFile.includes('DELETE /api/v1/account'), 'Privacy must cite deletion endpoint');
  assert.ok(privacyFile.includes('Notice: Pre-Publication Privacy Draft'), 'Privacy must have privacy draft notice');
});

test('GuidelinesPage specifies user responsibilities and labels unfinished policies as Coming Soon', () => {
  const guidelinesFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/GuidelinesPage.tsx'), 'utf-8');

  assert.ok(guidelinesFile.includes('Accurate Profile Information'), 'Guidelines must cover accurate profile');
  assert.ok(guidelinesFile.includes('Resume Ownership and Authenticity'), 'Guidelines must cover resume ownership');
  assert.ok(guidelinesFile.includes('Credential Security and Account Integrity'), 'Guidelines must cover credentials');
  assert.ok(guidelinesFile.includes('Responsible Platform Usage'), 'Guidelines must cover responsible usage');
  assert.ok(guidelinesFile.includes('Human Review Gate'), 'Guidelines must cover review gate');
  assert.ok(guidelinesFile.includes('Coming Soon'), 'Unfinished guidelines must be marked Coming Soon');
});

test('SupportPage shows polished Coming Soon state with next steps and no invented contact details', () => {
  const supportFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/SupportPage.tsx'), 'utf-8');

  assert.ok(
    supportFile.includes('Help & Support — Coming Soon') || supportFile.includes('Help &amp; Support — Coming Soon'),
    'Support page title must be Coming Soon',
  );
  assert.ok(supportFile.includes('Useful Next Steps'), 'Support page must provide next steps');
  assert.ok(!supportFile.includes('support@rolepilot.com'), 'Must not invent fake support email');
  assert.ok(!supportFile.includes('1-800'), 'Must not invent fake phone number');
});

test('PolicyAcceptancePage links to Terms of Use and Privacy Policy without user-facing draft-1 version badge', () => {
  const policyPageFile = fs.readFileSync(path.join(projectRoot, 'frontend/src/pages/PolicyAcceptancePage.tsx'), 'utf-8');

  assert.ok(policyPageFile.includes('href="/terms"'), 'Policy page must link to /terms');
  assert.ok(policyPageFile.includes('href="/privacy"'), 'Policy page must link to /privacy');
  assert.ok(!policyPageFile.includes('policy-badge'), 'Visible policy-badge must be removed from UI');
});
