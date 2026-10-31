import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, LogIn, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import type { InfoPageNavigationProps } from './AboutPage';
import '../components/auth/auth.css';

export const TermsPage: React.FC<InfoPageNavigationProps> = ({
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
    document.title = 'Terms of Use — RolePilot';
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
            <div className="landing-section-tag">Legal Terms</div>
            <h1 className="info-title">Terms of Use</h1>
            <p className="info-subtitle">
              Please read these Terms of Use carefully before using the RolePilot platform and workflow services.
            </p>
            <div className="info-warning-box" style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <AlertTriangle size={18} />
                <span>Notice: Pre-Publication Legal Draft</span>
              </div>
              <p>
                This document is a legal draft setting forth platform rules, user responsibilities, and operational disclaimers. It is subject to formal legal review and adaptation for the applicable governing jurisdiction prior to definitive publication.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <section className="info-section">
            <div className="info-section-heading">
              <FileText size={20} color="#0A66C2" />
              <h2>1. Account Eligibility and Security</h2>
            </div>
            <p>
              To access and use RolePilot, you must be of legal age to form a binding contract in your jurisdiction and legally authorized to seek employment in your designated target countries.
            </p>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials, passwords, and active session tokens. You agree to notify RolePilot immediately if you suspect any unauthorized access to or compromise of your account.
            </p>
          </section>

          {/* Section 2 */}
          <section className="info-section">
            <div className="info-section-heading">
              <FileText size={20} color="#0A66C2" />
              <h2>2. Accurate User Information</h2>
            </div>
            <p>
              You represent and warrant that all information you provide to RolePilot—including but not limited to your resume details, educational credentials, employment history, work authorizations, contact methods, and responses to prospective employers—is accurate, truthful, and up-to-date.
            </p>
            <p>
              RolePilot is not liable for any misrepresentations, inaccuracies, or false statements provided by candidates to prospective employers.
            </p>
          </section>

          {/* Section 3 */}
          <section className="info-section">
            <div className="info-section-heading">
              <FileText size={20} color="#0A66C2" />
              <h2>3. Acceptable Use Policy</h2>
            </div>
            <p>
              You agree to use RolePilot solely for legitimate, personal job search purposes. You may not:
            </p>
            <ul className="info-checklist">
              <li>Use the service to engage in automated spamming, high-frequency abusive requests, or distributed scraping.</li>
              <li>Attempt to reverse-engineer, decompile, disable, or circumvent platform rate limits, human-review gates, or security controls.</li>
              <li>Upload malicious code, corrupted files, or materials that infringe upon the intellectual property or privacy rights of any third party.</li>
              <li>Resell, sublicense, or offer RolePilot services as a commercial multi-tenant bureau without explicit authorization.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="info-section">
            <div className="info-section-heading">
              <ShieldCheck size={20} color="#0A66C2" />
              <h2>4. Human Review and Application Approval Gate</h2>
            </div>
            <p>
              RolePilot functions as an assistive workflow companion and job search organizer. It is not an unattended autonomous agent.
            </p>
            <p>
              <strong>Mandatory Human Gate:</strong> Every application response, questionnaire field, resume selection, and submission staged by RolePilot requires explicit review and final approval by the user. You retain complete and ultimate responsibility for reviewing and confirming every submission before it is transmitted to an employer.
            </p>
          </section>

          {/* Section 5 */}
          <section className="info-section">
            <div className="info-section-heading">
              <FileText size={20} color="#0A66C2" />
              <h2>5. Third-Party Platforms and Portals</h2>
            </div>
            <p>
              RolePilot integrates with or interfaces with third-party job boards and career networks, such as LinkedIn, and planned expansions to Indeed, Glassdoor, Naukri, and Wellfound.
            </p>
            <p>
              RolePilot is an independent software tool and is not affiliated with, sponsored by, or endorsed by any of these third-party platforms. Your use of third-party platforms remains subject to each platform&apos;s independent terms of service, policies, and community guidelines. You are solely responsible for ensuring your personal activities comply with those terms.
            </p>
          </section>

          {/* Section 6 */}
          <section className="info-section">
            <div className="info-section-heading">
              <FileText size={20} color="#0A66C2" />
              <h2>6. Service Availability and Modifications</h2>
            </div>
            <p>
              We endeavor to maintain high service reliability, but RolePilot is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. We do not warrant that the service will be uninterrupted, error-free, or continuously compatible with dynamic changes on external job portals.
            </p>
            <p>
              We reserve the right to modify, suspend, or discontinue any feature, endpoint, or platform integration at our discretion with reasonable notice where practicable.
            </p>
          </section>

          {/* Section 7 */}
          <section className="info-section">
            <div className="info-section-heading">
              <FileText size={20} color="#0A66C2" />
              <h2>7. Intellectual Property</h2>
            </div>
            <p>
              You retain all ownership rights to your personal resume documents, professional summaries, work history, and custom answers submitted to the platform.
            </p>
            <p>
              RolePilot and its licensors retain all right, title, and interest in and to the platform, including software code, algorithms, user interface designs, logos, and visual trademarks.
            </p>
          </section>

          {/* Section 8 */}
          <section className="info-section">
            <div className="info-section-heading">
              <FileText size={20} color="#0A66C2" />
              <h2>8. Account Suspension and Termination</h2>
            </div>
            <p>
              You may terminate your account and delete your stored profile data at any time through the in-app account settings.
            </p>
            <p>
              We reserve the right to suspend or terminate your access to RolePilot if you violate these Terms of Use, abuse rate limits, or engage in activities that jeopardize system stability or security.
            </p>
          </section>

          {/* Section 9 */}
          <section className="info-section">
            <div className="info-section-heading">
              <FileText size={20} color="#0A66C2" />
              <h2>9. Express Disclaimer of Hiring Outcomes</h2>
            </div>
            <div className="info-disclaimer-box">
              <p>
                <strong>NO EMPLOYMENT GUARANTEE:</strong> RolePilot is not an employment agency, headhunter, staffing firm, or employer. We do not evaluate candidates on behalf of employers, nor do we influence recruiter hiring decisions.
              </p>
              <p>
                RolePilot makes no representations, warranties, or guarantees—express or implied—regarding interview requests, response rates, employment offers, salary levels, or hiring outcomes resulting from the use of our service.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="info-section">
            <div className="info-section-heading">
              <FileText size={20} color="#0A66C2" />
              <h2>10. Limitation of Liability</h2>
            </div>
            <p>
              To the maximum extent permitted by applicable law, in no event shall RolePilot, its operators, affiliates, or licensors be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, employment opportunities, or goodwill, arising out of or related to your use of or inability to use the platform.
            </p>
          </section>

          {/* Section 11 */}
          <section className="info-section">
            <div className="info-section-heading">
              <FileText size={20} color="#0A66C2" />
              <h2>11. Inquiries and Notice</h2>
            </div>
            <p>
              For questions regarding these Terms of Use or platform policies, please consult our{' '}
              <a
                href="/support"
                onClick={(e) => {
                  if (onNavigateSupport) {
                    e.preventDefault();
                    onNavigateSupport();
                  }
                }}
                style={{ color: '#0A66C2', textDecoration: 'underline' }}
              >
                Help & Support
              </a>{' '}
              page or visit your account settings dashboard.
            </p>
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
