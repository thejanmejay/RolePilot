import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, LogIn, UserCheck, Shield, KeyRound, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import type { InfoPageNavigationProps } from './AboutPage';
import '../components/auth/auth.css';

export const GuidelinesPage: React.FC<InfoPageNavigationProps> = ({
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
    document.title = 'User Guidelines — RolePilot';
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
            <div className="landing-section-tag">Platform Standards</div>
            <h1 className="info-title">User Guidelines</h1>
            <p className="info-subtitle">
              Best practices and mandatory standards for maintaining integrity, security, and career success on RolePilot.
            </p>
          </div>

          {/* Guideline 1 */}
          <section className="info-section">
            <div className="info-section-heading">
              <UserCheck size={20} color="#0A66C2" />
              <h2>1. Accurate Profile Information</h2>
            </div>
            <p>
              Your candidate profile forms the foundation for qualification scoring and pre-staged application answers. Always provide truthful, accurate, and up-to-date information regarding your work history, titles, dates, educational credentials, and legal work authorizations.
            </p>
            <p>
              Misrepresenting experience or certifications undermines recruiter trust and violates our acceptable use standards.
            </p>
          </section>

          {/* Guideline 2 */}
          <section className="info-section">
            <div className="info-section-heading">
              <Shield size={20} color="#0A66C2" />
              <h2>2. Resume Ownership and Authenticity</h2>
            </div>
            <p>
              You must own or hold explicit authorization to use all resume documents, portfolios, and references uploaded to RolePilot.
            </p>
            <p>
              Do not upload resumes belonging to other individuals or share accounts across multiple candidates. RolePilot accounts are intended strictly for single-individual job search management.
            </p>
          </section>

          {/* Guideline 3 */}
          <section className="info-section">
            <div className="info-section-heading">
              <KeyRound size={20} color="#0A66C2" />
              <h2>3. Credential Security and Account Integrity</h2>
            </div>
            <p>
              Safeguard your authentication credentials with a strong, unique password. Never share login tokens, session strings, or authentication cookies with third parties or unverified browser extensions.
            </p>
            <p>
              When using shared or public workstations, always use the explicit Log Out button to purge session data and browser local storage.
            </p>
          </section>

          {/* Guideline 4 */}
          <section className="info-section">
            <div className="info-section-heading">
              <Sparkles size={20} color="#0A66C2" />
              <h2>4. Responsible Platform Usage and Automation Hygiene</h2>
            </div>
            <p>
              RolePilot is engineered to streamline thoughtful, high-match applications—not indiscriminate mass spamming.
            </p>
            <ul className="info-checklist">
              <li>
                <CheckCircle2 size={16} color="#16A34A" />
                <span>Target opportunities aligned with your actual skillset and readiness score.</span>
              </li>
              <li>
                <CheckCircle2 size={16} color="#16A34A" />
                <span>Respect platform rate limits, human-pacing delays, and daily application quotas.</span>
              </li>
              <li>
                <CheckCircle2 size={16} color="#16A34A" />
                <span>Do not attempt to bypass safety throttles, CAPTCHAs, or portal security checks.</span>
              </li>
            </ul>
          </section>

          {/* Guideline 5 */}
          <section className="info-section">
            <div className="info-section-heading">
              <CheckCircle2 size={20} color="#0A66C2" />
              <h2>5. Reviewing Generated Content & Confirming Submissions</h2>
            </div>
            <p>
              RolePilot pre-populates screening questions based on your profile inventory. However, question phrasing and company-specific requirements vary widely.
            </p>
            <div className="info-disclaimer-box">
              <p>
                <strong>Human Review Gate:</strong> You must always review pre-staged answers, compensation entries, and resume selections before confirming any application submission. Never permit automated dispatch without your explicit inspection.
              </p>
            </div>
          </section>

          {/* Incomplete / Upcoming Sections */}
          <section className="info-section">
            <div className="info-section-heading">
              <Clock size={20} color="#D97706" />
              <h2>6. Community & Multi-Account Guidelines — Coming Soon</h2>
            </div>
            <div className="info-warning-box">
              <p>
                Guidelines for peer networking, community interview sharing, and institutional/university recruiter access are currently being drafted and will be published alongside those features in an upcoming release.
              </p>
            </div>
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
