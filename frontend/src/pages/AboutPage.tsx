import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, LogIn, Target, ShieldCheck, FileCheck, CheckCircle2, Sparkles } from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import { AuthorCard } from '../components/blog/AuthorCard';
import { BLOG_AUTHOR } from '../content/blog/author';
import '../components/auth/auth.css';
import '../components/blog/blog.css';

export interface InfoPageNavigationProps {
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
  onNavigateSignup: () => void;
  onNavigateAbout?: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateGuidelines?: () => void;
  onNavigateSupport?: () => void;
  onNavigateBlog?: () => void;
  onNavigateContact?: () => void;
  isAuthenticated?: boolean;
  onNavigateDashboard?: () => void;
}

export const AboutPage: React.FC<InfoPageNavigationProps> = ({
  onNavigateHome,
  onNavigateLogin,
  onNavigateSignup,
  onNavigateAbout,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateGuidelines,
  onNavigateSupport,
  onNavigateBlog,
  isAuthenticated,
  onNavigateDashboard,
}) => {
  useEffect(() => {
    document.title = 'About — RolePilot';
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
            <div className="landing-section-tag">About RolePilot</div>
            <h1 className="info-title">Engineered for Structured, Intentional Job Search Workflows</h1>
            <p className="info-subtitle">
              RolePilot is a career-technology platform designed to help job seekers organize target opportunities, evaluate profile readiness, stage structured application responses, and track interview progress across portals.
            </p>
          </div>

          <section className="info-section">
            <div className="info-section-heading">
              <Target size={22} color="#0A66C2" />
              <h2>Our Core Purpose</h2>
            </div>
            <p>
              Navigating modern recruitment portals often involves repetitive, tedious manual data re-entry, unorganized submission logs, and ambiguous qualification feedback. RolePilot transforms this process into a structured, transparent, and repeatable workflow.
            </p>
            <p>
              By centralizing your structured profile details, core skill inventory, verified PDF resumes, and compensation preferences, RolePilot ensures that application responses are consistent, audited, and pre-staged for your review.
            </p>
          </section>

          <section className="info-section">
            <div className="info-section-heading">
              <FileCheck size={22} color="#0A66C2" />
              <h2>What RolePilot Provides</h2>
            </div>
            <ul className="info-checklist">
              <li>
                <CheckCircle2 size={18} color="#16A34A" />
                <div>
                  <strong>Readiness & Qualification Audits:</strong> Compare candidate profile skills and experience against target job requirements to generate an objective readiness score prior to application.
                </div>
              </li>
              <li>
                <CheckCircle2 size={18} color="#16A34A" />
                <div>
                  <strong>Pre-Staged Application Responses:</strong> Prepare standard portal questions (work authorization, notice period, compensation expectations) from verified candidate background information.
                </div>
              </li>
              <li>
                <CheckCircle2 size={18} color="#16A34A" />
                <div>
                  <strong>Unified Submission Pipeline:</strong> Track every job opportunity from initial discovery and staging through interview rounds and final outcomes in one unified dashboard.
                </div>
              </li>
              <li>
                <CheckCircle2 size={18} color="#16A34A" />
                <div>
                  <strong>Multi-Platform Expansion:</strong> Starting with LinkedIn automation and expanding to platforms such as Indeed, Glassdoor, Naukri, and Wellfound.
                </div>
              </li>
            </ul>
          </section>

          <section className="info-section">
            <div className="info-section-heading">
              <ShieldCheck size={22} color="#0A66C2" />
              <h2>User Responsibility and Boundaries</h2>
            </div>
            <div className="info-disclaimer-box">
              <p>
                <strong>Human-in-the-Loop Requirement:</strong> RolePilot is designed as an assistant and organization tool, not an autonomous agent that acts without candidate awareness. Every application response and submission requires explicit candidate review and final approval.
              </p>
              <p>
                <strong>Accuracy of Information:</strong> Users remain solely responsible for the truthfulness, accuracy, and currency of their resume details, credentials, work authorization representations, and responses submitted to employers.
              </p>
              <p>
                <strong>No Outcome Guarantees:</strong> RolePilot does not act as an employment agency, recruiter, or staffing firm. We do not promise, warrant, or guarantee interviews, job offers, hiring decisions, or employment placement.
              </p>
            </div>
          </section>

          <section className="info-section">
            <div className="info-section-heading">
              <Sparkles size={22} color="#0A66C2" />
              <h2>Product Innovation &amp; Architecture</h2>
            </div>
            <p>
              RolePilot is developed with a strict focus on structured applicant readiness, verifiable candidate credentials, and human-supervised automation.
            </p>
            <AuthorCard author={BLOG_AUTHOR} variant="full" />
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
