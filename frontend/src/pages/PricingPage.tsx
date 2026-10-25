import React, { useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  LogIn,
  CheckCircle2,
  MessageSquare,
  Gift,
} from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import type { ContactPageProps } from './ContactPage';
import '../components/auth/auth.css';

export const PricingPage: React.FC<ContactPageProps> = ({
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
    document.title = 'Pricing — RolePilot (Free to Use)';
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
        <article className="info-card" style={{ textAlign: 'center', padding: '48px 36px' }}>
          <div className="landing-hero-badge" style={{ margin: '0 auto 16px' }}>
            <Gift size={14} color="#1769E8" />
            <span>Transparent Community Access</span>
          </div>

          <h1 className="info-title" style={{ maxWidth: '720px', margin: '0 auto 16px' }}>
            Career tools should be accessible. Start with RolePilot for free.
          </h1>

          <p className="info-subtitle" style={{ maxWidth: '640px', margin: '0 auto 36px', fontSize: '1.1rem' }}>
            RolePilot is currently free to use. Explore the platform, share your feedback, and help us build a better career-search experience.
          </p>

          {/* Pricing Highlight Box */}
          <div
            style={{
              maxWidth: '540px',
              margin: '0 auto 36px',
              padding: '36px',
              borderRadius: '16px',
              border: '2px solid #BFDBFE',
              backgroundColor: '#F8FAFC',
              boxShadow: '0 8px 24px -4px rgba(23, 105, 232, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#101A3A', fontWeight: 800 }}>Early Access Plan</h2>
                <span style={{ fontSize: '0.85rem', color: '#64748B' }}>Full platform capabilities included</span>
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1769E8' }}>$0</div>
            </div>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.925rem', color: '#334155' }}>
                <CheckCircle2 size={18} color="#16A34A" />
                <span>Complete candidate profile &amp; skills inventory</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.925rem', color: '#334155' }}>
                <CheckCircle2 size={18} color="#16A34A" />
                <span>Objective qualification readiness scoring (0–100%)</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.925rem', color: '#334155' }}>
                <CheckCircle2 size={18} color="#16A34A" />
                <span>LinkedIn opportunity discovery &amp; Easy Apply form staging</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.925rem', color: '#334155' }}>
                <CheckCircle2 size={18} color="#16A34A" />
                <span>Mandatory human-in-the-loop review gate on all applications</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.925rem', color: '#334155' }}>
                <CheckCircle2 size={18} color="#16A34A" />
                <span>Centralized multi-stage pipeline tracking &amp; audit history</span>
              </li>
            </ul>

            <button
              type="button"
              onClick={onNavigateSignup}
              className="landing-btn-hero-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
            >
              <span>Create Free Account</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Feedback Section */}
          <div
            style={{
              maxWidth: '640px',
              margin: '0 auto',
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: '#101A3A', fontSize: '0.95rem', marginBottom: '4px' }}>
                Have ideas or suggestions for RolePilot?
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B' }}>
                The product is actively evolving based on real candidate needs. Share your thoughts with us.
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateContact}
              className="auth-btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <MessageSquare size={16} />
              <span>Share Feedback</span>
            </button>
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
      />
    </div>
  );
};
