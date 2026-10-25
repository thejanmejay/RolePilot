import React, { useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  LogIn,
  Shield,
  Lock,
  Database,
  Trash2,
  UserCheck,
  AlertTriangle,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import type { ContactPageProps } from './ContactPage';
import '../components/auth/auth.css';

export const SecurityPage: React.FC<ContactPageProps> = ({
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
    document.title = 'Security & Trust Center — RolePilot';
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
            <div className="landing-section-tag">Security &amp; Trust</div>
            <h1 className="info-title">Security &amp; Trust Center</h1>
            <p className="info-subtitle">
              How RolePilot handles candidate authentication, protects resume data, manages sessions, and guarantees complete user deletion rights.
            </p>
          </div>

          {/* Core Technical Controls */}
          <section className="info-section">
            <div className="info-section-heading">
              <Shield size={22} color="#0A66C2" />
              <h2>Verifiable Security Architecture</h2>
            </div>
            <p>
              We believe trust is built on verifiable technical implementation rather than exaggerated corporate promises. Here is exactly how our platform handles your data:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginTop: '18px' }}>
              <div style={{ padding: '22px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#101A3A', marginBottom: '8px' }}>
                  <Lock size={18} color="#1769E8" />
                  <span>Authentication &amp; Sessions</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  Authentication is managed via Supabase Auth using encrypted password hashes and short-lived JWT access tokens stored in browser localStorage. Explicit logout purges all tokens immediately.
                </p>
              </div>

              <div style={{ padding: '22px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#101A3A', marginBottom: '8px' }}>
                  <Database size={18} color="#1769E8" />
                  <span>PostgreSQL Database Hosting</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  Candidate profile data, skill inventories, and application records are stored in managed PostgreSQL databases provided by Supabase, with backend APIs hosted on Render.
                </p>
              </div>

              <div style={{ padding: '22px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#101A3A', marginBottom: '8px' }}>
                  <UserCheck size={18} color="#16A34A" />
                  <span>Mandatory Human Review Gate</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  RolePilot enforces a strict Human Review Gate across all automation runs with zero blind or autonomous submissions. Every application field, questionnaire response, and resume attachment requires explicit candidate inspection and approval.
                </p>
              </div>

              <div style={{ padding: '22px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#101A3A', marginBottom: '8px' }}>
                  <Trash2 size={18} color="#DC2626" />
                  <span>Permanent Account Deletion</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  You retain full ownership of your data. You can delete your account at any time via the in-app settings or account deletion API (<code>DELETE /api/v1/account</code>), permanently wiping your data.
                </p>
              </div>
            </div>
          </section>

          {/* Honest Compliance Boundaries */}
          <section className="info-section">
            <div className="info-section-heading">
              <AlertTriangle size={22} color="#D97706" />
              <h2>Honest Representation of Certifications</h2>
            </div>
            <div className="info-disclaimer-box">
              <p>
                <strong>No Unverified Certifications:</strong> RolePilot is an independent career-technology project in active development. We do not claim third-party certifications such as SOC 2 Type II, ISO 27001, or FedRAMP audits at this stage. We protect user data through standard modern web engineering practices and minimal necessary data collection.
              </p>
            </div>
          </section>

          {/* Security Inquiries & Reporting */}
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
                  Reporting Security or Privacy Concerns
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.55 }}>
                  If you discover a vulnerability or have questions about session security, please notify us immediately through our contact form.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onNavigateContact) onNavigateContact();
                  else window.location.href = '/contact?topic=Technical%20Support';
                }}
                className="landing-btn-hero-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                <MessageSquare size={16} />
                <span>Contact Security Team</span>
              </button>
            </div>
          </section>

          {/* Related Legal Links */}
          <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '20px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onNavigatePrivacy}
              className="landing-footer-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <FileText size={14} />
              <span>Read Full Privacy Policy &rarr;</span>
            </button>
            <button
              type="button"
              onClick={onNavigateTerms}
              className="landing-footer-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <FileText size={14} />
              <span>Read Terms of Use &rarr;</span>
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
