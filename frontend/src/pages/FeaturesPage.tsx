import React, { useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  LogIn,
  Sliders,
  Sparkles,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileCheck,
  BookOpen,
} from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import type { ContactPageProps } from './ContactPage';
import '../components/auth/auth.css';

export const FeaturesPage: React.FC<ContactPageProps> = ({
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
    document.title = 'Product Features & Capabilities — RolePilot';
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
            <div className="landing-section-tag">RolePilot Architecture</div>
            <h1 className="info-title">Verified Features &amp; How It Works</h1>
            <p className="info-subtitle">
              RolePilot is an assistive career-technology platform designed to help job seekers organize target opportunities, evaluate profile readiness, stage structured application responses, and track interview progress across portals.
            </p>
          </div>

          {/* Section 1: Available Now */}
          <section className="info-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
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
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={14} /> Available Now
              </span>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#101A3A' }}>Core Operating Capabilities</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginTop: '16px' }}>
              <div style={{ padding: '22px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#101A3A', marginBottom: '8px' }}>
                  <FileCheck size={18} color="#1769E8" />
                  <span>Structured Profile &amp; PDF Resumes</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  Centralized candidate skills inventory, work history entries, verified legal work authorizations, and active PDF resume document storage.
                </p>
              </div>

              <div style={{ padding: '22px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#101A3A', marginBottom: '8px' }}>
                  <Sparkles size={18} color="#1769E8" />
                  <span>Readiness Scoring Engine (0–100%)</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  Evaluates target role criteria against candidate qualifications, calculating objective readiness percentages to prevent wasted applications.
                </p>
              </div>

              <div style={{ padding: '22px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#101A3A', marginBottom: '8px' }}>
                  <Sliders size={18} color="#1769E8" />
                  <span>LinkedIn Easy Apply Staging</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  Browser automation discovering opportunities and pre-filling standard screening answers (work authorization, notice period, compensation).
                </p>
              </div>

              <div style={{ padding: '22px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#101A3A', marginBottom: '8px' }}>
                  <ShieldCheck size={18} color="#16A34A" />
                  <span>Mandatory Human Review Gate</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  Guarantees zero autonomous or blind submissions. Every pre-staged field and resume selection requires explicit candidate confirmation.
                </p>
              </div>

              <div style={{ padding: '22px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#101A3A', marginBottom: '8px' }}>
                  <BarChart3 size={18} color="#1769E8" />
                  <span>Unified Pipeline &amp; Audit Logs</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', lineHeight: 1.55 }}>
                  Multi-stage tracking across Discovered, Staged, Applied, Interviewing, and Offer stages with exact submission timestamps.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: In Development & Planned */}
          <section className="info-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span
                style={{
                  backgroundColor: '#FEF3C7',
                  color: '#B45309',
                  border: '1px solid #FDE68A',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Clock size={14} /> Roadmap
              </span>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#101A3A' }}>In Development &amp; Planned</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginTop: '16px' }}>
              <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <div style={{ fontWeight: 700, color: '#101A3A', marginBottom: '6px' }}>Multi-Resume Version Comparison (In Development)</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B', lineHeight: 1.55 }}>
                  Simultaneously compare qualification readiness scores across different resume versions for a specific opportunity.
                </p>
              </div>

              <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <div style={{ fontWeight: 700, color: '#101A3A', marginBottom: '6px' }}>Expanded Job Portals (Planned)</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B', lineHeight: 1.55 }}>
                  Integration pipelines for Indeed, Glassdoor, Naukri, and Wellfound are in architectural design and will be introduced in future releases.
                </p>
              </div>

              <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <div style={{ fontWeight: 700, color: '#101A3A', marginBottom: '6px' }}>Interview Preparation Workflows (Planned)</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B', lineHeight: 1.55 }}>
                  Interactive company research dossiers and requirement question flashcards based on verified job descriptions.
                </p>
              </div>
            </div>
          </section>

          {/* Action CTAs */}
          <div
            style={{
              marginTop: '36px',
              padding: '28px',
              borderRadius: '14px',
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
              <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', color: '#1E40AF', fontWeight: 800 }}>
                Ready to organize your job search?
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>
                Start free today or explore our step-by-step documentation guides.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={onNavigateBlog}
                className="auth-btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <BookOpen size={16} />
                <span>Read User Guides</span>
              </button>
              <button
                type="button"
                onClick={onNavigateSignup}
                className="landing-btn-hero-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Get Started Free</span>
                <ArrowRight size={16} />
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
