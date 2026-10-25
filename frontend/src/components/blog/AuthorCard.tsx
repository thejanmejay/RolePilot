import React from 'react';
import { BLOG_AUTHOR, type AuthorProfile } from '../../content/blog/author';

interface AuthorCardProps {
  author?: AuthorProfile;
  variant?: 'compact' | 'full' | 'inline';
}

const LinkedInIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

export const AuthorCard: React.FC<AuthorCardProps> = ({
  author = BLOG_AUTHOR,
  variant = 'full',
}) => {
  if (variant === 'inline') {
    return (
      <div className="blog-author-inline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <img
          src={author.avatarUrl}
          alt={author.name}
          className="blog-author-avatar-sm"
          style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#101A3A' }}>
            {author.name}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
            {author.title}
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="blog-author-compact">
        <img
          src={author.avatarUrl}
          alt={author.name}
          className="blog-author-avatar-sm"
          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
        />
        <div className="blog-author-info">
          <span className="blog-author-name">{author.name}</span>
          <span className="blog-author-title">{author.title}</span>
        </div>
      </div>
    );
  }

  return (
    <aside className="blog-author-card" aria-label="Author Profile">
      <div className="blog-author-header">
        <img
          src={author.avatarUrl}
          alt={author.name}
          className="blog-author-avatar-lg"
          width={64}
          height={64}
        />
        <div className="blog-author-main">
          <div className="blog-author-name-row">
            <h3 className="blog-author-name">{author.name}</h3>
            <a
              href={author.linkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className="blog-author-linkedin-link"
              aria-label={`${author.name} on LinkedIn`}
              title="View LinkedIn Profile"
            >
              <LinkedInIcon size={16} />
              <span>LinkedIn</span>
            </a>
          </div>
          <div className="blog-author-title">{author.title}</div>
        </div>
      </div>
      <p className="blog-author-bio">{author.bio}</p>
    </aside>
  );
};
