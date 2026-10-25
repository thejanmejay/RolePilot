import React, { useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  LogIn,
  CheckCircle2,
  Clock,
  BookOpen,
} from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import type { ContactPageProps } from './ContactPage';
import '../components/auth/auth.css';

export const IntegrationsPage: React.FC<ContactPageProps> = ({
  onNavigateHome,
  onNavigateLogin,
  onNavigateSignup,
  onNavigateAbout,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateGuidelines,
  onNavigateSupport,
  onNavigateBlog,
  onNavigateFeatures,
  onNavigatePricing,
  onNavigateCareers,
  onNavigateAccessibility,
  onNavigateSecurity,
  onNavigateIntegrations,
  onNavigateContact,
}) => {
  useEffect(() => {
    document.title = 'Supported Integrations & Job Platforms — RolePilot';
  }, []);

  return (
    <div className="landing-wrapper">
      {/* Header */}
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

      {/* Main Content */}
      <main className="info-page-container">
        <article className="info-card">
          <div className="info-header">
            <div className="landing-section-tag">Platform Ecosystem</div>
            <h1 className="info-title">Supported Integrations &amp; Job Networks</h1>
            <p className="info-subtitle">
              RolePilot connects your structured candidate profile with modern hiring portals. Transparent information on current platform support, technical boundaries, and future plans.
            </p>
          </div>

          {/* Active Platform: LinkedIn */}
          <section className="info-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.45rem', color: '#101A3A' }}>Currently Supported Platform</h2>
              <span
                style={{
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  border: '1px solid #BBF7D0',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <CheckCircle2 size={14} /> Available Now
              </span>
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '2px solid #BFDBFE',
                borderRadius: '16px',
                padding: '28px 32px',
                boxShadow: '0 4px 20px -2px rgba(23, 105, 232, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#101A3A' }}>LinkedIn Integration</div>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateBlog) onNavigateBlog();
                    else window.location.href = '/blog/using-the-linkedin-integration';
                  }}
                  className="auth-btn-secondary"
                  style={{ fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <BookOpen size={14} />
                  <span>View Setup &amp; Safety Guide</span>
                </button>
              </div>

              <p style={{ fontSize: '0.95rem', color: '#334155', lineHeight: 1.6, margin: '0 0 16px' }}>
                LinkedIn is currently the <strong>only active platform</strong> supported by RolePilot. Our browser-based session integration connects with LinkedIn Easy Apply to discover relevant roles, evaluate candidate readiness, and pre-populate questionnaire answers for candidate confirmation.
              </p>

              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#101A3A', margin: '16px 0 8px' }}>Supported Features:</h4>
              <ul className="info-checklist" style={{ marginBottom: '16px' }}>
                <li>
                  <CheckCircle2 size={16} color="#16A34A" />
                  <span>Keyword-based and location-filtered job card discovery</span>
                </li>
                <li>
                  <CheckCircle2 size={16} color="#16A34A" />
                  <span>Extraction of required skills and qualification criteria for readiness auditing</span>
                </li>
                <li>
                  <CheckCircle2 size={16} color="#16A34A" />
                  <span>Pre-staging standardized Easy Apply responses (work authorizations, notice period, compensation)</span>
                </li>
                <li>
                  <CheckCircle2 size={16} color="#16A34A" />
                  <span>Human-like pacing intervals and strict daily execution limits to safeguard candidate accounts</span>
                </li>
              </ul>

              <div className="info-disclaimer-box" style={{ marginTop: '16px' }}>
                <p>
                  <strong>Independent Software Notice:</strong> RolePilot is an independent software tool and is NOT affiliated with, authorized, maintained, sponsored, or endorsed by LinkedIn Corporation or Microsoft Corporation.
                </p>
              </div>
            </div>
          </section>

          {/* Planned Platforms */}
          <section className="info-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.45rem', color: '#101A3A' }}>Planned Job Platforms</h2>
              <span
                style={{
                  backgroundColor: '#F1F5F9',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Clock size={14} /> Roadmap
              </span>
            </div>
            <p style={{ fontSize: '0.95rem', color: '#64748B', lineHeight: 1.6 }}>
              The following platforms are planned for architectural design and development in future releases. They are not currently active or available for automated submission.
            </p>

            <div className="landing-platforms-grid">
              <div className="landing-platform-box">
                <div className="landing-platform-header">
                  <div className="landing-platform-name">Indeed</div>
                  <span className="landing-platform-badge coming-soon">Planned</span>
                </div>
                <p className="landing-platform-desc">
                  Direct job indexing, employer assessment staging, and structured application responses for Indeed employer portals.
                </p>
              </div>

              <div className="landing-platform-box">
                <div className="landing-platform-header">
                  <div className="landing-platform-name">Glassdoor</div>
                  <span className="landing-platform-badge coming-soon">Planned</span>
                </div>
                <p className="landing-platform-desc">
                  Company insights alignment, compensation benchmarks, and structured application dispatch for Glassdoor partner posts.
                </p>
              </div>

              <div className="landing-platform-box">
                <div className="landing-platform-header">
                  <div className="landing-platform-name">Naukri</div>
                  <span className="landing-platform-badge coming-soon">Planned</span>
                </div>
                <p className="landing-platform-desc">
                  Regional qualification mapping, candidate resume refreshing, and application staging tailored for Naukri recruitment workflows.
                </p>
              </div>

              <div className="landing-platform-box">
                <div className="landing-platform-header">
                  <div className="landing-platform-name">Wellfound</div>
                  <span className="landing-platform-badge coming-soon">Planned</span>
                </div>
                <p className="landing-platform-desc">
                  Startup tech role matching, pitch note preparation, and direct founder application staging for high-growth tech ventures.
                </p>
              </div>
            </div>
          </section>
        </article>
      </main>

      {/* Footer */}
      <PublicFooter
        onNavigateHome={onNavigateHome}
        onNavigateAbout={onNavigateAbout}
        onNavigateTerms={onNavigateTerms}
        onNavigatePrivacy={onNavigatePrivacy}
        onNavigateGuidelines={onNavigateGuidelines}
        onNavigateSupport={onNavigateSupport}
        onNavigateBlog={onNavigateBlog}
        onNavigateFeatures={onNavigateFeatures}
        onNavigatePricing={onNavigatePricing}
        onNavigateCareers={onNavigateCareers}
        onNavigateAccessibility={onNavigateAccessibility}
        onNavigateSecurity={onNavigateSecurity}
        onNavigateIntegrations={onNavigateIntegrations}
        onNavigateContact={onNavigateContact}
        onNavigateLogin={onNavigateLogin}
        onNavigateSignup={onNavigateSignup}
      />
    </div>
  );
};
