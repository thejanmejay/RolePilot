import React, { useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  LogIn,
  HeartHandshake,
  Compass,
  Briefcase,
} from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import type { ContactPageProps } from './ContactPage';
import '../components/auth/auth.css';

export const CareersPage: React.FC<ContactPageProps> = ({
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
  isAuthenticated,
  onNavigateDashboard,
}) => {
  useEffect(() => {
    document.title = 'Careers — RolePilot';
  }, []);

  return (
    <div className="landing-wrapper">
      {/* Header */}
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

      {/* Main Content */}
      <main className="info-page-container">
        <article className="info-card">
          <div className="info-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <span className="landing-section-tag">RolePilot Careers</span>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: '#F1F5F9',
                  color: '#475569',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  border: '1px solid #CBD5E1',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Briefcase size={13} />
                <span>Not hiring at the moment</span>
              </span>
            </div>
            <h1 className="info-title">
              We&apos;re building something different. Our team will grow when the work calls for it.
            </h1>
            <p className="info-subtitle">
              RolePilot is in its early development phase, focused on building, testing, and refining our career-tech workflows.
            </p>
          </div>

          {/* Core Philosophy */}
          <section className="info-section">
            <div className="info-section-heading">
              <Compass size={22} color="#0A66C2" />
              <h2>Our Perspective on Work</h2>
            </div>
            <p>
              RolePilot is in its early phase, focused on building and improving the product. We&apos;re not hiring right now.
            </p>
            <p>
              When the time comes to grow the team, we&apos;ll recruit based on the work that needs to be done, the skills required, and the value people can contribute. We aim to offer fair, market-aligned compensation and a respectful working environment where people are treated as contributors, not just resources.
            </p>
            <p>
              We believe good work should matter more than unnecessary hierarchy, and people should be evaluated on their capabilities, contribution, and potential.
            </p>
            <p>
              We&apos;re focused on building the product first. When genuine opportunities open up, we&apos;ll communicate them transparently.
            </p>
          </section>

          {/* Cultural Principles */}
          <section className="info-section">
            <div className="info-section-heading">
              <HeartHandshake size={22} color="#0A66C2" />
              <h2>Values We Stand By</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '16px' }}>
              <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ fontWeight: 700, color: '#101A3A', marginBottom: '6px' }}>Contribution Over Hierarchy</div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  Decisions are driven by technical reality and user feedback rather than organizational posturing.
                </p>
              </div>

              <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ fontWeight: 700, color: '#101A3A', marginBottom: '6px' }}>Respect for People</div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  Candidates and collaborators are human beings with lives, ambitions, and unique situations.
                </p>
              </div>

              <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ fontWeight: 700, color: '#101A3A', marginBottom: '6px' }}>Grounded Transparency</div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  We say what we mean, avoid inflated corporate jargon, and communicate real product capabilities honestly.
                </p>
              </div>
            </div>
          </section>

          {/* Status Note */}
          <div
            style={{
              marginTop: '32px',
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: '#1E40AF', marginBottom: '4px' }}>Want to follow our journey?</div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155' }}>
                Learn how our workflows operate or explore our educational guides.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={onNavigateAbout}
                className="auth-btn-secondary"
                style={{ fontSize: '0.875rem' }}
              >
                <span>About RolePilot</span>
              </button>
              <button
                type="button"
                onClick={onNavigateHome}
                className="landing-btn-hero-primary"
                style={{ fontSize: '0.875rem', height: '38px', padding: '0 16px' }}
              >
                <span>Return Home</span>
              </button>
            </div>
          </div>
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
        isAuthenticated={isAuthenticated}
        onNavigateDashboard={onNavigateDashboard}
      />
    </div>
  );
};
