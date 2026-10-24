import React, { useState } from 'react';
import { Link2, Globe, Check, Edit3, X, Award, Languages, Code2 } from 'lucide-react';
import type { Profile } from '../../types/profile';
import { profileApi } from '../../api/profile';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';

interface AdditionalInfoSectionProps {
  profile: Profile;
  onProfileUpdated: (updated: Profile) => void;
}

export const AdditionalInfoSection: React.FC<AdditionalInfoSectionProps> = ({
  profile,
  onProfileUpdated,
}) => {
  const { showSuccess, showError } = useToast();
  const [isEditingUrls, setIsEditingUrls] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [urls, setUrls] = useState({
    linkedin_url: profile.linkedin_url || '',
    github_url: profile.github_url || '',
    website_url: profile.website_url || '',
  });

  const handleSaveUrls = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updated = await profileApi.updateProfile({
        linkedin_url: urls.linkedin_url || null,
        github_url: urls.github_url || null,
        website_url: urls.website_url || null,
      });
      onProfileUpdated(updated);
      showSuccess('Web links updated successfully!');
      setIsEditingUrls(false);
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card" id="additional-info-section">
      <div className="card-header">
        <h2 className="card-title">
          <Link2 size={20} color="var(--primary)" />
          <span>Web Links & Additional Information</span>
        </h2>
        {!isEditingUrls && (
          <button
            onClick={() => setIsEditingUrls(true)}
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '4px 12px' }}
          >
            <Edit3 size={14} />
            <span>Edit Links</span>
          </button>
        )}
      </div>

      <div className="card-body">
        {/* Professional Profiles */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '12px' }}>
            Professional Portfolios & Social
          </h3>

          {isEditingUrls ? (
            <form onSubmit={handleSaveUrls}>
              <div className="form-group">
                <label className="form-label">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, color: '#0a66c2' }}>in</span>
                    <span>LinkedIn Profile URL</span>
                  </div>
                </label>
                <input
                  type="url"
                  value={urls.linkedin_url}
                  onChange={(e) => setUrls((p) => ({ ...p, linkedin_url: e.target.value }))}
                  className="form-input"
                  placeholder="https://www.linkedin.com/in/yourprofile"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700 }}>gh</span>
                    <span>GitHub Profile URL</span>
                  </div>
                </label>
                <input
                  type="url"
                  value={urls.github_url}
                  onChange={(e) => setUrls((p) => ({ ...p, github_url: e.target.value }))}
                  className="form-input"
                  placeholder="https://github.com/yourusername"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Globe size={14} color="#057642" />
                    <span>Personal Portfolio / Website URL</span>
                  </div>
                </label>
                <input
                  type="url"
                  value={urls.website_url}
                  onChange={(e) => setUrls((p) => ({ ...p, website_url: e.target.value }))}
                  className="form-input"
                  placeholder="https://yourportfolio.dev"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditingUrls(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  <X size={16} />
                  <span>Cancel</span>
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  <Check size={16} />
                  <span>{isSubmitting ? 'Saving...' : 'Save Links'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                <div
                  style={{
                    backgroundColor: '#0a66c2',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    width: '20px',
                    height: '20px',
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  in
                </div>
                {profile.linkedin_url ? (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--primary)', textDecoration: 'none', wordBreak: 'break-all' }}
                  >
                    {profile.linkedin_url}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-subtle)' }}>No LinkedIn profile URL set</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                <div
                  style={{
                    backgroundColor: '#24292f',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    width: '20px',
                    height: '20px',
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  GH
                </div>
                {profile.github_url ? (
                  <a
                    href={profile.github_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--primary)', textDecoration: 'none', wordBreak: 'break-all' }}
                  >
                    {profile.github_url}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-subtle)' }}>No GitHub profile URL set</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                <Globe size={18} color="#057642" />
                {profile.website_url ? (
                  <a
                    href={profile.website_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--primary)', textDecoration: 'none', wordBreak: 'break-all' }}
                  >
                    {profile.website_url}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-subtle)' }}>No personal portfolio URL set</span>
                )}
              </div>
            </div>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '20px 0' }} />

        {/* Placeholders for Certifications, Languages, Projects */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Award size={18} color="var(--primary)" />
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Certifications</h4>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
              No certifications added yet. (Backend sync coming soon)
            </p>
          </div>

          <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Languages size={18} color="var(--primary)" />
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Languages</h4>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
              No languages recorded yet. (Backend sync coming soon)
            </p>
          </div>

          <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Code2 size={18} color="var(--primary)" />
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Featured Projects</h4>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
              No featured projects added yet. (Backend sync coming soon)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
