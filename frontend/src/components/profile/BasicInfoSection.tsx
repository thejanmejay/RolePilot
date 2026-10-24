import React, { useState } from 'react';
import { User, Edit3, Check, X } from 'lucide-react';
import type { Profile, ProfileUpdate } from '../../types/profile';
import { profileApi } from '../../api/profile';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';

interface BasicInfoSectionProps {
  profile: Profile;
  onProfileUpdated: (updated: Profile) => void;
  isEditingExternal?: boolean;
  setIsEditingExternal?: (editing: boolean) => void;
}

export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
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
    experience_years: profile.experience_years ?? 0,
    experience_months: profile.experience_months ?? 0,
    notice_period_days: profile.notice_period_days ?? 30,
    current_ctc: profile.current_ctc ?? null,
    expected_ctc: profile.expected_ctc ?? null,
    authorized_to_work: profile.authorized_to_work ?? true,
    willing_to_relocate: profile.willing_to_relocate ?? true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData((prev) => ({ ...prev, [name]: value === '' ? null : Number(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updated = await profileApi.updateProfile(formData);
      onProfileUpdated(updated);
      showSuccess('Profile information updated successfully!');
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
      experience_years: profile.experience_years ?? 0,
      experience_months: profile.experience_months ?? 0,
      notice_period_days: profile.notice_period_days ?? 30,
      current_ctc: profile.current_ctc ?? null,
      expected_ctc: profile.expected_ctc ?? null,
      authorized_to_work: profile.authorized_to_work ?? true,
      willing_to_relocate: profile.willing_to_relocate ?? true,
    });
    setEditing(false);
  };

  return (
    <div className="card" id="basic-info">
      <div className="card-header">
        <h2 className="card-title">
          <User size={20} color="var(--primary)" />
          <span>Basic Information</span>
        </h2>
        {!isEditing && (
          <button
            onClick={() => setEditing(true)}
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '4px 12px' }}
          >
            <Edit3 size={14} />
            <span>Edit</span>
          </button>
        )}
      </div>

      <div className="card-body">
        {isEditing ? (
          <form onSubmit={handleSave}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name || ''}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. Jane"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name || ''}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. Doe"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. jane@example.com"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. +91 9876543210"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city || ''}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. Noida / Bengaluru"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country || ''}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. India"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Total Experience (Years & Months)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    name="experience_years"
                    min="0"
                    max="50"
                    value={formData.experience_years ?? 0}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Years"
                  />
                  <input
                    type="number"
                    name="experience_months"
                    min="0"
                    max="11"
                    value={formData.experience_months ?? 0}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Months (0-11)"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notice Period (Days)</label>
                <input
                  type="number"
                  name="notice_period_days"
                  min="0"
                  max="365"
                  value={formData.notice_period_days ?? 30}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. 30"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Current CTC (LPA / INR)</label>
                <input
                  type="number"
                  name="current_ctc"
                  value={formData.current_ctc ?? ''}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. 800000"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Expected CTC (LPA / INR)</label>
                <input
                  type="number"
                  name="expected_ctc"
                  value={formData.expected_ctc ?? ''}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. 1200000"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '24px', margin: '16px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  name="authorized_to_work"
                  checked={formData.authorized_to_work ?? true}
                  onChange={handleChange}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>Authorized to work in targeted location</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  name="willing_to_relocate"
                  checked={formData.willing_to_relocate ?? true}
                  onChange={handleChange}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>Willing to relocate</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={handleCancel} className="btn btn-secondary" disabled={isSubmitting}>
                <X size={16} />
                <span>Cancel</span>
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                <Check size={16} />
                <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Full Name
              </span>
              <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '2px' }}>
                {`${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Not specified'}
              </p>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Email
              </span>
              <p style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '2px' }}>
                {profile.email || 'Not specified'}
              </p>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Phone
              </span>
              <p style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '2px' }}>
                {profile.phone && profile.phone !== 'YOUR_PHONE_NUMBER' ? profile.phone : 'Not provided'}
              </p>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Location
              </span>
              <p style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '2px' }}>
                {[profile.city, profile.state, profile.country].filter(Boolean).join(', ') || 'Not provided'}
              </p>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Experience
              </span>
              <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '2px' }}>
                {profile.experience_years !== null && profile.experience_years !== undefined
                  ? `${profile.experience_years} Years ${profile.experience_months || 0} Months`
                  : 'Not provided'}
              </p>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Notice Period
              </span>
              <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '2px' }}>
                {profile.notice_period_days !== null && profile.notice_period_days !== undefined
                  ? `${profile.notice_period_days} Days`
                  : 'Not provided'}
              </p>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Current CTC / Expected CTC
              </span>
              <p style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '2px' }}>
                {profile.current_ctc ? `₹${profile.current_ctc.toLocaleString()}` : 'Not provided'} /{' '}
                {profile.expected_ctc ? `₹${profile.expected_ctc.toLocaleString()}` : 'Not provided'}
              </p>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Work Authorization & Relocation
              </span>
              <p style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '2px' }}>
                {profile.authorized_to_work ? 'Authorized' : 'Need Visa'} • {profile.willing_to_relocate ? 'Can Relocate' : 'No Relocation'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
