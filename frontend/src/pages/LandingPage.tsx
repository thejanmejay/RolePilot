import React from 'react';
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
} from 'lucide-react';
import '../components/auth/auth.css';

interface LandingPageProps {
  onNavigateSignup: () => void;
  onNavigateLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateSignup,
  onNavigateLogin,
}) => {
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
            aria-label="LinkedIn Hunter Home"
          >
            <div className="auth-logo-badge">in</div>
            <span className="auth-brand-name">LinkedIn Hunter</span>
            <span className="auth-brand-pill">Pro</span>
          </div>

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

          <div className="landing-header-actions">
            <button
              type="button"
              onClick={onNavigateLogin}
              className="auth-btn-secondary"
            >
              <LogIn size={16} />
              <span>Log in</span>
            </button>
            <button
              type="button"
              onClick={onNavigateSignup}
              className="landing-btn-hero-primary"
              style={{ height: '40px', padding: '0 18px', fontSize: '0.9rem' }}
            >
              <span>Get started</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero" aria-labelledby="hero-heading">
        <div className="landing-hero-badge">
          <Sparkles size={14} />
          <span>Intelligent Application Assistant for Professionals</span>
        </div>

        <h1 id="hero-heading" className="landing-hero-title">
          Your job search. More focused. Less repetitive.
        </h1>

        <p className="landing-hero-subtitle">
          Organize your job search and simplify repetitive application tasks
          with LinkedIn Hunter.
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

        {/* Tasteful Product Workflow Visualization Graphic */}
        <div id="workflow" className="landing-visual-card">
          <div className="visual-mockup-header">
            <div className="visual-dot visual-dot-red" />
            <div className="visual-dot visual-dot-yellow" />
            <div className="visual-dot visual-dot-green" />
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--auth-text-muted)',
                marginLeft: '8px',
                fontWeight: 500,
              }}
            >
              LinkedIn Hunter Automation & Readiness Pipeline
            </span>
          </div>

          <div className="visual-mockup-content">
            <div className="workflow-steps-grid">
              {/* Step 1 */}
              <div className="workflow-step-box">
                <div className="workflow-step-badge">Stage 1: Readiness</div>
                <div className="workflow-step-title">Profile & Skills Audit</div>
                <p className="workflow-step-desc">
                  Evaluates resume keywords, experience depth, and missing
                  qualifications against target roles.
                </p>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '12px',
                    fontSize: '0.8rem',
                    color: '#16A34A',
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={16} /> 94% Application Ready
                </div>
              </div>

              {/* Step 2 */}
              <div className="workflow-step-box">
                <div className="workflow-step-badge">Stage 2: Precision</div>
                <div className="workflow-step-title">Smart Autofill & Form Prep</div>
                <p className="workflow-step-desc">
                  Generates verified response drafts for repetitive application
                  questions while matching your real data.
                </p>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '12px',
                    fontSize: '0.8rem',
                    color: 'var(--auth-blue)',
                    fontWeight: 600,
                  }}
                >
                  <Sliders size={16} /> Human Review Gate
                </div>
              </div>

              {/* Step 3 */}
              <div className="workflow-step-box">
                <div className="workflow-step-badge">Stage 3: Tracking</div>
                <div className="workflow-step-title">Centralized Pipeline</div>
                <p className="workflow-step-desc">
                  Unified dashboard tracking statuses, submission telemetry, and
                  automation logs without scattered tabs.
                </p>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '12px',
                    fontSize: '0.8rem',
                    color: '#0284C7',
                    fontWeight: 600,
                  }}
                >
                  <BarChart3 size={16} /> Real-Time Telemetry
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
              Engineered specifically for job seekers who want structured,
              organized, and repeatable job application workflows.
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
                Eliminate tedious copy-pasting across repetitive job application
                portals. Prepare and stage structured applications with consistent
                accuracy and verified background details.
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '16px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.825rem',
                  color: 'var(--auth-text-muted)',
                }}
              >
                <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} color="#16A34A" /> Form field intelligent mapping
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} color="#16A34A" /> Automated draft preparation
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
                Measure readiness before applying. Identify missing keywords,
                skill mismatches, and experience gaps against target job
                descriptions so every submission counts.
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '16px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.825rem',
                  color: 'var(--auth-text-muted)',
                }}
              >
                <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} color="#16A34A" /> Comprehensive gap analysis
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} color="#16A34A" /> Tailored readiness score (0-100%)
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
                Track every submission, interview stage, and automation run in one
                clean dashboard. Keep your pipeline organized with timestamps,
                run details, and audit history.
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '16px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.825rem',
                  color: 'var(--auth-text-muted)',
                }}
              >
                <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} color="#16A34A" /> Unified status dashboard
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} color="#16A34A" /> Complete automation run logs
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Human Control & Safety Note Section */}
      <section id="safety" className="landing-control-section" aria-labelledby="safety-heading">
        <div className="landing-control-card">
          <div className="landing-control-icon">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h2 id="safety-heading" className="landing-control-title">
              You remain in complete control
            </h2>
            <p className="landing-control-text">
              LinkedIn Hunter is designed to organize, simplify, and assist your
              job search workflow — not run wild without your supervision. Every
              application is staged for your review and confirmation before
              submission.
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '12px',
                fontSize: '0.825rem',
                color: 'var(--auth-text-muted)',
              }}
            >
              <ShieldAlert size={16} color="var(--auth-blue)" />
              <span>
                <strong>Important note:</strong> LinkedIn Hunter is a productivity
                tool. We do not claim or guarantee interviews, automatic hiring, or
                job placement.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="auth-brand-logo" onClick={onNavigateSignup} style={{ cursor: 'pointer' }}>
            <div className="auth-logo-badge" style={{ width: '26px', height: '26px', fontSize: '0.95rem' }}>
              in
            </div>
            <span className="auth-brand-name" style={{ fontSize: '1rem' }}>
              LinkedIn Hunter
            </span>
            <span className="auth-brand-pill">Pro</span>
          </div>

          <div className="auth-footer-links">
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
            <a href="#safety">Safety</a>
            <button type="button" onClick={onNavigateLogin}>Sign In</button>
            <button type="button" onClick={onNavigateSignup}>Register</button>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--auth-text-subtle)' }}>
            © {new Date().getFullYear()} LinkedIn Hunter V2. Modern job search automation.
          </div>
        </div>
      </footer>
    </div>
  );
};
