import React, { useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  LogIn,
  Calendar,
  Clock,
  ChevronRight,
  AlertCircle,
  HelpCircle,
  BookOpen,
  ArrowUpRight,
} from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import { AuthorCard } from '../components/blog/AuthorCard';
import { getPostBySlug, getRelatedPosts, type BlogPost } from '../content/blog';
import '../components/auth/auth.css';
import '../components/blog/blog.css';

interface BlogPostPageProps {
  slug: string;
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
  onNavigateSignup: () => void;
  onNavigateBlog: () => void;
  onNavigateBlogPost: (slug: string) => void;
  onNavigateAbout?: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateGuidelines?: () => void;
  onNavigateSupport?: () => void;
  isAuthenticated?: boolean;
  onNavigateDashboard?: () => void;
}

export const BlogPostPage: React.FC<BlogPostPageProps> = ({
  slug,
  onNavigateHome,
  onNavigateLogin,
  onNavigateSignup,
  onNavigateBlog,
  onNavigateBlogPost,
  onNavigateAbout,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateGuidelines,
  onNavigateSupport,
  isAuthenticated,
  onNavigateDashboard,
}) => {
  const post: BlogPost | undefined = useMemo(() => getPostBySlug(slug), [slug]);
  const relatedPosts = useMemo(() => (post ? getRelatedPosts(post, 3) : []), [post]);

  useEffect(() => {
    if (!post) {
      document.title = 'Article Not Found — RolePilot';
      return;
    }

    // Update document title
    document.title = `${post.seoTitle || post.title} — RolePilot`;

    // Dynamic SEO meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', post.seoDescription || post.excerpt);

    // Canonical link
    const canonicalUrl = `https://rolepilot-frontend-phi.vercel.app/blog/${post.slug}`;
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', canonicalUrl);

    // Structured JSON-LD Article Data
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.excerpt,
      image: 'https://rolepilot-frontend-phi.vercel.app/rolepilot-logo-transparent.png',
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      author: {
        '@type': 'Person',
        name: post.author.name,
        jobTitle: post.author.title,
        url: post.author.linkedIn,
      },
      publisher: {
        '@type': 'Organization',
        name: 'RolePilot',
        logo: {
          '@type': 'ImageObject',
          url: 'https://rolepilot-frontend-phi.vercel.app/rolepilot-logo-transparent.png',
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl,
      },
    };

    let scriptLd = document.getElementById('rolepilot-article-jsonld');
    if (!scriptLd) {
      scriptLd = document.createElement('script');
      scriptLd.setAttribute('type', 'application/ld+json');
      scriptLd.setAttribute('id', 'rolepilot-article-jsonld');
      document.head.appendChild(scriptLd);
    }
    scriptLd.textContent = JSON.stringify(structuredData);

    return () => {
      // Clean up script on unmount
      const existingScript = document.getElementById('rolepilot-article-jsonld');
      if (existingScript) existingScript.remove();
    };
  }, [post]);

  if (!post) {
    return (
      <div className="landing-wrapper">
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
                onClick={onNavigateBlog}
                className="auth-back-link"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ArrowLeft size={16} />
                <span>Back to Blog</span>
              </button>
            </div>
          </div>
        </header>

        <main className="article-detail-container" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <AlertCircle size={48} color="#DC2626" style={{ margin: '0 auto 16px' }} />
          <h1 className="blog-empty-title" style={{ fontSize: '1.75rem' }}>
            Article Not Found
          </h1>
          <p className="blog-empty-desc" style={{ maxWidth: '480px', margin: '0 auto 24px' }}>
            The guide or article you are looking for ({slug}) does not exist or has been relocated.
          </p>
          <button
            type="button"
            onClick={onNavigateBlog}
            className="landing-btn-hero-primary"
            style={{ display: 'inline-flex', margin: '0 auto' }}
          >
            <BookOpen size={16} />
            <span>Browse All Guides</span>
          </button>
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
        />
      </div>
    );
  }

  return (
    <div className="landing-wrapper">
      {/* Top Header */}
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
              onClick={onNavigateBlog}
              className="auth-back-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={16} />
              <span>All Guides</span>
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

      {/* Main Article Container */}
      <main className="article-detail-container">
        {/* Breadcrumb Navigation */}
        <nav className="article-breadcrumbs" aria-label="Breadcrumb">
          <span
            onClick={onNavigateHome}
            role="link"
            tabIndex={0}
            className="article-breadcrumb-link"
            style={{ cursor: 'pointer' }}
          >
            Home
          </span>
          <ChevronRight size={14} />
          <span
            onClick={onNavigateBlog}
            role="link"
            tabIndex={0}
            className="article-breadcrumb-link"
            style={{ cursor: 'pointer' }}
          >
            Blog
          </span>
          <ChevronRight size={14} />
          <span className="article-breadcrumb-link">{post.category}</span>
          <ChevronRight size={14} />
          <span className="article-breadcrumb-current">{post.title}</span>
        </nav>

        {/* Article Card Main */}
        <article className="article-card-main">
          {/* Header */}
          <header className="article-header">
            <span className="blog-card-category">{post.category}</span>
            <h1 className="article-title">{post.title}</h1>
            <p className="article-excerpt">{post.excerpt}</p>

            <div className="article-meta-row">
              <AuthorCard author={post.author} variant="compact" />
              <div className="article-meta-details">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={14} /> Published: {post.publishedAt}
                </span>
                <span>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Clock size={14} /> {post.readingTimeMinutes} min read
                </span>
              </div>
            </div>
          </header>

          {/* Prerequisites Checklist */}
          {post.prerequisites && post.prerequisites.length > 0 && (
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '20px 24px',
                marginBottom: '32px',
              }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#101A3A', margin: '0 0 10px' }}>
                Prerequisites for this Guide:
              </h3>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.925rem', color: '#475569', lineHeight: 1.6 }}>
                {post.prerequisites.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Article Sections */}
          {post.sections.map((section, idx) => (
            <section key={idx} className="article-section">
              <h2>{section.heading}</h2>

              {section.body.map((paragraph, pIdx) => (
                <p key={pIdx}>{paragraph}</p>
              ))}

              {/* Numbered Steps */}
              {section.steps && section.steps.length > 0 && (
                <div className="article-steps-list">
                  {section.steps.map((st) => (
                    <div key={st.stepNumber} className="article-step-item">
                      <div className="article-step-number">{st.stepNumber}</div>
                      <div className="article-step-content">
                        <h4>{st.title}</h4>
                        <p>{st.instruction}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Subsections */}
              {section.subsections &&
                section.subsections.map((sub, sIdx) => (
                  <div key={sIdx} style={{ marginTop: '16px' }}>
                    <h3>{sub.title}</h3>
                    {sub.paragraphs.map((subP, spIdx) => (
                      <p key={spIdx}>{subP}</p>
                    ))}
                  </div>
                ))}

              {/* Callouts */}
              {section.callout && (
                <div className={`article-callout ${section.callout.type}`}>
                  <div className="article-callout-title">{section.callout.title}</div>
                  <p className="article-callout-text">{section.callout.text}</p>
                </div>
              )}
            </section>
          ))}

          {/* FAQs Section */}
          {post.faqs && post.faqs.length > 0 && (
            <section className="article-faqs-section" aria-labelledby="faqs-heading">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <HelpCircle size={22} color="#1769E8" />
                <h2 id="faqs-heading" style={{ fontSize: '1.35rem', margin: 0 }}>
                  Frequently Asked Questions
                </h2>
              </div>
              {post.faqs.map((faq, fIdx) => (
                <div key={fIdx} className="article-faq-item">
                  <h3 className="article-faq-question">{faq.question}</h3>
                  <p className="article-faq-answer">{faq.answer}</p>
                </div>
              ))}
            </section>
          )}

          {/* Author Profile Footer */}
          <AuthorCard author={post.author} variant="full" />
        </article>

        {/* Related Articles */}
        {relatedPosts.length > 0 && (
          <section className="article-related-section" aria-labelledby="related-heading">
            <h2 id="related-heading" className="article-related-title">
              Related Guides &amp; Workflows
            </h2>
            <div className="article-related-grid">
              {relatedPosts.map((rel: BlogPost) => (
                <div
                  key={rel.slug}
                  className="article-related-card"
                  onClick={() => onNavigateBlogPost(rel.slug)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNavigateBlogPost(rel.slug);
                    }
                  }}
                  aria-label={rel.title}
                >
                  <span className="blog-card-category" style={{ fontSize: '0.7rem' }}>
                    {rel.category}
                  </span>
                  <h3 className="article-related-card-title">{rel.title}</h3>
                  <div className="article-related-card-meta">
                    {rel.readingTimeMinutes} min read • {rel.publishedAt}
                  </div>
                  <div style={{ color: '#1769E8', fontSize: '0.8rem', fontWeight: 600, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <span>Read guide</span> <ArrowUpRight size={13} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
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
        onNavigateLogin={onNavigateLogin}
        onNavigateSignup={onNavigateSignup}
        isAuthenticated={isAuthenticated}
        onNavigateDashboard={onNavigateDashboard}
      />
    </div>
  );
};
