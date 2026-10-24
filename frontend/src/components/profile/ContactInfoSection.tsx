import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Link2,
  Code2,
  Globe,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import type { Profile, ProfileUpdate } from '../../types/profile';
import { profileApi } from '../../api/profile';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';

interface ContactInfoSectionProps {
  profile: Profile;
  onProfileUpdated: (updated: Profile) => void;
  isEditingExternal?: boolean;
  setIsEditingExternal?: (editing: boolean) => void;
}

export const ContactInfoSection: React.FC<ContactInfoSectionProps> = ({
  profile,
  onProfileUpdated,
  isEditingExternal,
  setIsEditingExternal,
}) => {
  const { showSuccess, showError } = useToast();
  const [internalEditing, setInternalEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = isEditingExternal !== undefined ? isEditingExternal : internalEditing;
  const setEditing = (val: boolean) => {
    if (setIsEditingExternal) setIsEditingExternal(val);
    setInternalEditing(val);
  };

  const [formData, setFormData] = useState<ProfileUpdate>({
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    city: profile.city || '',
    state: profile.state || '',
    country: profile.country || 'India',
    linkedin_url: profile.linkedin_url || '',
    github_url: profile.github_url || '',
    website_url: profile.website_url || '',
  });

  useEffect(() => {
    setFormData({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      city: profile.city || '',
      state: profile.state || '',
      country: profile.country || 'India',
      linkedin_url: profile.linkedin_url || '',
      github_url: profile.github_url || '',
      website_url: profile.website_url || '',
    });
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updated = await profileApi.updateProfile({
        ...formData,
        first_name: formData.first_name?.trim() || null,
        last_name: formData.last_name?.trim() || null,
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        city: formData.city?.trim() || null,
        state: formData.state?.trim() || null,
        country: formData.country?.trim() || null,
        linkedin_url: formData.linkedin_url?.trim() || null,
        github_url: formData.github_url?.trim() || null,
        website_url: formData.website_url?.trim() || null,
      });
      onProfileUpdated(updated);
      showSuccess('Contact & profile information saved successfully!');
      setEditing(false);
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      city: profile.city || '',
      state: profile.state || '',
      country: profile.country || 'India',
      linkedin_url: profile.linkedin_url || '',
      github_url: profile.github_url || '',
      website_url: profile.website_url || '',
    });
    setEditing(false);
  };

  return (
    <div className="card" id="contact-info-section" style={{ marginBottom: '24px' }}>
      <div className="card-header">
        <h2 className="card-title" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
          <User size={20} color="var(--primary)" />
          <span>Contact & Basic Information</span>
        </h2>
        {!isEditing && (
          <button
            onClick={() => setEditing(true)}
            className="btn btn-outline"
            style={{ fontSize: '0.82rem', padding: '6px 14px', minHeight: '36px' }}
          >
            <Edit3 size={14} />
            <span>Edit Contact Info</span>
          </button>
        )}
      </div>

      <div className="card-body">
        {isEditing ? (
          <form onSubmit={handleSave}>
            {/* Name Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  First Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name || ''}
                  onChange={handleChange}
                  placeholder="e.g. Janmejay"
                  required
                  className="form-control"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '4px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Last Name
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name || ''}
                  onChange={handleChange}
                  placeholder="e.g. Singh"
                  className="form-control"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '4px' }}
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Email Address <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  placeholder="e.g. janmejay@example.com"
                  required
                  className="form-control"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '4px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Mobile Phone Number <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  placeholder="e.g. +91 9876543210"
                  required
                  className="form-control"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '4px' }}
                />
              </div>
            </div>

            {/* Location Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  City <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city || ''}
                  onChange={handleChange}
                  placeholder="e.g. Noida / New Delhi"
                  required
                  className="form-control"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '4px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  State / Province
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state || ''}
                  onChange={handleChange}
                  placeholder="e.g. Uttar Pradesh"
                  className="form-control"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '4px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Country <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country || ''}
                  onChange={handleChange}
                  placeholder="e.g. India"
                  required
                  className="form-control"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '4px' }}
                />
              </div>
            </div>

            {/* Online Links (LinkedIn, GitHub, Portfolio) */}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginBottom: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '12px' }}>
                Professional Web Links
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Link2 size={14} color="#0a66c2" />
                    <span>LinkedIn Profile URL</span>
                  </label>
                  <input
                    type="url"
                    name="linkedin_url"
                    value={formData.linkedin_url || ''}
                    onChange={handleChange}
                    placeholder="https://linkedin.com/in/username"
                    className="form-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Code2 size={14} />
                    <span>GitHub Profile URL</span>
                  </label>
                  <input
                    type="url"
                    name="github_url"
                    value={formData.github_url || ''}
                    onChange={handleChange}
                    placeholder="https://github.com/username"
                    className="form-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Globe size={14} color="var(--primary)" />
                    <span>Portfolio / Personal Website</span>
                  </label>
                  <input
                    type="url"
                    name="website_url"
                    value={formData.website_url || ''}
                    onChange={handleChange}
                    placeholder="https://yourportfolio.com"
                    className="form-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '4px' }}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={handleCancel}
                className="btn btn-secondary"
                disabled={isSubmitting}
                style={{ padding: '8px 16px', minHeight: '40px' }}
              >
                <X size={15} />
                <span>Cancel</span>
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{ padding: '8px 20px', minHeight: '40px' }}
              >
                <Check size={15} />
                <span>{isSubmitting ? 'Saving...' : 'Save Contact Info'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div>
            {/* View Mode Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '20px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Full Name
                </div>
                <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                  {profile.first_name || profile.last_name
                    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                    : <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>Name missing (Blocker)</span>}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Mail size={13} />
                  <span>Email Address</span>
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                  {profile.email || <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>Email missing (Blocker)</span>}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={13} />
                  <span>Phone Number</span>
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                  {profile.phone || <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>Phone missing (Blocker)</span>}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={13} />
                  <span>Location</span>
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                  {[profile.city, profile.state, profile.country].filter(Boolean).join(', ') || (
                    <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>City/Country missing</span>
                  )}
                </div>
              </div>
            </div>

            {/* Web Links Row */}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {profile.linkedin_url ? (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                  style={{ fontSize: '0.82rem', padding: '6px 12px', minHeight: '34px', gap: '6px' }}
                >
                  <Link2 size={14} color="#0a66c2" />
                  <span>LinkedIn Profile</span>
                </a>
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Link2 size={14} />
                  <span>No LinkedIn URL</span>
                </span>
              )}

              {profile.github_url && (
                <a
                  href={profile.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                  style={{ fontSize: '0.82rem', padding: '6px 12px', minHeight: '34px', gap: '6px' }}
                >
                  <Code2 size={14} />
                  <span>GitHub Profile</span>
                </a>
              )}

              {profile.website_url && (
                <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                  style={{ fontSize: '0.82rem', padding: '6px 12px', minHeight: '34px', gap: '6px' }}
                >
                  <Globe size={14} color="var(--primary)" />
                  <span>Portfolio Site</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
