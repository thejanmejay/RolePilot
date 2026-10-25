import React, { useState } from 'react';
import {
  ArrowRight,
  LogIn,
  CheckCircle2,
  Sliders,
  Sparkles,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  Check,
  Menu,
  X,
  FileText,
  UserCheck,
  Building2,
  Clock,
} from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import '../components/auth/auth.css';

interface LandingPageProps {
  onNavigateSignup: () => void;
  onNavigateLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateSignup,
  onNavigateLogin,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="landing-wrapper">
      {/* Top Sticky Header */}
      <header className="landing-header">
        <div className="landing-header-container">
          <div
            onClick={onNavigateSignup}
            className="auth-brand-logo"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigateSignup();
              }
            }}
            aria-label="RolePilot Home"
          >
            <RolePilotLogo variant="compact" height={36} alt="RolePilot — Your Career. Your Next Move." />
          </div>

          {/* Desktop Navigation Links */}
          <nav className="landing-nav-links" aria-label="Main Navigation">
            <a href="#features" className="landing-nav-link">
              Features
            </a>
            <a href="#workflow" className="landing-nav-link">
              Workflow
            </a>
            <a href="#safety" className="landing-nav-link">
              Safety & Control
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div className="landing-header-actions">
            <button
              type="button"
              onClick={onNavigateLogin}
              className="auth-btn-secondary landing-header-login-btn"
              aria-label="Log in to your RolePilot account"
            >
              <LogIn size={16} />
              <span>Log in</span>
            </button>
            <button
              type="button"
              onClick={onNavigateSignup}
              className="landing-btn-hero-primary landing-header-cta-btn"
              aria-label="Get started with RolePilot"
            >
              <span>Get started</span>
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="landing-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <nav className="landing-mobile-menu" aria-label="Mobile Navigation">
            <a href="#features" className="landing-mobile-nav-link" onClick={handleNavClick}>
              Features
            </a>
            <a href="#workflow" className="landing-mobile-nav-link" onClick={handleNavClick}>
              Workflow
            </a>
            <a href="#safety" className="landing-mobile-nav-link" onClick={handleNavClick}>
              Safety & Control
            </a>
            <div className="landing-mobile-menu-actions">
              <button
                type="button"
                onClick={() => {
                  handleNavClick();
                  onNavigateLogin();
                }}
                className="auth-btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <LogIn size={16} />
                <span>Log in</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleNavClick();
                  onNavigateSignup();
                }}
                className="landing-btn-hero-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>Get started</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* Hero Section */}
      <section className="landing-hero" aria-labelledby="hero-heading">
        <div className="landing-hero-badge">
          <Sparkles size={14} color="#FFAD18" />
          <span>Your Career. Your Next Move.</span>
        </div>

        <h1 id="hero-heading" className="landing-hero-title">
          Your Career. Your Next Move.
        </h1>

        <p className="landing-hero-subtitle">
          Discover opportunities, streamline applications, evaluate readiness, and manage your job search from one place with RolePilot.
        </p>

        <div className="landing-hero-ctas">
          <button
            type="button"
            onClick={onNavigateSignup}
            className="landing-btn-hero-primary"
            id="hero-get-started-btn"
          >
            <span>Get started</span>
            <ArrowRight size={18} />
          </button>
          <button
            type="button"
            onClick={onNavigateLogin}
            className="landing-btn-hero-secondary"
            id="hero-log-in-btn"
          >
            <LogIn size={18} />
            <span>Log in</span>
          </button>
        </div>

        {/* Realistic Product Workflow Pipeline Preview */}
        <div id="workflow" className="landing-visual-card">
          <div className="visual-mockup-header">
            <div className="visual-window-dots">
              <div className="visual-dot visual-dot-red" />
              <div className="visual-dot visual-dot-yellow" />
              <div className="visual-dot visual-dot-green" />
            </div>
            <span className="visual-mockup-title">
              RolePilot Application & Readiness Workflow (Sample Preview)
            </span>
            <div className="visual-sample-tag">Illustrative Mockup</div>
          </div>

          {/* Sample Target Role Sub-Bar */}
          <div className="visual-target-role-bar">
            <div className="visual-role-info">
              <Building2 size={16} className="visual-role-icon" />
              <div>
                <span className="visual-role-title">Target Opportunity:</span>{' '}
                <strong>Senior Software Engineer</strong> • Stripe (Remote / San Francisco)
              </div>
            </div>
            <div className="visual-role-status">
              <Clock size={14} />
              <span>Staged for Review</span>
            </div>
          </div>

          <div className="visual-mockup-content">
            <div className="workflow-steps-grid">
              {/* Stage 1 */}
              <div className="workflow-step-box">
                <div className="workflow-step-header">
                  <span className="workflow-step-badge">Stage 1: Readiness</span>
                </div>
                <h3 className="workflow-step-title">Profile & Skills Audit</h3>
                <p className="workflow-step-desc">
                  Verifies candidate qualifications, active PDF resume, and core technical skills against target roles.
                </p>

                <div className="workflow-checklist">
                  <div className="workflow-checklist-item">
                    <FileText size={14} color="#16A34A" />
                    <span>Active PDF resume attached</span>
                  </div>
                  <div className="workflow-checklist-item">
                    <Check size={14} color="#16A34A" />
                    <span>8 of 8 core technical skills verified</span>
                  </div>
                  <div className="workflow-checklist-item">
                    <Check size={14} color="#16A34A" />
                    <span>Saved compensation preference</span>
                  </div>
                </div>

                <div className="workflow-status-metric success">
                  <CheckCircle2 size={16} />
                  <span>94% Application Ready (Sample Score)</span>
                </div>
                <div className="workflow-metric-caption">
                  *Illustrative score calculated from candidate profile completeness and verified skills.
                </div>
              </div>

              {/* Stage 2 */}
              <div className="workflow-step-box">
                <div className="workflow-step-header">
                  <span className="workflow-step-badge">Stage 2: Precision</span>
                </div>
                <h3 className="workflow-step-title">Smart Autofill & Form Prep</h3>
                <p className="workflow-step-desc">
                  Pre-stages verified responses for repetitive portal fields using your structured profile data.
                </p>

                <div className="workflow-checklist">
                  <div className="workflow-checklist-item">
                    <Check size={14} color="#1769E8" />
                    <span>Standard portal fields pre-staged</span>
                  </div>
                  <div className="workflow-checklist-item">
                    <UserCheck size={14} color="#1769E8" />
                    <span>Candidate review gate enforced</span>
                  </div>
                  <div className="workflow-checklist-item">
                    <Check size={14} color="#1769E8" />
                    <span>Zero blind or autonomous submissions</span>
                  </div>
                </div>

                <div className="workflow-status-metric primary">
                  <Sliders size={16} />
                  <span>Human Review Gate Required</span>
                </div>
                <div className="workflow-metric-caption">
                  *Applications require explicit confirmation before submission.
                </div>
              </div>

              {/* Stage 3 */}
              <div className="workflow-step-box">
                <div className="workflow-step-header">
                  <span className="workflow-step-badge">Stage 3: Tracking</span>
                </div>
                <h3 className="workflow-step-title">Centralized Pipeline</h3>
                <p className="workflow-step-desc">
                  Unified dashboard tracking statuses, interview stages, and automation run logs in one workspace.
                </p>

                <div className="workflow-checklist">
                  <div className="workflow-checklist-item">
                    <Check size={14} color="#0284C7" />
                    <span>Status: Applied • Interview Scheduled</span>
                  </div>
                  <div className="workflow-checklist-item">
                    <Clock size={14} color="#0284C7" />
                    <span>Timestamped submission history</span>
                  </div>
                  <div className="workflow-checklist-item">
                    <Check size={14} color="#0284C7" />
                    <span>Full automation audit telemetry</span>
                  </div>
                </div>

                <div className="workflow-status-metric info">
                  <BarChart3 size={16} />
                  <span>Real-Time Status & Audit History</span>
                </div>
                <div className="workflow-metric-caption">
                  *Centralized view keeps every application history organized.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section id="features" className="landing-features-section" aria-labelledby="features-heading">
        <div className="landing-section-container">
          <div className="landing-section-header">
            <span className="landing-section-tag">Key Capabilities</span>
            <h2 id="features-heading" className="landing-section-title">
              Built for speed, accuracy, and peace of mind
            </h2>
            <p className="landing-section-subtitle">
              Engineered specifically for job seekers who want structured, organized, and repeatable application workflows.
            </p>
          </div>

          <div className="landing-features-grid">
            {/* Feature 1 */}
            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <Sliders size={22} />
              </div>
              <h3 className="landing-feature-title">
                Streamlined job-application workflows
              </h3>
              <p className="landing-feature-desc">
                Eliminate tedious copy-pasting across repetitive application portals. Prepare and stage structured applications with verified background details and consistent accuracy.
              </p>
              <ul className="landing-feature-list">
                <li>
                  <Check size={14} color="#16A34A" />
                  <span>Structured candidate data staging</span>
                </li>
                <li>
                  <Check size={14} color="#16A34A" />
                  <span>Eliminates repetitive manual data entry</span>
                </li>
                <li>
                  <Check size={14} color="#16A34A" />
                  <span>Prepares draft answers for applicant portals</span>
                </li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <Sparkles size={22} />
              </div>
              <h3 className="landing-feature-title">
                Profile and application readiness
              </h3>
              <p className="landing-feature-desc">
                Evaluate application readiness before applying. Identify missing qualifications, skill mismatches, and experience gaps against target roles so every submission counts.
              </p>
              <ul className="landing-feature-list">
                <li>
                  <Check size={14} color="#16A34A" />
                  <span>Objective readiness score (0–100%)</span>
                </li>
                <li>
                  <Check size={14} color="#16A34A" />
                  <span>Missing skills & qualification checks</span>
                </li>
                <li>
                  <Check size={14} color="#16A34A" />
                  <span>Active PDF resume validation</span>
                </li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <BarChart3 size={22} />
              </div>
              <h3 className="landing-feature-title">
                Application progress and organization
              </h3>
              <p className="landing-feature-desc">
                Track every submission, interview stage, and automation run in one clean dashboard. Keep your pipeline organized with timestamps, run details, and full audit history.
              </p>
              <ul className="landing-feature-list">
                <li>
                  <Check size={14} color="#16A34A" />
                  <span>Unified multi-stage status dashboard</span>
                </li>
                <li>
                  <Check size={14} color="#16A34A" />
                  <span>Complete automation run and error logs</span>
                </li>
                <li>
                  <Check size={14} color="#16A34A" />
                  <span>Clear tracking from applied to offer</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Human Control & Safety Section */}
      <section id="safety" className="landing-control-section" aria-labelledby="safety-heading">
        <div className="landing-control-card">
          <div className="landing-control-icon">
            <ShieldCheck size={26} />
          </div>
          <div className="landing-control-content">
            <h2 id="safety-heading" className="landing-control-title">
              You remain in complete control
            </h2>
            <p className="landing-control-text">
              RolePilot is designed to organize, simplify, and assist your job search workflow — not run wild without your supervision. Every application is staged for your explicit review and confirmation before submission.
            </p>
            <div className="landing-control-badges">
              <div className="landing-control-badge-item">
                <ShieldCheck size={16} color="#16A34A" />
                <span>Human review gate required for all application actions</span>
              </div>
              <div className="landing-control-badge-item disclaimer">
                <ShieldAlert size={16} color="var(--auth-blue)" />
                <span>
                  <strong>Important note:</strong> RolePilot is a career-tech platform. We do not guarantee interviews, hiring, or job placement.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div
            className="auth-brand-logo"
            onClick={onNavigateSignup}
            style={{ cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigateSignup();
              }
            }}
            aria-label="RolePilot Home"
          >
            <RolePilotLogo variant="compact" height={32} alt="RolePilot" />
          </div>

          <div className="landing-footer-links">
            <a href="#features" className="landing-footer-link">Features</a>
            <a href="#workflow" className="landing-footer-link">Workflow</a>
            <a href="#safety" className="landing-footer-link">Safety & Control</a>
            <button type="button" onClick={onNavigateLogin} className="landing-footer-btn">Log in</button>
            <button type="button" onClick={onNavigateSignup} className="landing-footer-btn primary">Get started</button>
          </div>

          <div className="landing-footer-copyright">
            © {new Date().getFullYear()} RolePilot. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
