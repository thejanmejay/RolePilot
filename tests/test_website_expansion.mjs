import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

test('Contact configuration correctly specifies Google Form and builds prefilled URL', () => {
  const contactConfigPath = path.join(projectRoot, 'frontend/src/config/contactConfig.ts');
  assert.ok(fs.existsSync(contactConfigPath), 'contactConfig.ts should exist');
  const code = fs.readFileSync(contactConfigPath, 'utf8');

  assert.ok(code.includes('https://docs.google.com/forms/d/e/1FAIpQLScEIhtak-KPNZ-gDWMFkunP2yihTpLdpTLx9XbAWI4fi6PNVg/viewform'), 'Should contain resolved responder URL');
  assert.ok(code.includes('entry.1972022550'), 'Should contain Name entry ID');
  assert.ok(code.includes('entry.402706908'), 'Should contain Email entry ID');
  assert.ok(code.includes('entry.1103946435'), 'Should contain Topic entry ID');
  assert.ok(code.includes('entry.1595425484'), 'Should contain Message entry ID');
  assert.ok(code.includes('buildPrefilledGoogleFormUrl'), 'Should export buildPrefilledGoogleFormUrl');
});

test('ContactPage renders required fields, confirmation notice, and topic dropdown options', () => {
  const contactPagePath = path.join(projectRoot, 'frontend/src/pages/ContactPage.tsx');
  const contactConfigPath = path.join(projectRoot, 'frontend/src/config/contactConfig.ts');
  assert.ok(fs.existsSync(contactPagePath), 'ContactPage.tsx should exist');
  const code = fs.readFileSync(contactPagePath, 'utf8');
  const configCode = fs.readFileSync(contactConfigPath, 'utf8');

  assert.ok(code.includes('Your query has been sent. Please wait for a reply from the RolePilot team.'), 'Must display exact required confirmation message');
  assert.ok(configCode.includes('General Inquiry'), 'Must support General Inquiry topic');
  assert.ok(configCode.includes('Product Feedback'), 'Must support Product Feedback topic');
  assert.ok(configCode.includes('Technical Support'), 'Must support Technical Support topic');
  assert.ok(configCode.includes('LinkedIn Integration'), 'Must support LinkedIn Integration topic');
  assert.ok(configCode.includes('Account and Privacy'), 'Must support Account and Privacy topic');
  assert.ok(configCode.includes('Bug Report'), 'Must support Bug Report topic');
  assert.ok(configCode.includes('Accessibility Barrier'), 'Must support Accessibility Barrier topic');
  assert.ok(configCode.includes('Other'), 'Must support Other topic');
  assert.ok(code.includes('Google Form'), 'Should disclose Google Form submission flow');
});

test('PricingPage clearly communicates that RolePilot is free to use without fake tiers', () => {
  const pricingPagePath = path.join(projectRoot, 'frontend/src/pages/PricingPage.tsx');
  assert.ok(fs.existsSync(pricingPagePath), 'PricingPage.tsx should exist');
  const code = fs.readFileSync(pricingPagePath, 'utf8');

  assert.ok(code.includes('Free to Use') || code.includes('free to use') || code.includes('Free for All Job Seekers'), 'Should state free to use');
  assert.ok(!code.includes('Enterprise Tier') && !code.includes('Pro Plan: $'), 'Should not contain fake paid plans');
});

test('CareersPage displays Not hiring at the moment status without fake job openings', () => {
  const careersPagePath = path.join(projectRoot, 'frontend/src/pages/CareersPage.tsx');
  assert.ok(fs.existsSync(careersPagePath), 'CareersPage.tsx should exist');
  const code = fs.readFileSync(careersPagePath, 'utf8');

  assert.ok(code.includes('Not hiring at the moment'), 'Should prominently display Not hiring at the moment');
});

test('AccessibilityPage documents accessibility goals and feedback route without claiming false certification', () => {
  const a11yPagePath = path.join(projectRoot, 'frontend/src/pages/AccessibilityPage.tsx');
  assert.ok(fs.existsSync(a11yPagePath), 'AccessibilityPage.tsx should exist');
  const code = fs.readFileSync(a11yPagePath, 'utf8');

  assert.ok(code.includes('Accessibility'), 'Should document accessibility statement');
  assert.ok(!code.includes('Officially certified WCAG AAA compliant'), 'Should not make false compliance claims');
  assert.ok(code.includes('/contact'), 'Should direct accessibility feedback to contact form');
});

test('FeaturesPage distinguishes Available Now vs In Development vs Planned capabilities', () => {
  const featuresPagePath = path.join(projectRoot, 'frontend/src/pages/FeaturesPage.tsx');
  assert.ok(fs.existsSync(featuresPagePath), 'FeaturesPage.tsx should exist');
  const code = fs.readFileSync(featuresPagePath, 'utf8');

  assert.ok(code.includes('Available Now'), 'Should highlight Available Now');
  assert.ok(code.includes('In Development') || code.includes('Planned'), 'Should highlight Planned / In Development');
});

test('IntegrationsPage maintains LinkedIn as sole active integration and marks others as roadmap', () => {
  const integrationsPagePath = path.join(projectRoot, 'frontend/src/pages/IntegrationsPage.tsx');
  assert.ok(fs.existsSync(integrationsPagePath), 'IntegrationsPage.tsx should exist');
  const code = fs.readFileSync(integrationsPagePath, 'utf8');

  assert.ok(code.includes('LinkedIn'), 'Should feature LinkedIn');
  assert.ok(code.includes('Available Now'), 'LinkedIn should be marked Available Now');
  assert.ok(code.includes('Indeed'), 'Should list Indeed');
  assert.ok(code.includes('Glassdoor'), 'Should list Glassdoor');
  assert.ok(code.includes('Naukri'), 'Should list Naukri');
  assert.ok(code.includes('Wellfound'), 'Should list Wellfound');
});

test('SecurityPage details verifiable technical controls without false certifications', () => {
  const securityPagePath = path.join(projectRoot, 'frontend/src/pages/SecurityPage.tsx');
  assert.ok(fs.existsSync(securityPagePath), 'SecurityPage.tsx should exist');
  const code = fs.readFileSync(securityPagePath, 'utf8');

  assert.ok(code.includes('Supabase Auth'), 'Should mention Supabase Auth');
  assert.ok(code.includes('PostgreSQL'), 'Should mention PostgreSQL');
  assert.ok(code.includes('Human Review Gate'), 'Should mention Human Review Gate');
  assert.ok(!code.includes('SOC 2 Type II Certified') && !code.includes('ISO 27001 Certified'), 'Should not make false ISO/SOC2 claims');
});

test('LandingPage FAQ section contains 8 expandable items with accessible disclosure controls', () => {
  const landingPagePath = path.join(projectRoot, 'frontend/src/pages/LandingPage.tsx');
  const code = fs.readFileSync(landingPagePath, 'utf8');

  assert.ok(code.includes('id="faq"'), 'LandingPage must contain #faq section');
  assert.ok(code.includes('landing-faq-accordion'), 'Must use landing-faq-accordion');
  assert.ok(code.includes('What is RolePilot, and how does it work?'), 'FAQ 1 present');
  assert.ok(code.includes('Is RolePilot free to use?'), 'FAQ 2 present');
  assert.ok(code.includes('Which job platform does RolePilot currently support?'), 'FAQ 3 present');
  assert.ok(code.includes('How does profile readiness evaluation work?'), 'FAQ 4 present');
  assert.ok(code.includes('Does RolePilot submit applications automatically?'), 'FAQ 5 present');
  assert.ok(code.includes('Do I review application information before submission?'), 'FAQ 6 present');
  assert.ok(code.includes('How does RolePilot handle my personal data and resume?'), 'FAQ 7 present');
  assert.ok(code.includes('How can I report a bug or share feedback?'), 'FAQ 8 present');
  assert.ok(code.includes('aria-expanded'), 'Must use aria-expanded for accordion triggers');
});

test('PublicFooter organizes links into 3 compact categories without affiliate/changelog/roadmap', () => {
  const footerPath = path.join(projectRoot, 'frontend/src/components/common/PublicFooter.tsx');
  const code = fs.readFileSync(footerPath, 'utf8');

  assert.ok(code.includes('Product'), 'Should contain Product group');
  assert.ok(code.includes('Company & Info'), 'Should contain Company & Info group');
  assert.ok(code.includes('Legal & Support'), 'Should contain Legal & Support group');
  assert.ok(!code.includes('/affiliate'), 'Must not link to /affiliate');
  assert.ok(!code.includes('/changelog'), 'Must not link to /changelog');
  assert.ok(!code.includes('/roadmap'), 'Must not link to /roadmap');
});

test('App.tsx registers and routes all public website expansion pages', () => {
  const appPath = path.join(projectRoot, 'frontend/src/App.tsx');
  const code = fs.readFileSync(appPath, 'utf8');

  const requiredRoutes = [
    '/contact',
    '/pricing',
    '/careers',
    '/accessibility',
    '/features',
    '/integrations',
    '/security',
    '/guides',
  ];

  for (const route of requiredRoutes) {
    assert.ok(code.includes(`'${route}'`), `PUBLIC_ROUTES must include ${route}`);
    assert.ok(code.includes(`currentPath === '${route}'`), `AppContent must render page for ${route}`);
  }
});

test('sitemap.xml and robots.txt include all website expansion routes', () => {
  const sitemapPath = path.join(projectRoot, 'frontend/public/sitemap.xml');
  const robotsPath = path.join(projectRoot, 'frontend/public/robots.txt');
  const sitemapCode = fs.readFileSync(sitemapPath, 'utf8');
  const robotsCode = fs.readFileSync(robotsPath, 'utf8');

  const expandedPages = ['contact', 'pricing', 'careers', 'accessibility', 'features', 'integrations', 'security', 'guides'];
  for (const p of expandedPages) {
    assert.ok(sitemapCode.includes(`/${p}`), `sitemap.xml must include /${p}`);
    assert.ok(robotsCode.includes(`Allow: /${p}`), `robots.txt must allow /${p}`);
  }
});
