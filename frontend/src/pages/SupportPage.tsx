import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, LogIn, HelpCircle, BookOpen, Compass, ShieldCheck, MessageSquare } from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import type { InfoPageNavigationProps } from './AboutPage';
import '../components/auth/auth.css';

export const SupportPage: React.FC<InfoPageNavigationProps> = ({
  onNavigateHome,
  onNavigateLogin,
  onNavigateSignup,
  onNavigateAbout,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateGuidelines,
  onNavigateSupport,
  onNavigateBlog,
  onNavigateContact,
  isAuthenticated,
  onNavigateDashboard,
}) => {
  useEffect(() => {
    document.title = 'Help & Support — RolePilot';
  }, []);

  return (
    <div className="landing-wrapper">
      <header className="landing-header">
        <div className="landing-header-container">
          <div
            onClick={isAuthenticated && onNavigateDashboard ? onNavigateDashboard : onNavigateHome}
            className="auth-brand-logo"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (isAuthenticated && onNavigateDashboard) {
                  onNavigateDashboard();
                } else {
                  onNavigateHome();
                }
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
            {isAuthenticated && onNavigateDashboard ? (
              <button
                type="button"
                onClick={onNavigateDashboard}
                className="landing-btn-hero-primary landing-header-cta-btn"
                aria-label="Go to your RolePilot dashboard"
              >
                <span>Dashboard</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </header>

      <main className="info-page-container">
        <article className="info-card">
          <div className="info-header">
            <div className="landing-section-tag">RolePilot Support</div>
            <h1 className="info-title">Help &amp; Support — Coming Soon</h1>
            <p className="info-subtitle">
              Our dedicated self-service knowledge base, interactive troubleshooting guides, and help center are currently under active development.
            </p>
          </div>

          <section className="info-section">
            <div className="info-section-heading">
              <HelpCircle size={22} color="#0A66C2" />
              <h2>What to Expect</h2>
            </div>
            <p>
              We are preparing comprehensive documentation covering setup steps, candidate profile optimization, automation run configuration, and troubleshooting for supported job platforms.
            </p>
          </section>

          <section className="info-section">
            <div className="info-section-heading">
              <Compass size={22} color="#0A66C2" />
              <h2>Useful Next Steps</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '16px' }}>
              <div
                style={{
                  padding: '20px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#101A3A' }}>
                  <BookOpen size={18} color="#0A66C2" />
                  <span>Review User Guidelines</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.5 }}>
                  Learn how to structure your resume data, evaluate readiness scores, and safely navigate human review gates.
                </p>
                <a
                  href="/guidelines"
                  onClick={(e) => {
                    if (onNavigateGuidelines) {
                      e.preventDefault();
                      onNavigateGuidelines();
                    }
                  }}
                  style={{ color: '#0A66C2', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', marginTop: '4px' }}
                >
                  View User Guidelines &rarr;
                </a>
              </div>

              <div
                style={{
                  padding: '20px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#101A3A' }}>
                  <ShieldCheck size={18} color="#0A66C2" />
                  <span>Learn About RolePilot</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.5 }}>
                  Explore how RolePilot stages application answers, verifies candidate qualifications, and organizes pipelines.
                </p>
                <a
                  href="/about"
                  onClick={(e) => {
                    if (onNavigateAbout) {
                      e.preventDefault();
                      onNavigateAbout();
                    }
                  }}
                  style={{ color: '#0A66C2', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', marginTop: '4px' }}
                >
                  Read About RolePilot &rarr;
                </a>
              </div>

              <div
                style={{
                  padding: '20px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#101A3A' }}>
                  <MessageSquare size={18} color="#0A66C2" />
                  <span>Account Deletion &amp; Support</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.5 }}>
                  Need help with an accidental deletion, account recreation, or email reservation release? Reach out directly via our Contact form — no login required.
                </p>
                <a
                  href="/contact"
                  onClick={(e) => {
                    if (onNavigateContact) {
                      e.preventDefault();
                      onNavigateContact();
                    }
                  }}
                  style={{ color: '#0A66C2', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', marginTop: '4px' }}
                >
                  Contact Support &rarr;
                </a>
              </div>
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
        isAuthenticated={isAuthenticated}
        onNavigateDashboard={onNavigateDashboard}
      />
    </div>
  );
};
