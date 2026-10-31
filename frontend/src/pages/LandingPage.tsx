import React, { useState, useEffect } from 'react';
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
  ChevronDown,
} from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import { ExtensionPromotion } from '../components/extension/ExtensionPromotion';
import { useNavigation } from '../context/NavigationContext';
import '../components/auth/auth.css';

interface LandingPageProps {
  onNavigateSignup: () => void;
  onNavigateLogin: () => void;
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
  isAuthenticated?: boolean;
  onNavigateDashboard?: () => void;
}

const FAQ_ITEMS = [
  {
    question: 'What is RolePilot, and how does it work?',
    answer:
      'RolePilot is an assistive career workspace designed to help candidates organize applications, evaluate profile readiness, stage structured responses, and track interview progress from a single dashboard.',
  },
  {
    question: 'Is RolePilot free to use?',
    answer:
      'Yes, RolePilot is completely free to use. All core application-organization tools, profile readiness scoring, and tracking workflows are available without subscription tiers, trial periods, or credit card requirements.',
  },
  {
    question: 'Which job platform does RolePilot currently support?',
    answer:
      'RolePilot currently integrates with LinkedIn for job search discovery, qualification audits, and Easy Apply application staging. Support for additional platforms including Indeed, Glassdoor, Naukri, and Wellfound is in active development.',
  },
  {
    question: 'How does profile readiness evaluation work?',
    answer:
      'Profile readiness audits your active resume, verified technical skills, and background criteria against target job descriptions, generating an objective 0–100% readiness score with actionable tips before you apply.',
  },
  {
    question: 'Does RolePilot submit applications automatically?',
    answer:
      'No. RolePilot does not perform blind or autonomous submissions. We believe candidate control is paramount; all actions require human review.',
  },
  {
    question: 'Do I review application information before submission?',
    answer:
      'Yes. RolePilot enforces a mandatory Human Review Gate across all workflows. You inspect and confirm every staged answer, attached document, and role detail prior to final submission.',
  },
  {
    question: 'How does RolePilot handle my personal data and resume?',
    answer:
      'Your resume and profile credentials are securely stored using industry-standard encrypted PostgreSQL and Supabase Authentication. Your data is used exclusively for your own job search, never sold to recruiters, and can be exported or permanently deleted at any time.',
  },
  {
    question: 'How can I report a bug or share feedback?',
    answer:
      'You can reach us through our Contact page at /contact or by submitting feedback on our designated Google Form. Our team reviews all technical support queries and product suggestions.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateSignup,
  onNavigateLogin,
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
  const { navigate } = useNavigation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'RolePilot — Your Career. Your Next Move.';
  }, []);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  const handleBrandLogoClick = () => {
    if (isAuthenticated && onNavigateDashboard) {
      onNavigateDashboard();
    } else {
      onNavigateSignup();
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="landing-wrapper">
      {/* Top Sticky Header */}
      <header className="landing-header">
        <div className="landing-header-container">
          <div
            onClick={handleBrandLogoClick}
            className="auth-brand-logo"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleBrandLogoClick();
              }
            }}
            aria-label="RolePilot Home"
          >
            <RolePilotLogo variant="compact" height={36} alt="RolePilot — Your Career. Your Next Move." />
          </div>

          {/* Desktop Navigation Links */}
          <nav className="landing-nav-links" aria-label="Main Navigation">
            <a
              href="/resume-checker"
              className="landing-nav-link"
              style={{ color: 'var(--primary)', fontWeight: 600 }}
              onClick={(e) => {
                e.preventDefault();
                navigate('/resume-checker');
              }}
            >
              ATS Checker
            </a>
            <a href="#features" className="landing-nav-link">
              Features
            </a>
            <a href="#integrations" className="landing-nav-link">
              Integrations
            </a>
            <a href="#workflow" className="landing-nav-link">
              Workflow
            </a>
            <a href="#safety" className="landing-nav-link">
              Safety & Control
            </a>
            <a href="#faq" className="landing-nav-link">
              FAQ
            </a>
            {onNavigateBlog && (
              <a
                href="/blog"
                className="landing-nav-link"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateBlog();
                }}
              >
                Guides
              </a>
            )}
          </nav>

          {/* Header Action Buttons */}
          <div className="landing-header-actions">
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
              </>
            )}
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
            <a
              href="/resume-checker"
              className="landing-mobile-nav-link"
              style={{ color: 'var(--primary)', fontWeight: 600 }}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick();
                navigate('/resume-checker');
              }}
            >
              ATS Checker
            </a>
            <a href="#features" className="landing-mobile-nav-link" onClick={handleNavClick}>
              Features
            </a>
            <a href="#integrations" className="landing-mobile-nav-link" onClick={handleNavClick}>
              Integrations
            </a>
            <a href="#workflow" className="landing-mobile-nav-link" onClick={handleNavClick}>
              Workflow
            </a>
            <a href="#safety" className="landing-mobile-nav-link" onClick={handleNavClick}>
              Safety & Control
            </a>
            <a href="#faq" className="landing-mobile-nav-link" onClick={handleNavClick}>
              FAQ
            </a>
            {onNavigateBlog && (
              <a
                href="/blog"
                className="landing-mobile-nav-link"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick();
                  onNavigateBlog();
                }}
              >
                Guides
              </a>
            )}
            <div className="landing-mobile-menu-actions">
              {isAuthenticated && onNavigateDashboard ? (
                <button
                  type="button"
                  onClick={() => {
                    handleNavClick();
                    onNavigateDashboard();
                  }}
                  className="landing-btn-hero-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <>
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
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      {/* 1. Hero Section Container */}
      <section className="landing-card-section landing-hero-card" aria-labelledby="hero-heading">
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

        {/* Realistic Product Workflow Pipeline Preview */}
        <div id="workflow" className="landing-visual-card">
          <div className="visual-mockup-header">
            <div className="visual-window-dots">
              <div className="visual-dot visual-dot-red" />
              <div className="visual-dot visual-dot-yellow" />
              <div className="visual-dot visual-dot-green" />
            </div>
            <span className="visual-mockup-title">
              RolePilot Application &amp; Readiness Workflow (Sample Preview)
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
                <h3 className="workflow-step-title">Profile &amp; Skills Audit</h3>
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
                <h3 className="workflow-step-title">Smart Autofill &amp; Form Prep</h3>
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
                  <span>Real-Time Status &amp; Audit History</span>
                </div>
                <div className="workflow-metric-caption">
                  *Centralized view keeps every application history organized.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Key Capabilities Section Container */}
      <section id="features" className="landing-card-section landing-capabilities-card" aria-labelledby="features-heading">
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
                <span>Missing skills &amp; qualification checks</span>
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

        {/* Human Control Callout inside the capabilities section */}
        <div id="safety" className="landing-control-card">
          <div className="landing-control-icon">
            <ShieldCheck size={26} />
          </div>
          <div className="landing-control-content">
            <h3 className="landing-control-title">
              You remain in complete control
            </h3>
            <p className="landing-control-text">
              RolePilot is designed to organize, simplify, and assist your job search workflow — not run wild without your supervision. Every application is staged for your explicit review and confirmation before submission.
            </p>
            <div className="landing-control-badges">
              <div className="landing-control-badge-item">
                <CheckCircle2 size={16} color="#16A34A" />
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

      {/* 3. Supported Platforms & Integrations Section Container */}
      <section id="integrations" className="landing-card-section landing-platforms-card" aria-labelledby="integrations-heading">
        <div className="landing-section-header">
          <span className="landing-section-tag">Ecosystem &amp; Portals</span>
          <h2 id="integrations-heading" className="landing-section-title">
            Supported Platforms
          </h2>
          <p className="landing-section-subtitle">
            RolePilot bridges your structured profile with major recruitment networks. Starting with LinkedIn automation, with expanded portal support in active development.
          </p>
        </div>

        <div className="landing-platforms-grid">
          {/* LinkedIn - Available Now */}
          <div className="landing-platform-box active">
            <div className="landing-platform-header">
              <div className="landing-platform-name">LinkedIn</div>
              <span className="landing-platform-badge available">Available Now</span>
            </div>
            <p className="landing-platform-desc">
              Discover opportunities, evaluate profile readiness against role criteria, and stage Easy Apply submissions with mandatory human review.
            </p>
          </div>

          {/* Indeed - Coming Soon */}
          <div className="landing-platform-box">
            <div className="landing-platform-header">
              <div className="landing-platform-name">Indeed</div>
              <span className="landing-platform-badge coming-soon">Coming Soon</span>
            </div>
            <p className="landing-platform-desc">
              Direct job listing indexing, employer assessment staging, and structured application responses for Indeed employer portals.
            </p>
          </div>

          {/* Glassdoor - Coming Soon */}
          <div className="landing-platform-box">
            <div className="landing-platform-header">
              <div className="landing-platform-name">Glassdoor</div>
              <span className="landing-platform-badge coming-soon">Coming Soon</span>
            </div>
            <p className="landing-platform-desc">
              Company insights alignment, compensation benchmarks, and structured application dispatch for Glassdoor partner posts.
            </p>
          </div>

          {/* Naukri - Coming Soon */}
          <div className="landing-platform-box">
            <div className="landing-platform-header">
              <div className="landing-platform-name">Naukri</div>
              <span className="landing-platform-badge coming-soon">Coming Soon</span>
            </div>
            <p className="landing-platform-desc">
              Regional qualification mapping, candidate resume refreshing, and application staging tailored for Naukri recruitment workflows.
            </p>
          </div>

          {/* Wellfound - Coming Soon */}
          <div className="landing-platform-box">
            <div className="landing-platform-header">
              <div className="landing-platform-name">Wellfound</div>
              <span className="landing-platform-badge coming-soon">Coming Soon</span>
            </div>
            <p className="landing-platform-desc">
              Startup tech role matching, pitch note preparation, and direct founder application staging for high-growth tech ventures.
            </p>
          </div>
        </div>
      </section>

      {/* Free ATS Resume Checker Section Container */}
      <section id="resume-checker" className="landing-card-section landing-resume-checker-card" aria-labelledby="resume-checker-heading">
        <div className="landing-resume-checker-layout">
          <div className="landing-resume-checker-content">
            <span className="landing-resume-checker-eyebrow">Free Career Tool</span>
            <h2 id="resume-checker-heading" className="landing-resume-checker-title">
              Check Your Resume's ATS Pass-Through Rate
            </h2>
            <p className="landing-resume-checker-description">
              Over 75% of resumes are filtered out before reaching a human recruiter. Test your PDF resume against real Applicant Tracking System scoring heuristics — 100% free with no account required.
            </p>
            <ul className="landing-resume-checker-benefits">
              <li><CheckCircle2 size={16} aria-hidden="true" /> Instant Deterministic Score</li>
              <li><CheckCircle2 size={16} aria-hidden="true" /> Keyword Density Audit</li>
              <li><CheckCircle2 size={16} aria-hidden="true" /> Actionable Fixes</li>
            </ul>
            <button
              type="button"
              onClick={() => navigate('/resume-checker')}
              className="landing-btn-hero-primary landing-resume-checker-cta"
            >
              <span>Scan Your Resume Now — Free</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="landing-resume-checker-preview">
            <div className="landing-resume-checker-score">
              <span>92%</span>
            </div>
            <div className="landing-resume-checker-grade">Grade: A (ATS Ready)</div>
            <p className="landing-resume-checker-preview-note">
              Tested against modern enterprise ATS standards.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Frequently Asked Questions Container */}
      <section id="faq" className="landing-card-section landing-faq-card" aria-labelledby="faq-heading">
        <div className="landing-section-header">
          <span className="landing-section-tag">Frequently Asked Questions</span>
          <h2 id="faq-heading" className="landing-section-title">
            Answers to common questions
          </h2>
          <p className="landing-section-subtitle">
            Everything you need to know about RolePilot, how it works, and how we protect your career data.
          </p>
        </div>

        <div className="landing-faq-accordion" role="region" aria-label="Frequently Asked Questions">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openFaqIndex === index;
            const buttonId = `faq-trigger-${index}`;
            const panelId = `faq-panel-${index}`;
            return (
              <div key={index} className={`landing-faq-item ${isOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  id={buttonId}
                  className="landing-faq-trigger"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleFaq(index)}
                >
                  <span className="landing-faq-question">{item.question}</span>
                  <span className="landing-faq-icon" aria-hidden="true">
                    <ChevronDown size={20} />
                  </span>
                </button>
                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="landing-faq-answer"
                  >
                    <p style={{ margin: 0 }}>{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <ExtensionPromotion
        placement="marketing"
        isAuthenticated={isAuthenticated}
        onGetStarted={onNavigateSignup}
        onOpenDashboard={onNavigateDashboard}
      />

      {/* Footer */}
      <PublicFooter
        onNavigateHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
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
