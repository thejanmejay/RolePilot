import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, LogIn, Shield, Database, Lock, UserCheck, AlertTriangle } from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import type { InfoPageNavigationProps } from './AboutPage';
import '../components/auth/auth.css';

export const PrivacyPage: React.FC<InfoPageNavigationProps> = ({
  onNavigateHome,
  onNavigateLogin,
  onNavigateSignup,
  onNavigateAbout,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateGuidelines,
  onNavigateSupport,
  onNavigateBlog,
}) => {
  useEffect(() => {
    document.title = 'Privacy Policy — RolePilot';
  }, []);

  return (
    <div className="landing-wrapper">
      <header className="landing-header">
        <div className="landing-header-container">
          <div
            onClick={onNavigateHome}
            className="auth-brand-logo"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigateHome();
              }
            }}
            aria-label="RolePilot Home"
          >
            <RolePilotLogo variant="compact" height={36} alt="RolePilot" />
          </div>

          <div className="landing-header-actions">
            <button
              type="button"
              onClick={onNavigateHome}
              className="auth-back-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={16} />
              <span>Back to home</span>
            </button>
            <button
              type="button"
              onClick={onNavigateLogin}
              className="auth-btn-secondary landing-header-login-btn"
            >
              <LogIn size={16} />
              <span>Log in</span>
            </button>
            <button
              type="button"
              onClick={onNavigateSignup}
              className="landing-btn-hero-primary landing-header-cta-btn"
            >
              <span>Get started</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="info-page-container">
        <article className="info-card">
          <div className="info-header">
            <div className="landing-section-tag">Data & Privacy</div>
            <h1 className="info-title">Privacy Policy</h1>
            <p className="info-subtitle">
              How RolePilot collects, processes, stores, and protects candidate information across our application.
            </p>
            <div className="info-warning-box" style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <AlertTriangle size={18} />
                <span>Notice: Pre-Publication Privacy Draft</span>
              </div>
              <p>
                This document is a technical draft detailing actual data collection and operational handling based on RolePilot&apos;s existing architecture. It is subject to formal privacy and legal review before finalized publication.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <section className="info-section">
            <div className="info-section-heading">
              <Database size={20} color="#0A66C2" />
              <h2>1. Information We Collect</h2>
            </div>
            <p>
              RolePilot collects only the information necessary to provide candidate readiness audits, application preparation, and workflow tracking:
            </p>
            <ul className="info-checklist">
              <li>
                <strong>Account Details:</strong> Email address, encrypted authentication credentials managed via Supabase Auth, unique user identifier, and platform policy consent records with timestamps.
              </li>
              <li>
                <strong>Profile & Resume Information:</strong> Full name, professional headline, contact phone/location, work history entries, educational background, core skills inventory, uploaded PDF resume documents, and parsed text representations.
              </li>
              <li>
                <strong>Job-Search Preferences:</strong> Target job titles, preferred geographical locations, minimum salary expectations, remote/hybrid preferences, and notice periods.
              </li>
              <li>
                <strong>Application Records:</strong> Target job descriptions, candidate readiness scores, pre-staged questionnaire answers, application status stages (Discovered, Staged, Applied, Interviewing, Offer, Rejected), and user review logs.
              </li>
              <li>
                <strong>Technical Diagnostics:</strong> Client-side error telemetry, HTTP response status codes, and browser session states to maintain session continuity and resolve technical bugs.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="info-section">
            <div className="info-section-heading">
              <Lock size={20} color="#0A66C2" />
              <h2>2. How Your Information Is Used</h2>
            </div>
            <p>We use candidate data strictly for operational application features:</p>
            <ul className="info-checklist">
              <li>To evaluate profile readiness against target job descriptions and identify missing qualifications or skills.</li>
              <li>To prepare and pre-fill standardized application questionnaires for explicit human review and confirmation.</li>
              <li>To organize and maintain your unified job tracking dashboard and automation run logs.</li>
              <li>To authenticate your session, enforce platform policy acceptance, and protect account security.</li>
            </ul>
            <p>
              We do not sell, rent, or trade your personal information, resumes, or search preferences to third-party data brokers, marketers, or advertisers.
            </p>
          </section>

          {/* Section 3 */}
          <section className="info-section">
            <div className="info-section-heading">
              <Shield size={20} color="#0A66C2" />
              <h2>3. Data Storage, Providers, and Infrastructure</h2>
            </div>
            <p>
              RolePilot uses reputable cloud infrastructure providers to host and secure application services:
            </p>
            <ul className="info-checklist">
              <li>
                <strong>Supabase:</strong> Manages user authentication, session tokens, and relational PostgreSQL database storage.
              </li>
              <li>
                <strong>Render:</strong> Hosts the backend API application services and manages scheduled worker pipelines.
              </li>
              <li>
                <strong>Vercel:</strong> Delivers the frontend static web application and assets.
              </li>
            </ul>
            <p>
              Authentication tokens are stored locally in browser storage (localStorage) for active user sessions. When you log out, local storage tokens and cached session data are immediately purged from your browser.
            </p>
          </section>

          {/* Section 4 */}
          <section className="info-section">
            <div className="info-section-heading">
              <UserCheck size={20} color="#0A66C2" />
              <h2>4. Third-Party Job Platforms</h2>
            </div>
            <p>
              RolePilot provides automation and staging workflows that interface with external job networks (currently LinkedIn, with planned expansions to Indeed, Glassdoor, Naukri, and Wellfound).
            </p>
            <p>
              Information transmitted to external employers (such as your submitted resume or contact answers) is submitted only when you explicitly confirm the action. Once submitted, that data is governed by the receiving employer&apos;s and job platform&apos;s respective privacy policies.
            </p>
          </section>

          {/* Section 5 */}
          <section className="info-section">
            <div className="info-section-heading">
              <Shield size={20} color="#0A66C2" />
              <h2>5. Data Retention and Account Deletion</h2>
            </div>
            <p>
              We retain candidate profile information, resumes, and application records for as long as your account remains active so you can track ongoing job searches across interview cycles.
            </p>
            <p>
              <strong>Your Right to Deletion:</strong> You have full control over your data. You may update or remove individual resumes, skills, or job records directly in your dashboard. You may also request complete account deletion at any time via the in-app settings or account deletion endpoint (<code>DELETE /api/v1/account</code>), which permanently purges your candidate profile, uploaded resumes, and application logs from the active database.
            </p>
          </section>

          {/* Section 6 */}
          <section className="info-section">
            <div className="info-section-heading">
              <Shield size={20} color="#0A66C2" />
              <h2>6. User Privacy Rights</h2>
            </div>
            <p>Depending on your jurisdiction, you may hold rights to:</p>
            <ul className="info-checklist">
              <li>Access the personal data RolePilot maintains about you.</li>
              <li>Rectify inaccurate or outdated profile and resume information.</li>
              <li>Export or download your structured profile data.</li>
              <li>Request the complete deletion of your account and related records.</li>
            </ul>
            <p>
              To exercise any of these rights, visit your profile and settings dashboard or consult our{' '}
              <a
                href="/support"
                onClick={(e) => {
                  if (onNavigateSupport) {
                    e.preventDefault();
                    onNavigateSupport();
                  }
                }}
                style={{ color: '#0A66C2', textDecoration: 'underline' }}
              >
                Help & Support
              </a>{' '}
              page.
            </p>
          </section>
        </article>
      </main>

      <PublicFooter
        onNavigateHome={onNavigateHome}
        onNavigateAbout={onNavigateAbout}
        onNavigateTerms={onNavigateTerms}
        onNavigatePrivacy={onNavigatePrivacy}
        onNavigateGuidelines={onNavigateGuidelines}
        onNavigateSupport={onNavigateSupport}
        onNavigateBlog={onNavigateBlog}
        onNavigateLogin={onNavigateLogin}
        onNavigateSignup={onNavigateSignup}
      />
    </div>
  );
};
