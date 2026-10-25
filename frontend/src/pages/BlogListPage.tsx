import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  LogIn,
  Search,
  BookOpen,
  Calendar,
  Clock,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import { AuthorCard } from '../components/blog/AuthorCard';
import {
  searchPosts,
  getCategoriesWithCounts,
  type BlogPost,
  type BlogCategory,
} from '../content/blog';
import '../components/auth/auth.css';
import '../components/blog/blog.css';

interface BlogListPageProps {
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
  onNavigateSignup: () => void;
  onNavigateBlogPost: (slug: string) => void;
  onNavigateAbout?: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateGuidelines?: () => void;
  onNavigateSupport?: () => void;
  onNavigateBlog?: () => void;
}

const ITEMS_PER_PAGE = 6;

export const BlogListPage: React.FC<BlogListPageProps> = ({
  onNavigateHome,
  onNavigateLogin,
  onNavigateSignup,
  onNavigateBlogPost,
  onNavigateAbout,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateGuidelines,
  onNavigateSupport,
  onNavigateBlog,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | 'All'>('All');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    document.title = 'Blog & User Guides — RolePilot';
    
    // Inject or update meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      'content',
      'Actionable guides, application readiness scoring walkthroughs, and platform tutorials for RolePilot users.'
    );
  }, []);

  const categories = useMemo(() => getCategoriesWithCounts(), []);

  const filteredPosts = useMemo(() => {
    return searchPosts(searchQuery, selectedCategory);
  }, [searchQuery, selectedCategory]);

  const featuredPost = useMemo(() => {
    if (searchQuery || selectedCategory !== 'All') return null;
    return filteredPosts.find((p) => p.featured) || filteredPosts[0] || null;
  }, [filteredPosts, searchQuery, selectedCategory]);

  const gridPosts = useMemo(() => {
    if (featuredPost) {
      return filteredPosts.filter((p) => p.slug !== featuredPost.slug);
    }
    return filteredPosts;
  }, [filteredPosts, featuredPost]);

  const visibleGridPosts = useMemo(() => {
    return gridPosts.slice(0, visibleCount);
  }, [gridPosts, visibleCount]);

  const hasMore = visibleCount < gridPosts.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
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

      {/* Main Blog Container */}
      <main className="blog-page-container">
        {/* Hero Section */}
        <div className="blog-hero">
          <div className="blog-hero-tag">
            <BookOpen size={14} />
            <span>RolePilot Knowledge Base &amp; Guides</span>
          </div>
          <h1 className="blog-hero-title">Guides, Workflows, and Product Updates</h1>
          <p className="blog-hero-subtitle">
            Actionable walkthroughs on structuring your resume, evaluating candidate readiness, and navigating intentional application automation.
          </p>

          {/* Search Input */}
          <div className="blog-search-wrapper">
            <Search size={18} className="blog-search-icon" />
            <input
              type="text"
              placeholder="Search guides, topics, and workflows..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(ITEMS_PER_PAGE);
              }}
              className="blog-search-input"
              aria-label="Search articles"
            />
          </div>
        </div>

        {/* Category Pills Bar */}
        <nav className="blog-categories-bar" aria-label="Article Categories">
          {categories.map((cat) => (
            <button
              key={cat.category}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.category);
                setVisibleCount(ITEMS_PER_PAGE);
              }}
              className={`blog-category-pill ${selectedCategory === cat.category ? 'active' : ''}`}
            >
              <span>{cat.category}</span>
              <span className="blog-category-count">({cat.count})</span>
            </button>
          ))}
        </nav>

        {/* Featured Article Card (shown when not searching / filtering) */}
        {featuredPost && (
          <article
            className="blog-featured-card"
            onClick={() => onNavigateBlogPost(featuredPost.slug)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigateBlogPost(featuredPost.slug);
              }
            }}
            aria-label={`Featured: ${featuredPost.title}`}
          >
            <div className="blog-card-meta">
              <span className="blog-card-category">{featuredPost.category}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={13} color="#FFAD18" /> Featured Guide
              </span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} /> {featuredPost.publishedAt}
              </span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={13} /> {featuredPost.readingTimeMinutes} min read
              </span>
            </div>

            <h2 className="blog-featured-title">{featuredPost.title}</h2>
            <p className="blog-featured-excerpt">{featuredPost.excerpt}</p>

            <div className="blog-featured-footer">
              <AuthorCard author={featuredPost.author} variant="compact" />
              <span className="blog-read-more-link">
                Read full guide <ArrowRight size={16} />
              </span>
            </div>
          </article>
        )}

        {/* Grid of Articles */}
        {visibleGridPosts.length > 0 ? (
          <div className="blog-grid">
            {visibleGridPosts.map((post: BlogPost) => (
              <article
                key={post.slug}
                className="blog-card"
                onClick={() => onNavigateBlogPost(post.slug)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigateBlogPost(post.slug);
                  }
                }}
                aria-label={post.title}
              >
                <div>
                  <div className="blog-card-meta">
                    <span className="blog-card-category">{post.category}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {post.readingTimeMinutes}m
                    </span>
                  </div>

                  <h3 className="blog-card-title">{post.title}</h3>
                  <p className="blog-card-excerpt">{post.excerpt}</p>
                </div>

                <div className="blog-card-footer">
                  <AuthorCard author={post.author} variant="compact" />
                  <span style={{ color: '#1769E8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    Read <ArrowUpRight size={14} />
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="blog-empty-state">
            <BookOpen size={40} color="#94A3B8" />
            <h3 className="blog-empty-title">No articles found</h3>
            <p className="blog-empty-desc">
              We couldn&apos;t find any guides matching &quot;{searchQuery}&quot; in{' '}
              {selectedCategory === 'All' ? 'all categories' : selectedCategory}.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="auth-btn-secondary"
              style={{ display: 'inline-flex', margin: '0 auto' }}
            >
              Reset Search &amp; Filters
            </button>
          </div>
        )}

        {/* Load More Pagination */}
        {hasMore && (
          <div className="blog-pagination-wrapper">
            <button
              type="button"
              onClick={handleLoadMore}
              className="blog-load-more-btn"
            >
              Load more articles ({gridPosts.length - visibleCount} remaining)
            </button>
          </div>
        )}
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
};
