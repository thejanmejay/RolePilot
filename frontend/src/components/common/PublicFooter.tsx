import React from 'react';
import { RolePilotLogo } from './RolePilotLogo';

export interface PublicFooterProps {
  onNavigateHome?: () => void;
  onNavigateAbout?: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateGuidelines?: () => void;
  onNavigateSupport?: () => void;
  onNavigateBlog?: () => void;
  onNavigateFeatures?: () => void;
  onNavigatePricing?: () => void;
  onNavigateCareers?: () => void;
  onNavigateAccessibility?: () => void;
  onNavigateSecurity?: () => void;
  onNavigateIntegrations?: () => void;
  onNavigateContact?: () => void;
  onNavigateLogin?: () => void;
  onNavigateSignup?: () => void;
  isAuthenticated?: boolean;
  onNavigateDashboard?: () => void;
}

export const PublicFooter: React.FC<PublicFooterProps> = ({
  onNavigateHome,
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
  onNavigateLogin,
  onNavigateSignup,
  isAuthenticated,
  onNavigateDashboard,
}) => {
  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, handler?: () => void) => {
    if (handler && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      handler();
    }
  };

  return (
    <footer className="landing-footer" aria-label="Site Footer">
      <div className="landing-footer-container" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Top Grid: Logo & 3 Compact Link Columns */}
        <div
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '32px',
          }}
        >
          {/* Brand Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              className="auth-brand-logo"
              onClick={onNavigateHome}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNavigateHome?.();
                }
              }}
              aria-label="RolePilot Home"
              style={{ cursor: onNavigateHome ? 'pointer' : 'default' }}
            >
              <RolePilotLogo variant="compact" height={32} alt="RolePilot" />
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748B', lineHeight: 1.55, maxWidth: '240px' }}>
              Structured, transparent job search workflows with objective qualification readiness scoring and human review.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              {isAuthenticated && onNavigateDashboard ? (
                <button
                  type="button"
                  onClick={onNavigateDashboard}
                  className="landing-btn-hero-primary"
                  style={{ fontSize: '0.8rem', height: '32px', padding: '0 12px' }}
                >
                  Dashboard &rarr;
                </button>
              ) : (
                <>
                  {onNavigateLogin && (
                    <button
                      type="button"
                      onClick={onNavigateLogin}
                      className="auth-btn-secondary"
                      style={{ fontSize: '0.8rem', height: '32px', padding: '0 12px' }}
                    >
                      Log in
                    </button>
                  )}
                  {onNavigateSignup && (
                    <button
                      type="button"
                      onClick={onNavigateSignup}
                      className="landing-btn-hero-primary"
                      style={{ fontSize: '0.8rem', height: '32px', padding: '0 12px' }}
                    >
                      Get started
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Group 1: Product */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#101A3A', letterSpacing: '0.5px' }}>
              Product
            </div>
            <a
              href="/features"
              className="landing-footer-link"
              onClick={(e) => handleLink(e, onNavigateFeatures)}
            >
              Features
            </a>
            <a
              href="/integrations"
              className="landing-footer-link"
              onClick={(e) => handleLink(e, onNavigateIntegrations)}
            >
              Integrations
            </a>
            <a
              href="/pricing"
              className="landing-footer-link"
              onClick={(e) => handleLink(e, onNavigatePricing)}
            >
              Pricing
            </a>
            <a
              href="/blog"
              className="landing-footer-link"
              onClick={(e) => handleLink(e, onNavigateBlog)}
            >
              User Guides &amp; Blog
            </a>
          </div>

          {/* Group 2: Company & Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#101A3A', letterSpacing: '0.5px' }}>
              Company &amp; Info
            </div>
            <a
              href="/about"
              className="landing-footer-link"
              onClick={(e) => handleLink(e, onNavigateAbout)}
            >
              About
            </a>
            <a
              href="/careers"
              className="landing-footer-link"
              onClick={(e) => handleLink(e, onNavigateCareers)}
            >
              Careers
            </a>
            <a
              href="/security"
              className="landing-footer-link"
              onClick={(e) => handleLink(e, onNavigateSecurity)}
            >
              Security
            </a>
            <a
              href="/accessibility"
              className="landing-footer-link"
              onClick={(e) => handleLink(e, onNavigateAccessibility)}
            >
              Accessibility
            </a>
            <a
              href="/contact"
              className="landing-footer-link"
              onClick={(e) => handleLink(e, onNavigateContact)}
            >
              Contact
            </a>
          </div>

          {/* Group 3: Legal & Support */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#101A3A', letterSpacing: '0.5px' }}>
              Legal &amp; Support
            </div>
            <a
              href="/terms"
              className="landing-footer-link"
              onClick={(e) => handleLink(e, onNavigateTerms)}
            >
              Terms of Use
            </a>
            <a
              href="/privacy"
              className="landing-footer-link"
              onClick={(e) => handleLink(e, onNavigatePrivacy)}
            >
              Privacy Policy
            </a>
            <a
              href="/guidelines"
              className="landing-footer-link"
              onClick={(e) => handleLink(e, onNavigateGuidelines)}
            >
              User Guidelines
            </a>
            <a
              href="/support"
              className="landing-footer-link"
              onClick={(e) => handleLink(e, onNavigateSupport)}
            >
              Help &amp; Support
            </a>
          </div>
        </div>

        {/* Bottom Copyright Row */}
        <div
          style={{
            borderTop: '1px solid #E2E8F0',
            paddingTop: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div className="landing-footer-copyright">
            © {new Date().getFullYear()} RolePilot. All rights reserved.
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
            Assistive job search workflows • Not an employment agency or recruiter
          </div>
        </div>
      </div>
    </footer>
  );
};
