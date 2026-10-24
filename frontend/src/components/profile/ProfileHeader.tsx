import React from 'react';
import { MapPin, Mail, Briefcase, Clock, Edit2 } from 'lucide-react';
import type { Profile } from '../../types/profile';

interface ProfileHeaderProps {
  profile: Profile;
  onEditClick: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ profile, onEditClick }) => {
  const firstName = profile.first_name || '';
  const lastName = profile.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Candidate Profile';
  const initials =
    (firstName[0] || '') + (lastName[0] || '') || fullName.slice(0, 2).toUpperCase() || 'LH';

  const locationParts = [profile.city, profile.state, profile.country].filter(Boolean);
  const locationStr = locationParts.join(', ') || 'Location not provided';

  const totalExpStr =
    profile.experience_years !== null && profile.experience_years !== undefined
      ? `${profile.experience_years}y ${profile.experience_months || 0}m exp`
      : null;

  return (
    <div className="card" style={{ padding: '0', position: 'relative', overflow: 'hidden' }}>
      {/* Banner background */}
      <div
        style={{
          height: '110px',
          background: 'linear-gradient(135deg, #0a66c2 0%, #004182 50%, #0f172a 100%)',
        }}
      />

      <div style={{ padding: '0 24px 24px 24px', position: 'relative' }}>
        {/* Avatar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '-48px', marginBottom: '16px' }}>
          <div
            style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              backgroundColor: '#0a66c2',
              color: '#ffffff',
              border: '4px solid #ffffff',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              fontWeight: 700,
              letterSpacing: '1px',
              userSelect: 'none',
            }}
          >
            {initials}
          </div>

          <button
            onClick={onEditClick}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Edit2 size={16} />
            <span>Edit Profile</span>
          </button>
        </div>

        {/* Profile Info */}
        <div style={{ maxWidth: '780px' }}>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
            {fullName}
          </h1>

          <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 500 }}>
            {profile.headline || (profile.experiences?.[0] ? `${profile.experiences[0].job_title} at ${profile.experiences[0].company_name}` : 'No professional headline set')}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={16} color="var(--primary)" />
              <span>{locationStr}</span>
            </div>

            {profile.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={16} color="var(--primary)" />
                <span>{profile.email}</span>
              </div>
            )}

            {totalExpStr && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Briefcase size={16} color="var(--primary)" />
                <span>{totalExpStr}</span>
              </div>
            )}

            {profile.notice_period_days !== null && profile.notice_period_days !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="var(--primary)" />
                <span>{profile.notice_period_days} days notice</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
