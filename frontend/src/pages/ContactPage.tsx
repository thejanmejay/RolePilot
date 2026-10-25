import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  LogIn,
  Send,
  ExternalLink,
  AlertCircle,
  Info,
  RotateCcw,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import {
  CONTACT_CONFIG,
  buildPrefilledGoogleFormUrl,
  type ContactTopic,
} from '../config/contactConfig';
import '../components/auth/auth.css';
import '../components/blog/blog.css';

export interface ContactPageProps {
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
  onNavigateSignup: () => void;
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
}

export const ContactPage: React.FC<ContactPageProps> = ({
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<ContactTopic>('General Inquiry');
  const [message, setMessage] = useState('');

  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    topic?: string;
    message?: string;
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openedGoogleFormUrl, setOpenedGoogleFormUrl] = useState<string | null>(null);
  const [isConfirmedSent, setIsConfirmedSent] = useState(false);

  useEffect(() => {
    document.title = 'Contact Support & Feedback — RolePilot';

    // Check URL query parameters for topic pre-selection (e.g. ?topic=Accessibility%20Barrier)
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlTopic = searchParams.get('topic');
      if (
        urlTopic &&
        CONTACT_CONFIG.topics.includes(urlTopic as ContactTopic)
      ) {
        setTopic(urlTopic as ContactTopic);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = 'Full name is required.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!topic) {
      newErrors.topic = 'Please select a topic.';
    }

    if (!message.trim()) {
      newErrors.message = 'Message content is required.';
    } else if (message.trim().length < 10) {
      newErrors.message = 'Please provide at least 10 characters describing your inquiry.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const prefilledUrl = buildPrefilledGoogleFormUrl({
        name,
        email,
        topic,
        message,
      });

      setOpenedGoogleFormUrl(prefilledUrl);

      // Open the prefilled Google Form in a new tab
      window.open(prefilledUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to open contact form:', err);
      // Fallback: open basic form URL
      window.open(CONTACT_CONFIG.shortUrl, '_blank', 'noopener,noreferrer');
      setOpenedGoogleFormUrl(CONTACT_CONFIG.shortUrl);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setTopic('General Inquiry');
    setMessage('');
    setErrors({});
    setOpenedGoogleFormUrl(null);
    setIsConfirmedSent(false);
  };

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
            <div className="landing-section-tag">RolePilot Support &amp; Feedback</div>
            <h1 className="info-title">Contact the RolePilot Team</h1>
            <p className="info-subtitle">
              Have a question about candidate readiness, found a bug, or want to share feedback? We review inquiries directly.
            </p>
          </div>

          {/* Submission Status Alert */}
          {isConfirmedSent ? (
            <div
              style={{
                backgroundColor: '#DCFCE7',
                border: '1px solid #BBF7D0',
                borderRadius: '12px',
                padding: '20px 24px',
                marginBottom: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#15803D', fontWeight: 700, fontSize: '1.05rem' }}>
                <CheckCircle2 size={22} />
                <span>Your query has been sent. Please wait for a reply from the RolePilot team.</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#166534', lineHeight: 1.55 }}>
                We appreciate you taking the time to write to us. A team member will follow up at <strong>{email || 'your email'}</strong> as soon as possible.
              </p>
              <div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="auth-btn-secondary"
                  style={{
                    fontSize: '0.85rem',
                    height: '34px',
                    padding: '0 14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '4px',
                  }}
                >
                  <RotateCcw size={14} />
                  <span>Send another inquiry</span>
                </button>
              </div>
            </div>
          ) : openedGoogleFormUrl ? (
            <div
              style={{
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '12px',
                padding: '20px 24px',
                marginBottom: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#1E40AF', fontWeight: 700, fontSize: '1rem' }}>
                <Info size={20} />
                <span>Complete and submit the Google Form to send your query to the RolePilot team</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.55 }}>
                A new browser tab has opened with your details prefilled in our official Google Form. Because Google Forms handles the final delivery externally, please click <strong>Submit</strong> on that page to finalize your query.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setIsConfirmedSent(true)}
                  className="landing-btn-hero-primary"
                  style={{
                    fontSize: '0.875rem',
                    height: '38px',
                    padding: '0 16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Check size={16} />
                  <span>I have submitted the Google Form</span>
                </button>
                <a
                  href={openedGoogleFormUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="auth-btn-secondary"
                  style={{
                    fontSize: '0.875rem',
                    height: '38px',
                    padding: '0 16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={15} />
                  <span>Open Google Form Again</span>
                </a>
                <button
                  type="button"
                  onClick={handleReset}
                  className="auth-btn-secondary"
                  style={{
                    fontSize: '0.875rem',
                    height: '38px',
                    padding: '0 16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RotateCcw size={15} />
                  <span>Start New Inquiry</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* Full Name */}
            <div>
              <label htmlFor="contact-name" style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#101A3A', marginBottom: '8px' }}>
                Full Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Your full name"
                className="blog-search-input"
                style={{ paddingLeft: '16px' }}
                aria-required="true"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'contact-name-error' : undefined}
              />
              {errors.name && (
                <div id="contact-name-error" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontSize: '0.8rem', marginTop: '6px' }}>
                  <AlertCircle size={14} />
                  <span>{errors.name}</span>
                </div>
              )}
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="contact-email" style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#101A3A', marginBottom: '8px' }}>
                Email Address <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="you@example.com"
                className="blog-search-input"
                style={{ paddingLeft: '16px' }}
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'contact-email-error' : undefined}
              />
              {errors.email && (
                <div id="contact-email-error" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontSize: '0.8rem', marginTop: '6px' }}>
                  <AlertCircle size={14} />
                  <span>{errors.email}</span>
                </div>
              )}
            </div>

            {/* Topic Dropdown */}
            <div>
              <label htmlFor="contact-topic" style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#101A3A', marginBottom: '8px' }}>
                Topic <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                id="contact-topic"
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value as ContactTopic);
                  if (errors.topic) setErrors((prev) => ({ ...prev, topic: undefined }));
                }}
                className="blog-search-input"
                style={{ paddingLeft: '14px', height: '48px', cursor: 'pointer' }}
                aria-required="true"
              >
                {CONTACT_CONFIG.topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {errors.topic && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontSize: '0.8rem', marginTop: '6px' }}>
                  <AlertCircle size={14} />
                  <span>{errors.topic}</span>
                </div>
              )}
            </div>

            {/* Message Area */}
            <div>
              <label htmlFor="contact-message" style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#101A3A', marginBottom: '8px' }}>
                Message <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (errors.message) setErrors((prev) => ({ ...prev, message: undefined }));
                }}
                placeholder="Describe your inquiry, feedback, or technical issue in detail..."
                rows={6}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: errors.message ? '1px solid #DC2626' : '1px solid #CBD5E1',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  color: '#101A3A',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
                aria-required="true"
                aria-invalid={!!errors.message}
                aria-describedby={errors.message ? 'contact-message-error' : undefined}
              />
              {errors.message && (
                <div id="contact-message-error" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontSize: '0.8rem', marginTop: '6px' }}>
                  <AlertCircle size={14} />
                  <span>{errors.message}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="landing-btn-hero-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isSubmitting ? 0.7 : 1,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                <Send size={16} />
                <span>{isSubmitting ? 'Preparing Google Form...' : 'Send Message'}</span>
              </button>

              <a
                href={CONTACT_CONFIG.shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#0A66C2',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'none',
                }}
              >
                <span>Or open Google Form directly</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </form>

          {/* Privacy Note */}
          <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid #F1F5F9', fontSize: '0.825rem', color: '#64748B', lineHeight: 1.5 }}>
            Submissions are processed via RolePilot&apos;s verified Google Form response pipeline. Your contact information is used strictly to respond to your inquiry and is never sold or used for marketing.
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
