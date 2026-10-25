import React, { useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  LogIn,
  Eye,
  Keyboard,
  Smartphone,
  Contrast,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import type { ContactPageProps } from './ContactPage';
import '../components/auth/auth.css';

export const AccessibilityPage: React.FC<ContactPageProps> = ({
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
    document.title = 'Accessibility Statement & Goals — RolePilot';
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
            <div className="landing-section-tag">Platform Accessibility</div>
            <h1 className="info-title">
              A more accessible career-search experience, for everyone.
            </h1>
            <p className="info-subtitle">
              We&apos;re continuously working to make RolePilot easier to use for people with different needs and abilities. Accessibility is an ongoing responsibility, and user feedback will help us identify and address barriers.
            </p>
          </div>

          {/* Development Focus Areas */}
          <section className="info-section">
            <div className="info-section-heading">
              <Eye size={22} color="#0A66C2" />
              <h2>Our Ongoing Accessibility Priorities</h2>
            </div>
            <p>
              We are actively developing and auditing our interfaces across several key usability dimensions:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '18px' }}>
              <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#101A3A', marginBottom: '8px' }}>
                  <Keyboard size={18} color="#1769E8" />
                  <span>Keyboard Navigation</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  Ensuring all menus, forms, accordion disclosures, and interactive application controls can be operated via standard keyboard controls without traps.
                </p>
              </div>

              <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#101A3A', marginBottom: '8px' }}>
                  <Contrast size={18} color="#1769E8" />
                  <span>Color Contrast &amp; Typography</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  Maintaining readable text contrast ratios against backgrounds, distinct focus outlines, and legible typography scales across components.
                </p>
              </div>

              <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#101A3A', marginBottom: '8px' }}>
                  <Smartphone size={18} color="#1769E8" />
                  <span>Responsive Layouts &amp; Zoom</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  Supporting page zoom up to 200% without horizontal clipping, and providing flexible multi-column to single-column reflow on mobile viewports.
                </p>
              </div>

              <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#101A3A', marginBottom: '8px' }}>
                  <Eye size={18} color="#1769E8" />
                  <span>Screen-Reader Semantics</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  Applying semantic HTML5 landmarks, clear form input labels, aria-expanded states for collapsible content, and descriptive button text.
                </p>
              </div>
            </div>
          </section>

          {/* Transparent Disclaimer */}
          <section className="info-section">
            <div className="info-section-heading">
              <ShieldAlert size={22} color="#0A66C2" />
              <h2>Honest Representation of Compliance</h2>
            </div>
            <div className="info-disclaimer-box">
              <p>
                <strong>Development Goals, Not Audited Certification:</strong> The features listed above represent our active technical roadmap and engineering design principles. RolePilot does not claim formal third-party WCAG certification or complete accessibility compliance at this early stage. We treat accessibility as an iterative, continuous duty.
              </p>
            </div>
          </section>

          {/* Feedback & Reporting Barriers */}
          <section className="info-section">
            <div
              style={{
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#1E40AF', fontWeight: 700 }}>
                  Encountered an accessibility barrier?
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.55 }}>
                  Please let us know. Specify the page URL, assistive technology used, and the difficulty encountered so we can address it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onNavigateContact) onNavigateContact();
                  else window.location.href = '/contact?topic=Accessibility%20Barrier';
                }}
                className="landing-btn-hero-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                <MessageSquare size={16} />
                <span>Report an Accessibility Barrier</span>
              </button>
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
