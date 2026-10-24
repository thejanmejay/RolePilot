import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Save,
  IndianRupee,
  Clock,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import type { Profile, ProfileUpdate } from '../../types/profile';
import { profileApi } from '../../api/profile';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';

interface ApplicationPreferencesSectionProps {
  profile: Profile;
  onProfileUpdated: (updated: Profile) => void;
}

export const ApplicationPreferencesSection: React.FC<ApplicationPreferencesSectionProps> = ({
  profile,
  onProfileUpdated,
}) => {
  const { showSuccess, showError } = useToast();

  const [noticePeriodDays, setNoticePeriodDays] = useState<number>(profile.notice_period_days ?? 30);
  const [currentCtc, setCurrentCtc] = useState<string>(profile.current_ctc != null ? String(profile.current_ctc) : '');
  const [expectedCtc, setExpectedCtc] = useState<string>(profile.expected_ctc != null ? String(profile.expected_ctc) : '');
  const [authorizedToWork, setAuthorizedToWork] = useState<boolean>(profile.authorized_to_work ?? true);
  const [willingToRelocate, setWillingToRelocate] = useState<boolean>(profile.willing_to_relocate ?? true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setNoticePeriodDays(profile.notice_period_days ?? 30);
    setCurrentCtc(profile.current_ctc != null ? String(profile.current_ctc) : '');
    setExpectedCtc(profile.expected_ctc != null ? String(profile.expected_ctc) : '');
    setAuthorizedToWork(profile.authorized_to_work ?? true);
    setWillingToRelocate(profile.willing_to_relocate ?? true);
    setIsDirty(false);
  }, [profile]);

  const handleFieldChange = () => {
    setIsDirty(true);
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload: ProfileUpdate = {
      notice_period_days: noticePeriodDays != null ? Number(noticePeriodDays) : null,
      current_ctc: currentCtc.trim() ? parseFloat(currentCtc) : null,
      expected_ctc: expectedCtc.trim() ? parseFloat(expectedCtc) : null,
      authorized_to_work: authorizedToWork,
      willing_to_relocate: willingToRelocate,
    };

    try {
      const updated = await profileApi.updateProfile(payload);
      showSuccess('Application preferences saved successfully!');
      setIsDirty(false);
      onProfileUpdated(updated);
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const noticePresets = [
    { label: 'Immediate (0d)', days: 0 },
    { label: '15 Days', days: 15 },
    { label: '30 Days (1 mo)', days: 30 },
    { label: '60 Days (2 mos)', days: 60 },
    { label: '90 Days (3 mos)', days: 90 },
  ];

  return (
    <div className="card" id="application-preferences-section" style={{ marginBottom: '24px' }}>
      <form onSubmit={handleSavePreferences}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="card-title">
              <SlidersHorizontal size={20} color="var(--primary)" />
              <span>Application Preferences & Screening Answers</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              These parameters are directly consumed by the automation engine to answer mandatory employer screening questions.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Save size={14} />
            <span>{isSubmitting ? 'Saving...' : isDirty ? 'Save Preferences' : 'Saved'}</span>
          </button>
        </div>

        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {/* 1. Notice Period */}
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Clock size={15} color="var(--primary)" />
                <span style={{ fontWeight: 600 }}>Notice Period (in Days)</span>
                <span style={{ color: 'var(--danger)' }}>*</span>
              </label>

              {/* Quick Presets */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {noticePresets.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => {
                      setNoticePeriodDays(preset.days);
                      handleFieldChange();
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '14px',
                      border: noticePeriodDays === preset.days ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                      backgroundColor: noticePeriodDays === preset.days ? 'var(--primary-light)' : 'var(--bg-subtle, #f8fafc)',
                      color: noticePeriodDays === preset.days ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: noticePeriodDays === preset.days ? 600 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  min="0"
                  max="180"
                  className="input"
                  value={noticePeriodDays}
                  onChange={(e) => {
                    setNoticePeriodDays(Math.max(0, parseInt(e.target.value) || 0));
                    handleFieldChange();
                  }}
                  required
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>days</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', display: 'block', marginTop: '4px' }}>
                Used for: "What is your official notice period?" or "How soon can you join?"
              </span>
            </div>

            {/* 2. Expected CTC */}
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <IndianRupee size={15} color="var(--primary)" />
                <span style={{ fontWeight: 600 }}>Expected CTC (Annual / ₹)</span>
                <span style={{ color: 'var(--danger)' }}>* Blocker</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    fontSize: '0.9rem',
                  }}
                >
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 1200000 (12 LPA) or 12"
                  className="input"
                  style={{ paddingLeft: '28px' }}
                  value={expectedCtc}
                  onChange={(e) => {
                    setExpectedCtc(e.target.value);
                    handleFieldChange();
                  }}
                  required
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', display: 'block', marginTop: '4px' }}>
                Used for: "What are your salary expectations?" or "Expected CTC"
              </span>
            </div>

            {/* 3. Current CTC */}
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <IndianRupee size={15} color="var(--text-muted)" />
                <span style={{ fontWeight: 600 }}>Current CTC (Annual / ₹)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>(Optional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    fontSize: '0.9rem',
                  }}
                >
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 800000 (8 LPA)"
                  className="input"
                  style={{ paddingLeft: '28px' }}
                  value={currentCtc}
                  onChange={(e) => {
                    setCurrentCtc(e.target.value);
                    handleFieldChange();
                  }}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', display: 'block', marginTop: '4px' }}>
                Used for: "What is your current fixed CTC?"
              </span>
            </div>

            {/* 4. Work Authorization & Relocation Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
              {/* Work Authorization */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ paddingRight: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    <ShieldCheck size={16} color="var(--success)" />
                    <span>Legally Authorized to Work</span>
                    <span style={{ color: 'var(--danger)' }}>*</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Answers "Are you legally authorized to work without sponsorship?"
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthorizedToWork(true);
                      handleFieldChange();
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: authorizedToWork ? '1px solid var(--success)' : '1px solid var(--border-light)',
                      backgroundColor: authorizedToWork ? 'var(--success-bg)' : 'transparent',
                      color: authorizedToWork ? 'var(--success)' : 'var(--text-muted)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthorizedToWork(false);
                      handleFieldChange();
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: !authorizedToWork ? '1px solid var(--danger)' : '1px solid var(--border-light)',
                      backgroundColor: !authorizedToWork ? 'var(--danger-bg)' : 'transparent',
                      color: !authorizedToWork ? 'var(--danger)' : 'var(--text-muted)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    No
                  </button>
                </div>
              </div>

              {/* Willing to Relocate */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ paddingRight: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    <MapPin size={16} color="var(--primary)" />
                    <span>Willing to Relocate</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Answers "Are you willing to relocate or travel for this position?"
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setWillingToRelocate(true);
                      handleFieldChange();
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: willingToRelocate ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                      backgroundColor: willingToRelocate ? 'var(--primary-light)' : 'transparent',
                      color: willingToRelocate ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWillingToRelocate(false);
                      handleFieldChange();
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: !willingToRelocate ? '1px solid var(--danger)' : '1px solid var(--border-light)',
                      backgroundColor: !willingToRelocate ? 'var(--danger-bg)' : 'transparent',
                      color: !willingToRelocate ? 'var(--danger)' : 'var(--text-muted)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
