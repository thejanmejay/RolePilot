import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const landing = fs.readFileSync(path.join(root, 'frontend/src/pages/LandingPage.tsx'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'frontend/src/components/auth/auth.css'), 'utf8');

test('Supported Platforms, ATS Resume Checker, and FAQ use the same centered section flow', () => {
  const platformIndex = landing.indexOf('id="integrations" className="landing-card-section landing-platforms-card"');
  const checkerIndex = landing.indexOf('id="resume-checker" className="landing-card-section landing-resume-checker-card"');
  const faqIndex = landing.indexOf('id="faq" className="landing-card-section landing-faq-card"');
  assert.ok(platformIndex >= 0 && platformIndex < checkerIndex && checkerIndex < faqIndex);
  assert.equal((landing.match(/id="resume-checker"/g) || []).length, 1);

  const checkerTag = landing.slice(checkerIndex, landing.indexOf('>', checkerIndex) + 1);
  assert.doesNotMatch(checkerTag, /style=/, 'The checker section must not override shared container sizing inline');
  assert.match(styles, /\.landing-card-section\s*\{[^}]*max-width:\s*1140px;[^}]*width:\s*calc\(100% - 48px\);[^}]*margin:\s*36px auto;/s);
  assert.match(styles, /\.landing-resume-checker-layout\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(220px, 280px\);/s);
  assert.doesNotMatch(styles, /\.landing-resume-checker-card\s*\{[^}]*position:\s*absolute/s);
});

test('ATS Resume Checker stacks cleanly at mobile widths without changing its route action', () => {
  assert.match(landing, /onClick=\{\(\) => navigate\('\/resume-checker'\)\}/);
  assert.match(styles, /@media\s*\(max-width:\s*640px\)\s*\{[^}]*\.landing-resume-checker-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s);
  assert.match(styles, /@media\s*\(max-width:\s*480px\)\s*\{[^}]*\.landing-resume-checker-cta\s*\{[^}]*width:\s*100%;/s);
  assert.match(styles, /@media\s*\(max-width:\s*768px\)\s*\{[^}]*\.landing-card-section\s*\{[^}]*width:\s*calc\(100% - 24px\);[^}]*margin:\s*20px auto;/s);
});
